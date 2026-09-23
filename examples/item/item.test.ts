/** Recipe: add an item (docs/EXTENDING.md). */
import { applyCommand, createGame } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { overlayManifest, resolveExample } from '../lib/overlay.js';
import visuals from './assets.registry.json';
import i18n from './i18n.json';
import items from './items.json';

const pack = resolveExample('example-item', {
  'pack.json': overlayManifest('example-item', 'modern-western'),
  'items.json': items,
  'i18n/en.json': i18n,
  'assets.registry.json': visuals,
});

describe('recipe: add an item', () => {
  it('resolves into the pack alongside every inherited item', () => {
    expect(pack.itemById['standing-desk']).toMatchObject({ price: 350, comfort: true });
    expect(pack.itemById.television).toBeDefined();
  });

  it('is sold where storeIds says, and a purchase lands in the inventory', () => {
    const s = createGame(
      {
        packId: 'example-item',
        seed: 'item',
        chaos: 'off',
        classicOpacity: false,
        seats: [
          {
            name: 'You',
            controller: 'human-local',
            color: 'p1',
            shape: 'circle',
            goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
          },
        ],
      },
      pack,
    );
    let state = { ...s, players: s.players.map((p) => ({ ...p, cash: 1_000 })) };
    for (const cmd of [
      { type: 'Move', to: 'appliance-depot', mode: 'walk' },
      { type: 'Enter' },
      { type: 'BuyItem', itemId: 'standing-desk', qty: 1 },
    ] as const) {
      const r = applyCommand(state, 0, cmd, pack);
      expect(r.events.find((e) => e.type === 'CommandRejected')).toBeUndefined();
      state = r.state;
    }
    expect(state.players[0]!.items.map((i) => i.itemId)).toContain('standing-desk');
  });
});
