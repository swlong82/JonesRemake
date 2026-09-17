/**
 * Debug switches (UX 7.9), behind the `debugTools` app flag and `?debug=1`: autoplay, grants, week
 * jumps, hidden stats and the state hash. Never reachable in a deployed build because the flag
 * also requires `VITE_DEBUG_ALLOWED=true`.
 */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';

export function DebugPanel() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const autoplay = useGame((s) => s.autoplay);
  const hash = useGame((s) => s.hash);
  const debugPatch = useGame((s) => s.debugPatch);
  const setAutoplay = useGame((s) => s.setAutoplay);
  if (!state) return null;
  const player = state.players[state.activeSeat];

  return (
    <section
      className="rounded-lg border border-warn bg-surface-2 p-3 text-sm"
      aria-label={t('debug.heading')}
      data-testid="debug-panel"
    >
      <h2 className="font-bold">{t('debug.heading')}</h2>
      <p className="text-xs text-ink-muted" data-testid="debug-hash">
        {t('debug.hash', { hash: hash() })}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          onClick={() => setAutoplay(!autoplay)}
          aria-pressed={autoplay}
          data-testid="debug-autoplay"
        >
          {t('debug.autoplay')}
        </Button>
        <Button
          onClick={() =>
            debugPatch((s) => {
              const p = s.players[s.activeSeat];
              if (p) p.cash += 1000;
            })
          }
          data-testid="debug-grant"
        >
          {t('debug.grant')}
        </Button>
        <Button
          onClick={() =>
            debugPatch((s) => {
              s.week = Math.max(s.week, 10);
            })
          }
          data-testid="debug-jump"
        >
          {t('debug.jump')}
        </Button>
      </div>
      {player && (
        <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs" data-testid="debug-hidden">
          <dt>{t('hud.dependability')}</dt>
          <dd className="text-right tabular-nums">{player.dependability}</dd>
          <dt>{t('hud.experience')}</dt>
          <dd className="text-right tabular-nums">{player.experience}</dd>
          <dt>{t('hud.relaxation')}</dt>
          <dd className="text-right tabular-nums">{player.relaxation}</dd>
        </dl>
      )}
    </section>
  );
}
