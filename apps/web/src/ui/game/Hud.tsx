/**
 * HUD (UX 7.3, M4.4): active seat, week, hours ring, money, four goal bars and the week's
 * housekeeping (job, rent, food, outfit). Classic opacity hides exact goal numbers and shows the
 * bars in 25% steps instead (GDD 4.1.4).
 */
import { computeGoals, type GameState } from '@hustle-ring/engine';
import type { CityPack } from '@hustle-ring/content';
import type { GoalId } from '@hustle-ring/shared';
import { useTranslation } from 'react-i18next';
import { PALETTE_HEX } from '../../assets/AssetRegistry';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { hours, jobTitle } from './labels';

export const GOAL_IDS: GoalId[] = ['wealth', 'happiness', 'education', 'career'];

/** Bar fill percentage; classic opacity rounds down to 25% steps. */
export function fillPct(current: number, target: number, opaque: boolean): number {
  if (target <= 0) return 100;
  const pct = Math.min(100, Math.round((current * 100) / target));
  return opaque ? Math.floor(pct / 25) * 25 : pct;
}

function HoursRing({ left, total }: { left: number; total: number }) {
  const { t } = useTranslation();
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = total <= 0 ? 0 : Math.max(0, Math.min(1, left / total));
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" role="img" aria-label={t('hud.hoursLabel')}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--c-line)" strokeWidth={7} />
      <circle
        cx={32}
        cy={32}
        r={r}
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth={7}
        strokeDasharray={`${c * frac} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      <text x={32} y={37} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--c-ink)">
        {hours(left)}
      </text>
    </svg>
  );
}

export function GoalBars({
  state,
  pack,
  seat,
  opaque,
}: {
  state: GameState;
  pack: CityPack;
  seat: number;
  opaque: boolean;
}) {
  const { t } = useTranslation();
  const player = state.players[seat];
  if (!player) return null;
  const current = computeGoals(player, state, pack, 0);
  return (
    <ul className="flex flex-col gap-1" data-testid={`goals-${seat}`}>
      {GOAL_IDS.map((goal) => {
        const value = current[goal];
        const target = player.goals[goal];
        const met = value >= target;
        const pct = fillPct(value, target, opaque);
        return (
          <li key={goal} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0">{t(`hud.goal.${goal}`)}</span>
            <span
              className="h-3 grow overflow-hidden rounded-full bg-surface-3"
              role="img"
              aria-label={
                opaque
                  ? `${t(`hud.goal.${goal}`)} ${String(pct)}%`
                  : t('hud.goalValue', { goal: t(`hud.goal.${goal}`), current: value, target })
              }
            >
              <span
                className="block h-3 rounded-full"
                style={{ width: `${pct}%`, background: met ? 'var(--c-ok)' : 'var(--c-accent)' }}
              />
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums" data-testid={`goal-${goal}`}>
              {met ? `✓ ${t('hud.goalMet')}` : opaque ? `${pct}%` : `${value}/${target}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Hud({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const toggleStandings = useGame((s) => s.toggleStandings);
  const toggleLog = useGame((s) => s.toggleLog);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;
  const opaque = state.config.classicOpacity;
  const job = player.job;
  const outfit = player.clothing[0];

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3"
      aria-label={t('hud.goals')}
      data-testid="hud"
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-full border border-ink"
          style={{ background: PALETTE_HEX[player.color] }}
          aria-hidden="true"
        />
        <h2 className="grow text-lg font-bold" data-testid="active-player">
          {t('hud.activeTurn', { name: player.name })}
        </h2>
        <span className="text-sm text-ink-muted" data-testid="week">
          {t('hud.week', { n: state.week })}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <HoursRing left={player.hoursLeft} total={pack.rules.time.weekHours} />
        <dl className="grid grow grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-muted">{t('hud.cash')}</dt>
          <dd className="text-right font-semibold tabular-nums" data-testid="cash">
            {t('panel.preview.money', { n: player.cash })}
          </dd>
          <dt className="text-ink-muted">{t('hud.bank')}</dt>
          <dd className="text-right font-semibold tabular-nums" data-testid="bank">
            {t('panel.preview.money', { n: player.bank })}
          </dd>
          <dt className="text-ink-muted">{t('hud.job')}</dt>
          <dd className="text-right" data-testid="job">
            {job ? jobTitle(job.jobId) : t('hud.noJob')}
          </dd>
        </dl>
      </div>
      <GoalBars state={state} pack={pack} seat={state.activeSeat} opaque={opaque} />
      {!compact && (
        <ul className="flex flex-col gap-0.5 text-xs text-ink-muted">
          <li>{t(`home.${player.home.tier}`)}</li>
          <li data-testid="rent">
            {player.home.debt > 0
              ? t('hud.rentDebt', { amount: player.home.debt })
              : t('hud.rentDue', {
                  week: player.home.paidThroughWeek + pack.rules.housing.rentWeeks,
                })}
          </li>
          <li data-testid="food">
            {player.food.mealPending !== null ? t('hud.fed') : t('hud.hungry')}
          </li>
          <li>
            {outfit
              ? t('hud.clothingWeeks', {
                  tier: t(`uniform.${outfit.tier}`),
                  weeks: outfit.weeksLeft,
                })
              : t('hud.noClothing')}
          </li>
          <li>
            {t('hud.econ', { phase: t(`phase.${state.econ.phase}`), index: state.econ.index })}
          </li>
        </ul>
      )}
      <div className="flex gap-2">
        <Button className="grow" onClick={toggleStandings} data-testid="standings-btn">
          {t('hud.standings')}
        </Button>
        <Button className="grow" onClick={toggleLog} data-testid="log-btn">
          {t('log.heading')}
        </Button>
      </div>
    </section>
  );
}
