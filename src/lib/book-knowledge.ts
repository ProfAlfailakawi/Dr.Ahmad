import rawKnowledge from '../data/book-knowledge.json' with { type: 'json' }
import { buildSmartQueryPlan, scoreSmartFields } from './smart-search.ts'

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
    ...book.concepts.flatMap((concept) => [
      concept.title,
      concept.keywords.join(' '),
      concept.summary,
      concept.question,
    ]),
    ...book.questions,
  ].join(' ')
}

export type BookKnowledgeMatch = {
  book: BookKnowledgeRecord
  concept: BookKnowledgeConcept
  score: number
}

export function relatedBookKnowledge(query: string, limit = 3, excludeSlug = ''): BookKnowledgeMatch[] {
  const plan = buildSmartQueryPlan(query)
  if (!plan.directRoots.length && !plan.semanticRoots.length) return []
  const matches: BookKnowledgeMatch[] = []

  for (const book of knowledge.books) {
    if (book.slug === excludeSlug) continue
    for (const concept of book.concepts.filter((item) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)|الدراسات السابقة/u.test(item.title))) {
      const score = scoreSmartFields(plan, [
        { value: concept.title, weight: 6.2, phraseWeight: 1.7, exactWeight: 1.8 },
        { value: concept.keywords.join(' '), weight: 3.4, phraseWeight: 1.2 },
        { value: concept.question, weight: 2.6 },
        { value: concept.summary, weight: 2.3 },
        { value: book.title, weight: .75 },
        { value: book.topTerms.join(' '), weight: .55 },
        { value: book.role, weight: 1.1 },
      ])
      if (score > 8) matches.push({ book, concept, score })
    }
  }

  const perBook = new Map<string, number>()
  return matches
    .sort((left, right) => right.score - left.score
      || Number(right.book.slug === 'encyclopedia') - Number(left.book.slug === 'encyclopedia')
      || left.concept.pageStart - right.concept.pageStart)
    .filter((match) => {
      const used = perBook.get(match.book.slug) || 0
      if (used >= 3) return false
      perBook.set(match.book.slug, used + 1)
      return true
    })
    .slice(0, limit)
}

export function bestBookConcept(query: string, slug = '') {
  if (slug) {
    const book = bySlug.get(slug)
    if (!book) return null
    const plan = buildSmartQueryPlan(query)
    let best: BookKnowledgeMatch | null = null
    for (const concept of book.concepts.filter((item) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)|الدراسات السابقة/u.test(item.title))) {
      const score = scoreSmartFields(plan, [
        { value: concept.title, weight: 6.5, phraseWeight: 1.8, exactWeight: 2 },
        { value: concept.keywords.join(' '), weight: 3.5 },
        { value: concept.question, weight: 2.6 },
        { value: concept.summary, weight: 2.2 },
        { value: book.title, weight: .3 },
        { value: book.topTerms.join(' '), weight: .25 },
      ])
      if (!best || score > best.score) best = { book, concept, score }
    }
    if (best) return best
    return book.concepts[0] ? { book, concept: book.concepts[0], score: 0 } : null
  }
  return relatedBookKnowledge(query, 1)[0] || null
}

export function bookKnowledgeAnchor(concept: BookKnowledgeConcept) {
  return `book-knowledge-${concept.id}`
}
