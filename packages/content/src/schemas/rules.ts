import { z } from 'zod';
import {
  bpSchema,
  dollarsSchema,
  hoursSchema,
  homeTierSchema,
  uniformTierSchema,
} from './common.js';

/**
 * rules.json — every GDD numeric constant (CONTENT_SCHEMAS 6.1). Hours are authored in hours and
 * converted to half-hours by the loader; probabilities are basis points; econ values per-mille.
 */
export const rulesSchema = z
  .object({
    scheduler: z.enum(['sequential', 'simultaneous']),
    win: z.enum(['all-goals-race']),
    time: z
      .object({
        weekHours: hoursSchema,
        enterHours: hoursSchema,
        workSessionHours: hoursSchema,
        lessonHours: hoursSchema,
        relaxHours: hoursSchema,
        applyHours: hoursSchema,
        raiseHours: hoursSchema,
        extensionHours: hoursSchema,
        starvationHours: hoursSchema,
        doctorHours: hoursSchema,
        deliveryHours: hoursSchema,
        gigSignupHours: hoursSchema,
        gigShiftHours: z.array(hoursSchema).min(1),
        stallWeek: z.number().int().positive(),
      })
      .strict(),
    start: z
      .object({
        cash: dollarsSchema,
        bank: dollarsSchema,
        happiness: z.number().int(),
        dependability: z.number().int(),
        experience: z.number().int(),
        relaxation: z.number().int(),
        wellbeing: z.number().int(),
        clothingTier: uniformTierSchema,
        clothingWeeks: z.number().int().nonnegative(),
        homeTier: homeTierSchema,
      })
      .strict(),
    goals: z
      .object({
        sliderMin: z.number().int(),
        sliderMax: z.number().int(),
        sliderStep: z.number().int().positive(),
        sliderDefault: z.number().int(),
        aiGoalRanges: z.record(
          z.enum(['easy', 'normal', 'hard']),
          z.tuple([z.number(), z.number()]),
        ),
        educationBase: z.number().int(),
        educationPerDegree: z.number().int(),
        careerDependabilityBp: z.number().int().positive(),
        /**
         * Career = dependability × careerDependabilityBp / 10000 − careerDependabilityOffset
         * (ADR-0040): the offset lets the pack line career up with the degree ladder at every goal
         * level. 0 keeps career proportional to dependability.
         */
        careerDependabilityOffset: z.number().int().nonnegative().default(0),
        /**
         * Tenure (ADR-0040): career is also capped at weeks in the current job × this / 10000, so a
         * new job starts its career over. 0 turns the cap off.
         */
        careerTenureBpPerWeek: z.number().int().nonnegative().default(0),
        /** Probation (ADR-0040): tenure counts only after this many weeks in the job. */
        careerTenureDelayWeeks: z.number().int().nonnegative().default(0),
        /** Weeks after an event layoff within which a rehire resumes tenure (ADR-0047). */
        careerLayoffGraceWeeks: z.number().int().nonnegative().default(0),
      })
      .strict(),
    stats: z
      .object({
        dependabilityDecay: z.number().int(),
        relaxationDecay: z.number().int(),
        relaxationMin: z.number().int(),
        relaxationMax: z.number().int(),
        relaxGain: z.number().int(),
        workExperienceGain: z.number().int(),
        workDependabilityGain: z.number().int(),
        maxStatBase: z.number().int(),
        maxStatPerDegree: z.number().int(),
        degreeDependabilityBonus: z.number().int(),
        /** Experience a graduation adds (ADR-0044, modern internship credit); 0 on classic. */
        degreeExperienceBonus: z.number().int().nonnegative().default(0),
        hireDependabilityFloor: z.number().int(),
        firingDependabilityMargin: z.number().int(),
        statMin: z.number().int(),
        statMax: z.number().int(),
      })
      .strict(),
    happiness: z
      .object({
        hired: z.number().int(),
        refused: z.number().int(),
        fired: z.number().int(),
        graduation: z.number().int(),
        relaxBase: z.number().int(),
        relaxPerComfort: z.number().int(),
        relaxMax: z.number().int(),
        /** Per-week happiness decay (GDD 4.8 step E, ADR-0025); 0 keeps happiness monotonic. */
        decayPerWeek: z.number().int().nonnegative().default(0),
        theft: z.number().int(),
        starvation: z.number().int(),
        moveSecure: z.number().int(),
        subscriptionLapsed: z.number().int(),
        min: z.number().int(),
        max: z.number().int(),
      })
      .strict(),
    jobs: z
      .object({
        luckBase: z.number().int(),
        luckAdd: z.number().int(),
        luckDegreeWeight: z.number().int(),
        luckDivisor: z.number().int().positive(),
        payPerSession: z.number().int(),
        raiseStep: z.number().int(),
        garnishBp: bpSchema,
        garnishFee: dollarsSchema,
        crashJobLossBpBySeverity: z.array(bpSchema).min(1),
      })
      .strict(),
    education: z
      .object({
        lessons: z.number().int().positive(),
        minLessons: z.number().int().positive(),
        maxConcurrent: z.number().int().positive(),
        extraCreditCap: z.number().int().nonnegative(),
        enrollFee: dollarsSchema,
      })
      .strict(),
    housing: z
      .object({
        rentWeeks: z.number().int().positive(),
        extensionApproveBp: bpSchema,
        evictionWeeks: z.number().int().positive(),
        evictionKeepDurables: z.number().int().nonnegative(),
        burglary: z
          .object({
            baseBp: bpSchema,
            perDurableBp: bpSchema,
            perRelaxationBp: bpSchema,
            minBp: bpSchema,
            maxBp: bpSchema,
          })
          .strict(),
        tiers: z.record(
          homeTierSchema,
          z
            .object({
              rent: dollarsSchema,
              burglary: z.boolean(),
              locationId: z.string(),
              rentHikeBp: bpSchema,
            })
            .strict(),
        ),
        rentHike: z.object({ minBp: bpSchema, maxBp: bpSchema }).strict(),
        roommateFoodBp: bpSchema,
      })
      .strict(),
    food: z
      .object({
        unitPrice: dollarsSchema,
        fridgeCap: z.number().int().positive(),
        freezerCap: z.number().int().positive(),
        deliveryPriceBp: z.number().int().positive(),
        deliveryLostBp: bpSchema,
        deliveryRefundBp: bpSchema,
        foodClubDiscountBp: bpSchema,
      })
      .strict(),
    items: z
      .object({
        resaleMinBp: bpSchema,
        resaleDecayPerWeekBp: bpSchema,
        discountPriceBp: bpSchema,
        discountBreakMultBp: z.number().int().positive(),
        discountRotation: z.number().int().positive(),
        discountStoreId: z.string(),
      })
      .strict(),
    pawn: z
      .object({
        sellBp: bpSchema,
        redeemBp: z.number().int().positive(),
        othersBuyBp: bpSchema,
        redeemRounds: z.number().int().nonnegative(),
        locationId: z.string(),
      })
      .strict(),
    theft: z
      .object({
        baseBp: bpSchema,
        perHundredBp: bpSchema,
        threshold: dollarsSchema,
        capBp: bpSchema,
        locationIds: z.array(z.string()),
      })
      .strict(),
    doctor: z
      .object({
        baseBp: bpSchema,
        perRelaxationBp: bpSchema,
        minBp: bpSchema,
        costMin: dollarsSchema,
        costMax: dollarsSchema,
      })
      .strict(),
    lottery: z
      .object({
        ticketPrice: dollarsSchema,
        prizes: z.array(z.object({ amount: dollarsSchema, bp: bpSchema }).strict()).min(1),
        locationId: z.string(),
      })
      .strict(),
    econ: z
      .object({
        start: z.number().int().positive(),
        min: z.number().int().positive(),
        max: z.number().int().positive(),
        drift: z.record(z.enum(['boom', 'stable', 'recession']), z.number().int()),
        noiseSigma: z.number().int().nonnegative(),
        phaseTransitionBp: bpSchema,
        crash: z.object({ minPm: z.number().int(), maxPm: z.number().int() }).strict(),
        newsAccuracyBp: bpSchema,
        newsPrice: dollarsSchema,
        newsLocationId: z.string(),
      })
      .strict(),
    market: z
      .object({ locationId: z.string(), crashMultiplierPm: z.number().int().positive() })
      .strict(),
    chaos: z.record(
      z.enum(['off', 'classic', 'modern', 'chaotic']),
      z.number().int().nonnegative(),
    ),
    wellbeing: z
      .object({
        workDelta: z.number().int(),
        gigDelta: z.number().int(),
        studyDelta: z.number().int(),
        onlineStudyDelta: z.number().int(),
        relaxBase: z.number().int(),
        relaxPerComfort: z.number().int(),
        relaxMax: z.number().int(),
        unspentHoursThreshold: hoursSchema,
        unspentBonus: z.number().int(),
        walkTripSteps: z.number().int(),
        walkTripBonus: z.number().int(),
        starvation: z.number().int(),
        loanMissed: z.number().int(),
        driftTarget: z.number().int(),
        driftStep: z.number().int(),
        bands: z
          .object({
            thrive: z.number().int(),
            burnout: z.number().int(),
            collapse: z.number().int(),
          })
          .strict(),
        thriveHappiness: z.number().int(),
        burnoutHours: hoursSchema,
        burnoutPayPenaltyBp: bpSchema,
        burnoutLessonWasteBp: bpSchema,
        collapseReset: z.number().int(),
        collapseDependability: z.number().int(),
        collapseJobLossBp: bpSchema,
      })
      .strict(),
    gig: z
      .object({ demandMinPm: z.number().int(), demandMaxPm: z.number().int(), carWearBp: bpSchema })
      .strict(),
    onlineStudy: z.object({ wasteBp: bpSchema, focusWasteBp: bpSchema }).strict(),
    subscriptions: z
      .object({
        driftEveryWeeks: z.number().int().positive(),
        driftChanceBp: bpSchema,
        driftMinBp: bpSchema,
        driftMaxBp: bpSchema,
      })
      .strict(),
    cars: z
      .object({
        usedMin: dollarsSchema,
        usedMax: dollarsSchema,
        newPrice: dollarsSchema,
        sellUsedBp: bpSchema,
        sellNewBp: bpSchema,
        sellNewWeeks: z.number().int(),
        depreciationBp: bpSchema,
        upkeep: dollarsSchema,
        usedBreakdownBp: bpSchema,
        newBreakdownBp: bpSchema,
        repairCost: dollarsSchema,
        usedLocationId: z.string(),
        newLocationId: z.string(),
      })
      .strict(),
    scoring: z
      .object({
        version: z.number().int().positive(),
        base: z.number().int(),
        perWeek: z.number().int(),
        netWorthDivisor: z.number().int().positive(),
        perDegree: z.number().int(),
        perHappinessCareer: z.number().int(),
        goalTotalDivisor: z.number().int().positive(),
        hardSeatBp: z.number().int(),
        easySeatBp: z.number().int(),
      })
      .strict(),
    layoff: z.object({ baseBp: bpSchema, severanceWeeks: z.number().int() }).strict(),
  })
  .strict();

export type RulesFile = z.infer<typeof rulesSchema>;
