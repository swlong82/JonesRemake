import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlags } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { useWalker } from './Avatars';
import { avatarIdFor, FRAME_MS, facing, frameAt, STEP_MS, walkDuration, walkRoute } from './walk';

const square = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 100, y: 0 }));

describe('walk math (ART_SPEC 17.9)', () => {
  it('takes the short way round, clockwise on a tie', () => {
    expect(walkRoute(16, 0, 3)).toEqual([0, 1, 2, 3]);
    expect(walkRoute(16, 1, 14)).toEqual([1, 0, 15, 14]);
    expect(walkRoute(16, 0, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(walkRoute(16, 5, 5)).toEqual([5]);
    expect(walkRoute(0, 0, 0)).toEqual([0]);
  });

  it('lasts in proportion to the squares walked', () => {
    expect(walkDuration([0])).toBe(0);
    expect(walkDuration(walkRoute(16, 0, 2))).toBe(2 * STEP_MS);
    expect(walkDuration(walkRoute(16, 0, 6))).toBe(3 * walkDuration(walkRoute(16, 0, 2)));
  });

  it('faces the direction of travel', () => {
    expect(facing({ x: 0, y: 0 }, { x: 10, y: 2 })).toBe('e');
    expect(facing({ x: 0, y: 0 }, { x: -10, y: 2 })).toBe('w');
    expect(facing({ x: 0, y: 0 }, { x: 1, y: 10 })).toBe('s');
    expect(facing({ x: 0, y: 0 }, { x: 1, y: -10 })).toBe('n');
  });

  it('interpolates along the path and alternates walk frames', () => {
    const path = square(4);
    const route = walkRoute(4, 0, 1);
    expect(frameAt(route, path, 0)).toEqual({
      point: { x: 0, y: 0 },
      dir: 'e',
      pose: 'walk1',
      done: false,
    });
    const mid = frameAt(route, path, STEP_MS / 2);
    expect(mid.point.x).toBeCloseTo(50);
    expect(frameAt(route, path, FRAME_MS).pose).toBe('walk2');
    expect(frameAt(route, path, STEP_MS)).toEqual({
      point: { x: 100, y: 0 },
      dir: 's',
      pose: 'idle',
      done: true,
    });
  });

  it('picks the chosen, rival or per-seat avatar', () => {
    const seat = defaultSeat(0, 'human-local', 'A');
    expect(avatarIdFor({ ...seat, avatar: 'player-4' }, 0)).toBe('player-4');
    expect(avatarIdFor(seat, 7)).toBe('player-2');
    expect(avatarIdFor({ ...seat, ai: { difficulty: 'hard', personality: 'grinder' } }, 1)).toBe(
      'rival-grinder',
    );
    expect(avatarIdFor(undefined, 0)).toBe('player-1');
  });
});

describe('useWalker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const path = square(16);

  it('walks square by square, then stands idle facing the viewer', () => {
    const { result, rerender } = renderHook(({ node }) => useWalker(node, path, false), {
      initialProps: { node: 0 },
    });
    expect(result.current.pose).toBe('idle');
    rerender({ node: 3 });
    expect(result.current.pose).toBe('walk1');
    act(() => {
      vi.advanceTimersByTime(STEP_MS * 1.5);
    });
    expect(result.current.done).toBe(false);
    expect(result.current.point.x).toBeGreaterThan(100);
    expect(result.current.point.x).toBeLessThan(200);
    act(() => {
      vi.advanceTimersByTime(STEP_MS * 2);
    });
    expect(result.current).toMatchObject({
      point: { x: 300, y: 0 },
      pose: 'idle',
      dir: 's',
      done: true,
    });
  });

  it('jumps without intermediate frames under reduced motion', () => {
    const { result, rerender } = renderHook(({ node }) => useWalker(node, path, true), {
      initialProps: { node: 0 },
    });
    rerender({ node: 5 });
    expect(result.current).toMatchObject({ point: { x: 500, y: 0 }, pose: 'idle', done: true });
  });
});

describe('avatar in setup and config (ART_SPEC 17.3)', () => {
  beforeEach(() => {
    useGame.getState().quit();
    useSettings.getState().resetData();
  });
  afterEach(() => useFlags.getState().reset({ env: {}, search: '' }));

  it('records only a chosen avatar, and never for an AI seat', () => {
    const human = { ...defaultSeat(0, 'human-local', 'A'), avatar: 'player-5' };
    const ai = { ...defaultSeat(1, 'ai', 'B'), avatar: 'player-6' };
    const cfg = buildConfig('classic', [human, ai], 's', 'classic', false, false);
    expect(cfg.seats[0]!.avatar).toBe('player-5');
    expect(cfg.seats[1]!.avatar).toBeUndefined();
    const plain = buildConfig(
      'classic',
      [defaultSeat(0, 'human-local', 'A')],
      's',
      'classic',
      false,
      true,
    );
    expect(plain.seats[0]!.avatar).toBeUndefined();
  });

  it('offers the picker for human seats only while the scene UI is on', () => {
    useGame.setState({ screen: 'setup' });
    const { unmount } = render(<SetupScreen />);
    expect(screen.queryByTestId('avatar-picker-0')).toBeNull();
    unmount();
    useFlags.getState().set('sceneUi', true);
    render(<SetupScreen />);
    const radio = screen.getByTestId<HTMLInputElement>('avatar-0-player-3');
    expect(screen.getByTestId<HTMLInputElement>('avatar-0-player-1').checked).toBe(true);
    fireEvent.click(radio);
    expect(radio.checked).toBe(true);
  });
});
