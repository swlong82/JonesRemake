import { fireEvent, render, screen, within } from '@testing-library/react';
import type { GameConfig } from '@hustle-ring/engine';
import type { DomainEvent } from '@hustle-ring/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { GameScreen } from '../screens/GameScreen';
import { AiTicker } from './AiTicker';
import { Board, nodePosition } from './Board';
import { DebugPanel } from './DebugPanel';
import { EventCards } from './EventCards';
import { GoalBars, Hud, fillPct } from './Hud';
import { LocationPanel, groupRows, runRepeat } from './LocationPanel';
import { LogDrawer } from './LogDrawer';
import { MenuSheet } from './MenuSheet';
import { PhoneLocationList } from './PhoneLocationList';
import { Standings } from './Standings';
import { TravelSheet } from './TravelSheet';
import { handleGameKey, locationForKey } from './useKeyboard';
import { matchesPhone } from './useIsPhone';

/** Solo practice: one human seat, so no AI turn runs during a component test. */
function soloConfig(opaque = false): GameConfig {
  const cfg = buildConfig(
    'classic',
    [defaultSeat(0, 'human-local', 'You')],
    'ui-test',
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

function start(opaque = false): void {
  useGame.getState().startGame(soloConfig(opaque));
}

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('board', () => {
  it('draws every ring square with a keyboard badge, and a token per player', () => {
    start();
    render(<Board />);
    const pack = useGame.getState().pack!;
    for (const loc of pack.locations) expect(screen.getByTestId(`square-${loc.id}`)).toBeDefined();
    expect(screen.getByTestId('token-0')).toBeDefined();
    expect(screen.getByTestId('board')).toBeDefined();
  });

  it('labels the current square as "you are here" and others with distance and hours', () => {
    start();
    render(<Board />);
    const here = useGame.getState().state!.players[0]!.location;
    expect(screen.getByTestId(`square-${here}`).getAttribute('aria-label')).toContain(
      'you are here',
    );
    const label = screen.getByTestId('square-bank').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/Bank: \d+ steps, [\d.]+h walk/);
    expect(label).toContain('Press');
  });

  it('opens the travel sheet for another location and selects the current one', () => {
    start();
    render(<Board />);
    fireEvent.click(screen.getByTestId('square-bank'));
    expect(useGame.getState().travelOpen).toBe(true);
    expect(useGame.getState().selectedLocation).toBe('bank');
    const here = useGame.getState().state!.players[0]!.location;
    fireEvent.click(screen.getByTestId(`square-${here}`));
    expect(useGame.getState().travelOpen).toBe(false);
    expect(useGame.getState().selectedLocation).toBe(here);
  });

  it('is keyboard operable on a square', () => {
    start();
    render(<Board />);
    fireEvent.keyDown(screen.getByTestId('square-bank'), { key: 'Enter' });
    expect(useGame.getState().travelOpen).toBe(true);
  });

  it('places nodes on a circle', () => {
    const top = nodePosition(0, 16);
    const bottom = nodePosition(8, 16);
    expect(Math.round(top.x)).toBe(Math.round(bottom.x));
    expect(top.y).toBeLessThan(bottom.y);
  });

  it('honours reduced motion by dropping the token transition', () => {
    start();
    useSettings.getState().update({ reducedMotion: true });
    render(<Board />);
    expect(screen.getByTestId('token-0').getAttribute('style')).not.toContain('transition');
  });
});

describe('hud', () => {
  it('shows the active seat, week, money and four goal bars', () => {
    start();
    render(<Hud />);
    expect(screen.getByTestId('active-player').textContent).toContain('You');
    expect(screen.getByTestId('week').textContent).toContain('1');
    expect(screen.getByTestId('cash').textContent).toMatch(/\$\d+/);
    const goals = screen.getByTestId('goals-0');
    expect(within(goals).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByTestId('rent').textContent).toBeTruthy();
    expect(screen.getByTestId('food').textContent).toBeTruthy();
  });

  it('classic opacity replaces exact goal values with 25% steps', () => {
    start(true);
    render(<Hud />);
    expect(screen.getByTestId('goal-wealth').textContent).toMatch(/^(0|25|50|75|100)%$/);
  });

  it('rounds bar fills, and to quarter steps under classic opacity', () => {
    expect(fillPct(10, 50, false)).toBe(20);
    expect(fillPct(10, 50, true)).toBe(0);
    expect(fillPct(30, 50, true)).toBe(50);
    expect(fillPct(80, 50, false)).toBe(100);
    expect(fillPct(1, 0, false)).toBe(100);
  });

  it('marks a met goal', () => {
    start();
    const state = useGame.getState().state!;
    const players = state.players.map((p) => ({ ...p, goals: { ...p.goals, happiness: 1 } }));
    useGame.setState({ state: { ...state, players } });
    render(
      <GoalBars
        state={useGame.getState().state!}
        pack={useGame.getState().pack!}
        seat={0}
        opaque={false}
      />,
    );
    expect(screen.getByTestId('goal-happiness').textContent).toContain('met');
  });

  it('toggles standings and the log from the HUD', () => {
    start();
    render(<Hud />);
    fireEvent.click(screen.getByTestId('standings-btn'));
    expect(useGame.getState().standingsOpen).toBe(true);
    fireEvent.click(screen.getByTestId('log-btn'));
    expect(useGame.getState().logOpen).toBe(true);
  });
});

describe('standings', () => {
  it('lists a row per player and closes', () => {
    start();
    render(<Standings />);
    expect(screen.getByTestId('standing-0')).toBeDefined();
    useGame.getState().toggleStandings();
    fireEvent.click(screen.getByTestId('standings-close'));
    expect(useGame.getState().standingsOpen).toBe(false);
  });
});

describe('location panel', () => {
  it('names where you are and offers the actions available inside', () => {
    start();
    render(<LocationPanel />);
    expect(screen.getByTestId('panel-location').textContent).toContain('Housing');
    expect(screen.getByTestId('panel-state').textContent).toBe('Open');
    expect(screen.getByTestId('section-relax')).toBeDefined();
    expect(screen.getByTestId('exit')).toBeDefined();
  });

  it('dispatches an action and shows its preview line', () => {
    start();
    render(<LocationPanel />);
    const relax = screen.getByTestId('action-Relax');
    expect(relax.parentElement?.textContent).toMatch(/−?\d+(\.\d)?h/);
    fireEvent.click(relax);
    expect(useGame.getState().state?.players[0]?.turn.relaxed).toBe(true);
  });

  it('shows a disabled action with the reason from its error code', () => {
    start();
    // Relax twice: the second attempt is disabled with ERR_ALREADY_RELAXED.
    useGame.getState().dispatch({ type: 'Relax' });
    render(<LocationPanel />);
    const relax = screen.getByTestId<HTMLButtonElement>('action-Relax');
    expect(relax.disabled).toBe(true);
    expect(relax.parentElement?.textContent).toContain('Already relaxed');
  });

  it('asks before ending a turn with hours left, and ends it on confirm', () => {
    start();
    render(<LocationPanel />);
    fireEvent.click(screen.getByTestId('end-turn'));
    expect(useGame.getState().endTurnPending).toBe(true);
    expect(screen.getByTestId('end-turn-cancel')).toBeDefined();
    fireEvent.click(screen.getByTestId('end-turn-cancel'));
    expect(useGame.getState().endTurnPending).toBe(false);
    fireEvent.click(screen.getByTestId('end-turn'));
    fireEvent.click(screen.getByTestId('end-turn-confirm'));
    expect(useGame.getState().state?.week).toBe(2);
  });

  it('groups candidate rows by section, legal first, dropping wrong-place actions', () => {
    const groups = groupRows([
      { cmd: { type: 'Work', hours: 16 }, code: 'ERR_NO_JOB' },
      { cmd: { type: 'Relax' }, code: null },
      { cmd: { type: 'Deposit', amount: 5 }, code: 'ERR_NOT_AT_LOCATION' },
      { cmd: { type: 'EndTurn' }, code: null },
    ]);
    expect(groups.map((g) => g.section)).toEqual(['work', 'relax']);
    expect(groups[1]?.rows).toHaveLength(1);
  });

  it('repeats an action until it is no longer legal', () => {
    start();
    render(<LocationPanel />);
    fireEvent.click(screen.getByTestId('repeat'));
    const before = useGame.getState().state!.players[0]!.hoursLeft;
    fireEvent.click(screen.getByTestId('action-Relax'));
    const after = useGame.getState().state!.players[0]!.hoursLeft;
    expect(after).toBeLessThan(before);
    // Relax is once per week, so the repeat loop stops after the first success.
    expect(useGame.getState().state?.players[0]?.turn.relaxed).toBe(true);
  });

  it('runRepeat stops immediately on an unknown command', () => {
    start();
    const before = useGame.getState().hash();
    runRepeat({ type: 'Work', hours: 16 });
    expect(useGame.getState().hash()).toBe(before);
  });
});

describe('travel sheet', () => {
  it('offers the walk mode with its cost and moves the player on Go', () => {
    start();
    useGame.getState().dispatch({ type: 'Exit' });
    useGame.getState().openTravel('bank');
    render(<TravelSheet />);
    expect(screen.getByTestId('mode-walk')).toBeDefined();
    expect(screen.getByTestId('travel-cost').textContent).toMatch(/[\d.]+h/);
    fireEvent.click(screen.getByTestId('travel-go'));
    expect(useGame.getState().state?.players[0]?.location).toBe('bank');
    expect(useGame.getState().travelOpen).toBe(false);
  });

  it('cancels back to the board', () => {
    start();
    useGame.getState().openTravel('bank');
    render(<TravelSheet />);
    fireEvent.click(screen.getByTestId('travel-cancel'));
    expect(useGame.getState().travelOpen).toBe(false);
  });

  it('warns when the trip needs more hours than are left', () => {
    start();
    const state = useGame.getState().state!;
    const players = state.players.map((p) => ({ ...p, hoursLeft: 1, inside: false }));
    useGame.setState({ state: { ...state, players }, selectedLocation: 'bank', travelOpen: true });
    render(<TravelSheet />);
    expect(screen.getByTestId('travel-partial')).toBeDefined();
  });
});

describe('event cards', () => {
  const card: DomainEvent = {
    type: 'EventFired',
    seat: 0,
    eventId: 'found-cash',
    effects: ['money:cash:40'],
    seq: 1,
    week: 1,
  };

  it('shows the top card with chips and dismisses it', () => {
    start();
    useGame.setState({ cards: [card, { ...card, seq: 2 }] });
    render(<EventCards />);
    expect(screen.getByTestId('event-title').textContent).toBe('Found cash');
    expect(within(screen.getByTestId('event-chips')).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('event-dismiss'));
    expect(useGame.getState().cards).toHaveLength(1);
  });

  it('renders nothing without a card', () => {
    start();
    render(<EventCards />);
    expect(screen.queryByTestId('event-modal')).toBeNull();
  });
});

describe('log drawer', () => {
  it('groups the events of each week', () => {
    start();
    useGame.getState().dispatch({ type: 'Relax' });
    render(<LogDrawer />);
    const drawer = screen.getByTestId('log-drawer');
    expect(drawer.textContent).toContain('Week 1');
    expect(drawer.textContent).toContain('relaxed');
    fireEvent.click(screen.getByTestId('log-close'));
    expect(useGame.getState().logOpen).toBe(true);
  });
});

describe('ai ticker', () => {
  it('is silent on a human turn and lists the rival actions on an AI turn', () => {
    start();
    const { unmount } = render(<AiTicker />);
    expect(screen.queryByTestId('ai-ticker')).toBeNull();
    unmount();
    const state = useGame.getState().state!;
    const players = state.players.map((p) => ({ ...p, controller: 'ai' as const }));
    useGame.setState({
      state: { ...state, players },
      ticker: [{ seat: 0, cmd: { type: 'Relax' } }],
      aiThinking: true,
    });
    render(<AiTicker />);
    expect(screen.getByTestId('ai-ticker').textContent).toContain('Relax');
    fireEvent.click(screen.getByTestId('ai-skip'));
    expect(useGame.getState().aiSkip).toBe(true);
  });
});

describe('menu sheet', () => {
  it('shows the state hash and quits after confirming', () => {
    start();
    render(<MenuSheet />);
    expect(screen.getByTestId('menu-hash').textContent).toMatch(/[0-9a-f]+/);
    fireEvent.click(screen.getByTestId('menu-quit'));
    fireEvent.click(screen.getByTestId('menu-quit-confirm'));
    expect(useGame.getState().screen).toBe('title');
    expect(useGame.getState().state).toBeNull();
  });

  it('routes to settings and help', () => {
    start();
    render(<MenuSheet />);
    fireEvent.click(screen.getByTestId('menu-settings'));
    expect(useGame.getState().screen).toBe('settings');
    fireEvent.click(screen.getByTestId('menu-help'));
    expect(useGame.getState().screen).toBe('help');
  });
});

describe('debug panel', () => {
  it('grants money, jumps weeks, toggles autoplay and shows hidden stats', () => {
    start();
    render(<DebugPanel />);
    const cash = useGame.getState().state!.players[0]!.cash;
    fireEvent.click(screen.getByTestId('debug-grant'));
    expect(useGame.getState().state?.players[0]?.cash).toBe(cash + 1000);
    expect(useGame.getState().state?.debugTouched).toBe(true);
    fireEvent.click(screen.getByTestId('debug-jump'));
    expect(useGame.getState().state?.week).toBe(10);
    expect(screen.getByTestId('debug-hidden').textContent).toContain('Dependability');
    fireEvent.click(screen.getByTestId('debug-autoplay'));
    expect(useGame.getState().autoplay).toBe(true);
  });
});

describe('keyboard map (UX 7.7)', () => {
  function key(init: KeyboardEventInit): void {
    handleGameKey(new KeyboardEvent('keydown', init));
  }

  it('maps ring keys to locations', () => {
    start();
    const pack = useGame.getState().pack!;
    expect(locationForKey('1', pack.board.locationAt)).toBe('low-housing');
    expect(locationForKey('q', pack.board.locationAt)).toBe('bank');
    expect(locationForKey('Z', pack.board.locationAt)).toBeNull();
  });

  it('opens travel with a ring key and selects the current square', () => {
    start();
    key({ key: 'q' });
    expect(useGame.getState().travelOpen).toBe(true);
    expect(useGame.getState().selectedLocation).toBe('bank');
    key({ key: '1' });
    expect(useGame.getState().selectedLocation).toBe('low-housing');
  });

  it('toggles the log, standings and help', () => {
    start();
    key({ key: 'l' });
    expect(useGame.getState().logOpen).toBe(true);
    key({ key: 'g' });
    expect(useGame.getState().standingsOpen).toBe(true);
    key({ key: 'h' });
    expect(useGame.getState().screen).toBe('help');
  });

  it('Shift+E asks to end the turn and Escape cancels', () => {
    start();
    key({ key: 'E', shiftKey: true });
    expect(useGame.getState().endTurnPending).toBe(true);
    key({ key: 'Escape' });
    expect(useGame.getState().endTurnPending).toBe(false);
  });

  it('Enter confirms the travel sheet and dismisses a card first', () => {
    start();
    useGame.getState().dispatch({ type: 'Exit' });
    useGame.setState({ cards: [{ type: 'Starved', seat: 0, seq: 9, week: 1 }] });
    key({ key: 'Enter' });
    expect(useGame.getState().cards).toHaveLength(0);
    useGame.getState().openTravel('bank');
    key({ key: 'Enter' });
    expect(useGame.getState().state?.players[0]?.location).toBe('bank');
  });

  it('cycles transport modes with M and closes the sheet with Escape', () => {
    start();
    useGame.getState().openTravel('bank');
    key({ key: 'm' });
    expect(useGame.getState().travelMode).toBe('walk');
    key({ key: 'Escape' });
    expect(useGame.getState().travelOpen).toBe(false);
  });

  it('swallows Ctrl+S and ignores keys typed into inputs', () => {
    start();
    const e = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    handleGameKey(e);
    expect(e.defaultPrevented).toBe(true);
    const input = globalThis.document.createElement('input');
    globalThis.document.body.append(input);
    const typed = new KeyboardEvent('keydown', { key: 'l' });
    Object.defineProperty(typed, 'target', { value: input });
    handleGameKey(typed);
    expect(useGame.getState().logOpen).toBe(false);
    input.remove();
  });
});

describe('phone layout (UX 7.2)', () => {
  it('detects the breakpoint through matchMedia', () => {
    stubMatchMedia(true);
    expect(matchesPhone()).toBe(true);
    stubMatchMedia(false);
    expect(matchesPhone()).toBe(false);
  });

  it('lists locations by travel time with a here badge', () => {
    start();
    render(<PhoneLocationList />);
    const here = useGame.getState().state!.players[0]!.location;
    expect(screen.getByTestId(`phone-loc-${here}`).textContent).toContain('here');
    fireEvent.click(screen.getByTestId('phone-loc-bank'));
    expect(useGame.getState().travelOpen).toBe(true);
  });
});

describe('game screen', () => {
  it('renders the wide layout with board, HUD and panel', () => {
    stubMatchMedia(false);
    start();
    render(<GameScreen />);
    expect(screen.getByTestId('board')).toBeDefined();
    expect(screen.getByTestId('hud')).toBeDefined();
    expect(screen.getByTestId('location-panel')).toBeDefined();
    expect(screen.getByTestId('live').textContent).toContain('You');
    expect(screen.queryByTestId('phone-locations')).toBeNull();
  });

  it('renders the phone layout with a mini ring, location list and expand toggle', () => {
    stubMatchMedia(true);
    start();
    render(<GameScreen />);
    expect(screen.getByTestId('board-mini')).toBeDefined();
    expect(screen.getByTestId('phone-locations')).toBeDefined();
    fireEvent.click(screen.getByTestId('board-expand'));
    expect(screen.getByTestId('board')).toBeDefined();
    fireEvent.click(screen.getByTestId('board-collapse'));
    expect(screen.getByTestId('board-mini')).toBeDefined();
  });

  it('hides the panel and ignores action keys while a rival is playing', () => {
    stubMatchMedia(false);
    start();
    const state = useGame.getState().state!;
    const players = state.players.map((p) => ({ ...p, controller: 'ai' as const }));
    useGame.setState({ state: { ...state, players } });
    render(<GameScreen />);
    expect(screen.queryByTestId('location-panel')).toBeNull();
    expect(screen.getByTestId('ai-ticker')).toBeDefined();
    handleGameKey(new KeyboardEvent('keydown', { key: 'q' }));
    expect(useGame.getState().travelOpen).toBe(false);
    handleGameKey(new KeyboardEvent('keydown', { key: 'E', shiftKey: true }));
    expect(useGame.getState().endTurnPending).toBe(false);
    // View toggles still work while watching.
    handleGameKey(new KeyboardEvent('keydown', { key: 'l' }));
    expect(useGame.getState().logOpen).toBe(true);
  });

  it('opens the menu from the header', () => {
    stubMatchMedia(false);
    start();
    render(<GameScreen />);
    fireEvent.click(screen.getByTestId('menu-btn'));
    expect(screen.getByTestId('menu-sheet')).toBeDefined();
  });
});
