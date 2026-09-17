import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'kebab-case id');
export const i18nKeySchema = z.string().regex(/^[a-zA-Z0-9_.:-]+$/, 'i18n key');
export const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'semver x.y.z');

/** Hours authored in hours; must be a multiple of 0.5 or a per-step fraction (converted by loader). */
export const hoursSchema = z.number().nonnegative();
/** Whole dollars. */
export const dollarsSchema = z.number().int();
/** Basis points 0..10000. */
export const bpSchema = z.number().int().min(0).max(10_000);
/** Signed basis points −10000..10000 (correlations). */
export const signedBpSchema = z.number().int().min(-10_000).max(10_000);
/** Probability authored as 0..1 float (e.g. automationRisk 0.45); loader converts to bp. */
export const probSchema = z.number().min(0).max(1);

export const rangeSchema = z
  .object({ min: z.number(), max: z.number(), int: z.boolean().optional() })
  .strict()
  .refine((r) => r.max >= r.min, 'range.max must be >= range.min');
export type RangeSpec = z.infer<typeof rangeSchema>;

export const uniformTierSchema = z.enum(['none', 'casual', 'dress', 'business']);
export const homeTierSchema = z.enum(['low', 'high']);
export const econPhaseSchema = z.enum(['boom', 'stable', 'recession']);
export const chaosSchema = z.enum(['off', 'classic', 'modern', 'chaotic']);
export const statIdSchema = z.enum([
  'happiness',
  'wellbeing',
  'dependability',
  'experience',
  'relaxation',
]);

/** Overlay marker: an `{ id, _remove: true }` entry deletes the inherited entry (EXTENSIBILITY 12.3). */
export const removableSchema = z.object({ id: idSchema, _remove: z.literal(true) }).strict();

/**
 * JSON-logic subset used by event conditions and weight expressions (CONTENT_SCHEMAS 6.2).
 * Validated structurally here; the evaluator whitelists operators.
 */
export const jsonLogicSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.null(),
    z.array(jsonLogicSchema),
    z.record(z.string(), z.union([jsonLogicSchema, z.array(jsonLogicSchema)])),
  ]),
);
