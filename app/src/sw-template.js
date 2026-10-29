// HYROX Trainer service worker. Generated at build time from src/sw-template.js.
// App files are precached; navigation falls back to the cached app shell when offline.
const VERSION = '__VERSION__';
const PREFIX = 'hyrox-trainer-';
const CACHE = `${PREFIX}${VERSION}`;
const MEDIA_CACHE = `${PREFIX}media`;
const PRECACHE = __PRECACHE__;
// Exercise photos: cached in the background after activation, so the first start stays fast.
const MEDIA = __MEDIA__;

async function fill() {
  const cache = await caches.open(CACHE);
  await cache.addAll(PRECACHE);
}

async function warmMedia() {
  const cache = await caches.open(MEDIA_CACHE);
  for (const file of MEDIA) {
    if (await cache.match(file)) continue;
    try {
      const res = await fetch(file);
      if (res.ok) await cache.put(file, res);
    } catch {
      return; // offline or interrupted: the next start continues
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(fill().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Only our own old caches (also those of the previous single-file version). The domain is
    // shared with FORM., whose caches must stay untouched.
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE && k !== MEDIA_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
  void warmMedia();
});

self.addEventListener('message', (event) => {
  // Another app on the same domain may delete caches it does not know (FORM.'s old service
  // worker does). Each app start checks the offline copy and refills it if it is incomplete.
  if (event.data === 'ensure-cache') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      if ((await cache.keys()).length < PRECACHE.length) await fill().catch(() => undefined);
      await warmMedia();
    })());
  }
});

async function fromCache(request) {
  return (await (await caches.open(CACHE)).match(request, { ignoreSearch: true }))
    ?? (await (await caches.open(MEDIA_CACHE)).match(request, { ignoreSearch: true }));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Network first for the page itself, so updates arrive; cached shell when offline.
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('./index.html')) ?? (await cache.match('./')) ?? Response.error();
    }));
    return;
  }
  // Built files have content hashes: cache first is safe. Only our own caches are consulted.
  event.respondWith((async () => {
    const cached = await fromCache(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && new URL(request.url).pathname.includes('/media/')) {
      const copy = response.clone();
      caches.open(MEDIA_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  })());
});
