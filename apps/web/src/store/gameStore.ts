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
import { haptic } from './haptics';
import { weekNeeds } from './needs';
import { useTutorial } from '../tutorial/useTutorial';
import type { InfoTopic } from '../ui/game/info';
import { isOutcome } from '../ui/game/outcomes';
import { useSettings, type AiSpeed } from './settings';

export type Screen =
  'title' | 'setup' | 'settings' | 'stats' | 'game' | 'pass' | 'end' | 'help' | 'saves';

/** Events shown as modal cards (UX 7.5). */
export const CARD_EVENTS = new Set<DomainEvent['type']>([
  'EventFired',
  'Starved',
  'Spoiled',
  'ItemsStolen',
  'ItemBroke',
  'RentDebt',
  'ExtensionDenied',
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

export type UnsubscribeCommand = Extract<Command, { type: 'Unsubscribe' }>;

/** A big action waiting for the player's OK (M13.8). */
export interface ConfirmPending {
  cmd: Command;
  stateHash: string;
}

/** Commands that always ask first: they commit a lot of money or change how the player lives. */
export const CONFIRM_COMMANDS: ReadonlySet<string> = new Set([
  'TakeLoan',
  'BuyCar',
  'SellCar',
  'MoveHome',
  'Enroll',
]);

/** Spending at least this share (percent) of cash also asks first. */
export const CONFIRM_CASH_PERCENT = 50;

export interface SubscriptionCancelPending {
  cmd: UnsubscribeCommand;
  /** Engine-state snapshot that owned the offer; stale dialogs must never dispatch. */
  stateHash: string;
}

/** A point in the acting human's current turn that `undoLast` can return to (M12.2). */
export interface UndoSnapshot {
  state: GameState;
  log: LogEntry[];
  cards: DomainEvent[];
  mapView: boolean;
}

/** Most steps one turn can be rewound; a turn holds far fewer actions than this. */
export const MAX_UNDO = 40;

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
  /** Result pop-ups for the human's own actions, oldest first (M13.2). */
  outcomes: DomainEvent[];
  /** Open detail card for a goal, the job, the home or studies (M13.3–13.6). */
  info: InfoTopic | null;
  ticker: TickerEntry[];
  /** What the last human action did to that seat (M11.10); cleared by the toast's timer. */
  delta: { id: number; seat: number; events: DomainEvent[] } | null;
  /**
   * Snapshots taken before each of this turn's human actions (M12.2). The engine never mutates its
   * input, so a snapshot is just the earlier state; restoring it keeps the RNG and command log
   * exactly as they were, so replays stay identical. Emptied whenever the turn changes.
   */
  undoStack: UndoSnapshot[];
  /** Human seat currently controlling the device (hotseat privacy). */
  viewerSeat: number;
  selectedLocation: LocationId | null;
  /** Show the street at the start of a human turn, even when the player is inside. */
  mapView: boolean;
  travelOpen: boolean;
  /** Transport mode chosen in the travel sheet (UX 7.2, cycled with M). */
  travelMode: string;
  logOpen: boolean;
  standingsOpen: boolean;
  menuOpen: boolean;
  helpOpen: boolean;
  /** Command palette (M12.3) is open. */
  paletteOpen: boolean;
  /** End-turn confirmation is pending because hours are still left (UX 7.7). */
  endTurnPending: boolean;
  /** The deliberately inconvenient second step in the subscription cancellation flow. */
  subscriptionCancelPending: SubscriptionCancelPending | null;
  /** Big action awaiting confirmation, with its before → after preview (M13.8). */
  confirmPending: ConfirmPending | null;
  aiThinking: boolean;
  loading: boolean;
  aiSkip: boolean;
  lastError: ErrorCode | null;
  debug: boolean;
  autoplay: boolean;
  aiClient: AiClient;

  go: (screen: Screen) => void;
  beginLoad: () => number;
  finishLoad: (token: number, loaded?: { state: GameState; pack: CityPack }) => boolean;
  ownsLoad: (token: number) => boolean;
  startGame: (config: GameConfig, opts?: { debug?: boolean; autoplay?: boolean }) => void;
  dispatch: (cmd: Command) => boolean;
  selectLocation: (id: LocationId | null) => void;
  openTravel: (id: LocationId) => void;
  showMap: () => void;
  /** Visit a place with the selected (or explicit) mode, then enter if the whole trip is legal. */
  visitLocation: (id: LocationId, mode?: string) => boolean;
  /** Travel now with the chosen mode (or the first legal one); false when it cannot (M13.1). */
  quickTravel: (id: LocationId) => boolean;
  closeTravel: () => void;
  setTravelMode: (mode: string) => void;
  cycleTravelMode: () => void;
  toggleLog: () => void;
  toggleStandings: () => void;
  toggleMenu: () => void;
  /** End the turn, or ask first when hours remain over `END_TURN_CONFIRM_HOURS` or a weekly need is unmet. */
  requestEndTurn: () => void;
  cancelEndTurn: () => void;
  requestSubscriptionCancel: (cmd: UnsubscribeCommand) => boolean;
  confirmSubscriptionCancel: () => boolean;
  cancelSubscriptionCancel: () => void;
  /** Ask first when the command is big; false means it needs no confirmation (M13.8). */
  requestConfirm: (cmd: Command) => boolean;
  confirmAction: () => boolean;
  cancelConfirm: () => void;
  toggleHelp: () => void;
  togglePalette: (open?: boolean) => void;
  dismissCard: () => void;
  dismissOutcome: () => void;
  openInfo: (topic: InfoTopic) => void;
  closeInfo: () => void;
  dismissAllCards: () => void;
  clearDelta: () => void;
  /** Rewind the human's last action this turn (M12.2); false when there is nothing to undo. */
  undoLast: () => boolean;
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
  delta: null,
  undoStack: [],
  pendingCards: [],
  outcomes: [],
  info: null,
  ticker: [],
  viewerSeat: 0,
  selectedLocation: null,
  mapView: false,
  travelOpen: false,
  travelMode: 'walk',
  logOpen: false,
  standingsOpen: false,
  menuOpen: false,
  helpOpen: false,
  paletteOpen: false,
  endTurnPending: false,
  subscriptionCancelPending: null,
  confirmPending: null,
  loading: false,
  aiThinking: false,
  aiSkip: false,
  lastError: null,
  debug: false,
  autoplay: false,
  aiClient: createAiClient(),

  go(screen) {
    if (screen !== 'game' && screen !== 'pass') {
      gameGeneration++;
      get().aiClient.cancelPending();
      set({ aiThinking: false, loading: false });
    }
    set({ screen, helpOpen: false, menuOpen: false, paletteOpen: false });
    if (screen === 'game') void get().runAiIfNeeded();
  },
  beginLoad() {
    gameGeneration++;
    get().aiClient.cancelPending();
    set({ loading: true, aiThinking: false });
    return gameGeneration;
  },
  ownsLoad(token) {
    return token === gameGeneration && get().loading;
  },
  finishLoad(token, loaded) {
    if (!get().ownsLoad(token)) return false;
    if (!loaded) {
      set({ loading: false });
      void get().runAiIfNeeded();
      return false;
    }
    const state = structuredClone(loaded.state);
    const humans = humanSeats(state);
    loadPackStrings(loaded.pack);
    set({
      state,
      pack: loaded.pack,
      loading: false,
      aiThinking: false,
      aiSkip: false,
      log: [],
      cards: [],
      pendingCards: [],
      outcomes: [],
      info: null,
      ticker: [],
      delta: null,
      undoStack: [],
      viewerSeat: humans.includes(state.activeSeat) ? state.activeSeat : (humans[0] ?? 0),
      selectedLocation: null,
      // A saved game resumes its current view; a new turn will show the map.
      mapView: false,
      travelOpen: false,
      travelMode: 'walk',
      logOpen: false,
      standingsOpen: false,
      menuOpen: false,
      helpOpen: false,
      endTurnPending: false,
      subscriptionCancelPending: null,
      confirmPending: null,
      lastError: null,
      debug: state.debugTouched,
      autoplay: false,
      screen:
        state.winner !== null
          ? 'end'
          : humans.length > 1 && humans.includes(state.activeSeat)
            ? 'pass'
            : 'game',
    });
    void get().runAiIfNeeded();
    return true;
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
      delta: null,
      undoStack: [],
      viewerSeat: humans[0] ?? 0,
      selectedLocation: null,
      mapView: true,
      travelOpen: false,
      logOpen: false,
      standingsOpen: false,
      menuOpen: false,
      helpOpen: false,
      endTurnPending: false,
      subscriptionCancelPending: null,
      confirmPending: null,
      loading: false,
      aiThinking: false,
      aiSkip: false,
      pendingCards: [],
      outcomes: [],
      info: null,
      lastError: null,
      debug: opts.debug ?? false,
      autoplay: opts.autoplay ?? false,
      screen: humans.length > 1 && humans.includes(first) ? 'pass' : 'game',
    });
    void get().runAiIfNeeded();
  },

  dispatch(cmd) {
    const { state, pack } = get();
    if (!state || !pack || get().loading) return false;
    const seat = state.activeSeat;
    const r = applyCommand(state, seat, cmd, pack);
    const rejected = r.events.find((e) => e.type === 'CommandRejected');
    if (rejected?.type === 'CommandRejected') {
      set({ lastError: rejected.code });
      if (state.players[seat]?.controller === 'human-local') haptic('fail');
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
      // The tutorial explains each result itself, and its overlay would sit over a pop-up.
      outcomes:
        isHuman && !useTutorial.getState().active
          ? [
              ...get().outcomes,
              ...r.events.filter(
                (e) =>
                  'seat' in e &&
                  e.seat === seat &&
                  !CARD_EVENTS.has(e.type) &&
                  isOutcome(e, useSettings.getState().settings.popups),
              ),
            ]
          : get().outcomes,
      lastError: null,
      travelOpen: false,
      mapView:
        cmd.type === 'Enter'
          ? false
          : cmd.type === 'Move' || cmd.type === 'Exit'
            ? true
            : get().mapView,
      endTurnPending: false,
      subscriptionCancelPending: null,
      confirmPending: null,
    };
    // Undo (M12.2): each human action pushes the state it started from; a turn change or a
    // setting that turns undo off starts the stack over.
    const canUndo =
      isHuman && cmd.type !== 'EndTurn' && !useSettings.getState().settings.strictMode;
    patch.undoStack = canUndo
      ? [
          ...get().undoStack,
          { state, log: get().log, cards: get().cards, mapView: get().mapView },
        ].slice(-MAX_UNDO)
      : [];
    // Turn changed: hotseat privacy screen, or AI turn.
    if (next.activeSeat !== seat || next.winner !== null) {
      patch.undoStack = [];
      patch.selectedLocation = null;
      patch.mapView = true;
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
    if (isHuman && cmd.type !== 'EndTurn') {
      const events = r.events.filter((e) => 'seat' in e && e.seat === seat);
      patch.delta = events.length > 0 ? { id: (get().delta?.id ?? 0) + 1, seat, events } : null;
    }
    set(patch);
    if (isHuman && cmd.type !== 'EndTurn') haptic('success');
    if (!isHuman) set({ ticker: [...get().ticker, { seat, cmd }].slice(-12) });
    void get().runAiIfNeeded();
    return true;
  },

  selectLocation(id) {
    set({ selectedLocation: id, travelOpen: false, mapView: false });
  },
  openTravel(id) {
    set({ selectedLocation: id, travelOpen: true, mapView: true, lastError: null });
  },
  showMap() {
    set({ mapView: true, travelOpen: false });
  },
  visitLocation(id, mode) {
    const { state, pack } = get();
    if (!state || !pack || get().loading || get().screen !== 'game') return false;
    const seat = state.activeSeat;
    const player = state.players[seat];
    const before = get();
    if (player?.controller !== 'human-local' || !pack.locationById[id]) return false;
    if (player.location === id) {
      if (player.inside) {
        set({ selectedLocation: id, travelOpen: false, mapView: false, lastError: null });
        return true;
      }
      set({ selectedLocation: id, travelOpen: false });
      return get().dispatch({ type: 'Enter' });
    }
    const rows = get()
      .candidates()
      .filter((r) => r.cmd.type === 'Move' && r.cmd.to === id);
    const selectedMode = mode ?? get().travelMode;
    const preferred = rows.find((r) => r.cmd.type === 'Move' && r.cmd.mode === selectedMode);
    const row =
      mode === undefined
        ? preferred?.code === null
          ? preferred
          : (rows.find((r) => r.code === null) ?? preferred)
        : preferred;
    if (row?.code !== null) {
      set({ selectedLocation: id, travelOpen: true, lastError: row?.code ?? null });
      return false;
    }
    // Test the exact engine transitions on a clone before committing either action. Movement can
    // stop partway and end the turn; entry can fail when the destination is closed or time is low.
    const moved = applyCommand(state, seat, row.cmd, pack);
    const arrival = moved.state.players[seat];
    if (moved.state.activeSeat !== seat || arrival?.location !== id || arrival.inside) {
      set({ selectedLocation: id, travelOpen: true, lastError: 'ERR_NOT_ENOUGH_HOURS' });
      return false;
    }
    const entered = applyCommand(moved.state, seat, { type: 'Enter' }, pack);
    const rejection = entered.events.find((event) => event.type === 'CommandRejected');
    if (rejection?.type === 'CommandRejected') {
      set({ selectedLocation: id, travelOpen: true, lastError: rejection.code });
      return false;
    }
    if (!get().dispatch(row.cmd)) return false;
    const current = get().state;
    if (current?.activeSeat !== seat || current.players[seat]?.location !== id) return false;
    const enteredOk = get().dispatch({ type: 'Enter' });
    if (enteredOk && !useSettings.getState().settings.strictMode) {
      // A map click is one player action even though the engine records Move and Enter separately.
      set({
        undoStack: [
          ...before.undoStack,
          { state, log: before.log, cards: before.cards, mapView: before.mapView },
        ].slice(-MAX_UNDO),
      });
    }
    return enteredOk;
  },
  quickTravel(id) {
    if (!useSettings.getState().settings.quickTravel) return false;
    return get().visitLocation(id);
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
    const { pack } = get();
    const left = state?.players[state.activeSeat]?.hoursLeft ?? 0;
    const needs = state && pack ? weekNeeds(state, pack).length : 0;
    if (left > END_TURN_CONFIRM_HOURS || needs > 0) {
      set({ endTurnPending: true });
      return;
    }
    set({ endTurnPending: false });
    get().dispatch({ type: 'EndTurn' });
  },
  cancelEndTurn() {
    set({ endTurnPending: false });
  },
  requestSubscriptionCancel(cmd) {
    const { state, pack } = get();
    if (!state || !pack || get().loading) return false;
    const legal = legalCommands(state, state.activeSeat, pack).some(
      (candidate) => candidate.type === 'Unsubscribe' && candidate.subId === cmd.subId,
    );
    if (!legal) return false;
    set({ subscriptionCancelPending: { cmd, stateHash: stateHash(state) } });
    return true;
  },
  confirmSubscriptionCancel() {
    const { state, subscriptionCancelPending: pending } = get();
    set({ subscriptionCancelPending: null });
    if (!state) return false;
    if (stateHash(state) !== pending?.stateHash) return false;
    return get().dispatch(pending.cmd);
  },
  cancelSubscriptionCancel() {
    set({ subscriptionCancelPending: null });
  },
  requestConfirm(cmd) {
    const { state, pack, loading } = get();
    if (!state || !pack || loading || useTutorial.getState().active) return false;
    const p = get().preview(cmd);
    const cash = state.players[state.activeSeat]?.cash ?? 0;
    const big =
      CONFIRM_COMMANDS.has(cmd.type) ||
      (p !== null && p.money < 0 && cash > 0 && (-p.money * 100) / cash >= CONFIRM_CASH_PERCENT);
    if (!big) return false;
    const legal = legalCommands(state, state.activeSeat, pack).some(
      (c) => JSON.stringify(c) === JSON.stringify(cmd),
    );
    if (!legal) return false;
    set({ confirmPending: { cmd, stateHash: stateHash(state) } });
    return true;
  },
  confirmAction() {
    const { state, confirmPending: pending } = get();
    set({ confirmPending: null });
    if (!state || stateHash(state) !== pending?.stateHash) return false;
    return get().dispatch(pending.cmd);
  },
  cancelConfirm() {
    set({ confirmPending: null });
  },
  toggleHelp() {
    set({ helpOpen: !get().helpOpen });
  },
  togglePalette(open) {
    set({ paletteOpen: open ?? !get().paletteOpen });
  },
  dismissCard() {
    set({ cards: get().cards.slice(1) });
  },
  openInfo(topic) {
    set({ info: topic, travelOpen: false });
  },
  closeInfo() {
    set({ info: null });
  },
  dismissOutcome() {
    set({ outcomes: get().outcomes.slice(1) });
  },
  dismissAllCards() {
    set({ cards: [] });
  },
  clearDelta() {
    set({ delta: null });
  },
  undoLast() {
    const { undoStack, state, loading } = get();
    const snap = undoStack[undoStack.length - 1];
    if (!snap || !state || loading || state.winner !== null) return false;
    // Only the seat that acted may rewind, and only inside the same turn.
    if (snap.state.activeSeat !== state.activeSeat || snap.state.week !== state.week) return false;
    set({
      state: snap.state,
      mapView: snap.mapView,
      log: snap.log,
      cards: snap.cards,
      outcomes: [],
      info: null,
      undoStack: undoStack.slice(0, -1),
      delta: null,
      lastError: null,
      travelOpen: false,
      endTurnPending: false,
      subscriptionCancelPending: null,
      confirmPending: null,
    });
    return true;
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
      outcomes: [],
      info: null,
    });
  },

  async runAiIfNeeded() {
    const g = get();
    const { state, pack } = g;
    if (
      !state ||
      !pack ||
      state.winner !== null ||
      g.aiThinking ||
      g.loading ||
      g.screen !== 'game'
    )
      return;
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
      outcomes: [],
      info: null,
      ticker: [],
      delta: null,
      undoStack: [],
      log: [],
      loading: false,
      aiThinking: false,
      aiSkip: false,
      subscriptionCancelPending: null,
      confirmPending: null,
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
    set({ state: next, undoStack: [], subscriptionCancelPending: null, confirmPending: null });
  },
}));

/** Human-readable helpers shared by components. */
export function hoursLabel(halfHours: number): string {
  return (halfHours / 2).toString();
}
