/**
 * GameState and PlayerState (ARCHITECTURE 5.3, STATE_MODEL 13.2). Everything is JSON-serializable,
 * integer-valued (13.1) and structurally cloneable. Hours are half-hours; asset prices cents.
 */
import type {
  AssetId,
  Chaos,
  CityId,
  Controller,
  DegreeId,
  Difficulty,
  EconPhase,
  EventId,
  HomeTier,
  ItemId,
  JobId,
  LocationId,
  MealId,
  ModuleId,
  PaletteId,
  PersonalityId,
  TokenShape,
  UniformTier,
} from '@hustle-ring/shared';
import type { FeatureFlags } from '@hustle-ring/content';
import type { RngState } from './rng.js';

export interface SeatConfig {
  name: string;
  controller: Controller;
  color: PaletteId;
  shape: TokenShape;
  goals: Goals;
  ai?: { difficulty: Difficulty; personality: PersonalityId };
}

export interface Goals {
  wealth: number;
  happiness: number;
  education: number;
  career: number;
}

export interface GameConfig {
  packId: string;
  seats: SeatConfig[];
  seed: string;
  chaos: Chaos;
  classicOpacity: boolean;
  /** Solo practice: no auto-added AI opponent (GDD 4.1.5). */
  soloPractice?: boolean;
}

export interface EconState {
  /** Per-mille economy index (1000 = 1.0). */
  index: number;
  phase: EconPhase;
  /** Per-mille change applied in the last tick (signed), for market correlation. */
  lastChangePm: number;
  /** Phase the news feed will report for next week; accuracy applied when generated. */
  newsPhase: EconPhase;
  newsAccurate: boolean;
}

export interface MarketState {
  /** Asset id → price in cents. */
  prices: Record<AssetId, number>;
  /** Asset id → last N prices (oldest first) for sparklines. */
  history: Record<AssetId, number[]>;
}

export interface OwnedItem {
  uid: string;
  itemId: ItemId;
  condition: 'ok' | 'broken';
  boughtWeek: number;
  boughtAt: LocationId;
}

export interface PawnEntry {
  uid: string;
  itemId: ItemId;
  sellerSeat: number;
  listedWeek: number;
  /** Price the shop paid (dollars); redeem = ×redeemBp, others buy = ×othersBuyBp of value. */
  paid: number;
  boughtWeek: number;
}

export interface PlayerState {
  seat: number;
  name: string;
  color: PaletteId;
  shape: TokenShape;
  cityId: CityId;
  controller: Controller;
  ai?: { difficulty: Difficulty; personality: PersonalityId };
  goals: Goals;
  cash: number;
  bank: number;
  investments: Record<AssetId, { units: number; costBasisCents: number }>;
  location: LocationId;
  inside: boolean;
  hoursLeft: number;
  turn: {
    jobsTurnedDown: JobId[];
    relaxed: boolean;
    eventsFired: EventId[];
    lockedActions: string[];
    /** Consumable item ids whose once-per-turn happiness already applied. */
    consumed: ItemId[];
    /** Discount-store rotation for this turn (item ids). */
    shopRotation: ItemId[];
    /** Half-hour penalties applied at turn start (starvation, sickness, burnout). */
    penalties: number;
  };
  happiness: number;
  dependability: number;
  experience: number;
  relaxation: number;
  maxDependability: number;
  maxExperience: number;
  /** `hiredWeek`: start of continuous employment, kept across job changes (ADR-0040). */
  job: { jobId: JobId; wage: number; raises: number; hiredWeek: number } | null;
  degrees: DegreeId[];
  enrolled: Record<DegreeId, { lessonsLeft: number }>;
  home: {
    tier: HomeTier;
    rentLocked: number;
    paidThroughWeek: number;
    debt: number;
    debtSinceWeek: number | null;
    extensionsBlocked: boolean;
    extensionUntilWeek: number | null;
    everHadDebt: boolean;
    movedSecureOnce: boolean;
  };
  items: OwnedItem[];
  food: {
    fridgeUnits: number;
    unrefrigeratedUnits: number;
    mealPending: MealId | null;
  };
  clothing: { tier: UniformTier; weeksLeft: number }[];
  lotteryTickets: number;
  freeEnrollments: number;
  newsHintWeek: number | null;
  /** Scheduled events: eventId → week to fire. */
  scheduled: { eventId: EventId; week: number }[];
  modules: Record<ModuleId, unknown>;
  stats: {
    earned: number;
    workSessions: number;
    lessons: number;
    eventsSuffered: number;
    highestWage: number;
    collapses: number;
  };
  history: { week: number; goals: [number, number, number, number] }[];
  /** Weeks the player has held a fired-for-crash lock etc. (reserved). */
  eliminated: boolean;
}

export interface LoggedCommand {
  seat: number;
  seq: number;
  cmd: unknown;
}

export interface GameState {
  schemaVersion: number;
  engineVersion: string;
  packId: string;
  packVersion: string;
  worldId: string;
  config: GameConfig;
  week: number;
  activeSeat: number;
  /** Seat whose turn opened the current week (economy ticks once per week). */
  weekOpenedBySeat: number;
  econ: EconState;
  market: MarketState;
  players: PlayerState[];
  pawnShop: PawnEntry[];
  news: { phaseHint: EconPhase; accurate: boolean; week: number };
  rng: RngState;
  log: LoggedCommand[];
  /** Monotonic event sequence counter. */
  seq: number;
  winner: number | null;
  flags: FeatureFlags;
  modules: Record<ModuleId, unknown>;
  debugTouched: boolean;
  /** Next unique id counter for items / pawn entries (deterministic). */
  uidCounter: number;
  /** Player-turn phase for the active seat. */
  phase: 'actions' | 'over';
}
