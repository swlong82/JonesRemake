/// <reference lib="webworker" />
/** AI worker entry: plans one turn per request (see aiClient.ts). */
import { runAiTurn } from '@hustle-ring/ai';
import { loadPack } from '@hustle-ring/content';
import type { AiRequest, AiResponse } from './aiClient';

self.onmessage = (ev: MessageEvent<AiRequest>) => {
  const { id, state, seat, packId, opts } = ev.data;
  try {
    const r = runAiTurn(state, seat, loadPack(packId), opts);
    const res: AiResponse = { id, commands: r.commands };
    self.postMessage(res);
  } catch (e) {
    const res: AiResponse = { id, commands: [], error: e instanceof Error ? e.message : String(e) };
    self.postMessage(res);
  }
};
