/** Recipe: add a subscription (docs/EXTENDING.md). */
import { describe, expect, it } from 'vitest';
import { overlayManifest, play, resolveExample, soloGame } from '../lib/overlay.js';
import i18n from './i18n.json';
import subscriptions from './subscriptions.json';

const pack = resolveExample('example-subscription', {
  'pack.json': overlayManifest('example-subscription', 'modern-western'),
  'subscriptions.json': subscriptions,
  'i18n/en.json': i18n,
});

describe('recipe: add a subscription', () => {
  it('is sold at its desk and billed weekly', () => {
    expect(pack.subscriptionById['meal-kit']).toMatchObject({ weeklyPrice: 20 });
    let s = soloGame(pack, 'meal-kit');
    s = { ...s, players: s.players.map((p) => ({ ...p, cash: 500 })) };
    s = play(s, pack, [
      { type: 'Move', to: 'electronics-store', mode: 'walk' },
      { type: 'Enter' },
      { type: 'Subscribe', subId: 'meal-kit' },
    ]);
    const slice = s.players[0]!.modules.subscriptions as { active: Record<string, unknown> };
    expect(Object.keys(slice.active)).toContain('meal-kit');
  });
});
