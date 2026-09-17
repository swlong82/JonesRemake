/** Standings panel (UX 7.3): every player's goal progress and total. */
import { computeGoals } from '@hustle-ring/engine';
import { useTranslation } from 'react-i18next';
import { PALETTE_HEX } from '../../assets/AssetRegistry';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { GOAL_IDS, fillPct } from './Hud';

export function Standings() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const close = useGame((s) => s.toggleStandings);
  if (!state || !pack) return null;
  const opaque = state.config.classicOpacity;

  return (
    <section
      className="rounded-lg border border-line bg-surface-2 p-3"
      aria-label={t('standings.heading')}
      data-testid="standings"
    >
      <h2 className="mb-2 text-lg font-bold">{t('standings.heading')}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-muted">
            <th scope="col">{t('setup.name')}</th>
            {GOAL_IDS.map((goal) => (
              <th scope="col" key={goal} className="text-right">
                {t(`hud.goal.${goal}`)}
              </th>
            ))}
            <th scope="col" className="text-right">
              {t('standings.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((p) => {
            const current = computeGoals(p, state, pack, 0);
            const pcts = GOAL_IDS.map((goal) => fillPct(current[goal], p.goals[goal], opaque));
            const total = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
            return (
              <tr key={p.seat} data-testid={`standing-${p.seat}`}>
                <th scope="row" className="flex items-center gap-2 py-1 text-left font-medium">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-ink"
                    style={{ background: PALETTE_HEX[p.color] }}
                    aria-hidden="true"
                  />
                  {p.name}
                </th>
                {pcts.map((pct, i) => (
                  <td key={GOAL_IDS[i]} className="text-right tabular-nums">
                    {pct}%
                  </td>
                ))}
                <td className="text-right font-semibold tabular-nums">{total}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button className="mt-3 w-full" onClick={close} data-testid="standings-close">
        {t('standings.close')}
      </Button>
    </section>
  );
}
