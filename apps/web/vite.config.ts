import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Files the service worker precaches: every emitted file except source maps, the build manifest
 * and the non-Latin font subsets (the UI is English only; @font-face still lists them for
 * completeness, and they stay fetchable online).
 */
export function precacheList(files: readonly string[]): string[] {
  return [
    './',
    ...files.filter(
      (f) =>
        !f.endsWith('.map') &&
        !f.startsWith('.vite/') &&
        f !== 'index.html' &&
        (!f.endsWith('.woff2') || /-latin-\d/.test(f)) &&
        !f.endsWith('.woff'),
    ),
  ].sort();
}

/** Emits `sw.js` from `sw/template.js` with the precache list and a content version (M9.11). */
function serviceWorker(): Plugin {
  return {
    name: 'hustle-ring-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = precacheList(Object.keys(bundle));
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(resolve(import.meta.dirname, 'sw/template.js'), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// The deployed commit, stamped into index.html so the live smoke test (M8.4) can tell a fresh
// deploy from a cached one. deploy.yml sets it; everywhere else it reads `dev`.
process.env.VITE_BUILD_SHA ??= 'dev';

// GitHub Pages serves from /<repo>/ — deploy.yml sets VITE_BASE_PATH; local dev stays at '/'.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), serviceWorker()],
  build: {
    // Art-set files stay separate hashed files, never data URLs in the JS bundle, so art does not
    // count against the initial budget and a service worker can precache them (ART_SPEC 17.8).
    assetsInlineLimit: (file) => (file.includes('/packages/art/sets/') ? false : undefined),
    manifest: true,
    sourcemap: true,
    target: 'es2022',
  },
  preview: { port: 4173, strictPort: true },
  server: { port: 5173 },
});
