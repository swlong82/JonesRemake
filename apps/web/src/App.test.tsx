import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { useFlags } from './flags/appFlags';
import { useGame } from './store/gameStore';
import { useSettings } from './store/settings';
import { SCREENS, flagForScreen } from './ui/screens/registry';

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
  useFlags.getState().reset({ env: {}, search: '' });
});

describe('<App /> router', () => {
  it('opens on the title screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hustle Ring');
    expect(screen.getByTestId('version')).toBeDefined();
  });

  it('renders each ungated screen', () => {
    for (const s of ['setup', 'settings', 'stats', 'help'] as const) {
      useGame.getState().go(s);
      const { unmount } = render(<App />);
      expect(screen.queryByTestId('unavailable')).toBeNull();
      unmount();
    }
  });

  it('falls back to the Unavailable screen while a registered screen is gated off', () => {
    const original = SCREENS.stats;
    SCREENS.stats = { flag: 'tutorial', ...original };
    try {
      useGame.getState().go('stats');
      render(<App />);
      expect(screen.getByTestId('unavailable')).toBeDefined();
      expect(screen.getByTestId('unavailable-milestone').textContent).toContain('M7.3');
    } finally {
      SCREENS.stats = original;
    }
  });

  it('renders a gated screen once its flag is on', () => {
    const original = SCREENS.stats;
    SCREENS.stats = { flag: 'tutorial', ...original };
    try {
      useFlags.getState().set('tutorial', true);
      useGame.getState().go('stats');
      render(<App />);
      expect(screen.queryByTestId('unavailable')).toBeNull();
      expect(screen.getByTestId('games-played')).toBeDefined();
    } finally {
      SCREENS.stats = original;
    }
  });

  it('offers a skip link to the main landmark', () => {
    render(<App />);
    expect(screen.getByText('Skip to content').getAttribute('href')).toBe('#main');
    expect(document.getElementById('main')).not.toBeNull();
  });
});

describe('screen registry', () => {
  it('has a component for every screen and gates none of them (M4 complete)', () => {
    for (const [name, entry] of Object.entries(SCREENS)) {
      expect(entry.component, name).toBeDefined();
      expect(entry.flag, name).toBeUndefined();
    }
    expect(flagForScreen('title')).toBeNull();
    expect(flagForScreen('game')).toBeNull();
  });
});
