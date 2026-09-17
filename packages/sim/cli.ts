#!/usr/bin/env tsx
/**
 * Sim CLI (BALANCE_SPEC 9.1, BUILD_READINESS 15.2).
 *
 *   pnpm sim -- --games 10000 --pack classic --out reports/
 *   pnpm sim:gate   → --config sim/gates.json --assert
 *
 * STUB — M3 implements the runner. Until then:
 *   - a gates file with zero configs passes (nothing to assert yet);
 *   - any config, or a plain run, exits 1 with a clear "not implemented" message so a
 *     half-wired gate can never pass silently.
 */
import { readFileSync } from 'node:fs';
import { parseGatesFile } from './src/index.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const configPath = flag('config');
if (configPath) {
  const gates = parseGatesFile(JSON.parse(readFileSync(configPath, 'utf8')) as unknown);
  if (gates.configs.length === 0) {
    console.log(`sim:gate — ${configPath} has 0 gate configs (M0 stub). Nothing to assert. OK`);
    process.exit(0);
  }
  console.error(
    `sim:gate — ${gates.configs.length} config(s) found but the sim runner is not implemented (M3). FAIL`,
  );
  process.exit(1);
}

console.error('sim — runner not implemented until M3 (BALANCE_SPEC 9.1). FAIL');
process.exit(1);
