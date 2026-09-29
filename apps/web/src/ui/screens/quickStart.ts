/**
 * Quick Start (M12.1): one tap from the title screen into a modern-city game against one rival, on
 * defaults. The tutorial starts by itself on a first game (`useTutorialBoot`). Everything else stays
 * one screen away under "New game".
 */
import { loadPack, WORLD } from '@hustle-ring/content';
import type { GameConfig } from '@hustle-ring/engine';
import { buildConfig, defaultSeat, randomSeed } from './SetupScreen';

/** The newest bundled ruleset the world offers, else its first. */
export function quickStartPackId(): string {
  const ids = WORLD.cities.map((c) => c.packId);
  return ids.includes('modern-western') ? 'modern-western' : (ids[0] ?? 'classic');
}

export function quickStartConfig(seed: string = randomSeed(), classicOpacity = false): GameConfig {
  const packId = quickStartPackId();
  const pack = loadPack(packId);
  return buildConfig(
    packId,
    [defaultSeat(0, 'human-local', 'You'), defaultSeat(1, 'ai', 'Rival')],
    seed,
    pack.flags.modernEvents ? 'modern' : 'classic',
    classicOpacity,
    false,
  );
}
