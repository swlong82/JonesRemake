import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artFiles, checkArtBudget, checkBudget, initialFiles, type Manifest } from './budget.js';

function fakeDist(entryBytes: number, lazyBytes: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'budget-'));
  mkdirSync(join(dir, '.vite'), { recursive: true });
  mkdirSync(join(dir, 'assets'), { recursive: true });
  // Random bytes so gzip cannot compress them away.
  const noise = (n: number): Buffer =>
    Buffer.from(Array.from({ length: n }, () => Math.floor(Math.random() * 256)));
  writeFileSync(join(dir, 'assets/index.js'), noise(entryBytes));
  writeFileSync(join(dir, 'assets/vendor.js'), noise(1024));
  writeFileSync(join(dir, 'assets/music.js'), noise(lazyBytes));
  writeFileSync(join(dir, 'assets/index.css'), noise(512));
  const manifest: Manifest = {
    'index.html': {
      file: 'assets/index.js',
      isEntry: true,
      imports: ['_vendor'],
      dynamicImports: ['src/audio/music.ts'],
      css: ['assets/index.css'],
    },
    _vendor: { file: 'assets/vendor.js' },
    'src/audio/music.ts': { file: 'assets/music.js' },
  };
  writeFileSync(join(dir, '.vite/manifest.json'), JSON.stringify(manifest));
  return dir;
}

describe('bundle budget (PRD 2.5)', () => {
  it('counts entry + static imports + css, not dynamic chunks', () => {
    const manifest: Manifest = {
      'index.html': {
        file: 'a.js',
        isEntry: true,
        imports: ['v'],
        dynamicImports: ['m'],
        css: ['a.css'],
      },
      v: { file: 'v.js', imports: ['index.html'] },
      m: { file: 'm.js' },
    };
    expect(initialFiles(manifest)).toEqual(['a.css', 'a.js', 'v.js']);
  });
  it('passes a small bundle and ignores the lazy music chunk', () => {
    const r = checkBudget(fakeDist(10 * 1024, 900 * 1024), 350);
    expect(r.ok).toBe(true);
    expect(r.files.map((f) => f.file)).not.toContain('assets/music.js');
  });
  it('fails an oversized fixture', () => {
    const r = checkBudget(fakeDist(400 * 1024, 0), 350);
    expect(r.ok).toBe(false);
    expect(r.totalKb).toBeGreaterThan(350);
  });
});

describe('art budget (ART_SPEC 17.8)', () => {
  it('sums the emitted art-set files only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'art-budget-'));
    mkdirSync(join(dir, '.vite'), { recursive: true });
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'assets/a.svg'), 'x'.repeat(2048));
    writeFileSync(join(dir, 'assets/b.svg'), 'x'.repeat(1024));
    writeFileSync(join(dir, 'assets/logo.svg'), 'x'.repeat(4096));
    const manifest: Manifest = {
      '../../packages/art/sets/default/files/a.svg': { file: 'assets/a.svg' },
      '../../packages/art/sets/default/files/b.svg': { file: 'assets/b.svg' },
      'src/logo.svg': { file: 'assets/logo.svg' },
    };
    writeFileSync(join(dir, '.vite/manifest.json'), JSON.stringify(manifest));
    expect(artFiles(manifest)).toEqual(['assets/a.svg', 'assets/b.svg']);
    expect(checkArtBudget(dir, 3)).toEqual({ ok: true, totalKb: 3, count: 2 });
    expect(checkArtBudget(dir, 2).ok).toBe(false);
  });
});
