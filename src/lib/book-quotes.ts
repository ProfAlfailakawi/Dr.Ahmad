/**
 * الاقتباسات المنشورة من متون الكتب — بإذن المؤلف.
 *
 * البحث هنا هجين: يطابق اللفظ، والجذر العربي، والمعنى المتخصص، وعناوين
 * الفصول. وعندما يكون السؤال عنوان محورٍ لا يملك مقتطفاً مستقلاً، يُعاد
 * المحور نفسه بوصفه «محوراً مفهرساً» لا اقتباساً حرفياً.
 */
import rawQuotes from '../data/book-quotes.json' with { type: 'json' }
import { bestBookConcept, relatedBookKnowledge } from './book-knowledge'
import { buildSmartQueryPlan, extendSmartQueryPlan, scoreSmartFields } from './smart-search.ts'

export type BookQuote = {
  id: string
  text: string
  page: number
  section: string
  conceptId: string
  conceptTitle: string
  evidenceType?: 'passage' | 'concept'
}

export type BookQuoteRecord = {
  slug: string
  title: string
  year: string
  quotes: BookQuote[]
}

type QuotesFile = {
  version: number
  policy: string
  limits: Record<string, number>
  coverage: { books: number; quotes: number; longest: number }
  books: BookQuoteRecord[]
}

const file = rawQuotes as QuotesFile
const bySlug = new Map(file.books.map((book) => [book.slug, book]))

export const bookQuotePolicy = file.policy
export const bookQuoteCoverage = file.coverage

export function bookQuotes(slug = ''): BookQuote[] {
  return bySlug.get(slug)?.quotes || []
}

export function quotesForConcept(slug: string, conceptId: string): BookQuote[] {
  if (!conceptId) return []
  return bookQuotes(slug).filter((quote) => quote.conceptId === conceptId)
}

export type BookQuoteMatch = {
  quote: BookQuote
  bookSlug: string
  bookTitle: string
  score: number
}

function conceptQuote(match: NonNullable<ReturnType<typeof bestBookConcept>>): BookQuoteMatch {
  return {
    bookSlug: match.book.slug,
    bookTitle: match.book.title,
    score: match.score + 72,
    quote: {
      id: `concept-${match.concept.id}`,
      text: match.concept.summary || match.concept.question,
      page: match.concept.pageStart,
      section: match.concept.title,
      conceptId: match.concept.id,
      conceptTitle: match.concept.title,
      evidenceType: 'concept',
    },
  }
}

function balancedMatches(matches: BookQuoteMatch[], limit: number, perBookLimit = 3) {
  const seen = new Set<string>()
  const perBook = new Map<string, number>()
  return matches
    .sort((left, right) => right.score - left.score || left.quote.page - right.quote.page)
    .filter((match) => {
      const key = `${match.bookSlug}:${match.quote.id}`
      if (seen.has(key)) return false
      seen.add(key)
      const used = perBook.get(match.bookSlug) || 0
      if (used >= perBookLimit) return false
      perBook.set(match.bookSlug, used + 1)
      return true
    })
    .slice(0, limit)
}

/** أقرب مختارات الكتاب إلى سؤالٍ أو فكرة، مع فهم المعنى لا التطابق الحرفي. */
export function matchBookQuotes(query: string, limit = 3, onlySlug = ''): BookQuoteMatch[] {
  const plan = buildSmartQueryPlan(query)
  if (!plan.directRoots.length && !plan.semanticRoots.length) return []
  const matches: BookQuoteMatch[] = []

  for (const book of file.books) {
    if (onlySlug && book.slug !== onlySlug) continue
    for (const quote of book.quotes) {
      const score = scoreSmartFields(plan, [
        { value: quote.text, weight: 1.8, phraseWeight: 1.15 },
        { value: quote.conceptTitle, weight: 5.2, phraseWeight: 1.7, exactWeight: 1.8 },
        { value: quote.section, weight: 3.6 },
        { value: book.title, weight: 1.25 },
      ])
      if (score > 8) matches.push({ quote: { ...quote, evidenceType: quote.evidenceType || 'passage' }, bookSlug: book.slug, bookTitle: book.title, score })
    }
  }

  if (onlySlug) {
    const concept = bestBookConcept(query, onlySlug)
    if (concept && concept.score > 18) matches.push(conceptQuote(concept))
  } else {
    for (const concept of relatedBookKnowledge(query, Math.max(4, limit))) {
      if (concept.score > 18) matches.push(conceptQuote(concept))
    }
  }

  return balancedMatches(matches, limit, onlySlug ? Math.max(3, limit) : 2)
}

/* ═══ المتون كاملة — من الجلدة إلى الجلدة ═══ */
type PassagesFile = {
  coverage: { books: number; passages: number }
  books: { slug: string; title: string; year: string; passages: BookQuote[] }[]
}

type PassagesBook = PassagesFile['books'][number]
type ShardMeta = { version: number; revision: string; books: { slug: string; passages: number }[] }

let passagesCache: PassagesFile | null = null
let passagesPromise: Promise<PassagesFile> | null = null

/* ═══ شريحةٌ لكل كتاب ═══
   كان تحميل متنٍ واحد يجرّ الكتب التسعة (١٣٣٤ ك.ب) ويجمّد الخيط الرئيسي في
   تحليلها. الشرائح مولَّدةٌ وقت البناء (scripts/build-book-passage-shards.mjs)
   على نمط شرائح المقالات نفسه في article-bodies.ts، ومفتاحها `revision`
   فتُخزَّن أبداً. وحين تغيب — تطويرٌ قبل بناء، أو نشرٌ ناقص — نسقط إلى الملف
   الكامل كما كان، فلا تنكسر صفحةٌ أبداً. */
const shardBooks = new Map<string, Promise<PassagesBook | null>>()
let shardMetaPromise: Promise<ShardMeta | null> | null = null
let fullCorpusPromise: Promise<PassagesFile> | null = null

/* المصيدة المعروفة: ملفٌ ناقص في public/ يردّ صفحة HTML بحالة ٢٠٠، فيمرّ
   `ok` ويسقط `json()` صامتاً. لذلك نتحقّق من الشكل لا من الحالة وحدها. */
async function fetchJson<T>(url: string, cache: RequestCache): Promise<T | null> {
  try {
    const response = await fetch(url, { cache })
    if (!response.ok) return null
    const type = response.headers.get('content-type') || ''
    if (!type.includes('json')) return null
    return await response.json() as T
  } catch {
    return null
  }
}

function shardMeta(): Promise<ShardMeta | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!shardMetaPromise) {
    shardMetaPromise = fetchJson<ShardMeta>('/books/passages/v1/meta.json', 'no-cache')
      .then((meta) => (meta && Array.isArray(meta.books) && meta.revision ? meta : null))
  }
  return shardMetaPromise
}

function mergeBook(book: PassagesBook) {
  const current = passagesCache || { coverage: { books: 0, passages: 0 }, books: [] }
  if (!current.books.some((item) => item.slug === book.slug)) current.books.push(book)
  current.coverage = {
    books: current.books.length,
    passages: current.books.reduce((total, item) => total + item.passages.length, 0),
  }
  passagesCache = current
}

/** متن كتابٍ واحد — وهو ما تحتاجه صفحة الكتاب فعلاً. */
export function loadBookPassagesFor(slug: string): Promise<PassagesFile> {
  const clean = String(slug || '').trim()
  if (!clean) return loadBookPassages()
  if (passagesCache?.books.some((item) => item.slug === clean)) return Promise.resolve(passagesCache)
  let promise = shardBooks.get(clean)
  if (!promise) {
    promise = shardMeta().then(async (meta) => {
      if (!meta?.books.some((item) => item.slug === clean)) return null
      return await fetchJson<PassagesBook>(`/books/passages/v1/${encodeURIComponent(meta.revision)}/${encodeURIComponent(clean)}.json`, 'force-cache')
    }).then((book) => (book && Array.isArray(book.passages) ? book : null))
    shardBooks.set(clean, promise)
  }
  return promise.then((book) => {
    if (book) {
      mergeBook(book)
      return passagesCache as PassagesFile
    }
    /* لا شريحة — نسقط إلى المتن الكامل بدل أن نترك الصفحة بلا جواب. */
    return loadBookPassages()
  })
}

function loadFullCorpus(): Promise<PassagesFile> {
  if (!fullCorpusPromise) {
    fullCorpusPromise = import('../data/book-passages.json')
      .then((module) => (module.default || module) as unknown as PassagesFile)
      .catch(() => ({ coverage: { books: 0, passages: 0 }, books: [] }))
  }
  return fullCorpusPromise
}

/** المتون التسعة — للبحث الشامل وحده (‏/search و‏/ask). */
export function loadBookPassages(): Promise<PassagesFile> {
  if (!passagesPromise) {
    passagesPromise = shardMeta().then(async (meta) => {
      if (!meta) return await loadFullCorpus()
      const books = await Promise.all(meta.books.map((entry) =>
        fetchJson<PassagesBook>(`/books/passages/v1/${encodeURIComponent(meta.revision)}/${encodeURIComponent(entry.slug)}.json`, 'force-cache')))
      const usable = books.filter((book): book is PassagesBook => Boolean(book && Array.isArray(book.passages)))
      if (usable.length !== meta.books.length) return await loadFullCorpus()
      for (const book of usable) mergeBook(book)
      return passagesCache as PassagesFile
    }).then((file) => {
      if (!passagesCache) passagesCache = file
      return passagesCache
    })
  }
  return passagesPromise
}

export const bookPassagesReady = () => Boolean(passagesCache)

/** هل متن هذا الكتاب حاضرٌ بعينه؟ (‏`bookPassagesReady` تعني «أيُّ متن»). */
export const bookPassagesReadyFor = (slug: string) =>
  Boolean(passagesCache?.books.some((item) => item.slug === slug))

export function bookPassageAtPage(slug: string, page: number): BookQuote | null {
  const book = passagesCache?.books.find((item) => item.slug === slug)
  if (!book?.passages.length) return null
  return [...book.passages].sort((left, right) =>
    Math.abs(Number(left.page) - page) - Math.abs(Number(right.page) - page))[0] || null
}

/**
 * البحث الدلالي في متون الكتب التسعة كاملة.
 *
 * 1) يفهم صياغة الزائر واللهجة والمرادفات من معجم التخصص.
 * 2) يطابق عناوين الفصول والمحاور بوزن أعلى من الكلمات العامة.
 * 3) إذا كان السؤال عنوان محور مثل «الصفات الأساسية للعب»، يعرض المحور
 *    نفسه ثم أقرب المقاطع معنىً، حتى لو لم يرد العنوان حرفياً داخل المقطع.
 */
export function searchBookPassages(query: string, limit = 12, onlySlug = ''): BookQuoteMatch[] {
  if (!passagesCache) return []
  const plan = buildSmartQueryPlan(query)
  if (!plan.directRoots.length && !plan.semanticRoots.length) return []
  const matches: BookQuoteMatch[] = []
  const selectedConcept = onlySlug ? bestBookConcept(query, onlySlug) : null
  const conceptPlan = selectedConcept && selectedConcept.score > 12
    ? extendSmartQueryPlan(plan, `${selectedConcept.concept.title} ${selectedConcept.concept.keywords.join(' ')} ${selectedConcept.concept.summary} ${selectedConcept.concept.question}`)
    : null

  for (const book of passagesCache.books) {
    if (onlySlug && book.slug !== onlySlug) continue
    for (const passage of book.passages) {
      let score = scoreSmartFields(plan, [
        { value: passage.text, weight: 1.75, phraseWeight: 1.08 },
        { value: passage.conceptTitle, weight: 5.2, phraseWeight: 1.65, exactWeight: 1.7 },
        { value: passage.section, weight: 4.2, phraseWeight: 1.45 },
        { value: book.title, weight: 1.25 },
      ])

      if (conceptPlan && selectedConcept && book.slug === selectedConcept.book.slug) {
        score += scoreSmartFields(conceptPlan, [
          { value: passage.text, weight: .48 },
          { value: passage.conceptTitle, weight: 1.45 },
          { value: passage.section, weight: 1.2 },
        ])
        const distance = Math.abs(Number(passage.page || 0) - selectedConcept.concept.pageStart)
        if (distance <= 12) score += Math.max(0, 10 - distance * .65)
      }

      if (score > 9) matches.push({
        quote: { ...passage, evidenceType: passage.evidenceType || 'passage' },
        bookSlug: book.slug,
        bookTitle: book.title,
        score,
      })
    }
  }

  if (onlySlug) {
    if (selectedConcept && selectedConcept.score > 18) matches.push(conceptQuote(selectedConcept))
  } else {
    for (const concept of relatedBookKnowledge(query, Math.max(6, limit))) {
      if (concept.score > 18) matches.push(conceptQuote(concept))
    }
  }

  return balancedMatches(matches, limit, onlySlug ? Math.max(4, limit) : 3)
}
