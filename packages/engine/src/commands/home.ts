/** Home: Relax, PayRent, RequestExtension, MoveHome (GDD 4.9, 4.10). */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import { STREAMS } from '../core/rng.js';
import { requireCash, requireHours, requireService } from './common.js';

export interface RelaxCommand extends BaseCommand {
  type: 'Relax';
}
export interface PayRentCommand extends BaseCommand {
  type: 'PayRent';
  months: number;
}
export interface RequestExtensionCommand extends BaseCommand {
  type: 'RequestExtension';
}
export interface MoveHomeCommand extends BaseCommand {
  type: 'MoveHome';
  tier: 'low' | 'high';
}

/** Hook for the wellbeing module: extra relax effects. */
export let relaxExtra: (ctx: Ctx, seat: number, atHome: boolean) => void = () => undefined;
export function setRelaxExtra(fn: typeof relaxExtra): void {
  relaxExtra = fn;
}

export function relaxHappiness(ctx: Ctx, seat: number, atHome: boolean): number {
  const h = ctx.rules.happiness;
  if (!atHome) return h.relaxBase;
  return Math.min(h.relaxMax, h.relaxBase + h.relaxPerComfort * ctx.comfortCount(seat));
}

export const relaxHandler: CommandHandler<RelaxCommand> = {
  type: 'Relax',
  schema: z.object({ type: z.literal('Relax') }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.relaxHours, money: 0 }),
  validate: (ctx) => {
    const svc = requireService(ctx, 'relax');
    if (svc) return svc;
    if (ctx.player.turn.relaxed) return 'ERR_ALREADY_RELAXED';
    return requireHours(ctx, ctx.rules.time.relaxHours);
  },
  apply: (ctx) => {
    const p = ctx.player;
    const atHome = ctx.isHome(ctx.seat);
    ctx.spendHours(ctx.seat, ctx.rules.time.relaxHours, 'relax');
    p.turn.relaxed = true;
    ctx.addStat(ctx.seat, 'relaxation', ctx.rules.stats.relaxGain, 'relax');
    ctx.addStat(ctx.seat, 'happiness', relaxHappiness(ctx, ctx.seat, atHome), 'relax');
    relaxExtra(ctx, ctx.seat, atHome);
    ctx.emit({ type: 'Relaxed', seat: ctx.seat });
  },
  preview: (ctx) => ({
    deltas: {
      happiness: relaxHappiness(ctx, ctx.seat, ctx.isHome(ctx.seat)),
      relaxation: ctx.rules.stats.relaxGain,
    },
  }),
  candidates: () => [{ type: 'Relax' }],
  ai: { category: 'home' },
};

/** Week by which the next rent period must be paid. */
export function rentDueWeek(ctx: Ctx, seat: number): number {
  const p = ctx.playerAt(seat);
  const due = p.home.paidThroughWeek + ctx.rules.housing.rentWeeks;
  return p.home.extensionUntilWeek !== null ? Math.max(due, p.home.extensionUntilWeek) : due;
}

export function rentIsDue(ctx: Ctx, seat: number): boolean {
  return ctx.week >= rentDueWeek(ctx, seat) || ctx.playerAt(seat).home.debt > 0;
}

export function payRentCost(ctx: Ctx, months: number): number {
  return ctx.player.home.debt + months * ctx.player.home.rentLocked;
}

export const payRentHandler: CommandHandler<PayRentCommand> = {
  type: 'PayRent',
  schema: z.object({ type: z.literal('PayRent'), months: z.number().int().nonnegative() }).strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: payRentCost(ctx, cmd.months) }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'rent');
    if (svc) return svc;
    if (cmd.months === 0 && ctx.player.home.debt === 0) return 'ERR_INVALID_AMOUNT';
    if (cmd.months > 12) return 'ERR_INVALID_AMOUNT';
    return requireCash(ctx, payRentCost(ctx, cmd.months));
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const cost = payRentCost(ctx, cmd.months);
    ctx.addMoney(ctx.seat, 'cash', -cost, 'rent');
    if (p.home.debt > 0) {
      p.home.debt = 0;
      p.home.debtSinceWeek = null;
    }
    p.home.paidThroughWeek += cmd.months * ctx.rules.housing.rentWeeks;
    p.home.extensionUntilWeek = null;
    ctx.emit({ type: 'RentPaid', seat: ctx.seat, months: cmd.months });
  },
  candidates: (ctx) => {
    const out: PayRentCommand[] = [];
    if (ctx.player.home.debt > 0) out.push({ type: 'PayRent', months: 0 });
    out.push(
      { type: 'PayRent', months: 1 },
      { type: 'PayRent', months: 2 },
      { type: 'PayRent', months: 3 },
    );
    return out;
  },
  zeroTime: true,
  ai: { category: 'home' },
};

export const requestExtensionHandler: CommandHandler<RequestExtensionCommand> = {
  type: 'RequestExtension',
  schema: z.object({ type: z.literal('RequestExtension') }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.extensionHours, money: 0 }),
  validate: (ctx) => {
    const svc = requireService(ctx, 'rent');
    if (svc) return svc;
    const p = ctx.player;
    if (p.home.extensionsBlocked || p.home.everHadDebt || p.home.extensionUntilWeek !== null)
      return 'ERR_EXTENSION_DENIED';
    if (!rentIsDue(ctx, ctx.seat) || p.home.debt > 0) return 'ERR_RENT_NOT_DUE';
    return requireHours(ctx, ctx.rules.time.extensionHours);
  },
  apply: (ctx) => {
    const p = ctx.player;
    ctx.spendHours(ctx.seat, ctx.rules.time.extensionHours, 'extension');
    if (ctx.rng.chance(STREAMS.events(ctx.seat), ctx.rules.housing.extensionApproveBp)) {
      p.home.extensionUntilWeek = rentDueWeek(ctx, ctx.seat) + 1;
      ctx.emit({ type: 'RentDue', seat: ctx.seat });
    } else {
      p.home.extensionsBlocked = true;
      ctx.emit({
        type: 'CommandRejected',
        seat: ctx.seat,
        cmdType: 'RequestExtension',
        code: 'ERR_EXTENSION_DENIED',
      });
    }
  },
  preview: (ctx) => ({
    riskBp: 10_000 - ctx.rules.housing.extensionApproveBp,
    riskKey: 'risk.extensionDenied',
  }),
  candidates: () => [{ type: 'RequestExtension' }],
  ai: { category: 'home' },
};

export function moveHomeCost(ctx: Ctx, tier: 'low' | 'high'): number {
  const rent = ctx.rules.housing.tiers[tier]?.rent ?? 0;
  return ctx.player.home.debt + ctx.econ(rent);
}

export const moveHomeHandler: CommandHandler<MoveHomeCommand> = {
  type: 'MoveHome',
  schema: z.object({ type: z.literal('MoveHome'), tier: z.enum(['low', 'high']) }).strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: moveHomeCost(ctx, cmd.tier) }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'move-home');
    if (svc) return svc;
    if (ctx.player.home.tier === cmd.tier) return 'ERR_ALREADY_IN_TIER';
    return requireCash(ctx, moveHomeCost(ctx, cmd.tier));
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const cost = moveHomeCost(ctx, cmd.tier);
    ctx.addMoney(ctx.seat, 'cash', -cost, 'move-home');
    p.home.debt = 0;
    p.home.debtSinceWeek = null;
    p.home.tier = cmd.tier;
    p.home.rentLocked = ctx.econ(ctx.rules.housing.tiers[cmd.tier]?.rent ?? 0);
    p.home.paidThroughWeek =
      Math.max(p.home.paidThroughWeek, ctx.week - (ctx.week % ctx.rules.housing.rentWeeks)) +
      ctx.rules.housing.rentWeeks;
    p.home.extensionUntilWeek = null;
    if (cmd.tier === 'high' && !p.home.movedSecureOnce) {
      p.home.movedSecureOnce = true;
      ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.moveSecure, 'move-secure');
    }
    ctx.emit({ type: 'HomeMoved', seat: ctx.seat, tier: cmd.tier });
  },
  preview: (ctx, cmd) => ({
    deltas:
      cmd.tier === 'high' && !ctx.player.home.movedSecureOnce
        ? { happiness: ctx.rules.happiness.moveSecure }
        : {},
  }),
  candidates: () => [
    { type: 'MoveHome', tier: 'low' },
    { type: 'MoveHome', tier: 'high' },
  ],
  zeroTime: true,
  ai: { category: 'home' },
};
