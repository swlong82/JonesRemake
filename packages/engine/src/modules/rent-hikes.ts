/**
 * rentHikes (order 160, flag `rentHikes`): GDD 4.10's modern housing rules. On each renewal week the
 * landlord may raise the locked rent — the notice lands the week before, so there is time to move —
 * and a co-living pod comes with a roommate who helps themselves to the fridge.
 */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import type { RuleModule } from '../core/module.js';
import type { PlayerState } from '../core/state.js';
import { mulDiv } from '../core/math.js';

export const RENT_HIKES_MODULE_ID = 'rent-hikes';

interface HikeSlice {
  /** Basis points the rent goes up by on the next renewal, 0 when no notice is out. */
  noticeBp: number;
  /** Renewal week the notice is for, so a notice is never applied twice. */
  noticeWeek: number;
}

const sliceSchema = z
  .object({ noticeBp: z.number().int().nonnegative(), noticeWeek: z.number().int().nonnegative() })
  .strict();

function sliceOf(p: PlayerState): HikeSlice | undefined {
  return p.modules[RENT_HIKES_MODULE_ID] as HikeSlice | undefined;
}

/** The rise the seat has been warned about, for the news feed and the UI. */
export function rentHikeNotice(p: PlayerState): { bp: number; week: number } | null {
  const slice = sliceOf(p);
  return slice && slice.noticeBp > 0 ? { bp: slice.noticeBp, week: slice.noticeWeek } : null;
}

/** Renewal weeks are every `rentWeeks`; the notice goes out the week before one. */
function nextRenewalWeek(ctx: Ctx): number {
  const every = ctx.rules.housing.rentWeeks;
  return Math.ceil((ctx.week + 1) / every) * every;
}

export const rentHikes: RuleModule = {
  id: RENT_HIKES_MODULE_ID,
  flag: 'rentHikes',
  order: 160,
  stateSlice: {
    key: RENT_HIKES_MODULE_ID,
    schema: sliceSchema,
    version: 1,
    initialPlayer: () => ({ noticeBp: 0, noticeWeek: 0 }),
  },
  hooks: {
    onTurnStart(ctx) {
      const slice = sliceOf(ctx.player);
      if (!slice || ctx.week <= 1) return;
      const h = ctx.rules.housing;
      const p = ctx.player;
      const tier = h.tiers[p.home.tier];
      const stream = `rent:${ctx.seat}`;

      // Renewal week: whatever was noticed last week is what the rent becomes.
      if (ctx.week % h.rentWeeks === 0 && slice.noticeBp > 0 && slice.noticeWeek === ctx.week) {
        const rise = Math.max(1, mulDiv(p.home.rentLocked, slice.noticeBp, 10_000));
        p.home.rentLocked += rise;
        slice.noticeBp = 0;
        ctx.emit({
          type: 'EventFired',
          seat: ctx.seat,
          eventId: 'core:rent-hike',
          effects: [`rent:+${rise}`],
        });
      }

      // A week before the next renewal, the landlord may give notice.
      const renewal = nextRenewalWeek(ctx);
      if (tier && renewal - ctx.week === 1 && slice.noticeBp === 0) {
        // The pack's chaos multiplier is per-mille, and 'off' means no hikes at all.
        const chance = mulDiv(
          tier.rentHikeBp,
          ctx.pack.chaosMultiplier[ctx.state.config.chaos],
          1000,
        );
        if (ctx.rng.chance(stream, chance)) {
          slice.noticeBp = ctx.rng.range(stream, h.rentHike.minBp, h.rentHike.maxBp);
          slice.noticeWeek = renewal;
          ctx.emit({
            type: 'EventFired',
            seat: ctx.seat,
            eventId: 'core:rent-hike-notice',
            effects: [`rentBp:${slice.noticeBp}`],
          });
        }
      }

      // Co-living quirk: the roommate borrows food and forgets to say so.
      if (
        p.home.tier === 'low' &&
        p.food.fridgeUnits > 0 &&
        ctx.rng.chance(stream, h.roommateFoodBp)
      ) {
        p.food.fridgeUnits -= 1;
        ctx.emit({
          type: 'EventFired',
          seat: ctx.seat,
          eventId: 'core:roommate-food',
          effects: ['food:-1'],
        });
      }
    },
  },
};
