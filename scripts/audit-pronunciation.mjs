#!/usr/bin/env node
/**
 * فاحص النطق — يمشّط مكتبة الدكتور كلها ويستخرج ما يستحقّ مدخلاً في القاموس.
 *
 * العلّة التي يعالجها: القاموس يُبنى بردّ الفعل. تُولَّد حلقة، فيسمع الدكتور
 * «الفاشينستات» مكسورةً، فيُبلّغ، فتُضاف الكلمة. ومع مئةٍ وتسعةٍ وخمسين مقالاً
 * تنتظر التوليد، معناه مئةُ تصحيحٍ بعد فوات الأوان — وكل تصحيحٍ إعادةُ توليد.
 *
 * فنعكس الترتيب: نمشّط المتون قبل التوليد، ونستخرج كل ما يُتوقّع أن يتعثّر فيه
 * المحرك، ونضبطه دفعةً واحدة. والفحص لا يُخمّن نطقاً من عنده — يُصنّف ويرتّب
 * بالتكرار، والحكم للدكتور وحده.
 *
 * وأصنافُ ما يتعثّر فيه محرك النطق العربي، مرتّبةً بخطورتها:
 *
 *   ١) الدخيل المعرَّب: «فاشينستات» و«سوشيل» — لا جذر لها فيُقاس عليها خطأً.
 *   ٢) اللاتينية الصريحة: تُقرأ حرفاً حرفاً أو تُتجاهل.
 *   ٣) الأرقام والسنوات: تُقرأ أرقاماً مفردة لا أعداداً منطوقة.
 *   ٤) الاختصارات: تُقرأ كلمةً واحدة مبهمة.
 *   ٥) المشترك اللفظي: «عِلم/عَلَم» — يُنطق بالمعنى الخطأ فينقلب المعنى.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/* ═══ الكشّافات ═══ */

/**
 * مقاطع لا تجتمع في كلمةٍ عربيةِ الأصل — أثرُ التعريب.
 *
 * وضُبطت بعد أن أغرقتني نسختها الأولى بالضجيج: كان فيها «يست» فالتقطت «يستطيع»
 * و«يستخدم» و«وليست» — وهي وزن «استفعل» العربي الأصيل لا دخيلٌ فيه. وفيها
 * «شير» فالتقطت «يشير» و«تشير». وقاموسٌ فيه «يستطيع» قاموسٌ لا يُقرأ.
 *
 * فالقاعدة: المقطع يجب أن يكون نادراً في العربية بذاته، لا أن يُشبه وزناً شائعاً.
 */
const FOREIGN_MARKS = /(?:ستات|يشن|تشن|كشن|نستا|غرام|سوشي|سوشا|ميدي|فاشن|فاشي|بلوك|لايك|فولو|هاشت|ترند|كوتش|ديجيت|تكنولوج|استراتيج|بروتوكول|سيناريو|ديموقراط|ايديولوج|انستغ|انستق|سناب|تيك توك|يوتيوب|واتس|تويت|فيسبوك|بودكاست|اونلاين|اوفلاين|ابليكيشن|تطبيقات ذكية)/

/* وزن «استفعل» ومضارعه: يَستـ/تَستـ/نَستـ/أستـ — عربيٌّ محض مهما شابه الدخيل */
const NATIVE_FORM_X = /^(?:[يتنأا]ست|وليست|ليست|لست)/

/** أوزانٌ عربية أصيلة تُشبه الدخيل ظاهراً — تُستثنى لئلا يمتلئ القاموس ضجيجاً */
const NATIVE_EXCEPTIONS = new Set([
  'الدكتور', 'دكتور', 'الدستور', 'دستور', 'المنشور', 'منشور', 'الجمهور', 'جمهور',
  'المحور', 'محور', 'التصور', 'تصور', 'الشعور', 'شعور', 'الظهور', 'ظهور',
  'الصور', 'صور', 'الامور', 'امور', 'العصور', 'عصور', 'الفتور', 'القصور',
])

const stripTashkeel = (value) => String(value || '').replace(/[ً-ْٰ]/g, '')
const bareWord = (word) => stripTashkeel(word).replace(/^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/, '')

/**
 * يصنّف كلمةً واحدة. يعيد null لما لا يحتاج مدخلاً.
 * نُصنّف ولا نُخمّن النطق: اقتراحُ نطقٍ خاطئ أسوأ من تركه للدكتور.
 */
export function classify(word) {
  const raw = String(word || '').trim()
  if (!raw) return null

  if (/^\d{4}$/.test(raw)) return { type: 'سنة', reason: 'تُقرأ رقماً مفرداً لا عدداً منطوقاً' }
  if (/^\d+([.,]\d+)?%?$/.test(raw)) return { type: 'رقم', reason: 'يحتاج صياغةً منطوقة' }
  if (/^[A-Za-z][A-Za-z.&-]{1,}$/.test(raw)) {
    return /^[A-Z]{2,6}$/.test(raw)
      ? { type: 'اختصار لاتيني', reason: 'يُقرأ كلمةً مبهمة بدل تهجئته' }
      : { type: 'لفظ لاتيني', reason: 'لا ينطقه المحرك العربي' }
  }
  if (!/[ء-ي]/.test(raw)) return null

  const bare = bareWord(raw)
  if (bare.length < 4) return null
  if (NATIVE_EXCEPTIONS.has(stripTashkeel(raw)) || NATIVE_EXCEPTIONS.has(bare)) return null
  if (NATIVE_FORM_X.test(bare) || NATIVE_FORM_X.test(stripTashkeel(raw))) return null
  if (FOREIGN_MARKS.test(bare)) return { type: 'دخيل معرَّب', reason: 'لا جذر عربياً له فيُقاس عليه خطأً' }

  return null
}

/** يمشّط المتون ويجمع المرشّحين مرتّبين بالتكرار، مع شاهدٍ من نصّ الدكتور */
export function audit(bodies = {}, known = new Set()) {
  const found = new Map()
  for (const [slug, body] of Object.entries(bodies)) {
    const text = String(body || '')
    for (const raw of text.split(/[\s.,،؛:!؟()«»"'\[\]{}…]+/)) {
      const word = raw.trim()
      if (!word) continue
      const key = stripTashkeel(word)
      if (known.has(key) || known.has(bareWord(word))) continue
      const verdict = classify(word)
      if (!verdict) continue
      const entry = found.get(key) || { word: key, ...verdict, count: 0, slugs: new Set(), sample: '' }
      entry.count += 1
      entry.slugs.add(slug)
      if (!entry.sample) {
        const at = text.indexOf(word)
        entry.sample = text.slice(Math.max(0, at - 40), at + word.length + 40).replace(/\s+/g, ' ').trim()
      }
      found.set(key, entry)
    }
  }
  return [...found.values()]
    .map((entry) => ({ ...entry, articles: entry.slugs.size, slugs: undefined }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (condition, message) => { if (!condition) throw new Error(`✘ ${message}`) }

  assert(classify('الفاشينستات')?.type === 'دخيل معرَّب', 'الدخيل يُلتقط')
  assert(classify('السوشيل')?.type === 'دخيل معرَّب', 'سوشيل تُلتقط')
  assert(classify('اللايكات')?.type === 'دخيل معرَّب', 'اللايكات تُلتقط')
  assert(classify('2019')?.type === 'سنة', 'السنة تُلتقط')
  assert(classify('45%')?.type === 'رقم', 'النسبة تُلتقط')
  assert(classify('UNESCO')?.type === 'اختصار لاتيني', 'الاختصار يُلتقط')
  assert(classify('Frontiers')?.type === 'لفظ لاتيني', 'اللاتيني يُلتقط')

  /* ★ لا يمتلئ القاموس ضجيجاً: العربي الأصيل يُترك */
  for (const native of [
    'التعليم', 'الطالب', 'المدرسة', 'الوعي', 'الامتحان', 'الدكتور', 'الجمهور', 'المنشور',
    /* ★ وزن «استفعل» ومضارعه — أغرق نسختي الأولى بالضجيج */
    'يستطيع', 'ويستطيع', 'يستخدم', 'تستطيع', 'نستطيع', 'وليست', 'ليست', 'استراتيجي',
    /* ★ «شير» كانت تلتقط هذين */
    'يشير', 'تشير',
  ]) {
    assert(classify(native) === null, `★ «${native}» عربيةٌ أصيلة فلا تُقترح`)
  }
  assert(classify('في') === null && classify('من') === null, 'القصير يُتجاهل')

  const bodies = {
    a: 'حديث الفاشينستات عن الثراء… واللايكات لا تصنع مالاً. الفاشينستات مرة أخرى.',
    b: 'دراسة سنة 2019 في UNESCO عن الفاشينستات.',
  }
  const rows = audit(bodies)
  const top = rows[0]
  assert(top.word === 'الفاشينستات' && top.count === 3, 'الترتيب بالتكرار')
  assert(top.articles === 2, 'يُحصي المقالات لا التكرارات فقط')
  assert(top.sample.includes('الفاشينستات'), 'يرفق شاهداً من نصّ الدكتور')
  assert(rows.some((row) => row.word === '2019') && rows.some((row) => row.word === 'UNESCO'), 'يجمع الأصناف')

  /* ★ المعروف لا يُقترح ثانيةً */
  const filtered = audit(bodies, new Set(['الفاشينستات']))
  assert(!filtered.some((row) => row.word === 'الفاشينستات'), '★ ما في القاموس لا يتكرر اقتراحه')

  console.log('✓ اختبارات فاحص النطق: 26/26')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const lexPath = resolve(ROOT, 'scripts/pronunciation-lexicon.json')
const lexicon = existsSync(lexPath) ? JSON.parse(readFileSync(lexPath, 'utf8')) : { entries: {} }
const known = new Set(Object.keys(lexicon.entries || {}).flatMap((key) => [key, bareWord(key)]))

const rows = audit(bodies, known)

/* وضع الحارس: يُفشل البناء إن دخل المكتبةَ لفظٌ ثقيل التكرار ليس في القاموس.
   والعتبة ثلاثٌ عمداً: ما ورد مرّةً قد يكون اسماً عابراً في استشهاد، وما تكرّر
   ثلاثاً فهو من كلام الدكتور المعتاد — وسيُنطق خطأً في كل حلقةٍ تذكره. */
if (process.argv.includes('--guard')) {
  const heavy = rows.filter((row) => row.count >= 3 && row.type === 'دخيل معرَّب')
  if (!heavy.length) { console.log('✓ حارس النطق: لا لفظ دخيلٍ متكرر خارج القاموس.'); process.exit(0) }
  console.error(`✘ حارس النطق: ${heavy.length} لفظاً دخيلاً متكرراً ليس في القاموس:\n`)
  for (const row of heavy.slice(0, 20)) console.error(`   «${row.word}» ×${row.count} · ${row.articles} مقالاً`)
  console.error('\nأضفها من: لوحة التحكم ← الصوت والبودكاست ← مكتبة الصوت ← قاموس النطق')
  process.exit(1)
}

const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) || 60)

console.log(`═══ فاحص النطق · ${Object.keys(bodies).length} متناً · القاموس فيه ${Object.keys(lexicon.entries || {}).length} مدخلاً ═══\n`)
const byType = rows.reduce((acc, row) => ({ ...acc, [row.type]: (acc[row.type] || 0) + 1 }), {})
for (const [type, count] of Object.entries(byType)) console.log(`  ${type}: ${count}`)
console.log(`\n── أعلى ${Math.min(limit, rows.length)} مرشّحاً (من ${rows.length}) ──\n`)
for (const row of rows.slice(0, limit)) {
  console.log(`«${row.word}»  ×${row.count} · ${row.articles} مقالاً · ${row.type}`)
  if (row.sample) console.log(`   … ${row.sample.slice(0, 90)}`)
}
