/**
 * Game screen (UX 7.2, M4.3–M4.6). Two layouts over one component tree: board + right column on
 * desktop and tablet, compact HUD + mini ring + location list + bottom sheet on phones. The
 * keyboard map (7.7) and the live region (7.8) are attached here.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { artRegistryFor, useArtSets } from '../../assets/art/artRegistry';
import { useDebugBoot } from '../../debug/useDebugBoot';
import { useFlags } from '../../flags/appFlags';
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
import { InteriorHeader } from '../scene/InteriorScene';
import { Newspaper, NewspaperButton } from '../scene/Newspaper';
import { PhoneScene } from '../scene/PhoneScene';
import { SceneGameScreen } from '../scene/SceneGameScreen';

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
  // Re-render when an art pack is installed or switched (M9.12).
  useArtSets((s) => s.version);
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const travelOpen = useGame((s) => s.travelOpen);
  const logOpen = useGame((s) => s.logOpen);
  const standingsOpen = useGame((s) => s.standingsOpen);
  const menuOpen = useGame((s) => s.menuOpen);
  const toggleMenu = useGame((s) => s.toggleMenu);
  const phone = useIsPhone();
  const debug = useDebugBoot();
  const [expanded, setExpanded] = useState(false);
  const [paper, setPaper] = useState(false);
  const sceneUi = useFlags((f) => f.flags.sceneUi);
  useKeyboard();
  if (!state) return null;
  // The illustrated scene (ART_SPEC 17.9) replaces the ring on desktop and tablet; phones get
  // the pannable scene with a list toggle (M9.9).
  if (sceneUi && !phone) {
    return (
      <>
        <LiveRegion />
        <EventCards />
        <SceneGameScreen debug={debug} />
      </>
    );
  }
  // While a rival is playing, the panel and travel sheet would act on the AI's seat: show the
  // ticker instead (the keyboard map is gated the same way).
  const yourTurn = state.players[state.activeSeat]?.controller === 'human-local';

  const side = (
    <div className="flex flex-col gap-3">
      <Hud compact={phone} />
      {yourTurn && travelOpen && <TravelSheet />}
      {standingsOpen && <Standings />}
      {menuOpen && <MenuSheet />}
      <AiTicker />
      {sceneUi && yourTurn && pack && <InteriorHeader registry={artRegistryFor(pack)} />}
      {yourTurn && <LocationPanel />}
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
      {phone && sceneUi ? (
        <div className="flex flex-col gap-3">
          <PhoneScene />
          <NewspaperButton onClick={() => setPaper((p) => !p)} />
          {paper && <Newspaper onClose={() => setPaper(false)} />}
          <h2 className="text-sm font-semibold text-ink-muted">{t('phone.actions')}</h2>
          {side}
        </div>
      ) : phone ? (
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
