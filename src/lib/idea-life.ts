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

const themeLabel = (article: ArticleRecord) => ({
  technology: 'التقنية والإنسان',
  assessment: 'القياس والتقييم',
  family: 'الطفل والأسرة',
  education: 'التعليم والممارسة الصفية',
  media: 'الإعلام واقتصاد الانتباه',
  research: 'البحث والدليل',
  human: article.cat || 'السلوك الإنساني',
})[themeOf(article)]

function articleCue(article: ArticleRecord, claim: string) {
  const cue = concise(claim.replace(/[«»]/g, ''), 138)
  return cue && normalizeIdeaText(cue) !== normalizeIdeaText(article.title) ? cue : article.title
}

function strongestCounterargument(article: ArticleRecord, claim: string) {
  const cue = articleCue(article, claim)
  const opening = `في «${article.title}»، أقوى اعتراض على عبارة «${cue}» هو أن `
  switch (themeOf(article)) {
    case 'technology':
      return `${opening}الأداة لا تُضعف الإنسان بذاتها؛ فقد تتغيّر النتيجة عندما تُصمَّم المهمة حول التفكير، ويُدرَّب المستخدم، ويُقاس مسار الاختيار لا المنتج النهائي وحده.`
    case 'assessment':
      return `${opening}القياس الموحّد، على قصوره، قد يظل ضرورياً للمقارنة وكشف الفجوات؛ وربما يقع الخلل في معنى النتيجة وطريقة استخدامها، لا في وجود التقييم وحده.`
    case 'family':
      return `${opening}ما يبدو حمايةً أو حزماً زائداً قد يكون استجابةً مؤقتة لعمر الطفل أو لخطر حقيقي؛ فلا يكتمل الحكم من السلوك الظاهر من دون معرفة حاجته وسياقه.`
    case 'education':
      return `${opening}المبدأ التربوي قد يكون صحيحاً بينما يتعثر تطبيقه بسبب الصف والوقت والموارد؛ كما أن نجاح تجربة واحدة لا يثبت أن الصيغة ذاتها تصلح لكل متعلم ومؤسسة.`
    case 'media':
      return `${opening}المنصة لا تصنع السلوك من الصفر، بل تضخّم حاجات وميولاً سابقة؛ وتحميل الوسيط وحده المسؤولية قد يحجب أثر الأسرة والتعليم والاقتصاد في القضية التي يناقشها النص.`
    case 'research':
      return `${opening}الدليل المتاح قد لا يسمح بالتعميم الذي توحي به الصياغة؛ فالعينة والسياق وأداة القياس قد تغيّر نتيجة هذه القضية أكثر مما يظهر في الخلاصة الأولى.`
    default:
      return `${opening}الخلل قد يكون في التطبيق أو السياق لا في الفكرة نفسها؛ ولذلك ينبغي اختبار الاستثناءات الجادة قبل تحويل ما يقوله المقال إلى قاعدة عامة.`
  }
}

function pressureTests(article: ArticleRecord, claim: string) {
  const cue = articleCue(article, claim)
  const context = article.cat || themeLabel(article)
  switch (themeOf(article)) {
    case 'technology': return [
      `هل يبقى استنتاج «${cue}» نفسه عندما تصبح التقنية أداةً مساعدة تحت إشراف واعٍ، لا بديلاً عن التفكير؟`,
      `في سياق «${context}»، هل تنطبق النتيجة على المبتدئ والخبير بالدرجة نفسها، أم تغيّر الخبرة أثر الأداة؟`,
      `ما الذي قد نخسره في القضية التي يطرحها «${article.title}» إن منعنا الأداة تماماً، لا إن استخدمناها بلا ضوابط فقط؟`,
    ]
    case 'assessment': return [
      `هل يكشف البديل الذي يوحي به «${cue}» التعلّم فعلاً، أم يبدّل شكل القياس ويبقي المشكلة؟`,
      `كيف نحافظ على المقارنة والعدالة في «${context}» عندما تختلف الموارد والمصححون وظروف المتعلمين؟`,
      `هل يؤدي تعميم موقف «${article.title}» إلى تحيز أقل، أم ينقل التحيز إلى أداة يصعب ملاحظتها؟`,
    ]
    case 'family': return [
      `هل يتغيّر الحكم على «${cue}» عندما يكون السلوك عارضاً مرتبطاً بعمر أو ظرف، لا نمطاً ثابتاً؟`,
      `هل يظل موقف «${article.title}» صالحاً إذا اختلفت حساسية الطفل وقدرته على التعبير واحتياجه للدعم؟`,
      `ما الرسالة غير المقصودة التي قد يتعلمها الطفل إذا طُبّق استنتاج المقال حرفياً في كل أسرة؟`,
    ]
    case 'education': return [
      `هل تصمد عبارة «${cue}» في صف مزدحم ووقت محدود، لا في الحالة المثالية فقط؟`,
      `هل يمنح «${article.title}» المعلّم إجراءً قابلاً للتطبيق في «${context}»، أم يضيف معياراً جميلاً يصعب تنفيذه؟`,
      `هل يستفيد الطالب المتفوق والمتعثر من هذا الموقف بالقدر نفسه، أم يحتاج كل منهما صيغة مختلفة؟`,
    ]
    case 'media': return [
      `في «${article.title}»، هل الوسيط سبب مباشر أم أنه يضخّم حاجة اجتماعية ونفسية كانت موجودة قبله؟`,
      `هل يختلف الحكم على «${cue}» بين الاستخدام النشط الواعي والتلقي الطويل السلبي؟`,
      `ما الذي يبقى من المشكلة في «${context}» إذا عالجنا المنصة وتركنا الدافع الذي جعل الناس يتعلقون بها؟`,
    ]
    case 'research': return [
      `هل تسمح الأدلة التي تقف خلف «${cue}» بتعميم النتيجة خارج سياق «${context}»؟`,
      `هل تظل العلاقة التي يبني عليها «${article.title}» قائمـة بعد فصل العوامل الاجتماعية والاقتصادية المصاحبة؟`,
      `ما النتيجة التي قد تظهر لو أُعيد اختبار القضية بأداة قياس مختلفة أو بعد مدة أطول؟`,
    ]
    default: return [
      `هل تبقى عبارة «${cue}» عادلة عندما تختلف الأعمار والقدرات والظروف؟`,
      `هل يصمد موقف «${article.title}» في بيئة محدودة الوقت والموارد، لا في الحالة المثالية فقط؟`,
      `ما الأثر غير المقصود إذا تحولت الفكرة المطروحة في «${context}» من توجيه مرن إلى قاعدة عامة؟`,
    ]
  }
}

function resilientCore(article: ArticleRecord, claim: string) {
  const cue = articleCue(article, claim)
  switch (themeOf(article)) {
    case 'technology': return `يبقى قلب «${article.title}» صامداً في تنبيهه إلى «${cue}»: جودة الناتج لا تكفي وحدها لإثبات أن الإنسان فهم واختار ونما.`
    case 'assessment': return `يبقى أقوى ما في «${article.title}» رفض تحويل المؤشر إلى تعريف كامل للمتعلم؛ وهذا المعنى يظل قائماً حتى عند ضرورة القياس.`
    case 'family': return `يبقى مركز «${article.title}» هو قراءة السلوك في سياقه قبل معاملته كمخالفة؛ وهذا لا يلغي الحدود، لكنه يغيّر سببها وطريقة بنائها.`
    case 'education': return `يبقى المعيار الإنساني في «${article.title}» صامداً: نجاح الإجراء لا يُقاس بسهولة تنفيذه فقط، بل بما يضيفه إلى تعلم الطالب وكرامته واستقلاله.`
    case 'media': return `يبقى التحذير الخاص بـ«${cue}» قائماً؛ فالوسيط قد يكافئ ما يطيل الانتباه، لا بالضرورة ما يجعل الإنسان أوعى أو أكثر اتزاناً.`
    case 'research': return `يبقى طلب الدليل والسياق الذي يقوم عليه «${article.title}» ضرورياً؛ فالنتيجة تقوى بحدودها الواضحة، لا بالصياغة الأشد يقيناً.`
    default: return `يبقى الجزء الأقوى في «${article.title}» هو ردّ القرار إلى أثره في الإنسان، لا الاكتفاء بجمال الأداة أو سهولة الإجراء.`
  }
}

function reconsiderCondition(article: ArticleRecord, claim: string) {
  const cue = articleCue(article, claim)
  switch (themeOf(article)) {
    case 'technology': return `يحتاج حكم «${cue}» إلى مراجعة إذا أثبتت أدلة طويلة المدى أن الاستخدام الموجّه يبني استقلال التفكير في الفئة التي يتناولها المقال، لا يكتفي بتحسين المنتج الظاهر.`
    case 'assessment': return `يحتاج موقف «${article.title}» إلى مراجعة إذا أثبت البديل، على نطاق واسع، أنه أكثر عدلاً وقابلية للتحقق وأقل عبئاً من الأداة التي ينتقدها النص.`
    case 'family': return `يحتاج تفسير «${cue}» إلى مراجعة إذا أظهر السياق النمائي أو النفسي أن السلوك استجابة لحاجة مختلفة عن نقطة البداية في المقال.`
    case 'education': return `يحتاج استنتاج «${article.title}» إلى مراجعة إذا تكررت نتائج مخالفة في مدارس وفئات متعددة، لا في تجربة استثنائية واحدة.`
    case 'media': return `يحتاج حكم «${cue}» إلى مراجعة إذا أمكن فصل أثر الوسيط عن البيئة الاجتماعية والاقتصادية وأظهرت البيانات أن العامل الحاسم يقع في مكان آخر.`
    default: return `يحتاج استنتاج «${article.title}» إلى مراجعة إذا ظهرت أدلة متكررة في سياقات مختلفة تنقض العلاقة التي يبني عليها النص حكمه.`
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
    counterargument: strongestCounterargument(article, claim),
    pressureTests: pressureTests(article, claim),
    resilientCore: resilientCore(article, claim),
    reconsiderWhen: reconsiderCondition(article, claim),
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
        direction: review?.dimensions?.direction || (newer
          ? `أعاد مقال «${newer.title}» المنشور عام ${newer.iso.slice(0, 4)} فتح الاتجاه الذي بدأه هذا التوقع، من دون أن يكون ظهوره وحده حكماً بالتحقق.`
          : `لم تظهر بعد في الأرشيف كتابة لاحقة تعيد صياغة توقع «${concise(quote, 92)}» أو تنقض اتجاهه بوضوح.`),
        timing: review?.dimensions?.timing || (yearsOld < 2
          ? `لم يمض على نشر «${article.title}» سوى ${yearsOld || 'أقل من'} ${yearsOld === 1 ? 'سنة' : 'سنتين'}؛ لذلك تبقى المراجعة المبكرة غير عادلة.`
          : `مرّ نحو ${yearsOld} أعوام منذ نشر «${article.title}» عام ${article.iso.slice(0, 4)}؛ وهي مدة تسمح بجمع إشارات، لا بإعلان نتيجة نهائية بلا أدلة مستقلة.`),
        scale: review?.dimensions?.scale || `يتصل هذا التوقع بمحور «${themeLabel(article)}»؛ لذلك لا يُقاس حجمه بخبر واحد، بل بتكرار الأثر واتساعه وثباته عبر أكثر من حالة.`,
        scope: review?.dimensions?.scope || `نطاق الحكم الأول هو سياق «${article.cat || themeLabel(article)}» كما صيغ في «${article.title}»؛ وأي تعميم خارجه يحتاج دليلاً يطابق الفئة والبيئة والزمن.`,
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
