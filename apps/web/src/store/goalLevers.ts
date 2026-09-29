/**
 * "Why not yet?" (M12.5): for a goal bar, the few actions that move it. Actions on offer where the
 * player stands come first (ranked by how much they help, from the engine's own previews); when
 * nothing here helps, the nearest place that offers a helpful service is named instead.
 *
 * Under classic opacity the ranking ignores hidden stat changes, so it cannot leak them.
 */
import type { CityPack } from '@hustle-ring/content';
import type { ActionPreview, Command, GameState } from '@hustle-ring/engine';
import type { GoalId } from '@hustle-ring/shared';
import { nearest } from './nextStep';

/** Command types that move each goal. */
export const GOAL_COMMANDS: Record<GoalId, readonly string[]> = {
  wealth: ['Work', 'GigShift', 'SellItem', 'SellAsset', 'BuyAsset'],
  happiness: ['Relax', 'EatMeal', 'BuyItem', 'OrderDelivery'],
  education: ['Study', 'StudyOnline', 'Enroll'],
  career: ['Work', 'ApplyJob', 'AskRaise', 'GigShift'],
};

/** Location services to send the player to when nothing here helps. */
export const GOAL_SERVICES: Record<GoalId, readonly string[]> = {
  wealth: ['work', 'invest'],
  happiness: ['relax', 'meals'],
  education: ['study'],
  career: ['work', 'apply', 'raise'],
};

export const MAX_LEVERS = 3;

export interface GoalLever {
  cmd: Command;
  preview: ActionPreview | null;
}

export interface GoalLevers {
  here: GoalLever[];
  /** Where to go when no action here moves the goal. */
  place: string | null;
}

function gain(goal: GoalId, preview: ActionPreview | null, opaque: boolean): number {
  if (!preview) return 0;
  if (goal === 'wealth') return preview.money;
  if (opaque) return 0;
  return preview.deltas[goal] ?? 0;
}

export function goalLevers(
  goal: GoalId,
  state: GameState,
  pack: CityPack,
  candidates: readonly { cmd: Command; code: string | null }[],
  preview: (cmd: Command) => ActionPreview | null,
): GoalLevers {
  const opaque = state.config.classicOpacity;
  const types = GOAL_COMMANDS[goal];
  const here = candidates
    .filter((c) => c.code === null && types.includes(c.cmd.type))
    .map((c) => ({ cmd: c.cmd, preview: preview(c.cmd) }))
    .sort((a, b) => gain(goal, b.preview, opaque) - gain(goal, a.preview, opaque))
    .slice(0, MAX_LEVERS);
  const player = state.players[state.activeSeat];
  const place =
    here.length > 0 || !player ? null : nearest(pack, player.location, [...GOAL_SERVICES[goal]]);
  return { here, place: place === player?.location ? null : place };
}
