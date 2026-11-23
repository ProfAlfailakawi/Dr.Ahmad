#!/usr/bin/env node
/**
 * حارس بديل حفظ بطاقة الاقتباس: داخل التطبيق لا window.open ولا نصّ «قائمة المتصفح»؛
 * في المتصفح السلوك والنصوص السابقة كما هي.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

let checks = 0
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1 }
const ok = (c, m) => { assert.ok(c, m); checks += 1 }

const calls = { open: 0, revoke: 0 }
let popup = {}
globalThis.window = globalThis
URL.createObjectURL = () => 'blob:x'
URL.revokeObjectURL = () => { calls.revoke += 1 }
globalThis.open = () => { calls.open += 1; return popup }
globalThis.setTimeout = () => 0

const { imageSaveFallbackFeedback, NATIVE_IMAGE_SAVE_FALLBACK } = await import('../src/lib/image-save-fallback.ts')

/* (أ) التطبيق */
globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }
const nativeMsg = imageSaveFallbackFeedback({})
eq([nativeMsg, calls.open], [NATIVE_IMAGE_SAVE_FALLBACK, 0], 'التطبيق: بلا window.open')
ok(nativeMsg.includes('زر المشاركة') && !/متصفح|سفاري|Safari/i.test(nativeMsg), 'نص التطبيق بلا متصفح/سفاري')

/* (ب) المتصفح: كما كان */
delete globalThis.Capacitor
eq([imageSaveFallbackFeedback({}), calls.open], ['فُتحت الصورة؛ احفظها من قائمة المتصفح.', 1], 'متصفح: فُتحت الصورة')
popup = null
eq([imageSaveFallbackFeedback({}), calls.open, calls.revoke], ['تعذّر فتح الصورة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.', 2, 1], 'متصفح: النوافذ محجوبة')

/* المكوّنان يستعملان المساعد ولا يبقى window.open مباشر */
for (const f of ['QuoteImage', 'IdeaFeatures']) {
  const src = readFileSync(new URL(`../src/components/${f}.tsx`, import.meta.url), 'utf8')
  ok(src.includes('imageSaveFallbackFeedback(blob)') && !src.includes("window.open(objectUrl"), `${f}: عبر المساعد`)
}
console.log(`native-image-save: ${checks} فحصاً ناجحاً`)
