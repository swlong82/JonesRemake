/**
 * Art-pack import (ART_SPEC 17.6, M9.12): a `.zip` with `manifest.json` and `files/*.svg`,
 * optionally inside one top-level folder. Everything is checked before anything is stored: entry
 * count and sizes (zip-bomb guard), UTF-8, JSON, the manifest schema, the reserved id, and every
 * SVG through the same validator and sanitizer as the bundled set, with the user limits.
 */
import {
  USER_LIMITS,
  validateArtSet,
  type ArtIssue,
  type ArtManifest,
  type ParseXml,
  type SlotSpec,
} from '@hustle-ring/art';
import { unzipSync } from 'fflate';

export const MAX_ENTRIES = 400;
export const MAX_PACK_BYTES = 4 * 1024 * 1024;

export interface ImportedPack {
  id: string;
  name: string;
  manifest: ArtManifest;
  files: Record<string, string>;
}

export interface ImportResult {
  ok: boolean;
  pack?: ImportedPack;
  issues: ArtIssue[];
  /** Entries that are neither the manifest nor an SVG under `files/`; skipped, not fatal. */
  ignored: string[];
}

export interface ImportOptions {
  catalog: readonly SlotSpec[];
  boardSizes: readonly number[];
  parseXml?: ParseXml;
}

/** Strip a single folder every entry shares (zips made by "compress folder"). */
function stripCommonFolder(names: readonly string[]): (name: string) => string {
  const first = names[0]?.split('/')[0];
  const shared =
    first !== undefined &&
    names.length > 0 &&
    names.every((n) => n.startsWith(`${first}/`) || n === `${first}/`);
  return shared ? (n) => n.slice(first.length + 1) : (n) => n;
}

export function readArtPackZip(bytes: Uint8Array, opts: ImportOptions): ImportResult {
  const issues: ArtIssue[] = [];
  const fail = (path: string, message: string): ImportResult => ({
    ok: false,
    issues: [...issues, { path, message }],
    ignored: [],
  });

  let entries: Record<string, Uint8Array>;
  let count = 0;
  let declared = 0;
  try {
    entries = unzipSync(bytes, {
      // Checked on the declared sizes before anything is inflated.
      filter: (f) => {
        count++;
        declared += f.originalSize;
        return count <= MAX_ENTRIES && declared <= MAX_PACK_BYTES && !f.name.endsWith('/');
      },
    });
  } catch {
    return fail('zip', 'not a readable zip file');
  }
  if (count > MAX_ENTRIES) return fail('zip', `more than ${MAX_ENTRIES} entries`);
  if (declared > MAX_PACK_BYTES) return fail('zip', `more than ${MAX_PACK_BYTES} bytes unpacked`);

  const names = Object.keys(entries);
  const local = stripCommonFolder(names);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const files: Record<string, string> = {};
  const ignored: string[] = [];
  let manifestText: string | undefined;
  for (const name of names) {
    const path = local(name);
    const data = entries[name]!;
    const isManifest = path === 'manifest.json';
    const svg = /^files\/[^/]+\.svg$/.exec(path);
    if (!isManifest && !svg) {
      ignored.push(path);
      continue;
    }
    let text: string;
    try {
      text = decoder.decode(data);
    } catch {
      issues.push({ path, message: 'not UTF-8 text' });
      continue;
    }
    if (isManifest) manifestText = text;
    else files[path.slice('files/'.length)] = text;
  }
  if (manifestText === undefined) return fail('manifest.json', 'missing');

  let raw: unknown;
  try {
    raw = JSON.parse(manifestText);
  } catch {
    return fail('manifest.json', 'not valid JSON');
  }
  // A user set always builds on the bundled one, so a partial pack falls back per key (17.6).
  const withBase =
    typeof raw === 'object' && raw !== null && !('extends' in raw)
      ? { ...raw, extends: 'default' }
      : raw;
  const result = validateArtSet(withBase, {
    catalog: opts.catalog,
    boardSizes: opts.boardSizes,
    files: new Map(Object.entries(files)),
    limits: USER_LIMITS,
    maxTotalBytes: MAX_PACK_BYTES,
    ...(opts.parseXml ? { parseXml: opts.parseXml } : {}),
  });
  issues.push(...result.issues);
  const manifest = result.manifest;
  if (manifest?.id === 'default') {
    issues.push({ path: 'manifest.id', message: '"default" is reserved for the bundled set' });
  }
  if (issues.length > 0 || !manifest) return { ok: false, issues, ignored };
  return {
    ok: true,
    pack: { id: manifest.id, name: manifest.name, manifest, files },
    issues,
    ignored,
  };
}
