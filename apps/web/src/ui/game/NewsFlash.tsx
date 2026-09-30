/**
 * News flash: a slim, non-blocking banner that slides in when a human's week begins with the lead
 * headline of the Daily Hustle digest. It never covers the board; "Read the paper" opens the full
 * page and the close button hides it until next week. Turn it off in Settings.
 */
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { useDigest } from '../scene/Newspaper';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { Button } from '../common/Button';

/** `seed:week:seat` of the flash the player dismissed; a new week or seat shows the next one. */
const useDismissed = create<{ key: string | null; dismiss: (key: string) => void }>((set) => ({
  key: null,
  dismiss: (key) => {
    set({ key });
  },
}));

const TONE_DOT: Record<string, string> = {
  good: 'bg-ok',
  bad: 'bg-danger',
  neutral: 'bg-ink-muted',
};

export function NewsFlash({ onRead }: { onRead: () => void }) {
  const { t } = useTranslation();
  const enabled = useSettings((s) => s.settings.newsFlash);
  const state = useGame((s) => s.state);
  const cards = useGame((s) => s.cards);
  const digest = useDigest();
  const dismissed = useDismissed((s) => s.key);
  const dismiss = useDismissed((s) => s.dismiss);
  if (!enabled || !state || !digest || cards.length > 0) return null;
  const seat = state.activeSeat;
  if (state.players[seat]?.controller !== 'human-local') return null;
  const key = `${state.config.seed}:${state.week}:${seat}`;
  const lead = digest.stories[0];
  if (!lead || dismissed === key) return null;
  const more = digest.stories.length - 1;
  return (
    <section
      className="news-flash sheet-enter flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
      aria-label={t('news.flash.label')}
      data-testid="news-flash"
    >
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[lead.tone] ?? ''}`}
        aria-hidden="true"
      />
      <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
        {t('news.flash.label')}
      </span>
      <span className="min-w-0 grow text-sm font-semibold" data-testid="news-flash-headline">
        {lead.headline}
        {more > 0 && (
          <span className="ml-2 text-xs font-normal text-ink-muted">
            {t('news.flash.more', { count: more })}
          </span>
        )}
      </span>
      <Button
        onClick={() => {
          dismiss(key);
          onRead();
        }}
        data-testid="news-flash-read"
      >
        {t('news.flash.read')}
      </Button>
      <Button
        aria-label={t('news.flash.dismiss')}
        onClick={() => {
          dismiss(key);
        }}
        data-testid="news-flash-dismiss"
      >
        ×
      </Button>
    </section>
  );
}
