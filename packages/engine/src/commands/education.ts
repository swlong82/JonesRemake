/** Education: Enroll, Study (GDD 4.7, ORIGINAL_REFERENCE 3.5). */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import { recomputeMaxima } from '../core/goals.js';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import { requireCash, requireHours, requireService } from './common.js';

export interface EnrollCommand extends BaseCommand {
  type: 'Enroll';
  degreeId: string;
}
export interface StudyCommand extends BaseCommand {
  type: 'Study';
  degreeId: string;
}

export function extraCreditCount(ctx: Ctx, seat: number): number {
  const ids = new Set<string>();
  for (const owned of ctx.playerAt(seat).items) {
    if (owned.condition !== 'ok') continue;
    if (ctx.pack.itemById[owned.itemId]?.extraCredit) ids.add(owned.itemId);
  }
  return Math.min(ctx.rules.education.extraCreditCap, ids.size);
}

export function enrollFee(ctx: Ctx, degreeId: string): number {
  const d = ctx.pack.degreeById[degreeId];
  if (ctx.player.freeEnrollments > 0) return 0;
  return ctx.econ(d?.feeBase ?? ctx.rules.education.enrollFee);
}

export const enrollHandler: CommandHandler<EnrollCommand> = {
  type: 'Enroll',
  schema: z.object({ type: z.literal('Enroll'), degreeId: z.string() }).strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: enrollFee(ctx, cmd.degreeId) }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'study');
    if (svc) return svc;
    const d = ctx.pack.degreeById[cmd.degreeId];
    if (!d) return 'ERR_UNKNOWN_ID';
    const p = ctx.player;
    if (p.degrees.includes(d.id) || d.id in p.enrolled) return 'ERR_ALREADY_HAS_DEGREE';
    for (const pre of d.prereqs) if (!p.degrees.includes(pre)) return 'ERR_PREREQ_MISSING';
    if (Object.keys(p.enrolled).length >= ctx.rules.education.maxConcurrent)
      return 'ERR_MAX_COURSES';
    return requireCash(ctx, enrollFee(ctx, cmd.degreeId));
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const d = ctx.pack.degreeById[cmd.degreeId]!;
    const fee = enrollFee(ctx, cmd.degreeId);
    if (fee === 0 && p.freeEnrollments > 0) p.freeEnrollments -= 1;
    if (fee > 0) ctx.addMoney(ctx.seat, 'cash', -fee, 'enroll');
    const lessons = Math.max(
      ctx.rules.education.minLessons,
      d.lessons - extraCreditCount(ctx, ctx.seat),
    );
    p.enrolled[d.id] = { lessonsLeft: lessons };
    ctx.emit({ type: 'Enrolled', seat: ctx.seat, degreeId: d.id });
  },
  preview: (ctx, cmd) => {
    const d = ctx.pack.degreeById[cmd.degreeId];
    return {
      notes: [
        `lessons:${d ? Math.max(ctx.rules.education.minLessons, d.lessons - extraCreditCount(ctx, ctx.seat)) : 0}`,
      ],
    };
  },
  candidates: (ctx) => ctx.pack.degrees.map((d) => ({ type: 'Enroll' as const, degreeId: d.id })),
  zeroTime: true,
  ai: { category: 'study' },
};

/** Hook for modern modules: chance (bp) that a lesson is wasted, and wellbeing/other side effects. */
export let lessonWasteBp: (ctx: Ctx, seat: number, online: boolean) => number = () => 0;
export function setLessonWaste(fn: typeof lessonWasteBp): void {
  lessonWasteBp = fn;
}

export function graduate(ctx: Ctx, seat: number, degreeId: string): void {
  const p = ctx.playerAt(seat);
  const { [degreeId]: _done, ...rest } = p.enrolled;
  p.enrolled = rest;
  p.degrees.push(degreeId);
  recomputeMaxima(p, ctx.pack);
  ctx.addStat(seat, 'happiness', ctx.rules.happiness.graduation, 'graduation');
  ctx.addDependabilityRaw(seat, ctx.rules.stats.degreeDependabilityBonus, 'graduation');
  ctx.emit({ type: 'Graduated', seat, degreeId });
}

export function studyLesson(ctx: Ctx, seat: number, degreeId: string, online: boolean): void {
  const p = ctx.playerAt(seat);
  const course = p.enrolled[degreeId]!;
  ctx.spendHours(seat, ctx.rules.time.lessonHours, online ? 'study-online' : 'study');
  const waste = lessonWasteBp(ctx, seat, online);
  const counted = waste <= 0 || !ctx.rng.chance(`events:${seat}`, waste);
  if (counted) {
    course.lessonsLeft -= 1;
    p.stats.lessons += 1;
  }
  ctx.emit({ type: 'Studied', seat, degreeId, counted });
  if (course.lessonsLeft <= 0) graduate(ctx, seat, degreeId);
}

export const studyHandler: CommandHandler<StudyCommand> = {
  type: 'Study',
  schema: z.object({ type: z.literal('Study'), degreeId: z.string() }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.lessonHours, money: 0 }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'study');
    if (svc) return svc;
    if (!(cmd.degreeId in ctx.pack.degreeById)) return 'ERR_UNKNOWN_ID';
    if (!(cmd.degreeId in ctx.player.enrolled)) return 'ERR_NOT_ENROLLED';
    return requireHours(ctx, ctx.rules.time.lessonHours);
  },
  apply: (ctx, cmd) => {
    studyLesson(ctx, ctx.seat, cmd.degreeId, false);
  },
  preview: (ctx, cmd) => {
    const c = ctx.player.enrolled[cmd.degreeId];
    const waste = lessonWasteBp(ctx, ctx.seat, false);
    return {
      notes: [`lessonsLeft:${c ? c.lessonsLeft - 1 : 0}`],
      ...(waste > 0 ? { riskBp: waste, riskKey: 'risk.lessonWasted' } : {}),
    };
  },
  candidates: (ctx) =>
    Object.keys(ctx.player.enrolled).map((degreeId) => ({ type: 'Study' as const, degreeId })),
  ai: { category: 'study' },
};
