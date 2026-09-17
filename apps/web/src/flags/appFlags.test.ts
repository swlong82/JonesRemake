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
    expect(flags.gameBoard).toBe(false);
    expect(DEFAULT_APP_FLAGS.endScreen).toBe(false);
  });

  it('every flag names the milestone that removes it', () => {
    for (const id of APP_FLAG_IDS) {
      expect(APP_FLAGS[id].milestone).toMatch(/^M\d/);
      expect(APP_FLAGS[id].labelKey.startsWith('flag.')).toBe(true);
    }
  });

  it('reads build env overrides in every accepted spelling', () => {
    expect(envKeyFor('gameBoard')).toBe('VITE_FF_GAMEBOARD');
    expect(resolveAppFlags({ env: { VITE_FF_GAMEBOARD: 'on' } }).gameBoard).toBe(true);
    expect(resolveAppFlags({ env: { VITE_FF_GAMEBOARD: 'true' } }).gameBoard).toBe(true);
    expect(resolveAppFlags({ env: { VITE_FF_GAMEBOARD: '1' } }).gameBoard).toBe(true);
    expect(resolveAppFlags({ env: { VITE_FF_GAMEBOARD: 'off' } }).gameBoard).toBe(false);
    expect(resolveAppFlags({ env: { VITE_FF_GAMEBOARD: 'nonsense' } }).gameBoard).toBe(false);
    expect(resolveAppFlags({ env: { VITE_FF_GAMEBOARD: true } }).gameBoard).toBe(true);
  });

  it('parses the ff query, with a minus prefix turning a flag off', () => {
    expect(parseFlagQuery('?ff=gameBoard,-endScreen')).toEqual({
      gameBoard: true,
      endScreen: false,
    });
    expect(parseFlagQuery('?ff=gameBoard&ff=saves')).toEqual({ gameBoard: true, saves: true });
    expect(parseFlagQuery('?ff=')).toEqual({});
    expect(parseFlagQuery('?ff=notAFlag')).toEqual({});
    expect(parseFlagQuery('')).toEqual({});
  });

  it('lets the query override the build env', () => {
    const flags = resolveAppFlags({
      env: { VITE_FF_GAMEBOARD: 'on' },
      search: '?ff=-gameBoard',
    });
    expect(flags.gameBoard).toBe(false);
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
    expect(useFlags.getState().flags.gameBoard).toBe(false);
    useFlags.getState().set('gameBoard', true);
    expect(useFlags.getState().flags.gameBoard).toBe(true);
    useFlags.getState().set('debugTools', true);
    expect(useFlags.getState().flags.debugTools).toBe(false);
    useFlags.getState().reset({ env: {}, search: '' });
    expect(useFlags.getState().flags.gameBoard).toBe(false);
  });
});
