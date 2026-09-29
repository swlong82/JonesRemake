/**
 * Swipe gestures for phone sheets (M12.8). Pure direction maths plus a thin touch hook: a swipe is a
 * mostly-straight drag past a distance, so ordinary scrolling and taps never trigger one. Every
 * gesture has a button equivalent; this only adds the shortcut.
 */
import { useRef, type TouchEvent } from 'react';

export const SWIPE_MIN_PX = 64;
/** The off-axis drift allowed, as a fraction of the main-axis distance. */
export const SWIPE_MAX_DRIFT = 0.6;

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export function swipeDirection(dx: number, dy: number, min = SWIPE_MIN_PX): SwipeDirection | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay >= ax) {
    if (ay < min || ax > ay * SWIPE_MAX_DRIFT) return null;
    return dy > 0 ? 'down' : 'up';
  }
  if (ax < min || ay > ax * SWIPE_MAX_DRIFT) return null;
  return dx > 0 ? 'right' : 'left';
}

export interface SwipeHandlers {
  down?: () => void;
  up?: () => void;
  left?: () => void;
  right?: () => void;
}

/**
 * Touch handlers to spread on an element. A downward swipe only counts while the element is
 * scrolled to its top, so scrolling a long sheet back up never closes it.
 */
export function useSwipe(handlers: SwipeHandlers): {
  onTouchStart: (e: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (e: TouchEvent<HTMLElement>) => void;
} {
  const start = useRef<{ x: number; y: number; top: number } | null>(null);
  return {
    onTouchStart(e) {
      const touch = e.touches[0];
      start.current =
        e.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY, top: e.currentTarget.scrollTop }
          : null;
    },
    onTouchEnd(e) {
      const from = start.current;
      start.current = null;
      const touch = e.changedTouches[0];
      if (!from || !touch) return;
      const dir = swipeDirection(touch.clientX - from.x, touch.clientY - from.y);
      if (dir === 'down' && from.top > 0) return;
      if (dir) handlers[dir]?.();
    },
  };
}
