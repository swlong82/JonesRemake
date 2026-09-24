import { paletteIssues } from '@hustle-ring/art';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFlags } from '../../flags/appFlags';
import { useSettings } from '../../store/settings';
import { DEFAULT_ART_SET } from './artRegistry';
import {
  ART_THEME_VARS,
  applyArtTheme,
  artThemeActive,
  artThemeVars,
  FONT_STACKS,
} from './artTheme';
import { useArtTheme } from './useArtTheme';

const theme = DEFAULT_ART_SET.theme!;

describe('art theme (ART_SPEC 17.7)', () => {
  afterEach(() => {
    useFlags.getState().reset({ env: {}, search: '' });
    useSettings.getState().update({ theme: 'system' });
    applyArtTheme(document.documentElement, undefined);
  });

  it('ships a legible default palette in the bundled font', () => {
    expect(paletteIssues(theme.palette as never)).toEqual([]);
    expect(theme.font).toBe('nunito');
  });

  it('maps palette tokens, derived shades, font and frames to CSS variables', () => {
    const vars = artThemeVars(theme, { panel: 'blob:p', button: 'blob:b' });
    expect(vars['--c-surface']).toBe(theme.palette.surface);
    expect(vars['--c-on-accent']).toBe(theme.palette.onAccent);
    expect(vars['--c-surface-3']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--font-ui']).toBe(FONT_STACKS.nunito);
    expect(vars['--art-frame-panel']).toBe('url("blob:p")');
    expect(Object.keys(vars).every((k) => (ART_THEME_VARS as readonly string[]).includes(k))).toBe(
      true,
    );
    expect(artThemeVars(theme)['--art-frame-panel']).toBeUndefined();
  });

  it('is active only with the scene UI and without an explicit dark theme', () => {
    expect(artThemeActive(true, 'system')).toBe(true);
    expect(artThemeActive(true, 'light')).toBe(true);
    expect(artThemeActive(true, 'dark')).toBe(false);
    expect(artThemeActive(false, 'light')).toBe(false);
  });

  it('applies and clears exactly its own properties', () => {
    const el = document.createElement('div');
    el.style.setProperty('--other', 'x');
    applyArtTheme(el, theme);
    expect(el.dataset.artTheme).toBe('on');
    expect(el.style.getPropertyValue('--c-ink')).toBe(theme.palette.ink);
    applyArtTheme(el, undefined);
    expect(el.dataset.artTheme).toBeUndefined();
    expect(el.style.getPropertyValue('--c-ink')).toBe('');
    expect(el.style.getPropertyValue('--other')).toBe('x');
  });

  it('follows the sceneUi flag and the theme setting', async () => {
    const root = document.documentElement;
    useFlags.getState().set('sceneUi', false);
    const { rerender } = renderHook(() => useArtTheme());
    expect(root.dataset.artTheme).toBeUndefined();
    useFlags.getState().set('sceneUi', true);
    rerender();
    await waitFor(() => expect(root.style.getPropertyValue('--art-frame-panel')).toMatch(/^url\(/));
    expect(root.dataset.artTheme).toBe('on');
    useSettings.getState().update({ theme: 'dark' });
    rerender();
    await waitFor(() => expect(root.dataset.artTheme).toBeUndefined());
  });
});
