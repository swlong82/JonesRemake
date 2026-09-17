#!/usr/bin/env tsx
/** Banned-terms scan (PRD 2.6, CLAUDE.md 1.3). Exit 1 on any hit. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanFiles, type BannedConfig } from './lib/banned.js';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(
  readFileSync(resolve(root, 'tools/banned-terms.json'), 'utf8'),
) as BannedConfig;

const hits = await scanFiles(config, root);
for (const h of hits) console.error(`${h.file}:${h.line}: banned term "${h.term}" — ${h.text}`);
console.log(`check:banned — ${config.terms.length} terms, ${hits.length} hit(s)`);
process.exit(hits.length === 0 ? 0 : 1);
