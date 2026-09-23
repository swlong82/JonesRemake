import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  lockedHashFrom,
  sha256,
  targetProblems,
  toleranceBand,
  type ModernTargets,
} from './targets.js';

const root = join(import.meta.dirname, '..', '..');
const TARGETS = 'reports/modern-targets.json';
const BASELINE = 'reports/baseline.json';
const ADR = 'ADR-0042';

const targetsBytes = readFileSync(join(root, TARGETS));
const targets = JSON.parse(targetsBytes.toString('utf8')) as ModernTargets;
const decisions = readFileSync(join(root, 'DECISIONS.md'), 'utf8');

describe('lockedHashFrom', () => {
  it('reads the hash out of the named ADR only', () => {
    const md = [
      '## ADR-0001: something else',
      '',
      `- Locked sha256 (${TARGETS}): \`${'a'.repeat(64)}\``,
      '',
      '## ADR-0033: the lock',
      '',
      `- Locked sha256 (${TARGETS}): \`${'b'.repeat(64)}\``,
      '',
      '## ADR-0034: after',
      '',
    ].join('\n');
    expect(lockedHashFrom(md, 'ADR-0033', TARGETS)).toBe('b'.repeat(64));
    expect(lockedHashFrom(md, 'ADR-9999', TARGETS)).toBeNull();
    expect(lockedHashFrom('## ADR-0033: no hash here', 'ADR-0033', TARGETS)).toBeNull();
  });
});

describe('toleranceBand', () => {
  it('rounds a ±20% band outward to whole weeks', () => {
    expect(toleranceBand(28)).toEqual({ min: 22, max: 34 });
    expect(toleranceBand(40)).toEqual({ min: 32, max: 48 });
    expect(toleranceBand(83)).toEqual({ min: 66, max: 100 });
  });
});

describe('targetProblems', () => {
  it('names a median band that is not the baseline ±20%', () => {
    const bad = {
      targets: [{ id: 'median-50', min: 35, max: 45 }],
    } as unknown as ModernTargets;
    expect(targetProblems(bad, { '50': 40 })).toEqual([
      'median-50 band 35–45 is not ±20% of B=40 (32–48)',
    ]);
  });

  it('names a boundless or inverted target and a duplicate id', () => {
    const bad = {
      targets: [{ id: 'stall' }, { id: 'stall', min: 5, max: 1 }],
    } as unknown as ModernTargets;
    expect(targetProblems(bad, {})).toEqual([
      'stall has no bound',
      'duplicate target id stall',
      'stall has min > max',
    ]);
  });
});

// BALANCE_SPEC 9.5: "CC writes `reports/modern-targets.json` ... and MUST NOT edit it after first
// commit (enforced by test comparing file hash to the one recorded in DECISIONS.md)."
describe(`M6.2: ${TARGETS} is locked`, () => {
  it('hashes to the value recorded in the ADR', () => {
    expect(lockedHashFrom(decisions, ADR, TARGETS)).toBe(sha256(targetsBytes));
  });

  it('records the baseline it was derived from, by hash', () => {
    expect(targets.derivedFrom.file).toBe(BASELINE);
    expect(targets.derivedFrom.sha256).toBe(sha256(readFileSync(join(root, BASELINE))));
  });

  it('states every BALANCE 9.5 gate with a bound, and median bands that are the baseline ±20%', () => {
    expect(targetProblems(targets, targets.baseline.medianLengthByGoal)).toEqual([]);
    expect(targets.pack).toBe('modern-western');
    expect(targets.targets.length).toBeGreaterThanOrEqual(14);
  });

  it('takes its baseline medians from the classic Normal×2 rows', () => {
    const baseline = JSON.parse(readFileSync(join(root, BASELINE), 'utf8')) as {
      rows: { id: string; weeks: { median: number } }[];
    };
    for (const [goals, median] of Object.entries(targets.baseline.medianLengthByGoal)) {
      const row = baseline.rows.find((r) => r.id === `classic-${goals}-normal-2`);
      expect(row?.weeks.median).toBe(median);
    }
  });
});
