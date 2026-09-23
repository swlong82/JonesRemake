/**
 * Metrics aggregation (BALANCE_SPEC 9.2). `summarize` is deterministic for a given result set
 * (results are sorted by seed; timing lives in a separate `perf` object).
 */
import type { GameResult } from './runner.js';

export interface Quantiles {
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
}

export function quantiles(values: number[]): Quantiles {
  if (values.length === 0) return { min: 0, p10: 0, median: 0, p90: 0, max: 0, mean: 0 };
  const s = [...values].sort((a, b) => a - b);
  const q = (f: number): number => s[Math.min(s.length - 1, Math.floor(f * s.length))]!;
  const mean = Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100;
  return { min: s[0]!, p10: q(0.1), median: q(0.5), p90: q(0.9), max: s[s.length - 1]!, mean };
}

export interface Summary {
  runId: string;
  games: number;
  decided: number;
  length: Quantiles;
  stallRate: number;
  bankruptcyRate: number;
  winnerSeat: Record<string, number>;
  /** First-seat win share among decided games, in percent. */
  firstSeatWinPct: number;
  winnerDifficulty: Record<string, number>;
  /** Percent of decided games won by each difficulty (always lists easy/normal/hard). */
  winnerDifficultyPct: Record<string, number>;
  winnerPersonality: Record<string, number>;
  winnerBot: Record<string, number>;
  /** Share (percent of decided games) in which each goal was the last completed. */
  lastGoalPct: Record<string, number>;
  jobTierHistogram: Record<string, number>;
  degreesAtEnd: Quantiles;
  wealthP50ByWeek: number[];
  eventsPer100PlayerWeeks: Record<string, number>;
  /** Percent of decided games whose winner holds every degree (education-only path completes). */
  winnerAllDegreesPct: number;
  collapseGamePct: number;
  /** Per-seat win percent for bot seats, keyed by bot id. */
  botWinPct: Record<string, number>;
  /** Percent of a bot's own seat-games that ended bankrupt (BALANCE 9.5 CryptoAllIn). */
  botBankruptcyPct: Record<string, number>;
  /** Percent of a bot's own seat-games with at least one collapse (9.5 NoRelax). */
  botCollapsePct: Record<string, number>;
  /** Percent of a bot's own seat-games in which it defaulted on a loan (9.5 LoanMax). */
  botDefaultPct: Record<string, number>;
}

export interface Perf {
  msPerGame: Quantiles;
  totalMs: number;
  commandsPerGame: number;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((10_000 * n) / d) / 100;
}

function inc(rec: Record<string, number>, key: string, by = 1): void {
  rec[key] = (rec[key] ?? 0) + by;
}

function sortKeys<T>(rec: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).sort(([a], [b]) => a.localeCompare(b)));
}

export function summarize(
  runId: string,
  resultsIn: GameResult[],
  degreeCount: number,
): { summary: Summary; perf: Perf } {
  const results = [...resultsIn].sort((a, b) => a.seed.localeCompare(b.seed));
  const decided = results.filter((r) => r.winner !== null);
  const winnerSeat: Record<string, number> = {};
  const winnerDifficulty: Record<string, number> = { easy: 0, normal: 0, hard: 0 };
  const winnerPersonality: Record<string, number> = {};
  const winnerBot: Record<string, number> = {};
  const lastGoal: Record<string, number> = { wealth: 0, happiness: 0, education: 0, career: 0 };
  const jobTier: Record<string, number> = {};
  const events: Record<string, number> = {};
  const botGames: Record<
    string,
    { games: number; wins: number; bankrupt: number; collapse: number; defaulted: number }
  > = {};
  let bankrupt = 0;
  let allDegrees = 0;
  let collapseGames = 0;
  let playerWeeks = 0;
  const degrees: number[] = [];
  const maxWeek = Math.max(0, ...results.map((r) => r.wealthByWeek.length));
  const wealthCols: number[][] = Array.from({ length: maxWeek }, () => []);
  for (const r of results) {
    playerWeeks += r.playerWeeks;
    for (const [fam, n] of Object.entries(r.eventsByFamily)) inc(events, fam, n);
    if (r.seats.some((s) => s.bankrupt)) bankrupt++;
    if (r.seats.some((s) => s.collapses > 0)) collapseGames++;
    for (const s of r.seats) {
      degrees.push(s.degrees);
      inc(jobTier, s.jobTier < 0 ? 'none' : `tier${s.jobTier}`);
      if (s.spec.kind === 'bot') {
        const b = (botGames[s.spec.bot] ??= {
          games: 0,
          wins: 0,
          bankrupt: 0,
          collapse: 0,
          defaulted: 0,
        });
        b.games++;
        if (r.winner === s.seat) b.wins++;
        if (s.bankrupt) b.bankrupt++;
        if (s.collapses > 0) b.collapse++;
        if (s.defaulted) b.defaulted++;
      }
    }
    r.wealthByWeek.forEach((w, i) => wealthCols[i]!.push(w));
    if (r.winner === null) continue;
    inc(winnerSeat, `seat${r.winner}`);
    const w = r.seats[r.winner]!;
    if (w.spec.kind === 'ai') {
      inc(winnerDifficulty, w.spec.difficulty);
      inc(winnerPersonality, w.spec.personality);
    } else inc(winnerBot, w.spec.bot);
    // Goals that land in the same week share the credit (ADR-0040): a fixed tie-break order
    // would hand every tie to the earliest goal in the list and never to career.
    if (r.goalWeeks) {
      const weeks = r.goalWeeks;
      const last = Math.max(weeks.wealth, weeks.happiness, weeks.education, weeks.career);
      const tied = (Object.keys(weeks) as (keyof typeof weeks)[]).filter((g) => weeks[g] === last);
      for (const g of tied) lastGoal[g] = (lastGoal[g] ?? 0) + 1 / tied.length;
    } else if (r.lastGoal) inc(lastGoal, r.lastGoal);
    if (w.degrees >= degreeCount) allDegrees++;
  }
  const summary: Summary = {
    runId,
    games: results.length,
    decided: decided.length,
    length: quantiles(decided.map((r) => r.weeks)),
    stallRate: pct(results.length - decided.length, results.length),
    bankruptcyRate: pct(bankrupt, results.length),
    winnerSeat: sortKeys(winnerSeat),
    firstSeatWinPct: pct(winnerSeat.seat0 ?? 0, decided.length),
    winnerDifficulty: sortKeys(winnerDifficulty),
    winnerDifficultyPct: sortKeys(
      Object.fromEntries(
        Object.entries(winnerDifficulty).map(([k, v]) => [k, pct(v, decided.length)]),
      ),
    ),
    winnerPersonality: sortKeys(winnerPersonality),
    winnerBot: sortKeys(winnerBot),
    lastGoalPct: sortKeys(
      Object.fromEntries(Object.entries(lastGoal).map(([k, v]) => [k, pct(v, decided.length)])),
    ),
    jobTierHistogram: sortKeys(jobTier),
    degreesAtEnd: quantiles(degrees),
    wealthP50ByWeek: wealthCols.map((c) => quantiles(c).median),
    eventsPer100PlayerWeeks: sortKeys(
      Object.fromEntries(
        Object.entries(events).map(([k, v]) => [
          k,
          playerWeeks === 0 ? 0 : Math.round((10_000 * v) / playerWeeks) / 100,
        ]),
      ),
    ),
    winnerAllDegreesPct: pct(allDegrees, decided.length),
    collapseGamePct: pct(collapseGames, results.length),
    botWinPct: sortKeys(
      Object.fromEntries(Object.entries(botGames).map(([k, v]) => [k, pct(v.wins, v.games)])),
    ),
    botBankruptcyPct: sortKeys(
      Object.fromEntries(Object.entries(botGames).map(([k, v]) => [k, pct(v.bankrupt, v.games)])),
    ),
    botCollapsePct: sortKeys(
      Object.fromEntries(Object.entries(botGames).map(([k, v]) => [k, pct(v.collapse, v.games)])),
    ),
    botDefaultPct: sortKeys(
      Object.fromEntries(Object.entries(botGames).map(([k, v]) => [k, pct(v.defaulted, v.games)])),
    ),
  };
  const perf: Perf = {
    msPerGame: quantiles(results.map((r) => Math.round(r.ms))),
    totalMs: Math.round(results.reduce((a, r) => a + r.ms, 0)),
    commandsPerGame:
      results.length === 0
        ? 0
        : Math.round(results.reduce((a, r) => a + r.commands, 0) / results.length),
  };
  return { summary, perf };
}

/** Resolve a dotted metric path on the summary (e.g. `length.median`, `lastGoalPct.career`). */
export function metric(summary: Summary, path: string): number | undefined {
  let cur: unknown = summary;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'number' ? cur : undefined;
}
