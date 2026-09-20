/**
 * AI scorer registry (EXTENSIBILITY 12.6). Plan utility = Σ weight(personality, difficulty) ×
 * score(before, after). Every scorer is a potential difference V(after) − V(before) over a
 * normalised 0..1+ progress measure so partial progress (lessons, dependability) has a gradient.
 * Modules add their own scorers via `registerScorer`; a system with none is simply ignored.
 */
import type { CityPack, PersonalitySpec } from '@hustle-ring/content';
import { computeGoals, marketValue, type GameState, type PlayerState } from '@hustle-ring/engine';
import type { Difficulty } from '@hustle-ring/shared';
import { DIFFICULTY } from './config.js';

export interface ScorerCtx {
  pack: CityPack;
  seat: number;
  personality: PersonalitySpec;
  difficulty: Difficulty;
}

export interface Scorer {
  id: string;
  weight(p: PersonalitySpec, d: Difficulty): number;
  /** Potential function over a state; utility uses V(after) − V(before). */
  value(ctx: ScorerCtx, state: GameState, player: PlayerState): number;
}

function goalProgress(current: number, target: number): number {
  if (target <= 0) return 1;
  return Math.min(1.15, current / target);
}

/** Wage × sessions per week the player can realistically work (≈ 6 sessions in 60h). */
function weeklyIncome(pack: CityPack, p: PlayerState): number {
  if (!p.job) return 0;
  return p.job.wage * pack.rules.jobs.payPerSession * 6;
}

export const goalWealth: Scorer = {
  id: 'goal-gap:wealth',
  weight: (p) => p.weights.wealth,
  value: (ctx, state, p) => {
    const g = computeGoals(p, state, ctx.pack, 0);
    const targetDollars = p.goals.wealth * ctx.pack.wealthPointValue;
    const liquid = p.cash + p.bank + marketValue(p, state);
    const look = DIFFICULTY[ctx.difficulty].lookaheadWeeks;
    const future = weeklyIncome(ctx.pack, p) * look * 0.5;
    return (
      goalProgress(g.wealth, p.goals.wealth) +
      Math.min(0.3, ((liquid + future) / Math.max(1, targetDollars)) * 0.3)
    );
  },
};

export const goalHappiness: Scorer = {
  id: 'goal-gap:happiness',
  weight: (p) => p.weights.happiness,
  value: (_ctx, _state, p) => goalProgress(p.happiness, p.goals.happiness),
};

/**
 * Education progress with credit for the degree in progress: the goal itself only moves on
 * graduation, so without this a lesson looks like six wasted hours to any search.
 */
function educationProgress(ctx: ScorerCtx, state: GameState, p: PlayerState): number {
  const g = computeGoals(p, state, ctx.pack, 0);
  const prog = goalProgress(g.education, p.goals.education);
  if (prog >= 1) return prog;
  let best = 0;
  for (const [id, c] of Object.entries(p.enrolled)) {
    const total = ctx.pack.degreeById[id]?.lessons ?? ctx.pack.rules.education.lessons;
    const f = Math.max(0, total - c.lessonsLeft) / total;
    // Being enrolled is itself progress (0.15) so the fee is not a dead loss in the search.
    best = Math.max(best, 0.15 + 0.85 * f);
  }
  // A course in progress is worth at most 90% of the degree it leads to, so graduating is
  // always a step up (monotone), and never more than the remaining gap.
  const degreeShare = ctx.pack.rules.goals.educationPerDegree / Math.max(1, p.goals.education);
  return prog + Math.min(degreeShare, 1 - prog) * 0.9 * best;
}

export const goalEducation: Scorer = {
  id: 'goal-gap:education',
  weight: (p) => p.weights.education,
  value: (ctx, state, p) => educationProgress(ctx, state, p),
};

export const goalCareer: Scorer = {
  id: 'goal-gap:career',
  weight: (p) => p.weights.career,
  value: (ctx, state, p) => {
    const g = computeGoals(p, state, ctx.pack, 0);
    const prog = goalProgress(g.career, p.goals.career);
    // Potential: dependability can be ground up to its job-defined maximum, so a better job is
    // worth half the career it unlocks even before the stat catches up.
    const potential = p.job
      ? goalProgress(
          Math.floor((p.maxDependability * ctx.pack.rules.goals.careerDependabilityBp) / 10_000),
          p.goals.career,
        )
      : 0;
    const jobBonus = p.job ? 0.15 : -0.25;
    return prog + 0.5 * potential + jobBonus;
  },
};

/**
 * Win proximity: the race is won by the goal you are furthest from, not by the sum, so the binding
 * goal's progress is scored on its own. Without it a planner trades the last three points of a
 * nearly-met goal for money it does not need, and games at high goal levels never close.
 */
export const winProximity: Scorer = {
  id: 'win-proximity',
  weight: () => 2,
  value: (ctx, state, p) => {
    const g = computeGoals(p, state, ctx.pack, 0);
    const worst = Math.min(
      goalProgress(g.wealth, p.goals.wealth),
      goalProgress(g.happiness, p.goals.happiness),
      // Credited, so a lesson moves the binding goal even though the degree has not landed yet.
      educationProgress(ctx, state, p),
      goalProgress(g.career, p.goals.career),
    );
    // Meeting every goal at once is the win itself, so it is worth more than the sum of its parts.
    return worst >= 1 ? 1.5 : Math.min(1, worst);
  },
};

/** Survival: next-week food, rent covered, clothing for the job. */
export const survival: Scorer = {
  id: 'survival',
  weight: (_p, d) => (d === 'easy' ? 0.6 : 1.0),
  value: (ctx, state, p) => {
    let v = 0;
    const fed =
      p.food.fridgeUnits > 0 || p.food.mealPending !== null || p.food.unrefrigeratedUnits > 0;
    v += fed ? 0.1 : -0.15;
    const due = p.home.paidThroughWeek + ctx.pack.rules.housing.rentWeeks;
    const weeksToDue = due - state.week;
    // Rent is paid in cash, so near the due week only cash on hand counts as covered.
    const covered =
      weeksToDue <= 1 ? p.cash >= p.home.rentLocked : p.cash + p.bank >= p.home.rentLocked;
    if (p.home.debt > 0) v -= 0.5 + Math.min(0.5, p.home.debt / 1000);
    else if (weeksToDue <= 1 && !covered) v -= 0.35;
    else if (weeksToDue > ctx.pack.rules.housing.rentWeeks) v += 0.1;
    if (p.job) {
      const job = ctx.pack.jobById[p.job.jobId];
      const need = job ? ctx.pack.uniformRank[job.uniformTier] : 0;
      let best = 0;
      for (const c of p.clothing) best = Math.max(best, ctx.pack.uniformRank[c.tier]);
      if (best < need) v -= 0.3;
      const weeks = p.clothing.reduce((m, c) => Math.max(m, c.weeksLeft), 0);
      if (weeks <= 1) v -= 0.1;
    }
    // Cash carried outside the bank is theft exposure; large balances belong in the bank.
    if (p.cash > 500) v -= Math.min(0.15, (p.cash - 500) / 10_000);
    return v;
  },
};

/** Time is only valuable when spent on something; small penalty for burning hours idly. */
export const timeCost: Scorer = {
  id: 'time-cost',
  weight: () => 1,
  value: (_ctx, _state, p) => -0.0001 * (120 - p.hoursLeft),
};

/**
 * Happiness upkeep: where a pack decays happiness (ADR-0025), relaxing alone need not outrun the
 * decay, so comfort durables are what keep the happiness goal reachable. This scores the weekly
 * gain a relax session would net, which is what turns a $400 television from a one-off
 * `happinessOnBuy` into the investment it actually is. Packs without decay score 0.
 */
export const happinessUpkeep: Scorer = {
  id: 'happiness-upkeep',
  weight: (p) => p.weights.happiness,
  value: (ctx, _state, p) => {
    const h = ctx.pack.rules.happiness;
    if (h.decayPerWeek <= 0) return 0;
    let comfort = 0;
    for (const it of p.items)
      if (ctx.pack.itemById[it.itemId]?.comfort && it.condition === 'ok') comfort++;
    const gain = Math.min(h.relaxMax, h.relaxBase + h.relaxPerComfort * comfort);
    const span = Math.max(1, h.relaxMax - h.relaxBase);
    // 0 when a relax session loses ground by a full span, 1 when it gains one: monotone in comfort.
    return Math.min(1, Math.max(0, (gain - h.decayPerWeek + span) / (2 * span)));
  },
};

/** Relaxation reduces doctor visits and burglary; personalities weight it. */
export const relaxation: Scorer = {
  id: 'relaxation',
  weight: (p) => p.preferences.relaxWeight * 0.3,
  value: (_ctx, _state, p) => p.relaxation / 50,
};

/**
 * Wellbeing (GDD 4.5): a modern seat that lets it fall hits burnout and then a collapse, which
 * costs a whole turn. Personalities carry their own floor, and the scorer punishes being under it.
 * Packs without the system score 0, because the slice is not there.
 */
export const wellbeing: Scorer = {
  id: 'wellbeing',
  weight: (_p, d) => (d === 'easy' ? 0.5 : 1),
  value: (ctx, _state, p) => {
    const value = (p.modules.wellbeing as { value?: number } | undefined)?.value;
    if (value === undefined) return 0;
    const floor = ctx.personality.preferences.wellbeingFloor;
    const bands = ctx.pack.rules.wellbeing.bands;
    if (value < bands.collapse) return -1;
    if (value < bands.burnout) return -0.5;
    return Math.min(1, value / Math.max(1, floor)) * 0.5;
  },
};

/** Debt is a drag on every goal: it is negative wealth and a weekly bill you cannot skip. */
export const loanBurden: Scorer = {
  id: 'loan-burden',
  weight: (p) => 0.5 + 0.5 * p.weights.wealth,
  value: (ctx, _state, p) => {
    const slice = p.modules.loans as
      { loans: { balance: number; weeklyPayment: number }[]; garnished?: number } | undefined;
    if (!slice) return 0;
    const owed = slice.loans.reduce((sum, l) => sum + l.balance, 0) + (slice.garnished ?? 0);
    if (owed === 0) return 0;
    const weekly = slice.loans.reduce((sum, l) => sum + l.weeklyPayment, 0);
    const target = Math.max(1, p.goals.wealth * ctx.pack.wealthPointValue);
    return -Math.min(1, owed / target) - Math.min(0.5, weekly / 200);
  },
};

/** Subscriptions are small, weekly and easy to forget; the AI should feel the drain. */
export const subscriptionDrain: Scorer = {
  id: 'subscription-drain',
  weight: (p) => p.weights.wealth * 0.5,
  value: (_ctx, _state, p) => {
    const slice = p.modules.subscriptions as
      { active: Record<string, { price: number }> } | undefined;
    if (!slice) return 0;
    let weekly = 0;
    for (const entry of Object.values(slice.active)) weekly += entry.price;
    // A week's subscriptions measured against a week's rent: 0 when nothing is running.
    return -Math.min(1, weekly / 100);
  },
};

const registry = new Map<string, Scorer>();
export function registerScorer(s: Scorer): void {
  registry.set(s.id, s);
}
export function allScorers(): Scorer[] {
  return [...registry.values()];
}
for (const s of [
  goalWealth,
  goalHappiness,
  goalEducation,
  goalCareer,
  survival,
  winProximity,
  timeCost,
  relaxation,
  happinessUpkeep,
  wellbeing,
  loanBurden,
  subscriptionDrain,
])
  registerScorer(s);

/** Weighted potential of a state for `seat`. */
export function stateValue(ctx: ScorerCtx, state: GameState): number {
  const p = state.players[ctx.seat];
  if (!p) return -Infinity;
  let v = 0;
  for (const s of registry.values()) {
    const w = s.weight(ctx.personality, ctx.difficulty);
    if (w !== 0) v += w * s.value(ctx, state, p);
  }
  return v;
}
