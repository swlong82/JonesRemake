import { describe, expect, it } from 'vitest';
import type { SaveRecord } from '../types.js';
import { MemorySaveStore, type SaveStore } from './index.js';

const implementations: [string, () => SaveStore][] = [
  ['MemorySaveStore', () => new MemorySaveStore()],
];

const rec = (id: string): SaveRecord => ({
  id,
  createdAt: '2026-01-01T00:00:00Z',
  week: 3,
  packId: 'classic',
  packVersion: '0.1.0',
  seatsSummary: 'You vs Rival',
  schemaVersion: 1,
  config: {},
  commandLog: [],
  snapshot: {},
});

describe.each(implementations)('SaveStore contract: %s', (_name, make) => {
  it('put / get / list / delete round trip', async () => {
    const s = make();
    expect(await s.list()).toEqual([]);
    await s.put(rec('a'));
    expect(await s.get('a')).toEqual(rec('a'));
    expect(await s.list()).toEqual([
      {
        id: 'a',
        createdAt: '2026-01-01T00:00:00Z',
        week: 3,
        packId: 'classic',
        seatsSummary: 'You vs Rival',
      },
    ]);
    await s.delete('a');
    expect(await s.get('a')).toBeNull();
  });
  it('put overwrites by id', async () => {
    const s = make();
    await s.put(rec('a'));
    await s.put({ ...rec('a'), week: 9 });
    expect((await s.get('a'))?.week).toBe(9);
    expect(await s.list()).toHaveLength(1);
  });
  it('sync() reports not-supported in v1', async () => {
    const s = make();
    expect(await s.sync?.()).toEqual({ status: 'not-supported' });
  });
  it.todo('schema migration: a schemaVersion < current record is migrated on get (M7.2)');
});
