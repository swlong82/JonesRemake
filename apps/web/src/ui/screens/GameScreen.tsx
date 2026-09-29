/**
 * Game screen (UX 7.2, M4.3–M4.6). Two layouts over one component tree: board + right column on
 * desktop and tablet, compact HUD + mini ring + location list + bottom sheet on phones. The
 * keyboard map (7.7) and the live region (7.8) are attached here.
 */
import { useEffect, useState, type ReactNode } from 'react';
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
import { hours, turnOwner } from '../game/labels';
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
      {`${t('live.turn', { owner: turnOwner(player.name, t), week: state.week })} · ${t(
        'live.hours',
        {
          n: hours(player.hoursLeft),
        },
      )} · ${t('live.money', { cash: player.cash })}`}
    </p>
  );
}

/**
 * Phone: slim status strip that stays on screen while the map and panels scroll under it, so
 * turn, week, hours and cash are never a scroll away (M11.6).
 */
function PhoneStatusBar() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const toggleMenu = useGame((s) => s.toggleMenu);
  const player = state?.players[state.activeSeat];
  if (!state || !player) return null;
  return (
    <div
      className="sticky top-0 z-20 -mx-3 -mt-3 flex items-center gap-2 border-b border-line bg-surface px-3 py-2"
      data-testid="phone-status"
    >
      <h1 className="sr-only">{t('app.title')}</h1>
      <p className="grow text-sm font-semibold">
        {t('phone.status', {
          name: player.name,
          week: t('hud.week', { n: state.week }),
          hours: t('hud.hours', { n: hours(player.hoursLeft) }),
          cash: player.cash,
        })}
      </p>
      <Button onClick={toggleMenu} data-testid="menu-btn">
        {t('hud.menu')}
      </Button>
    </div>
  );
}

/** Phone bottom sheet: keeps the map visible and tappable above it. */
function PhoneSheet({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-3 shadow-2xl"
      data-testid="phone-sheet"
    >
      {children}
    </div>
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
  const active = state?.players[state.activeSeat];
  // Entering, leaving or a new turn changes what the page is about: start at the top of it (M11.6).
  useEffect(() => {
    if (phone) window.scrollTo(0, 0);
  }, [phone, active?.location, active?.inside, state?.activeSeat, state?.week]);
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
      {yourTurn &&
        travelOpen &&
        (phone ? (
          <PhoneSheet>
            <TravelSheet />
          </PhoneSheet>
        ) : (
          <TravelSheet />
        ))}
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
      {phone ? (
        <PhoneStatusBar />
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="grow text-xl font-bold">{t('app.title')}</h1>
          <Button onClick={toggleMenu} data-testid="menu-btn">
            {t('hud.menu')}
          </Button>
        </div>
      )}
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
