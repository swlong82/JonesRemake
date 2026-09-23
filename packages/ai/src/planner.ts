/**
 * Utility planner (GDD 4.14): beam search of width W and depth D over command sequences within
 * the remaining hours, on a sanitized private state (view.ts). Candidates at each node are
 * pre-ranked with the cheap `previewCommand` heuristic and only the top `branch` are simulated.
 * Score noise (Easy/Normal) comes from an AI-owned RNG stream and never touches game RNG.
 */
import type { CityPack } from '@hustle-ring/content';
import {
  applyCommand,
  careerFromDependability,
  computeGoals,
  legalCommands,
  previewCommand,
  Rng,
  type Command,
  type GameState,
  type PlayerState,
} from '@hustle-ring/engine';
import type { Difficulty } from '@hustle-ring/shared';
import { ASSET_TIER, DIFFICULTY, HUNGRY_HOURS, type DifficultyConfig } from './config.js';
import { atTurnStart, isSystemGadget, stateValue, type ScorerCtx } from './scorers.js';
import { aiSeed, sanitizeForAi } from './view.js';

export interface PlanOptions {
  difficulty: Difficulty;
  personality: string;
  /** Strategy bots (BALANCE 9.4): commands for which this returns true are never considered. */
  forbid?: (cmd: Command, state: GameState, seat: number) => boolean;
  /**
   * Strategy bots (BALANCE 9.4, ADR-0044): a per-command preference added to the pre-rank and to
   * the utility of every plan that contains the command (for `Move`, the pre-rank only). A bot that
   * must *do* something (borrow the maximum, buy the ETF) needs this; forbidding the alternatives
   * alone leaves the AI free to decline.
   */
  bias?: (cmd: Command, state: GameState, seat: number) => number;
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
  /** Sum of `PlanOptions.bias` over the plan's commands. */
  bias?: number;
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
      // ---- modern systems (M5.9) ---------------------------------------------------------
      case 'TakeLoan':
        // Borrowing is for seats that cannot cover the principal themselves, and only for
        // personalities with some appetite for it.
        if (ctx.personality.riskTolerance < 0.4) continue;
        if (p.cash + p.bank > c.principal) continue;
        break;
      case 'RepayLoan':
        if (p.cash < c.amount) continue;
        break;
      case 'BuyCar':
        // A car is a slow purchase: only with the price twice over, so the week is not gutted.
        if (p.cash < 2 * Math.abs(previewCommand(state, seat, c, pack).money)) continue;
        break;
      case 'SellCar':
        // Selling the car is a last resort, not a strategy.
        if (p.cash + p.bank > 1_000) continue;
        break;
      case 'GigShift':
        if (previewCommand(state, seat, c, pack).money <= 0) continue;
        break;
      case 'Subscribe':
        if ((pack.subscriptionById[c.subId]?.weeklyPrice ?? 0) * 4 > p.cash) continue;
        break;
      case 'OrderDelivery':
        // Delivery is for when there is no time to go out, not a default.
        if (p.food.mealPending !== null || p.hoursLeft > 12) continue;
        break;
      default:
        break;
    }
    out.push(c);
  }
  return out;
}

/** Cash a seat without the uniform its job needs should hold before shopping for one. */
const UNIFORM_CASH = 500;
/** Hours left above which ending the turn is wasting the week (matches EndTurn's pre-rank). */
const IDLE_HOURS = 12;

/** Commands that move money between cash, bank, debt and holdings rather than spend or earn it. */
const TRANSFERS: ReadonlySet<Command['type']> = new Set<Command['type']>([
  'Deposit',
  'Withdraw',
  'TakeLoan',
  'RepayLoan',
  'BuyAsset',
  'SellAsset',
]);

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
  const g = computeGoals(atTurnStart(p, pack), state, pack, 0);
  const gap = (goal: keyof typeof g): number =>
    Math.max(0, 1 - g[goal] / Math.max(1, p.goals[goal]));
  const w = ctx.personality.weights;
  // Career potential the current job can ever reach; below target → the ladder must be climbed.
  const potential = p.job ? careerFromDependability(p.maxDependability, pack) : 0;
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
  // Rent due or owed is a purchase that cannot wait either (ADR-0043).
  const rentDue = p.home.debt > 0 || rentSoon ? p.home.rentLocked + p.home.debt : 0;
  const shopping = Math.max(shoppingNeed(pack, p, needClothes, gap('happiness') > 0), rentDue);
  // Nothing to eat at the next week's start: starving costs a third of that week's hours and
  // happiness, far more than any meal, so feeding outranks errands (KI-008).
  const unfed =
    p.food.fridgeUnits === 0 && p.food.unrefrigeratedUnits === 0 && p.food.mealPending === null;
  // Any hour of the week will do for the meal, so the trip turns urgent only as the week runs out:
  // made urgent from the first hour, it went ahead of relaxing at home and the seat never relaxed.
  const hungry = unfed && p.hoursLeft <= HUNGRY_HOURS;
  // Balance-sheet moves (banking, loans, investments) change cash without changing what the seat
  // is worth, so their cash delta is not a gain or a cost: counted as one, a loan ranked at +75 and
  // took every branch at the bank, and a deposit ranked at −85 and was never tried (ADR-0043).
  const transfer = TRANSFERS.has(cmd.type);
  let s =
    (transfer ? 0 : pv.money / 200) +
    (pv.deltas.happiness ?? 0) * 0.05 +
    (pv.deltas.dependability ?? 0) * 0.02;
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
      // A raise is worth a trip when wealth is short and the seat qualifies for a job paying 20%
      // more; without this, a seat whose career goal was met stayed on its first wage (ADR-0043).
      else if (svc.includes('apply') && gap('wealth') > 0 && betterPaidJob(pack, p))
        s += 0.3 + 0.4 * gap('wealth');
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
      // Where happiness decays, a shopping trip for a comfort durable is the only lasting fix.
      if (gap('happiness') > 0 && relaxNet(pack, p) < 1 && sellsUnownedComfort(pack, p, cmd.to))
        s += 0.3 * gap('happiness');
      if (wantsGadgetAt(pack, p, cmd.to)) s += 0.3;
      if (svc.includes('meals') && unfed) s += hungry ? 1.1 : 0.4;
      if (svc.includes('grocery') && unfed) s += hungry ? 0.9 : 0.3;
      if (svc.includes('rent') && p.home.paidThroughWeek + 4 <= state.week + 1) s += 0.3;
      if (svc.includes('bank') && shopping > p.cash && p.bank >= shopping - p.cash) s += 0.8;
      if (
        svc.includes('invest') &&
        shopping > p.cash + p.bank &&
        Object.keys(p.investments).length > 0
      )
        s += 0.8;
      // The pull to the bank grows with the cash at risk of street theft (ADR-0043).
      if (svc.includes('bank') && p.cash > 400) s += 0.2 + Math.min(0.6, p.cash / 5_000);
      if (loc?.kind === 'home') s += 0.1;
      s += pv.hours / 60;
      break;
    }
    case 'BuyItem': {
      const cl = pack.clothingById[cmd.itemId];
      // The outfit the job needs is bought at its price, not pruned for it: without it the seat
      // cannot work at all (ADR-0043).
      if (cl && needClothes && pack.uniformRank[cl.tier] >= pack.uniformRank[curJob.uniformTier])
        s += 0.8 - pv.money / 200;
      const spec = pack.itemById[cmd.itemId];
      // A comfort durable raises every future relax; without one, a decaying happiness goal is
      // unreachable, so it outranks the immediate happinessOnBuy the base score already counts.
      if (spec?.comfort && gap('happiness') > 0 && relaxNet(pack, p) < 1)
        s += 0.4 * gap('happiness') + 0.3 - pv.money / 200;
      // A gadget that unlocks a system the pack has switched on is worth more than the happiness
      // it hands over the counter: without it delivery, ride-hail and online study stay closed and
      // whole event families never reach the player (ADR-0034).
      if (spec && spec.unlocks.length > 0 && !p.items.some((it) => it.itemId === spec.id))
        s += 0.35;
      // A system gadget is bought as an asset: the pre-ranker must not prune it on its price
      // before the search can weigh the access it buys (ADR-0039).
      if (spec && isSystemGadget(pack, spec.id) && !p.items.some((it) => it.itemId === spec.id))
        s += 0.6 - pv.money / 200;
      break;
    }
    case 'EatMeal':
      s += unfed && pack.mealById[cmd.mealId]?.countsAsMeal ? 1 : -0.2;
      break;
    case 'BuyFood':
      s += unfed ? 1 : 0;
      break;
    case 'PayRent':
      s += p.home.debt > 0 ? 0.8 : rentSoon ? 0.6 : 0.15;
      break;
    case 'Deposit':
      // Carried cash is theft exposure; the more of it, the sooner it belongs in the bank — except
      // the shopping fund, which is why it was withdrawn.
      s += p.cash > 300 && !rentSoon ? 0.2 + Math.min(0.6, p.cash / 5_000) : -0.1;
      if (shopping > 0 && p.cash - cmd.amount < shopping) s -= 1.5;
      break;
    case 'SellAsset':
      // Holdings are the last pocket: sold only when cash and bank cannot cover a need (ADR-0043).
      if (shopping > p.cash + p.bank) s += 0.9;
      break;
    case 'Withdraw':
      s += rentSoon && p.cash < p.home.rentLocked ? 0.5 : -0.2;
      // Cash for a purchase the seat cannot do without is worth fetching (ADR-0043).
      if (shopping > p.cash && cmd.amount >= shopping - p.cash) s += 0.9;
      break;
    case 'Relax': {
      s += 0.1 * ctx.personality.preferences.relaxWeight + 0.5 * gap('happiness');
      // When happiness is the goal furthest off, the relax session is the move the race turns on;
      // ranked below errands, it was pruned and a goals-100 seat sat at 64 happiness for months.
      const hGap = gap('happiness');
      if (hGap > 0 && hGap >= Math.max(gap('wealth'), gap('education'), gap('career'))) s += 0.6;
      break;
    }
    case 'GigShift':
      // Gig money is money; the planner values it through the preview like any other pay.
      s += 0.5 + 0.2 * gap('wealth');
      break;
    case 'GigSignup':
      s += 0.3 + 0.3 * gap('wealth') - (p.job ? 0.1 : 0);
      break;
    case 'StudyOnline':
      s += 0.5 * w.education + 0.5 + gap('education');
      break;
    case 'BuyTransitPass':
    case 'BuyCar':
      // Faster travel is worth the most when the week is tight.
      s += 0.2 + 0.3 * (1 - p.hoursLeft / Math.max(1, pack.rules.time.weekHours));
      break;
    case 'RepairCar':
      s += 0.4;
      break;
    case 'Repair':
      // A broken phone or laptop shuts its systems until it is fixed (ADR-0039).
      // Ranked near the top so the search always weighs it; `stateValue` makes the decision.
      if (isSystemGadget(pack, cmd.itemId)) s += 1 - pv.money / 200;
      break;
    case 'Subscribe': {
      const sub = pack.subscriptionById[cmd.subId];
      s += sub ? 0.1 + 0.2 * (sub.happinessPerWeek + sub.wellbeingPerWeek) : 0;
      break;
    }
    case 'Unsubscribe':
      // Cancel when money is tight, keep it otherwise.
      s += p.cash < 100 ? 0.4 : -0.3;
      break;
    case 'TakeLoan':
      s += 0.2 * gap('wealth') * ctx.personality.riskTolerance;
      break;
    case 'RepayLoan':
      s += 0.3;
      break;
    case 'OrderDelivery':
      s += unfed ? 0.9 : -0.3;
      break;
    case 'EndTurn':
      s -= p.hoursLeft > IDLE_HOURS ? 0.5 : 0;
      break;
    default:
      break;
  }
  return s;
}

/**
 * Happiness a relax session nets per week after the pack's decay (ADR-0025). Non-positive means
 * relaxing alone cannot close the happiness goal and comfort durables are the only way up.
 */
function relaxNet(pack: CityPack, p: PlayerState): number {
  const h = pack.rules.happiness;
  let comfort = 0;
  for (const it of p.items)
    if (pack.itemById[it.itemId]?.comfort && it.condition === 'ok') comfort++;
  return Math.min(h.relaxMax, h.relaxBase + h.relaxPerComfort * comfort) - h.decayPerWeek;
}

/**
 * True when this location can put a working system gadget in the player's hands: it repairs one
 * they hold broken, or sells one they do not own, and they can pay for it on top of the rent.
 */
function wantsGadgetAt(pack: CityPack, p: PlayerState, locId: string): boolean {
  const spare = p.cash - p.home.rentLocked;
  return pack.items.some((i) => {
    if (!isSystemGadget(pack, i.id) || !i.storeIds.includes(locId)) return false;
    const owned = p.items.filter((it) => it.itemId === i.id);
    if (owned.some((it) => it.condition === 'ok')) return false;
    return owned.length > 0 ? i.repairCost <= spare : i.price <= spare;
  });
}

/**
 * Cash the seat should hold for a purchase it cannot do without (ADR-0043): the uniform its job
 * needs, a comfort durable when relaxing alone cannot outrun the happiness decay, or a system gadget
 * it lacks. 0 when there is none.
 */
function shoppingNeed(
  pack: CityPack,
  p: PlayerState,
  needClothes: boolean,
  unhappy: boolean,
): number {
  let need = needClothes ? UNIFORM_CASH : 0;
  const unowned = (id: string): boolean =>
    !p.items.some((it) => it.itemId === id && it.condition === 'ok');
  if (unhappy && relaxNet(pack, p) < 1) {
    const prices = pack.items.filter((i) => i.comfort && unowned(i.id)).map((i) => i.price);
    if (prices.length > 0) need = Math.max(need, Math.min(...prices));
  }
  const gadgets = pack.items
    .filter((i) => isSystemGadget(pack, i.id) && unowned(i.id))
    .map((i) => i.price);
  if (gadgets.length > 0) need = Math.max(need, Math.min(...gadgets));
  return need;
}

/** True when the seat qualifies for a regular job paying at least 20% more than its own. */
function betterPaidJob(pack: CityPack, p: PlayerState): boolean {
  const wage = p.job?.wage ?? 0;
  return pack.jobs.some(
    (j) =>
      !j.isGig &&
      j.baseWage * 10 > wage * 12 &&
      p.experience >= j.reqExperience &&
      p.dependability >= j.reqDependability &&
      j.reqDegrees.every((d) => p.degrees.includes(d)) &&
      !p.turn.jobsTurnedDown.includes(j.id),
  );
}

/** True when this location sells an affordable comfort durable the player does not own yet. */
function sellsUnownedComfort(pack: CityPack, p: PlayerState, locId: string): boolean {
  // Bank money counts: the ranker fetches it on the way (ADR-0043).
  const spare = p.cash + p.bank - p.home.rentLocked;
  return pack.items.some(
    (i) =>
      i.comfort &&
      i.price <= spare &&
      i.storeIds.includes(locId) &&
      !p.items.some((it) => it.itemId === i.id),
  );
}

/**
 * Keeps only the best-ranked Move to each destination. Transport modes to one square rank within a
 * hair of each other, and three of them took three of four branches: the fourth idea of the turn,
 * relaxing at home or going to eat, was never searched (KI-008).
 */
function firstMovePerDestination(): (x: { c: Command }) => boolean {
  const seen = new Set<string>();
  return ({ c }) => {
    if (c.type !== 'Move') return true;
    if (seen.has(c.to)) return false;
    seen.add(c.to);
    return true;
  };
}

/**
 * Drops a plan's closing EndTurn while the week still has hours in it (KI-008). Every step costs a
 * little utility and the search stops at its depth, so a short plan that ends the turn could
 * outscore one that walks on to work; a seat that took it idled whole weeks, let dependability decay
 * to 0 and never met its career goal. The prefix is played and the turn planned again from there;
 * a fresh plan that is only EndTurn still ends the turn, so this cannot loop.
 */
export function trimEarlyEnd(commands: Command[], hoursLeft: number): Command[] {
  const last = commands[commands.length - 1];
  if (commands.length > 1 && last?.type === 'EndTurn' && hoursLeft > IDLE_HOURS)
    return commands.slice(0, -1);
  return commands;
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
      const all = legalCommands(node.state, seat, pack);
      let legal = filterCandidates(node.state, seat, pack, all, cfg, ctx);
      // A command a strategy bot actively prefers survives the domain pruning that keeps an
      // ordinary seat from, say, borrowing money it does not need (ADR-0044).
      if (opts.bias) {
        const bias = opts.bias;
        const kept = new Set(legal);
        for (const c of all) if (!kept.has(c) && bias(c, node.state, seat) > 0) legal.push(c);
      }
      if (opts.forbid) {
        const forbid = opts.forbid;
        legal = legal.filter((c) => c.type === 'EndTurn' || !forbid(c, node.state, seat));
      }
      const ranked = legal
        .map((c) => ({
          c,
          q: quickScore(node.state, seat, pack, c, ctx) + (opts.bias?.(c, node.state, seat) ?? 0),
        }))
        .filter((x) => x.q !== Number.NEGATIVE_INFINITY)
        .sort((a, b) => b.q - a.q)
        .filter(firstMovePerDestination())
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
        // A Move's bias steers the pre-rank only: counted in utility, a plan could farm it by walking
        // back and forth.
        const bias =
          (node.bias ?? 0) + (c.type === 'Move' ? 0 : (opts.bias?.(c, node.state, seat) ?? 0));
        let util = stateValue(ctx, r.state) - base - STEP_PENALTY * cmds.length + bias;
        if (cfg.noiseSigma > 0)
          util += (noise.normal('n', 10_000) / 10_000) * cfg.noiseSigma * NOISE_UNIT;
        children.push({ state: r.state, commands: cmds, utility: util, done: false, bias });
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
  return {
    commands: trimEarlyEnd(best.commands, best.state.players[seat]!.hoursLeft),
    utility: best.utility,
    expanded,
  };
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
