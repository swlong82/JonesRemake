import { z } from 'zod';
import {
  bpSchema,
  dollarsSchema,
  econPhaseSchema,
  homeTierSchema,
  hoursSchema,
  i18nKeySchema,
  idSchema,
  jsonLogicSchema,
  probSchema,
  rangeSchema,
  removableSchema,
  signedBpSchema,
  statIdSchema,
  uniformTierSchema,
} from './common.js';

/** UI service ids (EXTENSIBILITY 12.5). `shop:<catalogId>` is validated by prefix. */
export const SERVICE_IDS = [
  'work',
  'apply',
  'raise',
  'gig',
  'meals',
  'grocery',
  'bank',
  'invest',
  'loans',
  'rent',
  'move-home',
  'study',
  'relax',
  'subscriptions',
  'transit-pass',
  'cars',
  'pawn',
  'lottery',
  'news',
  'clinic',
] as const;
export const serviceSchema = z
  .string()
  .refine(
    (s) => (SERVICE_IDS as readonly string[]).includes(s) || /^shop:[a-z][a-z0-9-]*$/.test(s),
    'unknown service id',
  );

export const openRuleSchema = z.union([
  z.literal('always'),
  z.literal('rent-week'),
  z.object({ weeks: z.array(z.number().int().positive()).min(1) }).strict(),
]);

export const locationKindSchema = z.enum(['home', 'store', 'workplace', 'service', 'filler']);
export const musicMoodSchema = z.enum([
  'menu',
  'normal',
  'boom',
  'recession',
  'tension',
  'victory',
]);

export const locationSchema = z
  .object({
    id: idSchema,
    kind: locationKindSchema,
    services: z.array(serviceSchema),
    open: openRuleSchema,
    mood: musicMoodSchema.optional(),
    homeTier: homeTierSchema.optional(),
    /** Discount-store style rotation: only N random catalog items offered per player turn. */
    shopRotation: z.number().int().positive().optional(),
    category: z.enum(['home', 'retail', 'work', 'finance', 'education', 'service']),
  })
  .strict();
export type LocationSpec = z.infer<typeof locationSchema>;

export const boardSchema = z.discriminatedUnion('topology', [
  z
    .object({
      topology: z.literal('ring'),
      squares: z.array(z.object({ locationId: idSchema.nullable() }).strict()).length(16),
    })
    .strict(),
  z
    .object({
      topology: z.literal('graph'),
      nodes: z.array(z.object({ id: idSchema, locationId: idSchema.nullable() }).strict()).min(2),
      edges: z
        .array(
          z
            .object({
              from: idSchema,
              to: idSchema,
              steps: z.number().int().positive(),
              modes: z.array(idSchema).optional(),
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
]);
export type BoardSpec = z.infer<typeof boardSchema>;

export const layoutSchema = z.record(idSchema, z.object({ x: z.number(), y: z.number() }).strict());

export const jobSchema = z
  .object({
    id: idSchema,
    workplaceId: idSchema,
    titleKey: i18nKeySchema,
    baseWage: dollarsSchema.positive(),
    reqExperience: z.number().int().nonnegative(),
    reqDependability: z.number().int().nonnegative(),
    reqDegrees: z.array(idSchema),
    uniformTier: uniformTierSchema,
    automationRisk: probSchema,
    isGig: z.boolean().default(false),
    gigRequires: z.array(z.string()).default([]),
    /** Gig pay base per 6h shift block (dollars) — only for isGig. */
    gigPay: dollarsSchema.optional(),
    openings: z.number().int().positive().optional(),
    alwaysHire: z.boolean().default(false),
  })
  .strict();
export type JobSpec = z.infer<typeof jobSchema>;

export const degreeSchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    prereqs: z.array(idSchema),
    lessons: z.number().int().positive(),
    feeBase: dollarsSchema.nonnegative(),
  })
  .strict();
export type DegreeSpec = z.infer<typeof degreeSchema>;

export const UNLOCK_KEYS = [
  'freshFood',
  'freshFood12',
  'weekendIncome',
  'noRelaxDecay',
  'newsHint',
  'rideHail',
  'delivery',
  'gigDelivery',
  'onlineStudy',
  'bike',
  'phoneProtection',
  'twoFactor',
  'gymCard',
] as const;
export const unlockSchema = z.enum(UNLOCK_KEYS);

export const itemCategorySchema = z.enum([
  'appliance',
  'electronics',
  'book',
  'ticket',
  'junk',
  'drink',
  'misc',
  'vehicle',
]);

export const itemSchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    descKey: i18nKeySchema.optional(),
    category: itemCategorySchema,
    price: dollarsSchema.nonnegative(),
    storeIds: z.array(idSchema).min(1),
    happinessOnBuy: z.number().int(),
    comfort: z.boolean().default(false),
    extraCredit: z.boolean().default(false),
    /** Percent per week (e.g. 1.5 = 1.5%/week); converted to bp by the loader. */
    breakdownPerWeek: z.number().min(0).max(100).default(0),
    repairCost: dollarsSchema.nonnegative().default(0),
    unlocks: z.array(unlockSchema).default([]),
    /** Consumed on purchase (tickets, junk, drinks): never enters inventory. */
    consumable: z.boolean().default(false),
    /** Consumable happiness applies only to the first purchase per turn. */
    oncePerTurn: z.boolean().default(false),
    /** Counts as a "durable" for burglary, eviction and relax bonuses. */
    durable: z.boolean().default(true),
    /** Modern replacement of a classic item (kept as separate id; UI groups). */
    replaces: idSchema.optional(),
  })
  .strict();
export type ItemSpec = z.infer<typeof itemSchema>;

export const mealSchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    locationId: idSchema,
    price: dollarsSchema.positive(),
    happiness: z.number().int(),
    countsAsMeal: z.boolean().default(true),
    deliveryEligible: z.boolean().default(false),
  })
  .strict();
export type MealSpec = z.infer<typeof mealSchema>;

export const clothingSchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    tier: uniformTierSchema,
    storeId: idSchema,
    price: dollarsSchema.positive(),
    weeks: z.number().int().positive(),
  })
  .strict();
export type ClothingSpec = z.infer<typeof clothingSchema>;

export const transportModeSchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    hoursPerStep: z.number().nonnegative(),
    fixedHours: hoursSchema,
    cost: z.discriminatedUnion('type', [
      z.object({ type: z.literal('free') }).strict(),
      z.object({ type: z.literal('perTrip'), base: dollarsSchema, perStep: z.number() }).strict(),
      z
        .object({ type: z.literal('passOrFare'), fare: dollarsSchema, passPrice: dollarsSchema })
        .strict(),
      z.object({ type: z.literal('upkeep'), weekly: dollarsSchema }).strict(),
    ]),
    unlock: z.enum(['always', 'transitPass', 'smartphone', 'car']),
    surgeBp: bpSchema.default(0),
    surgeMinPm: z.number().int().default(1000),
    surgeMaxPm: z.number().int().default(1000),
    noShowBp: bpSchema.default(0),
    noShowHours: hoursSchema.default(0),
    delayBp: bpSchema.default(0),
    delayHours: hoursSchema.default(0),
    trafficBp: bpSchema.default(0),
    trafficWellbeing: z.number().int().default(0),
    breakdownBp: bpSchema.default(0),
  })
  .strict();
export type TransportModeSpec = z.infer<typeof transportModeSchema>;

export const subscriptionSchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    locationId: idSchema,
    weeklyPrice: dollarsSchema.positive(),
    happinessPerWeek: z.number().int().default(0),
    wellbeingPerWeek: z.number().int().default(0),
    /** Named capability the subscription grants (checked by rules, e.g. homeInternet, focusApp). */
    grants: z
      .array(z.enum(['homeInternet', 'streaming', 'music', 'cloud', 'gym', 'focusApp', 'foodClub']))
      .default([]),
    priceDrift: z.boolean().default(true),
  })
  .strict();
export type SubscriptionSpec = z.infer<typeof subscriptionSchema>;

export const assetSchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    model: z.enum(['bounded', 'drift']),
    startCents: z.number().int().positive(),
    minCents: z.number().int().positive().optional(),
    maxCents: z.number().int().positive().optional(),
    /** bounded: uniform max weekly move (bp of price). */
    maxMoveBp: bpSchema.default(0),
    /** drift: weekly drift and volatility in bp. */
    driftBp: z.number().int().default(0),
    volBp: bpSchema.default(0),
    econCorrBp: signedBpSchema,
    feeBp: bpSchema.default(0),
    crashImmune: z.boolean().default(false),
    /** Special event hooks: event ids in events.json referencing this asset via `asset` effects. */
    specialEvents: z.array(idSchema).default([]),
    /** Modern-only: hidden when the flag is off (and vice versa for classic instruments). */
    set: z.enum(['classic', 'modern']),
  })
  .strict();
export type AssetSpec = z.infer<typeof assetSchema>;

export const loansSchema = z
  .object({
    min: dollarsSchema.positive(),
    max: dollarsSchema.positive(),
    terms: z.array(z.number().int().positive()).min(1),
    aprBaseBp: z.number().int(),
    aprPerEconBp: z.number().int(),
    aprLowDepBp: z.number().int(),
    lowDepThreshold: z.number().int(),
    approvalIncomeWeeks: z.number().int().positive(),
    approvalIncomeBp: bpSchema,
    missedFee: dollarsSchema,
    defaultAfter: z.number().int().positive(),
    garnishBp: bpSchema,
    maxActive: z.number().int().positive(),
    /**
     * Student loans (ADR-0044): a seat that has not yet met its education goal may borrow up to this
     * much whatever its income. 0 turns them off.
     */
    studentMax: dollarsSchema.default(0),
  })
  .strict();
export type LoansSpec = z.infer<typeof loansSchema>;

export const itemFilterSchema = z
  .object({
    category: itemCategorySchema.optional(),
    durable: z.boolean().optional(),
    itemId: idSchema.optional(),
    /** Number of weeks owned above which items are eligible (eviction keeps newest N). */
    excludeNewest: z.number().int().nonnegative().optional(),
  })
  .strict();

const numOrRange = z.union([z.number().int(), rangeSchema]);

/** Effect DSL (CONTENT_SCHEMAS 6.2). */
export const effectSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('stat'), stat: statIdSchema, delta: numOrRange }).strict(),
  z
    .object({
      op: z.literal('money'),
      account: z.enum(['cash', 'bank']),
      delta: z.union([
        numOrRange,
        z.object({ pctOf: z.enum(['cash', 'bank']), pct: rangeSchema }).strict(),
      ]),
      /** Money scaled by econ (weekend events: "money effects × econ"). */
      scaleEcon: z.boolean().default(false),
      /** Deduct from cash then bank; if both empty, add to rent debt (SEED_DATA 14.3). */
      cascade: z.boolean().default(false),
    })
    .strict(),
  z.object({ op: z.literal('hours'), delta: hoursSchema.or(z.number().negative()) }).strict(),
  z
    .object({
      op: z.literal('loseJob'),
      severanceWeeks: z.number().int().nonnegative().optional(),
      chanceBp: bpSchema.default(10_000),
    })
    .strict(),
  z
    .object({
      op: z.literal('loseItems'),
      filter: itemFilterSchema,
      count: z.union([z.number().int().positive(), z.literal('all'), rangeSchema]),
    })
    .strict(),
  z
    .object({ op: z.literal('disableItem'), itemId: idSchema, untilRepaired: z.literal(true) })
    .strict(),
  z.object({ op: z.literal('econ'), multiply: rangeSchema }).strict(),
  z
    .object({
      op: z.literal('asset'),
      assetId: idSchema.or(z.literal('*')),
      multiply: rangeSchema,
      exceptImmune: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      op: z.literal('grant'),
      what: z.enum(['freeEnrollment', 'meal']),
      qty: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      op: z.literal('schedule'),
      eventId: idSchema,
      inWeeks: z.number().int().positive(),
      chance: bpSchema,
    })
    .strict(),
  z.object({ op: z.literal('relaxation'), delta: z.number().int() }).strict(),
  z.object({ op: z.literal('food'), delta: z.number().int() }).strict(),
]);
export type EffectSpec = z.infer<typeof effectSchema>;

export const eventTriggerSchema = z
  .string()
  .refine(
    (s) =>
      s === 'turnStart' ||
      s === 'weekend' ||
      /^onEnter:[a-z][a-z0-9-]*$/.test(s) ||
      /^onExit:[a-z][a-z0-9-]*$/.test(s) ||
      /^onAction:[A-Za-z]+$/.test(s),
    'trigger must be turnStart | weekend | onEnter:<loc> | onExit:<loc> | onAction:<cmd>',
  );

export const eventSchema = z
  .object({
    id: idSchema,
    family: z.string().min(1),
    trigger: eventTriggerSchema,
    conditions: jsonLogicSchema.optional(),
    /** Weight in basis points (turnStart: chance per turn) or relative weight (weekend). May be JSON-logic. */
    weight: z.union([bpSchema, jsonLogicSchema]),
    /** Per-mille chaos multipliers; default = rules.chaos. */
    chaosWeights: z
      .object({
        off: z.number().int(),
        classic: z.number().int(),
        modern: z.number().int(),
        chaotic: z.number().int(),
      })
      .strict()
      .optional(),
    effects: z.array(effectSchema),
    textKey: i18nKeySchema,
    /** Weekend events tagged neutral still fire with Chaos Off. */
    neutral: z.boolean().default(false),
    /** Hint for UI/audio: positive, negative or neutral card. */
    tone: z.enum(['good', 'bad', 'neutral']).default('neutral'),
    /** Only fires when the pack enables this flag. */
    flag: z.string().optional(),
  })
  .strict();
export type EventSpec = z.infer<typeof eventSchema>;

export const personalitySchema = z
  .object({
    id: idSchema,
    nameKey: i18nKeySchema,
    taglineKey: i18nKeySchema,
    weights: z
      .object({
        wealth: z.number(),
        happiness: z.number(),
        education: z.number(),
        career: z.number(),
      })
      .strict(),
    riskTolerance: z.number().min(0).max(1),
    preferences: z
      .object({
        relaxWeight: z.number(),
        wellbeingFloor: z.number().int(),
        prefersGig: z.boolean(),
        prefersOnlineStudy: z.boolean(),
        prefersWalk: z.boolean(),
        cryptoTolerance: z.number().min(0).max(1),
      })
      .strict(),
  })
  .strict();
export type PersonalitySpec = z.infer<typeof personalitySchema>;

export const visualSchema = z
  .object({
    shape: z.enum(['rounded-rect', 'circle', 'badge', 'token']),
    color: z.string().min(1),
    icon: z.string().min(1),
  })
  .strict();
export const assetsRegistrySchema = z.record(z.string(), visualSchema);

export const worldSchema = z
  .object({
    id: idSchema,
    version: z.string(),
    cities: z
      .array(
        z
          .object({
            packId: idSchema,
            displayNameKey: i18nKeySchema,
            unlock: z.union([
              z.literal('always'),
              z.object({ minNetWorth: z.number().int() }).strict(),
              z.object({ degrees: z.number().int() }).strict(),
            ]),
          })
          .strict(),
      )
      .min(1),
    travel: z.array(
      z
        .object({
          fromCity: idSchema,
          toCity: idSchema,
          hours: hoursSchema,
          cost: dollarsSchema,
          requires: z.string().optional(),
        })
        .strict(),
    ),
    sharedEconomy: z.boolean(),
  })
  .strict();
export type WorldSpec = z.infer<typeof worldSchema>;

/** Array files may be a plain array, an array with `_remove` entries, or `{ _replace: true, entries }`. */
export function overlayArray<T extends z.ZodTypeAny>(entry: T) {
  const withRemove = z.array(z.union([entry, removableSchema]));
  return z.union([
    withRemove,
    z.object({ _replace: z.literal(true), entries: z.array(entry) }).strict(),
  ]);
}

export const econPhaseKey = econPhaseSchema;
