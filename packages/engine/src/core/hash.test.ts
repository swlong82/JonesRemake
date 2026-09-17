import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalJson, cyrb53, hashValue } from './hash.js';

describe('canonicalJson + cyrb53', () => {
  it('is stable across key order', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    expect(hashValue({ b: 1, a: 2 })).toBe(hashValue({ a: 2, b: 1 }));
  });
  it('drops undefined values, keeps null', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
    expect(canonicalJson(undefined)).toBe('null');
  });
  it('golden hashes', () => {
    expect(cyrb53('')).toBe('0bdcb81aee8d83');
    expect(cyrb53('hustle')).toBe('0745c188491591');
    expect(hashValue({ week: 1, seat: 0 })).toBe('0fbc58944a6b60');
  });
  it('JSON round-trip preserves the hash (property)', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        const round = JSON.parse(JSON.stringify(v)) as unknown;
        expect(hashValue(round)).toBe(hashValue(v));
      }),
    );
  });
  it('different inputs hash differently (sample)', () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
  });
});
