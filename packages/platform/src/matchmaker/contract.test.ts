import { describe, expect, it } from 'vitest';
import { LocalMatchmaker, type Matchmaker } from './index.js';

let n = 0;
const implementations: [string, () => Matchmaker][] = [
  ['LocalMatchmaker', () => new LocalMatchmaker(() => `room-${String(++n).padStart(4, '0')}`)],
];
const cfg = { packId: 'classic', seats: 2, isPrivate: true };

describe.each(implementations)('Matchmaker contract: %s', (_name, make) => {
  it('creates a room with a join code and lists it', async () => {
    const m = make();
    const room = await m.createRoom(cfg);
    expect(room.code).toHaveLength(6);
    expect(await m.list()).toEqual([room]);
    expect(await m.list({ packId: 'classic' })).toEqual([room]);
    expect(await m.list({ packId: 'nope' })).toEqual([]);
  });
  it('joins by code and rejects unknown codes', async () => {
    const m = make();
    const room = await m.createRoom(cfg);
    expect(await m.join(room.code)).toEqual(room);
    await expect(m.join('ZZZZZZ')).rejects.toThrow(/not found/);
  });
  it('leave removes the room', async () => {
    const m = make();
    const room = await m.createRoom(cfg);
    await m.leave(room.id);
    expect(await m.list()).toEqual([]);
  });
});
