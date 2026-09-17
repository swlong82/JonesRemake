/** M1.6: movement, enter/exit, hour accounting (walk only). */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  legalCommands,
  partialDestination,
  theftChanceBp,
  tripCost,
  Ctx,
} from '../index.js';
import { classic, goInside, humanSeat, newGame, patch, run } from '../testing.js';

const pack = classic();
const ctxOf = (s: ReturnType<typeof newGame>, seat = 0): Ctx => new Ctx(s, pack, seat);

describe('Move (GDD 4.3)', () => {
  it('picks the shortest direction and rounds hours up to the half hour', () => {
    const s = newGame('move');
    const ctx = ctxOf(s);
    // 1 step = 0.625h → 1h (2 half-hours); 3 steps = 1.875h → 2h; 8 steps = 5h; 15 steps ≡ 1 step.
    expect(tripCost(ctx, 'low-housing', 'rent-office', 'walk')).toEqual({
      steps: 1,
      hours: 2,
      money: 0,
    });
    expect(tripCost(ctx, 'low-housing', 'discount-store', 'walk')).toEqual({
      steps: 3,
      hours: 4,
      money: 0,
    });
    expect(tripCost(ctx, 'low-housing', 'employment-office', 'walk')).toEqual({
      steps: 8,
      hours: 10,
      money: 0,
    });
    expect(tripCost(ctx, 'low-housing', 'park', 'walk')).toEqual({ steps: 1, hours: 2, money: 0 });
    expect(tripCost(ctx, 'low-housing', 'low-housing', 'walk')).toEqual({
      steps: 0,
      hours: 0,
      money: 0,
    });
    expect(tripCost(ctx, 'nowhere', 'park', 'walk').steps).toBe(0);
  });
  it('valid move exits the home, spends hours, updates location', () => {
    const s = newGame('move');
    const r = applyCommand(s, 0, { type: 'Move', to: 'bank', mode: 'walk' }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['Exited', 'HoursSpent', 'Moved']);
    const p = r.state.players[0]!;
    expect(p.location).toBe('bank');
    expect(p.inside).toBe(false);
    expect(p.hoursLeft).toBe(120 - 8); // 6 steps (16 − 10) → ceil(6 × 1.25) = 8 half-hours
  });
  it('rejects unknown destination, unknown mode, same square, zero hours', () => {
    const s = newGame('move');
    expect(
      applyCommand(s, 0, { type: 'Move', to: 'moon', mode: 'walk' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
    expect(
      applyCommand(s, 0, { type: 'Move', to: 'bank', mode: 'jetpack' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
    expect(
      applyCommand(s, 0, { type: 'Move', to: 'low-housing', mode: 'walk' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
    const tired = patch(s, 0, (p) => {
      p.hoursLeft = 0;
      p.inside = false;
    });
    expect(
      applyCommand(tired, 0, { type: 'Move', to: 'bank', mode: 'walk' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_HOURS' });
    expect(applyCommand(s, 0, { type: 'Move', to: 'bank' } as never, pack).events[0]).toMatchObject(
      { code: 'ERR_INVALID_AMOUNT' },
    );
  });
  it('travels as far as time allows, then the turn ends (partial move)', () => {
    let s = newGame('partial', [humanSeat(), humanSeat()]);
    s = patch(s, 0, (p) => {
      p.hoursLeft = 3; // 2 steps affordable (2×1.25=2.5→3)
    });
    const r = applyCommand(s, 0, { type: 'Move', to: 'employment-office', mode: 'walk' }, pack);
    const moved = r.events.find((e) => e.type === 'Moved');
    expect(moved).toMatchObject({ type: 'Moved', to: 'pawn-shop', hours: 3 });
    expect(r.state.activeSeat).toBe(1);
    expect(r.events.map((e) => e.type)).toContain('TurnEnded');
    // Next turn the player is back home with a fresh clock.
    expect(r.state.players[0]!.location).toBe('pawn-shop');
  });
  it('partialDestination walks the shorter way round and stays put on 0 steps', () => {
    const ctx = ctxOf(newGame('pd'));
    expect(partialDestination(ctx, 'low-housing', 'park', 1)).toBe('park');
    expect(partialDestination(ctx, 'low-housing', 'discount-store', 2)).toBe('pawn-shop');
    expect(partialDestination(ctx, 'low-housing', 'park', 0)).toBe('low-housing');
  });
  it('legalCommands offers a Move to every other location', () => {
    const s = newGame('legal');
    const moves = legalCommands(s, 0, pack).filter((c) => c.type === 'Move');
    expect(moves).toHaveLength(15);
  });
});

describe('Enter / Exit', () => {
  it('enter costs 2h and emits Entered; entering twice is rejected', () => {
    let s = newGame('enter');
    s = run(s, 0, [{ type: 'Move', to: 'bank', mode: 'walk' }]);
    const before = s.players[0]!.hoursLeft;
    const r = applyCommand(s, 0, { type: 'Enter' }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['HoursSpent', 'Entered']);
    expect(r.state.players[0]!.hoursLeft).toBe(before - 4);
    expect(r.state.players[0]!.inside).toBe(true);
    expect(applyCommand(r.state, 0, { type: 'Enter' }, pack).events[0]).toMatchObject({
      code: 'ERR_ALREADY_INSIDE',
    });
  });
  it('enter with < 2h left is rejected; exit needs to be inside', () => {
    let s = newGame('enter2');
    s = patch(s, 0, (p) => {
      p.inside = false;
      p.hoursLeft = 3;
    });
    expect(applyCommand(s, 0, { type: 'Enter' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_HOURS',
    });
    expect(applyCommand(s, 0, { type: 'Exit' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_INSIDE',
    });
  });
  it('rent office is closed outside rent week unless employed there or holding an extension (13.5)', () => {
    let s = newGame('closed', [humanSeat(), humanSeat()]);
    s = run(s, 0, [{ type: 'Move', to: 'rent-office', mode: 'walk' }]);
    expect(applyCommand(s, 0, { type: 'Enter' }, pack).events[0]).toMatchObject({
      code: 'ERR_LOCATION_CLOSED',
    });
    const employed = patch(s, 0, (p) => {
      p.job = { jobId: 'rent-office-records-clerk', wage: 7, raises: 0, hiredWeek: 1 };
    });
    expect(applyCommand(employed, 0, { type: 'Enter' }, pack).events[1]).toMatchObject({
      type: 'Entered',
    });
    const ext = patch(s, 0, (p) => {
      p.home.extensionUntilWeek = 5;
    });
    expect(applyCommand(ext, 0, { type: 'Enter' }, pack).events[1]).toMatchObject({
      type: 'Entered',
    });
    const week4 = patch(s, 0, (_p, st) => {
      st.week = 4;
    });
    expect(applyCommand(week4, 0, { type: 'Enter' }, pack).events[1]).toMatchObject({
      type: 'Entered',
    });
  });
  it('exiting with 0 hours ends the turn (ORIGINAL_REFERENCE 3.1)', () => {
    let s = newGame('exit0', [humanSeat(), humanSeat()]);
    s = goInside(s, 0, 'bank');
    s = patch(s, 0, (p) => {
      p.hoursLeft = 0;
    });
    const r = applyCommand(s, 0, { type: 'Exit' }, pack);
    expect(r.events.map((e) => e.type)).toContain('TurnEnded');
    expect(r.state.activeSeat).toBe(1);
  });
  it('zero-hour actions remain allowed inside, time-costing ones do not', () => {
    let s = newGame('zero', [humanSeat(), humanSeat()]);
    s = goInside(s, 0, 'bank');
    s = patch(s, 0, (p) => {
      p.hoursLeft = 0;
    });
    const r = applyCommand(s, 0, { type: 'Deposit', amount: 50 }, pack);
    expect(r.events.map((e) => e.type)).toContain('Deposited');
    expect(
      applyCommand(s, 0, { type: 'Move', to: 'park', mode: 'walk' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_HOURS' });
    const legal = legalCommands(s, 0, pack).map((c) => c.type);
    expect(legal).toContain('Deposit');
    expect(legal).toContain('EndTurn');
    expect(legal).not.toContain('Move');
  });
});

describe('street theft on exit (SEED_DATA 14.5)', () => {
  it('chance formula: base 3% + 1% per $100 above $200, cap 12%, only at theft locations', () => {
    let s = newGame('theft');
    s = goInside(s, 0, 'bank');
    let ctx = ctxOf(s);
    expect(theftChanceBp(ctx, 0)).toBe(300);
    ctx = ctxOf(patch(s, 0, (p) => (p.cash = 650)));
    expect(theftChanceBp(ctx, 0)).toBe(700);
    ctx = ctxOf(patch(s, 0, (p) => (p.cash = 5000)));
    expect(theftChanceBp(ctx, 0)).toBe(1200);
    ctx = ctxOf(patch(s, 0, (p) => (p.location = 'park')));
    expect(theftChanceBp(ctx, 0)).toBe(0);
  });
  it('a theft steals all cash and lowers happiness (found by seed scan); Chaos Off never steals', () => {
    let hit = false;
    for (let i = 0; i < 200 && !hit; i++) {
      let s = newGame(`theft-${i}`);
      s = goInside(s, 0, 'bank');
      s = patch(s, 0, (p) => (p.cash = 3000));
      const r = applyCommand(s, 0, { type: 'Exit' }, pack);
      if (r.events.some((e) => e.type === 'EventFired' && e.eventId === 'core:street-theft')) {
        hit = true;
        expect(r.state.players[0]!.cash).toBe(0);
        expect(r.state.players[0]!.happiness).toBe(6);
      }
    }
    expect(hit).toBe(true);
    for (let i = 0; i < 50; i++) {
      let s = newGame(`theft-off-${i}`, [humanSeat()], { chaos: 'off' });
      s = goInside(s, 0, 'bank');
      s = patch(s, 0, (p) => (p.cash = 3000));
      expect(applyCommand(s, 0, { type: 'Exit' }, pack).state.players[0]!.cash).toBe(3000);
    }
  });
  it('preview of Exit at the bank shows the theft risk', () => {
    let s = newGame('prev');
    s = goInside(s, 0, 'bank');
    const ctx = ctxOf(s);
    expect(theftChanceBp(ctx, 0)).toBeGreaterThan(0);
  });
});
