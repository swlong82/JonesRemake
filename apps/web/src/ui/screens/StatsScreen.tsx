/** Stats (UX 7.1) and the local leaderboard by scope (ROADMAP_SCAFFOLDS 16.7). */
import { loadPack, WORLD } from '@hustle-ring/content';
import { scopes, seasonOf, type ScoreEntry } from '@hustle-ring/platform';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../platform/Services';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { Button } from '../common/Button';
import { Field } from '../common/Field';

type ScopeKind = 'global' | 'season' | 'pack' | 'packSeason';
const SCOPE_KINDS: ScopeKind[] = ['global', 'season', 'pack', 'packSeason'];

function cityName(packId: string): string {
  const pack = loadPack(packId);
  return pack.i18n[pack.manifest.titleKey ?? ''] ?? packId;
}

export function StatsScreen() {
  const { t } = useTranslation();
  const go = useGame((s) => s.go);
  const stats = useSettings((s) => s.stats);
  const { leaderboard } = useServices();
  const [kind, setKind] = useState<ScopeKind>('global');
  const [packId, setPackId] = useState(WORLD.cities[0]?.packId ?? 'classic');
  // Seasons come from the device clock in v1 (16.7); a server supplies them in v2.
  const season = seasonOf(new Date().toISOString());
  // The fetched page is kept with the scope it answers, so switching scope shows nothing stale.
  const [result, setResult] = useState<{
    scope: string;
    rows: readonly ScoreEntry[] | null;
  } | null>(null);

  const scope =
    kind === 'global'
      ? scopes.global()
      : kind === 'season'
        ? scopes.season(season)
        : kind === 'pack'
          ? scopes.pack(packId)
          : scopes.packSeason(packId, season);

  useEffect(() => {
    let live = true;
    leaderboard
      .query(scope, { offset: 0, limit: 20 })
      .then((page) => {
        if (live) setResult({ scope, rows: page.entries });
      })
      .catch(() => {
        if (live) setResult({ scope, rows: null });
      });
    return () => {
      live = false;
    };
  }, [leaderboard, scope]);
  const current = result?.scope === scope ? result : null;
  const rows = current?.rows ?? null;
  const failed = current !== null && current.rows === null;

  const wins = Object.entries(stats.winsByPack);
  return (
    <section className="mx-auto max-w-2xl p-4 sm:p-6">
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

      <h2 className="mt-8 text-xl font-semibold">{t('stats.leaderboard')}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Field label={t('stats.scope')} htmlFor="lb-scope">
          <select
            id="lb-scope"
            className="input"
            value={kind}
            data-testid="lb-scope"
            onChange={(e) => setKind(e.target.value as ScopeKind)}
          >
            {SCOPE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`stats.scope.${k}`, { season })}
              </option>
            ))}
          </select>
        </Field>
        {(kind === 'pack' || kind === 'packSeason') && (
          <Field label={t('stats.city')} htmlFor="lb-city">
            <select
              id="lb-city"
              className="input"
              value={packId}
              data-testid="lb-city"
              onChange={(e) => setPackId(e.target.value)}
            >
              {WORLD.cities.map((c) => (
                <option key={c.packId} value={c.packId}>
                  {cityName(c.packId)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <p
        className="mt-3 inline-block rounded bg-surface-2 px-2 py-1 text-sm"
        data-testid="lb-badge"
      >
        {t('stats.unverified')}
      </p>
      {failed ? (
        <p role="alert" className="mt-3 text-danger">
          {t('stats.loadFailed')}
        </p>
      ) : rows === null ? null : rows.length === 0 ? (
        <p className="mt-3 text-ink-muted" data-testid="lb-empty">
          {t('stats.empty')}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm" data-testid="lb-table">
            <caption className="sr-only">{t('stats.leaderboard')}</caption>
            <thead>
              <tr className="text-left text-ink-muted">
                <th scope="col">{t('stats.col.rank')}</th>
                <th scope="col">{t('stats.col.name')}</th>
                <th scope="col" className="text-right">
                  {t('stats.col.score')}
                </th>
                <th scope="col" className="text-right">
                  {t('stats.col.weeks')}
                </th>
                <th scope="col" className="text-right">
                  {t('stats.col.date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={`${e.playerId}:${e.finishedAt}:${i}`} className="border-t border-line">
                  <td>{i + 1}</td>
                  <td>{e.displayName}</td>
                  <td className="text-right">{e.score}</td>
                  <td className="text-right">{e.weeks}</td>
                  <td className="text-right">{e.finishedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button className="mt-6" onClick={() => go('title')} data-testid="back">
        {t('stats.back')}
      </Button>
    </section>
  );
}
