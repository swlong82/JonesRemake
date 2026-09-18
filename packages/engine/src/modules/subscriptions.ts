/**
 * subscriptions (order 130, flag `subscriptions`): GDD 4.11. Weekly charges that are easy to start
 * and, deliberately, less easy to stop: cancelling means going back to where you signed up. Each
 * one bills at the start of your turn from the bank and then cash; one you cannot pay is cancelled
 * for you, at the cost of the happiness the pack sets. Prices drift upward on the pack's schedule.
 *
 * Other modules ask `grantsOf` what a seat is subscribed to rather than reading this slice.
 */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler, RuleModule } from '../core/module.js';
import type { PlayerState } from '../core/state.js';
import { mulDiv } from '../core/math.js';
import { requireService } from '../commands/common.js';

export const SUBS_MODULE_ID = 'subscriptions';

export type SubGrant =
  'homeInternet' | 'streaming' | 'music' | 'cloud' | 'gym' | 'focusApp' | 'foodClub';

interface SubsSlice {
  /** subId → the price this seat pays (drift makes it personal) and where it was started. */
  active: Record<string, { price: number; locationId: string; since: number }>;
  /** Week the next price-drift check falls due. */
  nextDriftWeek: number;
}

const sliceSchema = z
  .object({
    active: z.record(
      z.string(),
      z
        .object({
          price: z.number().int().nonnegative(),
          locationId: z.string(),
          since: z.number().int().positive(),
        })
        .strict(),
    ),
    nextDriftWeek: z.number().int().positive(),
  })
  .strict();

function sliceOf(p: PlayerState): SubsSlice | undefined {
  return p.modules[SUBS_MODULE_ID] as SubsSlice | undefined;
}

/** Subscription ids the seat is paying for. */
export function activeSubs(p: PlayerState): string[] {
  return Object.keys(sliceOf(p)?.active ?? {});
}

/** What the seat's subscriptions grant right now (`homeInternet`, `focusApp`, …). */
export function grantsOf(ctx: Ctx, seat: number): Set<SubGrant> {
  const out = new Set<SubGrant>();
  const p = ctx.playerAt(seat);
  for (const subId of activeSubs(p))
    for (const g of ctx.pack.subscriptionById[subId]?.grants ?? []) out.add(g);
  return out;
}

export function hasGrant(ctx: Ctx, seat: number, grant: SubGrant): boolean {
  return grantsOf(ctx, seat).has(grant);
}

/** Total weekly cost of everything the seat subscribes to, for the HUD and the AI. */
export function weeklySubTotal(p: PlayerState): number {
  let total = 0;
  for (const entry of Object.values(sliceOf(p)?.active ?? {})) total += entry.price;
  return total;
}

export interface SubscribeCommand extends BaseCommand {
  type: 'Subscribe';
  subId: string;
}
export interface UnsubscribeCommand extends BaseCommand {
  type: 'Unsubscribe';
  subId: string;
}

const subscribeHandler: CommandHandler<SubscribeCommand> = {
  type: 'Subscribe',
  schema: z.object({ type: z.literal('Subscribe'), subId: z.string() }).strict(),
  cost: (ctx, cmd) => ({
    hours: 0,
    money: ctx.econ(ctx.pack.subscriptionById[cmd.subId]?.weeklyPrice ?? 0),
  }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'subscriptions');
    if (svc) return svc;
    const spec = ctx.pack.subscriptionById[cmd.subId];
    if (!spec) return 'ERR_UNKNOWN_ID';
    if (spec.locationId !== ctx.player.location) return 'ERR_SUB_WRONG_LOCATION';
    const slice = sliceOf(ctx.player);
    if (!slice) return 'ERR_FEATURE_OFF';
    if (slice.active[cmd.subId]) return 'ERR_SUB_ACTIVE';
    return null;
  },
  apply: (ctx, cmd) => {
    const spec = ctx.pack.subscriptionById[cmd.subId]!;
    const slice = sliceOf(ctx.player)!;
    slice.active[cmd.subId] = {
      price: ctx.econ(spec.weeklyPrice),
      locationId: spec.locationId,
      since: ctx.week,
    };
    ctx.emit({ type: 'Subscribed', seat: ctx.seat, subId: cmd.subId });
  },
  preview: (ctx, cmd) => ({
    notes: [`weekly:${ctx.econ(ctx.pack.subscriptionById[cmd.subId]?.weeklyPrice ?? 0)}`],
  }),
  candidates: (ctx) =>
    ctx.pack.subscriptions.map((s) => ({ type: 'Subscribe' as const, subId: s.id })),
  zeroTime: true,
  ai: { category: 'buy' },
};

const unsubscribeHandler: CommandHandler<UnsubscribeCommand> = {
  type: 'Unsubscribe',
  schema: z.object({ type: z.literal('Unsubscribe'), subId: z.string() }).strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'subscriptions');
    if (svc) return svc;
    const entry = sliceOf(ctx.player)?.active[cmd.subId];
    if (!entry) return 'ERR_SUB_INACTIVE';
    // Cancelling means going back to the desk you signed up at (GDD 4.11).
    if (entry.locationId !== ctx.player.location) return 'ERR_SUB_WRONG_LOCATION';
    return null;
  },
  apply: (ctx, cmd) => {
    const slice = sliceOf(ctx.player)!;
    const { [cmd.subId]: _gone, ...rest } = slice.active;
    slice.active = rest;
    ctx.emit({ type: 'Unsubscribed', seat: ctx.seat, subId: cmd.subId });
  },
  candidates: (ctx) =>
    activeSubs(ctx.player).map((subId) => ({ type: 'Unsubscribe' as const, subId })),
  zeroTime: true,
  ai: { category: 'finance' },
};

/** Bills every active subscription, cancelling the ones the seat cannot pay for. */
function bill(ctx: Ctx): void {
  const p = ctx.player;
  const slice = sliceOf(p)!;
  let paid = 0;
  for (const [subId, entry] of Object.entries(slice.active)) {
    // `takeMoneyCascade` returns what it could not cover, not what it took.
    const shortfall = ctx.takeMoneyCascade(ctx.seat, entry.price, `sub:${subId}`);
    if (shortfall > 0) {
      // Unpaid: the service drops you, and that stings (GDD 4.8).
      const { [subId]: _gone, ...rest } = slice.active;
      slice.active = rest;
      ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.subscriptionLapsed, 'sub-lapsed');
      ctx.emit({ type: 'Unsubscribed', seat: ctx.seat, subId });
      continue;
    }
    paid += entry.price;
    const spec = ctx.pack.subscriptionById[subId];
    if (spec?.happinessPerWeek)
      ctx.addStat(ctx.seat, 'happiness', spec.happinessPerWeek, `sub:${subId}`);
    if (spec?.wellbeingPerWeek)
      ctx.addStat(ctx.seat, 'wellbeing', spec.wellbeingPerWeek, `sub:${subId}`);
  }
  if (paid > 0) ctx.emit({ type: 'SubBilled', seat: ctx.seat, total: paid });
}

/** Every `driftEveryWeeks`, each drifting subscription may quietly cost more. */
function drift(ctx: Ctx): void {
  const s = ctx.rules.subscriptions;
  const slice = sliceOf(ctx.player)!;
  if (ctx.week < slice.nextDriftWeek) return;
  slice.nextDriftWeek = ctx.week + s.driftEveryWeeks;
  for (const [subId, entry] of Object.entries(slice.active)) {
    if (ctx.pack.subscriptionById[subId]?.priceDrift === false) continue;
    if (!ctx.rng.chance(`subs:${ctx.seat}`, s.driftChanceBp)) continue;
    const bumpBp = ctx.rng.range(`subs:${ctx.seat}`, s.driftMinBp, s.driftMaxBp);
    entry.price += Math.max(1, mulDiv(entry.price, bumpBp, 10_000));
  }
}

export const subscriptions: RuleModule = {
  id: SUBS_MODULE_ID,
  flag: 'subscriptions',
  order: 130,
  commands: [subscribeHandler, unsubscribeHandler],
  stateSlice: {
    key: SUBS_MODULE_ID,
    schema: sliceSchema,
    version: 1,
    initialPlayer: (ctx) => ({
      active: {},
      nextDriftWeek: ctx.rules.subscriptions.driftEveryWeeks,
    }),
  },
  hooks: {
    onTurnStart(ctx) {
      if (!sliceOf(ctx.player) || ctx.week <= 1) return;
      drift(ctx);
      bill(ctx);
    },
  },
};
