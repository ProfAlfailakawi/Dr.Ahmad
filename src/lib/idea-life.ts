import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from './cms'
import { toRoot } from './dialect-lexicon'

export type IdeaCertainty = 'حقيقة موثقة' | 'استنتاج' | 'موقف قيمي' | 'توقع'
export type PredictionStatus = 'قيد المتابعة' | 'ظهرت إشارة لاحقة' | 'تحتاج زمناً أطول'
export type ImpactKind = 'origin' | 'article' | 'book' | 'paper' | 'media' | 'application' | 'external'

export type RemoteIdeaSignal = {
  title: string
  summary?: string
  url: string
  source?: string
  publishedAt?: string
  type?: 'academic' | 'media' | 'application' | 'direct'
  confidence?: number
  relation?: string
}

export type RemotePredictionReview = {
  quote: string
  status?: string
  reviewedAt?: string
  evidence?: RemoteIdeaSignal[]
  dimensions?: Partial<Record<'direction' | 'timing' | 'scale' | 'scope', string>>
}

export type IdeaLifeRemoteRecord = {
  id?: string
  slug: string
  kind?: 'article' | 'paper'
  checkedAt?: string
  predictions?: RemotePredictionReview[]
  signals?: RemoteIdeaSignal[]
}

export type IdeaTest = {
  claim: string
  counterargument: string
  pressureTests: string[]
  resilientCore: string
  reconsiderWhen: string
  certainty: IdeaCertainty
}

export type PredictionRecord = {
  quote: string
  status: PredictionStatus | string
  dimensions: {
    direction: string
    timing: string
    scale: string
    scope: string
  }
  laterArticle?: ArticleRecord
  evidence?: RemoteIdeaSignal[]
}

export type TimeLink = {
  role: 'جذر' | 'تطور'
  article: ArticleRecord
  overlap: number
}

export type ImpactNode = {
  kind: ImpactKind
  label: string
  title: string
  note: string
  year?: string
  url?: string
  to?: string
  source?: string
  confidence: 'موثق' | 'صلة قوية'
}

export type IdeaLifeModel = {
  test: IdeaTest
  predictions: PredictionRecord[]
  timeLinks: TimeLink[]
  impact: ImpactNode[]
  signature: string
}

const AR_STOP = new Set([
  'على', 'إلى', 'الى', 'من', 'في', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
  'بين', 'بعد', 'قبل', 'عند', 'حتى', 'كان', 'كانت', 'هل', 'ما', 'لا', 'لم', 'لن', 'قد',
  'ثم', 'أو', 'او', 'أم', 'بل', 'كل', 'بعض', 'غير', 'نحو', 'لدى', 'منذ', 'حين', 'حول',
  'أن', 'ان', 'إن', 'لأن', 'كيف', 'أين', 'ليس', 'وهو', 'وهي', 'لكن', 'كما', 'أكثر', 'يمكن',
])

export const normalizeIdeaText = (value = '') => value
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^\w\u0600-\u06FF ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const ideaWords = (value = '') => Array.from(new Set(
  normalizeIdeaText(value)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !AR_STOP.has(word))
    .map(toRoot)
    .filter((word) => word.length > 2),
))

const sentences = (value = '') => value
  .replace(/\r/g, '')
  .split(/(?<=[.!؟…])\s+|\n{2,}/)
  .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
  .filter((sentence) => sentence.length >= 45)

const overlapCount = (left = '', right = '') => {
  const mine = new Set(ideaWords(left))
  return ideaWords(right).reduce((count, word) => count + (mine.has(word) ? 1 : 0), 0)
}

const overlapRatio = (left = '', right = '') => {
  const a = ideaWords(left)
  const b = ideaWords(right)
  if (!a.length || !b.length) return 0
  const set = new Set(a)
  return b.filter((word) => set.has(word)).length / Math.max(3, Math.min(a.length, b.length))
}

const FUTURE_RE = /(?:^|[\s،؛:!.؟?()\[\]{}«»\"'…-])(?:سوف|سيكون|ستكون|سيصبح|ستصبح|سنرى|سنشهد|سيؤدي|ستؤدي|سيزداد|ستزداد|سيقل|ستقل|سيتراجع|ستتراجع|ستنتهي|سيختفي|ستختفي|سيحل|ستحل|ستتغير|سيتغير|مستقبلاً|في المستقبل|في السنوات القادمة|في الأعوام القادمة|خلال السنوات|خلال الأعوام|ربما نشهد|قد يصبح|قد تتحول|قد نصل|لن يعود)(?=$|[\s،؛:!.؟?()\[\]{}«»\"'…-])/i
const FUTURE_QUESTION_RE = /(?:^| )(?:ف)?(?:هل|كيف|متي|ماذا|ما الذي) (?:سوف |سي|ست|سن)|(?:لا احد يعرف|لا نعرف|لا ندري|نتساءل|تساءل|سائلا|يفكر كيف|ما سيحدث)/i
const FUTURE_ATTRIBUTION_RE = /(?:دراسه|بحث|تقرير|منظمه|جامعه|بحسب|وفقا|قالت|اعلنت|اشارت|حذرت|تري مايكروسوفت|تعد سامسونج)/i
const FUTURE_FRAGMENT_RE = /^(?:هو|هي|لكن المميز|ومن المميز) /i
const isPredictionSentence = (sentence: string) => {
  const normalized = normalizeIdeaText(sentence)
  return FUTURE_RE.test(sentence)
    && !sentence.includes('؟')
    && !FUTURE_QUESTION_RE.test(normalized)
    && !FUTURE_ATTRIBUTION_RE.test(normalized)
    && !FUTURE_FRAGMENT_RE.test(normalized)
}
const VALUE_RE = /(?:ينبغي|يجب|الأجدر|الأفضل|العدل|الإنصاف|المسؤولية|الكرامة|الإنسان أولاً|لا بد)/i
const EVIDENCE_RE = /(?:دراسة|بحث|بيانات|إحصاء|نسبة|%|٪|وفقاً|أظهرت|أثبتت|تشير النتائج)/i
const CAUSAL_RE = /(?:لأن|لذلك|حين|عندما|يؤدي|ينتج|يصنع|يحوّل|يفقد|يمنح|يمنع|يكشف)/i

function sourceText(article: ArticleRecord) {
  return `${article.title}. ${article.excerpt || ''}\n\n${article.body || ''}`.trim()
}

function concise(value: string, maximum = 420) {
  if (value.length <= maximum) return value
  const clipped = value.slice(0, maximum)
  const boundary = Math.max(clipped.lastIndexOf('،'), clipped.lastIndexOf('؛'), clipped.lastIndexOf(' '))
  return `${clipped.slice(0, boundary > maximum * .72 ? boundary : maximum).trim()}…`
}

function centralClaim(article: ArticleRecord) {
  const titleWords = new Set(ideaWords(article.title))
  const raw = `${article.excerpt || ''}\n\n${article.body || ''}`.replace(/\r/g, '')
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length >= 45)
  const candidates = paragraphs.length ? paragraphs : sentences(raw)
  const thesisSignal = /(?:نحن لا|لا نرفض|المشكلة|الخطر|الغاية|الفكرة الأهم|خلاصة|المقصود|هنا تبدأ|ليس[^.؟…]{0,90}بل)/i
  const anecdoteSignal = /(?:في مشهد|في مثال|يقول بصراحة|يسأل الطالب|وعندما يُطلب)/i
  const normalizedTitle = normalizeIdeaText(article.title)
  const ranked = candidates.map((sentence, index) => {
    const titleOverlap = ideaWords(sentence).filter((word) => titleWords.has(word)).length
    const idealLength = sentence.length >= 75 && sentence.length <= 300 ? 11 : sentence.length <= 420 ? 5 : 0
    const signal = (CAUSAL_RE.test(sentence) ? 7 : 0) + (VALUE_RE.test(sentence) ? 5 : 0) + (FUTURE_RE.test(sentence) ? 3 : 0)
    const thesis = thesisSignal.test(sentence) ? 15 : 0
    const opening = index < 5 ? 6 : index < 9 ? 2 : 0
    const evidencePenalty = EVIDENCE_RE.test(sentence) ? 18 : 0
    const questionPenalty = sentence.includes('؟') ? 7 : 0
    const anecdotePenalty = anecdoteSignal.test(sentence) ? 6 : 0
    const headingPenalty = normalizeIdeaText(sentence) === normalizedTitle ? 30 : 0
    return { sentence, score: titleOverlap * 5 + idealLength + signal + thesis + opening - evidencePenalty - questionPenalty - anecdotePenalty - headingPenalty }
  }).sort((a, b) => b.score - a.score)
  return concise(ranked[0]?.sentence || article.excerpt || article.title)
}

function themeOf(article: ArticleRecord) {
  const text = normalizeIdeaText(sourceText(article))
  if (/(ذكاء|اصطناعي|خوارزمي|تقنيه|هاتف|شاشه|رقمي|منصه|تكنولوجيا)/.test(text)) return 'technology'
  if (/(اختبار|امتحان|تقييم|درجه|شهاده|تحصيل|قياس)/.test(text)) return 'assessment'
  if (/(طفل|اطفال|ابناء|اسره|والد|والدين|امومه|ابوه)/.test(text)) return 'family'
  if (/(معلم|تدريس|صف|مدرسه|طالب|تعليم)/.test(text)) return 'education'
  if (/(اعلام|تواصل اجتماعي|مشاهير|فاشينست|راي عام)/.test(text)) return 'media'
  if (/(بحث|جامعه|اكاديمي|دراسه|علمي)/.test(text)) return 'research'
  return 'human'
}

function strongestCounterargument(article: ArticleRecord) {
  switch (themeOf(article)) {
    case 'technology':
      return 'قد يعترض قارئ بأن الأداة لا تُضعف الإنسان بذاتها؛ فالنتيجة تتغيّر جذرياً عندما يُعاد تصميم المهمة، ويُدرَّب المستخدم، ويُقاس التفكير لا المنتج النهائي وحده.'
    case 'assessment':
      return 'قد يعترض قارئ بأن القياس الموحّد، على قصوره، يظل ضرورياً للعدالة والمقارنة وكشف الفجوات؛ وأن المشكلة قد تكون في استخدام النتيجة لا في وجود التقييم نفسه.'
    case 'family':
      return 'قد يعترض قارئ بأن الحزم أو الحماية التي تبدو زائدة في موقف ما قد تكون استجابة مؤقتة لعمر الطفل أو خطر حقيقي؛ وأن الحكم لا يكتمل من السلوك الظاهر وحده.'
    case 'education':
      return 'قد يعترض قارئ بأن الفكرة القوية تربوياً قد تتعثر بسبب حجم الصف والوقت والموارد؛ وأن فشل التطبيق لا يعني دائماً ضعف المبدأ، كما أن نجاح المثال الفردي لا يضمن عموميته.'
    case 'media':
      return 'قد يعترض قارئ بأن المنصات لا تصنع السلوك من الصفر، بل تكشف ميولاً وحاجات كانت موجودة؛ وأن تحميل الوسيط وحده المسؤولية قد يحجب دور الأسرة والتعليم والاقتصاد.'
    case 'research':
      return 'قد يعترض قارئ بأن الدليل المتاح لا يسمح بعد بتعميم واسع؛ فاختلاف العينة والسياق وطريقة القياس قد يغيّر النتيجة أكثر مما توحي به الخلاصة الأولى.'
    default:
      return 'قد يعترض قارئ بأن الخلل قد يكون في التطبيق أو السياق لا في الفكرة نفسها؛ وأن الاستثناءات الجادة تستحق أن تُختبر قبل تحويل الموقف إلى قاعدة عامة.'
  }
}

function pressureTests(article: ArticleRecord) {
  switch (themeOf(article)) {
    case 'technology': return [
      'هل يبقى الحكم نفسه عندما تكون التقنية أداة مساعدة تحت إشراف واعٍ، لا بديلاً عن التفكير؟',
      'هل تنطبق النتيجة على المبتدئ والخبير بالدرجة نفسها، أم أن الخبرة تغيّر أثر الأداة؟',
      'ما الذي قد نخسره إن منعنا الأداة تماماً، لا إن استخدمناها بلا ضوابط فقط؟',
    ]
    case 'assessment': return [
      'هل يكشف البديل المقترح التعلم فعلاً، أم يبدّل شكل القياس ويُبقي المشكلة؟',
      'كيف نحافظ على المقارنة والعدالة عندما تختلف المدارس والموارد والمصححون؟',
      'هل يؤدي التطبيق الواسع إلى تحيز أقل، أم ينقل التحيز إلى أداة يصعب ملاحظتها؟',
    ]
    case 'family': return [
      'هل يتغيّر القرار عندما يكون السلوك عارضاً مرتبطاً بعمر أو ظرف، لا نمطاً ثابتاً؟',
      'هل يظل الحل صالحاً إذا اختلفت حساسية الطفل وقدرته على التعبير واحتياجه للدعم؟',
      'ما الرسالة غير المقصودة التي قد يتعلمها الطفل من تطبيق النصيحة حرفياً؟',
    ]
    case 'education': return [
      'هل تصمد الفكرة في صف مزدحم ووقت محدود، لا في الحالة المثالية فقط؟',
      'هل تمنح المعلم إجراءً قابلاً للتطبيق، أم تضيف إليه معياراً جميلاً يصعب تنفيذه؟',
      'هل يستفيد منها الطالب المتفوق والمتعثر بالقدر نفسه، أم يحتاج كل منهما صيغة مختلفة؟',
    ]
    case 'media': return [
      'هل المنصة سبب مباشر، أم أنها تضخّم حاجة اجتماعية ونفسية كانت موجودة قبلها؟',
      'هل يختلف الحكم بين الاستخدام النشط الواعي والتلقي الطويل السلبي؟',
      'ما الذي يحدث إذا عالجنا الوسيط وتركنا الدافع الذي جعل الناس يتعلقون به؟',
    ]
    case 'research': return [
      'هل تسمح العينة وطريقة القياس بتعميم النتيجة خارج سياق الدراسة؟',
      'هل تظل العلاقة قائمة بعد فصل العوامل الاجتماعية والاقتصادية المصاحبة؟',
      'ما النتيجة التي قد تظهر لو أُعيد الاختبار بأداة قياس مختلفة أو بعد مدة أطول؟',
    ]
    default: return [
      'هل تبقى الفكرة عادلة عندما تختلف الأعمار والقدرات والظروف؟',
      'هل تصمد في بيئة محدودة الوقت والموارد، لا في الحالة المثالية فقط؟',
      'ما الأثر غير المقصود إذا تحولت الفكرة من توجيه مرن إلى قاعدة عامة؟',
    ]
  }
}

function resilientCore(article: ArticleRecord) {
  switch (themeOf(article)) {
    case 'technology': return 'يبقى أقوى ما في الفكرة أنها ترفض قياس جودة الاستخدام بجودة الناتج وحده؛ فالمنتج اللامع لا يثبت أن الإنسان فهم أو اختار أو نما.'
    case 'assessment': return 'يبقى تنبيه المقال إلى أن الدرجة أداة وصف لا تعريفاً للطالب؛ وحتى عند ضرورة القياس، لا ينبغي أن يتحول المؤشر إلى حكم كامل على الإنسان.'
    case 'family': return 'يبقى مركز الفكرة هو قراءة السلوك بوصفه رسالةً قبل معاملته كمخالفة؛ وهذا لا يلغي الحدود، لكنه يغيّر طريقة بنائها.'
    case 'education': return 'يبقى المعيار الإنساني للفكرة صامداً: نجاح الإجراء لا يُقاس بسهولة تنفيذه فقط، بل بما يضيفه إلى تعلم الطالب وكرامته واستقلاله.'
    case 'media': return 'يبقى التحذير من اقتصاد الانتباه قائماً؛ فالمنصات تكافئ ما يبقي الإنسان أطول، لا بالضرورة ما يجعله أوعى أو أكثر اتزاناً.'
    case 'research': return 'يبقى طلب الدليل والسياق ضرورياً؛ فالنتيجة العلمية تقوى بحدودها الواضحة، لا بالصياغة الأشد يقيناً.'
    default: return 'يبقى الجزء الأقوى في الفكرة هو ردّ القرار إلى أثره في الإنسان، لا الاكتفاء بجمال الأداة أو سهولة الإجراء.'
  }
}

function reconsiderCondition(article: ArticleRecord) {
  switch (themeOf(article)) {
    case 'technology': return 'تحتاج النتيجة إلى مراجعة إذا ظهرت أدلة طويلة المدى تُثبت أن الاستخدام الموجّه يبني استقلال التفكير، لا يكتفي بتحسين المنتج الظاهر.'
    case 'assessment': return 'تحتاج النتيجة إلى مراجعة إذا أثبت البديل، على نطاق واسع، أنه أكثر عدلاً وقابلية للتحقق وأقل عبئاً من الأداة التي ينتقدها المقال.'
    case 'family': return 'تحتاج النتيجة إلى مراجعة إذا أظهر السياق النمائي أو النفسي أن السلوك استجابة لحاجة مختلفة عن التفسير الذي يبدأ منه المقال.'
    case 'education': return 'تحتاج النتيجة إلى مراجعة إذا تكررت نتائج مخالفة في مدارس وفئات متعددة، لا في تجربة استثنائية واحدة.'
    case 'media': return 'تحتاج النتيجة إلى مراجعة إذا أمكن فصل أثر المنصة عن أثر البيئة الاجتماعية والاقتصادية وأظهرت البيانات أن العامل الحاسم يقع في مكان آخر.'
    default: return 'تحتاج النتيجة إلى مراجعة إذا ظهرت أدلة متكررة في سياقات مختلفة تنقض العلاقة التي يبني عليها المقال استنتاجه.'
  }
}

function certaintyOf(claim: string): IdeaCertainty {
  if (isPredictionSentence(claim)) return 'توقع'
  if (EVIDENCE_RE.test(claim)) return 'حقيقة موثقة'
  if (VALUE_RE.test(claim)) return 'موقف قيمي'
  return 'استنتاج'
}

export function buildIdeaTest(article: ArticleRecord): IdeaTest {
  const claim = centralClaim(article)
  return {
    claim,
    counterargument: strongestCounterargument(article),
    pressureTests: pressureTests(article),
    resilientCore: resilientCore(article),
    reconsiderWhen: reconsiderCondition(article),
    certainty: certaintyOf(claim),
  }
}

export function extractPredictionQuotes(article: ArticleRecord) {
  const output: string[] = []
  const seen = new Set<string>()
  for (const sentence of sentences(sourceText(article))) {
    if (!isPredictionSentence(sentence)) continue
    const value = sentence.slice(0, 360)
    const key = normalizeIdeaText(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(value)
    if (output.length >= 3) break
  }
  return output
}

function articleSimilarity(left: ArticleRecord, right: ArticleRecord) {
  const overlap = overlapCount(`${left.title} ${left.excerpt || ''}`, `${right.title} ${right.excerpt || ''}`)
  return overlap + (left.cat === right.cat ? 1 : 0)
}

export function timeLinksFor(article: ArticleRecord, articles: ArticleRecord[]): TimeLink[] {
  const currentYear = Number(article.iso.slice(0, 4))
  const candidates = articles
    .filter((candidate) => candidate.slug !== article.slug && /^(?:19|20)\d{2}/.test(candidate.iso))
    .map((candidate) => ({ candidate, gap: Number(candidate.iso.slice(0, 4)) - currentYear, overlap: articleSimilarity(article, candidate) }))
    .filter((item) => Math.abs(item.gap) >= 2 && item.overlap >= 2)

  const older = candidates.filter((item) => item.gap < 0).sort((a, b) => b.overlap - a.overlap || b.gap - a.gap)[0]
  const newer = candidates.filter((item) => item.gap > 0).sort((a, b) => b.overlap - a.overlap || a.gap - b.gap)[0]
  return [
    older && { role: 'جذر' as const, article: older.candidate, overlap: older.overlap },
    newer && { role: 'تطور' as const, article: newer.candidate, overlap: newer.overlap },
  ].filter(Boolean) as TimeLink[]
}

function remoteReviewFor(quote: string, remote?: IdeaLifeRemoteRecord) {
  return remote?.predictions?.find((item) => overlapRatio(item.quote, quote) >= 0.65)
}

export function predictionRecordsFor(article: ArticleRecord, articles: ArticleRecord[], remote?: IdeaLifeRemoteRecord): PredictionRecord[] {
  const links = timeLinksFor(article, articles)
  const newer = links.find((link) => link.role === 'تطور')?.article
  return extractPredictionQuotes(article).map((quote) => {
    const review = remoteReviewFor(quote, remote)
    const yearsOld = Math.max(0, new Date().getFullYear() - Number(article.iso.slice(0, 4)))
    const status: PredictionStatus | string = review?.status || (newer ? 'ظهرت إشارة لاحقة' : yearsOld < 2 ? 'تحتاج زمناً أطول' : 'قيد المتابعة')
    return {
      quote,
      status,
      laterArticle: newer,
      evidence: review?.evidence,
      dimensions: {
        direction: review?.dimensions?.direction || (newer ? 'ظهرت في الأرشيف كتابة لاحقة على الخيط نفسه.' : 'لا توجد بعد إشارة كافية للحكم.'),
        timing: review?.dimensions?.timing || (yearsOld < 2 ? 'ما زال مبكراً على مراجعة عادلة.' : 'حان وقت جمع الأدلة من الواقع.'),
        scale: review?.dimensions?.scale || 'لا يُفترض حجم الأثر من خبر واحد أو حالة منفردة.',
        scope: review?.dimensions?.scope || 'يبقى الحكم مقيداً بالسياق الذي تتوافر عنه أدلة قابلة للتحقق.',
      },
    }
  })
}

function bestMatches<T>(article: ArticleRecord, items: T[], text: (item: T) => string, minimum = 2) {
  return items
    .map((item) => ({ item, score: overlapCount(`${article.title} ${article.excerpt || ''}`, text(item)) }))
    .filter((match) => match.score >= minimum)
    .sort((a, b) => b.score - a.score)
}

function externalSignalNode(signal: RemoteIdeaSignal): ImpactNode | null {
  if (!signal.url || (signal.confidence ?? 1) < 0.82) return null
  const label = signal.type === 'academic' ? 'أثر علمي' : signal.type === 'application' ? 'أثر تطبيقي' : signal.type === 'media' ? 'أثر إعلامي' : 'ذكر مباشر'
  return {
    kind: signal.type === 'academic' ? 'paper' : signal.type === 'application' ? 'application' : 'external',
    label,
    title: signal.title,
    note: signal.summary || signal.relation || 'إشارة عامة اجتازت فحص المصدر والرابط والتطابق.',
    year: signal.publishedAt?.slice(0, 4),
    url: signal.url,
    source: signal.source,
    confidence: 'موثق',
  }
}

export function impactNodesFor(
  article: ArticleRecord,
  books: BookRecord[],
  papers: PaperRecord[],
  media: MediaRecord[],
  remote?: IdeaLifeRemoteRecord,
): ImpactNode[] {
  const nodes: ImpactNode[] = [{
    kind: 'origin', label: 'البداية', title: article.title, note: 'النص الذي بدأت منه رحلة الفكرة.',
    year: article.iso.slice(0, 4), to: `/articles/${article.slug}`, confidence: 'موثق',
  }]

  const paper = bestMatches(article, papers, (item) => `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`, 3)[0]
  if (paper) nodes.push({
    kind: 'paper', label: 'امتداد علمي', title: paper.item.titleAr || paper.item.title,
    note: 'صلة موضوعية قوية بعمل علمي منشور في الأرشيف؛ لا تُعرض بوصفها استشهاداً إلا إذا أثبته المصدر الخارجي.',
    year: paper.item.iso?.slice(0, 4), to: `/research/${paper.item.slug}`, confidence: 'صلة قوية',
  })

  const appearance = bestMatches(article, media, (item) => `${item.title} ${item.outlet}`, 3)[0]
  if (appearance) nodes.push({
    kind: 'media', label: 'في الحوار العام', title: appearance.item.title,
    note: `مادة منشورة عبر ${appearance.item.outlet} تلتقي مع خيط الفكرة.` ,
    year: appearance.item.iso?.slice(0, 4), url: appearance.item.url, source: appearance.item.outlet, confidence: 'صلة قوية',
  })

  const book = bestMatches(article, books, (item) => `${item.title} ${item.desc || ''}`, 3)[0]
  if (book) nodes.push({
    kind: 'book', label: 'امتداد كتابي', title: book.item.title,
    note: 'تظهر الفكرة ضمن إطار أوسع في أحد المؤلفات المنشورة.',
    to: `/publications/${book.item.slug}`, confidence: 'صلة قوية',
  })

  for (const signal of remote?.signals || []) {
    const node = externalSignalNode(signal)
    if (node) nodes.push(node)
  }

  const seen = new Set<string>()
  return nodes.filter((node) => {
    const key = `${node.label}:${normalizeIdeaText(node.title)}:${node.url || node.to || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 7)
}

function tinyHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function buildIdeaLife(
  article: ArticleRecord,
  articles: ArticleRecord[],
  books: BookRecord[],
  papers: PaperRecord[],
  media: MediaRecord[],
  remote?: IdeaLifeRemoteRecord,
): IdeaLifeModel {
  const test = buildIdeaTest(article)
  const predictions = predictionRecordsFor(article, articles, remote)
  const timeLinks = timeLinksFor(article, articles)
  const impact = impactNodesFor(article, books, papers, media, remote)
  const signature = tinyHash(JSON.stringify({
    slug: article.slug,
    claim: test.claim,
    predictions: predictions.map((item) => [
      item.quote,
      item.status,
      item.dimensions,
      (item.evidence || []).map((evidence) => [evidence.title, evidence.url, evidence.publishedAt || '']),
    ]),
    timeLinks: timeLinks.map((item) => [item.role, item.article.slug]),
    impact: impact.map((item) => [item.label, item.title, item.url || item.to, item.confidence]),
  }))
  return { test, predictions, timeLinks, impact, signature }
}
