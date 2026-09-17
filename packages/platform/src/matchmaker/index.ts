import type { Room, RoomConfig, RoomId } from '../types.js';

export interface Matchmaker {
  createRoom(cfg: RoomConfig): Promise<Room>;
  join(code: string): Promise<Room>;
  leave(roomId: RoomId): Promise<void>;
  list(filter?: { packId?: string }): Promise<Room[]>;
}

/** v1 default: single in-process room registry (hotseat never needs it; keeps call sites honest). */
export class LocalMatchmaker implements Matchmaker {
  private readonly rooms = new Map<RoomId, Room>();
  constructor(private readonly newId: () => string) {}

  createRoom(cfg: RoomConfig): Promise<Room> {
    const id = this.newId();
    const room: Room = { id, code: id.slice(0, 6).toUpperCase(), config: cfg, members: [] };
    this.rooms.set(id, room);
    return Promise.resolve(room);
  }
  join(code: string): Promise<Room> {
    const room = [...this.rooms.values()].find((r) => r.code === code);
    return room ? Promise.resolve(room) : Promise.reject(new Error(`room ${code} not found`));
  }
  leave(roomId: RoomId): Promise<void> {
    this.rooms.delete(roomId);
    return Promise.resolve();
  }
  list(filter?: { packId?: string }): Promise<Room[]> {
    const all = [...this.rooms.values()];
    return Promise.resolve(
      filter?.packId ? all.filter((r) => r.config.packId === filter.packId) : all,
    );
  }
}
