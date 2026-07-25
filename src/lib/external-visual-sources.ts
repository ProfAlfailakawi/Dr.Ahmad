import type { CreativeBrief, CreativeIdentity } from './creative-director'

export type FreeImageProviderId = 'wikimedia' | 'pexels' | 'openverse'
export type VisualTone = 'documentary' | 'editorial' | 'data' | 'symbolic'

export type VisualSearchPlan = {
  headline: string
  queries: string[]
  englishQueries: string[]
  avoidTerms: string[]
  generationPrompt: string
  rationale: string
  tone: VisualTone
}

export type ExternalVisualResult = {
  id: string
  provider: FreeImageProviderId
  providerLabel: string
  title: string
  description: string
  thumbnailUrl: string
  imageUrl: string
  pageUrl: string
  author: string
  license: string
  requiresAttribution: boolean
  width?: number
  height?: number
  rationale: string
  score: number
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
}

const PEXELS_FALLBACK_KEY = 'VnPsE0iQsD1In8AckghcrXNPYkoODZGdK7bGhN25IGKHadcTV7PZV0N4'

const clean = (value = '') => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const truncate = (value: string, count: number) => {
  const words = clean(value).split(/\s+/).filter(Boolean)
  return words.length > count ? `${words.slice(0, count).join(' ')}…` : words.join(' ')
}
const normalize = (value = '') => clean(value).toLowerCase()

function unique(list: string[]) {
  return [...new Set(list.map((item) => clean(item)).filter(Boolean))]
}

function visualSeed(brief: CreativeBrief) {
  switch (brief.visualNeed) {
    case 'human':
      return {
        tone: 'documentary' as const,
        ar: ['معلم داخل فصل', 'حوار تربوي', 'طالب ومعلم', 'لحظة إنسانية في التعليم'],
        en: ['teacher in classroom', 'human educational moment', 'teacher student discussion'],
      }
    case 'place':
      return {
        tone: 'editorial' as const,
        ar: ['جامعة', 'مكتبة', 'فصل دراسي', 'مساحة تعليمية'],
        en: ['university campus', 'library interior', 'classroom environment'],
      }
    case 'data':
      return {
        tone: 'data' as const,
        ar: ['مخطط بياني', 'دراسة', 'أرقام تعليمية', 'إحصاءات'],
        en: ['data visualization', 'education statistics', 'research chart'],
      }
    case 'typography':
      return {
        tone: 'symbolic' as const,
        ar: ['خلفية ورق', 'هامش كتاب', 'صفحة أرشيف'],
        en: ['paper texture', 'editorial page', 'archive page'],
      }
    default:
      return {
        tone: 'editorial' as const,
        ar: ['رمز غير مباشر', 'تفكير', 'تأمل', 'قرار'],
        en: ['symbolic editorial image', 'reflection', 'decision moment'],
      }
  }
}

export function buildVisualSearchPlan(text: string, context: string, brief: CreativeBrief, identity: CreativeIdentity): VisualSearchPlan {
  const seeds = visualSeed(brief)
  const headline = truncate(brief.issue || brief.hook || text || 'فكرة بصرية', 12)
  const queries = unique([
    headline,
    brief.hook,
    `${headline} ${brief.audience}`,
    `${headline} ${seeds.ar[0] || ''}`,
    `${truncate(text || '', 8)} ${seeds.ar[1] || ''}`,
    ...(seeds.ar || []),
  ]).slice(0, 6)
  const englishQueries = unique([
    `${headline} ${seeds.en[0] || ''}`,
    `${brief.visualNeed} ${seeds.en[1] || ''}`,
    `${identity.persona} ${seeds.en[2] || ''}`,
    ...seeds.en,
  ]).slice(0, 6)
  const avoidTerms = unique([
    brief.avoid,
    'روبوت يلمس يد إنسان',
    'دماغ مضيء',
    'شبكة رقمية على وجه',
    'طفل أمام شاشة زرقاء',
  ])
  const generationPrompt = [
    `اصنع صورة ${identity.imageRealism === 'documentary' ? 'واقعية وثائقية' : identity.imageRealism === 'abstract' ? 'تجريدية أنيقة' : 'تحريرية راقية'} تخدم الفكرة التالية: ${brief.issue}.`,
    `الشعور المطلوب: ${brief.emotion}.`,
    `الجمهور: ${brief.audience}.`,
    `الحجة البصرية: ${brief.visualReason}.`,
    `الإضاءة: ${identity.lighting}.`,
    `المساحة السلبية: ${identity.negativeSpace}.`,
    `تجنّب: ${brief.avoid}.`,
    'اترك مساحة واضحة للعنوان العربي، ولا تستخدم كليشيهات تقنية مباشرة أو صورًا عامة بلا نقطة تركيز.',
  ].join(' ')
  return {
    headline,
    queries,
    englishQueries,
    avoidTerms,
    generationPrompt,
    rationale: `الأولوية لصورة ${brief.visualNeed === 'data' ? 'تحمل الدليل' : brief.visualNeed === 'human' ? 'إنسانية غير مصطنعة' : 'تحريرية غير مباشرة'} وتترك مساحة للعنوان، مع الابتعاد عن الكليشيهات المستهلكة.`,
    tone: seeds.tone,
  }
}

function stripHtml(value = '') {
  return clean(value.replace(/<[^>]*>/g, ' '))
}

function deriveOrientation(width?: number, height?: number) {
  if (!width || !height) return 'unknown' as const
  if (Math.abs(width - height) <= Math.min(width, height) * 0.08) return 'square' as const
  return width > height ? 'landscape' as const : 'portrait' as const
}

function computeCandidateScore(item: Omit<ExternalVisualResult, 'score' | 'orientation'>, plan: VisualSearchPlan) {
  const haystack = normalize(`${item.title} ${item.description}`)
  const qTerms = unique([...plan.queries, ...plan.englishQueries]).flatMap((entry) => normalize(entry).split(/\s+/)).filter((word) => word.length > 2)
  const matchBoost = qTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 5 : 0), 0)
  const avoidPenalty = plan.avoidTerms.reduce((sum, term) => sum + (haystack.includes(normalize(term)) ? 12 : 0), 0)
  const orientation = deriveOrientation(item.width, item.height)
  let score = 50 + matchBoost - avoidPenalty
  if (orientation === 'landscape') score += 12
  if (orientation === 'square') score += 8
  if (plan.tone === 'documentary' && item.provider === 'pexels') score += 12
  if (plan.tone === 'data' && item.provider === 'wikimedia') score += 10
  if (plan.tone === 'editorial' && item.provider === 'openverse') score += 7
  if (item.provider === 'wikimedia' && /diagram|chart|research|education|teacher|school|university|library/i.test(haystack)) score += 7
  if (item.provider === 'pexels' && /teacher|student|classroom|library|study/i.test(haystack)) score += 7
  return {
    score: Math.max(0, Math.min(99, score)),
    orientation,
  }
}

async function searchWikimedia(query: string, plan: VisualSearchPlan, limit = 8): Promise<ExternalVisualResult[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrsearch', query)
  url.searchParams.set('gsrnamespace', '6')
  url.searchParams.set('gsrlimit', String(Math.max(4, Math.min(limit, 12))))
  url.searchParams.set('prop', 'imageinfo|info')
  url.searchParams.set('iiprop', 'url|extmetadata|size')
  url.searchParams.set('iiurlwidth', '900')
  url.searchParams.set('inprop', 'url')
  const response = await fetch(url.toString())
  if (!response.ok) throw new Error('wikimedia_search_failed')
  const payload = await response.json() as { query?: { pages?: Record<string, any> } }
  const pages = Object.values(payload.query?.pages || {})
  return pages.map((page: any) => {
    const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : undefined
    const meta = info?.extmetadata || {}
    const title = String(page.title || '').replace(/^File:/i, '')
    const base = {
      id: `wikimedia-${page.pageid || title}`,
      provider: 'wikimedia' as const,
      providerLabel: 'Wikimedia Commons',
      title,
      description: stripHtml(meta.ImageDescription?.value || title),
      thumbnailUrl: info?.thumburl || info?.url || '',
      imageUrl: info?.url || info?.thumburl || '',
      pageUrl: page.fullurl || info?.descriptionurl || '',
      author: stripHtml(meta.Artist?.value || meta.Credit?.value || 'غير محدد'),
      license: stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value || 'ترخيص كومنز — راجع الصفحة الأصلية'),
      requiresAttribution: true,
      width: Number(info?.width || 0) || undefined,
      height: Number(info?.height || 0) || undefined,
      rationale: 'مصدر مجاني مفتوح وموثق، مناسب للصور التاريخية والتحريرية والأكاديمية.',
    }
    return { ...base, ...computeCandidateScore(base, plan) }
  }).filter((item) => item.thumbnailUrl && item.imageUrl)
}

async function searchPexels(query: string, plan: VisualSearchPlan, limit = 8): Promise<ExternalVisualResult[]> {
  const apiKey = ((import.meta as any)?.env?.VITE_PEXELS_API_KEY as string | undefined) || PEXELS_FALLBACK_KEY
  if (!apiKey) return []
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(Math.max(4, Math.min(limit, 15))))
  url.searchParams.set('orientation', plan.tone === 'documentary' ? 'landscape' : 'landscape')
  const response = await fetch(url.toString(), { headers: { Authorization: apiKey } })
  if (!response.ok) throw new Error('pexels_search_failed')
  const payload = await response.json() as { photos?: any[] }
  return (payload.photos || []).map((photo) => {
    const base = {
      id: `pexels-${photo.id}`,
      provider: 'pexels' as const,
      providerLabel: 'Pexels',
      title: photo.alt || `Pexels #${photo.id}`,
      description: photo.alt || 'صورة تحريرية مجانية من Pexels.',
      thumbnailUrl: photo.src?.medium || photo.src?.small || photo.src?.large || '',
      imageUrl: photo.src?.large2x || photo.src?.large || photo.src?.original || '',
      pageUrl: photo.url || photo.photographer_url || '',
      author: photo.photographer || 'Pexels',
      license: 'Pexels License',
      requiresAttribution: true,
      width: Number(photo.width || 0) || undefined,
      height: Number(photo.height || 0) || undefined,
      rationale: 'مكتبة مجانية قوية للصور الإنسانية والتحريرية المعاصرة.',
    }
    return { ...base, ...computeCandidateScore(base, plan) }
  }).filter((item) => item.thumbnailUrl && item.imageUrl)
}

async function searchOpenverse(query: string, plan: VisualSearchPlan, limit = 8): Promise<ExternalVisualResult[]> {
  const url = new URL('https://api.openverse.org/v1/images/')
  url.searchParams.set('q', query)
  url.searchParams.set('page_size', String(Math.max(4, Math.min(limit, 14))))
  url.searchParams.set('license_type', 'commercial')
  url.searchParams.set('mature', 'false')
  const response = await fetch(url.toString())
  if (!response.ok) throw new Error('openverse_search_failed')
  const payload = await response.json() as { results?: any[] }
  return (payload.results || []).map((item) => {
    const base = {
      id: `openverse-${item.id || item.url}`,
      provider: 'openverse' as const,
      providerLabel: 'Openverse',
      title: item.title || 'Openverse image',
      description: item.title || item.tags?.slice?.(0, 5)?.join(' · ') || 'صورة مجانية من Openverse.',
      thumbnailUrl: item.thumbnail || item.url || '',
      imageUrl: item.thumbnail || item.url || '',
      pageUrl: item.foreign_landing_url || item.detail_url || item.url || '',
      author: item.creator || 'Openverse',
      license: item.license ? `${String(item.license).toUpperCase()}${item.license_version ? ` ${item.license_version}` : ''}` : 'راجع صفحة المصدر',
      requiresAttribution: true,
      width: Number(item.width || 0) || undefined,
      height: Number(item.height || 0) || undefined,
      rationale: 'مصدر مجاني مفتوح يوسّع الخيارات التحريرية والرمزية عبر مواد مرخّصة.',
    }
    return { ...base, ...computeCandidateScore(base, plan) }
  }).filter((item) => item.thumbnailUrl && item.imageUrl)
}

export async function searchExternalVisualSources(plan: VisualSearchPlan, limit = 10): Promise<ExternalVisualResult[]> {
  const bundle = unique([...plan.queries.slice(0, 3), ...plan.englishQueries.slice(0, 2)]).slice(0, 4)
  const collected: ExternalVisualResult[] = []
  for (const query of bundle) {
    const [wikimedia, pexels, openverse] = await Promise.allSettled([
      searchWikimedia(query, plan, Math.ceil(limit / 2)),
      searchPexels(query, plan, Math.ceil(limit / 2)),
      searchOpenverse(query, plan, Math.ceil(limit / 2)),
    ])
    if (wikimedia.status === 'fulfilled') collected.push(...wikimedia.value)
    if (pexels.status === 'fulfilled') collected.push(...pexels.value)
    if (openverse.status === 'fulfilled') collected.push(...openverse.value)
    if (collected.length >= limit * 3) break
  }
  const deduped = new Map<string, ExternalVisualResult>()
  for (const item of collected) {
    const key = item.imageUrl || item.pageUrl || item.id
    if (!deduped.has(key) || (deduped.get(key)?.score || 0) < item.score) deduped.set(key, item)
  }
  return [...deduped.values()].sort((a, b) => b.score - a.score || a.providerLabel.localeCompare(b.providerLabel)).slice(0, limit)
}
