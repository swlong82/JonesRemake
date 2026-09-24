import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The deployed commit, stamped into index.html so the live smoke test (M8.4) can tell a fresh
// deploy from a cached one. deploy.yml sets it; everywhere else it reads `dev`.
process.env.VITE_BUILD_SHA ??= 'dev';

// GitHub Pages serves from /<repo>/ — deploy.yml sets VITE_BASE_PATH; local dev stays at '/'.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    manifest: true,
    sourcemap: true,
    target: 'es2022',
  },
  preview: { port: 4173, strictPort: true },
  server: { port: 5173 },
});
