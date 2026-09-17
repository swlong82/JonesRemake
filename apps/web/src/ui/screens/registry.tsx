/**
 * Screen registry: maps each `Screen` to its component and, where the screen belongs to unfinished
 * work, to the app flag that gates it (see `flags/appFlags.ts`).
 *
 * Wiring point for the next milestone: when M4.3–M4.6 land the board UI, add
 * `game: { flag: 'gameBoard', component: GameScreen }` here and flip `gameBoard` to default on in
 * the flag registry. Nothing else in the router changes.
 */
import type { ComponentType } from 'react';
import type { AppFlagId } from '../../flags/appFlags';
import type { Screen } from '../../store/gameStore';
import { HelpScreen } from './HelpScreen';
import { PassDeviceScreen } from './PassDeviceScreen';
import { SettingsScreen } from './SettingsScreen';
import { SetupScreen } from './SetupScreen';
import { StatsScreen } from './StatsScreen';
import { TitleScreen } from './TitleScreen';

export interface ScreenEntry {
  /** Absent for finished screens; present while the screen is gated. */
  flag?: AppFlagId;
  /** Absent while the screen does not exist yet — the router falls back to Unavailable. */
  component?: ComponentType;
}

export const SCREENS: Record<Screen, ScreenEntry> = {
  title: { component: TitleScreen },
  setup: { component: SetupScreen },
  settings: { component: SettingsScreen },
  stats: { component: StatsScreen },
  help: { component: HelpScreen },
  // Built, but only reachable inside a game, so it rides the same flag as the board.
  pass: { flag: 'gameBoard', component: PassDeviceScreen },
  // Not built yet (M4.3–M4.6 board + HUD + panel, M4.8 end screen).
  game: { flag: 'gameBoard' },
  end: { flag: 'endScreen' },
};

/** The flag gating a screen, or null when the screen is unconditional. */
export function flagForScreen(screen: Screen): AppFlagId | null {
  return SCREENS[screen].flag ?? null;
}
