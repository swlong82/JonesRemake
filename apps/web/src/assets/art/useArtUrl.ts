import { useEffect, useState } from 'react';
import type { PaletteId } from '@hustle-ring/shared';
import type { ArtRegistry } from './artRegistry';

/**
 * `<img src>` for an art key (ART_SPEC 17.5): the wireframe at once, then the resolved file or
 * tinted blob when it loads. A result for a previous key or tint is never shown.
 */
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
  return loaded?.id === id ? loaded.url : registry.wireframe(key);
}
