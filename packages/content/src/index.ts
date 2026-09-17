/**
 * @hustle-ring/content — CityPack schemas (Zod), loader, validator (CONTENT_SCHEMAS 6.x).
 *
 * STUB — M2 adds every schema in 6.1 and the classic pack. At M0 only `pack.json` is typed so the
 * validator CLI and the `_template` overlay have something real to check.
 */
import { z } from 'zod';

/** Feature flag ids (EXTENSIBILITY 12.4). Unknown ids fail validation. */
export const FEATURE_FLAG_IDS = [
  'transport',
  'gig',
  'delivery',
  'subscriptions',
  'rentHikes',
  'loans',
  'modernAssets',
  'modernEvents',
  'wellbeing',
  'onlineStudy',
  'simultaneousTurns',
  'online',
] as const;
export type FeatureFlagId = (typeof FEATURE_FLAG_IDS)[number];

const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'semver x.y.z');

export const PackManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'kebab-case id'),
    version: semver,
    currency: z.object({ symbol: z.string().min(1), code: z.string().length(3) }),
    featureFlags: z.record(z.enum(FEATURE_FLAG_IDS), z.boolean()),
    wealthPointValue: z.number().int().positive(),
    extends: z.string().optional(),
  })
  .strict();

export type PackManifest = z.infer<typeof PackManifestSchema>;

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

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
