import { fireEvent, render, screen, within } from '@testing-library/react';
import type { DomainEvent } from '@hustle-ring/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settings';
import { buildConfig, defaultSeat } from '../screens/SetupScreen';
import { eventCardText, eventChips, previewParts } from './labels';
import { LocationPanel } from './LocationPanel';

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
