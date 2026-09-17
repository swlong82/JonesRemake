/**
 * core-econ (order 10): GDD 4.12 economy tick once per week (step B) + classic bounded market
 * (SEED_DATA 14.4) + news hint generation. Modern drift-model assets are handled by the
 * modern-assets module through the same `stepAsset` seam.
 */
import type { AssetSpec } from '@hustle-ring/content';
import type { EconPhase } from '@hustle-ring/shared';
import type { Ctx } from '../core/ctx.js';
import { clamp, mulDiv } from '../core/math.js';
import type { RuleModule } from '../core/module.js';
import { STREAMS } from '../core/rng.js';

const PHASES: EconPhase[] = ['boom', 'stable', 'recession'];
export const MARKET_HISTORY = 26;

export function tickEconomy(ctx: Ctx): void {
  const e = ctx.state.econ;
  const r = ctx.rules.econ;
  // Phase transition: p per adjacent phase.
  const idx = PHASES.indexOf(e.phase);
  const neighbours = [idx - 1, idx + 1].filter((i) => i >= 0 && i < PHASES.length);
  for (const n of neighbours) {
    if (ctx.rng.chance(STREAMS.economy, r.phaseTransitionBp)) {
      e.phase = PHASES[n]!;
      break;
    }
  }
  const drift = r.drift[e.phase] ?? 0;
  const noise = ctx.rng.normal(STREAMS.economy, r.noiseSigma);
  const before = e.index;
  e.index = clamp(mulDiv(before, 1000 + drift + noise, 1000), r.min, r.max);
  e.lastChangePm = mulDiv(e.index, 1000, before) - 1000;
  ctx.emit({ type: 'EconomyTicked', econ: e.index, phase: e.phase });
  // News hint for the coming week (accuracy applied here, read later).
  const accurate = ctx.rng.chance(STREAMS.economy, r.newsAccuracyBp);
  let hint = e.phase;
  if (!accurate) {
    const others = PHASES.filter((p) => p !== e.phase);
    hint = others[ctx.rng.int(STREAMS.economy, others.length)]!;
  }
  ctx.state.news = { phaseHint: hint, accurate, week: ctx.week };
}

/** Bounded random walk (SEED_DATA 14.4): move = corr × econΔ + uniform(±maxMove) × (1 − |corr|), reflected at bounds. */
export function stepBounded(ctx: Ctx, a: AssetSpec, price: number): number {
  const econMoveBp = mulDiv(a.econCorrBp, ctx.state.econ.lastChangePm, 1000);
  const u = ctx.rng.range(STREAMS.market, -a.maxMoveBp, a.maxMoveBp);
  const idio = mulDiv(u, 10_000 - Math.abs(a.econCorrBp), 10_000);
  let np = mulDiv(price, 10_000 + econMoveBp + idio, 10_000);
  const min = a.minCents ?? 1;
  const max = a.maxCents ?? Number.MAX_SAFE_INTEGER;
  if (np > max) np = max - (np - max);
  if (np < min) np = min + (min - np);
  return clamp(np, min, max);
}

/** Seam for the modern-assets module. */
export let stepAsset: (ctx: Ctx, a: AssetSpec, price: number) => number = (ctx, a, price) =>
  a.model === 'bounded' ? stepBounded(ctx, a, price) : price;
export function setAssetStepper(fn: typeof stepAsset): void {
  stepAsset = fn;
}

export function tickMarket(ctx: Ctx): void {
  const m = ctx.state.market;
  const changed: Record<string, number> = {};
  for (const a of ctx.pack.assets) {
    const price = m.prices[a.id];
    if (price === undefined) continue;
    const np = Math.max(1, stepAsset(ctx, a, price));
    m.prices[a.id] = np;
    changed[a.id] = np;
    const h = (m.history[a.id] ??= []);
    h.push(np);
    if (h.length > MARKET_HISTORY) h.splice(0, h.length - MARKET_HISTORY);
  }
  ctx.emit({ type: 'MarketMoved', prices: changed });
}

export const coreEcon: RuleModule = {
  id: 'core-econ',
  order: 10,
  hooks: {
    onWeekStart(ctx) {
      tickEconomy(ctx);
      tickMarket(ctx);
    },
  },
};
