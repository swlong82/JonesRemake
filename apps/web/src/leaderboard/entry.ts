/**
 * Leaderboard entry for a finished game (ROADMAP_SCAFFOLDS 16.7). Only a human winner gets one:
 * losers score 0, AI-only games are excluded, and so is any game a debug switch touched.
 */
import type { CityPack } from '@hustle-ring/content';
import { score, type GameState } from '@hustle-ring/engine';
import type { ScoreEntry } from '@hustle-ring/platform';

/** Hotseat players share a device, so a local player is known by the seat name they played. */
export function localPlayerId(name: string): string {
  return `local:${name.trim().toLowerCase()}`;
}

/** A key that is the same for every render of one finished game. */
export function gameKey(state: GameState): string {
  return `${state.config.seed}:${state.week}:${state.log.length}`;
}

export function leaderboardEntry(
  state: GameState,
  pack: CityPack,
  finishedAt: string,
): ScoreEntry | null {
  if (state.winner === null || state.debugTouched) return null;
  const winner = state.players[state.winner];
  if (winner?.controller !== 'human-local') return null;
  return {
    playerId: localPlayerId(winner.name),
    displayName: winner.name,
    packId: state.packId,
    packVersion: state.packVersion,
    engineVersion: state.engineVersion,
    scoringVersion: pack.rules.scoring.version,
    seed: state.config.seed,
    weeks: state.week,
    score: score(state, state.winner, pack),
    finishedAt,
    verified: false,
  };
}
