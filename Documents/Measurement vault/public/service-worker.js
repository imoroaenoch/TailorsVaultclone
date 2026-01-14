// Service Worker for Tailor's Vault PWA
const CACHE_NAME = 'tailors-vault-v1';
const STATIC_CACHE_NAME = 'tailors-vault-static-v1';

// Assets to cache on install (app shell)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/app.js',
  '/indexeddb.js',
  '/sync-manager.js',
  '/styles.css',
  '/auth-header.jpg',
  '/auth-header.jpeg',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return Promise.allSettled(
        STATIC_ASSETS.map(url => {
          // Skip external URLs that might fail
          if (url.startsWith('http') && !url.startsWith(self.location.origin)) {
            return fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            }).catch(err => {
              console.warn(`[Service Worker] Failed to cache ${url}:`, err);
            });
          } else {
            // For same-origin URLs, use relative path
            const requestUrl = url.startsWith('/') ? url : `/${url}`;
            return fetch(requestUrl).then(response => {
              if (response.ok) {
                return cache.put(requestUrl, response);
              }
            }).catch(err => {
              console.warn(`[Service Worker] Failed to cache ${requestUrl}:`, err);
            });
          }
        })
      ).then(() => {
        console.log('[Service Worker] Static assets cached');
      });
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;
  
  // Skip chrome-extension:// and other unsupported protocols
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'chrome:' ||
      url.protocol === 'moz-extension:') {
    return; // Let browser handle it
  }
  
  // DO NOT cache Supabase API requests
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('supabase') ||
      url.pathname.includes('/rest/v1/') ||
      url.pathname.includes('/auth/v1/')) {
    // Always fetch from network for Supabase requests (but don't block if offline)
    event.respondWith(
      fetch(request).catch(() => {
        // If offline, return a basic response to prevent blocking
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // DO NOT cache authentication redirects or API calls
  if (url.pathname.includes('/auth/') || 
      url.searchParams.has('access_token') ||
      url.searchParams.has('refresh_token')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response('', { status: 503 });
      })
    );
    return;
  }
  
  // For navigation requests (HTML), use cache-first for offline support
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Return cached version if available (offline support)
        if (cachedResponse) {
          return cachedResponse;
        }
        // Otherwise fetch from network
        return fetch(request).then((response) => {
          // Cache the response for offline use
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // If offline and no cache, return a basic HTML response
          return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your connection.</p></body></html>', {
            headers: { 'Content-Type': 'text/html' }
          });
        });
      })
    );
    return;
  }
  
  // For static assets, use cache-first strategy
  if (event.request.method === 'GET' && 
      (event.request.destination === 'script' ||
       event.request.destination === 'style' ||
       event.request.destination === 'image' ||
       event.request.destination === 'font' ||
       url.pathname.endsWith('.css') ||
       url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.JPG') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2'))) {
    
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request).then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the new response
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        }).catch(() => {
          // If network fails and no cache, return empty response to prevent blocking
          return new Response('', { status: 503 });
        });
      })
    );
  } else {
    // For other requests, try network first, fallback to cache
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to home page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { status: 503 });
        });
      })
    );
  }
});

