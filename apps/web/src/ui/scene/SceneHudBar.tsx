/**
 * Scene HUD bar (ART_SPEC 17.9, M9.6): the always-visible strip under the stage — active player,
 * week, the clock of hours left, money and the four goal meters — plus the buttons that open the
 * full HUD, standings, log and menu as overlays. The full HUD (UX 7.3) stays one click away.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { GoalBars } from '../game/Hud';
import { hours } from '../game/labels';
import { NewspaperButton } from './Newspaper';

/** Hours left as a draining clock face. */
export function SceneClock({ left, total }: { left: number; total: number }) {
  const { t } = useTranslation();
  const frac = total <= 0 ? 0 : Math.max(0, Math.min(1, left / total));
  // A pie wedge for the hours left, drawn clockwise from twelve o'clock.
  const angle = frac * 2 * Math.PI;
  const x = 32 + 26 * Math.sin(angle);
  const y = 32 - 26 * Math.cos(angle);
  const large = frac > 0.5 ? 1 : 0;
  const wedge =
    frac >= 1
      ? 'M32 6 A26 26 0 1 1 31.99 6 Z'
      : frac <= 0
        ? ''
        : `M32 32 L32 6 A26 26 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-14 w-14 shrink-0"
      role="img"
      aria-label={t('hud.hours', { n: hours(left) })}
      data-testid="scene-clock"
    >
      <circle
        cx={32}
        cy={32}
        r={30}
        fill="var(--c-surface)"
        stroke="var(--c-ink)"
        strokeWidth={3}
      />
      {wedge !== '' && <path d={wedge} fill="var(--c-accent)" opacity={0.85} />}
      <circle cx={32} cy={32} r={14} fill="var(--c-surface-2)" />
      <text x={32} y={37} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--c-ink)">
        {hours(left)}
      </text>
    </svg>
  );
}

export function SceneHudBar({
  avatar,
  onDetails,
  onNewspaper,
}: {
  avatar?: ReactNode;
  onDetails: () => void;
  onNewspaper: () => void;
}) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const toggleStandings = useGame((s) => s.toggleStandings);
  const toggleLog = useGame((s) => s.toggleLog);
  const toggleMenu = useGame((s) => s.toggleMenu);
  if (!state || !pack) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;
  const total = pack.rules.time.weekHours;
  return (
    <section
      className="art-frame flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface-2 px-3 py-2"
      aria-label={t('scene.hud')}
      data-testid="scene-hud"
    >
      {avatar}
      <div className="flex min-w-0 flex-col">
        <h2 className="truncate text-base font-bold" data-testid="scene-player">
          {t('hud.activeTurn', { name: player.name })}
        </h2>
        <span className="text-sm text-ink-muted" data-testid="scene-week">
          {t('hud.week', { n: state.week })}
        </span>
      </div>
      <SceneClock left={player.hoursLeft} total={total} />
      <dl className="grid grid-cols-[auto_auto] gap-x-2 text-sm">
        <dt>{t('hud.cash')}</dt>
        <dd className="text-right font-semibold tabular-nums" data-testid="scene-cash">
          ${player.cash}
        </dd>
        <dt>{t('hud.bank')}</dt>
        <dd className="text-right font-semibold tabular-nums" data-testid="scene-bank">
          ${player.bank}
        </dd>
      </dl>
      <div className="min-w-[14rem] grow text-sm">
        <GoalBars
          state={state}
          pack={pack}
          seat={state.activeSeat}
          opaque={state.config.classicOpacity}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <NewspaperButton onClick={onNewspaper} />
        <Button onClick={onDetails} data-testid="hud-details-btn">
          {t('scene.details')}
        </Button>
        <Button onClick={toggleStandings} data-testid="scene-standings-btn">
          {t('hud.standings')}
        </Button>
        <Button onClick={toggleLog} data-testid="scene-log-btn">
          {t('log.heading')}
        </Button>
        <Button onClick={toggleMenu} data-testid="menu-btn">
          {t('hud.menu')}
        </Button>
      </div>
    </section>
  );
}
