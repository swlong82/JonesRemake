/** Jobs: ApplyJob, AskRaise, Work (GDD 4.6, ORIGINAL_REFERENCE 3.4). */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import { recomputeMaxima } from '../core/goals.js';
import { mulDiv } from '../core/math.js';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import { STREAMS } from '../core/rng.js';
import { requireHours, requireService } from './common.js';

export interface ApplyJobCommand extends BaseCommand {
  type: 'ApplyJob';
  jobId: string;
}
export interface AskRaiseCommand extends BaseCommand {
  type: 'AskRaise';
}
export interface WorkCommand extends BaseCommand {
  type: 'Work';
  /** Half-hours requested (≤ one session). */
  hours: number;
}

/** luck = base + floor((add + dep + exp + degreeWeight × degrees) / divisor) (ORIGINAL_REFERENCE 3.4). */
export function luckPercent(ctx: Ctx, seat: number): number {
  const j = ctx.rules.jobs;
  const p = ctx.playerAt(seat);
  return (
    j.luckBase +
    Math.floor(
      (j.luckAdd + p.dependability + p.experience + j.luckDegreeWeight * p.degrees.length) /
        j.luckDivisor,
    )
  );
}

/**
 * Start of continuous employment for a hire off the street: this week, or — within the pack's grace
 * after an event layoff — the lost job's start moved on by the weeks spent out of work (ADR-0047).
 */
function resumed(ctx: Ctx): number {
  const off = ctx.player.layoff;
  if (!off || ctx.week - off.week > ctx.rules.goals.careerLayoffGraceWeeks) return ctx.week;
  return off.hiredWeek + (ctx.week - off.week);
}

export const applyJobHandler: CommandHandler<ApplyJobCommand> = {
  type: 'ApplyJob',
  schema: z.object({ type: z.literal('ApplyJob'), jobId: z.string() }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.applyHours, money: 0 }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'apply');
    if (svc) return svc;
    const job = ctx.pack.jobById[cmd.jobId];
    if (!job || job.isGig) return 'ERR_UNKNOWN_ID';
    const p = ctx.player;
    if (p.job?.jobId === cmd.jobId) return 'ERR_ALREADY_HAVE_JOB';
    if (p.turn.jobsTurnedDown.includes(cmd.jobId)) return 'ERR_NO_OPENINGS';
    const h = requireHours(ctx, ctx.rules.time.applyHours);
    if (h) return h;
    if (p.experience < job.reqExperience) return 'ERR_REQ_EXPERIENCE';
    if (p.dependability < job.reqDependability) return 'ERR_REQ_DEPENDABILITY';
    for (const d of job.reqDegrees) if (!p.degrees.includes(d)) return 'ERR_REQ_EDUCATION';
    return null;
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const job = ctx.pack.jobById[cmd.jobId]!;
    ctx.spendHours(ctx.seat, ctx.rules.time.applyHours, 'apply');
    const hired =
      job.alwaysHire || ctx.rng.int(STREAMS.jobs(ctx.seat), 100) < luckPercent(ctx, ctx.seat);
    if (!hired) {
      p.turn.jobsTurnedDown.push(cmd.jobId);
      ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.refused, 'refused');
      ctx.emit({ type: 'Refused', seat: ctx.seat, jobId: cmd.jobId, code: 'ERR_NO_OPENINGS' });
      return;
    }
    const wage = ctx.econ(job.baseWage);
    // `hiredWeek` is the start of continuous employment (ADR-0040): moving job to job keeps it,
    // so climbing the ladder does not restart the career tenure; only losing the job does.
    p.job = { jobId: cmd.jobId, wage, raises: 0, hiredWeek: p.job?.hiredWeek ?? resumed(ctx) };
    delete p.layoff;
    if (p.dependability < ctx.rules.stats.hireDependabilityFloor) {
      ctx.addDependabilityRaw(
        ctx.seat,
        ctx.rules.stats.hireDependabilityFloor - p.dependability,
        'hired',
      );
    }
    recomputeMaxima(p, ctx.pack);
    p.stats.highestWage = Math.max(p.stats.highestWage, wage);
    ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.hired, 'hired');
    ctx.emit({ type: 'Hired', seat: ctx.seat, jobId: cmd.jobId });
  },
  preview: (ctx, cmd) => {
    const job = ctx.pack.jobById[cmd.jobId];
    const luck = job?.alwaysHire ? 100 : Math.min(100, luckPercent(ctx, ctx.seat));
    return {
      riskBp: (100 - luck) * 100,
      riskKey: 'risk.noOpenings',
      deltas: { happiness: ctx.rules.happiness.hired },
      notes: [`wage:${job ? ctx.econ(job.baseWage) : 0}`],
    };
  },
  candidates: (ctx) =>
    ctx.pack.jobs.filter((j) => !j.isGig).map((j) => ({ type: 'ApplyJob' as const, jobId: j.id })),
  ai: { category: 'work' },
};

export const askRaiseHandler: CommandHandler<AskRaiseCommand> = {
  type: 'AskRaise',
  schema: z.object({ type: z.literal('AskRaise') }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.raiseHours, money: 0 }),
  validate: (ctx) => {
    const svc = requireService(ctx, 'raise');
    if (svc) return svc;
    const p = ctx.player;
    if (!p.job) return 'ERR_NO_JOB';
    const h = requireHours(ctx, ctx.rules.time.raiseHours);
    if (h) return h;
    const job = ctx.pack.jobById[p.job.jobId]!;
    if (p.dependability <= job.reqDependability + ctx.rules.jobs.raiseStep * p.job.raises)
      return 'ERR_RAISE_NOT_ELIGIBLE';
    return null;
  },
  apply: (ctx) => {
    const p = ctx.player;
    const job = ctx.pack.jobById[p.job!.jobId]!;
    ctx.spendHours(ctx.seat, ctx.rules.time.raiseHours, 'raise');
    p.job!.raises += 1;
    const listed = ctx.econ(job.baseWage);
    // Each raise lifts the wage by one raiseStep percent-point block of the listed wage, or to the listed wage if higher.
    const bump = Math.max(
      listed,
      p.job!.wage + Math.max(1, mulDiv(listed, ctx.rules.jobs.raiseStep * 100, 10_000)),
    );
    p.job!.wage = bump;
    p.stats.highestWage = Math.max(p.stats.highestWage, bump);
    ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.hired, 'raise');
    ctx.emit({ type: 'Raised', seat: ctx.seat, wage: bump });
  },
  preview: (ctx) => ({ deltas: { happiness: ctx.rules.happiness.hired } }),
  candidates: () => [{ type: 'AskRaise' }],
  ai: { category: 'work' },
};

export function workPay(ctx: Ctx, seat: number, halfHours: number): number {
  const p = ctx.playerAt(seat);
  if (!p.job) return 0;
  const session = ctx.rules.time.workSessionHours;
  return mulDiv(ctx.rules.jobs.payPerSession * p.job.wage, Math.min(halfHours, session), session);
}

/** Hook for modern modules (burnout pay penalty). */
export let payModifierBp: (ctx: Ctx, seat: number) => number = () => 10_000;
export function setPayModifier(fn: typeof payModifierBp): void {
  payModifierBp = fn;
}

export const workHandler: CommandHandler<WorkCommand> = {
  type: 'Work',
  schema: z.object({ type: z.literal('Work'), hours: z.number().int().positive() }).strict(),
  cost: (ctx, cmd) => ({
    hours: Math.min(cmd.hours, ctx.rules.time.workSessionHours, Math.max(1, ctx.player.hoursLeft)),
    money: 0,
  }),
  validate: (ctx, cmd) => {
    const p = ctx.player;
    if (!p.job) return 'ERR_NO_JOB';
    const job = ctx.pack.jobById[p.job.jobId]!;
    const at = ctx.pack.locationById[p.location];
    if (!at || job.workplaceId !== p.location) return 'ERR_NOT_AT_LOCATION';
    if (!p.inside) return 'ERR_NOT_INSIDE';
    if (cmd.hours > ctx.rules.time.workSessionHours) return 'ERR_INVALID_AMOUNT';
    if (p.hoursLeft <= 0) return 'ERR_NOT_ENOUGH_HOURS';
    if (ctx.uniformRank(ctx.seat) < ctx.pack.uniformRank[job.uniformTier])
      return 'ERR_UNIFORM_REQUIRED';
    return null;
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const job = ctx.pack.jobById[p.job!.jobId]!;
    // Firing check (GDD 4.6): dependability far below requirement → fired on the work attempt.
    if (p.dependability < job.reqDependability - ctx.rules.stats.firingDependabilityMargin) {
      p.job = null;
      recomputeMaxima(p, ctx.pack);
      ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.fired, 'fired');
      ctx.emit({ type: 'Fired', seat: ctx.seat, reason: 'dependability' });
      return;
    }
    const hours = Math.min(cmd.hours, ctx.rules.time.workSessionHours, p.hoursLeft);
    ctx.spendHours(ctx.seat, hours, 'work');
    let pay = mulDiv(workPay(ctx, ctx.seat, hours), payModifierBp(ctx, ctx.seat), 10_000);
    if (p.home.debt > 0) {
      const garnish = Math.min(
        pay,
        mulDiv(pay, ctx.rules.jobs.garnishBp, 10_000) + ctx.rules.jobs.garnishFee,
      );
      const applied = Math.min(garnish, p.home.debt);
      p.home.debt -= applied;
      if (p.home.debt === 0) p.home.debtSinceWeek = null;
      pay -= garnish;
      ctx.emit({
        type: 'MoneyChanged',
        seat: ctx.seat,
        account: 'cash',
        delta: -garnish,
        reason: 'garnish',
      });
    }
    ctx.addMoney(ctx.seat, 'cash', pay, 'work');
    p.stats.earned += pay;
    p.stats.workSessions += 1;
    ctx.addStat(ctx.seat, 'experience', ctx.rules.stats.workExperienceGain, 'work');
    ctx.addStat(ctx.seat, 'dependability', ctx.rules.stats.workDependabilityGain, 'work');
    ctx.emit({ type: 'Worked', seat: ctx.seat, hours, pay });
  },
  preview: (ctx, cmd) => {
    const hours = Math.min(
      cmd.hours,
      ctx.rules.time.workSessionHours,
      Math.max(0, ctx.player.hoursLeft),
    );
    return {
      hours: -hours,
      money: mulDiv(workPay(ctx, ctx.seat, hours), payModifierBp(ctx, ctx.seat), 10_000),
      deltas: {
        experience: ctx.rules.stats.workExperienceGain,
        dependability: ctx.rules.stats.workDependabilityGain,
      },
    };
  },
  candidates: (ctx) => [{ type: 'Work', hours: ctx.rules.time.workSessionHours }],
  ai: { category: 'work' },
};
