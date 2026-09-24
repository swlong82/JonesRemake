/** M1.7: Relax, PayRent, RequestExtension, MoveHome. */
import { describe, expect, it } from 'vitest';
import { applyCommand, previewCommand, rentDueWeek, Ctx } from '../index.js';
import { classic, goInside, newGame, patch, run } from '../testing.js';

const pack = classic();

describe('Relax (GDD 4.9, 3.3)', () => {
  it('at home: 6h, relaxation +3 (max 50), happiness +1 +1 per comfort durable (max +7), once per turn', () => {
    const s = patch(newGame('relax'), 0, (p) => {
      p.items.push({
        uid: 'tv',
        itemId: 'television',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'electronics-store',
      });
      p.items.push({
        uid: 'st',
        itemId: 'stereo',
        condition: 'broken',
        boughtWeek: 1,
        boughtAt: 'electronics-store',
      });
    });
    expect(previewCommand(s, 0, { type: 'Relax' }, pack)).toMatchObject({
      hours: -12,
      deltas: { happiness: 2, relaxation: 3 },
    });
    const r = applyCommand(s, 0, { type: 'Relax' }, pack);
    expect(r.events.map((e) => e.type)).toEqual([
      'HoursSpent',
      'StatChanged',
      'StatChanged',
      'Relaxed',
    ]);
    expect(r.state.players[0]!.relaxation).toBe(13);
    expect(r.state.players[0]!.happiness).toBe(12);
    expect(applyCommand(r.state, 0, { type: 'Relax' }, pack).events[0]).toMatchObject({
      code: 'ERR_ALREADY_RELAXED',
    });
    const maxed = patch(s, 0, (p) => {
      p.relaxation = 49;
      for (let i = 0; i < 6; i++)
        p.items.push({
          uid: `c${i}`,
          itemId: 'computer',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'electronics-store',
        });
    });
    const r2 = applyCommand(maxed, 0, { type: 'Relax' }, pack);
    expect(r2.state.players[0]!.relaxation).toBe(50);
    // Start happiness 10 plus the pack's relax cap (base + 1 per comfort durable, capped).
    expect(r2.state.players[0]!.happiness).toBe(10 + pack.rules.happiness.relaxMax);
  });
  it('in the park: base happiness only; rejected where there is no relax service or too few hours', () => {
    const park = goInside(newGame('park'), 0, 'park');
    const r = applyCommand(park, 0, { type: 'Relax' }, pack);
    expect(r.state.players[0]!.happiness).toBe(10 + pack.rules.happiness.relaxBase);
    const bank = goInside(newGame('park'), 0, 'bank');
    expect(applyCommand(bank, 0, { type: 'Relax' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_AT_LOCATION',
    });
    const tired = patch(newGame('park'), 0, (p) => (p.hoursLeft = 11));
    expect(applyCommand(tired, 0, { type: 'Relax' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_HOURS',
    });
    const outside = patch(newGame('park'), 0, (p) => (p.inside = false));
    expect(applyCommand(outside, 0, { type: 'Relax' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_INSIDE',
    });
  });
});

const atRent = (seed: string, week = 4) => {
  const s = patch(newGame(seed), 0, (_p, st) => (st.week = week));
  return goInside(s, 0, 'rent-office');
};

describe('PayRent (GDD 4.10)', () => {
  it('pays N months in advance at the locked rent, 0h; clears debt first', () => {
    const s = patch(atRent('rent'), 0, (p) => (p.cash = 1000));
    expect(rentDueWeek(new Ctx(s, pack, 0), 0)).toBe(4);
    const r = applyCommand(s, 0, { type: 'PayRent', months: 2 }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['MoneyChanged', 'RentPaid']);
    expect(r.state.players[0]!.cash).toBe(350);
    expect(r.state.players[0]!.home.paidThroughWeek).toBe(8);
    const indebted = patch(s, 0, (p) => {
      p.home.debt = 100;
      p.home.debtSinceWeek = 3;
    });
    const r2 = applyCommand(indebted, 0, { type: 'PayRent', months: 0 }, pack);
    expect(r2.state.players[0]!.cash).toBe(900);
    expect(r2.state.players[0]!.home.debt).toBe(0);
    expect(r2.state.players[0]!.home.debtSinceWeek).toBeNull();
  });
  it('rejects: 0 months without debt, > 12 months, not enough cash, wrong location', () => {
    const s = atRent('rent2');
    expect(applyCommand(s, 0, { type: 'PayRent', months: 0 }, pack).events[0]).toMatchObject({
      code: 'ERR_INVALID_AMOUNT',
    });
    expect(applyCommand(s, 0, { type: 'PayRent', months: 13 }, pack).events[0]).toMatchObject({
      code: 'ERR_INVALID_AMOUNT',
    });
    expect(applyCommand(s, 0, { type: 'PayRent', months: 1 }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_CASH',
    });
    expect(
      applyCommand(newGame('rent2'), 0, { type: 'PayRent', months: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
  });
  it('edge: paying exactly the cash on hand leaves $0', () => {
    const s = patch(atRent('rent3'), 0, (p) => (p.cash = 325));
    expect(applyCommand(s, 0, { type: 'PayRent', months: 1 }, pack).state.players[0]!.cash).toBe(0);
  });
});

describe('RequestExtension (GDD 4.10)', () => {
  it('1h; 60% approval pushes the deadline one week; denial blocks further requests', () => {
    let approved = 0;
    let denied = 0;
    for (let i = 0; i < 40; i++) {
      const s = patch(atRent(`ext-${i}`), 0, (p) => (p.cash = 10));
      const r = applyCommand(s, 0, { type: 'RequestExtension' }, pack);
      expect(r.state.players[0]!.hoursLeft).toBe(s.players[0]!.hoursLeft - 2);
      if (r.state.players[0]!.home.extensionUntilWeek !== null) {
        approved++;
        expect(r.state.players[0]!.home.extensionUntilWeek).toBe(5);
        expect(
          applyCommand(r.state, 0, { type: 'RequestExtension' }, pack).events[0],
        ).toMatchObject({ code: 'ERR_EXTENSION_DENIED' });
      } else {
        denied++;
        expect(r.state.players[0]!.home.extensionsBlocked).toBe(true);
        expect(r.events.some((e) => e.type === 'ExtensionDenied' && e.seat === 0)).toBe(true);
        // A chance denial is an outcome, never a rejection (KI-012).
        expect(r.events.some((e) => e.type === 'CommandRejected')).toBe(false);
      }
    }
    expect(approved).toBeGreaterThan(10);
    expect(denied).toBeGreaterThan(5);
  });
  it('rejects when rent is not due, after any past debt, or with debt outstanding', () => {
    const notDue = patch(atRent('ext2', 4), 0, (p) => (p.home.paidThroughWeek = 4));
    expect(applyCommand(notDue, 0, { type: 'RequestExtension' }, pack).events[0]).toMatchObject({
      code: 'ERR_RENT_NOT_DUE',
    });
    const past = patch(atRent('ext3'), 0, (p) => (p.home.everHadDebt = true));
    expect(applyCommand(past, 0, { type: 'RequestExtension' }, pack).events[0]).toMatchObject({
      code: 'ERR_EXTENSION_DENIED',
    });
    const debt = patch(atRent('ext4'), 0, (p) => (p.home.debt = 50));
    expect(applyCommand(debt, 0, { type: 'RequestExtension' }, pack).events[0]).toMatchObject({
      code: 'ERR_RENT_NOT_DUE',
    });
    expect(previewCommand(atRent('ext5'), 0, { type: 'RequestExtension' }, pack).riskBp).toBe(4000);
  });
  it('edge: needs 1h left', () => {
    const tired = patch(atRent('ext6'), 0, (p) => (p.hoursLeft = 1));
    expect(applyCommand(tired, 0, { type: 'RequestExtension' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_HOURS',
    });
  });
});

describe('MoveHome (GDD 4.10)', () => {
  it('costs one month of the new rent (+ debt), locks rent, +5 happiness once for secure', () => {
    const s = patch(atRent('home'), 0, (p) => (p.cash = 1000));
    expect(previewCommand(s, 0, { type: 'MoveHome', tier: 'high' }, pack)).toMatchObject({
      money: -475,
      deltas: { happiness: 5 },
    });
    const r = applyCommand(s, 0, { type: 'MoveHome', tier: 'high' }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['MoneyChanged', 'StatChanged', 'HomeMoved']);
    const p = r.state.players[0]!;
    expect(p.home.tier).toBe('high');
    expect(p.home.rentLocked).toBe(475);
    expect(p.cash).toBe(525);
    expect(p.happiness).toBe(15);
    expect(p.home.paidThroughWeek).toBe(8);
    const back = run(r.state, 0, [{ type: 'MoveHome', tier: 'low' }]);
    const again = applyCommand(back, 0, { type: 'MoveHome', tier: 'high' }, pack);
    expect(again.events.map((e) => e.type)).not.toContain('StatChanged');
  });
  it('rejects same tier and insufficient cash', () => {
    const s = atRent('home2');
    expect(applyCommand(s, 0, { type: 'MoveHome', tier: 'low' }, pack).events[0]).toMatchObject({
      code: 'ERR_ALREADY_IN_TIER',
    });
    expect(applyCommand(s, 0, { type: 'MoveHome', tier: 'high' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_CASH',
    });
    expect(
      applyCommand(s, 0, { type: 'MoveHome', tier: 'penthouse' } as never, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
  });
  it('edge: next turn starts at the new home', () => {
    let s = patch(atRent('home3'), 0, (p) => (p.cash = 1000));
    s = run(s, 0, [{ type: 'MoveHome', tier: 'high' }, { type: 'EndTurn' }]);
    s = run(s, 1, [{ type: 'EndTurn' }]);
    expect(s.players[0]!.location).toBe('secure-apartments');
    expect(s.players[0]!.inside).toBe(true);
  });
});
