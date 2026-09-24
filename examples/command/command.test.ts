/** Recipe: add a command (docs/EXTENDING.md). */
import { loadPack } from '@hustle-ring/content';
import { applyCommand, legalCommands, registerModules } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { play, soloGame } from '../lib/overlay.js';
import { volunteerModule } from './volunteer.js';

// Register before the first engine for this pack object is built.
registerModules(volunteerModule);
const pack = { ...loadPack('classic') };

describe('recipe: add a command', () => {
  it('is legal only inside the clinic, and costs hours for happiness', () => {
    const start = soloGame(pack, 'volunteer');
    expect(legalCommands(start, 0, pack).some((c) => c.type === ('Volunteer' as string))).toBe(
      false,
    );
    const inside = play(start, pack, [
      { type: 'Move', to: 'clinic', mode: 'walk' },
      { type: 'Enter' },
    ]);
    expect(legalCommands(inside, 0, pack)).toContainEqual({ type: 'Volunteer' });
    const before = inside.players[0]!;
    const r = applyCommand(inside, 0, { type: 'Volunteer' } as never, pack);
    const after = r.state.players[0]!;
    expect(after.hoursLeft).toBe(before.hoursLeft - 8);
    expect(after.happiness).toBe(before.happiness + 3);
  });
});
