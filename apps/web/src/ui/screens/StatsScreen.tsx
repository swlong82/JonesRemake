import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { Button } from '../common/Button';

export function StatsScreen() {
  const { t } = useTranslation();
  const go = useGame((s) => s.go);
  const stats = useSettings((s) => s.stats);
  const wins = Object.entries(stats.winsByPack);
  return (
    <section className="mx-auto max-w-xl p-4 sm:p-6">
      <h1 className="mb-4 text-3xl font-bold">{t('stats.heading')}</h1>
      <dl className="grid grid-cols-2 gap-3">
        <dt className="font-medium">{t('stats.gamesPlayed')}</dt>
        <dd data-testid="games-played">{stats.gamesPlayed}</dd>
        <dt className="font-medium">{t('stats.winsByPack')}</dt>
        <dd>
          {wins.length === 0 ? t('stats.none') : wins.map(([k, v]) => `${k}: ${v}`).join(', ')}
        </dd>
        <dt className="font-medium">{t('stats.fastestWin')}</dt>
        <dd>
          {stats.fastestWinWeeks === null
            ? t('stats.none')
            : t('stats.weeks', { n: stats.fastestWinWeeks })}
        </dd>
        <dt className="font-medium">{t('stats.highestNetWorth')}</dt>
        <dd>${stats.highestNetWorth}</dd>
      </dl>
      <p className="mt-4 text-sm text-ink-muted">{t('stats.leaderboardSoon')}</p>
      <Button className="mt-6" onClick={() => go('title')} data-testid="back">
        {t('stats.back')}
      </Button>
    </section>
  );
}
