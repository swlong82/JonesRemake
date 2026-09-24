import { useEffect } from 'react';
import { useFlags } from '../../flags/appFlags';
import { useSettings } from '../../store/settings';
import { baseArtRegistry } from './artRegistry';
import { applyArtTheme, artThemeActive } from './artTheme';

/** Drive the document's colour tokens, font and frames from the active art set (17.7). */
export function useArtTheme(): void {
  const sceneUi = useFlags((s) => s.flags.sceneUi);
  const theme = useSettings((s) => s.settings.theme);
  useEffect(() => {
    const root = globalThis.document.documentElement;
    if (!artThemeActive(sceneUi, theme)) {
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
  }, [sceneUi, theme]);
}
