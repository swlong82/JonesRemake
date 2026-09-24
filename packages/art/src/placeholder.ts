/**
 * Generated wireframes and the default board layout (ART_SPEC 17.3). A wireframe is the slot's
 * stand-in until it is drawn: frame, diagonal cross, key label, anchor mark and, for tintable
 * slots, swatches in the key colours. The marker comment lets the generator tell its own output
 * from drawn art, which it never overwrites.
 */
import type { SlotSpec } from './catalog.js';
import { STAGE, type BoardLayout, type BoardSlot } from './schema.js';
import type { TintKeys } from './tint.js';

export const PLACEHOLDER_MARKER = '<!-- art:placeholder -->';

export function isPlaceholder(svg: string): boolean {
  return svg.includes(PLACEHOLDER_MARKER);
}

const GROUP_FILL: Record<SlotSpec['group'], string> = {
  board: '#dfe9d8',
  building: '#f3e2c4',
  interior: '#e6dff0',
  host: '#f6d9cf',
  avatar: '#ffffff',
  weekend: '#d9e8f2',
  ui: '#ececec',
  frame: '#f7f7f7',
};

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Anchor of the slot in its own viewBox: bottom centre for figures and fronts, else centre. */
export function anchorFor(spec: Pick<SlotSpec, 'group' | 'width' | 'height'>): {
  x: number;
  y: number;
} {
  const bottom = spec.group === 'building' || spec.group === 'host' || spec.group === 'avatar';
  return { x: spec.width / 2, y: bottom ? spec.height : spec.height / 2 };
}

export function wireframeSvg(spec: SlotSpec, tintKeys: TintKeys): string {
  const { width: w, height: h } = spec;
  const stroke = Math.max(1, Math.round(Math.min(w, h) / 64));
  const font = Math.max(6, Math.round(Math.min(w / (spec.key.length * 0.62), h / 6)));
  const a = anchorFor(spec);
  const mark = Math.max(4, Math.round(Math.min(w, h) / 12));
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    PLACEHOLDER_MARKER,
    `<title>${escapeXml(spec.key)}</title>`,
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${GROUP_FILL[spec.group]}"/>`,
    `<g fill="none" stroke="#6b6b6b" stroke-width="${stroke}">`,
    `<rect x="${stroke / 2}" y="${stroke / 2}" width="${w - stroke}" height="${h - stroke}" stroke-dasharray="${stroke * 4} ${stroke * 3}"/>`,
    `<line x1="0" y1="0" x2="${w}" y2="${h}"/>`,
    `<line x1="${w}" y1="0" x2="0" y2="${h}"/>`,
    '</g>',
  ];
  if (spec.tint) {
    const sw = Math.round(w / 3);
    const sh = Math.round(h / 4);
    lines.push(
      `<rect x="${Math.round(w / 2 - sw)}" y="${Math.round(h / 2 - sh / 2)}" width="${sw}" height="${sh}" fill="${tintKeys.primary}"/>`,
      `<rect x="${Math.round(w / 2)}" y="${Math.round(h / 2 - sh / 2)}" width="${sw}" height="${sh}" fill="${tintKeys.secondary}"/>`,
    );
  }
  lines.push(
    `<g stroke="#c0392b" stroke-width="${stroke}">`,
    `<line x1="${a.x - mark}" y1="${a.y}" x2="${a.x + mark}" y2="${a.y}"/>`,
    `<line x1="${a.x}" y1="${a.y - mark}" x2="${a.x}" y2="${a.y + mark}"/>`,
    '</g>',
    `<text x="${w / 2}" y="${Math.round(h * 0.2)}" text-anchor="middle" font-family="sans-serif" font-size="${font}" fill="#1a1a1a">${escapeXml(spec.key)}</text>`,
    `<text x="${w / 2}" y="${Math.round(h * 0.2) + font + 2}" text-anchor="middle" font-family="sans-serif" font-size="${Math.max(5, Math.round(font * 0.6))}" fill="#545454">${w}×${h}</text>`,
    '</svg>',
    '',
  );
  return lines.join('\n');
}

/** `data:` URL of a wireframe, for the registry's synchronous fallback (17.5). */
export function wireframeDataUrl(spec: SlotSpec, tintKeys: TintKeys): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wireframeSvg(spec, tintKeys))}`;
}

/** Building-centre rectangle and the street rectangle inside it, in stage units. */
const OUTER = { left: 140, top: 130, right: STAGE.width - 140, bottom: STAGE.height - 130 };
const STREET = { left: 330, top: 320, right: STAGE.width - 330, bottom: STAGE.height - 320 };
const BUILDING = 180;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Default city-block layout for `n` squares: buildings spaced evenly around the outer rectangle,
 * clockwise from the top-left corner, facing a street loop around a central park. Ring index 0
 * sits at the top-left, matching the ring board's order.
 */
export function defaultBoardLayout(n: number): BoardLayout {
  const w = OUTER.right - OUTER.left;
  const h = OUTER.bottom - OUTER.top;
  const perimeter = 2 * (w + h);
  const slots: BoardSlot[] = [];
  for (let i = 0; i < n; i++) {
    let t = (i / n) * perimeter;
    let cx: number;
    let cy: number;
    if (t <= w) [cx, cy] = [OUTER.left + t, OUTER.top];
    else if ((t -= w) <= h) [cx, cy] = [OUTER.right, OUTER.top + t];
    else if ((t -= h) <= w) [cx, cy] = [OUTER.right - t, OUTER.bottom];
    else [cx, cy] = [OUTER.left, OUTER.bottom - (t - w)];
    const door = {
      x: round(clamp(cx, STREET.left, STREET.right)),
      y: round(clamp(cy, STREET.top, STREET.bottom)),
    };
    slots.push({
      rect: {
        x: round(cx - BUILDING / 2),
        y: round(cy - BUILDING / 2),
        width: BUILDING,
        height: BUILDING,
      },
      door,
      label: { x: round(cx), y: round(cy + BUILDING / 2 + 4) },
    });
  }
  return { slots, path: slots.map((s) => s.door) };
}
