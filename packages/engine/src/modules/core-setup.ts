/** core-setup (order 0): reset the per-turn state — hours, position at home, shop rotation. */
import type { RuleModule } from '../core/module.js';
import { STREAMS } from '../core/rng.js';

export const coreSetup: RuleModule = {
  id: 'core-setup',
  order: 0,
  hooks: {
    onTurnStart(ctx) {
      const p = ctx.player;
      p.hoursLeft = Math.max(0, ctx.rules.time.weekHours - p.turn.penalties);
      if (p.turn.penalties > 0)
        ctx.emit({
          type: 'HoursSpent',
          seat: ctx.seat,
          hours: p.turn.penalties,
          reason: 'penalty',
        });
      p.turn.penalties = 0;
      p.turn.jobsTurnedDown = [];
      p.turn.relaxed = false;
      p.turn.eventsFired = [];
      p.turn.consumed = [];
      p.location = ctx.pack.homeLocation[p.home.tier];
      p.inside = true;
      // Discount-store rotation: N random catalog items per player turn, seeded per seat (SEED_DATA 14.5).
      const store = ctx.pack.locationById[ctx.rules.items.discountStoreId];
      const n = store?.shopRotation ?? ctx.rules.items.discountRotation;
      const catalog = ctx.pack.items
        .filter((i) => i.storeIds.includes(ctx.rules.items.discountStoreId))
        .map((i) => i.id);
      p.turn.shopRotation = ctx.rng.shuffle(STREAMS.shop(ctx.seat), catalog).slice(0, n);
    },
  },
};
