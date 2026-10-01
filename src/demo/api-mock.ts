/*
 * اعتراض fetch لمسارات /api/* في وضع العرض: ردود تجريبية ثابتة، بلا أي اتصال بخادم.
 * مسارات /api/encyclopedia/* يخدمها وسيط Vite نفسه عند التشغيل بـ npm run demo، فتمرّ كما هي.
 */
import { articles } from '../data'
import { whatsappMock } from './whatsapp-mock'
import { contentSuggestion, monteurStoryboard, reelInvention, studioImage } from './ai-mock'

const DAY = 86_400_000
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

function usageEvents() {
  const now = Date.now()
  const items: Record<string, unknown>[] = []
  let n = 0
  const pages = ['/', '/articles', '/publications', '/research', '/listen', '/search', '/ask', '/cv', '/contact', ...articles.slice(0, 14).map((a) => `/articles/${a.slug}`)]
  const queries = ['الذكاء الاصطناعي في التعليم', 'التقييم التربوي', 'قلق الامتحانات', 'المعلم الرقمي', 'التعلم المصغر', 'مدرسة المستقبل']
  for (let d = 0; d < 60; d++) {
    const perDay = 14 + ((d * 7) % 11)
    for (let j = 0; j < perDay; j++) {
      const path = pages[(d * 3 + j * 5) % pages.length]
      const sid = `v-${d}-${Math.floor(j / 2)}`
      const at = new Date(now - d * DAY - j * 1_200_000).toISOString()
      const device = j % 3 === 0 ? 'desktop' : 'mobile'
      items.push({ id: `ev${n++}`, name: 'page_view', sessionId: sid, path, referrerPath: j % 4 ? '/' : '', device, props: {}, createdAt: at })
      if (j % 4 === 0) items.push({ id: `ev${n++}`, name: 'scroll_depth', sessionId: sid, path, referrerPath: '', device, props: { depth: [25, 50, 75, 100][j % 4 + (d % 3)] || 50 }, createdAt: at })
      if (j % 5 === 0) items.push({ id: `ev${n++}`, name: 'search_submitted', sessionId: sid, path: '/search', referrerPath: '/', device, props: { query: queries[(d + j) % queries.length], results: 3 + (j % 7) }, createdAt: at })
      if (j % 17 === 0) items.push({ id: `ev${n++}`, name: 'search_zero_results', sessionId: sid, path: '/search', referrerPath: '/', device, props: { query: ['تعلم بالألعاب', 'ميتافيرس'][d % 2] }, createdAt: at })
      if (j % 6 === 0) items.push({ id: `ev${n++}`, name: 'web_vital', sessionId: sid, path, referrerPath: '', device, props: { metric: 'LCP', value: 1400 + ((d * 37 + j * 91) % 900) }, createdAt: at })
      if (j % 6 === 1) items.push({ id: `ev${n++}`, name: 'web_vital', sessionId: sid, path, referrerPath: '', device, props: { metric: 'CLS', value: Number((0.02 + ((d + j) % 7) * 0.01).toFixed(3)) }, createdAt: at })
      if (j % 3 === 0) items.push({ id: `ev${n++}`, name: 'atlas_impression', sessionId: sid, path: '/atlas', referrerPath: '/', device, props: {}, createdAt: at })
      if (j % 6 === 0) items.push({ id: `ev${n++}`, name: 'atlas_discovered', sessionId: sid, path: '/atlas', referrerPath: '/', device, props: {}, createdAt: at })
      if (j % 4 === 1) items.push({ id: `ev${n++}`, name: 'atlas_interaction', sessionId: sid, path: '/atlas', referrerPath: '/', device, props: {}, createdAt: at })
      if (j % 5 === 0 && j % 2 === 0) items.push({ id: `ev${n++}`, name: 'search_result_opened', sessionId: sid, path: '/search', referrerPath: '/', device, props: {}, createdAt: at })
      if (j % 7 === 0) items.push({ id: `ev${n++}`, name: 'living_mind_started', sessionId: sid, path, referrerPath: '', device, props: {}, createdAt: at })
      if (j % 7 === 0 && d % 3) items.push({ id: `ev${n++}`, name: 'living_mind_completed', sessionId: sid, path, referrerPath: '', device, props: {}, createdAt: at })
      if (j % 14 === 0) items.push({ id: `ev${n++}`, name: 'living_mind_result_used', sessionId: sid, path, referrerPath: '', device, props: {}, createdAt: at })
      if (j % 6 === 3) items.push({ id: `ev${n++}`, name: 'web_vital', sessionId: sid, path, referrerPath: '', device, props: { metric: 'TTFB', value: 180 + ((d * 11 + j * 17) % 260) }, createdAt: at })
      if (j % 6 === 4) items.push({ id: `ev${n++}`, name: 'web_vital', sessionId: sid, path, referrerPath: '', device, props: { metric: 'FCP', value: 900 + ((d * 19 + j * 23) % 700) }, createdAt: at })
      if (j % 6 === 2) items.push({ id: `ev${n++}`, name: 'web_vital', sessionId: sid, path, referrerPath: '', device, props: { metric: 'INP', value: 90 + ((d * 13 + j * 29) % 120) }, createdAt: at })
    }
  }
  return items
}

async function handler(url: URL, method: string, bodyText = ''): Promise<Response | null> {
  const p = url.pathname
  if (p.startsWith('/api/encyclopedia/')) return null
  if (p === '/api/admin/analytics/events') {
    const days = Number(url.searchParams.get('days') || 30)
    const all = usageEvents()
    const since = Date.now() - days * 2 * DAY
    const items = all.filter((e) => Date.parse(String(e.createdAt)) >= since)
    return json({ items, window: { days, compare: true, spanMs: days * DAY, since: new Date(since).toISOString(), until: new Date().toISOString() }, truncated: false })
  }
  if (p === '/api/admin/journeys') return json({ items: [] })
  if (p === '/api/admin/control-center') {
    const { previewSnapshot } = await import('../components/admin/ProductionMonitor')
    if (method === 'POST') return json({ ok: true, message: 'تم التنفيذ في وضع العرض التجريبي — لم يتغير شيء فعلياً.', steps: [{ id: 'demo', label: 'فحص تجريبي', ok: true, durationMs: 42, detail: 'اكتمل بنجاح.' }] })
    return json({ ...previewSnapshot, checkedAt: new Date().toISOString() })
  }
  if (p.startsWith('/api/admin/whatsapp/')) return json(whatsappMock(p.slice('/api/admin/whatsapp'.length), method))
  if (p === '/api/admin/whatsapp/status') {
    return json({ status: 'ready', bridgeOnline: true, lastHeartbeatAt: new Date().toISOString(), updated_at: new Date().toISOString(), health: { ready: true, label: 'مساعد واتساب يعمل', why: 'النبض حديث والطابور فارغ.', fix: 'لا يحتاج تدخلاً.' }, diagnostics: { level: 'healthy', title: 'سليم', summary: 'الجسر متصل والردود تصل خلال ثوانٍ.', action: 'لا يحتاج تدخلاً.', checkedAt: new Date().toISOString(), checks: [{ state: 'ok', detail: 'الجسر متصل' }, { state: 'ok', detail: 'الطابور فارغ' }], queue: { pending: 0, leased: 0, failed: 0 } } })
  }
  if (p === '/api/ai/current-context') {
    const h = (n: number) => new Date(Date.now() - n * 3600_000).toISOString()
    return json({ items: [
      { id: 'ce1', title: 'وزارة التربية تعلن إطاراً جديداً لاستخدام الذكاء الاصطناعي في المدارس', summary: 'الإطار يشدد على دور المعلم ويمنع الاعتماد الكامل على الأدوات في التقييم.', source: 'Kuwait Times', url: 'https://example.org/news/ai-framework', publishedAt: h(5), ageHours: 5, relevance: 0.92 },
      { id: 'ce2', title: 'بدء الفصل الدراسي الثاني وسط حديث عن أعباء الواجبات المنزلية', summary: 'أولياء أمور يطالبون بتخفيف الواجبات وإعادة النظر في جدول الاختبارات.', source: 'كونا', url: 'https://example.org/news/homework', publishedAt: h(14), ageHours: 14, relevance: 0.81 },
      { id: 'ce3', title: 'دراسة دولية: القراءة اليومية القصيرة تتفوق على الجلسات الطويلة', summary: 'نتائج تدعم فكرة العادة الصغيرة المنتظمة في التعلم.', source: 'OECD', url: 'https://example.org/news/reading', publishedAt: h(30), ageHours: 30, relevance: 0.74 },
      { id: 'ce4', title: 'مؤتمر إقليمي يناقش مستقبل المعلم الرقمي في الخليج', summary: 'توصيات بتدريب مستمر وربط الترقية بالكفاءة الرقمية.', source: 'الجريدة', url: 'https://example.org/news/conference', publishedAt: h(40), ageHours: 40, relevance: 0.7 },
    ] })
  }
  if (method === 'POST' && ['/api/ai/studio-image', '/api/studio-image', '/api/generate-studio-image', '/api/ai/reel-invention', '/api/ai/monteur-storyboard', '/api/ai/content-suggestion'].includes(p)) {
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(bodyText || '{}') } catch { /* جسم غير صالح: نكمل بقيم افتراضية */ }
    await new Promise((r) => setTimeout(r, 700))
    if (p.endsWith('studio-image') || p === '/api/generate-studio-image') return json(studioImage(body))
    if (p === '/api/ai/reel-invention') return json(reelInvention(body))
    if (p === '/api/ai/monteur-storyboard') return json(monteurStoryboard(body))
    return json(contentSuggestion(body))
  }
  if (p.startsWith('/api/admin/') || p.startsWith('/api/ai/')) return json({ ok: true, demo: true, items: [], message: 'وضع العرض التجريبي: العملية لا تُنفَّذ فعلياً.' })
  if (p.startsWith('/api/')) return json({ ok: true, demo: true })
  return null
}

export function installDemoApi() {
  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const url = new URL(raw, window.location.origin)
      if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
        const bodyText = typeof init?.body === 'string' ? init.body : ''
        const res = await handler(url, (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase(), bodyText)
        if (res) return res
      }
    } catch { /* يمرّ إلى fetch الأصلي */ }
    return real(input as RequestInfo, init)
  }
}
