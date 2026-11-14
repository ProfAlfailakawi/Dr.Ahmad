#!/usr/bin/env node
/**
 * iPhone Duo — حارس تقاطع «ركن الودجت».
 *
 * يفتح الموقع (وضع العرض التوضيحي) في Playwright WebKit على مقاسات الـDuo المعروفة، طولياً وعرضياً،
 * فاتحاً وداكناً ونصاً ‎200%‎، ثم يعدّ العناصر المهمة (نص مرئي، a/button/input/select/textarea/
 * [role=tab|button|link]/img/svg/video) التي يتقاطع صندوقها مع مستطيل الركن الفيزيائي:
 *     x ≥ vw − widget-w   و   y ≤ widget-h        (widget-h = clamp(64px, 30vh, 200px))
 * الخلفيات الممتدة (علامة data-duo-bleed، أو أيقونة زخرفية aria-hidden بلا تفاعل) تُسجَّل استثناءً ولا تُعدّ.
 * عند scrollY=0 تُفحص الصفحة كلها؛ بعد التمرير تُفحص العناصر الثابتة/اللاصقة فقط (المحتوى يمرّ تحت الودجت بطبيعته).
 *
 * الاستعمال:  node scripts/test-duo-widget.mjs [--quick] [--no-var-check] [--json=out.json]
 *   --no-var-check: لا يشترط أن تكون متغيرات الركن مفعّلة (لقياس الفرع الأساسي قبل الإصلاح).
 * المتطلبات: playwright (webkit) مثبّت. يشغّل vite بنفسه إن لم يجد خادماً على المنفذ.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const QUICK = args.has('--quick')
const NO_VAR = args.has('--no-var-check')
const JSON_OUT = [...args].find((a) => a.startsWith('--json='))?.slice(7)
const BASE_PORT = 47931
const REAL_PORT = 47932

const SIZES = [[382, 580], [470, 780], [594, 368], [669, 867], [951, 585]]
const ALL_VIEWPORTS = SIZES.flatMap(([w, h]) => [{ w, h, tag: `${w}x${h}` }, { w: h, h: w, tag: `${h}x${w}` }])
const ONLY = process.env.DUO_VP ? process.env.DUO_VP.split(',') : null
const VIEWPORTS = ONLY ? ALL_VIEWPORTS.filter((v) => ONLY.includes(v.tag)) : ALL_VIEWPORTS
const ROUTES = ['/', '/articles', '/articles/__first__', '/publications', '/research', '/listen', '/search', '/contact', '/cv', '/en', '/mihwar', '/admin']
/* مقاسات تطبيق Capacitor بارتفاع كامل (بلا أشرطة متصفح). */
const TALL = [[382, 780], [382, 844], [470, 900], [669, 1000], [951, 700]].map(([w, h]) => ({ w, h, tag: `${w}x${h}` }))
const WK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const QUICK_ROUTES = ['/', '/articles', '/contact', '/mihwar']

const serverUp = async (port) => { try { return (await fetch(`http://localhost:${port}/`)).ok } catch { return false } }
const children = []
const ensureServer = async (port, demo) => {
  if (await serverUp(port)) return
  const p = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: ROOT, env: { ...process.env, ...(demo ? { VITE_DEMO_MODE: '1' } : {}) }, stdio: 'ignore' })
  children.push(p)
  for (let i = 0; i < 80; i++) { if (await serverUp(port)) return; await new Promise((r) => setTimeout(r, 500)) }
  throw new Error('vite لم يبدأ على المنفذ ' + port)
}
const stop = () => children.forEach((c) => { try { c.kill() } catch {} })
process.on('exit', stop)

/* ---- يُنفَّذ داخل الصفحة ---- */
const scan = ({ scrolled, zoneW, vh }) => {
  const vw = window.innerWidth
  const zoneH = Math.min(200, Math.max(64, vh * 0.3))
  const zone = { x: vw - zoneW, y: 0, r: vw, b: zoneH }
  const hits = [], bleeds = []
  const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role=tab],[role=button],[role=link],[role=menuitem],[tabindex]:not([tabindex="-1"])'
  const MEDIA = 'img,svg,video,canvas,picture'
  const inZone = (r) => r.width > 0.5 && r.height > 0.5 && r.right > zone.x + 0.5 && r.left < zone.r && r.top < zone.b - 0.5 && r.bottom > zone.y
  const desc = (el) => {
    const id = el.id ? '#' + el.id : ''
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
    return `${el.tagName.toLowerCase()}${id}${cls ? '.' + cls : ''}`
  }
  const visible = (el) => {
    for (let n = el; n; n = n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null)) {
      const cs = getComputedStyle(n)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false
      if (parseFloat(cs.opacity) < 0.05) return false
      if (n.hasAttribute && n.hasAttribute('inert')) return false
    }
    return true
  }
  const fixedish = (el) => {
    for (let n = el; n; n = n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null)) {
      const p = getComputedStyle(n).position
      if (p === 'fixed' || p === 'sticky') return true
    }
    return false
  }
  /* يقصّ المستطيل بحدود الأسلاف المقصوصة (overflow ≠ visible) حتى لا يُحتسب ما لا يراه أحد. */
  const clip = (el, r) => {
    let left = r.left, top = r.top, right = r.right, bottom = r.bottom
    for (let n = el.parentElement || (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null); n; n = n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null)) {
      if (n === document.documentElement || n === document.body) break
      const cs = getComputedStyle(n)
      if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
        const b = n.getBoundingClientRect()
        if (/(hidden|clip|auto|scroll)/.test(cs.overflowX)) { left = Math.max(left, b.left); right = Math.min(right, b.right) }
        if (/(hidden|clip|auto|scroll)/.test(cs.overflowY)) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom) }
      }
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top }
  }
  const visit = (root) => {
    const els = root.querySelectorAll('*')
    for (const el of els) {
      if (el.shadowRoot) visit(el.shadowRoot)
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'PATH', 'G', 'DEFS', 'USE', 'CIRCLE', 'RECT', 'LINE', 'POLYGON', 'POLYLINE', 'ELLIPSE', 'STOP', 'LINEARGRADIENT', 'RADIALGRADIENT', 'CLIPPATH', 'FILTER', 'MASK', 'PATTERN', 'SYMBOL', 'TSPAN', 'TEXT', 'TITLE', 'DESC', 'FOREIGNOBJECT', 'ANIMATE', 'ANIMATETRANSFORM', 'SET'].includes(el.tagName.toUpperCase()) && !(el instanceof HTMLElement)) continue
      if (el.closest && el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
      if (el.id === 'boot-splash' || (el.closest && el.closest('#boot-splash'))) continue
      if (scrolled && !fixedish(el)) continue
      const isInteractive = el.matches(INTERACTIVE)
      const isMedia = el.matches(MEDIA)
      let rects = []
      let kind = ''
      if (isInteractive) { rects.push(el.getBoundingClientRect()); kind = 'تفاعل' }
      else if (isMedia) { rects.push(el.getBoundingClientRect()); kind = 'وسائط' }
      else {
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent.trim()) {
            const range = document.createRange(); range.selectNodeContents(n)
            for (const r of range.getClientRects()) rects.push(r)
          }
        }
        kind = 'نص'
      }
      if (!rects.length) continue
      rects = rects.map((r) => clip(el, r)).filter((r) => r.width > 0.5 && r.height > 0.5)
      if (!rects.some(inZone)) continue
      if (!visible(el)) continue
      const bleed = el.closest && el.closest('[data-duo-bleed]')
      const decorative = isMedia && !isInteractive && ((el.getAttribute('aria-hidden') === 'true') || getComputedStyle(el).pointerEvents === 'none' || el.getAttribute('role') === 'presentation') && !el.closest('a,button')
      const name = desc(el)
      const text = (el.innerText || el.getAttribute('aria-label') || el.alt || '').trim().slice(0, 40)
      if (bleed || decorative) { bleeds.push({ el: name, kind, why: bleed ? 'data-duo-bleed' : 'زخرفة aria-hidden' }); continue }
      const r = rects.find(inZone)
      hits.push({ el: name, kind, text, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], fixed: fixedish(el) })
    }
  }
  visit(document)
  const cs = getComputedStyle(document.documentElement)
  return { hits, bleeds, zone, vars: { w: cs.getPropertyValue('--duo-widget-w').trim(), h: cs.getPropertyValue('--duo-widget-h').trim(), gap: cs.getPropertyValue('--duo-widget-gap').trim() } }
}

const { webkit } = await import('playwright')
await ensureServer(BASE_PORT, true)
await ensureServer(REAL_PORT, false)
const browser = await webkit.launch()
const results = []
const bleedTally = new Map()
const note = (c) => { const k = `${c.kind}|${c.el}|${c.why}`; bleedTally.set(k, (bleedTally.get(k) || 0) + 1) }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const resolveRoute = async (page, route, port) => {
  if (!route.includes('__first__')) return route
  const base = route.split('/__first__')[0]
  await page.goto(`http://localhost:${port}${base}`, { waitUntil: 'domcontentloaded' })
  await wait(1200)
  const href = await page.evaluate((b) => [...document.querySelectorAll(`a[href^="${b}/"]`)].map((a) => a.getAttribute('href')).find((h) => h && h !== b + '/' && !h.includes('#')), base)
  return href || null
}

const runCase = async (ctx, { label, vp, url, state, scheme, text200, port }) => {
  const page = await ctx.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;transition-duration:.001s!important}' })
    if (text200) await page.addStyleTag({ content: 'html{font-size:200%!important}' })
    await wait(1600)
    if (state) await state(page)
    await wait(500)
    const rec = { label: (vp.app ? '[APP] ' : '') + label, vp: vp.tag, scheme, text200, state: state?.label || '', hits: [], bleeds: [], vars: null }
    for (const sy of [0, 700]) {
      if (sy) { await page.evaluate((y) => window.scrollTo(0, y), sy); await wait(350) }
      const r = await page.evaluate(scan, { scrolled: sy > 0, zoneW: 70, vh: vp.h })
      rec.vars = r.vars
      rec.hits.push(...r.hits.map((h) => ({ ...h, sy })))
      rec.bleeds.push(...r.bleeds)
    }
    rec.bleeds.forEach(note)
    results.push(rec)
    return rec
  } catch (e) {
    results.push({ label, vp: vp.tag, scheme, text200, state: state?.label || '', error: String(e.message || e).slice(0, 160), hits: [], bleeds: [] })
  } finally { await page.close() }
}

const openMenu = Object.assign(async (page) => { await page.locator('button.site-menu-trigger').first().click({ timeout: 4000 }).catch(() => {}); await wait(900) }, { label: 'القائمة مفتوحة' })
const openSearch = Object.assign(async (page) => { await page.locator('button[aria-label="مركز البحث الموحد"]').first().click({ timeout: 4000 }).catch(() => {}); await wait(900) }, { label: 'البحث مفتوح' })
const openMySpace = Object.assign(async (page) => { await page.locator('[aria-label*="مساحتي"], .my-space-trigger').first().click({ timeout: 4000 }).catch(() => {}); await wait(900) }, { label: 'مساحتي (sheet)' })
const openReaderTools = Object.assign(async (page) => { await page.evaluate(() => window.scrollTo(0, 900)); await wait(500); await page.locator('.floating-actions button').first().click({ timeout: 3000 }).catch(() => {}); await wait(700) }, { label: 'أدوات القارئ' })

const t0 = Date.now()
const routes = QUICK ? QUICK_ROUTES : ROUTES
const jobs = []
const ctxs = new Map()
const getCtx = async (vp, scheme, app = vp.app) => {
  const k = `${vp.tag}|${scheme}|${app ? 'app' : 'safari'}`
  if (!ctxs.has(k)) {
    const c = browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: scheme, deviceScaleFactor: app ? 2 : 1, hasTouch: true, isMobile: true, locale: 'ar', ...(app ? { userAgent: WK_UA } : {}) })
    if (app) c.then((x) => x.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', platform: 'ios' }; try { Object.defineProperty(navigator, 'standalone', { get: () => undefined }) } catch {} }))
    ctxs.set(k, c)
  }
  return ctxs.get(k)
}
const firstCache = new Map()
const pageJob = (vp, route, scheme, text200) => async () => {
  const ctx = await getCtx(vp, scheme)
  if (route.includes('__first__')) {
    const key = route
    if (!firstCache.has(key)) firstCache.set(key, (async () => { const p = await ctx.newPage(); try { return await resolveRoute(p, route, BASE_PORT) } finally { await p.close() } })())
    route = await firstCache.get(key)
    if (!route) return
  }
  const real = route === '/mihwar' || route === '/admin'
  await runCase(ctx, { label: route + (real ? ' (دخول)' : ''), vp, url: `http://localhost:${real ? REAL_PORT : BASE_PORT}${route}`, scheme, text200 })
}
const stateJob = (vp, scheme, label, path, state, text200 = false) => async () => {
  const ctx = await getCtx(vp, scheme)
  await runCase(ctx, { label, vp, url: `http://localhost:${BASE_PORT}${path}`, state, scheme, text200 })
}
const ctxVps = (list) => list.flatMap((v) => [{ ...v, app: false }, { ...v, app: true }])
const MAIN = ctxVps(VIEWPORTS)
const EXTRA = ONLY ? [] : ctxVps(TALL)
/* ١) كل المسارات على كل المقاسات (Safari ثم APP): فاتح، نص عادي. */
for (const vp of MAIN) for (const route of routes) jobs.push(pageJob(vp, route, 'light', false))
/* ٢) داكن + نص 200% على مجموعة أصغر من المسارات. */
const subset = QUICK ? ['/'] : ['/', '/mihwar']
for (const vp of MAIN) for (const route of subset) { jobs.push(pageJob(vp, route, 'dark', false)); jobs.push(pageJob(vp, route, 'light', true)) }
/* ٣) حالات الحالة: قائمة جانبية، بحث، sheet، 404. */
for (const vp of MAIN) for (const scheme of ['light', 'dark']) {
  jobs.push(stateJob(vp, scheme, '/ + القائمة', '/', openMenu))
  if (scheme === 'light') jobs.push(stateJob(vp, scheme, '/ + القائمة (نص 200%)', '/', openMenu, true))
  jobs.push(stateJob(vp, scheme, '/ + البحث (modal)', '/', openSearch))
  if (scheme === 'light') jobs.push(stateJob(vp, scheme, '/ + مساحتي (sheet)', '/', openMySpace))
  if (scheme === 'light') jobs.push(stateJob(vp, scheme, '/en + القائمة', '/en', openMenu))
  if (scheme === 'light') jobs.push(stateJob(vp, scheme, '/__missing__ (404)', '/__missing__', null))
}
/* ٤) ارتفاعات التطبيق الكاملة: صفحات رئيسية + قائمة. */
for (const vp of EXTRA) { for (const route of ['/', '/articles', '/mihwar']) jobs.push(pageJob(vp, route, 'light', false)); jobs.push(stateJob(vp, 'light', '/ + القائمة', '/', openMenu)) }
const WORKERS = Number(process.env.DUO_WORKERS || 1)
let cursor = 0
await Promise.all(Array.from({ length: WORKERS }, async () => { while (cursor < jobs.length) await jobs[cursor++]() }))
for (const ctx of ctxs.values()) await (await ctx).close()
await browser.close()
stop()

const failedLoads = results.filter((r) => r.error)
const bad = results.filter((r) => r.hits.length)
const totalHits = results.reduce((s, r) => s + r.hits.length, 0)
const inactive = NO_VAR ? [] : results.filter((r) => !r.error && r.vars && (r.vars.w !== '70px' || !r.vars.h))
console.log(`duo-widget (WebKit، سياقان: Safari وAPP/Capacitor مُحاكى): ${results.length} حالة، ${VIEWPORTS.length + (ONLY ? 0 : TALL.length)} مقاساً، ${Math.round((Date.now() - t0) / 1000)}ث`)
console.log(`  حالات بها تقاطع: ${bad.length} · مجموع التقاطعات: ${totalHits} · أخطاء تحميل: ${failedLoads.length} · حالات الركن فيها غير نشط: ${inactive.length}`)
const byEl = new Map()
for (const r of bad) for (const h of r.hits) { const k = `${h.kind}|${h.el}${h.fixed ? ' [ثابت]' : ''}`; const e = byEl.get(k) || { n: 0, cases: new Set(), sample: h }; e.n++; e.cases.add(`${r.label}@${r.vp}`); byEl.set(k, e) }
for (const [k, e] of [...byEl].sort((a, b) => b[1].n - a[1].n).slice(0, 60)) console.log(`  ✗ ${k} ×${e.n} مثال: «${e.sample.text}» [${e.sample.rect}] في ${[...e.cases][0]}`)
console.log(`  استثناءات مسجّلة (خلفيات/زخرفة): ${[...bleedTally.values()].reduce((a, b) => a + b, 0)} في ${bleedTally.size} نوعاً`)
for (const [k, n] of [...bleedTally].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`    · ${k} ×${n}`)
for (const f of failedLoads.slice(0, 8)) console.log(`  ! خطأ: ${f.label}@${f.vp}: ${f.error}`)
if (inactive.length) console.log(`  ! الركن غير نشط في: ${[...new Set(inactive.map((r) => r.vp))].join(', ')}`)
if (JSON_OUT) writeFileSync(resolve(ROOT, JSON_OUT), JSON.stringify({ results, bleeds: [...bleedTally] }, null, 1))
process.exit(bad.length || failedLoads.length > results.length * 0.05 || inactive.length ? 1 : 0)
