/**
 * Phone scene (ART_SPEC 17.9, M9.9): the city block in a pannable, zoomable viewport, with a
 * one-tap toggle to the location list (UX 7.2), which stays the accessible equivalent. The stage
 * is sized so buildings are at least 44 CSS px at the lowest zoom (UX 7.8); drag pans, a pinch or
 * the zoom buttons zoom, and a tap that ended a drag never activates a square.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { artRegistryFor, useArtSets } from '../../assets/art/artRegistry';
import { useScenePrefetch } from '../../assets/art/usePrefetch';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { PhoneLocationList } from '../game/PhoneLocationList';
import { AvatarLayer } from './Avatars';
import { BoardScene, layoutFor } from './BoardScene';
import { centreOn, clampView, panBy, zoomAt, type Size, type View } from './panZoom';

/** Viewport height as a share of its width; the stage fills that height at scale 1. */
const VIEWPORT_RATIO = 0.75;
const DRAG_THRESHOLD = 8;
const STAGE_RATIO = 1.6;

export type PhoneView = 'scene' | 'list';

function useWidth(ref: React.RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [ref]);
  return width;
}

function PannableScene() {
  const { t } = useTranslation();
  // Re-render when an art pack is installed or switched (M9.12).
  useArtSets((s) => s.version);
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, 390);
  const viewport: Size = { width, height: Math.round(width * VIEWPORT_RATIO) };
  const stage: Size = { width: viewport.height * STAGE_RATIO, height: viewport.height };
  const [view, setView] = useState<View | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const dragged = useRef(false);
  if (!state || !pack) return null;
  const registry = artRegistryFor(pack);
  const layout = layoutFor(registry, pack);
  const here = pack.board.nodeOf[state.players[state.activeSeat]?.location ?? ''] ?? 0;
  const door = layout.path[here] ?? { x: 800, y: 500 };
  const current =
    view === null
      ? centreOn(
          { scale: 1, x: 0, y: 0 },
          (door.x / 1600) * stage.width,
          (door.y / 1000) * stage.height,
          viewport,
          stage,
        )
      : clampView(view, viewport, stage);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      moved.current = 0;
      dragged.current = false;
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 1) {
      moved.current += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
      if (moved.current > DRAG_THRESHOLD) dragged.current = true;
      setView(panBy(current, next.x - prev.x, next.y - prev.y, viewport, stage));
    } else if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(next.x - other.x, next.y - other.y);
        const rect = box.current?.getBoundingClientRect();
        const cx = (next.x + other.x) / 2 - (rect?.left ?? 0);
        const cy = (next.y + other.y) / 2 - (rect?.top ?? 0);
        if (before > 0) setView(zoomAt(current, after / before, cx, cy, viewport, stage));
        dragged.current = true;
      }
    }
    pointers.current.set(e.pointerId, next);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(e.pointerId);
  };
  const zoom = (factor: number): void => {
    setView(zoomAt(current, factor, viewport.width / 2, viewport.height / 2, viewport, stage));
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={box}
        className="relative w-full touch-none overflow-hidden rounded-lg border border-line bg-surface-3"
        style={{ height: viewport.height }}
        data-testid="phone-scene"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        onClickCapture={(e) => {
          // A drag or pinch that ends over a building is not a tap on it.
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
            dragged.current = false;
          }
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: stage.width,
            height: stage.height,
            transform: `translate(${current.x}px, ${current.y}px) scale(${current.scale})`,
          }}
          data-testid="phone-stage"
          data-scale={current.scale.toFixed(2)}
        >
          <BoardScene registry={registry}>
            <AvatarLayer registry={registry} layout={layout} />
          </BoardScene>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => zoom(1 / 1.25)}
          aria-label={t('phone.zoomOut')}
          data-testid="zoom-out"
        >
          −
        </Button>
        <Button onClick={() => zoom(1.25)} aria-label={t('phone.zoomIn')} data-testid="zoom-in">
          +
        </Button>
      </div>
    </div>
  );
}

/** Scene or list, one tap apart. */
export function PhoneScene() {
  const { t } = useTranslation();
  useScenePrefetch();
  const [mode, setMode] = useState<PhoneView>('scene');
  return (
    <div className="flex flex-col gap-2" data-testid="phone-scene-switch">
      <div className="flex gap-2" role="group" aria-label={t('phone.view')}>
        <Button
          className="grow"
          variant={mode === 'scene' ? 'primary' : 'default'}
          aria-pressed={mode === 'scene'}
          onClick={() => setMode('scene')}
          data-testid="phone-view-scene"
        >
          {t('phone.viewScene')}
        </Button>
        <Button
          className="grow"
          variant={mode === 'list' ? 'primary' : 'default'}
          aria-pressed={mode === 'list'}
          onClick={() => setMode('list')}
          data-testid="phone-view-list"
        >
          {t('phone.viewList')}
        </Button>
      </div>
      {mode === 'scene' ? <PannableScene /> : <PhoneLocationList />}
    </div>
  );
}
