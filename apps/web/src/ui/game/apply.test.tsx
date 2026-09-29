import { fireEvent, render, screen, within } from '@testing-library/react';
import type { DomainEvent } from '@hustle-ring/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { useFlags } from '../../flags/appFlags';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { eventCardText, eventChips, locationQuip, previewParts } from './labels';
import { LocationPanel, SectionRows } from './LocationPanel';

beforeEach(() => {
  useGame.getState().quit();
  globalThis.localStorage.clear();
  useSettings.getState().resetData();
  useGame
    .getState()
    .startGame(
      buildConfig(
        'classic',
        [defaultSeat(0, 'human-local', 'You')],
        'apply',
        'classic',
        false,
        true,
      ),
    );
  useGame.getState().debugPatch((s) => {
    const p = s.players[0]!;
    p.location = 'employment-office';
    p.inside = true;
  });
});

describe('apply list (M11.3)', () => {
  it('shows only jobs the player can apply for, grouped by employer, best pay first', () => {
    render(<LocationPanel />);
    const list = screen.getByTestId('apply-list');
    const rows = within(list).getAllByTestId('preview');
    expect(rows.length).toBeGreaterThan(0);
    // A fresh player qualifies for entry jobs only; the ladder above is hidden and counted.
    expect(within(list).queryAllByTestId('disabled-reason')).toHaveLength(0);
    expect(screen.getByTestId('apply-hidden').textContent).toMatch(/\d+ more jobs are hidden/);
    const burger = within(list).getByTestId('apply-employer-burger-joint');
    expect(within(burger).getByRole('heading').textContent).toBe('At Burger Joint');
    const wages = within(list)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(wages).toContain('Apply: Cook');
  });

  it('reveals locked jobs with what they need when the filter is off', () => {
    render(<LocationPanel />);
    fireEvent.click(screen.getByTestId('apply-only-ok'));
    const needs = screen.getAllByTestId('apply-needs').map((n) => n.textContent);
    expect(needs.length).toBeGreaterThan(10);
    expect(needs.some((n) => /Experience 12 \(you \d+\)/.test(n))).toBe(true);
    expect(needs.some((n) => n.includes('Junior College') || n.includes('Dependability'))).toBe(
      true,
    );
    expect(screen.queryByTestId('apply-hidden')).toBeNull();
  });
});

describe('job risk copy (M11.4)', () => {
  const t = i18n.t.bind(i18n);
  it('says what the risk means', () => {
    const parts = previewParts(
      { hours: -8, money: 0, deltas: {}, notes: [], riskBp: 5700, riskKey: 'risk.noOpenings' },
      t,
      {},
    );
    expect(parts).toContain('−4h');
    expect(parts.some((p) => p.startsWith('57% chance you are turned down'))).toBe(true);
  });

  it('rejection card names the job and its cost', () => {
    const pack = useGame.getState().pack!;
    const ev: DomainEvent = {
      type: 'Refused',
      seat: 0,
      jobId: 'grocery-bagger',
      code: 'ERR_NO_OPENINGS',
      seq: 1,
      week: 1,
    };
    expect(eventCardText(ev, t, pack.rules).text).toContain('turned you down for');
    expect(eventChips(ev, t, pack.rules)[0]).toBe('4h');
  });
});

describe('next-step hint (M11.5)', () => {
  it('shows a hint with a travel shortcut and can be hidden for good', () => {
    useGame.getState().debugPatch((s) => {
      const p = s.players[0]!;
      p.location = 'low-housing';
    });
    render(<LocationPanel />);
    expect(screen.getByTestId('next-step').textContent).toContain('Get a job');
    fireEvent.click(screen.getByTestId('next-step-go'));
    expect(useGame.getState().selectedLocation).toBe('employment-office');
    fireEvent.click(screen.getByTestId('next-step-hide'));
    expect(screen.queryByTestId('next-step')).toBeNull();
    expect(useSettings.getState().settings.hints).toBe(false);
  });
});

describe('panel decluttering (M11.9)', () => {
  it('folds locked rows once something is available, and keeps an all-locked section open', () => {
    const relax = { cmd: { type: 'Relax' } as const, code: null };
    const locked = { cmd: { type: 'Work', hours: 12 } as const, code: 'ERR_NO_JOB' as const };
    const mixed = render(<SectionRows rows={[relax, locked]} repeat={false} section="relax" />);
    const fold = screen.getByTestId('locked-relax');
    expect(fold.tagName).toBe('DETAILS');
    expect(fold.querySelector('summary')?.textContent).toBe('Not available now (1)');
    expect(fold.hasAttribute('open')).toBe(false);
    mixed.unmount();
    render(<SectionRows rows={[locked]} repeat={false} section="work" />);
    expect(screen.queryByTestId('locked-work')).toBeNull();
    expect(screen.getByTestId('disabled-reason')).toBeDefined();
  });

  it('leaves the greeting to the host bubble inside the scene', () => {
    const quip = locationQuip('employment-office', useGame.getState().state!.week);
    useFlags.getState().set('sceneUi', false);
    const ring = render(<LocationPanel />);
    expect(screen.getByText(quip)).toBeDefined();
    ring.unmount();
    useFlags.getState().set('sceneUi', true);
    render(<LocationPanel />);
    expect(screen.queryByText(quip)).toBeNull();
    useFlags.getState().reset({ env: {}, search: '' });
  });
});
