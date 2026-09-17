/** Food: BuyFood, EatMeal (GDD 4.8, 4.11). */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import { requireCash, requireService } from './common.js';

export interface BuyFoodCommand extends BaseCommand {
  type: 'BuyFood';
  units: number;
}
export interface EatMealCommand extends BaseCommand {
  type: 'EatMeal';
  mealId: string;
}

export function fridgeCapacity(ctx: Ctx, seat: number): number {
  if (!ctx.hasUnlock(seat, 'freshFood')) return 0;
  return ctx.hasUnlock(seat, 'freshFood12') ? ctx.rules.food.freezerCap : ctx.rules.food.fridgeCap;
}

export const FOOD_UNITS = [1, 2, 4] as const;

export const buyFoodHandler: CommandHandler<BuyFoodCommand> = {
  type: 'BuyFood',
  schema: z.object({ type: z.literal('BuyFood'), units: z.number().int().positive() }).strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: ctx.econ(ctx.rules.food.unitPrice) * cmd.units }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'grocery');
    if (svc) return svc;
    if (!(FOOD_UNITS as readonly number[]).includes(cmd.units)) return 'ERR_INVALID_AMOUNT';
    const cap = fridgeCapacity(ctx, ctx.seat);
    const p = ctx.player;
    if (cap === 0) {
      if (cmd.units > 1 || p.food.unrefrigeratedUnits > 0) return 'ERR_NO_FRIDGE';
    } else if (p.food.fridgeUnits + cmd.units > cap) return 'ERR_FRIDGE_FULL';
    return requireCash(ctx, ctx.econ(ctx.rules.food.unitPrice) * cmd.units);
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    ctx.addMoney(ctx.seat, 'cash', -ctx.econ(ctx.rules.food.unitPrice) * cmd.units, 'food');
    if (fridgeCapacity(ctx, ctx.seat) === 0) p.food.unrefrigeratedUnits += cmd.units;
    else p.food.fridgeUnits += cmd.units;
    ctx.emit({ type: 'FoodBought', seat: ctx.seat, units: cmd.units });
  },
  candidates: () => FOOD_UNITS.map((units) => ({ type: 'BuyFood' as const, units })),
  zeroTime: true,
  ai: { category: 'buy' },
};

export const eatMealHandler: CommandHandler<EatMealCommand> = {
  type: 'EatMeal',
  schema: z.object({ type: z.literal('EatMeal'), mealId: z.string() }).strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: ctx.econ(ctx.pack.mealById[cmd.mealId]?.price ?? 0) }),
  validate: (ctx, cmd) => {
    const meal = ctx.pack.mealById[cmd.mealId];
    if (!meal) return 'ERR_UNKNOWN_ID';
    const svc = requireService(ctx, 'meals');
    if (svc) return svc;
    if (meal.locationId !== ctx.player.location) return 'ERR_NOT_AT_LOCATION';
    return requireCash(ctx, ctx.econ(meal.price));
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const meal = ctx.pack.mealById[cmd.mealId]!;
    ctx.addMoney(ctx.seat, 'cash', -ctx.econ(meal.price), 'meal');
    if (meal.countsAsMeal) p.food.mealPending = meal.id;
    if (meal.happiness !== 0) ctx.addStat(ctx.seat, 'happiness', meal.happiness, 'meal');
    ctx.emit({ type: 'MealEaten', seat: ctx.seat });
  },
  preview: (ctx, cmd) => {
    const meal = ctx.pack.mealById[cmd.mealId];
    return {
      deltas: meal && meal.happiness !== 0 ? { happiness: meal.happiness } : {},
      notes: meal?.countsAsMeal ? ['meal.counts'] : ['meal.snack'],
    };
  },
  candidates: (ctx) =>
    ctx.pack.meals
      .filter((m) => m.locationId === ctx.player.location)
      .map((m) => ({ type: 'EatMeal' as const, mealId: m.id })),
  zeroTime: true,
  ai: { category: 'buy' },
};
