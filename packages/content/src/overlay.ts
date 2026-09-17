/**
 * Content overlay merge (EXTENSIBILITY 12.3): objects deep-merge; arrays of `{id}` merge by id;
 * an entry with `_remove: true` deletes; a file-level `{ _replace: true, entries }` replaces.
 */
import type { JsonValue } from '@hustle-ring/shared';

type JsonObject = Record<string, JsonValue>;

function isObject(v: JsonValue | undefined): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasId(v: JsonValue): v is JsonObject & { id: string } {
  return isObject(v) && typeof v.id === 'string';
}

/** Normalise an array-file value to a plain array plus the replace flag. */
export function unwrapArrayFile(v: JsonValue | undefined): {
  entries: JsonValue[];
  replace: boolean;
} {
  if (v === undefined) return { entries: [], replace: false };
  if (Array.isArray(v)) return { entries: v, replace: false };
  if (isObject(v) && v._replace === true && Array.isArray(v.entries)) {
    return { entries: v.entries, replace: true };
  }
  throw new Error('array file must be an array or { _replace: true, entries: [] }');
}

export function mergeArraysById(base: JsonValue[], overlay: JsonValue[]): JsonValue[] {
  const out: JsonValue[] = base.map((e) => e);
  for (const entry of overlay) {
    if (!hasId(entry)) {
      out.push(entry);
      continue;
    }
    const idx = out.findIndex((e) => hasId(e) && e.id === entry.id);
    if (entry._remove === true) {
      if (idx >= 0) out.splice(idx, 1);
      continue;
    }
    if (idx >= 0) {
      const existing = out[idx];
      out[idx] = isObject(existing) ? deepMerge(existing, entry) : entry;
    } else {
      out.push(entry);
    }
  }
  return out;
}

export function deepMerge(base: JsonValue, overlay: JsonValue): JsonValue {
  if (Array.isArray(base) && Array.isArray(overlay)) {
    const byId = base.some(hasId) || overlay.some(hasId);
    return byId ? mergeArraysById(base, overlay) : overlay;
  }
  if (isObject(base) && isObject(overlay)) {
    const out: JsonObject = { ...base };
    for (const [k, v] of Object.entries(overlay)) {
      const b = out[k];
      out[k] = b === undefined ? v : deepMerge(b, v);
    }
    return out;
  }
  return overlay;
}

/** Merge one pack file (base first, overlay second). Either may be undefined. */
export function mergeFile(
  base: JsonValue | undefined,
  overlay: JsonValue | undefined,
  kind: 'array' | 'object',
): JsonValue | undefined {
  if (overlay === undefined) return base;
  if (base === undefined) {
    return kind === 'array'
      ? unwrapArrayFile(overlay).entries.filter((e) => !(hasId(e) && e._remove === true))
      : overlay;
  }
  if (kind === 'array') {
    const b = unwrapArrayFile(base).entries;
    const o = unwrapArrayFile(overlay);
    return o.replace ? o.entries : mergeArraysById(b, o.entries);
  }
  return deepMerge(base, overlay);
}
