import { useEffect, useState } from 'react';
import type { PaletteId } from '@hustle-ring/shared';
import type { ArtRegistry } from './artRegistry';

/**
 * `<img src>` for an art key (ART_SPEC 17.5): the wireframe on first paint, then the resolved file
 * or tinted blob when it loads. While the next key of the same image is loading (a walking avatar
 * swapping frames) the previous picture stays, so a tinted frame never flashes its magenta/cyan
 * wireframe mid-step; a picture for a different slot is never kept.
 */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** `avatar:player-2:walk1:e#blue` → `avatar:player-2`: frames of one avatar share a slot. */
function slotOf(id: string): string {
  const [key = '', tint = ''] = id.split('#');
  return key.startsWith('avatar:') ? `${key.split(':').slice(0, 2).join(':')}#${tint}` : id;
}

export function useArtUrl(registry: ArtRegistry, key: string, tint?: PaletteId): string {
  const id = `${key}#${tint ?? ''}`;
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    let live = true;
    void registry.url(key, tint).then((url) => {
      if (live) setLoaded({ id, url });
    });
    return () => {
      live = false;
    };
  }, [registry, key, tint, id]);
  if (loaded?.id === id) return loaded.url;
  const sameSlot = loaded !== null && slotOf(loaded.id) === slotOf(id);
  if (sameSlot) return loaded.url;
  // A character that has not loaded yet is simply absent for a moment, not a magenta box.
  return key.startsWith('avatar:') ? BLANK : registry.wireframe(key);
}
