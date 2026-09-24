import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ServicesProvider } from './platform/Services';
import { App } from './App';
import { useGame } from './store/gameStore';
import './i18n';
// Bundled OFL face for art sets that name `nunito` (ART_SPEC 17.7); @font-face only downloads
// the files when the font is actually used.
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './index.css';

/**
 * Debug-only test hook (UX 7.9): the e2e build sets `VITE_DEBUG_ALLOWED=true`, so Playwright can
 * drive the store directly for states that take a whole game to reach (end screen, event cards).
 * A deployed build never defines it, so nothing is exposed in production.
 */
if (import.meta.env.VITE_DEBUG_ALLOWED === 'true') {
  Object.defineProperty(globalThis, '__hustleRing', { value: { useGame }, configurable: true });
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <ServicesProvider>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
