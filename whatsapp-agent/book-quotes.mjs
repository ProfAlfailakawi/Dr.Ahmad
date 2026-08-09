/**
 * البوت يقتبس من كتب الدكتور.
 *
 * قبل هذا كان البوت يعرف عناوين الكتب فقط، فيردّ بروابط. والآن يملك متونها
 * التسعة (٨٤٨ مقطعاً) فيردّ **بكلام الدكتور نفسه** منسوباً إلى كتابه وصفحته.
 * جملةٌ من كتابه أصدق من قائمة روابط، وأقرب إلى ما يريده السائل.
 *
 * القيود المتوارثة: لا يُرسل ملف الكتاب، ولا يُرسل أكثر من مقطعٍ واحد في
 * الرسالة، ولا يُقتبس إلا ما تجاوز عتبة تطابقٍ معتبرة — فلا يُنسب إلى
 * الدكتور كلامٌ في موضوعٍ لم يتناوله.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CANDIDATES = [
  resolve(HERE, '../src/data/book-passages.json'),
  resolve(process.cwd(), 'src/data/book-passages.json'),
]
const KNOWLEDGE_CANDIDATES = [
  resolve(HERE, '../src/data/book-knowledge.json'),
  resolve(process.cwd(), 'src/data/book-knowledge.json'),
]

const SITE_URL = (process.env.SITE_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, '')

let corpus = null
function load() {
  if (corpus) return corpus
  const path = CANDIDATES.find((item) => existsSync(item))
  corpus = path ? JSON.parse(readFileSync(path, 'utf8')) : { books: [] }
  return corpus
}

let knowledge = null
function loadKnowledge() {
  if (knowledge) return knowledge
  const path = KNOWLEDGE_CANDIDATES.find((item) => existsSync(item))
  knowledge = path ? JSON.parse(readFileSync(path, 'utf8')) : { books: [] }
  return knowledge
}

const STOP = new Set('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون هل كيف ماذا لماذا شنو وش يعني رايك رايه الدكتور دكتور احمد الفيلكاوي كتاب كتب'.split(' '))

/* الجمع المكسّر لا تصلحه قاعدة: «أطفال» ليست «طفل» + لاحقة. وهذه أكثر
   الكلمات دوراناً في مجال الدكتور، فبلا ردّها إلى مفردها يفشل البحث في
   أشيع ما يكتبه الناس. قائمةٌ صغيرة مقصودة — لا معجم كامل. */
const BROKEN_PLURALS = {
  اطفال: 'طفل', مدارس: 'مدرس', معلمين: 'معلم', معلمون: 'معلم',
  طلاب: 'طالب', طلبه: 'طالب', كتب: 'كتاب', العاب: 'لعب', الالعاب: 'لعب',
  وسايل: 'وسيل', وسائل: 'وسيل', مفاهيم: 'مفهوم', مناهج: 'منهج',
  اجهزه: 'جهاز', اجهزة: 'جهاز', شاشات: 'شاش', مهارات: 'مهار',
  اهداف: 'هدف', ادوات: 'اداه', بيئات: 'بيئه', فصول: 'فصل',
}

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
    /* «شاشات» و«شاشة» جذرٌ واحد عند المطابقة؛ بلا توحيدهما يفشل أكثر
       ما يكتبه الناس. نطبّق القاعدة على الطرفين فيبقى الميزان عادلاً. */
    .replace(/(?:ات|ون|ين|ية|يه)$/u, '')
    .replace(/ه$/u, (match, offset, full) => (full.length > 4 ? '' : match)))
  .map((word) => BROKEN_PLURALS[word] || word)
  .filter((word) => word.length > 2 && !STOP.has(word)))

/* عتبة الصدق قائمة على **التغطية** لا على رقمٍ ثابت: سؤالٌ من كلمةٍ واحدة
   يكفيه تطابقها، وسؤالٌ من أربع لا يكفيه تطابق واحدة منها. */
const MIN_SCORE = 8

export function findBookQuote(rawText = '', options = {}) {
  const query = roots(rawText)
  if (query.size < 1) return null
  const onlySlug = String(options.bookSlug || '').trim()

  let best = null
  for (const book of load().books || []) {
    if (onlySlug && book.slug !== onlySlug) continue
    const titleRoots = roots(book.title)
    for (const passage of book.passages || []) {
      const text = roots(passage.text)
      const concept = roots(passage.conceptTitle || '')
      let score = 0
      let matched = 0
      for (const word of query) {
        const hit = text.has(word) || concept.has(word) || titleRoots.has(word)
        if (hit) matched += 1
        if (text.has(word)) score += 3
        if (concept.has(word)) score += 4
        if (titleRoots.has(word)) score += 2
      }
      if (matched < Math.min(2, query.size)) continue
      /* الأقرب إلى قلمه يسبق عند التساوي — لا نقتبس المترجم ما وجدنا صوته. */
      const voice = Number(passage.voice) || 50
      if (!best || score > best.score || (score === best.score && voice > best.voice)) {
        best = { score, voice, passage, bookTitle: book.title, bookSlug: book.slug }
      }
    }
  }

  return best && best.score >= MIN_SCORE ? best : null
}

/** الردّ الجاهز للإرسال — مقطعٌ واحد، منسوبٌ، ورابط صفحة الكتاب لا ملفه. */
export function bookQuoteReply(rawText = '', options = {}) {
  const found = findBookQuote(rawText, options)
  if (!found) return null
  return {
    text: `من كتابه «${found.bookTitle}» (ص ${found.passage.page}):\n«${found.passage.text}»\n${SITE_URL}/publications/${found.bookSlug}#book-knowledge`,
    found,
  }
}

/**
 * «معلومة من الكتاب» ليست بحثاً بكلمة مفتاحية. نختار مقطعاً حقيقياً مكتفياً
 * بذاته من الكتاب الحاضر في المحادثة، ونديره يومياً بحساب حتمي حتى يتنوّع
 * من غير عشوائيةٍ مربكة أو نموذجٍ يولّد كلاماً غير منشور.
 */
export function usefulBookQuoteReply(bookSlug = '', seedKey = '') {
  const book = (load().books || []).find((item) => item.slug === String(bookSlug || '').trim())
  if (!book) return null
  const candidates = (book.passages || []).filter((passage) => {
    const text = String(passage.text || '').trim()
    const section = String(passage.section || passage.conceptTitle || '')
    return text.length >= 90 && text.length <= 430
      && !/(?:قائمه|قائمة)\s*(?:المراجع|المصادر)|^المراجع|https?:\/\//iu.test(`${section} ${text}`)
      && !/^(?:الفصل|الباب)\s+(?:الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)\s*$/iu.test(text)
  })
  if (!candidates.length) return null
  const day = new Date().toISOString().slice(0, 10)
  const seed = `${book.slug}:${day}:${seedKey}`
  let hash = 2166136261
  for (const char of seed) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0
  const ranked = candidates
    .map((passage) => ({ passage, quality: (Number(passage.voice) || 50) - Math.abs(String(passage.text).length - 230) / 18 }))
    .sort((left, right) => right.quality - left.quality)
  const pool = ranked.slice(0, Math.min(18, ranked.length))
  const passage = pool[hash % pool.length].passage
  return {
    text: `هذه فكرة موثّقة من «${book.title}» (ص ${passage.page}):\n«${passage.text}»\n\nإذا تبي، أشرحها لك أو أبحث عن فكرةٍ ثانية داخل الكتاب نفسه.\n${SITE_URL}/publications/${book.slug}#book-knowledge`,
    found: { bookSlug: book.slug, bookTitle: book.title, passage },
  }
}

/** فهرسٌ موثّق من خريطة الكتاب: عناوين المحاور وصفحاتها فقط، بلا اختلاق. */
export function bookChaptersReply(bookSlug = '', maxChars = 1_450) {
  const book = (loadKnowledge().books || []).find((item) => item.slug === bookSlug)
  if (!book || !Array.isArray(book.concepts) || !book.concepts.length) return null
  const lines = []
  for (const concept of book.concepts) {
    const page = Number(concept.pageStart) || 0
    const end = Number(concept.pageEnd) || page
    const range = page ? `ص ${page}${end > page ? `–${end}` : ''}` : ''
    const line = `${lines.length + 1}. ${concept.title}${range ? ` — ${range}` : ''}`
    if (lines.length && lines.join('\n').length + line.length + 1 > maxChars) break
    lines.push(line)
  }
  const omitted = Math.max(0, book.concepts.length - lines.length)
  return {
    text: `فصول ومحاور «${book.title}» كما في فهرسه:\n\n${lines.join('\n')}${omitted ? `\n\nوبقية الفهرس (${omitted}) في صفحة الكتاب.` : ''}\n\n${SITE_URL}/publications/${book.slug}#book-knowledge`,
    found: { bookSlug: book.slug, bookTitle: book.title, count: book.concepts.length },
  }
}
