#!/usr/bin/env node
/**
 * الحارس الجذريّ: المانيفست لا يستطيع أن يكذب.
 *
 * العطب الذي يعالجه — ووقع ثلاث مرات في يومٍ واحد:
 * يُصفَّر الصوت أو يُحذف ملفٌ منه، ثم تُرفع من جهاز الدكتور نسخةٌ محلية أقدم من
 * المانيفست، فتدهس الحقيقة وتُعيد إدراج مئةٍ وتسعةٍ وخمسين مقالاً ملفاتُها
 * محذوفة. فيرى الزائر مشغّل صوتٍ يضغطه فلا يعمل — والموقع يكذب عليه.
 *
 * وكل علاجٍ يعتمد على أن يتذكّر أحدٌ شيئاً سيسقط يوماً. فالعلاج الوحيد الباقي:
 * ألّا يُصدَّق المانيفست على كلمته. قبل كل بناء نسأل المخزن نفسه عن كل ملف،
 * فما لا وجود له يسقط من المانيفست وحده. فأيّ رفعةٍ قديمة يُصلحها البناء التالي
 * بلا تدخّل، ولا يحتاج الدكتور أن يتذكّر شيئاً عند الرفع.
 *
 * والقيد الحاكم: لا نحذف إلا على يقين. جوابٌ صريح (404/403) يُسقط، وأيّ تعثّر
 * شبكيّ يُبقي — لأن انقطاعاً عابراً يجب ألّا يمحو أرشيف الدكتور.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/** أجوبةٌ تعني «غير موجود» يقيناً. ما عداها شكٌّ لا يُبنى عليه حذف. */
export const DEFINITELY_GONE = Object.freeze([404, 403, 410])

/**
 * يقرّر مصير المانيفست بناءً على أجوبة المخزن.
 * نقيّةٌ بلا شبكة ليُختبر القرار نفسه، فهو موضع الخطر لا طلبُ الشبكة.
 */
export function decide(meta = {}, results = {}) {
  const keep = {}
  const dropped = []
  const unsure = []
  for (const [name, info] of Object.entries(meta)) {
    const status = results[name]
    if (DEFINITELY_GONE.includes(status)) { dropped.push({ name, status }); continue }
    if (typeof status !== 'number') unsure.push(name)
    keep[name] = info
  }
  return { keep, dropped, unsure }
}

/**
 * صمّام الأمان: لو سقط كل شيء فالغالب أن العطب في الشبكة أو الإعداد لا في
 * المخزن. عندها لا نمسّ المانيفست البتة — محوُ الأرشيف كلّه بسبب خطأ إعدادٍ
 * كارثةٌ أكبر بكثير من إبقاء مدخلٍ ميت.
 */
export function isSuspicious(total, droppedCount) {
  return total >= 5 && droppedCount === total
}

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }
  const meta = { 'a.mp3': { bytes: 1 }, 'b.mp3': { bytes: 2 }, 'c.mp3': { bytes: 3 }, 'd.mp3': { bytes: 4 } }

  const out = decide(meta, { 'a.mp3': 200, 'b.mp3': 404, 'c.mp3': 500, 'd.mp3': 200 })
  assert(Object.keys(out.keep).length === 3, 'الموجود يبقى')
  assert(out.dropped.length === 1 && out.dropped[0].name === 'b.mp3', 'المفقود يقيناً يسقط')
  assert(out.keep['c.mp3'], '★ خطأ الخادم (500) لا يُسقط ملفاً — الشكّ لا يُبنى عليه حذف')
  assert(out.unsure.length === 0, '500 جوابٌ معروف لا مجهول')

  const noNetwork = decide(meta, {})
  assert(Object.keys(noNetwork.keep).length === 4, '★ انقطاع الشبكة لا يمحو شيئاً')
  assert(noNetwork.unsure.length === 4, 'ويُبلَّغ عن الجهل به')

  assert(decide(meta, { 'a.mp3': 403 }).dropped.length === 1, 'المحجوب (403) يسقط')
  assert(decide(meta, { 'a.mp3': 206 }).dropped.length === 0, 'الجزئي (206) موجود')

  assert(isSuspicious(10, 10) === true, '★ سقوط كل شيء = عطبٌ في الإعداد لا في المخزن')
  assert(isSuspicious(10, 9) === false, 'سقوط الأكثر وارد')
  assert(isSuspicious(3, 3) === false, 'العدد الصغير قد يسقط كله بحق')

  console.log('✓ اختبارات حارس المانيفست: 11/11')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const BASE = String(process.env.AUDIO_PUBLIC_BASE_URL || 'https://pub-e2ce7a54469544ecab38d55cd80787aa.r2.dev').replace(/\/+$/, '')
const META = resolve(ROOT, 'src/data/audio-meta.json')
if (!existsSync(META)) { console.log('ⓘ لا مانيفست — لا شيء يُفحص.'); process.exit(0) }

const meta = JSON.parse(readFileSync(META, 'utf8'))
const names = Object.keys(meta)
if (!names.length) { console.log('ⓘ المانيفست فارغ.'); process.exit(0) }

/* التوازي ثمانية: يكفي لثلاثمئة ملفٍ في ثوانٍ، ولا يُغرق المخزن بطلباتٍ
   فيردّ بـ429 فنقرأها خطأً على أنها غياب. */
const results = {}
const queue = [...names]
const worker = async () => {
  while (queue.length) {
    const name = queue.shift()
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12_000)
      const response = await fetch(`${BASE}/${encodeURIComponent(name)}`, { method: 'HEAD', signal: controller.signal })
      clearTimeout(timer)
      results[name] = response.status
    } catch { /* تعثّرٌ شبكيّ: يبقى مجهولاً فلا يُحذف */ }
  }
}
await Promise.all(Array.from({ length: 8 }, worker))

const { keep, dropped, unsure } = decide(meta, results)

if (isSuspicious(names.length, dropped.length)) {
  console.log(`⚠ كل الملفات (${names.length}) بدت مفقودة — الأرجح عطبٌ في الإعداد لا في المخزن. لم أمسّ المانيفست.`)
  process.exit(0)
}
if (!dropped.length) {
  console.log(`✓ المانيفست صادق: ${names.length} ملفاً كلها موجودة في المخزن${unsure.length ? ` (${unsure.length} لم يُجب عنها)` : ''}.`)
  process.exit(0)
}

writeFileSync(META, JSON.stringify(Object.fromEntries(Object.keys(keep).sort().map((k) => [k, keep[k]])), null, 2) + '\n')
console.log(`✂ أُسقط من المانيفست ${dropped.length} ملفاً لا وجود له في المخزن:`)
for (const item of dropped.slice(0, 12)) console.log(`   ${item.name} (${item.status})`)
if (dropped.length > 12) console.log(`   … و${dropped.length - 12} غيرها`)
console.log(`✓ بقي ${Object.keys(keep).length} ملفاً صادقاً.`)
