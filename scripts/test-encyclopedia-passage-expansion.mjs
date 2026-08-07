#!/usr/bin/env node
/**
 * حارس فهرس متن موسوعة تكنولوجيا التعليم.
 *
 * يفحص الملف المنشور نفسه (لا يعيد بناءه)، فيعمل في CI بلا الكتاب الخاص:
 * التغطية، والحدود، والجودة، وخلوّه من التكرار والتداخل ومن كل ما لا يُقتبس.
 *
 * يُبنى الفهرس بـ: node scripts/build-book-quotes.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BODY_LIMITS, bareArabic, looksLikeReference, passageRejection } from './encyclopedia-passage-expansion.mjs'

const root = resolve(import.meta.dirname, '..')
const payload = JSON.parse(readFileSync(resolve(root, 'src/data/book-passages.json'), 'utf8'))
const book = payload.books.find((item) => item.slug === 'encyclopedia')
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

assert.ok(book, 'سجل موسوعة تكنولوجيا التعليم موجود')
const passages = book.passages || []
const pages = new Set(passages.map((item) => Number(item.page)))

/* ═══ التغطية ═══ */
check(passages.length >= 700, `عدد مقاطع الموسوعة ${passages.length} — والمرجو ٧٠٠ فأكثر`)
check(pages.size >= 320, `الصفحات المفهرسة ${pages.size} — والمرجو ٣٢٠ صفحة فأكثر`)
check(payload.coverage?.encyclopediaPassages === passages.length, 'العدد المعلن في التغطية يطابق المحتوى')
check(payload.coverage?.encyclopediaPagesIndexed === pages.size, 'الصفحات المعلنة تطابق المفهرس فعلاً')

/* ═══ الحدود: لا فهرس ولا بيانات نشر ولا قوائم مراجع ═══ */
const outside = [...pages].filter((page) => page < BODY_LIMITS.bodyStart || page > BODY_LIMITS.bodyEnd)
check(outside.length === 0, `مقاطع خارج حدود المتن (${BODY_LIMITS.bodyStart}-${BODY_LIMITS.bodyEnd}): ${outside.slice(0, 8).join('، ')}`)
check(!passages.some((item) => looksLikeReference(item.text)), 'لا مقطع بصيغة مرجع بيبليوغرافي')

/* ═══ الجودة: كل مقطع منشور يجتاز البوابة نفسها التي بُني بها ═══ */
const failed = passages.filter((item) => passageRejection(item.text))
check(failed.length === 0, `مقاطع لا تجتاز بوابة الجودة: ${failed.length}؛ أولها ص${failed[0]?.page}: ${failed[0]?.text?.slice(0, 60)}`)
check(!passages.some((item) => /[0-9٠-٩A-Za-z]/.test(item.text)), 'لا رقم ولا حرف لاتيني — مواضعها غير مضمونة في الاستخراج')
check(passages.every((item) => item.text.length >= BODY_LIMITS.minPassageChars), 'لا مقطع دون الحد الأدنى')
check(passages.every((item) => item.text.length <= BODY_LIMITS.hardMaxChars), 'لا مقطع فوق الحد الأقصى')
check(passages.every((item) => item.id && item.fingerprint && Number(item.page) > 0), 'كل مقطع منسوب إلى صفحته ببصمة ومعرّف')
check(passages.every((item) => item.section), 'كل مقطع منسوب إلى بابه أو فصله')

/* ═══ لا تكرار ولا تداخل ═══ */
check(new Set(passages.map((item) => item.id)).size === passages.length, 'المعرّفات فريدة')
check(new Set(passages.map((item) => item.fingerprint)).size === passages.length, 'البصمات فريدة')
const bare = passages.map((item) => ({ page: Number(item.page), value: bareArabic(item.text) }))
check(new Set(bare.map((item) => item.value)).size === bare.length, 'لا نصّين متطابقين')
/* التداخل: مقطعٌ يبتلع مقطعاً آخر يعني نافذتين من نصٍّ واحد — وهو ما أُزيل. */
const byPage = new Map()
for (const item of bare) byPage.set(item.page, [...(byPage.get(item.page) || []), item.value])
let nested = 0
for (const values of byPage.values()) {
  for (const left of values) for (const right of values) {
    if (left !== right && left.length < right.length && right.includes(left)) nested += 1
  }
}
check(nested === 0, `مقاطع متداخلة داخل الصفحة نفسها: ${nested}`)

/* ═══ الأداء: الفهرس يُجلب عند البحث وحده، فلا يُثقل أول تحميل ═══ */
const bytes = readFileSync(resolve(root, 'src/data/book-passages.json')).length
check(bytes <= 3_500_000, `حجم فهرس المتون ${Math.round(bytes / 1024)}KB — والسقف ٣٫٥ ميغابايت`)
const quotes = JSON.parse(readFileSync(resolve(root, 'src/data/book-quotes.json'), 'utf8'))
const encyclopediaQuotes = quotes.books.find((item) => item.slug === 'encyclopedia')?.quotes || []
check(encyclopediaQuotes.length >= 10, 'مختارات صفحة الكتاب مولَّدة من الفهرس الجديد')
check(encyclopediaQuotes.every((quote) => passages.some((item) => item.fingerprint === quote.fingerprint)), 'كل مختارٍ معروض مأخوذ من الفهرس نفسه')

/* ═══ الكتب الثمانية الأخرى: البوابة نفسها تحرسها ═══ */
/* الأرضيات عند نحو ٨٨٪ من المستوى **بعد المراجعة بالعين**، فتلتقط أي انحدارٍ
   حقيقي ولا تنكسر من تذبذبٍ يسير في المصدر. ونزلت عن سابقتها لأن مئة مقطعٍ
   حُجبت ببصمتها بعد قراءتها — نقصٌ مقصود لا انحدار. */
const floors = {
  'digital-education': [56, 34],
  gamification: [49, 34],
  'handy-tech': [73, 40],
  'kids-tech': [72, 44],
  'mega-data': [106, 51],
  'smart-school': [65, 41],
  teaching: [177, 98],
  'virtual-world': [49, 32],
}
let otherPassages = 0
let otherPages = 0
for (const [slug, [minPassages, minPages]] of Object.entries(floors)) {
  const record = payload.books.find((item) => item.slug === slug)
  assert.ok(record, `سجل «${slug}» موجود`)
  const rows = record.passages || []
  const slugPages = new Set(rows.map((item) => Number(item.page)))
  otherPassages += rows.length
  otherPages += slugPages.size
  check(rows.length >= minPassages, `«${slug}»: ${rows.length} مقطعاً — والأرضية ${minPassages}`)
  check(slugPages.size >= minPages, `«${slug}»: ${slugPages.size} صفحة — والأرضية ${minPages}`)
  const bad = rows.filter((item) => passageRejection(item.text))
  check(bad.length === 0, `«${slug}»: ${bad.length} مقطعاً لا يجتاز بوابة الجودة`)
  check(!rows.some((item) => /[0-9٠-٩A-Za-z]/.test(item.text)), `«${slug}»: لا رقم ولا حرف لاتيني`)
  check(new Set(rows.map((item) => item.fingerprint)).size === rows.length, `«${slug}»: البصمات فريدة`)
  check(!rows.some((item) => looksLikeReference(item.text)), `«${slug}»: لا مقطع بصيغة مرجع`)
}

/* ═══ المعرّفات فريدة عبر الكتب التسعة لا داخل كل كتابٍ وحده ═══
   البادئة الثابتة كانت تجعل ٢٢٢ معرّفاً يتصادم، فيحجب أمرُ الحجب غيرَ ما قُصد. */
const everyId = payload.books.flatMap((item) => (item.passages || []).map((row) => row.id))
check(new Set(everyId).size === everyId.length, `معرّفات متصادمة بين الكتب: ${everyId.length - new Set(everyId).size}`)
for (const record of payload.books) {
  const wrong = (record.passages || []).filter((row) => !String(row.id).startsWith(`${record.slug}-p`))
  check(wrong.length === 0, `«${record.slug}»: ${wrong.length} معرّفاً لا يحمل سلاسة كتابه`)
}

const covered = Math.round((pages.size / (BODY_LIMITS.bodyEnd - BODY_LIMITS.bodyStart + 1)) * 100)
console.log(`✓ فهرس متن الموسوعة: ${checks} تحققاً · ${passages.length} مقطعاً · ${pages.size} صفحة (${covered}٪ من المتن) · بلا تكرار ولا تداخل`)
console.log(`✓ الكتب الثمانية الأخرى: ${otherPassages} مقطعاً · ${otherPages} صفحة · بالبوابة نفسها`)
