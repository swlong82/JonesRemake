import { beforeEach, describe, expect, it } from 'vitest';
import { applyDocumentSettings, DEFAULT_SETTINGS, DEFAULT_STATS, useSettings } from './settings';

describe('settings store', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    useSettings.getState().resetData();
  });

  it('starts from the documented defaults', () => {
    expect(useSettings.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(useSettings.getState().stats).toEqual(DEFAULT_STATS);
  });

  it('persists an updated setting to localStorage', () => {
    useSettings.getState().update({ theme: 'dark', textScale: 125 });
    expect(useSettings.getState().settings.theme).toBe('dark');
    const raw = globalThis.localStorage.getItem('hustle-ring:settings');
    expect(raw).toContain('dark');
  });

  it('records wins, fastest week and highest net worth', () => {
    useSettings.getState().recordGame({
      packId: 'classic',
      humanWon: true,
      weeks: 22,
      netWorth: 5000,
    });
    useSettings.getState().recordGame({
      packId: 'classic',
      humanWon: false,
      weeks: 10,
      netWorth: 900,
    });
    const s = useSettings.getState().stats;
    expect(s.gamesPlayed).toBe(2);
    expect(s.winsByPack.classic).toBe(1);
    expect(s.fastestWinWeeks).toBe(22);
    expect(s.highestNetWorth).toBe(5000);
  });

  it('clears everything on reset', () => {
    useSettings.getState().update({ muted: true });
    useSettings.getState().resetData();
    expect(useSettings.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(globalThis.localStorage.getItem('hustle-ring:settings')).toBeNull();
  });

  it('writes theme, text scale and reduced motion onto the document root', () => {
    applyDocumentSettings({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      textScale: 150,
      reducedMotion: true,
    });
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.fontSize).toBe('150%');
    expect(root.dataset.reducedMotion).toBe('true');
  });
});
