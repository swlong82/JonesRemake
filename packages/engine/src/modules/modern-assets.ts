/**
 * modernAssets (order 180, flag `modernAssets`): GDD 4.12's six modern instruments. The pack
 * carries both instrument sets and the flag picks one, so this module only has to price the
 * `drift` model the modern set uses: a weekly drift, a share of the week's economy move, and an
 * idiosyncratic shock weighted so the realised correlation with the economy is the one the content
 * asks for. `savings` has no volatility at all and simply accrues.
 */
import type { AssetSpec } from '@hustle-ring/content';
import type { Ctx } from '../core/ctx.js';
import type { RuleModule } from '../core/module.js';
import { isqrt, mulDiv } from '../core/math.js';
import { setAssetStepper, stepAsset } from './core-econ.js';
import { STREAMS } from '../core/rng.js';

export const MODERN_ASSETS_MODULE_ID = 'modern-assets';

/**
 * Weight of the idiosyncratic shock: for `move = c·E + s·I` with E and I independent and of equal
 * spread, the realised correlation with E is `c / √(c² + s²)`, so `s = √(1 − c²)` makes it `c`.
 */
export function idioWeightBp(econCorrBp: number): number {
  const c = Math.min(10_000, Math.abs(econCorrBp));
  return isqrt(10_000 * 10_000 - c * c);
}

/** One week of the drift model, in cents. */
export function stepDrift(ctx: Ctx, a: AssetSpec, price: number): number {
  if (a.volBp === 0) return mulDiv(price, 10_000 + a.driftBp, 10_000);
  // The week's economy move, in thousandths of its own noise spread, so it is comparable to a
  // standard shock; the same scale the idiosyncratic draw uses.
  const sigmaPm = Math.max(1, ctx.rules.econ.noiseSigma);
  const econShock = mulDiv(ctx.state.econ.lastChangePm, 1000, sigmaPm);
  const idioShock = ctx.rng.normal(STREAMS.market, 1000);
  const combined =
    mulDiv(econShock, a.econCorrBp, 10_000) + mulDiv(idioShock, idioWeightBp(a.econCorrBp), 10_000);
  const moveBp = a.driftBp + mulDiv(a.volBp, combined, 1000);
  return mulDiv(price, 10_000 + moveBp, 10_000);
}

export const modernAssets: RuleModule = {
  id: MODERN_ASSETS_MODULE_ID,
  flag: 'modernAssets',
  order: 180,
};

/** Teaches the market stepper the drift model; the bounded model is core and stays as it is. */
export function registerModernAssetHooks(): void {
  const previous = stepAsset;
  setAssetStepper((ctx, a, price) =>
    a.model === 'drift' ? stepDrift(ctx, a, price) : previous(ctx, a, price),
  );
}
