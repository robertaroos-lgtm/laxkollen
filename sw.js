const C='lk-v13.6.1';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{self.clients.claim()});
self.addEventListener('fetch',()=>{});
