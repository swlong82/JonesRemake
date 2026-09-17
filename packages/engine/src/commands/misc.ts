/** Misc: BuyLottery, ReadNews (GDD 4.12/4.13, SEED_DATA 14.5). */
import { z } from 'zod';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import { requireCash, requireService } from './common.js';

export interface BuyLotteryCommand extends BaseCommand {
  type: 'BuyLottery';
  qty: number;
}
export interface ReadNewsCommand extends BaseCommand {
  type: 'ReadNews';
}

export const buyLotteryHandler: CommandHandler<BuyLotteryCommand> = {
  type: 'BuyLottery',
  schema: z
    .object({ type: z.literal('BuyLottery'), qty: z.number().int().positive().max(20) })
    .strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: ctx.rules.lottery.ticketPrice * cmd.qty }),
  validate: (ctx, cmd) =>
    requireService(ctx, 'lottery') ?? requireCash(ctx, ctx.rules.lottery.ticketPrice * cmd.qty),
  apply: (ctx, cmd) => {
    ctx.addMoney(ctx.seat, 'cash', -ctx.rules.lottery.ticketPrice * cmd.qty, 'lottery');
    ctx.player.lotteryTickets += cmd.qty;
    ctx.emit({ type: 'ItemBought', seat: ctx.seat, itemId: 'lottery-ticket' });
  },
  preview: (ctx) => ({
    riskBp: 10_000 - ctx.rules.lottery.prizes.reduce((s, p) => s + p.bp, 0),
    riskKey: 'risk.lotteryLoss',
  }),
  candidates: () => [{ type: 'BuyLottery', qty: 1 }],
  zeroTime: true,
  ai: { category: 'finance' },
};

export const readNewsHandler: CommandHandler<ReadNewsCommand> = {
  type: 'ReadNews',
  schema: z.object({ type: z.literal('ReadNews') }).strict(),
  cost: (ctx) => ({
    hours: 0,
    money: ctx.player.newsHintWeek === ctx.week ? 0 : ctx.rules.econ.newsPrice,
  }),
  validate: (ctx) => {
    if (ctx.hasUnlock(ctx.seat, 'newsHint'))
      return ctx.player.newsHintWeek === ctx.week ? 'ERR_INVALID_AMOUNT' : null;
    const svc = requireService(ctx, 'news');
    if (svc) return svc;
    if (ctx.player.newsHintWeek === ctx.week) return 'ERR_INVALID_AMOUNT';
    return requireCash(ctx, ctx.rules.econ.newsPrice);
  },
  apply: (ctx) => {
    if (!ctx.hasUnlock(ctx.seat, 'newsHint'))
      ctx.addMoney(ctx.seat, 'cash', -ctx.rules.econ.newsPrice, 'news');
    ctx.player.newsHintWeek = ctx.week;
    ctx.emit({ type: 'ItemBought', seat: ctx.seat, itemId: 'news' });
  },
  candidates: () => [{ type: 'ReadNews' }],
  zeroTime: true,
  ai: { category: 'meta' },
};
