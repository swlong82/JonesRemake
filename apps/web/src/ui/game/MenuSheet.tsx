/** In-game menu (UX 7.2): save/load (M7), settings, help, quit, and the state hash for bug reports. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';

export function MenuSheet() {
  const { t } = useTranslation();
  const close = useGame((s) => s.toggleMenu);
  const go = useGame((s) => s.go);
  const quit = useGame((s) => s.quit);
  const hash = useGame((s) => s.hash);
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={t('menu.heading')}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
      data-testid="menu-sheet"
    >
      <h2 className="text-lg font-bold">{t('menu.heading')}</h2>
      <Button disabled title={t('title.loadSoon')}>
        {t('menu.save')}
      </Button>
      <Button disabled title={t('title.loadSoon')}>
        {t('menu.load')}
      </Button>
      <Button onClick={() => go('settings')} data-testid="menu-settings">
        {t('menu.settings')}
      </Button>
      <Button onClick={() => go('help')} data-testid="menu-help">
        {t('menu.help')}
      </Button>
      {confirmQuit ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t('menu.quitConfirm')}</p>
          <Button variant="danger" onClick={quit} data-testid="menu-quit-confirm">
            {t('menu.quit')}
          </Button>
          <Button onClick={() => setConfirmQuit(false)}>{t('travel.cancel')}</Button>
        </div>
      ) : (
        <Button onClick={() => setConfirmQuit(true)} data-testid="menu-quit">
          {t('menu.quit')}
        </Button>
      )}
      <p className="text-xs text-ink-muted" data-testid="menu-hash">
        {t('menu.hash')}: {hash()}
      </p>
      <Button onClick={close} data-testid="menu-close">
        {t('menu.close')}
      </Button>
    </section>
  );
}
