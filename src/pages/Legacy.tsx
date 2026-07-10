import { Navigate, useLocation, useParams } from 'react-router-dom'
import NotFound from './NotFound'

/**
 * جسر الروابط القديمة (ووردبريس) → المسارات الجديدة.
 * يحافظ على كل رابط نُشر أو فُهرس سابقاً، ويمنع فقدان أرشفة غوغل.
 */

/** صفحات ثابتة */
export const LEGACY_PAGES: Record<string, string> = {
  'academic-biography-2': '/cv',
  'academic-biography': '/cv',
  'scholarly-contributions-2': '/research',
  'scholarly-contributions': '/research',
  'published-books-2': '/publications',
  'published-books': '/publications',
  'signature-thought-articles-2': '/articles',
  'signature-thought-articles': '/articles',
  'recorded-interviews-media-appearances-2': '/media',
  'recorded-interviews-media-appearances': '/media',
  'upcoming-speaking-engagements-2': '/upcoming',
  'upcoming-speaking-engagements': '/upcoming',
  'from-my-inbox': '/inbox',
  'about-the-website-2': '/about',
  'about-the-website': '/about',
  'contact-consultation-2': '/contact',
  'contact-consultation': '/contact',
  'home-2': '/',
}

/** تصنيفات «من اختياراتي» — كلها تصبّ في صفحة المختارات */
const CURATED = [
  'book-of-the-month', 'article-worth-reading', 'scientific-research',
  'video-pick', 'audio-pick', 'from-xtwitter', 'watch-listen-2',
  'quote-reflection', 'thought-experiment', 'disruptive-question', 'reframe-it',
  'silent-wisdom', 'behind-the-ideas',
  'visual-insights', 'infographic', 'mind-map-visual-notes', 'map-of-meaning', 'image-that-says-it-all',
  'tool-of-the-week', 'ai-summary-corner', 'emerging-concept', 'trend-watch', 'web-platform-i-recommended',
  'mini-library', 'mini-library-ai-society', 'behind-the-quote', 'flash-insight',
  'the-misunderstood-term', 'what-schools-dont-teach', 'spotlight-on-innovation-2',
  'arabic-revival', 'debatable',
]
CURATED.forEach((c) => { LEGACY_PAGES[c] = '/curated' })

/** أسماء الكتب تغيّرت */
const BOOKS: Record<string, string> = {
  'enyclopedia-cover': 'encyclopedia',
  'teaching-2': 'teaching',
  'mega-data-2': 'mega-data',
  'kids-tech-2': 'kids-tech',
  'gamification-2': 'gamification',
  'handy-tech': 'handy-tech',
  'smart-school': 'smart-school',
  'virtual-world': 'virtual-world',
  'digital-education': 'digital-education',
}

/** /:slug — صفحة قديمة ثابتة. إن لم تُعرف، تُعرض ٤٠٤ مباشرة (لا تحويل، لا حلقة). */
export function LegacyPage() {
  const { slug = '' } = useParams()
  const to = LEGACY_PAGES[slug]
  if (!to) return <NotFound />
  return <Navigate to={to} replace />
}

/** /signature_articles/:slug — المقالات (الـslug نفسه) */
export function LegacyArticle() {
  const { slug = '' } = useParams()
  return <Navigate to={`/articles/${slug}`} replace />
}

/** /scholarly_contributi/:slug — الأبحاث (الـslug نفسه) */
export function LegacyPaper() {
  const { slug = '' } = useParams()
  return <Navigate to={`/research/${decodeURIComponent(slug)}`} replace />
}

/** /books/:slug — الكتب (أسماء مختلفة) */
export function LegacyBook() {
  const { slug = '' } = useParams()
  const s = BOOKS[slug]
  return <Navigate to={s ? `/publications/${s}` : '/publications'} replace />
}

/** /ar/... و /en/... — يزيل بادئة اللغة */
export function LegacyLang() {
  const { pathname, search } = useLocation()
  const stripped = pathname.replace(/^\/(ar|en)/, '') || '/'
  if (stripped === pathname) return <NotFound />
  return <Navigate to={stripped + search} replace />
}
