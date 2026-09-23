import type { SaveMeta, SaveStore } from '@hustle-ring/platform';
import { create } from 'zustand';
import { useGame } from '../store/gameStore';
import { decodeSave, makeSave, parseImport } from './codec';

export const MANUAL_SLOTS = ['slot-1', 'slot-2', 'slot-3'] as const;
export type SaveSlot = (typeof MANUAL_SLOTS)[number];
export interface SaveStatus {
  records: SaveMeta[];
  busy: boolean;
  message: 'saved' | 'loaded' | 'deleted' | null;
  error: 'storage' | 'invalid' | 'missing' | null;
  warning: boolean;
}
const initial: SaveStatus = {
  records: [],
  busy: false,
  message: null,
  error: null,
  warning: false,
};
export const useSaves = create<SaveStatus & { controller: SaveController | null }>(() => ({
  ...initial,
  controller: null,
}));

/** Serializes capture-time snapshots, imports, loads and deletes across game generations. */
export class SaveController {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private closed = false;
  private readonly unsubscribe: () => void;
  constructor(
    private readonly store: SaveStore,
    private readonly update: (patch: Partial<SaveStatus>) => void = (patch) =>
      useSaves.setState(patch),
  ) {
    this.unsubscribe = useGame.subscribe((next, previous) => {
      if (!next.state || next.state === previous.state || previous.loading) return;
      const state = next.state;
      const last = state.log.at(-1)?.cmd as { type?: string } | undefined;
      if (
        state.config !== previous.state?.config ||
        (state.log.length !== previous.state.log.length &&
          (last?.type === 'EndTurn' ||
            state.log.length % 10 === 0 ||
            state.week !== previous.state.week ||
            state.activeSeat !== previous.state.activeSeat ||
            state.winner !== null))
      ) {
        const record = makeSave(state, 'autosave');
        void this.enqueue(async () => {
          await this.store.put(record);
          await this.refreshInside();
        });
      }
    });
  }
  private publish(patch: Partial<SaveStatus>): void {
    if (!this.closed) this.update(patch);
  }
  private async refreshInside(): Promise<void> {
    this.publish({ records: await this.store.list() });
  }
  private enqueue(task: () => Promise<void>): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.pending++;
    this.publish({ busy: true, error: null, message: null });
    const result = this.tail
      .then(task)
      .catch(() => {
        this.publish({ error: 'storage' });
      })
      .finally(() => {
        this.pending--;
        this.publish({ busy: this.pending > 0 });
      });
    this.tail = result;
    return result;
  }
  refresh(): Promise<void> {
    return this.enqueue(() => this.refreshInside());
  }
  save(slot: SaveSlot): Promise<void> {
    const state = useGame.getState().state;
    if (!state || !MANUAL_SLOTS.includes(slot)) return Promise.resolve();
    const record = makeSave(state, slot);
    return this.enqueue(async () => {
      await this.store.put(record);
      await this.refreshInside();
      this.publish({ message: 'saved' });
    });
  }
  remove(id: string): Promise<void> {
    if (id !== 'autosave' && !MANUAL_SLOTS.includes(id as SaveSlot)) return Promise.resolve();
    return this.enqueue(async () => {
      await this.store.delete(id);
      await this.refreshInside();
      this.publish({ message: 'deleted' });
    });
  }
  load(id: string): Promise<void> {
    return this.loadOrImport(id);
  }
  import(text: string): Promise<void> {
    return this.loadOrImport(null, text);
  }
  private loadOrImport(id: string | null, text?: string): Promise<void> {
    const token = useGame.getState().beginLoad();
    return this.enqueue(async () => {
      try {
        const raw = id === null ? null : await this.store.get(id);
        if (!useGame.getState().ownsLoad(token)) return;
        if (id !== null && raw === null) {
          this.publish({ error: 'missing' });
          return;
        }
        let loaded;
        try {
          loaded = id === null ? parseImport(text ?? '') : decodeSave(raw);
        } catch {
          this.publish({ error: 'invalid' });
          return;
        }
        if (!useGame.getState().ownsLoad(token)) return;
        // Commit before replacing the live game; failed imports preserve both game and old saves.
        await this.store.put({ ...loaded.record, id: 'autosave' });
        if (!useGame.getState().finishLoad(token, loaded)) return;
        if (loaded.warning) console.warn('Save replay differs; loaded the validated snapshot.');
        this.publish({ warning: loaded.warning, message: 'loaded' });
        await this.refreshInside();
      } finally {
        useGame.getState().finishLoad(token);
      }
    });
  }
  settled(): Promise<unknown> {
    return this.tail;
  }
  close(): void {
    this.closed = true;
    this.unsubscribe();
  }
}
