import { describe, expect, it } from 'vitest';
import type { CommandEnvelope } from '../types.js';
import { LocalTransport, type Transport } from './index.js';

const implementations: [string, () => Transport][] = [
  ['LocalTransport', () => new LocalTransport()],
];

const env = (seq: number, roomId = 'r1'): CommandEnvelope => ({
  v: 1,
  roomId,
  seat: 0,
  seq,
  cmd: { type: 'EndTurn' },
  clientHash: `h${seq}`,
});

describe.each(implementations)('Transport contract: %s', (_name, make) => {
  it('accepts in-order submissions and delivers to subscribers in order', async () => {
    const t = make();
    const seen: number[] = [];
    const off = t.subscribe('r1', (batch) => seen.push(...batch.map((e) => e.seq)));
    expect((await t.submit(env(0))).accepted).toBe(true);
    expect((await t.submit(env(1))).accepted).toBe(true);
    off();
    await t.submit(env(2));
    expect(seen).toEqual([0, 1]);
  });
  it('is idempotent on duplicate seq and rejects gaps', async () => {
    const t = make();
    await t.submit(env(0));
    expect(await t.submit(env(0))).toMatchObject({ accepted: true, reason: 'duplicate' });
    expect(await t.submit(env(5))).toMatchObject({ accepted: false });
    expect(await t.resync('r1', 0)).toHaveLength(1);
  });
  it('resync replays from a seq (reconnect replay)', async () => {
    const t = make();
    for (let i = 0; i < 4; i++) await t.submit(env(i));
    expect((await t.resync('r1', 2)).map((e) => e.seq)).toEqual([2, 3]);
    expect(await t.resync('other', 0)).toEqual([]);
  });
});
