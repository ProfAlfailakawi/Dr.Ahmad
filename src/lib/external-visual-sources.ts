import type { CreativeBrief, CreativeIdentity } from './creative-director'
import { domainGlossaryPrompt, interpretDrAhmadDomain, type DrAhmadDomainUnderstanding } from './dr-ahmad-domain-glossary'

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
  understanding: DrAhmadDomainUnderstanding
  glossaryConcept?: string
  glossaryLabel?: string
  glossaryMeaning?: string
  glossaryCanonicalEn?: string
  visualScenes: string[]
  preferredWorlds: string[]
  moods: string[]
  literalAnchors: string[]
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

// لا مفتاح محفور في المصدر: يُقرأ من متغيّر بيئة فقط، وإلا يُتخطّى المصدر بأمان (السطر ~306: if (!apiKey) return []).
const PEXELS_FALLBACK_KEY = ((import.meta as any)?.env?.VITE_PEXELS_KEY as string | undefined) || ''

/* نداءات المخازن كانت بلا مهلة إطلاقاً: مزوّد واحد معلّق (أوبنفيرس خاصة)
   يجمّد Promise.allSettled فتبقى «أبحث الآن…» مضاءة للأبد — لقطة الدكتور
   31 يوليو. تسع ثوانٍ سقف أي مزوّد، والبطيء يسقط وحده ويكمل إخوته. */
async function fetchWithDeadline(input: string, init: RequestInit = {}, timeoutMs = 9_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

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
  const understanding = interpretDrAhmadDomain(text, context)
  const seeds = visualSeed(brief)
  const firstRecognized = understanding.recognizedTerms[0]
  const headline = truncate(brief.issue || understanding.primary?.canonicalAr || firstRecognized?.canonicalAr || brief.hook || text || 'فكرة بصرية', 12)
  const glossaryQueries = understanding.recognizedTerms.length ? [
    understanding.primary?.canonicalAr || '',
    understanding.primary?.canonicalEn || '',
    ...(understanding.primary?.aliases.slice(0, 4) || []),
    ...understanding.recognizedTerms.slice(0, 8).flatMap((item) => [item.canonicalAr, item.canonicalEn]),
    ...understanding.visualScenes.slice(0, 4),
    ...understanding.literalAnchors,
    ...(understanding.literalAnchors.length ? understanding.literalAnchors.map((anchor) => `${understanding.primary?.canonicalAr || firstRecognized?.canonicalAr || headline} ${anchor}`) : []),
  ] : []
  const queries = unique([
    ...glossaryQueries,
    headline,
    brief.hook,
    `${headline} ${brief.audience}`,
    `${headline} ${seeds.ar[0] || ''}`,
    `${truncate(text || '', 8)} ${seeds.ar[1] || ''}`,
    ...(seeds.ar || []),
  ]).slice(0, 9)
  const englishQueries = unique([
    understanding.primary?.canonicalEn || firstRecognized?.canonicalEn || '',
    ...(understanding.primary?.aliases.filter((alias) => /[a-z]/i.test(alias)) || []),
    ...understanding.recognizedTerms.slice(0, 8).map((item) => item.canonicalEn),
    `${headline} ${seeds.en[0] || ''}`,
    `${brief.visualNeed} ${seeds.en[1] || ''}`,
    `${identity.persona} ${seeds.en[2] || ''}`,
    ...seeds.en,
  ]).slice(0, 9)
  const avoidTerms = unique([
    brief.avoid,
    ...understanding.avoid,
    'روبوت يلمس يد إنسان',
    'دماغ مضيء',
    'شبكة رقمية على وجه',
    'طفل أمام شاشة زرقاء',
  ])
  const semanticLock = domainGlossaryPrompt(understanding)
  const literalLock = understanding.literalAnchors.length
    ? `MANDATORY VISIBLE SUBJECTS: ${understanding.literalAnchors.join(' + ')}. The image is invalid if any of these subjects disappears or is replaced by a generic classroom, flowers, people with laptops, or an unrelated mood photograph.`
    : ''
  const visualRange = understanding.visualScenes.length
    ? `Choose ONE clearly different visual route from this domain-specific range: ${understanding.visualScenes.slice(0, 6).join(' | ')}.`
    : 'Choose one original visual route that is semantically precise and not a generic stock scene.'
  const emotionalRange = understanding.moods.length
    ? `Emotional direction may be ${understanding.moods.join(', ')}; do not default to sadness, darkness, empty corridors, or lonely classrooms unless the idea explicitly demands it.`
    : 'Do not default to sadness or darkness; let the idea determine the emotional direction.'
  const generationPrompt = [
    literalLock,
    semanticLock,
    `Create a ${identity.imageRealism === 'documentary' ? 'photorealistic documentary' : identity.imageRealism === 'abstract' ? 'elegant conceptual' : 'premium editorial'} image for: ${brief.issue}.`,
    `Audience: ${brief.audience}. Intended emotional effect: ${brief.emotion}.`,
    `Visual argument: ${brief.visualReason}.`,
    visualRange,
    emotionalRange,
    `Lighting preference: ${identity.lighting}. Negative space: ${identity.negativeSpace}.`,
    `Avoid: ${avoidTerms.join(', ')}.`,
    'Every visible object must serve the exact compound meaning. Reject decorative flowers, generic office scenes, random laptop groups, chess, and unrelated stock imagery unless explicitly required by the idea.',
    'Leave a clean text-safe zone for later Arabic typography. Generate no text, letters, numbers, logos, watermarks, or UI screenshots.',
  ].filter(Boolean).join(' ')
  return {
    headline,
    queries,
    englishQueries,
    avoidTerms,
    generationPrompt,
    rationale: understanding.recognizedTerms.length
      ? `فهم الرسم المعرفي ${understanding.recognizedTerms.slice(0, 5).map((item) => `«${item.canonicalAr}»`).join(' + ')} بدرجة ${understanding.confidence}٪، ثم ركّب المعنى المتخصص والسياق والجمهور والغاية بدل الاعتماد على تشابه كلمة واحدة.`
      : `الأولوية لصورة ${brief.visualNeed === 'data' ? 'تحمل الدليل' : brief.visualNeed === 'human' ? 'إنسانية غير مصطنعة' : 'تحريرية غير مباشرة'} وتترك مساحة للعنوان، مع الابتعاد عن الكليشيهات المستهلكة.`,
    tone: understanding.moods.includes('human') ? 'documentary' : understanding.moods.includes('data') || understanding.moods.includes('academic') ? 'data' : seeds.tone,
    understanding,
    glossaryConcept: understanding.primary?.id || (understanding.recognizedTerms.length ? `compound-${understanding.recognizedTerms.slice(0, 5).map((item) => item.id).join('-')}` : undefined),
    glossaryLabel: understanding.primary?.canonicalAr || understanding.recognizedTerms.slice(0, 4).map((item) => item.canonicalAr).join(' + '),
    glossaryCanonicalEn: understanding.primary?.canonicalEn || understanding.recognizedTerms.slice(0, 4).map((item) => item.canonicalEn).filter(Boolean).join(' + '),
    glossaryMeaning: understanding.compoundMeaning || understanding.primary?.meaningAr,
    visualScenes: understanding.visualScenes,
    preferredWorlds: understanding.preferredWorlds,
    moods: understanding.moods,
    literalAnchors: understanding.literalAnchors,
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

/* كلماتٌ تصف الحقل كله ولا تدلّ على الفكرة: مطابقتها لا تعني صلةً بالنص.
   وجودها في التسجيل هو ما جعل صورةً عامّةً «فصل دراسي» تجتاز بوابة الترشيح
   لفكرةٍ عن التلعيب أو التقويم أو الذكاء الاصطناعي. */
const GENERIC_MATCH_TOKENS = new Set([
  'education', 'educational', 'learning', 'teaching', 'teacher', 'student', 'students', 'school', 'schools',
  'classroom', 'class', 'university', 'college', 'study', 'studying', 'knowledge', 'training', 'course',
  'child', 'children', 'kids', 'people', 'person', 'man', 'woman', 'group', 'team', 'work', 'working',
  'photo', 'image', 'picture', 'background', 'concept', 'abstract', 'modern', 'business', 'office',
  'التعليم', 'تعليم', 'تعليمي', 'التعلم', 'تعلم', 'المعرفة', 'معرفة', 'المدرسة', 'مدرسة', 'الطالب', 'طالب',
  'الطلاب', 'المعلم', 'معلم', 'الجامعة', 'جامعة', 'الصف', 'صورة', 'مشهد', 'فكرة', 'الفكرة',
])

function computeCandidateScore(item: Omit<ExternalVisualResult, 'score' | 'orientation'>, plan: VisualSearchPlan) {
  const haystack = normalize(`${item.title} ${item.description}`)
  /* جذر «الصورة ما لها علاقة بالكلام»: الكلمات كانت تُجمع من تسع عباراتٍ بلا
     تفريدٍ على مستوى الكلمة، فكلمة «education» المتكررة في خمس عبارات تمنح
     25 نقطة وحدها. الآن: تفريدٌ بالكلمة، إسقاطٌ للكلمات العامة، وسقفٌ للمكافأة. */
  const qTerms = [...new Set(
    unique([...plan.queries, ...plan.englishQueries])
      .flatMap((entry) => normalize(entry).split(/\s+/))
      .filter((word) => word.length > 2 && !GENERIC_MATCH_TOKENS.has(word)),
  )]
  const matchBoost = Math.min(20, qTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 5 : 0), 0))
  const avoidPenalty = plan.avoidTerms.reduce((sum, term) => sum + (haystack.includes(normalize(term)) ? 12 : 0), 0)
  const conceptTerms = unique([
    plan.glossaryLabel || '',
    plan.glossaryCanonicalEn || '',
    ...plan.understanding.recognizedTerms.slice(0, 6).flatMap((item) => [item.canonicalAr, item.canonicalEn]),
  ]).map(normalize).filter(Boolean)
  const conceptHits = conceptTerms.filter((term) => {
    const tokens = term.split(/\s+/).filter((word) => word.length > 2)
    return tokens.length > 0 && tokens.some((token) => haystack.includes(token))
  }).length
  const primaryConceptMissing = conceptTerms.length > 0 && conceptHits === 0
  const literalTokens = unique(plan.literalAnchors.flatMap((anchor) => normalize(anchor).split(/\s+/))).filter((word) => word.length > 2)
  const literalHits = literalTokens.filter((token) => haystack.includes(token)).length
  const literalCoverage = literalTokens.length ? literalHits / literalTokens.length : 1
  const orientation = deriveOrientation(item.width, item.height)
  const smallestSide = Math.min(Number(item.width || 0), Number(item.height || 0))
  const genericStock = /generic|stock photo|business team|office meeting|people (?:using|with) laptop|smiling (?:student|people|team)/i.test(haystack)
  let score = 44 + matchBoost + conceptHits * 12 + Math.round(literalCoverage * 18) - avoidPenalty
  /* حين يفهم المعجم مفهوماً أساسياً ولا يحمله وصف الصورة، لا يكفي خصمٌ يمكن
     تعويضه بجودة الصورة واتجاهها؛ نسقّف النتيجة تحت عتبة القبول (70) فيُستبعد
     المرشح بدل أن يُركَّب على التصميم خطأً. الصمت أصدق من صورة لا صلة لها. */
  if (primaryConceptMissing) score = Math.min(score - 38, 58)
  if (literalTokens.length >= 2 && literalCoverage < .34) score = Math.min(score - 22, 62)
  if (genericStock) score -= 26
  if (smallestSide > 0 && smallestSide < 720) score -= 24
  else if (smallestSide >= 1200) score += 8
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
  const response = await fetchWithDeadline(url.toString())
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
  const response = await fetchWithDeadline(url.toString(), { headers: { Authorization: apiKey } })
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
  const response = await fetchWithDeadline(url.toString())
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
  /* مخازن الصور العالمية تفهرس أوصافها بالإنجليزية غالباً. البدء بالعبارة
     العربية كان يملأ المجموعة بنتائج عامة قبل بلوغ الاستعلام الدلالي الإنجليزي. */
  const latinQuery = (value: string) => clean(value)
    .replace(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const englishFirst = unique([
    ...plan.englishQueries.map(latinQuery),
    ...plan.queries.map(latinQuery),
  ]).filter((query) => query.length >= 3)
  const bundle = unique([
    ...englishFirst.slice(0, 4),
    ...plan.queries.slice(0, 2),
  ]).slice(0, 5)
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
    if (collected.filter((item) => item.score >= 70).length >= limit * 2) break
  }
  const deduped = new Map<string, ExternalVisualResult>()
  for (const item of collected) {
    const key = item.imageUrl || item.pageUrl || item.id
    if (!deduped.has(key) || (deduped.get(key)?.score || 0) < item.score) deduped.set(key, item)
  }
  /* لا نعرض صورة جاهزة لمجرد أنها جميلة أو قريبة من كلمة عامة. المرشح الذي
     لا يحمل المفهوم الأساسي في وصفه يُستبعد بدل أن يُركّب على التصميم خطأً.
     لكن عتبة السبعين وحدها كانت تُجوّع الأفكار المجردة حتى الصفر (خصم -38
     لغياب المصطلح الأكاديمي من أوصاف المخازن) فيموت المسار كله — لقطة
     31 يوليو. الحل تدرّج صادق: الصارم أولاً، فإن جاع نزلنا لمطابقة مرنة
     معلنة في مبررها بدل يدين فارغتين. */
  const pool = [...deduped.values()]
    .sort((a, b) => b.score - a.score || a.providerLabel.localeCompare(b.providerLabel))
  const strict = pool.filter((item) => item.score >= 70)
  if (strict.length >= Math.min(3, limit)) return strict.slice(0, limit)
  const flexible = pool
    .filter((item) => item.score >= 52)
    .map((item) => ({
      ...item,
      rationale: `${item.rationale} (مطابقة مرنة: المفهوم مجرد ولا يظهر حرفياً في أوصاف المخازن — رُشحت الأقرب بصرياً وترتيبها بالدرجة.)`,
    }))
  return [...strict, ...flexible.filter((item) => !strict.some((top) => top.id === item.id))].slice(0, limit)
}
