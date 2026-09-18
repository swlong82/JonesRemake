/**
 * gig (order 120, flag `gig`): GDD 4.6 gig work. A gig is a job with `isGig`, signed up for once at
 * the employment office and then worked anywhere on the board in fixed blocks. It pays a base per
 * block scaled by the economy and by a weekly demand multiplier, and that is all it pays: no
 * experience, no dependability, and no career, because the career goal reads the regular job. A
 * player may hold one regular job and one gig at the same time.
 */
import { z } from 'zod';
import type { ErrorCode } from '@hustle-ring/shared';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler, RuleModule } from '../core/module.js';
import type { GameState, PlayerState } from '../core/state.js';
import { mulDiv, pm } from '../core/math.js';
import { requireHours, requireService } from '../commands/common.js';
import { breakCar, carOf } from './transport.js';

export const GIG_MODULE_ID = 'gig';

interface GigSlice {
  gigId: string | null;
}

interface GigMarket {
  /** This week's demand multiplier in per-mille (1000 = flat). */
  demandPm: number;
}

const playerSchema = z.object({ gigId: z.string().nullable() }).strict();
const gameSchema = z.object({ demandPm: z.number().int().positive() }).strict();

export function gigOf(p: PlayerState): string | null {
  return (p.modules[GIG_MODULE_ID] as GigSlice | undefined)?.gigId ?? null;
}

export function gigDemandPm(state: GameState): number {
  return (state.modules[GIG_MODULE_ID] as GigMarket | undefined)?.demandPm ?? 1000;
}

/** Pay for a block of gig hours: base per full shift × economy × this week's demand. */
export function gigPay(ctx: Ctx, seat: number, halfHours: number): number {
  const gigId = gigOf(ctx.playerAt(seat));
  const spec = gigId ? ctx.pack.jobById[gigId] : undefined;
  if (!spec?.gigPay) return 0;
  const full = ctx.rules.time.gigShiftHours[ctx.rules.time.gigShiftHours.length - 1] ?? 1;
  const base = mulDiv(spec.gigPay, Math.min(halfHours, full), full);
  return pm(ctx.econ(base), gigDemandPm(ctx.state));
}

/** Unlocks a gig asks for: item unlocks, plus `car` for anything that needs one. */
function missingRequirement(ctx: Ctx, seat: number, gigId: string): ErrorCode | null {
  const spec = ctx.pack.jobById[gigId];
  if (!spec?.isGig) return 'ERR_UNKNOWN_ID';
  for (const need of spec.gigRequires) {
    if (need === 'car') {
      if (!carOf(ctx.playerAt(seat))) return 'ERR_NO_CAR';
      continue;
    }
    if (!ctx.hasUnlock(seat, need)) return 'ERR_GIG_REQUIREMENT';
  }
  return null;
}

export interface GigSignupCommand extends BaseCommand {
  type: 'GigSignup';
  gigId: string;
}
export interface GigShiftCommand extends BaseCommand {
  type: 'GigShift';
  hours: number;
}

const gigSignupHandler: CommandHandler<GigSignupCommand> = {
  type: 'GigSignup',
  schema: z.object({ type: z.literal('GigSignup'), gigId: z.string() }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.gigSignupHours, money: 0 }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'apply');
    if (svc) return svc;
    const slice = ctx.player.modules[GIG_MODULE_ID] as GigSlice | undefined;
    if (!slice) return 'ERR_FEATURE_OFF';
    if (slice.gigId === cmd.gigId) return 'ERR_ALREADY_HAVE_JOB';
    const missing = missingRequirement(ctx, ctx.seat, cmd.gigId);
    if (missing) return missing;
    return requireHours(ctx, ctx.rules.time.gigSignupHours);
  },
  apply: (ctx, cmd) => {
    const slice = ctx.player.modules[GIG_MODULE_ID] as GigSlice;
    ctx.spendHours(ctx.seat, ctx.rules.time.gigSignupHours, 'gig-signup');
    slice.gigId = cmd.gigId;
    ctx.emit({ type: 'GigStarted', seat: ctx.seat, gigId: cmd.gigId });
  },
  candidates: (ctx) =>
    ctx.pack.jobs.filter((j) => j.isGig).map((j) => ({ type: 'GigSignup' as const, gigId: j.id })),
  ai: { category: 'work' },
};

const gigShiftHandler: CommandHandler<GigShiftCommand> = {
  type: 'GigShift',
  schema: z.object({ type: z.literal('GigShift'), hours: z.number().int().positive() }).strict(),
  cost: (ctx, cmd) => ({ hours: Math.min(cmd.hours, ctx.player.hoursLeft), money: 0 }),
  validate: (ctx, cmd) => {
    const slice = ctx.player.modules[GIG_MODULE_ID] as GigSlice | undefined;
    if (!slice?.gigId) return 'ERR_NO_JOB';
    if (!ctx.rules.time.gigShiftHours.includes(cmd.hours)) return 'ERR_INVALID_AMOUNT';
    const missing = missingRequirement(ctx, ctx.seat, slice.gigId);
    if (missing) return missing;
    return ctx.player.hoursLeft > 0 ? null : 'ERR_NOT_ENOUGH_HOURS';
  },
  apply: (ctx, cmd) => {
    const hours = Math.min(cmd.hours, ctx.player.hoursLeft);
    const pay = gigPay(ctx, ctx.seat, hours);
    ctx.spendHours(ctx.seat, hours, 'gig');
    ctx.addMoney(ctx.seat, 'cash', pay, 'gig');
    ctx.player.stats.earned += pay;
    ctx.emit({ type: 'GigWorked', seat: ctx.seat, hours, pay });
    // Driving for a living wears the car out faster (GDD 4.6).
    const spec = ctx.pack.jobById[gigOf(ctx.player) ?? ''];
    if (
      spec?.gigRequires.includes('car') &&
      ctx.rng.chance(`gig:${ctx.seat}`, ctx.rules.gig.carWearBp)
    )
      breakCar(ctx, ctx.seat);
  },
  preview: (ctx, cmd) => ({
    money: gigPay(ctx, ctx.seat, Math.min(cmd.hours, ctx.player.hoursLeft)),
    notes: [`gig-demand:${gigDemandPm(ctx.state)}`],
  }),
  candidates: (ctx) =>
    ctx.rules.time.gigShiftHours.map((hours) => ({ type: 'GigShift' as const, hours })),
  ai: { category: 'work' },
};

export const gig: RuleModule = {
  id: GIG_MODULE_ID,
  flag: 'gig',
  order: 120,
  commands: [gigSignupHandler, gigShiftHandler],
  stateSlice: {
    key: GIG_MODULE_ID,
    schema: z.union([playerSchema, gameSchema]),
    version: 1,
    initialPlayer: () => ({ gigId: null }),
    initialGame: (ctx) => ({ demandPm: ctx.rules.gig.demandMinPm }),
  },
  hooks: {
    onWeekStart(ctx) {
      // One demand multiplier a week for the whole city, rolled before any seat acts, so a
      // preview and the shift it prices always agree (ADR-0028).
      const g = ctx.rules.gig;
      const market = ctx.state.modules[GIG_MODULE_ID] as GigMarket | undefined;
      if (market) market.demandPm = ctx.rng.range('gig:demand', g.demandMinPm, g.demandMaxPm);
    },
    contributeIncome(ctx, seat) {
      // A gig's weekly earning power, for anything that asks what a seat makes (loan approval).
      const gigId = gigOf(ctx.playerAt(seat));
      if (!gigId) return 0;
      const full = ctx.rules.time.gigShiftHours[ctx.rules.time.gigShiftHours.length - 1] ?? 1;
      return gigPay(ctx, seat, full) * 2;
    },
  },
};
