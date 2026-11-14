/*
 * iPhone Duo — مصفوفة القياس النهائية (WebKit).
 *
 * التشغيل (خادم العرض التجريبي يعمل أولاً):
 *   VITE_DEMO_MODE=1 npx vite --port 5110 --strictPort
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node docs/iphone-duo-final/duo-audit.cjs --label after [--base http://127.0.0.1:5110] [--shots]
 *
 * يكتب docs/iphone-duo-final/audit-<label>.json. لا يكتب شيئاً إلى أي خادم:
 * وضع العرض التجريبي يعترض /api/* ويستعمل Firestore وهمياً.
 */
const { webkit } = require('playwright')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const LABEL = arg('label', 'after')
const BASE = arg('base', 'http://127.0.0.1:5110')
const SHOTS = args.includes('--shots')
const ONLY = arg('only', '')
const OUT_DIR = __dirname
const SPINE = 32

const ARTICLE = '/articles/aggression-in-the-sky-and-steadfastness-withinarabic'
const PAGES = [
  { id: 'home', path: '/' },
  { id: 'articles', path: '/articles' },
  { id: 'article', path: ARTICLE },
  { id: 'publications', path: '/publications' },
  { id: 'book', path: '/publications/teaching' },
  { id: 'search-empty', path: '/search?q=%D8%B2%D8%B2%D8%B2%D8%B2%D8%B2%D8%B2' },
  { id: 'contact', path: '/contact' },
  { id: 'mihwar', path: '/mihwar' },
  { id: 'not-found', path: '/no-such-page-duo' },
]
// --set all: كل مسار في src/App.tsx (جرد الشاشات في وثيقة القبول).
const ALL = [
  ...PAGES,
  { id: 'launch', path: '/launch' }, { id: 'live', path: '/live' },
  { id: 'research', path: '/research' }, { id: 'paper', path: '/research/faculty-attitudes-edtech' },
  { id: 'encyclopedia', path: '/publications/encyclopedia' },
  { id: 'listen', path: '/listen' }, { id: 'radio', path: '/radio' }, { id: 'search-start', path: '/search' },
  { id: 'search-askbook', path: '/search?tab=askbook' }, { id: 'ask', path: '/ask' }, { id: 'decade', path: '/decade' },
  { id: 'thought-paths', path: '/thought-paths' }, { id: 'paths', path: '/paths' }, { id: 'path', path: '/paths/ai-and-the-learner' },
  { id: 'concept', path: '/concept/%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85' }, { id: 'thought', path: '/thought' },
  { id: 'atlas', path: '/atlas' }, { id: 'media', path: '/media' }, { id: 'media-detail', path: '/media/radio-idaa' },
  { id: 'questions', path: '/questions' }, { id: 'radar', path: '/radar' }, { id: 'admin', path: '/admin' },
  { id: 'curated', path: '/curated' }, { id: 'upcoming', path: '/upcoming' }, { id: 'inbox', path: '/inbox' },
  { id: 'about', path: '/about' }, { id: 'cv', path: '/cv' }, { id: 'impact', path: '/impact' }, { id: 'cv-file', path: '/cv-file/ar' },
  { id: 'card', path: '/card' }, { id: 'cards', path: '/cards' }, { id: 'privacy', path: '/privacy' }, { id: 'terms', path: '/terms' },
  { id: 'data-deletion', path: '/data-deletion' }, { id: 'mylib', path: '/mylib' },
  { id: 'en', path: '/en' }, { id: 'en-cv', path: '/en/cv' }, { id: 'en-research', path: '/en/research' }, { id: 'en-contact', path: '/en/contact' },
]
const SELECTED = (args.includes('--set') && arg('set') === 'all' ? ALL : PAGES).filter((p) => !ONLY || ONLY.split(',').includes(p.id))

// الوضعيات A–H. inner = يجب أن يكون فيها كتاب مفتوح ومفصل خالٍ.
const VIEWPORTS = [
  ['A', 382, 580], ['A', 385, 571], ['A', 320, 568],
  ['B', 594, 368],
  ['C', 669, 867, 'inner'],
  ['D', 951, 585, 'inner'],
  ['E', 951, 350], ['E', 600, 350],
  ['F', 669, 520, 'inner'], ['F', 600, 480],
  ['G', 768, 1024], ['G', 1024, 768], ['G', 1280, 800], ['G', 1440, 900],
  ['H', 360, 640], ['H', 390, 844], ['H', 844, 390],
  ['S', 320, 350], ['S', 320, 600], ['S', 320, 900],
  ['S', 470, 350], ['S', 470, 600], ['S', 470, 900],
  ['S', 620, 350], ['S', 620, 600], ['S', 620, 900],
].map(([pose, w, h, kind]) => ({ pose, w, h, inner: kind === 'inner' })).filter((v) => !args.includes('--inner') || v.inner)
  .filter((v) => !args.includes('--key') || ['382x580','594x368','669x867','951x585','951x350','600x350','669x520','390x844','1280x800'].includes(`${v.w}x${v.h}`))

/* يجري داخل الصفحة: أرقام فقط. */
function measure({ spine, inner }) {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const cx = vw / 2
  const zone = [cx - spine / 2, cx + spine / 2]
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    // sr-only: مقصوص إلى 1px، لا يُرى.
    if (s.position === 'absolute' && el.offsetWidth <= 1 && el.offsetHeight <= 1) return false
    return true
  }
  // التفاعلي يُعدّ إن كان متاحاً؛ أما النص الزخرفي (aria-hidden) فيُعدّ في فحص الكعب
  // لأنه يُرى بالعين وإن لم يُقرأ بقارئ الشاشة.
  const visible = (el) => shown(el) && !el.closest('[aria-hidden="true"], [inert]')
  const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
  const label = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} «${t}»`
  }

  const doc = document.scrollingElement
  const overflowX = doc.scrollWidth - doc.clientWidth

  // مِحور يعيش داخل Shadow DOM: نجمع الجذور كلها كي يُقاس ما بداخلها أيضاً.
  const roots = [document]
  for (let i = 0; i < roots.length; i++) {
    for (const el of roots[i].querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot)
  }
  const all = (sel) => roots.flatMap((r) => [...r.querySelectorAll(sel)])
  const interactive = all('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab], summary')
    .filter(visible)
  // أهداف لمس صغيرة: العنصر التفاعلي الظاهر في الشاشة أصغر من 44px في البعدين،
  // ولا تُعدّ الروابط المضمّنة داخل فقرة نصية (معيار WCAG 2.5.8 يستثنيها).
  const smallTargets = []
  for (const el of interactive) {
    const r = el.getBoundingClientRect()
    if (!inView(r)) continue
    if (el.tagName === 'A' && el.closest('p, li') && getComputedStyle(el).display === 'inline') continue
    if (r.width < 44 && r.height < 44) smallTargets.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) })
  }

  // عناصر مقصوصة أفقياً: تفاعلي أو عنوان يبدأ أو ينتهي خارج النافذة وليس داخل شريط تمرير أفقي.
  const clipped = []
  for (const el of [...interactive, ...all('h1, h2')].filter(visible)) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > vh) continue
    let p = el.parentElement, inScroller = false
    while (p && p !== document.body) {
      const s = getComputedStyle(p)
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) { inScroller = true; break }
      p = p.parentElement
    }
    if (inScroller) continue
    if (r.left < -1 || r.right > vw + 1) clipped.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) })
  }

  const clipBox = (el, self) => {
    const b = { left: -1e9, right: 1e9, top: -1e9, bottom: 1e9 }
    for (let p = self ? el : (el.parentElement || (el.getRootNode() && el.getRootNode().host)); p; p = p.parentElement || (p.getRootNode && p.getRootNode().host)) {
      const s = getComputedStyle(p)
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const r = p.getBoundingClientRect()
        b.left = Math.max(b.left, r.left); b.right = Math.min(b.right, r.right)
        b.top = Math.max(b.top, r.top); b.bottom = Math.min(b.bottom, r.bottom)
      }
      if (p === document.documentElement) break
    }
    return b
  }
  // المفصل: سطور النص (من Range) والعناصر التفاعلية التي تلمس [cx-16, cx+16].
  const spineHits = []
  if (inner) {
    const seen = new Set()
    const textNodes = []
    for (const root of roots) {
      const walker = document.createTreeWalker(root === document ? document.body : root, NodeFilter.SHOW_TEXT, {
        acceptNode: (t) => (t.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      })
      let t
      while ((t = walker.nextNode())) textNodes.push(t)
    }
    for (const n of textNodes) {
      const el = n.parentElement
      if (!el || !shown(el) || el.closest('svg, script, style, noscript, [inert]')) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const box = clipBox(el, true)
      for (const raw of range.getClientRects()) {
        // ما يقصّه شريط تمرير أو حاوية overflow لا يُرى، فلا يُحسب على الكعب.
        const r = { left: Math.max(raw.left, box.left), right: Math.min(raw.right, box.right), top: Math.max(raw.top, box.top), bottom: Math.min(raw.bottom, box.bottom) }
        r.width = r.right - r.left; r.height = r.bottom - r.top
        if (!inView(r) || r.width < 2) continue
        if (r.right > zone[0] && r.left < zone[1]) {
          const key = label(el)
          if (!seen.has(key)) { seen.add(key); spineHits.push({ kind: 'text', el: key, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) }) }
          break
        }
      }
    }
    for (const el of interactive) {
      const raw = el.getBoundingClientRect()
      const box = clipBox(el, false)
      const r = { left: Math.max(raw.left, box.left), right: Math.min(raw.right, box.right), top: Math.max(raw.top, box.top), bottom: Math.min(raw.bottom, box.bottom) }
      r.width = r.right - r.left; r.height = r.bottom - r.top
      if (!inView(r)) continue
      if (r.right > zone[0] && r.left < zone[1]) {
        const key = label(el)
        if (!seen.has(key)) { seen.add(key); spineHits.push({ kind: 'control', el: key, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) }) }
      }
    }
  }
  const spread = document.querySelector('.duo-book')
  return {
    vw, vh, overflowX, smallTargets, clipped, spineHits,
    spread: spread ? getComputedStyle(spread).display : null,
    spreadOn: !!spread && getComputedStyle(document.body, '::after').content !== 'none',
  }
}

async function settle(page) {
  await page.waitForTimeout(900)
  await page.evaluate(() => document.fonts && document.fonts.ready)
}

;(async () => {
  const browser = await webkit.launch()
  const context = await browser.newContext({ locale: 'ar', reducedMotion: 'reduce', deviceScaleFactor: 1, hasTouch: true, isMobile: true })
  const errors = []
  let page
  const fresh = async () => {
    if (page) await page.close().catch(() => {})
    page = await context.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
  }
  await fresh()
  // WebKit يتعثر أحياناً («internal error») في تشغيلات طويلة: صفحة جديدة ومحاولة أخرى.
  const open = async (url) => {
    for (let attempt = 1; ; attempt++) {
      try { await page.goto(url, { waitUntil: 'load' }); return } catch (e) {
        if (attempt >= 3) throw e
        const vp = page.viewportSize()
        await fresh(); await page.setViewportSize(vp)
      }
    }
  }
  const rows = []
  const t0 = Date.now()
  for (const pg of SELECTED) {
    for (const v of VIEWPORTS) {
      await page.setViewportSize({ width: v.w, height: v.h })
      errors.length = 0
      await open(BASE + pg.path)
      await settle(page)
      const top = await page.evaluate(measure, { spine: SPINE, inner: v.inner })
      let mid = null
      if (v.inner) {
        // نصف الصفحة أيضاً: المفصل يجب أن يبقى خالياً أثناء القراءة، لا في أعلاها فقط.
        await page.evaluate(() => window.scrollTo(0, Math.max(0, document.scrollingElement.scrollHeight * 0.35)))
        await page.waitForTimeout(500)
        mid = await page.evaluate(measure, { spine: SPINE, inner: true })
      }
      rows.push({ page: pg.id, path: pg.path, pose: v.pose, w: v.w, h: v.h, inner: v.inner, top, mid, errors: [...errors] })
      if (SHOTS && v.inner && ['article', 'home', 'articles', 'book'].includes(pg.id)) {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.waitForTimeout(300)
        await page.screenshot({ path: path.join(OUT_DIR, `${LABEL}-${pg.id}-${v.w}x${v.h}.jpg`), type: 'jpeg', quality: 62 })
      }
      process.stdout.write('.')
    }
  }
  await browser.close()
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0)
  const summary = {
    label: LABEL, base: BASE, engine: 'webkit', generatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000),
    snapshots: rows.length,
    overflowX: rows.filter((r) => r.top.overflowX > 0).map((r) => `${r.page}@${r.w}x${r.h}:${r.top.overflowX}`),
    clipped: sum((r) => r.top.clipped.length),
    smallTargets: sum((r) => r.top.smallTargets.length),
    spineHitsInner: sum((r) => r.top.spineHits.length + (r.mid ? r.mid.spineHits.length : 0)),
    spineByPage: Object.fromEntries(SELECTED.map((p) => [p.id, rows.filter((r) => r.page === p.id && r.inner).map((r) => `${r.w}x${r.h}: top ${r.top.spineHits.length} / mid ${r.mid ? r.mid.spineHits.length : '-'}`)])),
    pageErrors: rows.filter((r) => r.errors.length).map((r) => `${r.page}@${r.w}x${r.h}: ${r.errors[0]}`),
  }
  fs.writeFileSync(path.join(OUT_DIR, `audit-${LABEL}.json`), JSON.stringify({ summary, rows }, null, 1))
  console.log('\n' + JSON.stringify(summary, null, 1))
})()
