/** M2.4: planner legality, determinism, difficulty configs, personalities, benchmarks. */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createGame,
  legalCommands,
  Rng,
  stateHash,
  type Command,
} from '@hustle-ring/engine';
import { aiSeat, classic, goInside, makeConfig, newGame, patch } from '@hustle-ring/engine/testing';
import type { Difficulty } from '@hustle-ring/shared';
import {
  ASSET_TIER,
  DIFFICULTY,
  filterCandidates,
  planTurn,
  runAiTurn,
  trimEarlyEnd,
  allScorers,
  registerScorer,
  stateValue,
  isAiDifficulty,
  AI_DIFFICULTIES,
} from './index.js';

const pack = classic();
const PERSONALITIES = ['grinder', 'scholar', 'hustler', 'balanced'];

function aiGame(
  seed: string,
  d0: Difficulty,
  d1: Difficulty,
  p0 = 'balanced',
  p1 = 'grinder',
  goals = 50,
) {
  const s = createGame(
    makeConfig(seed, [aiSeat('A', d0, p0), { ...aiSeat('B', d1, p1), color: 'p2' }]),
    pack,
  );
  return patch(s, 0, (_p, st) => {
    for (const p of st.players)
      p.goals = { wealth: goals, happiness: goals, education: goals, career: goals };
  });
}

describe('difficulty and personality configs (GDD 4.14)', () => {
  it('W × D, noise and lookahead per tier', () => {
    expect(DIFFICULTY.easy).toMatchObject({
      width: 3,
      depth: 3,
      noiseSigma: 0.35,
      lookaheadWeeks: 0,
    });
    expect(DIFFICULTY.normal).toMatchObject({
      width: 6,
      depth: 5,
      noiseSigma: 0.1,
      lookaheadWeeks: 2,
    });
    expect(DIFFICULTY.hard).toMatchObject({
      width: 12,
      depth: 8,
      noiseSigma: 0,
      lookaheadWeeks: 6,
    });
    expect(AI_DIFFICULTIES).toHaveLength(3);
    expect(isAiDifficulty('hard')).toBe(true);
    expect(isAiDifficulty('brutal')).toBe(false);
  });
  it('the classic pack ships the four personalities', () => {
    expect(pack.personalities.map((p) => p.id).sort()).toEqual([...PERSONALITIES].sort());
    expect(pack.personalityById.scholar!.weights.education).toBe(1.6);
    expect(pack.personalityById.grinder!.weights.career).toBe(1.4);
  });
  it('unknown personality falls back to the first; unknown pack personalities throw', () => {
    const s = newGame('fallback', [aiSeat('A', 'easy', 'nobody')]);
    expect(
      planTurn(s, 0, pack, { difficulty: 'easy', personality: 'nobody' }).commands.length,
    ).toBeGreaterThan(0);
    expect(() =>
      planTurn(
        s,
        0,
        { ...pack, personalities: [], personalityById: {} },
        { difficulty: 'easy', personality: 'x' },
      ),
    ).toThrow(/personalities/);
  });
});

describe('planTurn', () => {
  it('is deterministic for the same state and ends with EndTurn', () => {
    const s = newGame('plan', [aiSeat('A', 'normal')]);
    const a = planTurn(s, 0, pack, { difficulty: 'normal', personality: 'balanced' });
    const b = planTurn(s, 0, pack, { difficulty: 'normal', personality: 'balanced' });
    expect(a.commands).toEqual(b.commands);
    expect(a.commands.length).toBeGreaterThan(0);
    expect(a.expanded).toBeGreaterThan(0);
  });
  it('every command in a plan is legal when replayed on the real state', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      let s = newGame(`legal-${difficulty}`, [aiSeat('A', difficulty)]);
      const plan = planTurn(s, 0, pack, { difficulty, personality: 'balanced' });
      for (const cmd of plan.commands) {
        const r = applyCommand(s, 0, cmd, pack);
        // The real RNG can refuse a job the sanitized model accepted; only rejections count.
        expect(r.events.filter((e) => e.type === 'CommandRejected')).toEqual([]);
        s = r.state;
        if (s.activeSeat !== 0) break;
      }
    }
  });
  it('filterCandidates enforces investing tiers, personality risk and junk avoidance', () => {
    const s = newGame('filter', [aiSeat('A', 'easy')]);
    const ctx = {
      pack,
      seat: 0,
      personality: pack.personalityById.balanced!,
      difficulty: 'easy' as const,
    };
    const cmds: Command[] = [
      { type: 'BuyAsset', assetId: 'penny-stocks', amount: 100 },
      { type: 'BuyAsset', assetId: 't-bills', amount: 100 },
      { type: 'BuyLottery', qty: 1 },
      { type: 'BuyItem', itemId: 'bad-novel', qty: 1 },
      { type: 'BuyItem', itemId: 'television', qty: 1 },
      { type: 'Exit' },
      { type: 'SellItem', itemId: 'television' },
      { type: 'EatMeal', mealId: 'burger' },
      { type: 'Move', to: 'clinic', mode: 'walk' },
      { type: 'Move', to: 'bank', mode: 'walk' },
      { type: 'EndTurn' },
    ];
    const kept = filterCandidates(s, 0, pack, cmds, DIFFICULTY.easy, ctx).map((c) =>
      JSON.stringify(c),
    );
    expect(kept).toContain(JSON.stringify({ type: 'BuyAsset', assetId: 't-bills', amount: 100 }));
    expect(kept).not.toContain(
      JSON.stringify({ type: 'BuyAsset', assetId: 'penny-stocks', amount: 100 }),
    );
    expect(kept).not.toContain(JSON.stringify({ type: 'BuyLottery', qty: 1 }));
    expect(kept).not.toContain(JSON.stringify({ type: 'BuyItem', itemId: 'bad-novel', qty: 1 }));
    expect(kept).toContain(JSON.stringify({ type: 'BuyItem', itemId: 'television', qty: 1 }));
    expect(kept).not.toContain(JSON.stringify({ type: 'Exit' }));
    expect(kept).toContain(JSON.stringify({ type: 'SellItem', itemId: 'television' }));
    expect(kept).toContain(JSON.stringify({ type: 'EatMeal', mealId: 'burger' }));
    expect(kept).toContain(JSON.stringify({ type: 'Move', to: 'bank', mode: 'walk' }));
    expect(kept).toContain(JSON.stringify({ type: 'EndTurn' }));
    const hard = {
      ...ctx,
      personality: pack.personalityById.hustler!,
      difficulty: 'hard' as const,
    };
    const keptHard = filterCandidates(s, 0, pack, cmds, DIFFICULTY.hard, hard).map((c) => c.type);
    expect(keptHard.filter((t) => t === 'BuyAsset')).toHaveLength(2);
    expect(keptHard).toContain('BuyLottery');
    const recession = patch(s, 0, (_p, st) => (st.econ.phase = 'recession'));
    expect(
      filterCandidates(recession, 0, pack, cmds, DIFFICULTY.hard, hard).filter(
        (c) => c.type === 'BuyAsset',
      ),
    ).toHaveLength(1);
    const rich = patch(s, 0, (p) => (p.cash = 1000));
    expect(
      filterCandidates(rich, 0, pack, cmds, DIFFICULTY.easy, ctx).some(
        (c) => c.type === 'SellItem',
      ),
    ).toBe(false);
    const fed = patch(s, 0, (p) => (p.food.mealPending = 'burger'));
    expect(
      filterCandidates(fed, 0, pack, cmds, DIFFICULTY.easy, ctx).some((c) => c.type === 'EatMeal'),
    ).toBe(false);
    const applying = (dependability: number) =>
      filterCandidates(
        patch(s, 0, (p) => {
          p.job = { jobId: 'factory-engineer', wage: 18, raises: 0, hiredWeek: 1 };
          p.clothing.push({ tier: 'dress', weeksLeft: 5 });
          p.dependability = dependability;
        }),
        0,
        pack,
        [
          { type: 'ApplyJob', jobId: 'burger-joint-cook' },
          { type: 'ApplyJob', jobId: 'factory-general-manager' },
        ],
        DIFFICULTY.easy,
        ctx,
      ).map((c) => (c as { jobId: string }).jobId);
    // A job the seat can work: only trade up.
    expect(applying(100)).toEqual(['factory-general-manager']);
    // A job a shift would get the seat fired from is no job: stepping down is allowed (KI-008).
    expect(applying(0)).toEqual(['burger-joint-cook', 'factory-general-manager']);
    expect(ASSET_TIER.crypto).toBe(3);
  });
  it('scorer registry accepts module scorers and stateValue sums weighted values', () => {
    const before = allScorers().length;
    registerScorer({ id: 'test-zero', weight: () => 0, value: () => 999 });
    registerScorer({ id: 'test-one', weight: () => 1, value: () => 0.5 });
    expect(allScorers().length).toBe(before + 2);
    const s = newGame('sv', [aiSeat('A')]);
    const ctx = {
      pack,
      seat: 0,
      personality: pack.personalityById.balanced!,
      difficulty: 'normal' as const,
    };
    const v = stateValue(ctx, s);
    expect(Number.isFinite(v)).toBe(true);
    expect(stateValue({ ...ctx, seat: 5 }, s)).toBe(-Infinity);
    registerScorer({ id: 'test-one', weight: () => 0, value: () => 0 });
    registerScorer({ id: 'test-zero', weight: () => 0, value: () => 0 });
  });
});

describe('runAiTurn and M2.4 acceptance', () => {
  it('AI never issues illegal commands over 1,000 games (opening turn, all tiers and personalities)', async () => {
    const pick = new Rng({}, 'ai-legal');
    let rejected = 0;
    let commands = 0;
    for (let i = 0; i < 1000; i++) {
      // Yield to the event loop so the vitest worker RPC never starves during this long loop.
      if (i % 25 === 0) await new Promise((r) => setImmediate(r));
      const d0 = AI_DIFFICULTIES[pick.int('d', 3)]!;
      const d1 = AI_DIFFICULTIES[pick.int('d', 3)]!;
      let s = aiGame(
        `legal-${i}`,
        d0,
        d1,
        PERSONALITIES[pick.int('p', 4)],
        PERSONALITIES[pick.int('p', 4)],
        30 + 10 * pick.int('g', 5),
      );
      // Randomise the opening position a little so plans start from varied states.
      s = patch(s, 0, (p) => {
        p.cash = pick.int('c', 800);
        p.happiness = pick.int('h', 60);
      });
      for (let t = 0; t < 1 && s.winner === null; t++) {
        const seat = s.activeSeat;
        const p = s.players[seat]!;
        const before = s;
        const r = runAiTurn(before, seat, pack, {
          difficulty: p.ai!.difficulty,
          personality: p.ai!.personality,
        });
        // Re-apply the exact command list on the pre-turn state: every command must be accepted.
        let replay = before;
        for (const cmd of r.commands) {
          const step = applyCommand(replay, seat, cmd, pack);
          if (step.events.some((e) => e.type === 'CommandRejected')) rejected++;
          replay = step.state;
          commands++;
        }
        expect(stateHash(replay)).toBe(stateHash(r.state));
        expect(r.state.activeSeat).not.toBe(seat);
        s = r.state;
      }
    }
    expect(commands).toBeGreaterThan(1000);
    expect(rejected).toBe(0);
  }, 240_000);

  it('runAiTurn always yields the turn and uses commands from legalCommands', () => {
    let s = aiGame('yield', 'normal', 'easy');
    for (let t = 0; t < 6; t++) {
      const seat = s.activeSeat;
      const legalAtStart = legalCommands(s, seat, pack).map((c) => c.type);
      const r = runAiTurn(s, seat, pack, { difficulty: 'normal', personality: 'balanced' });
      expect(legalAtStart).toContain(r.commands[0]!.type);
      expect(r.state.activeSeat).toBe((seat + 1) % 2);
      expect(r.plans).toBeGreaterThanOrEqual(1);
      s = r.state;
    }
  });

  it('turn-time benchmark (GDD 4.14): Normal median < 250 ms, Hard < 1000 ms', () => {
    for (const [difficulty, budget] of [
      ['normal', 250],
      ['hard', 1000],
    ] as const) {
      let s = aiGame(`bench-${difficulty}`, difficulty, difficulty);
      const times: number[] = [];
      for (let t = 0; t < 20 && s.winner === null; t++) {
        const t0 = performance.now();
        s = runAiTurn(s, s.activeSeat, pack, { difficulty, personality: 'balanced' }).state;
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      expect(times[Math.floor(times.length / 2)]!).toBeLessThan(budget);
    }
  }, 120_000);

  it('a Normal self-play game reaches a winner well before the stall week', () => {
    let s = aiGame('finish', 'normal', 'normal');
    while (s.winner === null && s.week < 300) {
      const p = s.players[s.activeSeat]!;
      s = runAiTurn(s, s.activeSeat, pack, {
        difficulty: 'normal',
        personality: p.ai!.personality,
      }).state;
    }
    expect(s.winner).not.toBeNull();
    expect(s.week).toBeLessThan(150);
  }, 120_000);

  it('Hard beats Easy ≥ 70% (smoke: 24 games at goals 30, alternating seats)', async () => {
    let hard = 0;
    let decided = 0;
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setImmediate(r));
      const hardFirst = i % 2 === 0;
      let s = aiGame(
        `hve-${i}`,
        hardFirst ? 'hard' : 'easy',
        hardFirst ? 'easy' : 'hard',
        PERSONALITIES[i % 4],
        PERSONALITIES[(i + 1) % 4],
        30,
      );
      // Hard wins in ~25 weeks; a game still open at week 100 counts against Hard.
      while (s.winner === null && s.week < 100) {
        const p = s.players[s.activeSeat]!;
        s = runAiTurn(s, s.activeSeat, pack, {
          difficulty: p.ai!.difficulty,
          personality: p.ai!.personality,
        }).state;
      }
      decided++;
      if (s.winner !== null && s.players[s.winner]!.ai!.difficulty === 'hard') hard++;
    }
    expect(hard / decided).toBeGreaterThanOrEqual(0.7);
  }, 600_000);
});

describe('pre-ranking treats balance-sheet moves as transfers (ADR-0043)', () => {
  const opts = { difficulty: 'normal', personality: 'balanced' } as const;
  it('banks a large cash balance instead of carrying it past the street-theft risk', () => {
    let s = patch(newGame('transfer-deposit', [aiSeat('A'), aiSeat('B')]), 0, (p) => {
      p.cash = 12_000;
    });
    s = goInside(s, 0, 'bank');
    const r = runAiTurn(s, 0, pack, opts);
    expect(r.commands.some((c) => c.type === 'Deposit')).toBe(true);
    expect(r.state.players[0]!.bank).toBeGreaterThan(0);
  });

  it('withdraws cash for a uniform when the job cannot be worked without one', () => {
    let s = patch(newGame('transfer-uniform', [aiSeat('A'), aiSeat('B')]), 0, (p) => {
      p.cash = 40;
      p.bank = 3_000;
      p.job = { jobId: 'bank-branch-manager', wage: 18, raises: 0, hiredWeek: 1 };
      p.clothing = [];
      p.food.mealPending = 'burger';
    });
    s = goInside(s, 0, 'bank');
    const r = runAiTurn(s, 0, pack, opts);
    const w = r.commands.find((c) => c.type === 'Withdraw') as { amount: number } | undefined;
    expect(w?.amount).toBeGreaterThanOrEqual(500);
  });
});

describe('feeding (KI-008)', () => {
  it('an unfed seat with money gets a meal in before the week ends', () => {
    for (const personality of PERSONALITIES) {
      const s = patch(newGame(`feed-${personality}`, [aiSeat('A'), aiSeat('B')]), 0, (p) => {
        p.cash = 400;
        p.food = { fridgeUnits: 0, unrefrigeratedUnits: 0, mealPending: null };
      });
      const r = runAiTurn(s, 0, pack, { difficulty: 'normal', personality });
      // A meal, groceries or a delivery: whichever it is, the next week does not start starving.
      const eats = r.commands.some(
        (c) => c.type === 'EatMeal' || c.type === 'BuyFood' || c.type === 'OrderDelivery',
      );
      expect(eats, personality).toBe(true);
    }
  });
});

describe('early turn ends (KI-008)', () => {
  const end: Command = { type: 'EndTurn' };
  const eat: Command = { type: 'EatMeal', mealId: 'burger' };
  it('drops a closing EndTurn while the week still has hours in it', () => {
    expect(trimEarlyEnd([eat, end], 40)).toEqual([eat]);
  });
  it('keeps it when the week is spent, or when ending is the whole plan', () => {
    expect(trimEarlyEnd([eat, end], 12)).toEqual([eat, end]);
    expect(trimEarlyEnd([end], 60)).toEqual([end]);
    expect(trimEarlyEnd([eat], 60)).toEqual([eat]);
  });
});
