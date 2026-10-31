// Offline cache for the living encyclopedia: after the first visit the app, its libraries, the fonts
// and the recognition packs come from the phone, so it opens instantly even with a weak network.
const CACHE = 'living-v18';
const BASE = new URL('./', self.location);                       // …/living/
const PAGE = BASE.pathname === '/' ? BASE.href : BASE.href.slice(0, -1); // …/living (the page itself)
const SHELL = ['app.js?v=18', 'experiences.js?v=18', 'kit.js?v=6', 'pencil.js?v=6', 'doors34.js?v=7', 'doors2.js?v=8', 'doors-next.js?v=11', 'doors-future.js?v=18', 'doors-wave-a.js?v=18', 'doors-wave-b.js?v=18', 'doors-games.js?v=18', 'sound.js?v=6', 'targets-door1.mind?v=18', 'targets-door2.mind?v=18', 'targets-door3new.mind?v=18', 'targets-door2future.mind?v=18', 'targets-door3future.mind?v=18', 'targets-door4future.mind?v=18', 'targets-doorwave1.mind?v=18', 'targets-doorwave2.mind?v=18', 'targets-doorwave3.mind?v=18', 'targets-doorwave4.mind?v=18', 'targets-doorwave5.mind?v=18', 'targets-games-foundations.mind?v=18', 'targets-games-policy.mind?v=18'].map((p) => new URL(p, BASE).href);
const LIBS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/lines/LineSegments2.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/lines/LineSegmentsGeometry.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/lines/LineMaterial.js',
  'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One failed file must not block the others.
    await Promise.all([PAGE, ...SHELL, ...LIBS].map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('living-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// The page with any query (?home, ?pack=…, ?lecture) and every file under it.
const PAGE_PATH = new URL(PAGE).pathname;
const ours = (url) => url.origin === location.origin && (url.pathname === PAGE_PATH || url.pathname.startsWith(BASE.pathname));
const library = (url) => url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The page: network first so updates arrive, the saved copy when offline.
  if (req.mode === 'navigate' && ours(url)) {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(PAGE, copy)); return r; })
      .catch(() => caches.match(PAGE)));
    return;
  }
  // Files and libraries: from the phone first (they are versioned), then the network.
  if (ours(url) || library(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return r;
    })));
  }
});
