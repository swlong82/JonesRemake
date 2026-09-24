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

  it('defaults every flag to its declared value', () => {
    const flags = resolveAppFlags();
    for (const id of APP_FLAG_IDS) expect(flags[id]).toBe(APP_FLAGS[id].default);
    // M7.1 and M7.3 landed audio and the tutorial, so their flags are on; M8.1 landed the
    // leaderboard and deleted its flag (ADR-0017).
    expect(DEFAULT_APP_FLAGS.audio).toBe(true);
    expect(DEFAULT_APP_FLAGS.tutorial).toBe(true);
  });

  it('every flag names the milestone that removes it', () => {
    for (const id of APP_FLAG_IDS) {
      expect(APP_FLAGS[id].milestone).toMatch(/^M\d/);
      expect(APP_FLAGS[id].labelKey.startsWith('flag.')).toBe(true);
    }
  });

  it('reads build env overrides in every accepted spelling', () => {
    expect(envKeyFor('audio')).toBe('VITE_FF_AUDIO');
    const read = (v: string | boolean): boolean =>
      resolveAppFlags({ env: { VITE_FF_AUDIO: v } }).audio;
    expect(read('on')).toBe(true);
    expect(read('true')).toBe(true);
    expect(read('1')).toBe(true);
    expect(read('off')).toBe(false);
    expect(read('0')).toBe(false);
    expect(read(true)).toBe(true);
    // A flag whose milestone has landed defaults on, and the same spellings still turn it off.
    expect(resolveAppFlags({ env: { VITE_FF_TUTORIAL: 'off' } }).tutorial).toBe(false);
    expect(resolveAppFlags({ env: {} }).tutorial).toBe(true);
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
    expect(useFlags.getState().flags.audio).toBe(true);
    useFlags.getState().set('audio', false);
    expect(useFlags.getState().flags.audio).toBe(false);
    useFlags.getState().set('debugTools', true);
    expect(useFlags.getState().flags.debugTools).toBe(false);
    useFlags.getState().reset({ env: {}, search: '' });
    expect(useFlags.getState().flags.audio).toBe(true);
  });
});
