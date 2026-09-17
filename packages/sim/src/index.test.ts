import { describe, expect, it } from 'vitest';
import { parseGatesFile } from './index.js';

describe('parseGatesFile', () => {
  it('accepts a minimal gates file', () => {
    expect(parseGatesFile({ gamesPerConfig: 500, configs: [] })).toEqual({
      gamesPerConfig: 500,
      configs: [],
    });
  });
  it('rejects non-objects', () => {
    expect(() => parseGatesFile(null)).toThrow(/object/);
  });
  it('rejects bad gamesPerConfig', () => {
    expect(() => parseGatesFile({ gamesPerConfig: 0, configs: [] })).toThrow(/gamesPerConfig/);
  });
  it('rejects non-array configs', () => {
    expect(() => parseGatesFile({ gamesPerConfig: 1, configs: {} })).toThrow(/configs/);
  });
});
