/**
 * M7.5: themes, text scale, the pseudo-locale, and the contrast the a11y pass depends on
 * (UX_SPEC 7.8: "Contrast ≥ 4.5:1 text, ≥ 3:1 UI components in both themes").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';
import { accent, pseudoBundle, PSEUDO_CLOSE, PSEUDO_OPEN, pseudoValue } from './pseudo.js';
import { applyDocumentSettings, DEFAULT_SETTINGS } from '../store/settings.js';

// ---- contrast ---------------------------------------------------------------------------------

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const v = hex.replace('#', '');
  return [
    Number.parseInt(v.slice(0, 2), 16),
    Number.parseInt(v.slice(2, 4), 16),
    Number.parseInt(v.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The tokens of one theme, read straight out of the stylesheet. */
function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--c-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!;
  return out;
}

const css = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf8');

/** `:root { … }` is the light theme; the explicit `[data-theme='dark']` block is the dark one. */
function themeTokens(dark: boolean): Record<string, string> {
  if (!dark) {
    const start = css.indexOf(':root {');
    return tokens(css.slice(start, css.indexOf('}', start)));
  }
  const start = css.lastIndexOf(":root[data-theme='dark'] {");
  const light = themeTokens(false);
  return { ...light, ...tokens(css.slice(start, css.indexOf('}', start))) };
}

describe('theme contrast (UX 7.8)', () => {
  for (const dark of [false, true]) {
    const name = dark ? 'dark' : 'light';
    it(`keeps body and muted text above 4.5:1 in the ${name} theme`, () => {
      const c = themeTokens(dark);
      for (const surface of ['--c-surface', '--c-surface-2', '--c-surface-3']) {
        expect(contrast(c['--c-ink']!, c[surface]!), `ink on ${surface}`).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrast(c['--c-ink-muted']!, c[surface]!),
          `muted ink on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`keeps UI components and status colours above 3:1 in the ${name} theme`, () => {
      const c = themeTokens(dark);
      for (const token of ['--c-accent', '--c-danger', '--c-ok', '--c-warn', '--c-focus']) {
        expect(contrast(c[token]!, c['--c-surface']!), token).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(c['--c-line']!, c['--c-surface']!), '--c-line').toBeGreaterThanOrEqual(1.3);
    });

    it(`keeps text on a filled accent or danger surface above 4.5:1 in the ${name} theme`, () => {
      const c = themeTokens(dark);
      // The M7.5 axe pass caught white-on-pale-blue at 2.54:1 in the dark theme; these two tokens
      // are why the button's label is not simply white.
      expect(contrast(c['--c-on-accent']!, c['--c-accent']!), 'on accent').toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(c['--c-on-accent']!, c['--c-accent-strong']!),
        'on accent-strong',
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c['--c-on-danger']!, c['--c-danger']!), 'on danger').toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }

  it('measures a known pair correctly', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
  });
});

// ---- pseudo-locale ----------------------------------------------------------------------------

describe('pseudo-locale generation (M7.5)', () => {
  it('accents letters and leaves everything else alone', () => {
    expect(accent('Work 6h')).toBe('Ẃóŕḱ 6ḫ');
    // Digits, punctuation and currency are left alone; only letters are accented.
    expect(accent('$1,200')).toBe('$1,200');
  });

  it('brackets, accents and pads a string', () => {
    const out = pseudoValue('Settings');
    expect(out.startsWith(PSEUDO_OPEN)).toBe(true);
    expect(out.endsWith(PSEUDO_CLOSE)).toBe(true);
    expect(out).toContain('Śéṭṭíńĝś');
    // Long enough that a layout built for English shows its seams.
    expect(out.length).toBeGreaterThan('Settings'.length * 1.3);
  });

  it('never touches an interpolation placeholder, so strings still interpolate', () => {
    const out = pseudoValue('Week {{week}} of {{total}}');
    expect(out).toContain('{{week}}');
    expect(out).toContain('{{total}}');
  });

  it('covers every English key, with no key renamed', () => {
    const bundle = pseudoBundle(en);
    expect(Object.keys(bundle)).toEqual(Object.keys(en));
    for (const [key, value] of Object.entries(bundle)) {
      const source = (en as Record<string, string>)[key]!;
      if (source === '') continue;
      expect(value, key).not.toBe(source);
      expect(value.startsWith(PSEUDO_OPEN), key).toBe(true);
    }
  });

  it('leaves an empty string empty rather than bracketing nothing', () => {
    expect(pseudoValue('')).toBe('');
  });
});

// ---- themes and text scale --------------------------------------------------------------------

describe('document settings (UX 7.1)', () => {
  it('writes the theme, the text scale, reduced motion and the language onto the root', () => {
    applyDocumentSettings({ ...DEFAULT_SETTINGS, theme: 'dark', textScale: 150 });
    const root = globalThis.document.documentElement;
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.fontSize).toBe('150%');
    expect(root.lang).toBe('en');

    applyDocumentSettings({ ...DEFAULT_SETTINGS, language: 'pseudo', reducedMotion: true });
    expect(root.lang).toBe('en-XA');
    expect(root.dataset.reducedMotion).toBe('true');
    expect(root.style.fontSize).toBe('100%');
  });

  it('offers the three text scales UX 7.1 lists', () => {
    for (const scale of [100, 125, 150] as const) {
      applyDocumentSettings({ ...DEFAULT_SETTINGS, textScale: scale });
      expect(globalThis.document.documentElement.style.fontSize).toBe(`${scale}%`);
    }
  });
});
