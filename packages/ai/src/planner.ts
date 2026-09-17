/**
 * Utility planner (GDD 4.14): beam search of width W and depth D over command sequences within
 * the remaining hours, on a sanitized private state (view.ts). Candidates at each node are
 * pre-ranked with the cheap `previewCommand` heuristic and only the top `branch` are simulated.
 * Score noise (Easy/Normal) comes from an AI-owned RNG stream and never touches game RNG.
 */
import type { CityPack } from '@hustle-ring/content';
import {
  applyCommand,
  computeGoals,
  legalCommands,
  previewCommand,
  Rng,
  type Command,
  type GameState,
} from '@hustle-ring/engine';
import type { Difficulty } from '@hustle-ring/shared';
import { ASSET_TIER, DIFFICULTY, type DifficultyConfig } from './config.js';
import { stateValue, type ScorerCtx } from './scorers.js';
import { aiSeed, sanitizeForAi } from './view.js';

export interface PlanOptions {
  difficulty: Difficulty;
  personality: string;
  /** Strategy bots (BALANCE 9.4): commands for which this returns true are never considered. */
  forbid?: (cmd: Command, state: GameState, seat: number) => boolean;
  /** Debug hook: called once per depth with the ranked candidates and surviving beam. */
  trace?: (
    depth: number,
    info: {
      ranked: { cmd: Command; q: number }[];
      beam: { commands: Command[]; utility: number }[];
    },
  ) => void;
}

export interface Plan {
  commands: Command[];
  utility: number;
  /** Nodes simulated (for benchmarks). */
  expanded: number;
}

/** Utility penalty per command so equal-value filler actions lose to ending the turn. */
const STEP_PENALTY = 0.002;
/** Utility unit is 'one goal fully achieved'; noise σ is expressed in typical-action units (≈ 0.05 goal). */
const NOISE_UNIT = 0.05;

interface Node {
  state: GameState;
  commands: Command[];
  utility: number;
  done: boolean;
}

function scorerCtx(pack: CityPack, seat: number, opts: PlanOptions): ScorerCtx {
  const personality = pack.personalityById[opts.personality] ?? pack.personalities[0];
  if (!personality) throw new Error('pack has no personalities');
  return { pack, seat, personality, difficulty: opts.difficulty };
}

/** Domain pruning: drop commands the AI should never consider at this difficulty/personality. */
export function filterCandidates(
  state: GameState,
  seat: number,
  pack: CityPack,
  cmds: Command[],
  cfg: DifficultyConfig,
  ctx: ScorerCtx,
): Command[] {
  const p = state.players[seat]!;
  const out: Command[] = [];
  for (const c of cmds) {
    switch (c.type) {
      case 'BuyAsset': {
        const tier = ASSET_TIER[c.assetId] ?? 3;
        if (tier > cfg.investTier) continue;
        if (tier > 1 && ctx.personality.riskTolerance < 0.5) continue;
        if (cfg.econAware && tier >= 2 && state.econ.phase === 'recession') continue;
        break;
      }
      case 'ApplyJob': {
        const job = pack.jobById[c.jobId];
        // Only trade up, unless the current job cannot be worked (uniform missing).
        if (p.job && job && job.baseWage * 10 <= p.job.wage * 12) {
          const cur = pack.jobById[p.job.jobId];
          let best = 0;
          for (const cl of p.clothing) best = Math.max(best, pack.uniformRank[cl.tier]);
          const canWork = !cur || best >= pack.uniformRank[cur.uniformTier];
          if (canWork) continue;
        }
        break;
      }
      case 'BuyLottery':
        if (ctx.personality.riskTolerance < 0.7) continue;
        break;
      case 'EatMeal':
        // One meal per turn; extra meals only buy happiness at a poor rate.
        if (p.food.mealPending !== null) continue;
        break;
      case 'BuyItem': {
        const spec = pack.itemById[c.itemId];
        if (spec?.category === 'junk') continue;
        break;
      }
      case 'Move':
        // Never move to a location with nothing to do there (fillers without services).
        if ((pack.locationById[c.to]?.services.length ?? 0) === 0) continue;
        break;
      case 'Exit':
        // Exiting is only useful as part of a Move (implicit) or to end the turn.
        if (p.hoursLeft > 0) continue;
        break;
      case 'SellItem':
        if (p.cash + p.bank > 300) continue;
        break;
      default:
        break;
    }
    out.push(c);
  }
  return out;
}

/** Cheap heuristic for pre-ranking: preview money/hours plus category priors. */
function quickScore(
  state: GameState,
  seat: number,
  pack: CityPack,
  cmd: Command,
  ctx: ScorerCtx,
): number {
  const p = state.players[seat]!;
  const pv = previewCommand(state, seat, cmd, pack);
  if (-pv.hours > p.hoursLeft) return Number.NEGATIVE_INFINITY;
  const g = computeGoals(p, state, pack, 0);
  const gap = (goal: keyof typeof g): number =>
    Math.max(0, 1 - g[goal] / Math.max(1, p.goals[goal]));
  const w = ctx.personality.weights;
  // Career potential the current job can ever reach; below target → the ladder must be climbed.
  const potential = p.job
    ? Math.floor((p.maxDependability * pack.rules.goals.careerDependabilityBp) / 10_000)
    : 0;
  const needLadder = potential < p.goals.career;
  const rentWeeks = pack.rules.housing.rentWeeks;
  // Uniform needs: the current job's tier vs the best outfit and how long it lasts.
  const curJob = p.job ? pack.jobById[p.job.jobId] : undefined;
  let bestTier = 0;
  let outfitWeeks = 0;
  for (const cl of p.clothing) {
    bestTier = Math.max(bestTier, pack.uniformRank[cl.tier]);
    outfitWeeks = Math.max(outfitWeeks, cl.weeksLeft);
  }
  const needClothes =
    curJob !== undefined && (bestTier < pack.uniformRank[curJob.uniformTier] || outfitWeeks <= 1);
  const rentSoon = p.home.paidThroughWeek + rentWeeks <= state.week + 1;
  let s =
    pv.money / 200 + (pv.deltas.happiness ?? 0) * 0.05 + (pv.deltas.dependability ?? 0) * 0.02;
  switch (cmd.type) {
    case 'Work':
      s += 0.6;
      break;
    case 'Study':
      s += 0.5 * w.education + 0.5 + gap('education');
      break;
    case 'ApplyJob': {
      const job = pack.jobById[cmd.jobId];
      s +=
        0.4 +
        (job ? job.baseWage / 40 : 0) -
        (p.job ? Math.max(0, (p.job.wage - (job?.baseWage ?? 0)) / 10) : 0);
      break;
    }
    case 'Enroll':
      s += 0.3 * w.education + 0.5 * gap('education');
      break;
    case 'Move': {
      const loc = pack.locationById[cmd.to];
      const svc = loc?.services ?? [];
      if (p.job && pack.jobById[p.job.jobId]?.workplaceId === cmd.to)
        s += 0.5 + 0.3 * gap('wealth') + 0.3 * gap('career');
      if (svc.includes('apply') && (!p.job || needLadder)) s += 0.5 + 0.3 * gap('career');
      if (svc.includes('study') && gap('education') > 0)
        s += 0.2 * w.education + 0.4 + 0.4 * gap('education');
      if (svc.includes('rent') && (p.home.debt > 0 || rentSoon) && p.cash >= p.home.rentLocked)
        s += 0.6;
      if (needClothes && svc.some((x) => x === 'shop:clothing' || x === 'shop:discount')) s += 0.7;
      if (
        svc.includes('bank') &&
        rentSoon &&
        p.cash < p.home.rentLocked &&
        p.bank >= p.home.rentLocked
      )
        s += 0.5;
      if (loc?.kind === 'home' && gap('happiness') > 0 && !p.turn.relaxed)
        s += 0.3 * gap('happiness');
      if (svc.includes('meals') && p.food.mealPending === null && p.food.fridgeUnits === 0)
        s += 0.3;
      if (svc.includes('grocery') && p.food.fridgeUnits === 0) s += 0.1;
      if (svc.includes('rent') && p.home.paidThroughWeek + 4 <= state.week + 1) s += 0.3;
      if (svc.includes('bank') && p.cash > 400) s += 0.2;
      if (loc?.kind === 'home') s += 0.1;
      s += pv.hours / 60;
      break;
    }
    case 'BuyItem': {
      const cl = pack.clothingById[cmd.itemId];
      if (cl && needClothes && pack.uniformRank[cl.tier] >= pack.uniformRank[curJob.uniformTier])
        s += 0.8;
      break;
    }
    case 'EatMeal':
      s += p.food.mealPending === null && p.food.fridgeUnits === 0 ? 0.4 : -0.2;
      break;
    case 'PayRent':
      s += p.home.debt > 0 ? 0.8 : rentSoon ? 0.6 : 0.15;
      break;
    case 'Deposit':
      s += p.cash > 300 && !rentSoon ? 0.2 : -0.1;
      break;
    case 'Withdraw':
      s += rentSoon && p.cash < p.home.rentLocked ? 0.5 : -0.2;
      break;
    case 'Relax':
      s += 0.1 * ctx.personality.preferences.relaxWeight + 0.5 * gap('happiness');
      break;
    case 'EndTurn':
      s -= p.hoursLeft > 12 ? 0.5 : 0;
      break;
    default:
      break;
  }
  return s;
}

export function planTurn(
  realState: GameState,
  seat: number,
  pack: CityPack,
  opts: PlanOptions,
): Plan {
  const cfg = DIFFICULTY[opts.difficulty];
  const ctx = scorerCtx(pack, seat, opts);
  const noise = new Rng({}, `${aiSeed(realState, seat)}:noise`);
  const root = sanitizeForAi(realState, seat);
  const base = stateValue(ctx, root);
  let beam: Node[] = [{ state: root, commands: [], utility: 0, done: false }];
  let expanded = 0;
  const finished: Node[] = [];
  let lastRanked: { cmd: Command; q: number }[] = [];
  for (let depth = 0; depth < cfg.depth; depth++) {
    const children: Node[] = [];
    for (const node of beam) {
      if (node.done) {
        finished.push(node);
        continue;
      }
      let legal = filterCandidates(
        node.state,
        seat,
        pack,
        legalCommands(node.state, seat, pack),
        cfg,
        ctx,
      );
      if (opts.forbid) {
        const forbid = opts.forbid;
        legal = legal.filter((c) => c.type === 'EndTurn' || !forbid(c, node.state, seat));
      }
      const ranked = legal
        .map((c) => ({ c, q: quickScore(node.state, seat, pack, c, ctx) }))
        .filter((x) => x.q !== Number.NEGATIVE_INFINITY)
        .sort((a, b) => b.q - a.q)
        .slice(0, cfg.branch);
      // EndTurn is always considered so every node can terminate.
      if (!ranked.some((x) => x.c.type === 'EndTurn'))
        ranked.push({ c: { type: 'EndTurn' }, q: 0 });
      if (node === beam[0]) lastRanked = ranked.map((x) => ({ cmd: x.c, q: x.q }));
      for (const { c, q } of ranked) {
        // EndTurn is terminal: the plan is valued as it stands. The next turn start (decay,
        // starvation, rivals) is never simulated, so ending is neutral rather than catastrophic.
        // Terminal nodes go straight to `finished` so they never crowd live plans out of the beam.
        if (c.type === 'EndTurn') {
          finished.push({
            state: node.state,
            commands: [...node.commands, c],
            utility: node.utility,
            done: true,
          });
          continue;
        }
        // Never simulate an action that would run the clock out and auto-end the turn.
        if (q === Number.NEGATIVE_INFINITY) continue;
        let r = applyCommand(node.state, seat, c, pack);
        expanded++;
        if (r.events.some((e) => e.type === 'CommandRejected')) continue;
        if (r.state.activeSeat !== seat || r.state.phase === 'over') continue;
        const cmds = [...node.commands, c];
        // Macro step: a Move is immediately followed by Enter when legal, so depth is spent on
        // decisions rather than on the mandatory door.
        if (c.type === 'Move') {
          const enter: Command = { type: 'Enter' };
          const r2 = applyCommand(r.state, seat, enter, pack);
          expanded++;
          if (!r2.events.some((e) => e.type === 'CommandRejected')) {
            r = r2;
            cmds.push(enter);
          }
        }
        let util = stateValue(ctx, r.state) - base - STEP_PENALTY * cmds.length;
        if (cfg.noiseSigma > 0)
          util += (noise.normal('n', 10_000) / 10_000) * cfg.noiseSigma * NOISE_UNIT;
        children.push({ state: r.state, commands: cmds, utility: util, done: false });
      }
    }
    if (children.length === 0) break;
    children.sort((a, b) => b.utility - a.utility);
    beam = children.slice(0, cfg.width);
    opts.trace?.(depth, {
      ranked: lastRanked,
      beam: beam.map((n) => ({ commands: n.commands, utility: n.utility })),
    });
  }
  const all = [...finished, ...beam].sort((a, b) => b.utility - a.utility);
  const best = all[0];
  if (!best || best.commands.length === 0)
    return { commands: [{ type: 'EndTurn' }], utility: 0, expanded };
  return { commands: best.commands, utility: best.utility, expanded };
}

export interface AiTurnResult {
  state: GameState;
  commands: Command[];
  /** Number of planning passes (1 + re-plans after surprises). */
  plans: number;
}

/** Surprises that invalidate the remaining plan: refusals, firings, random events, rejections. */
const SURPRISES = new Set([
  'Refused',
  'Fired',
  'EventFired',
  'ItemsStolen',
  'ItemBroke',
  'CommandRejected',
]);

/** Execute a full AI turn on the real state: plan, apply, re-plan on surprise, until the turn ends. */
export function runAiTurn(
  state: GameState,
  seat: number,
  pack: CityPack,
  opts: PlanOptions,
  maxCommands = 60,
): AiTurnResult {
  const commands: Command[] = [];
  let plans = 0;
  let queue: Command[] = [];
  let guard = 0;
  while (state.activeSeat === seat && state.winner === null && guard++ < maxCommands) {
    if (queue.length === 0) {
      queue = planTurn(state, seat, pack, opts).commands;
      plans++;
    }
    const cmd = queue.shift()!;
    const r = applyCommand(state, seat, cmd, pack);
    const rejected = r.events.some((e) => e.type === 'CommandRejected');
    if (rejected) {
      // A rejected command means our model diverged; force EndTurn if planning keeps failing.
      if (queue.length === 0 && plans > 3) {
        state = applyCommand(state, seat, { type: 'EndTurn' }, pack).state;
        commands.push({ type: 'EndTurn' });
        break;
      }
      queue = [];
      continue;
    }
    commands.push(cmd);
    state = r.state;
    if (r.events.some((e) => e.type === 'TurnEnded')) return { state, commands, plans };
    if (
      r.events.some((e) => SURPRISES.has(e.type) && e.type !== 'EventFired') ||
      r.events.some(
        (e) =>
          e.type === 'EventFired' && 'seat' in e && e.seat === seat && state.activeSeat === seat,
      )
    ) {
      queue = [];
    }
  }
  if (state.activeSeat === seat && state.winner === null) {
    state = applyCommand(state, seat, { type: 'EndTurn' }, pack).state;
    commands.push({ type: 'EndTurn' });
  }
  return { state, commands, plans };
}
