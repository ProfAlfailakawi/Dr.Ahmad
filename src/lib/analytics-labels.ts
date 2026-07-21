import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from './cms'

export type AnalyticsSources = {
  articles?: ArticleRecord[]
  books?: BookRecord[]
  papers?: PaperRecord[]
  media?: MediaRecord[]
}

export type AnalyticsKind = 'مقالات' | 'كتب' | 'أبحاث' | 'صفحات' | 'مشاركات' | 'استماع'

const PAGE_NAMES: Record<string, string> = {
  '/': 'الرئيسية',
  '/articles': 'فهرس المقالات',
  '/publications': 'فهرس الكتب',
  '/research': 'فهرس الأبحاث',
  '/media': 'الظهور الإعلامي',
  '/cv': 'السيرة الأكاديمية',
  '/contact': 'التواصل',
  '/about': 'حول الموقع',
  '/about-site': 'حول الموقع',
  '/curated': 'المختارات',
  '/questions': 'سؤال يقلق التعليم',
  '/radar': 'أرشيف الرادار',
  '/inbox': 'رسائل على الهامش',
  '/atlas': 'سماء المقالات',
  '/thought-paths': 'مسارات الفكرة',
  '/search': 'البحث العميق',
  '/ask': 'اسأل الأرشيف',
  '/upcoming': 'اللقاءات القادمة',
  '/now': 'الآن',
  '/decade': 'وثيقة العقد',
}

export const decodeAnalyticsPath = (value = '') => {
  try { return decodeURIComponent(value) } catch { return value }
}

const cleanPath = (path = '/') => {
  const decoded = decodeAnalyticsPath(path).split(/[?#]/)[0] || '/'
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded
}

const prettify = (path: string) => cleanPath(path)
  .replace(/^\//, '')
  .replace(/[-_/]+/g, ' ')
  .trim() || 'صفحة'

const titleMap = (sources: AnalyticsSources) => {
  const labels = new Map<string, string>()
  Object.entries(PAGE_NAMES).forEach(([path, label]) => labels.set(path, label))
  ;(sources.articles || []).forEach((item) => labels.set(`/articles/${item.slug}`, item.title))
  ;(sources.books || []).forEach((item) => labels.set(`/publications/${item.slug}`, item.title))
  ;(sources.papers || []).forEach((item) => labels.set(`/research/${item.slug}`, item.titleAr || item.title))
  ;(sources.media || []).forEach((item) => {
    labels.set(`/media/${item.slug}`, item.title)
    if (item.url) labels.set(item.url, item.title)
  })
  return labels
}

export function analyticsKindOf(path: string): AnalyticsKind {
  const clean = cleanPath(path)
  if (clean.startsWith('/_share')) return 'مشاركات'
  if (clean.startsWith('/_listen')) return 'استماع'
  if (clean.startsWith('/articles/')) return 'مقالات'
  if (clean.startsWith('/publications/')) return 'كتب'
  if (clean.startsWith('/research/')) return 'أبحاث'
  return 'صفحات'
}

export function createAnalyticsNamer(sources: AnalyticsSources = {}) {
  const labels = titleMap(sources)

  const label = (path: string, fallback = ''): string => {
    const clean = cleanPath(path)
    if (clean.startsWith('/_share')) {
      const target = cleanPath(clean.slice('/_share'.length) || '/')
      return `مشاركة: ${label(target)}`
    }
    const listen = clean.match(/^\/_listen\d+(\/.*)$/)
    if (listen) return `استماع: ${label(listen[1])}`
    if (clean.startsWith('/_journey/')) {
      const parsed = parseJourneyPath(clean)
      return parsed ? `رحلة: ${label(parsed.from)} ← ${label(parsed.to)}` : 'رحلة زائر'
    }
    const titled = labels.get(clean)
    if (titled) return titled
    return fallback && fallback !== clean ? fallback : prettify(clean)
  }

  const journey = (from = '/', to = '/') => ({
    from: label(from),
    to: label(to),
    title: `${label(from)} ← ${label(to)}`,
  })

  return { label, journey }
}

export function parseJourneyPath(path: string) {
  const clean = cleanPath(path)
  if (!clean.startsWith('/_journey/')) return null
  const payload = clean.slice('/_journey/'.length)
  const split = payload.indexOf('>')
  if (split < 1) return null
  const from = decodeAnalyticsPath(payload.slice(0, split))
  const to = decodeAnalyticsPath(payload.slice(split + 1))
  return from && to ? { from, to } : null
}
