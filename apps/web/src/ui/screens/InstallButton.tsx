/**
 * "Install app" (M12.6): shown only when the browser has offered the install prompt
 * (`beforeinstallprompt`) and the app is not already running installed. The event stays on the
 * device; nothing is sent anywhere.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { Button } from '../common/Button';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallStore {
  event: InstallPromptEvent | null;
  set: (event: InstallPromptEvent | null) => void;
}

export const useInstall = create<InstallStore>((set) => ({
  event: null,
  set: (event) => {
    set({ event });
  },
}));

/** Listen for the prompt for as long as the host component is mounted. */
export function useInstallPrompt(): void {
  const set = useInstall((s) => s.set);
  useEffect(() => {
    const onPrompt = (e: Event): void => {
      e.preventDefault();
      set(e as InstallPromptEvent);
    };
    const onInstalled = (): void => {
      set(null);
    };
    globalThis.addEventListener('beforeinstallprompt', onPrompt);
    globalThis.addEventListener('appinstalled', onInstalled);
    return () => {
      globalThis.removeEventListener('beforeinstallprompt', onPrompt);
      globalThis.removeEventListener('appinstalled', onInstalled);
    };
  }, [set]);
}

export function InstallButton() {
  const { t } = useTranslation();
  const event = useInstall((s) => s.event);
  const set = useInstall((s) => s.set);
  if (!event) return null;
  return (
    <Button
      data-testid="install-app"
      onClick={() => {
        // The prompt can be used once; drop it either way.
        set(null);
        void event.prompt().catch(() => undefined);
      }}
    >
      {t('title.install')}
    </Button>
  );
}
