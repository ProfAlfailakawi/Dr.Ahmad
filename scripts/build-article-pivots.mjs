#!/usr/bin/env node
/**
 * لحظة الانعطاف — الجملة التي ينعطف عندها المقال.
 *
 * للدكتور صيغةُ توقيعٍ مقيسة في أسلوبه: يبني الظاهر ثم ينقضه ثم يضع الحقيقي
 * مكانه — «المشكلة ليست في وجود الامتحان، بل في المعنى الذي ألصقناه به».
 * هذه الجملة الواحدة **هي المقال**، وبقيته شرحٌ لها.
 *
 * القواعد التي تحكم هذا الملف:
 *   ١) **جملته حرفياً** — لا تلخيص ولا إعادة صياغة ولا ترميم.
 *   ٢) **الصمت عند الشك** — مقالٌ بلا انعطافٍ واضح لا يُعرض له شيء. أن يظهر
 *      في ثلث المقالات بجودة، خيرٌ من أن يظهر في كلها بضجيج.
 *   ٣) الجملة لا تعبر فقرتين ولا سطرين: ما التقط سطراً زائداً يُرفض، لا يُقصّ.
 *   ٤) بلا ذكاء اصطناعي وبلا خدمة مدفوعة — علاماتُ الانعطاف في نصّه تكفي.
 *
 * التشغيل: node scripts/build-article-pivots.mjs [--report]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeCanonicalArticleBodies, mergeCanonicalRecords, readCanonicalCms } from './canonical-cms.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BODIES = resolve(ROOT, 'src/data/bodies.json')
const DATA = resolve(ROOT, 'src/data.ts')
const OUT = resolve(ROOT, 'src/data/article-pivots.json')

const report = process.argv.includes('--report')

if (!existsSync(BODIES)) {
  console.error('✘ لا يوجد src/data/bodies.json')
  process.exit(1)
}

const staticBodies = JSON.parse(readFileSync(BODIES, 'utf8'))
const canonical = readCanonicalCms(ROOT)
const bodies = mergeCanonicalArticleBodies(staticBodies, {}, canonical).normal
const dataText = readFileSync(DATA, 'utf8')
const block = dataText.slice(dataText.indexOf('export const articles = ['), dataText.indexOf('export const articlesWithBody'))
const staticArticles = []
for (const record of block.split(/\n(?=  \{ slug: ')/).slice(1)) {
  const slug = record.split("'")[1]
  const title = record.match(/title: '((?:[^'\\]|\\.)*)'/)?.[1]
  if (slug) staticArticles.push({ slug, title: title || slug })
}
const titles = new Map(mergeCanonicalRecords('article', staticArticles, canonical).map((article) => [article.slug, article.title || article.slug]))

/* ═══ علامات الانعطاف، مرجّحةً بقوّتها في نصّه ═══ */
const AR = 'ء-ي'
const TURNS = [
  { test: new RegExp(`المشكلة\\s+(?:ليست|ليس|لا)`), weight: 7, label: 'نقض المشكلة' },
  { test: new RegExp(`(?<![${AR}])بل(?![${AR}])`), weight: 5, label: '«بل»' },
  { test: new RegExp(`(?<![${AR}])إنّ?ما(?![${AR}])`), weight: 4, label: '«إنما»' },
  { test: new RegExp(`غير\\s+أنّ?`), weight: 4, label: '«غير أنّ»' },
  { test: new RegExp(`(?<![${AR}])لكنّ?(?![${AR}])`), weight: 4, label: '«لكن»' },
  { test: new RegExp(`(?<![${AR}])ليست?(?![${AR}])`), weight: 3, label: 'نفي' },
]

/* ═══ ما لا يصلح أن يكون انعطافاً ═══ */
const REJECT = [
  { test: /[\n\r]/, why: 'يعبر سطرين' },
  { test: /^[^\p{L}]*$/u, why: 'بلا حروف' },
  { test: /[A-Za-z]{3,}/, why: 'حروف لاتينية' },
  { test: /https?:|www\./i, why: 'رابط' },
  /* الجملة المبتورة من أولها تبدأ بحرف عطفٍ معلّق. */
  { test: new RegExp(`^(?:و|ف)[${AR}]`), why: 'بداية معلّقة' },
  { test: /^(?:ثم|أو|أي|إذ)\s/u, why: 'بداية معلّقة' },
  /* الجملة التي تفتتح بـ«بل» أو «لكن» أو «لا،» ذيلُ جملةٍ قبلها: المنفيّ
     الذي تستدركه غائبٌ عنها، فتُقرأ ناقصةً خارج سياقها — وهذه تُعرض وحدها. */
  { test: /^(?:بل|لكنّ?|لا[،,])\s/u, why: 'استدراكٌ بلا منفيّه' },
]

const clean = (value = '') => String(value)
  .replace(/[*_]{1,3}/g, '')        /* تشديدٌ تحريري من الترقيم لا من كلامه */
  .replace(/ /g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim()

/* المسطرة مُعايَرة على نَفَسه هو: بصمته المقيسة تقول وسيط الجملة ٨–٩ كلمات،
   وقياس جمل الانعطاف في أرشيفه أعطى وسيطاً ٥٤ حرفاً. فحدٌّ أدنى عند ٦٠ كان
   يرفض ٢٦٨ جملة من ٤٨٥ لأنها «قصيرة» — وهي ليست قصيرة، بل هي أسلوبه. */
const MIN = 40
const MAX = 220

const stats = { articles: 0, withPivot: 0, rejected: {} }
const note = (why) => { stats.rejected[why] = (stats.rejected[why] || 0) + 1 }

const pivots = {}

for (const [slug, rawBody] of Object.entries(bodies)) {
  const body = String(rawBody || '')
  if (!body.trim()) continue
  stats.articles += 1

  /* الفقرة وحدة العمل: تمنع أن تلتقط جملةٌ سطراً من فقرةٍ تاليةٍ لها. */
  const paragraphs = body.split('\n\n')
  let best = null

  paragraphs.forEach((paragraph, paragraphIndex) => {
    /* «…» علامةُ ختامٍ عنده لا حشو: بصمته المقيسة ٥٫٣ وقفة لكل ١٠٠ كلمة،
       و١٢٪ من جمله تنتهي بها. إغفالها كان يُلصق الجملة بما بعدها فتطول
       وتُرفض — فضاع أكثر من نصف المرشّحين. */
    const sentences = paragraph
      .split(/(?<=[.؟!…])\s+/)
      .map(clean)
      .filter(Boolean)

    sentences.forEach((sentence, sentenceIndex) => {
      if (sentence.length < MIN || sentence.length > MAX) return
      const reason = REJECT.find((rule) => rule.test.test(sentence))
      if (reason) { note(reason.why); return }
      /* الجملة المكتملة تنتهي بعلامة ختام؛ وإلا فهي مقطوعة عند حدّ الفقرة. */
      if (!/[.؟!…]$/.test(sentence)) { note('بلا نهاية'); return }

      const marks = TURNS.filter((turn) => turn.test.test(sentence))
      if (!marks.length) return

      let score = marks.reduce((total, mark) => total + mark.weight, 0)
      /* الانعطاف يقع في وسط النص غالباً: المقدمة تمهّد والخاتمة تُجمل. */
      const position = paragraphs.length > 1 ? paragraphIndex / (paragraphs.length - 1) : 0.5
      if (position >= 0.2 && position <= 0.8) score += 3
      /* الطول المعتدل أجمل في العرض وأدلّ على جملةٍ مكتملة. */
      if (sentence.length >= 45 && sentence.length <= 160) score += 2
      /* «ليست… بل…» في جملةٍ واحدة هي توقيعه الكامل. */
      if (/ليست?[^.؟!]{0,60}بل\s/u.test(sentence)) score += 6

      if (!best || score > best.score) {
        best = { score, text: sentence, paragraph: paragraphIndex, sentence: sentenceIndex, marks: marks.map((mark) => mark.label) }
      }
    })
  })

  /* العتبة: دون هذا الرقم لا نثق أن الجملة انعطافٌ فعلاً — فنصمت. */
  if (!best || best.score < 9) continue

  pivots[slug] = { text: best.text, paragraph: best.paragraph, marks: best.marks }
  stats.withPivot += 1
}

writeFileSync(OUT, `${JSON.stringify({
  version: 1,
  policy: 'جملة المقال التي ينعطف عندها المعنى، منقولةً حرفياً. لا تُعرض إلا عند وضوحها؛ ولا تُختلق عند غيابها.',
  coverage: { articles: stats.articles, withPivot: stats.withPivot },
  pivots,
}, null, 2)}\n`, 'utf8')

console.log(`✔ لحظة الانعطاف: ${stats.withPivot} مقالاً من ${stats.articles} (${Math.round(stats.withPivot / Math.max(1, stats.articles) * 100)}٪)`)
for (const [slug, pivot] of Object.entries(pivots).slice(0, 4)) {
  console.log(`   ${(titles.get(slug) || slug).slice(0, 46)}\n     ↳ ${pivot.text}`)
}
if (report) {
  console.log('\nالمرفوض:')
  for (const [why, count] of Object.entries(stats.rejected).sort((a, b) => b[1] - a[1])) console.log(`   ${String(count).padStart(5)} — ${why}`)
}
