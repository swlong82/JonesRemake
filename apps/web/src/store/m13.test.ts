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
