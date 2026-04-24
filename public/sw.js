const CACHE_NAME = 'fabricel-cache-v3';

self.addEventListener('install', (event) => {
  console.log('SW Install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW Activate');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // PWA Builder compliance: must have a fetch handler
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline');
    })
  );
});
