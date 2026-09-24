/* global self, caches, fetch, URL */
/**
 * Offline cache for the static app and its art (ART_SPEC 17.8, M9.11). Generated at build time by
 * the `hustle-ring-sw` Vite plugin, which fills in the precache list and a version from the
 * emitted files. Pages are network-first (a fresh deploy always wins); everything else is served
 * from the cache first. Same-origin GET only: the app makes no other requests (CLAUDE.md 1.3).
 */
const VERSION = '__VERSION__';
// eslint-disable-next-line no-undef -- replaced at build time by the Vite plugin
const PRECACHE = __PRECACHE__;
const CACHE = `hustle-ring-${VERSION}`;
const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(scoped))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('hustle-ring-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    const index = scoped('./');
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(index, copy));
          return response;
        })
        .catch(() => caches.match(index, { ignoreVary: true })),
    );
    return;
  }
  // Module scripts carry an Origin header the precache request did not, so ignore Vary.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request)),
  );
});
