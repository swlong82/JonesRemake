import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Subset of Vite's build manifest we rely on. */
export interface ManifestChunk {
  readonly file: string;
  readonly isEntry?: boolean;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
  readonly css?: readonly string[];
}
export type Manifest = Record<string, ManifestChunk>;

/** Files loaded before first render: every entry + its static import closure + their CSS. */
export function initialFiles(manifest: Manifest): string[] {
  const seen = new Set<string>();
  const visit = (key: string): void => {
    const chunk = manifest[key];
    if (!chunk || seen.has(chunk.file)) return;
    seen.add(chunk.file);
    for (const css of chunk.css ?? []) seen.add(css);
    for (const imp of chunk.imports ?? []) visit(imp);
  };
  for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
  return [...seen].sort();
}

export function gzipKb(distDir: string, files: readonly string[]): { file: string; kb: number }[] {
  return files.map((file) => ({
    file,
    kb: gzipSync(readFileSync(join(distDir, file))).byteLength / 1024,
  }));
}

export function checkBudget(
  distDir: string,
  maxKb: number,
): { ok: boolean; totalKb: number; files: { file: string; kb: number }[] } {
  const manifest = JSON.parse(
    readFileSync(join(distDir, '.vite', 'manifest.json'), 'utf8'),
  ) as Manifest;
  const files = gzipKb(distDir, initialFiles(manifest));
  const totalKb = files.reduce((s, f) => s + f.kb, 0);
  return { ok: totalKb <= maxKb, totalKb, files };
}

/** Art-set files the build emitted (ART_SPEC 17.8): manifest keys under `packages/art/sets/`. */
export function artFiles(manifest: Manifest): string[] {
  return Object.entries(manifest)
    .filter(([key]) => key.includes('packages/art/sets/'))
    .map(([, chunk]) => chunk.file)
    .sort();
}

/** Raw bytes of the emitted art against the per-set budget (1.5 MB by default). */
export function checkArtBudget(
  distDir: string,
  maxKb: number,
): { ok: boolean; totalKb: number; count: number } {
  const manifest = JSON.parse(
    readFileSync(join(distDir, '.vite', 'manifest.json'), 'utf8'),
  ) as Manifest;
  const files = artFiles(manifest);
  const totalKb = files.reduce((s, f) => s + statSync(join(distDir, f)).size, 0) / 1024;
  return { ok: totalKb <= maxKb, totalKb, count: files.length };
}
