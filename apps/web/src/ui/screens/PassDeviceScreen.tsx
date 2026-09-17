import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';

/** Hotseat privacy screen (UX 7.1): shown before each human turn when > 1 human. */
export function PassDeviceScreen() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const ready = useGame((s) => s.ready);
  const name = state?.players[state.activeSeat]?.name ?? '';
  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">{t('pass.heading')}</h1>
      <p className="text-xl">{t('pass.to', { name })}</p>
      <p className="text-ink-muted">{t('pass.hint', { name })}</p>
      <Button variant="primary" onClick={ready} autoFocus data-testid="ready">
        {t('pass.ready')}
      </Button>
    </section>
  );
}
