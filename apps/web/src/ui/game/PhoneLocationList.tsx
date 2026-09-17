/** Phone layout location list (UX 7.2): every location sorted by travel time from where you stand. */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { hours, locationName, stepsBetween } from './labels';

export function PhoneLocationList() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const openTravel = useGame((s) => s.openTravel);
  const selectLocation = useGame((s) => s.selectLocation);
  const preview = useGame((s) => s.preview);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;

  const rows = pack.locations
    .map((loc) => ({
      id: loc.id,
      steps: stepsBetween(pack, player.location, loc.id),
      halfHours: Math.abs(preview({ type: 'Move', to: loc.id, mode: 'walk' })?.hours ?? 0),
    }))
    .sort((a, b) => a.steps - b.steps || a.id.localeCompare(b.id));

  return (
    <nav aria-label={t('phone.locations')} data-testid="phone-locations">
      <h2 className="mb-1 text-sm font-semibold text-ink-muted">{t('phone.locations')}</h2>
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {rows.map(({ id, halfHours }) => {
          const isHere = id === player.location;
          return (
            <li key={id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                onClick={() => (isHere ? selectLocation(id) : openTravel(id))}
                data-testid={`phone-loc-${id}`}
              >
                <span className="grow">{locationName(id)}</span>
                <span className="text-xs text-ink-muted">
                  {isHere ? t('phone.here') : t('travel.hours', { hours: hours(halfHours) })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
