import audioManifest from '../data/audio.json'
import {
  articleCats,
  articles as staticArticles,
  books as staticBooks,
  media as staticMedia,
  papers as staticPapers,
} from '../data'

export type ContentKind = 'article' | 'book' | 'paper' | 'media'
export type ContentOrigin = 'base' | 'added'
export type AudioValue = boolean | string
export type ArticleAudio = { fahed?: AudioValue; noura?: AudioValue }

export type CmsMeta = {
  kind: ContentKind
  origin: ContentOrigin
  modified: boolean
  hidden: boolean
  docId: string
  baseSlug: string
  createdAt?: unknown
  updatedAt?: unknown
}

export type ArticleRecord = {
  slug: string
  title: string
  date: string
  iso: string
  cat: string
  excerpt: string
  body?: string
  source?: string
  url?: string
  status?: string
  scheduledAt?: string
  audio?: ArticleAudio
  words: number
  year: string
  hasAudio: boolean
  missing: boolean
  _cms: CmsMeta
}

export type BookRecord = {
  slug: string
  title: string
  isbn: string
  desc: string
  cover: string
  pdf: string
  coAuthors?: string
  _cms: CmsMeta
}

export type PaperRecord = {
  slug: string
  title: string
  meta: string
  abstractAr?: string
  journal?: string
  source?: string
  url?: string
  pdf?: string
  iso?: string
  date?: string
  coAuthors?: string
  scholar?: string
  researchgate?: string
  doi?: string
  verification?: 'verified' | 'needs-manual-review'
  _cms: CmsMeta
}

export type MediaRecord = {
  slug: string
  title: string
  outlet: string
  platform?: string
  url: string
  iso?: string
  date?: string
  _cms: CmsMeta
}

export type CmsSnapshot = {
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
}

export type RemoteDocument = Record<string, unknown> & { id: string }
export type RemoteCmsData = {
  overrides?: RemoteDocument[]
  articles?: RemoteDocument[]
  books?: RemoteDocument[]
  papers?: RemoteDocument[]
  media?: RemoteDocument[]
}

type AudioEntry = boolean | ArticleAudio
type AnyRecord = ArticleRecord | BookRecord | PaperRecord | MediaRecord

const audioMap = audioManifest as Record<string, AudioEntry>

const fieldsByKind: Record<ContentKind, readonly string[]> = {
  article: ['title', 'date', 'iso', 'cat', 'excerpt', 'body', 'source', 'url', 'status', 'scheduledAt', 'audio'],
  book: ['title', 'isbn', 'desc', 'cover', 'pdf'],
  paper: ['title', 'meta', 'abstractAr', 'journal', 'source', 'url', 'pdf', 'iso', 'date', 'coAuthors', 'scholar', 'researchgate', 'doi', 'verification'],
  media: ['title', 'outlet', 'platform', 'url', 'iso', 'date'],
}

const wordCount = (text = '') => text.trim().split(/\s+/).filter(Boolean).length
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const stringValue = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback

function metadata(kind: ContentKind, slug: string, value: Partial<CmsMeta> = {}): CmsMeta {
  return {
    kind,
    origin: value.origin ?? 'base',
    modified: Boolean(value.modified),
    hidden: Boolean(value.hidden),
    docId: value.docId || slug,
    baseSlug: value.baseSlug || slug,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function audioVoices(value: unknown): ArticleAudio | undefined {
  if (value === true) return { fahed: true }
  if (!isObject(value)) return undefined
  const valid = (entry: unknown): AudioValue | undefined =>
    typeof entry === 'boolean' || typeof entry === 'string' ? entry : undefined
  const result = { fahed: valid(value.fahed), noura: valid(value.noura) }
  return result.fahed || result.noura ? result : undefined
}

function buildArticle(value: Record<string, unknown>, cms: CmsMeta): ArticleRecord {
  const slug = stringValue(value.slug, cms.baseSlug)
  const body = stringValue(value.body) || undefined
  const audio = audioVoices(value.audio)
  return {
    slug,
    title: stringValue(value.title),
    date: stringValue(value.date),
    iso: stringValue(value.iso),
    cat: stringValue(value.cat, 'التعليم'),
    excerpt: stringValue(value.excerpt),
    body,
    source: stringValue(value.source) || undefined,
    url: stringValue(value.url) || undefined,
    status: stringValue(value.status) || undefined,
    scheduledAt: stringValue(value.scheduledAt) || undefined,
    audio,
    words: wordCount(body || stringValue(value.excerpt)),
    year: stringValue(value.iso).slice(0, 4),
    hasAudio: Boolean(audio?.fahed || audio?.noura),
    missing: !body,
    _cms: cms,
  }
}

function buildBook(value: Record<string, unknown>, cms: CmsMeta): BookRecord {
  return {
    slug: stringValue(value.slug, cms.baseSlug),
    title: stringValue(value.title),
    isbn: stringValue(value.isbn),
    desc: stringValue(value.desc),
    cover: stringValue(value.cover),
    pdf: stringValue(value.pdf),
    coAuthors: stringValue(value.coAuthors) || undefined,
    _cms: cms,
  }
}

function buildPaper(value: Record<string, unknown>, cms: CmsMeta): PaperRecord {
  return {
    slug: stringValue(value.slug, cms.baseSlug),
    title: stringValue(value.title),
    meta: stringValue(value.meta),
    abstractAr: stringValue(value.abstractAr) || undefined,
    journal: stringValue(value.journal) || undefined,
    source: stringValue(value.source) || undefined,
    url: stringValue(value.url) || undefined,
    pdf: stringValue(value.pdf) || undefined,
    iso: stringValue(value.iso) || undefined,
    date: stringValue(value.date) || undefined,
    coAuthors: stringValue(value.coAuthors) || undefined,
    scholar: stringValue(value.scholar) || undefined,
    researchgate: stringValue(value.researchgate) || undefined,
    doi: stringValue(value.doi) || undefined,
    verification: stringValue(value.verification) === 'needs-manual-review' ? 'needs-manual-review' : 'verified',
    _cms: cms,
  }
}

function buildMedia(value: Record<string, unknown>, cms: CmsMeta): MediaRecord {
  const outlet = stringValue(value.outlet) || stringValue(value.platform)
  return {
    slug: stringValue(value.slug, cms.baseSlug),
    title: stringValue(value.title),
    outlet,
    platform: stringValue(value.platform, outlet) || undefined,
    url: stringValue(value.url),
    iso: stringValue(value.iso) || undefined,
    date: stringValue(value.date) || undefined,
    _cms: cms,
  }
}

function buildRecord(kind: ContentKind, value: Record<string, unknown>, cms: CmsMeta): AnyRecord {
  if (kind === 'article') return buildArticle(value, cms)
  if (kind === 'book') return buildBook(value, cms)
  if (kind === 'paper') return buildPaper(value, cms)
  return buildMedia(value, cms)
}

function youtubeId(url: string) {
  return (url.match(/[?&]v=([\w-]{6,})/) || url.match(/youtu\.be\/([\w-]{6,})/))?.[1]
}

const baseArticles: ArticleRecord[] = staticArticles.map((article) => {
  const slug = article.slug
  const manifest = audioMap[slug]
  const audio = manifest === true ? { fahed: true } : audioVoices(manifest)
  return buildArticle({
    ...article,
    audio,
  }, metadata('article', slug))
})

const baseBooks: BookRecord[] = staticBooks.map((book) =>
  buildBook(book, metadata('book', book.slug)))

const basePapers: PaperRecord[] = staticPapers.map((paper) =>
  buildPaper(paper, metadata('paper', paper.slug)))

const baseMedia: MediaRecord[] = staticMedia.map((item, index) => {
  const slug = 'media-' + (youtubeId(item.url) || index + 1)
  return buildMedia({ ...item, slug }, metadata('media', slug))
})

export const baseCmsSnapshot: CmsSnapshot = {
  articles: baseArticles,
  books: baseBooks,
  papers: basePapers,
  media: baseMedia,
}

const baseMaps: Record<ContentKind, Map<string, AnyRecord>> = {
  article: new Map(baseArticles.map((item) => [item.slug, item])),
  book: new Map(baseBooks.map((item) => [item.slug, item])),
  paper: new Map(basePapers.map((item) => [item.slug, item])),
  media: new Map(baseMedia.map((item) => [item.slug, item])),
}

export function getBaseRecord(kind: ContentKind, slug: string): Record<string, unknown> | undefined {
  const record = baseMaps[kind].get(slug)
  if (!record) return undefined
  const { _cms, ...content } = record
  void _cms
  return { ...content }
}

function cleanPatch(kind: ContentKind, value: unknown) {
  if (!isObject(value)) return {}
  return Object.fromEntries(fieldsByKind[kind]
    .filter((field) => Object.prototype.hasOwnProperty.call(value, field))
    .map((field) => [field, value[field]]))
}

export function diffContentPatch(
  kind: ContentKind,
  base: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  return Object.fromEntries(fieldsByKind[kind].flatMap((field) => {
    const left = base[field]
    const right = next[field]
    if (JSON.stringify(left ?? '') === JSON.stringify(right ?? '')) return []
    return [[field, right ?? '']]
  }))
}

function applyOriginals<T extends AnyRecord>(
  kind: ContentKind,
  originals: readonly T[],
  overrides: Map<string, RemoteDocument>,
  includeHidden: boolean,
): T[] {
  return originals.flatMap((original) => {
    const override = overrides.get(kind + ':' + original.slug)
    const patch = cleanPatch(kind, override?.patch)
    const hidden = override?.hidden === true
    if (hidden && !includeHidden) return []
    const base = getBaseRecord(kind, original.slug) || {}
    const merged = { ...base, ...patch, slug: original.slug }
    if (kind === 'article' && !includeHidden && !isPubliclyPublished({ id: original.slug, ...merged })) return []
    return [buildRecord(kind, merged, metadata(kind, original.slug, {
      modified: Object.keys(patch).length > 0,
      hidden,
      updatedAt: override?.updatedAt,
    })) as T]
  })
}

function additions<T extends AnyRecord>(
  kind: ContentKind,
  documents: readonly RemoteDocument[],
  occupied: Set<string>,
  includeHidden: boolean,
): T[] {
  return documents.flatMap((document) => {
    const slug = stringValue(document.slug, document.id)
    if (!slug || occupied.has(slug)) return []
    const hidden = document.hidden === true
    if (hidden && !includeHidden) return []
    if (kind === 'article' && !includeHidden && !isPubliclyPublished(document)) return []
    const record = buildRecord(kind, { ...document, slug }, metadata(kind, slug, {
      origin: 'added',
      modified: false,
      hidden,
      docId: document.id,
      baseSlug: slug,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    })) as T
    if (!record.title) return []
    occupied.add(slug)
    return [record]
  })
}

const timeValue = (value: unknown) => {
  if (typeof value === 'string') return Date.parse(value) || 0
  if (isObject(value) && typeof value.seconds === 'number') return value.seconds * 1000
  if (isObject(value) && typeof value.toMillis === 'function') {
    try { return Number((value.toMillis as () => number)()) || 0 } catch { return 0 }
  }
  return 0
}

const scheduledTime = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const isPubliclyPublished = (document: RemoteDocument) => {
  const status = stringValue(document.status, 'published')
  if (status === 'draft') return false
  const scheduledAt = scheduledTime(document.scheduledAt)
  if (status === 'scheduled') return scheduledAt > 0 && scheduledAt <= Date.now()
  if (scheduledAt > Date.now()) return false
  return status === 'published' || !status
}

const newestFirst = <T extends AnyRecord>(left: T, right: T) => {
  const leftIso = 'iso' in left ? String(left.iso || '') : ''
  const rightIso = 'iso' in right ? String(right.iso || '') : ''
  const iso = rightIso.localeCompare(leftIso)
  if (iso) return iso
  return timeValue(right._cms.createdAt) - timeValue(left._cms.createdAt)
}

export function mergeCmsContent(remote: RemoteCmsData = {}, includeHidden = false): CmsSnapshot {
  const overrides = new Map((remote.overrides || []).map((item) => [item.id, item]))

  const originalArticles = applyOriginals('article', baseArticles, overrides, includeHidden)
  const originalBooks = applyOriginals('book', baseBooks, overrides, includeHidden)
  const originalPapers = applyOriginals('paper', basePapers, overrides, includeHidden)
  const originalMedia = applyOriginals('media', baseMedia, overrides, includeHidden)

  const articleAdditions = additions<ArticleRecord>('article', remote.articles || [], new Set(originalArticles.map((item) => item.slug)), includeHidden)
  const bookAdditions = additions<BookRecord>('book', remote.books || [], new Set(originalBooks.map((item) => item.slug)), includeHidden)
  const paperAdditions = additions<PaperRecord>('paper', remote.papers || [], new Set(originalPapers.map((item) => item.slug)), includeHidden)
  const mediaAdditions = additions<MediaRecord>('media', remote.media || [], new Set(originalMedia.map((item) => item.slug)), includeHidden)

  return {
    articles: [...articleAdditions, ...originalArticles].sort(newestFirst),
    books: [...bookAdditions.sort(newestFirst), ...originalBooks],
    papers: [...paperAdditions.sort(newestFirst), ...originalPapers],
    media: [...mediaAdditions, ...originalMedia].sort(newestFirst),
  }
}

export type CmsIssue = {
  kind: 'article' | 'book' | 'paper'
  id: string
  message: string
}

const requiredArticleFields = ['slug', 'title', 'date', 'iso', 'cat', 'excerpt'] as const

export const allArticles: ArticleRecord[] = baseArticles
export const articleYears = Array.from(new Set(allArticles.map((article) => article.year)))
  .filter(Boolean)
  .sort((a, b) => b.localeCompare(a))

export const cmsIssues: CmsIssue[] = [
  ...allArticles.flatMap((article) => {
    const missingFields = requiredArticleFields.filter((field) => !String(article[field] || '').trim())
    return [
      ...missingFields.map((field) => ({
        kind: 'article' as const,
        id: article.slug || article.title,
        message: 'الحقل ' + field + ' ناقص',
      })),
      ...(article.missing ? [{
        kind: 'article' as const,
        id: article.slug,
        message: 'النص الكامل غير موجود',
      }] : []),
    ]
  }),
  ...baseBooks.flatMap((book) => [
    ...(!book.cover ? [{ kind: 'book' as const, id: book.slug, message: 'غلاف الكتاب غير محدد' }] : []),
    ...(!book.pdf ? [{ kind: 'book' as const, id: book.slug, message: 'ملف PDF غير محدد' }] : []),
  ]),
  ...basePapers.flatMap((paper) => !paper.slug
    ? [{ kind: 'paper' as const, id: paper.title, message: 'مسار البحث غير محدد' }]
    : []),
]

export const cmsStats = {
  articles: allArticles.length,
  completeArticles: allArticles.filter((article) => !article.missing).length,
  missingArticles: allArticles.filter((article) => article.missing),
  audioReady: allArticles.filter((article) => article.hasAudio).length,
  words: allArticles.reduce((sum, article) => sum + article.words, 0),
  years: articleYears.length,
  categories: Array.from(new Set(allArticles.map((article) => article.cat).filter(Boolean)))
    .map((cat) => ({
      cat,
      count: allArticles.filter((article) => article.cat === cat).length,
      words: allArticles.filter((article) => article.cat === cat).reduce((sum, article) => sum + article.words, 0),
    }))
    .sort((a, b) => b.count - a.count || a.cat.localeCompare(b.cat, 'ar')),
  duplicateSlugs: Array.from(
    allArticles.reduce((map, article) => map.set(article.slug, (map.get(article.slug) || 0) + 1), new Map<string, number>()),
  ).filter(([, count]) => count > 1),
}

export const getArticleBySlug = (slug?: string, source: ArticleRecord[] = allArticles) =>
  source.find((article) => article.slug === slug)

export const getArticleNeighbors = (slug?: string, source: ArticleRecord[] = allArticles) => {
  const index = source.findIndex((article) => article.slug === slug)
  return {
    index,
    prev: index > -1 ? source[index - 1] : undefined,
    next: index > -1 ? source[index + 1] : undefined,
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
  const text = normalizeArabic(article.title + ' ' + (article.excerpt || '') + ' ' + (article.body || ''))
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

export function relatedArticles(
  article: ArticleRecord,
  limit = 3,
  source: ArticleRecord[] = allArticles,
) {
  const base = new Set(articleKeywords(article, 12))
  return source
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
}, source: ArticleRecord[] = allArticles) {
  const term = normalizeArabic(query)
  const terms = term ? term.split(/\s+/).filter(Boolean) : []

  return source
    .filter((article) => (cat === 'الكل' ? true : article.cat === cat))
    .filter((article) => (year === 'الكل' ? true : article.year === year))
    .map((article) => {
      const title = normalizeArabic(article.title)
      const excerpt = normalizeArabic(article.excerpt || '')
      const body = normalizeArabic(article.body || '')
      const haystack = title + ' ' + excerpt + ' ' + body
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
