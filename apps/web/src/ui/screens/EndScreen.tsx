/**
 * End screen (GDD 4.16, M4.8): winner, weeks elapsed, the goal-over-time chart and per-player key
 * stats, with Rematch (same seats, new seed), New game and a local replay export. The export is a
 * Blob download — nothing leaves the device (CLAUDE.md 1.3).
 */
import { loadPack } from '@hustle-ring/content';
import type { GameState } from '@hustle-ring/engine';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameKey, leaderboardEntry } from '../../leaderboard/entry';
import { useServices } from '../../platform/Services';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { GoalChart } from '../game/GoalChart';
import { jobTitle } from '../game/labels';

/** Replay payload: config + command log is enough to replay the game deterministically (M1.10). */
export function replayJson(state: GameState): string {
  return JSON.stringify(
    {
      engineVersion: state.engineVersion,
      schemaVersion: state.schemaVersion,
      packId: state.packId,
      packVersion: state.packVersion,
      config: state.config,
      log: state.log,
      weeks: state.week,
      winner: state.winner,
    },
    null,
    2,
  );
}

function download(name: string, text: string): void {
  const doc = globalThis.document;
  if (typeof doc === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Games already submitted this session, so a re-render or remount never posts twice. */
const submitted = new Map<string, { score: number; rank: number; total: number } | 'failed'>();

type ScoreStatus = { score: number; rank: number; total: number } | 'failed' | null;

/** Posts the human winner's score to the local board once, then shows it with its rank (16.7). */
function ScoreLine({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const { leaderboard } = useServices();
  const key = gameKey(state);
  // Decided at render: a game with no entry (AI winner, debug switches) never reaches the board.
  const entry = useMemo(
    () => leaderboardEntry(state, loadPack(state.packId), new Date().toISOString()),
    [state],
  );
  const [status, setStatus] = useState<ScoreStatus>(() => submitted.get(key) ?? null);
  useEffect(() => {
    if (!entry || submitted.has(key)) return;
    let live = true;
    submitted.set(key, 'failed');
    leaderboard
      .submit(entry)
      .then(async () => {
        const rank = await leaderboard.myRank('global', entry.playerId);
        const result = { score: entry.score, rank: rank?.rank ?? 1, total: rank?.total ?? 1 };
        submitted.set(key, result);
        if (live) setStatus(result);
      })
      .catch(() => {
        if (live) setStatus('failed');
      });
    return () => {
      live = false;
    };
  }, [entry, key, leaderboard]);
  if (!entry)
    return (
      <p className="text-ink-muted" data-testid="end-score">
        {t('end.scoreNone')}
      </p>
    );
  if (status === null) return null;
  if (status === 'failed')
    return (
      <p role="alert" className="text-danger" data-testid="end-score">
        {t('end.scoreFailed')}
      </p>
    );
  return (
    <p data-testid="end-score">
      {t('end.score', status)}{' '}
      <span className="rounded bg-surface-2 px-2 py-0.5 text-sm">{t('stats.unverified')}</span>
    </p>
  );
}

export function EndScreen() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const go = useGame((s) => s.go);
  const rematch = useGame((s) => s.rematch);
  const quit = useGame((s) => s.quit);
  if (!state) return null;
  const winner = state.winner === null ? null : state.players[state.winner];

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <h1 className="text-3xl font-bold" data-testid="end-heading">
        {t('end.heading', { name: winner?.name ?? '', week: state.week })}
      </h1>
      <ScoreLine state={state} />
      <GoalChart state={state} />
      <h2 className="text-lg font-bold">{t('end.stats')}</h2>
      <table className="w-full text-sm" data-testid="end-stats">
        <thead>
          <tr className="text-left text-ink-muted">
            <th scope="col">{t('setup.name')}</th>
            <th scope="col" className="text-right">
              {t('end.stat.earned')}
            </th>
            <th scope="col" className="text-right">
              {t('end.stat.degrees')}
            </th>
            <th scope="col" className="text-right">
              {t('end.stat.job')}
            </th>
            <th scope="col" className="text-right">
              {t('end.stat.netWorth')}
            </th>
            <th scope="col" className="text-right">
              {t('end.stat.events')}
            </th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((p) => (
            <tr key={p.seat} data-testid={`end-row-${p.seat}`}>
              <th scope="row" className="text-left font-medium">
                {p.name}
              </th>
              <td className="text-right tabular-nums">
                {t('panel.preview.money', { n: p.stats.earned })}
              </td>
              <td className="text-right tabular-nums">{p.degrees.length}</td>
              <td className="text-right">
                {p.job ? jobTitle(p.job.jobId) : t('note.wage', { n: p.stats.highestWage })}
              </td>
              <td className="text-right tabular-nums">
                {t('panel.preview.money', { n: p.cash + p.bank })}
              </td>
              <td className="text-right tabular-nums">{p.stats.eventsSuffered}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={rematch} data-testid="rematch">
          {t('end.rematch')}
        </Button>
        <Button onClick={() => go('setup')} data-testid="end-new-game">
          {t('end.newGame')}
        </Button>
        <Button
          onClick={() => download(`replay-${state.config.seed}.json`, replayJson(state))}
          data-testid="end-export"
        >
          {t('end.export')}
        </Button>
        <Button onClick={quit} data-testid="end-title">
          {t('end.title')}
        </Button>
      </div>
    </section>
  );
}
