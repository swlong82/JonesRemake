/**
 * Starting the tutorial (UX_SPEC 7.6): "runs in a fixed tutorial seed with 1 human + 1 Easy AI",
 * triggered on the first game or from How to Play.
 */
import type { GameConfig } from '@hustle-ring/engine';
import { useGame } from '../store/gameStore.js';
import { useSettings } from '../store/settings.js';
import { TUTORIAL_GOALS, TUTORIAL_PACK, TUTORIAL_SEED } from './steps.js';
import { useTutorial } from './useTutorial.js';

export function tutorialConfig(): GameConfig {
  const goals = {
    wealth: TUTORIAL_GOALS,
    happiness: TUTORIAL_GOALS,
    education: TUTORIAL_GOALS,
    career: TUTORIAL_GOALS,
  };
  return {
    packId: TUTORIAL_PACK,
    seed: TUTORIAL_SEED,
    chaos: 'classic',
    classicOpacity: false,
    seats: [
      { name: 'You', controller: 'human-local', color: 'p1', shape: 'circle', goals },
      {
        name: 'Rival',
        controller: 'ai',
        color: 'p2',
        shape: 'square',
        goals,
        ai: { difficulty: 'easy', personality: 'balanced' },
      },
    ],
  };
}

/** Start a fresh tutorial game. Safe to call from any screen. */
export function startTutorial(): void {
  useGame.getState().startGame(tutorialConfig());
  useTutorial.getState().start();
}

/** True the first time the player reaches a game, until they finish or skip the tutorial. */
export function shouldOfferTutorial(): boolean {
  return !useSettings.getState().settings.tutorialSeen;
}
