/** Recipe: add a location (docs/EXTENDING.md). */
import { applyCommand, createGame, legalCommands } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { overlayManifest, resolveExample } from '../lib/overlay.js';
import visuals from './assets.registry.json';
import board from './board.json';
import i18n from './i18n.json';
import locations from './locations.json';

const pack = resolveExample('example-location', {
  'pack.json': overlayManifest('example-location', 'modern-western'),
  'locations.json': locations,
  'board.json': board,
  'assets.registry.json': visuals,
  'i18n/en.json': i18n,
});

describe('recipe: add a location', () => {
  it('joins the pack and the ring board', () => {
    expect(pack.locationById['coworking-space']).toMatchObject({ services: ['relax'] });
    expect(pack.board.locationAt).toContain('coworking-space');
    // It took the park's square; the park and its strings are gone.
    expect(pack.board.locationAt).not.toContain('park');
    expect(pack.locationById.park).toBeUndefined();
    expect(pack.i18n['location.park.name']).toBeUndefined();
  });

  it('can be walked to and entered', () => {
    let s = createGame(
      {
        packId: 'example-location',
        seed: 'loc',
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
    expect(legalCommands(s, 0, pack)).toContainEqual(
      expect.objectContaining({ type: 'Move', to: 'coworking-space' }),
    );
    for (const cmd of [
      { type: 'Move', to: 'coworking-space', mode: 'walk' },
      { type: 'Enter' },
    ] as const) {
      const r = applyCommand(s, 0, cmd, pack);
      expect(r.events.find((e) => e.type === 'CommandRejected')).toBeUndefined();
      s = r.state;
    }
    expect(s.players[0]).toMatchObject({ location: 'coworking-space', inside: true });
  });
});
