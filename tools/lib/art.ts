/**
 * Shared I/O for `pnpm art:check` and `pnpm art:placeholders` (ART_SPEC 17.3, 17.8): reads art
 * sets from disk, derives the slot catalog from every bundled pack, and formats reports. The
 * rules themselves live in `@hustle-ring/art`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  catalogFor,
  isPlaceholder,
  type ArtManifest,
  type ParseXml,
  type SlotGroup,
  type SlotSpec,
} from '@hustle-ring/art';
import { loadPack, PACK_IDS } from '@hustle-ring/content';

export interface ArtSetOnDisk {
  id: string;
  dir: string;
  /** Parsed JSON, not yet validated; `undefined` when `manifest.json` is missing. */
  manifest: unknown;
  files: Map<string, string>;
}

export interface PackCatalog {
  catalog: SlotSpec[];
  boardSizes: number[];
}

/** Node has no `DOMParser`; jsdom's behaves like the browser's. */
export const nodeParseXml: ParseXml = (text) =>
  new new JSDOM('').window.DOMParser().parseFromString(text, 'image/svg+xml');

export function catalogFromPacks(packIds: readonly string[] = PACK_IDS): PackCatalog {
  const locationIds = new Set<string>();
  const personalityIds = new Set<string>();
  const boardSizes = new Set<number>();
  for (const id of packIds) {
    const pack = loadPack(id);
    for (const loc of pack.board.locationAt) if (loc !== null) locationIds.add(loc);
    for (const p of pack.personalities) personalityIds.add(p.id);
    boardSizes.add(pack.board.locationAt.length);
  }
  return {
    catalog: catalogFor({ locationIds: [...locationIds], personalityIds: [...personalityIds] }),
    boardSizes: [...boardSizes].sort((a, b) => a - b),
  };
}

export function listSets(setsDir: string): string[] {
  if (!existsSync(setsDir)) return [];
  return readdirSync(setsDir)
    .filter((d) => statSync(join(setsDir, d)).isDirectory())
    .sort();
}

export function readSet(setsDir: string, id: string): ArtSetOnDisk {
  const dir = join(setsDir, id);
  const manifestPath = join(dir, 'manifest.json');
  const manifest: unknown = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : undefined;
  const files = new Map<string, string>();
  const filesDir = join(dir, 'files');
  if (existsSync(filesDir)) {
    for (const f of readdirSync(filesDir).sort()) {
      if (f.endsWith('.svg')) files.set(f, readFileSync(join(filesDir, f), 'utf8'));
    }
  }
  return { id, dir, manifest, files };
}

export function writeSet(
  dir: string,
  manifest: ArtManifest,
  writes: ReadonlyMap<string, string>,
): void {
  mkdirSync(join(dir, 'files'), { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [file, text] of writes) writeFileSync(join(dir, 'files', file), text);
}

export interface DrawnReport {
  group: SlotGroup;
  drawn: number;
  total: number;
}

/** Drawn vs placeholder per slot group (the M9.13 tracker, `art:check --report`). */
export function drawnReport(
  manifest: ArtManifest,
  files: ReadonlyMap<string, string>,
  catalog: readonly SlotSpec[],
): DrawnReport[] {
  const rows = new Map<SlotGroup, DrawnReport>();
  for (const slot of catalog) {
    const row = rows.get(slot.group) ?? { group: slot.group, drawn: 0, total: 0 };
    row.total++;
    const file = manifest.assets[slot.key]?.file;
    const text = file === undefined ? undefined : files.get(file);
    if (text !== undefined && !isPlaceholder(text)) row.drawn++;
    rows.set(slot.group, row);
  }
  return [...rows.values()];
}
