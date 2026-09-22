/** Items: BuyItem (items + clothing + pawn listings), SellItem, RedeemPawn, Repair (GDD 4.11, SEED_DATA 14.2/14.5). */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import { mulDiv } from '../core/math.js';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import type { PawnEntry } from '../core/state.js';
import { itemValue, requireCash, requireInside, requireService } from './common.js';

export interface BuyItemCommand extends BaseCommand {
  type: 'BuyItem';
  itemId: string;
  qty: number;
}
export interface SellItemCommand extends BaseCommand {
  type: 'SellItem';
  itemId: string;
}
export interface RedeemPawnCommand extends BaseCommand {
  type: 'RedeemPawn';
  itemId: string;
}
export interface RepairCommand extends BaseCommand {
  type: 'Repair';
  itemId: string;
}

export function isDiscountStore(ctx: Ctx, locationId: string): boolean {
  return locationId === ctx.rules.items.discountStoreId;
}

/** Shelf price at the current location (dollars). */
export function itemPrice(ctx: Ctx, itemId: string): number {
  const spec = ctx.pack.itemById[itemId];
  if (spec) {
    const base = ctx.econ(spec.price);
    return isDiscountStore(ctx, ctx.player.location) && spec.durable
      ? mulDiv(base, ctx.rules.items.discountPriceBp, 10_000)
      : base;
  }
  const cl = ctx.pack.clothingById[itemId];
  if (cl) return ctx.econ(cl.price);
  return 0;
}

/** Pawn listing another player (or the seller after the window) may buy. */
export function buyablePawn(ctx: Ctx, itemId: string): PawnEntry | undefined {
  const w = ctx.rules.pawn.redeemRounds;
  return ctx.state.pawnShop.find(
    (e) =>
      e.itemId === itemId &&
      (e.sellerSeat !== ctx.seat || ctx.week >= e.listedWeek + w) &&
      ctx.week >= e.listedWeek + w,
  );
}

export function pawnBuyPrice(ctx: Ctx, e: PawnEntry): number {
  return mulDiv(itemValue(ctx, e.itemId, e.boughtWeek), ctx.rules.pawn.othersBuyBp, 10_000);
}

function sellsHere(ctx: Ctx, itemId: string): boolean {
  const here = ctx.player.location;
  const spec = ctx.pack.itemById[itemId];
  if (spec) {
    if (!spec.storeIds.includes(here)) return false;
    const loc = ctx.pack.locationById[here];
    if (loc?.shopRotation !== undefined && !ctx.player.turn.shopRotation.includes(itemId))
      return false;
    return true;
  }
  const cl = ctx.pack.clothingById[itemId];
  return cl?.storeId === here;
}

export const buyItemHandler: CommandHandler<BuyItemCommand> = {
  type: 'BuyItem',
  schema: z
    .object({ type: z.literal('BuyItem'), itemId: z.string(), qty: z.number().int().positive() })
    .strict(),
  cost: (ctx, cmd) => {
    const pawn =
      ctx.player.location === ctx.rules.pawn.locationId ? buyablePawn(ctx, cmd.itemId) : undefined;
    return {
      hours: 0,
      money: pawn ? pawnBuyPrice(ctx, pawn) : itemPrice(ctx, cmd.itemId) * cmd.qty,
    };
  },
  validate: (ctx, cmd) => {
    const p = ctx.player;
    const spec = ctx.pack.itemById[cmd.itemId];
    const cl = ctx.pack.clothingById[cmd.itemId];
    if (!spec && !cl) return 'ERR_UNKNOWN_ID';
    if (!p.inside) return 'ERR_NOT_INSIDE';
    if (p.location === ctx.rules.pawn.locationId) {
      const e = buyablePawn(ctx, cmd.itemId);
      if (!e) return 'ERR_ITEM_NOT_FOR_SALE';
      if (cmd.qty !== 1) return 'ERR_INVALID_AMOUNT';
      if (p.items.some((i) => i.itemId === cmd.itemId)) return 'ERR_INVALID_AMOUNT';
      return requireCash(ctx, pawnBuyPrice(ctx, e));
    }
    if (!sellsHere(ctx, cmd.itemId)) return 'ERR_ITEM_NOT_FOR_SALE';
    if (spec && !spec.consumable) {
      if (cmd.qty !== 1) return 'ERR_INVALID_AMOUNT';
      if (p.items.some((i) => i.itemId === cmd.itemId)) return 'ERR_INVALID_AMOUNT';
    }
    if (cl && cmd.qty !== 1) return 'ERR_INVALID_AMOUNT';
    if (spec?.consumable && cmd.qty > 10) return 'ERR_INVALID_AMOUNT';
    return requireCash(ctx, itemPrice(ctx, cmd.itemId) * cmd.qty);
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    if (p.location === ctx.rules.pawn.locationId) {
      const e = buyablePawn(ctx, cmd.itemId)!;
      const price = pawnBuyPrice(ctx, e);
      ctx.addMoney(ctx.seat, 'cash', -price, 'pawn-buy');
      ctx.state.pawnShop = ctx.state.pawnShop.filter((x) => x.uid !== e.uid);
      p.items.push({
        uid: e.uid,
        itemId: e.itemId,
        condition: 'ok',
        boughtWeek: e.boughtWeek,
        boughtAt: ctx.rules.pawn.locationId,
      });
      const spec = ctx.pack.itemById[e.itemId];
      if (spec) ctx.addStat(ctx.seat, 'happiness', spec.happinessOnBuy, 'buy');
      ctx.emit({ type: 'ItemBought', seat: ctx.seat, itemId: e.itemId });
      return;
    }
    const total = itemPrice(ctx, cmd.itemId) * cmd.qty;
    ctx.addMoney(ctx.seat, 'cash', -total, 'buy');
    const spec = ctx.pack.itemById[cmd.itemId];
    if (spec) {
      if (spec.consumable) {
        for (let i = 0; i < cmd.qty; i++) {
          const first = !p.turn.consumed.includes(spec.id);
          if (!spec.oncePerTurn || first)
            ctx.addStat(ctx.seat, 'happiness', spec.happinessOnBuy, 'buy');
          if (first) p.turn.consumed.push(spec.id);
          if (spec.unlocks.includes('newsHint')) p.newsHintWeek = ctx.week;
        }
      } else {
        p.items.push({
          uid: ctx.uid(),
          itemId: spec.id,
          condition: 'ok',
          boughtWeek: ctx.week,
          boughtAt: p.location,
        });
        ctx.addStat(ctx.seat, 'happiness', spec.happinessOnBuy, 'buy');
      }
    } else {
      const cl = ctx.pack.clothingById[cmd.itemId]!;
      p.clothing.push({ tier: cl.tier, weeksLeft: cl.weeks });
    }
    ctx.emit({ type: 'ItemBought', seat: ctx.seat, itemId: cmd.itemId });
  },
  preview: (ctx, cmd) => {
    const spec = ctx.pack.itemById[cmd.itemId];
    if (!spec || spec.happinessOnBuy === 0) return {};
    const p = ctx.player;
    // Mirror `apply` exactly: a `oncePerTurn` consumable pays once however many are bought, and
    // the stat is clamped, so a seat already at the pack's happiness ceiling gains nothing. The
    // preview said otherwise until M6.3's gentler modern decay made the ceiling reachable in
    // ordinary play and the preview ≡ apply property test caught it (ADR-0035).
    const times = spec.consumable
      ? spec.oncePerTurn
        ? p.turn.consumed.includes(spec.id)
          ? 0
          : 1
        : cmd.qty
      : 1;
    const h = ctx.rules.happiness;
    const raw = spec.happinessOnBuy * times;
    const gained = Math.min(h.max, Math.max(h.min, p.happiness + raw)) - p.happiness;
    return gained === 0 ? {} : { deltas: { happiness: gained } };
  },
  candidates: (ctx) => {
    const p = ctx.player;
    const here = p.location;
    const out: BuyItemCommand[] = [];
    if (here === ctx.rules.pawn.locationId) {
      const seen = new Set<string>();
      for (const e of ctx.state.pawnShop) {
        if (!seen.has(e.itemId)) {
          seen.add(e.itemId);
          out.push({ type: 'BuyItem', itemId: e.itemId, qty: 1 });
        }
      }
      return out;
    }
    for (const it of ctx.pack.items)
      if (it.storeIds.includes(here)) out.push({ type: 'BuyItem', itemId: it.id, qty: 1 });
    for (const c of ctx.pack.clothing)
      if (c.storeId === here) out.push({ type: 'BuyItem', itemId: c.id, qty: 1 });
    return out;
  },
  zeroTime: true,
  ai: { category: 'buy' },
};

export const sellItemHandler: CommandHandler<SellItemCommand> = {
  type: 'SellItem',
  schema: z.object({ type: z.literal('SellItem'), itemId: z.string() }).strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'pawn');
    if (svc) return svc;
    if (!(cmd.itemId in ctx.pack.itemById)) return 'ERR_UNKNOWN_ID';
    const owned = ctx.player.items.find((i) => i.itemId === cmd.itemId);
    if (!owned) return 'ERR_ITEM_NOT_OWNED';
    if (owned.condition === 'broken') return 'ERR_ITEM_BROKEN';
    return null;
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const idx = p.items.findIndex((i) => i.itemId === cmd.itemId);
    const owned = p.items[idx]!;
    const paid = mulDiv(
      itemValue(ctx, owned.itemId, owned.boughtWeek),
      ctx.rules.pawn.sellBp,
      10_000,
    );
    p.items.splice(idx, 1);
    ctx.addMoney(ctx.seat, 'cash', paid, 'pawn-sell');
    ctx.state.pawnShop.push({
      uid: owned.uid,
      itemId: owned.itemId,
      sellerSeat: ctx.seat,
      listedWeek: ctx.week,
      paid,
      boughtWeek: owned.boughtWeek,
    });
    ctx.emit({ type: 'ItemSold', seat: ctx.seat, itemId: owned.itemId });
  },
  preview: (ctx, cmd) => {
    const owned = ctx.player.items.find((i) => i.itemId === cmd.itemId);
    return {
      money: owned
        ? mulDiv(itemValue(ctx, owned.itemId, owned.boughtWeek), ctx.rules.pawn.sellBp, 10_000)
        : 0,
    };
  },
  candidates: (ctx) =>
    ctx.player.items.map((i) => ({ type: 'SellItem' as const, itemId: i.itemId })),
  zeroTime: true,
  ai: { category: 'finance' },
};

export function redeemable(ctx: Ctx, itemId: string): PawnEntry | undefined {
  return ctx.state.pawnShop.find(
    (e) =>
      e.itemId === itemId &&
      e.sellerSeat === ctx.seat &&
      ctx.week < e.listedWeek + ctx.rules.pawn.redeemRounds,
  );
}

export function redeemPrice(ctx: Ctx, e: PawnEntry): number {
  return mulDiv(e.paid, ctx.rules.pawn.redeemBp, 10_000);
}

export const redeemPawnHandler: CommandHandler<RedeemPawnCommand> = {
  type: 'RedeemPawn',
  schema: z.object({ type: z.literal('RedeemPawn'), itemId: z.string() }).strict(),
  cost: (ctx, cmd) => {
    const e = redeemable(ctx, cmd.itemId);
    return { hours: 0, money: e ? redeemPrice(ctx, e) : 0 };
  },
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'pawn');
    if (svc) return svc;
    if (!(cmd.itemId in ctx.pack.itemById)) return 'ERR_UNKNOWN_ID';
    const e = redeemable(ctx, cmd.itemId);
    if (!e)
      return ctx.state.pawnShop.some((x) => x.itemId === cmd.itemId && x.sellerSeat === ctx.seat)
        ? 'ERR_PAWN_LOCKED'
        : 'ERR_ITEM_NOT_OWNED';
    return requireCash(ctx, redeemPrice(ctx, e));
  },
  apply: (ctx, cmd) => {
    const e = redeemable(ctx, cmd.itemId)!;
    ctx.addMoney(ctx.seat, 'cash', -redeemPrice(ctx, e), 'pawn-redeem');
    ctx.state.pawnShop = ctx.state.pawnShop.filter((x) => x.uid !== e.uid);
    ctx.player.items.push({
      uid: e.uid,
      itemId: e.itemId,
      condition: 'ok',
      boughtWeek: e.boughtWeek,
      boughtAt: ctx.rules.pawn.locationId,
    });
    ctx.emit({ type: 'ItemBought', seat: ctx.seat, itemId: e.itemId });
  },
  candidates: (ctx) =>
    ctx.state.pawnShop
      .filter((e) => e.sellerSeat === ctx.seat)
      .map((e) => ({ type: 'RedeemPawn' as const, itemId: e.itemId })),
  zeroTime: true,
  ai: { category: 'finance' },
};

export const repairHandler: CommandHandler<RepairCommand> = {
  type: 'Repair',
  schema: z.object({ type: z.literal('Repair'), itemId: z.string() }).strict(),
  cost: (ctx, cmd) => ({
    hours: 0,
    money: ctx.econ(ctx.pack.itemById[cmd.itemId]?.repairCost ?? 0),
  }),
  validate: (ctx, cmd) => {
    const spec = ctx.pack.itemById[cmd.itemId];
    if (!spec) return 'ERR_UNKNOWN_ID';
    const store = spec.storeIds.find((s) => s === ctx.player.location);
    const inside = store ? requireInside(ctx, store) : 'ERR_NOT_AT_LOCATION';
    if (inside) return inside;
    const owned = ctx.player.items.find((i) => i.itemId === cmd.itemId);
    if (!owned) return 'ERR_ITEM_NOT_OWNED';
    if (owned.condition !== 'broken') return 'ERR_INVALID_AMOUNT';
    return requireCash(ctx, ctx.econ(spec.repairCost));
  },
  apply: (ctx, cmd) => {
    const spec = ctx.pack.itemById[cmd.itemId]!;
    const owned = ctx.player.items.find((i) => i.itemId === cmd.itemId)!;
    ctx.addMoney(ctx.seat, 'cash', -ctx.econ(spec.repairCost), 'repair');
    owned.condition = 'ok';
    ctx.emit({ type: 'ItemRepaired', seat: ctx.seat, uid: owned.uid });
  },
  candidates: (ctx) =>
    ctx.player.items
      .filter((i) => i.condition === 'broken')
      .map((i) => ({ type: 'Repair' as const, itemId: i.itemId })),
  zeroTime: true,
  ai: { category: 'buy' },
};
