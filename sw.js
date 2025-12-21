const CACHE_NAME = 'laxkollen-v6';
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=6',
  './app.js?v=6',
  './manifest.json',
  './icons/icon-192-LK.png',
  './icons/icon-512-LK.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle same-origin GET
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // For HTML/navigation, use network-first
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r=>{
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c=>c.put('./', copy));
        return r;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // For others, cache-first
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE_NAME).then(c=>c.put(req, copy));
      return r;
    }).catch(()=>cached))
  );
});
