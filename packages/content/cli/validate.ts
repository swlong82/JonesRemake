#!/usr/bin/env tsx
/**
 * Pack validator CLI (CONTENT_SCHEMAS 6.1, BUILD_READINESS 15.2 `content:validate`).
 *
 *   tsx packages/content/cli/validate.ts --all
 *   tsx packages/content/cli/validate.ts packs/classic
 *
 * STUB — validates `pack.json` only. M2 extends this to every file in 6.1 plus cross-file rules.
 * `_template` is validated like any other pack so the overlay skeleton can never rot.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validatePackManifest } from '../src/index.js';

const packsDir = resolve(import.meta.dirname, '..', 'packs');
const args = process.argv.slice(2);

const targets = args.includes('--all')
  ? readdirSync(packsDir)
      .filter((d) => statSync(join(packsDir, d)).isDirectory())
      .map((d) => join(packsDir, d))
  : args.filter((a) => !a.startsWith('--')).map((a) => resolve(a));

let failed = 0;
for (const dir of targets) {
  const manifestPath = join(dir, 'pack.json');
  if (!existsSync(manifestPath)) {
    console.error(`✗ ${dir}: missing pack.json`);
    failed++;
    continue;
  }
  const result = validatePackManifest(JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown);
  if (result.ok) {
    console.log(`✓ ${result.manifest.id}@${result.manifest.version} (${dir})`);
  } else {
    failed++;
    console.error(`✗ ${dir}`);
    for (const issue of result.issues)
      console.error(`    ${issue.path || '<root>'}: ${issue.message}`);
  }
}
console.log(`content:validate — ${targets.length} pack(s), ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
