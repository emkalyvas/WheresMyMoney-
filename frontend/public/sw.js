// Basic Service Worker to satisfy PWA installability requirements.
// A more advanced SW could cache assets, but we rely on the backend cache for data.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests
  event.respondWith(fetch(event.request));
});
