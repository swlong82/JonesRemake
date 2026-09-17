/** Report writers (BALANCE_SPEC 9.1): summary.json, games.csv, report.md with ASCII histograms. */
import type { Perf, Summary } from './metrics.js';
import type { GameResult } from './runner.js';

export function summaryJson(summary: Summary): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

export function gamesCsv(results: GameResult[]): string {
  const rows = [...results].sort((a, b) => a.seed.localeCompare(b.seed));
  const head = [
    'seed',
    'weeks',
    'winner',
    'stalled',
    'lastGoal',
    'commands',
    ...(rows[0]?.seats.flatMap((_, i) => [
      `s${i}_wealth`,
      `s${i}_happiness`,
      `s${i}_education`,
      `s${i}_career`,
      `s${i}_degrees`,
      `s${i}_job`,
      `s${i}_netWorth`,
    ]) ?? []),
  ];
  const lines = rows.map((r) =>
    [
      r.seed,
      r.weeks,
      r.winner ?? '',
      r.stalled ? 1 : 0,
      r.lastGoal ?? '',
      r.commands,
      ...r.seats.flatMap((s) => [...s.goals, s.degrees, s.jobId ?? '', s.netWorth]),
    ].join(','),
  );
  return `${[head.join(','), ...lines].join('\n')}\n`;
}

export function histogram(values: number[], buckets = 10, width = 40): string {
  if (values.length === 0) return '(no data)\n';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const size = Math.max(1, Math.ceil((max - min + 1) / buckets));
  const counts = new Array<number>(buckets).fill(0);
  for (const v of values) counts[Math.min(buckets - 1, Math.floor((v - min) / size))]!++;
  const peak = Math.max(...counts, 1);
  return counts
    .map((c, i) => {
      const lo = min + i * size;
      const hi = Math.min(max, lo + size - 1);
      return `${String(lo).padStart(5)}–${String(hi).padEnd(5)} ${'#'.repeat(Math.round((c / peak) * width)).padEnd(width)} ${c}`;
    })
    .join('\n')
    .concat('\n');
}

function table(rows: (string | number)[][]): string {
  return rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
}

export function reportMd(
  summary: Summary,
  perf: Perf,
  results: GameResult[],
  title: string,
): string {
  const decided = results.filter((r) => r.winner !== null);
  const lines: string[] = [];
  lines.push(
    `# Sim report — ${title}`,
    '',
    `Games: ${summary.games} · decided: ${summary.decided} · stall rate: ${summary.stallRate}% · bankruptcy: ${summary.bankruptcyRate}%`,
    '',
  );
  lines.push(
    '## Game length (weeks)',
    '',
    table([
      ['min', 'p10', 'median', 'p90', 'max', 'mean'],
      ['---', '---', '---', '---', '---', '---'],
      [
        summary.length.min,
        summary.length.p10,
        summary.length.median,
        summary.length.p90,
        summary.length.max,
        summary.length.mean,
      ],
    ]),
    '',
    '```',
    histogram(decided.map((r) => r.weeks)).trimEnd(),
    '```',
    '',
  );
  lines.push(
    '## Winners',
    '',
    table([['Seat', 'Wins'], ['---', '---'], ...Object.entries(summary.winnerSeat)]),
    '',
    `First-seat win share: ${summary.firstSeatWinPct}%`,
    '',
  );
  if (Object.keys(summary.winnerDifficulty).length > 0)
    lines.push(
      table([['Difficulty', 'Wins'], ['---', '---'], ...Object.entries(summary.winnerDifficulty)]),
      '',
    );
  if (Object.keys(summary.winnerPersonality).length > 0)
    lines.push(
      table([
        ['Personality', 'Wins'],
        ['---', '---'],
        ...Object.entries(summary.winnerPersonality),
      ]),
      '',
    );
  if (Object.keys(summary.botWinPct).length > 0)
    lines.push(table([['Bot', 'Win %'], ['---', '---'], ...Object.entries(summary.botWinPct)]), '');
  lines.push(
    '## Last goal completed (percent of decided games)',
    '',
    table([['Goal', '%'], ['---', '---'], ...Object.entries(summary.lastGoalPct)]),
    '',
  );
  lines.push(
    '## Job tier at end (all seats)',
    '',
    table([['Tier', 'Seats'], ['---', '---'], ...Object.entries(summary.jobTierHistogram)]),
    '',
  );
  lines.push(
    '## Degrees at end (all seats)',
    '',
    table([
      ['min', 'p10', 'median', 'p90', 'max'],
      ['---', '---', '---', '---', '---'],
      [
        summary.degreesAtEnd.min,
        summary.degreesAtEnd.p10,
        summary.degreesAtEnd.median,
        summary.degreesAtEnd.p90,
        summary.degreesAtEnd.max,
      ],
    ]),
    '',
    `Winner holds every degree: ${summary.winnerAllDegreesPct}%`,
    '',
  );
  lines.push(
    '## Events per 100 player-weeks',
    '',
    table([['Family', 'Rate'], ['---', '---'], ...Object.entries(summary.eventsPer100PlayerWeeks)]),
    '',
  );
  lines.push(
    '## Seat 0 wealth goal, p50 by week',
    '',
    '```',
    summary.wealthP50ByWeek
      .slice(0, 60)
      .map((v, i) => `w${String(i + 1).padStart(3)} ${'#'.repeat(Math.min(60, v))} ${v}`)
      .join('\n'),
    '```',
    '',
  );
  lines.push(
    '## Performance',
    '',
    table([
      ['ms/game median', 'ms/game p90', 'total ms', 'commands/game'],
      ['---', '---', '---', '---'],
      [perf.msPerGame.median, perf.msPerGame.p90, perf.totalMs, perf.commandsPerGame],
    ]),
    '',
  );
  return `${lines.join('\n')}\n`;
}
