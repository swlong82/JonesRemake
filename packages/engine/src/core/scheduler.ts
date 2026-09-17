/**
 * Turn scheduling and win condition (ARCHITECTURE 5.5, GDD 4.2). `SequentialScheduler` is v1;
 * `SimultaneousScheduler` is the v2 stub that returns ERR_SCHEDULER_STUB (ROADMAP_SCAFFOLDS 16.6).
 */
import type { ErrorCode, GoalId } from '@hustle-ring/shared';
import type { Ctx } from './ctx.js';
import { computeGoals, goalsMet, recomputeMaxima } from './goals.js';
import type { Engine } from './module.js';
import type { GameState, Goals } from './state.js';

export interface GoalProgress {
  goal: GoalId;
  current: number;
  target: number;
  met: boolean;
}

export interface WinCondition {
  evaluate(ctx: Ctx, seat: number): { met: boolean; progress: GoalProgress[]; current: Goals };
}

export function moduleWealth(engine: Engine, ctx: Ctx, seat: number): number {
  let sum = 0;
  for (const h of engine.hooks.contributeWealth) sum += h.fn(ctx, seat);
  return sum;
}

export class AllGoalsRace implements WinCondition {
  constructor(private readonly engine: Engine) {}
  evaluate(ctx: Ctx, seat: number): { met: boolean; progress: GoalProgress[]; current: Goals } {
    const p = ctx.playerAt(seat);
    const current = computeGoals(p, ctx.state, ctx.pack, moduleWealth(this.engine, ctx, seat));
    const met = goalsMet(current, p.goals);
    const progress: GoalProgress[] = (
      ['wealth', 'happiness', 'education', 'career'] as GoalId[]
    ).map((g) => ({
      goal: g,
      current: current[g],
      target: p.goals[g],
      met: met[g],
    }));
    return { met: progress.every((x) => x.met), progress, current };
  }
}

export interface TurnScheduler {
  /** Seats allowed to act right now. */
  current(state: GameState): number[];
  canAct(state: GameState, seat: number): ErrorCode | null;
  /** Advance after the active seat ends its turn; runs weekend + next turn start. */
  onEndTurn(ctx: Ctx): void;
}

export class SequentialScheduler implements TurnScheduler {
  constructor(
    private readonly engine: Engine,
    private readonly win: WinCondition,
  ) {}

  current(state: GameState): number[] {
    return state.winner === null ? [state.activeSeat] : [];
  }

  canAct(state: GameState, seat: number): ErrorCode | null {
    if (state.winner !== null || state.phase === 'over') return 'ERR_GAME_OVER';
    if (seat !== state.activeSeat) return 'ERR_NOT_YOUR_TURN';
    return null;
  }

  onEndTurn(ctx: Ctx): void {
    const state = ctx.state;
    const seat = state.activeSeat;
    ctx.seat = seat;
    for (const h of this.engine.hooks.onTurnEnd) h.fn(ctx);
    ctx.emit({ type: 'TurnEnded', seat });
    const next = (seat + 1) % state.players.length;
    if (next === state.weekOpenedBySeat) {
      state.week += 1;
      ctx.emit({ type: 'WeekAdvanced', week: state.week });
    }
    state.activeSeat = next;
    this.startTurn(ctx, next);
  }

  /** GDD 4.2: TurnStarted → (B econ once per week) → C/D/E via module hooks → F win check. */
  startTurn(ctx: Ctx, seat: number): void {
    const state = ctx.state;
    ctx.seat = seat;
    const p = ctx.playerAt(seat);
    ctx.emit({ type: 'TurnStarted', seat, week: state.week });
    if (seat === state.weekOpenedBySeat && state.week > 1) {
      for (const h of this.engine.hooks.onWeekStart) h.fn(ctx);
    }
    p.turn.lockedActions.push('turn-start');
    for (const h of this.engine.hooks.onTurnStart) h.fn(ctx);
    p.turn.lockedActions = p.turn.lockedActions.filter((a) => a !== 'turn-start');
    recomputeMaxima(p, ctx.pack);
    const result = this.win.evaluate(ctx, seat);
    p.history.push({
      week: state.week,
      goals: [
        result.current.wealth,
        result.current.happiness,
        result.current.education,
        result.current.career,
      ],
    });
    if (result.met) {
      state.winner = seat;
      state.phase = 'over';
      ctx.emit({ type: 'Won', seat, week: state.week });
      return;
    }
    state.phase = 'actions';
  }
}

/** v2 stub (ROADMAP_SCAFFOLDS 16.6): contract tests are `test.todo`; every call refuses. */
export class SimultaneousScheduler implements TurnScheduler {
  current(state: GameState): number[] {
    return state.players.map((p) => p.seat);
  }
  canAct(): ErrorCode | null {
    return 'ERR_SCHEDULER_STUB';
  }
  onEndTurn(): void {
    throw new Error('ERR_SCHEDULER_STUB: SimultaneousScheduler is not implemented in v1');
  }
}

export interface SchedulerPair {
  scheduler: SequentialScheduler | SimultaneousScheduler;
  win: WinCondition;
}

/** Scheduler + win condition chosen by pack rules (EXTENSIBILITY 12.8); cached per engine. */
export function createScheduler(engine: Engine): SchedulerPair {
  const cached = engine.cache.scheduler as SchedulerPair | undefined;
  if (cached) return cached;
  const win = new AllGoalsRace(engine);
  const kind = engine.pack.rules.scheduler;
  const pair: SchedulerPair =
    kind === 'simultaneous'
      ? { scheduler: new SimultaneousScheduler(), win }
      : { scheduler: new SequentialScheduler(engine, win), win };
  engine.cache.scheduler = pair;
  return pair;
}
