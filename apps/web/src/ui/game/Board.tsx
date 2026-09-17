/**
 * Ring board (UX 7.2, M4.3). Code-rendered SVG: 16 ring squares, each a focusable button with an
 * aria-label carrying name, distance and hours; player tokens come from the AssetRegistry and move
 * with a CSS transform transition that reduced-motion turns off.
 */
import { useTranslation } from 'react-i18next';
import { registryFor } from '../../assets/AssetRegistry';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { hours, locationName, ringKeyFor, stepsBetween } from './labels';

const SIZE = 620;
const CENTER = SIZE / 2;
const RADIUS = 250;
const SQUARE = 74;

export function nodePosition(index: number, count: number): { x: number; y: number } {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
}

export function Board({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const openTravel = useGame((s) => s.openTravel);
  const preview = useGame((s) => s.preview);
  const selectLocation = useGame((s) => s.selectLocation);
  const selected = useGame((s) => s.selectedLocation);
  const reducedMotion = useSettings((s) => s.settings.reducedMotion);
  if (!state || !pack) return null;

  const registry = registryFor(pack);
  const nodes = pack.board.locationAt;
  const active = state.players[state.activeSeat];
  const here = active?.location ?? '';
  const transition = reducedMotion ? undefined : 'transform 380ms ease-in-out';

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={compact ? 'h-auto w-full max-w-[22rem]' : 'h-auto w-full max-w-[42rem]'}
      role="group"
      aria-label={t('board.label')}
      data-testid={compact ? 'board-mini' : 'board'}
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke="var(--c-line)"
        strokeWidth={2}
        strokeDasharray="6 8"
      />
      <text
        x={CENTER}
        y={CENTER - 8}
        textAnchor="middle"
        fontSize={34}
        fontWeight={700}
        fill="var(--c-ink)"
      >
        {t('hud.week', { n: state.week })}
      </text>
      <text x={CENTER} y={CENTER + 26} textAnchor="middle" fontSize={20} fill="var(--c-ink-muted)">
        {t(`phase.${state.econ.phase}`)}
      </text>
      {nodes.map((locId, index) => {
        if (locId === null) return null;
        const { x, y } = nodePosition(index, nodes.length);
        const visual = pack.visuals[`location:${locId}`];
        const Icon = registry.icon(visual?.icon ?? 'building');
        const steps = stepsBetween(pack, here, locId);
        const trip = preview({ type: 'Move', to: locId, mode: 'walk' });
        const isHere = locId === here;
        const label = isHere
          ? t('board.here', { name: locationName(locId) })
          : t('board.location', {
              name: locationName(locId),
              steps,
              hours: hours(trip?.hours ?? 0),
              key: ringKeyFor(index),
            });
        return (
          <g
            key={locId}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-current={isHere ? 'true' : undefined}
            data-testid={`square-${locId}`}
            className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => (isHere ? selectLocation(locId) : openTravel(locId))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (isHere) selectLocation(locId);
                else openTravel(locId);
              }
            }}
          >
            <rect
              x={x - SQUARE / 2}
              y={y - SQUARE / 2}
              width={SQUARE}
              height={SQUARE}
              rx={10}
              fill={registry.colorVar(visual?.color ?? 'fallback')}
              stroke={isHere || locId === selected ? 'var(--c-focus)' : 'var(--c-ink)'}
              strokeWidth={isHere || locId === selected ? 4 : 1.5}
            />
            <g
              transform={`translate(${x - 11}, ${y - 20})`}
              aria-hidden="true"
              pointerEvents="none"
            >
              <Icon width={22} height={22} color="#1a1a1a" />
            </g>
            <text
              x={x}
              y={y + 20}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill="#1a1a1a"
              aria-hidden="true"
              pointerEvents="none"
            >
              {ringKeyFor(index)}
            </text>
            <text
              x={x}
              y={y + SQUARE / 2 + 15}
              textAnchor="middle"
              fontSize={13}
              fill="var(--c-ink)"
              aria-hidden="true"
              pointerEvents="none"
            >
              {locationName(locId)}
            </text>
          </g>
        );
      })}
      {state.players.map((p) => {
        const node = pack.board.nodeOf[p.location] ?? 0;
        const { x, y } = nodePosition(node, nodes.length);
        const offset = p.seat * 15 - (state.players.length - 1) * 7.5;
        return (
          <g
            key={p.seat}
            style={{ transform: `translate(${x + offset}px, ${y - 4}px)`, transition }}
            data-testid={`token-${p.seat}`}
          >
            <title>{t('board.token', { name: p.name, location: locationName(p.location) })}</title>
            {registry.token(p.shape, p.color, p.name.slice(0, 1).toUpperCase(), 13)}
          </g>
        );
      })}
    </svg>
  );
}
