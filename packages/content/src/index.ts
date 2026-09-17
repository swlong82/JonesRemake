/**
 * @hustle-ring/content — CityPack schemas (Zod), overlay resolver, validators and the bundled packs
 * (CONTENT_SCHEMAS 6.x, EXTENSIBILITY 12.3). Engine code imports only ids and the resolved
 * `CityPack`; display strings stay in `pack.i18n`.
 */
export * from './schemas/pack.js';
export * from './schemas/common.js';
export * from './schemas/entities.js';
export * from './schemas/rules.js';
export * from './types.js';
export * from './overlay.js';
export * from './logic.js';
export * from './resolve.js';
export * from './validators/cross.js';
export * from './validators/i18n.js';
export * from './packs.js';

import { PackManifestSchema, type PackManifest } from './schemas/pack.js';
import type { ValidationIssue } from './resolve.js';

export function validatePackManifest(
  raw: unknown,
): { ok: true; manifest: PackManifest } | { ok: false; issues: ValidationIssue[] } {
  const parsed = PackManifestSchema.safeParse(raw);
  if (parsed.success) return { ok: true, manifest: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  };
}
