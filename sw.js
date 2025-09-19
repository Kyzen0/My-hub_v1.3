const CACHE_NAME = 'my-hub-v1.4';
const STATIC_CACHE = 'my-hub-static-v1.4';
const DYNAMIC_CACHE = 'my-hub-dynamic-v1.4';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/anime.html',
  '/projects.html',
  '/bookmarks.html',
  '/vault.html',
  '/profile.html',
  '/styles.css',
  '/profile.css',
  '/script.js',
  '/navbar.js',
  '/vault.js',
  '/profile.js',
  '/manifest.json',
  '/img/anime-bg.avif',
  '/img/profile.png',
  '/img/projects-2-bg.avif',
  '/img/projects-bg.avif'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - network-first for navigation, cache-first for same-origin static assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests; let external/CDN/Firebase pass through
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Background sync for offline data
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // This will be handled by the main app when it comes back online
      console.log('[SW] Background sync ready to sync data')
    );
  }
});

// Handle push notifications (optional)
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/img/profile.png',
    badge: '/img/profile.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/img/profile.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/img/profile.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('My Hub', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
