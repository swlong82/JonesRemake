import { useTranslation } from 'react-i18next';
import { APP_FLAGS, type AppFlagId } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';

/**
 * Shown when a screen's app flag is off (CLAUDE.md 1.5): the feature is specified but not built
 * yet. It names the milestone that lands it so the state of the build is never a mystery.
 */
export function UnavailableScreen({ flag }: { flag: AppFlagId }) {
  const { t } = useTranslation();
  const go = useGame((s) => s.go);
  const spec = APP_FLAGS[flag];
  return (
    <section
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="unavailable"
    >
      <h1 className="text-3xl font-bold">{t('flags.heading')}</h1>
      <p>{t('flags.body', { feature: t(spec.labelKey) })}</p>
      <p className="text-ink-muted" data-testid="unavailable-milestone">
        {t('flags.milestone', { milestone: spec.milestone })}
      </p>
      <Button variant="primary" onClick={() => go('title')} data-testid="unavailable-back">
        {t('flags.back')}
      </Button>
    </section>
  );
}
