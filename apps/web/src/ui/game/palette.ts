/**
 * Command palette entries (M12.3): "go to X", the actions available where the player stands, and
 * the view/turn shortcuts, as one searchable list. Pure over a store snapshot so the wording and the
 * search are unit-testable; the component only renders and runs them.
 */
import type { GameStore } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { commandLabel, locationName, previewParts, sectionOf, type Translate } from './labels';

export interface PaletteEntry {
  id: string;
  label: string;
  /** Second line: what it costs or where it leads. */
  hint: string;
  /** Lower-cased text the query is matched against. */
  haystack: string;
  run: () => void;
}

export const MAX_PALETTE_RESULTS = 8;

export function buildPaletteEntries(store: GameStore, t: Translate): PaletteEntry[] {
  const { state, pack } = store;
  if (!state || !pack) return [];
  const player = state.players[state.activeSeat];
  // Never offer actions for a rival's seat (an AI turn, or another player's hotseat turn).
  if (player?.controller !== 'human-local') return [];
  const opaque = state.config.classicOpacity;
  const out: PaletteEntry[] = [];
  const add = (id: string, label: string, hint: string, run: () => void, extra = '') =>
    out.push({ id, label, hint, run, haystack: `${label} ${hint} ${extra}`.toLowerCase() });

  // Things to do right here. Only legal ones: the panel already explains the locked ones.
  for (const { cmd, code } of store.candidates()) {
    if (code !== null || cmd.type === 'Move' || cmd.type === 'EndTurn') continue;
    const preview = store.preview(cmd);
    add(
      `cmd:${JSON.stringify(cmd)}`,
      commandLabel(cmd, t),
      preview ? previewParts(preview, t, { opaque }).join(' · ') : '',
      () => {
        if (!store.requestConfirm(cmd)) store.dispatch(cmd);
      },
      `${cmd.type} ${sectionOf(cmd) ?? ''}`,
    );
  }

  // Places.
  for (const loc of pack.board.locationAt) {
    if (loc === null) continue;
    const here = player.location === loc;
    const trip = here ? null : store.preview({ type: 'Move', to: loc, mode: 'walk' });
    add(
      `go:${loc}`,
      t('palette.go', { place: locationName(loc) }),
      here ? t('palette.here') : trip ? t('palette.trip', { n: Math.abs(trip.hours) / 2 }) : '',
      () => {
        if (here) store.selectLocation(loc);
        else store.openTravel(loc);
      },
      loc,
    );
  }

  add('act:end', t('palette.endTurn'), t('palette.endTurnHint'), () => {
    store.requestEndTurn();
  });
  if (store.undoStack.length > 0 && !useSettings.getState().settings.strictMode)
    add('act:undo', t('hud.undo'), t('hud.undoHint'), () => {
      store.undoLast();
    });
  add('act:standings', t('hud.standings'), '', store.toggleStandings);
  add('act:log', t('log.heading'), '', store.toggleLog);
  add('act:help', t('menu.help'), '', () => {
    store.go('help');
  });
  add('act:save', t('menu.save'), '', () => {
    store.go('saves');
  });
  return out;
}

/** Every word of the query must appear; label prefixes rank first, then shorter labels. */
export function filterPaletteEntries(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { entry: PaletteEntry; score: number }[] = [];
  for (const entry of entries) {
    if (!words.every((w) => entry.haystack.includes(w))) continue;
    const label = entry.label.toLowerCase();
    const prefix = words.length > 0 && label.startsWith(words[0] ?? '') ? 0 : 1000;
    scored.push({ entry, score: prefix + label.length });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, MAX_PALETTE_RESULTS).map((s) => s.entry);
}
