/* Läxkollen Service Worker (v8) */
const CACHE_NAME = "laxkollen-cache-v8";
const PRECACHE_URLS = [
  "./",
  "./index.html?v=8",
  "./style.css?v=8",
  "./app.js?v=8",
  "./manifest.json",
  "./icon-192-LK.png",
  "./icon-512-LK.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: false });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // Cache same-origin navigation + static assets
      const url = new URL(req.url);
      if (url.origin === location.origin) {
        // only cache basic responses
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          cache.put(req, fresh.clone());
        }
      }
      return fresh;
    } catch (e) {
      // Offline fallback to app shell
      const fallback = await cache.match("./index.html?v=8");
      return fallback || Response.error();
    }
  })());
});
