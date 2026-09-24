/**
 * City-block board (ART_SPEC 17.9, M9.6): background, a building per ring square, a name plate per
 * square and the walking avatars. Every square is a real `<button>` over its building that keeps
 * the ring board's label, keyboard key and click behaviour (UX 7.7, 7.8); the art is decorative.
 */
import { defaultBoardLayout, type BoardLayout, type Rect } from '@hustle-ring/art';
import type { CityPack } from '@hustle-ring/content';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArtRegistry } from '../../assets/art/artRegistry';
import { useGame } from '../../store/gameStore';
import { hours, locationName, ringKeyFor, stepsBetween } from '../game/labels';
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

export function BoardScene({
  registry,
  children,
}: {
  registry: ArtRegistry;
  /** Layers above the buildings (the avatars). */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const openTravel = useGame((s) => s.openTravel);
  const preview = useGame((s) => s.preview);
  const selectLocation = useGame((s) => s.selectLocation);
  const selected = useGame((s) => s.selectedLocation);
  if (!state || !pack) return null;

  const layout = layoutFor(registry, pack);
  const here = state.players[state.activeSeat]?.location ?? '';

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
        const label = isHere
          ? t('board.here', { name: locationName(locId) })
          : t('board.location', {
              name: locationName(locId),
              steps: stepsBetween(pack, here, locId),
              hours: hours(trip?.hours ?? 0),
              key: ringKeyFor(index),
            });
        const ring =
          isHere || locId === selected ? 'outline outline-4 outline-offset-2 outline-focus' : '';
        return (
          <div key={locId}>
            <ArtImage
              registry={registry}
              artKey={`building:${locId}`}
              style={rectStyle(slot.rect)}
            />
            <button
              type="button"
              aria-label={label}
              aria-current={isHere ? 'true' : undefined}
              data-testid={`square-${locId}`}
              className={`rounded-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-focus ${ring}`}
              style={rectStyle(hitArea(slot.rect))}
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
        return (
          <span
            key={locId}
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface-2 px-1.5 text-[clamp(9px,0.9vw,14px)] font-semibold leading-tight text-ink shadow-sm"
            style={{ left: pctX(slot.label.x), top: pctY(slot.label.y) }}
          >
            <span className="mr-1 text-ink-muted">{ringKeyFor(index)}</span>
            {locationName(locId)}
          </span>
        );
      })}
    </div>
  );
}
