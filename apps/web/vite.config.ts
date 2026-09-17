import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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
