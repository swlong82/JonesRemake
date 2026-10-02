import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { ConfirmModal } from './ConfirmModal';
import { InfoModal } from './InfoModal';
import { handleGameKey } from './useKeyboard';
import { LogDrawer } from './LogDrawer';
import { matchesFilter } from './logFilter';
import { OutcomeModal } from './OutcomeModal';
import { educationInfo, goalInfo, homeInfo, jobInfo, placeInfo } from './info';

function solo(opaque = false): void {
  useGame
    .getState()
    .startGame(
      buildConfig(
        'classic',
        [defaultSeat(0, 'human-local', 'You')],
        'm13ui',
        'classic',
        opaque,
        true,
      ),
    );
}

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
});

describe('info readers (M13.3–13.6)', () => {
  it('reads goal, home, job and education state from public data', () => {
    solo();
    const { state, pack } = useGame.getState();
    if (!state || !pack) throw new Error('no game');
    const g = goalInfo(state, pack, 0, 'wealth');
    expect(g?.target).toBeGreaterThan(0);
    expect(g?.cash).toBe(state.players[0]?.cash);
    const h = homeInfo(state, pack, 0);
    expect(h?.rent).toBe(state.players[0]?.home.rentLocked);
    expect(jobInfo(state, pack, 0)).toBeNull();
    const e = educationInfo(state, pack, 0);
    expect(e?.held).toEqual([]);
    expect(e?.available.length).toBeGreaterThan(0);
  });

  it('quantizes progress under classic opacity', () => {
    solo(true);
    const { state, pack } = useGame.getState();
    if (!state || !pack) throw new Error('no game');
    expect(state.config.classicOpacity).toBe(true);
    const goal = goalInfo(state, pack, 0, 'career');
    expect((goal?.pct ?? 1) % 25).toBe(0);
  });
});

describe('info modal (M13.3–13.6)', () => {
  it.each(['goal', 'job', 'home', 'education'] as const)(
    'opens the %s card and closes on Escape',
    (kind) => {
      solo();
      render(<InfoModal />);
      expect(screen.queryByTestId('info-modal')).toBeNull();
      act(() => {
        useGame.getState().openInfo(kind === 'goal' ? { kind, goal: 'wealth' } : { kind });
      });
      expect(screen.getByTestId('info-modal')).toBeTruthy();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('info-modal')).toBeNull();
    },
  );

  it('shows the no-job message and the rent line', () => {
    solo();
    render(<InfoModal />);
    act(() => {
      useGame.getState().openInfo({ kind: 'job' });
    });
    expect(screen.getByTestId('info-job-none')).toBeTruthy();
    act(() => {
      useGame.getState().openInfo({ kind: 'home' });
    });
    expect(screen.getByTestId('info-home-rent')).toBeTruthy();
  });
});

describe('outcome modal (M13.2)', () => {
  it('shows a queued outcome and dismisses it', () => {
    solo();
    render(<OutcomeModal />);
    expect(screen.queryByTestId('outcome-modal')).toBeNull();
    act(() => {
      useGame.setState({
        outcomes: [{ type: 'GoalMet', seat: 0, goal: 'wealth', seq: 1, week: 1 }],
      });
    });
    expect(screen.getByTestId('outcome-title').textContent).toContain('Goal reached');
    fireEvent.click(screen.getByTestId('outcome-dismiss'));
    expect(screen.queryByTestId('outcome-modal')).toBeNull();
  });
});

describe('place info (M13.7)', () => {
  it('lists services, tags the home and the suggested place', () => {
    solo();
    const { state, pack } = useGame.getState();
    if (!state || !pack) throw new Error('no game');
    const office = pack.locations.find((l) => l.services.includes('apply'));
    if (!office) throw new Error('no employment office');
    const info = placeInfo(state, pack, office.id, office.id);
    expect(info.services).toContain('apply');
    expect(info.recommended).toBe(true);
    expect(info.isWork).toBe(false);
    const home = placeInfo(state, pack, pack.homeLocation.low, null);
    expect(home.isHome).toBe(true);
    expect(home.recommended).toBe(false);
  });
});

describe('confirm modal (M13.8)', () => {
  it('shows cash before → after, confirms with OK and cancels with Escape', () => {
    solo();
    render(<ConfirmModal />);
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
    const study = useGame.getState().pack?.locations.find((l) => l.services.includes('study'));
    if (!study) throw new Error('no school');
    act(() => {
      useGame.getState().quickTravel(study.id);
    });
    const enroll = useGame
      .getState()
      .candidates()
      .find((r) => r.cmd.type === 'Enroll' && r.code === null);
    if (!enroll) throw new Error('no enrol row');
    act(() => {
      useGame.getState().requestConfirm(enroll.cmd);
    });
    expect(screen.getByTestId('confirm-diff').textContent).toContain('→');
    fireEvent.keyDown(screen.getByTestId('confirm-modal'), { key: 'Escape' });
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
    act(() => {
      useGame.getState().requestConfirm(enroll.cmd);
    });
    fireEvent.click(screen.getByTestId('confirm-ok'));
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
    expect(Object.keys(useGame.getState().state?.players[0]?.enrolled ?? {}).length).toBe(1);
  });
});

describe('log filters (M13.9)', () => {
  it('sorts events into money, work and life', () => {
    const money = {
      type: 'MoneyChanged',
      seat: 0,
      account: 'cash',
      delta: 5,
      reason: 'x',
      seq: 1,
      week: 1,
    } as const;
    const hired = { type: 'Hired', seat: 0, jobId: 'x', seq: 2, week: 1 } as const;
    const rent = { type: 'RentPaid', seat: 0, months: 1, seq: 3, week: 1 } as const;
    expect(matchesFilter(money, 'money')).toBe(true);
    expect(matchesFilter(money, 'work')).toBe(false);
    expect(matchesFilter(hired, 'work')).toBe(true);
    expect(matchesFilter(rent, 'life')).toBe(true);
    expect(matchesFilter(rent, 'all')).toBe(true);
  });

  it('the drawer hides entries the filter excludes', () => {
    solo();
    act(() => {
      useGame.getState().dispatch({ type: 'Relax' });
    });
    render(<LogDrawer />);
    const all = screen.getAllByRole('listitem').length;
    expect(all).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('log-filter-work'));
    expect(screen.queryAllByRole('listitem').length).toBeLessThan(all);
    expect(screen.getByTestId('log-filter-work').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('keyboard parity (M13.10)', () => {
  const press = (key: string): void => {
    act(() => {
      handleGameKey(new KeyboardEvent('keydown', { key }));
    });
  };

  it('J, N and S open the job, home and studies cards', () => {
    solo();
    press('j');
    expect(useGame.getState().info).toEqual({ kind: 'job' });
    useGame.getState().closeInfo();
    press('n');
    expect(useGame.getState().info).toEqual({ kind: 'home' });
    useGame.getState().closeInfo();
    press('s');
    expect(useGame.getState().info).toEqual({ kind: 'education' });
  });

  it('shortcuts wait while a pop-up is open', () => {
    solo();
    press('j');
    press('n');
    expect(useGame.getState().info).toEqual({ kind: 'job' });
    useGame.getState().closeInfo();
    useGame.setState({ outcomes: [{ type: 'Raised', seat: 0, wage: 9, seq: 1, week: 1 }] });
    press('n');
    expect(useGame.getState().info).toBeNull();
  });

  it('Escape cancels a pending confirmation', () => {
    solo();
    useGame.setState({ confirmPending: { cmd: { type: 'Relax' }, stateHash: 'x' } });
    press('Escape');
    expect(useGame.getState().confirmPending).toBeNull();
  });
});
