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

  it('shows the Unavailable screen for a gated screen that is not built yet', () => {
    useGame.getState().go('game');
    render(<App />);
    expect(screen.getByTestId('unavailable')).toBeDefined();
    expect(screen.getByTestId('unavailable-milestone').textContent).toContain('M4.3');
  });

  it('still shows Unavailable for the board when the flag is on but no component is registered', () => {
    useFlags.getState().set('gameBoard', true);
    useGame.getState().go('game');
    render(<App />);
    expect(screen.getByTestId('unavailable')).toBeDefined();
  });

  it('renders a gated screen that is built once its flag is on', () => {
    useFlags.getState().set('gameBoard', true);
    useGame.getState().go('pass');
    render(<App />);
    expect(screen.queryByTestId('unavailable')).toBeNull();
    expect(screen.getByTestId('ready')).toBeDefined();
  });

  it('offers a skip link to the main landmark', () => {
    render(<App />);
    expect(screen.getByText('Skip to content').getAttribute('href')).toBe('#main');
    expect(document.getElementById('main')).not.toBeNull();
  });
});

describe('screen registry', () => {
  it('gates exactly the screens that are still unfinished', () => {
    expect(flagForScreen('title')).toBeNull();
    expect(flagForScreen('game')).toBe('gameBoard');
    expect(flagForScreen('end')).toBe('endScreen');
    expect(SCREENS.game.component).toBeUndefined();
    expect(SCREENS.end.component).toBeUndefined();
    expect(SCREENS.title.component).toBeDefined();
  });
});
