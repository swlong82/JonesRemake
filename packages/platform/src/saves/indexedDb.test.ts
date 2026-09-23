import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveRecord } from '../types.js';
import { IndexedDbSaveStore } from './indexedDb.js';

const record = (week = 3): SaveRecord => ({
  id: 'slot-1',
  schemaVersion: 1,
  packId: 'classic',
  packVersion: '0.1.0',
  createdAt: '2026-01-01T00:00:00Z',
  week,
  seatsSummary: 'You',
  config: {},
  commandLog: [],
  snapshot: { engineVersion: '0.1.0' },
});
afterEach(() => vi.restoreAllMocks());
describe('IndexedDbSaveStore', () => {
  it('survives a fresh store instance and migrates v1 to v2 without mutating input', async () => {
    const factory = new IDBFactory();
    const first = new IndexedDbSaveStore(() => factory);
    const input = record();
    await first.put(input);
    const reopened = new IndexedDbSaveStore(() => factory);
    expect(await reopened.get('slot-1')).toEqual({
      ...input,
      schemaVersion: 2,
      engineVersion: '0.1.0',
    });
    expect(input.schemaVersion).toBe(1);
    expect(await reopened.list()).toHaveLength(1);
    await reopened.delete('slot-1');
    expect(await first.get('slot-1')).toBeNull();
    expect(await first.sync()).toEqual({ status: 'not-supported' });
  });
  it('does not report success when a transaction aborts after the request succeeds', async () => {
    const store = new IndexedDbSaveStore(() => newFactory);
    const newFactory = new IDBFactory();
    await store.put(record());
    // The saved method is deliberately invoked with the original receiver below.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args
    ) {
      const request = original.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(store.put(record(9))).rejects.toThrow();
    expect((await store.get('slot-1'))?.week).toBe(3);
  });
  it('rejects unavailable storage and quota failure without replacing an existing save', async () => {
    await expect(new IndexedDbSaveStore(() => undefined).list()).rejects.toThrow();
    await expect(
      new IndexedDbSaveStore(() => {
        throw new Error('denied');
      }).list(),
    ).rejects.toThrow();
    const factory = new IDBFactory();
    const store = new IndexedDbSaveStore(() => factory);
    await store.put(record());
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await expect(store.put(record(9))).rejects.toThrow('QuotaExceededError');
    expect((await store.get('slot-1'))?.week).toBe(3);
  });
});
