/**
 * The newspaper (ART_SPEC 17.3, 17.9, M9.10). Always on the shelf: the front page and the weekly
 * digest (`buildDigest`) are written from the current game, free. Buying this week's paper at the
 * grocery (`ReadNews`) adds the forecast, whose accuracy stays hidden, as in the rules.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { baseArtRegistry, useArtSets } from '../../assets/art/artRegistry';
import { buildDigest, type NewsDigest, type StoryTone } from '../../news/digest';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { ArtImage } from './ArtImage';

/** Whether the active player holds this week's paper (the forecast is theirs to read). */
export function useHasPaper(): boolean {
  return useGame((s) => {
    const p = s.state?.players[s.state.activeSeat];
    return p !== undefined && p.newsHintWeek === s.state?.week;
  });
}

/** The active player's digest for this week; recomputed when the game state or log changes. */
export function useDigest(): NewsDigest | null {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const log = useGame((s) => s.log);
  return useMemo(
    () =>
      state && pack
        ? buildDigest(
            state,
            pack,
            state.activeSeat,
            t,
            log.map((e) => ({ week: e.week, event: e.event })),
          )
        : null,
    [state, pack, log, t],
  );
}

export function NewspaperButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button onClick={onClick} data-testid="newspaper-btn">
      {t('news.open')}
    </Button>
  );
}

const TONE_STYLE: Record<StoryTone, string> = {
  good: 'border-l-ok',
  bad: 'border-l-danger',
  neutral: 'border-l-line',
};

export function Newspaper({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  // Re-render when an art pack is installed or switched (M9.12).
  useArtSets((s) => s.version);
  const state = useGame((s) => s.state);
  const has = useHasPaper();
  const digest = useDigest();
  if (!state || !digest) return null;
  const phase = state.news.phaseHint;
  const [lead, ...rest] = digest.stories;
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
      aria-label={t('news.name')}
      data-testid="newspaper"
    >
      <div className="relative overflow-hidden rounded-md border border-line">
        <ArtImage
          registry={baseArtRegistry()}
          artKey="ui:newspaper-masthead"
          className="aspect-[6/1] w-full"
        />
      </div>
      <h2 className="text-center font-serif text-2xl font-black tracking-tight">
        {t('news.name')}
      </h2>
      <p className="text-center text-xs text-ink-muted">
        {t('news.edition', { week: state.week })}
      </p>
      {lead && (
        <article data-testid="news-lead">
          <h3 className="text-lg font-bold" data-testid="news-lead-headline">
            {lead.headline}
          </h3>
          <p className="text-sm">{lead.body}</p>
        </article>
      )}
      {rest.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-ink-muted">{t('news.stories.heading')}</h3>
          <ul className="flex flex-col gap-2" data-testid="news-stories">
            {rest.map((s) => (
              <li
                key={s.id}
                className={`rounded-md border border-line border-l-4 bg-surface-3 px-2 py-1 ${TONE_STYLE[s.tone]}`}
                data-testid={`news-story-${s.id}`}
              >
                <p className="text-xs uppercase tracking-wide text-ink-muted">
                  {t(`news.section.${s.section}`)}
                </p>
                <p className="font-semibold">{s.headline}</p>
                <p className="text-sm">{s.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <section aria-label={t('news.forecast.heading')} data-testid="news-forecast">
        <h3 className="text-sm font-semibold text-ink-muted">{t('news.forecast.heading')}</h3>
        {has ? (
          <>
            <p className="font-bold" data-testid="news-headline">
              {t(`news.headline.${phase}`)}
            </p>
            <p className="text-sm">{t(`news.body.${phase}`)}</p>
          </>
        ) : (
          <p className="text-sm" data-testid="news-forecast-locked">
            {t('news.forecast.locked')}
          </p>
        )}
      </section>
      <p className="text-xs italic text-ink-muted">{t('news.disclaimer')}</p>
      <Button onClick={onClose} data-testid="newspaper-close">
        {t('news.close')}
      </Button>
    </section>
  );
}
