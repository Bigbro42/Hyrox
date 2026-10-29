// HYROX Trainer service worker. Generated at build time from src/sw-template.js.
// App files are precached; navigation falls back to the cached app shell when offline.
const VERSION = '1793310698300';
const PREFIX = 'hyrox-trainer-';
const CACHE = `${PREFIX}${VERSION}`;
const MEDIA_CACHE = `${PREFIX}media`;
const PRECACHE = ["./","apple-touch-icon.png","assets/index-CQNPEGSH.js","assets/index-D2zOsxT_.css","icon-192.png","icon-512.png","icon-maskable-512.png","icon.svg","index.html","manifest.webmanifest"];
// Exercise photos: cached in the background after activation, so the first start stays fast.
const MEDIA = ["media/exercises/Air_Bike/0.jpg","media/exercises/Air_Bike/1.jpg","media/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg","media/exercises/Barbell_Bench_Press_-_Medium_Grip/1.jpg","media/exercises/Barbell_Deadlift/0.jpg","media/exercises/Barbell_Deadlift/1.jpg","media/exercises/Barbell_Hip_Thrust/0.jpg","media/exercises/Barbell_Hip_Thrust/1.jpg","media/exercises/Bicycling_Stationary/0.jpg","media/exercises/Bicycling_Stationary/1.jpg","media/exercises/Butt_Lift_Bridge/0.jpg","media/exercises/Butt_Lift_Bridge/1.jpg","media/exercises/Calf_Stretch_Hands_Against_Wall/0.jpg","media/exercises/Calf_Stretch_Hands_Against_Wall/1.jpg","media/exercises/Dead_Bug/0.jpg","media/exercises/Dead_Bug/1.jpg","media/exercises/Dumbbell_Step_Ups/0.jpg","media/exercises/Dumbbell_Step_Ups/1.jpg","media/exercises/Kneeling_Hip_Flexor/0.jpg","media/exercises/Kneeling_Hip_Flexor/1.jpg","media/exercises/Leg_Press/0.jpg","media/exercises/Leg_Press/1.jpg","media/exercises/Lying_Leg_Curls/0.jpg","media/exercises/Lying_Leg_Curls/1.jpg","media/exercises/One-Arm_Dumbbell_Row/0.jpg","media/exercises/One-Arm_Dumbbell_Row/1.jpg","media/exercises/Pallof_Press/0.jpg","media/exercises/Pallof_Press/1.jpg","media/exercises/Plank/0.jpg","media/exercises/Plank/1.jpg","media/exercises/Romanian_Deadlift/0.jpg","media/exercises/Romanian_Deadlift/1.jpg","media/exercises/Rowing_Stationary/0.jpg","media/exercises/Rowing_Stationary/1.jpg","media/exercises/Seated_Cable_Rows/0.jpg","media/exercises/Seated_Cable_Rows/1.jpg","media/exercises/Side_Bridge/0.jpg","media/exercises/Side_Bridge/1.jpg","media/exercises/Standing_Dumbbell_Calf_Raise/0.jpg","media/exercises/Standing_Dumbbell_Calf_Raise/1.jpg","media/exercises/Standing_Military_Press/0.jpg","media/exercises/Standing_Military_Press/1.jpg","media/exercises/Wide-Grip_Lat_Pulldown/0.jpg","media/exercises/Wide-Grip_Lat_Pulldown/1.jpg","media/exercises/Worlds_Greatest_Stretch/0.jpg","media/exercises/Worlds_Greatest_Stretch/1.jpg"];

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
