/**
 * Start-of-turn event cards (UX 7.5): modal, up to three stacked, dismissed with Enter or a click.
 * Content comes from the pack's satirical strings where the event has them, else the generic
 * translation keys.
 */
import { useTranslation } from 'react-i18next';
import { useFlags } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { WeekendPicture } from '../scene/WeekendRecap';
import { eventCardText, eventChips, hours, summarizeCards } from './labels';

/** Two or more start-of-turn cards read as one "This week" summary with a single OK (M11.10). */
function WeekSummary({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  const cards = useGame((s) => s.cards);
  const rules = useGame((s) => s.pack?.rules);
  const net = summarizeCards(cards, rules);
  const netParts = [
    ...(net.halfHours !== 0
      ? [`${net.halfHours < 0 ? '−' : '+'}${t('event.chip.hours', { n: hours(net.halfHours) })}`]
      : []),
    ...(net.money !== 0
      ? [
          `${net.money < 0 ? '−' : '+'}${t('event.chip.money', {
            sign: '',
            n: Math.abs(net.money),
          })}`,
        ]
      : []),
  ];
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('events.weekSummary')}
      data-testid="event-modal"
      onClick={onDismiss}
    >
      <section
        className="flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-surface-2 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold" data-testid="event-title">
          {t('events.weekSummary')}
        </h2>
        <ul className="flex flex-col gap-3" data-testid="week-summary">
          {cards.map((card, i) => {
            const { title, text } = eventCardText(card, t, rules);
            const chips = eventChips(card, t, rules);
            return (
              <li key={`${card.seq}-${i}`} className="border-b border-line pb-2 last:border-b-0">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm">{text}</p>
                {chips.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {chips.map((chip, k) => (
                      <li
                        key={`${chip}-${k}`}
                        className="rounded-full border border-line bg-surface-3 px-2 py-0.5 text-xs"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {netParts.length > 0 && (
          <p className="text-sm font-semibold" data-testid="week-net">
            {t('events.net', { list: netParts.join(' · ') })}
          </p>
        )}
        <Button variant="primary" onClick={onDismiss} autoFocus data-testid="event-dismiss">
          {t('events.dismiss')}
        </Button>
      </section>
    </div>
  );
}

export function EventCards() {
  const { t } = useTranslation();
  const cards = useGame((s) => s.cards);
  const dismiss = useGame((s) => s.dismissCard);
  const dismissAll = useGame((s) => s.dismissAllCards);
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const sceneUi = useFlags((f) => f.flags.sceneUi);
  const card = cards[0];
  if (!card) return null;
  if (cards.length > 1) return <WeekSummary onDismiss={dismissAll} />;
  const { title, text } = eventCardText(card, t, pack?.rules);
  const chips = eventChips(card, t, pack?.rules);
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
        {sceneUi && state && pack && card.type === 'EventFired' && (
          <WeekendPicture card={card} state={state} pack={pack} />
        )}
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
