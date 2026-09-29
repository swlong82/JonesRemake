/**
 * Haptic feedback (M12.8): a short vibration on success or failure where the device supports it
 * (phones, mostly). Off with the `haptics` setting and under reduced motion; never throws, so a
 * host without `navigator.vibrate` (desktop browsers, jsdom) is simply silent.
 */
import { useSettings } from './settings';

export type HapticKind = 'tap' | 'success' | 'fail';

export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  success: [15, 40, 15],
  fail: 60,
};

export function haptic(kind: HapticKind): boolean {
  const { haptics, reducedMotion } = useSettings.getState().settings;
  if (!haptics || reducedMotion) return false;
  const nav = (globalThis as { navigator?: { vibrate?: (p: number | number[]) => boolean } })
    .navigator;
  if (typeof nav?.vibrate !== 'function') return false;
  try {
    return nav.vibrate(HAPTIC_PATTERNS[kind]);
  } catch {
    return false;
  }
}
