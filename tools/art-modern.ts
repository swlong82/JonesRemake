#!/usr/bin/env tsx
/** Generate the cumulative Modern pack; refuse to overwrite independently drawn art. */
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drawBenchmark, MARKER } from './art-modern/draw.js';

const dir = resolve(import.meta.dirname, '../packages/art/sets/modern/files');
const check = process.argv.includes('--check');
mkdirSync(dir, { recursive: true });
for (const [file, svg] of Object.entries(drawBenchmark())) {
  const target = resolve(dir, file);
  const previous = existsSync(target) ? readFileSync(target, 'utf8') : undefined;
  if (check) {
    if (previous !== svg) throw new Error(`${file} differs: run pnpm art:modern`);
  } else {
    if (previous !== undefined && !previous.includes(MARKER))
      throw new Error(`Refusing to overwrite hand-drawn ${file}`);
    writeFileSync(target, svg);
  }
}
console.log(`modern: eight assets ${check ? 'match generator' : 'written'}`);
