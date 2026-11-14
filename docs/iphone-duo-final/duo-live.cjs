/*
 * iPhone Duo — الانتقال الحي (I) واختبارات الإجهاد (J) على WebKit.
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node docs/iphone-duo-final/duo-live.cjs [--base http://127.0.0.1:5110]
 * يكتب docs/iphone-duo-final/live-and-stress.json.
 */
const { webkit } = require('playwright')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const BASE = (args.includes('--base') && args[args.indexOf('--base') + 1]) || 'http://127.0.0.1:5110'
const ARTICLE = '/articles/aggression-in-the-sky-and-steadfastness-withinarabic'
const SEQ = [[951, 585], [669, 867], [470, 700], [382, 580], [594, 368], [951, 350], [951, 585]]

const overflow = (page) => page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)

;(async () => {
  const browser = await webkit.launch()
  const out = { generatedAt: new Date().toISOString(), engine: 'webkit', live: {}, stress: [] }

  // I-1) المقال: الفقرة المقروءة ونص محدد يبقيان عبر الطي (بلا إعادة تحميل).
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, viewport: { width: 951, height: 585 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(BASE + ARTICLE, { waitUntil: 'load' })
    await page.waitForSelector('#article-body p', { timeout: 20000 })
    await page.waitForTimeout(800)
    const pick = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('#article-body p')]
      const p = ps[Math.min(4, ps.length - 1)]
      p.dataset.duoMark = '1'
      window.scrollTo(0, p.getBoundingClientRect().top + scrollY - 140)
      return ps.length
    })
    await page.waitForTimeout(600)
    // تحديد نص داخل الفقرة.
    await page.evaluate(() => {
      const p = document.querySelector('[data-duo-mark]')
      const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r)
    })
    const steps = []
    for (const [w, h] of SEQ) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(900)
      steps.push(await page.evaluate(([w, h]) => {
        const p = document.querySelector('[data-duo-mark]')
        const r = p.getBoundingClientRect()
        const spread = getComputedStyle(document.querySelector('.article-spread')).display
        return { size: `${w}x${h}`, markTop: Math.round(r.top), markVisible: r.bottom > 0 && r.top < innerHeight, selection: getSelection().toString().length > 0, spread, overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth, sameNode: !!p.isConnected }
      }, [w, h]))
    }
    out.live.article = { paragraphs: pick, steps, errors }
    await ctx.close()
  }

  // I-2) التواصل: نص مكتوب في النموذج ونقطة تركيز تبقيان عبر الطي.
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, viewport: { width: 951, height: 585 } })
    const page = await ctx.newPage()
    await page.goto(BASE + '/contact', { waitUntil: 'load' })
    await page.waitForTimeout(1000)
    await page.locator('#booking-form button').first().click()
    await page.waitForTimeout(500)
    const msg = page.locator('#booking-form textarea')
    await msg.fill('رسالة تجريبية لا تُرسل — اختبار الطي')
    await page.locator('#booking-form input[name=name]').fill('اختبار')
    const steps = []
    for (const [w, h] of SEQ) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(700)
      steps.push(await page.evaluate(([w, h]) => ({
        size: `${w}x${h}`,
        message: document.querySelector('#booking-form textarea')?.value.length || 0,
        name: document.querySelector('#booking-form input[name=name]')?.value || '',
        overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      }), [w, h]))
    }
    out.live.contact = { steps }
    await ctx.close()
  }

  // I-3) مِحور: النص في البحث، والتبويب المختار، ونافذة «الإعدادات» المفتوحة.
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, viewport: { width: 951, height: 585 } })
    const page = await ctx.newPage()
    await page.goto(BASE + '/mihwar', { waitUntil: 'load' })
    await page.waitForTimeout(1800)
    const host = 'mihwar-app, [data-mihwar-host]'
    const ok = await page.evaluate(() => {
      const h = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('#search'))
      if (!h) return false
      const r = h.shadowRoot
      const s = r.querySelector('#search'); s.value = 'ذكاء'; s.dispatchEvent(new Event('input', { bubbles: true }))
      const tabs = r.querySelectorAll('.tab'); if (tabs[2]) tabs[2].click()
      return true
    })
    const steps = []
    for (const [w, h] of SEQ) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(700)
      steps.push(await page.evaluate(([w, h]) => {
        const hst = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('#search'))
        const r = hst.shadowRoot
        const sel = r.querySelector('.tab[aria-selected="true"]')
        return { size: `${w}x${h}`, search: r.querySelector('#search').value, selectedTab: sel ? sel.textContent.trim() : null, overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth }
      }, [w, h]))
    }
    out.live.mihwar = { hostFound: ok, host, steps }
    await ctx.close()
  }

  // I-4) نافذة مفتوحة (لوحة البحث الموحد) تبقى مفتوحة عبر الطي.
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, viewport: { width: 951, height: 585 } })
    const page = await ctx.newPage()
    await page.goto(BASE + '/articles', { waitUntil: 'load' })
    await page.waitForTimeout(1000)
    await page.locator('button[aria-label="مركز البحث الموحد"]').click()
    await page.waitForTimeout(700)
    await page.keyboard.type('تعليم')
    const steps = []
    for (const [w, h] of SEQ) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(600)
      steps.push(await page.evaluate(([w, h]) => {
        const dlg = document.querySelector('[role="dialog"]')
        const input = dlg && dlg.querySelector('input')
        return { size: `${w}x${h}`, dialogOpen: !!dlg, typed: input ? input.value : null }
      }, [w, h]))
    }
    out.live.dialog = { steps }
    await ctx.close()
  }

  // I-5) مجلس الفكرة (/listen): حلقة مفتوحة بمشغّلها، ونص في البحث، والمشغّل
  // العنصر نفسه عبر الطي (الشبكة على جذر الصفحة، لا إعادة تركيب).
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, viewport: { width: 951, height: 585 } })
    const page = await ctx.newPage()
    await page.goto(BASE + '/listen', { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await page.locator('input[aria-label="بحث في أسئلة المجلس"]').fill('هل')
    await page.waitForTimeout(500)
    await page.locator('.majlis-row button').first().click()
    await page.waitForTimeout(900)
    await page.evaluate(() => { window.__duoPlayer = document.querySelector('.majlis-player-shell') })
    const steps = []
    for (const [w, h] of SEQ) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(600)
      steps.push(await page.evaluate(([w, h]) => {
        const shell = document.querySelector('.majlis-player-shell')
        return {
          size: `${w}x${h}`,
          playerOpen: !!shell,
          samePlayerElement: !!shell && shell === window.__duoPlayer,
          typed: document.querySelector('input[aria-label="بحث في أسئلة المجلس"]')?.value || '',
          overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        }
      }, [w, h]))
    }
    out.live.listen = { steps }
    await ctx.close()
  }

  // J) إجهاد: 200% نص، ليلي، تقليل حركة، لوحة مفاتيح (ارتفاع 350 مع حقل مركّز)، حواف غير متماثلة.
  const STRESS_PAGES = ['/', '/articles', ARTICLE, '/contact', '/search', '/no-such-page-duo', '/publications/teaching']
  const CASES = [
    { id: 'text-200', css: 'html{font-size:200% !important}', sizes: [[669, 867], [951, 585], [382, 580]] },
    { id: 'dark', scheme: 'dark', sizes: [[669, 867], [951, 585]] },
    { id: 'safe-area-asym', css: 'body{padding-left:44px !important;padding-right:0 !important}', sizes: [[951, 585], [594, 368]] },
  ]
  for (const c of CASES) {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, colorScheme: c.scheme || 'light' })
    const page = await ctx.newPage()
    for (const p of STRESS_PAGES) for (const [w, h] of c.sizes) {
      await page.setViewportSize({ width: w, height: h })
      try { await page.goto(BASE + p, { waitUntil: 'load' }) } catch { continue }
      if (c.scheme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'))
      if (c.css) await page.addStyleTag({ content: c.css })
      await page.waitForTimeout(800)
      const ox = await overflow(page)
      out.stress.push({ case: c.id, page: p, size: `${w}x${h}`, overflowX: ox })
      if (c.id === 'dark' && p === ARTICLE && w === 669) await page.screenshot({ path: path.join(__dirname, 'after-article-669x867-dark.jpg'), type: 'jpeg', quality: 62 })
      if (c.id === 'text-200' && p === ARTICLE && w === 669) await page.screenshot({ path: path.join(__dirname, 'after-article-669x867-text200.jpg'), type: 'jpeg', quality: 62 })
    }
    await ctx.close()
  }
  // لوحة المفاتيح: حقل مركّز ثم يقصر الارتفاع إلى 350 (محاكاة، لا لوحة حقيقية).
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true, viewport: { width: 669, height: 867 } })
    const page = await ctx.newPage()
    for (const [p, sel] of [['/contact', '#booking-form button'], ['/search', 'input[aria-label="بحث في الأرشيف كله"]'], ['/articles', 'input[aria-label="بحث"]']]) {
      await page.setViewportSize({ width: 669, height: 867 })
      await page.goto(BASE + p, { waitUntil: 'load' })
      await page.waitForTimeout(900)
      if (p === '/contact') { await page.locator(sel).first().click(); await page.waitForTimeout(400); await page.locator('#booking-form textarea').focus() } else await page.locator(sel).first().focus()
      await page.keyboard.type('اختبار')
      await page.setViewportSize({ width: 669, height: 350 })
      await page.waitForTimeout(600)
      out.stress.push({ case: 'keyboard-350', page: p, ...(await page.evaluate(() => {
        const a = document.activeElement; const r = a.getBoundingClientRect()
        return { focused: a.tagName, value: a.value, focusedInView: r.top >= 0 && r.bottom <= innerHeight + 1, overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth }
      })) })
    }
    await ctx.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(__dirname, 'live-and-stress.json'), JSON.stringify(out, null, 1))
  console.log(JSON.stringify(out, null, 1))
})()
