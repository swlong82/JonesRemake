/**
 * Pan and zoom for the phone scene (ART_SPEC 17.9, M9.9). Pure: a view is a scale plus the
 * stage's offset inside the viewport; every change is clamped so the stage always covers the
 * viewport (no empty edges) and the zoom stays within bounds.
 */

export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 3;

/** Keep the zoom in bounds and the scaled stage covering the viewport. */
export function clampView(view: View, viewport: Size, stage: Size): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  const w = stage.width * scale;
  const h = stage.height * scale;
  const clamp = (v: number, extent: number, room: number): number =>
    extent <= room ? (room - extent) / 2 : Math.min(0, Math.max(room - extent, v));
  return { scale, x: clamp(view.x, w, viewport.width), y: clamp(view.y, h, viewport.height) };
}

export function panBy(view: View, dx: number, dy: number, viewport: Size, stage: Size): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, viewport, stage);
}

/** Zoom by `factor`, keeping the stage point under (`cx`, `cy`) (viewport px) in place. */
export function zoomAt(
  view: View,
  factor: number,
  cx: number,
  cy: number,
  viewport: Size,
  stage: Size,
): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const k = scale / view.scale;
  return clampView(
    { scale, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k },
    viewport,
    stage,
  );
}

/** Centre the view on a stage point (in unscaled stage px). */
export function centreOn(view: View, px: number, py: number, viewport: Size, stage: Size): View {
  return clampView(
    { ...view, x: viewport.width / 2 - px * view.scale, y: viewport.height / 2 - py * view.scale },
    viewport,
    stage,
  );
}
