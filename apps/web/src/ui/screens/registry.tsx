/**
 * Screen registry: maps each `Screen` to its component and, where the screen belongs to unfinished
 * work, to the app flag that gates it (see `flags/appFlags.ts`).
 *
 * Every M4 screen is built, so nothing here is gated. A later milestone adds its screen the same
 * way: register it with the flag that gates it, and drop the flag when the screen lands.
 */
import type { ComponentType } from 'react';
import type { AppFlagId } from '../../flags/appFlags';
import type { Screen } from '../../store/gameStore';
import { EndScreen } from './EndScreen';
import { GameScreen } from './GameScreen';
import { HelpScreen } from './HelpScreen';
import { PassDeviceScreen } from './PassDeviceScreen';
import { SettingsScreen } from './SettingsScreen';
import { SetupScreen } from './SetupScreen';
import { StatsScreen } from './StatsScreen';
import { SaveScreen } from './SaveScreen';
import { TitleScreen } from './TitleScreen';

export interface ScreenEntry {
  /** Absent for finished screens; present while the screen is gated. */
  flag?: AppFlagId;
  /** Absent while the screen does not exist yet — the router falls back to Unavailable. */
  component?: ComponentType;
}

export const SCREENS: Record<Screen, ScreenEntry> = {
  title: { component: TitleScreen },
  saves: { component: SaveScreen },
  setup: { component: SetupScreen },
  settings: { component: SettingsScreen },
  stats: { component: StatsScreen },
  help: { component: HelpScreen },
  pass: { component: PassDeviceScreen },
  game: { component: GameScreen },
  end: { component: EndScreen },
};

/** The flag gating a screen, or null when the screen is unconditional. */
export function flagForScreen(screen: Screen): AppFlagId | null {
  return SCREENS[screen].flag ?? null;
}
