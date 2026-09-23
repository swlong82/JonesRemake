/** Recipe: add an AI personality (docs/EXTENDING.md). */
import { runAiTurn } from '@hustle-ring/ai';
import { createGame } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { overlayManifest, resolveExample } from '../lib/overlay.js';
import i18n from './i18n.json';
import personalities from './personalities.json';

const pack = resolveExample('example-personality', {
  'pack.json': overlayManifest('example-personality', 'modern-western'),
  'personalities.json': personalities,
  'i18n/en.json': i18n,
});

describe('recipe: add an AI personality', () => {
  it('drives an AI seat through legal turns', () => {
    expect(pack.personalityById.minimalist).toBeDefined();
    let s = createGame(
      {
        packId: 'example-personality',
        seed: 'minimalist',
        chaos: 'off',
        classicOpacity: false,
        seats: ['A', 'B'].map((name, i) => ({
          name,
          controller: 'ai' as const,
          color: (['p1', 'p2'] as const)[i]!,
          shape: (['circle', 'square'] as const)[i]!,
          goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
          ai: { difficulty: 'normal' as const, personality: 'minimalist' },
        })),
      },
      pack,
    );
    for (let turn = 0; turn < 6; turn++) {
      const r = runAiTurn(s, s.activeSeat, pack, {
        difficulty: 'normal',
        personality: 'minimalist',
      });
      expect(r.commands.length).toBeGreaterThan(0);
      s = r.state;
    }
    expect(s.week).toBeGreaterThan(1);
  });
});
