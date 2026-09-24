/**
 * Location interior (ART_SPEC 17.9, M9.8): while the active player is inside, the stage shows the
 * location's room with its host behind the counter, a speech bubble with the pack's greeting, and
 * the action panel (UX 7.4) in the calm right 40% of the room. The art is decorative; the heading,
 * the greeting and every action are text and buttons.
 */
import { useTranslation } from 'react-i18next';
import type { ArtRegistry } from '../../assets/art/artRegistry';
import { useGame } from '../../store/gameStore';
import { LocationPanel } from '../game/LocationPanel';
import { locationName, locationQuip } from '../game/labels';
import { ArtImage } from './ArtImage';
import { anchorStyle, pctX, pctY } from './geometry';

/** Host placement on the stage: feet on the floor, left of centre. */
const HOST = { x: 430, y: 980, width: 440, height: 660 };

export function SpeechBubble({ text, testId }: { text: string; testId: string }) {
  return (
    <p
      className="relative rounded-2xl border-2 border-ink bg-surface-2 px-3 py-2 text-[clamp(12px,1.2vw,18px)] font-semibold text-ink shadow-md after:absolute after:-bottom-3 after:left-6 after:h-5 after:w-5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-ink after:bg-surface-2"
      data-testid={testId}
    >
      {text}
    </p>
  );
}

export function InteriorScene({ registry }: { registry: ArtRegistry }) {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  if (!state) return null;
  const player = state.players[state.activeSeat];
  if (!player) return null;
  const loc = player.location;
  return (
    <div
      className="absolute inset-0"
      role="group"
      aria-label={t('scene.inside', { name: locationName(loc) })}
      data-testid="scene-interior"
    >
      <ArtImage
        registry={registry}
        artKey={`interior:${loc}`}
        className="absolute inset-0 h-full w-full"
      />
      <ArtImage
        registry={registry}
        artKey={`host:${loc}`}
        style={anchorStyle({ x: HOST.x, y: HOST.y }, HOST.width, HOST.height)}
      />
      <div className="absolute max-w-[34%]" style={{ left: pctX(520), top: pctY(170) }}>
        <SpeechBubble text={locationQuip(loc, state.week)} testId="host-speech" />
      </div>
      <div
        className="absolute left-[60%] top-[2%] h-[96%] w-[38.5%] overflow-y-auto"
        data-testid="interior-panel"
      >
        <LocationPanel />
      </div>
    </div>
  );
}

/** Phone variant (17.9): a cropped strip of the room with the host and the greeting. */
export function InteriorHeader({ registry }: { registry: ArtRegistry }) {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const player = state.players[state.activeSeat];
  if (!player?.inside) return null;
  const loc = player.location;
  return (
    <div
      className="relative h-36 overflow-hidden rounded-lg border border-line"
      data-testid="interior-header"
    >
      <ArtImage
        registry={registry}
        artKey={`interior:${loc}`}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <ArtImage
        registry={registry}
        artKey={`host:${loc}`}
        className="absolute bottom-0 left-2 h-[95%] w-auto"
      />
      <div className="absolute right-2 top-2 max-w-[60%]">
        <SpeechBubble text={locationQuip(loc, state.week)} testId="host-speech" />
      </div>
    </div>
  );
}
