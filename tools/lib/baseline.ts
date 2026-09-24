/**
 * Baseline report builder (BALANCE_SPEC 9.3, M3.3): turns the stage-1 suite's per-config
 * `summary.json` + `perf.json` into machine-readable `reports/baseline.json` and a human
 * `BASELINE_REPORT.md`. Pure functions over parsed JSON so the shaping is unit-tested; the CLI
 * (`tools/baseline-report.ts`) does the I/O.
 */

export interface Spread {
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
}

export interface StageSummary {
  runId: string;
  games: number;
  decided: number;
  length: Spread;
  stallRate: number;
  bankruptcyRate: number;
  firstSeatWinPct: number;
  lastGoalPct: Record<string, number>;
  degreesAtEnd: Spread;
  winnerAllDegreesPct: number;
  eventsPer100PlayerWeeks?: number;
  collapseGamePct?: number;
  jobTierHistogram?: Record<string, number>;
}

export interface StagePerf {
  msPerGame: Spread;
  commandsPerGame: number;
  wallMs: number;
}

export interface BaselineRow {
  id: string;
  goals: number;
  ai: string;
  seats: number;
  games: number;
  weeks: { p10: number; median: number; p90: number };
  stallRate: number;
  bankruptcyRate: number;
  firstSeatWinPct: number;
  lastGoalPct: Record<string, number>;
  degreesMedian: number;
  winnerAllDegreesPct: number;
  msPerGameMedian: number;
}

/** `classic-50-normal-2` → goals 50, Normal AI, 2 seats. */
export function parseRunId(runId: string): { goals: number; ai: string; seats: number } {
  const parts = runId.split('-');
  const seats = Number(parts.at(-1));
  const ai = parts.at(-2) ?? '';
  const goals = Number(parts.at(-3));
  return {
    goals: Number.isFinite(goals) ? goals : 0,
    ai,
    seats: Number.isFinite(seats) ? seats : 0,
  };
}

export function buildRow(summary: StageSummary, perf: StagePerf): BaselineRow {
  const { goals, ai, seats } = parseRunId(summary.runId);
  return {
    id: summary.runId,
    goals,
    ai,
    seats,
    games: summary.games,
    weeks: { p10: summary.length.p10, median: summary.length.median, p90: summary.length.p90 },
    stallRate: summary.stallRate,
    bankruptcyRate: summary.bankruptcyRate,
    firstSeatWinPct: summary.firstSeatWinPct,
    lastGoalPct: summary.lastGoalPct,
    degreesMedian: summary.degreesAtEnd.median,
    winnerAllDegreesPct: summary.winnerAllDegreesPct,
    msPerGameMedian: perf.msPerGame.median,
  };
}

/** Rows sorted by goal level, then AI tier (easy → normal → hard), then seats. */
export function sortRows(rows: BaselineRow[]): BaselineRow[] {
  const tier = (ai: string): number => ['easy', 'normal', 'hard'].indexOf(ai);
  return [...rows].sort(
    (a, b) => a.goals - b.goals || tier(a.ai) - tier(b.ai) || a.seats - b.seats,
  );
}

export interface GateCheck {
  gate: string;
  target: string;
  achieved: string;
  pass: boolean;
  note?: string;
}

/** The BALANCE 9.3 stage-1 sanity gates, evaluated against the baseline rows. */
export function evaluate93(rows: BaselineRow[]): GateCheck[] {
  const by = (id: string): BaselineRow | undefined => rows.find((r) => r.id === id);
  const out: GateCheck[] = [];
  const n50 = by('classic-50-normal-2');
  const num = (v: number | undefined): string => (v === undefined ? 'n/a' : v.toString());

  out.push({
    gate: 'Stall rate at goals 50 Normal×2',
    target: '< 0.5%',
    achieved: `${num(n50?.stallRate)}%`,
    pass: (n50?.stallRate ?? 100) < 0.5,
  });

  const medians = [30, 50, 80, 100].map((g) => by(`classic-${g}-normal-2`)?.weeks.median ?? 0);
  const monotonic = medians.every((m, i) => i === 0 || m > (medians[i - 1] ?? 0));
  out.push({
    gate: 'Median length grows with goal level',
    target: '30 < 50 < 80 < 100',
    achieved: medians.join(' < '),
    pass: monotonic,
  });

  // Seat bias is turn order alone, so it is read from the one personality against itself when that
  // run exists (ADR-0044); the Normal×2 rows pair two different personalities.
  const seat = by('seatbias-classic-50-normal-2') ?? n50;
  out.push({
    gate:
      seat === n50
        ? 'Seat bias Normal×2 (goals 50)'
        : 'Seat bias Normal×2 (goals 50, Balanced vs Balanced)',
    target: 'first seat 45–55%',
    achieved: `${num(seat?.firstSeatWinPct)}%`,
    pass: (seat?.firstSeatWinPct ?? 0) >= 45 && (seat?.firstSeatWinPct ?? 0) <= 55,
  });

  for (const goal of ['wealth', 'happiness', 'education', 'career']) {
    const pct = n50?.lastGoalPct[goal] ?? 0;
    out.push({
      gate: `Goal last-completed: ${goal} (goals 50)`,
      target: '≥ 10% of games',
      achieved: `${pct}%`,
      pass: pct >= 10,
    });
  }

  const normalMs = rows.filter((r) => r.ai === 'normal').map((r) => r.msPerGameMedian);
  const worstMs = normalMs.length > 0 ? Math.max(...normalMs) : undefined;
  out.push({
    gate: 'Sim speed, Normal AI',
    target: '< 200 ms/game median',
    achieved: worstMs === undefined ? 'n/a' : `${worstMs} ms (worst Normal config)`,
    pass: worstMs !== undefined && worstMs < 200,
    note: 'ADR-0016: the spec-sized AI beam costs ~1 s/game; sample sizes were reduced instead.',
  });

  const n100 = by('classic-100-normal-2');
  out.push({
    gate: 'Education path completes at goals 100',
    target: '≥ 99% of stall-free games',
    achieved: `${num(n100?.winnerAllDegreesPct)}%`,
    pass: (n100?.winnerAllDegreesPct ?? 0) >= 99,
  });

  return out;
}

export interface Baseline {
  spec: string;
  pack: string;
  engineVersion: string;
  /** How the run was measured; timing metrics are only meaningful with this. */
  conditions: string;
  gamesTotal: number;
  rows: BaselineRow[];
  gates: GateCheck[];
}

export function buildBaseline(
  runs: { summary: StageSummary; perf: StagePerf }[],
  meta: { pack: string; engineVersion: string; conditions?: string },
): Baseline {
  const rows = sortRows(runs.map((r) => buildRow(r.summary, r.perf)));
  return {
    spec: 'BALANCE_SPEC 9.3 stage-1',
    pack: meta.pack,
    engineVersion: meta.engineVersion,
    conditions: meta.conditions ?? 'unrecorded',
    gamesTotal: rows.reduce((a, r) => a + r.games, 0),
    rows,
    gates: evaluate93(rows),
  };
}

/** Deterministic JSON (stable key order, newline-terminated) for committing. */
export function baselineJson(baseline: Baseline): string {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

function goalCell(row: BaselineRow): string {
  return ['wealth', 'happiness', 'education', 'career']
    .map((g) => `${g[0]?.toUpperCase() ?? ''}${row.lastGoalPct[g] ?? 0}`)
    .join(' ');
}

export function baselineMarkdown(baseline: Baseline, date: string): string {
  const head = [
    '# Baseline report — classic',
    '',
    `Stage-1 suite (BALANCE_SPEC 9.3) for pack \`${baseline.pack}\`, engine ${baseline.engineVersion}.`,
    `${baseline.rows.length} configs, ${baseline.gamesTotal} games, generated ${date} by`,
    '`pnpm baseline` from `reports/stage1/*/summary.json`. Machine-readable copy:',
    '`reports/baseline.json`. Game counts are reduced per ADR-0016, so rates carry roughly ±3–5 pp',
    'of sampling error and medians ±2 weeks.',
    '',
    `Measurement conditions: ${baseline.conditions}. Only \`ms/game\` depends on them; every other`,
    'metric is deterministic for these seeds.',
    '',
    '## B(metric, config)',
    '',
    '| Config | Games | Weeks p10/median/p90 | Stall % | Seat 0 win % | Bankrupt % | Degrees median | Last goal % (W/H/E/C) | ms/game |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  const body = baseline.rows.map(
    (r) =>
      `| \`${r.id}\` | ${r.games} | ${r.weeks.p10} / ${r.weeks.median} / ${r.weeks.p90} | ${r.stallRate} | ${r.firstSeatWinPct} | ${r.bankruptcyRate} | ${r.degreesMedian} | ${goalCell(r)} | ${r.msPerGameMedian} |`,
  );
  const gates = [
    '',
    '## Stage-1 sanity gates (9.3)',
    '',
    '| Gate | Target | Achieved | Result |',
    '| --- | --- | --- | --- |',
    ...baseline.gates.map(
      (g) =>
        `| ${g.gate} | ${g.target} | ${g.achieved} | ${g.pass ? 'pass' : 'FAIL'}${g.note === undefined ? '' : ` — ${g.note}`} |`,
    ),
  ];
  const failed = baseline.gates.filter((g) => !g.pass);
  const tail = [
    '',
    '## Unmet targets',
    '',
    failed.length === 0
      ? 'None: every 9.3 gate passes on these numbers.'
      : failed
          .map((g) => `- **${g.gate}** — target ${g.target}, achieved ${g.achieved}.`)
          .join('\n'),
    '',
    'Unmet targets are recorded here per the stuck policy (CLAUDE.md 1.5) and tracked in',
    '`KNOWN_ISSUES.md`; the CI gate keeps asserting them (`pnpm sim:gate --strict`, ADR-0019).',
    '',
  ];
  return [...head, ...body, ...gates, ...tail].join('\n');
}
