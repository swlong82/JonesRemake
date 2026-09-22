import { useAudio } from './audio/useAudio';
import { useSaveConnection } from './platform/Services';
import { SaveNotice } from './save/SaveNotice';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlags } from './flags/appFlags';
import { useGame } from './store/gameStore';
import { applyDocumentSettings, useSettings } from './store/settings';
import { Spotlight } from './tutorial/Spotlight';
import { useTutorialBoot } from './tutorial/useTutorialBoot';
import { SCREENS } from './ui/screens/registry';
import { UnavailableScreen } from './ui/screens/UnavailableScreen';

/**
 * Screen router (UX_SPEC 7.1). Screens are plain components driven by the game store; the screen
 * registry decides which are live and which are still gated behind an app flag (CLAUDE.md 1.5).
 */
export function App() {
  useSaveConnection();
  useAudio();
  useTutorialBoot();
  const { t } = useTranslation();
  const screen = useGame((s) => s.screen);
  const settings = useSettings((s) => s.settings);
  const flags = useFlags((s) => s.flags);
  useEffect(() => {
    applyDocumentSettings(settings);
  }, [settings]);

  const entry = SCREENS[screen];
  const gate = entry.flag;
  const Component = gate === undefined || flags[gate] ? entry.component : undefined;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-white"
      >
        {t('app.skipToContent')}
      </a>
      <main id="main" className="min-h-screen">
        <SaveNotice />
        {Component ? <Component /> : <UnavailableScreen flag={gate ?? 'tutorial'} />}
        <Spotlight />
      </main>
    </div>
  );
}
