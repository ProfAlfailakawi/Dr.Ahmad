/* خدمة العمل — قراءة المقالات دون إنترنت — المعرّف: __BUILD_ID__ */
const CACHE = 'alfailakawi-v1-__BUILD_ID__'
const CORE = ['/', '/index.html', '/favicon.png', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (location.hostname.includes('ais-dev-') || location.hostname.includes('localhost') || location.hostname.includes('127.0.0.1')) {
    return
  }
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return

  // الصفحات: الشبكة أولاً، ثم الذاكرة
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return r })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    )
    return
  }

  // الأصول: الذاكرة أولاً
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(request, copy)) }
        return r
      })
    )
  )
})
