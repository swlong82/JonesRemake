/**
 * Keyboard map (UX 7.7). Attached by the game screen; ignores keystrokes aimed at form controls so
 * the setup and settings inputs keep working.
 */
import { useEffect } from 'react';
import { useGame } from '../../store/gameStore';
import { RING_KEYS } from './labels';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/** Resolve a ring key (1–9, 0, Q W E R T Y) to a location id on the board. */
export function locationForKey(key: string, locationAt: (string | null)[]): string | null {
  const index = RING_KEYS.indexOf(key.toUpperCase() as (typeof RING_KEYS)[number]);
  if (index < 0) return null;
  return locationAt[index] ?? null;
}

/** Handle one keydown against the current store state; exported for unit tests. */
export function handleGameKey(e: KeyboardEvent): void {
  if (isTypingTarget(e.target)) return;
  const store = useGame.getState();
  const { state, pack } = store;
  if (!state || !pack) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault(); // Manual save arrives with M7.2; swallow the browser's save dialog.
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // A retention offer is modal: only its own buttons and Escape may act while it is open.
  if (store.subscriptionCancelPending) {
    if (e.key === 'Escape') {
      e.preventDefault();
      store.cancelSubscriptionCancel();
    }
    return;
  }

  if (e.key === 'Escape') {
    if (store.cards.length > 0) store.dismissCard();
    else if (store.travelOpen) store.closeTravel();
    else if (store.endTurnPending) store.cancelEndTurn();
    else if (store.menuOpen) store.toggleMenu();
    else if (store.standingsOpen) store.toggleStandings();
    else if (store.logOpen) store.toggleLog();
    return;
  }
  // View toggles work any time; anything that could dispatch is limited to the human's own turn.
  const yourTurn = state.players[state.activeSeat]?.controller === 'human-local';

  if (e.key === 'Enter' || e.key === ' ') {
    if (!yourTurn) return;
    if (store.cards.length > 0) {
      e.preventDefault();
      store.dismissCard();
      return;
    }
    if (store.travelOpen && store.selectedLocation !== null) {
      e.preventDefault();
      const move = store
        .legal()
        .find(
          (c) =>
            c.type === 'Move' && c.to === store.selectedLocation && c.mode === store.travelMode,
        );
      if (move) store.dispatch(move);
    }
    return;
  }
  if (store.cards.length > 0) return;

  if (e.shiftKey && e.key.toLowerCase() === 'e') {
    if (yourTurn) store.requestEndTurn();
    return;
  }
  if (e.shiftKey) return;

  switch (e.key.toLowerCase()) {
    case 'm':
      if (store.travelOpen) store.cycleTravelMode();
      return;
    case 'l':
      store.toggleLog();
      return;
    case 'g':
      store.toggleStandings();
      return;
    case 'h':
      store.go('help');
      return;
    default:
      break;
  }
  if (!yourTurn) return;
  const loc = locationForKey(e.key, pack.board.locationAt);
  if (loc === null) return;
  const active = state.players[state.activeSeat];
  if (active?.location === loc) store.selectLocation(loc);
  else store.openTravel(loc);
}

export function useKeyboard(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      handleGameKey(e);
    };
    globalThis.addEventListener('keydown', onKey);
    return () => {
      globalThis.removeEventListener('keydown', onKey);
    };
  }, [enabled]);
}
