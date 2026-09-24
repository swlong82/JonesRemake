#!/usr/bin/env tsx
/**
 * `pnpm art:check` (ART_SPEC 17.8) — validates every set under `packages/art/sets/` against the
 * slot catalog of every bundled pack: schema, coverage, files, viewBox, sanitizer, tint keys,
 * board layout, theme contrast and byte budgets. `--report` adds drawn vs placeholder counts.
 */
import { resolve } from 'node:path';
import { validateArtSet } from '@hustle-ring/art';
import { catalogFromPacks, drawnReport, listSets, nodeParseXml, readSet } from './lib/art.js';

const setsDir = resolve(import.meta.dirname, '..', 'packages/art/sets');
const report = process.argv.includes('--report');
const { catalog, boardSizes } = catalogFromPacks();

let failed = 0;
const sets = listSets(setsDir);
if (!sets.includes('default')) {
  console.error('✗ packages/art/sets/default is missing (run pnpm art:placeholders)');
  failed++;
}
for (const id of sets) {
  const set = readSet(setsDir, id);
  const result = validateArtSet(set.manifest, {
    catalog,
    boardSizes,
    files: set.files,
    parseXml: nodeParseXml,
  });
  if (result.ok && result.manifest?.id !== id) {
    result.issues.push({ path: 'manifest.id', message: `must equal the folder name "${id}"` });
  }
  if (result.issues.length > 0) {
    failed++;
    console.error(`✗ ${id}: ${result.issues.length} issue(s)`);
    for (const i of result.issues) console.error(`    ${i.path}: ${i.message}`);
    continue;
  }
  console.log(
    `✓ ${id}: ${Object.keys(result.manifest!.assets).length} assets, ${set.files.size} files`,
  );
  if (report) {
    for (const row of drawnReport(result.manifest!, set.files, catalog)) {
      console.log(`    ${row.group.padEnd(9)} ${row.drawn}/${row.total} drawn`);
    }
  }
}
console.log(
  `art:check — ${sets.length} set(s), ${catalog.length} slots → ${failed === 0 ? 'OK' : 'FAIL'}`,
);
process.exit(failed === 0 ? 0 : 1);
