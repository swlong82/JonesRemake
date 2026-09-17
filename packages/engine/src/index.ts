/**
 * @hustle-ring/engine — pure game rules (ARCHITECTURE 5.3).
 *
 * INVARIANTS (CLAUDE.md 1.3, lint-enforced): no DOM, no Date.now(), no Math.random(), no I/O.
 * All mutation goes through applyCommand(state, seat, cmd, pack) → { state, events }.
 */
import type { CityPack } from '@hustle-ring/content';
import type { ErrorCode } from '@hustle-ring/shared';
import {
  applyCommand as applyWithEngine,
  candidateCommands as candidatesWithEngine,
  legalCommands as legalWithEngine,
  previewCommand as previewWithEngine,
  validate as validateWithEngine,
  endTurn,
  type ApplyResult,
  type Validation,
} from './core/apply.js';
import { createGame as createWithEngine } from './core/create.js';
import { hashValue } from './core/hash.js';
import { createEngine, type ActionPreview, type BaseCommand, type Engine } from './core/module.js';
import type { GameConfig, GameState } from './core/state.js';
import { setEndTurnImpl } from './commands/turn.js';
import { allModules } from './modules/index.js';
import type { Command } from './commands/commands.generated.js';

export { ENGINE_VERSION, STATE_SCHEMA_VERSION } from './core/version.js';
export * from './core/state.js';
export * from './core/rng.js';
export * from './core/math.js';
export * from './core/hash.js';
export * from './core/clone.js';
export * from './core/ctx.js';
export * from './core/module.js';
export * from './core/goals.js';
export * from './core/effects.js';
export * from './core/events.js';
export * from './core/scheduler.js';
export {
  cloneState,
  endTurn,
  validateCommand,
  type ApplyResult,
  type Validation,
} from './core/apply.js';
export {
  createGame as createGameWithEngine,
  randomAiGoals,
  validateConfig,
} from './core/create.js';
export * from './commands/commands.generated.js';
export * from './commands/registry.js';
export * from './commands/common.js';
export * from './commands/turn.js';
export * from './commands/jobs.js';
export * from './commands/education.js';
export * from './commands/home.js';
export * from './commands/food.js';
export * from './commands/items.js';
export * from './commands/bank.js';
export * from './commands/misc.js';
export * from './modules/index.js';
export * from './modules/core-econ.js';
export * from './modules/core-pending.js';
export * from './modules/core-events.js';
export { coreSetup } from './modules/core-setup.js';
export { coreDecay } from './modules/core-decay.js';

const engines = new WeakMap<CityPack, Engine>();

/** Resolve (and cache) the engine for a pack: active modules by flag, sorted by order. */
export function engineFor(pack: CityPack): Engine {
  let e = engines.get(pack);
  if (!e) {
    e = createEngine(pack, allModules());
    engines.set(pack, e);
  }
  return e;
}

// Wire EndTurn to the scheduler without an import cycle between commands and core/apply.
setEndTurnImpl((ctx) => {
  endTurn((ctx.engine as Engine | null) ?? engineFor(ctx.pack), ctx);
});

export function createGame(config: GameConfig, pack: CityPack): GameState {
  return createWithEngine(config, pack, engineFor(pack));
}

export function validate(state: GameState, seat: number, cmd: Command, pack: CityPack): Validation {
  return validateWithEngine(engineFor(pack), state, seat, cmd);
}

export function applyCommand(
  state: GameState,
  seat: number,
  cmd: Command,
  pack: CityPack,
): ApplyResult {
  return applyWithEngine(engineFor(pack), state, seat, cmd);
}

export function candidateCommands(
  state: GameState,
  seat: number,
  pack: CityPack,
): { cmd: Command; code: ErrorCode | null }[] {
  return candidatesWithEngine(engineFor(pack), state, seat) as {
    cmd: Command;
    code: ErrorCode | null;
  }[];
}

export function legalCommands(state: GameState, seat: number, pack: CityPack): Command[] {
  return legalWithEngine(engineFor(pack), state, seat) as Command[];
}

export function previewCommand(
  state: GameState,
  seat: number,
  cmd: Command,
  pack: CityPack,
): ActionPreview {
  return previewWithEngine(engineFor(pack), state, seat, cmd);
}

/** Stable, key-sorted hash of the whole state (ARCHITECTURE 5.3). */
export function stateHash(state: GameState): string {
  return hashValue(state);
}

export type { BaseCommand };
