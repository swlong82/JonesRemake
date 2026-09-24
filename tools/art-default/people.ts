/**
 * People (ART_SPEC 17.3): one parametric figure in a 64×96 box. Player and rival avatars paint the
 * shirt in the primary key colour and the trousers in the secondary one, so the registry can
 * recolour them per player (17.4); hosts use the same figure at 6.25× in a uniform.
 */
import { circle, dark, ellipse, g, INK, path, rect, svg } from './svg.js';

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'spiky' | 'bald' | 'slick' | 'gray';
export type Hat =
  'none' | 'cap' | 'beanie' | 'chef' | 'hard' | 'doorman' | 'ranger' | 'visor' | 'band';
export type Extra =
  | 'briefcase'
  | 'book'
  | 'phone'
  | 'backpack'
  | 'tie'
  | 'apron'
  | 'coat'
  | 'headset'
  | 'stethoscope'
  | 'scarf'
  | 'overalls'
  | 'vest'
  | 'beard'
  | 'glasses'
  | 'shades';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
  shoes: string;
  hat?: Hat;
  hatColor?: string;
  extras?: readonly Extra[];
  /** Wider torso for variety. */
  round?: boolean;
}

export type Pose = 'idle' | 'walk1' | 'walk2' | 'cheer' | 'slump';
export type Dir = 'n' | 'e' | 's' | 'w';

const SW = 1.4;
const o = {
  stroke: INK,
  'stroke-width': SW,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
} as const;

function has(look: Look, e: Extra): boolean {
  return look.extras?.includes(e) ?? false;
}

function hairBack(look: Look, cx: number, cy: number): string {
  switch (look.hairStyle) {
    case 'long':
      return path(
        `M${cx - 12} ${cy} Q${cx - 14} ${cy + 20} ${cx - 8} ${cy + 22} H${cx + 8} Q${cx + 14} ${cy + 20} ${cx + 12} ${cy} Z`,
        look.hair,
        o,
      );
    case 'bun':
      return circle(cx, cy - 13, 5, look.hair, o);
    case 'curly':
      return [-10, -4, 4, 10].map((dx) => circle(cx + dx, cy - 8, 5, look.hair, o)).join('');
    default:
      return '';
  }
}

function hairFront(look: Look, cx: number, cy: number, back: boolean): string {
  const h = look.hair;
  if (back) {
    if (look.hairStyle === 'bald') return '';
    return path(
      `M${cx - 12} ${cy + 2} A12 12 0 0 1 ${cx + 12} ${cy + 2} L${cx + 12} ${cy + 8} Q${cx} ${cy + 12} ${cx - 12} ${cy + 8} Z`,
      h,
      o,
    );
  }
  switch (look.hairStyle) {
    case 'bald':
      return '';
    case 'spiky':
      return path(
        `M${cx - 12} ${cy - 1} L${cx - 10} ${cy - 13} L${cx - 5} ${cy - 8} L${cx} ${cy - 16} L${cx + 5} ${cy - 8} L${cx + 10} ${cy - 13} L${cx + 12} ${cy - 1} Q${cx} ${cy - 6} ${cx - 12} ${cy - 1} Z`,
        h,
        o,
      );
    case 'slick':
      return path(
        `M${cx - 12} ${cy - 1} Q${cx - 10} ${cy - 13} ${cx + 2} ${cy - 13} Q${cx + 13} ${cy - 12} ${cx + 12} ${cy - 2} Q${cx + 2} ${cy - 9} ${cx - 12} ${cy - 1} Z`,
        h,
        o,
      );
    case 'curly':
      return [-8, -2, 4, 9].map((dx) => circle(cx + dx, cy - 9, 4.5, h, o)).join('');
    default:
      return path(
        `M${cx - 12} ${cy} A12 12 0 0 1 ${cx + 12} ${cy} Q${cx + 4} ${cy - 6} ${cx - 12} ${cy} Z`,
        h,
        o,
      );
  }
}

function hat(look: Look, cx: number, cy: number, side: boolean): string {
  const c = look.hatColor ?? '#e04848';
  switch (look.hat) {
    case 'cap':
      return (
        path(`M${cx - 12} ${cy - 2} A12 11 0 0 1 ${cx + 12} ${cy - 2} Z`, c, o) +
        rect(side ? cx : cx - 14, cy - 4, side ? 14 : 28, 3, dark(c, 0.2), { rx: 1.5, ...o })
      );
    case 'beanie':
      return (
        path(`M${cx - 12} ${cy - 1} A12 12 0 0 1 ${cx + 12} ${cy - 1} Z`, c, o) +
        circle(cx, cy - 13, 3, c, o)
      );
    case 'chef':
      return (
        rect(cx - 10, cy - 20, 20, 12, '#ffffff', { rx: 5, ...o }) +
        rect(cx - 11, cy - 9, 22, 6, '#ffffff', o)
      );
    case 'hard':
      return (
        path(`M${cx - 13} ${cy - 1} A13 12 0 0 1 ${cx + 13} ${cy - 1} Z`, '#f5c518', o) +
        rect(cx - 15, cy - 2, 30, 3, '#f5c518', o)
      );
    case 'doorman':
      return rect(cx - 11, cy - 14, 22, 10, c, { rx: 2, ...o }) + rect(cx - 13, cy - 5, 26, 3, INK);
    case 'ranger':
      return path(
        `M${cx - 16} ${cy - 3} H${cx + 16} L${cx + 9} ${cy - 7} L${cx + 6} ${cy - 16} H${cx - 6} L${cx - 9} ${cy - 7} Z`,
        '#9a7b4f',
        o,
      );
    case 'visor':
      return (
        rect(cx - 12, cy - 8, 24, 4, '#3aa36a', o) +
        path(`M${cx - 8} ${cy - 4} H${cx + 10} L${cx + 14} ${cy} H${cx - 4} Z`, '#3aa36a', o)
      );
    case 'band':
      return rect(cx - 12, cy - 8, 24, 4, c, o);
    default:
      return '';
  }
}

/** The figure in its 64×96 box. */
export function figure(look: Look, pose: Pose, dir: Dir): string {
  if (dir === 'w') return g(figure(look, pose, 'e'), { transform: 'translate(64 0) scale(-1 1)' });
  const side = dir === 'e';
  const back = dir === 'n';
  const slump = pose === 'slump';
  const cx = side ? 33 : 32;
  const headY = slump ? 26 : 22;
  const torsoW = side ? 14 : look.round ? 28 : 24;
  const tx = 32 - torsoW / 2;
  let s = ellipse(32, 93, 15, 3, '#000000', { opacity: 0.2 });

  // Legs.
  const leg = (x: number, lift: number, angle: number): string =>
    g(
      rect(x - 3.5, 62, 7, 24 - lift, look.pants, { rx: 2, ...o }) +
        ellipse(x + (side ? 2 : 0), 88 - lift, side ? 6 : 4.5, 3, look.shoes, o),
      angle === 0 ? {} : { transform: `rotate(${angle} ${x} 62)` },
    );
  if (side) {
    const swing = pose === 'walk1' ? 18 : pose === 'walk2' ? -18 : 0;
    s += leg(32, 0, -swing) + leg(32, 0, swing);
  } else {
    const l = pose === 'walk1' ? 4 : 0;
    const r = pose === 'walk2' ? 4 : 0;
    s += leg(27, l, 0) + leg(37, r, 0);
  }

  if (has(look, 'backpack') && side) s += rect(20, 38, 9, 20, '#7a5c3a', { rx: 3, ...o });

  // Torso (a backpack seen from behind sits on top of it).
  s += rect(tx, 36, torsoW, 30, look.shirt, { rx: 7, ...o });
  if (has(look, 'backpack') && back) s += rect(22, 38, 20, 24, '#7a5c3a', { rx: 4, ...o });
  if (has(look, 'backpack') && !back && !side)
    s += path(`M${tx + 5} 37 V52 M${tx + torsoW - 5} 37 V52`, 'none', {
      ...o,
      stroke: '#7a5c3a',
      'stroke-width': 2.5,
    });
  if (!back) {
    if (has(look, 'coat'))
      s += path(
        `M${tx} 40 V66 H${32 - 3} V40 Z M${32 + 3} 40 V66 H${tx + torsoW} V40 Z`,
        '#ffffff',
        o,
      );
    if (has(look, 'overalls')) s += rect(tx + 4, 48, torsoW - 8, 18, look.pants, { rx: 2, ...o });
    if (has(look, 'vest'))
      s += path(
        `M${tx} 40 L${32 - 2} 58 V66 H${tx} Z M${tx + torsoW} 40 L${32 + 2} 58 V66 H${tx + torsoW} Z`,
        dark(look.shirt === '#FF00FF' ? '#6b4a2b' : look.shirt, 0.3),
        o,
      );
    if (has(look, 'apron')) s += rect(tx + 3, 46, torsoW - 6, 22, '#fdfdfd', { rx: 2, ...o });
    if (has(look, 'tie') && !side) s += path('M32 38 L29.5 42 L32 56 L34.5 42 Z', '#b3261e', o);
    if (has(look, 'scarf')) s += rect(tx - 1, 35, torsoW + 2, 5, '#e9a23b', { rx: 2, ...o });
    if (has(look, 'stethoscope') && !side)
      s +=
        path('M26 38 Q26 52 32 52 Q38 52 38 38', 'none', { ...o, 'stroke-width': 1.6 }) +
        circle(32, 53, 2, '#9aa5b1', o);
  }

  // Arms.
  const skinHand = (x: number, y: number): string => circle(x, y, 3.2, look.skin, o);
  if (pose === 'cheer') {
    s +=
      rect(tx - 6, 18, 6.5, 22, look.shirt, {
        rx: 3,
        ...o,
        transform: `rotate(-20 ${tx - 3} 38)`,
      }) + skinHand(tx - 9, 17);
    s +=
      rect(tx + torsoW - 0.5, 18, 6.5, 22, look.shirt, {
        rx: 3,
        ...o,
        transform: `rotate(20 ${tx + torsoW + 3} 38)`,
      }) + skinHand(tx + torsoW + 9, 17);
  } else if (side) {
    const swing = pose === 'walk1' ? -22 : pose === 'walk2' ? 22 : 0;
    s += g(
      rect(29.5, 38, 7, 22, look.shirt, { rx: 3, ...o }) + skinHand(33, 61),
      swing === 0 ? {} : { transform: `rotate(${swing} 33 39)` },
    );
  } else {
    const drop = slump ? 3 : 0;
    const lsw = pose === 'walk1' ? 10 : pose === 'walk2' ? -10 : 4;
    s += g(
      rect(tx - 6, 38 + drop, 6.5, 22, look.shirt, { rx: 3, ...o }) + skinHand(tx - 3, 61 + drop),
      { transform: `rotate(${lsw} ${tx - 3} 39)` },
    );
    s += g(
      rect(tx + torsoW - 0.5, 38 + drop, 6.5, 22, look.shirt, { rx: 3, ...o }) +
        skinHand(tx + torsoW + 3, 61 + drop),
      { transform: `rotate(${-lsw} ${tx + torsoW + 3} 39)` },
    );
  }
  if (!back && pose !== 'cheer') {
    if (has(look, 'briefcase'))
      s += rect(side ? 34 : tx + torsoW - 2, 58, 12, 10, '#6b4a2b', { rx: 2, ...o });
    if (has(look, 'book')) s += rect(side ? 34 : tx - 10, 50, 9, 12, '#4a7fb5', { rx: 1, ...o });
    if (has(look, 'phone'))
      s += rect(side ? 36 : tx + torsoW + 1, 54, 5, 8, '#2b3a4a', { rx: 1, ...o });
  }

  // Head.
  s += hairBack(look, cx, headY);
  s += rect(cx - 3, headY + 9, 6, 6, look.skin, o);
  s += circle(cx, headY, 12, look.skin, o);
  if (side && !back) s += circle(cx + 11, headY + 2, 2, look.skin, o);
  s += hairFront(look, cx, headY, back);
  if (!back) {
    const eyes: [number, number][] = side
      ? [[cx + 6, headY]]
      : [
          [cx - 4.5, headY],
          [cx + 4.5, headY],
        ];
    if (has(look, 'shades')) {
      s += side
        ? rect(cx + 2, headY - 3, 9, 5, '#1d1d1d', { rx: 2 })
        : rect(cx - 9, headY - 3, 18, 5, '#1d1d1d', { rx: 2 });
    } else {
      for (const [ex, ey] of eyes) s += circle(ex, ey, 1.6, INK);
      if (has(look, 'glasses'))
        for (const [ex, ey] of eyes)
          s += circle(ex, ey, 3.4, 'none', { ...o, 'stroke-width': 1.1 });
    }
    if (slump && !side) {
      s += path(
        `M${cx - 7} ${headY - 5} L${cx - 2} ${headY - 3} M${cx + 7} ${headY - 5} L${cx + 2} ${headY - 3}`,
        'none',
        o,
      );
    }
    const mouthY = headY + 6;
    s +=
      pose === 'cheer'
        ? path(
            side
              ? `M${cx + 3} ${mouthY - 1} Q${cx + 7} ${mouthY + 4} ${cx + 10} ${mouthY - 1} Z`
              : `M${cx - 5} ${mouthY - 1} Q${cx} ${mouthY + 6} ${cx + 5} ${mouthY - 1} Z`,
            '#7a2b1f',
            o,
          )
        : slump
          ? path(
              side
                ? `M${cx + 4} ${mouthY + 2} Q${cx + 7} ${mouthY - 1} ${cx + 9} ${mouthY + 2}`
                : `M${cx - 4} ${mouthY + 2} Q${cx} ${mouthY - 2} ${cx + 4} ${mouthY + 2}`,
              'none',
              o,
            )
          : path(
              side
                ? `M${cx + 4} ${mouthY} Q${cx + 7} ${mouthY + 2.5} ${cx + 9} ${mouthY}`
                : `M${cx - 4} ${mouthY} Q${cx} ${mouthY + 4} ${cx + 4} ${mouthY}`,
              'none',
              o,
            );
    if (has(look, 'beard'))
      s += path(
        side
          ? `M${cx} ${headY + 4} Q${cx + 6} ${headY + 16} ${cx + 11} ${headY + 5}`
          : `M${cx - 10} ${headY + 3} Q${cx} ${headY + 18} ${cx + 10} ${headY + 3} Q${cx} ${headY + 9} ${cx - 10} ${headY + 3} Z`,
        look.hair,
        o,
      );
    if (has(look, 'headset'))
      s +=
        path(`M${cx - 12} ${headY} A12 12 0 0 1 ${cx + 12} ${headY}`, 'none', {
          ...o,
          'stroke-width': 2,
        }) + rect(cx - 14, headY - 2, 4, 7, '#2b3a4a', { rx: 1.5 });
  }
  s += hat(look, cx, headY, side);
  return s;
}

/** Primary and secondary key colours (17.4): shirt and trousers of every avatar. */
export const KEY_SHIRT = '#FF00FF';
export const KEY_PANTS = '#00FFFF';

const avatarLook = (l: Omit<Look, 'shirt' | 'pants'>): Look => ({
  ...l,
  shirt: KEY_SHIRT,
  pants: KEY_PANTS,
});

/** Six player avatars with distinct silhouettes, and one per AI personality. */
export const AVATAR_LOOKS: Record<string, Look> = {
  'player-1': avatarLook({
    skin: '#f1c7a1',
    hair: '#6b4226',
    hairStyle: 'short',
    shoes: '#3a2a1f',
  }),
  'player-2': avatarLook({ skin: '#8d5a3b', hair: '#1f1a17', hairStyle: 'long', shoes: '#5a2a3a' }),
  'player-3': avatarLook({
    skin: '#c68642',
    hair: '#2a1c14',
    hairStyle: 'curly',
    shoes: '#2b3a4a',
    round: true,
  }),
  'player-4': avatarLook({ skin: '#e0ac69', hair: '#8b3a1f', hairStyle: 'bun', shoes: '#3a2a1f' }),
  'player-5': avatarLook({
    skin: '#ffdbac',
    hair: '#e8c35a',
    hairStyle: 'spiky',
    shoes: '#2b2b2b',
    hat: 'cap',
    hatColor: '#2f6fb5',
  }),
  'player-6': avatarLook({
    skin: '#6b3e26',
    hair: '#1f1a17',
    hairStyle: 'short',
    shoes: '#5c4d3f',
    hat: 'beanie',
    hatColor: '#e9a23b',
    extras: ['backpack'],
  }),
  'rival-grinder': avatarLook({
    skin: '#e0ac69',
    hair: '#3a2a1f',
    hairStyle: 'bald',
    shoes: '#1d1d1d',
    extras: ['tie', 'briefcase'],
  }),
  'rival-scholar': avatarLook({
    skin: '#f1c7a1',
    hair: '#9aa0a6',
    hairStyle: 'gray',
    shoes: '#5c4d3f',
    extras: ['glasses', 'book'],
  }),
  'rival-hustler': avatarLook({
    skin: '#c68642',
    hair: '#1f1a17',
    hairStyle: 'slick',
    shoes: '#b3261e',
    extras: ['shades', 'phone'],
  }),
  'rival-balanced': avatarLook({
    skin: '#8d5a3b',
    hair: '#2a1c14',
    hairStyle: 'curly',
    shoes: '#3a5a3a',
    hat: 'band',
    hatColor: '#3aa36a',
    extras: ['backpack'],
  }),
};

const FALLBACK_LOOK = avatarLook({
  skin: '#e0ac69',
  hair: '#6b4226',
  hairStyle: 'short',
  shoes: '#3a2a1f',
});

export function avatarSvg(avatarId: string, pose: Pose, dir: Dir): string {
  return svg(64, 96, figure(AVATAR_LOOKS[avatarId] ?? FALLBACK_LOOK, pose, dir));
}

/** Hosts: one per location, in its uniform. */
export const HOST_LOOKS: Record<string, Look> = {
  'low-housing': {
    skin: '#c68642',
    hair: '#2a1c14',
    hairStyle: 'curly',
    shirt: '#7a9cc6',
    pants: '#4a4a5a',
    shoes: '#3a2a1f',
    extras: ['scarf'],
  },
  'rent-office': {
    skin: '#f1c7a1',
    hair: '#6b4226',
    hairStyle: 'bun',
    shirt: '#d9d2c3',
    pants: '#5d6f91',
    shoes: '#1d1d1d',
    extras: ['vest', 'glasses'],
  },
  'pawn-shop': {
    skin: '#e0ac69',
    hair: '#3a2a1f',
    hairStyle: 'short',
    shirt: '#b58fc9',
    pants: '#4a3a5a',
    shoes: '#1d1d1d',
    hat: 'visor',
    extras: ['beard'],
  },
  'discount-store': {
    skin: '#8d5a3b',
    hair: '#1f1a17',
    hairStyle: 'long',
    shirt: '#e0625a',
    pants: '#3a3a4a',
    shoes: '#1d1d1d',
    extras: ['vest'],
  },
  'burger-joint': {
    skin: '#ffdbac',
    hair: '#e8c35a',
    hairStyle: 'short',
    shirt: '#f28c5a',
    pants: '#3a3a4a',
    shoes: '#1d1d1d',
    hat: 'chef',
    extras: ['apron'],
  },
  'clothing-boutique': {
    skin: '#c68642',
    hair: '#8b3a1f',
    hairStyle: 'long',
    shirt: '#f2a7c3',
    pants: '#2b2b3a',
    shoes: '#8a3a5f',
    extras: ['scarf'],
  },
  'electronics-store': {
    skin: '#f1c7a1',
    hair: '#1f1a17',
    hairStyle: 'spiky',
    shirt: '#4a90d9',
    pants: '#2b3a4a',
    shoes: '#1d1d1d',
    extras: ['headset'],
  },
  university: {
    skin: '#e0ac69',
    hair: '#9aa0a6',
    hairStyle: 'gray',
    shirt: '#9a7b4f',
    pants: '#5c4d3f',
    shoes: '#3a2a1f',
    extras: ['glasses', 'beard', 'book'],
  },
  'employment-office': {
    skin: '#6b3e26',
    hair: '#1f1a17',
    hairStyle: 'short',
    shirt: '#5d6f91',
    pants: '#2b2b3a',
    shoes: '#1d1d1d',
    extras: ['tie'],
  },
  factory: {
    skin: '#e0ac69',
    hair: '#6b4226',
    hairStyle: 'short',
    shirt: '#6f8fae',
    pants: '#3b5a7a',
    shoes: '#3a2a1f',
    hat: 'hard',
    extras: ['overalls'],
  },
  bank: {
    skin: '#ffdbac',
    hair: '#3a2a1f',
    hairStyle: 'slick',
    shirt: '#2b3a4a',
    pants: '#2b2b3a',
    shoes: '#1d1d1d',
    extras: ['tie'],
  },
  grocery: {
    skin: '#8d5a3b',
    hair: '#2a1c14',
    hairStyle: 'short',
    shirt: '#9ccf8a',
    pants: '#3a4a3a',
    shoes: '#3a2a1f',
    hat: 'cap',
    hatColor: '#4f9140',
    extras: ['apron'],
  },
  'secure-apartments': {
    skin: '#c68642',
    hair: '#1f1a17',
    hairStyle: 'short',
    shirt: '#2b3a67',
    pants: '#2b2b3a',
    shoes: '#1d1d1d',
    hat: 'doorman',
    hatColor: '#2b3a67',
  },
  'appliance-depot': {
    skin: '#f1c7a1',
    hair: '#8b3a1f',
    hairStyle: 'short',
    shirt: '#c9d6de',
    pants: '#4a90d9',
    shoes: '#3a2a1f',
    hat: 'cap',
    hatColor: '#4a90d9',
    extras: ['overalls'],
  },
  clinic: {
    skin: '#e0ac69',
    hair: '#2a1c14',
    hairStyle: 'bun',
    shirt: '#8fd3c4',
    pants: '#8fd3c4',
    shoes: '#ffffff',
    extras: ['coat', 'stethoscope'],
  },
  park: {
    skin: '#c68642',
    hair: '#6b4226',
    hairStyle: 'short',
    shirt: '#7a9a5a',
    pants: '#6b5a3a',
    shoes: '#3a2a1f',
    hat: 'ranger',
  },
};

const FALLBACK_HOST: Look = {
  skin: '#e0ac69',
  hair: '#3a2a1f',
  hairStyle: 'short',
  shirt: '#9a7b4f',
  pants: '#3a3a4a',
  shoes: '#1d1d1d',
};

export function hostSvg(locationId: string): string {
  const look = HOST_LOOKS[locationId] ?? FALLBACK_HOST;
  return svg(400, 600, g(figure(look, 'idle', 's'), { transform: 'scale(6.25)' }));
}
