/** M1.9: every Effect op (CONTENT_SCHEMAS 6.2), event runtime, econ tick bounds. */
import type { EffectSpec } from '@hustle-ring/content';
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  Ctx,
  cloneState,
  applyEffect,
  conditionHolds,
  evalWeight,
  logicView,
  runTurnStartEvents,
  runWeekendEvent,
  runTriggerEvents,
  runScheduledEvents,
  chaosMultiplier,
  tickEconomy,
  tickMarket,
  stepBounded,
} from '../index.js';
import { classic, humanSeat, newGame, patch, run } from '../testing.js';

const pack = classic();

function ctxFor(seed = 'fx', setup?: (p: ReturnType<typeof newGame>['players'][0]) => void): Ctx {
  let s = newGame(seed, [humanSeat(), humanSeat()]);
  if (setup) s = patch(s, 0, setup);
  const c = new Ctx(cloneState(s), pack, 0, true);
  return c;
}

describe('effect DSL ops', () => {
  it('stat with number and range; wellbeing ignored when flag off', () => {
    const ctx = ctxFor();
    expect(applyEffect(ctx, 0, { op: 'stat', stat: 'happiness', delta: 4 }, 't')).toEqual([
      'stat:happiness:4',
    ]);
    expect(ctx.player.happiness).toBe(14);
    applyEffect(ctx, 0, { op: 'stat', stat: 'experience', delta: { min: 2, max: 2 } }, 't');
    expect(ctx.player.experience).toBe(12);
    expect(applyEffect(ctx, 0, { op: 'stat', stat: 'wellbeing', delta: -5 }, 't')).toEqual([]);
    expect(applyEffect(ctx, 0, { op: 'relaxation', delta: 3 }, 't')).toEqual(['stat:relaxation:3']);
    expect(ctx.player.relaxation).toBe(13);
  });
  it('money: positive, negative capped at balance, cascade to bank then debt, pctOf, scaleEcon', () => {
    const ctx = ctxFor('m', (p) => {
      p.cash = 100;
      p.bank = 50;
    });
    ctx.state.econ.index = 1500;
    expect(
      applyEffect(
        ctx,
        0,
        { op: 'money', account: 'cash', delta: 20, scaleEcon: true, cascade: false },
        't',
      ),
    ).toEqual(['money:cash:30']);
    expect(ctx.player.cash).toBe(130);
    expect(
      applyEffect(
        ctx,
        0,
        { op: 'money', account: 'bank', delta: -500, scaleEcon: false, cascade: false },
        't',
      ),
    ).toEqual(['money:bank:-50']);
    expect(ctx.player.bank).toBe(0);
    ctx.player.bank = 40;
    const chips = applyEffect(
      ctx,
      0,
      { op: 'money', account: 'cash', delta: -200, scaleEcon: false, cascade: true },
      't',
    );
    expect(chips).toEqual(['debt:30', 'money:cash:-200']);
    expect(ctx.player).toMatchObject({ cash: 0, bank: 0 });
    expect(ctx.player.home.debt).toBe(30);
    expect(ctx.player.home.debtSinceWeek).toBe(1);
    ctx.player.bank = 1000;
    expect(
      applyEffect(
        ctx,
        0,
        {
          op: 'money',
          account: 'bank',
          delta: { pctOf: 'bank', pct: { min: 10, max: 10 } },
          scaleEcon: false,
          cascade: false,
        },
        't',
      ),
    ).toEqual(['money:bank:-100']);
    expect(ctx.player.bank).toBe(900);
  });
  it('hours: negative applies now during actions, or as a next-turn penalty otherwise', () => {
    const ctx = ctxFor();
    applyEffect(ctx, 0, { op: 'hours', delta: -4 }, 't');
    expect(ctx.player.hoursLeft).toBe(112);
    ctx.player.turn.lockedActions.push('turn-start');
    applyEffect(ctx, 0, { op: 'hours', delta: -2 }, 't');
    expect(ctx.player.turn.penalties).toBe(4);
    applyEffect(ctx, 0, { op: 'hours', delta: 3 }, 't');
    expect(ctx.player.hoursLeft).toBe(112);
  });
  it('loseJob: chance, severance, no job → no-op', () => {
    const ctx = ctxFor(
      'lj',
      (p) => (p.job = { jobId: 'burger-joint-cook', wage: 10, raises: 0, hiredWeek: 1 }),
    );
    expect(applyEffect(ctx, 0, { op: 'loseJob', chanceBp: 0 }, 't')).toEqual([]);
    expect(
      applyEffect(ctx, 0, { op: 'loseJob', chanceBp: 10_000, severanceWeeks: 2 }, 't'),
    ).toEqual(['severance:160', 'fired']);
    expect(ctx.player.job).toBeNull();
    expect(ctx.player.cash).toBe(360);
    expect(ctx.player.happiness).toBe(5);
    expect(applyEffect(ctx, 0, { op: 'loseJob', chanceBp: 10_000 }, 't')).toEqual([]);
  });
  it('loseItems with filters and counts; disableItem; grant; food', () => {
    const ctx = ctxFor('li', (p) => {
      p.items.push({
        uid: 'a',
        itemId: 'television',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'x',
      });
      p.items.push({ uid: 'b', itemId: 'atlas', condition: 'ok', boughtWeek: 1, boughtAt: 'x' });
      p.items.push({ uid: 'c', itemId: 'computer', condition: 'ok', boughtWeek: 1, boughtAt: 'x' });
    });
    expect(
      applyEffect(ctx, 0, { op: 'loseItems', filter: { category: 'book' }, count: 'all' }, 't'),
    ).toEqual(['items:-1']);
    expect(ctx.player.items.map((i) => i.itemId)).toEqual(['television', 'computer']);
    expect(
      applyEffect(ctx, 0, { op: 'loseItems', filter: { itemId: 'ghost' }, count: 1 }, 't'),
    ).toEqual([]);
    expect(
      applyEffect(
        ctx,
        0,
        { op: 'loseItems', filter: { durable: true }, count: { min: 1, max: 1 } },
        't',
      ),
    ).toEqual(['items:-1']);
    expect(ctx.player.items).toHaveLength(1);
    const left = ctx.player.items[0]!.itemId;
    expect(
      applyEffect(ctx, 0, { op: 'disableItem', itemId: left, untilRepaired: true }, 't'),
    ).toEqual([`broken:${left}`]);
    expect(
      applyEffect(ctx, 0, { op: 'disableItem', itemId: left, untilRepaired: true }, 't'),
    ).toEqual([]);
    expect(applyEffect(ctx, 0, { op: 'grant', what: 'freeEnrollment', qty: 2 }, 't')).toEqual([
      'grant:freeEnrollment:2',
    ]);
    expect(ctx.player.freeEnrollments).toBe(2);
    expect(applyEffect(ctx, 0, { op: 'grant', what: 'meal', qty: 1 }, 't')).toEqual([
      'grant:meal:1',
    ]);
    expect(ctx.player.food.mealPending).toBe('burger');
    expect(applyEffect(ctx, 0, { op: 'food', delta: -1 }, 't')).toEqual(['food:0']);
    ctx.player.food.fridgeUnits = 3;
    expect(applyEffect(ctx, 0, { op: 'food', delta: -1 }, 't')).toEqual(['food:-1']);
    expect(
      applyEffect(ctx, 0, { op: 'loseItems', filter: { durable: true }, count: 5 }, 't'),
    ).toEqual(['items:-1']);
    expect(applyEffect(ctx, 0, { op: 'loseItems', filter: {}, count: 1 }, 't')).toEqual([]);
  });
  it('econ and asset multipliers are clamped/bounded; schedule queues by chance', () => {
    const ctx = ctxFor();
    expect(applyEffect(ctx, 0, { op: 'econ', multiply: { min: 500, max: 500 } }, 't')).toEqual([
      'econ:500',
    ]);
    expect(ctx.state.econ.index).toBe(500);
    applyEffect(ctx, 0, { op: 'econ', multiply: { min: 100, max: 100 } }, 't');
    expect(ctx.state.econ.index).toBe(500);
    expect(
      applyEffect(
        ctx,
        0,
        { op: 'asset', assetId: '*', multiply: { min: 700, max: 700 }, exceptImmune: true },
        't',
      ),
    ).toEqual(['asset:*:700']);
    expect(ctx.state.market.prices['t-bills']).toBe(10_000);
    expect(ctx.state.market.prices['blue-chip']).toBe(8000);
    expect(ctx.state.market.prices['penny-stocks']).toBe(7000);
    applyEffect(
      ctx,
      0,
      { op: 'asset', assetId: 'gold', multiply: { min: 2000, max: 2000 }, exceptImmune: false },
      't',
    );
    expect(ctx.state.market.prices.gold).toBe(14_000);
    expect(
      applyEffect(
        ctx,
        0,
        { op: 'asset', assetId: 'ghost', multiply: { min: 1, max: 1 }, exceptImmune: false },
        't',
      ),
    ).toEqual(['asset:ghost:1']);
    expect(
      applyEffect(
        ctx,
        0,
        { op: 'schedule', eventId: 'boom-news', inWeeks: 2, chance: 10_000 },
        't',
      ),
    ).toEqual(['schedule:boom-news']);
    expect(ctx.player.scheduled).toEqual([{ eventId: 'boom-news', week: 3 }]);
    expect(
      applyEffect(ctx, 0, { op: 'schedule', eventId: 'boom-news', inWeeks: 2, chance: 0 }, 't'),
    ).toEqual([]);
  });
  it('every schema op is covered', () => {
    const ops: EffectSpec['op'][] = [
      'stat',
      'money',
      'hours',
      'loseJob',
      'loseItems',
      'disableItem',
      'econ',
      'asset',
      'grant',
      'schedule',
      'relaxation',
      'food',
    ];
    expect(new Set(ops).size).toBe(12);
  });
});

describe('conditions, weights, event runtime', () => {
  it('logicView exposes the whitelisted fields; conditions and weights evaluate', () => {
    const ctx = ctxFor('lv', (p) => {
      p.items.push({ uid: 'c', itemId: 'computer', condition: 'ok', boughtWeek: 1, boughtAt: 'x' });
      p.degrees = ['trade-school'];
    });
    const v = logicView(ctx, 0) as { player: Record<string, unknown> };
    expect(v.player.itemIds).toEqual(['computer']);
    expect(v.player.unlocks).toEqual(['weekendIncome']);
    expect(v.player.degreeCount).toBe(1);
    expect(conditionHolds(ctx, 0, undefined)).toBe(true);
    expect(conditionHolds(ctx, 0, { in: ['computer', { var: 'player.itemIds' }] })).toBe(true);
    expect(conditionHolds(ctx, 0, { '>': [{ var: 'player.cash' }, 1000] })).toBe(false);
    expect(evalWeight(ctx, 0, 300)).toBe(300);
    expect(evalWeight(ctx, 0, { '*': [300, { '-': [10, { var: 'player.degreeCount' }] }] })).toBe(
      2700,
    );
    expect(evalWeight(ctx, 0, { var: 'player.name' })).toBe(0);
    expect(evalWeight(ctx, 0, -5)).toBe(0);
  });
  it('weekend: freelance needs a computer; Chaos Off runs neutral events only', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 300; i++) {
      const ctx = ctxFor(`wk-${i}`, (p) =>
        p.items.push({
          uid: 'c',
          itemId: 'computer',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'x',
        }),
      );
      runWeekendEvent(ctx, 0);
      const id = ctx.player.turn.eventsFired[0]!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.get('freelance')).toBeGreaterThan(5);
    for (let i = 0; i < 100; i++) {
      const ctx = ctxFor(`wkn-${i}`);
      runWeekendEvent(ctx, 0);
      expect(ctx.player.turn.eventsFired[0]).not.toBe('freelance');
    }
    for (let i = 0; i < 100; i++) {
      let s = newGame(`off-${i}`, [humanSeat(), humanSeat()], { chaos: 'off' });
      s = run(s, 0, [{ type: 'EndTurn' }]);
      const fired = s.players[0]!.turn.eventsFired[0]!;
      expect(pack.eventById[fired]!.neutral).toBe(true);
    }
  });
  it('turnStart: at most one event per turn; chaos multiplier scales the chance; Off never fires', () => {
    let fired = 0;
    for (let i = 0; i < 300; i++) {
      const ctx = ctxFor(`ts-${i}`);
      runTurnStartEvents(ctx, 0);
      expect(ctx.player.turn.eventsFired.length).toBeLessThanOrEqual(1);
      fired += ctx.player.turn.eventsFired.length;
    }
    // Total weight = 400+400+80 bp ≈ 8.8% per turn → ~26 of 300.
    expect(fired).toBeGreaterThan(8);
    expect(fired).toBeLessThan(60);
    const ctx = ctxFor('cm');
    expect(chaosMultiplier(ctx, pack.eventById['boom-news']!)).toBe(1000);
    ctx.state.config.chaos = 'chaotic';
    expect(chaosMultiplier(ctx, pack.eventById['boom-news']!)).toBe(2000);
    expect(
      chaosMultiplier(ctx, {
        ...pack.eventById['boom-news']!,
        chaosWeights: { off: 0, classic: 1, modern: 2, chaotic: 7 },
      }),
    ).toBe(7);
  });
  it('scheduled and trigger events fire when due', () => {
    const ctx = ctxFor('sch');
    ctx.player.scheduled.push(
      { eventId: 'boom-news', week: 1 },
      { eventId: 'recession-news', week: 9 },
      { eventId: 'ghost', week: 1 },
    );
    runScheduledEvents(ctx, 0);
    expect(ctx.player.turn.eventsFired).toEqual(['boom-news']);
    expect(ctx.player.scheduled).toEqual([{ eventId: 'recession-news', week: 9 }]);
    runTriggerEvents(ctx, 0, 'onEnter:bank');
    expect(ctx.player.turn.eventsFired).toEqual(['boom-news']);
    const bad = pack.eventById['market-crash-3']!;
    const before = ctx.player.stats.eventsSuffered;
    ctx.player.scheduled.push({ eventId: bad.id, week: 1 });
    runScheduledEvents(ctx, 0);
    expect(ctx.player.stats.eventsSuffered).toBe(before + 1);
  });
  it('a market crash lowers econ and non-immune prices and may fire the worker', () => {
    const ctx = ctxFor(
      'crash',
      (p) => (p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 }),
    );
    ctx.player.scheduled.push({ eventId: 'market-crash-3', week: 1 });
    runScheduledEvents(ctx, 0);
    expect(ctx.state.econ.index).toBeLessThan(1000);
    expect(ctx.state.market.prices['blue-chip']).toBe(8000);
    expect(ctx.player.job).toBeNull();
  });
});

describe('economy tick (GDD 4.12, SEED_DATA 14.4)', () => {
  it('index stays within [0.5, 1.6] and prices within bounds over 10k weeks', () => {
    const ctx = ctxFor('econ-10k');
    const phases = new Set<string>();
    let minIdx = Infinity;
    let maxIdx = -Infinity;
    for (let w = 0; w < 10_000; w++) {
      tickEconomy(ctx);
      tickMarket(ctx);
      phases.add(ctx.state.econ.phase);
      minIdx = Math.min(minIdx, ctx.state.econ.index);
      maxIdx = Math.max(maxIdx, ctx.state.econ.index);
      for (const a of pack.assets) {
        const p = ctx.state.market.prices[a.id]!;
        expect(p).toBeGreaterThanOrEqual(a.minCents!);
        expect(p).toBeLessThanOrEqual(a.maxCents!);
        expect(Number.isInteger(p)).toBe(true);
      }
      expect(Number.isInteger(ctx.state.econ.index)).toBe(true);
    }
    expect(minIdx).toBeGreaterThanOrEqual(500);
    expect(maxIdx).toBeLessThanOrEqual(1600);
    expect(phases.size).toBe(3);
    expect(ctx.state.market.history.gold!.length).toBe(26);
    expect(['boom', 'stable', 'recession']).toContain(ctx.state.news.phaseHint);
  });
  it('stepBounded reflects at both bounds', () => {
    const ctx = ctxFor('reflect');
    const gold = pack.assetById.gold!;
    ctx.state.econ.lastChangePm = 0;
    expect(stepBounded(ctx, { ...gold, maxMoveBp: 0 }, 10_000)).toBe(10_000);
    const hi = stepBounded(ctx, { ...gold, maxMoveBp: 0, econCorrBp: 10_000 }, 13_990);
    ctx.state.econ.lastChangePm = 100;
    const hi2 = stepBounded(ctx, { ...gold, maxMoveBp: 0, econCorrBp: 10_000 }, 13_990);
    expect(hi).toBe(13_990);
    expect(hi2).toBeLessThanOrEqual(14_000);
    ctx.state.econ.lastChangePm = -500;
    const lo = stepBounded(ctx, { ...gold, maxMoveBp: 0, econCorrBp: 10_000 }, 8_010);
    expect(lo).toBeGreaterThanOrEqual(8000);
  });
  it('news hint is right about 70% of the time', () => {
    let right = 0;
    for (let i = 0; i < 400; i++) {
      const ctx = ctxFor(`news-${i}`);
      tickEconomy(ctx);
      if (ctx.state.news.accurate) {
        right++;
        expect(ctx.state.news.phaseHint).toBe(ctx.state.econ.phase);
      } else expect(ctx.state.news.phaseHint).not.toBe(ctx.state.econ.phase);
    }
    expect(right / 400).toBeGreaterThan(0.6);
    expect(right / 400).toBeLessThan(0.8);
  });
  it('the econ scales prices: rent lock at hire/move, wages at hire', () => {
    let s = newGame('scale');
    s = patch(s, 0, (p, st) => {
      st.econ.index = 1200;
      p.cash = 5000;
      st.week = 4;
    });
    s = run(s, 0, [
      { type: 'Move', to: 'employment-office', mode: 'walk' },
      { type: 'Enter' },
      { type: 'ApplyJob', jobId: 'burger-joint-cook' },
    ]);
    expect(s.players[0]!.job!.wage).toBe(5);
    const r = applyCommand(
      run(s, 0, [{ type: 'Move', to: 'rent-office', mode: 'walk' }, { type: 'Enter' }]),
      0,
      { type: 'MoveHome', tier: 'high' },
      pack,
    );
    expect(r.state.players[0]!.home.rentLocked).toBe(570);
  });
});
