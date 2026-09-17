import { describe, expect, it } from 'vitest';
import { AI_DIFFICULTIES, isAiDifficulty } from './index.js';

describe('ai scaffold', () => {
  it('has three difficulty tiers', () => {
    expect(AI_DIFFICULTIES).toHaveLength(3);
  });
  it('guards difficulty strings', () => {
    expect(isAiDifficulty('normal')).toBe(true);
    expect(isAiDifficulty('nightmare')).toBe(false);
  });
});
