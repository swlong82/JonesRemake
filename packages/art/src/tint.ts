/**
 * Key-colour tint (ART_SPEC 17.4). A tintable file paints recolourable regions in the manifest's
 * key colours; the registry swaps them for the player's colours in the SVG text before making a
 * `blob:` URL, so bundled and user art share one `<img>` render path.
 */

export interface TintKeys {
  primary: string;
  secondary: string;
}

function keyPattern(hex: string): RegExp {
  // `#RRGGBB` not followed by more hex digits (so `#FF00FF80` is left alone).
  return new RegExp(`${hex}(?![0-9a-fA-F])`, 'gi');
}

export function hasTintKey(svg: string, key: string): boolean {
  return keyPattern(key).test(svg);
}

/** Replace each key colour with its target. Other colours are untouched. */
export function applyTint(
  svg: string,
  keys: TintKeys,
  colours: { primary: string; secondary: string },
): string {
  return svg
    .replace(keyPattern(keys.primary), colours.primary)
    .replace(keyPattern(keys.secondary), colours.secondary);
}

/** `#RRGGBB` scaled towards black by `factor` (0 = unchanged, 1 = black). */
export function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): string =>
    Math.round(((n >> shift) & 0xff) * (1 - factor))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Player colours for a palette colour: the colour itself and a 35% darker secondary. */
export function tintColours(hex: string): { primary: string; secondary: string } {
  return { primary: hex.toLowerCase(), secondary: shade(hex, 0.35) };
}
