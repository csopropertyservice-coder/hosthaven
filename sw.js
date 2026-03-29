// HostHaven Service Worker v2 — no HTML caching
const CACHE = 'hosthaven-v2';

// Only cache static assets, NEVER the HTML
const CACHE_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;1,9..144,300&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  
  // NEVER cache HTML — always fetch fresh from network
  if (url.includes('index.html') || url.endsWith('/hosthaven/') || url.endsWith('/hosthaven')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For everything else, network first
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});
