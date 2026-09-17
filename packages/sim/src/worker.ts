/** Worker-thread entry: receives GameSpecs, replies with GameResults. */
import { parentPort } from 'node:worker_threads';
import { runGame } from './runner.js';
import type { GameSpec } from './spec.js';

parentPort?.on('message', (spec: GameSpec) => {
  try {
    parentPort?.postMessage({ ok: true, result: runGame(spec) });
  } catch (e) {
    parentPort?.postMessage({
      ok: false,
      error: e instanceof Error ? (e.stack ?? e.message) : String(e),
    });
  }
});
