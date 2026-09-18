/**
 * Resolved CityPack — the engine-facing view of a pack after overlay resolution and unit
 * conversion (hours → half-hours, percents → basis points, priceScale applied).
 * The engine imports only these types; JSON file shapes live in ./schemas.
 */
import type {
  AssetId,
  Chaos,
  DegreeId,
  EconPhase,
  EventId,
  HomeTier,
  ItemId,
  JobId,
  LocationId,
  MealId,
  PersonalityId,
  SubscriptionId,
  TransportModeId,
  UniformTier,
} from '@hustle-ring/shared';
import type {
  AssetSpec,
  ClothingSpec,
  DegreeSpec,
  EffectSpec,
  EventSpec,
  ItemSpec,
  JobSpec,
  LoansSpec,
  LocationSpec,
  MealSpec,
  PersonalitySpec,
  SubscriptionSpec,
  TransportModeSpec,
  WorldSpec,
} from './schemas/entities.js';
import type { FeatureFlags, PackManifest } from './schemas/pack.js';
import type { RulesFile } from './schemas/rules.js';

/** Half-hour integers. */
export type HalfHours = number;

/** Deep type transform: RulesFile with hour fields converted to half-hours (same shape). */
export type Rules = RulesFile;

export interface ResolvedJob extends Omit<JobSpec, 'automationRisk'> {
  automationRiskBp: number;
  /** Rank within its workplace by wage (0 = lowest). */
  tierIndex: number;
}

export interface ResolvedItem extends Omit<ItemSpec, 'breakdownPerWeek'> {
  breakdownBp: number;
}

export interface ResolvedTransportMode extends Omit<
  TransportModeSpec,
  'hoursPerStep' | 'fixedHours' | 'noShowHours' | 'delayHours'
> {
  /** Half-hours per step × 1000 (integer); trip cost = ceil(steps × this / 1000). */
  stepHalfHoursMilli: number;
  fixedHalfHours: HalfHours;
  noShowHalfHours: HalfHours;
  delayHalfHours: HalfHours;
}

export interface ResolvedBoard {
  topology: 'ring' | 'graph';
  /** Node ids in ring order (ring) or declaration order (graph). */
  nodes: string[];
  /** Node → location (null for pass-through squares). */
  locationAt: (string | null)[];
  /** Location → node index. */
  nodeOf: Record<LocationId, number>;
  /** All-pairs shortest steps between node indices. */
  dist: number[][];
  /** Ring only: +1 if clockwise is the (weakly) shorter direction from a to b. */
  ringSize: number;
}

export interface CityPack {
  id: string;
  version: string;
  manifest: PackManifest;
  flags: FeatureFlags;
  wealthPointValue: number;
  rules: Rules;
  board: ResolvedBoard;
  locations: LocationSpec[];
  locationById: Record<LocationId, LocationSpec>;
  jobs: ResolvedJob[];
  jobById: Record<JobId, ResolvedJob>;
  degrees: DegreeSpec[];
  degreeById: Record<DegreeId, DegreeSpec>;
  items: ResolvedItem[];
  itemById: Record<ItemId, ResolvedItem>;
  meals: MealSpec[];
  mealById: Record<MealId, MealSpec>;
  clothing: ClothingSpec[];
  clothingById: Record<string, ClothingSpec>;
  transport: ResolvedTransportMode[];
  transportById: Record<TransportModeId, ResolvedTransportMode>;
  subscriptions: SubscriptionSpec[];
  subscriptionById: Record<SubscriptionId, SubscriptionSpec>;
  /** The instrument set the pack's `modernAssets` flag selects (EXTENSIBILITY 12.4). */
  assets: AssetSpec[];
  /** Both instrument sets as authored, for validation and for switching sets. */
  allAssets: AssetSpec[];
  assetById: Record<AssetId, AssetSpec>;
  loans: LoansSpec | null;
  events: EventSpec[];
  eventById: Record<EventId, EventSpec>;
  personalities: PersonalitySpec[];
  personalityById: Record<PersonalityId, PersonalitySpec>;
  i18n: Record<string, string>;
  visuals: Record<string, { shape: string; color: string; icon: string }>;
  /** Home tier → location id. */
  homeLocation: Record<HomeTier, LocationId>;
  uniformRank: Record<UniformTier, number>;
  chaosMultiplier: Record<Chaos, number>;
  econPhases: EconPhase[];
}

export type {
  EffectSpec,
  EventSpec,
  WorldSpec,
  LocationSpec,
  JobSpec,
  DegreeSpec,
  ItemSpec,
  MealSpec,
};
export type {
  ClothingSpec,
  TransportModeSpec,
  SubscriptionSpec,
  AssetSpec,
  LoansSpec,
  PersonalitySpec,
};
export type { PackManifest, FeatureFlags };
