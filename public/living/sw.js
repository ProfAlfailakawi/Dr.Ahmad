// Offline cache for the living encyclopedia: after the first visit the app, its libraries, the fonts
// and the recognition packs come from the phone, so it opens instantly even with a weak network.
const CACHE = 'living-v33';
const BASE = new URL('./', self.location);                       // …/living/
const PAGE = BASE.pathname === '/' ? BASE.href : BASE.href.slice(0, -1); // …/living (the page itself)
const SHELL = ['app.js?v=33', 'experiences.js?v=33', 'kit.js?v=33', 'pencil.js?v=33', 'doors34.js?v=33', 'sound.js?v=33', 'boot.js?v=33', 'fast.js?v=33', 'fast-index.js?v=33', 'extras.js?v=33', 'targets/all.stub.mind?v=15'].map((p) => new URL(p, BASE).href);
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

// The page with any query (?home, ?pack=…, ?lecture) and every file under it.
const PAGE_PATH = new URL(PAGE).pathname;
const ours = (url) => url.origin === location.origin && (url.pathname === PAGE_PATH || url.pathname.startsWith(BASE.pathname));
const library = (url) => url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Keep what the phone already has: libraries (pinned by version in their address) and our files whose
    // address carries a version that is still in use (the recognition pack above all, about 7 MB) move from
    // the previous release's cache into this one, so an update downloads only what really changed.
    for (const key of await caches.keys()) {
      if (!key.startsWith('living-') || key === CACHE) continue;
      const oldV = key.slice('living-v'.length);
      const prev = await caches.open(key);
      for (const req of await prev.keys()) {
        const url = new URL(req.url);
        const v = url.searchParams.get('v');
        const keep = library(url) || (ours(url) && v && v !== oldV);
        if (!keep || await cache.match(req)) continue;
        const hit = await prev.match(req);
        if (hit) await cache.put(req, hit).catch(() => {});
      }
    }
    // Anything still missing comes from the network. One failed file must not block the others.
    await Promise.all([PAGE, ...SHELL, ...LIBS].map(async (u) => { if (u === PAGE || !(await cache.match(u))) await cache.add(u).catch(() => {}); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('living-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

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
