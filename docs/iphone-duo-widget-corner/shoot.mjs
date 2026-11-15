#!/usr/bin/env node
/**
 * لقطات «قبل/بعد» لركن الودجت بـWebKit، مع رسم إطار الركن (أحمر شفاف) فوق اللقطة.
 *   node docs/iphone-duo-widget-corner/shoot.mjs <قبل|بعد> <المنفذ> [مجلد الإخراج]
 * المقاسات: 382×580 و669×867 (طولي) و951×585 (عرضي). الإطار: 96px × clamp(64px,31vh,270px) من أعلى اليمين.
 * ملاحظة: اللقطات من متصفح WebKit على سطح مكتب لا من جهاز Duo؛ إطار الركن تقريبي من القياس المعطى.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , phase = 'after', port = '47931', out = dirname(fileURLToPath(import.meta.url))] = process.argv
const name = phase === 'قبل' || phase === 'before' ? 'before' : 'after'
const { webkit } = await import('playwright')
const browser = await webkit.launch()
const shots = [
  [382, 580, '/'], [669, 867, '/'], [951, 585, '/'],
  [382, 580, '/articles'], [669, 867, '/articles'], [951, 585, '/articles'],
]
for (const [w, h, route] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ar' })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 })
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:.001s!important;transition-duration:.001s!important}' })
  await new Promise((r) => setTimeout(r, 2500))
  await page.evaluate(() => {
    const f = document.createElement('div')
    const h = Math.min(270, Math.max(64, innerHeight * 0.31))
    f.style.cssText = `position:fixed;top:0;right:0;width:96px;height:${h}px;box-sizing:border-box;border:2px solid rgb(220 38 38 / .95);background:rgb(220 38 38 / .14);z-index:2147483647;pointer-events:none`
    document.body.appendChild(f)
  })
  const file = resolve(out, `${name}-${w}x${h}${route === '/' ? '' : '-articles'}.png`)
  await page.screenshot({ path: file })
  console.log(file)
  await ctx.close()
}
await browser.close()
