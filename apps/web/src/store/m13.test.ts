import { beforeEach, describe, expect, it } from 'vitest';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { useGame } from './gameStore';
import { useSettings } from './settings';

function solo(): void {
  useGame
    .getState()
    .startGame(
      buildConfig('classic', [defaultSeat(0, 'human-local', 'You')], 'm13', 'classic', false, true),
    );
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

describe('quick travel (M13.1)', () => {
  it('moves to a reachable place without opening the sheet', () => {
    solo();
    const g = useGame.getState();
    const here = g.state?.players[0]?.location;
    const target = g
      .candidates()
      .find((r) => r.cmd.type === 'Move' && r.code === null && r.cmd.to !== here);
    expect(target).toBeDefined();
    if (target?.cmd.type !== 'Move') return;
    expect(useGame.getState().quickTravel(target.cmd.to)).toBe(true);
    expect(useGame.getState().state?.players[0]?.location).toBe(target.cmd.to);
    expect(useGame.getState().travelOpen).toBe(false);
  });

  it('does nothing when the setting is off', () => {
    solo();
    useSettings.getState().update({ quickTravel: false });
    const before = useGame.getState().hash();
    const target = useGame
      .getState()
      .candidates()
      .find((r) => r.cmd.type === 'Move');
    if (target?.cmd.type !== 'Move') throw new Error('no move');
    expect(useGame.getState().quickTravel(target.cmd.to)).toBe(false);
    expect(useGame.getState().hash()).toBe(before);
  });

  it('falls back to the sheet when the trip is illegal', () => {
    solo();
    const g = useGame.getState();
    const here = g.state?.players[0]?.location;
    expect(useGame.getState().quickTravel(here ?? '')).toBe(false);
  });
});

describe('outcome pop-ups (M13.2)', () => {
  function firstOutcomeMove(): boolean {
    // Enrol / hire needs setup; use a GoalMet-free path: any command whose events are outcomes.
    return useGame.getState().outcomes.length > 0;
  }

  it('queues nothing for a plain move', () => {
    solo();
    const t = useGame
      .getState()
      .candidates()
      .find((r) => r.cmd.type === 'Move' && r.code === null);
    if (t?.cmd.type !== 'Move') throw new Error('no move');
    useGame.getState().dispatch(t.cmd);
    expect(firstOutcomeMove()).toBe(false);
  });

  it('classifies events by density', async () => {
    const { isOutcome, outcomeTone } = await import('../ui/game/outcomes');
    const hired = { type: 'Hired', seat: 0, jobId: 'x', seq: 1, week: 1 } as const;
    const bought = { type: 'ItemBought', seat: 0, itemId: 'x', seq: 2, week: 1 } as const;
    const lost = { type: 'GoalLost', seat: 0, goal: 'wealth', seq: 3, week: 1 } as const;
    expect(isOutcome(hired, 'important')).toBe(true);
    expect(isOutcome(bought, 'important')).toBe(false);
    expect(isOutcome(bought, 'all')).toBe(true);
    expect(isOutcome(hired, 'off')).toBe(false);
    expect(outcomeTone(lost)).toBe('bad');
    expect(outcomeTone(hired)).toBe('good');
  });

  it('dismisses in order and undo clears the queue', () => {
    solo();
    const ev = { type: 'Hired', seat: 0, jobId: 'x', seq: 1, week: 1 } as const;
    useGame.setState({ outcomes: [ev, { ...ev, seq: 2 }] });
    useGame.getState().dismissOutcome();
    expect(useGame.getState().outcomes).toHaveLength(1);
    useGame.getState().dispatch({ type: 'Relax' });
    useGame.getState().undoLast();
    expect(useGame.getState().outcomes).toHaveLength(0);
  });
});
