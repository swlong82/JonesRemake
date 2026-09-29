/**
 * Hours strip (M12.9): the week as one cell per hour — spent, free, and the part the trip being
 * looked at would use — plus chips for what is coming due (food, rent). Glanceable where the M11.1
 * warning was a banner; the numbers stay in the label, so colour is never the only signal.
 */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { hourCells, rentDueIn, weekNeeds } from '../../store/needs';
import { hours } from './labels';

const CELL_CLASS = {
  left: 'bg-accent',
  planned: 'bg-warn opacity-80',
  spent: 'bg-surface-3',
} as const;

export function HoursStrip({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const travelOpen = useGame((s) => s.travelOpen);
  const selected = useGame((s) => s.selectedLocation);
  const mode = useGame((s) => s.travelMode);
  const preview = useGame((s) => s.preview);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;
  const total = pack.rules.time.weekHours;
  const trip =
    travelOpen && selected !== null && selected !== player.location
      ? preview({ type: 'Move', to: selected, mode })
      : null;
  const planned = trip ? Math.abs(trip.hours) : 0;
  const cells = hourCells(total, player.hoursLeft, planned);
  const needs = weekNeeds(state, pack);
  const rentIn = rentDueIn(state, pack);
  const label = trip
    ? t('strip.planned', { left: hours(player.hoursLeft), n: hours(planned) })
    : t('strip.left', { left: hours(player.hoursLeft), total: hours(total) });
  return (
    <div className="flex min-w-[10rem] flex-col gap-1" data-testid="hours-strip">
      <div
        className="flex h-2 gap-px overflow-hidden rounded-full"
        role="img"
        aria-label={label}
        data-testid="hours-strip-bar"
      >
        {cells.map((cell, i) => (
          <span key={i} className={`h-2 grow ${CELL_CLASS[cell]}`} data-cell={cell} />
        ))}
      </div>
      {!compact && (
        <ul className="flex flex-wrap gap-1 text-xs" aria-label={t('strip.due')}>
          <li className="text-ink-muted" data-testid="strip-label">
            {label}
          </li>
          {needs.some((n) => n.id === 'food') && (
            <li
              className="rounded-full border border-line bg-surface-3 px-2"
              data-testid="chip-food"
            >
              {t('strip.food')}
            </li>
          )}
          {rentIn <= 1 && (
            <li
              className="rounded-full border border-line bg-surface-3 px-2"
              data-testid="chip-rent"
            >
              {rentIn === 0 ? t('strip.rentNow') : t('strip.rentSoon', { count: rentIn })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
