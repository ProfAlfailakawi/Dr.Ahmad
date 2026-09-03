#!/usr/bin/env node
/**
 * مستوعِب النصوص المُشكَّلة — من ملفات الدكتور إلى حقل توليد الصوت.
 *
 * الدكتور يملك عشرات الملفات المُشكَّلة، ولكلٍّ منها مقالٌ في المكتبة. ومطابقتها
 * يدوياً واحداً واحداً عملُ ساعات، وخطأُ مطابقةٍ واحد يُنطق مقالاً بنصّ غيره.
 *
 * فهذا يُطابق آلياً ثم يُثبت المطابقة: يجرّد التشكيل ويقارن بالمتون كلّها، ولا
 * يقبل إلا تطابقاً يقارب التمام. وما شكّ فيه يعزله ولا يُدخله — فإدخال نصٍّ
 * مُشكَّل في مقالٍ غير مقاله أسوأ من تركه بلا تشكيل.
 *
 * وينظّف قبل الإدخال بأمر الدكتور:
 *   • التوقيع «الدكتور: أحمد حسين الفيلكاوي» — يُقرأ صوتياً بلا داعٍ
 *   • «@Drahmadkw» — يُنطق حرفاً حرفاً فيُفسد الخاتمة
 *   • ويُبقي العنوان في أوله — بأمره صراحةً
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/** تجريد التشكيل للمقارنة وحدها — النصّ المحفوظ يبقى مُشكَّلاً كما هو */
export const stripTashkeel = (value) => String(value || '').normalize('NFC').replace(/[ً-ْٰ]/g, '')

/** تطبيعٌ للمقارنة: صور الحذف ومسافاتها تختلف بين المصدرين ولا تعني تحريفاً */
export const compareForm = (value) => stripTashkeel(value)
  .replace(/…/g, '..')
  .replace(/\.\.+/g, '..')
  .replace(/\s*\.\.\s*/g, '..')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/\s+/g, ' ')
  .trim()

/**
 * تنظيف الملف قبل حفظه: يُزال ما لا يُقرأ صوتاً.
 * ولا يُمسّ المتن — الحذف من أطرافه فقط، ومحصورٌ بأنماطٍ صريحة.
 */
export function cleanVocalized(raw) {
  let text = String(raw || '').replace(/\r\n/g, '\n')
  const removed = []

  /* حساب تويتر: يُنطق «آت دي آر إيه إتش…» في آخر الحلقة */
  if (/@\s*Drahmadkw/i.test(text)) { removed.push('@Drahmadkw'); text = text.replace(/@\s*Drahmadkw/gi, '') }

  /* التوقيع: يُفحص سطراً سطراً بعد تجريد تشكيله. والنمط المُشكَّل المباشر لا
     يصلح هنا — الحركات تتخلّل كل حرفٍ بصورٍ لا تُحصى، فيفشل على «الفيلكاوِيُّ»
     وينجح على «الفيلكاوي». فنجرّد للفحص ونحذف السطر الأصلي كما هو. */
  const lines = text.split('\n')
  const kept = lines.filter((line) => {
    const bare = stripTashkeel(line).replace(/[إأآٱ]/g, 'ا').replace(/\s+/g, ' ').trim()
    const isSignature = /الفيلكاوي/.test(bare) && bare.length <= 60 && /^(ال)?دكتور|^د\s*[.:]/.test(bare)
    if (isSignature) removed.push('توقيع الاسم')
    return !isSignature
  })
  text = kept.join('\n')

  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), removed }
}

/**
 * يبحث عن المقال الذي يخصّه هذا النصّ.
 * يعيد أفضل مرشّح مع درجة تطابقه — والقرار بالقبول يُتخذ في مكانٍ واحد أدناه.
 */
export function matchArticle(vocalized, bodies) {
  const needle = compareForm(vocalized)
  if (needle.length < 80) return null
  let best = null
  for (const [slug, body] of Object.entries(bodies)) {
    const hay = compareForm(body)
    if (hay.length < 80) continue
    /* التطابق يُقاس على المقال: النصّ المُشكَّل قد يحمل عنواناً زائداً في أوله */
    const contained = needle.includes(hay)
    const score = contained ? 1 : overlapRatio(needle, hay)
    if (!best || score > best.score) best = { slug, score, contained, bodyLength: hay.length }
  }
  return best
}

/** نسبة الكلمات المشتركة — دليلٌ كافٍ للترشيح، لا للقبول */
function overlapRatio(a, b) {
  const words = new Set(b.split(' ').filter((w) => w.length > 2))
  if (!words.size) return 0
  let hits = 0
  for (const word of new Set(a.split(' ').filter((w) => w.length > 2))) if (words.has(word)) hits += 1
  return hits / words.size
}

/** عتبة القبول: دونها يُعزل الملف ولا يُدخل */
export const ACCEPT_THRESHOLD = 0.92

export function decide(match) {
  if (!match) return { ok: false, why: 'لم أجد مقالاً يشبهه' }
  if (match.contained) return { ok: true, why: 'المتن مطابقٌ حرفاً بحرف' }
  if (match.score >= ACCEPT_THRESHOLD) return { ok: true, why: `تطابق ${Math.round(match.score * 100)}٪` }
  return { ok: false, why: `تطابق ${Math.round(match.score * 100)}٪ — دون العتبة` }
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  const cleaned = cleanVocalized('نَصٌّ مُشَكَّلٌ هُنَا.\n\nالدُّكتور: أَحمد حسين الفيلكاوِيُّ\n@Drahmadkw\n')
  assert(!cleaned.text.includes('Drahmadkw'), '★ حساب تويتر يُحذف — كان يُنطق حرفاً حرفاً')
  assert(!/الفيلكاوِيُّ|الفيلكاوي/.test(cleaned.text), '★ التوقيع يُحذف')
  assert(cleaned.text.includes('نَصٌّ مُشَكَّلٌ'), 'والمتن يبقى مُشكَّلاً كما هو')
  assert(cleaned.removed.length === 2, 'ويُبلَّغ عمّا حُذف')

  /* المتن الذي لا توقيع فيه لا يُمَسّ */
  const intact = cleanVocalized('مَتْنٌ نَظِيفٌ بِلَا تَوْقِيعٍ.')
  assert(intact.removed.length === 0 && intact.text === 'مَتْنٌ نَظِيفٌ بِلَا تَوْقِيعٍ.', 'النظيف يبقى كما هو')

  /* المطابقة */
  const bodies = {
    right: 'جاءني احدى الطلاب في الكلية… يبدو عليه الحيرة… فقمت بتعزيز ثقته ليتحدث براحه وطمأنينة كاملة اليوم.',
    other: 'حديث مختلف تماما عن التكنولوجيا والذكاء الاصطناعي في التعليم الحديث ولا علاقة له بالاول ابدا.',
  }
  const vocalized = 'انهِيَار قيِّمٍ.. جَاءَنِي احْدَى الطُّلَّابُ فِي الْكُلِّيَّةِ.. يَبْدُو عَلَيْهِ الْحِيرَةُ.. فَقُمْتُ بِتَعْزِيزِ ثِقَتِهِ لِيَتَحَدَّثَ بِرَاحِهِ وَطُمَأْنِينَةٍ كَامِلَةٍ الْيَوْمَ.'
  const match = matchArticle(vocalized, bodies)
  assert(match.slug === 'right', '★ يُطابق المقال الصحيح')
  assert(decide(match).ok, 'ويُقبل — العنوان الزائد لا يمنع')

  /* ★ لا يُدخل نصّاً في مقالٍ غير مقاله */
  const stranger = matchArticle('نَصٌّ غَرِيبٌ تَمَاماً عَنْ أَسْعَارِ النِّفْطِ وَالذَّهَبِ فِي الأَسْوَاقِ العَالَمِيَّةِ اليَوْمَ وَغَداً وَبَعْدَ غَدٍ أَيْضاً.', bodies)
  assert(!decide(stranger).ok, '★ الغريب يُعزل ولا يُدخل')
  assert(!decide(null).ok, 'وبلا مرشّحٍ لا قبول')

  console.log('✓ اختبارات مستوعِب المُشكَّل: 9/9')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const dirArg = process.argv.find((a) => a.startsWith('--dir='))?.slice(6)
const apply = process.argv.includes('--apply')
if (!dirArg) {
  console.error('الاستعمال: node scripts/ingest-vocalized.mjs --dir="مسار المجلد" [--apply]')
  process.exit(1)
}

const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const outPath = resolve(ROOT, 'src/data/bodies-vocalized.json')
const current = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {}

const files = readdirSync(dirArg)
  .filter((name) => /\.(txt|md)$/i.test(name))
  .map((name) => join(dirArg, name))
  .filter((file) => statSync(file).isFile())

console.log(`═══ ${files.length} ملفاً · ${Object.keys(bodies).length} مقالاً في المكتبة ═══\n`)

const accepted = []
const rejected = []
for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const { text, removed } = cleanVocalized(raw)
  const match = matchArticle(text, bodies)
  const verdict = decide(match)
  const label = basename(file)
  if (verdict.ok) {
    accepted.push({ slug: match.slug, text, label, removed, why: verdict.why })
    console.log(`✓ ${label}\n   → ${match.slug} · ${verdict.why}${removed.length ? ` · حُذف: ${removed.join('، ')}` : ''}`)
  } else {
    rejected.push({ label, why: verdict.why, slug: match?.slug })
    console.log(`✘ ${label}\n   ${verdict.why}${match ? ` (أقربها: ${match.slug})` : ''}`)
  }
}

/* مقالٌ واحد لا يأخذ نصّين: التكرار خطأُ ملفاتٍ لا قرارٌ يُتخذ صامتاً */
const seen = new Map()
for (const item of accepted) {
  if (seen.has(item.slug)) {
    console.log(`\n⚠ ${item.slug} مرشَّحٌ مرّتين: «${seen.get(item.slug)}» و«${item.label}» — لن أُدخل أيّهما.`)
    item.skip = true
    accepted.find((x) => x.label === seen.get(item.slug)).skip = true
  } else seen.set(item.slug, item.label)
}

const ready = accepted.filter((item) => !item.skip)
console.log(`\n── مقبول: ${ready.length} · معزول: ${rejected.length + (accepted.length - ready.length)} ──`)

if (!apply) {
  console.log('\nⓘ تشغيلةٌ جافّة: لم يُكتب شيء. أضف --apply للحفظ.')
  process.exit(0)
}

for (const item of ready) current[item.slug] = item.text
writeFileSync(outPath, JSON.stringify(Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]])), null, 2) + '\n')
console.log(`\n✓ حُفظ ${ready.length} نصّاً مُشكَّلاً · المجموع في الملف: ${Object.keys(current).length}`)
