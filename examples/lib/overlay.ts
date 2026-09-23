/**
 * Resolve an example overlay pack exactly as a bundled pack is resolved: the example's files, then
 * the chain its `pack.json` `extends`, validated by the same Zod schemas and cross-validators.
 */
import { lookupRawPack, resolvePack, type CityPack, type RawPackFiles } from '@hustle-ring/content';
import { applyCommand, createGame, type Command, type GameState } from '@hustle-ring/engine';
import type { Chaos, JsonValue } from '@hustle-ring/shared';

export function resolveExample(id: string, files: Record<string, unknown>): CityPack {
  const raw = files as RawPackFiles;
  const r = resolvePack(id, (x) => (x === id ? raw : lookupRawPack(x)));
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return r.pack;
}

/** An overlay's `pack.json`: a new id that extends a bundled pack. */
export function overlayManifest(id: string, base: string): JsonValue {
  return {
    id,
    version: '0.0.1',
    currency: { symbol: '$', code: 'USD' },
    featureFlags: {},
    wealthPointValue: 185,
    extends: base,
  };
}

/** A one-human game on `pack`, for the examples' end-to-end checks. */
export function soloGame(pack: CityPack, seed: string, chaos: Chaos = 'off'): GameState {
  return createGame(
    {
      packId: pack.manifest.id,
      seed,
      chaos,
      classicOpacity: false,
      seats: [
        {
          name: 'You',
          controller: 'human-local',
          color: 'p1',
          shape: 'circle',
          goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
        },
      ],
    },
    pack,
  );
}

/** Apply commands in order, failing loudly on the first rejection. */
export function play(state: GameState, pack: CityPack, cmds: readonly unknown[]): GameState {
  let s = state;
  for (const cmd of cmds) {
    const r = applyCommand(s, s.activeSeat, cmd as Command, pack);
    const rejected = r.events.find((e) => e.type === 'CommandRejected');
    if (rejected) throw new Error(`${JSON.stringify(cmd)} rejected: ${JSON.stringify(rejected)}`);
    s = r.state;
  }
  return s;
}
