/**
 * App feature flags — build-stage gating for the web app (CLAUDE.md 1.5).
 *
 * These are NOT the CityPack feature flags of EXTENSIBILITY 12.4 (`transport`, `wellbeing`, …),
 * which gate *rules* per ruleset and live in content. App flags gate *screens and UI surfaces*
 * that are specified but not built yet, so an unfinished milestone can ship dark on `main`
 * instead of blocking the branch. Every flag names the milestone that removes it.
 *
 * Resolution order (last wins):
 *   1. registry default
 *   2. build env `VITE_FF_<ID>` = on|off|true|false|1|0
 *   3. URL query `?ff=audio,-tutorial` (`-` prefix turns a flag off)
 *
 * Flags marked `debugOnly` additionally require `VITE_DEBUG_ALLOWED === 'true'` (UX_SPEC 7.9);
 * without it they stay off however they are requested, so debug surfaces cannot be switched on in
 * a deployed build.
 */
import { create } from 'zustand';

export const APP_FLAG_IDS = ['debugTools', 'tutorial', 'audio', 'leaderboard'] as const;

export type AppFlagId = (typeof APP_FLAG_IDS)[number];
export type AppFlags = Record<AppFlagId, boolean>;

export interface AppFlagSpec {
  id: AppFlagId;
  /** Value when nothing overrides it. Unfinished work ships off. */
  default: boolean;
  /** Milestone that implements the feature and deletes the flag. */
  milestone: string;
  /** i18n key describing the feature to the player. */
  labelKey: string;
  /** Requires `VITE_DEBUG_ALLOWED=true` to be switchable at all. */
  debugOnly?: boolean;
}

export const APP_FLAGS: Record<AppFlagId, AppFlagSpec> = {
  debugTools: {
    id: 'debugTools',
    default: false,
    milestone: 'M4.6',
    labelKey: 'flag.debugTools',
    debugOnly: true,
  },
  tutorial: { id: 'tutorial', default: false, milestone: 'M7.3', labelKey: 'flag.tutorial' },
  // M7.1 landed the bus, the recipes and the moods, so audio is on by default now.
  audio: { id: 'audio', default: true, milestone: 'M7.1', labelKey: 'flag.audio' },
  leaderboard: {
    id: 'leaderboard',
    default: false,
    milestone: 'M8.1',
    labelKey: 'flag.leaderboard',
  },
};

export const DEFAULT_APP_FLAGS: AppFlags = Object.fromEntries(
  APP_FLAG_IDS.map((id) => [id, APP_FLAGS[id].default]),
) as AppFlags;

/** Env shape used for resolution; `import.meta.env` satisfies it. */
export interface FlagEnv {
  VITE_DEBUG_ALLOWED?: string | undefined;
  [key: string]: string | boolean | undefined;
}

function parseBool(raw: string | boolean | undefined): boolean | null {
  if (raw === undefined) return null;
  if (typeof raw === 'boolean') return raw;
  const v = raw.trim().toLowerCase();
  if (v === 'on' || v === 'true' || v === '1') return true;
  if (v === 'off' || v === 'false' || v === '0') return false;
  return null;
}

/** `VITE_FF_TUTORIAL` — upper-cased flag id, so env keys stay shell-safe. */
export function envKeyFor(id: AppFlagId): string {
  return `VITE_FF_${id.toUpperCase()}`;
}

/** Parse `?ff=audio,-tutorial` into explicit on/off requests. */
export function parseFlagQuery(search: string): Partial<AppFlags> {
  const out: Partial<AppFlags> = {};
  const params = new URLSearchParams(search);
  for (const value of params.getAll('ff')) {
    for (const part of value.split(',')) {
      const token = part.trim();
      if (token.length === 0) continue;
      const off = token.startsWith('-');
      const id = (off ? token.slice(1) : token) as AppFlagId;
      if ((APP_FLAG_IDS as readonly string[]).includes(id)) out[id] = !off;
    }
  }
  return out;
}

export interface ResolveInput {
  env?: FlagEnv;
  search?: string;
}

export function resolveAppFlags({ env = {}, search = '' }: ResolveInput = {}): AppFlags {
  const debugAllowed = parseBool(env.VITE_DEBUG_ALLOWED) ?? false;
  const fromQuery = parseFlagQuery(search);
  const out = { ...DEFAULT_APP_FLAGS };
  for (const id of APP_FLAG_IDS) {
    const spec = APP_FLAGS[id];
    const fromEnv = parseBool(env[envKeyFor(id)]);
    let value = spec.default;
    if (fromEnv !== null) value = fromEnv;
    const q = fromQuery[id];
    if (q !== undefined) value = q;
    out[id] = spec.debugOnly && !debugAllowed ? false : value;
  }
  return out;
}

export interface FlagStore {
  flags: AppFlags;
  /** Override one flag (debug panel, tests). Ignores debug-only flags in a non-debug build. */
  set: (id: AppFlagId, on: boolean) => void;
  reset: (input?: ResolveInput) => void;
}

function buildEnv(): FlagEnv {
  return import.meta.env;
}

function initialInput(): ResolveInput {
  const loc = globalThis.location as Location | undefined;
  return { env: buildEnv(), search: loc ? loc.search : '' };
}

export const useFlags = create<FlagStore>((set) => ({
  flags: resolveAppFlags(initialInput()),
  set(id, on) {
    set((s) => {
      const debugAllowed = parseBool(buildEnv().VITE_DEBUG_ALLOWED);
      if (APP_FLAGS[id].debugOnly && debugAllowed !== true) return s;
      return { flags: { ...s.flags, [id]: on } };
    });
  },
  reset(input) {
    set({ flags: resolveAppFlags(input ?? initialInput()) });
  },
}));

/** Read one flag reactively. */
export function useAppFlag(id: AppFlagId): boolean {
  return useFlags((s) => s.flags[id]);
}
