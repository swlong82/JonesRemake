/** Recipe: add a rule module (docs/EXTENDING.md). */
import { loadPack } from '@hustle-ring/content';
import { createEngine, allModules, type Engine } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { stipendModule } from './stipend.js';

describe('recipe: add a rule module', () => {
  it('runs its hook in order, after every core module', () => {
    const pack = loadPack('classic');
    const engine: Engine = createEngine(pack, [...allModules(), stipendModule(25)]);
    expect(engine.moduleIds.at(-1)).toBe('example-stipend');
    const ids = engine.hooks.onTurnStart.map((h) => h.module);
    expect(ids.at(-1)).toBe('example-stipend');
  });
});

describe('recipe: add a rule module, end to end', () => {
  it('pays the stipend at every turn start', async () => {
    const { registerModules } = await import('@hustle-ring/engine');
    const { play, soloGame } = await import('../lib/overlay.js');
    // The same seeded turn, first on an engine built before the module is registered…
    const plain = { ...loadPack('classic') };
    const without = play(soloGame(plain, 'stipend'), plain, [{ type: 'EndTurn' }]);
    // …then on one built after: the only difference is the stipend.
    registerModules(stipendModule(25));
    const extended = { ...loadPack('classic') };
    const withIt = play(soloGame(extended, 'stipend'), extended, [{ type: 'EndTurn' }]);
    // Two turn starts: the one creating the game and the one after EndTurn.
    expect(withIt.players[0]!.cash).toBe(without.players[0]!.cash + 2 * 25);
  });
});
