/**
 * Worker-thread pool (BALANCE_SPEC 9.1: parallel = CPU count). Each worker imports the runner and
 * plays the GameSpecs it is handed; results are merged in seed order so output is deterministic
 * regardless of scheduling. Falls back to in-process execution when workers are unavailable.
 */
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { runGame, type GameResult } from './runner.js';
import type { GameSpec } from './spec.js';

export interface PoolOptions {
  workers?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function runAll(specs: GameSpec[], opts: PoolOptions = {}): Promise<GameResult[]> {
  const n = Math.max(1, Math.min(opts.workers ?? cpus().length, specs.length));
  if (n === 1) {
    const out: GameResult[] = [];
    for (const [i, s] of specs.entries()) {
      out.push(runGame(s));
      opts.onProgress?.(i + 1, specs.length);
    }
    return out;
  }
  const results: GameResult[] = [];
  let next = 0;
  let done = 0;
  const workerUrl = new URL('./worker.ts', import.meta.url);
  await Promise.all(
    Array.from({ length: n }, () => {
      return new Promise<void>((resolve, reject) => {
        // Bootstrap the TypeScript loader inside the worker so `./worker.ts` and its imports resolve.
        const w = new Worker(
          `import('tsx/esm/api').then(({ register }) => { register(); return import(${JSON.stringify(workerUrl.href)}); });`,
          { eval: true },
        );
        const feed = (): void => {
          if (next >= specs.length) {
            void w.terminate().then(() => {
              resolve();
            }, reject);
            return;
          }
          w.postMessage(specs[next++]);
        };
        w.on('message', (msg: { ok: true; result: GameResult } | { ok: false; error: string }) => {
          if (!msg.ok) {
            reject(new Error(msg.error));
            return;
          }
          results.push(msg.result);
          done++;
          opts.onProgress?.(done, specs.length);
          feed();
        });
        w.on('error', reject);
        feed();
      });
    }),
  );
  return results.sort((a, b) => a.seed.localeCompare(b.seed));
}
