/** M1.3: GameState, createGame, stateHash. */
import { describe, expect, it } from 'vitest';
import {
  createGame,
  stateHash,
  validateConfig,
  ENGINE_VERSION,
  STATE_SCHEMA_VERSION,
} from '../index.js';
import { GameStateSchema } from './state-schema.js';
import { aiSeat, classic, humanSeat, makeConfig, newGame } from '../testing.js';

const pack = classic();

describe('createGame (GDD 4.1.6)', () => {
  const s = newGame('create');
  const p = s.players[0]!;
  it('starting state per GDD 4.1.6', () => {
    expect(p.cash).toBe(200);
    expect(p.bank).toBe(0);
    expect(p.home.tier).toBe('low');
    expect(p.job).toBeNull();
    expect(p.clothing).toEqual([{ tier: 'casual', weeksLeft: 4 }]);
    expect(p.food).toEqual({ fridgeUnits: 0, unrefrigeratedUnits: 0, mealPending: null });
    expect(p.dependability).toBe(20);
    expect(p.experience).toBe(10);
    expect(p.relaxation).toBe(10);
    expect(p.happiness).toBe(10);
    expect(p.location).toBe('low-housing');
    expect(p.inside).toBe(true);
    expect(s.week).toBe(1);
    expect(s.activeSeat).toBe(0);
    expect(p.hoursLeft).toBe(120);
    expect(p.maxDependability).toBe(20);
    expect(p.maxExperience).toBe(20);
  });
  it('carries versions, pack ids, flags and the first history sample', () => {
    expect(s.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(s.engineVersion).toBe(ENGINE_VERSION);
    expect(s.packId).toBe('classic');
    expect(s.packVersion).toBe(pack.version);
    expect(s.flags.transport).toBe(false);
    expect(p.history).toEqual([{ week: 1, goals: [2, 10, 1, 0] }]);
    expect(s.econ.index).toBe(1000);
    expect(Object.keys(s.market.prices).sort()).toEqual([
      'blue-chip',
      'commodities',
      'gold',
      'penny-stocks',
      'silver',
      't-bills',
    ]);
  });
  it('AI goals are random within the difficulty range, step 10, independent of config goals', () => {
    for (const [difficulty, lo, hi] of [
      ['easy', 20, 60],
      ['normal', 30, 80],
      ['hard', 50, 100],
    ] as const) {
      for (let i = 0; i < 20; i++) {
        const g = newGame(`ai-${difficulty}-${i}`, [humanSeat(), aiSeat('R', difficulty)])
          .players[1]!.goals;
        for (const v of Object.values(g)) {
          expect(v).toBeGreaterThanOrEqual(lo);
          expect(v).toBeLessThanOrEqual(hi);
          expect(v % 10).toBe(0);
        }
      }
    }
    const a = newGame('same', [humanSeat(), aiSeat()]).players[1]!.goals;
    const b = newGame('same', [humanSeat(), aiSeat()]).players[1]!.goals;
    expect(a).toEqual(b);
  });
  it('validates config', () => {
    expect(() => validateConfig(makeConfig('x', [], {}), pack)).toThrow(/seats/);
    expect(() =>
      validateConfig(
        makeConfig('x', [humanSeat(), humanSeat(), humanSeat(), humanSeat(), humanSeat()]),
        pack,
      ),
    ).toThrow(/seats/);
    expect(() => validateConfig(makeConfig('', [humanSeat()]), pack)).toThrow(/seed/);
    expect(() => validateConfig(makeConfig('x', [humanSeat()], { packId: 'other' }), pack)).toThrow(
      /packId/,
    );
    expect(() =>
      validateConfig(makeConfig('x', [{ ...humanSeat(), controller: 'ai' }]), pack),
    ).toThrow(/ai config/);
    expect(() => validateConfig(makeConfig('x', [humanSeat('')]), pack)).toThrow(/name/);
    expect(() => validateConfig(makeConfig('x', [humanSeat('a', 55)]), pack)).toThrow(
      /goal wealth=55/,
    );
    expect(() => validateConfig(makeConfig('x', [humanSeat('a', 110)]), pack)).toThrow(/goal/);
    expect(() => createGame(makeConfig('x', [humanSeat('ok', 10)]), pack)).not.toThrow();
  });
  it('config is copied, not aliased', () => {
    const cfg = makeConfig('alias');
    const g = createGame(cfg, pack);
    cfg.seats[0]!.name = 'changed';
    expect(g.config.seats[0]!.name).toBe('You');
  });
  it('conforms to the GameState Zod schema', () => {
    expect(GameStateSchema.safeParse(s).success).toBe(true);
  });
});

describe('stateHash (M1.3 AC)', () => {
  const s = newGame('hash');
  it('is stable across key order and JSON round trip', () => {
    const reordered = JSON.parse(
      JSON.stringify(Object.fromEntries(Object.entries(s).reverse())),
    ) as typeof s;
    expect(stateHash(reordered)).toBe(stateHash(s));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(stateHash(JSON.parse(JSON.stringify(s)) as typeof s)).toBe(stateHash(s));
  });
  it('is deterministic for the same seed and differs for another seed', () => {
    expect(stateHash(newGame('hash'))).toBe(stateHash(s));
    expect(stateHash(newGame('hash2'))).not.toBe(stateHash(s));
    expect(stateHash(s)).toMatch(/^[0-9a-f]{14}$/);
  });
  it('state is structurally cloneable', () => {
    expect(structuredClone(s)).toEqual(s);
  });
});
