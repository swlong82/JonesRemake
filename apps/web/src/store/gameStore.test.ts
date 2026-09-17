import type { GameConfig } from '@hustle-ring/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { hoursLabel, useGame } from './gameStore';
import { useSettings } from './settings';

function config(
  seats = [defaultSeat(0, 'human-local', 'You'), defaultSeat(1, 'ai', 'Rival')],
): GameConfig {
  const cfg = buildConfig('classic', seats, 'store-test', 'classic', false, false);
  return {
    ...cfg,
    seats: cfg.seats.map((s) => ({
      ...s,
      goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
    })),
  };
}

/** Wait for the floating AI turn started by dispatch() to hand control back. */
async function waitForHumanTurn(): Promise<void> {
  await vi.waitFor(
    () => {
      const s = useGame.getState();
      expect(s.aiThinking).toBe(false);
      expect(s.state?.activeSeat).toBe(0);
    },
    { timeout: 15_000, interval: 20 },
  );
}

describe('game store', () => {
  beforeEach(() => {
    useGame.getState().quit();
    globalThis.localStorage.clear();
    useSettings.getState().resetData();
  });

  it('starts a game and lands on the board for a single human', () => {
    useGame.getState().startGame(config());
    const s = useGame.getState();
    expect(s.screen).toBe('game');
    expect(s.pack?.id).toBe('classic');
    expect(s.state?.week).toBe(1);
    expect(s.viewerSeat).toBe(0);
    expect(s.hash()).toMatch(/^[0-9a-f]+$/);
    expect(s.hash()).toBe(useGame.getState().hash());
  });

  it('is the only mutation path: dispatch applies a legal command and logs its events', () => {
    useGame.getState().startGame(config());
    const before = useGame.getState().hash();
    // Players start inside their home (GDD 4.1.6), so Relax is the first legal move.
    expect(useGame.getState().dispatch({ type: 'Relax' })).toBe(true);
    const after = useGame.getState();
    expect(after.hash()).not.toBe(before);
    expect(after.state?.players[0]?.turn.relaxed).toBe(true);
    expect(after.log.some((e) => e.event.type === 'Relaxed')).toBe(true);
    expect(after.lastError).toBeNull();
  });

  it('rejects an illegal command and surfaces the error code without changing state', () => {
    useGame.getState().startGame(config());
    const before = useGame.getState().hash();
    expect(useGame.getState().dispatch({ type: 'Work', hours: 12 })).toBe(false);
    expect(useGame.getState().hash()).toBe(before);
    expect(useGame.getState().lastError).not.toBeNull();
  });

  it('previews a command and lists legal + candidate commands', () => {
    useGame.getState().startGame(config());
    const preview = useGame.getState().preview({ type: 'Move', to: 'university', mode: 'walk' });
    expect(preview?.hours).toBeLessThan(0);
    const legal = useGame.getState().legal();
    expect(legal.some((c) => c.type === 'Relax')).toBe(true);
    expect(legal.some((c) => c.type === 'Move')).toBe(true);
    const candidates = useGame.getState().candidates();
    expect(candidates.length).toBeGreaterThan(legal.length);
    expect(candidates.some((c) => c.code !== null)).toBe(true);
  });

  it('returns empty results and false before a game exists', () => {
    const s = useGame.getState();
    expect(s.dispatch({ type: 'Relax' })).toBe(false);
    expect(s.preview({ type: 'Relax' })).toBeNull();
    expect(s.legal()).toEqual([]);
    expect(s.candidates()).toEqual([]);
    expect(s.hash()).toBe('');
  });

  it('runs the AI seat after the human ends the turn and comes back to the human', async () => {
    useGame.getState().startGame(config());
    useGame.getState().dispatch({ type: 'EndTurn' });
    await waitForHumanTurn();
    const s = useGame.getState();
    expect(s.state?.week).toBe(2);
    expect(s.ticker.length).toBeGreaterThan(0);
    expect(s.ticker.every((t) => t.seat === 1)).toBe(true);
  });

  it('shows the pass-device screen between two human seats', () => {
    useGame
      .getState()
      .startGame(
        config([defaultSeat(0, 'human-local', 'One'), defaultSeat(1, 'human-local', 'Two')]),
      );
    expect(useGame.getState().screen).toBe('pass');
    useGame.getState().ready();
    expect(useGame.getState().screen).toBe('game');
    useGame.getState().dispatch({ type: 'EndTurn' });
    expect(useGame.getState().screen).toBe('pass');
    expect(useGame.getState().viewerSeat).toBe(0);
    useGame.getState().ready();
    expect(useGame.getState().viewerSeat).toBe(1);
  });

  it('toggles drawers, dismisses cards and skips AI animation', () => {
    useGame.getState().startGame(config());
    const g = useGame.getState();
    g.toggleLog();
    expect(useGame.getState().logOpen).toBe(true);
    g.toggleStandings();
    expect(useGame.getState().standingsOpen).toBe(true);
    g.toggleHelp();
    expect(useGame.getState().helpOpen).toBe(true);
    g.selectLocation('university');
    expect(useGame.getState().selectedLocation).toBe('university');
    g.openTravel('bank');
    expect(useGame.getState().travelOpen).toBe(true);
    g.closeTravel();
    expect(useGame.getState().travelOpen).toBe(false);
    g.skipAi();
    expect(useGame.getState().aiSkip).toBe(true);
    g.dismissCard();
    expect(useGame.getState().cards).toEqual([]);
    g.go('settings');
    expect(useGame.getState().screen).toBe('settings');
  });

  it('rematch keeps the seats but changes the seed; quit clears the game', () => {
    useGame.getState().startGame(config());
    const first = useGame.getState().state?.config.seed;
    useGame.getState().rematch();
    const second = useGame.getState().state;
    expect(second?.config.seed).not.toBe(first);
    expect(second?.players).toHaveLength(2);
    useGame.getState().quit();
    expect(useGame.getState().state).toBeNull();
    expect(useGame.getState().screen).toBe('title');
  });

  it('rematch without a game is a no-op', () => {
    useGame.getState().rematch();
    expect(useGame.getState().state).toBeNull();
  });

  it('marks debug-patched state so a tampered game is never mistaken for a clean one', () => {
    useGame.getState().startGame(config());
    useGame.getState().debugPatch((s) => {
      const p = s.players[0];
      if (p) p.cash += 1000;
    });
    expect(useGame.getState().state?.debugTouched).toBe(true);
    expect(useGame.getState().state?.players[0]?.cash).toBeGreaterThan(1000);
  });

  it('formats half-hours as hours', () => {
    expect(hoursLabel(120)).toBe('60');
    expect(hoursLabel(1)).toBe('0.5');
  });
});
