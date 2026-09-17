/**
 * Movement, enter/exit and end turn (GDD 4.2, 4.3; M1.6). Classic = walk only; modern modes are
 * validated through the transport module's unlock hook. Hours are half-hours.
 */
import type { ErrorCode } from '@hustle-ring/shared';
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import { runTriggerEvents } from '../core/events.js';
import { ceilDiv } from '../core/math.js';
import type { BaseCommand, CommandHandler } from '../core/module.js';
import { STREAMS } from '../core/rng.js';
import { isOpen } from './common.js';

export interface MoveCommand extends BaseCommand {
  type: 'Move';
  to: string;
  mode: string;
}
export interface EnterCommand extends BaseCommand {
  type: 'Enter';
}
export interface ExitCommand extends BaseCommand {
  type: 'Exit';
}
export interface EndTurnCommand extends BaseCommand {
  type: 'EndTurn';
}

export interface TripCost {
  steps: number;
  hours: number;
  money: number;
}

/** Hook point for the transport module: returns an error code when the mode is not usable. */
export let modeGate: (ctx: Ctx, mode: string) => ErrorCode | null = (ctx, mode) =>
  mode === 'walk' && ctx.pack.transportById.walk ? null : 'ERR_UNKNOWN_ID';
export let modeMoney: (ctx: Ctx, mode: string, steps: number) => number = () => 0;
export function setModeHooks(gate: typeof modeGate, money: typeof modeMoney): void {
  modeGate = gate;
  modeMoney = money;
}

export function tripCost(ctx: Ctx, from: string, to: string, mode: string): TripCost {
  const b = ctx.pack.board;
  const a = b.nodeOf[from];
  const c = b.nodeOf[to];
  const m = ctx.pack.transportById[mode];
  if (a === undefined || c === undefined || !m) return { steps: 0, hours: 0, money: 0 };
  const steps = b.dist[a]![c]!;
  const hours =
    steps === 0 ? 0 : Math.max(1, ceilDiv(steps * m.stepHalfHoursMilli, 1000)) + m.fixedHalfHours;
  return { steps, hours, money: modeMoney(ctx, mode, steps) };
}

/** Street theft on exit (SEED_DATA 14.5): bank/grocery, steals all cash. */
export function theftChanceBp(ctx: Ctx, seat: number): number {
  const t = ctx.rules.theft;
  const p = ctx.playerAt(seat);
  if (!t.locationIds.includes(p.location)) return 0;
  const above = Math.max(0, p.cash - t.threshold);
  return Math.min(t.capBp, t.baseBp + t.perHundredBp * Math.floor(above / 100));
}

export function doExit(ctx: Ctx): void {
  const p = ctx.player;
  const loc = p.location;
  p.inside = false;
  ctx.emit({ type: 'Exited', seat: ctx.seat, loc });
  const bp = theftChanceBp(ctx, ctx.seat);
  if (
    bp > 0 &&
    p.cash > 0 &&
    ctx.state.config.chaos !== 'off' &&
    ctx.rng.chance(STREAMS.events(ctx.seat), bp)
  ) {
    const stolen = p.cash;
    ctx.addMoney(ctx.seat, 'cash', -stolen, 'theft');
    ctx.addStat(ctx.seat, 'happiness', ctx.rules.happiness.theft, 'theft');
    p.stats.eventsSuffered++;
    ctx.emit({
      type: 'EventFired',
      seat: ctx.seat,
      eventId: 'core:street-theft',
      effects: [`money:cash:-${stolen}`],
    });
  }
  runTriggerEvents(ctx, ctx.seat, `onExit:${loc}`);
}

export const moveHandler: CommandHandler<MoveCommand> = {
  type: 'Move',
  schema: z.object({ type: z.literal('Move'), to: z.string(), mode: z.string() }).strict(),
  cost: (ctx, cmd) => {
    const t = tripCost(ctx, ctx.player.location, cmd.to, cmd.mode);
    return { hours: t.hours, money: t.money };
  },
  validate: (ctx, cmd) => {
    if (!(cmd.to in ctx.pack.board.nodeOf)) return 'ERR_UNKNOWN_ID';
    const gate = modeGate(ctx, cmd.mode);
    if (gate) return gate;
    if (cmd.to === ctx.player.location) return 'ERR_INVALID_AMOUNT';
    if (ctx.player.hoursLeft <= 0) return 'ERR_NOT_ENOUGH_HOURS';
    const t = tripCost(ctx, ctx.player.location, cmd.to, cmd.mode);
    if (t.money > 0 && ctx.player.cash < t.money) return 'ERR_NOT_ENOUGH_CASH';
    return null;
  },
  apply: (ctx, cmd) => {
    const p = ctx.player;
    if (p.inside) doExit(ctx);
    const from = p.location;
    const t = tripCost(ctx, from, cmd.to, cmd.mode);
    const mode = ctx.pack.transportById[cmd.mode]!;
    let dest = cmd.to;
    let hours = t.hours;
    if (t.hours > p.hoursLeft) {
      // Travel as far as time allows along the shortest direction, then the turn ends (GDD 4.2).
      hours = p.hoursLeft;
      const afford = Math.max(
        0,
        Math.floor(((hours - mode.fixedHalfHours) * 1000) / Math.max(1, mode.stepHalfHoursMilli)),
      );
      dest = partialDestination(ctx, from, cmd.to, Math.min(afford, t.steps));
    }
    if (t.money > 0) ctx.addMoney(ctx.seat, 'cash', -t.money, `travel:${cmd.mode}`);
    ctx.spendHours(ctx.seat, hours, `travel:${cmd.mode}`);
    p.location = dest;
    p.inside = false;
    ctx.emit({ type: 'Moved', seat: ctx.seat, from, to: dest, mode: cmd.mode, hours });
  },
  preview: (ctx, cmd) => {
    const t = tripCost(ctx, ctx.player.location, cmd.to, cmd.mode);
    return { hours: -t.hours, money: -t.money, notes: [`steps:${t.steps}`] };
  },
  candidates: (ctx) => {
    const out: MoveCommand[] = [];
    for (const loc of ctx.pack.locations) {
      if (loc.id === ctx.player.location) continue;
      for (const m of ctx.pack.transport) out.push({ type: 'Move', to: loc.id, mode: m.id });
    }
    return out;
  },
  ai: { category: 'move' },
};

/** Ring: walk `steps` squares from `from` toward `to` along the shorter direction; graph: stay put. */
export function partialDestination(ctx: Ctx, from: string, to: string, steps: number): string {
  const b = ctx.pack.board;
  if (b.topology !== 'ring' || steps <= 0) return from;
  const a = b.nodeOf[from]!;
  const c = b.nodeOf[to]!;
  const n = b.ringSize;
  const cw = (c - a + n) % n;
  const dir = cw <= n - cw ? 1 : -1;
  let idx = a;
  let last = from;
  for (let i = 0; i < steps; i++) {
    idx = (idx + dir + n) % n;
    const loc = b.locationAt[idx];
    if (loc !== null && loc !== undefined) last = loc;
  }
  return last;
}

export const enterHandler: CommandHandler<EnterCommand> = {
  type: 'Enter',
  schema: z.object({ type: z.literal('Enter') }).strict(),
  cost: (ctx) => ({ hours: ctx.rules.time.enterHours, money: 0 }),
  validate: (ctx) => {
    const p = ctx.player;
    if (p.inside) return 'ERR_ALREADY_INSIDE';
    if (!isOpen(ctx, p.location)) return 'ERR_LOCATION_CLOSED';
    if (p.hoursLeft < ctx.rules.time.enterHours) return 'ERR_NOT_ENOUGH_HOURS';
    return null;
  },
  apply: (ctx) => {
    const p = ctx.player;
    ctx.spendHours(ctx.seat, ctx.rules.time.enterHours, 'enter');
    p.inside = true;
    ctx.emit({ type: 'Entered', seat: ctx.seat, loc: p.location });
    runTriggerEvents(ctx, ctx.seat, `onEnter:${p.location}`);
  },
  candidates: () => [{ type: 'Enter' }],
  ai: { category: 'move' },
};

export const exitHandler: CommandHandler<ExitCommand> = {
  type: 'Exit',
  schema: z.object({ type: z.literal('Exit') }).strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: (ctx) => (ctx.player.inside ? null : 'ERR_NOT_INSIDE'),
  apply: (ctx) => {
    doExit(ctx);
  },
  preview: (ctx) => {
    const bp = theftChanceBp(ctx, ctx.seat);
    return bp > 0 ? { riskBp: bp, riskKey: 'risk.theft' } : {};
  },
  candidates: () => [{ type: 'Exit' }],
  zeroTime: true,
  ai: { category: 'move' },
};

/** EndTurn's apply defers to the scheduler via a hook installed by the engine (avoids an import cycle). */
export let endTurnImpl: (ctx: Ctx) => void = () => {
  throw new Error('endTurn not wired');
};
export function setEndTurnImpl(fn: (ctx: Ctx) => void): void {
  endTurnImpl = fn;
}

export const endTurnHandler: CommandHandler<EndTurnCommand> = {
  type: 'EndTurn',
  schema: z.object({ type: z.literal('EndTurn') }).strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: () => null,
  apply: (ctx) => {
    const p = ctx.player;
    if (p.hoursLeft > 0) ctx.spendHours(ctx.seat, p.hoursLeft, 'end-turn');
    endTurnImpl(ctx);
  },
  candidates: () => [{ type: 'EndTurn' }],
  zeroTime: true,
  ai: { category: 'meta' },
};
