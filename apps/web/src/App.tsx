import { ENGINE_VERSION, STATE_SCHEMA_VERSION } from '@hustle-ring/engine';
import { useTranslation } from 'react-i18next';

/** Placeholder Title page (M0.4). Replaced by the real screen map in M4 (UX_SPEC 7.1). */
export function App() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">{t('app.title')}</h1>
      <p className="text-lg">{t('app.tagline')}</p>
      <p role="status" className="rounded border border-current/30 p-3 text-sm">
        {t('app.status')}
      </p>
      <footer className="text-xs opacity-70" data-testid="version">
        {t('app.version', { engine: ENGINE_VERSION, schema: STATE_SCHEMA_VERSION })}
      </footer>
    </main>
  );
}
