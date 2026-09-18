/**
 * onlineStudy (order 140, flag `onlineStudy`): GDD 4.7. The same lesson, taken at your own kitchen
 * table: it needs a laptop, an active home-internet subscription and you at home, it counts exactly
 * as a lesson at the university does, it is easier on your wellbeing, and some of the time you
 * doomscroll instead and lose the six hours anyway. A focus-app subscription cuts that down.
 */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler, RuleModule } from '../core/module.js';
import { lessonWasteBp, setLessonWaste, studyLesson } from '../commands/education.js';
import { requireHours } from '../commands/common.js';
import { hasGrant } from './subscriptions.js';

export const ONLINE_STUDY_MODULE_ID = 'online-study';

export interface StudyOnlineCommand extends BaseCommand {
  type: 'StudyOnline';
  degreeId: string;
}

/** Chance a lesson taken at home is doomscrolled away, halved-ish by the focus app. */
export function doomscrollBp(ctx: Ctx, seat: number): number {
  const o = ctx.rules.onlineStudy;
  return hasGrant(ctx, seat, 'focusApp') ? o.focusWasteBp : o.wasteBp;
}

/** Everything GDD 4.7 asks of an online lesson, in the order the error codes are documented. */
function online(ctx: Ctx, cmd: StudyOnlineCommand): ReturnType<CommandHandler['validate']> {
  if (!(cmd.degreeId in ctx.pack.degreeById)) return 'ERR_UNKNOWN_ID';
  if (!(cmd.degreeId in ctx.player.enrolled)) return 'ERR_NOT_ENROLLED';
  if (!ctx.isHome(ctx.seat) || !ctx.player.inside) return 'ERR_NOT_AT_LOCATION';
  if (!ctx.hasUnlock(ctx.seat, 'onlineStudy')) return 'ERR_UNLOCK_MISSING';
  if (!hasGrant(ctx, ctx.seat, 'homeInternet')) return 'ERR_SUB_INACTIVE';
  return requireHours(ctx, ctx.rules.time.lessonHours);
}

const studyOnlineHandler: CommandHandler<StudyOnlineCommand> = {
  type: 'StudyOnline',
  schema: z.object({ type: z.literal('StudyOnline'), degreeId: z.string() }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.lessonHours, money: 0 }),
  validate: online,
  apply: (ctx, cmd) => {
    studyLesson(ctx, ctx.seat, cmd.degreeId, true);
  },
  preview: (ctx, cmd) => {
    const course = ctx.player.enrolled[cmd.degreeId];
    const waste = doomscrollBp(ctx, ctx.seat);
    return {
      notes: [`lessonsLeft:${course ? course.lessonsLeft - 1 : 0}`],
      ...(waste > 0 ? { riskBp: waste, riskKey: 'risk.doomscrolled' } : {}),
    };
  },
  candidates: (ctx) =>
    Object.keys(ctx.player.enrolled).map((degreeId) => ({
      type: 'StudyOnline' as const,
      degreeId,
    })),
  ai: { category: 'study' },
};

export const onlineStudy: RuleModule = {
  id: ONLINE_STUDY_MODULE_ID,
  flag: 'onlineStudy',
  order: 140,
  commands: [studyOnlineHandler],
};

/** Adds the doomscroll chance to the lesson-waste hook, on top of whatever else is registered. */
export function registerOnlineStudyHooks(): void {
  const previous = lessonWasteBp;
  setLessonWaste((ctx, seat, isOnline) => {
    const base = previous(ctx, seat, isOnline);
    if (!isOnline || !ctx.pack.flags.onlineStudy) return base;
    const mine = doomscrollBp(ctx, seat);
    // Independent chances, combined: neither the burnout risk nor the phone is lost.
    return 10_000 - Math.floor(((10_000 - base) * (10_000 - mine)) / 10_000);
  });
}
