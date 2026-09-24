/**
 * M1.7 property test (random legal command sequences never corrupt state) and
 * M1.10 replay determinism (200 seeds × random legal logs replay to identical hash).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createGame,
  legalCommands,
  stateHash,
  type Command,
  type GameState,
} from '../index.js';
import { Rng } from './rng.js';
import { GameStateSchema } from './state-schema.js';
import { aiSeat, classic, humanSeat, makeConfig } from '../testing.js';

const pack = classic();

/** Play `steps` random legal commands (uniform over legalCommands) using an external RNG. */
export function randomPlay(
  seed: string,
  steps: number,
  seats = 2,
): { state: GameState; log: { seat: number; cmd: Command }[] } {
  const cfg = makeConfig(seed, seats === 1 ? [humanSeat()] : [humanSeat(), aiSeat()]);
  let state = createGame(cfg, pack);
  const pick = new Rng({}, `driver:${seed}`);
  const log: { seat: number; cmd: Command }[] = [];
  for (let i = 0; i < steps && state.winner === null; i++) {
    const seat = state.activeSeat;
    const legal = legalCommands(state, seat, pack);
    expect(legal.length).toBeGreaterThan(0);
    // Bias against EndTurn so turns have content, but keep it possible.
    const nonEnd = legal.filter((c) => c.type !== 'EndTurn');
    const cmd =
      nonEnd.length > 0 && pick.int('c', 10) > 0
        ? nonEnd[pick.int('c', nonEnd.length)]!
        : legal[pick.int('c', legal.length)]!;
    const r = applyCommand(state, seat, cmd, pack);
    const rejected = r.events.find((e) => e.type === 'CommandRejected');
    expect(
      rejected,
      `legal command ${cmd.type} was rejected: ${JSON.stringify(cmd)}`,
    ).toBeUndefined();
    log.push({ seat, cmd });
    state = r.state;
  }
  return { state, log };
}

export function replay(seed: string, log: { seat: number; cmd: Command }[], seats = 2): GameState {
  const cfg = makeConfig(seed, seats === 1 ? [humanSeat()] : [humanSeat(), aiSeat()]);
  let state = createGame(cfg, pack);
  for (const { seat, cmd } of log) state = applyCommand(state, seat, cmd, pack).state;
  return state;
}

function assertSane(state: GameState): void {
  const parsed = GameStateSchema.safeParse(state);
  expect(
    parsed.success,
    JSON.stringify(parsed.success ? null : parsed.error.issues.slice(0, 3)),
  ).toBe(true);
  for (const p of state.players) {
    expect(p.hoursLeft).toBeGreaterThanOrEqual(0);
    expect(p.hoursLeft).toBeLessThanOrEqual(120);
    expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(p.bank).toBeGreaterThanOrEqual(0);
    for (const v of [
      p.happiness,
      p.dependability,
      p.experience,
      p.relaxation,
      p.cash,
      p.bank,
      p.home.debt,
    ])
      expect(Number.isFinite(v)).toBe(true);
  }
}

describe('M1.7 property: random legal command sequences keep the state valid', () => {
  it('never negative hours, NaN, or schema violations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 20, max: 120 }),
        (seedN, steps) => {
          const { state } = randomPlay(`prop-${seedN}`, steps);
          assertSane(state);
        },
      ),
      { numRuns: 40 },
    );
  });
  it('KI-012 regression: a chance-denied rent extension is not a rejection', () => {
    // fast-check counterexample [8290, 111]: a legal RequestExtension denied by the roll.
    const { state } = randomPlay('prop-8290', 111);
    assertSane(state);
  });
  it('the input state is never mutated by applyCommand', () => {
    const { state } = randomPlay('immut', 30);
    const before = stateHash(state);
    const json = JSON.stringify(state);
    for (const cmd of legalCommands(state, state.activeSeat, pack))
      applyCommand(state, state.activeSeat, cmd, pack);
    expect(stateHash(state)).toBe(before);
    expect(JSON.stringify(state)).toBe(json);
  });
});

describe('M1.10 replay determinism', () => {
  // 20 s timeout, not 5: the seed count is the M1.10 acceptance criterion, so under
  // concurrent load (a sim run on the same box, KI-004) the budget gives way, not the count.
  it('200 random seeds × random legal logs replay to identical hashes', () => {
    for (let i = 0; i < 200; i++) {
      const seed = `replay-${i}`;
      const { state, log } = randomPlay(seed, 40 + (i % 60));
      const again = replay(seed, log);
      expect(stateHash(again)).toBe(stateHash(state));
      expect(again.log.length).toBe(log.length);
    }
  }, 20_000);
  it('a different seed with the same log diverges (RNG is seed-driven)', () => {
    const { state, log } = randomPlay('div', 60);
    let other = createGame(makeConfig('div-2', [humanSeat(), aiSeat()]), pack);
    for (const { seat, cmd } of log) other = applyCommand(other, seat, cmd, pack).state;
    expect(stateHash(other)).not.toBe(stateHash(state));
  });
  it('a long single-seat game reaches many weeks without stalling the state machine', () => {
    const { state } = randomPlay('long', 600, 1);
    expect(state.week).toBeGreaterThan(5);
    assertSane(state);
  });
});
