/**
 * Scene game screen (ART_SPEC 17.9, M9.6), shown instead of the ring layout while the `sceneUi`
 * flag is on (desktop and tablet; phones keep the list layout until M9.9). A 16:10 stage holds
 * the city block — or, while the active player is inside a location, its interior (M9.8) — and
 * the HUD bar sits underneath. Sheets (travel, standings, log, menu, full HUD, the outside
 * location panel) open in the park at the centre of the block on wide screens, where no building
 * sits, and below the stage on narrower ones, so they never cover a square.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { artRegistryFor } from '../../assets/art/artRegistry';
import { useGame } from '../../store/gameStore';
import { AiTicker } from '../game/AiTicker';
import { DebugPanel } from '../game/DebugPanel';
import { Hud } from '../game/Hud';
import { LocationPanel } from '../game/LocationPanel';
import { LogDrawer } from '../game/LogDrawer';
import { MenuSheet } from '../game/MenuSheet';
import { Standings } from '../game/Standings';
import { TravelSheet } from '../game/TravelSheet';
import { useIsWide } from '../game/useIsPhone';
import { AvatarLayer, HudAvatar } from './Avatars';
import { BoardScene, layoutFor } from './BoardScene';
import { InteriorScene } from './InteriorScene';
import { SceneHudBar } from './SceneHudBar';

function Sheet({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[360px] shrink-0 empty:hidden">{children}</div>;
}

export function SceneGameScreen({ debug }: { debug: boolean }) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const travelOpen = useGame((s) => s.travelOpen);
  const logOpen = useGame((s) => s.logOpen);
  const standingsOpen = useGame((s) => s.standingsOpen);
  const menuOpen = useGame((s) => s.menuOpen);
  const [details, setDetails] = useState(false);
  const wide = useIsWide();
  if (!state || !pack) return null;
  const registry = artRegistryFor(pack);
  const player = state.players[state.activeSeat];
  const yourTurn = player?.controller === 'human-local';
  const showInterior = yourTurn && player.inside;

  const sheets = [
    details && <Hud key="hud" />,
    yourTurn && travelOpen && <TravelSheet key="travel" />,
    standingsOpen && <Standings key="standings" />,
    menuOpen && <MenuSheet key="menu" />,
    <AiTicker key="ticker" />,
    yourTurn && !showInterior && <LocationPanel key="panel" />,
    debug && <DebugPanel key="debug" />,
    logOpen && <LogDrawer key="log" />,
  ].filter((s): s is React.JSX.Element => s !== false);
  const inPark = wide && !showInterior;

  return (
    <div
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 p-2"
      data-testid="scene-screen"
    >
      <h1 className="sr-only">{t('app.title')}</h1>
      <div
        className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-xl border border-line bg-surface-3"
        style={{ maxWidth: 'calc((100dvh - 10rem) * 1.6)' }}
        data-testid="scene-stage"
      >
        {showInterior ? (
          <InteriorScene registry={registry} />
        ) : (
          <BoardScene registry={registry}>
            <AvatarLayer registry={registry} layout={layoutFor(registry, pack)} />
          </BoardScene>
        )}
        {inPark && (
          <div
            className="absolute left-[15.5%] top-[23.5%] flex h-[53%] w-[69%] flex-wrap content-start justify-center gap-2 overflow-y-auto p-1"
            data-testid="scene-sheets"
          >
            {sheets.map((s) => (
              <Sheet key={s.key}>{s}</Sheet>
            ))}
          </div>
        )}
      </div>
      {/* Narrow screens, and the interior (whose panel lives in the scene), put them below. */}
      {!inPark && sheets.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2" data-testid="scene-sheets-below">
          {sheets.map((s) => (
            <Sheet key={s.key}>{s}</Sheet>
          ))}
        </div>
      )}
      <SceneHudBar
        avatar={<HudAvatar registry={registry} />}
        onDetails={() => setDetails((d) => !d)}
      />
    </div>
  );
}
