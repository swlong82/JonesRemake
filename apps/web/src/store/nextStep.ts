/**
 * "What should I do next?" (M11.5). A small, ordered reading of the public game state that names
 * one sensible next step and, when it lives somewhere else, the location to head for. It only
 * looks at things the player can see (job, food, rent, hours), so it works under classic opacity.
 */
import type { CityPack } from '@hustle-ring/content';
import type { GameState } from '@hustle-ring/engine';
import { weekNeeds } from './needs';

export type NextStepId = 'endTurn' | 'job' | 'eat' | 'rent' | 'work';

export interface NextStep {
  id: NextStepId;
  /** Location to go to, or null when the step happens right where the player is. */
  place: string | null;
}

/** The location with `service` that is fewest ring steps from `from`, if the pack has one. */
function nearest(pack: CityPack, from: string, services: string[]): string | null {
  const a = pack.board.nodeOf[from];
  let best: { id: string; d: number } | null = null;
  for (const loc of pack.locations) {
    if (!loc.services.some((s) => services.includes(s))) continue;
    const b = pack.board.nodeOf[loc.id];
    const d = a === undefined || b === undefined ? 0 : (pack.board.dist[a]?.[b] ?? 0);
    if (best === null || d < best.d) best = { id: loc.id, d };
  }
  return best?.id ?? null;
}

export function nextStep(state: GameState, pack: CityPack): NextStep | null {
  const p = state.players[state.activeSeat];
  if (!p || p.controller === 'ai') return null;
  const go = (place: string | null): NextStep['place'] =>
    place === null || place === p.location ? null : place;

  if (p.hoursLeft <= 0) return { id: 'endTurn', place: null };
  if (!p.job) {
    const place = nearest(pack, p.location, ['apply']);
    if (place !== null) return { id: 'job', place: go(place) };
  }
  const needs = weekNeeds(state, pack);
  if (needs.some((n) => n.id === 'food')) {
    const place = nearest(pack, p.location, ['meals', 'grocery']);
    if (place !== null) return { id: 'eat', place: go(place) };
  }
  if (needs.some((n) => n.id === 'rent')) {
    const place = nearest(pack, p.location, ['rent']);
    if (place !== null) return { id: 'rent', place: go(place) };
  }
  if (p.job) {
    const place = pack.jobById[p.job.jobId]?.workplaceId ?? null;
    return { id: 'work', place: go(place) };
  }
  return null;
}
