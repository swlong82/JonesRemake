/**
 * AI turn planning off the main thread (ARCHITECTURE 5.6): a Web Worker runs `runAiTurn` on a
 * serialized copy of the state and returns only the command list; the UI re-applies the commands
 * locally (deterministic engine → identical state) so animation and events flow through the
 * normal dispatch path. Falls back to the main thread when Workers are unavailable (tests) or
 * after a worker crash (BUILD_READINESS 15.5).
 */
import type { PlanOptions } from '@hustle-ring/ai';
import { runAiTurn } from '@hustle-ring/ai';
import { loadPack } from '@hustle-ring/content';
import type { Command, GameState } from '@hustle-ring/engine';

export interface AiRequest {
  id: number;
  state: GameState;
  seat: number;
  packId: string;
  opts: PlanOptions;
}
export interface AiResponse {
  id: number;
  commands: Command[];
  error?: string;
}

export interface AiClient {
  plan(state: GameState, seat: number, packId: string, opts: PlanOptions): Promise<Command[]>;
  dispose(): void;
}

export function planOnMainThread(
  state: GameState,
  seat: number,
  packId: string,
  opts: PlanOptions,
): Command[] {
  return runAiTurn(state, seat, loadPack(packId), opts).commands;
}

export class MainThreadAiClient implements AiClient {
  plan(state: GameState, seat: number, packId: string, opts: PlanOptions): Promise<Command[]> {
    return Promise.resolve(planOnMainThread(state, seat, packId, opts));
  }
  dispose(): void {
    /* nothing to release */
  }
}

export class WorkerAiClient implements AiClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (c: Command[]) => void; reject: (e: Error) => void }
  >();
  private failures = 0;
  private readonly fallback = new MainThreadAiClient();

  constructor(private readonly makeWorker: () => Worker) {}

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = this.makeWorker();
    w.onmessage = (ev: MessageEvent<AiResponse>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.error !== undefined) p.reject(new Error(ev.data.error));
      else p.resolve(ev.data.commands);
    };
    w.onerror = () => {
      this.crash();
    };
    this.worker = w;
    return w;
  }

  private crash(): void {
    this.failures++;
    for (const p of this.pending.values()) p.reject(new Error('ai worker crashed'));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  async plan(
    state: GameState,
    seat: number,
    packId: string,
    opts: PlanOptions,
  ): Promise<Command[]> {
    // 15.5: retry the worker once, then fall back to the main thread with a notice.
    if (this.failures >= 2) return this.fallback.plan(state, seat, packId, opts);
    try {
      const id = this.nextId++;
      const req: AiRequest = {
        id,
        state,
        seat,
        packId,
        opts: { difficulty: opts.difficulty, personality: opts.personality },
      };
      return await new Promise<Command[]>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.ensure().postMessage(req);
      });
    } catch {
      this.crash();
      return this.plan(state, seat, packId, opts);
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

export function createAiClient(): AiClient {
  if (typeof Worker === 'undefined' || import.meta.env.MODE === 'test')
    return new MainThreadAiClient();
  return new WorkerAiClient(
    () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  );
}
