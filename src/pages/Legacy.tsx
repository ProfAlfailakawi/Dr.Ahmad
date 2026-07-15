import { Navigate, useLocation, useParams } from 'react-router-dom'
import NotFound from './NotFound'
import { papers } from '../data'

/**
 * جسر روابط الموقع السابق → المسارات الجديدة.
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

const PAPER_STOP_WORDS = new Set(['في', 'من', 'على', 'إلى', 'الى', 'عن', 'the', 'of', 'in', 'at', 'and', 'for', 'to', 'a', 'an', '2'])
const normalizePaperText = (value: string) => decodeURIComponent(value || '')
  .toLowerCase()
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[ًٌٍَُِّْ]/g, '')
  .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
  .trim()
const paperTokens = (value: string) => normalizePaperText(value).split(/\s+/).filter((token) => token.length > 1 && !PAPER_STOP_WORDS.has(token))
const resolveLegacyPaper = (legacySlug: string) => {
  const legacy = paperTokens(legacySlug)
  if (!legacy.length) return undefined
  let best: { slug: string; score: number; matches: number } | undefined
  for (const paper of papers) {
    const tokens = new Set([...paperTokens(paper.title), ...paperTokens(paper.slug)])
    const matches = legacy.filter((token) => tokens.has(token)).length
    const score = matches / Math.max(legacy.length, 1)
    if (!best || score > best.score || (score === best.score && matches > best.matches)) best = { slug: paper.slug, score, matches }
  }
  return best && (best.matches >= 3 || best.score >= 0.42) ? best.slug : undefined
}

/** روابط أبحاث ووردبريس القديمة كانت عربية ومختصرة؛ نطابقها بالعنوان بدل افتراض تطابق الـslug. */
export function LegacyPaper() {
  const { slug = '' } = useParams()
  const resolved = resolveLegacyPaper(slug)
  return <Navigate to={resolved ? `/research/${resolved}` : '/research'} replace />
}

/** /books/:slug — الكتب (أسماء مختلفة) */
export function LegacyBook() {
  const { slug = '' } = useParams()
  const s = BOOKS[slug]
  return <Navigate to={s ? `/publications/${s}` : '/publications'} replace />
}

/** /ar/... و /en/... — يحافظ على الوجهة الصحيحة داخل الموقع الجديد. */
export function LegacyLang() {
  const { pathname, search } = useLocation()
  const match = pathname.match(/^\/(ar|en)(?:\/(.*))?$/)
  if (!match) return <NotFound />

  const lang = match[1]
  const rest = (match[2] || '').replace(/\/+$/, '')
  if (!rest) return <Navigate to={(lang === 'en' ? '/en' : '/') + search} replace />

  if (lang === 'en' && /^(academic-biography(?:-2)?)$/.test(rest)) {
    return <Navigate to={'/en/cv' + search} replace />
  }
  if (lang === 'en' && /^(scholarly-contributions(?:-2)?)$/.test(rest)) {
    return <Navigate to={'/en/research' + search} replace />
  }

  const leaf = rest.split('/').filter(Boolean).at(-1) || ''
  const page = LEGACY_PAGES[rest] || LEGACY_PAGES[leaf]
  if (page) return <Navigate to={page + search} replace />

  const stripped = `/${rest}`
  return <Navigate to={stripped + search} replace />
}
