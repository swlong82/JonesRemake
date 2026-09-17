import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileTerms, scanFiles, scanText, type BannedConfig } from './banned.js';

// Fixture terms are invented so this file itself passes `pnpm check:banned`.
const compiled = compileTerms(['zorblax', 'fast pony', "bob's market", 'q-mart']);

describe('banned-terms scanner (PRD 2.6)', () => {
  it('flags case-insensitive whole-word hits', () => {
    expect(scanText('Welcome to ZORBLAX town', 'f.ts', compiled)).toMatchObject([
      { term: 'zorblax', line: 1 },
    ]);
    expect(scanText('life in the   Fast\tPony', 'f.ts', compiled)).toMatchObject([
      { term: 'fast pony' },
    ]);
    expect(scanText("Bob's Market opens", 'f.ts', compiled)).toMatchObject([
      { term: "bob's market" },
    ]);
    expect(scanText('shop at q-mart', 'f.ts', compiled)).toMatchObject([{ term: 'q-mart' }]);
  });
  it('does not flag substrings or unrelated words', () => {
    expect(scanText('pineapple', 'f.ts', compiled)).toEqual([]);
    expect(scanText('ZorblaxRemake repo', 'f.ts', compiled)).toEqual([]);
    expect(scanText('fastpony (one word)', 'f.ts', compiled)).toEqual([]);
  });
  it('reports line numbers', () => {
    const hits = scanText('ok\nok\nmr zorblax\n', 'f.ts', compiled);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.line).toBe(3);
  });
  it('the real config compiles and matches the original title (built at runtime so this file stays clean)', () => {
    const real = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../banned-terms.json'), 'utf8'),
    ) as BannedConfig;
    expect(real.terms.length).toBeGreaterThanOrEqual(31);
    const realCompiled = compileTerms(real.terms);
    const originalSurname = ['Jo', 'nes'].join('');
    expect(scanText(`Mr ${originalSurname} arrives`, 'f.ts', realCompiled)).toHaveLength(1);
    expect(scanText('pineapple', 'f.ts', realCompiled)).toEqual([]);
  });
});

describe('scanFiles', () => {
  it('honours include/exclude globs and reports hits with file paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'banned-'));
    mkdirSync(join(dir, 'src'));
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'src/a.ts'), 'const brand = "Zorblax";\n');
    writeFileSync(join(dir, 'src/b.ts'), 'const fruit = "pineapple";\n');
    writeFileSync(join(dir, 'docs/ORIGINAL.md'), 'Zorblax Zorblax\n');
    const hits = await scanFiles(
      { terms: ['zorblax'], include: ['**/*.{ts,md}'], exclude: ['docs/ORIGINAL.md'] },
      dir,
    );
    expect(hits).toEqual([
      { file: 'src/a.ts', line: 1, term: 'zorblax', text: 'const brand = "Zorblax";' },
    ]);
  });
});
