import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import './i18n';

/**
 * Node >= 24 owns a built-in `globalThis.localStorage` whose value is `undefined` unless the
 * process was started with `--localstorage-file`. The key already existing stops the jsdom
 * environment from installing its own `window.localStorage`, so app code and tests read
 * `undefined` on a Node the package `engines` field still supports (ADR-0032). Install a
 * Storage-shaped in-memory stand-in when that is the case; on Node 22 jsdom's own storage wins
 * and this block never runs.
 */
function installMemoryStorage(): void {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
}

if (typeof globalThis.localStorage === 'undefined') installMemoryStorage();

afterEach(() => {
  cleanup();
});
