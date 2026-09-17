/**
 * Zod schema for GameState (M1.7 property test, save import validation in M7.2). Every number is
 * a safe integer; hours are non-negative; money may be negative only in `home.debt` accounting.
 */
import { z } from 'zod';

const int = z.number().int().safe();
const nonneg = int.nonnegative();
const id = z.string().min(1);

export const GoalsSchema = z
  .object({ wealth: int, happiness: int, education: int, career: int })
  .strict();

export const SeatConfigSchema = z
  .object({
    name: z.string().min(1).max(16),
    controller: z.enum(['human-local', 'ai', 'remote']),
    color: z.enum(['p1', 'p2', 'p3', 'p4']),
    shape: z.enum(['circle', 'square', 'triangle', 'diamond']),
    goals: GoalsSchema,
    ai: z
      .object({ difficulty: z.enum(['easy', 'normal', 'hard']), personality: id })
      .strict()
      .optional(),
  })
  .strict();

export const GameConfigSchema = z
  .object({
    packId: id,
    seats: z.array(SeatConfigSchema).min(1).max(4),
    seed: z.string().min(1),
    chaos: z.enum(['off', 'classic', 'modern', 'chaotic']),
    classicOpacity: z.boolean(),
    soloPractice: z.boolean().optional(),
  })
  .strict();

export const PlayerStateSchema = z
  .object({
    seat: nonneg,
    name: z.string(),
    color: z.enum(['p1', 'p2', 'p3', 'p4']),
    shape: z.enum(['circle', 'square', 'triangle', 'diamond']),
    cityId: id,
    controller: z.enum(['human-local', 'ai', 'remote']),
    ai: z
      .object({ difficulty: z.enum(['easy', 'normal', 'hard']), personality: id })
      .strict()
      .optional(),
    goals: GoalsSchema,
    cash: nonneg,
    bank: nonneg,
    investments: z.record(id, z.object({ units: nonneg, costBasisCents: nonneg }).strict()),
    location: id,
    inside: z.boolean(),
    hoursLeft: nonneg,
    turn: z
      .object({
        jobsTurnedDown: z.array(id),
        relaxed: z.boolean(),
        eventsFired: z.array(id),
        lockedActions: z.array(z.string()),
        consumed: z.array(id),
        shopRotation: z.array(id),
        penalties: nonneg,
      })
      .strict(),
    happiness: int.min(0).max(100),
    dependability: int.min(0).max(100),
    experience: int.min(0).max(100),
    relaxation: int.min(0).max(100),
    maxDependability: nonneg,
    maxExperience: nonneg,
    job: z
      .object({ jobId: id, wage: nonneg, raises: nonneg, hiredWeek: nonneg })
      .strict()
      .nullable(),
    degrees: z.array(id),
    enrolled: z.record(id, z.object({ lessonsLeft: nonneg }).strict()),
    home: z
      .object({
        tier: z.enum(['low', 'high']),
        rentLocked: nonneg,
        paidThroughWeek: nonneg,
        debt: nonneg,
        debtSinceWeek: nonneg.nullable(),
        extensionsBlocked: z.boolean(),
        extensionUntilWeek: nonneg.nullable(),
        everHadDebt: z.boolean(),
        movedSecureOnce: z.boolean(),
      })
      .strict(),
    items: z.array(
      z
        .object({
          uid: id,
          itemId: id,
          condition: z.enum(['ok', 'broken']),
          boughtWeek: nonneg,
          boughtAt: id,
        })
        .strict(),
    ),
    food: z
      .object({ fridgeUnits: nonneg, unrefrigeratedUnits: nonneg, mealPending: id.nullable() })
      .strict(),
    clothing: z.array(
      z
        .object({ tier: z.enum(['none', 'casual', 'dress', 'business']), weeksLeft: nonneg })
        .strict(),
    ),
    lotteryTickets: nonneg,
    freeEnrollments: nonneg,
    newsHintWeek: nonneg.nullable(),
    scheduled: z.array(z.object({ eventId: id, week: nonneg }).strict()),
    modules: z.record(z.string(), z.unknown()),
    stats: z
      .object({
        earned: nonneg,
        workSessions: nonneg,
        lessons: nonneg,
        eventsSuffered: nonneg,
        highestWage: nonneg,
        collapses: nonneg,
      })
      .strict(),
    history: z.array(z.object({ week: nonneg, goals: z.tuple([int, int, int, int]) }).strict()),
    eliminated: z.boolean(),
  })
  .strict();

export const GameStateSchema = z
  .object({
    schemaVersion: int.positive(),
    engineVersion: z.string(),
    packId: id,
    packVersion: z.string(),
    worldId: id,
    config: GameConfigSchema,
    week: int.positive(),
    activeSeat: nonneg,
    weekOpenedBySeat: nonneg,
    econ: z
      .object({
        index: int.positive(),
        phase: z.enum(['boom', 'stable', 'recession']),
        lastChangePm: int,
        newsPhase: z.enum(['boom', 'stable', 'recession']),
        newsAccurate: z.boolean(),
      })
      .strict(),
    market: z
      .object({
        prices: z.record(id, int.positive()),
        history: z.record(id, z.array(int.positive())),
      })
      .strict(),
    players: z.array(PlayerStateSchema).min(1).max(4),
    pawnShop: z.array(
      z
        .object({
          uid: id,
          itemId: id,
          sellerSeat: nonneg,
          listedWeek: nonneg,
          paid: nonneg,
          boughtWeek: nonneg,
        })
        .strict(),
    ),
    news: z
      .object({
        phaseHint: z.enum(['boom', 'stable', 'recession']),
        accurate: z.boolean(),
        week: nonneg,
      })
      .strict(),
    rng: z.record(z.string(), z.tuple([nonneg, nonneg, nonneg, nonneg])),
    log: z.array(z.object({ seat: nonneg, seq: nonneg, cmd: z.unknown() }).strict()),
    seq: nonneg,
    winner: nonneg.nullable(),
    flags: z.record(z.string(), z.boolean()),
    modules: z.record(z.string(), z.unknown()),
    debugTouched: z.boolean(),
    uidCounter: nonneg,
    phase: z.enum(['actions', 'over']),
  })
  .strict();
