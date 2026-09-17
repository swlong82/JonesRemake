/**
 * Goal-over-time chart (UX/GDD 4.16, M4.8): one SVG polyline per player and goal, drawn from
 * `PlayerState.history`. No chart library — 4 goals × N players over the recorded weeks.
 */
import type { GameState } from '@hustle-ring/engine';
import { useTranslation } from 'react-i18next';
import { PALETTE_HEX } from '../../assets/AssetRegistry';
import { GOAL_IDS } from './Hud';

const W = 640;
const H = 280;
const PAD = 34;
/** Dash patterns keep the four goals distinguishable without relying on colour (UX 7.8). */
const DASHES = ['', '6 4', '2 3', '8 3 2 3'];

export function chartPoints(
  history: { week: number; goals: [number, number, number, number] }[],
  goalIndex: number,
  maxWeek: number,
): string {
  if (history.length === 0) return '';
  const span = Math.max(1, maxWeek);
  return history
    .map((h) => {
      const x = PAD + ((W - 2 * PAD) * Math.min(h.week, span)) / span;
      const y = H - PAD - ((H - 2 * PAD) * Math.min(100, h.goals[goalIndex] ?? 0)) / 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function GoalChart({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const maxWeek = Math.max(
    1,
    ...state.players.flatMap((p) => p.history.map((h) => h.week)),
    state.week,
  );

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('end.chart.desc')}
        data-testid="goal-chart"
      >
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--c-line)" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--c-line)" />
        <text x={PAD} y={PAD - 12} fontSize={12} fill="var(--c-ink-muted)">
          {t('end.chart')}
        </text>
        <text x={W - PAD} y={H - PAD + 18} fontSize={12} textAnchor="end" fill="var(--c-ink-muted)">
          {t('log.week', { n: maxWeek })}
        </text>
        {state.players.map((p) =>
          GOAL_IDS.map((goal, gi) => {
            const points = chartPoints(p.history, gi, maxWeek);
            if (points === '') return null;
            return (
              <polyline
                key={`${p.seat}-${goal}`}
                points={points}
                fill="none"
                stroke={PALETTE_HEX[p.color]}
                strokeWidth={2}
                strokeDasharray={DASHES[gi]}
                data-testid={`chart-${p.seat}-${goal}`}
              />
            );
          }),
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-3 text-xs text-ink-muted">
        {GOAL_IDS.map((goal, gi) => (
          <span key={goal} className="flex items-center gap-1">
            <svg viewBox="0 0 24 8" className="h-2 w-6" aria-hidden="true">
              <line
                x1={0}
                y1={4}
                x2={24}
                y2={4}
                stroke="var(--c-ink)"
                strokeWidth={2}
                strokeDasharray={DASHES[gi]}
              />
            </svg>
            {t(`hud.goal.${goal}`)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
