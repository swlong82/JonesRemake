import { describe, expect, it } from 'vitest';
import {
  baselineJson,
  baselineMarkdown,
  buildBaseline,
  buildRow,
  evaluate93,
  parseRunId,
  sortRows,
  type StagePerf,
  type StageSummary,
} from './baseline.js';

function spread(median: number) {
  return {
    min: median - 5,
    p10: median - 3,
    median,
    p90: median + 10,
    max: median + 50,
    mean: median,
  };
}

function summary(runId: string, patch: Partial<StageSummary> = {}): StageSummary {
  return {
    runId,
    games: 200,
    decided: 200,
    length: spread(45),
    stallRate: 0,
    bankruptcyRate: 70,
    firstSeatWinPct: 50,
    lastGoalPct: { career: 12, education: 40, happiness: 18, wealth: 30 },
    degreesAtEnd: spread(6),
    winnerAllDegreesPct: 100,
    ...patch,
  };
}

const perf: StagePerf = { msPerGame: spread(150), commandsPerGame: 1300, wallMs: 60_000 };

/** The four Normal×2 configs the 9.3 gates read, with growing medians. */
function healthyRuns(): { summary: StageSummary; perf: StagePerf }[] {
  return [
    { summary: summary('classic-30-normal-2', { length: spread(30) }), perf },
    { summary: summary('classic-50-normal-2'), perf },
    { summary: summary('classic-80-normal-2', { length: spread(84) }), perf },
    { summary: summary('classic-100-normal-2', { length: spread(120) }), perf },
  ];
}

describe('parseRunId', () => {
  it('reads goals, AI tier and seats', () => {
    expect(parseRunId('classic-50-normal-2')).toEqual({ goals: 50, ai: 'normal', seats: 2 });
    expect(parseRunId('classic-100-hard-4')).toEqual({ goals: 100, ai: 'hard', seats: 4 });
    expect(parseRunId('junk')).toEqual({ goals: 0, ai: '', seats: 0 });
  });
});

describe('buildRow', () => {
  it('keeps the metrics 9.3 names and the median cost per game', () => {
    const row = buildRow(summary('classic-50-normal-2'), perf);
    expect(row).toMatchObject({
      id: 'classic-50-normal-2',
      goals: 50,
      seats: 2,
      games: 200,
      stallRate: 0,
      firstSeatWinPct: 50,
      degreesMedian: 6,
      msPerGameMedian: 150,
    });
    expect(row.weeks).toEqual({ p10: 42, median: 45, p90: 55 });
  });
});

describe('sortRows', () => {
  it('orders by goal level, then AI tier, then seats', () => {
    const rows = [
      'classic-50-hard-2',
      'classic-30-normal-4',
      'classic-50-easy-4',
      'classic-30-normal-2',
    ].map((id) => buildRow(summary(id), perf));
    expect(sortRows(rows).map((r) => r.id)).toEqual([
      'classic-30-normal-2',
      'classic-30-normal-4',
      'classic-50-easy-4',
      'classic-50-hard-2',
    ]);
  });
});

describe('evaluate93', () => {
  it('passes every gate on healthy numbers except the documented speed gate', () => {
    const b = buildBaseline(healthyRuns(), { pack: 'classic', engineVersion: '0.1.0' });
    const failed = b.gates.filter((g) => !g.pass);
    expect(failed).toEqual([]);
  });

  it('fails the stall, monotonic, seat-bias, last-goal, speed and degree gates when the numbers do', () => {
    const runs = [
      { summary: summary('classic-30-normal-2', { length: spread(60) }), perf },
      {
        summary: summary('classic-50-normal-2', {
          length: spread(45),
          stallRate: 3,
          firstSeatWinPct: 61,
          lastGoalPct: { career: 0, education: 68, happiness: 0, wealth: 32 },
        }),
        perf: { ...perf, msPerGame: spread(900) },
      },
      { summary: summary('classic-80-normal-2', { length: spread(84) }), perf },
      {
        summary: summary('classic-100-normal-2', { length: spread(120), winnerAllDegreesPct: 40 }),
        perf,
      },
    ];
    const gates = evaluate93(sortRows(runs.map((r) => buildRow(r.summary, r.perf))));
    const failed = gates.filter((g) => !g.pass).map((g) => g.gate);
    expect(failed).toContain('Stall rate at goals 50 Normal×2');
    expect(failed).toContain('Median length grows with goal level');
    expect(failed).toContain('Seat bias Normal×2 (goals 50)');
    expect(failed).toContain('Goal last-completed: career (goals 50)');
    expect(failed).toContain('Goal last-completed: happiness (goals 50)');
    expect(failed).toContain('Sim speed, Normal AI');
    expect(failed).toContain('Education path completes at goals 100');
    expect(failed).not.toContain('Goal last-completed: education (goals 50)');
  });

  it('reports n/a rather than throwing when a config is missing', () => {
    const gates = evaluate93([]);
    expect(gates.some((g) => g.achieved.includes('n/a'))).toBe(true);
    expect(gates.every((g) => !g.pass)).toBe(true);
  });
});

describe('report output', () => {
  it('writes deterministic JSON with every config', () => {
    const b = buildBaseline(healthyRuns(), {
      pack: 'classic',
      engineVersion: '0.1.0',
      conditions: '8 workers, idle box',
    });
    const json = baselineJson(b);
    expect(json.endsWith('\n')).toBe(true);
    expect(baselineJson(b)).toBe(json);
    expect(JSON.parse(json)).toMatchObject({ pack: 'classic', gamesTotal: 800 });
  });

  it('writes a markdown table per config and a gate table', () => {
    const b = buildBaseline(healthyRuns(), { pack: 'classic', engineVersion: '0.1.0' });
    const md = baselineMarkdown(b, '2026-09-17');
    expect(md).toContain('# Baseline report — classic');
    expect(md).toContain('`classic-50-normal-2`');
    expect(md).toContain('## Stage-1 sanity gates (9.3)');
    expect(md).toContain('Measurement conditions: unrecorded');
    expect(md).toContain('None: every 9.3 gate passes on these numbers.');
  });

  it('lists unmet targets when a gate fails', () => {
    const runs = healthyRuns();
    runs[1] = {
      summary: summary('classic-50-normal-2', {
        lastGoalPct: { career: 0, education: 68, happiness: 0, wealth: 32 },
      }),
      perf,
    };
    const md = baselineMarkdown(
      buildBaseline(runs, { pack: 'classic', engineVersion: '0.1.0' }),
      '2026-09-17',
    );
    expect(md).toContain('**Goal last-completed: career (goals 50)**');
    expect(md).toContain('FAIL');
  });
});
