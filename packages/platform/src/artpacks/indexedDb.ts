/**
 * IndexedDB art-pack store (M9.12): its own database, keyed by pack id, so neither the saves nor
 * the leaderboard schema moves.
 */
import type { ArtPackStore, StoredArtPack } from './index.js';

const STORE = 'packs';

export class IndexedDbArtPackStore implements ArtPackStore {
  constructor(
    private readonly factory: () => IDBFactory | undefined,
    private readonly name = 'art-packs',
  ) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const factory = this.factory();
      if (!factory) {
        reject(new Error('Storage unavailable'));
        return;
      }
      const request = factory.open(this.name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Storage open failed'));
      };
      request.onblocked = () => {
        reject(new Error('Storage blocked'));
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
        };
        resolve(request.result);
      };
    });
  }

  private async run<T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = body(tx.objectStore(STORE));
      // Resolve on commit, never on request success: a quota error can still roll it back.
      tx.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error ?? new Error('Storage transaction aborted'));
      };
    });
  }

  async list(): Promise<StoredArtPack[]> {
    const all = (await this.run('readonly', (s) => s.getAll())) as StoredArtPack[];
    return all.sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<StoredArtPack | null> {
    const hit = (await this.run('readonly', (s) => s.get(id))) as StoredArtPack | undefined;
    return hit ?? null;
  }

  async put(pack: StoredArtPack): Promise<void> {
    await this.run('readwrite', (s) => s.put(pack));
  }

  async delete(id: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(id));
  }
}
