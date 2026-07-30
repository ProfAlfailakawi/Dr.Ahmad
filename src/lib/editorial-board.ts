import type { IdeaDna } from './idea-dna'

export type EditorialVerdict = 'write_now' | 'change_angle' | 'wait' | 'update_existing' | 'reject'
export type EditorialSourceType = 'self' | 'friend' | 'colleague' | 'reader' | 'student' | 'meeting' | 'whatsapp' | 'encounter' | 'other'

export type EditorialSimilarity = {
  highest: number
  originality: number
  repeated: boolean
  warning: boolean
  matches: Array<{ slug: string; title: string; score: number; titleScore?: number; ideaScore?: number; phraseScore?: number }>
}

export type EditorialArchiveMaterial = {
  kind: 'article' | 'book' | 'paper'
  slug: string
  title: string
  url: string
  score: number
  date?: string
  excerpt?: string
}

export type EditorialCurrentEvent = {
  id: string
  title: string
  source: string
  url: string
  summary?: string
  publishedAt?: string
  ageHours?: number | null
  relevance?: number
}

export type EditorialAudienceEvidence = {
  available: boolean
  score: number | null
  messageMatches: Array<{ theme: string; count: number; strength: string }>
  readingMatches: Array<{ path: string; title: string; recent: number; total: number }>
  explanation: string
}

export type EditorialBoardInput = {
  idea: string
  audience: string
  angle: string
  sourceMode: 'self' | 'received'
  sourcePerson?: string
  sourceType?: EditorialSourceType
  sourceContext?: string
  dna: IdeaDna
  similarity: EditorialSimilarity
  graphMatches: Array<{ kind: string; slug: string; title: string; score: number; url: string; year?: string }>
  archiveMaterials: EditorialArchiveMaterial[]
  currentEvents: EditorialCurrentEvent[]
  currentContextAvailable: boolean
  currentContextError?: string
  audienceEvidence: EditorialAudienceEvidence
  suggestedTitle: string
  generatedAt?: string
}

export type EditorialScore = number | null

export type EditorialBoardDecision = {
  version: 1
  id: string
  fingerprint: string
  status: EditorialVerdict
  verdict: EditorialVerdict
  verdictLabel: string
  idea: string
  source: {
    mode: 'self' | 'received'
    person: string
    type: EditorialSourceType
    context: string
  }
  generatedAt: string
  scores: {
    strength: EditorialScore
    novelty: EditorialScore
    repetitionRisk: EditorialScore
    timing: EditorialScore
    identityFit: EditorialScore
    audienceInterest: EditorialScore
    articlePotential: EditorialScore
  }
  why: string[]
  archiveCourt: {
    summary: string
    repeated: string[]
    newGround: string[]
    nearest: EditorialArchiveMaterial[]
    contradictionOpportunity: string | null
  }
  timingRadar: {
    available: boolean
    score: EditorialScore
    mode: string
    explanation: string
    events: EditorialCurrentEvent[]
  }
  audienceRadar: EditorialAudienceEvidence
  editorialGap: {
    headline: string
    covered: string[]
    gap: string[]
  }
  devilAdvocate: {
    objection: string
    answer: string
  }
  plan: {
    primaryTitle: string
    alternatives: string[]
    thesis: string
    angle: string
    whyWorthWriting: string
    newValue: string
    doNotRepeat: string[]
    outline: string[]
    referencesNeeded: string[]
    archiveMaterials: EditorialArchiveMaterial[]
    expectedLength: string
    tone: string
    audience: string
    timing: string
    channel: 'مقال طويل' | 'مقال قصير' | 'رأي' | 'منشور مستقل' | 'كاروسيل' | 'تحديث مقال سابق' | 'فصل محتمل لكتاب'
  }
  waitingRoom: null | {
    reason: string
    trigger: string
    reviewAt: string
    triggers: Array<'event' | 'research' | 'audience'>
  }
  dataNotes: string[]
}

const VERDICT_LABELS: Record<EditorialVerdict, string> = {
  write_now: 'اكتب الآن',
  change_angle: 'اكتب لكن غيّر الزاوية',
  wait: 'انتظر',
  update_existing: 'حدّث مقالاً سابقاً بدل كتابة مقال جديد',
  reject: 'لا تكتب',
}

const ARABIC_STOP = new Set('من في على إلى الى عن هذا هذه ذلك التي الذي مع أو او ثم ما ماذا كيف هل لم لن قد كل بين عند بعد قبل عبر حول داخل خارج إن ان أن كان يكون تكون جدا جداً'.split(' '))

function normalize(value = '') {
  return String(value).toLowerCase().normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670ـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(value = '') {
  return [...new Set(normalize(value).split(' ').filter((word) => word.length > 2 && !ARABIC_STOP.has(word)))]
}

function hash(value: string) {
  let current = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index)
    current = Math.imul(current, 16777619)
  }
  return (current >>> 0).toString(16).padStart(8, '0')
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function mean(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => Number.isFinite(value))
  return valid.length ? clamp(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null
}

function unique(items: string[], limit = 8) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit)
}

function cleanIdeaTitle(idea: string) {
  return idea.trim().replace(/[؟?!.…]+$/g, '').replace(/^[-–—\s]+|[-–—\s]+$/g, '')
}

function datePlusDays(iso: string, days: number) {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function timingFrom(input: EditorialBoardInput) {
  if (!input.currentContextAvailable) {
    return {
      available: false,
      score: null as number | null,
      explanation: input.currentContextError
        ? 'تعذّر فحص السياق الحالي؛ لم يدخل التوقيت في الدرجة، وبقي قرار الأرشيف سليماً.'
        : 'السياق الحالي غير متاح؛ لم تُخترع درجة توقيت.',
    }
  }
  if (!input.currentEvents.length) {
    const evergreen = input.dna.time.mode === 'evergreen'
    return {
      available: true,
      score: evergreen ? 58 : 24,
      explanation: evergreen
        ? 'لا توجد موجة راهنة واضحة، لكن الفكرة دائمة الصلاحية؛ لا تحتاج حدثاً كي تُكتب.'
        : 'لم يظهر سبب تحريري راهن قوي في المصادر الحالية؛ التوقيت أضعف من الفكرة نفسها.',
    }
  }
  const strongest = Math.max(...input.currentEvents.map((item) => Number(item.relevance || 0)))
  const fresh = input.currentEvents.some((item) => Number.isFinite(Number(item.ageHours)) && Number(item.ageHours) <= 72)
  const score = clamp(42 + Math.min(43, strongest * 5) + (fresh ? 10 : 0))
  return {
    available: true,
    score,
    explanation: `وجد الرادار ${input.currentEvents.length} رابطاً راهناً ذا صلة؛ أقوى إشارة تحريرية بلغت ${strongest} في مقياس الرادار الداخلي${fresh ? ' وبينها مادة حديثة خلال 72 ساعة' : ''}.`,
  }
}

function identityFit(input: EditorialBoardInput) {
  if (!input.graphMatches.length && !input.archiveMaterials.length) return null
  const topGraph = Math.max(0, ...input.graphMatches.map((item) => item.score))
  const crossKinds = new Set(input.graphMatches.filter((item) => item.score > 0).map((item) => item.kind)).size
  const archiveBreadth = Math.min(22, input.archiveMaterials.length * 4)
  return clamp(38 + Math.min(34, topGraph * 3) + Math.min(12, crossKinds * 4) + archiveBreadth)
}

function gapTokens(input: EditorialBoardInput) {
  const idea = tokens(`${input.idea} ${input.sourceContext || ''}`)
  const nearest = input.archiveMaterials.filter((item) => item.kind === 'article').slice(0, 3)
  const archive = new Set(tokens(nearest.map((item) => `${item.title} ${item.excerpt || ''}`).join(' ')))
  return idea.filter((word) => !archive.has(word)).slice(0, 5)
}

function strongestCovered(input: EditorialBoardInput) {
  const nearest = input.archiveMaterials.find((item) => item.kind === 'article')
  if (!nearest) return ['لا توجد مادة سابقة قريبة بما يكفي لاعتبارها تغطية سابقة.']
  const percentage = clamp((input.similarity.highest || 0) * 100)
  return [
    `أقرب مادة سابقة هي «${nearest.title}» وتشابهها البنيوي مع المقترح ${percentage}٪.`,
    ...(input.dna.novelty.nearest ? [`Idea DNA يرى أقرب صدى أرشيفي في «${input.dna.novelty.nearest.title}».`] : []),
  ]
}

function buildGap(input: EditorialBoardInput) {
  const novelWords = gapTokens(input)
  const nearest = input.archiveMaterials.find((item) => item.kind === 'article')
  if (!nearest) {
    return {
      headline: 'الفجوة هنا ليست في تغيير عنوان قديم؛ بل في تأسيس مدخل جديد داخل الأرشيف.',
      covered: ['لا توجد تغطية سابقة قريبة بدرجة عالية.'],
      gap: unique([
        novelWords.length ? `المفاهيم الأقل حضوراً في أقرب المواد: ${novelWords.join('، ')}.` : '',
        `ابنِ المقال حول السؤال المحدد في «${cleanIdeaTitle(input.idea)}» لا حول الموضوع العام فقط.`,
      ]),
    }
  }
  return {
    headline: input.similarity.highest >= .52
      ? `الفراغ ليس في الموضوع العام؛ بل في الزاوية التي لم يحسمها مقال «${nearest.title}».`
      : 'الموضوع له جذور في الأرشيف، لكن زاوية المقترح ما زالت تملك مساحة مستقلة.',
    covered: strongestCovered(input),
    gap: unique([
      novelWords.length ? `ركّز على: ${novelWords.join('، ')}؛ فهي أقل حضوراً في المواد الأقرب.` : '',
      input.dna.time.mode === 'current' ? 'اختبر ما تغيّر الآن مقارنة بما قيل في الأرشيف، لا تعِد مقدمة التحول الرقمي.' : '',
      input.sourceContext ? `استفد من سياق وصول الفكرة: ${input.sourceContext}` : '',
    ]),
  }
}

function selectVerdict(input: EditorialBoardInput, timingScore: number | null, identityScore: number | null): EditorialVerdict {
  const repetition = clamp(input.similarity.highest * 100)
  const novelty = input.dna.novelty.score
  const wordCount = tokens(input.idea).length
  const audienceScore = input.audienceEvidence.score

  if (repetition >= 72 && novelty <= 48 && input.similarity.matches[0]) return 'update_existing'
  if (wordCount <= 2 && input.dna.depth.score <= 32 && input.dna.evidence.score <= 30 && repetition >= 45) return 'reject'
  if (wordCount <= 3 && input.dna.depth.score <= 30 && (audienceScore == null || audienceScore < 20) && (identityScore == null || identityScore < 45)) return 'reject'
  if (input.dna.time.mode === 'future' && (timingScore == null || timingScore < 45)) return 'wait'
  if (input.dna.time.mode === 'current' && timingScore != null && timingScore < 30 && input.dna.novelty.score < 70) return 'wait'
  if (repetition >= 48 || (repetition >= 38 && novelty < 67)) return 'change_angle'
  return 'write_now'
}

function devil(input: EditorialBoardInput, verdict: EditorialVerdict) {
  const nearest = input.archiveMaterials.find((item) => item.kind === 'article')
  if (verdict === 'update_existing') return {
    objection: `أقوى اعتراض: إنشاء صفحة جديدة سيقسم الفكرة بين مقالتين متقاربتين ويضعف قيمة المادة الأصلية${nearest ? ` «${nearest.title}»` : ''}.`,
    answer: 'حدّث المادة السابقة بما تغيّر، وأضف فقرة واضحة تشرح الجديد وتاريخ التحديث؛ لا تنشئ مقالاً موازياً إلا إذا تغيّرت الأطروحة نفسها.',
  }
  if (verdict === 'reject') return {
    objection: 'أقوى اعتراض: الفكرة في صورتها الحالية أضعف من أن تحمل مقالاً مستقلاً؛ العنوان أكبر من المادة الجديدة المتاحة.',
    answer: 'حوّلها إلى ملاحظة أو منشور قصير، أو أعدها للمجلس بعد إضافة سؤال محدد أو دليل أو حالة تجعل لها أطروحة قابلة للدفاع.',
  }
  if (verdict === 'wait') return {
    objection: 'أقوى اعتراض: النشر الآن يستهلك الفكرة قبل أن تتكوّن لها لحظة أو مادة إثبات كافية.',
    answer: 'احتفظ بالزاوية، واربط العودة إليها بإشارة قابلة للرصد: دراسة جديدة، حدث مرتبط، أو تكرار ملموس في أسئلة الجمهور.',
  }
  if (input.similarity.highest >= .38) return {
    objection: `أكبر خطر: أن يقرأها الزائر كتكرار لمادة «${nearest?.title || input.similarity.matches[0]?.title || 'سابقة'}» بصياغة جديدة فقط.`,
    answer: 'ابدأ من الفرق لا من الخلفية: اذكر ما قيل سابقاً باختصار، ثم اجعل كل بنية المقال تخدم السؤال الجديد وحده.',
  }
  return {
    objection: 'أكبر خطر: أن يتحول المقال إلى شرح عام يمكن لأي كاتب أن يقوله بلا بصمة خاصة.',
    answer: 'اجعل الأطروحة قابلة للاختبار، واربطها بمادة من أرشيفك وبسؤال عملي واحد، ثم احذف كل فقرة لا تغيّر جواب القارئ عن ذلك السؤال.',
  }
}

function planFor(input: EditorialBoardInput, verdict: EditorialVerdict, gap: ReturnType<typeof buildGap>, timingScore: number | null) {
  const raw = cleanIdeaTitle(input.idea)
  const nearest = input.archiveMaterials.find((item) => item.kind === 'article')
  const gapPhrase = gapTokens(input).slice(0, 2).join(' و')
  const primaryTitle = verdict === 'update_existing' && nearest
    ? nearest.title
    : verdict === 'change_angle' && gapPhrase
      ? `${raw}: ما الذي يتغيّر حين ندخل ${gapPhrase} في السؤال؟`
      : input.suggestedTitle || raw
  const alternatives = verdict === 'update_existing' ? [] : unique([
    raw.startsWith('هل') || raw.startsWith('كيف') || raw.startsWith('لماذا') ? raw : `ماذا يحدث حين يصبح ${raw} قراراً يومياً؟`,
    gapPhrase ? `${gapPhrase}… الزاوية التي يغفلها النقاش حول ${raw}` : `ما الذي لا نقوله عادةً عن ${raw}؟`,
    input.dna.time.mode === 'current' ? `${raw}: ما الذي تغيّر الآن؟` : `${raw} بين الوعد والأثر الحقيقي`,
  ], 3)
  const longForm = input.dna.depth.score >= 62 || input.dna.evidence.score >= 58
  const channel: EditorialBoardDecision['plan']['channel'] = verdict === 'update_existing'
    ? 'تحديث مقال سابق'
    : verdict === 'reject'
      ? 'منشور مستقل'
      : input.dna.depth.score >= 82 && input.graphMatches.some((item) => item.kind === 'book')
        ? 'فصل محتمل لكتاب'
        : longForm ? 'مقال طويل' : 'مقال قصير'
  const thesis = verdict === 'update_existing'
    ? `القيمة ليست في مقال جديد؛ بل في جعل المادة السابقة تجيب ما تغيّر في سؤال «${raw}».`
    : `المقال يستحق أن يثبت أن «${raw}» ليس موضوعاً عاماً، بل قراراً له أثر محدد يمكن تفكيكه وقياسه.`
  const doNotRepeat = unique(input.similarity.matches.slice(0, 3).map((item) => `لا تعِد الحجة المركزية أو المقدمة التي استُخدمت في «${item.title}».`))
  const referencesNeeded = unique([
    input.dna.evidence.score < 58 ? 'دراسة حديثة أو مراجعة منهجية تثبت حجم الظاهرة قبل بناء استنتاج قوي.' : '',
    input.currentEvents.length ? `المصدر الراهن الأقوى: ${input.currentEvents[0].source} — للتحقق من السياق لا لبناء المقال كله على الترند.` : '',
    input.audienceEvidence.messageMatches.length ? 'استخدم إشارة الجمهور كمؤشر حاجة فقط، من دون نقل أي رسالة أو بيانات شخصية.' : '',
    input.graphMatches.some((item) => item.kind === 'paper') ? 'راجع البحث المرتبط في الأرشيف قبل صياغة الفقرة الأكاديمية.' : '',
  ])
  return {
    primaryTitle,
    alternatives,
    thesis,
    angle: gap.headline,
    whyWorthWriting: verdict === 'update_existing'
      ? 'لأن المادة القائمة قوية بما يكفي لتتحمل التحديث، وإنشاء مقال مكرر سيضعف الأرشيف.'
      : `لأن المجلس وجد ${input.similarity.highest < .48 ? 'مساحة جديدة قابلة للدفاع' : 'زاوية جديدة داخل موضوع سبق الاقتراب منه'}، لا مجرد عنوان جذاب.`,
    newValue: gap.gap[0] || 'التركيز على أثر الفكرة في القرار والممارسة لا إعادة وصف الموضوع.',
    doNotRepeat,
    outline: unique([
      'افتتاحية بموقف أو سؤال يكشف المشكلة من دون مقدمة مدرسية.',
      nearest ? `ما الذي قاله الأرشيف سابقاً في «${nearest.title}» — فقرة واحدة فقط.` : 'تحديد المصطلح أو الظاهرة بالقدر الضروري فقط.',
      `الفراغ التحريري: ${gap.gap[0] || 'ما الذي لم يُناقش بعد؟'}`,
      input.currentEvents.length ? 'ما الذي تغيّر في اللحظة الحالية، وما الذي لم يتغيّر؟' : '',
      'الاعتراض الأقوى على الأطروحة ثم الرد عليه بالدليل.',
      'خاتمة تقود إلى قرار أو سؤال قابل للتطبيق، لا إعادة تلخيص.',
    ], 6),
    referencesNeeded,
    archiveMaterials: input.archiveMaterials.slice(0, 8),
    expectedLength: verdict === 'update_existing' ? 'تحديث مركز داخل المقال القائم؛ لا تُضخّم النص لمجرد التحديث.' : longForm ? '900–1500 كلمة مبدئياً، ويُحسم الطول بعد اكتمال الدليل.' : '500–850 كلمة؛ إن لم تحتج أكثر فلا تطِل.',
    tone: input.dna.tone.label,
    audience: input.audience || input.dna.audience.primary,
    timing: timingScore == null ? 'لا توجد بيانات توقيت كافية؛ لا تجعل الغياب سبباً مصطنعاً للاستعجال.' : timingScore >= 70 ? 'نافذة نشر قوية الآن.' : timingScore >= 45 ? 'التوقيت مقبول، والقيمة الفكرية أهم من السرعة.' : 'التوقيت ضعيف؛ لا تنشر لمجرد ملء الجدول.',
    channel,
  }
}

export function buildEditorialBoardDecision(input: EditorialBoardInput): EditorialBoardDecision {
  const generatedAt = input.generatedAt || new Date().toISOString()
  const timing = timingFrom(input)
  const identity = identityFit(input)
  const novelty = clamp(input.dna.novelty.score)
  const repetitionRisk = clamp((input.similarity.highest || 0) * 100)
  const articlePotential = mean([
    novelty,
    100 - repetitionRisk,
    input.dna.depth.score,
    input.dna.evidence.score,
    identity,
    input.audienceEvidence.score,
    timing.score,
  ])
  const strength = mean([
    articlePotential,
    identity,
    input.audienceEvidence.score,
    timing.score,
  ])
  const verdict = selectVerdict(input, timing.score, identity)
  const gap = buildGap(input)
  const devilAdvocate = devil(input, verdict)
  const plan = planFor(input, verdict, gap, timing.score)
  const nearestArticle = input.archiveMaterials.find((item) => item.kind === 'article')
  const why = unique([
    `الجِدة بالنسبة إلى الأرشيف ${novelty}٪ وفق Idea DNA، وخطر التكرار ${repetitionRisk}٪ وفق فحص التشابه الفعلي للمحتوى.`,
    identity == null ? 'لا توجد بيانات كافية لدرجة ملاءمة الهوية.' : `خريطة المعرفة أعطت ملاءمة ${identity}٪ بناءً على صلات حقيقية بين المقالات والكتب والأبحاث.`,
    timing.explanation,
    input.audienceEvidence.explanation,
    verdict === 'update_existing' && nearestArticle ? `الأقرب «${nearestArticle.title}» قريب بما يكفي لأن يكون تحديثه أفضل من تقسيم الفكرة.` : '',
  ], 6)
  const waitingRoom = verdict === 'wait' ? {
    reason: timing.score != null && timing.score < 35 ? 'الفكرة قابلة للحياة، لكن لا توجد نافذة نشر قوية الآن.' : 'الفكرة تحتاج إشارة خارجية أو دليلاً إضافياً قبل استهلاكها في مقال.',
    trigger: input.dna.evidence.score < 58 ? 'ارجع إليها عند ظهور دراسة جديدة موثوقة أو سؤال جمهور متكرر.' : 'ارجع إليها عند ظهور حدث أو تطور يجعل الزاوية الحالية ضرورية لا اختيارية.',
    reviewAt: datePlusDays(generatedAt, input.dna.time.mode === 'future' ? 30 : 14),
    triggers: unique(['event', input.dna.evidence.score < 58 ? 'research' : '', input.audienceEvidence.available ? 'audience' : ''].filter(Boolean) as Array<'event' | 'research' | 'audience'>, 3) as Array<'event' | 'research' | 'audience'>,
  } : null
  const dataNotes = unique([
    !input.currentContextAvailable ? 'السياق الحالي لم يدخل في الدرجة لأن الرادار لم يكن متاحاً.' : '',
    !input.audienceEvidence.available ? 'لا توجد بيانات جمهور كافية؛ لم تُخترع درجة اهتمام.' : '',
    !input.graphMatches.length ? 'لم تُرجع خريطة المعرفة صلة كافية؛ اعتمد المجلس على فحص التشابه والأرشيف المباشر.' : '',
  ])
  const fingerprint = `editorial-${hash(`${normalize(input.idea)}::${input.sourceMode}::${normalize(input.sourceContext || '')}`)}`
  return {
    version: 1,
    id: `${fingerprint}-${hash(generatedAt)}`,
    fingerprint,
    status: verdict,
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    idea: input.idea.trim(),
    source: {
      mode: input.sourceMode,
      person: input.sourceMode === 'received' ? String(input.sourcePerson || '').trim() : '',
      type: input.sourceMode === 'received' ? (input.sourceType || 'other') : 'self',
      context: input.sourceMode === 'received' ? String(input.sourceContext || '').trim() : '',
    },
    generatedAt,
    scores: {
      strength,
      novelty,
      repetitionRisk,
      timing: timing.score,
      identityFit: identity,
      audienceInterest: input.audienceEvidence.score,
      articlePotential,
    },
    why,
    archiveCourt: {
      summary: nearestArticle
        ? `أقرب مادة «${nearestArticle.title}». التشابه ${repetitionRisk}٪، بينما Idea DNA يقدّر الجِدة ${novelty}٪؛ القرار مبني على الفرق بين تكرار الموضوع وتكرار الزاوية.`
        : 'لم نجد مادة سابقة قريبة بدرجة كافية؛ هذا يرفع الجِدة لكنه لا يثبت وحده أن الفكرة تستحق مقالاً.',
      repeated: strongestCovered(input),
      newGround: gap.gap,
      nearest: input.archiveMaterials.slice(0, 5),
      contradictionOpportunity: input.dna.time.mode === 'retrospective' && nearestArticle
        ? `افحص إن كان موقفك الحالي يختلف فعلاً عن «${nearestArticle.title}». إذا تغيّر الموقف بالدليل، يمكن أن تصبح الزاوية «كيف تغيّر رأيي في…» بدلاً من إخفاء الاختلاف.`
        : null,
    },
    timingRadar: {
      available: timing.available,
      score: timing.score,
      mode: input.dna.time.label,
      explanation: timing.explanation,
      events: input.currentEvents.slice(0, 4),
    },
    audienceRadar: input.audienceEvidence,
    editorialGap: gap,
    devilAdvocate,
    plan,
    waitingRoom,
    dataNotes,
  }
}

export function editorialScoreLabel(value: EditorialScore) {
  return value == null ? 'لا توجد بيانات كافية' : `${value}/100`
}
