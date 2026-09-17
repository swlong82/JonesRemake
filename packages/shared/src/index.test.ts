import { describe, expect, it } from 'vitest';
import { err, ok, SHARED_VERSION } from './index.js';

describe('shared result helpers', () => {
  it('ok wraps a value', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });
  it('err wraps an error', () => {
    expect(err('E')).toEqual({ ok: false, error: 'E' });
  });
  it('exports a version', () => {
    expect(SHARED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
