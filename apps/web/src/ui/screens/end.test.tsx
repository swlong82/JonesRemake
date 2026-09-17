import { fireEvent, render, screen } from '@testing-library/react';
import type { GameConfig } from '@hustle-ring/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { GoalChart, chartPoints } from '../game/GoalChart';
import { EndScreen, replayJson } from './EndScreen';
import { buildConfig, defaultSeat } from './SetupScreen';

function config(): GameConfig {
  return buildConfig(
    'classic',
    [defaultSeat(0, 'human-local', 'You'), defaultSeat(1, 'ai', 'Rival')],
    'end-test',
    'classic',
    false,
    false,
  );
}

/** Finish the game without playing it: a winner plus a little recorded history. */
function finish(): void {
  useGame.getState().startGame(config());
  const state = useGame.getState().state!;
  const players = state.players.map((p, i) => ({
    ...p,
    history: [
      { week: 1, goals: [0, 10, 0, 0] as [number, number, number, number] },
      { week: 2, goals: [5, 20, 10, 5 * i] as [number, number, number, number] },
    ],
    stats: { ...p.stats, earned: 1234 + i, eventsSuffered: i, highestWage: 9 },
  }));
  useGame.setState({ state: { ...state, players, winner: 0, week: 2 }, screen: 'end' });
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

describe('goal chart (M4.8)', () => {
  it('maps history into polyline points inside the plot area', () => {
    const points = chartPoints(
      [
        { week: 1, goals: [0, 0, 0, 0] },
        { week: 4, goals: [100, 0, 0, 0] },
      ],
      0,
      4,
    );
    const pairs = points.split(' ').map((p) => p.split(',').map(Number));
    expect(pairs).toHaveLength(2);
    expect(pairs[0]![1]).toBeGreaterThan(pairs[1]![1]!);
    expect(chartPoints([], 0, 10)).toBe('');
  });

  it('draws a line per player and goal with a distinct dash pattern', () => {
    finish();
    render(<GoalChart state={useGame.getState().state!} />);
    expect(screen.getByTestId('goal-chart')).toBeDefined();
    expect(screen.getByTestId('chart-0-wealth')).toBeDefined();
    expect(screen.getByTestId('chart-1-career')).toBeDefined();
    const wealth = screen.getByTestId('chart-0-wealth').getAttribute('stroke-dasharray');
    const happiness = screen.getByTestId('chart-0-happiness').getAttribute('stroke-dasharray');
    expect(wealth).not.toBe(happiness);
  });
});

describe('end screen (GDD 4.16)', () => {
  it('names the winner, the week and each player key stat', () => {
    finish();
    render(<EndScreen />);
    expect(screen.getByTestId('end-heading').textContent).toContain('You wins in week 2');
    const row = screen.getByTestId('end-row-0');
    expect(row.textContent).toContain('1234');
    expect(screen.getByTestId('end-stats')).toBeDefined();
  });

  it('offers rematch with a new seed, a new game and the title', () => {
    finish();
    const seed = useGame.getState().state!.config.seed;
    render(<EndScreen />);
    fireEvent.click(screen.getByTestId('rematch'));
    expect(useGame.getState().state?.config.seed).not.toBe(seed);
    expect(useGame.getState().screen).toBe('game');
  });

  it('exports a replay of config plus the command log', () => {
    finish();
    const json = JSON.parse(replayJson(useGame.getState().state!)) as {
      config: GameConfig;
      log: unknown[];
      winner: number;
    };
    expect(json.config.seed).toBe('end-test');
    expect(Array.isArray(json.log)).toBe(true);
    expect(json.winner).toBe(0);
    render(<EndScreen />);
    fireEvent.click(screen.getByTestId('end-export'));
    fireEvent.click(screen.getByTestId('end-new-game'));
    expect(useGame.getState().screen).toBe('setup');
  });
});
