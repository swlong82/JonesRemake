#!/usr/bin/env tsx
/**
 * `pnpm art:draw` (ART_SPEC 17.3, M9.13) — draws the default art set with `tools/art-default`:
 * every catalog slot whose file is a wireframe or earlier generator output is (re)drawn; files
 * drawn by hand are kept. Run `pnpm art:check --report` afterwards.
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ArtManifestSchema, defaultBoardLayout } from '@hustle-ring/art';
import { drawSlot, mayRedraw } from './art-default/index.js';
import { catalogFromPacks, readSet } from './lib/art.js';

const setsDir = resolve(import.meta.dirname, '..', 'packages/art/sets');
const { catalog, boardSizes } = catalogFromPacks();
const set = readSet(setsDir, 'default');
const manifest = ArtManifestSchema.parse(set.manifest);
const layout = manifest.board ?? defaultBoardLayout(boardSizes[0] ?? 16);

let drawn = 0;
let kept = 0;
for (const slot of catalog) {
  const entry = manifest.assets[slot.key];
  if (!entry) continue;
  if (!mayRedraw(set.files.get(entry.file))) {
    kept++;
    continue;
  }
  const art = drawSlot(slot, layout);
  if (art === null) continue;
  writeFileSync(join(set.dir, 'files', entry.file), art);
  drawn++;
}
console.log(`art:draw — ${drawn} slot(s) drawn, ${kept} hand-drawn kept`);
