/**
 * AI information boundary (CLAUDE.md 1.3, GDD 4.14, M2.5): the planner never sees other players'
 * hidden stats or the game's future RNG draws. `sanitizeForAi` builds a private simulation state:
 * own PlayerState intact, other players reduced to public fields with hidden stats neutralised,
 * and every RNG stream re-seeded from an AI-owned seed (`<seed>:ai:<seat>:<week>:<turn>`), so
 * simulated randomness is deterministic per turn yet independent of the real game's streams.
 */
import { cloneJson, type GameState, type PlayerState } from '@hustle-ring/engine';

/** Fields of other players the AI may read (public information on the standings panel). */
export const PUBLIC_PLAYER_FIELDS = [
  'seat',
  'name',
  'color',
  'shape',
  'controller',
  'goals',
  'location',
  'inside',
  'hoursLeft',
  'happiness',
  'job',
  'degrees',
  'home',
  'history',
] as const;

export function aiSeed(state: GameState, seat: number): string {
  return `${state.config.seed}:ai:${seat}:${state.week}:${state.log.length}`;
}

/** Neutralise hidden fields of a rival so they cannot influence planning. */
export function publicRival(p: PlayerState, template: PlayerState): PlayerState {
  const out = cloneJson(template);
  for (const k of PUBLIC_PLAYER_FIELDS)
    (out as unknown as Record<string, unknown>)[k] = cloneJson(p[k]);
  out.cash = 0;
  out.bank = 0;
  out.investments = {};
  out.dependability = 0;
  out.experience = 0;
  out.relaxation = 0;
  out.maxDependability = 0;
  out.maxExperience = 0;
  out.enrolled = {};
  out.items = [];
  out.food = { fridgeUnits: 0, unrefrigeratedUnits: 0, mealPending: null };
  out.clothing = [];
  out.lotteryTickets = 0;
  out.freeEnrollments = 0;
  out.newsHintWeek = null;
  out.scheduled = [];
  out.modules = {};
  out.stats = {
    earned: 0,
    workSessions: 0,
    lessons: 0,
    eventsSuffered: 0,
    highestWage: 0,
    collapses: 0,
  };
  out.turn = {
    jobsTurnedDown: [],
    relaxed: false,
    eventsFired: [],
    lockedActions: [],
    consumed: [],
    shopRotation: [],
    penalties: 0,
  };
  return out;
}

export function sanitizeForAi(state: GameState, seat: number): GameState {
  const me = state.players[seat];
  if (!me) throw new Error(`no player at seat ${seat}`);
  const seed = aiSeed(state, seat);
  const players = state.players.map((p, i) => (i === seat ? cloneJson(p) : publicRival(p, me)));
  return {
    ...cloneJson({ ...state, players: [], log: [], rng: {} }),
    config: { ...cloneJson(state.config), seed },
    players,
    rng: {},
    log: [],
  };
}
