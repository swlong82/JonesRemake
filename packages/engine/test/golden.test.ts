/**
 * Golden replays (BUILD_READINESS 15.3): `test/golden/<pack>/<seed>.json` holds a random legal
 * command log and the final state hash. Regenerate only via `UPDATE_GOLDEN=1 pnpm vitest run
 * --project engine` and record the reason in DECISIONS.md.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPack, PACK_IDS } from '@hustle-ring/content';
import { applyCommand, createGame, legalCommands, stateHash, type Command } from '../src/index.js';
import { Rng } from '../src/core/rng.js';
import { aiSeat, humanSeat, makeConfig } from '../src/testing.js';

interface Golden {
  seed: string;
  packId: string;
  packVersion: string;
  seats: number;
  log: { seat: number; cmd: Command }[];
  finalHash: string;
  week: number;
}

const SEEDS_PER_PACK = 20;
const STEPS = 150;
const dir = join(import.meta.dirname, 'golden');
const update = process.env.UPDATE_GOLDEN === '1';

function play(packId: string, seed: string): Golden {
  const pack = loadPack(packId);
  const cfg = makeConfig(seed, [humanSeat(), aiSeat()], { packId });
  let state = createGame(cfg, pack);
  const pick = new Rng({}, `golden:${seed}`);
  const log: Golden['log'] = [];
  for (let i = 0; i < STEPS && state.winner === null; i++) {
    const seat = state.activeSeat;
    const legal = legalCommands(state, seat, pack);
    const nonEnd = legal.filter((c) => c.type !== 'EndTurn');
    const cmd =
      nonEnd.length > 0 && pick.int('c', 10) > 0
        ? nonEnd[pick.int('c', nonEnd.length)]!
        : legal[pick.int('c', legal.length)]!;
    state = applyCommand(state, seat, cmd, pack).state;
    log.push({ seat, cmd });
  }
  return {
    seed,
    packId,
    packVersion: pack.version,
    seats: 2,
    log,
    finalHash: stateHash(state),
    week: state.week,
  };
}

function replay(g: Golden): string {
  const pack = loadPack(g.packId);
  let state = createGame(makeConfig(g.seed, [humanSeat(), aiSeat()], { packId: g.packId }), pack);
  for (const { seat, cmd } of g.log) state = applyCommand(state, seat, cmd, pack).state;
  return stateHash(state);
}

/** Packs that play a full game: every bundled pack except the overlay template. */
const playable = PACK_IDS.filter((id) => id !== 'template-city');

describe('golden replays', () => {
  for (const packId of playable) {
    const packDir = join(dir, packId);
    if (update) {
      mkdirSync(packDir, { recursive: true });
      for (let i = 0; i < SEEDS_PER_PACK; i++) {
        const g = play(packId, `golden-${packId}-${i}`);
        writeFileSync(join(packDir, `${g.seed}.json`), `${JSON.stringify(g, null, 2)}\n`);
      }
    }
    it(`${packId}: ${SEEDS_PER_PACK} golden files exist`, () => {
      expect(existsSync(packDir)).toBe(true);
      expect(readdirSync(packDir).filter((f) => f.endsWith('.json'))).toHaveLength(SEEDS_PER_PACK);
    });
    const files = existsSync(packDir)
      ? readdirSync(packDir)
          .filter((f) => f.endsWith('.json'))
          .sort()
      : [];
    it.each(files)(`${packId}: %s replays to its recorded hash`, (file) => {
      const g = JSON.parse(readFileSync(join(packDir, file), 'utf8')) as Golden;
      expect(g.packVersion).toBe(loadPack(packId).version);
      expect(replay(g)).toBe(g.finalHash);
    });
  }
});
