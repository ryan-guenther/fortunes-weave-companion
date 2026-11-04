// Service worker: makes the app work offline after the first visit.
// The deploy workflow replaces CACHE_VERSION with the commit SHA, so every
// deploy gets a fresh cache and installed copies pick up the new files.
const CACHE_VERSION = 'dev';
const CACHE = `fw-companion-${CACHE_VERSION}`;

const APP_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './data/characters.json',
  './data/classes.json',
  './data/paralogues.json',
  './data/shops.json',
  './data/sources.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const isAppFile = new URL(request.url).origin === self.location.origin;

  if (isAppFile) {
    // Network first so updates show up; fall back to the cache when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  // Google Fonts: cache first, since font files never change.
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok || response.type === 'opaque') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
