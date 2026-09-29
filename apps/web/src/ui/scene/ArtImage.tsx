import type { PaletteId } from '@hustle-ring/shared';
import { useState, type CSSProperties } from 'react';
import type { ArtRegistry } from '../../assets/art/artRegistry';
import { useArtUrl } from '../../assets/art/useArtUrl';

/**
 * One art-set picture (ART_SPEC 17.5). Always `<img>` (17.6) and decorative: the scene's meaning
 * lives in buttons and text layers, so `alt` is empty and the image never takes pointer events.
 */
export function ArtImage({
  registry,
  artKey,
  tint,
  className,
  style,
  testId,
}: {
  registry: ArtRegistry;
  artKey: string;
  tint?: PaletteId;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  const src = useArtUrl(registry, artKey, tint);
  // A soft shimmer shows behind the picture until it has loaded (M12.7).
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onLoad={() => {
        setLoadedSrc(src);
      }}
      onError={() => {
        setLoadedSrc(src);
      }}
      className={`pointer-events-none select-none ${loaded ? '' : 'skeleton'} ${className ?? ''}`}
      style={style}
      data-art-key={artKey}
      data-testid={testId}
    />
  );
}
