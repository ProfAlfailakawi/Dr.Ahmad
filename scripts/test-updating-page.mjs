#!/usr/bin/env node
/**
 * «نُحدّث الموقع» بدل صفحة Google الإنجليزية أثناء النشر.
 *
 *   U1) public/sw.js: فتحُ صفحةٍ بـ 500/502/503/504 ← صفحةُ التحديث (503، no-store)؛
 *       وانقطاعٌ والجهازُ متّصل ← الصفحةُ المحفوظة نفسها إن وُجدت وإلا صفحةُ التحديث؛
 *       والنجاحُ يمرّ كما هو؛ ودون اتصالٍ حقيقي تبقى القراءة من الذاكرة كما كانت.
 *   U2) لا يمسّ /api ولا غيرَ GET، ولا يحفظ جوابَ 5xx في أيّ ذاكرة.
 *   U3) التثبيتُ يحفظ الصفحة ومنطقَها؛ وتنقّلٌ ناجح يعيدهما إن مُسحا.
 *   U4) الصفحة: مستقلّة بلا طلبٍ خارجي ولا سكربتٍ مضمّن (CSP)، RTL، النهار أصلٌ
 *       والليل باختيار الزائر، فصحى بلفظ «الموقع»، تسأل /api/version وتتباطأ ولا تدور.
 *   U5) داخل الصفحة: 5xx بغير JSON على /api ← شريطٌ هادئ، دون تبديل الجواب.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8')
let checks = 0
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1 }
const tick = () => new Promise((done) => setTimeout(done, 0))

const ORIGIN = 'https://dr-alfailakawi.com'
const PAGE = read('public/updating.html')
const SCRIPT = read('public/updating.js')
const pathOf = (key) => new URL(typeof key === 'string' ? key : key.url, ORIGIN).pathname
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
const js = (body) => new Response(body, { status: 200, headers: { 'content-type': 'text/javascript' } })
const GOOGLE_502 = '<html><title>Error 502 (Server Error)!!1</title><p>Error: Server Error. Please try again in 30 seconds.</p></html>'

/** العامل في صندوقٍ معزول، وذاكرةٌ في الذاكرة تسجّل كل كتابة.
    التثبيتُ يجري والشبكة سليمة (installNet)، ثم تجيب الشبكةُ بـ net. */
function worker(net, { online = true, installNet = healthy } = {}) {
  let installing = false
  const route = (pathname) => (installing ? installNet : net)(pathname)
  const source = read('public/sw.js').replace(/__BUILD_ID__/g, 'test')
  const handlers = {}
  const store = new Map()
  const writes = []
  const open = async (name) => {
    if (!store.has(name)) store.set(name, new Map())
    const entries = store.get(name)
    return {
      put: async (key, response) => { writes.push({ key: pathOf(key), status: response.status }); entries.set(pathOf(key), response.clone()) },
      match: async (key) => entries.get(pathOf(key))?.clone(),
      delete: async (key) => entries.delete(pathOf(key)),
      addAll: async (list) => { for (const item of list) { const r = await route(pathOf(item)); if (r.ok) entries.set(pathOf(item), r) } },
    }
  }
  const caches = {
    open,
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name),
    match: async (key) => { for (const entries of store.values()) { const hit = entries.get(pathOf(key)); if (hit) return hit.clone() } },
  }
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn },
    location: { origin: ORIGIN }, skipWaiting() {}, clients: { claim() {} },
    navigator: { onLine: online }, registration: {},
  }
  vm.runInNewContext(source, { self, location: { origin: ORIGIN }, URL, Response, Promise, JSON, String, Number, Set, Date, Math, caches, fetch: (request) => route(pathOf(request)) })
  const lifecycle = async (type) => {
    const waits = []
    installing = type === 'install'
    handlers[type]({ waitUntil: (p) => waits.push(p) })
    try { await Promise.all(waits) } finally { installing = false }
  }
  const request = async (pathname, { mode = 'navigate', method = 'GET' } = {}) => {
    let answer = null
    handlers.fetch({
      request: { url: `${ORIGIN}${pathname}`, mode, method, headers: new Headers() },
      respondWith: (p) => { answer = p },
    })
    let response = null
    let error = null
    try { response = answer ? await answer : null } catch (e) { error = e }
    await tick(); await tick()
    return { answered: answer !== null, response, error }
  }
  return { lifecycle, request, store, writes, open }
}

const withPage = (rest) => async (pathname) => {
  if (pathname === '/updating.html') return html(PAGE)
  if (pathname === '/updating.js') return js(SCRIPT)
  return rest(pathname)
}
const healthy = withPage(async (pathname) => html(`<p>${pathname}</p>`))
const deploying = (status) => withPage(async () => {
  if (status === 'drop') throw new TypeError('Failed to fetch')
  return html(GOOGLE_502, status)
})
const isUpdatingPage = async (response) =>
  Boolean(response) && response.status === 503 && response.headers.get('cache-control') === 'no-store'
  && /text\/html/.test(response.headers.get('content-type') || '') && (await response.clone().text()).includes('نُجدّد الموقع، ونعود بعد قليل')

/* ══ U1 ══ */
for (const status of [500, 502, 503, 504]) {
  const sw = worker(deploying(status))
  await sw.lifecycle('install')
  const article = await sw.request('/articles/some-article')
  const admin = await sw.request('/admin')
  ok(await isUpdatingPage(article.response) && await isUpdatingPage(admin.response), `U1 فتحُ صفحةٍ بـ ${status} ← صفحةُ التحديث (503، no-store)`)
}
{
  const sw = worker(deploying('drop'))
  await sw.lifecycle('install')
  ok(await isUpdatingPage((await sw.request('/articles/never-read')).response), 'U1 انقطاعٌ والجهازُ متّصل وبلا نسخةٍ محفوظة ← صفحةُ التحديث')
}
{
  let down = false
  const sw = worker(withPage(async (p) => { if (down) throw new TypeError('Failed to fetch'); return html(`<p>${p}</p>`) }))
  await sw.lifecycle('install')
  await sw.request('/articles/read-before')
  down = true
  const again = await sw.request('/articles/read-before')
  ok(again.response?.status === 200 && (await again.response.text()) === '<p>/articles/read-before</p>', 'U1 والصفحةُ المقروءة سابقاً تُفتح من الذاكرة قبل صفحة التحديث')
}
{
  const sw = worker(withPage(async () => html('<p>the real page</p>')))
  await sw.lifecycle('install')
  const page = await sw.request('/research')
  ok(page.response?.status === 200 && (await page.response.text()) === '<p>the real page</p>', 'U1 والجوابُ الناجح يمرّ كما هو')
  const redirect = worker(async () => new Response(null, { status: 301, headers: { location: '/en' } }))
  ok((await redirect.request('/en/home')).response?.status === 301, 'U1 والتحويلُ يمرّ كما هو')
  const missing = worker(withPage(async () => html('<p>404</p>', 404)))
  await missing.lifecycle('install')
  ok((await missing.request('/nope')).response?.status === 404, 'U1 و404 تبقى 404')
}
{
  const offNet = async (p) => {
    if (p === '/' || p === '/index.html') return html('<p>shell</p>')
    if (p === '/updating.html') return html(PAGE)
    if (p === '/updating.js') return js(SCRIPT)
    if (p.startsWith('/articles/')) throw new TypeError('offline')
    return html('<p>asset</p>')
  }
  const offline = worker(offNet, { online: false, installNet: offNet })
  await offline.lifecycle('install')
  const shell = await offline.request('/articles/x')
  ok(shell.response && (await shell.response.text()) === '<p>shell</p>', 'U1 ودون اتصالٍ حقيقي يبقى الاحتياط كما كان')
}

/* ══ U2 ══ */
{
  const sw = worker(deploying(502))
  await sw.lifecycle('install')
  const api = await sw.request('/api/encyclopedia/videos', { mode: 'cors' })
  const apiNav = await sw.request('/api/version')
  ok(!api.answered && !apiNav.answered, 'U2 طلباتُ /api لا يمسّها العامل (ولا تنقّلُ /api)')
  ok(!(await sw.request('/contact', { method: 'POST' })).answered, 'U2 وغيرُ GET لا يمسّه العامل')
  const font = await sw.request('/fonts/never-cached.woff2', { mode: 'no-cors' })
  ok(font.response?.status === 502, 'U2 والملفُّ غيرُ المحفوظ يعود بجوابه (ليس تنقّلاً)')
  const fiveXX = sw.writes.filter((w) => w.status >= 500)
  ok(fiveXX.length === 0, `U2 لا يُحفظ جوابُ 5xx في أيّ ذاكرة: ${JSON.stringify(fiveXX)}`)

  const icon = worker(deploying(502))
  await (await icon.open('alfailakawi-test')).put('/logo.svg', new Response('<svg>cached</svg>', { status: 200 }))
  const answered = await icon.request('/logo.svg', { mode: 'no-cors' })
  ok(answered.response?.status === 200 && (await answered.response.text()) === '<svg>cached</svg>', 'U2 وملفٌّ محفوظ طُلب أثناء النشر يُجاب من الذاكرة')
}

/* ══ U3 ══ */
{
  const sw = worker(deploying(502))
  await sw.lifecycle('install')
  const cache = sw.store.get('alfailakawi-test')
  ok(cache?.has('/updating.html') && cache?.has('/updating.js'), 'U3 التثبيتُ يحفظ الصفحة ومنطقَها في ذاكرة الإصدار')
  const script = await sw.request('/updating.js', { mode: 'no-cors' })
  ok(script.response?.status === 200 && (await script.response.text()) === SCRIPT, 'U3 ومنطقُها يُجاب من الذاكرة والشبكة تجيب 5xx')

  const empty = worker(withPage(async () => html(GOOGLE_502, 502)))
  ok((await empty.request('/articles/x')).response?.status === 502, 'U3 وبلا صفحةٍ محفوظة يعود الجوابُ كما جاء (لا أسوأ من قبل)')

  const refill = worker(withPage(async () => html('<p>ok</p>')))
  await refill.request('/articles/x')
  ok(refill.store.get('alfailakawi-test')?.has('/updating.html'), 'U3 وتنقّلٌ ناجح يعيد حفظها إن مُسحت')

  const sw2 = read('public/sw.js')
  ok(sw2.includes('const CACHE = `alfailakawi-${BUILD_ID}`') && sw2.includes("navigationPreload.enable") && sw2.includes("self.addEventListener('push'"), 'U3 ختمُ البناء والتحميلُ المسبق والإشعاراتُ باقية')
}

/* ══ U4 ══ */
{
  ok(/<html lang="ar" dir="rtl">/.test(PAGE), 'U4 الصفحة عربية RTL')
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(PAGE) && PAGE.includes('<script src="/updating.js"></script>'), 'U4 بلا سكربتٍ مضمّن (CSP): منطقُها في /updating.js')
  ok(!/https?:\/\//.test(PAGE.replace(/<!--[\s\S]*?-->/g, '')) && !/https?:\/\//.test(SCRIPT), 'U4 بلا أيّ طلبٍ خارجي')
  ok(!/prefers-color-scheme/.test(PAGE) && /html\.dark\{/.test(PAGE) && SCRIPT.includes("localStorage.getItem('theme-choice') === 'dark'"), 'U4 النهار أصلٌ والليل باختيار الزائر وحده')
  ok(PAGE.includes('نُجدّد الموقع، ونعود بعد قليل') && PAGE.includes('تجد ما كنت تقرؤه في موضعه') && PAGE.includes('ستعود هذه الصفحة وحدها') && PAGE.includes('افتح الصفحة الآن') && !/البرنامج|✨/.test(PAGE + SCRIPT), 'U4 النصّ بلفظ «الموقع» قصيراً: يُجدَّد، ويعود وحده، ويُفتح الآن')
  ok(SCRIPT.includes("'انقطع الاتصال بالإنترنت'") && SCRIPT.includes('سنعيد المحاولة كل نصف دقيقة'), 'U4 ودون اتصالٍ تقول ذلك، وإن طال التجديد قالت ذلك')
  ok(/<title>الموقع قيد التحديث · د\. أحمد الفيلكاوي<\/title>/.test(PAGE), 'U4 العنوان باسم الموقع')
  ok(PAGE.includes('viewBox="0 0 25 15"') && PAGE.includes('<rect x="0" y="0" width="25" height="1"/>'), 'U4 العلامة الكوفية من logo.svg نفسه')
  ok(/prefers-reduced-motion:reduce/.test(PAGE), 'U4 وتسكن الحركة لمن طلب ذلك')
  ok(/id="note" role="status" aria-live="polite"/.test(PAGE) && PAGE.includes('id="retry"') && PAGE.includes('id="issue-date"'), 'U4 السطر المتغيّر معلَنٌ لقارئ الشاشة، وزرّ المحاولة وسطر العدد قائمان')
  ok(SCRIPT.includes("HEALTH = '/api/version'") && /FIRST = 3000, CEILING = 15000, PATIENT = 30000/.test(SCRIPT) && /recent\(\)\.length >= 3/.test(SCRIPT), 'U4 تسأل /api/version كل ٣ ثوانٍ وتتباطأ، ولا تدور في حلقة')
  ok(/location\.replace\('\/'\)/.test(SCRIPT) && /location\.reload\(\)/.test(SCRIPT), 'U4 تعيد فتح الرابط نفسه، وباسمها المباشر تعود إلى الرئيسية')
}

/* ══ U5 ══ */
{
  const source = read('src/lib/updating-notice.ts')
  const main = read('src/main.tsx')
  ok(main.includes('installUpdatingNotice()'), 'U5 الشريط مركَّب عند الإقلاع')
  ok(source.includes("'يُجدَّد الموقع الآن؛ تعود الصفحة وحدها بعد قليل.'") && source.includes("HEALTH_URL = '/api/version'"), 'U5 الشريط بلفظ الموقع ويسأل /api/version')
  ok(/UPDATING_STATUSES\.has\(status\) && !String\(contentType \|\| ''\)\.includes\('application\/json'\)/.test(source), 'U5 يُعرف جوابُ المنصّة: 5xx بغير JSON')
  ok(/url\.origin === window\.location\.origin && url\.pathname\.startsWith\('\/api\/'\)/.test(source) && /return response\n/.test(source), 'U5 يراقب /api على الأصل نفسه فقط ولا يبدّل الجواب')
}

console.log(`✓ صفحة «نُحدّث الموقع» وعامل الخدمة والشريط: ${checks} فحصاً`)
