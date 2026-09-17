/**
 * wellbeing (order 100, flag `wellbeing`): GDD 4.5. A modern-only survival stat, not a goal: every
 * work, study, gig and relax session moves it, it drifts back toward the pack's target each week,
 * and four bands decide what a turn costs you. The value lives in this module's slice, which is
 * what `ctx.addStat(seat, 'wellbeing', …)` writes through, so no other rule touches it directly.
 */
import { z } from 'zod';
import type { DomainEvent } from '@hustle-ring/shared';
import type { CityPack } from '@hustle-ring/content';
import type { Ctx } from '../core/ctx.js';
import type { RuleModule } from '../core/module.js';
import type { PlayerState } from '../core/state.js';
import { mulDiv } from '../core/math.js';
import { recomputeMaxima } from '../core/goals.js';
import { setLessonWaste, lessonWasteBp } from '../commands/education.js';
import { setPayModifier, payModifierBp } from '../commands/jobs.js';

export const WELLBEING_MODULE_ID = 'wellbeing';

export type WellbeingBand = 'thrive' | 'steady' | 'burnout' | 'collapse';

interface WellbeingSlice {
  value: number;
}

const sliceSchema = z.object({ value: z.number().int().min(0).max(100) }).strict();

/** The seat's wellbeing, or undefined when the pack has the flag off. */
export function wellbeingOf(p: PlayerState): number | undefined {
  return (p.modules[WELLBEING_MODULE_ID] as WellbeingSlice | undefined)?.value;
}

export function wellbeingBand(value: number, pack: CityPack): WellbeingBand {
  const b = pack.rules.wellbeing.bands;
  if (value >= b.thrive) return 'thrive';
  if (value < b.collapse) return 'collapse';
  if (value < b.burnout) return 'burnout';
  return 'steady';
}

/** Band of the seat's current wellbeing; 'steady' when the pack has no wellbeing. */
function bandFor(ctx: Ctx, seat: number): WellbeingBand {
  const v = wellbeingOf(ctx.playerAt(seat));
  return v === undefined ? 'steady' : wellbeingBand(v, ctx.pack);
}

/** A per-session delta pro-rated by the hours actually spent (a half session costs half). */
function perSession(delta: number, halfHours: number, sessionHalfHours: number): number {
  if (sessionHalfHours <= 0) return delta;
  const magnitude = mulDiv(
    Math.abs(delta),
    Math.min(halfHours, sessionHalfHours),
    sessionHalfHours,
  );
  return delta < 0 ? -magnitude : magnitude;
}

function relaxGain(ctx: Ctx, seat: number): number {
  const w = ctx.rules.wellbeing;
  return Math.min(w.relaxMax, w.relaxBase + w.relaxPerComfort * ctx.comfortCount(seat));
}

/** GDD 4.5: a collapse costs the whole turn, resets the stat and may cost the job. */
function collapse(ctx: Ctx, seat: number): void {
  const w = ctx.rules.wellbeing;
  const p = ctx.playerAt(seat);
  p.hoursLeft = 0;
  const slice = p.modules[WELLBEING_MODULE_ID] as WellbeingSlice | undefined;
  if (slice) slice.value = w.collapseReset;
  ctx.addStat(seat, 'dependability', w.collapseDependability, 'collapse');
  p.stats.collapses += 1;
  if (p.job && ctx.rng.chance(`wellbeing:${seat}`, w.collapseJobLossBp)) {
    p.job = null;
    recomputeMaxima(p, ctx.pack);
    ctx.addStat(seat, 'happiness', ctx.rules.happiness.fired, 'fired');
    ctx.emit({ type: 'Fired', seat, reason: 'collapse' });
  }
}

function onEvent(ctx: Ctx, e: DomainEvent): void {
  const w = ctx.rules.wellbeing;
  const t = ctx.rules.time;
  switch (e.type) {
    case 'Worked':
      ctx.addStat(
        e.seat,
        'wellbeing',
        perSession(w.workDelta, e.hours, t.workSessionHours),
        'work',
      );
      break;
    case 'GigWorked':
      ctx.addStat(e.seat, 'wellbeing', perSession(w.gigDelta, e.hours, t.workSessionHours), 'gig');
      break;
    case 'Studied':
      ctx.addStat(e.seat, 'wellbeing', w.studyDelta, 'study');
      break;
    case 'Relaxed':
      ctx.addStat(e.seat, 'wellbeing', relaxGain(ctx, e.seat), 'relax');
      break;
    case 'Starved':
      ctx.addStat(e.seat, 'wellbeing', w.starvation, 'starvation');
      break;
    case 'LoanMissed':
      ctx.addStat(e.seat, 'wellbeing', w.loanMissed, 'loan-missed');
      break;
    case 'HoursSpent':
      // A week with hours to spare is a week you rested. `EndTurn` spends what is left over, so
      // that event is where the unspent hours are, not `hoursLeft` by the time the turn ends.
      if (e.reason === 'end-turn' && e.hours >= w.unspentHoursThreshold)
        ctx.addStat(e.seat, 'wellbeing', w.unspentBonus, 'rest');
      break;
    case 'Moved': {
      // A decent walk is good for you; other modes are neutral (GDD 4.3).
      if (e.mode !== 'walk') break;
      const b = ctx.pack.board;
      const from = b.nodeOf[e.from];
      const to = b.nodeOf[e.to];
      if (from === undefined || to === undefined) break;
      if (b.dist[from]![to]! >= w.walkTripSteps)
        ctx.addStat(e.seat, 'wellbeing', w.walkTripBonus, 'walk');
      break;
    }
    default:
      break;
  }
}

export const wellbeing: RuleModule = {
  id: WELLBEING_MODULE_ID,
  flag: 'wellbeing',
  order: 100,
  stateSlice: {
    key: WELLBEING_MODULE_ID,
    schema: sliceSchema,
    version: 1,
    initialPlayer: (ctx) => ({ value: ctx.rules.start.wellbeing }),
  },
  hooks: {
    onTurnStart(ctx) {
      const w = ctx.rules.wellbeing;
      const slice = ctx.player.modules[WELLBEING_MODULE_ID] as WellbeingSlice | undefined;
      if (!slice) return;
      if (ctx.week > 1) {
        // Weekly drift back toward the pack's target, by at most one step.
        const towards = w.driftTarget - slice.value;
        if (towards !== 0) {
          const step = Math.min(w.driftStep, Math.abs(towards));
          ctx.addStat(ctx.seat, 'wellbeing', towards > 0 ? step : -step, 'drift');
        }
      }
      const band = wellbeingBand(slice.value, ctx.pack);
      if (band === 'thrive') ctx.addStat(ctx.seat, 'happiness', w.thriveHappiness, 'wellbeing');
      else if (band === 'burnout')
        ctx.player.hoursLeft = Math.max(0, ctx.player.hoursLeft - w.burnoutHours);
      else if (band === 'collapse') collapse(ctx, ctx.seat);
      if (band !== 'steady') ctx.emit({ type: 'WellbeingBand', seat: ctx.seat, band });
    },
    onDomainEvent: onEvent,
  },
};

/**
 * Burnout's two effects reach into core commands through the hooks they exposed for this
 * (M1.7): pay is cut while burnt out, and a lesson has a chance of being wasted. Both compose
 * with whatever a later modern module registers, and are no-ops for a pack without wellbeing.
 */
export function registerWellbeingHooks(): void {
  const previousPay = payModifierBp;
  setPayModifier((ctx, seat) => {
    const base = previousPay(ctx, seat);
    if (bandFor(ctx, seat) !== 'burnout') return base;
    return mulDiv(base, 10_000 - ctx.rules.wellbeing.burnoutPayPenaltyBp, 10_000);
  });
  const previousWaste = lessonWasteBp;
  setLessonWaste((ctx, seat, online) => {
    const base = previousWaste(ctx, seat, online);
    if (bandFor(ctx, seat) !== 'burnout') return base;
    // Two independent chances to waste the lesson, combined so neither is lost.
    const burnout = ctx.rules.wellbeing.burnoutLessonWasteBp;
    return 10_000 - mulDiv(10_000 - base, 10_000 - burnout, 10_000);
  });
}
