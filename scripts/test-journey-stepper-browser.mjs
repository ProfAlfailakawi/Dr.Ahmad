#!/usr/bin/env node
/**
 * فحص سلوك خطّاف «رحلة المحطّات» في متصفحٍ حقيقي: تقليل الحركة، العرض مرةً واحدة،
 * StrictMode، إعادة التسلّح عند تغيّر playKey (تنقّلٌ بين مسارين)، واتجاه امتلاء الخيط.
 *
 * اختياريّ ولا يدخل في `npm run build`: يحتاج Playwright وChromium (غير موجودين في dependencies)
 * وخادماً يعمل. شغّله هكذا:
 *   VITE_DEMO_MODE=1 npx vite --port 3017 &
 *   JOURNEY_BASE_URL=http://localhost:3017 JOURNEY_PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/test-journey-stepper-browser.mjs
 * (خادم التطوير يُشغّل StrictMode ويُجري كل الفحوص؛ مع `vite preview` على dist تُفحَص الإنتاج دون فحص تنقّل المسارات.) بدون ذلك يخرج بتنبيهٍ ونجاح.
 */
import { existsSync, readdirSync } from 'node:fs'

const BASE = process.env.JOURNEY_BASE_URL
const PW = process.env.JOURNEY_PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs'
if (!BASE || !existsSync(PW)) {
  console.log('• فحص المتصفح تُجوهل: عيّن JOURNEY_BASE_URL (خادمٌ يعمل) وJOURNEY_PLAYWRIGHT (مسار playwright).')
  process.exit(0)
}
const { chromium } = await import(PW)
const exe = process.env.JOURNEY_CHROME || (readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0])
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
let checks = 0
const ok = (cond, msg) => { if (!cond) { console.error('✘ ' + msg); process.exitCode = 1 } else checks += 1 }
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  return { ctx, page, errors }
}
const snap = (page, sel) => page.evaluate((s) => { const o = document.querySelector(s); return o && { reveal: o.dataset.reveal, states: [...o.children].map((l) => l.dataset.state[0]).join(''), links: [...o.children].map((l) => (l.dataset.link ? 1 : 0)).join('') } }, sel)
const watch = async (page, sel, ms = 6000) => { const seen = []; const end = Date.now() + ms; while (Date.now() < end) { const s = await snap(page, sel); if (s) seen.push(s); await page.waitForTimeout(100) } return seen }
const reveal = (page, sel) => page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sel)

/* ١) /ask: تسلسل، ثم لا إعادة بعد إعادة التحميل (play once)، وStrictMode لا يكسر */
{
  const { ctx, page, errors } = await newPage()
  await page.goto(BASE + '/ask'); await page.evaluate(() => sessionStorage.clear()); await page.goto(BASE + '/ask')
  await page.waitForSelector('[data-journey=full]'); await reveal(page, '[data-journey=full]')
  const seen = await watch(page, '[data-journey=full]')
  const nums = seen.map((s) => s.reveal).filter((r) => r !== 'done').map(Number)
  ok(nums.includes(1) && nums.includes(4), 'ask: التسلسل يمرّ بالمحطات 1..4')
  ok(nums.every((n, i) => i === 0 || n >= nums[i - 1]), 'ask: التسلسل تصاعديّ لا يتراجع')
  ok(seen.at(-1).reveal === 'done' && seen.at(-1).states === 'dddd', 'ask: يستقرّ على الحقيقية')
  await page.reload(); await page.waitForSelector('[data-journey=full]')
  const again = await watch(page, '[data-journey=full]', 1500)
  ok(again.every((s) => s.reveal === 'done'), 'ask: لا إعادة بعد إعادة التحميل في الجلسة نفسها')
  ok(errors.length === 0, 'ask: بلا أخطاء صفحة ' + errors.join('|'))
  await ctx.close()
}
/* ٢) تقليل الحركة: نهائيّ فوراً */
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' })
  await page.goto(BASE + '/ask'); await page.evaluate(() => sessionStorage.clear()); await page.goto(BASE + '/ask')
  await page.waitForSelector('[data-journey=full]'); await reveal(page, '[data-journey=full]')
  const seen = await watch(page, '[data-journey=full]', 1500)
  ok(seen.every((s) => s.reveal === 'done' && s.states === 'dddd'), 'تقليل الحركة: الحالة النهائية من أول إطار')
  await ctx.close()
}
/* ٣) تنقّلٌ بين مسارين دون إعادة تحميل: playKey مختلف يُعاد تسلّحه، والمعروض لا يُعاد */
{
  const { ctx, page, errors } = await newPage()
  await page.goto(BASE + '/paths'); await page.evaluate(() => { sessionStorage.clear(); localStorage.clear() })
  const ids = await page.evaluate(async () => { try { const m = await import('/src/data/learning-paths.ts'); return m.learningPaths.map((p) => ({ id: p.id, keys: p.steps.map((s) => `${s.kind}:${s.ref}`) })) } catch { return null } })
  if (!ids) { console.log('• تنقّل المسارات تُجوهل: يحتاج خادم التطوير (يستورد المصدر)، لا dist.'); await ctx.close() } else {
  const progress = Object.fromEntries(ids.slice(0, 2).map((p) => [p.id, { done: p.keys.slice(0, 2), at: 1 }]))
  await page.evaluate((p) => localStorage.setItem('learning-paths:progress:v1', JSON.stringify(p)), progress)
  await page.goto(BASE + '/paths/' + ids[0].id); await page.waitForSelector('[data-journey=strip]'); await reveal(page, '[data-journey=strip]')
  const first = await watch(page, '[data-journey=strip]', 5500)
  ok(first.some((s) => /^[1-9]$/.test(s.reveal)) && first.at(-1).reveal === 'done' && first.at(-1).states === 'ddcpp', 'مسار 1: تسلسلٌ ثم استقرارٌ على 2 منجزة + جارية')
  ok(first.at(-1).links === '11000', 'مسار 1: الخيط حتى الجارية فقط')
  // تنقّل SPA إلى مسارٍ آخر
  await page.evaluate((id) => { window.history.pushState({}, '', '/paths/' + id); window.dispatchEvent(new PopStateEvent('popstate')) }, ids[1].id)
  await page.waitForTimeout(800)
  await reveal(page, '[data-journey=strip]')
  const second = await watch(page, '[data-journey=strip]', 5500)
  ok(second.some((s) => /^[1-9]$/.test(s.reveal)), 'مسار 2 بعد التنقّل: يُعاد تسلّح المقدّمة (playKey جديد)')
  ok(second.at(-1).reveal === 'done', 'مسار 2: يستقرّ')
  // العودة إلى المسار 1: لا إعادة
  await page.evaluate((id) => { window.history.pushState({}, '', '/paths/' + id); window.dispatchEvent(new PopStateEvent('popstate')) }, ids[0].id)
  await page.waitForTimeout(800); await reveal(page, '[data-journey=strip]')
  const back = await watch(page, '[data-journey=strip]', 1500)
  ok(back.every((s) => s.reveal === 'done'), 'العودة إلى مسار عُرض: لا إعادة')
  ok(errors.length === 0, 'المسارات: بلا أخطاء صفحة ' + errors.join('|'))
  await ctx.close()
  }
}
/* ٤) اتجاه الامتلاء: RTL من اليمين، وجزيرة dir=ltr من اليسار */
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' })
  await page.goto(BASE + '/ask'); await page.waitForSelector('[data-journey=full]')
  const origin = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-journey=full] .journey__link'), '::after').transformOrigin.split(' ')[0])
  const rtl = await origin(); ok(parseFloat(rtl) > 0, 'RTL: أصل التحويل عند اليمين (' + rtl + ')')
  await page.evaluate(() => document.querySelector('[data-journey=full]').setAttribute('dir', 'ltr'))
  const ltr = await origin(); ok(parseFloat(ltr) === 0, 'جزيرة LTR داخل RTL: أصل التحويل عند اليسار (' + ltr + ')')
  await ctx.close()
}
await browser.close()
if (!process.exitCode) console.log(`✓ فحص متصفح رحلة المحطّات: ${checks} فحصاً`)
