/**
 * Art-set theme (ART_SPEC 17.7, M9.5): the active set's palette becomes the CSS colour tokens of
 * `index.css`, its font the UI font, and its 9-slice frames the `.art-frame` border images.
 * Applied while the scene UI is on, unless the player chose the dark theme explicitly
 * (ADR-0054); tokens the art palette does not define keep their light-theme values.
 */
import { shade, type ArtFont, type ArtTheme, type PaletteToken } from '@hustle-ring/art';

/** CSS stacks for the fonts an art set may name; `nunito` is bundled (`@fontsource/nunito`). */
export const FONT_STACKS: Record<ArtFont, string> = {
  system: 'ui-sans-serif, system-ui, sans-serif',
  nunito: '"Nunito", ui-sans-serif, system-ui, sans-serif',
};

const TOKEN_VARS: Record<PaletteToken, string> = {
  surface: '--c-surface',
  surface2: '--c-surface-2',
  ink: '--c-ink',
  inkMuted: '--c-ink-muted',
  line: '--c-line',
  accent: '--c-accent',
  onAccent: '--c-on-accent',
  focus: '--c-focus',
  danger: '--c-danger',
  onDanger: '--c-on-danger',
};

/** Every custom property `applyArtTheme` may set, so clearing removes exactly those. */
export const ART_THEME_VARS = [
  ...Object.values(TOKEN_VARS),
  '--c-surface-3',
  '--c-accent-strong',
  '--font-ui',
  '--art-frame-panel',
  '--art-frame-button',
] as const;

export interface FrameUrls {
  panel?: string;
  button?: string;
}

/** CSS custom properties for a theme; derived tokens are shades of the art palette. */
export function artThemeVars(theme: ArtTheme, frames: FrameUrls = {}): Record<string, string> {
  const palette = theme.palette as Record<PaletteToken, string>;
  const vars: Record<string, string> = {};
  for (const [token, cssVar] of Object.entries(TOKEN_VARS) as [PaletteToken, string][]) {
    vars[cssVar] = palette[token];
  }
  vars['--c-surface-3'] = shade(palette.surface, 0.06);
  vars['--c-accent-strong'] = shade(palette.accent, 0.2);
  vars['--font-ui'] = FONT_STACKS[theme.font];
  if (frames.panel !== undefined) vars['--art-frame-panel'] = `url("${frames.panel}")`;
  if (frames.button !== undefined) vars['--art-frame-button'] = `url("${frames.button}")`;
  return vars;
}

/** Whether the art theme should drive the tokens: scene UI on, and not an explicit dark theme. */
export function artThemeActive(sceneUi: boolean, theme: 'system' | 'light' | 'dark'): boolean {
  return sceneUi && theme !== 'dark';
}

/** Set (or, with `undefined`, clear) the art theme on an element, normally `<html>`. */
export function applyArtTheme(
  root: HTMLElement,
  theme: ArtTheme | undefined,
  frames: FrameUrls = {},
): void {
  for (const v of ART_THEME_VARS) root.style.removeProperty(v);
  if (!theme) {
    delete root.dataset.artTheme;
    return;
  }
  for (const [k, v] of Object.entries(artThemeVars(theme, frames))) root.style.setProperty(k, v);
  root.dataset.artTheme = 'on';
}
