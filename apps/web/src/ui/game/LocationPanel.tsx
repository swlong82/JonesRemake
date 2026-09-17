/**
 * Location panel and action previews (UX 7.4, M4.4). Actions come from the engine
 * (`candidateCommands`), grouped by service section; each row shows its preview line and, when the
 * command is not legal here, the reason from its `ErrorCode` (ADR-0020).
 */
import type { Command } from '@hustle-ring/engine';
import type { ErrorCode } from '@hustle-ring/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import {
  SECTION_ORDER,
  commandKey,
  commandLabel,
  hours,
  locationName,
  locationQuip,
  previewParts,
  sectionOf,
  type SectionId,
} from './labels';

/** Codes that mean "not here / not now", so the action is not shown at this location at all. */
const PLACE_CODES = new Set<ErrorCode>([
  'ERR_NOT_AT_LOCATION',
  'ERR_NOT_INSIDE',
  'ERR_ALREADY_INSIDE',
  'ERR_LOCATION_CLOSED',
  'ERR_UNKNOWN_ID',
  'ERR_FEATURE_OFF',
  'ERR_NOT_YOUR_TURN',
  'ERR_GAME_OVER',
]);

/** Actions worth repeating until the hours run out (UX 7.4). */
export const REPEATABLE = new Set<string>(['Work', 'Study', 'Relax']);

export interface Row {
  cmd: Command;
  code: ErrorCode | null;
}

/** Group the engine's candidates into panel sections, legal rows first. */
export function groupRows(rows: Row[]): { section: SectionId; rows: Row[] }[] {
  const bySection = new Map<SectionId, Row[]>();
  for (const row of rows) {
    if (row.code !== null && PLACE_CODES.has(row.code)) continue;
    const section = sectionOf(row.cmd);
    if (section === null) continue;
    const list = bySection.get(section) ?? [];
    list.push(row);
    bySection.set(section, list);
  }
  const out: { section: SectionId; rows: Row[] }[] = [];
  for (const section of SECTION_ORDER) {
    const list = bySection.get(section);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => (a.code === null ? 0 : 1) - (b.code === null ? 0 : 1));
    out.push({ section, rows: list });
  }
  return out;
}

/** Repeat an action until it stops being legal, an event fires or the turn changes. */
export function runRepeat(cmd: Command, limit = 24): void {
  for (let i = 0; i < limit; i++) {
    const before = useGame.getState();
    const seat = before.state?.activeSeat;
    const key = commandKey(cmd);
    if (!before.legal().some((c) => commandKey(c) === key)) break;
    const ok = before.dispatch(cmd);
    const after = useGame.getState();
    if (!ok) break;
    if (after.cards.length > before.cards.length) break;
    if (after.state?.activeSeat !== seat || after.state?.winner !== null) break;
  }
}

function ActionRow({ row, repeat }: { row: Row; repeat: boolean }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const preview = useGame((s) => s.preview);
  const opaque = useGame((s) => s.state?.config.classicOpacity ?? false);
  const p = preview(row.cmd);
  const parts = p ? previewParts(p, t, { opaque }) : [];
  const disabled = row.code !== null;
  return (
    <li className="flex flex-col gap-0.5 border-b border-line py-1 last:border-b-0">
      <Button
        variant={disabled ? 'default' : 'primary'}
        disabled={disabled}
        className="text-left"
        data-testid={`action-${commandKey(row.cmd)}`}
        onClick={() => {
          if (repeat && REPEATABLE.has(row.cmd.type)) runRepeat(row.cmd);
          else dispatch(row.cmd);
        }}
      >
        {commandLabel(row.cmd, t)}
      </Button>
      {parts.length > 0 && (
        <p className="text-xs text-ink-muted" data-testid="preview">
          {parts.join(' · ')}
        </p>
      )}
      {disabled && (
        <p className="text-xs text-danger" data-testid="disabled-reason">
          {t('panel.disabled', { reason: t(`error.${row.code ?? ''}`) })}
        </p>
      )}
    </li>
  );
}

export function LocationPanel() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const candidates = useGame((s) => s.candidates);
  const dispatch = useGame((s) => s.dispatch);
  const confirmEnd = useGame((s) => s.endTurnPending);
  const requestEndTurn = useGame((s) => s.requestEndTurn);
  const cancelEndTurn = useGame((s) => s.cancelEndTurn);
  const [repeat, setRepeat] = useState(false);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;

  const rows = candidates();
  const enterRow = rows.find((r) => r.cmd.type === 'Enter');
  const closed = enterRow?.code === 'ERR_LOCATION_CLOSED';
  const sections = groupRows(rows);
  const halfHoursLeft = player.hoursLeft;

  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
      aria-label={locationName(player.location)}
      data-testid="location-panel"
    >
      <header>
        <h2 className="text-lg font-bold" data-testid="panel-location">
          {locationName(player.location)}
        </h2>
        <p className="text-xs italic text-ink-muted">{locationQuip(player.location, state.week)}</p>
        <p className="text-xs" data-testid="panel-state">
          {closed ? t('panel.closed') : player.inside ? t('panel.open') : t('panel.outside')}
        </p>
      </header>

      {player.inside ? (
        <Button onClick={() => dispatch({ type: 'Exit' })} data-testid="exit">
          {t('panel.exit')}
        </Button>
      ) : (
        <Button
          variant="primary"
          disabled={enterRow?.code !== null && enterRow !== undefined}
          onClick={() => dispatch({ type: 'Enter' })}
          data-testid="enter"
        >
          {t('panel.enter')}
        </Button>
      )}

      {sections.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
            data-testid="repeat"
          />
          {t('panel.repeat')}
        </label>
      )}

      <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto">
        {sections.length === 0 && <p className="text-sm text-ink-muted">{t('panel.noActions')}</p>}
        {sections.map(({ section, rows: list }) => (
          <div key={section} data-testid={`section-${section}`}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {t(`panel.section.${section}`)}
            </h3>
            {section === 'bank' && (
              <p className="text-xs text-ink-muted">
                {t('panel.balance', { cash: player.cash, bank: player.bank })}
              </p>
            )}
            <ul>
              {list.map((row) => (
                <ActionRow key={commandKey(row.cmd)} row={row} repeat={repeat} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {confirmEnd ? (
        <div role="alertdialog" aria-label={t('panel.endTurn')} className="flex flex-col gap-2">
          <p className="text-sm">{t('panel.endTurnConfirm', { hours: hours(halfHoursLeft) })}</p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="grow"
              onClick={() => {
                cancelEndTurn();
                dispatch({ type: 'EndTurn' });
              }}
              data-testid="end-turn-confirm"
            >
              {t('panel.endTurn')}
            </Button>
            <Button className="grow" onClick={cancelEndTurn} data-testid="end-turn-cancel">
              {t('travel.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={requestEndTurn} data-testid="end-turn">
          {t('panel.endTurn')}
        </Button>
      )}
    </section>
  );
}
