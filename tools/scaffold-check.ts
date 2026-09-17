#!/usr/bin/env tsx
/** `pnpm scaffold:check` — lists every v1 stub, its README status and contract test (ROADMAP_SCAFFOLDS 16). */
import { resolve } from 'node:path';
import { allHealthy, listStubs } from './lib/scaffold.js';

const stubs = listStubs(resolve(import.meta.dirname, '..', 'packages/platform/src'));
for (const s of stubs) {
  console.log(
    `  ${s.area.padEnd(14)} README:${s.readme.padEnd(24)} contract.test.ts:${s.contractTest ? 'yes' : 'NO'}`,
  );
}
const ok = allHealthy(stubs);
console.log(`scaffold:check — ${stubs.length} stub area(s) → ${ok ? 'OK' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
