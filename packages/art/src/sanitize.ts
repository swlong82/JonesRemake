/**
 * SVG sanitizer (ART_SPEC 17.6). Allowlist check, not a rewriter: a file either passes unchanged
 * or is rejected with one issue per violation, so an artist gets a precise report and nothing is
 * silently altered. Rendering art only as `<img>` (17.5) is the second line of defence.
 */

export interface SvgLimits {
  maxBytes: number;
  maxElements: number;
}

export const BUNDLED_LIMITS: SvgLimits = { maxBytes: 60 * 1024, maxElements: 5000 };
export const USER_LIMITS: SvgLimits = { maxBytes: 256 * 1024, maxElements: 5000 };

export interface SvgCheck {
  ok: boolean;
  issues: string[];
  /** Size from the root `viewBox` (width, height), when present and well formed. */
  viewBox?: { width: number; height: number };
}

/** Parses SVG text into a DOM. The browser and jsdom both provide `DOMParser`. */
export type ParseXml = (text: string) => Document;

export const defaultParseXml: ParseXml = (text) =>
  new DOMParser().parseFromString(text, 'image/svg+xml');

export const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'metadata',
  'style',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'pattern',
  'filter',
  'fegaussianblur',
  'feoffset',
  'feblend',
  'fecolormatrix',
  'fecomposite',
  'feflood',
  'femerge',
  'femergenode',
  'fedropshadow',
]);

/** Attribute names (lower-cased). `data-*`, `aria-*` and `xmlns*` are also allowed. */
export const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'id',
  'class',
  'style',
  'version',
  'viewbox',
  'preserveaspectratio',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'd',
  'points',
  'pathlength',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'display',
  'visibility',
  'overflow',
  'clip-path',
  'clip-rule',
  'mask',
  'filter',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'patternunits',
  'patterntransform',
  'patterncontentunits',
  'clippathunits',
  'maskunits',
  'maskcontentunits',
  'filterunits',
  'primitiveunits',
  'in',
  'in2',
  'result',
  'stddeviation',
  'dx',
  'dy',
  'mode',
  'operator',
  'k1',
  'k2',
  'k3',
  'k4',
  'values',
  'type',
  'flood-color',
  'flood-opacity',
  'href',
  'xlink:href',
  'xml:space',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'paint-order',
  'vector-effect',
  'shape-rendering',
  'mix-blend-mode',
  'isolation',
]);

// `url(` must point at a fragment in the same file; anything else could fetch.
const EXTERNAL_URL = /url\(\s*(?!['"]?#)/i;
const BAD_SCHEMES = /(javascript|vbscript|data)\s*:/i;

function attributeIssues(el: Element): string[] {
  const issues: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const where = `<${el.localName}> attribute "${attr.name}"`;
    if (name.startsWith('on')) {
      issues.push(`${where}: event handlers are not allowed`);
      continue;
    }
    const allowed =
      ALLOWED_ATTRIBUTES.has(name) ||
      name.startsWith('data-') ||
      name.startsWith('aria-') ||
      name === 'xmlns' ||
      name.startsWith('xmlns:');
    if (!allowed) {
      issues.push(`${where}: not on the allowlist`);
      continue;
    }
    const value = attr.value;
    if ((name === 'href' || name === 'xlink:href') && !value.trim().startsWith('#')) {
      issues.push(`${where}: only same-file "#id" references are allowed`);
    }
    if (name.startsWith('xmlns')) continue;
    if (BAD_SCHEMES.test(value)) issues.push(`${where}: script and data URLs are not allowed`);
    if (EXTERNAL_URL.test(value)) issues.push(`${where}: url() must reference "#id"`);
  }
  return issues;
}

function styleIssues(css: string, where: string): string[] {
  const issues: string[] = [];
  if (/@import/i.test(css)) issues.push(`${where}: @import is not allowed`);
  if (EXTERNAL_URL.test(css)) issues.push(`${where}: url() must reference "#id"`);
  if (BAD_SCHEMES.test(css)) issues.push(`${where}: script and data URLs are not allowed`);
  if (/expression\s*\(/i.test(css)) issues.push(`${where}: CSS expressions are not allowed`);
  return issues;
}

function parseViewBox(raw: string | null): { width: number; height: number } | undefined {
  if (raw === null) return undefined;
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [, , width, height] = parts as [number, number, number, number];
  return width > 0 && height > 0 ? { width, height } : undefined;
}

export function checkSvg(
  text: string,
  limits: SvgLimits = BUNDLED_LIMITS,
  parseXml: ParseXml = defaultParseXml,
): SvgCheck {
  const issues: string[] = [];
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > limits.maxBytes) {
    issues.push(`file is ${bytes} bytes; the limit is ${limits.maxBytes}`);
  }
  // Entities can expand without bound and DTDs can reference external files: refuse both before
  // the parser ever sees them.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    issues.push('DOCTYPE and ENTITY declarations are not allowed');
    return { ok: false, issues };
  }
  let doc: Document;
  try {
    doc = parseXml(text);
  } catch {
    return { ok: false, issues: [...issues, 'not well-formed XML'] };
  }
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, issues: [...issues, 'not well-formed XML'] };
  }
  if (root.localName !== 'svg') {
    return { ok: false, issues: [...issues, `root element is <${root.localName}>, not <svg>`] };
  }
  const all = [root, ...Array.from(root.getElementsByTagName('*'))];
  if (all.length > limits.maxElements) {
    issues.push(`${all.length} elements; the limit is ${limits.maxElements}`);
  }
  for (const el of all) {
    const name = el.localName.toLowerCase();
    if (el.prefix !== null || !ALLOWED_ELEMENTS.has(name)) {
      issues.push(`<${el.tagName}> is not on the allowlist`);
      continue;
    }
    issues.push(...attributeIssues(el));
    const style = el.getAttribute('style');
    if (style !== null) issues.push(...styleIssues(style, `<${el.localName}> style attribute`));
    if (name === 'style') issues.push(...styleIssues(el.textContent, '<style>'));
  }
  const viewBox = parseViewBox(root.getAttribute('viewBox'));
  if (!viewBox) issues.push('root <svg> needs a viewBox "minX minY width height"');
  return viewBox ? { ok: issues.length === 0, issues, viewBox } : { ok: false, issues };
}
