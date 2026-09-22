/**
 * Tutorial spotlight (UX_SPEC 7.6): "Each step highlights one UI element (spotlight), blocks
 * unrelated input, and advances on the matching `DomainEvent`. Skip at any time."
 *
 * The dim layer is four panes around the anchor's rectangle rather than one pane with a hole, so
 * the anchor itself stays clickable while every other click lands on the blocker.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../store/gameStore';
import { Button } from '../ui/common/Button';
import { stepKeys, TUTORIAL_STEPS } from './steps';
import { useTutorial } from './useTutorial';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureAnchor(testid: string | null): Rect | null {
  if (testid === null || typeof globalThis.document === 'undefined') return null;
  const el = globalThis.document.querySelector(`[data-testid="${testid}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * The anchor's viewport rectangle. Measured during render for the first paint — the element is
 * already on screen, because the tutorial only ever points at something the game has drawn — and
 * re-measured from the resize and scroll listeners after that.
 */
function useAnchorRect(testid: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(() => measureAnchor(testid));
  // React's own "adjusting state when a prop changes" pattern: the previous value lives in state,
  // so the new rectangle is ready for the first paint without an effect round trip.
  const [measuredFor, setMeasuredFor] = useState(testid);
  if (measuredFor !== testid) {
    setMeasuredFor(testid);
    setRect(measureAnchor(testid));
  }
  useEffect(() => {
    const measure = (): void => {
      setRect(measureAnchor(testid));
    };
    globalThis.addEventListener('resize', measure);
    globalThis.addEventListener('scroll', measure, true);
    return () => {
      globalThis.removeEventListener('resize', measure);
      globalThis.removeEventListener('scroll', measure, true);
    };
  }, [testid]);
  return rect;
}

const DIM = 'fixed bg-black/60 z-40';

export function Spotlight() {
  const { t } = useTranslation();
  const active = useTutorial((s) => s.active);
  const index = useTutorial((s) => s.index);
  const next = useTutorial((s) => s.next);
  const skip = useTutorial((s) => s.skip);
  const observe = useTutorial((s) => s.observe);
  const log = useGame((s) => s.log);
  const step = active ? TUTORIAL_STEPS[index] : undefined;
  const rect = useAnchorRect(step?.anchor ?? null);

  useEffect(() => {
    observe(log);
  }, [observe, log]);

  if (!step) return null;
  const keys = stepKeys(step);
  const manual = step.advance.kind === 'manual';
  const last = index === TUTORIAL_STEPS.length - 1;

  return (
    <div data-testid="tutorial" aria-live="polite">
      {rect ? (
        <>
          <div className={DIM} style={{ top: 0, left: 0, right: 0, height: rect.top }} />
          <div
            className={DIM}
            style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={DIM}
            style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}
          />
          <div
            className={DIM}
            style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}
          />
          <div
            data-testid="tutorial-spotlight"
            className="pointer-events-none fixed z-40 rounded ring-4 ring-accent"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
        </>
      ) : (
        <div className={DIM} style={{ inset: 0 }} />
      )}
      <section
        className="fixed inset-x-2 bottom-2 z-50 mx-auto flex max-w-sm flex-col gap-2 rounded-lg border border-line bg-surface-2 p-4 shadow-lg sm:inset-x-auto sm:right-4"
        role="dialog"
        aria-modal="false"
        aria-label={t('tutorial.heading')}
        data-testid="tutorial-card"
      >
        <p className="text-xs text-ink-muted" data-testid="tutorial-progress">
          {t('tutorial.progress', { current: index + 1, total: TUTORIAL_STEPS.length })}
        </p>
        <h2 className="text-lg font-bold" data-testid="tutorial-title">
          {t(keys.title)}
        </h2>
        <p className="text-sm">{t(keys.body)}</p>
        <div className="flex gap-2">
          {manual && (
            <Button variant="primary" onClick={next} data-testid="tutorial-next" autoFocus>
              {last ? t('tutorial.finish') : t('tutorial.next')}
            </Button>
          )}
          <Button onClick={skip} data-testid="tutorial-skip">
            {t('tutorial.skip')}
          </Button>
        </div>
      </section>
    </div>
  );
}
