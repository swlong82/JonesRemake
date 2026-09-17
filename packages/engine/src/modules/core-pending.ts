/**
 * core-pending (order 20): GDD 4.2 step C — resolve pending lottery, food/starvation, spoilage,
 * rent due/debt/eviction (GDD 4.8, 4.10, SEED_DATA 14.5).
 */
import type { Ctx } from '../core/ctx.js';
import type { RuleModule } from '../core/module.js';
import { STREAMS } from '../core/rng.js';
import { fridgeCapacity } from '../commands/food.js';
import { rentDueWeek } from '../commands/home.js';

export function resolveLottery(ctx: Ctx): void {
  const p = ctx.player;
  if (p.lotteryTickets <= 0) return;
  let best = 0;
  const prizes = [...ctx.rules.lottery.prizes].sort((a, b) => b.amount - a.amount);
  for (let t = 0; t < p.lotteryTickets; t++) {
    const roll = ctx.rng.bp(STREAMS.events(ctx.seat));
    let acc = 0;
    for (const prize of prizes) {
      acc += prize.bp;
      if (roll < acc) {
        best = Math.max(best, prize.amount);
        break;
      }
    }
  }
  p.lotteryTickets = 0;
  if (best > 0) ctx.addMoney(ctx.seat, 'cash', best, 'lottery');
  ctx.emit({ type: 'LotteryResolved', seat: ctx.seat, prize: best });
}

/** Seam for the wellbeing module (starvation wellbeing hit). */
export let onStarve: (ctx: Ctx, seat: number) => void = () => undefined;
export function setOnStarve(fn: typeof onStarve): void {
  onStarve = fn;
}

export function doctorVisit(ctx: Ctx, reason: string): void {
  const p = ctx.player;
  ctx.spendHours(ctx.seat, ctx.rules.time.doctorHours, reason);
  const cost = ctx.rng.range(
    STREAMS.events(ctx.seat),
    ctx.rules.doctor.costMin,
    ctx.rules.doctor.costMax,
  );
  const shortfall = ctx.takeMoneyCascade(ctx.seat, cost, reason);
  if (shortfall > 0) {
    p.home.debt += shortfall;
    p.home.everHadDebt = true;
    p.home.debtSinceWeek ??= ctx.week;
  }
  p.stats.eventsSuffered++;
  ctx.emit({
    type: 'EventFired',
    seat: ctx.seat,
    eventId: `core:${reason}`,
    effects: [`hours:-${ctx.rules.time.doctorHours / 2}`, `money:cash:-${cost}`],
  });
}

export function resolveFood(ctx: Ctx): void {
  const p = ctx.player;
  const cap = fridgeCapacity(ctx, ctx.seat);
  if (cap === 0 && p.food.fridgeUnits > 0) {
    // Fridge broken or gone: contents are now unrefrigerated.
    p.food.unrefrigeratedUnits += p.food.fridgeUnits;
    p.food.fridgeUnits = 0;
  }
  if (p.food.fridgeUnits > 0) {
    p.food.fridgeUnits -= 1;
    ctx.emit({ type: 'MealEaten', seat: ctx.seat });
  } else if (p.food.unrefrigeratedUnits > 0) {
    p.food.unrefrigeratedUnits -= 1;
    ctx.emit({ type: 'MealEaten', seat: ctx.seat });
  } else if (p.food.mealPending !== null) {
    p.food.mealPending = null;
    ctx.emit({ type: 'MealEaten', seat: ctx.seat });
  } else if (ctx.week > 1) {
    ctx.spendHours(ctx.seat, ctx.rules.time.starvationHours, 'starvation');
    ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.starvation, 'starvation');
    onStarve(ctx, ctx.seat);
    p.stats.eventsSuffered++;
    ctx.emit({ type: 'Starved', seat: ctx.seat });
  }
  if (p.food.mealPending !== null) p.food.mealPending = null;
  if (p.food.unrefrigeratedUnits > 0) {
    p.food.unrefrigeratedUnits = 0;
    ctx.emit({ type: 'Spoiled', seat: ctx.seat });
    doctorVisit(ctx, 'spoiled');
  }
}

export function resolveRent(ctx: Ctx): void {
  const p = ctx.player;
  const r = ctx.rules.housing;
  const due = rentDueWeek(ctx, ctx.seat);
  if (ctx.week > due) {
    // Missed: the period is owed as debt.
    p.home.debt += p.home.rentLocked;
    p.home.paidThroughWeek += r.rentWeeks;
    p.home.extensionUntilWeek = null;
    p.home.everHadDebt = true;
    p.home.extensionsBlocked = true;
    p.home.debtSinceWeek ??= ctx.week;
    ctx.emit({ type: 'RentDebt', seat: ctx.seat });
  } else if (ctx.week === due) {
    ctx.emit({ type: 'RentDue', seat: ctx.seat });
  }
  if (p.home.debtSinceWeek !== null && ctx.week - p.home.debtSinceWeek >= r.evictionWeeks) {
    // Eviction: back to low tier, keep only the newest N durables, debt written off.
    p.home.tier = 'low';
    p.home.rentLocked = ctx.econ(r.tiers.low?.rent ?? 0);
    p.home.debt = 0;
    p.home.debtSinceWeek = null;
    p.home.paidThroughWeek = ctx.week;
    const durables = p.items
      .filter((i) => ctx.pack.itemById[i.itemId]?.durable)
      .sort((a, b) => b.boughtWeek - a.boughtWeek);
    const lost = durables.slice(r.evictionKeepDurables).map((i) => i.uid);
    if (lost.length > 0) {
      p.items = p.items.filter((i) => !lost.includes(i.uid));
      ctx.emit({ type: 'ItemsStolen', seat: ctx.seat, uids: lost });
    }
    p.location = ctx.pack.homeLocation.low;
    p.stats.eventsSuffered++;
    ctx.emit({ type: 'Evicted', seat: ctx.seat });
  }
}

export const corePending: RuleModule = {
  id: 'core-pending',
  order: 20,
  hooks: {
    onTurnStart(ctx) {
      resolveLottery(ctx);
      resolveFood(ctx);
      resolveRent(ctx);
    },
  },
};
