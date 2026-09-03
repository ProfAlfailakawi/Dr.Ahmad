import type { ArticleRecord, BookRecord, PaperRecord } from './cms'
import { articleSimilarityReport, ideaTokens, relatedForIdea } from './intelligence'

export type PersonalSourceKind = 'doi' | 'url' | 'pdf' | 'note'
export type PersonalSourceStatus = 'active' | 'needs_review' | 'corrected' | 'retracted'
export type PersonalSourceRecord = {
  id: string
  kind: PersonalSourceKind
  title: string
  reference: string
  note: string
  summary: string
  keywords: string[]
  doi?: string
  url?: string
  storagePath?: string
  journal?: string
  year?: string
  keyFinding?: string
  evidenceLabel?: string
  evidenceScore?: number | null
  status: PersonalSourceStatus
  linkedArticles: Array<{ slug: string; title: string; score: number }>
  linkedBooks: Array<{ slug: string; title: string }>
  linkedPapers: Array<{ slug: string; title: string }>
  createdAtClient?: string
  updatedAtClient?: string
}

export type IntellectualAgendaStatus = 'explore' | 'gather_evidence' | 'testing' | 'writing' | 'changed_mind' | 'complete'
export type IntellectualAgendaItem = {
  id: string
  title: string
  note: string
  status: IntellectualAgendaStatus
  priority: 1 | 2 | 3 | 4 | 5
  createdAtClient?: string
  updatedAtClient?: string
}

export type AgendaAlignment = {
  available: boolean
  score: number | null
  matches: Array<{ id: string; title: string; status: IntellectualAgendaStatus; priority: number; score: number }>
  explanation: string
}

export type PersonalSourceMatch = {
  id: string
  title: string
  kind: PersonalSourceKind
  status: PersonalSourceStatus
  score: number
  summary: string
  doi?: string
  url?: string
  storagePath?: string
}

export type MeaningFingerprint = {
  version: 1
  hash: string
  slug: string
  thesis: string
  protectedPoints: string[]
  caveats: string[]
  sourceIds: string[]
  builtAt: string
}

export type MeaningDriftReview = {
  ready: boolean
  score: number
  thesisCoverage: number
  missingProtectedPoints: string[]
  missingCaveats: string[]
  explanation: string
}

export type EvidenceChainSource = {
  id: string
  kind: 'personal_source' | 'paper' | 'article_source'
  title: string
  status: 'active' | 'needs_review' | 'corrected' | 'retracted' | 'unknown'
  url?: string
  doi?: string
}

export type EvidenceChainClaim = {
  id: string
  text: string
  sourceIds: string[]
  support: 'strong' | 'partial' | 'unsupported'
}

export type EvidenceChain = {
  version: 1
  slug: string
  coverage: number
  claims: EvidenceChainClaim[]
  sources: EvidenceChainSource[]
  sourceIds: string[]
  alerts: string[]
  builtAt: string
}

export type BookArchitectureChapter = {
  id: string
  title: string
  theme: string
  coverage: number
  articles: Array<{ slug: string; title: string }>
  papers: Array<{ slug: string; title: string }>
}

export type BookArchitecture = {
  version: 1
  seed: string
  readiness: number
  chapters: BookArchitectureChapter[]
  gaps: string[]
  reusableArticles: number
  reusablePapers: number
  builtAt: string
}

const STOP = new Set('هذا هذه ذلك التي الذي على الى إلى عن من في مع كان كانت يكون تكون كل بين عند بعد قبل حول ماذا كيف لماذا هل لكن فقط جدا جداً ايضا أيضاً'.split(' '))

function normalize(value = '') {
  return String(value).toLowerCase().normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670ـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(value = '') {
  return [...new Set(normalize(value).split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word)))]
}

function hash(value: string) {
  let current = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index)
    current = Math.imul(current, 16777619)
  }
  return (current >>> 0).toString(16).padStart(8, '0')
}

function overlapScore(left = '', right = '') {
  const a = tokens(left)
  const b = new Set(tokens(right))
  if (!a.length || !b.size) return 0
  const overlap = a.filter((word) => b.has(word)).length
  return Math.max(0, Math.min(100, Math.round((overlap / Math.min(Math.max(3, a.length), Math.max(3, b.size))) * 100)))
}

function unique(items: string[], limit = 12) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit)
}

function sentences(value = '') {
  return String(value).replace(/\r/g, '').split(/(?:\n{2,}|(?<=[.!؟])\s+)/u)
    .map((sentence) => sentence.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 520)
}

function claimScore(sentence: string, title = '') {
  let score = overlapScore(title, sentence) * .35
  if (/(?:دراسة|بحث|نتيج|بيانات|نسبة|٪|%|وفق|أظهرت|تشير|يثبت|يؤكد|يكشف)/i.test(sentence)) score += 28
  if (/\d/.test(sentence)) score += 12
  if (/(?:لذلك|وهذا يعني|الخلاصة|المشكلة|الأهم|الحجة|أرى|أعتقد)/.test(sentence)) score += 10
  return score
}

export function extractEditorialClaims(title: string, body: string, limit = 8) {
  return sentences(body)
    .map((text) => ({ text, score: claimScore(text, title) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.text)
}

export function matchPersonalSources(idea: string, sources: PersonalSourceRecord[], limit = 6): PersonalSourceMatch[] {
  return sources
    .map((source) => {
      const haystack = `${source.title} ${source.note} ${source.summary} ${source.keywords.join(' ')} ${source.keyFinding || ''}`
      let score = overlapScore(idea, haystack)
      if (source.status === 'corrected') score = Math.max(0, score - 8)
      if (source.status === 'retracted') score = Math.max(0, score - 20)
      return { id: source.id, title: source.title, kind: source.kind, status: source.status, score, summary: source.summary || source.note, doi: source.doi, url: source.url, storagePath: source.storagePath }
    })
    .filter((item) => item.score >= 12)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ar'))
    .slice(0, limit)
}

export function buildAgendaAlignment(idea: string, items: IntellectualAgendaItem[]): AgendaAlignment {
  if (!items.length) return { available: false, score: null, matches: [], explanation: 'لم تُحدّد أجندة فكرية خاصة بعد؛ لم تدخل أي درجة مفترضة في القرار.' }
  const matches = items.map((item) => {
    const lexical = overlapScore(idea, `${item.title} ${item.note}`)
    const stageBonus = item.status === 'writing' ? 14 : item.status === 'gather_evidence' ? 9 : item.status === 'testing' ? 7 : item.status === 'complete' ? -8 : 0
    const priorityBonus = (item.priority - 1) * 3
    return { id: item.id, title: item.title, status: item.status, priority: item.priority, score: Math.max(0, Math.min(100, lexical + stageBonus + priorityBonus)) }
  }).filter((item) => item.score >= 16).sort((a, b) => b.score - a.score).slice(0, 4)
  if (!matches.length) return { available: true, score: 0, matches: [], explanation: 'الفكرة لا تتقاطع بوضوح مع القضايا التي اخترتها لأجندتك الفكرية؛ هذا لا يرفضها، لكنه يكشف احتمال التشتت.' }
  const weight = matches.reduce((sum, item) => sum + item.score * Math.max(1, item.priority), 0)
  const totalWeight = matches.reduce((sum, item) => sum + Math.max(1, item.priority), 0)
  const score = Math.max(0, Math.min(100, Math.round(weight / totalWeight)))
  return {
    available: true,
    score,
    matches,
    explanation: score >= 70
      ? `الفكرة تخدم مباشرةً أجندتك الفكرية الخاصة، وأقوى تقاطع هو «${matches[0].title}».`
      : score >= 40
        ? `الفكرة تتقاطع جزئياً مع أجندتك، وأقرب مسار هو «${matches[0].title}».`
        : 'يوجد تقاطع ضعيف مع الأجندة؛ يستحق المجلس أن يفرّق بين الفضول المؤقت والمسار الفكري المقصود.',
  }
}

export function buildMeaningFingerprint(input: {
  slug: string
  title: string
  body: string
  excerpt?: string
  thesis?: string
  sourceIds?: string[]
  builtAt?: string
}): MeaningFingerprint {
  const bodySentences = sentences(input.body)
  const claims = extractEditorialClaims(input.title, input.body, 6)
  const thesis = String(input.thesis || claims[0] || bodySentences[0] || input.excerpt || input.title).trim()
  const caveats = unique(bodySentences.filter((sentence) => /(?:لكن|مع ذلك|رغم|لا يعني|لا يكفي|قد |ربما|بشرط|حدود|استثناء|من جهة أخرى)/.test(sentence)), 5)
  const protectedPoints = unique([thesis, ...claims.slice(0, 3), ...caveats.slice(0, 2)], 6)
  const sourceIds = unique(input.sourceIds || [], 24)
  const builtAt = input.builtAt || new Date().toISOString()
  return {
    version: 1,
    hash: `meaning-${hash(`${normalize(thesis)}::${protectedPoints.map(normalize).join('|')}::${sourceIds.join('|')}`)}`,
    slug: input.slug,
    thesis,
    protectedPoints,
    caveats,
    sourceIds,
    builtAt,
  }
}

export function reviewMeaningDrift(fingerprint: MeaningFingerprint, candidateText: string): MeaningDriftReview {
  const clean = String(candidateText || '').trim()
  if (!clean) return { ready: false, score: 0, thesisCoverage: 0, missingProtectedPoints: fingerprint.protectedPoints, missingCaveats: fingerprint.caveats, explanation: 'لا يوجد نص يمكن مقارنته ببصمة المعنى.' }
  const thesisCoverage = overlapScore(fingerprint.thesis, clean)
  const protectedRows = fingerprint.protectedPoints.map((point) => ({ point, score: overlapScore(point, clean) }))
  const missingProtectedPoints = protectedRows.filter((row) => row.score < 16).map((row) => row.point)
  const caveatRows = fingerprint.caveats.map((point) => ({ point, score: overlapScore(point, clean) }))
  const wordCount = clean.split(/\s+/).filter(Boolean).length
  const caveatThreshold = wordCount >= 180 ? 12 : 7
  const missingCaveats = caveatRows.filter((row) => row.score < caveatThreshold).map((row) => row.point)
  const preserved = protectedRows.length ? (protectedRows.length - missingProtectedPoints.length) / protectedRows.length : 1
  const caveatPreserved = caveatRows.length ? (caveatRows.length - missingCaveats.length) / caveatRows.length : 1
  const score = Math.max(0, Math.min(100, Math.round(thesisCoverage * .45 + preserved * 100 * .4 + caveatPreserved * 100 * .15)))
  const ready = thesisCoverage >= 18 && score >= 48 && !(wordCount >= 180 && fingerprint.caveats.length && missingCaveats.length === fingerprint.caveats.length)
  return {
    ready,
    score,
    thesisCoverage,
    missingProtectedPoints,
    missingCaveats,
    explanation: ready
      ? `النص يحافظ على الأطروحة وبصمة المعنى بدرجة ${score}/100.`
      : `يوجد خطر انزياح في المعنى (${score}/100)؛ راجع الأطروحة أو التحفظات قبل اعتماد النسخة المشتقة.`,
  }
}

export function buildEvidenceChain(input: {
  slug: string
  title: string
  body: string
  articleSource?: string
  personalSources?: PersonalSourceRecord[]
  papers?: PaperRecord[]
  preferredPaperSlugs?: string[]
  builtAt?: string
}): EvidenceChain {
  const claims = extractEditorialClaims(input.title, input.body, 8)
  const sourceRows: EvidenceChainSource[] = []
  const personal = matchPersonalSources(`${input.title} ${input.body.slice(0, 2200)}`, input.personalSources || [], 10)
  for (const match of personal) {
    const original = (input.personalSources || []).find((item) => item.id === match.id)
    if (!original) continue
    sourceRows.push({ id: `personal:${original.id}`, kind: 'personal_source', title: original.title, status: original.status, url: original.url, doi: original.doi })
  }
  const preferred = new Set(input.preferredPaperSlugs || [])
  const relatedPapers = relatedForIdea(`${input.title} ${input.body.slice(0, 2600)}`, input.papers || [], (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.keyFinding || ''} ${paper.keywords || ''}`, 8)
  const paperRows = [...(input.papers || []).filter((paper) => preferred.has(paper.slug)), ...relatedPapers]
  const seenPapers = new Set<string>()
  for (const paper of paperRows) {
    if (seenPapers.has(paper.slug)) continue
    seenPapers.add(paper.slug)
    sourceRows.push({ id: `paper:${paper.slug}`, kind: 'paper', title: paper.titleAr || paper.title, status: paper.analysisNeedsReview ? 'needs_review' : 'active', url: paper.url || paper.source || paper.pdf, doi: paper.doi })
  }
  if (input.articleSource?.trim()) sourceRows.push({ id: `article-source:${hash(input.articleSource)}`, kind: 'article_source', title: 'مصدر المقال المباشر', status: 'unknown', url: input.articleSource.trim() })

  const uniqueSources = Array.from(new Map(sourceRows.map((source) => [source.id, source])).values()).slice(0, 18)
  const claimRows: EvidenceChainClaim[] = claims.map((claim, index) => {
    const matches = uniqueSources.map((source) => {
      const personalRow = source.kind === 'personal_source' ? (input.personalSources || []).find((item) => `personal:${item.id}` === source.id) : null
      const paper = source.kind === 'paper' ? (input.papers || []).find((item) => `paper:${item.slug}` === source.id) : null
      const haystack = personalRow
        ? `${personalRow.title} ${personalRow.summary} ${personalRow.note} ${personalRow.keyFinding || ''} ${personalRow.keywords.join(' ')}`
        : paper
          ? `${paper.titleAr || paper.title} ${paper.meta || ''} ${paper.abstractAr || ''} ${paper.keyFinding || ''} ${paper.keywords || ''}`
          : source.title
      const lexical = overlapScore(claim, haystack)
      // المصدر المنسحب لا يمكن أن يرفع التغطية إطلاقاً. والمصحح/قيد المراجعة
      // يبقى مرشحاً للمراجعة فقط ولا يُسمح له وحده أن يصنع «دعماً قوياً».
      const score = source.status === 'retracted' ? 0 : source.status === 'corrected' || source.status === 'needs_review' ? Math.min(24, lexical) : lexical
      return { id: source.id, score }
    }).filter((row) => row.score >= 13).sort((a, b) => b.score - a.score).slice(0, 3)
    const sourceIds = matches.map((item) => item.id)
    const strongest = matches[0]?.score || 0
    return { id: `claim-${index + 1}-${hash(claim)}`, text: claim, sourceIds, support: strongest >= 34 ? 'strong' : strongest >= 13 ? 'partial' : 'unsupported' }
  })
  const supportedPoints = claimRows.filter((claim) => claim.support !== 'unsupported').length
  const coverage = claimRows.length ? Math.round((supportedPoints / claimRows.length) * 100) : 0
  // sourceIds هي تبعيات الادعاءات الفعلية (المستنتجة من التطابق)، لا كل مصدر
  // «قريب» من الموضوع. هذا يمنع حارس Crossref من إنذار مقال لم يعتمد المصدر.
  const linkedSourceIds = unique(claimRows.flatMap((claim) => claim.sourceIds), 18)
  const linkedSources = uniqueSources.filter((source) => linkedSourceIds.includes(source.id))
  const alerts = unique([
    ...linkedSources.filter((source) => source.status === 'retracted').map((source) => `المصدر «${source.title}» موسوم منسحباً ويجب ألا يبقى سنداً للمقال.`),
    ...linkedSources.filter((source) => source.status === 'corrected').map((source) => `المصدر «${source.title}» مصحح؛ راجع الادعاءات المرتبطة به قبل النشر التالي.`),
    ...linkedSources.filter((source) => source.status === 'needs_review').map((source) => `المصدر «${source.title}» يحتاج مراجعة قبل الاعتماد النهائي.`),
  ], 8)
  return { version: 1, slug: input.slug, coverage, claims: claimRows, sources: uniqueSources, sourceIds: linkedSourceIds, alerts, builtAt: input.builtAt || new Date().toISOString() }
}

function dominantTheme(items: ArticleRecord[]) {
  const counts = new Map<string, number>()
  for (const article of items) for (const token of ideaTokens(`${article.title} ${article.excerpt || ''}`)) {
    if (token.length < 4) continue
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))[0]?.[0] || ''
}

export function buildBookArchitecture(input: {
  title: string
  desc?: string
  articles: ArticleRecord[]
  papers: PaperRecord[]
  books?: BookRecord[]
  builtAt?: string
}): BookArchitecture {
  const seed = `${input.title} ${input.desc || ''}`.trim()
  const similarity = articleSimilarityReport(seed, input.desc || '', input.articles, Math.min(48, Math.max(8, input.articles.length))).matches
  const relatedArticles = similarity.flatMap((match) => {
    const article = input.articles.find((item) => item.slug === match.slug)
    return article && match.score >= .08 ? [article] : []
  })
  const relatedPapers = relatedForIdea(seed, input.papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.keyFinding || ''} ${paper.keywords || ''}`, 18)
  const groups = new Map<string, ArticleRecord[]>()
  for (const article of relatedArticles) {
    const key = article.cat || 'محور عام'
    groups.set(key, [...(groups.get(key) || []), article])
  }
  const chapters: BookArchitectureChapter[] = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 7)
    .map(([category, rows], index) => {
      const theme = dominantTheme(rows) || category
      const paperMatches = relatedForIdea(`${category} ${theme} ${rows.map((row) => row.title).join(' ')}`, relatedPapers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.keyFinding || ''}`, 4)
      const coverage = Math.min(100, Math.round(rows.length * 14 + paperMatches.length * 11 + Math.min(18, rows.reduce((sum, article) => sum + Math.min(4, article.words / 700), 0))))
      return {
        id: `chapter-${index + 1}-${hash(`${category}:${theme}`)}`,
        title: theme && normalize(theme) !== normalize(category) ? `${category}: ${theme}` : category,
        theme,
        coverage,
        articles: rows.slice(0, 7).map((article) => ({ slug: article.slug, title: article.title })),
        papers: paperMatches.map((paper) => ({ slug: paper.slug, title: paper.titleAr || paper.title })),
      }
    })
  const categoryCount = chapters.length
  const gaps = unique([
    relatedArticles.length < 5 ? 'المادة المقالية المرتبطة ما زالت قليلة؛ لا تحوّل الفكرة إلى كتاب قبل جمع كتلة نصية أوسع.' : '',
    relatedPapers.length < 2 ? 'العمود البحثي ضعيف حالياً؛ يحتاج الكتاب إلى دراستين أو أكثر ترتبطان مباشرة بمحاوره الأساسية.' : '',
    categoryCount < 3 ? 'الخريطة الحالية متمركزة في محور أو محورين؛ ابحث عن فصل يكسر التماثل ويضيف بعداً جديداً.' : '',
    chapters.some((chapter) => chapter.coverage < 35) ? 'يوجد فصل مرشح بتغطية منخفضة؛ اجعله سؤال بحث أو مقالاً تمهيدياً قبل تثبيته في الفهرس.' : '',
  ], 6)
  const readiness = Math.max(0, Math.min(100, Math.round(Math.min(45, relatedArticles.length * 5) + Math.min(25, relatedPapers.length * 7) + Math.min(20, categoryCount * 5) + (gaps.length ? 0 : 10))))
  return { version: 1, seed, readiness, chapters, gaps, reusableArticles: relatedArticles.length, reusablePapers: relatedPapers.length, builtAt: input.builtAt || new Date().toISOString() }
}
