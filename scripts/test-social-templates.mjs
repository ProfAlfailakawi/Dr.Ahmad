#!/usr/bin/env node
/**
 * حارسُ «فهم النصّ» في قوالب السوشال ميديا.
 *
 * كان اختيار التخطيط يعرف موضوع البطاقة ولا يعرف شكل جملتها، فيقع سؤالٌ صريح
 * في تخطيطٍ لا موضع فيه لسؤال. وأُضيفت قراءةُ الشكل (detectTextShape) لتُسكن
 * كلَّ نصٍّ في التخطيط الذي بُني له.
 *
 * وهذا الاختبار يحرس أمرين:
 *   ١) أن تُقرأ الأشكال صحيحةً — وأخطرها ألا تُقرأ فيرجع «statement» للكل.
 *      وهذا ما وقع فعلاً حين كُتبت الأنماط بـ\b: حدُّ الكلمة في JavaScript
 *      لا يرى الحرف العربي، فسقطت الأنماط كلُّها صامتةً بلا خطأ واحد.
 *   ٢) أن يستقرّ كلُّ نصٍّ في أحد بيوت شكله، وألا يتجاور تخطيطان متطابقان.
 *
 * التشغيل: npm run social:self-test
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = readFileSync(resolve(ROOT, 'src/lib/social-templates.ts'), 'utf8')

/* الوحدة TypeScript وهذا Node عاري. ننتزع منها ما نختبره بدل إدخال أداة
   ترجمةٍ في مسار الاختبار: الأنماط نفسها حرفاً بحرف، فلا نختبر نسخةً منها. */
function extract(name, opener, closer) {
  const start = SOURCE.indexOf(opener)
  if (start < 0) throw new Error(`تعذّر العثور على ${name} — تغيّر الملف`)
  const end = SOURCE.indexOf(closer, start)
  if (end < 0) throw new Error(`تعذّر إغلاق ${name}`)
  return SOURCE.slice(start, end + closer.length)
}

const shapeBlock = extract('SHAPE_SIGNALS', 'const SHAPE_SIGNALS', '\n]')
const layoutBlock = extract('SHAPE_LAYOUTS', 'const SHAPE_LAYOUTS', '\n}')

/* الهوية تُكتب مرةً واحدة: اسم الدكتور داخل التكوين، والتذييل للموقع فقط. */
if (!SOURCE.includes('cleanIdentityFooter(inputTemplate.footer)')) {
  throw new Error('★ التذييل لا يمرّ عبر منقّي الهوية — قد يتكرر اسم الدكتور')
}
if (!SOURCE.includes("الفيلكاوي/gi, '')")) {
  throw new Error('★ منقّي الهوية لا يزيل الاسم المكرر من التذييل')
}
if (!SOURCE.includes('export function analyzeSocialCopy')) {
  throw new Error('★ المخرج البصري لا يحلل النص قبل ترتيب القوالب')
}

/* ★ الحارس الأول: لا \b في أنماطٍ عربية. سقوطٌ صامتٌ لا يكشفه إلا هذا. */
if (/\\b/.test(shapeBlock)) {
  throw new Error('★ وُجد \\b في أنماط الأشكال — لا يعمل مع العربية ويُسقط النمط صامتاً')
}

const normalizeArabic = (value = '') => value
  .toLowerCase()
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')

/* نزع تعليقات الأنواع من رأس التصريح — الأنماط نفسها لا تُمسّ */
const stripTypes = (block, name) => block
  .replace(new RegExp(`const ${name}\\s*:[^=]*=`), 'const value =')
  .replace(new RegExp(`const ${name}\\s*=`), 'const value =')

/* eslint-disable no-new-func */
const SHAPE_SIGNALS = new Function(`${stripTypes(shapeBlock, 'SHAPE_SIGNALS')}; return value`)()
const SHAPE_LAYOUTS = new Function(`${stripTypes(layoutBlock, 'SHAPE_LAYOUTS')}; return value`)()

function detectTextShape(value) {
  const text = normalizeArabic(String(value || '')).trim()
  if (!text) return 'statement'
  for (const [shape, pattern] of SHAPE_SIGNALS) if (pattern.test(text)) return shape
  return 'statement'
}

const cases = [
  ['هل يضعف الذكاء الاصطناعي تفكير الطالب؟', 'question'],
  ['لماذا نقيس الحفظ ونسمّيه فهماً', 'question'],
  ['كيف نقيّم الفهم بدل الحفظ', 'question'],
  ['لا نلغي القياس بل نوسّعه', 'contrast'],
  ['المعلم لا يُقاس بما شرحه بل بما لاحظه', 'contrast'],
  ['ننتقل من التلقين إلى السؤال', 'contrast'],
  ['ليس الهدف سرعة الإجابة بل صحّة الطريق', 'contrast'],
  ['40% من سكان الكوكب تغزوهم التكنولوجيا', 'number'],
  ['نسبة من يقرأ حتى النهاية تتراجع', 'number'],
  ['أولاً نحدد الغاية، ثانياً نختار الأداة', 'sequence'],
  ['علينا أن نسأل عن الأثر قبل الأداة', 'call'],
  ['يجب أن يسبق السؤال الجواب', 'call'],
  ['التقويم هو أن نرى حركة المعرفة لا سكونها', 'definition'],
  ['الأداة تتغير والمعيار الإنساني يبقى', 'statement'],
  ['الأثر قبل الانبهار', 'statement'],
]

let failures = 0
const seen = new Set()
for (const [text, expected] of cases) {
  const actual = detectTextShape(text)
  seen.add(actual)
  if (actual !== expected) {
    failures += 1
    console.error(`✘ «${text}» → ${actual} والمتوقّع ${expected}`)
  }
}

/* ★ الحارس الثاني: ألّا تنهار القراءة إلى شكلٍ واحد. الأنماط المكسورة تُرجع
   «statement» للكل، وهو نجاحٌ ظاهريّ في اختبارٍ لا يعدّ الأشكال. */
if (seen.size < 5) {
  throw new Error(`★ الأشكال المقروءة ${seen.size} فقط — القراءة منهارة إلى شكلٍ واحد`)
}

for (const [shape, layouts] of Object.entries(SHAPE_LAYOUTS)) {
  if (!Array.isArray(layouts) || layouts.length < 3) {
    failures += 1
    console.error(`✘ الشكل «${shape}» بلا بيوتٍ كافية`)
  }
}
for (const shape of ['question', 'contrast', 'number', 'sequence', 'call', 'definition', 'statement']) {
  if (!SHAPE_LAYOUTS[shape]) { failures += 1; console.error(`✘ شكلٌ بلا بيوت: ${shape}`) }
}

if (failures) {
  console.error(`\n✘ سقط ${failures} من ${cases.length + 7}`)
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  cases: cases.length,
  shapesRead: [...seen].sort(),
  shapesDefined: Object.keys(SHAPE_LAYOUTS).length,
  guards: ['no-\\b-in-arabic-patterns', 'no-collapse-to-single-shape', 'single-identity-footer', 'copy-analysis-present'],
}, null, 2))
