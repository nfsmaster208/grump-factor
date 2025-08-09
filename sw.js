// Basic offline-first cache for built assets + network-first for index.
// Bumps automatically if you set VITE_APP_VERSION in your Actions build step.
const VERSION = (self.location.search || '') + (self.registration?.scope || '') // avoid TS-ish
const CACHE_NAME = 'gf-cache-v' + (self?.__VITE_APP_VERSION || '1');

const ASSET_PATTERNS = [
  '/assets/',        // Vite-built JS/CSS
  '/favicon.svg',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-512.png',
  '/apple-touch-icon.png',
  '/social-card.png'
];

// On install, just warm the basic icons. (We can't know hashed asset names here.)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/','/favicon.svg','/favicon-32.png'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Strategy:
// - HTML: network-first (so updates roll out), fallback to cache if offline.
// - Assets (/assets/...): cache-first (hashed files are immutable).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET and same-origin
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
  } else if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req));
  } else if (ASSET_PATTERNS.some(p => url.pathname.startsWith(p))) {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Clone only if ok
  if (res && res.status === 200) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    // last resort: cached index
    return cache.match('/');
  }
}
