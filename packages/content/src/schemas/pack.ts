import { z } from 'zod';
import { idSchema, semverSchema } from './common.js';

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
export type FeatureFlags = Record<FeatureFlagId, boolean>;

export const PackManifestSchema = z
  .object({
    id: idSchema,
    version: semverSchema,
    currency: z.object({ symbol: z.string().min(1), code: z.string().length(3) }).strict(),
    featureFlags: z.record(z.enum(FEATURE_FLAG_IDS), z.boolean()),
    wealthPointValue: z.number().int().positive(),
    /** Per-mille price scale applied to all base prices (overlays for other cities). */
    priceScale: z.number().int().positive().default(1000),
    schemaVersion: z.number().int().positive().default(1),
    extends: z.string().optional(),
    titleKey: z.string().optional(),
  })
  .strict();

export type PackManifest = z.infer<typeof PackManifestSchema>;
