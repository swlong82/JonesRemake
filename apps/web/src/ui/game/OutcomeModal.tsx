/**
 * Result pop-up (M13.2): one modal per important outcome of the player's own action (hired, raise,
 * enrolled, loan, goal reached or lost). Waits for start-of-turn cards, then shows one at a time;
 * Enter, Escape or a click dismisses it.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { outcomeText, outcomeTone } from './outcomes';

export function OutcomeModal() {
  const { t } = useTranslation();
  const event = useGame((s) => s.outcomes[0]);
  const waiting = useGame((s) => s.cards.length > 0);
  const remaining = useGame((s) => s.outcomes.length - 1);
  const dismiss = useGame((s) => s.dismissOutcome);
  useEffect(() => {
    if (!event || waiting) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [event, waiting, dismiss]);
  if (!event || waiting) return null;
  const { title, text } = outcomeText(event, t);
  const bad = outcomeTone(event) === 'bad';
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="outcome-modal"
      onClick={dismiss}
    >
      <section
        className={`flex w-full max-w-sm flex-col gap-3 rounded-lg border-2 bg-surface-2 p-4 ${
          bad ? 'border-danger' : 'border-focus'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold" data-testid="outcome-title">
          <span aria-hidden="true">{bad ? '⚠ ' : '✓ '}</span>
          {title}
        </h2>
        <p className="text-sm">{text}</p>
        {remaining > 0 && (
          <p className="text-xs text-ink-muted">{t('events.more', { n: remaining })}</p>
        )}
        <Button variant="primary" onClick={dismiss} autoFocus data-testid="outcome-dismiss">
          {t('events.dismiss')}
        </Button>
      </section>
    </div>
  );
}
