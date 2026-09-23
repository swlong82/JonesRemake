/**
 * Local leaderboard storage (M8.1): one IndexedDB database of its own, so the saves database keeps
 * its schema version. Entries are appended with an auto-increment key and read back in full; a local
 * board holds one device's games, so there is nothing to page on the storage side.
 */
import type { ScoreEntry } from '../types.js';
import type { EntryStore } from './index.js';

const STORE = 'entries';

export class IndexedDbEntryStore implements EntryStore {
  constructor(
    private readonly factory: () => IDBFactory | undefined,
    private readonly name = 'leaderboard',
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
          request.result.createObjectStore(STORE, { autoIncrement: true });
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

  async load(): Promise<ScoreEntry[]> {
    return (await this.run('readonly', (s) => s.getAll())) as ScoreEntry[];
  }

  async append(entry: ScoreEntry): Promise<void> {
    await this.run('readwrite', (s) => s.add(entry));
  }
}
