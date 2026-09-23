#!/usr/bin/env tsx
/**
 * Writes BASELINE_REPORT.md and reports/baseline.json from a stage-1 sim run (M3.3).
 *
 *   pnpm baseline [--in reports/stage1] [--pack classic]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  baselineJson,
  baselineMarkdown,
  buildBaseline,
  type StagePerf,
  type StageSummary,
} from './lib/baseline.js';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v !== undefined && v !== '' ? v : fallback;
};

const root = resolve(import.meta.dirname, '..');
const inDir = resolve(root, opt('in', 'reports/stage1'));
const pack = opt('pack', 'classic');
const date = opt('date', new Date().toISOString().slice(0, 10));
const conditions = opt(
  'conditions',
  '2 sim workers on a shared 4-core sandbox, other build tasks running',
);

/** Engine version, read from source rather than imported: tools does not depend on the engine. */
function engineVersion(): string {
  const src = readFileSync(resolve(root, 'packages/engine/src/core/version.ts'), 'utf8');
  return /ENGINE_VERSION = '([^']+)'/.exec(src)?.[1] ?? 'unknown';
}

const runs = readdirSync(inDir, { withFileTypes: true })
  // `seatbias-<pack>-…` is the same-personality run the seat-bias gate reads (ADR-0044).
  .filter(
    (e) =>
      e.isDirectory() && (e.name.startsWith(`${pack}-`) || e.name.startsWith(`seatbias-${pack}-`)),
  )
  .map((e) => ({
    summary: JSON.parse(readFileSync(join(inDir, e.name, 'summary.json'), 'utf8')) as StageSummary,
    perf: JSON.parse(readFileSync(join(inDir, e.name, 'perf.json'), 'utf8')) as StagePerf,
  }));

if (runs.length === 0) {
  console.error(`baseline — no ${pack} runs found in ${inDir}; run the stage-1 suite first.`);
  process.exit(1);
}

const baseline = buildBaseline(runs, { pack, engineVersion: engineVersion(), conditions });
mkdirSync(resolve(root, 'reports'), { recursive: true });
writeFileSync(resolve(root, 'reports/baseline.json'), baselineJson(baseline));
writeFileSync(resolve(root, 'BASELINE_REPORT.md'), baselineMarkdown(baseline, date));

const failed = baseline.gates.filter((g) => !g.pass);
for (const g of baseline.gates) {
  console.log(`  ${g.pass ? '✓' : '✗'} ${g.gate}: ${g.achieved} (target ${g.target})`);
}
console.log(
  `baseline — ${baseline.rows.length} configs, ${baseline.gamesTotal} games, ${failed.length} unmet 9.3 target(s) → BASELINE_REPORT.md, reports/baseline.json`,
);
