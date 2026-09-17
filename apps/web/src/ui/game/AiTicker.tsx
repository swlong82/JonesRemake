/** AI turn ticker (UX 7.5): compact list of the rival's actions with a skip button. */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { commandKey, commandLabel } from './labels';

export function AiTicker() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const ticker = useGame((s) => s.ticker);
  const thinking = useGame((s) => s.aiThinking);
  const skip = useGame((s) => s.skipAi);
  if (!state) return null;
  const active = state.players[state.activeSeat];
  if (!active || active.controller === 'human-local') return null;
  const recent = ticker.slice(-5);

  return (
    <section
      className="rounded-lg border border-line bg-surface-2 p-3"
      aria-label={t('ticker.heading', { name: active.name })}
      aria-live="polite"
      data-testid="ai-ticker"
    >
      <h2 className="text-sm font-semibold">{t('ticker.heading', { name: active.name })}</h2>
      <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ink-muted">
        {recent.map((entry, i) => (
          <li key={`${commandKey(entry.cmd)}-${i}`}>{commandLabel(entry.cmd, t)}</li>
        ))}
        {thinking && <li>{t('ticker.thinking')}</li>}
      </ul>
      <Button className="mt-2 w-full" onClick={skip} data-testid="ai-skip">
        {t('ticker.skip')}
      </Button>
    </section>
  );
}
