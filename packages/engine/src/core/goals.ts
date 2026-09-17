/**
 * Goal formulas and hidden-stat maxima (GDD 4.4, ORIGINAL_REFERENCE 3.2/3.3). Pure functions over
 * state + pack + wealth contributions from modules.
 */
import type { CityPack } from '@hustle-ring/content';
import type { GoalId } from '@hustle-ring/shared';
import { clamp, mulDiv } from './math.js';
import type { GameState, Goals, PlayerState } from './state.js';

/** Market value of holdings in whole dollars (units are milli-units, prices cents). */
export function marketValue(p: PlayerState, state: GameState): number {
  let cents = 0;
  for (const [assetId, h] of Object.entries(p.investments)) {
    const price = state.market.prices[assetId];
    if (price === undefined || h.units === 0) continue;
    cents += mulDiv(h.units, price, 1000);
  }
  return Math.floor(cents / 100);
}

export function liquidAssets(p: PlayerState, state: GameState, moduleWealth: number): number {
  return p.cash + p.bank + marketValue(p, state) + moduleWealth;
}

export function wealthGoal(
  p: PlayerState,
  state: GameState,
  pack: CityPack,
  moduleWealth: number,
): number {
  const liquid = liquidAssets(p, state, moduleWealth);
  return clamp(Math.floor(liquid / pack.wealthPointValue), 0, 100);
}

export function educationGoal(p: PlayerState, pack: CityPack): number {
  const g = pack.rules.goals;
  return clamp(g.educationBase + g.educationPerDegree * p.degrees.length, 0, 100);
}

export function careerGoal(p: PlayerState, pack: CityPack): number {
  if (!p.job) return 0;
  return clamp(mulDiv(p.dependability, pack.rules.goals.careerDependabilityBp, 10_000), 0, 100);
}

export function happinessGoal(p: PlayerState): number {
  return clamp(p.happiness, 0, 100);
}

export function computeGoals(
  p: PlayerState,
  state: GameState,
  pack: CityPack,
  moduleWealth: number,
): Goals {
  return {
    wealth: wealthGoal(p, state, pack, moduleWealth),
    happiness: happinessGoal(p),
    education: educationGoal(p, pack),
    career: careerGoal(p, pack),
  };
}

export function goalsMet(current: Goals, target: Goals): Record<GoalId, boolean> {
  return {
    wealth: current.wealth >= target.wealth,
    happiness: current.happiness >= target.happiness,
    education: current.education >= target.education,
    career: current.career >= target.career,
  };
}

/** max = base + jobRequired + perDegree × degrees (ORIGINAL_REFERENCE 3.3). */
export function recomputeMaxima(p: PlayerState, pack: CityPack): void {
  const s = pack.rules.stats;
  const job = p.job ? pack.jobById[p.job.jobId] : undefined;
  p.maxDependability =
    s.maxStatBase + (job?.reqDependability ?? 0) + s.maxStatPerDegree * p.degrees.length;
  p.maxExperience =
    s.maxStatBase + (job?.reqExperience ?? 0) + s.maxStatPerDegree * p.degrees.length;
}
