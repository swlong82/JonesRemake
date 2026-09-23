/** Recipe: add a city pack overlay (docs/EXTENDING.md). */
import { loadPack, worldSchema, WORLD } from '@hustle-ring/content';
import { describe, expect, it } from 'vitest';
import { play, resolveExample, soloGame } from '../lib/overlay.js';
import i18n from './i18n.json';
import manifest from './pack.json';
import rules from './rules.json';
import worldEntry from './world-entry.json';

const pack = resolveExample('harbor-town', {
  'pack.json': manifest,
  'rules.json': rules,
  'i18n/en.json': i18n,
});

describe('recipe: add a city pack overlay', () => {
  it('inherits everything it does not override', () => {
    const base = loadPack('modern-western');
    expect(pack.manifest.id).toBe('harbor-town');
    expect(pack.wealthPointValue).toBe(150);
    expect(pack.rules.goals.careerTenureBpPerWeek).toBe(40_000);
    expect(pack.rules.happiness.decayPerWeek).toBe(1);
    // Untouched rules and content come from the parent unchanged.
    expect(pack.rules.goals.educationPerDegree).toBe(base.rules.goals.educationPerDegree);
    expect(pack.locations.map((l) => l.id)).toEqual(base.locations.map((l) => l.id));
    expect(pack.i18n['title.harbor-town']).toBe('Harbor Town');
  });

  it('plays, and its world entry validates alongside the bundled cities', () => {
    const s = play(soloGame(pack, 'harbor'), pack, [{ type: 'EndTurn' }]);
    expect(s.packId).toBe('harbor-town');
    expect(s.week).toBe(2);
    const world = worldSchema.parse({ ...WORLD, cities: [...WORLD.cities, worldEntry] });
    expect(world.cities.map((c) => c.packId)).toContain('harbor-town');
  });
});
