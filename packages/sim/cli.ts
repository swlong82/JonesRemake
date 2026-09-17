#!/usr/bin/env tsx
/**
 * Sim CLI (BALANCE_SPEC 9.1, BUILD_READINESS 15.2).
 *
 *   pnpm sim -- --pack classic --games 10000 --seats 2 --ai normal,normal --goals 50 --seed-base baseline --out reports/classic-50
 *   pnpm sim -- --config sim/gates.json [--games 500] [--assert] [--out reports/gates]
 *   pnpm sim:smoke  (200 games, 2 seats Normal, goals 50)
 *
 * Writes `summary.json` (deterministic), `perf.json`, `games.csv`, `report.md` per run.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPack } from '@hustle-ring/content';
import {
  evaluateGates,
  gameSpecs,
  gamesCsv,
  gateRunSpec,
  parseGatesFile,
  parseSeats,
  reportMd,
  runAll,
  summarize,
  summaryJson,
  type RunSpec,
  type Summary,
} from './src/index.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const num = (name: string, fallback: number): number => {
  const v = flag(name);
  return v === undefined ? fallback : Number(v);
};

const workers = flag('workers') ? Number(flag('workers')) : undefined;
const outDir = flag('out');

function progress(label: string) {
  let last = -1;
  return (done: number, total: number): void => {
    const pctDone = Math.floor((100 * done) / total);
    if (pctDone !== last && (pctDone % 10 === 0 || done === total)) {
      last = pctDone;
      process.stdout.write(`  ${label}: ${done}/${total} (${pctDone}%)\n`);
    }
  };
}

async function runOne(run: RunSpec, dir: string | undefined): Promise<Summary> {
  const pack = loadPack(run.packId);
  const t0 = performance.now();
  const results = await runAll(gameSpecs(run), {
    ...(workers !== undefined ? { workers } : {}),
    onProgress: progress(run.id),
  });
  const { summary, perf } = summarize(run.id, results, pack.degrees.length);
  const wall = Math.round(performance.now() - t0);
  console.log(
    `${run.id}: ${summary.games} games, median ${summary.length.median} wk, stall ${summary.stallRate}%, seat0 ${summary.firstSeatWinPct}%, ${perf.msPerGame.median} ms/game (wall ${wall} ms)`,
  );
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'summary.json'), summaryJson(summary));
    writeFileSync(
      join(dir, 'perf.json'),
      `${JSON.stringify({ ...perf, wallMs: wall }, null, 2)}\n`,
    );
    writeFileSync(join(dir, 'games.csv'), gamesCsv(results));
    writeFileSync(join(dir, 'report.md'), reportMd(summary, perf, results, run.id));
  }
  return summary;
}

async function main(): Promise<number> {
  const configPath = flag('config');
  if (configPath) {
    const file = parseGatesFile(JSON.parse(readFileSync(resolve(configPath), 'utf8')) as unknown);
    const gamesOverride = flag('games') ? Number(flag('games')) : undefined;
    const summaries: Record<string, Summary> = {};
    for (const cfg of file.configs) {
      const pack = loadPack(cfg.pack);
      const run = gateRunSpec(
        cfg,
        gamesOverride ?? file.gamesPerConfig,
        pack.personalities.map((p) => p.id),
      );
      if (gamesOverride !== undefined) run.games = gamesOverride;
      summaries[cfg.id] = await runOne(run, outDir ? join(outDir, cfg.id) : undefined);
    }
    const outcomes = evaluateGates(file, summaries);
    const failed = outcomes.filter((o) => !o.pass);
    for (const o of outcomes) {
      console.log(
        `  ${o.pass ? '✓' : '✗'} ${o.id} ${o.metric}: ${o.achieved ?? 'n/a'} (target ${o.target})${o.note ? ` — ${o.note}` : ''}`,
      );
    }
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        join(outDir, 'gates.json'),
        `${JSON.stringify({ outcomes, summaries }, null, 2)}\n`,
      );
    }
    console.log(
      `sim:gate — ${file.configs.length} config(s), ${outcomes.length} assertion(s), ${failed.length} failed`,
    );
    if (has('assert') && failed.length > 0) return 1;
    return 0;
  }
  const packId = flag('pack') ?? 'classic';
  const pack = loadPack(packId);
  const seats = num('seats', 2);
  const run: RunSpec = {
    id: flag('id') ?? `${packId}-${num('goals', 50)}`,
    packId,
    games: num('games', 200),
    seedBase: flag('seed-base') ?? 'sim',
    seats: parseSeats(
      flag('ai') ?? 'normal',
      seats,
      pack.personalities.map((p) => p.id),
    ),
    goals: num('goals', 50),
    chaos: (flag('chaos') as RunSpec['chaos'] | undefined) ?? 'classic',
    stallWeek: num('stall-week', 300),
  };
  await runOne(run, outDir);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);
