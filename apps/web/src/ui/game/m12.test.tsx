import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { CommandPalette } from './CommandPalette';
import { CoachMark } from './CoachMark';
import { HoursStrip } from './HoursStrip';
import { buildPaletteEntries, filterPaletteEntries, MAX_PALETTE_RESULTS } from './palette';
import { swipeDirection } from './useSwipe';
import { UndoButton } from './UndoButton';
import { handleGameKey } from './useKeyboard';
import i18n from '../../i18n';

function solo(packId = 'classic'): void {
  useGame
    .getState()
    .startGame(
      buildConfig(packId, [defaultSeat(0, 'human-local', 'You')], 'm12ui', 'classic', false, true),
    );
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

const t = i18n.t.bind(i18n);

describe('palette entries (M12.3)', () => {
  it('offers local actions, places and turn shortcuts, and filters by every word', () => {
    solo();
    const entries = buildPaletteEntries(useGame.getState(), t);
    const labels = entries.map((e) => e.label);
    expect(labels).toContain(t('palette.endTurn'));
    expect(labels.some((l) => l.startsWith('Go to'))).toBe(true);
    expect(filterPaletteEntries(entries, 'go university').length).toBeGreaterThan(0);
    expect(filterPaletteEntries(entries, 'zzzz nothing')).toEqual([]);
    expect(filterPaletteEntries(entries, '').length).toBeLessThanOrEqual(MAX_PALETTE_RESULTS);
  });

  it('is empty when the active seat is not human', () => {
    solo();
    const store = useGame.getState();
    const player = store.state!.players[0]!;
    const rival = {
      ...store,
      state: { ...store.state!, players: [{ ...player, controller: 'ai' as const }] },
    };
    expect(buildPaletteEntries(rival, t)).toEqual([]);
  });

  it('opens with slash, runs an entry with Enter and closes', () => {
    solo();
    render(<CommandPalette />);
    expect(screen.queryByTestId('palette')).toBeNull();
    act(() => {
      handleGameKey(new KeyboardEvent('keydown', { key: '/' }));
    });
    const input = screen.getByTestId('palette-input');
    fireEvent.change(input, { target: { value: 'end turn' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('palette')).toBeNull();
    // Hours remain and food is unplanned, so ending the turn asks first.
    expect(useGame.getState().endTurnPending).toBe(true);
  });

  it('closes on Escape', () => {
    solo();
    render(<CommandPalette />);
    act(() => {
      useGame.getState().togglePalette(true);
    });
    fireEvent.keyDown(screen.getByTestId('palette-input'), { key: 'Escape' });
    expect(useGame.getState().paletteOpen).toBe(false);
  });
});

describe('undo button and keys (M12.2)', () => {
  it('is disabled until an action, then rewinds; Z and Ctrl+Z do the same', () => {
    solo();
    render(<UndoButton />);
    const undoBtn = (): HTMLButtonElement => screen.getByTestId<HTMLButtonElement>('undo-btn');
    expect(undoBtn().disabled).toBe(true);
    act(() => {
      useGame.getState().dispatch({ type: 'Relax' });
    });
    expect(undoBtn().disabled).toBe(false);
    fireEvent.click(screen.getByTestId('undo-btn'));
    expect(useGame.getState().state?.players[0]?.turn.relaxed).toBe(false);
    useGame.getState().dispatch({ type: 'Relax' });
    handleGameKey(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(useGame.getState().undoStack).toHaveLength(0);
    useGame.getState().dispatch({ type: 'Relax' });
    handleGameKey(new KeyboardEvent('keydown', { key: 'z' }));
    expect(useGame.getState().undoStack).toHaveLength(0);
  });

  it('is hidden in strict mode', () => {
    solo();
    useSettings.getState().update({ strictMode: true });
    render(<UndoButton />);
    expect(screen.queryByTestId('undo-btn')).toBeNull();
  });
});

describe('coach mark (M12.4)', () => {
  it('shows a tip once, for a modern-only system, and stays gone after "Got it"', () => {
    solo('modern-western');
    // The modern pack's start location offers no gig; walk to where subscriptions or loans live.
    useGame.getState().debugPatch((s) => {
      s.players[0]!.location = 'bank';
      s.players[0]!.inside = true;
    });
    const rows = useGame.getState().candidates();
    render(<CoachMark offered={rows.map((r) => r.cmd.type)} />);
    const mark = screen.getByTestId('coach-mark');
    expect(mark.getAttribute('data-coach')).toBeTruthy();
    fireEvent.click(screen.getByTestId('coach-dismiss'));
    expect(useSettings.getState().settings.coachSeen).toHaveLength(1);
  });

  it('never shows in classic, which has none of those systems', () => {
    solo('classic');
    render(<CoachMark offered={['Work', 'Relax', 'Deposit']} />);
    expect(screen.queryByTestId('coach-mark')).toBeNull();
  });
});

describe('hours strip (M12.9)', () => {
  it('draws one cell per hour and names what is left', () => {
    solo();
    render(<HoursStrip />);
    const bar = screen.getByTestId('hours-strip-bar');
    expect(bar.children.length).toBeGreaterThan(10);
    expect(bar.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByTestId('chip-food')).toBeTruthy();
  });
});

describe('swipe (M12.8)', () => {
  it('needs distance and a mostly straight path', () => {
    expect(swipeDirection(0, 120)).toBe('down');
    expect(swipeDirection(0, -120)).toBe('up');
    expect(swipeDirection(120, 10)).toBe('right');
    expect(swipeDirection(-120, 10)).toBe('left');
    expect(swipeDirection(10, 30)).toBeNull();
    expect(swipeDirection(90, 100)).toBeNull();
  });
});
