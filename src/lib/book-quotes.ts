/**
 * الاقتباسات المنشورة من متون الكتب — بإذن المؤلف.
 *
 * العقد: مقتطف قصير منسوب إلى كتابه وصفحته ومحوره، يدلّ على الكتاب ولا يغني
 * عنه. الملف المولّد (book-quotes.json) مقيّدٌ بسقوفٍ يفرضها حارس البناء،
 * فلا تتسع هذه الطبقة إلا بقرارٍ صريح من الدكتور.
 */
import rawQuotes from '../data/book-quotes.json' with { type: 'json' }

export type BookQuote = {
  id: string
  text: string
  page: number
  section: string
  conceptId: string
  conceptTitle: string
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

const STOP = new Set('من في على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون كتاب فصل مقدمه خاتمه'.split(' '))
const roots = (value = '') => new Set(String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  .map((word) => word.replace(/^ال(?=.{3,})/, '').replace(/ات$|ون$|ين$/u, ''))
  .filter((word) => word.length > 2 && !STOP.has(word)))

const overlap = (left: Set<string>, right: Set<string>) => {
  let score = 0
  for (const word of left) if (right.has(word)) score += 1
  return score
}

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

/**
 * أقرب اقتباسات المتن إلى سؤالٍ أو فكرة — بلا نموذج لغويّ ولا خدمة مدفوعة.
 * الترجيح جذريّ (مطابقة جذور الكلمات)، فيعمل على الجهاز نفسه وفوراً.
 */
export function matchBookQuotes(query: string, limit = 3, onlySlug = ''): BookQuoteMatch[] {
  const queryRoots = roots(query)
  if (queryRoots.size < 1) return []
  const matches: BookQuoteMatch[] = []

  for (const book of file.books) {
    if (onlySlug && book.slug !== onlySlug) continue
    for (const quote of book.quotes) {
      const score = overlap(queryRoots, roots(quote.text)) * 3
        + overlap(queryRoots, roots(quote.conceptTitle)) * 4
        + overlap(queryRoots, roots(book.title)) * 2
      if (score > 0) matches.push({ quote, bookSlug: book.slug, bookTitle: book.title, score })
    }
  }

  /* لا يحتكر كتابٌ واحد النتيجة: اقتباسان لكل كتاب على الأكثر، ليرى السائل
     أن الفكرة تعبر أكثر من مؤلَّف. */
  const perBook = new Map<string, number>()
  return matches
    .sort((left, right) => right.score - left.score || left.quote.page - right.quote.page)
    .filter((match) => {
      const used = perBook.get(match.bookSlug) || 0
      if (used >= 2) return false
      perBook.set(match.bookSlug, used + 1)
      return true
    })
    .slice(0, limit)
}

/* ═══ المتون كاملة — من الجلدة إلى الجلدة ═══
 *
 * المختارات أعلاه تُحمَّل مع الصفحة لأنها خفيفة وتُعرض في صفحة الكتاب.
 * أما فهرس المتون الكامل (تسعة كتب) فثقيل، فلا يُجلب إلا حين يبحث الزائر
 * فعلاً — كما يفعل فهرس المنطوق. وبعد جلبه مرّة يبقى في الذاكرة.
 */
type PassagesFile = {
  coverage: { books: number; passages: number }
  books: { slug: string; title: string; year: string; passages: BookQuote[] }[]
}

let passagesCache: PassagesFile | null = null
let passagesPromise: Promise<PassagesFile> | null = null

export function loadBookPassages(): Promise<PassagesFile> {
  if (passagesCache) return Promise.resolve(passagesCache)
  if (!passagesPromise) {
    passagesPromise = import('../data/book-passages.json')
      .then((module) => {
        passagesCache = (module.default || module) as unknown as PassagesFile
        return passagesCache
      })
      .catch(() => ({ coverage: { books: 0, passages: 0 }, books: [] }))
  }
  return passagesPromise
}

/** هل جاهز الفهرس في الذاكرة؟ يستعمله البحث ليقرر إن كان عليه الانتظار. */
export const bookPassagesReady = () => Boolean(passagesCache)

/**
 * البحث في متون الكتب التسعة كاملة. يعمل بلا خادم ولا نموذج لغويّ ولا خدمة
 * مدفوعة: مطابقة جذور عربية على الجهاز نفسه.
 */
export function searchBookPassages(query: string, limit = 12, onlySlug = ''): BookQuoteMatch[] {
  if (!passagesCache) return []
  const queryRoots = roots(query)
  if (!queryRoots.size) return []
  const matches: BookQuoteMatch[] = []

  for (const book of passagesCache.books) {
    if (onlySlug && book.slug !== onlySlug) continue
    const bookRoots = roots(book.title)
    for (const passage of book.passages) {
      const score = overlap(queryRoots, roots(passage.text)) * 3
        + overlap(queryRoots, roots(passage.conceptTitle)) * 4
        + overlap(queryRoots, bookRoots)
      if (score >= 3) matches.push({ quote: passage, bookSlug: book.slug, bookTitle: book.title, score })
    }
  }

  /* ثلاثة مقاطع لكل كتاب على الأكثر: يرى الباحث أن الفكرة تعبر مؤلفاته،
     ولا يبتلع كتابٌ واحد الصفحة. */
  const perBook = new Map<string, number>()
  return matches
    .sort((left, right) => right.score - left.score || left.quote.page - right.quote.page)
    .filter((match) => {
      const used = perBook.get(match.bookSlug) || 0
      if (used >= 3) return false
      perBook.set(match.bookSlug, used + 1)
      return true
    })
    .slice(0, limit)
}
