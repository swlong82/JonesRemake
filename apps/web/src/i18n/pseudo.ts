/**
 * Pseudo-locale generation (M7.5, UX_SPEC 7.1 "language"). A pseudo-locale is the cheapest
 * localisation test there is: it accents every letter so untranslated strings stand out, pads the
 * text so a layout that only fits English breaks visibly, and brackets each string so a truncation
 * is obvious from the missing `»`.
 *
 * Pure, and generated at runtime from the English bundle rather than checked in, so a new key
 * cannot be forgotten.
 */

/** Latin letters mapped to accented look-alikes: still legible, never the same bytes. */
const MAP: Record<string, string> = {
  a: 'á',
  b: 'ḅ',
  c: 'ć',
  d: 'ḓ',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ḫ',
  i: 'í',
  j: 'ĵ',
  k: 'ḱ',
  l: 'ĺ',
  m: 'ṁ',
  n: 'ń',
  o: 'ó',
  p: 'ṗ',
  q: 'q̇',
  r: 'ŕ',
  s: 'ś',
  t: 'ṭ',
  u: 'ú',
  v: 'ṽ',
  w: 'ẃ',
  x: 'ẋ',
  y: 'ý',
  z: 'ź',
  A: 'Á',
  B: 'Ḅ',
  C: 'Ć',
  D: 'Ḓ',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ḫ',
  I: 'Í',
  J: 'Ĵ',
  K: 'Ḱ',
  L: 'Ĺ',
  M: 'Ṁ',
  N: 'Ń',
  O: 'Ó',
  P: 'Ṗ',
  Q: 'Q̇',
  R: 'Ŕ',
  S: 'Ś',
  T: 'Ṭ',
  U: 'Ú',
  V: 'Ṽ',
  W: 'Ẃ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ź',
};

/** How much longer the padded string is, as a fraction. German and Finnish run about this long. */
export const PSEUDO_PADDING = 0.4;

export const PSEUDO_OPEN = '⟦';
export const PSEUDO_CLOSE = '⟧';

/** The filler used to pad; a run of one character reads as padding rather than as words. */
const PAD_CHAR = '·';

/**
 * i18next interpolation (`{{name}}`) and the pack namespace's own placeholders must survive
 * untouched, or the string stops interpolating.
 */
const PLACEHOLDER = /\{\{[^}]*\}\}|<[^>]+>/g;

/** Accent the letters of one string, leaving placeholders and punctuation alone. */
export function accent(text: string): string {
  return text.replace(/[A-Za-z]/g, (ch) => MAP[ch] ?? ch);
}

/**
 * One pseudo-localised string: bracketed, accented outside its placeholders, and padded to about
 * `PSEUDO_PADDING` longer so a layout built for English shows its seams.
 */
export function pseudoValue(text: string): string {
  if (text === '') return text;
  let out = '';
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const start = match.index;
    out += accent(text.slice(last, start));
    out += match[0];
    last = start + match[0].length;
  }
  out += accent(text.slice(last));
  const padding = Math.max(1, Math.round(text.length * PSEUDO_PADDING));
  return `${PSEUDO_OPEN}${out}${PAD_CHAR.repeat(padding)}${PSEUDO_CLOSE}`;
}

/** The whole bundle, key for key. Keys are never touched — only the values people read. */
export function pseudoBundle(en: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(en)) out[key] = pseudoValue(value);
  return out;
}
