/** Bank: Deposit, Withdraw, BuyAsset, SellAsset (GDD 4.12). Units are milli-units; prices cents. */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import { mulDiv } from '../core/math.js';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import { requireCash, requireService } from './common.js';

export interface DepositCommand extends BaseCommand {
  type: 'Deposit';
  amount: number;
}
export interface WithdrawCommand extends BaseCommand {
  type: 'Withdraw';
  amount: number;
}
export interface BuyAssetCommand extends BaseCommand {
  type: 'BuyAsset';
  assetId: string;
  /** Whole dollars to invest (fee charged on top). */
  amount: number;
}
export interface SellAssetCommand extends BaseCommand {
  type: 'SellAsset';
  assetId: string;
  /** Whole dollars' worth to sell (capped at holdings). */
  amount: number;
}

export const depositHandler: CommandHandler<DepositCommand> = {
  type: 'Deposit',
  schema: z.object({ type: z.literal('Deposit'), amount: z.number().int().positive() }).strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: (ctx, cmd) => requireService(ctx, 'bank') ?? requireCash(ctx, cmd.amount),
  apply: (ctx, cmd) => {
    ctx.addMoney(ctx.seat, 'cash', -cmd.amount, 'deposit');
    ctx.addMoney(ctx.seat, 'bank', cmd.amount, 'deposit');
    ctx.emit({ type: 'Deposited', seat: ctx.seat, amount: cmd.amount });
  },
  candidates: (ctx) => (ctx.player.cash > 0 ? [{ type: 'Deposit', amount: ctx.player.cash }] : []),
  zeroTime: true,
  ai: { category: 'finance' },
};

export const withdrawHandler: CommandHandler<WithdrawCommand> = {
  type: 'Withdraw',
  schema: z.object({ type: z.literal('Withdraw'), amount: z.number().int().positive() }).strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: (ctx, cmd) =>
    requireService(ctx, 'bank') ?? (ctx.player.bank >= cmd.amount ? null : 'ERR_NOT_ENOUGH_BANK'),
  apply: (ctx, cmd) => {
    ctx.addMoney(ctx.seat, 'bank', -cmd.amount, 'withdraw');
    ctx.addMoney(ctx.seat, 'cash', cmd.amount, 'withdraw');
    ctx.emit({ type: 'Withdrawn', seat: ctx.seat, amount: cmd.amount });
  },
  candidates: (ctx) => {
    const b = ctx.player.bank;
    const out: WithdrawCommand[] = [];
    if (b >= 100) out.push({ type: 'Withdraw', amount: 100 });
    if (b >= 500) out.push({ type: 'Withdraw', amount: 500 });
    if (b > 0) out.push({ type: 'Withdraw', amount: b });
    return out;
  },
  zeroTime: true,
  ai: { category: 'finance' },
};

export function activeAssetIds(ctx: Ctx): string[] {
  return Object.keys(ctx.state.market.prices);
}

export function assetFee(ctx: Ctx, assetId: string, amount: number): number {
  return mulDiv(amount, ctx.pack.assetById[assetId]?.feeBp ?? 0, 10_000);
}

/** Milli-units purchasable for `amount` dollars at the current price. */
export function unitsFor(ctx: Ctx, assetId: string, amount: number): number {
  const price = ctx.state.market.prices[assetId] ?? 0;
  return price > 0 ? Math.floor((amount * 100 * 1000) / price) : 0;
}

export function holdingValue(ctx: Ctx, seat: number, assetId: string): number {
  const h = ctx.playerAt(seat).investments[assetId];
  const price = ctx.state.market.prices[assetId] ?? 0;
  return h ? Math.floor(mulDiv(h.units, price, 1000) / 100) : 0;
}

export const buyAssetHandler: CommandHandler<BuyAssetCommand> = {
  type: 'BuyAsset',
  schema: z
    .object({
      type: z.literal('BuyAsset'),
      assetId: z.string(),
      amount: z.number().int().positive(),
    })
    .strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: cmd.amount + assetFee(ctx, cmd.assetId, cmd.amount) }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'invest');
    if (svc) return svc;
    if (!(cmd.assetId in ctx.state.market.prices)) return 'ERR_UNKNOWN_ID';
    if (unitsFor(ctx, cmd.assetId, cmd.amount) <= 0) return 'ERR_INVALID_AMOUNT';
    return requireCash(ctx, cmd.amount + assetFee(ctx, cmd.assetId, cmd.amount));
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const fee = assetFee(ctx, cmd.assetId, cmd.amount);
    const units = unitsFor(ctx, cmd.assetId, cmd.amount);
    ctx.addMoney(ctx.seat, 'cash', -(cmd.amount + fee), 'invest');
    const h = (p.investments[cmd.assetId] ??= { units: 0, costBasisCents: 0 });
    h.units += units;
    h.costBasisCents += cmd.amount * 100;
    ctx.emit({ type: 'AssetBought', seat: ctx.seat, assetId: cmd.assetId, units });
  },
  preview: (ctx, cmd) => ({ notes: [`fee:${assetFee(ctx, cmd.assetId, cmd.amount)}`] }),
  candidates: (ctx) => {
    const out: BuyAssetCommand[] = [];
    const cash = ctx.player.cash;
    for (const id of activeAssetIds(ctx)) {
      for (const amt of [100, 500, 1000])
        if (cash >= amt + assetFee(ctx, id, amt))
          out.push({ type: 'BuyAsset', assetId: id, amount: amt });
      const all = Math.floor((cash * 10_000) / (10_000 + (ctx.pack.assetById[id]?.feeBp ?? 0)));
      if (all >= 50 && ![100, 500, 1000].includes(all))
        out.push({ type: 'BuyAsset', assetId: id, amount: all });
    }
    return out;
  },
  zeroTime: true,
  ai: { category: 'finance' },
};

export const sellAssetHandler: CommandHandler<SellAssetCommand> = {
  type: 'SellAsset',
  schema: z
    .object({
      type: z.literal('SellAsset'),
      assetId: z.string(),
      amount: z.number().int().positive(),
    })
    .strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'invest');
    if (svc) return svc;
    if (!(cmd.assetId in ctx.state.market.prices)) return 'ERR_UNKNOWN_ID';
    const h = ctx.player.investments[cmd.assetId];
    if (!h || h.units <= 0) return 'ERR_INVALID_AMOUNT';
    return null;
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    const h = p.investments[cmd.assetId]!;
    const price = ctx.state.market.prices[cmd.assetId]!;
    const wanted = Math.floor((cmd.amount * 100 * 1000) / price);
    const units = Math.min(h.units, wanted);
    const gross = Math.floor(mulDiv(units, price, 1000) / 100);
    const fee = assetFee(ctx, cmd.assetId, gross);
    h.units -= units;
    h.costBasisCents = h.units === 0 ? 0 : Math.max(0, h.costBasisCents - gross * 100);
    if (h.units === 0) {
      const { [cmd.assetId]: _gone, ...rest } = p.investments;
      p.investments = rest;
    }
    ctx.addMoney(ctx.seat, 'cash', gross - fee, 'divest');
    ctx.emit({ type: 'AssetSold', seat: ctx.seat, assetId: cmd.assetId, units });
  },
  preview: (ctx, cmd) => {
    const value = Math.min(cmd.amount, holdingValue(ctx, ctx.seat, cmd.assetId));
    return { money: value - assetFee(ctx, cmd.assetId, value) };
  },
  candidates: (ctx) =>
    Object.keys(ctx.player.investments)
      .filter((id) => holdingValue(ctx, ctx.seat, id) > 0)
      .map((id) => ({
        type: 'SellAsset' as const,
        assetId: id,
        amount: holdingValue(ctx, ctx.seat, id),
      })),
  zeroTime: true,
  ai: { category: 'finance' },
};
