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
    expect(useGame.getState().quickTravel('employment-office')).toBe(true);
    expect(useGame.getState().state?.players[0]?.location).toBe('employment-office');
    expect(useGame.getState().state?.players[0]?.inside).toBe(true);
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

  it('opens the current location without changing game state', () => {
    solo();
    const g = useGame.getState();
    const here = g.state?.players[0]?.location;
    const before = g.hash();
    expect(useGame.getState().quickTravel(here ?? '')).toBe(true);
    expect(useGame.getState().hash()).toBe(before);
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

describe('confirm big actions (M13.8)', () => {
  it('asks first for listed commands and cancels cleanly', () => {
    solo();
    const study = useGame.getState().pack?.locations.find((l) => l.services.includes('study'));
    if (!study) throw new Error('no school');
    expect(useGame.getState().quickTravel(study.id)).toBe(true);
    expect(useGame.getState().state?.players[0]?.inside).toBe(true);
    const enroll = useGame
      .getState()
      .candidates()
      .find((r) => r.cmd.type === 'Enroll' && r.code === null);
    if (!enroll) throw new Error('no enrol row');
    expect(useGame.getState().requestConfirm(enroll.cmd)).toBe(true);
    expect(useGame.getState().confirmPending?.cmd).toEqual(enroll.cmd);
    useGame.getState().cancelConfirm();
    expect(useGame.getState().confirmPending).toBeNull();
    expect(useGame.getState().requestConfirm(enroll.cmd)).toBe(true);
    const before = useGame.getState().hash();
    expect(useGame.getState().confirmAction()).toBe(true);
    expect(useGame.getState().hash()).not.toBe(before);
  });

  it('does not ask for small actions and drops a stale confirmation', () => {
    solo();
    expect(useGame.getState().requestConfirm({ type: 'Relax' })).toBe(false);
    useGame.setState({ confirmPending: { cmd: { type: 'Relax' }, stateHash: 'stale' } });
    const before = useGame.getState().hash();
    expect(useGame.getState().confirmAction()).toBe(false);
    expect(useGame.getState().hash()).toBe(before);
  });
});
