/**
 * Weekend recap (ART_SPEC 17.3, 17.9, M9.10): a weekend event card becomes a small scene — the
 * event's picture (`weekend:<eventId>`, else the picture for its tone) with the player's avatar
 * cheering, slumping or standing by, above the usual title, text and effect chips.
 */
import type { CityPack } from '@hustle-ring/content';
import type { GameState } from '@hustle-ring/engine';
import type { DomainEvent } from '@hustle-ring/shared';
import { artRegistryFor, useArtSets } from '../../assets/art/artRegistry';
import { ArtImage } from './ArtImage';
import { avatarIdFor } from './walk';

export type WeekendMood = 'positive' | 'negative' | 'neutral';

/** The weekend event behind a card, or null for any other card. */
export function weekendEvent(
  card: DomainEvent,
  pack: CityPack,
): { id: string; mood: WeekendMood } | null {
  if (card.type !== 'EventFired') return null;
  const spec = pack.eventById[card.eventId];
  if (spec?.family !== 'weekend') return null;
  const tone = spec.tone;
  const mood: WeekendMood = tone === 'good' ? 'positive' : tone === 'bad' ? 'negative' : 'neutral';
  return { id: card.eventId, mood };
}

export function WeekendPicture({
  card,
  state,
  pack,
}: {
  card: DomainEvent & { type: 'EventFired' };
  state: GameState;
  pack: CityPack;
}) {
  useArtSets((s) => s.version);
  const weekend = weekendEvent(card, pack);
  if (!weekend) return null;
  const registry = artRegistryFor(pack);
  const own = `weekend:${weekend.id}`;
  const scene = registry.hasOwn(own) ? own : `weekend:${weekend.mood}`;
  const player = state.players[card.seat];
  const pose =
    weekend.mood === 'positive' ? 'cheer' : weekend.mood === 'negative' ? 'slump' : 'idle';
  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-line"
      data-testid="weekend-recap"
      data-mood={weekend.mood}
    >
      <ArtImage registry={registry} artKey={scene} className="absolute inset-0 h-full w-full" />
      {player && (
        <ArtImage
          registry={registry}
          artKey={`avatar:${avatarIdFor(state.config.seats[player.seat], player.seat)}:${pose}:s`}
          tint={player.color}
          className="absolute bottom-[4%] left-1/2 h-[55%] -translate-x-1/2"
          testId="weekend-avatar"
        />
      )}
    </div>
  );
}
