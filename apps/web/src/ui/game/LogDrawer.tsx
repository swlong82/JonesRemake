/**
 * Event log drawer (UX 7.5): all players' events grouped by week. In hotseat play another human's
 * amounts are hidden unless Classic opacity is off.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { logLine } from './labels';
import { CATEGORY_ICON, logCategory, matchesFilter, type LogFilter } from './logFilter';

const FILTERS: LogFilter[] = ['all', 'money', 'work', 'life'];

export function LogDrawer() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const entries = useGame((s) => s.log);
  const viewerSeat = useGame((s) => s.viewerSeat);
  const close = useGame((s) => s.toggleLog);
  const [filter, setFilter] = useState<LogFilter>('all');
  if (!state) return null;

  const weeks = new Map<number, { line: string; icon: string }[]>();
  for (const entry of entries) {
    if (!matchesFilter(entry.event, filter)) continue;
    const others =
      entry.seat !== null &&
      entry.seat !== viewerSeat &&
      state.players[entry.seat]?.controller === 'human-local';
    const line = logLine(entry.event, state, t, others && state.config.classicOpacity);
    const list = weeks.get(entry.week) ?? [];
    list.push({ line, icon: CATEGORY_ICON[logCategory(entry.event)] });
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
      <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label={t('log.filter')}>
        {FILTERS.map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'primary' : 'default'}
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
            }}
            data-testid={`log-filter-${f}`}
          >
            {t(`log.filter.${f}`)}
          </Button>
        ))}
      </div>
      {grouped.length === 0 && <p className="text-sm text-ink-muted">{t('log.empty')}</p>}
      <div className="max-h-64 overflow-y-auto">
        {grouped.map(([week, lines]) => (
          <section key={week}>
            <h3 className="mt-2 text-sm font-semibold text-ink-muted">
              {t('log.week', { n: week })}
            </h3>
            <ul className="flex flex-col gap-0.5 text-sm">
              {lines.map(({ line, icon }, i) => (
                <li key={`${week}-${i}`}>
                  <span
                    className="mr-1 inline-block w-4 text-center text-ink-muted"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
