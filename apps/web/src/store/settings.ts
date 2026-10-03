/**
 * Player settings (UX_SPEC 7.1 Settings) and local stats, persisted in localStorage. No cookies,
 * no network. Game saves use the platform SaveStore; settings continue to use localStorage.
 */
import { create } from 'zustand';

export type Theme = 'system' | 'light' | 'dark';
export type TextScale = 100 | 125 | 150;
export type AiSpeed = 'instant' | 'fast' | 'normal';
/** How many action results get a pop-up of their own (M13.2). */
export type Popups = 'important' | 'all' | 'off';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  textScale: TextScale;
  theme: Theme;
  aiSpeed: AiSpeed;
  classicOpacityDefault: boolean;
  language: 'en' | 'pseudo';
  tutorialSeen: boolean;
  /** Show the next-step hint in the location panel (M11.5). */
  hints: boolean;
  /** Slide in the weekly Daily Hustle headline at the start of each turn. */
  newsFlash: boolean;
  /** Double-click or double-tap a place to travel there without the sheet (M13.1). */
  quickTravel: boolean;
  /** Outcome pop-up density (M13.2). */
  popups: Popups;
  /** Coach marks for systems the tutorial does not cover (M12.4). */
  coach: boolean;
  /** Feature tips already shown, by id (M12.4). */
  coachSeen: string[];
  /** Turns off undo for a stricter game (M12.2). */
  strictMode: boolean;
  /** Short vibration on success or failure on devices that support it (M12.8). */
  haptics: boolean;
  /** Active art set: bundled Modern, original art, or an imported pack's id. */
  artSet: string;
  /** Distinguishes saved choices from before bundled Modern was introduced. */
  artSelectionVersion: 1;
}

export interface LocalStats {
  gamesPlayed: number;
  winsByPack: Record<string, number>;
  fastestWinWeeks: number | null;
  highestNetWorth: number;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  reducedMotion: false,
  textScale: 100,
  theme: 'system',
  aiSpeed: 'fast',
  classicOpacityDefault: false,
  language: 'en',
  tutorialSeen: false,
  hints: true,
  newsFlash: true,
  quickTravel: true,
  popups: 'important',
  coach: true,
  coachSeen: [],
  strictMode: false,
  haptics: true,
  artSet: 'modern',
  artSelectionVersion: 1,
};

export const DEFAULT_STATS: LocalStats = {
  gamesPlayed: 0,
  winsByPack: {},
  fastestWinWeeks: null,
  highestNetWorth: 0,
};

const SETTINGS_KEY = 'hustle-ring:settings';
const STATS_KEY = 'hustle-ring:stats';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) — settings stay in memory */
  }
}

export function readSettings(): Settings {
  const saved = read(SETTINGS_KEY, DEFAULT_SETTINGS);
  let current = false;
  try {
    const raw = globalThis.localStorage.getItem(SETTINGS_KEY);
    current = raw !== null && (JSON.parse(raw) as Partial<Settings>).artSelectionVersion === 1;
  } catch {
    // Invalid or unavailable storage uses the bundled Modern defaults.
  }
  if (current) return saved;
  // With no saved settings this is a fresh profile, already on Modern.
  try {
    if (globalThis.localStorage.getItem(SETTINGS_KEY) === null) return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
  // The old app offered only original art by default. An explicit imported `modern` pack used
  // the same id that is now bundled, so keep it under a separate choice.
  const settings: Settings = {
    ...saved,
    artSet:
      saved.artSet === 'default'
        ? 'modern'
        : saved.artSet === 'modern'
          ? '@imported-modern'
          : saved.artSet,
    artSelectionVersion: 1,
  };
  write(SETTINGS_KEY, settings);
  return settings;
}

export interface SettingsStore {
  settings: Settings;
  stats: LocalStats;
  update: (patch: Partial<Settings>) => void;
  recordGame: (result: {
    packId: string;
    humanWon: boolean;
    weeks: number;
    netWorth: number;
  }) => void;
  resetData: () => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: readSettings(),
  stats: read(STATS_KEY, DEFAULT_STATS),
  update(patch) {
    const settings = { ...get().settings, ...patch };
    write(SETTINGS_KEY, settings);
    set({ settings });
  },
  recordGame({ packId, humanWon, weeks, netWorth }) {
    const s = get().stats;
    const stats: LocalStats = {
      gamesPlayed: s.gamesPlayed + 1,
      winsByPack: humanWon
        ? { ...s.winsByPack, [packId]: (s.winsByPack[packId] ?? 0) + 1 }
        : s.winsByPack,
      fastestWinWeeks: humanWon
        ? Math.min(s.fastestWinWeeks ?? Infinity, weeks)
        : s.fastestWinWeeks,
      highestNetWorth: Math.max(s.highestNetWorth, netWorth),
    };
    write(STATS_KEY, stats);
    set({ stats });
  },
  resetData() {
    try {
      globalThis.localStorage.removeItem(SETTINGS_KEY);
      globalThis.localStorage.removeItem(STATS_KEY);
    } catch {
      /* ignore */
    }
    set({ settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS });
  },
}));

/**
 * Apply theme, text scale and language to the document root (CSS variables drive the rest).
 * `lang` matters to assistive technology and to the pseudo-locale check (M7.5).
 */
export function applyDocumentSettings(s: Settings): void {
  // Guarded for non-DOM hosts (the sim and unit tests import this module).
  if (typeof globalThis.document === 'undefined') return;
  const root = globalThis.document.documentElement;
  root.dataset.theme = s.theme;
  root.style.fontSize = `${s.textScale}%`;
  root.dataset.reducedMotion = s.reducedMotion ? 'true' : 'false';
  root.lang = s.language === 'pseudo' ? 'en-XA' : 'en';
}
