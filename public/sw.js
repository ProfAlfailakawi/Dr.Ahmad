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
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable() } catch { /* غير مدعوم */ }
    }
    await self.clients.claim()
  })())
})


// Push حقيقي للوحة التحكم: الخادم يرسل payload بيانات عبر Firebase Cloud Messaging،
// والـService Worker يعرضه حتى إن لم تكن صفحة /admin مفتوحة. يبقى المسار القديم
// registration.showNotification داخل اللوحة fallback للأجهزة غير المسجلة في FCM.
self.addEventListener('push', (event) => {
  let packet = {}
  try { packet = event.data ? event.data.json() : {} } catch {
    packet = { body: event.data ? event.data.text() : '' }
  }
  const data = packet?.data || packet?.notification || packet || {}
  const title = String(data.title || packet?.notification?.title || 'تنبيه جديد من الموقع').slice(0, 120)
  const body = String(data.body || packet?.notification?.body || 'افتح لوحة التحكم للاطلاع على التفاصيل.').slice(0, 360)
  const target = String(data.url || data.link || '/admin?tab=inbox').slice(0, 500)
  const tag = String(data.tag || 'admin-alert').slice(0, 120)
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    data: { url: target },
    icon: '/icon-192.png',
    badge: '/favicon.png',
  }))
})

// الضغط على إشعار Push أو fallback يعيد استخدام نافذة لوحة التحكم إن كانت مفتوحة،
// أو يفتح صندوق الوارد مباشرة.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetPath = String(event.notification?.data?.url || '/admin?tab=inbox')
  const target = new URL(targetPath, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        try {
          const url = new URL(client.url)
          if (url.origin === self.location.origin && 'focus' in client) {
            if ('navigate' in client) await client.navigate(target)
            return client.focus()
          }
        } catch { /* جرّب النافذة التالية */ }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined
    }),
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin) return

  const pathname = url.pathname
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/'

  // الشبكة وحدها للـAPI والملفات القابلة للتنزيل. اعتراض PDF كتنقّل ثم إرجاع
  // غلاف التطبيق المخزّن كان السبب المباشر لرسالة Safari عن redirections.
  // كما أن تخزين /api جعل فهرس الفيديو قديماً أو HTML بدلاً من JSON.
  const networkOnly = pathname.startsWith('/api/')
    || pathname.startsWith('/files/')
    || pathname.startsWith('/audio/')
    || pathname.startsWith('/covers/')
    || /\.(?:pdf|pptx|docx|xlsx|zip|mp3|mp4|webm)$/i.test(pathname)
  if (networkOnly) return

  // طلبات النطاق (Range) — تشغيل الوسائط يطلب أجزاء الملف فيرد الخادم 206 (Partial).
  // المتصفح يرفض تخزين 206 في الكاش؛ فلا نعترضها إطلاقاً ونتركها للشبكة مباشرة.
  if (request.headers.has('range')) return

  const isAudio = pathname.startsWith('/audio/')

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

  // الصفحات العامة: الشبكة أولاً عند وجود اتصال، والكاش fallback فقط عند الفشل.
  // هذا يمنع Safari/Chrome من عرض HTML قديم بعد النشر، مع إبقاء القراءة دون
  // إنترنت كما هي. navigationPreload (المفعّل في activate) يمنع طلباً شبكياً
  // إضافياً ويُبقي الفتح المباشر سريعاً قدر الإمكان.
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const preload = e.preloadResponse ? await e.preloadResponse.catch(() => null) : null
        const response = preload || await fetch(request, { cache: 'no-cache' })
        if (response?.status === 200 && !response.redirected) {
          await cache.put(request, response.clone())
        }
        return response
      } catch {
        return await cache.match(request)
          || await cache.match('/index.html')
          || await cache.match('/')
          || await caches.match('/offline.html')
          || new Response('Offline', { status: 503 })
      }
    })())
    return
  }

  // الأصول: الذاكرة أولاً — والتخزين فقط للاستجابات الكاملة (200 لا 206)، وليس الصوت ولا /admin
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((r) => {
        if (r.status === 200 && !r.redirected && !isAudio && !request.url.includes('/admin')) {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        }
        return r
      })
    )
  )
})
