/**
 * delivery (order 150, flag `delivery`): GDD 4.11. A meal brought to wherever you are, for a
 * markup, as long as you own a phone — half an hour of your week instead of the trip, with a small
 * chance the order never turns up and only half the money comes back. A food-club subscription
 * takes the pack's discount off the markup.
 */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler, RuleModule } from '../core/module.js';
import { mulDiv } from '../core/math.js';
import { requireCash, requireHours } from '../commands/common.js';
import { hasGrant } from './subscriptions.js';

export const DELIVERY_MODULE_ID = 'delivery';

export interface OrderDeliveryCommand extends BaseCommand {
  type: 'OrderDelivery';
  mealId: string;
}

/** Menu price × the pack's delivery markup, less the food-club discount on the markup. */
export function deliveryPrice(ctx: Ctx, seat: number, mealId: string): number {
  const meal = ctx.pack.mealById[mealId];
  if (!meal) return 0;
  const f = ctx.rules.food;
  const menu = ctx.econ(meal.price);
  const markup = mulDiv(menu, f.deliveryPriceBp, 10_000) - menu;
  const discounted = hasGrant(ctx, seat, 'foodClub')
    ? markup - mulDiv(markup, f.foodClubDiscountBp, 10_000)
    : markup;
  return menu + discounted;
}

const orderDeliveryHandler: CommandHandler<OrderDeliveryCommand> = {
  type: 'OrderDelivery',
  schema: z.object({ type: z.literal('OrderDelivery'), mealId: z.string() }).strict(),
  cost: (ctx, cmd) => ({
    hours: ctx.rules.time.deliveryHours,
    money: deliveryPrice(ctx, ctx.seat, cmd.mealId),
  }),
  validate: (ctx, cmd) => {
    const meal = ctx.pack.mealById[cmd.mealId];
    if (!meal) return 'ERR_UNKNOWN_ID';
    if (!meal.deliveryEligible) return 'ERR_ITEM_NOT_FOR_SALE';
    if (!ctx.hasUnlock(ctx.seat, 'delivery')) return 'ERR_UNLOCK_MISSING';
    const hours = requireHours(ctx, ctx.rules.time.deliveryHours);
    if (hours) return hours;
    return requireCash(ctx, deliveryPrice(ctx, ctx.seat, cmd.mealId));
  },
  apply: (ctx, cmd) => {
    const f = ctx.rules.food;
    const meal = ctx.pack.mealById[cmd.mealId]!;
    const price = deliveryPrice(ctx, ctx.seat, cmd.mealId);
    ctx.spendHours(ctx.seat, ctx.rules.time.deliveryHours, 'delivery');
    ctx.addMoney(ctx.seat, 'cash', -price, 'delivery');
    if (ctx.rng.chance(`delivery:${ctx.seat}`, f.deliveryLostBp)) {
      // Lost order: part of the money comes back, the meal does not (GDD 4.11).
      const refund = mulDiv(price, f.deliveryRefundBp, 10_000);
      ctx.addMoney(ctx.seat, 'cash', refund, 'delivery-refund');
      ctx.emit({
        type: 'EventFired',
        seat: ctx.seat,
        eventId: 'core:delivery-lost',
        effects: [`money:cash:${refund}`],
      });
      return;
    }
    // A delivered meal counts as the fast food it is, eaten next turn (GDD 4.8).
    if (meal.countsAsMeal) ctx.player.food.mealPending = meal.id;
    if (meal.happiness !== 0) ctx.addStat(ctx.seat, 'happiness', meal.happiness, 'meal');
    ctx.emit({ type: 'MealEaten', seat: ctx.seat });
  },
  preview: (ctx, cmd) => ({
    riskBp: ctx.rules.food.deliveryLostBp,
    riskKey: 'risk.deliveryLost',
    notes: [`meal:${cmd.mealId}`],
  }),
  candidates: (ctx) =>
    ctx.pack.meals
      .filter((m) => m.deliveryEligible)
      .map((m) => ({ type: 'OrderDelivery' as const, mealId: m.id })),
  ai: { category: 'buy' },
};

export const delivery: RuleModule = {
  id: DELIVERY_MODULE_ID,
  flag: 'delivery',
  order: 150,
  commands: [orderDeliveryHandler],
};
