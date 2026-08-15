#!/usr/bin/env node
/**
 * ماسح المخاطر الصوتية في المتن الكويتي.
 *
 * العلّة التي أنتجته: الدكتور يسمع حلقةً كاملةً (أربع دقائق) ثم يسمّي كلماتٍ
 * خرجت إماراتيةً أو فارسية. وهذا لا يتوسّع إلى ١٤٣ حلقة — أربع ساعات سماعٍ
 * لكل جولة. فبدل أن ننتظر أذنه لتكتشف الكلمة، نكشفها قبل التوليد.
 *
 * المبدأ المستخلَص من ست عشرة جولةً في يومٍ واحد: المحرّك يعجز عن صوتين
 * تحتاجهما الكويتية — القاف الجيمية (گ) والچ. وكل كلمةٍ سمعها الدكتور خطأً
 * كانت تحتاج أحدهما. أمّا ما لا يحتاجهما فيخرج سليماً.
 *
 * فالماسح يرتّب كلمات المتن بحسب حاجتها إلى صوتٍ يعجز عنه المحرّك، ويستثني
 * ما ثبت أنه يبقى قافاً فصيحةً في الكويتية (المتعلَّم: القرآن، القانون…)
 * وما عالجه المعجم أصلاً. الناتج قائمة عملٍ مرتّبةٌ بالأثر: أكثرها تكراراً
 * أولاً، فيُعالَج الجذر لا العَرَض.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const corpusPath = resolve(ROOT, 'src/data/kuwaiti-dialogues.json')
const lexiconPath = resolve(ROOT, 'src/data/kuwaiti-pronunciation.json')
if (!existsSync(corpusPath)) throw new Error('متن الحوارات الكويتية مفقود')

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'))
const lexicon = existsSync(lexiconPath) ? JSON.parse(readFileSync(lexiconPath, 'utf8')) : { words: {} }
const covered = new Set(Object.keys(lexicon.words || {}))

/* القاف تبقى فصيحةً في المتعلَّم — قاعدةٌ مثبتةٌ في طبقة النطق منذ البداية. */
const LEARNED = [
  'قرآن', 'قانون', 'منطق', 'تقييم', 'قرار', 'قرارات', 'تقرير', 'تطبيق', 'تقنية',
  'ثقافة', 'حقوق', 'مقال', 'مقالة', 'تقدم', 'مستقبل', 'أخلاق', 'اقتصاد', 'عقل',
  'منطقة', 'وثيقة', 'تحقيق', 'تصنيف', 'قضية', 'قيمة', 'قيم', 'طاقة', 'علاقة',
]
const isLearned = (word) => LEARNED.some((stem) => word.includes(stem))

/* السوابق تُنزع قبل الحكم كي لا تتكرّر الكلمة الواحدة بصيغٍ متعدّدة. */
const stripProclitic = (word) => word.replace(/^(وبال|فبال|بال|كال|وال|فال|ولل|فلل|لل|ال|و|ف|ب|ك|ل)/, '')

const turns = []
for (const [slug, episode] of Object.entries(corpus.episodes || {})) {
  for (const turn of Object.values(episode)) {
    if (turn?.text) turns.push({ slug, speaker: turn.speaker, text: turn.text })
  }
}

const risks = new Map()
const note = (word, kind, slug, text) => {
  const key = `${word}|${kind}`
  const entry = risks.get(key) || { word, kind, count: 0, episodes: new Set(), sample: '' }
  entry.count += 1
  entry.episodes.add(slug)
  if (!entry.sample) {
    const at = text.indexOf(word)
    entry.sample = text.slice(Math.max(0, at - 26), at + word.length + 30).replace(/\s+/g, ' ').trim()
  }
  risks.set(key, entry)
}

for (const turn of turns) {
  for (const raw of turn.text.split(/[^ء-ي]+/)) {
    if (raw.length < 3) continue
    const bare = stripProclitic(raw)
    if (covered.has(raw) || covered.has(bare)) continue
    /* القاف الجيمية: أخطر صوتٍ لأن المحرّك يبتلع گ ولا إملاء عربياً يعوّضه. */
    if (/ق/.test(raw) && !isLearned(raw)) note(raw, 'قاف', turn.slug, turn.text)
    /* الكاف المفخَّمة إلى چ: عولجت بـ«تش» ونجحت في الاسم وسقطت في «جم». */
    else if (/^(ج|چ)(ذ|ان|م)/.test(bare)) note(raw, 'چ', turn.slug, turn.text)
  }
}

const rows = [...risks.values()]
  .map((r) => ({ ...r, episodes: r.episodes.size }))
  .sort((a, b) => b.count - a.count)

const qaf = rows.filter((r) => r.kind === 'قاف')
const cheh = rows.filter((r) => r.kind === 'چ')
const totalHits = rows.reduce((sum, r) => sum + r.count, 0)

console.log(`المتن: ${turns.length} دوراً في ${Object.keys(corpus.episodes || {}).length} حلقة`)
console.log(`المعجم يغطّي: ${covered.size} مدخلاً\n`)
console.log(`مواضع تحتاج صوتاً يعجز عنه المحرّك: ${totalHits}`)
console.log(`  قاف جيمية : ${qaf.length} كلمةً مختلفة (${qaf.reduce((s, r) => s + r.count, 0)} موضعاً)`)
console.log(`  چ         : ${cheh.length} كلمةً مختلفة (${cheh.reduce((s, r) => s + r.count, 0)} موضعاً)\n`)

console.log('═══ أعلى ٢٥ كلمةً أثراً (تُعالَج أولاً) ═══')
for (const r of rows.slice(0, 25)) {
  console.log(`  ${String(r.count).padStart(3)}× في ${String(r.episodes).padStart(3)} حلقة  [${r.kind}]  ${r.word}`)
  console.log(`        …${r.sample}…`)
}

if (process.argv.includes('--json')) {
  console.log('\n' + JSON.stringify(rows.slice(0, 200), null, 1))
}
