/**
 * createGame (ARCHITECTURE 5.3, GDD 4.1.6): builds the initial GameState from config + pack, seeds
 * per-purpose RNG streams, initialises module slices, then opens seat 0's first turn.
 */
import type { CityPack } from '@hustle-ring/content';
import { GOAL_IDS, type Difficulty } from '@hustle-ring/shared';
import { Ctx } from './ctx.js';
import { recomputeMaxima } from './goals.js';
import type { Engine } from './module.js';
import { STREAMS } from './rng.js';
import { SequentialScheduler, createScheduler } from './scheduler.js';
import type { GameConfig, GameState, Goals, PlayerState, SeatConfig } from './state.js';
import { ENGINE_VERSION, STATE_SCHEMA_VERSION } from './version.js';

export function randomAiGoals(ctx: Ctx, seat: number, difficulty: Difficulty): Goals {
  const g = ctx.rules.goals;
  const [lo, hi] = g.aiGoalRanges[difficulty] ?? [30, 80];
  const steps = Math.floor((hi - lo) / g.sliderStep);
  const pick = (): number => lo + g.sliderStep * ctx.rng.int(`${STREAMS.setup}:${seat}`, steps + 1);
  return { wealth: pick(), happiness: pick(), education: pick(), career: pick() };
}

function initialPlayer(seat: number, cfg: SeatConfig, pack: CityPack): PlayerState {
  const s = pack.rules.start;
  const rent = pack.rules.housing.tiers[s.homeTier]?.rent ?? 0;
  const p: PlayerState = {
    seat,
    name: cfg.name,
    color: cfg.color,
    shape: cfg.shape,
    cityId: pack.id,
    controller: cfg.controller,
    goals: { ...cfg.goals },
    cash: s.cash,
    bank: s.bank,
    investments: {},
    location: pack.homeLocation[s.homeTier],
    inside: true,
    hoursLeft: 0,
    turn: {
      jobsTurnedDown: [],
      relaxed: false,
      eventsFired: [],
      lockedActions: [],
      consumed: [],
      shopRotation: [],
      penalties: 0,
    },
    happiness: s.happiness,
    dependability: s.dependability,
    experience: s.experience,
    relaxation: s.relaxation,
    maxDependability: 0,
    maxExperience: 0,
    job: null,
    degrees: [],
    enrolled: {},
    home: {
      tier: s.homeTier,
      rentLocked: rent,
      paidThroughWeek: 0,
      debt: 0,
      debtSinceWeek: null,
      extensionsBlocked: false,
      extensionUntilWeek: null,
      everHadDebt: false,
      movedSecureOnce: false,
    },
    items: [],
    food: { fridgeUnits: 0, unrefrigeratedUnits: 0, mealPending: null },
    clothing: s.clothingWeeks > 0 ? [{ tier: s.clothingTier, weeksLeft: s.clothingWeeks }] : [],
    lotteryTickets: 0,
    freeEnrollments: 0,
    newsHintWeek: null,
    scheduled: [],
    modules: {},
    stats: {
      earned: 0,
      workSessions: 0,
      lessons: 0,
      eventsSuffered: 0,
      highestWage: 0,
      collapses: 0,
    },
    history: [],
    eliminated: false,
  };
  if (cfg.ai) p.ai = { ...cfg.ai };
  recomputeMaxima(p, pack);
  return p;
}

export function validateConfig(config: GameConfig, pack: CityPack): void {
  if (config.packId !== pack.id)
    throw new Error(`config.packId "${config.packId}" does not match pack "${pack.id}"`);
  if (config.seats.length < 1 || config.seats.length > 4) throw new Error('seats must be 1–4');
  if (config.seed.length === 0) throw new Error('seed must be non-empty');
  const g = pack.rules.goals;
  config.seats.forEach((s, i) => {
    if (s.controller === 'ai' && !s.ai) throw new Error(`seat ${i}: ai controller needs ai config`);
    if (s.name.length === 0 || s.name.length > 16)
      throw new Error(`seat ${i}: name must be 1–16 chars`);
    for (const goal of GOAL_IDS) {
      const v = s.goals[goal];
      if (
        s.controller !== 'ai' &&
        (v < g.sliderMin || v > g.sliderMax || (v - g.sliderMin) % g.sliderStep !== 0)
      ) {
        throw new Error(
          `seat ${i}: goal ${goal}=${v} outside ${g.sliderMin}–${g.sliderMax} step ${g.sliderStep}`,
        );
      }
    }
  });
}

export function createGame(config: GameConfig, pack: CityPack, engine: Engine): GameState {
  validateConfig(config, pack);
  const prices: Record<string, number> = {};
  const history: Record<string, number[]> = {};
  const set = pack.flags.modernAssets ? 'modern' : 'classic';
  for (const a of pack.assets) {
    if (a.set !== set) continue;
    prices[a.id] = a.startCents;
    history[a.id] = [a.startCents];
  }
  const state: GameState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    packId: pack.id,
    packVersion: pack.version,
    worldId: 'world-default',
    config: structuredCloneConfig(config),
    week: 1,
    activeSeat: 0,
    weekOpenedBySeat: 0,
    econ: {
      index: pack.rules.econ.start,
      phase: 'stable',
      lastChangePm: 0,
      newsPhase: 'stable',
      newsAccurate: true,
    },
    market: { prices, history },
    players: config.seats.map((s, i) => initialPlayer(i, s, pack)),
    pawnShop: [],
    news: { phaseHint: 'stable', accurate: true, week: 0 },
    rng: {},
    log: [],
    seq: 0,
    winner: null,
    flags: { ...pack.flags },
    modules: {},
    debugTouched: false,
    uidCounter: 0,
    phase: 'actions',
  };
  const ctx = new Ctx(state, pack, 0);
  // AI seats: goals random per GDD 4.1.3 (config goals are ignored for AI).
  state.players.forEach((p, i) => {
    if (p.controller === 'ai' && p.ai) p.goals = randomAiGoals(ctx, i, p.ai.difficulty);
  });
  for (const m of engine.modules) {
    const slice = m.stateSlice;
    if (!slice) continue;
    if (slice.initialGame) state.modules[m.id] = slice.initialGame(ctx);
    if (slice.initialPlayer)
      state.players.forEach((p, i) => {
        p.modules[m.id] = slice.initialPlayer!(ctx, i);
      });
  }
  for (const h of engine.hooks.onGameCreate) h.fn(ctx);
  const { scheduler } = createScheduler(engine);
  if (scheduler instanceof SequentialScheduler) scheduler.startTurn(ctx, 0);
  return state;
}

function structuredCloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig;
}
