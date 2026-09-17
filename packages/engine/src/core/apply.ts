/**
 * applyCommand / validate / legalCommands / previewCommand (ARCHITECTURE 5.3). The state passed in
 * is never mutated: a private clone is taken, handlers mutate it, and the clone is returned.
 * Invalid commands return the original state plus a CommandRejected event.
 */
import type { DomainEvent, ErrorCode } from '@hustle-ring/shared';
import { cloneJson } from './clone.js';
import { Ctx } from './ctx.js';
import type { ActionPreview, BaseCommand, CommandHandler, Engine } from './module.js';
import { createScheduler, SequentialScheduler } from './scheduler.js';
import type { GameState } from './state.js';

export interface ApplyResult {
  state: GameState;
  events: DomainEvent[];
}

export type Validation =
  | { ok: true; preview: ActionPreview }
  | { ok: false; code: ErrorCode; params?: Record<string, unknown> };

function makeCtx(state: GameState, engine: Engine, seat: number, cow = false): Ctx {
  const ctx = new Ctx(state, engine.pack, seat, cow);
  ctx.engine = engine;
  ctx.setListeners(engine.hooks.onDomainEvent.map((h) => h.fn));
  return ctx;
}

/** Shared pre-checks + handler validation; does not consume RNG. */
export function validateCommand(
  engine: Engine,
  state: GameState,
  seat: number,
  cmd: BaseCommand,
): { code: ErrorCode | null; handler?: CommandHandler; parsed?: BaseCommand } {
  const { scheduler } = createScheduler(engine);
  const turn = scheduler.canAct(state, seat);
  if (turn) return { code: turn };
  const handler = engine.handlers.get(cmd.type);
  if (!handler) return { code: 'ERR_UNKNOWN_ID' };
  const parsed = handler.schema.safeParse(cmd);
  if (!parsed.success) return { code: 'ERR_INVALID_AMOUNT', handler };
  const p = state.players[seat];
  if (!p) return { code: 'ERR_NOT_YOUR_TURN' };
  // Zero hours left: only zero-time commands inside a location, or EndTurn.
  if (p.hoursLeft <= 0 && !handler.zeroTime && cmd.type !== 'EndTurn')
    return { code: 'ERR_NOT_ENOUGH_HOURS', handler };
  const ctx = makeCtx(state, engine, seat);
  const code = handler.validate(ctx, parsed.data);
  return { code, handler, parsed: parsed.data };
}

export function previewCommand(
  engine: Engine,
  state: GameState,
  seat: number,
  cmd: BaseCommand,
): ActionPreview {
  const handler = engine.handlers.get(cmd.type);
  const ctx = makeCtx(state, engine, seat);
  const base: ActionPreview = { hours: 0, money: 0, deltas: {}, notes: [] };
  if (!handler) return base;
  const parsed = handler.schema.safeParse(cmd);
  if (!parsed.success) return base;
  const cost = handler.cost(ctx, parsed.data);
  base.hours = -cost.hours || 0;
  base.money = -cost.money || 0;
  const extra = handler.preview?.(ctx, parsed.data);
  if (extra) {
    if (extra.hours !== undefined) base.hours = extra.hours || 0;
    if (extra.money !== undefined) base.money = extra.money || 0;
    if (extra.deltas) Object.assign(base.deltas, extra.deltas);
    if (extra.riskBp !== undefined) base.riskBp = extra.riskBp;
    if (extra.riskKey !== undefined) base.riskKey = extra.riskKey;
    if (extra.notes) base.notes.push(...extra.notes);
  }
  for (const h of engine.hooks.contributePreview) h.fn(ctx, parsed.data, base);
  return base;
}

export function validate(
  engine: Engine,
  state: GameState,
  seat: number,
  cmd: BaseCommand,
): Validation {
  const v = validateCommand(engine, state, seat, cmd);
  if (v.code) return { ok: false, code: v.code };
  return { ok: true, preview: previewCommand(engine, state, seat, cmd) };
}

export function applyCommand(
  engine: Engine,
  state: GameState,
  seat: number,
  cmd: BaseCommand,
): ApplyResult {
  const v = validateCommand(engine, state, seat, cmd);
  if (v.code !== null || !v.handler || !v.parsed) {
    const rejected: DomainEvent = {
      type: 'CommandRejected',
      seat,
      cmdType: cmd.type,
      code: v.code ?? 'ERR_UNKNOWN_ID',
      seq: state.seq,
      week: state.week,
    };
    return { state, events: [rejected] };
  }
  const next = cloneState(state);
  const ctx = makeCtx(next, engine, seat, true);
  const handler = v.handler;
  handler.apply(ctx, v.parsed);
  next.log.push({ seat, seq: next.log.length, cmd: v.parsed });
  // Turn ends when the player is outside with no hours left (GDD 4.2 / ORIGINAL_REFERENCE 3.1).
  const p = ctx.playerAt(seat);
  if (next.phase === 'actions' && p.hoursLeft <= 0 && !p.inside && cmd.type !== 'EndTurn') {
    endTurn(engine, ctx);
  }
  return { state: next, events: ctx.events };
}

/** Advance the game after the active seat finishes. Exposed for the EndTurn handler. */
export function endTurn(engine: Engine, ctx: Ctx): void {
  const { scheduler } = createScheduler(engine);
  if (!(scheduler instanceof SequentialScheduler)) throw new Error('ERR_SCHEDULER_STUB');
  scheduler.onEndTurn(ctx);
}

/**
 * Structural-sharing clone: top-level scalars and small objects are copied; `players` entries are
 * shared until a copy-on-write Ctx first touches them (Ctx.playerAt); the append-only `log` is
 * copied by reference list. Callers never observe mutation of the input state.
 */
export function cloneState(state: GameState): GameState {
  return {
    ...state,
    config: state.config,
    econ: { ...state.econ },
    market: { prices: { ...state.market.prices }, history: cloneJson(state.market.history) },
    players: state.players.slice(),
    pawnShop: cloneJson(state.pawnShop),
    news: { ...state.news },
    rng: cloneJson(state.rng),
    log: state.log.slice(),
    flags: state.flags,
    modules: cloneJson(state.modules),
  };
}

export function legalCommands(engine: Engine, state: GameState, seat: number): BaseCommand[] {
  const out: BaseCommand[] = [];
  const { scheduler } = createScheduler(engine);
  if (scheduler.canAct(state, seat)) return out;
  const ctx = makeCtx(state, engine, seat);
  const p = ctx.playerAt(seat);
  for (const handler of engine.handlers.values()) {
    if (!handler.candidates) continue;
    if (p.hoursLeft <= 0 && !handler.zeroTime && handler.type !== 'EndTurn') continue;
    for (const c of handler.candidates(ctx)) {
      if (handler.validate(ctx, c) === null) out.push(c);
    }
  }
  for (const h of engine.hooks.contributeLegal) h.fn(ctx, out);
  return out;
}
