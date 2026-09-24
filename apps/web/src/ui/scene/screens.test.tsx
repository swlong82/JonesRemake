import { act, fireEvent, render, screen } from '@testing-library/react';
import type { DomainEvent } from '@hustle-ring/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFlags } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { EventCards } from '../game/EventCards';
import { GameScreen } from '../screens/GameScreen';
import { buildConfig, defaultSeat, SetupScreen } from '../screens/SetupScreen';
import { TitleScreen } from '../screens/TitleScreen';
import { weekendEvent } from './WeekendRecap';

function fired(eventId: string): DomainEvent {
  return { type: 'EventFired', seat: 0, eventId, effects: ['stat:happiness:2'], seq: 1, week: 1 };
}

beforeEach(() => {
  useGame.getState().quit();
  useSettings.getState().resetData();
  useFlags.getState().set('sceneUi', true);
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  useGame
    .getState()
    .startGame(
      buildConfig(
        'classic',
        [defaultSeat(0, 'human-local', 'Ann')],
        'm910',
        'classic',
        false,
        true,
      ),
    );
});
afterEach(() => useFlags.getState().reset({ env: {}, search: '' }));

describe('weekend recap (ART_SPEC 17.9, M9.10)', () => {
  it('maps weekend events to a mood and ignores other cards', () => {
    const pack = useGame.getState().pack!;
    expect(weekendEvent(fired('night-out'), pack)).toEqual({ id: 'night-out', mood: 'positive' });
    expect(weekendEvent(fired('parking-fine'), pack)?.mood).toBe('negative');
    expect(weekendEvent(fired('laundromat'), pack)?.mood).toBe('neutral');
    expect(weekendEvent(fired('boom-news'), pack)).toBeNull();
    expect(weekendEvent({ type: 'Starved', seat: 0, seq: 1, week: 1 }, pack)).toBeNull();
  });

  it('shows the scene and the avatar mood on a weekend card', () => {
    useGame.setState({ cards: [fired('parking-fine')] });
    render(<EventCards />);
    const recap = screen.getByTestId('weekend-recap');
    expect(recap.dataset.mood).toBe('negative');
    expect(recap.querySelector('img')!.dataset.artKey).toBe('weekend:negative');
    expect(screen.getByTestId('weekend-avatar').dataset.artKey).toBe('avatar:player-1:slump:s');
    expect(screen.getByTestId('event-title').textContent).not.toBe('');
  });

  it('keeps plain cards without the flag', () => {
    useFlags.getState().set('sceneUi', false);
    useGame.setState({ cards: [fired('night-out')] });
    render(<EventCards />);
    expect(screen.queryByTestId('weekend-recap')).toBeNull();
  });
});

describe('newspaper (M9.10)', () => {
  it('opens only once this week’s paper is bought, with the hinted headline', () => {
    useGame.getState().dispatch({ type: 'Exit' });
    render(<GameScreen />);
    expect(screen.queryByTestId('newspaper-btn')).toBeNull();
    act(() => {
      useGame.getState().debugPatch((s) => {
        s.players[0]!.newsHintWeek = s.week;
      });
    });
    fireEvent.click(screen.getByTestId('newspaper-btn'));
    const phase = useGame.getState().state!.news.phaseHint;
    expect(screen.getByTestId('newspaper')).toBeDefined();
    expect(screen.getByTestId('news-headline').textContent).toBe(
      {
        boom: 'Boom times: hiring signs everywhere',
        stable: 'Steady as she goes, say the experts',
        recession: 'Belts tighten as the city slows down',
      }[phase],
    );
    fireEvent.click(screen.getByTestId('newspaper-close'));
    expect(screen.queryByTestId('newspaper')).toBeNull();
  });
});

describe('title and setup art (M9.10)', () => {
  it('puts key art behind the title menu and a banner on setup', () => {
    const { unmount } = render(<TitleScreen />);
    expect(
      screen.getByTestId('title-art').querySelector('img[data-art-key="ui:title"]'),
    ).not.toBeNull();
    expect(screen.getByTestId('new-game')).toBeDefined();
    unmount();
    render(<SetupScreen />);
    expect(screen.getByTestId('setup-art').dataset.artKey).toBe('ui:setup');
  });

  it('leaves both screens plain without the flag', () => {
    useFlags.getState().set('sceneUi', false);
    render(<TitleScreen />);
    expect(screen.queryByTestId('title-art')).toBeNull();
  });
});
