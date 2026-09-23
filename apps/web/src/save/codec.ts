/** Local save boundary: shape/integrity checks precede replay or any storage/game mutation. */
import { loadPack, type CityPack } from '@hustle-ring/content';
import {
  allModules,
  applyCommand,
  createGame,
  engineFor,
  GameConfigSchema,
  GameStateSchema,
  hashValue,
  stateHash,
  STATE_SCHEMA_VERSION,
  ENGINE_VERSION,
  type Command,
  type GameConfig,
  type GameState,
  type LoggedCommand,
} from '@hustle-ring/engine';
import { migrateSave, SAVE_SCHEMA_VERSION, type SaveRecord } from '@hustle-ring/platform';
import type { JsonValue } from '@hustle-ring/shared';
import { z } from 'zod';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_COMMANDS = 50_000;
const int = z.number().int().safe().nonnegative();
const logSchema = z
  .array(
    z
      .object({ seat: int.max(3), seq: int, cmd: z.object({ type: z.string() }).passthrough() })
      .strict(),
  )
  .max(MAX_COMMANDS);
const envelope = z
  .object({
    id: z.string().min(1).max(128),
    schemaVersion: z.number().int(),
    engineVersion: z.string().optional(),
    packId: z.string().min(1),
    packVersion: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    week: int.positive(),
    seatsSummary: z.string().max(256),
    config: GameConfigSchema,
    commandLog: logSchema,
    snapshot: GameStateSchema,
    finalHash: z
      .string()
      .regex(/^[0-9a-f]{14}$/)
      .optional(),
  })
  .strict();
const commands = new Map(
  allModules().flatMap((m) => (m.commands ?? []).map((h) => [h.type, h.schema] as const)),
);

function check(ok: boolean): asserts ok {
  if (!ok) throw new Error('Invalid save');
}

/** Also bounds recursion before Zod/hash traverse an untrusted object. */
function checkJson(value: unknown, depth = 0): void {
  check(depth <= 40);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    check(Number.isSafeInteger(value));
    return;
  }
  check(typeof value === 'object');
  for (const [key, child] of Object.entries(value)) {
    check(!['__proto__', 'constructor', 'prototype'].includes(key));
    checkJson(child, depth + 1);
  }
}
function validateLog(log: LoggedCommand[], seats: number): void {
  let previous = -1;
  for (const entry of log) {
    check(entry.seat < seats && entry.seq > previous);
    const cmd = z.object({ type: z.string() }).passthrough().parse(entry.cmd);
    check(commands.get(cmd.type)?.safeParse(cmd).success === true);
    previous = entry.seq;
  }
}

/** Validate module slices through the existing module contracts, including their owning scope. */
function validateSnapshot(state: GameState, pack: CityPack, initial: GameState): void {
  check(state.schemaVersion === STATE_SCHEMA_VERSION);
  check(
    state.players.length === initial.players.length &&
      state.activeSeat < state.players.length &&
      state.weekOpenedBySeat < state.players.length,
  );
  check(state.winner === null || state.winner < state.players.length);
  check((state.winner === null) === (state.phase === 'actions'));
  check(hashValue(state.flags) === hashValue(pack.flags));
  const slices = engineFor(pack).modules.filter((m) => m.stateSlice);
  function modules(actual: Record<string, unknown>, expected: Record<string, unknown>): void {
    check(hashValue(Object.keys(actual).sort()) === hashValue(Object.keys(expected).sort()));
    for (const [key, value] of Object.entries(actual)) {
      const slice = slices.find((m) => m.id === key)?.stateSlice;
      check(slice?.schema.safeParse(value).success === true);
      // A union schema (gig's game/player slices) must also match the intended scope.
      check(
        hashValue(Object.keys(value as object).sort()) ===
          hashValue(Object.keys(expected[key] as object).sort()),
      );
    }
  }
  modules(state.modules, initial.modules);
  for (const [seat, p] of state.players.entries()) {
    const start = initial.players[seat]!;
    check(p.seat === seat && p.controller !== 'remote' && p.controller === start.controller);
    check(p.name === start.name && p.color === start.color && p.shape === start.shape);
    check(hashValue(p.ai) === hashValue(start.ai));
    check(p.happiness <= pack.rules.happiness.max);
    check(Boolean(pack.locationById[p.location]));
    check(p.job === null || Boolean(pack.jobById[p.job.jobId]));
    check(
      p.degrees.every((id) => Boolean(pack.degreeById[id])) &&
        Object.keys(p.enrolled).every((id) => Boolean(pack.degreeById[id])),
    );
    check(
      p.items.every(
        (item) => Boolean(pack.itemById[item.itemId]) && Boolean(pack.locationById[item.boughtAt]),
      ),
    );
    check(Object.keys(p.investments).every((id) => initial.market.prices[id] !== undefined));
    modules(p.modules, start.modules);
  }
  check(
    hashValue(Object.keys(state.market.prices).sort()) ===
      hashValue(Object.keys(initial.market.prices).sort()),
  );
  check(
    hashValue(Object.keys(state.market.history).sort()) ===
      hashValue(Object.keys(initial.market.history).sort()),
  );
}

export function makeSave(state: GameState, id: string): SaveRecord {
  // JSON clone at capture time: later commands cannot change a queued save.
  const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
  return {
    id,
    schemaVersion: SAVE_SCHEMA_VERSION,
    engineVersion: state.engineVersion,
    packId: state.packId,
    packVersion: state.packVersion,
    createdAt: new Date().toISOString(),
    week: state.week,
    seatsSummary: state.players.map((p) => p.name).join(' / '),
    config: snapshot.config as unknown as JsonValue,
    commandLog: snapshot.log as unknown as JsonValue[],
    finalHash: stateHash(snapshot),
    snapshot: snapshot as unknown as JsonValue,
  };
}

export interface LoadedSave {
  record: SaveRecord;
  state: GameState;
  pack: CityPack;
  warning: boolean;
}
export function decodeSave(raw: unknown): LoadedSave {
  checkJson(raw);
  const parsed = envelope.parse(raw);
  const record = migrateSave(parsed as unknown as SaveRecord);
  const state = parsed.snapshot as GameState;
  check(
    record.engineVersion === state.engineVersion &&
      record.packId === state.packId &&
      record.packVersion === state.packVersion,
  );
  check(record.week === state.week && state.config.packId === state.packId);
  check(
    hashValue(parsed.config) === hashValue(state.config) &&
      hashValue(parsed.commandLog) === hashValue(state.log),
  );
  if (record.finalHash !== undefined) check(record.finalHash === stateHash(state));
  const pack = loadPack(state.packId);
  check(state.config.seats.every((s) => s.controller !== 'remote'));
  const initial = createGame(state.config, pack);
  validateSnapshot(state, pack, initial);
  validateLog(parsed.commandLog, state.players.length);
  let replay = initial;
  let warning = state.engineVersion !== ENGINE_VERSION || state.packVersion !== pack.version;
  try {
    for (const entry of parsed.commandLog) {
      const result = applyCommand(replay, entry.seat, entry.cmd as Command, pack);
      if (result.events.some((e) => e.type === 'CommandRejected')) {
        warning = true;
        break;
      }
      replay = result.state;
    }
    warning ||= stateHash(replay) !== stateHash(state);
  } catch {
    warning = true;
  }
  // An intact, structurally compatible snapshot is authoritative on replay drift (5.7).
  return { record, state, pack, warning };
}

export function parseImport(text: string): LoadedSave {
  check(
    text.length <= MAX_IMPORT_BYTES &&
      new TextEncoder().encode(text).byteLength <= MAX_IMPORT_BYTES,
  );
  const raw: unknown = JSON.parse(text);
  checkJson(raw);
  // The end screen's existing replay-only export has no fallback snapshot.
  if (raw && typeof raw === 'object' && 'log' in raw && !('snapshot' in raw)) {
    const replay = z
      .object({
        engineVersion: z.literal(ENGINE_VERSION),
        schemaVersion: z.literal(STATE_SCHEMA_VERSION),
        packId: z.string(),
        packVersion: z.string(),
        config: GameConfigSchema,
        log: logSchema,
        weeks: int.positive(),
        winner: int.nullable(),
      })
      .strict()
      .parse(raw);
    const pack = loadPack(replay.packId);
    check(replay.packVersion === pack.version && replay.config.packId === replay.packId);
    check(replay.config.seats.every((s) => s.controller !== 'remote'));
    validateLog(replay.log, replay.config.seats.length);
    let state = createGame(replay.config as GameConfig, pack);
    for (const entry of replay.log) {
      const result = applyCommand(state, entry.seat, entry.cmd as Command, pack);
      check(!result.events.some((e) => e.type === 'CommandRejected'));
      state = result.state;
    }
    check(
      state.week === replay.weeks &&
        state.winner === replay.winner &&
        hashValue(state.log) === hashValue(replay.log),
    );
    return decodeSave(makeSave(state, 'import'));
  }
  return decodeSave(raw);
}

export function downloadSave(state: GameState, title: string): void {
  const text = JSON.stringify(makeSave(state, 'export'), null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `save-${title.replace(/[^\p{L}\p{N}-]+/gu, '-')}-week${state.week}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
