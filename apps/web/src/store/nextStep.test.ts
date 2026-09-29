import { loadPack } from '@hustle-ring/content';
import { createGame } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { nextStep } from './nextStep';

function fresh() {
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

describe('nextStep', () => {
  it('sends a jobless player to the nearest place that takes applications', () => {
    const { state, pack } = fresh();
    expect(nextStep(state, pack)).toEqual({ id: 'job', place: 'employment-office' });
    state.players[0]!.location = 'employment-office';
    expect(nextStep(state, pack)).toEqual({ id: 'job', place: null });
  });

  it('moves on to food, rent and work once employed', () => {
    const { state, pack } = fresh();
    const p = state.players[0]!;
    p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
    p.location = 'burger-joint';
    expect(nextStep(state, pack)).toEqual({ id: 'eat', place: null });
    p.food.fridgeUnits = 1;
    expect(nextStep(state, pack)).toEqual({ id: 'work', place: null });
    state.week = p.home.paidThroughWeek + pack.rules.housing.rentWeeks;
    expect(nextStep(state, pack)).toEqual({ id: 'rent', place: 'rent-office' });
  });

  it('says to end the turn when out of hours, and stays quiet for AI seats', () => {
    const { state, pack } = fresh();
    state.players[0]!.hoursLeft = 0;
    expect(nextStep(state, pack)?.id).toBe('endTurn');
    state.players[0]!.controller = 'ai';
    expect(nextStep(state, pack)).toBeNull();
  });
});
