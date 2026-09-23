/** Recipe: add an investment asset (docs/EXTENDING.md). */
import { describe, expect, it } from 'vitest';
import { overlayManifest, play, resolveExample, soloGame } from '../lib/overlay.js';
import assets from './assets.json';
import i18n from './i18n.json';

const pack = resolveExample('example-asset', {
  'pack.json': overlayManifest('example-asset', 'modern-western'),
  'assets.json': assets,
  'i18n/en.json': i18n,
});

describe('recipe: add an investment asset', () => {
  it('replaces one of the six modern instruments', () => {
    const ids = pack.assets.map((a) => a.id);
    expect(ids).toHaveLength(6);
    expect(ids).not.toContain('gold-modern');
  });

  it('can be bought at the bank and is priced every week', () => {
    expect(pack.assets.map((a) => a.id)).toContain('green-bonds');
    let s = soloGame(pack, 'bonds');
    s = { ...s, players: s.players.map((p) => ({ ...p, cash: 1_000 })) };
    s = play(s, pack, [
      { type: 'Move', to: 'bank', mode: 'walk' },
      { type: 'Enter' },
      { type: 'BuyAsset', assetId: 'green-bonds', amount: 500 },
    ]);
    expect(s.players[0]!.investments['green-bonds']?.units).toBeGreaterThan(0);
    expect(s.market.prices['green-bonds']).toBeGreaterThan(0);
  });
});
