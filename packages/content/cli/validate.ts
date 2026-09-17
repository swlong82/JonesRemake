#!/usr/bin/env tsx
/**
 * Pack validator CLI (CONTENT_SCHEMAS 6.1, BUILD_READINESS 15.2 `content:validate`).
 *
 *   tsx packages/content/cli/validate.ts --all
 *   tsx packages/content/cli/validate.ts classic modern-western
 *
 * Validates every bundled pack (schemas, overlay resolution, cross-file rules, i18n) plus the world
 * file. `_template` is validated like any other pack so the overlay skeleton can never rot.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PACK_IDS, RAW_PACKS, resolveBundledPack, WORLD } from '../src/index.js';

const packsDir = resolve(import.meta.dirname, '..', 'packs');
const args = process.argv.slice(2);
const targets = args.includes('--all') ? PACK_IDS : args.filter((a) => !a.startsWith('--'));

let failed = 0;
// Every folder on disk must be registered in packs.ts (static imports), otherwise it silently rots.
for (const dir of readdirSync(packsDir).filter((d) => statSync(join(packsDir, d)).isDirectory())) {
  if (!existsSync(join(packsDir, dir, 'pack.json'))) {
    console.error(`✗ ${dir}: missing pack.json`);
    failed++;
    continue;
  }
  const registered = Object.values(RAW_PACKS).some((files) => {
    const m = files['pack.json'] as { id?: string } | undefined;
    return (
      m?.id !== undefined && (dir === m.id || (dir === '_template' && m.id === 'template-city'))
    );
  });
  if (!registered) {
    console.error(`✗ ${dir}: folder exists but is not registered in packages/content/src/packs.ts`);
    failed++;
  }
}
for (const id of targets) {
  const result = resolveBundledPack(id);
  if (result.ok) {
    const p = result.pack;
    console.log(
      `✓ ${p.id}@${p.version}  locations ${p.locations.length}, jobs ${p.jobs.length}, degrees ${p.degrees.length}, items ${p.items.length}, events ${p.events.length}, i18n ${Object.keys(p.i18n).length}`,
    );
  } else {
    failed++;
    console.error(`✗ ${id}`);
    for (const issue of result.issues)
      console.error(`    ${issue.path || '<root>'}: ${issue.message}`);
  }
}
for (const city of WORLD.cities) {
  if (!PACK_IDS.includes(city.packId)) {
    console.error(`✗ world.json: city pack "${city.packId}" is not bundled`);
    failed++;
  }
}
console.log(
  `content:validate — ${targets.length} pack(s), world ${WORLD.id} (${WORLD.cities.length} city), ${failed} failed`,
);
process.exit(failed === 0 ? 0 : 1);
