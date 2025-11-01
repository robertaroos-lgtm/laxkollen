// Hardened SW v13.7.0
const CACHE_KEY = 'lk-v13.7.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_KEY ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Pass-through: ingen respondWith → browsern hämtar alltid friskt (versioneras via ?v=)
self.addEventListener('fetch', (event) => {});
