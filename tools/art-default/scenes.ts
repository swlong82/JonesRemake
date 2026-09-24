/**
 * Stage-sized scenes (1600×1000) and UI pieces (ART_SPEC 17.3): the board background drawn around
 * the set's own layout, one interior per location (the right 40% kept calm for the action panel),
 * the weekend moods, title and setup art, the newspaper masthead and the 9-slice frames.
 */
import type { BoardLayout } from '@hustle-ring/art';
import { signFor } from './buildings.js';
import { icon } from './icons.js';
import {
  circle,
  dark,
  ellipse,
  g,
  ink,
  light,
  line,
  linear,
  path,
  poly,
  rect,
  rng,
  svg,
} from './svg.js';

const W = 1600;
const H = 1000;

function tree(x: number, y: number, r: number, c = '#5a9e45'): string {
  return (
    rect(x - r * 0.18, y, r * 0.36, r * 1.1, '#8b5a2b', ink(3)) +
    circle(x, y - r * 0.2, r, c, ink(4)) +
    circle(x - r * 0.35, y - r * 0.45, r * 0.35, light(c, 0.25))
  );
}

function cloud(x: number, y: number, s: number, fill = '#ffffff'): string {
  return g(
    ellipse(0, 0, 60, 26, fill, ink(3)) +
      ellipse(-34, 8, 36, 20, fill, ink(3)) +
      ellipse(36, 8, 40, 22, fill, ink(3)) +
      ellipse(0, 12, 70, 16, fill),
    { transform: `translate(${x} ${y}) scale(${s})` },
  );
}

/** Streets, sidewalks and the park, laid out around the board's own path and slots. */
export function boardBackground(layout: BoardLayout): string {
  const xs = layout.path.map((p) => p.x);
  const ys = layout.path.map((p) => p.y);
  const [l, r, t, b] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const road = 96;
  let s = rect(0, 0, W, H, '#9fd27f');
  const rand = rng(7);
  for (let i = 0; i < 120; i++) {
    s += ellipse(rand() * W, rand() * H, 6 + rand() * 10, 3 + rand() * 4, '#8cc56c', {
      opacity: 0.8,
    });
  }
  // Sidewalk from each building to the street.
  for (const [i, slot] of layout.slots.entries()) {
    const door = layout.path[i]!;
    const bx = slot.rect.x + slot.rect.width / 2;
    const by = slot.rect.y + slot.rect.height;
    s += path(`M${bx} ${by - 10} L${door.x} ${door.y}`, 'none', {
      stroke: '#d9cfbf',
      'stroke-width': 34,
      'stroke-linecap': 'round',
    });
  }
  // The street loop: kerb, asphalt, centre dashes.
  s += rect(l - road / 2 - 10, t - road / 2 - 10, r - l + road + 20, b - t + road + 20, 'none', {
    rx: 70,
    stroke: '#d9cfbf',
    'stroke-width': 26,
  });
  s += rect(l - road / 2, t - road / 2, r - l + road, b - t + road, 'none', {
    rx: 60,
    stroke: '#5b6470',
    'stroke-width': road,
  });
  s += rect(l, t, r - l, b - t, 'none', {
    rx: 20,
    stroke: '#f5d76e',
    'stroke-width': 5,
    'stroke-dasharray': '28 22',
  });
  // The park inside the loop.
  const px = l + road / 2 + 14;
  const py = t + road / 2 + 14;
  const pw = r - l - road - 28;
  const ph = b - t - road - 28;
  s += rect(px, py, pw, ph, '#7cc26a', { rx: 30, ...ink(5) });
  s += path(
    `M${px + 20} ${py + ph / 2} H${px + pw - 20} M${px + pw / 2} ${py + 20} V${py + ph - 20}`,
    'none',
    { stroke: '#e8dcc2', 'stroke-width': 26, 'stroke-linecap': 'round' },
  );
  s +=
    circle(px + pw / 2, py + ph / 2, 48, '#e8dcc2', ink(4)) +
    circle(px + pw / 2, py + ph / 2, 30, '#8fd3f4', ink(4)) +
    circle(px + pw / 2, py + ph / 2, 8, '#ffffff');
  const rt = rng(11);
  for (let i = 0; i < 14; i++) {
    const tx = px + 40 + rt() * (pw - 80);
    const ty = py + 40 + rt() * (ph - 70);
    if (Math.abs(tx - (px + pw / 2)) < 90 && Math.abs(ty - (py + ph / 2)) < 90) continue;
    if (Math.abs(ty - (py + ph / 2)) < 30 || Math.abs(tx - (px + pw / 2)) < 30) continue;
    s += tree(tx, ty, 16 + rt() * 10, rt() > 0.5 ? '#5a9e45' : '#4f9140');
  }
  s +=
    rect(px + 60, py + ph - 60, 60, 14, '#9a7b4f', { rx: 4, ...ink(3) }) +
    rect(px + pw - 130, py + 46, 60, 14, '#9a7b4f', { rx: 4, ...ink(3) });
  // Corner trees outside the block.
  for (const [tx, ty] of [
    [40, 40],
    [W - 40, 40],
    [40, H - 60],
    [W - 40, H - 60],
  ] as const)
    s += tree(tx, ty, 26);
  return svg(W, H, s);
}

interface Room {
  wall: string;
  floor: string;
  props: string;
  outdoor?: boolean;
}

function shelves(
  x: number,
  y: number,
  w: number,
  rows: number,
  seed: number,
  palette: readonly string[],
): string {
  let s = rect(x, y, w, rows * 90 + 14, '#b88a5a', { rx: 6, ...ink(4) });
  const rand = rng(seed);
  for (let r = 0; r < rows; r++) {
    const sy = y + 12 + r * 90;
    s += rect(x + 10, sy + 70, w - 20, 10, '#8b5a2b', ink(3));
    let cx = x + 18;
    while (cx < x + w - 50) {
      const bw = 26 + rand() * 30;
      const bh = 30 + rand() * 36;
      s += rect(cx, sy + 70 - bh, bw, bh, palette[Math.floor(rand() * palette.length)]!, {
        rx: 4,
        ...ink(3),
      });
      cx += bw + 8;
    }
  }
  return s;
}

function counter(x: number, w: number, color: string): string {
  return (
    rect(x, 610, w, 40, light(color, 0.2), { rx: 8, ...ink(4) }) +
    rect(x + 10, 650, w - 20, 130, color, { rx: 6, ...ink(4) })
  );
}

function windowPane(x: number, y: number, w: number, h: number, view: string): string {
  return (
    rect(x, y, w, h, '#fffdf6', { rx: 8, ...ink(5) }) +
    rect(x + 12, y + 12, w - 24, h - 24, view, { rx: 4, ...ink(3) }) +
    path(
      `M${x + w / 2} ${y + 12} V${y + h - 12} M${x + 12} ${y + h / 2} H${x + w - 12}`,
      'none',
      ink(4),
    )
  );
}

function signPlaque(locationId: string, x: number, y: number): string {
  return (
    rect(x, y, 120, 96, '#fffdf6', { rx: 14, ...ink(5) }) +
    icon(signFor(locationId), x + 20, y + 8, 80)
  );
}

const GOODS = ['#e0625a', '#f2c14e', '#6fb7e0', '#9ccf8a', '#b58fc9', '#f28c5a'];

function rooms(id: string): Room {
  switch (id) {
    case 'low-housing':
      return {
        wall: '#d9c4a0',
        floor: '#a8835a',
        props:
          windowPane(160, 170, 220, 200, '#9fd0ef') +
          path('M620 200 l20 30 l-12 20 l24 28', 'none', { ...ink(3), opacity: 0.6 }) +
          rect(520, 520, 300, 110, '#8a6fa5', { rx: 30, ...ink(4) }) +
          rect(500, 500, 60, 150, '#7a5f95', { rx: 20, ...ink(4) }) +
          rect(780, 500, 60, 150, '#7a5f95', { rx: 20, ...ink(4) }) +
          rect(80, 470, 130, 90, '#3b4a5a', { rx: 8, ...ink(4) }) +
          rect(92, 482, 106, 64, '#8fd3f4') +
          rect(120, 560, 50, 60, '#8b5a2b', ink(3)) +
          line(700, 90, 700, 150, ink(3)) +
          circle(700, 170, 22, '#fff4b0', ink(3)),
      };
    case 'secure-apartments':
      return {
        wall: '#e6ecf5',
        floor: '#c9b393',
        props:
          windowPane(120, 120, 520, 330, '#ffd9a0') +
          g(
            poly(
              [
                [140, 430],
                [200, 300],
                [240, 360],
                [300, 250],
                [360, 330],
                [420, 280],
                [480, 360],
                [540, 300],
                [620, 430],
              ],
              '#8fa5c9',
              ink(3),
            ),
          ) +
          rect(420, 540, 420, 100, '#4a7fb5', { rx: 30, ...ink(4) }) +
          ellipse(620, 790, 300, 40, '#d98c6f', ink(3)) +
          rect(740, 380, 60, 160, '#b88a5a', ink(3)) +
          circle(770, 360, 50, '#5a9e45', ink(4)),
      };
    case 'bank':
      return {
        wall: '#e8e2d0',
        floor: '#b9ad8e',
        props:
          [140, 420, 700].map((x) => rect(x, 200, 30, 380, '#f4f1ec', ink(4))).join('') +
          circle(290, 380, 110, '#9aa5b1', ink(6)) +
          circle(290, 380, 70, '#c9d6de', ink(4)) +
          [0, 60, 120]
            .map((a) => rect(286, 300, 8, 160, '#6f7b87', { transform: `rotate(${a} 290 380)` }))
            .join('') +
          rect(500, 260, 170, 220, '#fffdf6', ink(4)) +
          [520, 560, 600, 640].map((x) => line(x, 270, x, 470, ink(3))).join('') +
          counter(80, 820, '#8b5a2b') +
          signPlaque('bank', 800, 120),
      };
    case 'university':
      return {
        wall: '#e8e2d0',
        floor: '#a8835a',
        props:
          rect(120, 150, 560, 300, '#2f5a4a', { rx: 8, ...ink(6) }) +
          path(
            'M170 220 q40 -40 80 0 t80 0 M180 300 h140 M180 340 h90 M420 210 l60 60 m0 -60 l-60 60 M430 330 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0 M540 380 h100',
            'none',
            { stroke: '#ffffff', 'stroke-width': 5, 'stroke-linecap': 'round' },
          ) +
          shelves(720, 180, 200, 3, 3, ['#4a7fb5', '#b3261e', '#3aa36a', '#e9a23b']) +
          counter(80, 620, '#8b5a2b') +
          signPlaque('university', 740, 60),
      };
    case 'factory':
      return {
        wall: '#b0a39a',
        floor: '#6f6760',
        props:
          path('M60 200 H900 M60 230 H900', 'none', { stroke: '#8a7c72', 'stroke-width': 18 }) +
          [200, 480, 760]
            .map(
              (x) => circle(x, 330, 60, '#9aa5b1', ink(5)) + circle(x, 330, 20, '#6f7b87', ink(3)),
            )
            .join('') +
          rect(60, 520, 860, 60, '#3b3b3b', { rx: 30, ...ink(4) }) +
          [120, 280, 440, 600, 760]
            .map((x) => rect(x, 470, 70, 52, '#c9a36b', { rx: 4, ...ink(3) }))
            .join('') +
          [140, 320, 500, 680, 860].map((x) => circle(x, 550, 18, '#6f7b87', ink(3))).join('') +
          signPlaque('factory', 780, 60),
      };
    case 'clinic':
      return {
        wall: '#eef6f6',
        floor: '#c9d6de',
        props:
          signPlaque('clinic', 160, 120) +
          rect(420, 480, 420, 60, '#ffffff', { rx: 20, ...ink(4) }) +
          rect(420, 540, 420, 30, '#8fd3c4', ink(4)) +
          rect(440, 570, 20, 90, '#9aa5b1', ink(3)) +
          rect(800, 570, 20, 90, '#9aa5b1', ink(3)) +
          rect(430, 450, 110, 40, '#ffffff', { rx: 16, ...ink(3) }) +
          path('M380 120 V460', 'none', ink(4)) +
          path('M380 130 q30 40 0 80 t0 80 t0 80 t0 80', '#bfe6f5', { ...ink(3), opacity: 0.9 }) +
          rect(80, 440, 160, 200, '#f4f1ec', { rx: 6, ...ink(4) }) +
          rect(96, 460, 128, 70, '#bfe6f5', ink(3)),
      };
    case 'park':
      return {
        wall: '#bfe6f5',
        floor: '#8cc56c',
        outdoor: true,
        props:
          cloud(300, 150, 1.2) +
          cloud(760, 110, 0.9) +
          circle(1450, 150, 70, '#ffd84a', ink(4)) +
          tree(160, 430, 90) +
          tree(820, 400, 110, '#4f9140') +
          rect(380, 560, 300, 26, '#9a7b4f', { rx: 8, ...ink(4) }) +
          rect(380, 610, 300, 22, '#9a7b4f', { rx: 8, ...ink(4) }) +
          rect(400, 630, 18, 60, '#5c4d3f') +
          rect(640, 630, 18, 60, '#5c4d3f') +
          ellipse(1250, 820, 220, 60, '#8fd3f4', ink(4)),
      };
    case 'burger-joint':
      return {
        wall: '#fbe3c7',
        floor: '#d94436',
        props:
          rect(120, 120, 680, 200, '#2b2118', { rx: 12, ...ink(5) }) +
          ['burger', 'fruit', 'tag']
            .map(
              (id, i) =>
                rect(150 + i * 215, 145, 190, 150, '#3b3028', { rx: 10 }) +
                icon(id as 'burger', 185 + i * 215, 160, 120),
            )
            .join('') +
          rect(700, 380, 150, 200, '#9aa5b1', { rx: 10, ...ink(4) }) +
          [720, 760, 800]
            .map((x) => rect(x, 400, 26, 60, '#e04848', { rx: 6, ...ink(3) }))
            .join('') +
          counter(80, 760, '#e9a23b'),
      };
    case 'grocery':
      return {
        wall: '#eaf6e4',
        floor: '#c9b393',
        props:
          shelves(80, 160, 400, 3, 5, ['#e0625a', '#f2c14e', '#9ccf8a', '#f28c5a']) +
          [560, 700]
            .map(
              (x) =>
                rect(x, 470, 120, 120, '#b88a5a', ink(4)) +
                [0, 1, 2]
                  .map((k) =>
                    circle(x + 25 + k * 35, 470, 18, k % 2 ? '#e0625a' : '#9ccf8a', ink(3)),
                  )
                  .join(''),
            )
            .join('') +
          signPlaque('grocery', 600, 180),
      };
    case 'clothing-boutique':
      return {
        wall: '#fde2ec',
        floor: '#e8dcc2',
        props:
          path('M100 220 H860', 'none', { ...ink(6), stroke: '#9aa5b1' }) +
          [140, 250, 360, 470, 580, 690, 780]
            .map(
              (x, i) =>
                path(`M${x} 220 v20`, 'none', ink(3)) +
                g(
                  path(
                    'M13 6 L20 10 L27 6 L36 12 L32 19 L28 17 L28 35 L12 35 L12 17 L8 19 L4 12 Z',
                    GOODS[i % GOODS.length]!,
                    ink(1.2),
                  ),
                  { transform: `translate(${x - 50} 238) scale(2.5)` },
                ),
            )
            .join('') +
          rect(120, 420, 150, 260, '#fffdf6', { rx: 70, ...ink(4) }) +
          rect(135, 435, 120, 230, '#bfe6f5', { rx: 60 }) +
          signPlaque('clothing-boutique', 700, 440),
      };
    case 'electronics-store':
      return {
        wall: '#dfeef7',
        floor: '#8a9ba8',
        props:
          [
            [100, 140],
            [360, 140],
            [620, 140],
            [100, 330],
            [360, 330],
            [620, 330],
          ]
            .map(
              ([x, y], i) =>
                rect(x!, y!, 220, 150, '#2b3a4a', { rx: 10, ...ink(4) }) +
                rect(
                  x! + 14,
                  y! + 14,
                  192,
                  122,
                  ['#6fb7e0', '#f2c14e', '#9ccf8a', '#f28c5a', '#b58fc9', '#8fd3f4'][i]!,
                  { rx: 4 },
                ),
            )
            .join('') + counter(80, 760, '#4a90d9'),
      };
    case 'appliance-depot':
      return {
        wall: '#e6f1fb',
        floor: '#b0bcc6',
        props:
          [100, 300, 500, 700]
            .map(
              (x, i) =>
                rect(
                  x,
                  240 + (i % 2) * 60,
                  160,
                  400 - (i % 2) * 60,
                  i % 2 ? '#f4f1ec' : '#dfe8ee',
                  { rx: 12, ...ink(4) },
                ) +
                path(
                  `M${x} 380 H${x + 160} M${x + 20} ${300 + (i % 2) * 60} V${350 + (i % 2) * 60}`,
                  'none',
                  ink(4),
                ),
            )
            .join('') + signPlaque('appliance-depot', 740, 90),
      };
    case 'pawn-shop':
      return {
        wall: '#e9dcf2',
        floor: '#8b6a4a',
        props:
          shelves(80, 150, 520, 3, 9, ['#e9b93b', '#9aa5b1', '#b3261e', '#4a7fb5']) +
          circle(760, 250, 70, '#fffdf6', ink(5)) +
          path('M760 250 V200 M760 250 L800 270', 'none', ink(5)) +
          path('M680 600 L700 380 Q720 340 740 380 L760 600 Z', '#c9624b', ink(4)) +
          counter(80, 760, '#7b5a8f'),
      };
    case 'discount-store':
      return {
        wall: '#fff4d6',
        floor: '#e0c89a',
        props:
          shelves(80, 170, 420, 3, 13, GOODS) +
          shelves(540, 170, 360, 3, 17, GOODS) +
          g(
            poly(
              [
                [0, 0],
                [110, 0],
                [150, 50],
                [110, 100],
                [0, 100],
              ],
              '#e0625a',
              ink(5),
            ) + circle(28, 50, 12, '#fff4d6', ink(3)),
            { transform: 'translate(640 40) rotate(-6)' },
          ),
      };
    case 'employment-office':
      return {
        wall: '#e4efd9',
        floor: '#a8835a',
        props:
          rect(120, 150, 420, 280, '#c9a36b', { rx: 10, ...ink(5) }) +
          [
            [150, 180],
            [270, 190],
            [390, 175],
            [160, 300],
            [300, 310],
            [420, 290],
          ]
            .map(
              ([x, y], i) =>
                rect(x!, y!, 100, 90, ['#fffdf6', '#fdf1b8', '#e6f1fb'][i % 3]!, {
                  ...ink(3),
                  transform: `rotate(${(i % 3) - 1} ${x! + 50} ${y! + 45})`,
                }) + circle(x! + 50, y! + 8, 6, '#e04848', ink(2)),
            )
            .join('') +
          [620, 760]
            .map(
              (x) =>
                rect(x, 300, 120, 300, '#9aa5b1', { rx: 6, ...ink(4) }) +
                [0, 1, 2]
                  .map((k) => rect(x + 45, 340 + k * 90, 30, 10, '#6f7b87', { rx: 4 }))
                  .join(''),
            )
            .join('') +
          signPlaque('employment-office', 640, 120),
      };
    case 'rent-office':
      return {
        wall: '#e2ebf2',
        floor: '#9fb8c9',
        props:
          rect(140, 170, 300, 220, '#b88a5a', { rx: 10, ...ink(5) }) +
          [0, 1, 2, 3, 4, 5]
            .map((k) =>
              g(icon('key', 0, 0, 60), {
                transform: `translate(${160 + (k % 3) * 90} ${190 + Math.floor(k / 3) * 100})`,
              }),
            )
            .join('') +
          circle(640, 220, 70, '#fffdf6', ink(5)) +
          path('M640 220 V175 M640 220 L675 235', 'none', ink(5)) +
          rect(760, 330, 120, 280, '#9aa5b1', { rx: 6, ...ink(4) }) +
          counter(80, 640, '#5f7d95'),
      };
    default:
      return {
        wall: '#efe4cf',
        floor: '#b88a5a',
        props: shelves(80, 180, 600, 3, 21, GOODS) + counter(80, 700, '#8b5a2b'),
      };
  }
}

export function interiorSvg(locationId: string): string {
  const room = rooms(locationId);
  let s: string;
  if (room.outdoor) {
    s =
      rect(0, 0, W, H, room.wall) +
      rect(0, 640, W, 360, room.floor) +
      path(`M0 640 H${W}`, 'none', ink(5));
  } else {
    s =
      rect(0, 0, W, 700, room.wall) +
      rect(0, 660, W, 40, dark(room.wall, 0.15), ink(4)) +
      poly(
        [
          [0, 700],
          [W, 700],
          [W, H],
          [0, H],
        ],
        room.floor,
      ) +
      [0.25, 0.5, 0.75]
        .map((f) =>
          path(`M${f * W} 700 L${f * W + (f - 0.5) * 900} ${H}`, 'none', {
            stroke: dark(room.floor, 0.15),
            'stroke-width': 4,
          }),
        )
        .join('') +
      path(`M0 700 H${W}`, 'none', ink(5)) +
      // A calm framed picture in the panel's corner, high enough to stay behind the sheet.
      rect(1330, 90, 170, 120, '#fffdf6', { rx: 6, ...ink(4) }) +
      rect(1345, 105, 140, 90, light(room.wall, 0.3), { rx: 3 }) +
      path('M1350 190 l40 -40 l30 30 l20 -15 l35 25', 'none', ink(3));
  }
  return svg(W, H, s + room.props);
}

export function weekendSvg(mood: 'positive' | 'negative' | 'neutral'): string {
  if (mood === 'positive') {
    const defs = linear('sky', [
      [0, '#8fd3f4'],
      [1, '#e6f7ff'],
    ]);
    let s = rect(0, 0, W, H, 'url(#sky)') + circle(1350, 180, 110, '#ffd84a', ink(5));
    s += [0, 1, 2, 3, 4, 5, 6, 7]
      .map((k) =>
        line(
          1350,
          180,
          1350 + Math.cos((k * Math.PI) / 4) * 170,
          180 + Math.sin((k * Math.PI) / 4) * 170,
          { stroke: '#ffd84a', 'stroke-width': 10, 'stroke-linecap': 'round' },
        ),
      )
      .join('');
    s += cloud(350, 170, 1.3) + cloud(820, 110, 0.9);
    s += path(`M0 640 Q400 560 800 620 T${W} 600 V${H} H0 Z`, '#8cc56c', ink(5));
    s += tree(160, 560, 110) + tree(1450, 560, 90, '#4f9140');
    s += g(
      poly(
        [
          [0, 0],
          [360, 0],
          [420, 110],
          [-60, 110],
        ],
        '#e0625a',
        ink(4),
      ) +
        path('M40 0 L-10 110 M120 0 L90 110 M200 0 L190 110 M280 0 L290 110', 'none', {
          stroke: '#fff4d6',
          'stroke-width': 18,
        }),
      { transform: 'translate(260 800)' },
    );
    s +=
      circle(420, 820, 30, '#f2c14e', ink(3)) +
      rect(520, 790, 60, 50, '#9ccf8a', { rx: 8, ...ink(3) });
    s += [
      [1120, 300, '#e04848'],
      [1200, 260, '#4a90d9'],
      [1270, 320, '#f2c14e'],
    ]
      .map(
        ([x, y, c]) =>
          ellipse(x as number, y as number, 40, 50, c as string, ink(4)) +
          path(`M${x} ${(y as number) + 50} q-20 80 10 160`, 'none', ink(2.5)),
      )
      .join('');
    return svg(W, H, s, defs);
  }
  if (mood === 'negative') {
    const defs = linear('storm', [
      [0, '#4a5568'],
      [1, '#8a97a8'],
    ]);
    let s = rect(0, 0, W, H, 'url(#storm)');
    s += cloud(420, 170, 2, '#6f7b87') + cloud(1100, 140, 1.7, '#5f6b77');
    s += poly(
      [
        [1080, 230],
        [1030, 380],
        [1080, 370],
        [1040, 500],
        [1140, 330],
        [1090, 340],
        [1130, 230],
      ],
      '#f5d76e',
      ink(4),
    );
    s += rect(0, 700, W, 300, '#5b6470') + path(`M0 700 H${W}`, 'none', ink(5));
    s +=
      ellipse(300, 860, 160, 26, '#8fa5c9', { ...ink(3), opacity: 0.9 }) +
      ellipse(1250, 900, 200, 30, '#8fa5c9', { ...ink(3), opacity: 0.9 });
    const rr = rng(5);
    for (let i = 0; i < 90; i++) {
      const x = rr() * W;
      const y = rr() * 700;
      s += line(x, y, x - 14, y + 40, {
        stroke: '#cfe3f5',
        'stroke-width': 4,
        'stroke-linecap': 'round',
        opacity: 0.8,
      });
    }
    s +=
      rect(180, 360, 18, 340, '#3b3b3b', ink(3)) +
      rect(150, 330, 78, 40, '#f5d76e', { rx: 8, ...ink(4) });
    s += g(
      rect(0, 0, 150, 100, '#fffdf6', { rx: 6, ...ink(4) }) +
        path('M20 30 H130 M20 55 H100 M20 78 H120', 'none', { ...ink(4), stroke: '#b3261e' }),
      { transform: 'translate(1300 560) rotate(12)' },
    );
    return svg(W, H, s, defs);
  }
  let s =
    rect(0, 0, W, 700, '#efe4cf') +
    poly(
      [
        [0, 700],
        [W, 700],
        [W, H],
        [0, H],
      ],
      '#b88a5a',
    ) +
    path(`M0 700 H${W}`, 'none', ink(5));
  s += windowPane(180, 140, 360, 280, '#bfe6f5') + cloud(360, 260, 0.6);
  s +=
    circle(1280, 220, 90, '#fffdf6', ink(6)) +
    path('M1280 220 V160 M1280 220 L1325 250', 'none', ink(6));
  s +=
    rect(1080, 520, 380, 110, '#7a9cc6', { rx: 30, ...ink(4) }) +
    rect(1060, 500, 60, 150, '#6a8cb6', { rx: 20, ...ink(4) }) +
    rect(1420, 500, 60, 150, '#6a8cb6', { rx: 20, ...ink(4) });
  s +=
    path('M220 720 L250 880 H400 L430 720 Z', '#c9a36b', ink(4)) +
    [0, 1, 2].map((k) => ellipse(280 + k * 50, 720, 40, 20, GOODS[k]!, ink(3))).join('');
  return svg(W, H, s);
}

function skyline(
  y: number,
  color: string,
  seed: number,
  minH: number,
  maxH: number,
  windows: boolean,
): string {
  const rand = rng(seed);
  let s = '';
  let x = -20;
  while (x < W) {
    const w = 70 + rand() * 90;
    const h = minH + rand() * (maxH - minH);
    s += rect(x, y - h, w, h + 400, color, ink(3));
    if (windows) {
      for (let wy = y - h + 20; wy < y - 20; wy += 34) {
        for (let wx = x + 14; wx < x + w - 20; wx += 26)
          if (rand() > 0.45) s += rect(wx, wy, 12, 16, '#ffe9a8', { rx: 2 });
      }
    }
    if (rand() > 0.7)
      s += poly(
        [
          [x, y - h],
          [x + w / 2, y - h - 40],
          [x + w, y - h],
        ],
        color,
        ink(3),
      );
    x += w + 6;
  }
  return s;
}

export function titleSvg(): string {
  const defs = linear('dusk', [
    [0, '#ff9a5a'],
    [0.55, '#ffc98a'],
    [1, '#ffe7c2'],
  ]);
  let s = rect(0, 0, W, H, 'url(#dusk)') + circle(800, 560, 220, '#ffdf6b', { opacity: 0.95 });
  s += cloud(260, 200, 1.2, '#fff1dc') + cloud(1320, 160, 1, '#fff1dc');
  s +=
    skyline(700, '#c77d7a', 3, 180, 360, false) +
    skyline(780, '#8a5a78', 9, 120, 260, true) +
    skyline(860, '#5a3f5f', 15, 60, 180, true);
  s +=
    rect(0, 860, W, 140, '#4a4f5a') +
    rect(0, 920, W, 8, '#f5d76e', { 'stroke-dasharray': '60 40' });
  s += [
    [240, '#e0625a'],
    [900, '#4a90d9'],
    [1320, '#9ccf8a'],
  ]
    .map(([x, c]) =>
      g(
        rect(0, 0, 120, 44, c as string, { rx: 14, ...ink(4) }) +
          rect(20, -26, 70, 30, light(c as string, 0.4), { rx: 10, ...ink(3) }) +
          circle(26, 46, 12, '#2b2118') +
          circle(94, 46, 12, '#2b2118'),
        { transform: `translate(${x} 872)` },
      ),
    )
    .join('');
  return svg(W, H, s, defs);
}

export function setupSvg(): string {
  const defs = linear('day', [
    [0, '#8fd3f4'],
    [1, '#e6f7ff'],
  ]);
  let s =
    rect(0, 0, W, H, 'url(#day)') +
    cloud(300, 320, 1) +
    cloud(1200, 280, 1.2) +
    circle(1400, 300, 60, '#ffd84a', ink(4));
  s += skyline(640, '#9fb8c9', 21, 120, 240, false) + skyline(700, '#6f8fae', 27, 80, 200, true);
  s += rect(0, 700, W, 300, '#9fd27f') + path(`M0 700 H${W}`, 'none', ink(5));
  s += [200, 520, 1080, 1400].map((x) => tree(x, 690, 44)).join('');
  return svg(W, H, s, defs);
}

/** A small skyline vignette for the masthead, within `w`×`h` at (x, y). */
function vignette(x: number, y: number, w: number, h: number, seed: number): string {
  const rand = rng(seed);
  let out = '';
  let cx = x;
  while (cx < x + w - 12) {
    const bw = 14 + rand() * 18;
    const bh = h * (0.35 + rand() * 0.65);
    out += rect(cx, y + h - bh, Math.min(bw, x + w - cx), bh, '#b9ad8e', ink(2));
    cx += bw + 3;
  }
  return out;
}

export function mastheadSvg(): string {
  let s =
    rect(0, 0, 1200, 200, '#f4ecd8') +
    path('M30 24 H1170 M30 34 H1170 M30 166 H1170 M30 176 H1170', 'none', {
      stroke: '#2b2118',
      'stroke-width': 3,
    });
  s += vignette(50, 60, 260, 96, 31) + vignette(890, 60, 260, 96, 37);
  s += circle(600, 100, 40, '#e8dcc2', ink(3)) + icon('columns', 572, 72, 56);
  return svg(1200, 200, s);
}

export function frameSvg(kind: 'panel' | 'button'): string {
  if (kind === 'panel') {
    return svg(
      96,
      96,
      rect(3, 3, 90, 90, '#fff8ec', { rx: 18, ...ink(5), stroke: '#5c4d3f' }) +
        rect(12, 12, 72, 72, 'none', {
          rx: 12,
          stroke: '#c9a36b',
          'stroke-width': 2.5,
          'stroke-dasharray': '6 5',
        }),
    );
  }
  return svg(
    96,
    96,
    rect(3, 3, 90, 90, '#ffffff', { rx: 22, ...ink(5), stroke: '#2f6fb5' }) +
      path('M18 16 H78', 'none', {
        stroke: '#ffffff',
        'stroke-width': 5,
        'stroke-linecap': 'round',
        opacity: 0.8,
      }),
  );
}
