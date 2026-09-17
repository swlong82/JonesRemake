import { loadPack } from '@hustle-ring/content';
import type { ActionPreview } from '@hustle-ring/engine';
import type { DomainEvent } from '@hustle-ring/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import i18n, { loadPackStrings } from '../../i18n';
import {
  RING_KEYS,
  commandKey,
  commandLabel,
  effectChip,
  eventCardText,
  eventChips,
  hours,
  logLine,
  noteLabel,
  previewParts,
  ringKeyFor,
  sectionOf,
  stepsBetween,
} from './labels';

const pack = loadPack('classic');
const t = i18n.t.bind(i18n);

beforeAll(() => {
  loadPackStrings(pack);
});

function preview(patch: Partial<ActionPreview> = {}): ActionPreview {
  return { hours: 0, money: 0, deltas: {}, notes: [], ...patch };
}

describe('hours formatting', () => {
  it('renders half-hours as human hours', () => {
    expect(hours(12)).toBe('6');
    expect(hours(-12)).toBe('6');
    expect(hours(3)).toBe('1.5');
    expect(hours(0)).toBe('0');
  });
});

describe('commandLabel', () => {
  it('names content through the pack namespace', () => {
    expect(commandLabel({ type: 'ApplyJob', jobId: 'factory-packer' }, t)).toContain('Packer');
    expect(commandLabel({ type: 'Study', degreeId: 'trade-school' }, t)).toContain('Trade School');
    expect(commandLabel({ type: 'BuyItem', itemId: 'refrigerator', qty: 1 }, t)).toContain(
      'Refrigerator',
    );
    expect(commandLabel({ type: 'BuyAsset', assetId: 'gold', amount: 500 }, t)).toContain('Gold');
    expect(commandLabel({ type: 'Move', to: 'bank', mode: 'walk' }, t)).toContain('Bank');
  });

  it('renders hours, amounts and plurals', () => {
    expect(commandLabel({ type: 'Work', hours: 16 }, t)).toBe('Work a shift (8h)');
    expect(commandLabel({ type: 'PayRent', months: 1 }, t)).toBe('Pay rent (1 month)');
    expect(commandLabel({ type: 'PayRent', months: 3 }, t)).toBe('Pay rent (3 months)');
    expect(commandLabel({ type: 'PayRent', months: 0 }, t)).toBe('Clear rent debt');
    expect(commandLabel({ type: 'BuyLottery', qty: 1 }, t)).toContain('1 lottery ticket');
    expect(commandLabel({ type: 'BuyLottery', qty: 3 }, t)).toContain('3 lottery tickets');
    expect(commandLabel({ type: 'MoveHome', tier: 'high' }, t)).toContain('secure apartments');
    expect(commandLabel({ type: 'EndTurn' }, t)).toBe('End turn');
  });
});

describe('commandKey', () => {
  it('is stable and distinguishes arguments', () => {
    expect(commandKey({ type: 'Work', hours: 16 })).toBe('Work:hours=16');
    expect(commandKey({ type: 'Deposit', amount: 5 })).not.toBe(
      commandKey({ type: 'Deposit', amount: 6 }),
    );
  });
});

describe('sections', () => {
  it('maps commands to panel sections and leaves movement out', () => {
    expect(sectionOf({ type: 'Work', hours: 16 })).toBe('work');
    expect(sectionOf({ type: 'Deposit', amount: 10 })).toBe('bank');
    expect(sectionOf({ type: 'SellItem', itemId: 'stereo' })).toBe('pawn');
    expect(sectionOf({ type: 'EndTurn' })).toBeNull();
    expect(sectionOf({ type: 'Move', to: 'bank', mode: 'walk' })).toBeNull();
  });
});

describe('previewParts', () => {
  it('shows hours, money, stat deltas, risk and notes', () => {
    const parts = previewParts(
      preview({
        hours: -12,
        money: 96,
        deltas: { dependability: 2, happiness: -3, experience: 0 },
        riskBp: 400,
        notes: ['wage:12'],
      }),
      t,
    );
    expect(parts[0]).toBe('−6h');
    expect(parts[1]).toBe('+$96');
    expect(parts).toContain('Dependability +2');
    expect(parts).toContain('Happiness −3');
    expect(parts.some((p) => p.includes('4.0'))).toBe(true);
    expect(parts).toContain('$12/h');
    expect(parts.some((p) => p.includes('Experience'))).toBe(false);
  });

  it('classic opacity keeps hours and money only', () => {
    const parts = previewParts(
      preview({ hours: -4, money: -10, deltas: { happiness: 5 }, riskBp: 100 }),
      t,
      { opaque: true },
    );
    expect(parts).toEqual(['−2h', '−$10']);
  });
});

describe('noteLabel', () => {
  it('handles bare and numeric notes', () => {
    expect(noteLabel('bank.deposit', t)).toBe('to bank');
    expect(noteLabel('steps:4', t)).toBe('4 steps');
    expect(noteLabel('lessonsLeft:7', t)).toBe('7 lessons left');
  });
});

describe('event text and chips', () => {
  it('prefers the pack strings for a pack event', () => {
    const e: DomainEvent = {
      type: 'EventFired',
      seat: 0,
      eventId: 'found-cash',
      effects: ['money:cash:40'],
      seq: 1,
      week: 2,
    };
    expect(eventCardText(e, t).title).toBe('Found cash');
    expect(eventChips(e, t)).toEqual(['+$40']);
  });

  it('falls back to the generic keys for engine events', () => {
    const e: DomainEvent = { type: 'Starved', seat: 0, seq: 2, week: 3 };
    expect(eventCardText(e, t).title).toBe('Starving');
    expect(eventChips(e, t).length).toBe(2);
    const lottery: DomainEvent = {
      type: 'LotteryResolved',
      seat: 0,
      prize: 250,
      seq: 3,
      week: 3,
    };
    expect(eventCardText(lottery, t).text).toContain('250');
    expect(
      eventCardText({ type: 'LotteryResolved', seat: 0, prize: 0, seq: 4, week: 3 }, t).text,
    ).toContain('No luck');
  });

  it('renders each effect DSL op as a chip', () => {
    expect(effectChip('money:cash:-40', t)).toBe('−$40');
    expect(effectChip('stat:happiness:-3', t)).toBe('Happiness −3');
    expect(effectChip('hours:-4', t)).toBe('2h');
    expect(effectChip('econ:-50', t)).toBe('Economy shock');
    expect(effectChip('market:all:-100', t)).toBe('Markets moved');
    expect(effectChip('mystery:1', t)).toContain('mystery');
  });
});

describe('logLine', () => {
  const state = {
    players: [
      { seat: 0, name: 'You' },
      { seat: 1, name: 'Rival' },
    ],
  } as unknown as Parameters<typeof logLine>[1];

  it('renders money, stats, hours and movement', () => {
    expect(
      logLine(
        {
          type: 'MoneyChanged',
          seat: 0,
          account: 'cash',
          delta: -40,
          reason: 'meal',
          seq: 1,
          week: 1,
        },
        state,
        t,
      ),
    ).toBe('You: Cash −$40 (meal)');
    expect(
      logLine(
        {
          type: 'StatChanged',
          seat: 1,
          stat: 'dependability',
          delta: 2,
          reason: 'work',
          seq: 2,
          week: 1,
        },
        state,
        t,
      ),
    ).toBe('Rival: Dependability +2');
    expect(
      logLine(
        { type: 'HoursSpent', seat: 0, hours: 12, reason: 'work', seq: 3, week: 1 },
        state,
        t,
      ),
    ).toContain('6h');
    expect(
      logLine(
        {
          type: 'Moved',
          seat: 0,
          from: 'bank',
          to: 'park',
          mode: 'walk',
          hours: 4,
          seq: 4,
          week: 1,
        },
        state,
        t,
      ),
    ).toContain('Park');
    expect(
      logLine({ type: 'Worked', seat: 0, hours: 16, pay: 96, seq: 5, week: 1 }, state, t),
    ).toContain('$96');
  });

  it('hides another human seat amounts in hotseat play', () => {
    const line = logLine(
      {
        type: 'MoneyChanged',
        seat: 1,
        account: 'bank',
        delta: 500,
        reason: 'pay',
        seq: 6,
        week: 2,
      },
      state,
      t,
      true,
    );
    expect(line).toContain('(hidden)');
    expect(line).not.toContain('500');
  });

  it('names content and falls back for unmapped events', () => {
    expect(
      logLine({ type: 'Hired', seat: 0, jobId: 'factory-packer', seq: 7, week: 2 }, state, t),
    ).toContain('Packer');
    expect(
      logLine({ type: 'Graduated', seat: 0, degreeId: 'trade-school', seq: 8, week: 2 }, state, t),
    ).toContain('Trade School');
    expect(
      logLine({ type: 'EconomyTicked', econ: 1000, phase: 'boom', seq: 9, week: 2 }, state, t),
    ).toContain('booming');
    expect(logLine({ type: 'WeekAdvanced', week: 3, seq: 10 }, state, t)).toContain('Week 3');
    expect(logLine({ type: 'Relaxed', seat: 0, seq: 11, week: 3 }, state, t)).toContain('relaxed');
    expect(logLine({ type: 'GoalMet', seat: 0, goal: 'wealth', seq: 12, week: 3 }, state, t)).toBe(
      'GoalMet',
    );
  });
});

describe('ring keys and distances', () => {
  it('covers all 16 squares', () => {
    expect(RING_KEYS).toHaveLength(16);
    expect(ringKeyFor(0)).toBe('1');
    expect(ringKeyFor(10)).toBe('Q');
    expect(ringKeyFor(99)).toBe('');
  });

  it('measures ring distance both ways', () => {
    expect(stepsBetween(pack, 'low-housing', 'low-housing')).toBe(0);
    expect(stepsBetween(pack, 'low-housing', 'rent-office')).toBe(1);
    expect(stepsBetween(pack, 'low-housing', 'park')).toBe(1);
    expect(stepsBetween(pack, 'nowhere', 'park')).toBe(0);
  });
});
