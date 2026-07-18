/* خدمة العمل — قراءة المقالات دون إنترنت */
const BUILD_ID = '__BUILD_ID__'
const CACHE = `alfailakawi-${BUILD_ID}`
const CORE = ['/', '/index.html', '/favicon.png', '/manifest.webmanifest', '/offline.html']
const RETIRED_NAVIGATION_PATHS = new Set(['/mylib'])

function retiredPageResponse() {
  return new Response(
    '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>صفحة غير متاحة</title><main style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#16202a;background:#faf9f6"><section style="max-width:520px;text-align:center"><h1 style="font-size:28px;margin:0 0 12px">هذه الصفحة لم تعد متاحة.</h1><p style="margin:0;color:#667085;line-height:1.8">تم إيقاف هذا المسار من الموقع الحالي. يمكنك العودة إلى الصفحة الرئيسية.</p><p style="margin-top:20px"><a href="/" style="color:#365a7a;text-decoration:none">العودة للرئيسية</a></p></section></main></html>',
    { status: 410, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )
}

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

  // طلبات النطاق (Range) — تشغيل الصوت يطلب أجزاء الملف فيرد الخادم 206 (Partial).
  // المتصفح يرفض تخزين 206 في الكاش؛ فلا نعترضها إطلاقاً ونتركها للمتصفح مباشرة.
  if (request.headers.has('range')) return

  // الصوت (بثّ، ملفات كبيرة) لا يُخزَّن في الكاش — يُطلب من الشبكة دائماً.
  const isAudio = new URL(request.url).pathname.startsWith('/audio/')

  const pathname = new URL(request.url).pathname
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/'

  // مسارات داخلية قديمة أُزيلت نهائياً. نردّ عليها من الـService Worker نفسه
  // حتى لا يعيد أي كاش قديم صفحةً لم تعد جزءاً من الموقع.
  if (request.mode === 'navigate' && RETIRED_NAVIGATION_PATHS.has(normalizedPathname)) {
    e.respondWith(
      caches.open(CACHE)
        .then((cache) => cache.delete(request))
        .then(() => retiredPageResponse())
        .catch(() => retiredPageResponse()),
    )
    return
  }

  // لوحة التحكم لا تمر عبر كاش الصفحات إطلاقاً. هذا يمنع ظهور نسخة قديمة من
  // الرئيسية أو بيانات الملف الشخصي عند فتح /admin بعد تحديثات النشر.
  if (request.mode === 'navigate' && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    e.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => new Response(
        '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>لوحة التحكم</title><main dir="rtl" style="min-height:100vh;display:grid;place-items:center;font-family:sans-serif"><p>تعذّر فتح لوحة التحكم دون اتصال.</p></main>',
        { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
      )),
    )
    return
  }

  // الصفحات العامة: الشبكة أولاً، ثم الذاكرة.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((r) => {
          if (r.status === 200) {
            const copy = r.clone()
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return r
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    )
    return
  }

  // الأصول: الذاكرة أولاً — والتخزين فقط للاستجابات الكاملة (200 لا 206)، وليس الصوت ولا /admin
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((r) => {
        if (r.status === 200 && !isAudio && !request.url.includes('/admin')) {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        }
        return r
      })
    )
  )
})
