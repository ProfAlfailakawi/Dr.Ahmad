export type ResearchIntelligenceInput = {
  title?: string
  titleAr?: string
  meta?: string
  abstractAr?: string
  journal?: string
  source?: string
  url?: string
  pdf?: string
  doi?: string
  methodology?: string
  sample?: string
  researchQuestion?: string
  keyFinding?: string
  studyType?: string
  reviewStatus?: string
  keywords?: string
}

export type ResearchIntelligence = {
  reviewStatus: string
  studyType: string
  methodology: string
  sample: string
  researchQuestion: string
  keyFinding: string
  contribution: string
  evidenceLabel: string
  evidenceScore: number
  doi: string
  keywords: string
  openAccess: boolean
  confidence: number
  needsReview: boolean
  analyzedAt: string
}

const clean = (value = '') => value.replace(/^ملخص عربي:\s*/i, '').replace(/\s+/g, ' ').trim()
const first = (value = '') => clean(value).split(/(?<=[.!؟…])\s+/)[0] || clean(value)
const clip = (value: string, max = 260) => value.length <= max ? value : `${value.slice(0, max).replace(/\s+\S*$/, '')}…`
const pick = (text: string, patterns: RegExp[]) => patterns.map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean) || ''

const inferStudyType = (text: string) => {
  if (/مراجعة منهجية|systematic review|meta[- ]analysis|تحليل بعدي/i.test(text)) return 'مراجعة منهجية'
  if (/تجريب(?:ي|ية)|شبه تجريب|experimental|control group|مجموعة ضابطة/i.test(text)) return 'دراسة تجريبية'
  if (/مختلط|mixed methods?/i.test(text)) return 'منهج مختلط'
  if (/نوعي|qualitative|مقابلات|مجموعات تركيز/i.test(text)) return 'دراسة نوعية'
  if (/ارتباطي|correlational/i.test(text)) return 'دراسة ارتباطية'
  if (/مسح(?:ي|ية)|survey|استبانة|questionnaire/i.test(text)) return 'دراسة مسحية'
  if (/دراسة حالة|case study/i.test(text)) return 'دراسة حالة'
  if (/تحليل محتوى|content analysis/i.test(text)) return 'تحليل محتوى'
  if (/وصفي|descriptive/i.test(text)) return 'دراسة وصفية'
  return 'بحث أكاديمي'
}

const inferMethodology = (text: string, type: string) => pick(text, [
  /((?:اعتمدت|اعتمد|استخدمت|استخدم)\s+(?:الدراسة\s+)?(?:على\s+)?المنهج[^.؟]{0,180})[.؟]?/i,
  /((?:تم استخدام|جرى استخدام)\s+[^.؟]{0,180}(?:استبانة|مقابلة|تحليل محتوى|اختبار)[^.؟]{0,80})[.؟]?/i,
  /((?:descriptive|qualitative|quantitative|mixed|experimental)[^.]{0,160}(?:method|approach|design))[^.]*/i,
]) || ({
  'مراجعة منهجية': 'مراجعة منهجية للأدبيات وفق معايير الاختيار المذكورة في البحث.',
  'دراسة تجريبية': 'تصميم تجريبي أو شبه تجريبي يقارن الأثر بين حالات أو مجموعات.',
  'منهج مختلط': 'دمج بين أدوات كمية ونوعية لفهم الظاهرة من أكثر من زاوية.',
  'دراسة نوعية': 'مقاربة نوعية لتحليل الخبرات أو المعاني أو الممارسات.',
  'دراسة مسحية': 'منهج مسحي يعتمد أداة لجمع استجابات المشاركين.',
  'دراسة وصفية': 'منهج وصفي لتحليل الظاهرة في سياقها التعليمي.',
}[type] || '')

const inferSample = (text: string) => pick(text, [
  /((?:بلغ|تكونت|تكوّنت|اشتملت|شملت)\s+(?:عينة\s+)?(?:الدراسة\s+)?(?:من\s+)?\d{1,5}\s+[^.؟]{0,100})[.؟]?/i,
  /((?:sample|participants?)\s+(?:of|was|included)?\s*\d{1,5}[^.]{0,100})[.]?/i,
  /((?:عينة الدراسة|المشاركون)\s*[:：]?\s*\d{1,5}[^.؟]{0,100})[.؟]?/i,
])

const inferQuestion = (text: string, title: string) => pick(text, [
  /((?:سعى|يهدف|هدفت|هدف)\s+(?:هذا\s+)?(?:البحث|الدراسة)[^.؟]{0,220})[.؟]?/i,
  /((?:تتمثل مشكلة|تكمن مشكلة|يناقش البحث|تبحث الدراسة)[^.؟]{0,220})[.؟]?/i,
  /((?:aimed|aims|objective)[^.]{0,220})[.]?/i,
]) || (title ? `ما الذي يكشفه البحث حول «${title}» وما دلالته للممارسة التعليمية؟` : '')

const inferFinding = (text: string) => pick(text, [
  /((?:أظهرت النتائج|بيّنت النتائج|بينت النتائج|كشفت النتائج|توصلت الدراسة|خلصت الدراسة)[^.؟]{0,260})[.؟]?/i,
  /((?:تشير النتائج|اتضح|تبين أن|وُجد أن)[^.؟]{0,260})[.؟]?/i,
  /((?:results (?:showed|revealed|indicated)|the study found)[^.]{0,260})[.]?/i,
])

const inferContribution = (title: string, meta: string, finding: string) => {
  if (finding) return `تمنح هذه النتيجة أساساً أوضح لاتخاذ قرار مرتبط بـ${meta ? ` ${meta}` : ` ${title}`}.`
  if (/اتجاهات|وعي|قبول/i.test(`${title} ${meta}`)) return 'يقيس الاستعداد البشري والفكري للتطبيق قبل الاستثمار في الأداة أو المبادرة.'
  if (/فاعلية|أثر|effect/i.test(`${title} ${meta}`)) return 'يختبر قيمة الممارسة أو الأداة من خلال أثر يمكن مناقشته وقياسه.'
  if (/معوقات|تحديات|obstacle|barrier/i.test(`${title} ${meta}`)) return 'يشخّص العوائق التي تعطل التطبيق ويحدد مواضع التدخل الأكثر إلحاحاً.'
  return 'يضيف قراءة علمية موثقة تساعد على فهم القضية وتحويلها إلى قرار تربوي أكثر دقة.'
}

const inferKeywords = (text: string) => {
  const explicit = pick(text, [/(?:الكلمات المفتاحية|Keywords?)\s*[:：]\s*([^.\n]{4,220})/i])
  if (explicit) return explicit
  const candidates = ['تكنولوجيا التعليم', 'التعليم الإلكتروني', 'الذكاء الاصطناعي', 'التعلم', 'التدريس', 'المعلمون', 'أعضاء هيئة التدريس', 'الطلبة', 'التقويم', 'التحول الرقمي', 'الواقع المعزز', 'التربية الخاصة']
  return candidates.filter((item) => text.includes(item)).slice(0, 5).join('، ')
}

const extractDoi = (text: string) => (text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0] || '').replace(/[.,;]$/, '')

export function analyzeResearch(input: ResearchIntelligenceInput): ResearchIntelligence {
  const title = clean(input.titleAr || input.title)
  const abstract = clean(input.abstractAr)
  const meta = clean(input.meta)
  const journal = clean(input.journal)
  const source = clean(input.source || input.url || input.pdf)
  const text = clean([title, meta, abstract, journal, source].filter(Boolean).join(' '))
  const studyType = clean(input.studyType) || inferStudyType(text)
  const methodology = clean(input.methodology) || inferMethodology(text, studyType)
  const sample = clean(input.sample) || inferSample(text)
  const researchQuestion = clean(input.researchQuestion) || inferQuestion(abstract || meta, title)
  const keyFinding = clean(input.keyFinding) || inferFinding(abstract)
  const doi = clean(input.doi) || extractDoi(text)
  const keywords = clean(input.keywords) || inferKeywords(text)
  const reviewStatus = clean(input.reviewStatus) || (/محك[ّ]?م|peer[- ]reviewed|journal/i.test(journal + ' ' + meta) ? 'محكّم' : 'يحتاج توثيق حالة التحكيم')
  const contribution = inferContribution(title, meta, keyFinding)
  const openAccess = Boolean(source && (/\.pdf(?:$|\?)/i.test(source) || /researchgate|academia|repository|edu\.kw/i.test(source)))
  const completeness = [abstract, journal, methodology, sample, researchQuestion, keyFinding, doi].filter(Boolean).length
  const evidenceBase = studyType === 'مراجعة منهجية' ? 86 : studyType === 'دراسة تجريبية' ? 80 : studyType === 'منهج مختلط' ? 76 : studyType === 'دراسة نوعية' ? 70 : studyType === 'دراسة مسحية' ? 67 : 62
  const evidenceScore = Math.min(96, evidenceBase + Math.min(10, completeness * 2) - (!sample ? 5 : 0) - (!keyFinding ? 6 : 0))
  const evidenceLabel = evidenceScore >= 85 ? 'دليل قوي موثق' : evidenceScore >= 74 ? 'دليل جيد' : evidenceScore >= 64 ? 'دليل وصفي مفيد' : 'بياناته تحتاج استكمالاً'
  const confidence = Math.min(98, 38 + completeness * 8 + (title ? 7 : 0) + (abstract ? 10 : 0))
  const needsReview = confidence < 78 || !keyFinding || !methodology || reviewStatus.startsWith('يحتاج')
  return {
    reviewStatus, studyType, methodology: clip(methodology), sample: clip(sample), researchQuestion: clip(researchQuestion),
    keyFinding: clip(keyFinding), contribution: clip(contribution), evidenceLabel, evidenceScore, doi, keywords,
    openAccess, confidence, needsReview, analyzedAt: new Date().toISOString(),
  }
}

export function researchFingerprint(input: ResearchIntelligenceInput) {
  return analyzeResearch(input)
}
