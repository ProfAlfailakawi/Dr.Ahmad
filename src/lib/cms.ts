import audioManifest from '../data/audio.json'
import bodies from '../data/bodies.json'
import { articleCats, articles, books, papers } from '../data'

export type ArticleRecord = (typeof articles)[number] & {
  body?: string
  words: number
  year: string
  hasAudio: boolean
  missing: boolean
}

type AudioEntry = boolean | { fahed?: boolean; noura?: boolean }

const bodyMap = bodies as Record<string, string>
const audioMap = audioManifest as Record<string, AudioEntry>

const requiredArticleFields = ['slug', 'title', 'date', 'iso', 'cat', 'excerpt'] as const

export type CmsIssue = {
  kind: 'article' | 'book' | 'paper'
  id: string
  message: string
}

const wordCount = (text = '') => text.trim().split(/\s+/).filter(Boolean).length

const hasAudio = (slug: string) => {
  const entry = audioMap[slug]
  if (entry === true) return true
  return Boolean(entry && typeof entry === 'object' && (entry.fahed || entry.noura))
}

export const allArticles: ArticleRecord[] = articles.map((article) => {
  const body = bodyMap[article.slug]
  return {
    ...article,
    body,
    words: wordCount(body || article.excerpt),
    year: article.iso.slice(0, 4),
    hasAudio: hasAudio(article.slug),
    missing: !body,
  }
})

export const articleYears = Array.from(new Set(allArticles.map((article) => article.year))).sort((a, b) => b.localeCompare(a))

export const cmsIssues: CmsIssue[] = [
  ...allArticles.flatMap((article) => {
    const missingFields = requiredArticleFields.filter((field) => !String(article[field] || '').trim())
    return [
      ...missingFields.map((field) => ({
        kind: 'article' as const,
        id: article.slug || article.title,
        message: `الحقل ${field} ناقص`,
      })),
      ...(articleCats.includes(article.cat) ? [] : [{
        kind: 'article' as const,
        id: article.slug,
        message: `تصنيف غير معروف: ${article.cat}`,
      }]),
      ...(article.missing ? [{
        kind: 'article' as const,
        id: article.slug,
        message: 'النص الكامل غير موجود',
      }] : []),
    ]
  }),
  ...books.flatMap((book) => [
    ...(!book.cover ? [{ kind: 'book' as const, id: book.slug, message: 'غلاف الكتاب غير محدد' }] : []),
    ...(!book.pdf ? [{ kind: 'book' as const, id: book.slug, message: 'ملف PDF غير محدد' }] : []),
  ]),
  ...papers.flatMap((paper) => {
    const item = paper as { slug?: string; title: string }
    return [
      ...(!item.slug || !String(item.slug).trim()
        ? [{ kind: 'paper' as const, id: item.title, message: 'مسار البحث غير محدد' }]
        : []),
    ]
  }),
]

export const cmsStats = {
  articles: allArticles.length,
  completeArticles: allArticles.filter((article) => !article.missing).length,
  missingArticles: allArticles.filter((article) => article.missing),
  audioReady: allArticles.filter((article) => article.hasAudio).length,
  words: allArticles.reduce((sum, article) => sum + article.words, 0),
  years: articleYears.length,
  categories: articleCats
    .filter((cat) => cat !== 'الكل')
    .map((cat) => ({
      cat,
      count: allArticles.filter((article) => article.cat === cat).length,
      words: allArticles.filter((article) => article.cat === cat).reduce((sum, article) => sum + article.words, 0),
    }))
    .sort((a, b) => b.count - a.count),
  duplicateSlugs: Array.from(
    allArticles.reduce((map, article) => map.set(article.slug, (map.get(article.slug) || 0) + 1), new Map<string, number>()),
  ).filter(([, count]) => count > 1),
}

export const getArticleBySlug = (slug?: string) => allArticles.find((article) => article.slug === slug)

export const getArticleNeighbors = (slug?: string) => {
  const index = allArticles.findIndex((article) => article.slug === slug)
  return {
    index,
    prev: index > -1 ? allArticles[index - 1] : undefined,
    next: index > -1 ? allArticles[index + 1] : undefined,
  }
}

const arabicStopWords = new Set([
  'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'الذين', 'كان', 'كانت', 'يكون',
  'لكن', 'على', 'إلى', 'الى', 'عن', 'من', 'في', 'مع', 'ما', 'لا', 'لم', 'لن',
  'أن', 'إن', 'كل', 'حين', 'بعد', 'قبل', 'حتى', 'لقد', 'كما', 'نحن', 'وهو',
])

export function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function articleKeywords(article: Pick<ArticleRecord, 'title' | 'excerpt' | 'body'>, limit = 7) {
  const text = normalizeArabic(`${article.title} ${article.excerpt || ''} ${article.body || ''}`)
  const counts = new Map<string, number>()
  for (const word of text.split(/\s+/)) {
    if (word.length < 4 || arabicStopWords.has(word)) continue
    counts.set(word, (counts.get(word) || 0) + 1)
  }
  return Array.from(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

export function relatedArticles(article: ArticleRecord, limit = 3) {
  const base = new Set(articleKeywords(article, 12))
  return allArticles
    .filter((candidate) => candidate.slug !== article.slug)
    .map((candidate) => {
      const overlap = articleKeywords(candidate, 12).filter((keyword) => base.has(keyword)).length
      const score = overlap * 3 + (candidate.cat === article.cat ? 5 : 0) + (candidate.year === article.year ? 1 : 0)
      return { article: candidate, score }
    })
    .sort((a, b) => b.score - a.score || b.article.iso.localeCompare(a.article.iso))
    .slice(0, limit)
    .map(({ article: candidate }) => candidate)
}

export function searchArticles({
  query,
  cat = 'الكل',
  year = 'الكل',
}: {
  query: string
  cat?: string
  year?: string
}) {
  const term = normalizeArabic(query)
  const terms = term ? term.split(/\s+/).filter(Boolean) : []

  return allArticles
    .filter((article) => (cat === 'الكل' ? true : article.cat === cat))
    .filter((article) => (year === 'الكل' ? true : article.year === year))
    .map((article) => {
      const title = normalizeArabic(article.title)
      const excerpt = normalizeArabic(article.excerpt || '')
      const body = normalizeArabic(article.body || '')
      const haystack = `${title} ${excerpt} ${body}`
      const score = terms.length
        ? terms.reduce((sum, part) => {
            if (!haystack.includes(part)) return sum
            return sum + (title.includes(part) ? 8 : 0) + (excerpt.includes(part) ? 4 : 0) + (body.includes(part) ? 1 : 0)
          }, 0)
        : 1
      return { article, score }
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.article.iso.localeCompare(a.article.iso))
    .map(({ article }) => article)
}

export function topKeywordsFor(articlesToScan: ArticleRecord[], limit = 10) {
  const counts = new Map<string, number>()
  for (const article of articlesToScan) {
    for (const keyword of articleKeywords(article, 10)) counts.set(keyword, (counts.get(keyword) || 0) + 1)
  }
  return Array.from(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword)
}
