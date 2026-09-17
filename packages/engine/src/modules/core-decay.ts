/** core-decay (order 40): GDD 4.8 step E — dependability, relaxation and clothing decay. */
import type { RuleModule } from '../core/module.js';

export const coreDecay: RuleModule = {
  id: 'core-decay',
  order: 40,
  hooks: {
    onTurnStart(ctx) {
      const p = ctx.player;
      const s = ctx.rules.stats;
      if (ctx.week > 1) {
        ctx.addStat(ctx.seat, 'dependability', -s.dependabilityDecay, 'decay');
        if (!ctx.hasUnlock(ctx.seat, 'noRelaxDecay'))
          ctx.addStat(ctx.seat, 'relaxation', -s.relaxationDecay, 'decay');
        // The outfit in use (best tier) wears one week; worn-out outfits are discarded.
        if (p.clothing.length > 0) {
          let best = 0;
          for (let i = 1; i < p.clothing.length; i++) {
            if (
              ctx.pack.uniformRank[p.clothing[i]!.tier] >
              ctx.pack.uniformRank[p.clothing[best]!.tier]
            )
              best = i;
          }
          p.clothing[best]!.weeksLeft -= 1;
          p.clothing = p.clothing.filter((c) => c.weeksLeft > 0);
        }
      }
    },
  },
};
