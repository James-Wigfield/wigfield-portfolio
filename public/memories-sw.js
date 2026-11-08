/* Memory Rooms offline shell (registered by src/memory-rooms/MemoryRoomsApp.jsx in
   production builds, scope /memories). Lets /memories/new open with no signal so a
   capture can go into the outbox.

   - Navigations under /memories: network first; on failure, the last good page
     (the SPA's index.html, the same for every route).
   - /assets/*: cache first (Vite's file names are content-hashed, so never stale).
   - /api/*: never touched.
   Bump VERSION to drop everything cached. */

const VERSION = 'mr-shell-v1';
const SHELL = '/memories';
const MAX_ASSETS = 400;
// Hashed files never change, so ignore Vary (the page's Accept headers differ from cache.add's).
const MATCH = { ignoreVary: true };

/** Caches the shell page and every /assets/ file it references (the entry's static graph). */
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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mr-shell-') && k !== VERSION).map((k) => caches.delete(k))))
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
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      // Keep the shell (and, after a deploy, its new files) current in the background.
      cacheShell(cache, res.clone()).catch(() => {});
    }
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

// The page sends the /assets/ files it loaded before this worker took over,
// so the very first online visit is enough to open /memories/new offline later.
self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {};
  if (type !== 'mr-precache' || !Array.isArray(urls)) return;
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
      for (const u of own) {
        if (!(await cache.match(u, MATCH))) await cache.add(u).catch(() => {});
      }
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate' && url.pathname.startsWith('/memories')) event.respondWith(navigate(request));
  else if (url.pathname.startsWith('/assets/')) event.respondWith(asset(request));
});
