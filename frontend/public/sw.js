/* EcoReporta Carmen — Service Worker (PWA Offline)
 *  · App shell:        precache + stale-while-revalidate
 *  · Assets Vite:      cache-first (nombres con hash)
 *  · GET /api/*:       network-first con respaldo en caché (mapa y feed sin señal)
 *  · Teselas del mapa: cache-first (zonas ya visitadas disponibles offline)
 *  · POST:             nunca se cachea; la cola offline vive en IndexedDB
 */
const VERSION = 'v1.2.0';
const SHELL = `ecoreporta-shell-${VERSION}`;
const RUNTIME = `ecoreporta-runtime-${VERSION}`;
const API = `ecoreporta-api-${VERSION}`;
const TILES = 'ecoreporta-tiles';
const MAX_TILES = 600;

const PRECACHE = ['/', '/index.html', '/manifest.json', '/icons/icon.svg', '/icons/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME, API, TILES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function recortarCache(nombre, max) {
  const cache = await caches.open(nombre);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return (
      cached ||
      new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
}

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
      cache.put(req, res.clone());
      if (max) recortarCache(cacheName, max);
    }
    return res;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  const red = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await red) || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegación SPA → index.html (también sin red)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(SHELL).then((c) => c.put('/index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req, API));
    return;
  }

  if (/tile\.openstreetmap\.org|basemaps\.cartocdn\.com|arcgisonline\.com/.test(url.hostname)) {
    event.respondWith(cacheFirst(req, TILES, MAX_TILES));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }

  if (url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com|supabase\.co/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

// Background Sync: al volver la señal avisa a la app para vaciar la cola de IndexedDB
self.addEventListener('sync', (event) => {
  if (event.tag === 'ecoreporta-sync') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) =>
        clients.forEach((c) => c.postMessage({ type: 'SYNC_REPORTS' }))
      )
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
