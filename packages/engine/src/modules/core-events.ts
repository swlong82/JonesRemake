/**
 * core-events (order 30): GDD 4.2 step D — formula-driven start events (burglary, appliance
 * breakdown, doctor visit), scheduled events, then at most one random content event.
 * Weekend event runs at turn end (step H).
 */
import type { Ctx } from '../core/ctx.js';
import { runScheduledEvents, runTurnStartEvents, runWeekendEvent } from '../core/events.js';
import { clamp, mulDiv } from '../core/math.js';
import type { RuleModule } from '../core/module.js';
import { STREAMS } from '../core/rng.js';
import { doctorVisit } from './core-pending.js';

export function burglaryChanceBp(ctx: Ctx, seat: number): number {
  const p = ctx.playerAt(seat);
  const tier = ctx.rules.housing.tiers[p.home.tier];
  if (!tier?.burglary) return 0;
  const b = ctx.rules.housing.burglary;
  return clamp(
    b.baseBp + b.perDurableBp * ctx.durables(seat) - b.perRelaxationBp * p.relaxation,
    b.minBp,
    b.maxBp,
  );
}

export function runBurglary(ctx: Ctx): void {
  const p = ctx.player;
  const bp = burglaryChanceBp(ctx, ctx.seat);
  if (bp <= 0 || ctx.state.config.chaos === 'off') return;
  const durables = p.items.filter((i) => ctx.pack.itemById[i.itemId]?.durable);
  if (durables.length === 0) return;
  if (!ctx.rng.chance(STREAMS.events(ctx.seat), bp)) return;
  const count = ctx.rng.range(STREAMS.events(ctx.seat), 1, durables.length);
  const lost = ctx.rng
    .shuffle(STREAMS.events(ctx.seat), durables)
    .slice(0, count)
    .map((i) => i.uid);
  p.items = p.items.filter((i) => !lost.includes(i.uid));
  ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.theft, 'burglary');
  p.stats.eventsSuffered++;
  ctx.emit({ type: 'ItemsStolen', seat: ctx.seat, uids: lost });
  ctx.emit({
    type: 'EventFired',
    seat: ctx.seat,
    eventId: 'core:burglary',
    effects: [`items:-${lost.length}`, `stat:happiness:${ctx.rules.happiness.theft}`],
  });
}

export function breakdownChanceBp(ctx: Ctx, itemId: string, boughtAt: string): number {
  const spec = ctx.pack.itemById[itemId];
  if (!spec || spec.breakdownBp <= 0) return 0;
  const discount = boughtAt === ctx.rules.items.discountStoreId;
  return discount
    ? mulDiv(spec.breakdownBp, ctx.rules.items.discountBreakMultBp, 10_000)
    : spec.breakdownBp;
}

export function runBreakdowns(ctx: Ctx): void {
  if (ctx.state.config.chaos === 'off') return;
  const p = ctx.player;
  for (const owned of p.items) {
    if (owned.condition !== 'ok') continue;
    const bp = breakdownChanceBp(ctx, owned.itemId, owned.boughtAt);
    if (bp > 0 && ctx.rng.chance(STREAMS.events(ctx.seat), bp)) {
      owned.condition = 'broken';
      p.stats.eventsSuffered++;
      ctx.emit({ type: 'ItemBroke', seat: ctx.seat, uid: owned.uid });
    }
  }
}

export function doctorChanceBp(ctx: Ctx, seat: number): number {
  const d = ctx.rules.doctor;
  return Math.max(d.minBp, d.baseBp - d.perRelaxationBp * ctx.playerAt(seat).relaxation);
}

export function runDoctor(ctx: Ctx): void {
  if (ctx.state.config.chaos === 'off') return;
  if (ctx.rng.chance(STREAMS.events(ctx.seat), doctorChanceBp(ctx, ctx.seat)))
    doctorVisit(ctx, 'doctor');
}

export const coreEvents: RuleModule = {
  id: 'core-events',
  order: 30,
  hooks: {
    onTurnStart(ctx) {
      runBurglary(ctx);
      runBreakdowns(ctx);
      runDoctor(ctx);
      runScheduledEvents(ctx, ctx.seat);
      if (ctx.state.config.chaos !== 'off') runTurnStartEvents(ctx, ctx.seat);
    },
    onTurnEnd(ctx) {
      runWeekendEvent(ctx, ctx.seat);
    },
  },
};
