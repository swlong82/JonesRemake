import { defaultBoardLayout } from '@hustle-ring/art';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { GameConfig } from '@hustle-ring/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { artRegistryFor, DEFAULT_ART_SET } from '../../assets/art/artRegistry';
import { useFlags } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { GameScreen } from '../screens/GameScreen';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { layoutFor } from './BoardScene';
import { anchorStyle, pctX, pctY, rectStyle } from './geometry';
import { SceneClock } from './SceneHudBar';

function soloConfig(): GameConfig {
  return buildConfig(
    'classic',
    [defaultSeat(0, 'human-local', 'You')],
    'scene-test',
    'classic',
    false,
    true,
  );
}

function stubMatchMedia(wide: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      // Phone query never matches here; the wide query follows `wide`.
      matches: query.includes('min-width') ? wide : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
  stubMatchMedia(true);
  useGame.getState().startGame(soloConfig());
});

afterEach(() => {
  useFlags.getState().reset({ env: {}, search: '' });
});

/** Players start inside their home (GDD 4.1.6); step out to see the block. */
function stepOut(): void {
  useGame.getState().dispatch({ type: 'Exit' });
}

describe('stage geometry', () => {
  it('converts stage units to percentages', () => {
    expect(pctX(800)).toBe('50%');
    expect(pctY(250)).toBe('25%');
    expect(rectStyle({ x: 160, y: 100, width: 320, height: 200 })).toMatchObject({
      left: '10%',
      top: '10%',
      width: '20%',
      height: '20%',
    });
    expect(anchorStyle({ x: 800, y: 500 }, 160, 100)).toMatchObject({ left: '45%', top: '40%' });
  });
});

describe('scene board (ART_SPEC 17.9)', () => {
  it('replaces the ring with the scene while the flag is on', () => {
    stepOut();
    render(<GameScreen />);
    expect(screen.getByTestId('scene-screen')).toBeDefined();
    expect(screen.queryByTestId('board')).toBeNull();
    const pack = useGame.getState().pack!;
    const board = screen.getByTestId('scene-board');
    expect(within(board).getAllByRole('button')).toHaveLength(
      pack.board.locationAt.filter(Boolean).length,
    );
    const bg = board.querySelector('img[data-art-key="board:background"]')!;
    expect(bg.getAttribute('alt')).toBe('');
    const avatar = screen.getByTestId('avatar-0');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(avatar.dataset.pose).toBe('idle');
    expect(avatar.querySelector('img')!.dataset.artKey).toBe('avatar:player-1:idle:s');
    expect(screen.getByTestId('hud-avatar').dataset.artKey).toBe('avatar:player-1:idle:s');
  });

  it('labels every square like the ring board and marks the current one', () => {
    stepOut();
    render(<GameScreen />);
    const here = screen.getByTestId('square-low-housing');
    expect(here.getAttribute('aria-current')).toBe('true');
    const bank = screen.getByTestId('square-bank');
    expect(bank.getAttribute('aria-label')).toMatch(/Bank/);
    expect(bank.getAttribute('aria-label')).toMatch(/Q/);
  });

  it('visits a square in one click, and opens the full HUD from the bar', () => {
    stepOut();
    render(<GameScreen />);
    fireEvent.click(screen.getByTestId('square-employment-office'));
    expect(screen.getByTestId('scene-interior')).toBeDefined();
    expect(useGame.getState().state?.players[0]?.location).toBe('employment-office');
    expect(screen.queryByTestId('hud')).toBeNull();
    fireEvent.click(screen.getByTestId('hud-details-btn'));
    const sheets = screen.getByTestId('scene-sheets');
    expect(within(sheets).getByTestId('hud')).toBeDefined();
    expect(screen.getByTestId('scene-cash').textContent).toBe('$200');
  });

  it('puts the sheets below the stage on narrower screens', () => {
    stubMatchMedia(false);
    stepOut();
    render(<GameScreen />);
    expect(screen.queryByTestId('scene-sheets')).toBeNull();
    expect(
      within(screen.getByTestId('scene-sheets-below')).getByTestId('location-panel'),
    ).toBeDefined();
  });

  it('falls back to the generated layout when a set does not fit the board', () => {
    const pack = useGame.getState().pack!;
    const registry = artRegistryFor(pack);
    expect(layoutFor(registry, pack)).toBe(DEFAULT_ART_SET.board);
    const small = {
      ...pack,
      board: { ...pack.board, locationAt: pack.board.locationAt.slice(0, 5) },
    };
    expect(layoutFor(registry, small)).toEqual(defaultBoardLayout(5));
  });
});

describe('interiors (ART_SPEC 17.9, M9.8)', () => {
  it('shows the room, the host, the greeting and the panel while inside', () => {
    render(<GameScreen />);
    expect(screen.getByTestId('scene-board')).toBeDefined();
    fireEvent.click(screen.getByTestId('square-low-housing'));
    const room = screen.getByTestId('scene-interior');
    expect(room.getAttribute('aria-label')).toBe('Inside Low-Cost Housing');
    expect(room.querySelector('img[data-art-key="interior:low-housing"]')).not.toBeNull();
    expect(room.querySelector('img[data-art-key="host:low-housing"]')).not.toBeNull();
    expect(screen.getByTestId('host-speech').textContent.length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('interior-panel')).getByTestId('location-panel'),
    ).toBeDefined();
    expect(screen.queryByTestId('scene-board')).toBeNull();
    // Leaving returns to the block, with the outside panel in the park.
    fireEvent.click(screen.getByTestId('exit'));
    expect(screen.getByTestId('scene-board')).toBeDefined();
    expect(within(screen.getByTestId('scene-sheets')).getByTestId('enter')).toBeDefined();
    fireEvent.click(screen.getByTestId('enter'));
    expect(screen.getByTestId('scene-interior')).toBeDefined();
  });

  it('gives phones a cropped room header above the panel', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    render(<GameScreen />);
    expect(screen.queryByTestId('scene-screen')).toBeNull();
    expect(screen.getByTestId('interior-header')).toBeDefined();
    fireEvent.click(screen.getByTestId('exit'));
    expect(screen.queryByTestId('interior-header')).toBeNull();
  });
});

describe('scene clock', () => {
  it('draws a wedge for the hours left and labels the number', () => {
    const { container, rerender } = render(<SceneClock left={120} total={120} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/60/);
    expect(container.querySelector('path')).not.toBeNull();
    rerender(<SceneClock left={30} total={120} />);
    expect(container.querySelector('path')!.getAttribute('d')).toContain('A26 26 0 0 1');
    rerender(<SceneClock left={0} total={0} />);
    expect(container.querySelector('path')).toBeNull();
  });
});

describe('trip cost (M11.2)', () => {
  it('shows walk + enter = total on hover and in the button label', () => {
    stepOut();
    render(<GameScreen />);
    const btn = screen.getByTestId('square-employment-office');
    expect(btn.getAttribute('aria-label')).toMatch(/5h walk plus 2h to enter, 7h in all/);
    expect(screen.queryByTestId('trip-badge-employment-office')).toBeNull();
    fireEvent.mouseEnter(btn);
    expect(screen.getByTestId('trip-badge-employment-office').textContent).toContain(
      '5h walk + 2h enter = 7h',
    );
    fireEvent.mouseLeave(btn);
    expect(screen.queryByTestId('trip-badge-employment-office')).toBeNull();
  });

  it('tints and warns about squares the hours left cannot cover', () => {
    stepOut();
    useGame.getState().debugPatch((s) => {
      s.players[0]!.hoursLeft = 6; // 3h
    });
    render(<GameScreen />);
    const btn = screen.getByTestId('square-employment-office');
    fireEvent.focus(btn);
    expect(screen.getByTestId('trip-badge-employment-office').textContent).toContain(
      'Too far for the hours left',
    );
    const img = btn.parentElement!.querySelector('img[data-art-key="building:employment-office"]');
    expect((img as HTMLElement).style.opacity).toBe('0.55');
  });

  it('travel sheet lists the total and the hours left afterwards', () => {
    stepOut();
    render(<GameScreen />);
    act(() => useGame.getState().openTravel('employment-office'));
    expect(screen.getByTestId('travel-cost').textContent).toContain('Walk 5h + enter 2h = 7h');
    expect(screen.getByTestId('travel-after').textContent).toBe(
      '53h left after arriving and entering',
    );
  });
});
