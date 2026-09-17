/**
 * transport (order 110, flag `transport`): GDD 4.3 travel modes beyond walking. The Move handler is
 * mode-agnostic — it asks `modeGate` whether a mode may be used and `modeMoney` what the trip costs
 * (M1.7 seams) — so everything mode-specific lives here: the transit pass, car ownership with its
 * weekly upkeep, depreciation and breakdowns, and the per-trip risks of each mode.
 *
 * Ride-hail surge is rolled once per turn and kept in the slice rather than per trip, so a preview
 * and the move it previews always agree on the price (ADR-0028).
 */
import { z } from 'zod';
import type { DomainEvent, ErrorCode } from '@hustle-ring/shared';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler, RuleModule } from '../core/module.js';
import type { PlayerState } from '../core/state.js';
import { mulDiv, pm } from '../core/math.js';
import { requireCash, requireService } from '../commands/common.js';
import { setModeHooks } from '../commands/turn.js';

export const TRANSPORT_MODULE_ID = 'transport';

export type CarKind = 'used' | 'new';

interface Car {
  kind: CarKind;
  /** Current market value in whole dollars; depreciates weekly. */
  value: number;
  boughtWeek: number;
  broken: boolean;
}

interface TransportSlice {
  /** Weeks of transit pass left; 0 means each trip pays the fare. */
  passWeeks: number;
  car: Car | null;
  /** This turn's ride-hail multiplier in per-mille (1000 = no surge). */
  surgePm: number;
  /** This turn's asking price for a used car, before the economy scale. */
  usedCarAsk: number;
}

const sliceSchema = z
  .object({
    passWeeks: z.number().int().nonnegative(),
    car: z
      .object({
        kind: z.enum(['used', 'new']),
        value: z.number().int().nonnegative(),
        boughtWeek: z.number().int().positive(),
        broken: z.boolean(),
      })
      .strict()
      .nullable(),
    surgePm: z.number().int().positive(),
    usedCarAsk: z.number().int().nonnegative(),
  })
  .strict();

export function transportOf(p: PlayerState): TransportSlice | undefined {
  return p.modules[TRANSPORT_MODULE_ID] as TransportSlice | undefined;
}

export function carOf(p: PlayerState): Car | null {
  return transportOf(p)?.car ?? null;
}

const stream = (seat: number): string => `transport:${seat}`;

/**
 * What a car costs right now. The used price is the asking price rolled at this turn's start and
 * kept in the slice: `cost` and `validate` must not draw from the RNG (they run inside
 * `legalCommands` and `previewCommand`, which are pure), so the roll cannot happen here.
 */
function carPrice(ctx: Ctx, seat: number, kind: CarKind): number {
  const c = ctx.rules.cars;
  if (kind === 'new') return ctx.econ(c.newPrice);
  const ask = transportOf(ctx.playerAt(seat))?.usedCarAsk ?? c.usedMin;
  return ctx.econ(ask);
}

/** Resale value: 50% of the current value, 60% while a new car is still young (GDD 4.3). */
export function carResale(ctx: Ctx, car: Car): number {
  const c = ctx.rules.cars;
  const young = car.kind === 'new' && ctx.week - car.boughtWeek < c.sellNewWeeks;
  return mulDiv(car.value, young ? c.sellNewBp : c.sellUsedBp, 10_000);
}

function modeGate(ctx: Ctx, mode: string): ErrorCode | null {
  const spec = ctx.pack.transportById[mode];
  if (!spec) return 'ERR_UNKNOWN_ID';
  const slice = transportOf(ctx.player);
  // Without the module (flag off) only the always-available mode exists: classic is walk only.
  if (!slice) return spec.unlock === 'always' ? null : 'ERR_FEATURE_OFF';
  switch (spec.unlock) {
    case 'always':
      return null;
    case 'transitPass':
      return slice.passWeeks > 0 ? null : 'ERR_UNLOCK_MISSING';
    case 'smartphone':
      return ctx.hasUnlock(ctx.seat, 'rideHail') ? null : 'ERR_UNLOCK_MISSING';
    case 'car':
      if (!slice.car) return 'ERR_NO_CAR';
      return slice.car.broken ? 'ERR_ITEM_BROKEN' : null;
  }
}

function modeMoney(ctx: Ctx, mode: string, steps: number): number {
  const spec = ctx.pack.transportById[mode];
  const slice = transportOf(ctx.player);
  if (!spec || !slice) return 0;
  const cost = spec.cost;
  switch (cost.type) {
    case 'free':
      return 0;
    case 'passOrFare':
      return slice.passWeeks > 0 ? 0 : ctx.econ(cost.fare);
    case 'perTrip': {
      const perStep = Math.round(cost.perStep * 1000);
      const base = cost.base + mulDiv(steps, perStep, 1000);
      return pm(ctx.econ(base), slice.surgePm);
    }
    case 'upkeep':
      // Paid weekly, not per trip.
      return 0;
  }
}

export interface BuyTransitPassCommand extends BaseCommand {
  type: 'BuyTransitPass';
}
export interface BuyCarCommand extends BaseCommand {
  type: 'BuyCar';
  source: CarKind;
}
export interface SellCarCommand extends BaseCommand {
  type: 'SellCar';
}
export interface RepairCarCommand extends BaseCommand {
  type: 'RepairCar';
}

/** The mode a pass covers, and its price: the one transit mode the pack defines. */
function passSpec(ctx: Ctx): { price: number } | null {
  for (const m of ctx.pack.transport)
    if (m.cost.type === 'passOrFare') return { price: ctx.econ(m.cost.passPrice) };
  return null;
}

const buyTransitPassHandler: CommandHandler<BuyTransitPassCommand> = {
  type: 'BuyTransitPass',
  schema: z.object({ type: z.literal('BuyTransitPass') }).strict(),
  cost: (ctx) => ({ hours: 0, money: passSpec(ctx)?.price ?? 0 }),
  validate: (ctx) => {
    const svc = requireService(ctx, 'transit-pass');
    if (svc) return svc;
    const spec = passSpec(ctx);
    if (!spec) return 'ERR_UNKNOWN_ID';
    return requireCash(ctx, spec.price);
  },
  apply: (ctx) => {
    const price = passSpec(ctx)!.price;
    const slice = transportOf(ctx.player)!;
    ctx.addMoney(ctx.seat, 'cash', -price, 'transit-pass');
    slice.passWeeks += ctx.rules.housing.rentWeeks;
    ctx.emit({ type: 'ItemBought', seat: ctx.seat, itemId: 'transit-pass' });
  },
  preview: (ctx) => ({ notes: [`transit-pass:${passSpec(ctx)?.price ?? 0}`] }),
  candidates: () => [{ type: 'BuyTransitPass' }],
  zeroTime: true,
  ai: { category: 'buy' },
};

const buyCarHandler: CommandHandler<BuyCarCommand> = {
  type: 'BuyCar',
  schema: z.object({ type: z.literal('BuyCar'), source: z.enum(['used', 'new']) }).strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: carPrice(ctx, ctx.seat, cmd.source) }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'cars');
    if (svc) return svc;
    const slice = transportOf(ctx.player);
    if (!slice) return 'ERR_FEATURE_OFF';
    if (slice.car) return 'ERR_HAS_CAR';
    const c = ctx.rules.cars;
    const here = ctx.player.location;
    const wanted = cmd.source === 'new' ? c.newLocationId : c.usedLocationId;
    if (here !== wanted) return 'ERR_NOT_AT_LOCATION';
    return requireCash(ctx, carPrice(ctx, ctx.seat, cmd.source));
  },
  apply: (ctx, cmd) => {
    const price = carPrice(ctx, ctx.seat, cmd.source);
    const slice = transportOf(ctx.player)!;
    ctx.addMoney(ctx.seat, 'cash', -price, 'car');
    slice.car = { kind: cmd.source, value: price, boughtWeek: ctx.week, broken: false };
    ctx.emit({ type: 'CarBought', seat: ctx.seat });
  },
  candidates: (ctx) => {
    const c = ctx.rules.cars;
    const here = ctx.player.location;
    const out: BuyCarCommand[] = [];
    if (here === c.usedLocationId) out.push({ type: 'BuyCar', source: 'used' });
    if (here === c.newLocationId) out.push({ type: 'BuyCar', source: 'new' });
    return out;
  },
  zeroTime: true,
  ai: { category: 'buy' },
};

const sellCarHandler: CommandHandler<SellCarCommand> = {
  type: 'SellCar',
  schema: z.object({ type: z.literal('SellCar') }).strict(),
  cost: (ctx) => {
    const car = carOf(ctx.player);
    return { hours: 0, money: car ? -carResale(ctx, car) : 0 };
  },
  validate: (ctx) => {
    const svc = requireService(ctx, 'cars');
    if (svc) return svc;
    return carOf(ctx.player) ? null : 'ERR_NO_CAR';
  },
  apply: (ctx) => {
    const slice = transportOf(ctx.player)!;
    const paid = carResale(ctx, slice.car!);
    slice.car = null;
    ctx.addMoney(ctx.seat, 'cash', paid, 'car-sale');
    ctx.emit({ type: 'CarSold', seat: ctx.seat });
  },
  preview: (ctx) => {
    const car = carOf(ctx.player);
    return car ? { money: carResale(ctx, car) } : {};
  },
  candidates: () => [{ type: 'SellCar' }],
  zeroTime: true,
  ai: { category: 'finance' },
};

const repairCarHandler: CommandHandler<RepairCarCommand> = {
  type: 'RepairCar',
  schema: z.object({ type: z.literal('RepairCar') }).strict(),
  cost: (ctx) => ({ hours: 0, money: ctx.econ(ctx.rules.cars.repairCost) }),
  validate: (ctx) => {
    const svc = requireService(ctx, 'cars');
    if (svc) return svc;
    const car = carOf(ctx.player);
    if (!car) return 'ERR_NO_CAR';
    if (!car.broken) return 'ERR_INVALID_AMOUNT';
    return requireCash(ctx, ctx.econ(ctx.rules.cars.repairCost));
  },
  apply: (ctx) => {
    const slice = transportOf(ctx.player)!;
    ctx.addMoney(ctx.seat, 'cash', -ctx.econ(ctx.rules.cars.repairCost), 'car-repair');
    slice.car!.broken = false;
    ctx.emit({ type: 'ItemRepaired', seat: ctx.seat, uid: 'car' });
  },
  candidates: () => [{ type: 'RepairCar' }],
  zeroTime: true,
  ai: { category: 'finance' },
};

/** Per-trip risks: a transit delay, a ride-hail no-show, a breakdown on the way. */
function onEvent(ctx: Ctx, e: DomainEvent): void {
  if (e.type !== 'Moved') return;
  const spec = ctx.pack.transportById[e.mode];
  const slice = transportOf(ctx.playerAt(e.seat));
  if (!spec || !slice) return;
  const seat = e.seat;
  if (spec.delayBp > 0 && ctx.rng.chance(stream(seat), spec.delayBp)) {
    ctx.spendHours(seat, spec.delayHalfHours, 'transit-delay');
    ctx.emit({ type: 'EventFired', seat, eventId: 'core:transit-delay', effects: ['hours'] });
  }
  if (spec.noShowBp > 0 && ctx.rng.chance(stream(seat), spec.noShowBp)) {
    ctx.spendHours(seat, spec.noShowHalfHours, 'ride-no-show');
    ctx.emit({ type: 'EventFired', seat, eventId: 'core:ride-no-show', effects: ['hours'] });
  }
  const car = slice.car;
  if (car && spec.unlock === 'car') {
    const c = ctx.rules.cars;
    const chance = car.kind === 'used' ? c.usedBreakdownBp : c.newBreakdownBp;
    if (chance > 0 && ctx.rng.chance(stream(seat), chance)) {
      car.broken = true;
      ctx.emit({ type: 'EventFired', seat, eventId: 'core:car-breakdown', effects: ['car'] });
    }
  }
}

export const transport: RuleModule = {
  id: TRANSPORT_MODULE_ID,
  flag: 'transport',
  order: 110,
  commands: [buyTransitPassHandler, buyCarHandler, sellCarHandler, repairCarHandler],
  stateSlice: {
    key: TRANSPORT_MODULE_ID,
    schema: sliceSchema,
    version: 1,
    initialPlayer: (ctx) => ({
      passWeeks: 0,
      car: null,
      surgePm: 1000,
      usedCarAsk: ctx.rules.cars.usedMin,
    }),
  },
  hooks: {
    onTurnStart(ctx) {
      const slice = transportOf(ctx.player);
      if (!slice) return;
      if (ctx.week > 1) {
        if (slice.passWeeks > 0) slice.passWeeks -= 1;
        const car = slice.car;
        if (car) {
          const spec = ctx.pack.transport.find((m) => m.cost.type === 'upkeep');
          if (spec?.cost.type === 'upkeep')
            ctx.takeMoneyCascade(ctx.seat, ctx.econ(spec.cost.weekly), 'car-upkeep');
          car.value -= mulDiv(car.value, ctx.rules.cars.depreciationBp, 10_000);
        }
      }
      // One surge roll and one used-car asking price a turn, so a preview and the action it
      // prices never disagree, and neither cost() nor validate() ever touches the RNG (ADR-0028).
      const rideHail = ctx.pack.transport.find((m) => m.surgeBp > 0);
      slice.surgePm =
        rideHail && ctx.rng.chance(stream(ctx.seat), rideHail.surgeBp)
          ? ctx.rng.range(stream(ctx.seat), rideHail.surgeMinPm, rideHail.surgeMaxPm)
          : 1000;
      const c = ctx.rules.cars;
      slice.usedCarAsk = ctx.rng.range(stream(ctx.seat), c.usedMin, c.usedMax);
    },
    onDomainEvent: onEvent,
    contributeWealth(ctx, seat) {
      // A car is a real asset: GDD 4.4 counts liquid assets, so its resale value counts.
      const car = carOf(ctx.playerAt(seat));
      return car ? carResale(ctx, car) : 0;
    },
  },
};

/** Installs the Move handler's mode hooks (M1.7 seam). Idempotent. */
export function registerTransportHooks(): void {
  setModeHooks(modeGate, modeMoney);
}
