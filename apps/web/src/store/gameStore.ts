/**
 * Game store (ARCHITECTURE 5.6): holds GameState + UI state; the only mutation path is
 * `dispatch(cmd)` → engine `applyCommand` → set state → push events to the EventQueue consumed by
 * modals, the log, audio and the tutorial. AI turns are planned by the AiClient (worker) and
 * replayed through the same dispatch with per-setting pacing.
 */
import { loadPack, type CityPack } from '@hustle-ring/content';
import {
  applyCommand,
  candidateCommands,
  createGame,
  legalCommands,
  previewCommand,
  stateHash,
  type ActionPreview,
  type Command,
  type GameConfig,
  type GameState,
} from '@hustle-ring/engine';
import type { DomainEvent, ErrorCode, LocationId } from '@hustle-ring/shared';
import { create } from 'zustand';
import { createAiClient, type AiClient } from '../ai/aiClient';
import { loadPackStrings } from '../i18n';
import { useSettings, type AiSpeed } from './settings';

export type Screen = 'title' | 'setup' | 'settings' | 'stats' | 'game' | 'pass' | 'end' | 'help';

/** Events shown as modal cards (UX 7.5). */
export const CARD_EVENTS = new Set<DomainEvent['type']>([
  'EventFired',
  'Starved',
  'Spoiled',
  'ItemsStolen',
  'ItemBroke',
  'RentDebt',
  'Evicted',
  'LotteryResolved',
  'Fired',
  'Refused',
  'Graduated',
  'Won',
]);

export interface LogEntry {
  seq: number;
  week: number;
  seat: number | null;
  event: DomainEvent;
}

export interface TickerEntry {
  seat: number;
  cmd: Command;
}

export interface GameStore {
  screen: Screen;
  pack: CityPack | null;
  state: GameState | null;
  /** Full domain-event log for the log drawer (capped). */
  log: LogEntry[];
  /** Pending modal cards for the human whose turn it is (max 3 visible). */
  cards: DomainEvent[];
  /** Cards held back until the hotseat pass screen is dismissed. */
  pendingCards: DomainEvent[];
  ticker: TickerEntry[];
  /** Human seat currently controlling the device (hotseat privacy). */
  viewerSeat: number;
  selectedLocation: LocationId | null;
  travelOpen: boolean;
  /** Transport mode chosen in the travel sheet (UX 7.2, cycled with M). */
  travelMode: string;
  logOpen: boolean;
  standingsOpen: boolean;
  menuOpen: boolean;
  helpOpen: boolean;
  /** End-turn confirmation is pending because hours are still left (UX 7.7). */
  endTurnPending: boolean;
  aiThinking: boolean;
  aiSkip: boolean;
  lastError: ErrorCode | null;
  debug: boolean;
  autoplay: boolean;
  aiClient: AiClient;

  go: (screen: Screen) => void;
  startGame: (config: GameConfig, opts?: { debug?: boolean; autoplay?: boolean }) => void;
  dispatch: (cmd: Command) => boolean;
  selectLocation: (id: LocationId | null) => void;
  openTravel: (id: LocationId) => void;
  closeTravel: () => void;
  setTravelMode: (mode: string) => void;
  cycleTravelMode: () => void;
  toggleLog: () => void;
  toggleStandings: () => void;
  toggleMenu: () => void;
  /** End the turn, or ask first when more than `END_TURN_CONFIRM_HOURS` remain. */
  requestEndTurn: () => void;
  cancelEndTurn: () => void;
  toggleHelp: () => void;
  dismissCard: () => void;
  skipAi: () => void;
  ready: () => void;
  runAiIfNeeded: () => Promise<void>;
  preview: (cmd: Command) => ActionPreview | null;
  legal: () => Command[];
  candidates: () => { cmd: Command; code: ErrorCode | null }[];
  hash: () => string;
  quit: () => void;
  rematch: () => void;
  /** Debug (7.9): mark state as debug-touched and apply a mutation. */
  debugPatch: (fn: (s: GameState) => void) => void;
  /** Debug (7.9): drive every seat with the AI. */
  setAutoplay: (on: boolean) => void;
}

const MAX_LOG = 400;

/** Half-hours above which ending the turn asks for confirmation (UX 7.7 Shift+E). */
export const END_TURN_CONFIRM_HOURS = 12;

/**
 * Monotonically identifies the game that owns asynchronous AI work. Kept outside serializable
 * game state because it is UI concurrency bookkeeping, not part of a deterministic replay.
 */
let gameGeneration = 0;

function delayFor(speed: AiSpeed): number {
  return speed === 'instant' ? 0 : speed === 'fast' ? 120 : 450;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function humanSeats(state: GameState): number[] {
  return state.players.filter((p) => p.controller === 'human-local').map((p) => p.seat);
}

export const useGame = create<GameStore>((set, get) => ({
  screen: 'title',
  pack: null,
  state: null,
  log: [],
  cards: [],
  pendingCards: [],
  ticker: [],
  viewerSeat: 0,
  selectedLocation: null,
  travelOpen: false,
  travelMode: 'walk',
  logOpen: false,
  standingsOpen: false,
  menuOpen: false,
  helpOpen: false,
  endTurnPending: false,
  aiThinking: false,
  aiSkip: false,
  lastError: null,
  debug: false,
  autoplay: false,
  aiClient: createAiClient(),

  go(screen) {
    set({ screen, helpOpen: false });
  },

  startGame(config, opts = {}) {
    gameGeneration++;
    get().aiClient.cancelPending();
    const pack = loadPack(config.packId);
    // Pack display strings live in the `pack` i18n namespace (M4.7).
    loadPackStrings(pack);
    const state = createGame(config, pack);
    const humans = humanSeats(state);
    const first = state.activeSeat;
    set({
      pack,
      state,
      log: [],
      cards: [],
      ticker: [],
      viewerSeat: humans[0] ?? 0,
      selectedLocation: null,
      travelOpen: false,
      logOpen: false,
      standingsOpen: false,
      menuOpen: false,
      helpOpen: false,
      endTurnPending: false,
      aiThinking: false,
      aiSkip: false,
      pendingCards: [],
      lastError: null,
      debug: opts.debug ?? false,
      autoplay: opts.autoplay ?? false,
      screen: humans.length > 1 && humans.includes(first) ? 'pass' : 'game',
    });
    void get().runAiIfNeeded();
  },

  dispatch(cmd) {
    const { state, pack } = get();
    if (!state || !pack) return false;
    const seat = state.activeSeat;
    const r = applyCommand(state, seat, cmd, pack);
    const rejected = r.events.find((e) => e.type === 'CommandRejected');
    if (rejected?.type === 'CommandRejected') {
      set({ lastError: rejected.code });
      return false;
    }
    const player = state.players[seat];
    const isHuman = player?.controller === 'human-local';
    const newLog = r.events.map<LogEntry>((e) => ({
      seq: e.seq,
      week: e.week,
      seat: 'seat' in e ? e.seat : null,
      event: e,
    }));
    const cards = isHuman
      ? r.events.filter(
          (e) => CARD_EVENTS.has(e.type) && 'seat' in e && e.seat === seat && e.type !== 'Won',
        )
      : [];
    const next = r.state;
    const patch: Partial<GameStore> = {
      state: next,
      log: [...get().log, ...newLog].slice(-MAX_LOG),
      cards: [...get().cards, ...cards],
      lastError: null,
      travelOpen: false,
      endTurnPending: false,
    };
    // Turn changed: hotseat privacy screen, or AI turn.
    if (next.activeSeat !== seat || next.winner !== null) {
      patch.selectedLocation = null;
      const nextPlayer = next.players[next.activeSeat];
      if (next.winner !== null) {
        patch.screen = 'end';
        const winner = next.players[next.winner];
        const humanWon = winner?.controller === 'human-local';
        useSettings.getState().recordGame({
          packId: next.packId,
          humanWon,
          weeks: next.week,
          netWorth: Math.max(...next.players.map((p) => p.cash + p.bank)),
        });
      } else if (
        nextPlayer?.controller === 'human-local' &&
        humanSeats(next).length > 1 &&
        !get().autoplay
      ) {
        patch.screen = 'pass';
        patch.cards = [];
        // Start-of-turn cards for the next human are surfaced after the pass screen.
        patch.pendingCards = r.events.filter(
          (e) =>
            CARD_EVENTS.has(e.type) &&
            'seat' in e &&
            e.seat === next.activeSeat &&
            e.type !== 'Won',
        );
      } else if (nextPlayer?.controller === 'human-local') {
        patch.viewerSeat = next.activeSeat;
        patch.cards = [
          ...(patch.cards ?? []),
          ...r.events.filter(
            (e) =>
              CARD_EVENTS.has(e.type) &&
              'seat' in e &&
              e.seat === next.activeSeat &&
              e.type !== 'Won',
          ),
        ];
      }
    }
    set(patch);
    if (!isHuman) set({ ticker: [...get().ticker, { seat, cmd }].slice(-12) });
    void get().runAiIfNeeded();
    return true;
  },

  selectLocation(id) {
    set({ selectedLocation: id, travelOpen: false });
  },
  openTravel(id) {
    set({ selectedLocation: id, travelOpen: true });
  },
  closeTravel() {
    set({ travelOpen: false });
  },
  setTravelMode(mode) {
    set({ travelMode: mode });
  },
  cycleTravelMode() {
    const { pack, travelMode } = get();
    const modes = pack?.transport.map((m) => m.id) ?? [];
    if (modes.length === 0) return;
    const next = modes[(modes.indexOf(travelMode) + 1) % modes.length];
    set({ travelMode: next ?? travelMode });
  },
  toggleLog() {
    set({ logOpen: !get().logOpen });
  },
  toggleStandings() {
    set({ standingsOpen: !get().standingsOpen });
  },
  toggleMenu() {
    set({ menuOpen: !get().menuOpen });
  },
  requestEndTurn() {
    const { state } = get();
    const left = state?.players[state.activeSeat]?.hoursLeft ?? 0;
    if (left > END_TURN_CONFIRM_HOURS) {
      set({ endTurnPending: true });
      return;
    }
    set({ endTurnPending: false });
    get().dispatch({ type: 'EndTurn' });
  },
  cancelEndTurn() {
    set({ endTurnPending: false });
  },
  toggleHelp() {
    set({ helpOpen: !get().helpOpen });
  },
  dismissCard() {
    set({ cards: get().cards.slice(1) });
  },
  skipAi() {
    set({ aiSkip: true });
  },
  ready() {
    const { state } = get();
    if (!state) return;
    set({
      screen: 'game',
      viewerSeat: state.activeSeat,
      cards: get().pendingCards,
      pendingCards: [],
    });
  },

  async runAiIfNeeded() {
    const g = get();
    const { state, pack } = g;
    if (!state || !pack || state.winner !== null || g.aiThinking) return;
    const seat = state.activeSeat;
    const player = state.players[seat];
    if (!player) return;
    const isAi = player.controller === 'ai' || g.autoplay;
    if (!isAi) return;
    const ownerGeneration = gameGeneration;
    let planCompleted = false;
    set({ aiThinking: true, aiSkip: false });
    try {
      const opts = {
        difficulty: player.ai?.difficulty ?? 'normal',
        personality: player.ai?.personality ?? 'balanced',
      };
      const commands = await g.aiClient.plan(state, seat, pack.id, opts);
      if (gameGeneration !== ownerGeneration) return;
      planCompleted = true;
      const speed = useSettings.getState().settings.aiSpeed;
      const delay = g.autoplay ? 0 : delayFor(speed);
      for (const cmd of commands) {
        const cur = get();
        if (
          gameGeneration !== ownerGeneration ||
          cur.state?.activeSeat !== seat ||
          cur.state.winner !== null
        )
          break;
        if (delay > 0 && !cur.aiSkip) await sleep(delay);
        // The game may have been quit/restarted/rematched while the pacing timer was sleeping.
        const afterDelay = get();
        if (
          gameGeneration !== ownerGeneration ||
          afterDelay.state?.activeSeat !== seat ||
          afterDelay.state.winner !== null
        )
          break;
        const ok = afterDelay.dispatch(cmd);
        if (!ok) break;
      }
      // Safety: if the seat is still active after the plan, end the turn so the game never hangs.
      const after = get();
      if (
        gameGeneration === ownerGeneration &&
        after.state?.activeSeat === seat &&
        after.state.winner === null
      ) {
        after.dispatch({ type: 'EndTurn' });
      }
    } catch {
      // Lifecycle cancellation is expected. A worker crash retries/falls back inside AiClient.
    } finally {
      if (gameGeneration === ownerGeneration) set({ aiThinking: false });
    }
    // Calls made by dispatch while this job owned the turn were intentionally ignored. Once it
    // releases ownership, start exactly one plan for a consecutive AI seat.
    if (gameGeneration === ownerGeneration && planCompleted) void get().runAiIfNeeded();
  },

  preview(cmd) {
    const { state, pack } = get();
    if (!state || !pack) return null;
    return previewCommand(state, state.activeSeat, cmd, pack);
  },
  legal() {
    const { state, pack } = get();
    if (!state || !pack) return [];
    return legalCommands(state, state.activeSeat, pack);
  },
  candidates() {
    const { state, pack } = get();
    if (!state || !pack) return [];
    return candidateCommands(state, state.activeSeat, pack);
  },
  hash() {
    const { state } = get();
    return state ? stateHash(state) : '';
  },
  quit() {
    gameGeneration++;
    get().aiClient.cancelPending();
    set({
      screen: 'title',
      state: null,
      pack: null,
      cards: [],
      pendingCards: [],
      ticker: [],
      log: [],
      aiThinking: false,
      aiSkip: false,
    });
  },
  rematch() {
    const { state } = get();
    if (!state) return;
    const seed = `${state.config.seed}-rematch-${state.week}`;
    get().startGame({ ...state.config, seed }, { debug: get().debug, autoplay: get().autoplay });
  },
  setAutoplay(on) {
    set({ autoplay: on });
    if (on) void get().runAiIfNeeded();
  },
  debugPatch(fn) {
    const { state } = get();
    if (!state) return;
    const next = structuredClone(state);
    next.debugTouched = true;
    fn(next);
    set({ state: next });
  },
}));

/** Human-readable helpers shared by components. */
export function hoursLabel(halfHours: number): string {
  return (halfHours / 2).toString();
}
