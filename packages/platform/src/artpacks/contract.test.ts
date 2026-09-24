import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  IndexedDbArtPackStore,
  MemoryArtPackStore,
  type ArtPackStore,
  type StoredArtPack,
} from './index.js';

let db = 0;
const implementations: [string, () => ArtPackStore][] = [
  ['MemoryArtPackStore', () => new MemoryArtPackStore()],
  [
    'IndexedDbArtPackStore',
    () => {
      const factory = new IDBFactory();
      return new IndexedDbArtPackStore(() => factory, `art-${db++}`);
    },
  ],
];

const pack = (id: string, name = id): StoredArtPack => ({
  id,
  name,
  manifest: { id, extends: 'default' },
  files: { 'a.svg': '<svg viewBox="0 0 1 1"/>' },
  importedAt: '2026-09-24T00:00:00.000Z',
});

describe.each(implementations)('ArtPackStore contract: %s', (_name, make) => {
  it('starts empty and returns null for unknown ids', async () => {
    const store = make();
    expect(await store.list()).toEqual([]);
    expect(await store.get('nope')).toBeNull();
  });

  it('puts, lists in id order, replaces by id and deletes', async () => {
    const store = make();
    await store.put(pack('zebra'));
    await store.put(pack('alpha'));
    expect((await store.list()).map((p) => p.id)).toEqual(['alpha', 'zebra']);
    await store.put(pack('alpha', 'Alpha 2'));
    expect((await store.get('alpha'))?.name).toBe('Alpha 2');
    expect(await store.list()).toHaveLength(2);
    await store.delete('alpha');
    expect((await store.list()).map((p) => p.id)).toEqual(['zebra']);
    await store.delete('missing');
  });

  it('returns copies, so callers cannot mutate what is stored', async () => {
    const store = make();
    await store.put(pack('one'));
    const got = (await store.get('one'))!;
    got.files['a.svg'] = 'changed';
    expect((await store.get('one'))!.files['a.svg']).toBe('<svg viewBox="0 0 1 1"/>');
  });
});

describe('IndexedDbArtPackStore without storage', () => {
  it('rejects instead of throwing synchronously', async () => {
    await expect(new IndexedDbArtPackStore(() => undefined).list()).rejects.toThrow('unavailable');
  });
});
