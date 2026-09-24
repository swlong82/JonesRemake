/**
 * The device's art-pack library (ART_SPEC 17.6, M9.12): loads stored packs from the platform
 * `ArtPackStore`, re-validates their manifests, installs them into the registry with the active
 * set from Settings, and imports new zips.
 */
import { ArtManifestSchema, catalogFor } from '@hustle-ring/art';
import { loadPack, WORLD } from '@hustle-ring/content';
import type { ArtPackStore, StoredArtPack } from '@hustle-ring/platform';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useServices } from '../../platform/Services';
import { useSettings } from '../../store/settings';
import { installArtSets, type InstalledPack } from './artRegistry';
import { readArtPackZip, type ImportResult } from './importPack';

interface LibraryState {
  packs: InstalledPack[];
  loaded: boolean;
  set: (packs: InstalledPack[]) => void;
}

export const useArtPackLibrary = create<LibraryState>((set) => ({
  packs: [],
  loaded: false,
  set: (packs) => {
    set({ packs, loaded: true });
  },
}));

/** Stored packs whose manifest still parses (a newer app may have tightened the schema). */
export function usablePacks(stored: readonly StoredArtPack[]): InstalledPack[] {
  const out: InstalledPack[] = [];
  for (const p of stored) {
    const parsed = ArtManifestSchema.safeParse(p.manifest);
    if (parsed.success) out.push({ manifest: parsed.data, files: p.files });
  }
  return out;
}

export async function refreshLibrary(store: ArtPackStore): Promise<void> {
  const packs = usablePacks(await store.list());
  useArtPackLibrary.getState().set(packs);
}

/** Validation context: every playable pack's locations and personalities, and its board size. */
export function importContext(): { catalog: ReturnType<typeof catalogFor>; boardSizes: number[] } {
  const packs = WORLD.cities.map((c) => loadPack(c.packId));
  return {
    catalog: catalogFor({
      locationIds: packs.flatMap((p) => p.board.locationAt.filter((l): l is string => l !== null)),
      personalityIds: packs.flatMap((p) => p.personalities.map((x) => x.id)),
    }),
    boardSizes: [...new Set(packs.map((p) => p.board.locationAt.length))],
  };
}

/** Validate a zip and, if it passes, store it and make it the active set. */
export async function importArtPack(
  bytes: Uint8Array,
  store: ArtPackStore,
  now: () => string = () => new Date().toISOString(),
): Promise<ImportResult> {
  const result = readArtPackZip(bytes, importContext());
  if (!result.ok || !result.pack) return result;
  await store.put({ ...result.pack, importedAt: now() });
  await refreshLibrary(store);
  useSettings.getState().update({ artSet: result.pack.id });
  return result;
}

export async function deleteArtPack(id: string, store: ArtPackStore): Promise<void> {
  await store.delete(id);
  await refreshLibrary(store);
  if (useSettings.getState().settings.artSet === id)
    useSettings.getState().update({ artSet: 'default' });
}

/** Load the library once and keep the registry in step with it and the active set. */
export function useArtPacks(): void {
  const { artPacks } = useServices();
  const packs = useArtPackLibrary((s) => s.packs);
  const loaded = useArtPackLibrary((s) => s.loaded);
  const active = useSettings((s) => s.settings.artSet);
  useEffect(() => {
    if (loaded) return;
    refreshLibrary(artPacks).catch(() => {
      // No storage (private mode, blocked IndexedDB): the bundled set is all there is.
      useArtPackLibrary.getState().set([]);
    });
  }, [artPacks, loaded]);
  useEffect(() => {
    if (!loaded) return;
    installArtSets(packs, active);
  }, [packs, loaded, active]);
}
