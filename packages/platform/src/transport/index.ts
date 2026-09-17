import type { Ack, CommandEnvelope, RoomId, Unsubscribe } from '../types.js';

export interface Transport {
  submit(env: CommandEnvelope): Promise<Ack>;
  subscribe(roomId: RoomId, cb: (batch: CommandEnvelope[]) => void): Unsubscribe;
  resync(roomId: RoomId, fromSeq: number): Promise<CommandEnvelope[]>;
}

/** v1 default: in-process command bus. Ordering + idempotent `seq` per room. */
export class LocalTransport implements Transport {
  private readonly logs = new Map<RoomId, CommandEnvelope[]>();
  private readonly subs = new Map<RoomId, Set<(batch: CommandEnvelope[]) => void>>();

  submit(env: CommandEnvelope): Promise<Ack> {
    const log = this.logs.get(env.roomId) ?? [];
    const expected = log.length;
    if (env.seq < expected)
      return Promise.resolve({ seq: env.seq, accepted: true, reason: 'duplicate' });
    if (env.seq > expected)
      return Promise.resolve({ seq: env.seq, accepted: false, reason: 'gap' });
    log.push(env);
    this.logs.set(env.roomId, log);
    for (const cb of this.subs.get(env.roomId) ?? []) cb([env]);
    return Promise.resolve({ seq: env.seq, accepted: true });
  }
  subscribe(roomId: RoomId, cb: (batch: CommandEnvelope[]) => void): Unsubscribe {
    const set = this.subs.get(roomId) ?? new Set();
    set.add(cb);
    this.subs.set(roomId, set);
    return () => set.delete(cb);
  }
  resync(roomId: RoomId, fromSeq: number): Promise<CommandEnvelope[]> {
    return Promise.resolve((this.logs.get(roomId) ?? []).filter((e) => e.seq >= fromSeq));
  }
}
