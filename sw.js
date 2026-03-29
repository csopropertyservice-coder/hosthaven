// HostHaven Service Worker — PWA offline support
const CACHE = 'hosthaven-v1';
const OFFLINE_URL = '/hosthaven/';

// Files to cache for offline use
const PRECACHE = [
  '/hosthaven/',
  '/hosthaven/index.html',
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;1,9..144,300&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE.map(url => new Request(url, {mode: 'no-cors'}))).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Only cache GET requests to same origin
  if(event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cache successful responses
        if(response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(function() {
        // Offline — serve from cache or offline page
        return caches.match(event.request)
          .then(function(cached) {
            return cached || caches.match(OFFLINE_URL);
          });
      })
  );
});
