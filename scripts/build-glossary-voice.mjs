#!/usr/bin/env node
/**
 * المعجم يتكلّم بكلامه.
 *
 * مصطلحات الموقع تُشرح اليوم بتعريفٍ عام صحيح لكنه لا يخصّ أحداً. وللدكتور
 * تسعة كتب عرّف فيها هذه المفاهيم بنفسه. فبدل أن يقرأ الطالب تعريفاً
 * محايداً عن «التلعيب»، يقرأ تعريف الفيلكاوي منسوباً إلى كتابه وصفحته.
 *
 * القاعدة: **لا نستبدل التعريف — نضيف صوته تحته.** والتعريف العام يبقى
 * لأنه أوضح للمبتدئ؛ وكلامه يجيء بعده لأنه أعمق ولأنه ملكه.
 *
 * وصدقُ التسمية: كتبه أكثرها تجميعٌ ودراسة، والتعريفات الصريحة فيها قليلة.
 * فلا ندّعي «تعريف الفيلكاوي» ونعرض ما ليس تعريفاً — بل نقول «كما تناوله
 * في كتبه»، ونقبل المقطع إن كان **محور صفحته** هو المصطلح نفسه، أو حمل
 * تركيباً تعريفياً ملتصقاً به. أما ذكرٌ عابر في جملة فمرفوض.
 *
 * التشغيل: node scripts/build-glossary-voice.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PASSAGES = resolve(ROOT, 'src/data/book-passages.json')
const READER = resolve(ROOT, 'src/components/ArticleReader.tsx')
const DOMAIN = resolve(ROOT, 'src/data/dr-ahmad-domain-glossary.json')
const OUT = resolve(ROOT, 'src/data/glossary-voice.json')

if (!existsSync(PASSAGES)) {
  console.error('✘ لا يوجد src/data/book-passages.json — شغّل build-book-quotes أولاً.')
  process.exit(1)
}

const corpus = JSON.parse(readFileSync(PASSAGES, 'utf8'))

/* المصطلحات المعروضة للزوار تسكن قائمة GLOSSARY داخل قارئ المقال، ويضاف
   إليها المفاهيم المحورية من معجم المجال. */
const terms = new Set()
if (existsSync(READER)) {
  for (const match of readFileSync(READER, 'utf8').matchAll(/\{\s*term:\s*'([^']+)'/g)) terms.add(match[1])
}
if (existsSync(DOMAIN)) {
  for (const concept of JSON.parse(readFileSync(DOMAIN, 'utf8'))) {
    if (concept?.canonicalAr) terms.add(concept.canonicalAr)
  }
}

const STOP = new Set('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون'.split(' '))
const roots = (value = '') => new Set(String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  .map((word) => word
    .replace(/^(?:[وف])(?=[بكل]ال|ال)/u, '')
    .replace(/^لل(?=.{3,})/u, '')
    .replace(/^[بكل](?=ال.{3,})/u, '')
    .replace(/^ال(?=.{3,})/u, '')
    .replace(/^[وف](?=.{4,})/u, '')
    .replace(/(?:ات|ون|ين|ية|يه)$/u, '')
    .replace(/ه$/u, (match, offset, full) => (full.length > 4 ? '' : match)))
  .filter((word) => word.length > 2 && !STOP.has(word)))

/* ═══ متى يكون المقطع تعريفاً لا ذكراً عابراً؟ ═══
   الشرط بنيويّ لا إحصائي: التركيب التعريفي يجب أن يلتصق بالمصطلح نفسه.
   «التلعيب هو…» تعريف. أما «…وقد أثبت التلعيب فاعليته» فذكرٌ عابر مهما
   تكرّر فيه المصطلح. هذا الفرق هو كل الفرق بين معجمٍ بصوته ومعجمٍ مشوّش. */
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function definitionMatch(text, term) {
  const bare = term.replace(/^ال/, '')
  for (const form of [term, `ال${bare}`, bare]) {
    const word = escape(form)
    /* الرابطة تُحسب فقط إذا افتتح المصطلحُ الجملةَ — وإلا فـ«هو» تعود إلى
       فاعلٍ آخر: «مستقبل الذكاء الاصطناعي والبيانات الضخمة هو…» ليس تعريفاً
       للبيانات الضخمة. */
    if (new RegExp(`(?:^|[.؟!]\\s+)(?:و)?${word}\\s+(?:هو|هي)\\s`, 'u').test(text)) return true
    if (new RegExp(`${word}[^.؟!]{0,20}(?:عبارة عن|بأنه\\b|بأنها\\b)`, 'u').test(text)) return true
    if (new RegExp(`(?:يقصد ب|ويقصد ب|المقصود ب|يُعرَّف|تُعرَّف|يُعرف|تُعرف)\\s*${word}`, 'u').test(text)) return true
  }
  return false
}

/* المقطع الذي عنوان محوره هو المصطلح نفسه: الصفحة كلها عنه، فهو أصدق
   تمثيلٍ لتناوله ولو لم يحمل صيغة تعريف. */
function isAboutTerm(passage, term) {
  const title = passage.conceptTitle || ''
  const bare = term.replace(/^ال/, '')
  return title.includes(term) || title.includes(bare)
}

const voice = {}
let matched = 0

for (const term of terms) {
  if (term.length < 4) continue
  const seed = roots(term)
  if (seed.size < 1) continue

  let best = null
  for (const book of corpus.books || []) {
    for (const passage of book.passages || []) {
      const defines = definitionMatch(passage.text, term)
      const about = isAboutTerm(passage, term)
      /* لا يُقبل الذكر العابر: إما تعريفٌ ملتصق، وإما أن يكون محور الصفحة. */
      if (!defines && !about) continue
      if (about && !passage.text.includes(term) && !passage.text.includes(term.replace(/^ال/, ''))) continue

      let score = defines ? 16 : 10
      const bag = roots(passage.text)
      for (const word of seed) if (bag.has(word)) score += 3
      /* المصطلح في عنوان المحور يعني أن الصفحة كلها عنه. */
      if (about) score += 8
      /* التعريف الأقصر أوضح — المطوّلات تشرح ولا تعرّف. */
      if (passage.text.length <= 200) score += 3
      /* المقطع الذي يفتتح بالمصطلح يتحدث عنه؛ والذي يذكره في آخره يمرّ به. */
      const at = Math.min(
        ...[passage.text.indexOf(term), passage.text.indexOf(term.replace(/^ال/, ''))].filter((index) => index >= 0),
      )
      if (Number.isFinite(at)) {
        if (at <= 40) score += 7
        else if (at <= 90) score += 3
        else score -= 4
      }
      /* افتتاحيات الاستئناف تعني أن المقطع ذيلُ نقاشٍ سابق، فلا يصلح شرحاً
         مستقلاً لمصطلح يقرؤه زائرٌ لأول مرة. */
      if (/^(?:انتقاد|أما|كما|ثم|بالمقابل|في المقابل|من جهة)/u.test(passage.text)) score -= 9
      const tone = Number(passage.voice) || 50
      if (!best || score > best.score || (score === best.score && tone > best.tone)) {
        best = { score, tone, passage, book, defines }
      }
    }
  }

  if (!best) continue

  voice[term] = {
    text: best.passage.text,
    book: best.book.title,
    slug: best.book.slug,
    page: best.passage.page,
    concept: best.passage.conceptTitle || '',
  }
  matched += 1
}

writeFileSync(OUT, `${JSON.stringify({
  version: 1,
  policy: 'مواضع المصطلح في متون كتب المؤلف — تُضاف تحت التعريف العام ولا تحلّ محلّه، وتُعرض بوصفها «من كتبه» لا «تعريفه».',
  coverage: { terms: terms.size, withVoice: matched },
  voice,
}, null, 2)}\n`, 'utf8')

console.log(`✔ المعجم بصوته: ${matched} مصطلحاً من ${terms.size} له موضعٌ في كتبه`)
for (const [term, entry] of Object.entries(voice).slice(0, 6)) {
  console.log(`   ${term} ← ${entry.book} ص${entry.page}`)
}
