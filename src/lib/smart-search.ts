import {
  DR_AHMAD_DOMAIN_FACETS,
  DR_AHMAD_DOMAIN_GLOSSARY,
  normalizeDomainTerm,
  type DomainFacet,
  type DrAhmadDomainUnderstanding,
  type DrAhmadGlossaryEntry,
  type RecognizedDomainTerm,
} from './dr-ahmad-domain-glossary.ts'

export type SmartQueryPlan = {
  original: string
  normalized: string
  coreText: string
  directRoots: string[]
  semanticRoots: string[]
  weightedRoots: Map<string, number>
  phrases: string[]
  semanticText: string
  interpretation: string
  suggestions: string[]
  understanding: DrAhmadDomainUnderstanding
}

export type SmartSearchField = {
  value?: string | null
  weight?: number
  phraseWeight?: number
  exactWeight?: number
}

const QUERY_WRAPPERS = new Set([
  'ابي', 'ابغى', 'ابغي', 'اريد', 'أريد', 'ودي', 'حاب', 'حابه', 'احتاج', 'أحتاج',
  'عطني', 'اعطني', 'أعطني', 'ورني', 'وريني', 'قل', 'قولي', 'قولوا', 'ابحث', 'إبحث',
  'شنو', 'وش', 'ايش', 'إيش', 'ماذا', 'ماهو', 'ماهي', 'ما', 'هل', 'كيف', 'ليش', 'لماذا',
  'عن', 'حول', 'في', 'من', 'على', 'الى', 'إلى', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
  'الكتاب', 'كتاب', 'المقال', 'مقال', 'البحث', 'بحث', 'الدكتور', 'دكتور', 'احمد', 'أحمد',
  'الفيلكاوي', 'يقول', 'قال', 'يتكلم', 'تكلم', 'يتحدث', 'موضوع', 'فكره', 'فكرة', 'شي', 'شيء',
])

const SEARCH_STOP = new Set([
  ...QUERY_WRAPPERS,
  'او', 'أو', 'ثم', 'قد', 'كان', 'كانت', 'يكون', 'تكون', 'هو', 'هي', 'هم', 'هن',
  'الذي', 'التي', 'الذين', 'اللاتي', 'كل', 'بعض', 'غير', 'بين', 'بعد', 'قبل', 'عند',
  'ضمن', 'نحو', 'لدي', 'لديه', 'عندي', 'عندنا', 'جدا', 'جداً', 'مره', 'مرة',
])

const BROKEN_PLURALS: Record<string, string> = {
  اطفال: 'طفل', ابناء: 'ابن', عيال: 'طفل', مدارس: 'مدرسه', معلمين: 'معلم', معلمون: 'معلم',
  مدرسين: 'مدرس', طلاب: 'طالب', طلبه: 'طالب', كتب: 'كتاب', العاب: 'لعب', الالعاب: 'لعب',
  خصائص: 'خاصيه', صفات: 'صفه', سمات: 'سمه', مفاهيم: 'مفهوم', مناهج: 'منهج',
  اجهزه: 'جهاز', اجهزة: 'جهاز', شاشات: 'شاشه', مهارات: 'مهاره', اهداف: 'هدف',
  ادوات: 'اداه', بيئات: 'بيئه', فصول: 'فصل', ابحاث: 'بحث', بحوث: 'بحث', دراسات: 'دراسه',
  مشكلات: 'مشكله', تحديات: 'تحدي', معوقات: 'عائق', نتائج: 'نتيجه', تاثيرات: 'تاثير', فوائد: 'فائده', فايده: 'فائده',
  تطبيقات: 'تطبيق', استخدامات: 'استخدام', استراتيجيات: 'استراتيجيه', نظريات: 'نظريه',
  وسائل: 'وسيله', وسايل: 'وسيله', لقاءات: 'لقاء', حلقات: 'حلقه', هواتف: 'هاتف', جوالات: 'هاتف', نحمي: 'حمايه', احمي: 'حمايه', يحمي: 'حمايه', حمايه: 'حمايه',
}

const SEMANTIC_FAMILIES = [
  ['صفه', 'خاصيه', 'سمه', 'ملمح', 'خصله', 'مميز'],
  ['اثر', 'تاثير', 'نتيجه', 'انعكاس', 'مردود', 'فائده', 'ايجابيه'],
  ['سبب', 'دافع', 'عامل', 'مبرر', 'خلفيه'],
  ['مشكله', 'تحدي', 'عائق', 'معوق', 'صعوبه', 'مخاطر'],
  ['حمايه', 'وقايه', 'سلامه', 'امن', 'خصوصيه', 'حد'],
  ['حل', 'معالجه', 'اقتراح', 'توصيه', 'بديل', 'اجراء'],
  ['استخدام', 'توظيف', 'تطبيق', 'ممارسه', 'تنفيذ'],
  ['تعريف', 'مفهوم', 'معني', 'مقصود', 'ماهية'],
  ['فرق', 'مقارنه', 'تمييز', 'اختلاف', 'تشابه'],
  ['دور', 'وظيفه', 'مساهمه', 'مسؤوليه', 'مهمه'],
  ['طفل', 'ابن', 'ناشئ', 'صغير'],
  ['معلم', 'مدرس', 'استاذ', 'مربي'],
  ['طالب', 'متعلم', 'دارس'],
  ['لعب', 'لعبه', 'العاب', 'تلاعب'],
  ['تعليم', 'تعلم', 'تدريس', 'تربيه'],
  ['رقمي', 'الكتروني', 'تقني', 'تكنولوجي'],
  ['ذكاء', 'ذكي', 'اصطناعي', 'خوارزمي'],
  ['قياس', 'تقويم', 'تقييم', 'اختبار'],
  ['اداره', 'حوكمه', 'قياده', 'قرار'],
  ['ابداع', 'ابتكار', 'تجديد', 'اختراع'],
  ['تحفيز', 'دافعيه', 'تشجيع', 'حافز'],
  ['تفاعل', 'مشاركه', 'اندماج', 'انخراط'],
] as const

const familyByRoot = new Map<string, readonly string[]>()
for (const family of SEMANTIC_FAMILIES) for (const root of family) familyByRoot.set(root, family)

const CACHE_LIMIT = 9000
const textCache = new Map<string, { normalized: string; roots: string[]; rootSet: Set<string> }>()
const queryPlanCache = new Map<string, SmartQueryPlan>()

export function normalizeSmartArabic(value = '') {
  return normalizeDomainTerm(value)
    .replace(/\b(?:د\.?\s*احمد|دكتور\s+احمد)\b/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function smartRootWord(value = '') {
  let word = normalizeSmartArabic(value).replace(/\s+/g, '')
  if (!word) return ''

  /* الجموع غير القياسية وبعض التراكيب الشائعة تُحسم قبل نزع اللواحق؛
     وإلا تحولت «صفات» مثلاً إلى «صف» وضاعت دلالتها. */
  if (BROKEN_PLURALS[word]) return BROKEN_PLURALS[word]

  if (word.startsWith('و') && (BROKEN_PLURALS[word.slice(1)] || word.slice(1).startsWith('ال'))) word = word.slice(1)
  if (word.startsWith('ف') && word.slice(1).startsWith('ال')) word = word.slice(1)

  word = word
    .replace(/^(?:وال|فال|بال|كال)(?=.{3,})/u, '')
    .replace(/^لل(?=.{3,})/u, '')
    .replace(/^ل(?=ل.{2,})/u, '')
    .replace(/^ال(?=.{3,})/u, '')

  if (BROKEN_PLURALS[word]) return BROKEN_PLURALS[word]

  word = word
    .replace(/(?:كما|هما|كم|كن|نا|ها|هم|هن)$/u, '')
    .replace(/(?:يات|ات|ون|ين|ان|يه|ية)$/u, '')
    .replace(/ه$/u, (match, offset, full) => (full.length > 4 ? '' : match))
  return BROKEN_PLURALS[word] || word
}

export function smartRoots(value = '', includeStop = false) {
  const output: string[] = []
  const seen = new Set<string>()
  for (const token of normalizeSmartArabic(value).split(/\s+/)) {
    if (!token || (!includeStop && SEARCH_STOP.has(token))) continue
    const root = smartRootWord(token)
    if (root.length < 2 || (!includeStop && SEARCH_STOP.has(root)) || seen.has(root)) continue
    seen.add(root)
    output.push(root)
  }
  return output
}

function textIndex(value = '') {
  const key = String(value || '')
  const cached = textCache.get(key)
  if (cached) return cached
  const normalized = normalizeSmartArabic(key)
  const roots = smartRoots(normalized)
  const indexed = { normalized, roots, rootSet: new Set(roots) }
  if (textCache.size >= CACHE_LIMIT) {
    const first = textCache.keys().next().value
    if (first !== undefined) textCache.delete(first)
  }
  textCache.set(key, indexed)
  return indexed
}

function addWeighted(map: Map<string, number>, value: string, weight: number) {
  for (const root of smartRoots(value)) map.set(root, Math.max(map.get(root) || 0, weight))
}

type DomainIndex = {
  conceptsByRoot: Map<string, Set<DrAhmadGlossaryEntry>>
  facetsByRoot: Map<string, Set<DomainFacet>>
}

let domainIndexCache: DomainIndex | null = null

function domainIndex(): DomainIndex {
  if (domainIndexCache) return domainIndexCache
  const conceptsByRoot = new Map<string, Set<DrAhmadGlossaryEntry>>()
  const facetsByRoot = new Map<string, Set<DomainFacet>>()
  const add = <T,>(map: Map<string, Set<T>>, root: string, value: T) => {
    if (root.length < 2) return
    const bucket = map.get(root) || new Set<T>()
    bucket.add(value)
    map.set(root, bucket)
  }
  for (const entry of DR_AHMAD_DOMAIN_GLOSSARY) {
    for (const root of new Set(smartRoots([entry.canonicalAr, ...entry.aliases].join(' ')))) add(conceptsByRoot, root, entry)
  }
  for (const facet of DR_AHMAD_DOMAIN_FACETS) {
    for (const root of new Set(smartRoots([facet.canonicalAr, ...facet.aliases].join(' ')))) add(facetsByRoot, root, facet)
  }
  domainIndexCache = { conceptsByRoot, facetsByRoot }
  return domainIndexCache
}

function quickDomainScore(queryNormalized: string, queryRoots: string[], canonicalAr: string, aliases: string[]) {
  const candidates = [canonicalAr, ...aliases]
  const querySet = new Set(queryRoots)
  let best = 0
  let matchedAlias = canonicalAr
  for (const candidate of candidates) {
    const normalized = normalizeSmartArabic(candidate)
    if (!normalized) continue
    let score = 0
    if (queryNormalized === normalized) score = 150
    else if (normalized.includes(' ') && ` ${queryNormalized} `.includes(` ${normalized} `)) score = 118
    const roots = smartRoots(normalized)
    if (roots.length) {
      const overlap = roots.filter((root) => querySet.has(root)).length
      if (overlap) {
        const precision = overlap / roots.length
        const recall = overlap / Math.max(1, queryRoots.length)
        score = Math.max(score, 42 + precision * 42 + recall * 24 + Math.min(18, overlap * 5))
      }
    }
    if (score > best) { best = score; matchedAlias = candidate }
  }
  return { score: best, matchedAlias }
}

function quickDomainUnderstanding(input: string): DrAhmadDomainUnderstanding {
  const normalized = normalizeSmartArabic(input)
  const roots = smartRoots(normalized)
  const empty: DrAhmadDomainUnderstanding = {
    primary: null,
    matches: [],
    confidence: 0,
    recognizedFrom: '',
    expandedContext: '',
    compoundMeaning: '',
    recognizedTerms: [],
    visualScenes: [],
    avoid: [],
    moods: [],
    preferredWorlds: [],
    literalAnchors: [],
    conceptCapacity: DR_AHMAD_DOMAIN_GLOSSARY.length,
  }
  if (!normalized || !roots.length) return empty

  const index = domainIndex()
  const conceptCandidates = new Set<DrAhmadGlossaryEntry>()
  const facetCandidates = new Set<DomainFacet>()
  for (const root of roots) {
    for (const entry of index.conceptsByRoot.get(root) || []) conceptCandidates.add(entry)
    for (const facet of index.facetsByRoot.get(root) || []) facetCandidates.add(facet)
  }

  const concepts = [...conceptCandidates]
    .map((entry) => ({ entry, ...quickDomainScore(normalized, roots, entry.canonicalAr, entry.aliases) }))
    .filter((row) => row.score >= 72)
    .sort((left, right) => right.score - left.score)
  const facets = [...facetCandidates]
    .map((facet) => ({ facet, ...quickDomainScore(normalized, roots, facet.canonicalAr, facet.aliases) }))
    .filter((row) => row.score >= 76)
    .sort((left, right) => right.score - left.score)

  const primary = concepts[0]?.entry || null
  const matches = concepts.slice(0, 6).map((row) => row.entry)
  const recognizedTerms: RecognizedDomainTerm[] = [
    ...concepts.slice(0, 6).map((row) => ({ id: row.entry.id, kind: 'concept' as const, canonicalAr: row.entry.canonicalAr, canonicalEn: row.entry.canonicalEn, score: Math.round(row.score), matchedAlias: row.matchedAlias })),
    ...facets.slice(0, 8).map((row) => ({ id: row.facet.id, kind: row.facet.kind, canonicalAr: row.facet.canonicalAr, canonicalEn: row.facet.canonicalEn, score: Math.round(row.score), matchedAlias: row.matchedAlias })),
  ]
  if (!primary && !recognizedTerms.length) return empty

  const compoundMeaning = [
    primary?.meaningAr || '',
    ...facets.slice(0, 4).map((row) => row.facet.meaningAr),
  ].filter(Boolean).join(' ')
  return {
    primary,
    matches,
    confidence: Math.min(99, Math.round(Math.max(concepts[0]?.score || 0, facets[0]?.score || 0))),
    recognizedFrom: recognizedTerms.slice(0, 6).map((term) => term.canonicalAr).join(' · '),
    expandedContext: compoundMeaning,
    compoundMeaning,
    recognizedTerms,
    visualScenes: [...new Set([...(primary?.visualScenes || []), ...facets.map((row) => row.facet.visualHint || '').filter(Boolean)])].slice(0, 8),
    avoid: primary?.avoid || [],
    moods: [...new Set([...(primary?.moods || []), ...facets.flatMap((row) => row.facet.moods || [])])].slice(0, 10),
    preferredWorlds: [...new Set([...(primary?.preferredWorlds || []), ...facets.flatMap((row) => row.facet.preferredWorlds || [])])].slice(0, 10),
    literalAnchors: [],
    conceptCapacity: DR_AHMAD_DOMAIN_GLOSSARY.length,
  }
}

function phraseVariants(query: string, coreText: string, understanding: DrAhmadDomainUnderstanding) {
  const values = new Set<string>()
  const add = (value = '') => {
    const normalized = normalizeSmartArabic(value)
    if (normalized.length >= 4) values.add(normalized)
  }
  add(query)
  add(coreText)
  add(understanding.primary?.canonicalAr || '')
  for (const item of understanding.matches.slice(0, 4)) add(item.canonicalAr)
  for (const item of understanding.recognizedTerms.slice(0, 6)) add(item.canonicalAr)
  return [...values].sort((left, right) => right.length - left.length).slice(0, 8)
}

function compactCoreText(query: string) {
  const normalized = normalizeSmartArabic(query)
  const tokens = normalized.split(/\s+/).filter(Boolean)
  const kept = tokens.filter((token) => !QUERY_WRAPPERS.has(token))
  return (kept.length ? kept : tokens).join(' ').trim()
}

function querySuggestions(coreText: string, understanding: DrAhmadDomainUnderstanding) {
  const focus = understanding.primary?.canonicalAr
    || understanding.recognizedTerms.find((item) => item.kind === 'concept')?.canonicalAr
    || coreText
  if (!focus) return []
  const candidates = [
    `ما المقصود بـ«${focus}» في مؤلفات الدكتور؟`,
    `ما أبرز الأفكار والتطبيقات المرتبطة بـ«${focus}»؟`,
    `ما التحديات والنتائج التي يناقشها الأرشيف حول «${focus}»؟`,
    `كيف تطورت معالجة «${focus}» بين الكتب والمقالات والأبحاث واللقاءات؟`,
  ]
  const normalizedCore = normalizeSmartArabic(coreText)
  return candidates.filter((item) => normalizeSmartArabic(item) !== normalizedCore).slice(0, 4)
}

function credibleGlossaryEntry(entry: { canonicalAr: string; aliases: string[] }, coreText: string, directRoots: string[]) {
  const normalizedCore = normalizeSmartArabic(coreText)
  const paddedCore = ` ${normalizedCore} `
  const candidates = [entry.canonicalAr, ...entry.aliases]
    .map((value) => normalizeSmartArabic(value))
    .filter((value) => value.length >= 3)

  if (candidates.some((candidate) => normalizedCore === candidate || (candidate.includes(' ') && paddedCore.includes(` ${candidate} `)))) return true

  const direct = new Set(directRoots)
  for (const candidate of candidates) {
    const roots = smartRoots(candidate)
    if (!roots.length) continue
    const overlap = roots.filter((root) => direct.has(root)).length
    if (roots.length === 1 && directRoots.length === 1 && overlap === 1) return true
    if (overlap >= 2 && overlap / roots.length >= .6) return true
  }
  return false
}

function credibleRecognizedTerm(term: DrAhmadDomainUnderstanding['recognizedTerms'][number], coreText: string, directRoots: string[]) {
  const normalizedCore = normalizeSmartArabic(coreText)
  const alias = normalizeSmartArabic(term.matchedAlias || term.canonicalAr)
  if (!alias) return false
  if (normalizedCore === alias || ` ${normalizedCore} `.includes(` ${alias} `)) return true
  const aliasRoots = smartRoots(alias)
  if (!aliasRoots.length) return false
  const direct = new Set(directRoots)
  const overlap = aliasRoots.filter((root) => direct.has(root)).length
  if (aliasRoots.length === 1) return overlap === 1 && normalizeSmartArabic(coreText).split(' ').includes(alias)
  return overlap >= 2 && overlap / aliasRoots.length >= .6
}

export function buildSmartQueryPlan(query: string): SmartQueryPlan {
  const original = String(query || '').trim()
  const cacheKey = normalizeSmartArabic(original)
  const cached = queryPlanCache.get(cacheKey)
  if (cached) return cached
  const normalized = normalizeSmartArabic(original)
  const coreText = compactCoreText(original)
  const understanding = quickDomainUnderstanding(original)
  const directRoots = smartRoots(coreText || original)
  const trustedPrimary = understanding.primary && credibleGlossaryEntry(understanding.primary, coreText || original, directRoots)
    ? understanding.primary
    : null
  const trustedMatches = understanding.matches.filter((entry) => credibleGlossaryEntry(entry, coreText || original, directRoots))
  const trustedRecognizedTerms = understanding.recognizedTerms.filter((term) => credibleRecognizedTerm(term, coreText || original, directRoots))
  const hasTrustedDomain = Boolean(trustedPrimary || trustedMatches.length || trustedRecognizedTerms.length)
  const trustedUnderstanding: DrAhmadDomainUnderstanding = {
    ...understanding,
    primary: trustedPrimary,
    matches: trustedMatches,
    recognizedTerms: trustedRecognizedTerms,
    confidence: hasTrustedDomain ? understanding.confidence : 0,
    recognizedFrom: hasTrustedDomain ? understanding.recognizedFrom : '',
    expandedContext: hasTrustedDomain ? understanding.expandedContext : '',
    compoundMeaning: hasTrustedDomain ? understanding.compoundMeaning : '',
    visualScenes: hasTrustedDomain ? understanding.visualScenes : [],
    avoid: hasTrustedDomain ? understanding.avoid : [],
    moods: hasTrustedDomain ? understanding.moods : [],
    preferredWorlds: hasTrustedDomain ? understanding.preferredWorlds : [],
  }
  const weightedRoots = new Map<string, number>()

  addWeighted(weightedRoots, coreText || original, 9)
  addWeighted(weightedRoots, original, 8)

  for (const root of [...weightedRoots.keys()]) {
    const family = familyByRoot.get(root)
    if (family) for (const related of family) weightedRoots.set(related, Math.max(weightedRoots.get(related) || 0, 4.8))
  }

  if (trustedPrimary && understanding.confidence >= 36) {
    addWeighted(weightedRoots, trustedPrimary.canonicalAr, 7.5)
    addWeighted(weightedRoots, trustedPrimary.canonicalEn, 4)
    for (const alias of trustedPrimary.aliases.slice(0, 18)) addWeighted(weightedRoots, alias, 5.5)
    addWeighted(weightedRoots, trustedPrimary.meaningAr, 2.4)
  }

  for (const match of trustedMatches.slice(0, 5)) {
    addWeighted(weightedRoots, match.canonicalAr, 5.2)
    for (const alias of match.aliases.slice(0, 8)) addWeighted(weightedRoots, alias, 3.6)
    addWeighted(weightedRoots, match.meaningAr, 1.5)
  }

  for (const term of trustedRecognizedTerms.slice(0, 10)) addWeighted(weightedRoots, term.canonicalAr, term.kind === 'concept' ? 5.5 : 3.2)
  for (const anchor of understanding.literalAnchors) addWeighted(weightedRoots, anchor, 6)

  const directSet = new Set(directRoots)
  const semanticRoots = [...weightedRoots.keys()].filter((root) => !directSet.has(root))
  const phrases = phraseVariants(original, coreText, trustedUnderstanding)
  const semanticParts = [
    original,
    coreText,
    trustedPrimary?.canonicalAr || '',
    ...trustedMatches.slice(0, 4).map((item) => item.canonicalAr),
    ...trustedRecognizedTerms.slice(0, 8).map((item) => item.canonicalAr),
    ...understanding.literalAnchors,
  ].filter(Boolean)
  const semanticText = [...new Set(semanticParts)].join(' ')

  const recognized = trustedRecognizedTerms.slice(0, 4).map((item) => item.canonicalAr)
  const interpretation = trustedPrimary && understanding.confidence >= 36
    ? `المعنى الأقرب: ${trustedPrimary.canonicalAr}${recognized.length > 1 ? `، مع صلة بـ${recognized.slice(1).join(' و')}` : ''}.`
    : coreText
      ? `أبحث عن معنى «${coreText}».`
      : ''

  const result: SmartQueryPlan = {
    original,
    normalized,
    coreText,
    directRoots,
    semanticRoots,
    weightedRoots,
    phrases,
    semanticText,
    interpretation,
    suggestions: querySuggestions(coreText, trustedUnderstanding),
    understanding: trustedUnderstanding,
  }
  if (queryPlanCache.size >= 160) {
    const first = queryPlanCache.keys().next().value
    if (first !== undefined) queryPlanCache.delete(first)
  }
  queryPlanCache.set(cacheKey, result)
  return result
}

export function extendSmartQueryPlan(base: SmartQueryPlan, extraText: string): SmartQueryPlan {
  const extraRoots = smartRoots(extraText)
  if (!extraRoots.length) return base
  const weightedRoots = new Map(base.weightedRoots)
  for (const root of extraRoots) weightedRoots.set(root, Math.max(weightedRoots.get(root) || 0, 4.2))
  const directSet = new Set(base.directRoots)
  return {
    ...base,
    semanticRoots: [...new Set([...base.semanticRoots, ...extraRoots.filter((root) => !directSet.has(root))])],
    weightedRoots,
    phrases: [...new Set([...base.phrases, normalizeSmartArabic(extraText)])].filter((value) => value.length >= 4).slice(0, 10),
    semanticText: `${base.semanticText} ${extraText}`.trim(),
  }
}

function boundedEditDistance(left: string, right: string, maximum: number) {
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    let rowBest = current[0]
    for (let j = 1; j <= right.length; j += 1) {
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      current[j] = value
      rowBest = Math.min(rowBest, value)
    }
    if (rowBest > maximum) return maximum + 1
    for (let j = 0; j < current.length; j += 1) previous[j] = current[j]
  }
  return previous[right.length]
}

function fuzzyContains(needle: string, haystack: string[]) {
  if (needle.length < 4) return false
  const maximum = needle.length >= 8 ? 2 : 1
  return haystack.some((candidate) => Math.abs(candidate.length - needle.length) <= maximum && boundedEditDistance(needle, candidate, maximum) <= maximum)
}

export function scoreSmartFields(plan: SmartQueryPlan, fields: SmartSearchField[]) {
  if (!plan.directRoots.length && !plan.semanticRoots.length) return 0
  let score = 0
  const matchedDirect = new Set<string>()
  const matchedSemantic = new Set<string>()

  for (const field of fields) {
    const value = String(field.value || '').trim()
    if (!value) continue
    const weight = field.weight ?? 1
    const phraseWeight = field.phraseWeight ?? 1
    const exactWeight = field.exactWeight ?? 1
    const indexed = textIndex(value)

    if (plan.normalized && indexed.normalized === plan.normalized) score += 54 * weight * exactWeight
    else if (plan.coreText && indexed.normalized.includes(normalizeSmartArabic(plan.coreText))) score += 24 * weight * exactWeight

    for (const phrase of plan.phrases) {
      if (phrase.length < 4) continue
      if (indexed.normalized.includes(phrase)) score += Math.min(34, 10 + phrase.length * .55) * weight * phraseWeight
    }

    const allowFuzzy = indexed.roots.length <= 56 || weight >= 3
    for (const root of plan.directRoots) {
      if (indexed.rootSet.has(root)) {
        matchedDirect.add(root)
        score += (plan.weightedRoots.get(root) || 8) * weight
      } else if (allowFuzzy && fuzzyContains(root, indexed.roots)) {
        /* التصحيح التقريبي مفيد في العناوين والحقول القصيرة، لكنه مكلف وغير
           دقيق في متن طويل؛ لذلك لا نمسح مئات كلمات كل فقرة بحثاً عن خطأ. */
        score += (plan.weightedRoots.get(root) || 8) * weight * .34
      }
    }

    for (const root of plan.semanticRoots) {
      if (!indexed.rootSet.has(root)) continue
      const repeated = matchedSemantic.has(root)
      matchedSemantic.add(root)
      /* المرادف يفتح الباب ولا يطغى على كلمات الزائر. تكراره في الوصف
         والسؤال والملخص لا يتحول إلى مئات النقاط. */
      score += (plan.weightedRoots.get(root) || 2) * weight * (repeated ? .07 : .58)
    }

    if (plan.directRoots.length > 1) {
      const ordered = plan.directRoots.join(' ')
      const fieldRoots = indexed.roots.join(' ')
      if (fieldRoots.includes(ordered)) score += 18 * weight
    }
  }

  if (matchedDirect.size) {
    const coverage = matchedDirect.size / Math.max(1, plan.directRoots.length)
    score += coverage * 24
    if (coverage >= .99) score += 18
    else if (coverage >= .66) score += 9
  }
  score += Math.min(12, matchedSemantic.size * 1.2)
  return Number(score.toFixed(3))
}

export function smartQueryConfidence(plan: SmartQueryPlan) {
  if (!plan.original) return 0
  const domain = plan.understanding.confidence
  const direct = Math.min(60, plan.directRoots.length * 14)
  return Math.min(99, Math.max(direct, Math.round(domain * .82)))
}

export function diversifySmartRows<T extends { kind: string; score: number }>(rows: T[], limit = rows.length) {
  const sorted = rows.slice().sort((left, right) => right.score - left.score)
  const groups = new Map<string, number>()
  const first: T[] = []
  const rest: T[] = []
  const groupOf = (kind: string) => kind === 'passage' || kind === 'book' ? 'book' : kind

  for (const row of sorted) {
    const group = groupOf(row.kind)
    const used = groups.get(group) || 0
    if (used < 3) {
      groups.set(group, used + 1)
      first.push(row)
    } else rest.push(row)
  }

  const topByGroup = new Map<string, T>()
  for (const row of sorted) {
    const group = groupOf(row.kind)
    if (!topByGroup.has(group)) topByGroup.set(group, row)
  }
  const seeded = [...topByGroup.values()].sort((left, right) => right.score - left.score)
  const merged: T[] = []
  const seen = new Set<T>()
  for (const row of [...seeded, ...first, ...rest]) {
    if (seen.has(row)) continue
    seen.add(row)
    merged.push(row)
    if (merged.length >= limit) break
  }
  return merged
}

export function suggestedDomainTerms(plan: SmartQueryPlan, limit = 6) {
  const values = [
    ...plan.understanding.matches.map((item) => item.canonicalAr),
    ...plan.understanding.recognizedTerms.map((item) => item.canonicalAr),
  ]
  const seen = new Set<string>()
  return values.filter((value) => {
    const normalized = normalizeSmartArabic(value)
    if (!normalized || normalized === plan.normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  }).slice(0, limit)
}

export const smartSearchGlossaryCoverage = {
  concepts: DR_AHMAD_DOMAIN_GLOSSARY.length,
  facets: DR_AHMAD_DOMAIN_FACETS.length,
}
