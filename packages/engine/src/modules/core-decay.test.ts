/** M3.3: happiness decay (GDD 4.8 step E as amended by ADR-0025) alongside the other decays. */
import { describe, expect, it } from 'vitest';
import type { CityPack } from '@hustle-ring/content';
import { classic, humanSeat, newGame, patch, run } from '../testing.js';
import type { GameState } from '../core/state.js';

const pack = classic();

/** Same pack with a different per-week happiness decay, to prove the number lives in content. */
function withDecay(decayPerWeek: number): CityPack {
  return {
    ...pack,
    rules: { ...pack.rules, happiness: { ...pack.rules.happiness, decayPerWeek } },
  };
}

/** Both seats end their turn, so the week advances and every seat sees one decay step. */
function endWeek(state: GameState, p: CityPack): GameState {
  return run(run(state, 0, [{ type: 'EndTurn' }], p), 1, [{ type: 'EndTurn' }], p);
}

/** Starts from 80 happiness so the floor (and starvation) cannot mask the decay being measured. */
const START = 80;

function happinessAfter(weeks: number, p: CityPack, seed = 'decay'): number {
  let s = patch(newGame(seed, [humanSeat(), humanSeat()], { chaos: 'off' }, p), 0, (pl) => {
    pl.happiness = START;
  });
  for (let i = 1; i < weeks; i++) s = endWeek(s, p);
  return s.players[0]!.happiness;
}

describe('core-decay: happiness', () => {
  it('costs the pack value every week from week 2 — the same game with no decay keeps it', () => {
    // Same seed, same commands: the only difference is the content value, so the gap is the decay.
    const withoutDecay = withDecay(0);
    expect(happinessAfter(1, pack)).toBe(START);
    for (const weeks of [2, 3, 4]) {
      const decayed = happinessAfter(weeks, pack);
      const kept = happinessAfter(weeks, withoutDecay);
      expect(kept - decayed).toBe((weeks - 1) * pack.rules.happiness.decayPerWeek);
    }
  });

  it('never falls below the pack minimum', () => {
    const steep = withDecay(100);
    expect(happinessAfter(4, steep, 'floor')).toBe(steep.rules.happiness.min);
  });

  it('relaxing every week beats letting it slide, and a comfort durable turns it positive', () => {
    const start = newGame('relax', [humanSeat(), humanSeat()], { chaos: 'off' });
    const base = start.players[0]!.happiness;
    const relaxed = run(start, 0, [{ type: 'Relax' }]);
    expect(relaxed.players[0]!.happiness).toBe(base + pack.rules.happiness.relaxBase);
    const idleWeek = endWeek(start, pack).players[0]!.happiness;
    const relaxedWeek = endWeek(relaxed, pack).players[0]!.happiness;
    expect(relaxedWeek).toBeGreaterThan(idleWeek);
    // Comfort durables are what make happiness climb rather than merely hold (ADR-0025).
    const comfy = patch(start, 0, (p) => {
      p.items.push({
        uid: 'tv',
        itemId: 'television',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'low-housing',
      });
      p.items.push({
        uid: 'st',
        itemId: 'stereo',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'low-housing',
      });
    });
    const comfyRelax = run(comfy, 0, [{ type: 'Relax' }]).players[0]!.happiness;
    expect(comfyRelax - base).toBeGreaterThan(pack.rules.happiness.decayPerWeek);
  });
});
