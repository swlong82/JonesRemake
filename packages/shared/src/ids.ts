/**
 * Content and state identifiers (STATE_MODEL 13.2). Plain strings at the type level so JSON content
 * needs no casting; validity is enforced by the content validator and `ERR_UNKNOWN_ID`.
 */
export type LocationId = string;
export type JobId = string;
export type GigId = string;
export type DegreeId = string;
export type ItemId = string;
export type MealId = string;
export type AssetId = string;
export type EventId = string;
export type SubscriptionId = string;
export type TransportModeId = string;
export type ModuleId = string;
export type PersonalityId = string;
export type CityId = string;
export type ScorerId = string;
export type SfxId = string;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export type Chaos = 'off' | 'classic' | 'modern' | 'chaotic';
export const CHAOS_LEVELS: readonly Chaos[] = ['off', 'classic', 'modern', 'chaotic'];

export type Controller = 'human-local' | 'ai' | 'remote';

export type HomeTier = 'low' | 'high';
export const HOME_TIERS: readonly HomeTier[] = ['low', 'high'];

export type UniformTier = 'none' | 'casual' | 'dress' | 'business';
/** Ordered low → high; index is the comparable rank. */
export const UNIFORM_TIERS: readonly UniformTier[] = ['none', 'casual', 'dress', 'business'];

export type EconPhase = 'boom' | 'stable' | 'recession';
export const ECON_PHASES: readonly EconPhase[] = ['boom', 'stable', 'recession'];

export type GoalId = 'wealth' | 'happiness' | 'education' | 'career';
export const GOAL_IDS: readonly GoalId[] = ['wealth', 'happiness', 'education', 'career'];

export type TokenShape = 'circle' | 'square' | 'triangle' | 'diamond';
export const TOKEN_SHAPES: readonly TokenShape[] = ['circle', 'square', 'triangle', 'diamond'];

/** Color-blind-safe palette ids (CONTENT_SCHEMAS 6.4); hex values live in the web theme. */
export type PaletteId = 'p1' | 'p2' | 'p3' | 'p4';
export const PALETTE_IDS: readonly PaletteId[] = ['p1', 'p2', 'p3', 'p4'];

export type StatId = 'happiness' | 'wellbeing' | 'dependability' | 'experience' | 'relaxation';
export type MoneyAccount = 'cash' | 'bank';
