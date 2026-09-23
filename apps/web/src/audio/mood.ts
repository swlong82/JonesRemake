/**
 * Which mood the game is in (AUDIO_SPEC 8.3 "When" column). Pure, so the table is unit-tested
 * from plain state rather than from a rendered screen.
 */
import { wellbeingOf, type GameState } from '@hustle-ring/engine';
import type { Screen } from '../store/gameStore.js';
import type { MusicMood } from './types.js';

/** AUDIO_SPEC 8.3: "active player wellbeing < 25". Packs without the stat never hit it. */
export const TENSION_WELLBEING = 25;

export function moodFor(screen: Screen, state: GameState | null): MusicMood {
  if (screen === 'end') return 'victory';
  if (state === null || screen !== 'game') return 'menu';
  const player = state.players[state.activeSeat];
  if (player) {
    const wellbeing = wellbeingOf(player);
    if (player.home.debt > 0) return 'tension';
    if (wellbeing !== undefined && wellbeing < TENSION_WELLBEING) return 'tension';
  }
  if (state.econ.phase === 'boom') return 'boom';
  if (state.econ.phase === 'recession') return 'recession';
  return 'normal';
}
