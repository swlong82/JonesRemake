import { useEffect } from 'react';
import { useSettings } from '../../store/settings';
import { baseArtRegistry, useArtSets } from './artRegistry';
import { applyArtTheme, artThemeActive } from './artTheme';

/** Drive the document's colour tokens, font and frames from the active art set (17.7). */
export function useArtTheme(): void {
  const theme = useSettings((s) => s.settings.theme);
  const version = useArtSets((s) => s.version);
  useEffect(() => {
    const root = globalThis.document.documentElement;
    if (!artThemeActive(theme)) {
      applyArtTheme(root, undefined);
      return;
    }
    const registry = baseArtRegistry();
    const art = registry.theme();
    applyArtTheme(root, art);
    let live = true;
    const frames = art?.frames ?? {};
    void Promise.all([
      frames.panel === undefined ? undefined : registry.url(frames.panel),
      frames.button === undefined ? undefined : registry.url(frames.button),
    ]).then(([panel, button]) => {
      if (live) {
        applyArtTheme(root, art, {
          ...(panel === undefined ? {} : { panel }),
          ...(button === undefined ? {} : { button }),
        });
      }
    });
    return () => {
      live = false;
      applyArtTheme(root, undefined);
    };
  }, [theme, version]);
}
