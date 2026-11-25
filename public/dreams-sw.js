/* Dream Rooms offline shell (registered by src/dream-rooms/DreamRoomsApp.jsx in production
   builds, scope /dreams). Lets /dreams/new open with no signal at 6 am, so a dream can go
   into the outbox. A trimmed copy of public/memories-sw.js.

   - Navigations under /dreams: network first; on failure, the last good page (the SPA's
     index.html, the same for every route).
   - /assets/*: cache first (Vite's file names are content-hashed, so never stale).
   - /api/* and everything else: never touched (dreams and their files are never cached).
   Bump VERSION to drop everything cached. */

const VERSION = 'dr-shell-v1';
const SHELL = '/dreams/new';
const MAX_ASSETS = 300;
const MATCH = { ignoreVary: true };

async function cacheShell(cache, res) {
  await cache.put(SHELL, res.clone());
  const html = await res.text();
  const urls = [...new Set(html.match(/\/assets\/[^"'\s>)]+/g) || [])];
  await Promise.all(urls.map((u) => cache.match(u, MATCH).then((hit) => hit || cache.add(u)).catch(() => {})));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const res = await fetch(SHELL, { cache: 'no-store' });
      if (res.ok) await cacheShell(cache, res);
    })().catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dr-shell-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith('/assets/'));
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(old);
}

async function navigate(request) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) cacheShell(cache, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = (await cache.match(SHELL, MATCH)) || (await cache.match(request, MATCH));
    if (hit) return hit;
    throw err;
  }
}

async function asset(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request, MATCH);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trim(cache).catch(() => {});
  }
  return res;
}

// The page sends the /assets/ files it loaded before this worker took over (its lazy chunk, CSS),
// so the very first online visit is enough to open /dreams/new offline later.
self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {};
  if (type !== 'dr-precache' || !Array.isArray(urls)) return;
  const own = urls.filter((u) => {
    try {
      const url = new URL(u, self.location.origin);
      return url.origin === self.location.origin && url.pathname.startsWith('/assets/');
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      for (const u of own) if (!(await cache.match(u, MATCH))) await cache.add(u).catch(() => {});
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate' && (url.pathname === '/dreams' || url.pathname.startsWith('/dreams/'))) event.respondWith(navigate(request));
  else if (url.pathname.startsWith('/assets/')) event.respondWith(asset(request));
});
