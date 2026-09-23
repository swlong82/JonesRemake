/**
 * Headless game runner (BALANCE_SPEC 9.1): AI or bot for every seat, stop at winner or stall
 * week, collect the per-game metrics row (9.2).
 */
import { loadPack, type CityPack } from '@hustle-ring/content';
import {
  computeGoals,
  createGame,
  defaultDebtOf,
  type GameConfig,
  type GameState,
  type SeatConfig,
} from '@hustle-ring/engine';
import { runAiTurn, type PlanOptions } from '@hustle-ring/ai';
import type { GoalId, PaletteId, TokenShape } from '@hustle-ring/shared';
import { botPlanOptions, getBot } from './bots.js';
import type { GameSpec, SeatSpec } from './spec.js';

export interface SeatResult {
  seat: number;
  spec: SeatSpec;
  goals: [number, number, number, number];
  targets: [number, number, number, number];
  cash: number;
  bank: number;
  netWorth: number;
  degrees: number;
  jobId: string | null;
  jobTier: number;
  evicted: boolean;
  weeksInDebt: number;
  /** Bankrupt by BALANCE 9.2's definition: evicted, or four weeks carrying rent debt. */
  bankrupt: boolean;
  /** True once the seat has ever defaulted on a loan (modern packs only). */
  defaulted: boolean;
  collapses: number;
  eventsSuffered: number;
}

export interface GameResult {
  runId: string;
  seed: string;
  weeks: number;
  winner: number | null;
  stalled: boolean;
  /** Goal the winner completed last (by first week each goal was met). */
  lastGoal: GoalId | null;
  seats: SeatResult[];
  /** Winner's p50-able wealth trajectory: wealth goal value per week. */
  wealthByWeek: number[];
  /** Event family → count over the whole game (all seats). */
  eventsByFamily: Record<string, number>;
  playerWeeks: number;
  commands: number;
  ms: number;
}

const PALETTE: PaletteId[] = ['p1', 'p2', 'p3', 'p4'];
const SHAPES: TokenShape[] = ['circle', 'square', 'triangle', 'diamond'];

export function seatConfig(spec: SeatSpec, i: number, goals: number): SeatConfig {
  const g = goals > 0 ? goals : 50;
  const base = {
    name: `S${i + 1}`,
    color: PALETTE[i]!,
    shape: SHAPES[i]!,
    goals: { wealth: g, happiness: g, education: g, career: g },
  };
  if (spec.kind === 'ai')
    return {
      ...base,
      controller: 'ai',
      ai: { difficulty: spec.difficulty, personality: spec.personality },
    };
  return {
    ...base,
    controller: 'ai',
    ai: { difficulty: 'normal', personality: getBot(spec.bot).personality },
  };
}

export function planOptionsFor(spec: SeatSpec, pack: CityPack): PlanOptions {
  if (spec.kind === 'ai') return { difficulty: spec.difficulty, personality: spec.personality };
  return botPlanOptions(getBot(spec.bot), pack);
}

function lastGoalCompleted(state: GameState, seat: number): GoalId | null {
  const p = state.players[seat];
  if (!p) return null;
  const ids: GoalId[] = ['wealth', 'happiness', 'education', 'career'];
  const targets = [p.goals.wealth, p.goals.happiness, p.goals.education, p.goals.career];
  // First week from which each goal stayed met until the end.
  const firstMet = ids.map((_, gi) => {
    let week = state.week;
    for (let i = p.history.length - 1; i >= 0; i--) {
      const h = p.history[i]!;
      if (h.goals[gi]! >= targets[gi]!) week = h.week;
      else break;
    }
    return week;
  });
  let best = 0;
  for (let i = 1; i < 4; i++) if (firstMet[i]! > firstMet[best]!) best = i;
  return ids[best]!;
}

export function runGame(spec: GameSpec, packArg?: CityPack): GameResult {
  const pack = packArg ?? loadPack(spec.packId);
  const config: GameConfig = {
    packId: spec.packId,
    seed: spec.seed,
    chaos: spec.chaos,
    classicOpacity: false,
    seats: spec.seats.map((s, i) => seatConfig(s, i, spec.goals)),
  };
  const t0 = performance.now();
  let state = createGame(config, pack);
  if (spec.goals > 0) {
    // Equal goals for every seat (BALANCE 9.3) override the AI's random goals.
    state = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        goals: {
          wealth: spec.goals,
          happiness: spec.goals,
          education: spec.goals,
          career: spec.goals,
        },
      })),
    };
  }
  let commands = 0;
  const eventsByFamily: Record<string, number> = {};
  const evicted = new Set<number>();
  const defaulted = new Set<number>();
  const debtWeeks = new Map<number, number>();
  const wealthByWeek: number[] = [];
  let lastWeekSeen = 0;
  while (state.winner === null && state.week < spec.stallWeek) {
    const seat = state.activeSeat;
    const opts = planOptionsFor(spec.seats[seat]!, pack);
    const before = state;
    const r = runAiTurn(before, seat, pack, opts);
    commands += r.commands.length;
    // Event accounting: the seat's `turn.eventsFired` holds this turn's start events plus the
    // weekend event until its next turn start resets it.
    const pl = r.state.players[seat]!;
    for (const id of pl.turn.eventsFired) {
      const fam = pack.eventById[id]?.family ?? id;
      eventsByFamily[fam] = (eventsByFamily[fam] ?? 0) + 1;
    }
    if (pl.home.debt > 0) debtWeeks.set(seat, (debtWeeks.get(seat) ?? 0) + 1);
    // Default debt is only cleared by repayment, so "has ever defaulted" is a sticky observation
    // of the loans slice rather than an event count (the AI turn result carries no events).
    if (defaultDebtOf(pl) > 0) defaulted.add(seat);
    if (
      before.players[seat]!.home.tier === 'high' &&
      pl.home.tier === 'low' &&
      pl.home.debt === 0 &&
      before.players[seat]!.home.debt > 0
    )
      evicted.add(seat);
    if (r.state.week !== lastWeekSeen) {
      lastWeekSeen = r.state.week;
      const p0 = r.state.players[0]!;
      wealthByWeek.push(computeGoals(p0, r.state, pack, 0).wealth);
    }
    state = r.state;
  }
  const seats: SeatResult[] = state.players.map((p, i) => {
    const g = computeGoals(p, state, pack, 0);
    const job = p.job ? pack.jobById[p.job.jobId] : undefined;
    const weeksInDebt = debtWeeks.get(i) ?? 0;
    return {
      seat: i,
      spec: spec.seats[i]!,
      goals: [g.wealth, g.happiness, g.education, g.career],
      targets: [p.goals.wealth, p.goals.happiness, p.goals.education, p.goals.career],
      cash: p.cash,
      bank: p.bank,
      netWorth: p.cash + p.bank,
      degrees: p.degrees.length,
      jobId: p.job?.jobId ?? null,
      jobTier: job?.tierIndex ?? -1,
      evicted: evicted.has(i),
      weeksInDebt,
      bankrupt: evicted.has(i) || weeksInDebt >= 4,
      defaulted: defaulted.has(i),
      collapses: p.stats.collapses,
      eventsSuffered: p.stats.eventsSuffered,
    };
  });
  return {
    runId: spec.runId,
    seed: spec.seed,
    weeks: state.week,
    winner: state.winner,
    stalled: state.winner === null,
    lastGoal: state.winner === null ? null : lastGoalCompleted(state, state.winner),
    seats,
    wealthByWeek,
    eventsByFamily,
    playerWeeks: state.week * state.players.length,
    commands,
    ms: performance.now() - t0,
  };
}
