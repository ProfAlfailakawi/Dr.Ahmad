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
const VIDEO_TRANSCRIPT_CANDIDATES = [
  resolve(HERE, '../src/data/encyclopedia-video-transcripts.json'),
  resolve(process.cwd(), 'src/data/encyclopedia-video-transcripts.json'),
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

/* سقالة السؤال ليست موضوعاً.
   كانت «ماذا يقول عن المعلم؟» تفشل — وهي المثال الذي يقترحه البوت بنفسه — لأن
   «يقول» تُعدّ كلمةً موضوعية، فيصير الشرط: مقطعٌ يجمع «يقول» و«معلم» معاً.
   الحلّ ليس تخفيف عتبة الصدق (فتُنسب إليه أقوالٌ لم يقلها) بل تنظيف السؤال من
   أفعال الاستفهام والطلب قبل الوزن؛ فتبقى العتبة صارمة على الكلمات الحقيقية. */
const STOP = new Set(`في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون هل كيف ماذا لماذا شنو وش
 يعني رايك رايه الدكتور دكتور احمد الفيلكاوي كتاب كتب
 يقول قال تقول يقصد قصد يذكر ذكر يتكلم تكلم يتحدث تحدث يشرح شرح اشرح وضح يوضح
 عرف تعريف يعرف معنى مامعنى ماهو ماهي منو متى اين وين ليش شلون شو كم ايش
 ابي اريد ابغي ابغى ممكن عطني اعطني قلي قل لي وريني اعرض اذكر اشرحلي
 موقف رايه راي نظرة نظره كلام حديث جواب سؤال اسال اسئله`.split(/\s+/).filter(Boolean))

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

const rootList = (value = '') => (String(value)
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

const roots = (value = '') => new Set(rootList(value))

/* التكرار دليلُ موضوع.
   كان حضور الكلمة يُقاس بنعم/لا، فيستوي مقطعٌ ذكر «المعلم» عرَضاً ومقطعٌ يدور
   حوله كلّه — ولذلك كانت أسئلة الكلمة الواحدة (وهي أشيع ما يكتبه الناس) تسقط
   جميعاً تحت عتبة الثمانية. عدّ التكرار يفرّق بين الاثنين: المقطع الذي يدور
   حول الكلمة يعلو، والذكر العابر يبقى تحت العتبة. العتبة نفسها لم تُخفَّض. */
const rootTally = (value = '') => {
  const tally = new Map()
  for (const word of rootList(value)) tally.set(word, (tally.get(word) || 0) + 1)
  return tally
}

/* عتبة الصدق قائمة على **التغطية** لا على رقمٍ ثابت: سؤالٌ من كلمةٍ واحدة
   يكفيه تطابقها، وسؤالٌ من أربع لا يكفيه تطابق واحدة منها. */
const MIN_SCORE = 8
/* وزن الكلمة في المتن: ٣ لأول حضور، ثم واحدٌ لكل تكرارٍ حتى أربعة — فلا تطغى
   كلمةٌ واحدة مكرّرة على تطابقٍ حقيقيّ متعدّد الكلمات. */
const textWeight = (count = 0) => (count > 0 ? 3 + Math.min(4, count - 1) : 0)

export function findBookQuote(rawText = '', options = {}) {
  const query = roots(rawText)
  if (query.size < 1) return null
  const onlySlug = String(options.bookSlug || '').trim()

  let best = null
  for (const book of load().books || []) {
    if (onlySlug && book.slug !== onlySlug) continue
    const titleRoots = roots(book.title)
    for (const passage of book.passages || []) {
      const text = rootTally(passage.text)
      const concept = roots(passage.conceptTitle || '')
      let score = 0
      let matched = 0
      for (const word of query) {
        const hit = text.has(word) || concept.has(word) || titleRoots.has(word)
        if (hit) matched += 1
        score += textWeight(text.get(word) || 0)
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

/** المقاطع المطابقة مرتّبة — لا مقطعاً واحداً. جوابٌ من موضعين أقنع من موضع. */
export function findBookQuotes(rawText = '', options = {}) {
  const query = roots(rawText)
  if (query.size < 1) return []
  const onlySlug = String(options.bookSlug || '').trim()
  const limit = Math.max(1, Math.min(4, Number(options.limit) || 2))
  const rows = []
  for (const book of load().books || []) {
    if (onlySlug && book.slug !== onlySlug) continue
    const titleRoots = roots(book.title)
    for (const passage of book.passages || []) {
      const text = rootTally(passage.text)
      const concept = roots(passage.conceptTitle || '')
      let score = 0
      let matched = 0
      for (const word of query) {
        const hit = text.has(word) || concept.has(word) || titleRoots.has(word)
        if (hit) matched += 1
        score += textWeight(text.get(word) || 0)
        if (concept.has(word)) score += 4
        if (titleRoots.has(word)) score += 2
      }
      if (matched < Math.min(2, query.size)) continue
      if (score < MIN_SCORE) continue
      rows.push({ score, voice: Number(passage.voice) || 50, passage, bookTitle: book.title, bookSlug: book.slug })
    }
  }
  rows.sort((left, right) => right.score - left.score || right.voice - left.voice)
  /* لا نكرّر الصفحة نفسها مرّتين: موضعان متجاوران يقولان الشيء نفسه. */
  const picked = []
  const pages = new Set()
  for (const row of rows) {
    const key = `${row.bookSlug}:${row.passage.page}`
    if (pages.has(key)) continue
    pages.add(key)
    picked.push(row)
    if (picked.length >= limit) break
  }
  return picked
}

/** المحاور المطابقة من فهرس الكتاب الموثّق — عنوانٌ وصفحات، بلا اختلاق. */
export function bookConceptMatches(rawText = '', bookSlug = '', limit = 3) {
  const query = roots(rawText)
  if (!query.size) return []
  const books = (loadKnowledge().books || []).filter((item) => !bookSlug || item.slug === bookSlug)
  const rows = []
  for (const book of books) {
    for (const concept of book.concepts || []) {
      const title = roots(concept.title || '')
      const summary = roots(concept.summary || '')
      let score = 0
      for (const word of query) {
        if (title.has(word)) score += 5
        else if (summary.has(word)) score += 2
      }
      if (score < 5) continue
      rows.push({ score, concept, bookTitle: book.title, bookSlug: book.slug })
    }
  }
  return rows.sort((left, right) => right.score - left.score).slice(0, Math.max(1, limit))
}

/**
 * جوابُ الكتاب كما ينبغي أن يكون: موضعٌ من متنه منسوبٌ إلى صفحته، ثم موضعٌ ثانٍ
 * إن وُجد، ثم المحور الذي يقع فيه من فهرس الكتاب — فيخرج الجواب بثلاث طبقات
 * موثّقة بدل سطرٍ واحد. وإن لم يوجد متنٌ كافٍ نصدُق ونعرض أقرب محورٍ في فهرسه
 * بدل الهروب إلى المقالات والبودكاست.
 */
export function bookAnswerReply(rawText = '', options = {}) {
  const bookSlug = String(options.bookSlug || '').trim()
  const quotes = findBookQuotes(rawText, { bookSlug, limit: 2 })
  const concepts = bookConceptMatches(rawText, bookSlug, 2)
  if (!quotes.length && !concepts.length) return null

  const slug = quotes[0]?.bookSlug || concepts[0]?.bookSlug || bookSlug
  const title = quotes[0]?.bookTitle || concepts[0]?.bookTitle || ''
  const link = `${SITE_URL}/publications/${slug}#book-knowledge`

  if (!quotes.length) {
    const lines = concepts.map((row) => {
      const start = Number(row.concept.pageStart) || 0
      const end = Number(row.concept.pageEnd) || start
      return `• ${row.concept.title}${start ? ` — ص ${start}${end > start ? `–${end}` : ''}` : ''}`
    })
    return {
      grounded: false,
      text: `ما لقيت في متن «${title}» مقطعاً يقول هذا صراحةً، فما أنسب للدكتور كلاماً ما كتبه. لكن الموضوع يقع في هذا المحور من الكتاب:\n\n${lines.join('\n')}\n\n${link}`,
      found: { bookSlug: slug, bookTitle: title },
    }
  }

  const blocks = quotes.map((row) => `من «${row.bookTitle}» (ص ${row.passage.page}):\n«${row.passage.text}»`)
  const concept = concepts.find((row) => row.bookSlug === slug)
  const where = concept
    ? `\n\nوموضعه في الكتاب: ${concept.concept.title}${Number(concept.concept.pageStart) ? ` (ص ${concept.concept.pageStart})` : ''}.`
    : ''
  return {
    grounded: true,
    text: `${blocks.join('\n\n')}${where}\n\n${link}`,
    found: { bookSlug: slug, bookTitle: title, passage: quotes[0].passage },
  }
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

/* ── فيديوهات الموسوعة: اللحظة نفسها لا رابط الصفحة ──
   كان سؤال «فيديوهات عن كذا» يُقابَل برابط الخريطة المرئية فقط، بينما تفريغات
   الفيديو (١٦٩ مقطعاً مفهرساً بالثانية) حاضرةٌ في الصورة نفسها بلا استعمال.
   هنا نبحث داخل الكلام المنطوق ونعيد الفيديو والثانية التي قيلت فيها الفكرة،
   فيفتحها السائل على الموضع مباشرة. البحث متزامن ويُحمَّل عند أول سؤال فقط. */
let videoRecords = null
function loadVideoTranscripts() {
  if (videoRecords) return videoRecords
  const path = VIDEO_TRANSCRIPT_CANDIDATES.find((item) => existsSync(item))
  try {
    const payload = path ? JSON.parse(readFileSync(path, 'utf8')) : {}
    videoRecords = Object.values(payload.records || {}).filter((record) => record?.available)
  } catch {
    videoRecords = []
  }
  return videoRecords
}

const YOUTUBE_WATCH = (id, seconds) => `https://www.youtube.com/watch?v=${id}${seconds ? `&t=${Math.max(0, Math.floor(seconds))}` : ''}`

/** لحظاتُ الفيديو المطابقة — مرتّبةً، بمقطعٍ من الكلام وثانيته. */
export function encyclopediaVideoMoments(rawText = '', limit = 3) {
  const query = roots(rawText)
  if (!query.size) return []
  const rows = []
  for (const record of loadVideoTranscripts()) {
    for (const segment of record.segments || []) {
      if (segment.indexable === false) continue
      const spoken = segment.searchText || segment.displayText || segment.text || ''
      if (!spoken) continue
      const tally = rootTally(spoken)
      let score = 0
      let matched = 0
      for (const word of query) {
        const count = tally.get(word) || 0
        if (count > 0) matched += 1
        score += textWeight(count)
      }
      if (matched < Math.min(2, query.size)) continue
      if (score < MIN_SCORE) continue
      rows.push({
        score,
        videoId: record.videoId,
        title: record.sequenceLabel || record.chapterTitle || record.title || 'موسوعة تكنولوجيا التعليم',
        start: Number(segment.start) || 0,
        text: String(segment.displayText || segment.text || '').trim(),
      })
    }
  }
  rows.sort((left, right) => right.score - left.score || left.start - right.start)
  /* لحظةٌ واحدة من كل فيديو: ثلاث لحظاتٍ من ثلاثة فيديوهات أنفع من ثلاثٍ من واحد. */
  const picked = []
  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row.videoId)) continue
    seen.add(row.videoId)
    picked.push(row)
    if (picked.length >= Math.max(1, limit)) break
  }
  return picked
}

const trimSpoken = (value = '', max = 200) => {
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : max)}…`
}

/** الردّ الجاهز: العنوان، والثانية، وما قيل فيها، ورابطٌ يفتح على الموضع. */
export function encyclopediaVideoReply(rawText = '', limit = 3) {
  const moments = encyclopediaVideoMoments(rawText, limit)
  if (!moments.length) return null
  const stamp = (seconds) => {
    const total = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(total / 60)
    const rest = total % 60
    return `${minutes}:${String(rest).padStart(2, '0')}`
  }
  const blocks = moments.map((moment, index) => `${index + 1}) *${moment.title}* — الدقيقة ${stamp(moment.start)}\n«${trimSpoken(moment.text)}»\n${YOUTUBE_WATCH(moment.videoId, moment.start)}`)
  return {
    text: `لقيت «${String(rawText).trim()}» مذكوراً داخل فيديوهات الموسوعة، وهذي المواضع بالثانية:\n\n${blocks.join('\n\n')}\n\nوالخريطة المرئية كاملة:\n${SITE_URL}/publications/encyclopedia?q=${encodeURIComponent(String(rawText).trim())}&tab=video#encyclopedia-map`,
    moments,
  }
}
