import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, STATE_SCHEMA_VERSION } from './index.js';

describe('engine scaffold', () => {
  it('exports version constants', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(STATE_SCHEMA_VERSION).toBe(1);
  });
});
