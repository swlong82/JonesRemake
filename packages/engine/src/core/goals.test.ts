/** M1.8: goal formulas (GDD 4.4), stat decay (4.8), hidden stats (3.3) — table-driven. */
import { describe, expect, it } from 'vitest';
import {
  careerGoal,
  computeGoals,
  educationGoal,
  marketValue,
  recomputeMaxima,
  wealthGoal,
} from './goals.js';
import { classic, humanSeat, newGame, patch, run } from '../testing.js';

const pack = classic();

describe('goal formulas (GDD 4.4)', () => {
  const base = newGame('goals');
  it.each([
    [0, 0, {}, 0],
    [200, 0, {}, 2],
    [10_000, 0, {}, 100],
    [5_000, 4_999, {}, 99],
    [50, 30, { gold: { units: 5000, costBasisCents: 0 } }, 5], // gold 100.00 → $500
    [999_999, 0, {}, 100],
  ] as const)('wealth: cash %i bank %i investments → %i', (cash, bank, inv, expected) => {
    const s = patch(base, 0, (p) => {
      p.cash = cash;
      p.bank = bank;
      p.investments = { ...inv };
    });
    expect(wealthGoal(s.players[0]!, s, pack, 0)).toBe(expected);
  });
  it('wealth subtracts module contributions (loans) and floors at 0', () => {
    const s = patch(base, 0, (p) => (p.cash = 500));
    expect(wealthGoal(s.players[0]!, s, pack, -300)).toBe(2);
    expect(wealthGoal(s.players[0]!, s, pack, -900)).toBe(0);
    expect(
      marketValue(
        patch(s, 0, (p) => (p.investments = { ghost: { units: 100, costBasisCents: 0 } }))
          .players[0]!,
        s,
      ),
    ).toBe(0);
  });
  it.each([
    [0, 1],
    [1, 10],
    [5, 46],
    [11, 100],
  ])('education: %i degrees → %i', (n, expected) => {
    const s = patch(base, 0, (p) => (p.degrees = pack.degrees.slice(0, n).map((d) => d.id)));
    expect(educationGoal(s.players[0]!, pack)).toBe(expected);
  });
  it.each([
    [0, true, 0],
    [20, true, 25],
    [80, true, 100],
    [100, true, 100],
    [60, false, 0],
  ])('career: dependability %i employed=%s → %i', (dep, employed, expected) => {
    const s = patch(base, 0, (p) => {
      p.dependability = dep;
      p.job = employed ? { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 } : null;
    });
    expect(careerGoal(s.players[0]!, pack)).toBe(expected);
  });
  it('computeGoals bundles all four', () => {
    expect(computeGoals(base.players[0]!, base, pack, 0)).toEqual({
      wealth: 2,
      happiness: 10,
      education: 1,
      career: 0,
    });
  });
});

describe('hidden stat maxima (ORIGINAL_REFERENCE 3.3)', () => {
  it.each([
    [null, 0, 20, 20],
    ['burger-joint-cook', 0, 20, 20],
    ['university-professor', 0, 80, 70],
    ['university-professor', 3, 95, 85],
    [null, 11, 75, 75],
  ] as const)('job %s + %i degrees → maxDep %i maxExp %i', (jobId, degrees, maxDep, maxExp) => {
    const s = patch(newGame('max'), 0, (p) => {
      p.job = jobId ? { jobId, wage: 1, raises: 0, hiredWeek: 1 } : null;
      p.degrees = pack.degrees.slice(0, degrees).map((d) => d.id);
      recomputeMaxima(p, pack);
    });
    expect(s.players[0]!.maxDependability).toBe(maxDep);
    expect(s.players[0]!.maxExperience).toBe(maxExp);
  });
});

describe('stat decay at turn start (GDD 4.8)', () => {
  function afterOneWeek(setup: (p: ReturnType<typeof newGame>['players'][0]) => void) {
    let s = patch(newGame('decay', [humanSeat(), humanSeat()]), 0, setup);
    s = run(s, 0, [{ type: 'EndTurn' }]);
    s = run(s, 1, [{ type: 'EndTurn' }]);
    return s.players[0]!;
  }
  it.each([
    [20, 17],
    [3, 0],
    [0, 0],
  ])('dependability %i → %i (−3, min 0)', (before, after) => {
    expect(afterOneWeek((p) => (p.dependability = before)).dependability).toBe(after);
  });
  it.each([
    [10, 10],
    [11, 10],
    [30, 29],
  ])('relaxation %i → %i (−1, min 10)', (before, after) => {
    expect(afterOneWeek((p) => (p.relaxation = before)).relaxation).toBe(after);
  });
  it('hot tub stops relaxation decay', () => {
    const p = afterOneWeek((pl) => {
      pl.relaxation = 30;
      pl.items.push({
        uid: 'h',
        itemId: 'hot-tub',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'appliance-depot',
      });
    });
    expect(p.relaxation).toBe(30);
  });
  it('clothing: the best outfit in use loses a week; worn-out outfits vanish and lower the uniform tier', () => {
    const p = afterOneWeek(
      (pl) =>
        (pl.clothing = [
          { tier: 'casual', weeksLeft: 4 },
          { tier: 'dress', weeksLeft: 1 },
        ]),
    );
    expect(p.clothing).toEqual([{ tier: 'casual', weeksLeft: 4 }]);
    const q = afterOneWeek((pl) => (pl.clothing = [{ tier: 'casual', weeksLeft: 1 }]));
    expect(q.clothing).toEqual([]);
  });
  it('week 1 has no decay; history records goals every turn', () => {
    const s = newGame('nodecay');
    expect(s.players[0]!.dependability).toBe(20);
    const p = afterOneWeek(() => undefined);
    expect(p.history.map((h) => h.week)).toEqual([1, 2]);
  });
});
