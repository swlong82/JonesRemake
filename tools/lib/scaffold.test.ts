import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allHealthy, listStubs } from './scaffold.js';

describe('scaffold:check (ROADMAP_SCAFFOLDS 16)', () => {
  it('flags a stub without REPLACE ME heading or contract test', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scaffold-'));
    mkdirSync(join(dir, 'good'));
    writeFileSync(join(dir, 'good/README.md'), '# REPLACE ME — good\n');
    writeFileSync(join(dir, 'good/contract.test.ts'), '');
    mkdirSync(join(dir, 'bad'));
    writeFileSync(join(dir, 'bad/README.md'), '# Something else\n');
    writeFileSync(join(dir, 'types.ts'), '');
    const stubs = listStubs(dir);
    expect(stubs).toEqual([
      { area: 'bad', readme: 'no-replace-me-heading', contractTest: false },
      { area: 'good', readme: 'ok', contractTest: true },
    ]);
    expect(allHealthy(stubs)).toBe(false);
    expect(allHealthy(stubs.slice(1))).toBe(true);
    expect(allHealthy([])).toBe(false);
  });
  it('the real platform package is healthy', () => {
    const stubs = listStubs(resolve(import.meta.dirname, '../../packages/platform/src'));
    expect(stubs.map((s) => s.area)).toEqual([
      'artpacks',
      'entitlements',
      'identity',
      'leaderboard',
      'matchmaker',
      'platform',
      'saves',
      'telemetry',
      'transport',
    ]);
    expect(allHealthy(stubs)).toBe(true);
  });
});
