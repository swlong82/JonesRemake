/**
 * Content-event runtime (GDD 4.13): at most one random start-of-turn event per player per turn,
 * one weekend event per player per week, plus onEnter/onExit/onAction triggers and scheduled
 * events. Chaos multiplier scales turnStart chances; Chaos Off runs neutral weekend events only.
 */
import type { EventSpec } from '@hustle-ring/content';
import type { Ctx } from './ctx.js';
import { applyEffects, conditionHolds, evalWeight } from './effects.js';
import { mulDiv } from './math.js';
import { STREAMS } from './rng.js';

function eligible(ctx: Ctx, seat: number, e: EventSpec): boolean {
  if (e.flag !== undefined && !ctx.flags[e.flag as keyof typeof ctx.flags]) return false;
  return conditionHolds(ctx, seat, e.conditions);
}

export function chaosMultiplier(ctx: Ctx, e: EventSpec): number {
  const chaos = ctx.state.config.chaos;
  return e.chaosWeights ? e.chaosWeights[chaos] : ctx.pack.chaosMultiplier[chaos];
}

export function fireEvent(ctx: Ctx, seat: number, e: EventSpec): void {
  const p = ctx.playerAt(seat);
  const chips = applyEffects(ctx, seat, e.effects, `event:${e.id}`);
  p.turn.eventsFired.push(e.id);
  if (e.tone === 'bad') p.stats.eventsSuffered++;
  ctx.emit({ type: 'EventFired', seat, eventId: e.id, effects: chips });
}

/**
 * Random start-of-turn event: each eligible turnStart event's weight is its per-turn chance in bp,
 * scaled by chaos; one roll decides whether anything fires and which (at most 1).
 */
export function runTurnStartEvents(ctx: Ctx, seat: number): void {
  const candidates: { e: EventSpec; w: number }[] = [];
  for (const e of ctx.pack.events) {
    if (e.trigger !== 'turnStart') continue;
    const mult = chaosMultiplier(ctx, e);
    if (mult <= 0) continue;
    if (!eligible(ctx, seat, e)) continue;
    const w = mulDiv(evalWeight(ctx, seat, e.weight), mult, 1000);
    if (w > 0) candidates.push({ e, w });
  }
  if (candidates.length === 0) return;
  const total = candidates.reduce((s, c) => s + c.w, 0);
  const roll = ctx.rng.bp(STREAMS.events(seat));
  if (roll >= total) return;
  let acc = 0;
  for (const c of candidates) {
    acc += c.w;
    if (roll < acc) {
      fireEvent(ctx, seat, c.e);
      return;
    }
  }
}

export function runScheduledEvents(ctx: Ctx, seat: number): void {
  const p = ctx.playerAt(seat);
  if (p.scheduled.length === 0) return;
  const due = p.scheduled.filter((s) => s.week <= ctx.week);
  p.scheduled = p.scheduled.filter((s) => s.week > ctx.week);
  for (const s of due) {
    const e = ctx.pack.eventById[s.eventId];
    if (e && eligible(ctx, seat, e)) fireEvent(ctx, seat, e);
  }
}

/** Weekend event: weighted pick among eligible weekend events (neutral-only when Chaos Off). */
export function runWeekendEvent(ctx: Ctx, seat: number): void {
  const off = ctx.state.config.chaos === 'off';
  const candidates: { e: EventSpec; w: number }[] = [];
  for (const e of ctx.pack.events) {
    if (e.trigger !== 'weekend') continue;
    if (off && !e.neutral) continue;
    if (!eligible(ctx, seat, e)) continue;
    const w = evalWeight(ctx, seat, e.weight);
    if (w > 0) candidates.push({ e, w });
  }
  if (candidates.length === 0) return;
  const idx = ctx.rng.weighted(
    STREAMS.events(seat),
    candidates.map((c) => c.w),
  );
  fireEvent(ctx, seat, candidates[idx]!.e);
}

/** onEnter:<loc> / onExit:<loc> / onAction:<cmd> triggers: each eligible event rolls independently (weight = bp chance × chaos). */
export function runTriggerEvents(ctx: Ctx, seat: number, trigger: string): void {
  for (const e of ctx.pack.events) {
    if (e.trigger !== trigger) continue;
    const mult = chaosMultiplier(ctx, e);
    if (mult <= 0) continue;
    if (!eligible(ctx, seat, e)) continue;
    const w = mulDiv(evalWeight(ctx, seat, e.weight), mult, 1000);
    if (ctx.rng.chance(STREAMS.events(seat), w)) fireEvent(ctx, seat, e);
  }
}
