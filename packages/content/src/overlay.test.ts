import type { JsonValue } from '@hustle-ring/shared';
import { describe, expect, it } from 'vitest';
import { deepMerge, mergeArraysById, mergeFile, unwrapArrayFile } from './overlay.js';
import { loadPack, lookupRawPack } from './packs.js';
import { resolvePack } from './resolve.js';

describe('overlay merge (EXTENSIBILITY 12.3)', () => {
  it('deep-merges objects, child wins on scalars', () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, d: 1 }, { a: { c: 3 }, e: 5 })).toEqual({
      a: { b: 1, c: 3 },
      d: 1,
      e: 5,
    });
  });
  it('merges arrays of {id} by id, appends unknown ids, removes with _remove', () => {
    const base: JsonValue[] = [
      { id: 'a', v: 1, nested: { x: 1 } },
      { id: 'b', v: 2 },
    ];
    const overlay: JsonValue[] = [
      { id: 'a', nested: { y: 2 } },
      { id: 'b', _remove: true },
      { id: 'c', v: 3 },
    ];
    expect(mergeArraysById(base, overlay)).toEqual([
      { id: 'a', v: 1, nested: { x: 1, y: 2 } },
      { id: 'c', v: 3 },
    ]);
  });
  it('arrays without ids are replaced wholesale', () => {
    expect(deepMerge({ list: [1, 2] }, { list: [3] })).toEqual({ list: [3] });
  });
  it('_replace: true replaces the whole array file', () => {
    const base: JsonValue = [{ id: 'a' }, { id: 'b' }];
    const overlay: JsonValue = { _replace: true, entries: [{ id: 'z' }] };
    expect(mergeFile(base, overlay, 'array')).toEqual([{ id: 'z' }]);
  });
  it('mergeFile with no base returns overlay entries minus removals', () => {
    expect(mergeFile(undefined, [{ id: 'a' }, { id: 'b', _remove: true }], 'array')).toEqual([
      { id: 'a' },
    ]);
    expect(mergeFile(undefined, { k: 1 }, 'object')).toEqual({ k: 1 });
    expect(mergeFile({ k: 1 }, undefined, 'object')).toEqual({ k: 1 });
    expect(mergeFile({ k: 1 }, { j: 2 }, 'object')).toEqual({ k: 1, j: 2 });
  });
  it('unwrapArrayFile validates shape', () => {
    expect(unwrapArrayFile(undefined)).toEqual({ entries: [], replace: false });
    expect(unwrapArrayFile([1])).toEqual({ entries: [1], replace: false });
    expect(() => unwrapArrayFile({ nope: true })).toThrow(/array file/);
  });
  it('non-id entries in id arrays are appended', () => {
    expect(mergeArraysById([{ id: 'a' }], ['x'])).toEqual([{ id: 'a' }, 'x']);
  });
  it('overlay replaces a non-object base entry with the same id', () => {
    expect(deepMerge(1, { a: 1 })).toEqual({ a: 1 });
  });
});

describe('key deletion in keyed overlays (ADR-0046)', () => {
  const base = loadPack('modern-western');
  const overlay = (files: Record<string, unknown>) =>
    resolvePack('null-delete', (id) =>
      id === 'null-delete'
        ? {
            'pack.json': {
              id: 'null-delete',
              version: '0.0.1',
              currency: { symbol: '$', code: 'USD' },
              featureFlags: {},
              wealthPointValue: 185,
              extends: 'modern-western',
            },
            ...files,
          }
        : lookupRawPack(id),
    );

  it('a null i18n or registry value removes the inherited key', () => {
    const r = overlay({
      'assets.json': [
        { id: 'gold-modern', _remove: true },
        {
          ...base.assets.find((a) => a.id === 'gold-modern')!,
          id: 'gold-two',
          nameKey: 'asset.gold-two.name',
        },
      ],
      'i18n/en.json': { 'asset.gold-modern.name': null, 'asset.gold-two.name': 'Gold Two' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pack.i18n['asset.gold-modern.name']).toBeUndefined();
    expect(r.pack.i18n['asset.gold-two.name']).toBe('Gold Two');
  });

  it('a base pack may not use null, and an unrelated file still may not', () => {
    const r = resolvePack('bad-base', (id) =>
      id === 'bad-base'
        ? { ...lookupRawPack('classic'), 'i18n/en.json': { 'app.x': null } }
        : lookupRawPack(id),
    );
    expect(r.ok).toBe(false);
  });
});
