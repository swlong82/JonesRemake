import { loadPack } from '@hustle-ring/content';
import { applyCommand, createGame, stateHash, type GameConfig } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { decodeSave, makeSave, parseImport, MAX_IMPORT_BYTES } from './codec';
import { replayJson } from '../ui/screens/EndScreen';

export const config: GameConfig = {
  packId: 'classic',
  seed: 'saves',
  chaos: 'off',
  classicOpacity: false,
  soloPractice: true,
  seats: [
    {
      name: 'You',
      color: 'p1',
      shape: 'circle',
      controller: 'human-local',
      goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
    },
  ],
};
function fixture(packId = 'classic') {
  const pack = loadPack(packId);
  const start = createGame({ ...config, packId }, pack);
  return applyCommand(start, 0, { type: 'EndTurn' }, pack).state;
}
describe('save validation and replay', () => {
  it.each(['classic', 'modern-western'])(
    'round trips the complete %s state through JSON and replay',
    (id) => {
      const state = fixture(id);
      const decoded = parseImport(JSON.stringify(makeSave(state, 'slot-1')));
      expect(decoded.warning).toBe(false);
      expect(decoded.state).toEqual(state);
      expect(stateHash(decoded.state)).toBe(stateHash(state));
    },
  );
  it('imports a compatible replay-only export and rejects one without its ruleset', () => {
    const state = fixture();
    expect(parseImport(replayJson(state)).state).toEqual(state);
    const incompatible = JSON.parse(replayJson(state));
    incompatible.packVersion = 'old-rules';
    expect(() => parseImport(JSON.stringify(incompatible))).toThrow();
  });
  it('migrates v1 without changing the deterministic snapshot', () => {
    const state = fixture();
    const old = { ...makeSave(state, 'slot-1'), schemaVersion: 1 };
    const result = decodeSave(old);
    expect(result.record.schemaVersion).toBe(2);
    expect(result.state).toEqual(state);
  });
  it('loads a valid snapshot with a warning on incompatible replay', () => {
    const state = fixture();
    state.players[0]!.happiness = 104;
    const result = decodeSave(makeSave(state, 'slot-1'));
    expect(result.warning).toBe(true);
    expect(result.state.players[0]!.happiness).toBe(104);
  });
  it('rejects corruption, malformed modules/commands, invalid seats and oversized files', () => {
    const rec = makeSave(fixture('modern-western'), 'slot-1');
    const corrupted = JSON.parse(JSON.stringify(rec));
    corrupted.snapshot.players[0].cash++;
    expect(() => decodeSave(corrupted)).toThrow();
    const state = fixture('modern-western');
    state.players[0]!.modules.loans = { loans: 'broken' };
    expect(() => decodeSave(makeSave(state, 'slot-1'))).toThrow();
    const badSeat = fixture();
    badSeat.activeSeat = 9;
    expect(() => decodeSave(makeSave(badSeat, 'slot-1'))).toThrow();
    const badCommand = fixture();
    badCommand.log[0]!.cmd = { type: 'Work', hours: 'bad' };
    expect(() => decodeSave(makeSave(badCommand, 'slot-1'))).toThrow();
    expect(() => parseImport('{')).toThrow();
    expect(() => parseImport(' '.repeat(MAX_IMPORT_BYTES + 1))).toThrow();
    expect(() => decodeSave({ ...rec, schemaVersion: 999 })).toThrow();
  });
});
