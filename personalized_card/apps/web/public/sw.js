/*
 * The service worker for the creator app's shell only.
 *
 * What it does: lets the app open (the shell, not any particular letter)
 * when the network is briefly unavailable, and speeds up repeat visits by
 * caching the app's own hashed JS/CSS bundles as they're fetched.
 *
 * What it deliberately never does: cache anything under /api/ — that
 * includes every data request AND every media stream (/api/media/:id/stream),
 * so a photo or recording is never served stale, never served to someone it
 * doesn't belong to, and never left sitting in a cache after a letter is
 * deleted. Bump CACHE_VERSION when the shell's static asset list changes.
 */

const CACHE_VERSION = 'letter-shell-v1';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url) || isApiRequest(url)) return; // never our business, never cached

  // Navigations: prefer a fresh page, but open the shell offline rather than
  // showing the browser's own "no internet" screen.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match('/index.html')) ?? Response.error();
      }),
    );
    return;
  }

  // Everything else same-origin (the hashed build output, fonts, icons):
  // serve from cache when present, and quietly cache whatever comes back so
  // the next offline visit has it too.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
