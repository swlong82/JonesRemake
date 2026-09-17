#!/usr/bin/env tsx
/** Initial JS+CSS gzip budget (PRD 2.5: ≤ 350 kB; music engine must be a lazy chunk). */
import { resolve } from 'node:path';
import { checkBudget } from './lib/budget.js';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v !== undefined && v !== '' ? v : fallback;
};
const maxKb = Number(opt('max-gzip-kb', '350'));
const dist = resolve(import.meta.dirname, '..', opt('dist', 'apps/web/dist'));

const r = checkBudget(dist, maxKb);
for (const f of r.files) console.log(`  ${f.kb.toFixed(1).padStart(8)} kB  ${f.file}`);
console.log(
  `budget — initial gzip ${r.totalKb.toFixed(1)} kB / ${maxKb} kB → ${r.ok ? 'OK' : 'FAIL'}`,
);
process.exit(r.ok ? 0 : 1);
