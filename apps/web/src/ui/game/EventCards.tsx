/**
 * Start-of-turn event cards (UX 7.5): modal, up to three stacked, dismissed with Enter or a click.
 * Content comes from the pack's satirical strings where the event has them, else the generic
 * translation keys.
 */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { eventCardText, eventChips } from './labels';

export function EventCards() {
  const { t } = useTranslation();
  const cards = useGame((s) => s.cards);
  const dismiss = useGame((s) => s.dismissCard);
  const card = cards[0];
  if (!card) return null;
  const { title, text } = eventCardText(card, t);
  const chips = eventChips(card, t);
  const more = cards.length - 1;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('events.heading')}
      data-testid="event-modal"
      onClick={dismiss}
    >
      <section
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold" data-testid="event-title">
          {title}
        </h2>
        <p className="text-sm">{text}</p>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-1" data-testid="event-chips">
            {chips.map((chip, i) => (
              <li
                key={`${chip}-${i}`}
                className="rounded-full border border-line bg-surface-3 px-2 py-0.5 text-xs"
              >
                {chip}
              </li>
            ))}
          </ul>
        )}
        {more > 0 && <p className="text-xs text-ink-muted">{t('events.more', { n: more })}</p>}
        <Button variant="primary" onClick={dismiss} autoFocus data-testid="event-dismiss">
          {t('events.dismiss')}
        </Button>
      </section>
    </div>
  );
}
