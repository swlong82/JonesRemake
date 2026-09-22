import type { SaveMeta, SaveRecord, SyncResult } from '../types.js';
import type { SaveStore } from './index.js';
import { migrateSave } from './migrations.js';

/** Browser storage is injected. Failures remain visible; there is no silent in-memory fallback. */
export class IndexedDbSaveStore implements SaveStore {
  constructor(
    private readonly factory: () => IDBFactory | undefined,
    private readonly name = 'game',
  ) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const factory = this.factory();
      if (!factory) {
        reject(new Error('Storage unavailable'));
        return;
      }
      const request = factory.open(this.name, 1);
      let abandoned = false;
      request.onupgradeneeded = () => {
        for (const name of ['autosave', 'slots', 'settings', 'stats']) {
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name, { keyPath: 'id' });
        }
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Storage open failed'));
      };
      request.onblocked = () => {
        abandoned = true;
        reject(new Error('Storage blocked'));
      };
      request.onsuccess = () => {
        if (abandoned) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => {
          request.result.close();
        };
        resolve(request.result);
      };
    });
  }

  /** Resolve on commit, never on request success: a quota error/abort can still roll it back. */
  private async transaction<T>(
    names: string[],
    mode: IDBTransactionMode,
    run: (tx: IDBTransaction, value: (v: T) => void) => void,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      let result: T;
      let tx: IDBTransaction;
      try {
        tx = db.transaction(names, mode);
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('Storage transaction aborted'));
        };
        tx.onerror = () => {
          /* onabort reports the final transaction outcome. */
        };
        run(tx, (v) => {
          result = v;
        });
      } catch (error) {
        db.close();
        reject(error instanceof Error ? error : new Error('Storage failed'));
      }
    });
  }

  async list(): Promise<SaveMeta[]> {
    return this.transaction(['autosave', 'slots'], 'readonly', (tx, value) => {
      const records: SaveMeta[] = [];
      value(records);
      for (const name of ['autosave', 'slots']) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => {
          for (const rec of request.result as SaveRecord[]) {
            const { id, createdAt, week, packId, seatsSummary } = rec;
            records.push({ id, createdAt, week, packId, seatsSummary });
          }
        };
      }
    });
  }
  async get(id: string): Promise<SaveRecord | null> {
    const record = await this.transaction<SaveRecord | null>(
      [this.store(id)],
      'readonly',
      (tx, value) => {
        const request = tx.objectStore(this.store(id)).get(id);
        request.onsuccess = () => {
          value((request.result as SaveRecord | undefined) ?? null);
        };
      },
    );
    return record ? migrateSave(record) : null;
  }
  async put(rec: SaveRecord): Promise<void> {
    const copy = migrateSave(rec);
    await this.transaction<undefined>([this.store(rec.id)], 'readwrite', (tx) => {
      tx.objectStore(this.store(rec.id)).put(copy);
    });
  }
  async delete(id: string): Promise<void> {
    await this.transaction<undefined>([this.store(id)], 'readwrite', (tx) => {
      tx.objectStore(this.store(id)).delete(id);
    });
  }
  sync(): Promise<SyncResult> {
    return Promise.resolve({ status: 'not-supported' });
  }
  private store(id: string): string {
    return id === 'autosave' ? 'autosave' : 'slots';
  }
}
