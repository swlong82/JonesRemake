import { beforeEach, describe, expect, it } from 'vitest';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { useGame } from './gameStore';
import { useSettings } from './settings';

function start(twoHumans = false): void {
  const seats = [defaultSeat(0, 'human-local', 'One')];
  if (twoHumans) seats.push(defaultSeat(1, 'human-local', 'Two'));
  useGame.getState().startGame(buildConfig('classic', seats, 'visit', 'classic', false, true));
  if (twoHumans) useGame.getState().ready();
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

describe('one-click location visits', () => {
  it('starts on the map without changing the player and opens current home for free', () => {
    start();
    const before = useGame.getState().hash();
    expect(useGame.getState().mapView).toBe(true);
    expect(useGame.getState().state?.players[0]?.inside).toBe(true);
    expect(useGame.getState().visitLocation('low-housing')).toBe(true);
    expect(useGame.getState().mapView).toBe(false);
    expect(useGame.getState().hash()).toBe(before);
  });

  it('charges the normal movement and entry hours once, including repeated activation', () => {
    start();
    const initialHash = useGame.getState().hash();
    const before = useGame.getState().state!.players[0]!.hoursLeft;
    expect(useGame.getState().visitLocation('employment-office')).toBe(true);
    const player = useGame.getState().state!.players[0]!;
    expect(player.location).toBe('employment-office');
    expect(player.inside).toBe(true);
    expect(player.hoursLeft).toBe(before - 14);
    expect(useGame.getState().state?.log).toHaveLength(2);
    const hash = useGame.getState().hash();
    expect(useGame.getState().visitLocation('employment-office')).toBe(true);
    expect(useGame.getState().hash()).toBe(hash);
    expect(useGame.getState().undoLast()).toBe(true);
    expect(useGame.getState().hash()).toBe(initialHash);
    expect(useGame.getState().mapView).toBe(true);
  });

  it('keeps a closed destination outside the travel transaction and names the reason', () => {
    start();
    const before = useGame.getState().hash();
    expect(useGame.getState().visitLocation('rent-office')).toBe(false);
    expect(useGame.getState().hash()).toBe(before);
    expect(useGame.getState().lastError).toBe('ERR_LOCATION_CLOSED');
    expect(useGame.getState().travelOpen).toBe(true);
  });

  it('keeps an unaffordable or partial trip from entering or changing seats', () => {
    start();
    useGame.getState().debugPatch((state) => {
      state.players[0]!.hoursLeft = 3;
    });
    const before = useGame.getState().hash();
    expect(useGame.getState().visitLocation('employment-office')).toBe(false);
    expect(useGame.getState().hash()).toBe(before);
    expect(useGame.getState().travelOpen).toBe(true);
    expect(useGame.getState().lastError).toBe('ERR_NOT_ENOUGH_HOURS');
  });

  it('shows the map again when the next human turn begins', () => {
    start(true);
    useGame.getState().visitLocation('low-housing');
    expect(useGame.getState().mapView).toBe(false);
    useGame.getState().dispatch({ type: 'EndTurn' });
    expect(useGame.getState().screen).toBe('pass');
    useGame.getState().ready();
    expect(useGame.getState().viewerSeat).toBe(1);
    expect(useGame.getState().mapView).toBe(true);
    expect(useGame.getState().state?.players[1]?.inside).toBe(true);
  });
});
