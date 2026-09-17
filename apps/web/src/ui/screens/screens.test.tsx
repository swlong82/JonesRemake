import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFlags } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { HelpScreen } from './HelpScreen';
import { PassDeviceScreen } from './PassDeviceScreen';
import { buildConfig, defaultSeat, randomSeed, SetupScreen, validateDraft } from './SetupScreen';
import { SettingsScreen } from './SettingsScreen';
import { StatsScreen } from './StatsScreen';
import { TitleScreen } from './TitleScreen';
import { UnavailableScreen } from './UnavailableScreen';

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
  useFlags.getState().reset({ env: {}, search: '' });
});

describe('setup helpers', () => {
  it('rejects an empty seed, a blank name and duplicate colours', () => {
    const seats = [defaultSeat(0, 'human-local', 'You'), defaultSeat(1, 'ai', 'Rival')];
    expect(validateDraft(seats, 'seed')).toBeNull();
    expect(validateDraft(seats, '  ')).toBe('setup.invalid.seed');
    expect(validateDraft([{ ...seats[0]!, name: '' }], 'seed')).toBe('setup.invalid.name');
    expect(validateDraft([seats[0]!, { ...seats[1]!, color: seats[0]!.color }], 'seed')).toBe(
      'setup.invalid.color',
    );
  });

  it('adds an AI rival to a lone human seat unless solo practice is on', () => {
    const solo = [defaultSeat(0, 'human-local', 'You')];
    expect(buildConfig('classic', solo, 's', 'classic', false, false).seats).toHaveLength(2);
    expect(buildConfig('classic', solo, 's', 'classic', false, true).seats).toHaveLength(1);
  });

  it('carries AI difficulty and personality only onto AI seats', () => {
    const cfg = buildConfig(
      'classic',
      [defaultSeat(0, 'human-local', 'You'), defaultSeat(1, 'ai', 'Rival')],
      's',
      'classic',
      true,
      false,
    );
    expect(cfg.seats[0]?.ai).toBeUndefined();
    expect(cfg.seats[1]?.ai).toEqual({ difficulty: 'normal', personality: 'balanced' });
    expect(cfg.classicOpacity).toBe(true);
  });

  it('generates a non-empty random seed', () => {
    expect(randomSeed().length).toBeGreaterThan(0);
    expect(randomSeed()).not.toBe(randomSeed());
  });
});

describe('title screen', () => {
  it('shows the version footer and routes to setup', () => {
    render(<TitleScreen />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hustle Ring');
    expect(screen.getByTestId('version').textContent).toMatch(/Engine \d+\.\d+\.\d+ · schema v1/);
    fireEvent.click(screen.getByTestId('new-game'));
    expect(useGame.getState().screen).toBe('setup');
  });

  it('hides Continue while the board is gated', () => {
    render(<TitleScreen />);
    expect(screen.queryByTestId('continue')).toBeNull();
  });
});

describe('setup screen', () => {
  it('blocks Start while the board flag is off and explains why', () => {
    render(<SetupScreen />);
    expect(screen.getByTestId<HTMLButtonElement>('start-game').disabled).toBe(true);
    expect(screen.getByTestId('board-gated').textContent).toContain('M4.3');
  });

  it('enables Start once the board flag is on', () => {
    useFlags.getState().set('gameBoard', true);
    render(<SetupScreen />);
    expect(screen.getByTestId<HTMLButtonElement>('start-game').disabled).toBe(false);
    expect(screen.queryByTestId('board-gated')).toBeNull();
  });

  it('adds and removes seats up to four', () => {
    render(<SetupScreen />);
    expect(screen.getByTestId('seat-1')).toBeDefined();
    fireEvent.click(screen.getByTestId('add-seat'));
    expect(screen.getByTestId('seat-2')).toBeDefined();
  });

  it('surfaces a validation error for an empty seed', () => {
    render(<SetupScreen />);
    fireEvent.change(screen.getByTestId('seed'), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toContain('Seed');
  });
});

describe('settings screen', () => {
  it('persists a changed setting through the store', () => {
    render(<SettingsScreen />);
    const theme = screen.getByLabelText('Theme');
    fireEvent.change(theme, { target: { value: 'dark' } });
    expect(useSettings.getState().settings.theme).toBe('dark');
  });
});

describe('stats screen', () => {
  it('reads recorded local stats', () => {
    useSettings
      .getState()
      .recordGame({ packId: 'classic', humanWon: true, weeks: 14, netWorth: 7 });
    render(<StatsScreen />);
    expect(screen.getByTestId('games-played').textContent).toBe('1');
    fireEvent.click(screen.getByTestId('back'));
    expect(useGame.getState().screen).toBe('title');
  });
});

describe('help screen', () => {
  it('lists the keyboard map and closes back to the title without a game', () => {
    render(<HelpScreen />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
    fireEvent.click(screen.getByTestId('back'));
    expect(useGame.getState().screen).toBe('title');
  });
});

describe('pass-device screen', () => {
  it('names the next player and hands the device over on Ready', () => {
    useFlags.getState().set('gameBoard', true);
    useGame
      .getState()
      .startGame(
        buildConfig(
          'classic',
          [defaultSeat(0, 'human-local', 'One'), defaultSeat(1, 'human-local', 'Two')],
          'pass-test',
          'classic',
          false,
          false,
        ),
      );
    render(<PassDeviceScreen />);
    expect(screen.getByText('Pass to One')).toBeDefined();
    fireEvent.click(screen.getByTestId('ready'));
    expect(useGame.getState().screen).toBe('game');
  });
});

describe('unavailable screen', () => {
  it('names the feature and the milestone that lands it', () => {
    render(<UnavailableScreen flag="endScreen" />);
    expect(screen.getByTestId('unavailable-milestone').textContent).toContain('M4.8');
    fireEvent.click(screen.getByTestId('unavailable-back'));
    expect(useGame.getState().screen).toBe('title');
  });
});
