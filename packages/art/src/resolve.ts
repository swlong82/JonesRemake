/**
 * Key resolution across a set chain (ART_SPEC 17.5): user set → its `extends` chain → `default`.
 * An optional override key (e.g. `weekend:<eventId>`) that no set defines falls back to its
 * catalog fallback; anything else unresolved is the caller's cue to show the wireframe.
 */
import { type SlotSpec, slotSpecFor } from './catalog.js';
import type { ArtManifest, ArtTheme, AssetEntry, BoardLayout } from './schema.js';

export interface ResolvedAsset {
  setId: string;
  key: string;
  entry: AssetEntry;
}

/**
 * Order sets for lookup, starting at `id` and following `extends`. Unknown bases and cycles end
 * the chain; `default` is appended if the chain did not reach it.
 */
export function setChain(
  id: string,
  sets: ReadonlyMap<string, ArtManifest>,
  baseId = 'default',
): ArtManifest[] {
  const chain: ArtManifest[] = [];
  const seen = new Set<string>();
  let next: string | undefined = id;
  while (next !== undefined && !seen.has(next)) {
    seen.add(next);
    const set = sets.get(next);
    if (!set) break;
    chain.push(set);
    next = set.extends;
  }
  const base = sets.get(baseId);
  if (base && !seen.has(baseId)) chain.push(base);
  return chain;
}

export function resolveAsset(
  key: string,
  chain: readonly ArtManifest[],
  catalog: readonly SlotSpec[],
): ResolvedAsset | undefined {
  for (const set of chain) {
    const entry = set.assets[key];
    if (entry) return { setId: set.id, key, entry };
  }
  const fallback = slotSpecFor(key, catalog)?.optional?.fallback;
  return fallback === undefined ? undefined : resolveAsset(fallback, chain, catalog);
}

export function boardOf(chain: readonly ArtManifest[]): BoardLayout | undefined {
  return chain.find((s) => s.board)?.board;
}

export function themeOf(chain: readonly ArtManifest[]): ArtTheme | undefined {
  return chain.find((s) => s.theme)?.theme;
}
