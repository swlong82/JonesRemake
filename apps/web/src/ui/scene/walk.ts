/**
 * Walking along the street (ART_SPEC 17.3, 17.9, M9.7). Pure: which squares a trip passes, where
 * the avatar is after `elapsed` ms, which way it faces and which walk frame shows. Duration is
 * proportional to the squares walked; reduced motion skips straight to the destination.
 */
import type { AvatarDir, AvatarPose, Point } from '@hustle-ring/art';
import { PLAYER_AVATARS, rivalAvatarId } from '@hustle-ring/art';
import type { SeatConfig } from '@hustle-ring/engine';

/** Time to walk one square, and to show one walk frame. */
export const STEP_MS = 180;
export const FRAME_MS = 120;

/**
 * Ring indices from `from` to `to` inclusive, the short way round (the way the engine moves,
 * GDD 4.2); a tie goes clockwise.
 */
export function walkRoute(n: number, from: number, to: number): number[] {
  if (n <= 0 || from === to) return [to];
  const cw = (((to - from) % n) + n) % n;
  const ccw = n - cw;
  const step = cw <= ccw ? 1 : -1;
  const count = Math.min(cw, ccw);
  return Array.from({ length: count + 1 }, (_, i) => (((from + step * i) % n) + n) % n);
}

export function walkDuration(route: readonly number[]): number {
  return Math.max(0, route.length - 1) * STEP_MS;
}

/** Facing for a move from `a` to `b` in stage coordinates (y grows downwards). */
export function facing(a: Point, b: Point): AvatarDir {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
  return dy >= 0 ? 's' : 'n';
}

export interface WalkFrame {
  point: Point;
  dir: AvatarDir;
  pose: AvatarPose;
  done: boolean;
}

/** Where the avatar is `elapsed` ms into walking `route` over the `path` waypoints. */
export function frameAt(
  route: readonly number[],
  path: readonly Point[],
  elapsed: number,
): WalkFrame {
  const last = route[route.length - 1] ?? 0;
  const end = path[last] ?? { x: 0, y: 0 };
  const total = walkDuration(route);
  if (route.length < 2 || elapsed >= total) {
    return { point: end, dir: 's', pose: 'idle', done: true };
  }
  const t = Math.max(0, elapsed) / STEP_MS;
  const i = Math.floor(t);
  const a = path[route[i]!] ?? end;
  const b = path[route[i + 1]!] ?? end;
  const f = t - i;
  return {
    point: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
    dir: facing(a, b),
    pose: Math.floor(elapsed / FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2',
    done: false,
  };
}

/** The avatar a seat shows: its chosen one, else the personality's rival, else one per seat. */
export function avatarIdFor(seat: SeatConfig | undefined, index: number): string {
  if (seat?.avatar !== undefined) return seat.avatar;
  if (seat?.ai) return rivalAvatarId(seat.ai.personality);
  return PLAYER_AVATARS[index % PLAYER_AVATARS.length]!;
}
