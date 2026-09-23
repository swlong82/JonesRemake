/** M1.7: Enroll, Study. */
import { describe, expect, it } from 'vitest';
import { applyCommand, previewCommand } from '../index.js';
import { classic, goInside, newGame, patch, run } from '../testing.js';

const pack = classic();
const atUni = (seed: string) => goInside(newGame(seed), 0, 'university');

describe('Enroll (GDD 4.7)', () => {
  it('charges $50 × econ, 10 lessons, 0h', () => {
    const s = atUni('enroll');
    const r = applyCommand(s, 0, { type: 'Enroll', degreeId: 'trade-school' }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['MoneyChanged', 'Enrolled']);
    expect(r.state.players[0]!.cash).toBe(150);
    expect(r.state.players[0]!.enrolled).toEqual({ 'trade-school': { lessonsLeft: 10 } });
    expect(r.state.players[0]!.hoursLeft).toBe(s.players[0]!.hoursLeft);
  });
  it('rejects unknown, already held/enrolled, missing prereq, > 4 courses, no cash, wrong place', () => {
    const s = atUni('enroll2');
    expect(
      applyCommand(s, 0, { type: 'Enroll', degreeId: 'alchemy' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
    expect(
      applyCommand(s, 0, { type: 'Enroll', degreeId: 'electronics' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_PREREQ_MISSING' });
    const held = patch(s, 0, (p) => p.degrees.push('trade-school'));
    expect(
      applyCommand(held, 0, { type: 'Enroll', degreeId: 'trade-school' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ALREADY_HAS_DEGREE' });
    const enrolled = run(s, 0, [{ type: 'Enroll', degreeId: 'trade-school' }]);
    expect(
      applyCommand(enrolled, 0, { type: 'Enroll', degreeId: 'trade-school' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ALREADY_HAS_DEGREE' });
    const full = patch(s, 0, (p) => {
      p.degrees = ['trade-school', 'junior-college', 'academic', 'graduate-school'];
      p.enrolled = {
        electronics: { lessonsLeft: 1 },
        'pre-engineering': { lessonsLeft: 1 },
        'business-admin': { lessonsLeft: 1 },
        'post-doctoral': { lessonsLeft: 1 },
      };
    });
    expect(
      applyCommand(full, 0, { type: 'Enroll', degreeId: 'publishing' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_PREREQ_MISSING' });
    const full2 = patch(full, 0, (p) => p.degrees.push('research'));
    expect(
      applyCommand(full2, 0, { type: 'Enroll', degreeId: 'publishing' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_MAX_COURSES' });
    const broke = patch(s, 0, (p) => (p.cash = 10));
    expect(
      applyCommand(broke, 0, { type: 'Enroll', degreeId: 'trade-school' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
    expect(
      applyCommand(newGame('e'), 0, { type: 'Enroll', degreeId: 'trade-school' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
  });
  it('extra-credit items remove lessons (cap 2, min 8); free enrollment grants skip the fee', () => {
    const books = patch(atUni('xc'), 0, (p) => {
      p.items.push({
        uid: 'a',
        itemId: 'encyclopedia',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'discount-store',
      });
      p.items.push({
        uid: 'b',
        itemId: 'dictionary',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'discount-store',
      });
      p.items.push({
        uid: 'c',
        itemId: 'atlas',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'discount-store',
      });
      p.freeEnrollments = 1;
    });
    expect(
      previewCommand(books, 0, { type: 'Enroll', degreeId: 'trade-school' }, pack),
    ).toMatchObject({ money: 0, notes: ['lessons:8'] });
    const r = applyCommand(books, 0, { type: 'Enroll', degreeId: 'trade-school' }, pack);
    expect(r.state.players[0]!.enrolled['trade-school']).toEqual({ lessonsLeft: 8 });
    expect(r.state.players[0]!.cash).toBe(200);
    expect(r.state.players[0]!.freeEnrollments).toBe(0);
  });
});

describe('Study (GDD 4.7)', () => {
  it('6h lesson counts down; graduation: +5 happiness, +5 dependability (may exceed max), degree added', () => {
    let s = run(atUni('study'), 0, [{ type: 'Enroll', degreeId: 'trade-school' }]);
    s = patch(s, 0, (p) => (p.enrolled['trade-school'] = { lessonsLeft: 1 }));
    const r = applyCommand(s, 0, { type: 'Study', degreeId: 'trade-school' }, pack);
    expect(r.events.map((e) => e.type)).toEqual([
      'HoursSpent',
      'Studied',
      'StatChanged',
      'StatChanged',
      'Graduated',
    ]);
    const p = r.state.players[0]!;
    expect(p.degrees).toEqual(['trade-school']);
    expect(p.enrolled).toEqual({});
    expect(p.happiness).toBe(15);
    expect(p.dependability).toBe(25);
    expect(p.maxDependability).toBe(25);
    expect(p.stats.lessons).toBe(1);
  });
  it("graduation adds the pack's internship experience when it has one (ADR-0044)", () => {
    const credit = {
      ...pack,
      rules: { ...pack.rules, stats: { ...pack.rules.stats, degreeExperienceBonus: 8 } },
    };
    let s = run(atUni('intern'), 0, [{ type: 'Enroll', degreeId: 'trade-school' }]);
    s = patch(s, 0, (p) => (p.enrolled['trade-school'] = { lessonsLeft: 1 }));
    const before = s.players[0]!.experience;
    const plain = applyCommand(s, 0, { type: 'Study', degreeId: 'trade-school' }, pack);
    expect(plain.state.players[0]!.experience).toBe(before);
    const r = applyCommand(s, 0, { type: 'Study', degreeId: 'trade-school' }, credit);
    expect(r.state.players[0]!.experience).toBe(before + 8);
  });
  it('rejects unknown degree, not enrolled, too few hours, wrong place', () => {
    const s = run(atUni('study2'), 0, [{ type: 'Enroll', degreeId: 'trade-school' }]);
    expect(applyCommand(s, 0, { type: 'Study', degreeId: 'nope' }, pack).events[0]).toMatchObject({
      code: 'ERR_UNKNOWN_ID',
    });
    expect(
      applyCommand(s, 0, { type: 'Study', degreeId: 'junior-college' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENROLLED' });
    const tired = patch(s, 0, (p) => (p.hoursLeft = 11));
    expect(
      applyCommand(tired, 0, { type: 'Study', degreeId: 'trade-school' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_HOURS' });
    const away = patch(s, 0, (p) => (p.location = 'park'));
    expect(
      applyCommand(away, 0, { type: 'Study', degreeId: 'trade-school' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
  });
  it('full course: 10 lessons over two turns graduate exactly once', () => {
    let s = run(atUni('study3'), 0, [{ type: 'Enroll', degreeId: 'junior-college' }]);
    s = patch(s, 0, (p) => (p.hoursLeft = 119));
    for (let i = 0; i < 9; i++) s = run(s, 0, [{ type: 'Study', degreeId: 'junior-college' }]);
    expect(s.players[0]!.enrolled['junior-college']).toEqual({ lessonsLeft: 1 });
    expect(s.players[0]!.degrees).toEqual([]);
    expect(
      applyCommand(s, 0, { type: 'Study', degreeId: 'junior-college' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_HOURS' });
    expect(previewCommand(s, 0, { type: 'Study', degreeId: 'junior-college' }, pack).notes).toEqual(
      ['lessonsLeft:0'],
    );
  });
});
