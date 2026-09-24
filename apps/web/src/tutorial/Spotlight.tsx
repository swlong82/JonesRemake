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
import { anchorFor, stepKeys, TUTORIAL_STEPS } from './steps';
import { useTutorial } from './useTutorial';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureAnchor(testid: string | null): Rect | null {
  if (testid === null || typeof globalThis.document === 'undefined') return null;
  // The scene UI's HUD is a bar (`scene-hud`); the full HUD only opens on demand. Its squares are
  // only on screen outside a location, so until the player leaves, the way there is Leave
  // (ART_SPEC 17.9).
  const ids =
    testid === 'hud'
      ? ['hud', 'scene-hud']
      : testid.startsWith('square-')
        ? [testid, 'exit']
        : [testid];
  const el = ids
    .map((id) => globalThis.document.querySelector(`[data-testid="${id}"]`))
    .find((e) => e !== null);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * The anchor's viewport rectangle, re-measured every animation frame while the tutorial is up. The
 * layout moves under the spotlight — the travel sheet opening pushes the panel down, the phone
 * layout reflows — and resize and scroll events alone left the ring drawn over the wrong place.
 */
function useAnchorRect(testid: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(() => measureAnchor(testid));
  const [measuredFor, setMeasuredFor] = useState(testid);
  if (measuredFor !== testid) {
    setMeasuredFor(testid);
    setRect(measureAnchor(testid));
  }
  useEffect(() => {
    if (typeof globalThis.requestAnimationFrame !== 'function') return;
    let frame = 0;
    const tick = (): void => {
      const next = measureAnchor(testid);
      setRect((prev) => (sameRect(prev, next) ? prev : next));
      frame = globalThis.requestAnimationFrame(tick);
    };
    frame = globalThis.requestAnimationFrame(tick);
    return () => {
      globalThis.cancelAnimationFrame(frame);
    };
  }, [testid]);
  return rect;
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
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
  const game = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const viewerSeat = useGame((s) => s.viewerSeat);
  const travelOpen = useGame((s) => s.travelOpen);
  const endTurnPending = useGame((s) => s.endTurnPending);
  const me = game?.players[viewerSeat];
  const anchor =
    step && me
      ? anchorFor(step, {
          location: me.location,
          inside: me.inside,
          travelOpen,
          endTurnPending,
          jobWorkplace: me.job ? (pack?.jobById[me.job.jobId]?.workplaceId ?? null) : null,
          home: pack?.locations.find((l) => l.homeTier === me.home.tier)?.id ?? null,
        })
      : (step?.anchor ?? null);
  const rect = useAnchorRect(anchor);

  useEffect(() => {
    observe(log);
  }, [observe, log]);

  if (!step) return null;
  const keys = stepKeys(step);
  const viewportHeight = globalThis.innerHeight;
  const cardAtTop = rect !== null && rect.top + rect.height / 2 > viewportHeight / 2;
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
        // The card never covers what it points at: it moves to the top when the spotlight is in the
        // lower half of the screen (the End turn button sits under the default bottom position).
        className={`fixed inset-x-2 ${cardAtTop ? 'top-2' : 'bottom-2'} z-50 mx-auto flex max-w-sm flex-col gap-2 rounded-lg border border-line bg-surface-2 p-4 shadow-lg sm:inset-x-auto sm:right-4`}
        data-position={cardAtTop ? 'top' : 'bottom'}
        role="dialog"
        aria-modal="false"
        aria-label={t('tutorial.heading')}
        data-testid="tutorial-card"
        // Escape leaves the tutorial when focus is on the card (skip is always on offer, UX 7.6);
        // anywhere else Escape still belongs to the game, which closes its own sheets with it.
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          skip();
        }}
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
