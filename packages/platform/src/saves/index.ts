export { IndexedDbSaveStore } from './indexedDb.js';
export { migrateSave, SAVE_SCHEMA_VERSION } from './migrations.js';
import { migrateSave } from './migrations.js';
import type { SaveMeta, SaveRecord, SyncResult } from '../types.js';

export interface SaveStore {
  list(): Promise<SaveMeta[]>;
  get(id: string): Promise<SaveRecord | null>;
  put(rec: SaveRecord): Promise<void>;
  delete(id: string): Promise<void>;
  sync?(): Promise<SyncResult>;
}

/** v1 default at M0: in-memory. M7.2 replaces with `IndexedDbSaveStore` behind the same contract. */
export class MemorySaveStore implements SaveStore {
  private readonly records = new Map<string, SaveRecord>();

  list(): Promise<SaveMeta[]> {
    return Promise.resolve(
      [...this.records.values()].map(({ id, createdAt, week, packId, seatsSummary }) => ({
        id,
        createdAt,
        week,
        packId,
        seatsSummary,
      })),
    );
  }
  get(id: string): Promise<SaveRecord | null> {
    return Promise.resolve(this.records.has(id) ? migrateSave(this.records.get(id)!) : null);
  }
  put(rec: SaveRecord): Promise<void> {
    this.records.set(rec.id, migrateSave(rec));
    return Promise.resolve();
  }
  delete(id: string): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }
  sync(): Promise<SyncResult> {
    return Promise.resolve({ status: 'not-supported' });
  }
}
