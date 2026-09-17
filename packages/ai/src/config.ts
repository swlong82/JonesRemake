/** Difficulty configs (GDD 4.14). Beam width × depth, score noise (σ, in utility units), lookahead weeks. */
import type { Difficulty } from '@hustle-ring/shared';

export interface DifficultyConfig {
  width: number;
  depth: number;
  /** Gaussian score noise σ added to each candidate's utility (0 = none). */
  noiseSigma: number;
  /** Weeks of future income the value function credits. */
  lookaheadWeeks: number;
  /** Assets the AI may buy, by "risk tier": 0 safest … 3 everything. */
  investTier: number;
  /** Candidates expanded per node after preview-based pre-ranking. */
  branch: number;
  econAware: boolean;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: {
    width: 3,
    depth: 3,
    noiseSigma: 0.35,
    lookaheadWeeks: 0,
    investTier: 0,
    branch: 3,
    econAware: false,
  },
  normal: {
    width: 6,
    depth: 5,
    noiseSigma: 0.1,
    lookaheadWeeks: 2,
    investTier: 1,
    branch: 4,
    econAware: false,
  },
  hard: {
    width: 12,
    depth: 8,
    noiseSigma: 0,
    lookaheadWeeks: 6,
    investTier: 3,
    branch: 5,
    econAware: true,
  },
};

/** Asset risk tiers by id (classic + modern). Unknown assets count as tier 3. */
export const ASSET_TIER: Record<string, number> = {
  't-bills': 0,
  savings: 0,
  bonds: 1,
  gold: 1,
  'blue-chip': 1,
  'index-etf': 1,
  silver: 2,
  commodities: 2,
  'tech-stock': 2,
  'penny-stocks': 3,
  crypto: 3,
};
