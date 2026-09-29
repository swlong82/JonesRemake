import { describe, expect, it } from 'vitest';
import { loadPack } from '@hustle-ring/content';
import { createGame, type GameState } from '@hustle-ring/engine';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { weekNeeds } from './needs';
import { useGame } from './gameStore';
import { eventChips, eventCardText } from '../ui/game/labels';
import i18n from '../i18n';

function fresh(): { state: GameState; pack: ReturnType<typeof loadPack> } {
  const pack = loadPack('classic');
  const cfg = buildConfig(
    'classic',
    [defaultSeat(0, 'human-local', 'You')],
    's',
    'classic',
    false,
    true,
  );
  return { state: createGame(cfg, pack), pack };
}

describe('weekNeeds', () => {
  it('flags food when nothing is stocked or pending', () => {
    const { state, pack } = fresh();
    const needs = weekNeeds(state, pack);
    expect(needs.map((n) => n.id)).toEqual(['food']);
    expect(needs[0]?.halfHours).toBe(pack.rules.time.starvationHours);
  });

  it('clears the food need for fridge stock, loose food or a pending meal', () => {
    const { state, pack } = fresh();
    const p = state.players[0]!;
    p.food.fridgeUnits = 1;
    expect(weekNeeds(state, pack)).toEqual([]);
    p.food.fridgeUnits = 0;
    p.food.unrefrigeratedUnits = 1;
    expect(weekNeeds(state, pack)).toEqual([]);
    p.food.unrefrigeratedUnits = 0;
    p.food.mealPending = 'combo';
    expect(weekNeeds(state, pack)).toEqual([]);
  });

  it('flags rent in its due week and when debt is owed', () => {
    const { state, pack } = fresh();
    const p = state.players[0]!;
    p.food.fridgeUnits = 1;
    state.week = p.home.paidThroughWeek + pack.rules.housing.rentWeeks - 1;
    expect(weekNeeds(state, pack)).toEqual([]);
    state.week += 1;
    expect(weekNeeds(state, pack).map((n) => n.id)).toEqual(['rent']);
    state.week = 1;
    p.home.debt = 100;
    expect(weekNeeds(state, pack)[0]?.amount).toBe(100 + p.home.rentLocked);
  });
});

describe('starvation card', () => {
  it('shows the pack hours and happiness, not a hard-coded 10h', () => {
    const { pack } = fresh();
    const t = i18n.t.bind(i18n);
    const ev = { type: 'Starved', seat: 0 } as const;
    const chips = eventChips(ev, t, pack.rules);
    expect(chips[0]).toBe('20h');
    expect(eventCardText(ev, t, pack.rules).text).toContain('20 hours and 5 happiness');
  });
});

describe('end-turn confirm', () => {
  it('asks when a need is unmet even with few hours left, and not once it is met', () => {
    const cfg = buildConfig(
      'classic',
      [defaultSeat(0, 'human-local', 'You')],
      's',
      'classic',
      false,
      true,
    );
    useGame.getState().startGame(cfg);
    useGame.getState().debugPatch((s) => {
      s.players[0]!.hoursLeft = 4;
    });
    useGame.getState().requestEndTurn();
    expect(useGame.getState().endTurnPending).toBe(true);
    useGame.getState().cancelEndTurn();
    useGame.getState().debugPatch((s) => {
      s.players[0]!.food.fridgeUnits = 1;
    });
    useGame.getState().requestEndTurn();
    expect(useGame.getState().endTurnPending).toBe(false);
  });
});
