# Style guide — soft-lit vector city (draft v0, to ratify in P0)

Owner: art director. Change it by pull request; a style change needs the director's approval and, if it alters the direction, an ADR.

## Look in one line

Friendly modern cartoon in clean vector: rounded shapes, one soft light from the top-left, gentle gradients, thin dark-tone outlines, saturated but warm colour. Not pixel art, not photoreal, and never a copy of any original game art (PRD 2.6).

## Rules

| Topic   | Rule                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera  | 3/4 view from slightly above, the same for every building and interior; verticals stay vertical                                                                                       |
| Light   | One source, top-left. Highlights on top and left faces, shade on right and bottom. Ground shadow: soft ellipse under every building and avatar, 20–25% opacity, offset right and down |
| Outline | 1.5 px at the slot's native size in a darker tone of the fill (not pure black), rounded joins; no outline on shadows and highlights                                                   |
| Fill    | Flat base + one linear gradient (top lighter by ~8% lightness). No noise, no textures, no more than 3 tones per material                                                              |
| Palette | Built from the tokens below. Each building has one base hue and one accent; keep hues distinct per location so the block reads at a glance                                            |
| Detail  | Roof object, awning or sign pictogram, lit windows. Detail goes in `<defs>` and `<use>` to save bytes                                                                                 |
| Text    | Never in art. Names, speech and numbers are HTML layers                                                                                                                               |
| People  | Round heads, simple hands, 3-tone skin range across the six avatars, distinct silhouettes (hair and outfit), same proportions (about 3.5 heads tall)                                  |
| Tint    | Avatars only: primary `#FF00FF` for the outfit, secondary `#00FFFF` for trim                                                                                                          |

## Palette tokens (day)

Proposed values; the P0 pass may adjust them, then this table becomes the single source (the generator and the web theme read the same module).

| Token    | Hex       | Use                           |
| -------- | --------- | ----------------------------- |
| `sky`    | `#9fd4f5` | background sky                |
| `grass`  | `#8fce6b` | park, verges                  |
| `road`   | `#4d5466` | streets                       |
| `ink`    | `#2b2118` | text and darkest outline base |
| `paper`  | `#fff8ec` | UI surface                    |
| `accent` | `#2f6fb5` | UI accent                     |
| `warm`   | `#f2b84b` | lit windows, coins            |
| `alert`  | `#d4570f` | due and urgent badges         |

Dusk and night variants are filters over the same art (colour matrix plus lit windows), not separate files.

## Do and don't

- Do keep silhouettes readable at 44 px tall (phone map).
- Do leave the right 40% of every interior calm: the action panel sits there.
- Don't put a gradient behind small text or icons.
- Don't use pure black, pure white or fully saturated colours outside the tint keys.
- Don't reference or trace existing commercial artwork.

## Prompt preamble for AI-assisted concepts

Paste this first, then the slot brief:

> Modern friendly cartoon vector illustration, 3/4 view from slightly above, soft light from the top-left, rounded shapes, thin darker-tone outlines, gentle top-lit gradients, warm saturated palette (sky #9fd4f5, grass #8fce6b, road #4d5466), soft ground shadow, no text, no logos, no brand names, transparent background, flat vector look, original design.

Concepts are references only. The shipped file is clean vector that passes `pnpm art:check`.
