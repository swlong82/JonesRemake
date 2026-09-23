/** M8.1: leaderboard entries, submission from the end screen, and the Stats board by scope. */
import { loadPack } from '@hustle-ring/content';
import { createGame } from '@hustle-ring/engine';
import { createLocalServices, LocalLeaderboard, type ScoreEntry } from '@hustle-ring/platform';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ServicesProvider } from '../platform/Services';
import { useGame } from '../store/gameStore';
import { useSettings } from '../store/settings';
import { EndScreen } from '../ui/screens/EndScreen';
import { StatsScreen } from '../ui/screens/StatsScreen';
import { gameKey, leaderboardEntry, localPlayerId } from './entry';

const pack = loadPack('classic');

function finished(winnerController: 'human-local' | 'ai', debugTouched = false) {
  const s = createGame(
    {
      packId: 'classic',
      seed: `lb-${winnerController}-${debugTouched}`,
      chaos: 'classic',
      classicOpacity: false,
      seats: [
        {
          name: 'Ada',
          controller: winnerController,
          color: 'p1',
          shape: 'circle',
          goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
          ...(winnerController === 'ai'
            ? { ai: { difficulty: 'normal' as const, personality: 'balanced' } }
            : {}),
        },
        {
          name: 'Rival',
          controller: 'ai',
          color: 'p2',
          shape: 'square',
          goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
          ai: { difficulty: 'hard', personality: 'balanced' },
        },
      ],
    },
    pack,
  );
  return { ...s, winner: 0, phase: 'over' as const, week: 42, debugTouched };
}

function withBoard(board = new LocalLeaderboard()) {
  const services = {
    ...createLocalServices({ newId: () => 'id', platform: { open: () => undefined } }),
    leaderboard: board,
  };
  return {
    board,
    wrap: (ui: React.ReactNode) => <ServicesProvider services={services}>{ui}</ServicesProvider>,
  };
}

const entry = (name: string, score: number, packId: string, finishedAt: string): ScoreEntry => ({
  playerId: localPlayerId(name),
  displayName: name,
  packId,
  packVersion: '0.2.0',
  engineVersion: '0.2.0',
  scoringVersion: 1,
  seed: 's',
  weeks: 40,
  score,
  finishedAt,
  verified: false,
});

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

describe('leaderboard entry (16.7)', () => {
  it('builds an unverified entry for a human winner, with the engine score', () => {
    const s = finished('human-local');
    const e = leaderboardEntry(s, pack, '2026-09-23T00:00:00Z');
    expect(e).toMatchObject({
      playerId: 'local:ada',
      displayName: 'Ada',
      packId: 'classic',
      weeks: 42,
      scoringVersion: pack.rules.scoring.version,
      verified: false,
    });
    expect(e!.score).toBeGreaterThan(0);
  });

  it('posts nothing for an AI winner or a game a debug switch touched', () => {
    expect(leaderboardEntry(finished('ai'), pack, 'x')).toBeNull();
    expect(leaderboardEntry(finished('human-local', true), pack, 'x')).toBeNull();
    expect(leaderboardEntry({ ...finished('human-local'), winner: null }, pack, 'x')).toBeNull();
  });
});

describe('end screen submission', () => {
  it('submits the winner once and shows the local rank with the unverified badge', async () => {
    const { board, wrap } = withBoard();
    const s = finished('human-local');
    useGame.setState({ state: s, screen: 'end' });
    const view = render(wrap(<EndScreen />));
    await waitFor(() => expect(screen.getByTestId('end-score').textContent).toMatch(/1 of 1/));
    expect(screen.getByTestId('end-score').textContent).toContain('Not verified');
    // A remount of the same finished game does not post it again.
    view.unmount();
    render(wrap(<EndScreen />));
    await act(() => Promise.resolve());
    expect((await board.query('global', { offset: 0, limit: 10 })).total).toBe(1);
    expect(gameKey(s)).toContain(s.config.seed);
  });
});

describe('stats board', () => {
  it('lists entries per scope and says when a view is empty', async () => {
    const now = new Date().toISOString();
    const { board, wrap } = withBoard();
    await board.submit(entry('Ada', 900, 'classic', now));
    await board.submit(entry('Bo', 700, 'modern-western', now));
    await board.submit(entry('Cy', 800, 'classic', '2020-01-01T00:00:00Z'));
    render(wrap(<StatsScreen />));
    const names = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.children[1]!.textContent);
    await waitFor(() => expect(names()).toEqual(['Ada', 'Cy', 'Bo']));
    expect(screen.getByTestId('lb-badge').textContent).toBe('Not verified — local only');
    fireEvent.change(screen.getByTestId('lb-scope'), { target: { value: 'season' } });
    await waitFor(() => expect(names()).toEqual(['Ada', 'Bo']));
    fireEvent.change(screen.getByTestId('lb-scope'), { target: { value: 'packSeason' } });
    fireEvent.change(screen.getByTestId('lb-city'), { target: { value: 'classic' } });
    await waitFor(() => expect(names()).toEqual(['Ada']));
    fireEvent.change(screen.getByTestId('lb-city'), { target: { value: 'modern-western' } });
    await waitFor(() => expect(names()).toEqual(['Bo']));
    fireEvent.change(screen.getByTestId('lb-scope'), { target: { value: 'pack' } });
    fireEvent.change(screen.getByTestId('lb-city'), { target: { value: 'classic' } });
    await waitFor(() => expect(names()).toEqual(['Ada', 'Cy']));
  });

  it('shows the empty message on a fresh device', async () => {
    const { wrap } = withBoard();
    render(wrap(<StatsScreen />));
    await waitFor(() => expect(screen.getByTestId('lb-empty')).toBeTruthy());
  });
});
