/**
 * Scene game screen (ART_SPEC 17.9, M9.6), shown instead of the ring layout while the `sceneUi`
 * flag is on (desktop and tablet; phones keep the list layout until M9.9). A 16:10 stage holds
 * the city block — or, while the active player is inside a location, its interior (M9.8) — and
 * the HUD bar sits underneath. Sheets (travel, standings, log, menu, full HUD, the outside
 * location panel) open in a column beside the stage on wide screens and below it on narrower
 * ones, so they never cover a square or an avatar.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { artRegistryFor, useArtSets } from '../../assets/art/artRegistry';
import { useScenePrefetch } from '../../assets/art/usePrefetch';
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
import { Newspaper } from './Newspaper';
import { SceneHudBar } from './SceneHudBar';

function Sheet({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[360px] shrink-0 empty:hidden">{children}</div>;
}

export function SceneGameScreen({ debug }: { debug: boolean }) {
  const { t } = useTranslation();
  // Re-render when an art pack is installed or switched (M9.12).
  useArtSets((s) => s.version);
  const state = useGame((s) => s.state);
  const pack = useGame((s) => s.pack);
  const travelOpen = useGame((s) => s.travelOpen);
  const logOpen = useGame((s) => s.logOpen);
  const standingsOpen = useGame((s) => s.standingsOpen);
  const menuOpen = useGame((s) => s.menuOpen);
  const [details, setDetails] = useState(false);
  const [paper, setPaper] = useState(false);
  useScenePrefetch();
  const wide = useIsWide();
  if (!state || !pack) return null;
  const registry = artRegistryFor(pack);
  const player = state.players[state.activeSeat];
  const yourTurn = player?.controller === 'human-local';
  const showInterior = yourTurn && player.inside;

  const sheets = [
    details && <Hud key="hud" />,
    paper && <Newspaper key="paper" onClose={() => setPaper(false)} />,
    yourTurn && travelOpen && <TravelSheet key="travel" />,
    standingsOpen && <Standings key="standings" />,
    menuOpen && <MenuSheet key="menu" />,
    <AiTicker key="ticker" />,
    yourTurn && !showInterior && <LocationPanel key="panel" />,
    debug && <DebugPanel key="debug" />,
    logOpen && <LogDrawer key="log" />,
  ].filter((s): s is React.JSX.Element => s !== false);
  // Wide screens put the sheets in a column beside the stage, so they never cover a building or
  // an avatar on the street; narrower ones stack them under it (ADR-0058).
  const beside = wide;
  const column = sheets.length > 0 && (
    <div
      className={
        beside
          ? 'flex max-h-[calc(100dvh-10rem)] w-[360px] shrink-0 flex-col gap-2 overflow-y-auto'
          : 'flex flex-wrap justify-center gap-2'
      }
      data-testid={beside ? 'scene-sheets' : 'scene-sheets-below'}
    >
      {sheets.map((s) => (
        <Sheet key={s.key}>{s}</Sheet>
      ))}
    </div>
  );

  return (
    <div
      className="mx-auto flex w-full max-w-[1800px] flex-col gap-2 p-2"
      data-testid="scene-screen"
    >
      <h1 className="sr-only">{t('app.title')}</h1>
      <div className={beside ? 'flex items-start justify-center gap-3' : 'flex flex-col gap-2'}>
        <div
          className="relative aspect-[16/10] w-full min-w-0 overflow-hidden rounded-xl border border-line bg-surface-3"
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
        </div>
        {column}
      </div>
      <SceneHudBar
        avatar={<HudAvatar registry={registry} />}
        onDetails={() => setDetails((d) => !d)}
        onNewspaper={() => setPaper((p) => !p)}
      />
    </div>
  );
}
