/**
 * City-block board (ART_SPEC 17.9, M9.6): background, a building per ring square, a name plate per
 * square and the walking avatars. Every square is a real `<button>` over its building that keeps
 * the ring board's label, keyboard key and click behaviour (UX 7.7, 7.8); the art is decorative.
 */
import { defaultBoardLayout, type BoardLayout, type Rect } from '@hustle-ring/art';
import type { CityPack } from '@hustle-ring/content';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArtRegistry } from '../../assets/art/artRegistry';
import { useGame } from '../../store/gameStore';
import { hours, locationName, ringKeyFor, stepsBetween, tripCost } from '../game/labels';
import { ArtImage } from './ArtImage';
import { pctX, pctY, rectStyle } from './geometry';

/** The set's layout when it fits this pack's board, else the generated default (never throws). */
export function layoutFor(registry: ArtRegistry, pack: CityPack): BoardLayout {
  const n = pack.board.locationAt.length;
  const layout = registry.board();
  return layout?.slots.length === n && layout.path.length === n ? layout : defaultBoardLayout(n);
}

/** Each square's button reaches a little past its building, so it stays ≥ 44 px on a phone. */
const HIT_MARGIN = 12;

export function hitArea(r: Rect): Rect {
  return {
    x: r.x - HIT_MARGIN,
    y: r.y - HIT_MARGIN,
    width: r.width + 2 * HIT_MARGIN,
    height: r.height + 2 * HIT_MARGIN,
  };
}

/** First word of a location name: what fits under a building on a phone at low zoom. */
export function shortName(name: string): string {
  const first = name.split(/\s+/)[0] ?? name;
  return first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

export function BoardScene({
  registry,
  children,
  shortLabels = false,
}: {
  registry: ArtRegistry;
  /** Layers above the buildings (the avatars). */
  children?: ReactNode;
  /** Phone at low zoom: plates carry a short name; the tap badge carries the full one. */
  shortLabels?: boolean;
}) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const openTravel = useGame((s) => s.openTravel);
  const preview = useGame((s) => s.preview);
  const selectLocation = useGame((s) => s.selectLocation);
  const selected = useGame((s) => s.selectedLocation);
  const [hot, setHot] = useState<string | null>(null);
  if (!state || !pack) return null;

  const layout = layoutFor(registry, pack);
  const active = state.players[state.activeSeat];
  const here = active?.location ?? '';
  const hoursLeft = active?.hoursLeft ?? 0;
  const enterHours = pack.rules.time.enterHours;

  return (
    <div
      className="absolute inset-0"
      role="group"
      aria-label={t('board.label')}
      data-testid="scene-board"
    >
      <ArtImage
        registry={registry}
        artKey="board:background"
        className="absolute inset-0 h-full w-full"
      />
      {pack.board.locationAt.map((locId, index) => {
        const slot = layout.slots[index];
        if (locId === null || !slot) return null;
        const isHere = locId === here;
        const trip = preview({ type: 'Move', to: locId, mode: 'walk' });
        const cost = tripCost(trip?.hours ?? 0, enterHours, hoursLeft);
        const label = isHere
          ? t('board.here', { name: locationName(locId) })
          : t('board.locationTotal', {
              name: locationName(locId),
              count: stepsBetween(pack, here, locId),
              walk: hours(cost.walk),
              enter: hours(cost.enter),
              total: hours(cost.total),
              key: ringKeyFor(index),
            });
        const unreachable = !isHere && (cost.partial || cost.cannotEnter);
        const ring =
          isHere || locId === selected ? 'outline outline-4 outline-offset-2 outline-focus' : '';
        return (
          <div key={locId}>
            <ArtImage
              registry={registry}
              artKey={`building:${locId}`}
              style={{ ...rectStyle(slot.rect), opacity: unreachable ? 0.55 : 1 }}
            />
            <button
              type="button"
              aria-label={label}
              aria-current={isHere ? 'true' : undefined}
              data-testid={`square-${locId}`}
              className={`rounded-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-focus ${ring}`}
              style={rectStyle(hitArea(slot.rect))}
              onMouseEnter={() => setHot(locId)}
              onMouseLeave={() => setHot((h) => (h === locId ? null : h))}
              onFocus={() => setHot(locId)}
              onBlur={() => setHot((h) => (h === locId ? null : h))}
              onClick={() => (isHere ? selectLocation(locId) : openTravel(locId))}
            />
          </div>
        );
      })}
      {children}
      {/* Name plates last, so a passing avatar never hides a location's name. */}
      {pack.board.locationAt.map((locId, index) => {
        const slot = layout.slots[index];
        if (locId === null || !slot) return null;
        const isHot = hot === locId && locId !== here;
        const cost = tripCost(
          preview({ type: 'Move', to: locId, mode: 'walk' })?.hours ?? 0,
          enterHours,
          hoursLeft,
        );
        return (
          <span
            key={locId}
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface-2 px-1.5 text-[clamp(10px,0.9vw,14px)] font-semibold leading-tight text-ink shadow-sm"
            style={{
              left: pctX(shortLabels ? Math.min(1470, Math.max(130, slot.label.x)) : slot.label.x),
              top: pctY(slot.label.y),
            }}
          >
            {!shortLabels && <span className="mr-1 text-ink-muted">{ringKeyFor(index)}</span>}
            {shortLabels ? shortName(locationName(locId)) : locationName(locId)}
            {isHot && (
              <span
                className="absolute left-1/2 top-full z-10 mt-1 block -translate-x-1/2 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium shadow-md"
                data-testid={`trip-badge-${locId}`}
              >
                {shortLabels && <span className="block font-semibold">{locationName(locId)}</span>}
                {t('board.tripBadge', {
                  walk: hours(cost.walk),
                  enter: hours(cost.enter),
                  total: hours(cost.total),
                })}
                {(cost.partial || cost.cannotEnter) && (
                  <span className="block text-warn">
                    {t(cost.partial ? 'board.tripFar' : 'board.tripNoEnter')}
                  </span>
                )}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
