/** M3.3: the happiness-upkeep scorer (ADR-0025 decay makes comfort durables an investment). */
import { describe, expect, it } from 'vitest';
import type { CityPack } from '@hustle-ring/content';
import { classic, humanSeat, newGame, patch } from '@hustle-ring/engine/testing';
import type { PlayerState } from '@hustle-ring/engine';
import { happinessUpkeep } from './scorers.js';

const pack = classic();
const personality = pack.personalityById.balanced!;
const ctxFor = (p: CityPack) => ({ pack: p, seat: 0, personality, difficulty: 'normal' }) as const;

const COMFORT = ['television', 'stereo', 'media-player', 'computer', 'hot-tub'];

function withComfort(n: number): { state: ReturnType<typeof newGame>; player: PlayerState } {
  const state = patch(newGame('upkeep', [humanSeat(), humanSeat()], { chaos: 'off' }), 0, (p) => {
    for (const itemId of COMFORT.slice(0, n))
      p.items.push({
        uid: itemId,
        itemId,
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'low-housing',
      });
  });
  return { state, player: state.players[0]! };
}

function noDecay(): CityPack {
  return {
    ...pack,
    rules: { ...pack.rules, happiness: { ...pack.rules.happiness, decayPerWeek: 0 } },
  };
}

describe('happiness-upkeep scorer', () => {
  it('scores nothing for a pack that does not decay happiness', () => {
    const { state, player } = withComfort(0);
    expect(happinessUpkeep.value(ctxFor(noDecay()), state, player)).toBe(0);
  });

  it('rises with each comfort durable and saturates at the relax cap', () => {
    const values = [0, 1, 2, 3, 4, 5].map((n) => {
      const { state, player } = withComfort(n);
      return happinessUpkeep.value(ctxFor(pack), state, player);
    });
    for (let i = 1; i < values.length; i++)
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    expect(values[0]!).toBeLessThan(values[3]!);
    // relaxBase + relaxPerComfort × comfort is capped at relaxMax, so the last durables add nothing.
    const cap =
      (pack.rules.happiness.relaxMax - pack.rules.happiness.relaxBase) /
      pack.rules.happiness.relaxPerComfort;
    expect(values[COMFORT.length]!).toBe(values[Math.min(COMFORT.length, cap)]!);
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('a broken durable stops counting', () => {
    const { state, player } = withComfort(2);
    const before = happinessUpkeep.value(ctxFor(pack), state, player);
    const broken = patch(state, 0, (p) => {
      p.items[0]!.condition = 'broken';
    });
    expect(happinessUpkeep.value(ctxFor(pack), broken, broken.players[0]!)).toBeLessThan(before);
  });

  it('is weighted by the personality happiness weight', () => {
    expect(happinessUpkeep.weight(personality, 'normal')).toBe(personality.weights.happiness);
  });
});
