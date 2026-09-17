/** Turn-start pending resolution (GDD 4.8/4.10) and formula events (burglary, breakdown, doctor). */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  breakdownChanceBp,
  burglaryChanceBp,
  Ctx,
  doctorChanceBp,
} from '../index.js';
import { classic, humanSeat, newGame, patch, run } from '../testing.js';

const pack = classic();

/** Run seat 0's EndTurn then seat 1's EndTurn so seat 0 starts a new week. */
function nextWeek(s: ReturnType<typeof newGame>) {
  s = run(s, 0, [{ type: 'EndTurn' }]);
  return applyCommand(s, 1, { type: 'EndTurn' }, pack);
}

describe('rent (GDD 4.10)', () => {
  it('RentDue in week 4, debt in week 5 with garnish + no extensions ever, eviction after 8 weeks of debt', () => {
    // Enough cash that weekend costs never cascade into rent debt; only unpaid rent does.
    let s = patch(newGame('rent', [humanSeat(), humanSeat()]), 0, (p) => (p.cash = 5000));
    const evs: string[] = [];
    for (let w = 1; w <= 13; w++) {
      const r = nextWeek(s);
      s = r.state;
      const mine = r.events.filter((e) => 'seat' in e && e.seat === 0).map((e) => e.type);
      if (mine.includes('RentDue')) evs.push(`${s.week}:due`);
      if (mine.includes('RentDebt')) evs.push(`${s.week}:debt`);
      if (mine.includes('Evicted')) evs.push(`${s.week}:evicted`);
    }
    expect(evs).toEqual(['4:due', '5:debt', '8:due', '9:debt', '12:due', '13:debt', '13:evicted']);
    const p = s.players[0]!;
    expect(p.home.everHadDebt).toBe(true);
    expect(p.home.extensionsBlocked).toBe(true);
    expect(p.home.debt).toBe(0);
    expect(p.home.tier).toBe('low');
  });
  it('paying in advance prevents debt; extension defers by one week', () => {
    let s = patch(newGame('rent2', [humanSeat(), humanSeat()]), 0, (p, st) => {
      p.cash = 2000;
      st.week = 4;
    });
    s = run(s, 0, [
      { type: 'Move', to: 'rent-office', mode: 'walk' },
      { type: 'Enter' },
      { type: 'PayRent', months: 2 },
    ]);
    let debt = false;
    for (let i = 0; i < 8; i++) {
      const r = nextWeek(s);
      s = r.state;
      if (r.events.some((e) => e.type === 'RentDebt' && e.seat === 0)) debt = true;
    }
    expect(debt).toBe(false);
    expect(s.week).toBe(12);
    const ext = patch(newGame('rent3', [humanSeat(), humanSeat()]), 0, (p, st) => {
      st.week = 4;
      p.home.extensionUntilWeek = 5;
    });
    const r1 = nextWeek(ext);
    expect(r1.events.some((e) => e.type === 'RentDebt')).toBe(false);
    const r2 = nextWeek(r1.state);
    expect(r2.events.some((e) => e.type === 'RentDebt')).toBe(true);
  });
  it('eviction keeps only the 2 newest durables and returns the player to low-cost housing', () => {
    let s = patch(newGame('evict', [humanSeat(), humanSeat()]), 0, (p, st) => {
      st.week = 20;
      p.home.tier = 'high';
      p.home.debt = 900;
      p.home.debtSinceWeek = 12;
      p.home.paidThroughWeek = 20;
      p.items.push({
        uid: 'a',
        itemId: 'television',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'x',
      });
      p.items.push({ uid: 'b', itemId: 'stereo', condition: 'ok', boughtWeek: 5, boughtAt: 'x' });
      p.items.push({ uid: 'c', itemId: 'computer', condition: 'ok', boughtWeek: 9, boughtAt: 'x' });
      p.relaxation = 50;
    });
    const r = nextWeek(s);
    s = r.state;
    expect(r.events.filter((e) => e.type === 'Evicted')).toHaveLength(1);
    expect(s.players[0]!.items.map((i) => i.uid).sort()).toEqual(['b', 'c']);
    expect(s.players[0]!.home).toMatchObject({
      tier: 'low',
      debt: 0,
      rentLocked: Math.floor((325 * s.econ.index + 500) / 1000),
    });
  });
});

describe('food, starvation, spoilage', () => {
  it('unrefrigerated food spoils at turn start → doctor visit (−10h, $30–60), fridge food is eaten one unit per week', () => {
    let s = patch(newGame('spoil', [humanSeat(), humanSeat()]), 0, (p) => {
      p.food.unrefrigeratedUnits = 2;
      p.cash = 500;
    });
    let r = nextWeek(s);
    expect(r.events.map((e) => e.type)).toContain('Spoiled');
    expect(r.state.players[0]!.hoursLeft).toBeLessThanOrEqual(100);
    expect(r.state.players[0]!.cash).toBeLessThan(500);
    expect(r.state.players[0]!.food.unrefrigeratedUnits).toBe(0);
    s = patch(newGame('fridge', [humanSeat(), humanSeat()]), 0, (p) => {
      p.food.fridgeUnits = 2;
      p.items.push({
        uid: 'f',
        itemId: 'refrigerator',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'x',
      });
    });
    r = nextWeek(s);
    expect(r.state.players[0]!.food.fridgeUnits).toBe(1);
    expect(r.state.players[0]!.hoursLeft).toBeGreaterThanOrEqual(110);
    const broken = patch(s, 0, (p) => (p.items[0]!.condition = 'broken'));
    r = nextWeek(broken);
    expect(r.events.map((e) => e.type)).toContain('Spoiled');
  });
  it('starvation costs 20h and 5 happiness; doctor bill falls into rent debt when broke', () => {
    let s = patch(newGame('broke', [humanSeat(), humanSeat()]), 0, (p) => {
      p.cash = 0;
      p.food.unrefrigeratedUnits = 3;
    });
    const r = nextWeek(s);
    s = r.state;
    expect(s.players[0]!.home.debt).toBeGreaterThanOrEqual(30);
    const r2 = nextWeek(patch(newGame('hungry', [humanSeat(), humanSeat()]), 0, () => undefined));
    expect(r2.events.map((e) => e.type)).toContain('Starved');
    expect(r2.state.players[0]!.hoursLeft).toBeLessThanOrEqual(80);
    expect(r2.events).toContainEqual(
      expect.objectContaining({
        type: 'StatChanged',
        stat: 'happiness',
        delta: -5,
        reason: 'starvation',
      }),
    );
  });
});

describe('formula events (SEED_DATA 14.5, GDD 4.10)', () => {
  it('burglary chance: 2% + 1% per durable − 0.08% per relaxation, clamped 0.5–15%, never in secure housing', () => {
    const s = patch(newGame('burg'), 0, (p) => {
      p.items.push({
        uid: 'a',
        itemId: 'television',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'x',
      });
      p.relaxation = 10;
    });
    expect(burglaryChanceBp(new Ctx(s, pack, 0), 0)).toBe(220);
    expect(
      burglaryChanceBp(
        new Ctx(
          patch(s, 0, (p) => (p.relaxation = 50)),
          pack,
          0,
        ),
        0,
      ),
    ).toBe(50);
    const many = patch(s, 0, (p) => {
      for (let i = 0; i < 20; i++)
        p.items.push({
          uid: `i${i}`,
          itemId: 'atlas',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'x',
        });
    });
    expect(burglaryChanceBp(new Ctx(many, pack, 0), 0)).toBe(1500);
    expect(
      burglaryChanceBp(
        new Ctx(
          patch(s, 0, (p) => (p.home.tier = 'high')),
          pack,
          0,
        ),
        0,
      ),
    ).toBe(0);
  });
  it('a burglary steals 1..all durables and −4 happiness (found by seed scan)', () => {
    let seen = false;
    for (let i = 0; i < 150 && !seen; i++) {
      const s = patch(newGame(`burg-${i}`, [humanSeat(), humanSeat()]), 0, (p) => {
        for (let k = 0; k < 12; k++)
          p.items.push({
            uid: `i${k}`,
            itemId: 'atlas',
            condition: 'ok',
            boughtWeek: 1,
            boughtAt: 'x',
          });
        p.relaxation = 10;
      });
      const r = nextWeek(s);
      const ev = r.events.find((e) => e.type === 'EventFired' && e.eventId === 'core:burglary');
      if (ev) {
        seen = true;
        expect(r.state.players[0]!.items.length).toBeLessThan(12);
        expect(r.state.players[0]!.happiness).toBeLessThanOrEqual(6);
      }
    }
    expect(seen).toBe(true);
  });
  it('breakdown chance per item, ×2.5 for discount-store purchases; doctor chance floors at 1%', () => {
    const ctx = new Ctx(newGame('brk'), pack, 0);
    expect(breakdownChanceBp(ctx, 'microwave', 'appliance-depot')).toBe(150);
    expect(breakdownChanceBp(ctx, 'microwave', 'discount-store')).toBe(375);
    expect(breakdownChanceBp(ctx, 'atlas', 'discount-store')).toBe(0);
    expect(doctorChanceBp(ctx, 0)).toBe(450);
    expect(
      doctorChanceBp(
        new Ctx(
          patch(newGame('brk'), 0, (p) => (p.relaxation = 100)),
          pack,
          0,
        ),
        0,
      ),
    ).toBe(100);
  });
  it('items break over time (seed scan) and Chaos Off disables formula events', () => {
    let broke = false;
    for (let i = 0; i < 100 && !broke; i++) {
      const s = patch(newGame(`brk-${i}`, [humanSeat(), humanSeat()]), 0, (p) => {
        p.items.push({
          uid: 'm',
          itemId: 'microwave',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'discount-store',
        });
        p.items.push({
          uid: 't',
          itemId: 'media-player',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'discount-store',
        });
      });
      const r = nextWeek(s);
      if (r.events.some((e) => e.type === 'ItemBroke')) broke = true;
    }
    expect(broke).toBe(true);
    for (let i = 0; i < 40; i++) {
      const s = patch(newGame(`off-${i}`, [humanSeat(), humanSeat()], { chaos: 'off' }), 0, (p) => {
        p.items.push({
          uid: 'm',
          itemId: 'microwave',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'discount-store',
        });
        p.relaxation = 10;
      });
      const r = nextWeek(s);
      expect(
        r.events.some(
          (e) =>
            e.type === 'ItemBroke' ||
            e.type === 'ItemsStolen' ||
            (e.type === 'EventFired' && e.eventId.startsWith('core:')),
        ),
      ).toBe(false);
    }
  });
});
