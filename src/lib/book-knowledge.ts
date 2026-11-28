import rawKnowledge from '../data/book-knowledge.json' with { type: 'json' }

export type BookKnowledgeConcept = {
  id: string
  title: string
  pageStart: number
  pageEnd: number
  keywords: string[]
  summary: string
  question: string
}

export type BookKnowledgeRecord = {
  slug: string
  title: string
  year: string
  pageCount: number
  indexedPages: number
  role: string
  topTerms: string[]
  concepts: BookKnowledgeConcept[]
  questions: string[]
}

type KnowledgeFile = {
  version: number
  policy: string
  coverage: { books: number; pages: number; indexedPages: number; complete: boolean }
  books: BookKnowledgeRecord[]
}

const knowledge = rawKnowledge as KnowledgeFile
const bySlug = new Map(knowledge.books.map((book) => [book.slug, book]))

const STOP = new Set('من في على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون كتاب فصل باب مقدمه خاتمه'.split(' '))
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

export const bookKnowledgeCoverage = knowledge.coverage
export const allBookKnowledge = knowledge.books

export function getBookKnowledge(slug = '') {
  return bySlug.get(slug)
}

export function bookKnowledgeText(slug = '') {
  const book = bySlug.get(slug)
  if (!book) return ''
  return [
    book.title,
    book.role,
    book.topTerms.join(' '),
    ...book.concepts.flatMap((concept) => [concept.title, concept.keywords.join(' '), concept.question]),
  ].join(' ')
}

export type BookKnowledgeMatch = {
  book: BookKnowledgeRecord
  concept: BookKnowledgeConcept
  score: number
}

export function relatedBookKnowledge(query: string, limit = 3, excludeSlug = ''): BookKnowledgeMatch[] {
  const queryRoots = roots(query)
  if (!queryRoots.size) return []
  const matches: BookKnowledgeMatch[] = []
  for (const book of knowledge.books) {
    if (book.slug === excludeSlug) continue
    const bookRoots = roots(`${book.title} ${book.topTerms.join(' ')}`)
    let best: BookKnowledgeMatch | null = null
    for (const concept of book.concepts.filter((item) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)|الدراسات السابقة/u.test(item.title))) {
      const titleRoots = roots(concept.title)
      const conceptRoots = roots(`${concept.title} ${concept.keywords.join(' ')}`)
      const score = overlap(queryRoots, conceptRoots) * 3
        + overlap(queryRoots, titleRoots) * 5
        + overlap(queryRoots, bookRoots)
      if (!best || score > best.score) best = { book, concept, score }
    }
    if (best && best.score > 0) matches.push(best)
  }
  return matches
    .sort((left, right) => right.score - left.score
      || Number(right.book.slug === 'encyclopedia') - Number(left.book.slug === 'encyclopedia')
      || left.book.title.localeCompare(right.book.title, 'ar'))
    .slice(0, limit)
}

export function bestBookConcept(query: string, slug = '') {
  if (slug) {
    const match = relatedBookKnowledge(query, knowledge.books.length + 1).find((item) => item.book.slug === slug)
    if (match) return match
    const book = bySlug.get(slug)
    return book?.concepts[0] ? { book, concept: book.concepts[0], score: 0 } : null
  }
  return relatedBookKnowledge(query, 1)[0] || null
}

export function bookKnowledgeAnchor(concept: BookKnowledgeConcept) {
  return `book-knowledge-${concept.id}`
}
