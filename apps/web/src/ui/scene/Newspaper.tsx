/**
 * The newspaper (ART_SPEC 17.3, 17.9, M9.10). Reading it at the grocery (`ReadNews`) buys this
 * week's economy hint; this page shows it: the masthead art, the paper's name as text, the
 * headline for the hinted phase and this week's economy stories. Whether the hint is accurate
 * stays hidden, as in the rules.
 */
import { useTranslation } from 'react-i18next';
import { baseArtRegistry, useArtSets } from '../../assets/art/artRegistry';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { eventCardText } from '../game/labels';
import { ArtImage } from './ArtImage';

/** Whether the active player holds this week's paper. */
export function useHasPaper(): boolean {
  return useGame((s) => {
    const p = s.state?.players[s.state.activeSeat];
    return p !== undefined && p.newsHintWeek === s.state?.week;
  });
}

export function NewspaperButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  if (!useHasPaper()) return null;
  return (
    <Button onClick={onClick} data-testid="newspaper-btn">
      {t('news.open')}
    </Button>
  );
}

export function Newspaper({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  // Re-render when an art pack is installed or switched (M9.12).
  useArtSets((s) => s.version);
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const log = useGame((s) => s.log);
  const has = useHasPaper();
  if (!state || !pack || !has) return null;
  const phase = state.news.phaseHint;
  const stories = log
    .filter(
      (e) =>
        e.week === state.week &&
        e.event.type === 'EventFired' &&
        pack.eventById[e.event.eventId]?.family === 'economy',
    )
    .map((e) => eventCardText(e.event, t).title);
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
      <h3 className="text-lg font-bold" data-testid="news-headline">
        {t(`news.headline.${phase}`)}
      </h3>
      <p className="text-sm">{t(`news.body.${phase}`)}</p>
      {stories.length > 0 && (
        <ul className="list-disc pl-5 text-sm" data-testid="news-stories">
          {stories.map((s, i) => (
            <li key={`${s}-${i}`}>{s}</li>
          ))}
        </ul>
      )}
      <p className="text-xs italic text-ink-muted">{t('news.disclaimer')}</p>
      <Button onClick={onClose} data-testid="newspaper-close">
        {t('news.close')}
      </Button>
    </section>
  );
}
