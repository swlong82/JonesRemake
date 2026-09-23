/**
 * Bundled packs, imported statically so the web bundle, tests and the CLI share one registry.
 * Adding a pack = add a folder + one entry here (EXTENSIBILITY 12.3).
 */
import type { JsonValue } from '@hustle-ring/shared';
import classicAssetsRegistry from '../packs/classic/assets.registry.json';
import classicAssets from '../packs/classic/assets.json';
import classicBoard from '../packs/classic/board.json';
import classicClothing from '../packs/classic/clothing.json';
import classicDegrees from '../packs/classic/degrees.json';
import classicEvents from '../packs/classic/events.json';
import classicI18n from '../packs/classic/i18n/en.json';
import classicItems from '../packs/classic/items.json';
import classicJobs from '../packs/classic/jobs.json';
import classicLocations from '../packs/classic/locations.json';
import classicMeals from '../packs/classic/meals.json';
import classicManifest from '../packs/classic/pack.json';
import classicPersonalities from '../packs/classic/personalities.json';
import classicRules from '../packs/classic/rules.json';
import classicTransport from '../packs/classic/transport.json';
import modernAssetsRegistry from '../packs/modern-western/assets.registry.json';
import modernAssets from '../packs/modern-western/assets.json';
import modernEvents from '../packs/modern-western/events.json';
import modernI18n from '../packs/modern-western/i18n/en.json';
import modernLoans from '../packs/modern-western/loans.json';
import modernItems from '../packs/modern-western/items.json';
import modernJobs from '../packs/modern-western/jobs.json';
import modernDegrees from '../packs/modern-western/degrees.json';
import modernLocations from '../packs/modern-western/locations.json';
import modernManifest from '../packs/modern-western/pack.json';
import modernRules from '../packs/modern-western/rules.json';
import modernSubs from '../packs/modern-western/subscriptions.json';
import modernTransport from '../packs/modern-western/transport.json';
import templateManifest from '../packs/_template/pack.json';
import world from '../world/world.json';
import { resolvePack, type RawPackFiles, type ResolveResult } from './resolve.js';
import { worldSchema, type WorldSpec } from './schemas/entities.js';
import type { CityPack } from './types.js';

const j = (v: unknown): JsonValue => v as JsonValue;

export const RAW_PACKS: Record<string, RawPackFiles> = {
  classic: {
    'pack.json': j(classicManifest),
    'rules.json': j(classicRules),
    'board.json': j(classicBoard),
    'locations.json': j(classicLocations),
    'jobs.json': j(classicJobs),
    'degrees.json': j(classicDegrees),
    'items.json': j(classicItems),
    'meals.json': j(classicMeals),
    'clothing.json': j(classicClothing),
    'transport.json': j(classicTransport),
    'assets.json': j(classicAssets),
    'events.json': j(classicEvents),
    'personalities.json': j(classicPersonalities),
    'i18n/en.json': j(classicI18n),
    'assets.registry.json': j(classicAssetsRegistry),
  },
  'modern-western': {
    'pack.json': j(modernManifest),
    'rules.json': j(modernRules),
    'locations.json': j(modernLocations),
    'items.json': j(modernItems),
    'jobs.json': j(modernJobs),
    'degrees.json': j(modernDegrees),
    'transport.json': j(modernTransport),
    'subscriptions.json': j(modernSubs),
    'assets.json': j(modernAssets),
    'loans.json': j(modernLoans),
    'events.json': j(modernEvents),
    'i18n/en.json': j(modernI18n),
    'assets.registry.json': j(modernAssetsRegistry),
  },
  'template-city': {
    'pack.json': j(templateManifest),
  },
};

export const PACK_IDS = Object.keys(RAW_PACKS);

export function lookupRawPack(id: string): RawPackFiles | undefined {
  return RAW_PACKS[id];
}

const cache = new Map<string, CityPack>();

export function resolveBundledPack(id: string): ResolveResult {
  return resolvePack(id, lookupRawPack);
}

/** Load a bundled pack by id (cached). Throws with all issues if invalid. */
export function loadPack(id: string): CityPack {
  const hit = cache.get(id);
  if (hit) return hit;
  const r = resolveBundledPack(id);
  if (!r.ok) {
    throw new Error(
      `pack "${id}" invalid:\n${r.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`,
    );
  }
  cache.set(id, r.pack);
  return r.pack;
}

export const WORLD: WorldSpec = worldSchema.parse(world);
