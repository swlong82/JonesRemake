/**
 * Starts the tutorial the first time a player reaches a game (UX_SPEC 7.6: "triggered on first
 * game or via How to Play"), and only while the `tutorial` app flag is on. Skipping or finishing
 * sets `tutorialSeen`, so it never comes back uninvited.
 */
import { useEffect, useRef } from 'react';
import { useAppFlag } from '../flags/appFlags.js';
import { useGame } from '../store/gameStore.js';
import { useSettings } from '../store/settings.js';
import { useTutorial } from './useTutorial.js';

export function useTutorialBoot(): void {
  const enabled = useAppFlag('tutorial');
  const screen = useGame((s) => s.screen);
  const hasGame = useGame((s) => s.state !== null);
  const seen = useSettings((s) => s.settings.tutorialSeen);
  const active = useTutorial((s) => s.active);
  const start = useTutorial((s) => s.start);
  const offered = useRef(false);

  useEffect(() => {
    if (!enabled || seen || active || offered.current) return;
    if (screen !== 'game' || !hasGame) return;
    // The first game the player reaches runs the script over it; the fixed tutorial seed is for
    // the How-to-Play entry point, which starts its own game.
    offered.current = true;
    start();
  }, [enabled, seen, active, screen, hasGame, start]);
}
