/** M1.7: ApplyJob, AskRaise, Work — valid / invalid code / edge. */
import { describe, expect, it } from 'vitest';
import { applyCommand, Ctx, luckPercent, previewCommand, workPay } from '../index.js';
import { classic, goInside, humanSeat, newGame, patch, run } from '../testing.js';

const pack = classic();

describe('ApplyJob (GDD 4.6)', () => {
  it('cook is always hired: +3 happiness, wage × econ, dependability floor, maxima recomputed', () => {
    let s = goInside(newGame('apply'), 0, 'employment-office');
    s = patch(s, 0, (p) => (p.dependability = 4));
    const r = applyCommand(s, 0, { type: 'ApplyJob', jobId: 'burger-joint-cook' }, pack);
    expect(r.events.map((e) => e.type)).toEqual([
      'HoursSpent',
      'StatChanged',
      'StatChanged',
      'Hired',
    ]);
    const p = r.state.players[0]!;
    expect(p.job).toEqual({ jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 });
    expect(p.happiness).toBe(13);
    expect(p.dependability).toBe(10);
    expect(p.hoursLeft).toBe(120 - 10 - 4 - 8);
  });
  it('validation order: service → unknown → same job → turned down → hours → exp → dep → degrees', () => {
    const s = goInside(newGame('apply2'), 0, 'employment-office');
    const home = newGame('apply2');
    expect(
      applyCommand(home, 0, { type: 'ApplyJob', jobId: 'burger-joint-cook' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
    expect(
      applyCommand(s, 0, { type: 'ApplyJob', jobId: 'astronaut' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
    const withJob = patch(
      s,
      0,
      (p) => (p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 }),
    );
    expect(
      applyCommand(withJob, 0, { type: 'ApplyJob', jobId: 'burger-joint-cook' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ALREADY_HAVE_JOB' });
    const locked = patch(s, 0, (p) => p.turn.jobsTurnedDown.push('burger-joint-cook'));
    expect(
      applyCommand(locked, 0, { type: 'ApplyJob', jobId: 'burger-joint-cook' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NO_OPENINGS' });
    const tired = patch(s, 0, (p) => (p.hoursLeft = 7));
    expect(
      applyCommand(tired, 0, { type: 'ApplyJob', jobId: 'burger-joint-cook' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_HOURS' });
    expect(
      applyCommand(s, 0, { type: 'ApplyJob', jobId: 'burger-joint-cashier' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_REQ_EXPERIENCE' });
    const exp = patch(s, 0, (p) => (p.experience = 50));
    expect(
      applyCommand(exp, 0, { type: 'ApplyJob', jobId: 'university-professor' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_REQ_DEPENDABILITY' });
    const both = patch(exp, 0, (p) => (p.dependability = 60));
    expect(
      applyCommand(both, 0, { type: 'ApplyJob', jobId: 'university-professor' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_REQ_EDUCATION' });
  });
  it('luck roll: qualified applicants can be refused (−1 happiness, job locked this turn)', () => {
    const base = patch(goInside(newGame('luck'), 0, 'employment-office'), 0, (p) => {
      p.experience = 12;
      p.dependability = 15;
    });
    expect(luckPercent(new Ctx(base, pack, 0), 0)).toBe(30 + Math.floor((10 + 15 + 12) / 3));
    let refused = 0;
    let hired = 0;
    for (let i = 0; i < 60; i++) {
      const s = patch(base, 0, (_p, st) => (st.config.seed = `luck-${i}`));
      const r = applyCommand(s, 0, { type: 'ApplyJob', jobId: 'burger-joint-cashier' }, pack);
      if (r.events.some((e) => e.type === 'Refused')) {
        refused++;
        expect(r.state.players[0]!.happiness).toBe(9);
        expect(r.state.players[0]!.turn.jobsTurnedDown).toEqual(['burger-joint-cashier']);
        expect(
          applyCommand(r.state, 0, { type: 'ApplyJob', jobId: 'burger-joint-cashier' }, pack)
            .events[0],
        ).toMatchObject({ code: 'ERR_NO_OPENINGS' });
      } else hired++;
    }
    expect(refused).toBeGreaterThan(5);
    expect(hired).toBeGreaterThan(5);
  });
  it('preview exposes the no-openings risk and wage', () => {
    const s = goInside(newGame('prev'), 0, 'employment-office');
    expect(
      previewCommand(s, 0, { type: 'ApplyJob', jobId: 'burger-joint-cook' }, pack),
    ).toMatchObject({ hours: -8, riskBp: 0, deltas: { happiness: 3 } });
    expect(
      previewCommand(s, 0, { type: 'ApplyJob', jobId: 'burger-joint-cashier' }, pack).riskBp,
    ).toBeGreaterThan(0);
  });
});

describe('Work (GDD 4.6)', () => {
  const employed = (seed: string, jobId = 'burger-joint-cook', wage = 4) =>
    patch(
      goInside(newGame(seed), 0, 'burger-joint'),
      0,
      (p) => (p.job = { jobId, wage, raises: 0, hiredWeek: 1 }),
    );
  it('6h session pays 8 × wage, +1 exp, +2 dep (to max)', () => {
    const s = employed('work');
    const r = applyCommand(s, 0, { type: 'Work', hours: 12 }, pack);
    expect(r.events.map((e) => e.type)).toEqual([
      'HoursSpent',
      'MoneyChanged',
      'StatChanged',
      'Worked',
    ]);
    const p = r.state.players[0]!;
    expect(p.cash).toBe(232);
    expect(p.experience).toBe(11);
    expect(p.dependability).toBe(20); // already at max 20 (base 20 + req 0 + 0 degrees)
    expect(p.stats.workSessions).toBe(1);
    expect(p.stats.earned).toBe(32);
  });
  it('pro-rates pay by hours and caps at one session', () => {
    const s = employed('prorate');
    expect(workPay(new Ctx(s, pack, 0), 0, 6)).toBe(16);
    expect(workPay(new Ctx(s, pack, 0), 0, 3)).toBe(8);
    const r = applyCommand(s, 0, { type: 'Work', hours: 3 }, pack);
    expect(r.state.players[0]!.cash).toBe(208);
    expect(applyCommand(s, 0, { type: 'Work', hours: 13 }, pack).events[0]).toMatchObject({
      code: 'ERR_INVALID_AMOUNT',
    });
    const low = patch(s, 0, (p) => (p.hoursLeft = 5));
    const r2 = applyCommand(low, 0, { type: 'Work', hours: 12 }, pack);
    expect(r2.events.find((e) => e.type === 'Worked')).toMatchObject({ hours: 5, pay: 13 });
  });
  it('rejects: no job, wrong location, outside, uniform too low', () => {
    const s = goInside(newGame('work2'), 0, 'burger-joint');
    expect(applyCommand(s, 0, { type: 'Work', hours: 12 }, pack).events[0]).toMatchObject({
      code: 'ERR_NO_JOB',
    });
    const wrong = patch(
      goInside(newGame('work2'), 0, 'bank'),
      0,
      (p) => (p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 }),
    );
    expect(applyCommand(wrong, 0, { type: 'Work', hours: 12 }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_AT_LOCATION',
    });
    const outside = patch(employed('work3'), 0, (p) => (p.inside = false));
    expect(applyCommand(outside, 0, { type: 'Work', hours: 12 }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_INSIDE',
    });
    const suit = employed('work4', 'burger-joint-assistant-manager', 9);
    expect(applyCommand(suit, 0, { type: 'Work', hours: 12 }, pack).events[0]).toMatchObject({
      code: 'ERR_UNIFORM_REQUIRED',
    });
    const dressed = patch(suit, 0, (p) => {
      p.clothing.push({ tier: 'dress', weeksLeft: 3 });
      p.dependability = 35;
    });
    expect(
      applyCommand(dressed, 0, { type: 'Work', hours: 12 }, pack).events.map((e) => e.type),
    ).toContain('Worked');
  });
  it('fires the worker when dependability is far below requirement (−5 happiness, no pay)', () => {
    const s = patch(employed('fire', 'burger-joint-manager', 12), 0, (p) => {
      p.dependability = 30; // req 45 − 10 = 35 > 30
      p.clothing.push({ tier: 'business', weeksLeft: 5 });
    });
    const r = applyCommand(s, 0, { type: 'Work', hours: 12 }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['StatChanged', 'Fired']);
    expect(r.state.players[0]!.job).toBeNull();
    expect(r.state.players[0]!.happiness).toBe(5);
    expect(r.state.players[0]!.cash).toBe(200);
  });
  it('garnishes 50% + $2 while in rent debt', () => {
    const s = patch(employed('garnish'), 0, (p) => {
      p.home.debt = 100;
      p.home.debtSinceWeek = 1;
    });
    const r = applyCommand(s, 0, { type: 'Work', hours: 12 }, pack);
    const p = r.state.players[0]!;
    expect(p.cash).toBe(200 + 32 - 18);
    expect(p.home.debt).toBe(82);
    const small = patch(s, 0, (p2) => (p2.home.debt = 5));
    const r2 = applyCommand(small, 0, { type: 'Work', hours: 12 }, pack);
    expect(r2.state.players[0]!.home.debt).toBe(0);
    expect(r2.state.players[0]!.home.debtSinceWeek).toBeNull();
  });
});

describe('AskRaise (GDD 4.6)', () => {
  const ready = (seed: string) =>
    patch(goInside(newGame(seed), 0, 'employment-office'), 0, (p) => {
      p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
      p.dependability = 30;
    });
  it('raises the wage and requirement, +3 happiness, 4h', () => {
    const r = applyCommand(ready('raise'), 0, { type: 'AskRaise' }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['HoursSpent', 'StatChanged', 'Raised']);
    expect(r.state.players[0]!.job).toMatchObject({ raises: 1 });
    expect(r.state.players[0]!.job!.wage).toBeGreaterThanOrEqual(4);
    expect(r.state.players[0]!.happiness).toBe(13);
  });
  it('rejects without a job, without enough dependability, off-site', () => {
    const noJob = goInside(newGame('raise2'), 0, 'employment-office');
    expect(applyCommand(noJob, 0, { type: 'AskRaise' }, pack).events[0]).toMatchObject({
      code: 'ERR_NO_JOB',
    });
    const lowDep = patch(ready('raise3'), 0, (p) => (p.dependability = 0));
    expect(applyCommand(lowDep, 0, { type: 'AskRaise' }, pack).events[0]).toMatchObject({
      code: 'ERR_RAISE_NOT_ELIGIBLE',
    });
    expect(applyCommand(newGame('raise4'), 0, { type: 'AskRaise' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_AT_LOCATION',
    });
  });
  it('each raise lifts the requirement by 5 (edge: second raise needs dep > req + 5)', () => {
    let s = ready('raise5');
    s = run(s, 0, [{ type: 'AskRaise' }]);
    // req 0 + 5×1 = 5 < 30 → still eligible; set dependability to 5 to block.
    const blocked = patch(s, 0, (p) => (p.dependability = 5));
    expect(applyCommand(blocked, 0, { type: 'AskRaise' }, pack).events[0]).toMatchObject({
      code: 'ERR_RAISE_NOT_ELIGIBLE',
    });
    const tired = patch(s, 0, (p) => (p.hoursLeft = 2));
    expect(applyCommand(tired, 0, { type: 'AskRaise' }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_HOURS',
    });
  });
});

describe('human seat helper', () => {
  it('humanSeat builds valid goals', () => {
    expect(humanSeat('Z', 30).goals.wealth).toBe(30);
  });
});
