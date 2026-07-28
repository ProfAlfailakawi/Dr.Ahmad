#!/usr/bin/env node
/**
 * مُطابِق التشكيل — يُلبس حركات ملف الدكتور على النصّ المنشور حرفاً بحرف.
 *
 * الحال قبله: الملفات المُشكَّلة نسخةٌ أقدم أو أحدث من المنشور، فبينها وبين
 * المكتبة جُملٌ زائدة أو ناقصة. والمحرك يشترط التطابق التام (يجرّد التشكيل
 * ويقارن)، فأيّ فرقٍ يُسقط الملف كلّه ويعود إلى التخمين.
 *
 * والقاعدة التي أمر بها الدكتور: **المنشور هو المرجع**. فلا نُعدّل ما يقرؤه
 * الناس، بل نُعيد بناء النصّ المُشكَّل ليطابقه: كلمةً كلمة، نأخذ حركات الملف
 * حيث تتطابق الكلمة، ونأخذ كلمة المنشور كما هي حيث تختلف.
 *
 * فتخرج نسختان لنصٍّ واحد: واحدةٌ بلا حركات للقارئ، وأخرى بحركاتٍ للصوت —
 * لا تختلفان في حرفٍ ولا كلمة.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
/* يُستورد كوحدة أحياناً للفحص؛ فلا يُشغّل نفسه إلا إذا نودي باسمه */
const IS_MAIN = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false

/** تجريد الحركات — للمقارنة وحدها */
export const bare = (value) => String(value || '').normalize('NFC').replace(/[ً-ْٰ]/g, '')

/* حروفٌ تُنطق — والتطويل «ـ» مستثنًى عمداً: هو زخرفةٌ لا حرف، ولو عُدّ حرفاً
   لاختلّ العدّ بين متنٍ يحمله ومسوّدةٍ تُسقطه، فيسقط تشكيل الكلمة كلّها. */
const LETTER = /[ء-ؿف-يٱ-ۓ]/

/**
 * شكل المقارنة: الحروف وحدها.
 *
 * وإسقاط الترقيم ليس تساهلاً — المصدران يختلفان في النجوم والأقواس وعلامات
 * الاقتباس، وكلمةٌ مثل «*خرّيج» لا تطابق «خرّيج» فتضيع، ويقفز المؤشّر إلى
 * موضعٍ أبعد فيُهدر ما بينهما. فنقارن ما يُنطق، ونكتب ترقيم المنشور كما هو.
 */
export const key = (value) => bare(value)
  .replace(/ـ/g, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^ء-يٱ-ۓ0-9٠-٩a-zA-Z]/g, '')

const TASHKEEL = /[ً-ْٰ]/

/**
 * زرع الحركات في كلمة المنشور — لا استبدال الكلمة بها.
 *
 * الفرق ليس تجميلاً: لو أخذنا كلمة الملف كما هي لأخذنا معها علامات اقتباسه
 * («» مقابل "") وهمزاته، فيخرج نصٌّ يشبه المنشور ولا يطابقه. فنمشي على حروف
 * المنشور ونلقُط من الملف حركاتِه وحدها.
 */
/** حرفان يُعدّان واحداً في الرسم وإن اختلفت صورتهما */
const sameLetter = (a, b) => a === b
  || 'اأإآٱ'.includes(a) && 'اأإآٱ'.includes(b)
  || 'ةه'.includes(a) && 'ةه'.includes(b)
  || 'ىي'.includes(a) && 'ىي'.includes(b)

export function graftDiacritics(published, vocalized) {
  /* بعض المتون المنشورة تحمل حركاتٍ متفرّقة من قديم. وهي هنا ضجيج: الملف
     المُشكَّل هو مرجع النطق، والمتن مرجع الحروف. فنجرّد حركات المتن ونزرع
     مكانها حركات الملف، فلا تتراكب حركتان على حرف.

     والمشي على الحروف وحدها — لا على كل المحارف — لأن النجوم والأقواس
     وعلامات الاقتباس تختلف بين المصدرين، فلو عددناها لانحرف الطول وسقط
     التشكيل كلّه في كلمةٍ سليمة. */
  const source = []
  for (const ch of String(vocalized)) {
    if (ch === 'ـ') continue
    if (TASHKEEL.test(ch)) { if (source.length) source[source.length - 1].marks += ch; continue }
    if (LETTER.test(ch)) source.push({ ch, marks: '' })
  }

  const chars = [...bare(published)]
  const letters = chars.filter((c) => LETTER.test(c))
  if (letters.length !== source.length) return published           // اختلف عدد الحروف: لا نُخاطر
  for (let i = 0; i < letters.length; i += 1) {
    if (!sameLetter(letters[i], source[i].ch)) return published    // كلمةٌ أخرى: نردّ المنشور سليماً
  }

  let k = 0
  let out = ''
  for (const ch of chars) {
    out += ch
    if (LETTER.test(ch)) { out += source[k].marks; k += 1 }
  }
  return out
}

/**
 * محاذاة كلمةٍ بكلمة بين المنشور والمُشكَّل (خوارزمية الجسر الزاحف).
 *
 * لكل كلمةٍ في المنشور: إن طابقت الكلمة الحالية في المُشكَّل أخذنا حركاتها،
 * وإلا بحثنا عنها في نافذةٍ قريبة — فالفرق بينهما جُملٌ مُقحمة لا إعادةُ ترتيب.
 * وما لم نجده يبقى كما هو في المنشور بلا حركات: نقصٌ في التشكيل خيرٌ من كلمةٍ
 * ليست من نصّه.
 */
export function alignVocalized(published, vocalized) {
  const target = String(published || '').split(/(\s+)/)     // نحفظ الفواصل كما هي
  const source = String(vocalized || '').split(/\s+/).filter(Boolean)
  const out = []
  let cursor = 0
  let matched = 0
  let plain = 0

  /* الكلمة التالية في المنشور — تُستعمل شاهداً على صحّة القفزة */
  const words = target.filter((p) => p.trim())
  let wordIndex = -1

  for (const piece of target) {
    if (/^\s+$/.test(piece) || !piece) { out.push(piece); continue }
    wordIndex += 1
    const want = key(piece)
    if (!want) { out.push(piece); continue }                 // ترقيمٌ محض: يُكتب كما هو
    const nextWant = key(words[wordIndex + 1] || '')
    let found = -1
    /* نافذةٌ أمامية: الفرق إقحامُ جُملٍ لا خلطُ ترتيب، فالكلمة المقابلة قريبة.
       والقفزة البعيدة مقتلٌ: كلمةٌ شائعة مثل «على» تُطابَق بعد أربعين موضعاً،
       فيقفز المؤشّر ويُيتّم كل ما بينهما. فلا نقبل قفزةً إلا بشاهد: أن تكون
       الكلمة التي تليها في المنشور تالية لها في الملف أيضاً. */
    for (let i = cursor; i < Math.min(source.length, cursor + 60); i += 1) {
      if (key(source[i]) !== want) continue
      const jump = i - cursor
      if (jump > 2 && nextWant && key(source[i + 1] || '') !== nextWant) continue
      found = i
      break
    }
    if (found >= 0) {
      const grafted = graftDiacritics(piece, source[found])
      out.push(grafted)
      cursor = found + 1
      if (TASHKEEL.test(grafted)) matched += 1; else plain += 1
    } else {
      out.push(piece)          // لم نجد حركاتها: تُكتب كما هي في المنشور
      plain += 1
    }
  }

  const text = out.join('')
  return { text, matched, plain, ratio: matched / Math.max(1, matched + plain) }
}

/**
 * التحقق النهائي: المُشكَّل مجرّداً = المنشور مجرّداً، حرفاً بحرف.
 * ويُجرَّد الطرفان لا طرفٌ واحد — فبعض المتون المنشورة فيها حركاتٌ قديمة،
 * ومقارنةُ مجرّدٍ بمُشكَّل تُسقط النصّ السليم وتوهمنا أنه محرَّف.
 */
export function verifyAlignment(published, aligned) {
  return bare(aligned).replace(/\s+/g, ' ').trim() === bare(published).replace(/\s+/g, ' ').trim()
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  /* الحالة الأساسية: تطابقٌ تام */
  const same = alignVocalized('ذهب الطالب إلى المدرسة.', 'ذَهَبَ الطَّالِبُ إِلَى المَدْرَسَةِ.')
  assert(same.text === 'ذَهَبَ الطَّالِبُ إِلَى المَدْرَسَةِ.', 'التشكيل يُنقل كاملاً')
  assert(verifyAlignment('ذهب الطالب إلى المدرسة.', same.text), '★ المجرّد يساوي المنشور')

  /* ★ جملةٌ زائدة في الملف المُشكَّل: تُسقط ولا تدخل المنشور */
  const extra = alignVocalized(
    'هل يكتب فكرة؟ هل يعلق؟',
    'هَلْ يَكْتُبُ فِكْرَةً؟ هَلْ يَصُوغُ مَوْقِفاً؟ هَلْ يُعَلِّقُ؟',
  )
  assert(!extra.text.includes('يَصُوغُ'), '★ الجملة الزائدة لا تدخل — المنشور هو المرجع')
  assert(verifyAlignment('هل يكتب فكرة؟ هل يعلق؟', extra.text), '★ والناتج يطابق المنشور حرفاً')

  /* ★ كلمةٌ في المنشور وليست في الملف: تبقى بلا حركات لا تُحذف */
  const missing = alignVocalized('ذهب الطالب الجديد إلى المدرسة.', 'ذَهَبَ الطَّالِبُ إِلَى المَدْرَسَةِ.')
  assert(missing.text.includes('الجديد'), '★ كلمة المنشور لا تسقط')
  assert(verifyAlignment('ذهب الطالب الجديد إلى المدرسة.', missing.text), 'والتطابق يبقى')
  assert(missing.plain === 1, 'ويُحصى ما بقي بلا حركات')

  /* علامات الاقتباس المختلفة لا تمنع المطابقة */
  const quotes = alignVocalized('قال «الحق» واضح.', 'قَالَ "الحَقُّ" وَاضِحٌ.')
  assert(verifyAlignment('قال «الحق» واضح.', quotes.text), '★ اختلاف صور الاقتباس لا يُفسد التطابق')
  assert(quotes.text.includes('«'), 'وتبقى علامة المنشور نفسها')

  /* ★ الهمزة: حرف المنشور هو الذي يبقى، والحركة وحدها تُؤخذ */
  assert(graftDiacritics('الى', 'إِلَى') === 'اِلَى', '★ همزة الملف لا تُغيّر حرف المنشور')
  assert(graftDiacritics('كلمة', 'كَلِمَةٌ زَائِدَةٌ') === 'كلمة', '★ عند اختلاف الطول يُردّ المنشور سليماً')
  assert(graftDiacritics('نص', 'نَصّ') === 'نَصّ', 'والشدّة تُنقل')

  /* ★ التطويل: زخرفةٌ في المتن لا حرف — ولو عُدّ حرفاً لسقط تشكيل الكلمة */
  assert(graftDiacritics('لـحرية', 'لـحُرِّيَةٍ') === 'لـحُرِّيَةٍ', '★ التطويل لا يُفسد الزرع')
  const tatweel = alignVocalized('قال لـ"حرية" رأياً.', 'قَالَ لـ"حُرِّيَةٍ" رَأْياً.')
  assert(/حُرِّيَةٍ/.test(tatweel.text), '★ والكلمة الملتصقة بتطويلٍ تُشكَّل')
  assert(verifyAlignment('قال لـ"حرية" رأياً.', tatweel.text), 'ويبقى التطابق')

  /* نصٌّ غريبٌ تماماً: يبقى المنشور كما هو بلا حركات */
  const alien = alignVocalized('نص المنشور هنا.', 'كَلَامٌ آخَرُ تَمَاماً لَا عَلَاقَةَ لَهُ.')
  assert(verifyAlignment('نص المنشور هنا.', alien.text), '★ الغريب لا يُلوّث المنشور')

  console.log('✓ اختبارات مُطابِق التشكيل: 16/16')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

if (!IS_MAIN) { /* استوردَنا فاحصٌ — لا نُنفّذ شيئاً */ } else {

const apply = process.argv.includes('--apply')
const inspect = process.argv.find((a) => a.startsWith('--inspect='))?.slice(10)
const drafts = process.argv.find((a) => a.startsWith('--drafts='))?.slice(9)
const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const vocPath = resolve(ROOT, 'src/data/bodies-vocalized.json')
const voc = existsSync(vocPath) ? JSON.parse(readFileSync(vocPath, 'utf8')) : {}

/* عينٌ على مقالٍ بعينه: ما الكلمات التي بقيت بلا حركات؟ الرقم وحده لا يكفي
   للحكم — قد يكون النقص في ملف الدكتور، وقد يكون خللاً في المُطابِق نفسه. */
if (inspect) {
  const aligned = alignVocalized(bodies[inspect], voc[inspect])
  const naked = aligned.text.split(/\s+/).filter((w) => w && !TASHKEEL.test(w) && /[ء-ي]/.test(w))
  console.log(`${inspect} · ${aligned.matched} مُشكَّلة · ${aligned.plain} بلا حركات\n`)
  console.log(naked.slice(0, 60).join(' · '))
  process.exit(0)
}

/**
 * مسوّدات تشكيلٍ جديدة: مجلّدٌ فيه «<slug>.txt» لكلٍّ نصُّ الموقع مُشكَّلاً.
 *
 * لا تُقبل المسوّدة لأنها كُتبت، بل لأنها اجتازت: تُزرع حركاتها على حروف
 * المنشور، ويُحصى ما لم يُشكَّل، ويُعرض ما انحرف كلمةً كلمة. فإن سقطت كلمةٌ
 * واحدة ظهرت باسمها ولم تُدفن في رقمٍ إجمالي.
 */
if (drafts) {
  const files = readdirSync(drafts).filter((name) => name.endsWith('.txt'))
  console.log(`═══ ${files.length} مسوّدة تشكيل ═══\n`)
  let merged = 0
  const problems = []
  for (const name of files.sort()) {
    const slug = name.replace(/\.txt$/, '')
    const published = bodies[slug]
    if (!published) { problems.push(`${slug}: لا متن منشور بهذا الاسم`); continue }
    const draft = readFileSync(resolve(drafts, name), 'utf8')
    const aligned = alignVocalized(published, draft)
    if (!verifyAlignment(published, aligned.text)) { problems.push(`${slug}: تعذّرت المطابقة`); continue }

    /* الكلمات التي لم تصل إليها حركة — تُعرض بأعيانها لتُستدرك */
    const naked = []
    const pubWords = published.split(/\s+/).filter(Boolean)
    const outWords = aligned.text.split(/\s+/).filter(Boolean)
    for (let i = 0; i < outWords.length; i += 1) {
      if (!TASHKEEL.test(outWords[i]) && /[ء-ي]{2,}/.test(outWords[i])) naked.push(pubWords[i] || outWords[i])
    }
    const pct = Math.round(aligned.ratio * 1000) / 10
    console.log(`${naked.length ? '⚠' : '✓'} ${pct}٪ · ${slug}${naked.length ? `\n   بلا حركات (${naked.length}): ${naked.slice(0, 25).join(' · ')}` : ''}`)
    voc[slug] = aligned.text
    merged += 1
  }
  for (const problem of problems) console.log(`✘ ${problem}`)
  console.log(`\n── مقبول: ${merged} · متعذّر: ${problems.length} ──`)
  if (!apply) { console.log('\nⓘ تشغيلةٌ جافّة: لم يُكتب شيء. أضف --apply للحفظ.'); process.exit(0) }
  writeFileSync(vocPath, JSON.stringify(Object.fromEntries(Object.keys(voc).sort().map((k) => [k, voc[k]])), null, 2) + '\n')
  console.log(`\n✓ حُفظ · المجموع الآن: ${Object.keys(voc).length}`)
  process.exit(0)
}

const next = {}
const report = { perfect: 0, adjusted: 0, weak: [], failed: [] }

for (const [slug, vocalized] of Object.entries(voc)) {
  const published = bodies[slug]
  if (!published) { report.failed.push({ slug, why: 'لا متن منشور' }); continue }

  const aligned = alignVocalized(published, vocalized)
  if (!verifyAlignment(published, aligned.text)) {
    report.failed.push({ slug, why: 'تعذّرت المطابقة الحرفية' })
    continue
  }
  next[slug] = aligned.text
  if (aligned.plain === 0) report.perfect += 1
  else {
    report.adjusted += 1
    /* أقلّ من ٩٠٪ حركات: تشكيلٌ ناقصٌ يستحقّ نظر الدكتور */
    if (aligned.ratio < 0.9) report.weak.push({ slug, ratio: Math.round(aligned.ratio * 100), plain: aligned.plain })
  }
}

console.log('═══ مطابقة التشكيل على المنشور ═══\n')
console.log(`  ✓ مُشكَّلٌ بالكامل : ${report.perfect}`)
console.log(`  ✓ مُطابَقٌ ومُصحَّح : ${report.adjusted}  (كلماتٌ من المنشور بلا حركات)`)
console.log(`  ✘ تعذّر           : ${report.failed.length}`)
if (report.weak.length) {
  console.log(`\n  ⚠ تشكيلٌ ناقصٌ (دون ٩٠٪):`)
  for (const item of report.weak) console.log(`     ${item.ratio}٪ · ${item.plain} كلمة بلا حركات · ${item.slug}`)
}
for (const item of report.failed) console.log(`     ✘ ${item.slug}: ${item.why}`)

if (!apply) {
  console.log('\nⓘ تشغيلةٌ جافّة: لم يُكتب شيء. أضف --apply للحفظ.')
  process.exit(0)
}

writeFileSync(vocPath, JSON.stringify(Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]])), null, 2) + '\n')
console.log(`\n✓ حُفظ ${Object.keys(next).length} نصّاً مُشكَّلاً يطابق المنشور حرفاً بحرف.`)

}
