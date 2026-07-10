/* خدمة العمل — قراءة المقالات دون إنترنت */
const BUILD_ID = '__BUILD_ID__'
const CACHE = `alfailakawi-${BUILD_ID}`
const CORE = ['/', '/index.html', '/favicon.png', '/manifest.webmanifest', '/offline.html']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE).catch(() => c.addAll(CORE.filter((url) => url !== '/offline.html'))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return

  // الصفحات: الشبكة أولاً، ثم الذاكرة
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return r
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    )
    return
  }

  // الأصول: الذاكرة أولاً
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((r) => {
        if (r.ok && !request.url.includes('/admin')) {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return r
      })
    )
  )
})
