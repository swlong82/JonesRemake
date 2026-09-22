/**
 * AssetRegistry (EXTENSIBILITY 12.5, ROADMAP 16.1): every visual is looked up by string key and
 * rendered as a code-drawn placeholder + Lucide icon. Swapping in real art = a new registry
 * implementation; components never import assets directly. A missing key renders a labelled
 * fallback and never throws.
 */
import {
  Armchair,
  Bike,
  Book,
  BookOpen,
  Briefcase,
  Building,
  Circle,
  CupSoda,
  Dumbbell,
  Factory,
  Gamepad2,
  GraduationCap,
  Headphones,
  Home,
  Landmark,
  Laptop,
  Newspaper,
  Refrigerator,
  Shield,
  ShoppingBag,
  Smartphone,
  Tablet,
  Ticket,
  Trash2,
  Tv,
  type LucideIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';
import type { PaletteId, TokenShape } from '@hustle-ring/shared';

export interface VisualSpec {
  shape: string;
  color: string;
  icon: string;
}

export interface AssetRegistry {
  /** Icon component for a registry icon name. */
  icon(name: string): LucideIcon;
  /** Category color token (CSS variable name) for a location/item visual. */
  colorVar(token: string): string;
  /** Player token rendered inside an SVG group centred on (0,0), radius ~16. */
  token(shape: TokenShape, color: PaletteId, initial: string, size?: number): ReactElement;
  /** Whether a key is known (tests: every content visual key resolves). */
  has(key: string): boolean;
}

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  'shopping-bag': ShoppingBag,
  factory: Factory,
  landmark: Landmark,
  'graduation-cap': GraduationCap,
  building: Building,
  refrigerator: Refrigerator,
  tv: Tv,
  book: Book,
  ticket: Ticket,
  trash: Trash2,
  'cup-soda': CupSoda,
  newspaper: Newspaper,
  briefcase: Briefcase,
  armchair: Armchair,
  bike: Bike,
  'book-open': BookOpen,
  circle: Circle,
  dumbbell: Dumbbell,
  gamepad: Gamepad2,
  headphones: Headphones,
  laptop: Laptop,
  phone: Smartphone,
  shield: Shield,
  tablet: Tablet,
};

/** Color-blind-safe palette (Okabe–Ito based), also defined in index.css. */
export const PALETTE_HEX: Record<PaletteId, string> = {
  p1: '#0072B2',
  p2: '#E69F00',
  p3: '#009E73',
  p4: '#CC79A7',
};

export class PlaceholderAssetRegistry implements AssetRegistry {
  constructor(private readonly visuals: Record<string, VisualSpec>) {}

  icon(name: string): LucideIcon {
    return ICONS[name] ?? Building;
  }

  colorVar(token: string): string {
    return `var(--c-${token}, var(--c-fallback))`;
  }

  has(key: string): boolean {
    return key in this.visuals;
  }

  token(shape: TokenShape, color: PaletteId, initial: string, size = 16): ReactElement {
    const fill = PALETTE_HEX[color];
    const s = size;
    const text = (
      <text
        x={0}
        y={s * 0.35}
        textAnchor="middle"
        fontSize={s}
        fontWeight={700}
        fill="#fff"
        stroke="#000"
        strokeWidth={0.6}
        paintOrder="stroke"
        aria-hidden="true"
      >
        {initial}
      </text>
    );
    switch (shape) {
      case 'square':
        return (
          <g>
            <rect
              x={-s}
              y={-s}
              width={2 * s}
              height={2 * s}
              rx={3}
              fill={fill}
              stroke="#000"
              strokeWidth={2}
            />
            {text}
          </g>
        );
      case 'triangle':
        return (
          <g>
            <polygon
              points={`0,${-s * 1.2} ${s * 1.15},${s * 0.9} ${-s * 1.15},${s * 0.9}`}
              fill={fill}
              stroke="#000"
              strokeWidth={2}
            />
            {text}
          </g>
        );
      case 'diamond':
        return (
          <g>
            <polygon
              points={`0,${-s * 1.25} ${s * 1.25},0 0,${s * 1.25} ${-s * 1.25},0`}
              fill={fill}
              stroke="#000"
              strokeWidth={2}
            />
            {text}
          </g>
        );
      default:
        return (
          <g>
            <circle r={s} fill={fill} stroke="#000" strokeWidth={2} />
            {text}
          </g>
        );
    }
  }
}

export function locationKey(id: string): string {
  return `location:${id}`;
}
export function itemKey(id: string): string {
  return `item:${id}`;
}

const registries = new WeakMap<object, PlaceholderAssetRegistry>();

/** One placeholder registry per pack (visuals are immutable once the pack is resolved). */
export function registryFor(pack: {
  visuals: Record<string, VisualSpec>;
}): PlaceholderAssetRegistry {
  let r = registries.get(pack);
  if (!r) {
    r = new PlaceholderAssetRegistry(pack.visuals);
    registries.set(pack, r);
  }
  return r;
}
