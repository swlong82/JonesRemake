/**
 * Art-pack storage (ART_SPEC 17.6, M9.12): user-imported art sets live on the device only. The
 * store keeps what the import validated — the manifest as JSON and the sanitized SVG texts — and
 * knows nothing about their meaning; validation and rendering belong to `@hustle-ring/art` and the
 * web app.
 */
export { IndexedDbArtPackStore } from './indexedDb.js';

export interface StoredArtPack {
  /** The manifest's `id`; unique per device. `default` is reserved for the bundled set. */
  id: string;
  name: string;
  /** Parsed `manifest.json`, re-validated on load. */
  manifest: unknown;
  /** File name (relative to `files/`) → SVG text. */
  files: Record<string, string>;
  /** ISO timestamp, set by the caller. */
  importedAt: string;
}

export interface ArtPackStore {
  list(): Promise<StoredArtPack[]>;
  get(id: string): Promise<StoredArtPack | null>;
  /** Insert or replace by id. */
  put(pack: StoredArtPack): Promise<void>;
  delete(id: string): Promise<void>;
}

export class MemoryArtPackStore implements ArtPackStore {
  private readonly packs = new Map<string, StoredArtPack>();

  list(): Promise<StoredArtPack[]> {
    return Promise.resolve(
      [...this.packs.values()]
        .map((p) => structuredClone(p))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  }

  get(id: string): Promise<StoredArtPack | null> {
    const hit = this.packs.get(id);
    return Promise.resolve(hit ? structuredClone(hit) : null);
  }

  put(pack: StoredArtPack): Promise<void> {
    this.packs.set(pack.id, structuredClone(pack));
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.packs.delete(id);
    return Promise.resolve();
  }
}
