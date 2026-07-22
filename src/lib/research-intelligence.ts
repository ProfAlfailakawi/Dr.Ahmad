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

const clean = (value = '') => String(value).replace(/^ملخص عربي:\s*/i, '').replace(/\s+/g, ' ').trim()
const clip = (value: string, max = 520) => value.length <= max ? value : `${value.slice(0, max).replace(/\s+\S*$/, '')}…`
const pick = (text: string, patterns: RegExp[]) => patterns.map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean) || ''
const normalizeUrl = (value = '') => /^https?:\/\//i.test(value.trim()) ? value.trim() : ''

const inferStudyType = (text: string) => {
  if (/مراجعة منهجية|systematic review|meta[- ]analysis|تحليل بعدي/i.test(text)) return 'مراجعة منهجية'
  if (/شبه تجريب|quasi[- ]experimental/i.test(text)) return 'دراسة شبه تجريبية'
  if (/تجريب(?:ي|ية)|experimental|control group|مجموعة ضابطة/i.test(text)) return 'دراسة تجريبية'
  if (/مختلط|mixed methods?/i.test(text)) return 'منهج مختلط'
  if (/نوعي|qualitative|مقابلات|مجموعات تركيز/i.test(text)) return 'دراسة نوعية'
  if (/ارتباطي|correlational/i.test(text)) return 'دراسة ارتباطية'
  if (/مسح(?:ي|ية)|survey|استبانة|questionnaire/i.test(text)) return /وصفي|descriptive/i.test(text) ? 'دراسة وصفية مسحية' : 'دراسة مسحية'
  if (/دراسة حالة|case study/i.test(text)) return 'دراسة حالة'
  if (/تحليل محتوى|content analysis/i.test(text)) return 'تحليل محتوى'
  if (/وصفي|descriptive/i.test(text)) return 'دراسة وصفية'
  return 'دراسة أكاديمية'
}

const inferMethodology = (text: string) => pick(text, [
  /((?:اعتمدت|اعتمد|استخدمت|استخدم|اتبعت|اتبع)\s+(?:الدراسة\s+|البحث\s+)?(?:على\s+)?(?:المنهج|تصميماً|تصميمًا)[^.؟]{0,260})[.؟]?/i,
  /((?:تم استخدام|جرى استخدام|طُبقت|طبقت)\s+[^.؟]{0,240}(?:استبانة|استبيان|مقابلة|تحليل محتوى|اختبار|مقياس)[^.؟]{0,120})[.؟]?/i,
  /((?:(?:descriptive|qualitative|quantitative|mixed|experimental|survey)[^.]{0,180}(?:method|approach|design))[^.]*)/i,
])

const inferSample = (text: string) => pick(text, [
  /((?:بلغ|تكونت|تكوّنت|اشتملت|شملت|تألفت|تألّفت)\s+(?:عينة\s+)?(?:البحث|الدراسة)?\s*(?:من\s+)?\(?\s*\d{1,5}\s*\)?\s*[^.؟]{0,220})[.؟]?/i,
  /((?:طُبقت|طبقت|وُزعت|وزعت)\s+[^.؟]{0,100}(?:على|لدى)\s+(?:عينة\s+)?(?:قوامها|بلغت)?\s*\(?\s*\d{1,5}\s*\)?\s*[^.؟]{0,180})[.؟]?/i,
  /((?:عينة الدراسة|عينة البحث|المشاركون|المشاركات)\s*[:：،]?\s*(?:قوامها|بلغت|من)?\s*\(?\s*\d{1,5}\s*\)?\s*[^.؟]{0,220})[.؟]?/i,
  /((?:sample|participants?|respondents?)\s+(?:of|was|included|comprised|consisted of)?\s*\(?\s*\d{1,5}\s*\)?[^.]{0,180})[.]?/i,
])

const inferQuestion = (text: string, title: string) => pick(text, [
  /((?:سعى|يسعى|يهدف|هدفت|هدف)\s+(?:هذا\s+)?(?:البحث|الدراسة)[^.؟]{0,300})[.؟]?/i,
  /((?:تتمثل مشكلة|تكمن مشكلة|يناقش البحث|تبحث الدراسة|تقصت الدراسة|استهدفت الدراسة)[^.؟]{0,300})[.؟]?/i,
  /((?:aimed|aims|objective|purpose of (?:the )?study)[^.]{0,300})[.]?/i,
]) || (title ? `ما الذي يكشفه البحث حول «${title}»؟` : '')

const inferFinding = (text: string) => pick(text, [
  /((?:أظهرت النتائج|بيّنت النتائج|بينت النتائج|كشفت النتائج|أسفرت النتائج|توصلت الدراسة|خلصت الدراسة)[^.؟]{0,420})[.؟]?/i,
  /((?:تشير النتائج|اتضح|تبين أن|تبيّن أن|وُجد أن)[^.؟]{0,420})[.؟]?/i,
  /((?:results (?:showed|revealed|indicated)|the study found|findings (?:showed|revealed|indicated))[^.]{0,420})[.]?/i,
])

const inferApplications = (text: string) => pick(text, [
  /((?:أوصت الدراسة|يوصي البحث|توصي النتائج|وتوصي الدراسة|من التطبيقات|التطبيقات العملية)[^.؟]{0,420})[.؟]?/i,
  /((?:the study recommends|practical implications?|implications for practice)[^.]{0,420})[.]?/i,
])

const inferLimitations = (text: string) => pick(text, [
  /((?:حدود الدراسة|محددات الدراسة|قيود الدراسة|ومن قيود|اقتصرت الدراسة)[^.؟]{0,420})[.؟]?/i,
  /((?:limitations? of (?:the )?study|the study was limited)[^.]{0,420})[.]?/i,
])

const inferContribution = (title: string, meta: string, finding: string, applications: string) => {
  if (applications) return applications
  if (finding) return `يحوّل البحث النتيجة إلى أساس علمي يمكن الاستناد إليه في القرارات المرتبطة بـ${meta || title}.`
  if (/اتجاهات|وعي|قبول/i.test(`${title} ${meta}`)) return 'يوضح مستوى الاستعداد والقبول المهني قبل توسيع التطبيق.'
  if (/فاعلية|أثر|effect/i.test(`${title} ${meta}`)) return 'يقدم أساساً لقياس أثر الممارسة أو الأداة التعليمية.'
  if (/معوقات|تحديات|obstacle|barrier/i.test(`${title} ${meta}`)) return 'يحدد مواضع التدخل ذات الأولوية لتحسين التطبيق.'
  return title ? `يضيف قراءة علمية منظمة لقضية ${title}.` : ''
}

const inferKeywords = (text: string) => {
  const explicit = pick(text, [/(?:الكلمات المفتاحية|Keywords?)\s*[:：]\s*([^\n]{4,280})/i])
  if (explicit) return explicit.replace(/[.؛;]+$/, '')
  const candidates = ['تكنولوجيا التعليم', 'التعليم الإلكتروني', 'الذكاء الاصطناعي', 'التعلم', 'التدريس', 'المعلمون', 'أعضاء هيئة التدريس', 'الطلبة', 'التقويم', 'التحول الرقمي', 'الواقع المعزز', 'التربية الخاصة']
  return candidates.filter((item) => text.includes(item)).slice(0, 6).join('، ')
}

const extractDoi = (text: string) => (text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0] || '').replace(/[.,;]+$/, '')
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
    input.title, input.titleAr, input.meta, input.abstractAr, input.journal, input.source, input.url, input.pdf,
    input.scholar, input.researchgate, input.orcid, input.repository, input.doi, input.methodology, input.sample,
    input.researchQuestion, input.keyFinding, input.contribution, input.applications, input.limitations, input.studyType,
    input.keywords, input.iso, input.date, input.year, input.metadataText, input.pdfText, input.analysisText,
  ].map(clean).join('\u241f')
  return stableHash(payload)
}

export function researchLinks(input: ResearchIntelligenceInput, doiValue = ''): ResearchSourceLink[] {
  const doi = clean(doiValue || input.doi || extractDoi([input.source, input.url, input.pdf].filter(Boolean).join(' ')))
  const candidates: ResearchSourceLink[] = [
    { id: 'publisher', label: 'صفحة المجلة', url: normalizeUrl(input.source || input.url) },
    { id: 'pdf', label: 'النص الكامل PDF', url: normalizeUrl(input.pdf) },
    { id: 'doi', label: 'DOI', url: doi ? `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')}` : '' },
    { id: 'researchgate', label: 'ResearchGate', url: normalizeUrl(input.researchgate) },
    { id: 'scholar', label: 'Google Scholar', url: normalizeUrl(input.scholar) },
    { id: 'orcid', label: 'ORCID', url: normalizeUrl(input.orcid) },
    { id: 'repository', label: 'مستودع الجامعة', url: normalizeUrl(input.repository) },
  ]
  const seen = new Set<string>()
  return candidates.filter((item) => {
    if (!item.url || seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

export function analyzeResearch(input: ResearchIntelligenceInput): ResearchIntelligence {
  const title = clean(input.titleAr || input.title)
  const abstract = clean(input.abstractAr)
  const meta = clean(input.meta)
  const journal = clean(input.journal)
  const sourceMaterial = [
    title, meta, abstract, journal, clean(input.metadataText), clean(input.pdfText), clean(input.analysisText),
    clean(input.methodology), clean(input.sample), clean(input.researchQuestion), clean(input.keyFinding),
    clean(input.applications), clean(input.limitations), clean(input.keywords), clean(input.doi),
  ].filter(Boolean).join(' ')
  const studyType = clean(input.studyType) || inferStudyType(sourceMaterial)
  const methodology = clean(input.methodology) || inferMethodology(sourceMaterial)
  const sample = clean(input.sample) || inferSample(sourceMaterial)
  const researchQuestion = clean(input.researchQuestion) || inferQuestion(sourceMaterial, title)
  const keyFinding = clean(input.keyFinding) || inferFinding(sourceMaterial)
  const applications = clean(input.applications) || inferApplications(sourceMaterial)
  const limitations = clean(input.limitations) || inferLimitations(sourceMaterial)
  const doi = clean(input.doi) || extractDoi(sourceMaterial)
  const keywords = clean(input.keywords) || inferKeywords(sourceMaterial)
  const contribution = clean(input.contribution) || inferContribution(title, meta, keyFinding, applications)
  const year = extractYear(input, `${journal} ${sourceMaterial}`)
  const links = researchLinks(input, doi)
  const openAccess = links.some((item) => item.id === 'pdf' || item.id === 'repository' || item.id === 'researchgate')
  const available = [abstract, journal, methodology, sample, researchQuestion, keyFinding, doi, keywords, applications].filter(Boolean).length
  const evidenceScore = Math.min(100, 58 + available * 4 + (input.pdfText ? 4 : 0) + (input.metadataText ? 3 : 0))
  const confidence = Math.min(100, 46 + available * 5 + (abstract ? 6 : 0) + (input.pdfText ? 7 : 0) + (input.metadataText ? 4 : 0))
  const analysisSources = clean(input.analysisSources) || [abstract && 'الملخص', input.pdfText && 'PDF', input.metadataText && 'Metadata', doi && 'DOI', links.length && 'الروابط'].filter(Boolean).join('، ')

  return {
    reviewStatus: 'محكّم',
    studyType,
    methodology: clip(methodology),
    sample: clip(sample),
    researchQuestion: clip(researchQuestion),
    keyFinding: clip(keyFinding),
    contribution: clip(contribution),
    applications: clip(applications),
    limitations: clip(limitations),
    evidenceLabel: evidenceScore >= 88 ? 'بيانات علمية مكتملة' : evidenceScore >= 74 ? 'بيانات علمية واضحة' : 'بيانات علمية أساسية',
    evidenceScore,
    doi,
    keywords,
    journal,
    year,
    openAccess,
    confidence,
    needsReview: confidence < 72,
    analysisFingerprint: researchFingerprint(input),
    analysisSources,
    analyzedAt: clean(input.analyzedAt),
    links,
  }
}
