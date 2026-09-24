import { AVATAR_DIRS, AVATAR_POSES } from '@hustle-ring/art';
import type { PaletteId } from '@hustle-ring/shared';
import { useEffect } from 'react';
import { useGame } from '../../store/gameStore';
import { avatarIdFor } from '../../ui/scene/walk';
import { artRegistryFor, useArtSets } from './artRegistry';

/** Run `task` when the browser is idle (or soon, where `requestIdleCallback` is missing). */
function whenIdle(task: () => void): () => void {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(task, { timeout: 2000 });
    return () => {
      globalThis.cancelIdleCallback(id);
    };
  }
  const id = setTimeout(task, 200);
  return () => {
    clearTimeout(id);
  };
}

/**
 * Lazy per scene (ART_SPEC 17.8): the board loads with the game; once the browser is idle, every
 * interior and host, the weekend pictures and each player's tinted walk frames are fetched too,
 * so entering a location or walking never waits on the network.
 */
export function useScenePrefetch(): void {
  const pack = useGame((s) => s.pack);
  const gameId = useGame((s) => s.state?.config.seed);
  const version = useArtSets((s) => s.version);
  useEffect(() => {
    const { state } = useGame.getState();
    if (!pack || !state) return;
    const registry = artRegistryFor(pack);
    const requests: { key: string; tint?: PaletteId }[] = [];
    for (const loc of pack.board.locationAt) {
      if (loc === null) continue;
      requests.push({ key: `interior:${loc}` }, { key: `host:${loc}` });
    }
    for (const mood of ['positive', 'negative', 'neutral'])
      requests.push({ key: `weekend:${mood}` });
    for (const p of state.players) {
      const avatar = avatarIdFor(state.config.seats[p.seat], p.seat);
      for (const pose of AVATAR_POSES) {
        for (const dir of AVATAR_DIRS)
          requests.push({ key: `avatar:${avatar}:${pose}:${dir}`, tint: p.color });
      }
    }
    return whenIdle(() => {
      void registry.prefetch(requests);
    });
  }, [pack, gameId, version]);
}
