import { loadPack } from '@hustle-ring/content';
import { createGame, type GameState } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import {
  createAiClient,
  MainThreadAiClient,
  planOnMainThread,
  WorkerAiClient,
  type AiRequest,
  type AiResponse,
} from './aiClient';

function aiGame(): GameState {
  const config = buildConfig(
    'classic',
    [defaultSeat(0, 'ai', 'Bot'), defaultSeat(1, 'ai', 'Rival')],
    'ai-client-test',
    'classic',
    false,
    false,
  );
  return createGame(config, loadPack('classic'));
}

const OPTS = { difficulty: 'easy', personality: 'balanced' } as const;

/** Minimal Worker double: answers synchronously, or fails on demand. */
class FakeWorker {
  onmessage: ((ev: MessageEvent<AiResponse>) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  terminated = false;
  constructor(private readonly mode: 'ok' | 'error' = 'ok') {}
  postMessage(req: AiRequest): void {
    const res: AiResponse =
      this.mode === 'ok'
        ? { id: req.id, commands: [{ type: 'EndTurn' }] }
        : { id: req.id, commands: [], error: 'worker exploded' };
    queueMicrotask(() => this.onmessage?.({ data: res } as MessageEvent<AiResponse>));
  }
  terminate(): void {
    this.terminated = true;
  }
}

describe('AI client', () => {
  it('plans a legal turn on the main thread', async () => {
    const state = aiGame();
    const commands = await new MainThreadAiClient().plan(state, 0, 'classic', OPTS);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.at(-1)?.type).toBe('EndTurn');
    expect(planOnMainThread(state, 0, 'classic', OPTS)).toEqual(commands);
  });

  it('uses the worker when one is available', async () => {
    const worker = new FakeWorker();
    const client = new WorkerAiClient(() => worker as unknown as Worker);
    const commands = await client.plan(aiGame(), 0, 'classic', OPTS);
    expect(commands).toEqual([{ type: 'EndTurn' }]);
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('cancels pending worker plans without retrying them', async () => {
    const made: FakeWorker[] = [];
    const client = new WorkerAiClient(() => {
      const worker = new FakeWorker();
      worker.postMessage = () => {
        /* leave the request pending until cancellation */
      };
      made.push(worker);
      return worker as unknown as Worker;
    });
    const pending = client.plan(aiGame(), 0, 'classic', OPTS);
    client.cancelPending();
    await expect(pending).rejects.toThrow('cancelled');
    expect(made).toHaveLength(1);
    expect(made[0]?.terminated).toBe(true);
  });

  it('retries once and then falls back to the main thread when the worker fails', async () => {
    const made: FakeWorker[] = [];
    const client = new WorkerAiClient(() => {
      const w = new FakeWorker('error');
      made.push(w);
      return w as unknown as Worker;
    });
    // A failing worker never surfaces the error to the caller: the turn is still planned.
    const commands = await client.plan(aiGame(), 0, 'classic', OPTS);
    expect(commands.at(-1)?.type).toBe('EndTurn');
    expect(made.length).toBe(2);
    expect(made.every((w) => w.terminated)).toBe(true);
    // Once in fallback, later turns skip the worker entirely.
    const again = await client.plan(aiGame(), 0, 'classic', OPTS);
    expect(again.at(-1)?.type).toBe('EndTurn');
    expect(made.length).toBe(2);
  });

  it('picks the main-thread client in the test environment', () => {
    expect(createAiClient()).toBeInstanceOf(MainThreadAiClient);
  });
});
