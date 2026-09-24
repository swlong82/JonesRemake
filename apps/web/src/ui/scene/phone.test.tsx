import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useFlags } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { GameScreen } from '../screens/GameScreen';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { clampView, MAX_SCALE, panBy, zoomAt } from './panZoom';

const viewport = { width: 390, height: 292 };
const stage = { width: 468, height: 292 };

describe('pan and zoom (ART_SPEC 17.9, M9.9)', () => {
  it('keeps the stage covering the viewport', () => {
    expect(clampView({ scale: 1, x: 50, y: 20 }, viewport, stage)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
    expect(clampView({ scale: 1, x: -500, y: 0 }, viewport, stage).x).toBe(390 - 468);
    expect(clampView({ scale: 0.2, x: 0, y: 0 }, viewport, stage).scale).toBe(1);
    expect(clampView({ scale: 9, x: 0, y: 0 }, viewport, stage).scale).toBe(MAX_SCALE);
    // A stage smaller than the viewport is centred.
    expect(clampView({ scale: 1, x: 0, y: 0 }, { width: 600, height: 292 }, stage).x).toBe(66);
  });

  it('pans within bounds and zooms about a point', () => {
    expect(panBy({ scale: 1, x: 0, y: 0 }, -30, 10, viewport, stage)).toEqual({
      scale: 1,
      x: -30,
      y: 0,
    });
    const z = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 100, viewport, stage);
    expect(z.scale).toBe(2);
    // The stage point under (100, 100) stays under it.
    expect((100 - z.x) / z.scale).toBeCloseTo(100);
    expect((100 - z.y) / z.scale).toBeCloseTo(100);
  });
});

function phone(): void {
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
}

describe('phone scene', () => {
  beforeAll(() => {
    // jsdom has no PointerEvent; without it fireEvent drops pointerId and coordinates.
    if (typeof globalThis.PointerEvent === 'undefined') {
      class PointerEventPolyfill extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      }
      Object.defineProperty(globalThis, 'PointerEvent', {
        configurable: true,
        value: PointerEventPolyfill,
      });
    }
  });
  beforeEach(() => {
    useGame.getState().quit();
    useSettings.getState().resetData();
    useFlags.getState().set('sceneUi', true);
    phone();
    useGame
      .getState()
      .startGame(
        buildConfig(
          'classic',
          [defaultSeat(0, 'human-local', 'Ann')],
          'ph',
          'classic',
          false,
          true,
        ),
      );
    useGame.getState().dispatch({ type: 'Exit' });
  });
  afterEach(() => useFlags.getState().reset({ env: {}, search: '' }));

  it('shows the map by default and switches to the list in one tap', () => {
    render(<GameScreen />);
    expect(screen.getByTestId('phone-scene')).toBeDefined();
    expect(screen.getByTestId('phone-view-scene').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('phone-view-list'));
    expect(screen.queryByTestId('phone-scene')).toBeNull();
    expect(screen.getByTestId('phone-locations')).toBeDefined();
    fireEvent.click(screen.getByTestId('phone-view-scene'));
    expect(screen.getByTestId('phone-scene')).toBeDefined();
  });

  it('zooms with the buttons and opens travel from a tapped building', () => {
    render(<GameScreen />);
    const stageEl = screen.getByTestId('phone-stage');
    expect(stageEl.dataset.scale).toBe('1.00');
    fireEvent.click(screen.getByTestId('zoom-in'));
    expect(stageEl.dataset.scale).toBe('1.25');
    fireEvent.click(screen.getByTestId('zoom-out'));
    expect(stageEl.dataset.scale).toBe('1.00');
    fireEvent.click(within(stageEl).getByTestId('square-bank'));
    expect(screen.getByTestId('travel-sheet')).toBeDefined();
  });

  it('pans on drag and does not treat the drag as a tap', () => {
    render(<GameScreen />);
    const box = screen.getByTestId('phone-scene');
    const stageEl = screen.getByTestId('phone-stage');
    const before = stageEl.style.transform;
    // The whole block fits at 1×; zoom in first so there is somewhere to pan to.
    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.pointerDown(box, { pointerId: 1, clientX: 260, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(box, { pointerId: 1, clientX: 200, clientY: 100 });
    expect(stageEl.style.transform).not.toBe(before);
    fireEvent.click(within(stageEl).getByTestId('square-bank'));
    expect(screen.queryByTestId('travel-sheet')).toBeNull();
    // The next plain tap works again.
    fireEvent.click(within(stageEl).getByTestId('square-bank'));
    expect(screen.getByTestId('travel-sheet')).toBeDefined();
  });

  it('zooms with a pinch', () => {
    render(<GameScreen />);
    const box = screen.getByTestId('phone-scene');
    fireEvent.pointerDown(box, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(box, { pointerId: 2, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 300, clientY: 100 });
    fireEvent.pointerUp(box, { pointerId: 2 });
    fireEvent.pointerUp(box, { pointerId: 1 });
    expect(Number(screen.getByTestId('phone-stage').dataset.scale)).toBeGreaterThan(1.5);
  });
});
