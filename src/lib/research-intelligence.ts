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
}

export type ResearchSourceLink = {
  id: 'publisher' | 'pdf' | 'doi' | 'researchgate' | 'scholar' | 'orcid' | 'repository'
  label: string
  url: string
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
}

export const DEFAULT_RESEARCH_ORCID = 'https://orcid.org/0000-0002-1767-4963'
export const RESEARCH_ANALYSIS_VERSION = '2026-07-23-nuclear-2'

const clean = (value = '') => String(value).replace(/^ملخص عربي:\s*/i, '').replace(/\s+/g, ' ').trim()
const hasArabic = (value = '') => /[\u0600-\u06ff]/.test(value)
const clip = (value: string, max = 1_200) => value.length <= max ? value : `${value.slice(0, max).replace(/\s+\S*$/, '')}…`
const pick = (text: string, patterns: RegExp[]) => patterns.map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean) || ''
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

const inferMethodology = (text: string) => pick(text, [
  /((?:اعتمدت|اعتمد|استخدمت|استخدم|اتبعت|اتبع)\s+(?:الدراسة\s+|البحث\s+)?(?:على\s+)?(?:المنهج|تصميماً|تصميمًا)[^.؟]{0,420})[.؟]?/i,
  /((?:تم استخدام|جرى استخدام|طُبقت|طبقت)\s+[^.؟]{0,220}(?:استبانة|استبيان|مقابلة|تحليل محتوى|اختبار|مقياس)[^.؟]{0,220})[.؟]?/i,
])

const inferSample = (text: string) => pick(text, [
  /((?:بلغ|تكونت|تكوّنت|اشتملت|شملت|تألفت|تألّفت)\s+(?:عينة\s+)?(?:البحث|الدراسة)?\s*(?:من\s+)?\(?\s*\d{1,6}\s*\)?\s*[^.؟]{0,560})[.؟]?/i,
  /((?:طُبقت|طبقت|وُزعت|وزعت)\s+[^.؟]{0,180}(?:على|لدى)\s+(?:عينة\s+)?(?:قوامها|بلغت)?\s*\(?\s*\d{1,6}\s*\)?\s*[^.؟]{0,480})[.؟]?/i,
  /((?:عينة الدراسة|عينة البحث|المشاركون|المشاركات)\s*[:：،]?\s*(?:قوامها|بلغت|من)?\s*\(?\s*\d{1,6}\s*\)?\s*[^.؟]{0,560})[.؟]?/i,
])

const inferQuestion = (text: string) => pick(text, [
  /((?:سعى|يسعى|يهدف|هدفت|هدف)\s+(?:هذا\s+)?(?:البحث|الدراسة)[^.؟]{0,520})[.؟]?/i,
  /((?:تتمثل مشكلة|تكمن مشكلة|يناقش البحث|تبحث الدراسة|تقصت الدراسة|استهدفت الدراسة)[^.؟]{0,520})[.؟]?/i,
])

const inferFinding = (text: string) => pick(text, [
  /((?:أظهرت النتائج|بيّنت النتائج|بينت النتائج|كشفت النتائج|أسفرت النتائج|توصلت الدراسة|خلصت الدراسة)[^.؟]{0,900})[.؟]?/i,
  /((?:تشير النتائج|اتضح|تبين أن|تبيّن أن|وُجد أن)[^.؟]{0,900})[.؟]?/i,
])

const inferApplications = (text: string) => pick(text, [
  /((?:أوصت الدراسة|يوصي البحث|توصي النتائج|وتوصي الدراسة|من التطبيقات|التطبيقات العملية)[^.؟]{0,760})[.؟]?/i,
])

const inferLimitations = (text: string) => pick(text, [
  /((?:حدود الدراسة|محددات الدراسة|قيود الدراسة|ومن قيود|اقتصرت الدراسة)[^.؟]{0,760})[.؟]?/i,
])

const inferKeywords = (text: string) => {
  const explicit = pick(text, [/(?:الكلمات المفتاحية|الكلمات الدالة|Keywords?)\s*[:：]\s*([^\n]{4,520})/i])
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

export function researchFingerprint(input: ResearchIntelligenceInput) {
  const payload = [
    RESEARCH_ANALYSIS_VERSION, input.title, input.titleAr, input.meta, input.abstractAr, input.journal, input.source, input.url, input.pdf,
    input.scholar, input.researchgate, input.orcid, input.repository, input.doi, input.methodology, input.sample,
    input.researchQuestion, input.keyFinding, input.contribution, input.applications, input.limitations, input.studyType,
    input.keywords, input.iso, input.date, input.year, input.metadataText, input.pdfText, input.analysisText,
  ].map(clean).join('\u241f')
  return stableHash(payload)
}

export function researchLinks(input: ResearchIntelligenceInput, doiValue = ''): ResearchSourceLink[] {
  const doi = normalizeDoi(doiValue || input.doi || extractDoi([input.source, input.url, input.pdf].filter(Boolean).join(' ')))
  const doiUrl = doi ? `https://doi.org/${doi.split('/').map((part) => encodeURIComponent(part)).join('/')}` : ''
  const source = normalizeLink(input.source || '')
  const publisherUrl = source && canonicalLink(source) !== canonicalLink(doiUrl) ? source : ''
  const candidates: ResearchSourceLink[] = [
    { id: 'publisher', label: 'صفحة المجلة', url: publisherUrl },
    { id: 'pdf', label: 'النص الكامل PDF', url: normalizeLink(input.pdf) },
    { id: 'doi', label: 'DOI', url: doiUrl },
    { id: 'researchgate', label: 'ResearchGate', url: normalizeLink(input.researchgate) },
    { id: 'scholar', label: 'Google Scholar', url: normalizeLink(input.scholar) },
    { id: 'orcid', label: 'ORCID', url: normalizeOrcid(input.orcid) || DEFAULT_RESEARCH_ORCID },
    { id: 'repository', label: 'مستودع الجامعة', url: normalizeLink(input.repository) },
  ]
  const seen = new Set<string>()
  return candidates.filter((item) => {
    const key = canonicalLink(item.url)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function analyzeResearch(input: ResearchIntelligenceInput): ResearchIntelligence {
  const abstract = clean(input.abstractAr)
  const journal = clean(input.journal)
  const sourceMaterial = [
    abstract, clean(input.metadataText), clean(input.pdfText), clean(input.analysisText),
    clean(input.methodology), clean(input.sample), clean(input.researchQuestion), clean(input.keyFinding),
    clean(input.applications), clean(input.limitations), clean(input.keywords), clean(input.doi),
  ].filter(Boolean).join(' ')
  const studyType = clean(input.studyType) || inferStudyType(sourceMaterial)
  const methodology = clean(input.methodology) || inferMethodology(sourceMaterial)
  const sample = clean(input.sample) || inferSample(sourceMaterial)
  const researchQuestion = clean(input.researchQuestion) || inferQuestion(sourceMaterial)
  const keyFinding = clean(input.keyFinding) || inferFinding(sourceMaterial)
  const applications = clean(input.applications) || inferApplications(sourceMaterial)
  const limitations = clean(input.limitations) || inferLimitations(sourceMaterial)
  const doi = normalizeDoi(input.doi) || extractDoi([sourceMaterial, input.source, input.url, input.pdf].filter(Boolean).join(' '))
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

  return {
    reviewStatus: 'محكّم',
    topic,
    studyType,
    methodology: clip(methodology, 3_200),
    sample: clip(sample, 4_800),
    researchQuestion: clip(researchQuestion, 3_200),
    keyFinding: clip(keyFinding, 4_800),
    contribution: clip(contribution, 3_200),
    applications: clip(applications, 3_200),
    limitations: clip(limitations, 3_200),
    evidenceLabel: evidenceScore >= 90 ? 'بيانات علمية مكتملة' : evidenceScore >= 76 ? 'بيانات علمية واضحة' : 'بيانات علمية أساسية',
    evidenceScore,
    doi,
    keywords,
    journal,
    year,
    openAccess,
    confidence,
    needsReview: false,
    analysisFingerprint: researchFingerprint(input),
    analysisSources,
    analyzedAt: clean(input.analyzedAt),
    links,
  }
}
