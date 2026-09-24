/**
 * Stage geometry for the scene UI (ART_SPEC 17.9): art sets lay out in a 1600×1000 stage, the
 * DOM places layers in percentages of it, so the scene scales with its container.
 */
import { STAGE, type Point, type Rect } from '@hustle-ring/art';
import type { CSSProperties } from 'react';

export function pctX(x: number): string {
  return `${(x / STAGE.width) * 100}%`;
}

export function pctY(y: number): string {
  return `${(y / STAGE.height) * 100}%`;
}

/** Absolute placement of a stage rectangle. */
export function rectStyle(r: Rect): CSSProperties {
  return {
    position: 'absolute',
    left: pctX(r.x),
    top: pctY(r.y),
    width: pctX(r.width),
    height: pctY(r.height),
  };
}

/** Absolute placement of an element anchored at a stage point (bottom centre by default). */
export function anchorStyle(p: Point, width: number, height: number): CSSProperties {
  return {
    position: 'absolute',
    left: pctX(p.x - width / 2),
    top: pctY(p.y - height),
    width: pctX(width),
    height: pctY(height),
  };
}
