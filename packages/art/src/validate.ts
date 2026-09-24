/**
 * Art-set validator (ART_SPEC 17.2, 17.8). One function for bundled sets (`pnpm art:check`) and
 * user imports (M9.12): schema, catalog coverage, files, viewBox sizes, sanitizer, tint keys,
 * board layout, theme contrast and byte budgets. Issues carry a path so a report points at the
 * exact manifest field or file.
 */
import { type SlotSpec, slotSpecFor } from './catalog.js';
import { paletteIssues } from './contrast.js';
import {
  BUNDLED_LIMITS,
  checkSvg,
  defaultParseXml,
  type ParseXml,
  type SvgLimits,
} from './sanitize.js';
import { ArtManifestSchema, STAGE, type ArtManifest, type Palette, type Point } from './schema.js';
import { hasTintKey } from './tint.js';

export interface ArtIssue {
  path: string;
  message: string;
}

export interface ValidateOptions {
  /** Required slots (from `catalogFor`). */
  catalog: readonly SlotSpec[];
  /** Board sizes of every pack the set must serve; a base set's layout must fit each. */
  boardSizes: readonly number[];
  /** File name (relative to `files/`) → SVG text. */
  files: ReadonlyMap<string, string>;
  limits?: SvgLimits;
  /** Whole-set byte budget. */
  maxTotalBytes?: number;
  parseXml?: ParseXml;
}

export interface ValidateResult {
  ok: boolean;
  manifest?: ArtManifest;
  issues: ArtIssue[];
}

export const BUNDLED_SET_MAX_BYTES = 1.5 * 1024 * 1024;

function inStage(p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= STAGE.width && p.y <= STAGE.height;
}

export function validateArtSet(raw: unknown, opts: ValidateOptions): ValidateResult {
  const parsed = ArtManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: `manifest.${i.path.join('.')}`,
        message: i.message,
      })),
    };
  }
  const m = parsed.data;
  const issues: ArtIssue[] = [];
  const add = (path: string, message: string): void => {
    issues.push({ path, message });
  };
  const isBase = m.extends === undefined;

  // Base sets carry everything a scene needs; a set that extends one may override any part.
  if (isBase) {
    if (!m.theme) add('manifest.theme', 'a base set must define a theme');
    if (!m.board) add('manifest.board', 'a base set must define a board layout');
    for (const slot of opts.catalog) {
      if (!slot.optional && !(slot.key in m.assets)) {
        add(`manifest.assets.${slot.key}`, 'missing: a base set must define every slot');
      }
    }
  }
  if (m.theme) {
    for (const msg of paletteIssues(m.theme.palette as Palette)) add('manifest.theme.palette', msg);
    for (const [name, key] of Object.entries(m.theme.frames ?? {})) {
      if (key !== undefined && !key.startsWith('frame:'))
        add(`manifest.theme.frames.${name}`, 'must be a frame:* key');
    }
  }
  if (m.board) {
    const { slots, path } = m.board;
    for (const size of new Set(opts.boardSizes)) {
      if (slots.length !== size) {
        add('manifest.board.slots', `has ${slots.length} slots; a pack board has ${size}`);
      }
    }
    if (path.length !== slots.length) {
      add('manifest.board.path', `has ${path.length} waypoints for ${slots.length} slots`);
    }
    slots.forEach((s, i) => {
      const corner = { x: s.rect.x + s.rect.width, y: s.rect.y + s.rect.height };
      for (const [name, p] of [
        ['rect', s.rect],
        ['rect', corner],
        ['door', s.door],
        ['label', s.label],
      ] as const) {
        if (!inStage(p)) add(`manifest.board.slots.${i}.${name}`, 'lies outside the stage');
      }
    });
    path.forEach((p, i) => {
      if (!inStage(p)) add(`manifest.board.path.${i}`, 'lies outside the stage');
    });
  }

  const limits = opts.limits ?? BUNDLED_LIMITS;
  const parseXml = opts.parseXml ?? defaultParseXml;
  const referenced = new Set<string>();
  let totalBytes = 0;
  for (const [key, entry] of Object.entries(m.assets)) {
    const path = `manifest.assets.${key}`;
    const spec = slotSpecFor(key, opts.catalog);
    if (!spec) {
      add(path, 'unknown slot key');
      continue;
    }
    if (entry.width !== spec.width || entry.height !== spec.height) {
      add(path, `size ${entry.width}×${entry.height}; the slot is ${spec.width}×${spec.height}`);
    }
    referenced.add(entry.file);
    const text = opts.files.get(entry.file);
    if (text === undefined) {
      add(`files/${entry.file}`, `missing (referenced by ${key})`);
      continue;
    }
    const check = checkSvg(text, limits, parseXml);
    for (const msg of check.issues) add(`files/${entry.file}`, msg);
    if (
      check.viewBox &&
      (check.viewBox.width !== entry.width || check.viewBox.height !== entry.height)
    ) {
      add(
        `files/${entry.file}`,
        `viewBox is ${check.viewBox.width}×${check.viewBox.height}; manifest says ${entry.width}×${entry.height}`,
      );
    }
    if (isBase && spec.tint && !hasTintKey(text, m.tintKeys.primary)) {
      add(`files/${entry.file}`, `tintable slot ${key} uses no primary key colour`);
    }
  }
  for (const [file, text] of opts.files) {
    totalBytes += new TextEncoder().encode(text).length;
    if (!referenced.has(file)) add(`files/${file}`, 'not referenced by the manifest');
  }
  const maxTotal = opts.maxTotalBytes ?? BUNDLED_SET_MAX_BYTES;
  if (totalBytes > maxTotal) add('files', `set is ${totalBytes} bytes; the limit is ${maxTotal}`);

  return issues.length === 0
    ? { ok: true, manifest: m, issues }
    : { ok: false, manifest: m, issues };
}
