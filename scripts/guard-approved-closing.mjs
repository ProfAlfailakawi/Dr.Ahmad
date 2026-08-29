#!/usr/bin/env node
/**
 * حارس الختام المتصل.
 *
 * كان المونتاج يلصق مقطعاً قديماً معتمداً كي يضمن نطق الاسم، لكنه كان
 * يغيّر جرس الشخصية في آخر جملة. القرار الأحدث: نثبّت **النطق** في طبقة
 * مدخل الصوت، ونترك الختام يتولد داخل الـTake الحالي كي يبقى نفس الإنسان.
 *
 * يمنع هذا الحارس ثلاث سقطات: عودة المقطع القديم، اختلاف نص الإحالة بين
 * الحلقات، أو خروج اسم العائلة من مدخل الصوت بغير «الفيلتشاوي» المعتمدة.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPronunciationMap, toSpokenKuwaiti } from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const REFERRAL = 'تلقى المقال الأصلي في موقع الدكتور'
export const APPROVED_SPOKEN_FAMILY_NAME = 'الفيلتشاوي'

const engine = readFileSync(resolve(ROOT, 'scripts/podcast-kuwaiti-gemini.mjs'), 'utf8')
const buildStart = engine.indexOf('function buildTimedMaster')
const buildEnd = engine.indexOf('\nfunction ', buildStart + 1)
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'تعذر العثور على مونتاج الحلقة لفحص الختام')
const buildSource = engine.slice(buildStart, buildEnd)
assert.doesNotMatch(buildSource, /kuwaiti-closing-approved\.mp3|CLOSING_CLIP|useFixedClosing/,
  'عاد لصق الختام القديم؛ الاسم يجب أن يتولد داخل نفس الـTake الحالي')
assert.match(buildSource, /const file = files\[i\]/,
  'المونتاج لا يثبت أن كل دور، ومنه الختام، مأخوذ من الـTake الحالي')

const varietySource = readFileSync(resolve(ROOT, 'scripts/lib/kuwaiti-dialogue-variety.mjs'), 'utf8')
assert.doesNotMatch(varietySource, /output\[lastIndex\]\.speaker\s*=\s*['"]female['"]|asset بصوت نورة/,
  'طبقة التنويع ما زالت تجبر الإحالة على نورة بدل صوت الحلقة الحالي')

const pronunciationPath = resolve(ROOT, 'src/data/kuwaiti-pronunciation.json')
assert.ok(existsSync(pronunciationPath), 'دفتر النطق الكويتي مفقود')
const pronunciation = buildPronunciationMap(JSON.parse(readFileSync(pronunciationPath, 'utf8')))
const displayClosing = `${REFERRAL} أحمد حسين الفيلچاوي.`
const spokenClosing = toSpokenKuwaiti(displayClosing, pronunciation)
assert.match(spokenClosing, new RegExp(APPROVED_SPOKEN_FAMILY_NAME),
  `اسم العائلة لا يصل الصوت بالنطق المعتمد «${APPROVED_SPOKEN_FAMILY_NAME}»`)
assert.doesNotMatch(spokenClosing, /الفيل(?:ك|چ)اوي/,
  'الإملاء المعروض وصل إلى الصوت بدل النطق المعتمد')

/* الإملاء وحده ليس ضمانة.
   اللصق القديم كان يضمن الاسم فعلاً — يخرج من مقطعٍ سمعه الدكتور واعتمده.
   وحين حُذف (٢٥ أغسطس ٢٠٢٦) بقي الإملاء وحده، وهو نيّةٌ لا نتيجة: المحرك
   قد يقرأ «الفيلتشاوي» مسطّحةً، وشاهد الحدود يمرّرها لأن مسافتها ٠٫٢ ودون
   حدّ القبول ٠٫٣٤. فسمعها الدكتور في ٢٩ أغسطس وسمّاها «الكارثة».
   فصارت الضمانة شاهداً يسمع الاسم داخل الـTake نفسه ويرفض الأخذ كلّه إن
   سُطّح — يحفظ النطق بلا أن يخسر جرس الشخصية الذي حُذف اللصق لأجله.
   وهذي الأسطر تمنع أن يُحذف الشاهد كما حُذف اللصق: ضمانةٌ لا تُرفع إلا
   بضمانةٍ تحلّ محلّها. */
assert.match(engine, /export function familyNameVerdict/,
  'شاهد اسم العائلة اختفى من المولّد — لا شيء يسمع الاسم بعد حذف اللصق القديم')
assert.match(engine, /aligned\?\.familyName\?\.verdict === 'wrong'/,
  'المولّد ما عاد يرفض الـTake حين يسمع الشاهد الاسم مسطّحاً')
/* الرفض لا بد أن يكون رفضَ جودة (rejectTake ← الرمز ٣) لا خطأَ مولِّد
   (الرمز ١). في تشغيلة ٢٩ أغسطس ٠٣:٠٤ رمى الشاهدُ خطأً بدل أن يرفض أخذاً،
   فسقطت الباقة كلها على أول اسمٍ مسطّح ومعها الحلقة الناجحة قبلها — والمراد
   إعادةُ ذلك الأخذ ببذرة ثانية لا إسقاط التشغيلة. */
const familyGate = engine.slice(engine.indexOf("aligned?.familyName?.verdict === 'wrong'"))
assert.match(familyGate.slice(0, 600), /rejectTake\(/,
  'رفض الاسم يجب أن يمرّ بـrejectTake كي يُعاد الأخذ ببذرة ثانية، لا أن يقتل التشغيلة')

/* والشاهد لا يعمل إلا ومحاذاة التفريغ مشغّلة، فتُثبَّت في مسارَي الإنتاج. */
for (const workflow of ['podcast-kuwaiti-five-canaries.yml', 'podcast-kuwaiti-production-batch.yml']) {
  const path = resolve(ROOT, '.github/workflows', workflow)
  if (!existsSync(path)) continue
  assert.match(readFileSync(path, 'utf8'), /PODCAST_KW_TRANSCRIPT_ALIGNMENT:\s*required/,
    `${workflow}: أُطفئت محاذاة التفريغ، فلا شاهد يسمع الاسم في هذا المسار`)
}

/* نصّ الإحالة يبقى موحداً، لكن الصوت يتجدد مع شخصية الحلقة الحالية. */
const libPath = resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json')
if (existsSync(libPath)) {
  const eps = JSON.parse(readFileSync(libPath, 'utf8')).episodes
  let withReferral = 0; let mismatched = 0
  for (const ep of Object.values(eps)) {
    const t = Array.isArray(ep) ? ep : Object.values(ep)
    const last = String(t[t.length - 1]?.text || '')
    if (!last.includes('الفيل')) continue
    withReferral += 1
    if (!last.includes(REFERRAL)) mismatched += 1
  }
  assert.equal(mismatched, 0, `${mismatched} حلقة ختامها يخالف نصّ الإحالة المقفول`)
  console.log(`✓ الختام المتصل: ${withReferral} حلقة تولّد الاسم مع صوتها الحالي · النطق ${APPROVED_SPOKEN_FAMILY_NAME}`)
} else {
  console.log(`✓ الختام المتصل: الاسم يتولد في نفس الـTake · النطق ${APPROVED_SPOKEN_FAMILY_NAME}`)
}
