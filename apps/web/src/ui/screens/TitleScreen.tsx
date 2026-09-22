import { ENGINE_VERSION, STATE_SCHEMA_VERSION } from '@hustle-ring/engine';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSaves } from '../../save/controller';
import { Button } from '../common/Button';

export function TitleScreen() {
  const { t } = useTranslation();
  const { records, controller, busy } = useSaves();
  const go = useGame((s) => s.go);
  const state = useGame((s) => s.state);
  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-5xl font-black tracking-tight">{t('app.title')}</h1>
      <p className="mb-4 text-ink-muted">{t('app.tagline')}</p>
      {((state !== null && state.winner === null) || records.some((r) => r.id === 'autosave')) && (
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            if (state?.winner === null) go('game');
            else void controller?.load('autosave');
          }}
          data-testid="continue"
        >
          {t('title.continue')}
        </Button>
      )}
      <Button variant="primary" onClick={() => go('setup')} data-testid="new-game">
        {t('title.newGame')}
      </Button>
      <Button onClick={() => go('saves')}>{t('title.load')}</Button>
      <Button onClick={() => go('settings')} data-testid="settings">
        {t('title.settings')}
      </Button>
      <Button onClick={() => go('stats')} data-testid="stats">
        {t('title.stats')}
      </Button>
      <Button onClick={() => go('help')} data-testid="how-to-play">
        {t('title.howToPlay')}
      </Button>
      <footer className="mt-6 text-xs text-ink-muted" data-testid="version">
        {t('app.version', { engine: ENGINE_VERSION, schema: STATE_SCHEMA_VERSION })}
        {state ? ` · ${t('app.seed', { seed: state.config.seed })}` : ''}
      </footer>
    </section>
  );
}
