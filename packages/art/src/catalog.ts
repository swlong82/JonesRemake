/**
 * Slot catalog (ART_SPEC 17.3): every key a base art set must draw, with its viewBox size and
 * whether it is recoloured per player. Computed from the playable packs, so a pack that adds a
 * location adds that location's building, interior and host slots.
 */
import { STAGE } from './schema.js';

export const SLOT_GROUPS = [
  'board',
  'building',
  'interior',
  'host',
  'avatar',
  'weekend',
  'ui',
  'frame',
] as const;
export type SlotGroup = (typeof SLOT_GROUPS)[number];

export interface SlotSpec {
  key: string;
  group: SlotGroup;
  width: number;
  height: number;
  /** Painted in the manifest's tint key colours and recoloured per player (17.4). */
  tint: boolean;
  /** A base set may leave it out; the registry falls back to `fallback`. */
  optional?: { fallback: string };
}

export const PLAYER_AVATARS = [
  'player-1',
  'player-2',
  'player-3',
  'player-4',
  'player-5',
  'player-6',
] as const;
export const AVATAR_POSES = ['idle', 'walk1', 'walk2'] as const;
export const AVATAR_DIRS = ['n', 'e', 's', 'w'] as const;
export const AVATAR_MOODS = ['cheer', 'slump'] as const;
export const WEEKEND_MOODS = ['positive', 'negative', 'neutral'] as const;
export type AvatarPose = (typeof AVATAR_POSES)[number];
export type AvatarDir = (typeof AVATAR_DIRS)[number];

export const SIZES = {
  stage: { width: STAGE.width, height: STAGE.height },
  building: { width: 240, height: 240 },
  host: { width: 400, height: 600 },
  avatar: { width: 64, height: 96 },
  masthead: { width: 1200, height: 200 },
  frame: { width: 96, height: 96 },
} as const;

export interface CatalogInput {
  locationIds: readonly string[];
  personalityIds: readonly string[];
}

export function rivalAvatarId(personalityId: string): string {
  return `rival-${personalityId}`;
}

export function avatarIds(personalityIds: readonly string[]): string[] {
  return [...PLAYER_AVATARS, ...personalityIds.map(rivalAvatarId)];
}

export function avatarKey(avatarId: string, pose: string, dir: string): string {
  return `avatar:${avatarId}:${pose}:${dir}`;
}

function slot(key: string, group: SlotGroup, size: { width: number; height: number }): SlotSpec {
  return { key, group, width: size.width, height: size.height, tint: false };
}

/** Required slots, in a stable order (generator output and reports follow it). */
export function catalogFor(input: CatalogInput): SlotSpec[] {
  const out: SlotSpec[] = [slot('board:background', 'board', SIZES.stage)];
  const locations = [...new Set(input.locationIds)].sort();
  for (const id of locations) out.push(slot(`building:${id}`, 'building', SIZES.building));
  for (const id of locations) out.push(slot(`interior:${id}`, 'interior', SIZES.stage));
  for (const id of locations) out.push(slot(`host:${id}`, 'host', SIZES.host));
  for (const avatar of avatarIds([...new Set(input.personalityIds)].sort())) {
    for (const pose of AVATAR_POSES) {
      for (const dir of AVATAR_DIRS) {
        out.push({ ...slot(avatarKey(avatar, pose, dir), 'avatar', SIZES.avatar), tint: true });
      }
    }
    for (const mood of AVATAR_MOODS) {
      out.push({ ...slot(avatarKey(avatar, mood, 's'), 'avatar', SIZES.avatar), tint: true });
    }
  }
  for (const mood of WEEKEND_MOODS) out.push(slot(`weekend:${mood}`, 'weekend', SIZES.stage));
  out.push(slot('ui:title', 'ui', SIZES.stage));
  out.push(slot('ui:setup', 'ui', SIZES.stage));
  out.push(slot('ui:newspaper-masthead', 'ui', SIZES.masthead));
  out.push(slot('frame:panel', 'frame', SIZES.frame));
  out.push(slot('frame:button', 'frame', SIZES.frame));
  return out;
}

/**
 * Spec for any key an art set may define: a catalog slot, or an optional override such as
 * `weekend:<eventId>` (falls back to `weekend:neutral`). Unknown keys return `undefined`.
 */
export function slotSpecFor(key: string, catalog: readonly SlotSpec[]): SlotSpec | undefined {
  const known = catalog.find((s) => s.key === key);
  if (known) return known;
  const m = /^weekend:([a-z0-9-]+)$/.exec(key);
  if (m) {
    return {
      ...slot(key, 'weekend', SIZES.stage),
      optional: { fallback: 'weekend:neutral' },
    };
  }
  return undefined;
}
