/**
 * Leaderboard score (ROADMAP_SCAFFOLDS 16.7): deterministic from the final state, every constant in
 * content (`rules.scoring`), integer arithmetic only.
 *
 *   (base − perWeek × weeks + netWorth / netWorthDivisor + perDegree × degrees
 *     + perHappinessCareer × (happiness + career)) × Σtargets / goalTotalDivisor
 *   × (1 + hardSeatBp per Hard rival + easySeatBp per Easy rival)
 *
 * Losers and unfinished games score 0. Classic opacity does not change the score.
 */
import type { CityPack } from '@hustle-ring/content';
import { Ctx } from './ctx.js';
import { computeGoals, liquidAssets } from './goals.js';
import { mulDiv } from './math.js';
import type { Engine } from './module.js';
import { moduleWealth } from './scheduler.js';
import type { GameState } from './state.js';

/** Cash, bank, holdings and every module's contribution (a car's resale, loans owed). */
export function netWorthWith(
  engine: Engine,
  state: GameState,
  seat: number,
  pack: CityPack,
): number {
  const ctx = new Ctx(state, pack, seat, false);
  ctx.engine = engine;
  const p = state.players[seat];
  return p ? liquidAssets(p, state, moduleWealth(engine, ctx, seat)) : 0;
}

export function scoreWith(engine: Engine, state: GameState, seat: number, pack: CityPack): number {
  const p = state.players[seat];
  if (!p || state.winner !== seat) return 0;
  const s = pack.rules.scoring;
  const worth = netWorthWith(engine, state, seat, pack);
  const ctx = new Ctx(state, pack, seat, false);
  ctx.engine = engine;
  const g = computeGoals(p, state, pack, moduleWealth(engine, ctx, seat));
  const raw =
    s.base -
    s.perWeek * state.week +
    Math.floor(worth / s.netWorthDivisor) +
    s.perDegree * p.degrees.length +
    s.perHappinessCareer * (g.happiness + g.career);
  const t = p.goals;
  const scaled = mulDiv(raw, t.wealth + t.happiness + t.education + t.career, s.goalTotalDivisor);
  let adjustBp = 10_000;
  state.config.seats.forEach((seatCfg, i) => {
    if (i === seat || !seatCfg.ai) return;
    if (seatCfg.ai.difficulty === 'hard') adjustBp += s.hardSeatBp;
    if (seatCfg.ai.difficulty === 'easy') adjustBp += s.easySeatBp;
  });
  return Math.max(0, mulDiv(scaled, adjustBp, 10_000));
}
