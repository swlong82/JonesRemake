/** WCAG 2.x contrast (ART_SPEC 17.7). */
import type { Palette, PaletteToken } from './schema.js';

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pairs a theme must satisfy: [foreground, background, minimum ratio]. */
export const CONTRAST_PAIRS: readonly [PaletteToken, PaletteToken, number][] = [
  ['ink', 'surface', 4.5],
  ['ink', 'surface2', 4.5],
  ['inkMuted', 'surface', 4.5],
  ['onAccent', 'accent', 4.5],
  ['onDanger', 'danger', 4.5],
  ['focus', 'surface', 3],
];

export function paletteIssues(palette: Palette): string[] {
  const issues: string[] = [];
  for (const [fg, bg, min] of CONTRAST_PAIRS) {
    const ratio = contrastRatio(palette[fg], palette[bg]);
    if (ratio < min) {
      issues.push(`${fg} on ${bg} is ${ratio.toFixed(2)}:1; needs ${min}:1`);
    }
  }
  return issues;
}
