/**
 * Debug boot (UX 7.9): `?debug=1` plus the `debugTools` app flag (which itself needs
 * `VITE_DEBUG_ALLOWED=true`) turn the debug panel on. A deployed build can never enable it.
 */
import { useEffect } from 'react';
import { useAppFlag } from '../flags/appFlags';
import { useGame } from '../store/gameStore';

export function debugRequested(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/** True when the debug panel should render. Also flags the running game as debug-touched. */
export function useDebugBoot(search = globalThis.location.search): boolean {
  const allowed = useAppFlag('debugTools');
  const debug = useGame((s) => s.debug);
  const on = allowed && debugRequested(search);
  useEffect(() => {
    if (on && !debug) useGame.setState({ debug: true });
  }, [on, debug]);
  return on;
}
