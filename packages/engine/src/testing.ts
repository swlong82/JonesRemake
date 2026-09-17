/**
 * Test helpers shared by engine, ai and sim test suites. Not part of the runtime API; pure.
 */
import { loadPack, type CityPack } from '@hustle-ring/content';
import type { Difficulty } from '@hustle-ring/shared';
import type { Command } from './commands/commands.generated.js';
import { applyCommand, createGame, engineFor } from './index.js';
import { cloneState } from './core/apply.js';
import { Ctx } from './core/ctx.js';
import type { GameConfig, GameState, PlayerState, SeatConfig } from './core/state.js';

export const classic = (): CityPack => loadPack('classic');

export function humanSeat(name = 'You', goals = 50): SeatConfig {
  return {
    name,
    controller: 'human-local',
    color: 'p1',
    shape: 'circle',
    goals: { wealth: goals, happiness: goals, education: goals, career: goals },
  };
}

export function aiSeat(
  name = 'Rival',
  difficulty: Difficulty = 'normal',
  personality = 'balanced',
): SeatConfig {
  return {
    name,
    controller: 'ai',
    color: 'p2',
    shape: 'square',
    goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
    ai: { difficulty, personality },
  };
}

export function makeConfig(
  seed: string,
  seats: SeatConfig[] = [humanSeat(), aiSeat()],
  overrides: Partial<GameConfig> = {},
): GameConfig {
  return { packId: 'classic', seats, seed, chaos: 'classic', classicOpacity: false, ...overrides };
}

export function newGame(
  seed = 'test',
  seats?: SeatConfig[],
  overrides?: Partial<GameConfig>,
  pack: CityPack = classic(),
): GameState {
  return createGame(makeConfig(seed, seats, { packId: pack.id, ...overrides }), pack);
}

/** Apply a list of commands for `seat`; throws on the first rejection (tests expect legality). */
export function run(
  state: GameState,
  seat: number,
  cmds: Command[],
  pack: CityPack = classic(),
): GameState {
  let s = state;
  for (const cmd of cmds) {
    const r = applyCommand(s, seat, cmd, pack);
    const rej = r.events.find((e) => e.type === 'CommandRejected');
    if (rej?.type === 'CommandRejected')
      throw new Error(`command ${cmd.type} rejected: ${rej.code}`);
    s = r.state;
  }
  return s;
}

/** Test-only state surgery: returns a modified clone (player at `seat` is deep-cloned). */
export function patch(
  state: GameState,
  seat: number,
  fn: (p: PlayerState, s: GameState) => void,
  pack: CityPack = classic(),
): GameState {
  const next = cloneState(state);
  const ctx = new Ctx(next, pack, seat, true);
  fn(ctx.playerAt(seat), next);
  return next;
}

/** Walk to a location and enter it (walk only). */
export function goInside(
  state: GameState,
  seat: number,
  locationId: string,
  pack: CityPack = classic(),
): GameState {
  const p = state.players[seat]!;
  const cmds: Command[] = [];
  if (p.location !== locationId) cmds.push({ type: 'Move', to: locationId, mode: 'walk' });
  cmds.push({ type: 'Enter' });
  return run(state, seat, cmds, pack);
}

export { engineFor };
