import { beforeEach, describe, expect, it } from 'vitest';
import {
  APP_FLAGS,
  APP_FLAG_IDS,
  DEFAULT_APP_FLAGS,
  envKeyFor,
  parseFlagQuery,
  resolveAppFlags,
  useFlags,
} from './appFlags';

describe('app feature flags', () => {
  beforeEach(() => {
    useFlags.getState().reset({ env: {}, search: '' });
  });

  it('defaults every unfinished feature to off', () => {
    const flags = resolveAppFlags();
    for (const id of APP_FLAG_IDS) expect(flags[id]).toBe(APP_FLAGS[id].default);
    expect(flags.tutorial).toBe(false);
    expect(DEFAULT_APP_FLAGS.leaderboard).toBe(false);
    // M7.1 landed the audio bus, so its flag is on; the flag stays until the milestone is closed.
    expect(DEFAULT_APP_FLAGS.audio).toBe(true);
  });

  it('every flag names the milestone that removes it', () => {
    for (const id of APP_FLAG_IDS) {
      expect(APP_FLAGS[id].milestone).toMatch(/^M\d/);
      expect(APP_FLAGS[id].labelKey.startsWith('flag.')).toBe(true);
    }
  });

  it('reads build env overrides in every accepted spelling', () => {
    expect(envKeyFor('tutorial')).toBe('VITE_FF_TUTORIAL');
    expect(resolveAppFlags({ env: { VITE_FF_TUTORIAL: 'on' } }).tutorial).toBe(true);
    expect(resolveAppFlags({ env: { VITE_FF_TUTORIAL: 'true' } }).tutorial).toBe(true);
    expect(resolveAppFlags({ env: { VITE_FF_TUTORIAL: '1' } }).tutorial).toBe(true);
    expect(resolveAppFlags({ env: { VITE_FF_TUTORIAL: 'off' } }).tutorial).toBe(false);
    expect(resolveAppFlags({ env: { VITE_FF_TUTORIAL: 'nonsense' } }).tutorial).toBe(false);
    expect(resolveAppFlags({ env: { VITE_FF_TUTORIAL: true } }).tutorial).toBe(true);
  });

  it('parses the ff query, with a minus prefix turning a flag off', () => {
    expect(parseFlagQuery('?ff=tutorial,-audio')).toEqual({ tutorial: true, audio: false });
    expect(parseFlagQuery('?ff=audio&ff=tutorial')).toEqual({ audio: true, tutorial: true });
    expect(parseFlagQuery('?ff=')).toEqual({});
    expect(parseFlagQuery('?ff=notAFlag')).toEqual({});
    expect(parseFlagQuery('')).toEqual({});
  });

  it('lets the query override the build env', () => {
    const flags = resolveAppFlags({
      env: { VITE_FF_TUTORIAL: 'on' },
      search: '?ff=-tutorial',
    });
    expect(flags.tutorial).toBe(false);
  });

  it('keeps debug-only flags off unless the build allows debug', () => {
    expect(resolveAppFlags({ search: '?ff=debugTools' }).debugTools).toBe(false);
    expect(
      resolveAppFlags({ env: { VITE_FF_DEBUGTOOLS: 'on' }, search: '?ff=debugTools' }).debugTools,
    ).toBe(false);
    const allowed = resolveAppFlags({
      env: { VITE_DEBUG_ALLOWED: 'true' },
      search: '?ff=debugTools',
    });
    expect(allowed.debugTools).toBe(true);
  });

  it('exposes a store that can flip a non-debug flag and reset', () => {
    expect(useFlags.getState().flags.tutorial).toBe(false);
    useFlags.getState().set('tutorial', true);
    expect(useFlags.getState().flags.tutorial).toBe(true);
    useFlags.getState().set('debugTools', true);
    expect(useFlags.getState().flags.debugTools).toBe(false);
    useFlags.getState().reset({ env: {}, search: '' });
    expect(useFlags.getState().flags.tutorial).toBe(false);
  });
});
