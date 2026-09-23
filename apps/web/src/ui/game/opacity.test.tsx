/**
 * M7.4 AC: "hidden values absent from DOM (not just visually hidden)".
 *
 * Classic opacity is not a CSS effect — under it the numbers must never be rendered at all, in
 * text or in an attribute, because anything in the DOM is readable from devtools, from the
 * accessibility tree and by a screen reader (UX 7.3: "hidden stats never shown; previews show
 * hours and money only").
 */
import { render, screen } from '@testing-library/react';
import type { GameConfig } from '@hustle-ring/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { GameScreen } from '../screens/GameScreen';
import { EndScreen } from '../screens/EndScreen';
import { Hud } from './Hud';
import { LocationPanel } from './LocationPanel';
import { LogDrawer } from './LogDrawer';
import { Standings } from './Standings';

/**
 * Distinctive values, so finding one in the DOM cannot be a coincidence with a coordinate, a
 * class name or a week number.
 */
const HIDDEN = {
  dependability: 73,
  experience: 61,
  relaxation: 47,
  happiness: 83,
  wellbeing: 39,
} as const;

function config(pack: 'classic' | 'modern-western', opaque: boolean): GameConfig {
  const cfg = buildConfig(
    pack,
    [defaultSeat(0, 'human-local', 'You')],
    'opacity-test',
    'classic',
    opaque,
    true,
  );
  return {
    ...cfg,
    seats: cfg.seats.map((s) => ({
      ...s,
      goals: { wealth: 50, happiness: 50, education: 50, career: 50 },
    })),
  };
}

/** Start a game and give the seat the hidden stats above. */
function start(opaque: boolean, pack: 'classic' | 'modern-western' = 'classic'): void {
  useGame.getState().startGame(config(pack, opaque));
  useGame.getState().debugPatch((state) => {
    const p = state.players[state.activeSeat];
    if (!p) return;
    p.dependability = HIDDEN.dependability;
    p.experience = HIDDEN.experience;
    p.relaxation = HIDDEN.relaxation;
    p.happiness = HIDDEN.happiness;
    const slice = p.modules.wellbeing as { value: number } | undefined;
    if (slice) slice.value = HIDDEN.wellbeing;
  });
}

/** Every number the rendered markup contains, attributes included. */
function numbersInDom(): Set<number> {
  const html = globalThis.document.body.innerHTML;
  const out = new Set<number>();
  for (const match of html.matchAll(/\d+(?:\.\d+)?/g)) out.add(Number(match[0]));
  return out;
}

function leaked(): number[] {
  const numbers = numbersInDom();
  return Object.values(HIDDEN).filter((v) => numbers.has(v));
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

describe('classic opacity keeps hidden values out of the DOM (UX 7.3)', () => {
  it('renders none of them anywhere on the board screen', () => {
    start(true);
    render(<GameScreen />);
    expect(leaked()).toEqual([]);
  });

  it('renders none of them in the HUD, standings, action previews or the log', () => {
    start(true);
    useGame.getState().toggleStandings();
    useGame.getState().toggleLog();
    render(
      <>
        <Hud />
        <Standings />
        <LocationPanel />
        <LogDrawer />
      </>,
    );
    expect(leaked()).toEqual([]);
  });

  it('keeps the modern wellbeing stat to its band, with no number', () => {
    start(true, 'modern-western');
    render(<Hud />);
    const line = screen.getAllByTestId('wellbeing')[0];
    expect(line).toBeTruthy();
    // The band is still named — the player is told they are burnt out, not by how much.
    expect(line?.textContent ?? '').not.toContain(String(HIDDEN.wellbeing));
    expect(leaked()).toEqual([]);
  });

  it('quantises the goal bars to 25% steps instead of showing the value', () => {
    start(true);
    render(<Hud />);
    for (const goal of ['wealth', 'happiness', 'education', 'career']) {
      const text = screen.getByTestId(`goal-${goal}`).textContent;
      // Either a quarter step or the met marker; never `value/target`.
      expect(text).not.toContain('/');
      if (text.endsWith('%')) expect(Number(text.replace('%', '')) % 25).toBe(0);
    }
  });

  it('keeps the end-screen chart off the raw trajectory', () => {
    start(true);
    useGame.getState().debugPatch((state) => {
      state.winner = state.activeSeat;
    });
    useGame.getState().go('end');
    render(<EndScreen />);
    expect(leaked()).toEqual([]);
  });

  it('shows the same values plainly when opacity is off, so the test can tell the difference', () => {
    start(false, 'modern-western');
    render(<Hud />);
    const numbers = numbersInDom();
    expect(numbers.has(HIDDEN.wellbeing)).toBe(true);
  });
});
