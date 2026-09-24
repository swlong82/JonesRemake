#!/usr/bin/env tsx
/**
 * `pnpm art:placeholders` (ART_SPEC 17.3) — writes a wireframe for every catalog slot of the
 * default set that has no drawn file, plus the board layout and theme if the manifest has none.
 * Drawn art (no placeholder marker) is never touched; re-running is byte-stable.
 */
import { resolve } from 'node:path';
import { ArtManifestSchema, planPlaceholders } from '@hustle-ring/art';
import { catalogFromPacks, readSet, writeSet } from './lib/art.js';

const setsDir = resolve(import.meta.dirname, '..', 'packages/art/sets');
const { catalog, boardSizes } = catalogFromPacks();
if (boardSizes.length !== 1) {
  console.error(`packs disagree on board size (${boardSizes.join(', ')}); one layout cannot fit`);
  process.exit(1);
}
const set = readSet(setsDir, 'default');
const parsed = set.manifest === undefined ? undefined : ArtManifestSchema.safeParse(set.manifest);
if (parsed && !parsed.success) {
  console.error('packages/art/sets/default/manifest.json is invalid; fix it or delete it first:');
  for (const i of parsed.error.issues) console.error(`  ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
const plan = planPlaceholders({
  manifest: parsed?.data,
  files: set.files,
  catalog,
  boardSize: boardSizes[0]!,
});
writeSet(set.dir, plan.manifest, plan.writes);
console.log(
  `art:placeholders — ${catalog.length} slots: ${plan.writes.size} wireframe(s) written, ${plan.drawn.length} drawn kept`,
);
