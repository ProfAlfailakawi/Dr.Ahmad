import { cleanResearchSample, inferResearchSample, splitResearchSentences } from './research-sample.mjs'

export type ResearchIntelligenceInput = {
  title?: string
  titleAr?: string
  meta?: string
  abstractAr?: string
  journal?: string
  source?: string
  url?: string
  pdf?: string
  scholar?: string
  researchgate?: string
  orcid?: string
  repository?: string
  coAuthors?: string
  doi?: string
  methodology?: string
  sample?: string
  researchQuestion?: string
  keyFinding?: string
  contribution?: string
  applications?: string
  limitations?: string
  studyType?: string
  reviewStatus?: string
  keywords?: string
  iso?: string
  date?: string
  year?: string
  metadataText?: string
  pdfText?: string
  analysisText?: string
  analysisFingerprint?: string
  analysisSources?: string
  analyzedAt?: string
  fieldEvidence?: string | Record<string, unknown>
  conflictReport?: string | unknown[]
  qualityReport?: string | Record<string, unknown>
  qualityReady?: string | boolean
}

export type ResearchSourceLink = {
  id: 'publisher' | 'pdf' | 'doi' | 'researchgate' | 'scholar' | 'orcid' | 'repository'
  label: string
  url: string
}

export type ResearchEvidence = {
  source: string
  location: string
  quote: string
  label: string
}

export type ResearchConflict = {
  field: string
  label: string
  detail: string
  sources: string[]
  blocking: boolean
}

export type ResearchQualityCheck = {
  id: string
  label: string
  passed: boolean
  blocking: boolean
  detail: string
}

export type ResearchQuality = {
  ready: boolean
  score: number
  checks: ResearchQualityCheck[]
  blockers: ResearchQualityCheck[]
}

export type ResearchIntelligence = {
  reviewStatus: string
  topic: string
  studyType: string
  methodology: string
  sample: string
  researchQuestion: string
  keyFinding: string
  contribution: string
  applications: string
  limitations: string
  evidenceLabel: string
  evidenceScore: number
  doi: string
  keywords: string
  journal: string
  year: string
  openAccess: boolean
  confidence: number
  needsReview: boolean
  analysisFingerprint: string
  analysisSources: string
  analyzedAt: string
  links: ResearchSourceLink[]
  fieldEvidence: Record<string, ResearchEvidence>
  conflicts: ResearchConflict[]
  quality: ResearchQuality
  searchText: string
}

export const DEFAULT_RESEARCH_ORCID = 'https://orcid.org/0000-0002-1767-4963'
export const RESEARCH_ANALYSIS_VERSION = '2026-08-26-sample-integrity-4'

const clean = (value: unknown = '') => String(value ?? '').replace(/^ملخص عربي:\s*/i, '').replace(/\s+/g, ' ').trim()
const hasArabic = (value = '') => /[\u0600-\u06ff]/.test(value)
const clip = (value: string, max = 1_200) => value.length <= max ? value : `${value.slice(0, max).replace(/\s+\S*$/, '')}…`
const pick = (text: string, patterns: RegExp[]) => patterns.map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean) || ''
const pickScientificSentence = (text: string, patterns: RegExp[]) =>
  splitResearchSentences(text).find((sentence) => patterns.every((pattern) => pattern.test(sentence))) || ''
const normalizeForMatch = (value = '') => clean(value).toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ')
const normalizeLink = (value = '') => {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed) || /^\/(?!\/)/.test(trimmed)) return trimmed
  return ''
}
const normalizeDoi = (value = '') => clean(value)
  .replace(/^doi\s*:\s*/i, '')
  .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  .replace(/[\s]+/g, '')
  .replace(/[.,;،؛]+$/, '')
const normalizeOrcid = (value = '') => {
  const trimmed = clean(value)
  if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(trimmed)) return `https://orcid.org/${trimmed}`
  return normalizeLink(trimmed)
}
const canonicalLink = (value = '') => value.trim().replace(/\/$/, '').toLowerCase()

const inferStudyType = (text: string) => {
  if (/مراجعة منهجية|systematic review|meta[- ]analysis|تحليل بعدي/i.test(text)) return 'مراجعة منهجية'
  if (/شبه تجريب|quasi[- ]experimental/i.test(text)) return 'دراسة شبه تجريبية'
  if (/تجريب(?:ي|ية)|experimental|control group|مجموعة ضابطة/i.test(text)) return 'دراسة تجريبية'
  if (/مختلط|mixed methods?/i.test(text)) return 'دراسة بمنهج مختلط'
  if (/نوعي|qualitative|مقابلات|مجموعات تركيز/i.test(text)) return 'دراسة نوعية'
  if (/ارتباطي|correlational/i.test(text)) return 'دراسة ارتباطية'
  if (/مسح(?:ي|ية)|survey|استبانة|questionnaire/i.test(text)) return /وصفي|descriptive/i.test(text) ? 'دراسة وصفية مسحية' : 'دراسة مسحية'
  if (/دراسة حالة|case study/i.test(text)) return 'دراسة حالة'
  if (/تحليل محتوى|content analysis/i.test(text)) return 'دراسة تحليل محتوى'
  if (/وصفي|descriptive/i.test(text)) return 'دراسة وصفية'
  return ''
}

const inferMethodology = (text: string) => pickScientificSentence(text, [
  /(?:اعتمدت?|استخدمت?|استُخدم|تم استخدام|جرى استخدام|اتبعت?|طُبقت?|طبقت)/iu,
  /(?:المنهج|تصميم|استبانة|استبيان|مقابلة|تحليل محتوى|اختبار|مقياس)/iu,
])

const inferQuestion = (text: string) => splitResearchSentences(text).find((sentence) =>
  /(?:سعى|يسعى|يهدف|هدفت|هدف|تتمثل مشكلة|تكمن مشكلة|يناقش البحث|تبحث الدراسة|تقصت الدراسة|استهدفت الدراسة)/iu.test(sentence),
) || ''

const inferFinding = (text: string) => splitResearchSentences(text).find((sentence) =>
  /(?:أظهرت النتائج|بيّنت النتائج|بينت النتائج|كشفت النتائج|أسفرت النتائج|توصلت الدراسة|خلصت الدراسة|تشير النتائج|اتضح|تبين أن|تبيّن أن|وُجد أن)/iu.test(sentence),
) || ''

const inferApplications = (text: string) => splitResearchSentences(text).find((sentence) =>
  /(?:أوصت الدراسة|يوصي البحث|توصي النتائج|وتوصي الدراسة|من التطبيقات|التطبيقات العملية)/iu.test(sentence),
) || ''

const inferLimitations = (text: string) => splitResearchSentences(text).find((sentence) =>
  /(?:حدود الدراسة|محددات الدراسة|قيود الدراسة|ومن قيود|اقتصرت الدراسة)/iu.test(sentence),
) || ''

const inferKeywords = (text: string) => {
  const explicit = pick(text, [/(?:الكلمات المفتاحية|الكلمات الدالة|Keywords?)\s*[:：]\s*([^\n]{4,720})/i])
  return explicit.replace(/[.؛;]+$/, '')
}

const inferTopic = (input: ResearchIntelligenceInput, keywords: string) => {
  const meta = clean(input.meta)
  if (hasArabic(meta)) return meta
  if (keywords && hasArabic(keywords)) return keywords.split(/[،,؛;]/).slice(0, 3).map((item) => item.trim()).filter(Boolean).join(' · ')
  return ''
}

const extractDoi = (text: string) => normalizeDoi(text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0] || '')
const extractYear = (input: ResearchIntelligenceInput, text: string) => clean(input.year) || (clean(input.iso).match(/(?:19|20)\d{2}/)?.[0]) || (clean(input.date).match(/(?:19|20)\d{2}/)?.[0]) || (text.match(/(?:19|20)\d{2}/)?.[0] || '')

const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `r${(hash >>> 0).toString(36)}`
}

const parseJson = <T,>(value: unknown, fallback: T): T => {
  if (value && typeof value === 'object') return value as T
  if (typeof value !== 'string' || !value.trim()) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

const evidenceLabels: Record<string, string> = {
  topic: 'الموضوع', studyType: 'نوع الدراسة', methodology: 'المنهج', sample: 'العينة / نطاق الدراسة',
  researchQuestion: 'السؤال العلمي', keyFinding: 'أبرز النتائج', contribution: 'الإضافة العلمية',
  applications: 'التطبيقات', limitations: 'القيود', keywords: 'الكلمات المفتاحية', journal: 'المجلة', year: 'سنة النشر', doi: 'DOI', abstractAr: 'الملخص',
}

function normalizedEvidence(value: unknown): ResearchEvidence | null {
  if (typeof value === 'string' && value.trim()) return { source: value.trim(), location: '', quote: '', label: `موثّق من ${value.trim()}` }
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const source = clean(item.source || item.label)
  const location = clean(item.location || item.page || item.section)
  const quote = clip(clean(item.quote || item.excerpt), 220)
  if (!source && !location && !quote) return null
  return { source: source || 'المصدر الأصلي', location, quote, label: `موثّق من ${source || 'المصدر الأصلي'}${location ? ` · ${location}` : ''}` }
}

function sourceEvidence(input: ResearchIntelligenceInput, field: string, value: string, supplied: Record<string, unknown>) {
  const direct = normalizedEvidence(supplied[field])
  if (direct) return direct
  const needle = normalizeForMatch(value).slice(0, 120)
  const contains = (material: unknown) => needle.length >= 12 && normalizeForMatch(clean(material)).includes(needle)
  if (contains(input.pdfText)) return { source: 'PDF الكامل', location: 'النص المستخرج', quote: '', label: 'موثّق من PDF الكامل' }
  if (contains(input.metadataText)) return { source: 'Metadata الرسمية', location: '', quote: '', label: 'موثّق من Metadata الرسمية' }
  if (contains(input.abstractAr)) return { source: 'ملخص البحث', location: 'الملخص', quote: '', label: 'موثّق من ملخص البحث' }
  if (contains(input.analysisText)) return { source: 'النص المرفق', location: '', quote: '', label: 'موثّق من النص المرفق' }
  const sources = clean(input.analysisSources)
  if (/PDF/i.test(sources)) return { source: 'PDF والمصادر الأصلية', location: '', quote: '', label: 'موثّق من PDF والمصادر الأصلية' }
  if (field === 'doi') return { source: 'DOI / Crossref', location: '', quote: '', label: 'موثّق من DOI / Crossref' }
  if (field === 'journal' || field === 'year') return { source: 'بيانات النشر', location: '', quote: '', label: 'موثّق من بيانات النشر' }
  return { source: 'بيانات البحث', location: '', quote: '', label: 'موثّق من بيانات البحث' }
}

function parseConflicts(input: ResearchIntelligenceInput): ResearchConflict[] {
  const supplied = parseJson<unknown[]>(input.conflictReport, [])
  const normalized = supplied.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const detail = clean(row.detail || row.description || row.values)
    if (!detail) return []
    return [{
      field: clean(row.field) || 'metadata',
      label: clean(row.label) || 'تعارض بين المصادر',
      detail,
      sources: Array.isArray(row.sources) ? row.sources.map(clean).filter(Boolean) : clean(row.sources).split(/[،,]/).map((part) => part.trim()).filter(Boolean),
      blocking: row.blocking !== false,
    }]
  })
  const conflicts = [...normalized]
  const doiCandidates = [input.doi, input.source, input.url, input.pdf, input.metadataText].map((value) => extractDoi(clean(value))).filter(Boolean)
  const uniqueDois = [...new Set(doiCandidates.map((value) => value.toLowerCase()))]
  if (uniqueDois.length > 1 && !conflicts.some((item) => item.field === 'doi')) conflicts.push({ field: 'doi', label: 'اختلاف المعرّف الرقمي', detail: uniqueDois.join(' مقابل '), sources: ['بيانات البحث', 'الروابط / Metadata'], blocking: true })
  const explicitYears = [clean(input.year), clean(input.iso).match(/(?:19|20)\d{2}/)?.[0] || '', clean(input.date).match(/(?:19|20)\d{2}/)?.[0] || '', clean(input.journal).match(/(?:19|20)\d{2}/)?.[0] || ''].filter(Boolean)
  const uniqueYears = [...new Set(explicitYears)]
  if (uniqueYears.length > 1 && !conflicts.some((item) => item.field === 'year')) conflicts.push({ field: 'year', label: 'اختلاف سنة النشر', detail: uniqueYears.join(' مقابل '), sources: ['لوحة التحكم', 'بيانات المجلة'], blocking: true })
  return conflicts
}

export function researchFingerprint(input: ResearchIntelligenceInput) {
  const payload = [
    RESEARCH_ANALYSIS_VERSION, input.title, input.titleAr, input.meta, input.abstractAr, input.journal, input.source, input.url, input.pdf,
    input.scholar, input.researchgate, input.orcid, input.repository, input.coAuthors, input.doi, input.methodology, input.sample,
    input.researchQuestion, input.keyFinding, input.contribution, input.applications, input.limitations, input.studyType,
    input.keywords, input.iso, input.date, input.year, input.metadataText, input.pdfText, input.analysisText,
  ].map(clean).join('\u241f')
  return stableHash(payload)
}

export function researchLinks(input: ResearchIntelligenceInput, doiValue = ''): ResearchSourceLink[] {
  const doi = normalizeDoi(doiValue || input.doi || extractDoi([input.source, input.url, input.pdf].filter(Boolean).join(' ')))
  const doiUrl = doi ? `https://doi.org/${doi.split('/').map((part) => encodeURIComponent(part)).join('/')}` : ''
  const source = normalizeLink(clean(input.source))
  const publisherUrl = source && canonicalLink(source) !== canonicalLink(doiUrl) ? source : ''
  const candidates: ResearchSourceLink[] = [
    { id: 'publisher', label: 'صفحة المجلة', url: publisherUrl },
    { id: 'pdf', label: 'النص الكامل PDF', url: normalizeLink(clean(input.pdf)) },
    { id: 'doi', label: 'DOI', url: doiUrl },
    { id: 'researchgate', label: 'ResearchGate', url: normalizeLink(clean(input.researchgate)) },
    { id: 'scholar', label: 'Google Scholar', url: normalizeLink(clean(input.scholar)) },
    { id: 'orcid', label: 'ORCID', url: normalizeOrcid(clean(input.orcid)) || DEFAULT_RESEARCH_ORCID },
    { id: 'repository', label: 'مستودع الجامعة', url: normalizeLink(clean(input.repository)) },
  ]
  const seen = new Set<string>()
  return candidates.filter((item) => {
    const key = canonicalLink(item.url)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function evaluateResearchQuality(input: ResearchIntelligenceInput, intelligence?: Omit<ResearchIntelligence, 'quality'>): ResearchQuality {
  const data = intelligence || ({} as Omit<ResearchIntelligence, 'quality'>)
  const title = clean(input.title)
  const doi = clean(data.doi || input.doi)
  const links = data.links || researchLinks(input, doi)
  const core = [clean(data.researchQuestion || input.researchQuestion), clean(data.methodology || input.methodology), clean(data.sample || input.sample), clean(data.keyFinding || input.keyFinding)]
  const arabicValues = [data.topic || input.meta, data.studyType || input.studyType, ...core, data.applications || input.applications, data.limitations || input.limitations, data.keywords || input.keywords].map(clean).filter(Boolean)
  const conflicts = data.conflicts || parseConflicts(input)
  const evidence = data.fieldEvidence || {}
  const evidenceCore = ['researchQuestion', 'methodology', 'sample', 'keyFinding'].filter((key) => evidence[key]).length
  const checks: ResearchQualityCheck[] = [
    { id: 'identity', label: 'هوية البحث الأساسية', passed: Boolean(title), blocking: true, detail: 'العنوان والرابط المختصر' },
    { id: 'source', label: 'الوصول إلى مصدر أصلي', passed: links.some((item) => ['publisher', 'pdf', 'doi', 'repository'].includes(item.id)), blocking: true, detail: 'PDF أو DOI أو صفحة المجلة أو المستودع' },
    { id: 'publication', label: 'بيانات النشر', passed: Boolean(clean(data.journal || input.journal) && clean(data.year || input.year)), blocking: true, detail: 'اسم المجلة وسنة النشر' },
    { id: 'scientific-core', label: 'العمود العلمي الكامل', passed: core.every(Boolean), blocking: true, detail: 'السؤال والمنهج والعينة والنتائج' },
    { id: 'arabic', label: 'سلامة التعريب العلمي', passed: arabicValues.every(hasArabic), blocking: true, detail: 'الحقول العلمية الظاهرة بالعربية' },
    { id: 'doi', label: 'سلامة DOI', passed: !doi || /^10\.\d{4,9}\/[\S]+$/i.test(doi), blocking: true, detail: 'صيغة DOI قابلة للفتح' },
    { id: 'evidence', label: 'ختم مصدر للبيانات الجوهرية', passed: evidenceCore === 4, blocking: true, detail: 'مصدر موثّق لكل محور أساسي' },
    { id: 'conflicts', label: 'مطابقة المصادر', passed: !conflicts.some((item) => item.blocking), blocking: true, detail: 'لا تعارض غير محسوم بين PDF وDOI وMetadata' },
    { id: 'cache', label: 'بصمة التحليل', passed: Boolean(clean(input.analysisFingerprint) && clean(input.analyzedAt)), blocking: false, detail: 'إعادة التحليل فقط عند تغيّر البيانات' },
  ]
  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
  const blockers = checks.filter((check) => check.blocking && !check.passed)
  return { ready: blockers.length === 0, score, checks, blockers }
}

export function analyzeResearch(input: ResearchIntelligenceInput = {}): ResearchIntelligence {
  const abstract = clean(input.abstractAr)
  const journal = clean(input.journal)
  const sourceMaterial = [
    abstract, clean(input.metadataText), clean(input.pdfText), clean(input.analysisText),
    clean(input.methodology), clean(input.sample), clean(input.researchQuestion), clean(input.keyFinding),
    clean(input.applications), clean(input.limitations), clean(input.keywords), clean(input.doi),
  ].filter(Boolean).join(' ')
  const studyType = clean(input.studyType) || inferStudyType(sourceMaterial)
  const methodology = clean(input.methodology) || inferMethodology(sourceMaterial)
  /* لا نعرض قيمة خام لمجرد أن الحقل غير فارغ. إذا كانت شظية إحصائية أو
     أقواسها مبتورة، نهملها ونعود إلى جملة العينة الموثقة في المادة الأصلية. */
  const sample = cleanResearchSample(input.sample) || inferResearchSample(sourceMaterial)
  const researchQuestion = clean(input.researchQuestion) || inferQuestion(sourceMaterial)
  const keyFinding = clean(input.keyFinding) || inferFinding(sourceMaterial)
  const applications = clean(input.applications) || inferApplications(sourceMaterial)
  const limitations = clean(input.limitations) || inferLimitations(sourceMaterial)
  const doi = normalizeDoi(clean(input.doi)) || extractDoi([sourceMaterial, input.source, input.url, input.pdf].filter(Boolean).join(' '))
  const keywords = clean(input.keywords) || inferKeywords(sourceMaterial)
  const topic = inferTopic(input, keywords)
  const contribution = clean(input.contribution)
  const year = extractYear(input, `${journal} ${sourceMaterial}`)
  const links = researchLinks(input, doi)
  const openAccess = links.some((item) => item.id === 'pdf' || item.id === 'repository' || item.id === 'researchgate')
  const available = [abstract, journal, methodology, sample, researchQuestion, keyFinding, doi, keywords, applications].filter(Boolean).length
  const evidenceScore = Math.min(100, 56 + available * 4 + (input.pdfText ? 5 : 0) + (input.metadataText ? 4 : 0))
  const confidence = Math.min(100, 48 + available * 5 + (abstract ? 5 : 0) + (input.pdfText ? 8 : 0) + (input.metadataText ? 4 : 0))
  const analysisSources = clean(input.analysisSources) || [abstract && 'الملخص', input.pdfText && 'PDF', input.metadataText && 'البيانات الوصفية', doi && 'DOI', links.length && 'الروابط'].filter(Boolean).join('، ')
  const values: Record<string, string> = { topic, studyType, methodology, sample, researchQuestion, keyFinding, contribution, applications, limitations, keywords, journal, year, doi, abstractAr: abstract }
  const suppliedEvidence = parseJson<Record<string, unknown>>(input.fieldEvidence, {})
  const fieldEvidence = Object.fromEntries(Object.entries(values).filter(([, value]) => Boolean(value)).map(([field, value]) => [field, sourceEvidence(input, field, value, suppliedEvidence)]))
  const conflicts = parseConflicts(input)
  const partial = {
    reviewStatus: 'محكّم', topic, studyType, methodology: clip(methodology, 3_200), sample: clip(sample, 4_800),
    researchQuestion: clip(researchQuestion, 3_200), keyFinding: clip(keyFinding, 4_800), contribution: clip(contribution, 3_200),
    applications: clip(applications, 3_200), limitations: clip(limitations, 3_200),
    evidenceLabel: evidenceScore >= 90 ? 'بيانات علمية مكتملة' : evidenceScore >= 76 ? 'بيانات علمية واضحة' : 'بيانات علمية أساسية',
    evidenceScore, doi, keywords, journal, year, openAccess, confidence, needsReview: conflicts.some((item) => item.blocking),
    analysisFingerprint: researchFingerprint(input), analysisSources, analyzedAt: clean(input.analyzedAt), links, fieldEvidence, conflicts,
    searchText: normalizeForMatch([input.title, input.titleAr, input.coAuthors, topic, studyType, methodology, sample, researchQuestion, keyFinding, contribution, applications, limitations, keywords, journal, year, doi].map(clean).join(' ')),
  }
  const quality = evaluateResearchQuality(input, partial)
  return { ...partial, quality }
}

export const researchEvidenceLabel = (intelligence: ResearchIntelligence, field: string) => intelligence.fieldEvidence[field]?.label || `موثّق من ${evidenceLabels[field] || 'المصدر الأصلي'}`

/**
 * Archive-list projection: intentionally cheaper than analyzeResearch().
 * It powers filtering/searching across very large archives without running the
 * evidence/quality pipeline for every hidden row. Full intelligence is still
 * computed for the 12 records that are actually rendered.
 */
export function researchArchiveProjection(input: ResearchIntelligenceInput = {}) {
  const compactSource = [
    clean(input.title), clean(input.titleAr), clean(input.meta), clean(input.abstractAr).slice(0, 2_400),
    clean(input.journal), clean(input.coAuthors), clean(input.studyType), clean(input.methodology).slice(0, 900),
    clean(input.sample).slice(0, 500), clean(input.researchQuestion).slice(0, 900), clean(input.keyFinding).slice(0, 1_200),
    clean(input.keywords), clean(input.doi),
  ].filter(Boolean).join(' ')
  return {
    studyType: clean(input.studyType) || inferStudyType(compactSource),
    year: extractYear(input, `${clean(input.journal)} ${compactSource}`),
    searchText: normalizeForMatch(compactSource),
  }
}
