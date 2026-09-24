/**
 * Sign pictograms for buildings and interiors, drawn in a 40×40 box. No letters or digits: signs
 * must read in any language and never carry names (ART_SPEC 17.1, PRD 2.6).
 */
import { circle, ellipse, g, ink, path, poly, rect } from './svg.js';

export type IconId =
  | 'burger'
  | 'shirt'
  | 'tv'
  | 'cap'
  | 'briefcase'
  | 'gear'
  | 'columns'
  | 'fruit'
  | 'key'
  | 'balls'
  | 'tag'
  | 'cross'
  | 'fridge'
  | 'house'
  | 'shield'
  | 'tree';

const o = ink(2.5);

export const ICONS: Record<IconId, string> = {
  burger:
    path('M6 18 Q20 2 34 18 Z', '#e9a23b', o) +
    rect(5, 19, 30, 5, '#5a8f29', { rx: 2, ...o }) +
    rect(5, 24, 30, 6, '#7a3b1f', { rx: 2, ...o }) +
    path('M6 31 H34 Q34 37 20 37 Q6 37 6 31 Z', '#e9a23b', o),
  shirt: path(
    'M13 6 L20 10 L27 6 L36 12 L32 19 L28 17 L28 35 L12 35 L12 17 L8 19 L4 12 Z',
    '#4a90d9',
    o,
  ),
  tv:
    rect(5, 9, 30, 21, '#3b4a5a', { rx: 3, ...o }) +
    rect(9, 13, 22, 13, '#8fd3f4', { rx: 1 }) +
    path('M14 35 L20 30 L26 35', 'none', o),
  cap:
    poly(
      [
        [3, 16],
        [20, 8],
        [37, 16],
        [20, 24],
      ],
      '#2b3a67',
      o,
    ) +
    path('M11 20 V28 Q20 33 29 28 V20', '#2b3a67', o) +
    path('M34 17 V27', 'none', o) +
    circle(34, 29, 2, '#e9a23b', o),
  briefcase:
    rect(5, 13, 30, 21, '#8b5a2b', { rx: 3, ...o }) +
    path('M15 13 V9 H25 V13', 'none', o) +
    path('M5 22 H35', 'none', o),
  gear:
    circle(20, 20, 11, '#9aa5b1', o) +
    circle(20, 20, 4, '#ffffff', o) +
    [0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => rect(18, 3, 4, 6, '#9aa5b1', { transform: `rotate(${a} 20 20)`, ...o }))
      .join(''),
  columns:
    poly(
      [
        [4, 13],
        [20, 4],
        [36, 13],
      ],
      '#e8e2d0',
      o,
    ) +
    rect(6, 14, 28, 3, '#e8e2d0', o) +
    [9, 18, 27].map((x) => rect(x, 18, 4, 14, '#e8e2d0', o)).join('') +
    rect(5, 32, 30, 4, '#e8e2d0', o),
  fruit:
    path(
      'M20 12 C10 6 4 16 8 26 C11 34 17 36 20 33 C23 36 29 34 32 26 C36 16 30 6 20 12 Z',
      '#d94436',
      o,
    ) +
    path('M20 12 Q21 6 25 4', 'none', o) +
    ellipse(26, 8, 4, 2, '#5a8f29', { transform: 'rotate(-30 26 8)' }),
  key:
    circle(12, 20, 7, '#e9b93b', o) +
    circle(12, 20, 2.5, '#fff8ec', o) +
    path('M19 20 H36 M31 20 V26 M35 20 V25', 'none', o),
  balls:
    path('M20 4 V10 M8 12 H32', 'none', o) +
    circle(10, 22, 6, '#e9b93b', o) +
    circle(30, 22, 6, '#e9b93b', o) +
    circle(20, 32, 6, '#e9b93b', o),
  tag: path('M6 6 H22 L35 19 L21 33 L6 18 Z', '#e0625a', o) + circle(13, 13, 3, '#fff8ec', o),
  cross:
    rect(15, 5, 10, 30, '#e04848', { rx: 2, ...o }) +
    rect(5, 15, 30, 10, '#e04848', { rx: 2, ...o }) +
    rect(16, 16, 8, 8, '#e04848'),
  fridge:
    rect(10, 3, 20, 34, '#dfe8ee', { rx: 3, ...o }) +
    path('M10 15 H30 M14 8 V12 M14 19 V26', 'none', o),
  house:
    poly(
      [
        [5, 19],
        [20, 6],
        [35, 19],
      ],
      '#c9624b',
      o,
    ) +
    rect(9, 19, 22, 16, '#f2d8a7', o) +
    rect(17, 25, 6, 10, '#8b5a2b', o),
  shield:
    path('M20 4 L34 9 V19 C34 28 27 34 20 37 C13 34 6 28 6 19 V9 Z', '#4a7fb5', o) +
    path('M13 20 L18 25 L28 14', 'none', { ...ink(3), stroke: '#ffffff' }),
  tree: circle(20, 15, 11, '#5a9e45', o) + rect(17, 24, 6, 12, '#8b5a2b', o),
};

/** The icon scaled into a `size` box at (x, y). */
export function icon(id: IconId, x: number, y: number, size: number): string {
  return g(ICONS[id], { transform: `translate(${x} ${y}) scale(${size / 40})` });
}
