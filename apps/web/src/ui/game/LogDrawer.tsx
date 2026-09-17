/**
 * Event log drawer (UX 7.5): all players' events grouped by week. In hotseat play another human's
 * amounts are hidden unless Classic opacity is off.
 */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { logLine } from './labels';

export function LogDrawer() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const entries = useGame((s) => s.log);
  const viewerSeat = useGame((s) => s.viewerSeat);
  const close = useGame((s) => s.toggleLog);
  if (!state) return null;

  const weeks = new Map<number, string[]>();
  for (const entry of entries) {
    const others =
      entry.seat !== null &&
      entry.seat !== viewerSeat &&
      state.players[entry.seat]?.controller === 'human-local';
    const line = logLine(entry.event, state, t, others && state.config.classicOpacity);
    const list = weeks.get(entry.week) ?? [];
    list.push(line);
    weeks.set(entry.week, list);
  }
  const grouped = [...weeks.entries()].sort((a, b) => b[0] - a[0]);

  return (
    <section
      className="rounded-lg border border-line bg-surface-2 p-3"
      aria-label={t('log.heading')}
      data-testid="log-drawer"
    >
      <div className="mb-2 flex items-center gap-2">
        <h2 className="grow text-lg font-bold">{t('log.heading')}</h2>
        <Button onClick={close} data-testid="log-close">
          {t('log.close')}
        </Button>
      </div>
      {grouped.length === 0 && <p className="text-sm text-ink-muted">{t('log.empty')}</p>}
      <div className="max-h-64 overflow-y-auto">
        {grouped.map(([week, lines]) => (
          <section key={week}>
            <h3 className="mt-2 text-sm font-semibold text-ink-muted">
              {t('log.week', { n: week })}
            </h3>
            <ul className="flex flex-col gap-0.5 text-sm">
              {lines.map((line, i) => (
                <li key={`${week}-${i}`}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
