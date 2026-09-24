/**
 * Walking avatars (ART_SPEC 17.3, 17.9, M9.7): one per player on the street path, tinted in the
 * player's colour with the shape badge above the head (colour is never the only signal, UX 7.8).
 * Decorative: the squares' labels already say where everyone is.
 */
import type { BoardLayout, Point } from '@hustle-ring/art';
import type { PaletteId, TokenShape } from '@hustle-ring/shared';
import { useEffect, useState } from 'react';
import { registryFor, type PlaceholderAssetRegistry } from '../../assets/AssetRegistry';
import type { ArtRegistry } from '../../assets/art/artRegistry';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { useMediaQuery } from '../game/useIsPhone';
import { ArtImage } from './ArtImage';
import { anchorStyle } from './geometry';
import { avatarIdFor, frameAt, walkDuration, walkRoute, type WalkFrame } from './walk';

/** Avatar size on the stage (the 64×96 art, scaled up). */
const AVATAR_W = 80;
const AVATAR_H = 120;
const TICK_MS = 40;

export function useReducedMotion(): boolean {
  const setting = useSettings((s) => s.settings.reducedMotion);
  const system = useMediaQuery('(prefers-reduced-motion: reduce)', false);
  return setting || system;
}

/** The frame to draw for an avatar standing at, or walking to, ring index `node`. */
export function useWalker(node: number, path: readonly Point[], reduced: boolean): WalkFrame {
  const [walk, setWalk] = useState({ from: node, to: node, elapsed: 0 });
  // A new destination restarts the walk from wherever the last one ended (derived state).
  if (walk.to !== node) setWalk({ from: walk.to, to: node, elapsed: 0 });
  const route = reduced ? [node] : walkRoute(path.length, walk.from, walk.to);
  const total = walkDuration(route);
  const walking = walk.elapsed < total;
  useEffect(() => {
    if (!walking) return;
    const id = setInterval(() => {
      setWalk((w) => ({ ...w, elapsed: w.elapsed + TICK_MS }));
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, [walking, walk.from, walk.to]);
  return frameAt(route, path, walk.elapsed);
}

function Walker({
  registry,
  tokens,
  path,
  node,
  seat,
  avatarId,
  color,
  shape,
  initial,
  offset,
  reduced,
}: {
  registry: ArtRegistry;
  tokens: PlaceholderAssetRegistry;
  path: readonly Point[];
  node: number;
  seat: number;
  avatarId: string;
  color: PaletteId;
  shape: TokenShape;
  initial: string;
  offset: number;
  reduced: boolean;
}) {
  const frame = useWalker(node, path, reduced);
  const at = { x: frame.point.x + offset, y: frame.point.y };
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none"
      style={anchorStyle(at, AVATAR_W, AVATAR_H)}
      data-testid={`avatar-${seat}`}
      data-pose={frame.pose}
      data-dir={frame.dir}
    >
      <ArtImage
        registry={registry}
        artKey={`avatar:${avatarId}:${frame.pose}:${frame.dir}`}
        tint={color}
        className="h-full w-full"
      />
      <svg
        viewBox="-20 -20 40 40"
        className="absolute -top-[22%] left-1/2 w-[36%] -translate-x-1/2"
      >
        {tokens.token(shape, color, initial, 11)}
      </svg>
    </div>
  );
}

export function AvatarLayer({ registry, layout }: { registry: ArtRegistry; layout: BoardLayout }) {
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const reduced = useReducedMotion();
  if (!state || !pack) return null;
  const count = state.players.length;
  const tokens = registryFor(pack);
  return (
    <>
      {state.players.map((p) => (
        <Walker
          key={p.seat}
          registry={registry}
          tokens={tokens}
          path={layout.path}
          node={pack.board.nodeOf[p.location] ?? 0}
          seat={p.seat}
          avatarId={avatarIdFor(state.config.seats[p.seat], p.seat)}
          color={p.color}
          shape={p.shape}
          initial={p.name.slice(0, 1).toUpperCase()}
          offset={(p.seat - (count - 1) / 2) * 44}
          reduced={reduced}
        />
      ))}
    </>
  );
}

/** Portrait of the active player for the HUD bar. */
export function HudAvatar({ registry }: { registry: ArtRegistry }) {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const p = state.players[state.activeSeat];
  if (!p) return null;
  return (
    <ArtImage
      registry={registry}
      artKey={`avatar:${avatarIdFor(state.config.seats[p.seat], p.seat)}:idle:s`}
      tint={p.color}
      className="h-16 w-11 shrink-0"
      testId="hud-avatar"
    />
  );
}
