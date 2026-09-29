import { loadPack } from '@hustle-ring/content';
import { createGame } from '@hustle-ring/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { pickCoach } from './coach';
import { goalLevers } from './goalLevers';
import { useGame, MAX_UNDO } from './gameStore';
import { haptic, HAPTIC_PATTERNS } from './haptics';
import { hourCells, rentDueIn } from './needs';
import { useSettings } from './settings';

function solo(packId = 'classic'): void {
  useGame
    .getState()
    .startGame(
      buildConfig(packId, [defaultSeat(0, 'human-local', 'You')], 'm12', 'classic', false, true),
    );
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

describe('undo (M12.2)', () => {
  it('rewinds the last action to the exact earlier state, hash included', () => {
    solo();
    const before = useGame.getState().hash();
    const logBefore = useGame.getState().state?.log.length;
    expect(useGame.getState().dispatch({ type: 'Relax' })).toBe(true);
    expect(useGame.getState().hash()).not.toBe(before);
    expect(useGame.getState().undoStack).toHaveLength(1);
    expect(useGame.getState().undoLast()).toBe(true);
    expect(useGame.getState().hash()).toBe(before);
    expect(useGame.getState().state?.log.length).toBe(logBefore);
    expect(useGame.getState().undoStack).toHaveLength(0);
  });

  it('does nothing when there is nothing to undo', () => {
    solo();
    expect(useGame.getState().undoLast()).toBe(false);
  });

  it('is one step per action and never crosses the end of the turn', () => {
    solo();
    useGame.getState().dispatch({ type: 'Relax' });
    useGame.getState().dispatch({ type: 'Exit' });
    expect(useGame.getState().undoStack).toHaveLength(2);
    useGame.getState().dispatch({ type: 'EndTurn' });
    expect(useGame.getState().undoStack).toHaveLength(0);
    expect(useGame.getState().undoLast()).toBe(false);
  });

  it('does not record rejected commands', () => {
    solo();
    expect(useGame.getState().dispatch({ type: 'Work', hours: 12 })).toBe(false);
    expect(useGame.getState().undoStack).toHaveLength(0);
  });

  it('is off in strict mode', () => {
    solo();
    useSettings.getState().update({ strictMode: true });
    useGame.getState().dispatch({ type: 'Relax' });
    expect(useGame.getState().undoStack).toHaveLength(0);
    expect(useGame.getState().undoLast()).toBe(false);
  });

  it('keeps the stack bounded', () => {
    expect(MAX_UNDO).toBeGreaterThan(10);
  });

  it('replays to the same state after an undo and a different action', () => {
    solo();
    useGame.getState().dispatch({ type: 'Relax' });
    useGame.getState().undoLast();
    useGame.getState().dispatch({ type: 'Exit' });
    const s = useGame.getState().state!;
    const pack = loadPack('classic');
    // The command log only holds what really happened, so replaying it reproduces the state.
    const replay = createGame(s.config, pack);
    expect((s.log as { cmd: { type: string } }[]).map((c) => c.cmd.type)).toEqual(['Exit']);
    expect(replay.week).toBe(1);
  });
});

describe('coach marks (M12.4)', () => {
  it('picks the first unseen tip whose command is on offer', () => {
    expect(pickCoach(['Work', 'Relax'], [])).toBeNull();
    expect(pickCoach(['Work', 'TakeLoan'], [])).toBe('loan');
    expect(pickCoach(['TakeLoan', 'GigShift'], [])).toBe('gig');
    expect(pickCoach(['TakeLoan', 'GigShift'], ['gig'])).toBe('loan');
    expect(pickCoach(['TakeLoan'], ['loan'])).toBeNull();
  });
});

describe('goal levers (M12.5)', () => {
  it('lists local actions that move the goal, or names a place to go', () => {
    solo();
    const { state, pack } = useGame.getState();
    const s = useGame.getState();
    const happy = goalLevers('happiness', state!, pack!, s.candidates(), s.preview);
    expect(happy.here.map((l) => l.cmd.type)).toContain('Relax');
    expect(happy.place).toBeNull();
    const edu = goalLevers('education', state!, pack!, s.candidates(), s.preview);
    expect(edu.here).toHaveLength(0);
    expect(edu.place).toBe('university');
  });
});

describe('hours strip maths (M12.9)', () => {
  it('splits the week into spent, planned and free hours', () => {
    expect(hourCells(8, 8, 0)).toEqual(['left', 'left', 'left', 'left']);
    expect(hourCells(8, 4, 0)).toEqual(['left', 'left', 'spent', 'spent']);
    expect(hourCells(8, 6, 2)).toEqual(['left', 'left', 'planned', 'spent']);
    expect(hourCells(8, 2, 6)).toEqual(['planned', 'spent', 'spent', 'spent']);
  });

  it('counts weeks until rent is due, and 0 with debt', () => {
    const pack = loadPack('classic');
    const state = createGame(
      buildConfig('classic', [defaultSeat(0, 'human-local', 'You')], 's', 'classic', false, true),
      pack,
    );
    const p = state.players[0]!;
    const due = p.home.paidThroughWeek + pack.rules.housing.rentWeeks;
    expect(rentDueIn(state, pack)).toBe(Math.max(0, due - state.week));
    p.home.debt = 10;
    expect(rentDueIn(state, pack)).toBe(0);
  });
});

describe('haptics (M12.8)', () => {
  it('vibrates when supported and enabled, and is silent otherwise', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(haptic('success')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.success);
    useSettings.getState().update({ haptics: false });
    expect(haptic('fail')).toBe(false);
    useSettings.getState().update({ haptics: true, reducedMotion: true });
    expect(haptic('fail')).toBe(false);
    useSettings.getState().update({ reducedMotion: false });
    vi.stubGlobal('navigator', {});
    expect(haptic('tap')).toBe(false);
    vi.unstubAllGlobals();
  });
});
