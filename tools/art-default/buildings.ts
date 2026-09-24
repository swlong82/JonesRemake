/**
 * Building fronts (240×240, 3/4 view, kerb on the bottom edge) for every location (ART_SPEC 17.3).
 * One parametric builder, a spec per location: body colour, roof, windows, door, awning and a
 * pictogram sign. Unknown locations get a generic shop, so a new pack still draws.
 */
import { icon, type IconId } from './icons.js';
import { circle, dark, ellipse, g, ink, light, path, poly, rect, svg } from './svg.js';

type Roof = 'flat' | 'gable' | 'dome' | 'saw' | 'tower' | 'awningRoof';

export interface BuildingSpec {
  body: string;
  roof: Roof;
  roofColor: string;
  /** Front face box inside the 240 frame. */
  width: number;
  height: number;
  windows: { cols: number; rows: number };
  door: string;
  awning?: [string, string];
  sign?: IconId;
  extra?: 'chimney' | 'columns' | 'gate' | 'antenna' | 'cracks' | 'sale';
}

const W = 240;
const DEPTH = 22;

function windowsGrid(
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
): string {
  const gap = 10;
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h - gap * (rows + 1)) / rows;
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + gap + c * (cw + gap);
      const wy = y + gap + r * (ch + gap);
      out +=
        rect(wx, wy, cw, ch, '#bfe6f5', { rx: 3, ...ink(3) }) +
        path(`M${wx + 4} ${wy + ch - 4} L${wx + cw - 6} ${wy + 5}`, 'none', {
          stroke: '#ffffff',
          'stroke-width': 3,
          'stroke-linecap': 'round',
          opacity: 0.8,
        });
    }
  }
  return out;
}

export function building(spec: BuildingSpec): string {
  const x = (W - spec.width - DEPTH) / 2;
  const base = 226;
  const y = base - spec.height;
  const side = dark(spec.body, 0.22);
  let s = ellipse(W / 2 + 6, 230, spec.width / 2 + 24, 9, '#000000', { opacity: 0.18 });
  // Side face for depth, then the front.
  s += poly(
    [
      [x + spec.width, y],
      [x + spec.width + DEPTH, y - 12],
      [x + spec.width + DEPTH, base - 12],
      [x + spec.width, base],
    ],
    side,
    ink(4),
  );
  s += rect(x, y, spec.width, spec.height, spec.body, { rx: 4, ...ink(4) });
  s += roof(spec, x, y);
  if (spec.extra === 'columns') {
    for (let i = 0; i < 4; i++) {
      s += rect(
        x + 12 + i * ((spec.width - 36) / 3),
        y + 44,
        12,
        spec.height - 70,
        light(spec.body, 0.5),
        ink(3),
      );
    }
  }
  // Upper floors: windows above the ground floor.
  const groundH = 62;
  const upperH = spec.height - groundH - 8;
  if (spec.windows.rows > 0 && upperH > 30 && spec.extra !== 'columns') {
    s += windowsGrid(x, y + 6, spec.width, upperH, spec.windows.cols, spec.windows.rows);
  }
  // Ground floor: door, shop windows, awning, sign.
  const doorW = 34;
  const dx = x + spec.width / 2 - doorW / 2;
  s += rect(dx, base - 52, doorW, 52, spec.door, { rx: 3, ...ink(4) });
  s += circle(dx + doorW - 8, base - 26, 2.5, '#f5d76e');
  if (spec.width > 120) {
    s += rect(x + 10, base - 46, dx - x - 20, 32, '#bfe6f5', { rx: 3, ...ink(3) });
    s += rect(dx + doorW + 10, base - 46, x + spec.width - dx - doorW - 20, 32, '#bfe6f5', {
      rx: 3,
      ...ink(3),
    });
  }
  if (spec.awning) {
    const aw = spec.width + 10;
    const ax = x - 5;
    const ay = base - 66;
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      s += rect(
        ax + (i * aw) / stripes,
        ay,
        aw / stripes,
        14,
        i % 2 === 0 ? spec.awning[0] : spec.awning[1],
      );
    }
    let scallop = `M${ax} ${ay + 14}`;
    for (let i = 0; i < stripes; i++) scallop += ` q${aw / stripes / 2} 9 ${aw / stripes} 0`;
    s += path(`${scallop} V${ay} H${ax} Z`, 'none', ink(3));
    for (let i = 0; i < stripes; i++) {
      const cx = ax + (i + 0.5) * (aw / stripes);
      s += ellipse(cx, ay + 15, aw / stripes / 2, 5, i % 2 === 0 ? spec.awning[0] : spec.awning[1]);
    }
  }
  if (spec.sign) {
    const sy = spec.awning ? base - 104 : base - 96;
    s += rect(W / 2 - DEPTH / 2 - 26, sy, 52, 40, '#fffdf6', { rx: 8, ...ink(3.5) });
    s += icon(spec.sign, W / 2 - DEPTH / 2 - 18, sy + 4, 32);
  }
  if (spec.extra === 'chimney') {
    s += rect(x + spec.width - 44, y - 58, 20, 50, '#9a5b44', ink(4));
    s += circle(x + spec.width - 30, y - 70, 12, '#e6e6e6', ink(3));
    s += circle(x + spec.width - 12, y - 84, 9, '#f2f2f2', ink(3));
  }
  if (spec.extra === 'antenna') {
    s += path(`M${x + spec.width / 2} ${y - 20} V${y - 46}`, 'none', ink(4));
    s += circle(x + spec.width / 2, y - 48, 5, '#e04848', ink(3));
  }
  if (spec.extra === 'cracks') {
    s += path(`M${x + 16} ${y + 20} l8 10 l-5 8 l9 9`, 'none', { ...ink(2.5), opacity: 0.7 });
    s += rect(x + spec.width - 40, y + spec.height - 90, 22, 10, '#c8b9a0', {
      ...ink(2),
      transform: `rotate(-12 ${x + spec.width - 29} ${y + spec.height - 85})`,
    });
  }
  if (spec.extra === 'gate') {
    s += rect(x - 14, base - 40, 12, 40, '#6f7b87', ink(3));
    s += rect(x + spec.width + 2, base - 40, 12, 40, '#6f7b87', ink(3));
  }
  if (spec.extra === 'sale') {
    s += g(
      poly(
        [
          [0, 0],
          [30, 0],
          [42, 14],
          [30, 28],
          [0, 28],
        ],
        '#f5d76e',
        ink(3),
      ) + circle(8, 14, 3, '#fff8ec', ink(2)),
      { transform: `translate(${x + 8} ${y + 10}) rotate(-8)` },
    );
  }
  return s;
}

function roof(spec: BuildingSpec, x: number, y: number): string {
  const w = spec.width;
  const c = spec.roofColor;
  switch (spec.roof) {
    case 'gable':
      return poly(
        [
          [x - 10, y + 2],
          [x + w / 2, y - 48],
          [x + w + 10 + DEPTH / 2, y + 2],
        ],
        c,
        ink(4),
      );
    case 'dome':
      return (
        path(`M${x + w / 2 - 44} ${y} A44 40 0 0 1 ${x + w / 2 + 44} ${y} Z`, c, ink(4)) +
        path(`M${x + w / 2} ${y - 40} V${y - 62}`, 'none', ink(3)) +
        poly(
          [
            [x + w / 2, y - 62],
            [x + w / 2 + 20, y - 56],
            [x + w / 2, y - 50],
          ],
          '#e04848',
          ink(2.5),
        )
      );
    case 'saw': {
      let d = `M${x} ${y}`;
      const teeth = 4;
      for (let i = 0; i < teeth; i++) d += ` l${w / teeth} -30 v30`;
      return path(`${d} Z`, c, ink(4));
    }
    case 'tower':
      return rect(x + 10, y - 14, w - 20, 14, c, ink(4));
    case 'awningRoof':
      return rect(x - 8, y - 12, w + 16 + DEPTH / 2, 16, c, { rx: 4, ...ink(4) });
    default:
      return rect(x - 6, y - 10, w + 12 + DEPTH / 2, 12, c, { rx: 3, ...ink(4) });
  }
}

/** The park is not a building: trees, a lawn, a fountain and a gate arch. */
function park(): string {
  let s = ellipse(120, 214, 110, 24, '#7cc26a', ink(4));
  s += circle(58, 150, 34, '#5a9e45', ink(4)) + rect(52, 176, 12, 34, '#8b5a2b', ink(3));
  s += circle(186, 140, 40, '#4f9140', ink(4)) + rect(180, 172, 12, 38, '#8b5a2b', ink(3));
  s += ellipse(122, 206, 38, 12, '#8fd3f4', ink(3));
  s += rect(116, 176, 12, 28, '#c9c3b6', ink(3));
  s += path('M100 172 Q122 150 144 172', 'none', { ...ink(3), stroke: '#6fb7e0' });
  s += path('M40 206 V96 Q120 40 200 96 V206', 'none', { ...ink(6), stroke: '#5c4d3f' });
  s += circle(120, 56, 16, '#fffdf6', ink(3)) + icon('tree', 108, 44, 24);
  return s;
}

const SPECS: Record<string, BuildingSpec> = {
  'low-housing': {
    body: '#d9a877',
    roof: 'flat',
    roofColor: '#8f6a4a',
    width: 150,
    height: 170,
    windows: { cols: 2, rows: 2 },
    door: '#7a5234',
    sign: 'house',
    extra: 'cracks',
  },
  'rent-office': {
    body: '#9fb8c9',
    roof: 'gable',
    roofColor: '#5f7d95',
    width: 160,
    height: 140,
    windows: { cols: 3, rows: 1 },
    door: '#3f5a70',
    sign: 'key',
  },
  'pawn-shop': {
    body: '#b58fc9',
    roof: 'flat',
    roofColor: '#7b5a8f',
    width: 160,
    height: 130,
    windows: { cols: 3, rows: 1 },
    door: '#5a3f70',
    awning: ['#e9b93b', '#fff4d6'],
    sign: 'balls',
  },
  'discount-store': {
    body: '#f2c14e',
    roof: 'awningRoof',
    roofColor: '#e0625a',
    width: 190,
    height: 120,
    windows: { cols: 0, rows: 0 },
    door: '#b3261e',
    awning: ['#e0625a', '#fff4d6'],
    sign: 'tag',
    extra: 'sale',
  },
  'burger-joint': {
    body: '#f28c5a',
    roof: 'awningRoof',
    roofColor: '#d94436',
    width: 170,
    height: 125,
    windows: { cols: 0, rows: 0 },
    door: '#8b3a1f',
    awning: ['#d94436', '#fff4d6'],
    sign: 'burger',
  },
  'clothing-boutique': {
    body: '#f2a7c3',
    roof: 'gable',
    roofColor: '#c25b86',
    width: 150,
    height: 135,
    windows: { cols: 2, rows: 1 },
    door: '#8a3a5f',
    awning: ['#c25b86', '#fde2ec'],
    sign: 'shirt',
  },
  'electronics-store': {
    body: '#6fb7e0',
    roof: 'flat',
    roofColor: '#3b6e8f',
    width: 170,
    height: 135,
    windows: { cols: 3, rows: 1 },
    door: '#2c4f66',
    sign: 'tv',
    extra: 'antenna',
  },
  university: {
    body: '#e8e2d0',
    roof: 'dome',
    roofColor: '#7a9cc6',
    width: 180,
    height: 150,
    windows: { cols: 0, rows: 0 },
    door: '#6b4a2b',
    sign: 'cap',
    extra: 'columns',
  },
  'employment-office': {
    body: '#a8c98f',
    roof: 'flat',
    roofColor: '#6b8f52',
    width: 160,
    height: 160,
    windows: { cols: 3, rows: 2 },
    door: '#4a6b35',
    sign: 'briefcase',
  },
  factory: {
    body: '#b0a39a',
    roof: 'saw',
    roofColor: '#8a7c72',
    width: 190,
    height: 120,
    windows: { cols: 4, rows: 1 },
    door: '#5c4d3f',
    sign: 'gear',
    extra: 'chimney',
  },
  bank: {
    body: '#dcd3bd',
    roof: 'gable',
    roofColor: '#b9ad8e',
    width: 180,
    height: 145,
    windows: { cols: 0, rows: 0 },
    door: '#6b4a2b',
    sign: 'columns',
    extra: 'columns',
  },
  grocery: {
    body: '#9ccf8a',
    roof: 'awningRoof',
    roofColor: '#4f9140',
    width: 180,
    height: 120,
    windows: { cols: 0, rows: 0 },
    door: '#3d6e2f',
    awning: ['#4f9140', '#eaf6e4'],
    sign: 'fruit',
  },
  'secure-apartments': {
    body: '#8fa5c9',
    roof: 'tower',
    roofColor: '#5d6f91',
    width: 130,
    height: 200,
    windows: { cols: 2, rows: 4 },
    door: '#3b4a66',
    sign: 'shield',
    extra: 'gate',
  },
  'appliance-depot': {
    body: '#c9d6de',
    roof: 'flat',
    roofColor: '#8a9ba8',
    width: 180,
    height: 125,
    windows: { cols: 3, rows: 1 },
    door: '#4d5f6b',
    awning: ['#4a90d9', '#e6f1fb'],
    sign: 'fridge',
  },
  clinic: {
    body: '#f4f1ec',
    roof: 'flat',
    roofColor: '#c9c3b6',
    width: 160,
    height: 150,
    windows: { cols: 3, rows: 2 },
    door: '#6fb7e0',
    sign: 'cross',
  },
};

const GENERIC: BuildingSpec = {
  body: '#d8c7a8',
  roof: 'flat',
  roofColor: '#a08c6b',
  width: 160,
  height: 140,
  windows: { cols: 3, rows: 1 },
  door: '#6b4a2b',
  awning: ['#8f6a4a', '#f5ead6'],
};

/** Pictogram shown on each location's sign, reused by interiors. */
export function signFor(locationId: string): IconId {
  return SPECS[locationId]?.sign ?? (locationId === 'park' ? 'tree' : 'house');
}

export function buildingSvg(locationId: string): string {
  if (locationId === 'park') return svg(240, 240, park());
  return svg(240, 240, building(SPECS[locationId] ?? GENERIC));
}
