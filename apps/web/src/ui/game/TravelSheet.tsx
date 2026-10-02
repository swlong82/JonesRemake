/**
 * Travel sheet (UX 7.2): pick a transport mode for the selected location, see hours, cost and the
 * reason a mode is unavailable, then confirm. Classic packs offer walking only; modern modes appear
 * automatically because the rows come from the engine's Move candidates.
 */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { tp } from '../../i18n';
import { hours, locationName, previewParts, stepsBetween, tripCost } from './labels';

export function TravelSheet() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const target = useGame((s) => s.selectedLocation);
  const candidates = useGame((s) => s.candidates);
  const preview = useGame((s) => s.preview);
  const visitLocation = useGame((s) => s.visitLocation);
  const dispatch = useGame((s) => s.dispatch);
  const lastError = useGame((s) => s.lastError);
  const close = useGame((s) => s.closeTravel);
  const mode = useGame((s) => s.travelMode);
  const setMode = useGame((s) => s.setTravelMode);
  if (!state || !pack || target === null) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;

  const rows = candidates().filter((r) => r.cmd.type === 'Move' && r.cmd.to === target);
  const selected = rows.find((r) => r.cmd.type === 'Move' && r.cmd.mode === mode) ?? rows[0];
  const steps = stepsBetween(pack, player.location, target);
  const selectedPreview = selected ? preview(selected.cmd) : null;
  const cost = selectedPreview
    ? tripCost(selectedPreview.hours, pack.rules.time.enterHours, player.hoursLeft)
    : null;
  const tooFar = selectedPreview !== null && Math.abs(selectedPreview.hours) > player.hoursLeft;

  return (
    <section
      role="dialog"
      aria-label={t('travel.heading', { name: locationName(target) })}
      aria-modal="true"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
      data-testid="travel-sheet"
    >
      <h2 className="text-lg font-bold">{t('travel.heading', { name: locationName(target) })}</h2>
      <p className="text-xs text-ink-muted">{t('travel.steps', { count: steps })}</p>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">{t('travel.mode')}</legend>
        {rows.map((row) => {
          if (row.cmd.type !== 'Move') return null;
          const p = preview(row.cmd);
          const parts = p ? previewParts(p, t, { opaque: true }) : [];
          const id = `mode-${row.cmd.mode}`;
          return (
            <label key={row.cmd.mode} className="flex items-center gap-2 text-sm" htmlFor={id}>
              <input
                id={id}
                type="radio"
                name="travel-mode"
                value={row.cmd.mode}
                checked={selected?.cmd === row.cmd}
                onChange={() => setMode(row.cmd.type === 'Move' ? row.cmd.mode : 'walk')}
                disabled={row.code !== null}
                data-testid={id}
              />
              <span>{tp(pack.transportById[row.cmd.mode]?.nameKey ?? '')}</span>
              <span className="text-ink-muted">{parts.join(' · ')}</span>
              {row.code !== null && (
                <span className="text-danger">
                  {t('travel.unavailable', { reason: t(`error.${row.code}`) })}
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
      {tooFar && (
        <p className="text-xs text-warn" data-testid="travel-partial">
          {t('travel.partial')}
        </p>
      )}
      {lastError && (
        <p role="status" className="text-xs text-danger" data-testid="travel-error">
          {t(`error.${lastError}`)}
        </p>
      )}
      {selectedPreview && cost && (
        <div className="text-xs text-ink-muted" data-testid="travel-cost">
          <p>
            {t('travel.total', {
              walk: hours(cost.walk),
              enter: hours(cost.enter),
              total: hours(cost.total),
            })}
          </p>
          {!cost.partial && (
            <p data-testid="travel-after">{t('travel.after', { left: hours(cost.left) })}</p>
          )}
          {cost.cannotEnter && (
            <p className="text-warn" data-testid="travel-no-enter">
              {t('travel.noEnter')}
            </p>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="grow"
          disabled={selected?.code !== null}
          onClick={() => {
            if (selected?.cmd.type === 'Move') visitLocation(target, selected.cmd.mode);
          }}
          data-testid="travel-go"
        >
          {t('travel.go')}
        </Button>
        <Button className="grow" onClick={close} data-testid="travel-cancel">
          {t('travel.cancel')}
        </Button>
      </div>
      {selected?.code === null && selected.cmd.type === 'Move' && (
        <Button onClick={() => dispatch(selected.cmd)} data-testid="travel-only">
          {t('travel.only')}
        </Button>
      )}
    </section>
  );
}
