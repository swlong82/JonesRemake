/**
 * Game screen (UX 7.2, M4.3–M4.6). Two layouts over one component tree: board + right column on
 * desktop and tablet, compact HUD + mini ring + location list + bottom sheet on phones. The
 * keyboard map (7.7) and the live region (7.8) are attached here.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebugBoot } from '../../debug/useDebugBoot';
import { useGame } from '../../store/gameStore';
import { Button } from '../common/Button';
import { AiTicker } from '../game/AiTicker';
import { Board } from '../game/Board';
import { DebugPanel } from '../game/DebugPanel';
import { EventCards } from '../game/EventCards';
import { Hud } from '../game/Hud';
import { LocationPanel } from '../game/LocationPanel';
import { LogDrawer } from '../game/LogDrawer';
import { MenuSheet } from '../game/MenuSheet';
import { PhoneLocationList } from '../game/PhoneLocationList';
import { Standings } from '../game/Standings';
import { TravelSheet } from '../game/TravelSheet';
import { hours } from '../game/labels';
import { useIsPhone } from '../game/useIsPhone';
import { useKeyboard } from '../game/useKeyboard';

function LiveRegion() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const player = state?.players[state.activeSeat];
  if (!state || !player) return null;
  return (
    <p className="sr-only" aria-live="polite" data-testid="live">
      {`${t('live.turn', { name: player.name, week: state.week })} · ${t('live.hours', {
        n: hours(player.hoursLeft),
      })} · ${t('live.money', { cash: player.cash })}`}
    </p>
  );
}

export function GameScreen() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const travelOpen = useGame((s) => s.travelOpen);
  const logOpen = useGame((s) => s.logOpen);
  const standingsOpen = useGame((s) => s.standingsOpen);
  const menuOpen = useGame((s) => s.menuOpen);
  const toggleMenu = useGame((s) => s.toggleMenu);
  const phone = useIsPhone();
  const debug = useDebugBoot();
  const [expanded, setExpanded] = useState(false);
  useKeyboard();
  if (!state) return null;

  const side = (
    <div className="flex flex-col gap-3">
      <Hud compact={phone} />
      {travelOpen && <TravelSheet />}
      {standingsOpen && <Standings />}
      {menuOpen && <MenuSheet />}
      <AiTicker />
      <LocationPanel />
      {debug && <DebugPanel />}
      {logOpen && <LogDrawer />}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
      <LiveRegion />
      <EventCards />
      <div className="flex items-center gap-2">
        <h1 className="grow text-xl font-bold">{t('app.title')}</h1>
        <Button onClick={toggleMenu} data-testid="menu-btn">
          {t('hud.menu')}
        </Button>
      </div>
      {phone ? (
        <div className="flex flex-col gap-3">
          {expanded ? (
            <div className="flex flex-col items-center gap-2">
              <Board />
              <Button onClick={() => setExpanded(false)} data-testid="board-collapse">
                {t('board.collapse')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Board compact />
              <Button onClick={() => setExpanded(true)} data-testid="board-expand">
                {t('board.expand')}
              </Button>
            </div>
          )}
          <PhoneLocationList />
          <h2 className="text-sm font-semibold text-ink-muted">{t('phone.actions')}</h2>
          {side}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex justify-center">
            <Board />
          </div>
          {side}
        </div>
      )}
    </div>
  );
}
