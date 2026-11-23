#!/usr/bin/env node
/**
 * حارس الطباعة: داخل التطبيق الأصلي لا نافذة منبثقة (window.open) بل window.print() في الإطار
 * الرئيسي؛ وفي المتصفح (سطح مكتب أو هاتف) يبقى السلوك السابق كما هو.
 */
import assert from 'node:assert/strict'

let checks = 0
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1 }

const timers = []
function setup({ native, mobile }) {
  const log = { print: 0, open: 0, before: 0, after: 0 }
  const listeners = {}
  const source = { outerHTML: '<div>x</div>' }
  const popupDoc = { open() {}, write() {}, close() {} }
  globalThis.Capacitor = native ? { isNativePlatform: () => true, getPlatform: () => 'ios' } : undefined
  globalThis.document = {
    title: 't', documentElement: { dir: 'rtl', lang: 'ar' }, body: { className: '' },
    querySelector: () => source, querySelectorAll: () => [],
  }
  globalThis.location = { origin: 'https://x.test' }
  globalThis.window = globalThis
  globalThis.matchMedia = () => ({ matches: mobile })
  globalThis.print = () => { log.print += 1 }
  globalThis.open = () => { log.open += 1; return { document: popupDoc, opener: null } }
  globalThis.addEventListener = (n, f) => { listeners[n] = f }
  globalThis.removeEventListener = (n) => { delete listeners[n] }
  globalThis.setTimeout = (f, ms) => { timers.push({ f, ms }); return timers.length }
  return { log, listeners }
}

const { printSiteContent, NATIVE_AFTER_PRINT_MS } = await import('../src/lib/print.ts')

/* (أ) التطبيق (حتى لو مطابق لوسائط الهاتف): بلا window.open، طباعة واحدة، وafterPrint مرة واحدة */
for (const mobile of [true, false]) {
  timers.length = 0
  const { log, listeners } = setup({ native: true, mobile })
  const r = printSiteContent({ beforePrint: () => log.before++, afterPrint: () => log.after++ })
  eq([r, log.print, log.open, log.before, log.after], [true, 1, 0, 1, 0], `تطبيق (mobile=${mobile}): print فقط بلا popup`)
  eq(timers.map((t) => t.ms), [NATIVE_AFTER_PRINT_MS], 'مهلة afterPrint للتطبيق')
  timers[0].f(); listeners.afterprint?.()
  eq(log.after, 1, 'afterPrint مرة واحدة فقط')
}

/* (ب) المتصفح على الهاتف: ما زال يفتح ورقة الطباعة المنبثقة كما كان */
{
  timers.length = 0
  const { log } = setup({ native: false, mobile: true })
  const r = printSiteContent({ afterPrint: () => log.after++ })
  eq([r, log.open, log.print, log.after, timers.length], [true, 1, 0, 1, 0], 'متصفح هاتف: popup كما كان')
}
/* (ب) المتصفح على الكمبيوتر: window.print فقط */
{
  timers.length = 0
  const { log, listeners } = setup({ native: false, mobile: false })
  const r = printSiteContent({ afterPrint: () => log.after++ })
  eq([r, log.open, log.print, typeof listeners.afterprint, timers.length], [true, 0, 1, 'function', 0], 'متصفح كمبيوتر: print فقط')
}
/* (ب) متصفح هاتف مع حجب النوافذ: يرجع إلى window.print */
{
  const { log } = setup({ native: false, mobile: true })
  globalThis.open = () => null
  const r = printSiteContent({})
  eq([r, log.print], [false, 1], 'popup محجوب: رجوع إلى print')
}
console.log(`native-print: ${checks} فحصاً ناجحاً`)
