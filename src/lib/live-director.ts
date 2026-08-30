import type { ArticleRecord } from './cms.ts'
import { genuineAdditionMeter } from './editorial-foresight.ts'
import { strongestQuote, suggestStrongTitle } from './intelligence.ts'
import { polishTypography } from './style-dna.mjs'
import { arabicCountPhrase, DAY_FORMS, PASSAGE_AFTER_PREPOSITION_FORMS, PUBLISHED_PROJECT_FORMS, SECOND_FORMS, WORD_FORMS } from './arabic-count.ts'
import { cinematographyBlock, DEFAULT_FLOW_CLIP_SECONDS, flowLook, shotPlanForSeconds, type FlowLookId } from './flow-cinema.ts'

/**
 * مخرجات مسبك التغريدات ورنين القرّاء تُحقن حقناً ولا تُستورد هنا.
 * المسبك يستورد معجماً بصيغة JSON فلا يعمل تحت node مباشرة؛ والحقن يُبقي هذا
 * المحرك نقياً قابلاً للاختبار بلا Firestore ولا متصفح — وهي طريقة المسبك نفسه.
 */
export type ForgeDraft = {
  angle: string
  angleLabel: string
  text: string
  hashtags: string[]
  quote: string
  quoteVerified: boolean
  score: number
  resonanceCount?: number
}

export type ForgeInput = {
  drafts?: readonly ForgeDraft[]
  /** جملة من متنه مُتحقَّق من وجودها حرفاً بحرف. */
  verifiedLine?: string
  /** ما ظلّله القرّاء في هذا المتن، مرتّباً بعدد من ظلّله. */
  resonantLines?: readonly { text: string; count: number }[]
}

/** من أين جاءت جملة المقطع: كلامه المُظلَّل، أو متنه، أو صياغة المحرك. */
export type NarrationSource = 'resonance' | 'verified' | 'derived' | 'scaffold'

export type LiveDirectorProjectType = 'article_video' | 'public_topic_video'
export type LiveDirectorProjectStatus = 'draft' | 'analyzing' | 'prompts_ready' | 'day_one' | 'day_two' | 'generating' | 'needs_revision' | 'clips_approved' | 'editing' | 'ready_to_publish' | 'published' | 'archived'
export type LiveDirectorClipStatus = 'not_generated' | 'generated' | 'needs_revision' | 'approved' | 'uploaded'
export type LiveDirectorTone = 'فكرية' | 'تربوية' | 'إنسانية' | 'صادمة' | 'إعلامية' | 'أكاديمية مبسطة' | 'مستقبلية' | 'ساخرة بذكاء'
export type LiveDirectorPlatform = 'Instagram Reels' | 'X' | 'YouTube Shorts' | 'LinkedIn' | 'TikTok' | 'متعدد المنصات'
export type FlowAppearance = 'avatar_direct' | 'avatar_voiceover' | 'visual_only' | 'avatar_with_object'
/**
 * من يظهر في الإطار — أربعة خيارات صريحة، لا مربّع «أفتار» واحد.
 *
 * «الأفتار» يعني **د. أحمد نفسه**: نسخته المحفوظة داخل Flow. و«ناس المشهد»
 * شيءٌ آخر تماماً: أشخاصٌ في الحدث ليسوا هو ولا يشبهونه. وقد كان الخياران
 * مخلوطين في مفتاحٍ واحد، فلم يكن ممكناً أن يظهر هو **ومعه** ناس.
 *
 * `avatar`: هو وحده في الإطار.
 * `avatar_and_people`: هو، ومعه ناسٌ في المشهد.
 * `people`: ناسٌ في المشهد بلا ظهوره — الافتراضي.
 * `no_people`: بلا أي إنسان إطلاقاً؛ المعنى في الأشياء والضوء والمكان والمادة.
 */
export type CastMode = 'avatar' | 'avatar_and_people' | 'people' | 'no_people'

export const CAST_MODES: CastMode[] = ['people', 'no_people', 'avatar', 'avatar_and_people']

export const CAST_LABELS: Record<CastMode, string> = {
  avatar: 'أنا وحدي — أفتار د. أحمد المحفوظ في Flow',
  avatar_and_people: 'أنا ومعي ناس في المشهد',
  people: 'ناس في المشهد بلا ظهوري',
  no_people: 'بلا ناس إطلاقاً — أشياء ومكان وضوء',
}

export const CAST_NOTES: Record<CastMode, string> = {
  avatar: 'يتطلب اختيار الأفتار داخل Flow قبل التوليد؛ وإلا اخترع النموذج شخصاً آخر. ولا يظهر معك أحد.',
  avatar_and_people: 'تظهر أنت بهويتك المحفوظة، ويظهر معك آخرون في الحدث — ممنوعٌ أن يشبهك أحدهم أو يخاطب الكاميرا.',
  people: 'الافتراضي: أشخاصٌ في المشهد بلا هوية محددة ولا مذيع — لا يحتاج أفتاراً ولا صورة مرجعية.',
  no_people: 'لا وجه ولا يد ولا ظل إنسان. المشهد كله أشياء ومواد وضوء وحركة فيزيائية.',
}

/** هل تظهر نسخة د. أحمد المحفوظة في هذا الطاقم؟ */
const usesAvatar = (cast: CastMode) => cast === 'avatar' || cast === 'avatar_and_people'
/** نمط الترابط بين المقطع والمقطع الذي يسبقه. */
export type ContinuityMode = 'direct' | 'soft' | 'thematic' | 'independent'
/** استراتيجية الصورة المرجعية القادمة من المقطع السابق. */
export type ReferenceStrategy = 'last_frame' | 'selected_frame' | 'style_only' | 'none'
/** طريقة الصوت داخل المقطع: حديث مباشر، تعليق فوق مشهد، أو صورة وصوت بيئي بلا كلام. */
export type VoiceMode = 'avatar_speech' | 'voice_over' | 'ambient'
export type FlowPromptMode = 'speech_ar' | 'speech_en' | 'silent'
/** يحتفظ بمفتاح speech القديم للقراءة فقط؛ كل مشروع يُرقّى تلقائياً إلى المسارات الثلاثة. */
export type FlowPromptVariants = Record<FlowPromptMode, string> & { speech?: string }

export type OverlayCue = {
  kind: 'عنوان' | 'اقتباس' | 'رابط' | 'دعوة'
  text: string
  from: number
  to: number
  position: 'أعلى الإطار' | 'أسفل الإطار' | 'وسط الإطار'
  space: string
}

export type LiveDirectorSegment = {
  id: string
  order: number
  day: number
  duration: number
  role: string
  purpose: string
  /** المعنى الوحيد الذي يجب أن يصل من هذا المقطع. */
  message: string
  appearance: FlowAppearance
  /** من يظهر في هذا المقطع؛ يُحفظ مع المقطع فتبقى إعادة البناء أمينة. */
  cast: CastMode
  voiceMode: VoiceMode
  narration: string
  /** مصدر الجملة — يظهر في اللوحة كي لا تختلط صياغة المحرك بكلامه. */
  narrationSource: NarrationSource
  /** كم قارئاً ظلّل الجملة التي بُني عليها هذا المقطع. */
  resonanceCount: number
  shotCount: 1 | 2 | 3
  shotPlan: { from: number; to: number; framing: string }[]
  prompt: string
  /** ثلاثة مسارات: كلام عربي، كلام إنجليزي، أو بلا كلام؛ البرومبتات نفسها إنجليزية ولا تولّد نصاً مرئياً. */
  flowPrompts?: FlowPromptVariants
  /** وصف بصري إنجليزي مشتق داخلياً من موضوع المقطع من دون تسريب العربية إلى Flow. */
  visualBrief?: string
  negativeConstraints: string[]
  continuity: string
  continuityMode: ContinuityMode
  referenceStrategy: ReferenceStrategy
  referenceSourceClipId: string
  selectedReferenceFrame: string
  lastFrameImage: string
  startState: string
  endState: string
  overlayPlan: OverlayCue[]
  status: LiveDirectorClipStatus
  videoUrl: string
  revisionReason: string
  promptVersions: { prompt: string; reason: string; createdAt: string }[]
}

export type LiveDirectorSocialPack = {
  coverText: string
  caption: string
  x: string
  instagram: string
  linkedin: string
  youtube: string
  audienceQuestion: string
  callToAction: string
  hashtags: string[]
  thumbnailIdea: string
  articleDecision?: 'لا يحتاج مقالاً' | 'اربطه بمقالة موجودة' | 'حدّث مقالة قديمة' | 'حوّله إلى فكرة مقال' | 'أرسله إلى مجلس التحرير'
}

export type LiveDirectorQuality = {
  idea: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  duration: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  clips: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  avatar: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  publishing: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  continuity: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  notes: string[]
}

/** أرقام حقيقية يدخلها د. أحمد بعد النشر؛ لا تكامل مدفوع ولا تخمين. */
export type LiveDirectorMetrics = {
  views: number
  completion: number
  saves: number
  shares: number
  articleClicks: number
}

export type LiveDirectorProject = {
  id: string
  type: LiveDirectorProjectType
  articleId: string
  articleUrl: string
  title: string
  idea: string
  centralMessage: string
  audience: string
  platform: LiveDirectorPlatform
  tone: LiveDirectorTone
  useAvatar: boolean
  /** الطاقم المختار للمشروع كله. */
  castMode: CastMode
  series: boolean
  seriesPlan: string[]
  /** المدة الكاملة = عدد المقاطع × مدة المقطع الواحد. */
  duration: number
  durationReason: string
  /** النمط البصري: عدسة وإضاءة وتدرّج ونسيج. اختياريٌّ فالمشاريع المحفوظة تبقى صالحة. */
  look?: FlowLookId
  /** مدة المقطع الواحد؛ ثمانٍ افتراضاً، وأطول متاحٌ لمن له اشتراك Flow. */
  clipSeconds?: number
  segmentCount: number
  days: number
  narration: string
  identityLock: string
  continuityNotes: string[]
  segments: LiveDirectorSegment[]
  social: LiveDirectorSocialPack
  quality: LiveDirectorQuality
  status: LiveDirectorProjectStatus
  finalVideoUrl: string
  youtubeUrl: string
  coverUrl: string
  source: string
  sourceSessionId: string
  linkedEditorialDecisionId: string
  linkedCampaignId: string
  metrics?: LiveDirectorMetrics
  createdAtClient: string
  updatedAtClient: string
}

export type ArticleVideoInput = {
  article: ArticleRecord
  audience?: string
  platform?: LiveDirectorPlatform
  tone?: LiveDirectorTone
  useAvatar?: boolean
  castMode?: CastMode
  /** مدة المقطع الواحد في Flow؛ خمس عشرة افتراضاً. */
  clipSeconds?: number
  /** عدد المقاطع المطلوب يدوياً بدل توصية المحرك. */
  preferredSegments?: 3 | 6 | 8
  forge?: ForgeInput
  source?: string
  sourceSessionId?: string
  linkedEditorialDecisionId?: string
  linkedCampaignId?: string
}

export type PublicVideoInput = {
  topic: string
  message?: string
  audience?: string
  platform?: LiveDirectorPlatform
  tone?: LiveDirectorTone
  useAvatar?: boolean
  castMode?: CastMode
  clipSeconds?: number
  wantsSeries?: boolean
  forge?: ForgeInput
  source?: string
  sourceSessionId?: string
  linkedEditorialDecisionId?: string
  linkedCampaignId?: string
  linkedArticle?: ArticleRecord | null
  archive?: ArticleRecord[]
}

const wordList = (value = '') => value.trim().split(/\s+/).filter(Boolean)
const wordCount = (value = '') => wordList(value).length
const unique = <T,>(items: T[]) => [...new Set(items)]
const now = () => new Date().toISOString()

/** تجريد الجملة للمقارنة: بلا تشكيل ولا ترقيم ولا فروق ألف. */
const bareLine = (value = '') => value
  .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[إأآا]/g, 'ا')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

function clipWords(value: string, maximum: number, fallback = '') {
  const rows = wordList(value.replace(/[\r\n]+/g, ' '))
  const output = rows.slice(0, maximum).join(' ').replace(/[،؛:]$/, '')
  return output || fallback
}

function cleanSentence(value = '') {
  return value.replace(/\s+/g, ' ').replace(/^[\s•\-–—\d.)]+/, '').trim()
}

function meaningfulSentences(value = '') {
  const seen = new Set<string>()
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟…])\s+/)
    .map(cleanSentence)
    .filter((item) => wordCount(item) >= 6 && wordCount(item) <= 34)
    // الجملة المكرّرة في المتن لا تُقال مرتين في فيديو من ست مقاطع.
    .filter((item) => { const bare = bareLine(item); if (!bare || seen.has(bare)) return false; seen.add(bare); return true })
}

function projectId(type: LiveDirectorProjectType, seed: string) {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return `live-${type === 'article_video' ? 'article' : 'public'}-${Date.now().toString(36)}-${(hash >>> 0).toString(36)}`
}

/**
 * أعداد المقاطع التي لها أدوار سردية مكتوبة. لا يُولَّد عددٌ بلا أدوار.
 */
const SUPPORTED_SEGMENTS = [1, 2, 3, 4, 6, 8] as const

/**
 * يترجم «المدة المستهدفة» إلى عدد مقاطع بحسب مدة المقطع الواحد في Flow.
 *
 * قبل الخمس عشرة ثانية كان العدد يُحسب بقسمةٍ على ثمانٍ حتماً، فصار تغيير مدة
 * المقطع يضاعف طول الفيديو بدل أن يقلّل عدد التوليدات. القاعدة الآن: الطول
 * المستهدف ثابتٌ يخدم المنصة، وعدد المقاطع تابعٌ له — فالخمس عشرة تعني
 * توليداتٍ أقل لنفس الفيديو، لا فيديو أطول بلا سبب.
 */
function planFor(targetSeconds: number, clipSeconds: number) {
  const seconds = clipSeconds > 0 ? clipSeconds : DEFAULT_FLOW_CLIP_SECONDS
  const raw = Math.max(1, Math.round(targetSeconds / seconds))
  const segments = SUPPORTED_SEGMENTS.reduce((best, option) => Math.abs(option - raw) < Math.abs(best - raw) ? option : best, SUPPORTED_SEGMENTS[0])
  return { segments, duration: segments * seconds, days: Math.ceil(segments / 3) }
}

export function recommendArticleVideoDuration(article: Pick<ArticleRecord, 'title' | 'excerpt' | 'body'>, clipSeconds = DEFAULT_FLOW_CLIP_SECONDS) {
  const text = article.body || article.excerpt || ''
  const count = wordCount(text)
  const complex = /دراسة|نتيجة|مقارنة|قصة|حكاية|تجربة|من جهة|في المقابل|أولاً|ثانياً/i.test(text)
  if (count <= 260 && !complex) return { ...planFor(24, clipSeconds), reason: 'المقالة قصيرة وتدور حول سؤال واحد؛ الإعلان المركز يخدمها أكثر من شرح مطوّل.' }
  if (count >= 600 && complex) return { ...planFor(64, clipSeconds), reason: 'المادة تحمل قصة أو مقارنة ودليلاً يحتاجان مساحة إضافية؛ الدقيقة استثناء مبرر لا استهلاك للرصيد.' }
  return { ...planFor(48, clipSeconds), reason: count >= 350 && count <= 450 ? 'هذه المدة هي الأنسب لمقالة بين 350 و450 كلمة: تشرح الجوهر ولا تحاول قراءة المقال كاملاً.' : 'الفكرة تحتاج خطافاً ومشكلة ونقطتين ورأي د. أحمد وخاتمة، بلا حشو.' }
}

export function recommendPublicVideoDuration(input: Pick<PublicVideoInput, 'topic' | 'message' | 'wantsSeries'>, clipSeconds = DEFAULT_FLOW_CLIP_SECONDS) {
  const text = `${input.topic} ${input.message || ''}`.trim()
  const count = wordCount(text)
  const manyAxes = input.wantsSeries || count > 180 || /سلسلة|محاور|أجزاء|أسباب.*نتائج.*حلول|كل ما يتعلق/i.test(text)
  const complex = count > 55 || /دراسة|إحصائي|مقارنة|مشكلة.*حل|لماذا.*كيف|موقف.*توضيح|أكثر من جانب/i.test(text)
  if (manyAxes) return { ...planFor(24, clipSeconds), series: true, reason: 'الموضوع أكبر من فيديو واحد؛ سيُقسّم إلى سلسلة مستقلة بدل حشره في فيديو واحد.' }
  if (count <= 14 && /[؟?]$|اقتباس|ومضة|جملة/i.test(text)) return { ...planFor(8, clipSeconds), series: false, reason: 'الفكرة جملة واحدة أو سؤال؛ مقطع واحد يحافظ على قوتها.' }
  if (complex) return { ...planFor(48, clipSeconds), series: false, reason: 'الموضوع يحتاج تفسيراً ومثالاً ورأياً واضحاً؛ الاختزال هنا مخلّ.' }
  return { ...planFor(24, clipSeconds), series: false, reason: 'موضوع عام واحد؛ الخطاف والتفسير والخاتمة تكفي في رصيد يوم واحد.' }
}

const ARTICLE_ROLES: Record<number, string[]> = {
  1: ['الومضة'],
  2: ['الخطاف وجوهر الفكرة', 'رأي د. أحمد والدعوة إلى القراءة'],
  4: ['الخطاف', 'المشكلة', 'رأي د. أحمد', 'الخاتمة والدعوة'],
  3: ['الخطاف', 'رأي د. أحمد وجوهر الفكرة', 'الخاتمة والدعوة'],
  6: ['الخطاف', 'المشكلة', 'الفكرة الأولى', 'الفكرة الثانية أو المثال', 'رأي د. أحمد', 'الخاتمة والدعوة'],
  8: ['الخطاف', 'المشهد أو المشكلة', 'السؤال المركزي', 'الفكرة الأولى', 'المقارنة أو الدليل', 'الفكرة الثانية', 'رأي د. أحمد', 'الخاتمة والدعوة'],
}

const PUBLIC_ROLES: Record<number, string[]> = {
  1: ['الومضة'],
  2: ['الخطاف', 'الفكرة والخاتمة'],
  4: ['الخطاف', 'التفسير', 'المثال أو الدليل', 'الخاتمة والدعوة'],
  3: ['الخطاف', 'الفكرة أو التفسير', 'الخاتمة أو السؤال'],
  6: ['الخطاف', 'المشكلة', 'التفسير', 'المثال أو الدليل', 'رأي د. أحمد', 'الخاتمة والدعوة'],
}

/** حروفٌ وأدواتٌ لا تصلح آخر جملةٍ منطوقة؛ وجودها في النهاية يعني قطعاً في منتصف المعنى. */
const DANGLING = /\s(?:بل|من|في|إلى|على|عن|أن|إن|أو|و|ثم|لكن|لأن|التي|الذي|مع|بين|عند|قد|كي|حتى)$/

/**
 * يقتطع جملةً طويلة عند حدّ معنى لا عند حدّ عدد.
 * الجملة المُظلَّلة كلامه هو؛ قطعها في منتصفها يشوّهه، فنأخذ أطول مقطعٍ تامّ يسع المدة.
 */
function clipToClause(value: string, maximum: number, fallback = '') {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  if (wordCount(clean) <= maximum) return clean.replace(/[،؛:]$/, '')
  const clauses = clean.split(/(?<=[؛،:.…])\s+|\s+(?=بل\s)/).map((part) => part.replace(/[،؛:.…]+$/, '').trim()).filter(Boolean)
  const fitting = clauses.filter((clause) => wordCount(clause) <= maximum && wordCount(clause) >= 5)
  if (fitting.length) return fitting.sort((left, right) => wordCount(right) - wordCount(left))[0]
  let trimmed = clipWords(clean, maximum, fallback)
  while (DANGLING.test(trimmed)) trimmed = trimmed.replace(DANGLING, '')
  return trimmed || fallback
}

/** سطرٌ مع نسبه: كلامه المُظلَّل أولاً، ثم متنه، ثم صياغة المحرك أخيراً. */
type SourcedLine = { text: string; source: NarrationSource; resonanceCount: number }

const sourced = (text: string, source: NarrationSource, resonanceCount = 0): SourcedLine => ({ text: polishTypography(text), source, resonanceCount })

/** قوالب الخطاف لا تُستعمل إلا حين لا توجد جملة له تصلح؛ وتتنوّع بثبات مع العنوان. */
const HOOK_SHAPES = [
  (subject: string) => `ماذا لو كان ${subject} أعمق مما نظن؟`,
  (subject: string) => `${subject}… والسؤال الذي لا نسأله.`,
  (subject: string) => `ما الذي يتغيّر لو نظرنا إلى ${subject} من زاوية أخرى؟`,
  (subject: string) => `يُقال الكثير عن ${subject}. والحقيقة أهدأ من ذلك.`,
]

function scaffoldHook(title: string) {
  let hash = 2166136261
  for (const character of title) { hash ^= character.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) }
  return HOOK_SHAPES[(hash >>> 0) % HOOK_SHAPES.length](clipWords(title, 7, 'هذا السؤال'))
}

function articleNarration(article: ArticleRecord, count: number, forge?: ForgeInput): SourcedLine[] {
  const body = article.body || article.excerpt || article.title
  const sentences = meaningfulSentences(body)
  const resonant = [...(forge?.resonantLines || [])].filter((line) => line.text.trim()).sort((left, right) => right.count - left.count)
  const verified = forge?.verifiedLine?.trim() || ''
  const central = clipWords(article.excerpt || sentences[0] || article.title, 12, article.title)

  // الخطاف: الجملة التي أوقفت القرّاء فعلاً أولى من أي قالب.
  const hook: SourcedLine = resonant[0]
    ? sourced(clipToClause(resonant[0].text, 11, central), 'resonance', resonant[0].count)
    : sourced(scaffoldHook(article.title), 'scaffold')

  // الرأي: كلامه هو، مُظلَّلاً أو موثّقاً من متنه — لا صياغة عنه.
  const verdictLine = resonant[1] || resonant[0]
  const verdict: SourcedLine = verdictLine && verdictLine.text !== (resonant[0] && hook.source === 'resonance' ? resonant[0].text : '')
    ? sourced(clipToClause(verdictLine.text, 11, central), 'resonance', verdictLine.count)
    : verified
      ? sourced(clipToClause(verified, 11, central), 'verified')
      : sourced(clipToClause(strongestQuote(body) || central, 11, central), 'derived')

  // الجملة المقتطعة لا تطابق أصلها حرفاً بحرف؛ فالاستبعاد بالاحتواء لا بالمساواة، وإلا تكرّر الخطاف.
  const taken = [hook.text, verdict.text].map(bareLine).filter(Boolean)
  const rest = sentences.filter((item) => {
    const bare = bareLine(item)
    return bare && !taken.some((used) => bare.includes(used) || used.includes(bare))
  })
  const problem: SourcedLine = rest[0] ? sourced(clipToClause(rest[0], 12, central), 'derived') : sourced(clipWords(central, 12, central), 'derived')
  const first: SourcedLine = rest[1] ? sourced(clipToClause(rest[1], 11, central), 'derived') : sourced(clipWords(central, 11, central), 'derived')
  const second: SourcedLine = rest[2] ? sourced(clipToClause(rest[2], 11, central), 'derived') : first
  const closing: SourcedLine = sourced('الفكرة كاملة في المقال؛ اقرأها ثم اختبرها في واقعك.', 'scaffold')

  if (count === 1) return [hook]
  if (count === 2) return [hook, verdict]
  if (count === 3) return [hook, verdict, closing]
  if (count === 4) return [hook, problem, verdict, closing]
  if (count === 8) return [hook, problem, sourced(clipWords(central, 9, central), 'derived'), first, sourced(clipToClause(rest[3] || second.text, 11, central), 'derived'), second, verdict, closing]
  return [hook, problem, first, second, verdict, closing]
}

function publicNarration(topic: string, message: string, count: number, forge?: ForgeInput): SourcedLine[] {
  const central = clipWords(message || topic, 12, topic)
  const sentences = meaningfulSentences(`${message} ${topic}`.trim())
  const verified = forge?.verifiedLine?.trim() || ''
  const resonant = [...(forge?.resonantLines || [])].sort((left, right) => right.count - left.count)

  const one = sourced(`${clipWords(central, 11, 'فكرة تستحق التأمل')}.`, 'derived')
  const hook: SourcedLine = resonant[0]
    ? sourced(clipToClause(resonant[0].text, 11, central), 'resonance', resonant[0].count)
    : sourced(scaffoldHook(topic), 'scaffold')
  const core = sourced(clipWords(central, 10, central), 'derived')
  const closing = sourced('ما الذي سيتغيّر لو أخذنا هذا السؤال بجدية؟', 'scaffold')
  // الرأي في الفيديو العام: كلامه إن وُجد، وإلا فرسالته هو كما كتبها — لا حكمة مُعلَّبة.
  const verdict: SourcedLine = verified
    ? sourced(clipToClause(verified, 11, central), 'verified')
    : sourced(clipToClause(message || sentences[0] || central, 11, central), 'derived')

  if (count === 1) return [resonant[0] ? hook : one]
  if (count === 2) return [hook, verdict]
  if (count === 4) return [hook, core, verdict, closing]
  if (count === 6) return [
    hook,
    sourced(clipToClause(sentences[0] || central, 12, central), 'derived'),
    core,
    sourced(clipToClause(sentences[1] || central, 12, central), 'derived'),
    verdict,
    closing,
  ]
  return [hook, core, closing]
}

function appearanceFor(index: number, count: number, cast: CastMode): FlowAppearance {
  // بلا أفتار (ناس المشهد أو بلا ناس) يعني ألّا تظهر نسخته في أي مقطع.
  if (!usesAvatar(cast)) return 'visual_only'
  if (count <= 2) return index === 0 ? 'avatar_direct' : 'avatar_with_object'
  if (count === 3) return index === 0 ? 'avatar_direct' : index === 2 ? 'avatar_with_object' : 'visual_only'
  if (count === 4) return index === 0 ? 'avatar_direct' : index === 2 ? 'avatar_with_object' : 'visual_only'
  const map: FlowAppearance[] = ['avatar_direct', 'visual_only', 'visual_only', 'visual_only', 'avatar_direct', 'avatar_with_object', 'visual_only', 'avatar_direct']
  return map[index] || 'visual_only'
}

const SHIFT_ROLE = /المثال|الدليل|المقارنة|الخاتمة|التحول/

function voiceModeFor(appearance: FlowAppearance, role: string, count: number): VoiceMode {
  if (appearance !== 'visual_only') return 'avatar_speech'
  // مقطع بصري واحد بلا جملة منطوقة: الصورة أقوى، والمعنى ينتقل إلى خطة النصوص المضافة.
  if (count >= 6 && /المثال|الدليل|المقارنة/.test(role)) return 'ambient'
  return 'voice_over'
}

/** يختار نمط الترابط مع المقطع السابق؛ المقطع الأول مشهد مؤسس دائماً. */
function continuityModeFor(index: number, appearances: FlowAppearance[], role: string): ContinuityMode {
  if (index === 0) return 'independent'
  const previous = appearances[index - 1]
  const current = appearances[index]
  const previousAvatar = previous !== 'visual_only'
  const currentAvatar = current !== 'visual_only'
  if (previousAvatar !== currentAvatar) return 'thematic'
  if (!currentAvatar && SHIFT_ROLE.test(role)) return 'thematic'
  return currentAvatar ? 'direct' : 'soft'
}

const DEFAULT_REFERENCE: Record<ContinuityMode, ReferenceStrategy> = {
  independent: 'none',
  direct: 'last_frame',
  soft: 'selected_frame',
  thematic: 'style_only',
}

export const CONTINUITY_LABELS: Record<ContinuityMode, string> = {
  direct: 'امتداد مباشر',
  soft: 'امتداد بصري لطيف',
  thematic: 'انتقال موضوعي',
  independent: 'مشهد مؤسس',
}

export const REFERENCE_LABELS: Record<ReferenceStrategy, string> = {
  last_frame: 'الإطار الأخير',
  selected_frame: 'إطار مختار يدوياً',
  style_only: 'مرجع هوية ولون فقط',
  none: 'بلا مرجع',
}

export const VOICE_MODE_LABELS: Record<VoiceMode, string> = {
  avatar_speech: 'حديث مباشر بالأفتار',
  voice_over: 'تعليق صوتي فوق مشهد',
  ambient: 'مشهد بصري وصوت بيئي',
}

const CONTINUITY_CLAUSES: Record<ContinuityMode, string[]> = {
  direct: [
    'Continue the exact visual moment.',
    'Maintain body position and gaze logic.',
    'Continue the existing motion naturally.',
    'Do not introduce a new environment.',
    'Do not reset the character pose.',
  ],
  soft: [
    'Maintain the same cinematic world.',
    'Preserve environment and lighting.',
    'Shift to the requested camera angle smoothly.',
    'Keep the scene visually continuous despite the controlled reframing.',
  ],
  thematic: [
    'Maintain the established visual identity and emotional tone.',
    'Transition into the related new setting using a shared color, object, motion or sound.',
    'Do not make the new clip feel like an unrelated video.',
  ],
  independent: [
    'This is the founding scene of the project.',
    'Establish the environment, light direction, palette and framing logic that the following clips will inherit.',
  ],
}

/** كل ما يُنسخ إلى Flow إنجليزي خالص؛ الجملة الصوتية تُدار منفصلة عند الحاجة. */
const TONE_EN: Record<LiveDirectorTone, string> = {
  'فكرية': 'reflective and intellectual',
  'تربوية': 'educational and grounded',
  'إنسانية': 'human, warm and unforced',
  'صادمة': 'striking and direct',
  'إعلامية': 'broadcast-ready and composed',
  'أكاديمية مبسطة': 'accessible academic',
  'مستقبلية': 'future-facing and clean',
  'ساخرة بذكاء': 'wry and intelligent',
}

const ROLE_EN: Array<[RegExp, string]> = [
  [/الخطاف/, 'hook — stop the scroll with one visual question'],
  [/الومضة/, 'single flash — one idea, one image'],
  [/المشكلة|المشهد/, 'the problem — show why it matters'],
  [/السؤال المركزي/, 'the central question'],
  [/الفكرة الأولى/, 'first idea — one point only'],
  [/المقارنة|الدليل|المثال/, 'example or evidence'],
  [/الفكرة الثانية/, 'second idea'],
  [/التفسير/, 'explanation'],
  [/رأي/, 'the author verdict — the quotable line'],
  [/الخاتمة|الدعوة/, 'closing beat and invitation to read'],
  [/جوهر الفكرة/, 'the core idea'],
]

const PLATFORM_EN: Record<LiveDirectorPlatform, string> = {
  'Instagram Reels': 'Instagram Reels',
  'X': 'X',
  'YouTube Shorts': 'YouTube Shorts',
  'LinkedIn': 'LinkedIn',
  'TikTok': 'TikTok',
  'متعدد المنصات': 'multi-platform vertical distribution',
}

const OVERLAY_POSITION_EN: Record<OverlayCue['position'], string> = {
  'أعلى الإطار': 'upper third',
  'أسفل الإطار': 'lower third',
  'وسط الإطار': 'centre of frame',
}

function roleInEnglish(role: string) {
  return ROLE_EN.find(([pattern]) => pattern.test(role))?.[1] || 'carry one clear idea forward'
}

const REFERENCE_HEADER ='Continue from the provided reference frame. Use it as the visual starting point of the new 8-second clip. Preserve the selected saved character reference, wardrobe, lighting, environment, color palette, background details, time of day and cinematic tone. Continue the motion naturally instead of restarting or redesigning the scene from scratch.'

function referenceInstruction(mode: ContinuityMode, strategy: ReferenceStrategy, hasFrame: boolean) {
  if (strategy === 'none' || mode === 'independent') return 'Reference handling: no uploaded frame is required. Build the opening state from the written sequence instructions.'
  if (!hasFrame) return `Reference handling: no uploaded frame is required. Continue from the immediately previous generated clip using sequence continuity and the written handoff below. ${CONTINUITY_CLAUSES[mode].join(' ')}`
  if (strategy === 'style_only') return `Reference handling: use the optional attached frame for identity, wardrobe, palette and lighting only, not for composition. ${CONTINUITY_CLAUSES[mode].join(' ')}`
  return `${REFERENCE_HEADER} ${CONTINUITY_CLAUSES[mode].join(' ')}`
}

function startStateFor(mode: ContinuityMode) {
  // كان «إطاراً مستقراً» فيناقض قانون الافتتاح سطراً بسطر داخل البرومبت الواحد.
  if (mode === 'independent') return 'Open on the first frame of an action already in progress; the environment, light direction and palette for the whole project are established through that motion, not through a static establishing shot.'
  if (mode === 'direct') return 'Open exactly on the visual state of the reference frame: same pose, same gaze direction, same light.'
  if (mode === 'soft') return 'Open inside the same environment as the previous clip, seen from the newly requested angle.'
  return 'Open on the shared visual link — colour, object, motion or sound — carried over from the previous clip.'
}

function endStateFor(role: string) {
  if (role.includes('الخطاف')) return 'End on a held, unresolved beat with the subject still in frame, ready to be inherited by the next clip.'
  if (role.includes('الخاتمة') || role.includes('الدعوة')) return 'End on a stable quiet frame with clean negative space reserved for the title and link added later in editing.'
  return 'End on a stable handoff: one clear object or gaze direction that the next clip can start from.'
}

function overlayFor(input: { role: string; order: number; count: number; voiceMode: VoiceMode; title: string; message: string; articleUrl: string; seconds?: number }): OverlayCue[] {
  const cues: OverlayCue[] = []
  // التوقيتات كانت مثبتة على ثماني ثوانٍ؛ صارت نِسَباً فتصحّ على أي مدة.
  const total = input.seconds && input.seconds > 0 ? input.seconds : DEFAULT_FLOW_CLIP_SECONDS
  const at = (ratio: number) => Math.round(total * ratio * 10) / 10
  if (input.voiceMode === 'ambient') cues.push({ kind: 'عنوان', text: clipWords(input.message, 8, input.title), from: at(0.125), to: at(0.6875), position: 'وسط الإطار', space: 'اترك ثلث الإطار الأوسط نظيفاً بلا عناصر.' })
  if (input.role.includes('رأي')) cues.push({ kind: 'اقتباس', text: clipWords(input.message, 10, input.title), from: at(0.25), to: at(0.8125), position: 'أسفل الإطار', space: 'اترك الثلث السفلي هادئاً بلا تفاصيل متحركة.' })
  if (input.order === input.count) {
    cues.push({ kind: 'عنوان', text: clipWords(input.title, 7, input.title), from: at(0.0625), to: at(0.4375), position: 'أعلى الإطار', space: 'اترك الثلث العلوي فارغاً.' })
    cues.push({ kind: input.articleUrl ? 'رابط' : 'دعوة', text: input.articleUrl || 'اكتب رأيك في التعليقات', from: at(0.5625), to: total, position: 'أسفل الإطار', space: 'اترك الثلث السفلي فارغاً ومستقراً.' })
  }
  return cues
}

function shotsFor(index: number, role: string, appearance: FlowAppearance): 1 | 2 | 3 {
  if (appearance === 'visual_only') return role.includes('الخطاف') || role.includes('الخاتمة') ? 3 : 2
  if (role.includes('الخطاف') || role.includes('الخاتمة')) return 3
  if (role.includes('رأي')) return 1
  return index % 3 === 0 ? 1 : 2
}

/** خطة اللقطات تتبع مدة المقطع المختارة؛ الثماني لم تعد مفروضة. */
function shotPlan(count: 1 | 2 | 3, appearance: FlowAppearance, seconds = DEFAULT_FLOW_CLIP_SECONDS) {
  return shotPlanForSeconds(count, seconds, appearance !== 'visual_only')
}

function constraintsFor(appearance: FlowAppearance, count: number, cast: CastMode = 'people') {
  const common = ['generated text', 'visible text in any language', 'Arabic text inside the scene', 'English text inside the scene', 'letters', 'numbers', 'captions', 'subtitles generated inside Flow', 'labels', 'signage', 'interface text', 'logos', 'watermarks', 'multiple locations', 'shaky camera', 'visual clutter', 'sudden lighting changes']
  /* «بلا ناس» لا يكفي أن يُقال في الوصف: النموذج يدسّ يداً أو ظلاً أو انعكاس
     وجه ما لم يُمنع صراحةً. المنع هنا شاملٌ لكل أثرٍ بشريٍّ مرئي. */
  if (cast === 'no_people') return [...common, 'people', 'any human being', 'human figures', 'faces', 'hands', 'fingers', 'arms', 'human silhouettes', 'shadows of people', 'reflections of people', 'crowds', 'body parts', 'mannequins', 'portraits or photographs of people', 'anyone entering or leaving the frame', count <= 2 ? 'multiple camera movements' : 'more than three cuts']
  // «extra characters» يناقض «ناسٌ حاضرون»؛ فلا يُمنع إلا حيث لا ناس أصلاً أو حيث هو وحده.
  if (appearance === 'visual_only') return [...common, ...(cast === 'people' || cast === 'avatar_and_people' ? [] : ['extra characters']), 'recognisable celebrity faces', count <= 2 ? 'multiple camera movements' : 'more than three cuts']
  return [...common, ...(cast === 'avatar_and_people' ? ['anyone resembling the main figure', 'body doubles'] : ['extra characters']), 'face changes', 'identity drift', 'voice changes', 'wardrobe changes', 'age changes', 'lookalike replacement', 'distorted hands', 'extra fingers', 'unnatural mouth movement', 'poor lip synchronization', 'exaggerated gestures', count <= 2 ? 'multiple camera movements' : 'more than three cuts']
}

/* العطب الذي كشفه الدكتور (٢٩ أغسطس ٢٠٢٦): كان القفل يقول «استخدم الأفتار
   المحفوظ في Flow»، والنموذج لا يرى أي أفتار محفوظ ما لم تُرفَق صورةٌ مرجعية
   في «Ingredients» داخل Flow — فاخترع رجلاً أوروبياً مسنّاً في مكتبة فيكتورية.
   الأمانة أولى: القفل يصف الشرط صراحةً بدل أن يفترض المستحيل. */
/* رفض Flow التوليد: «This prompt might violate our policies about generating
   prominent people». العلّة أن القفل كان يذكر الاسم صراحةً، فقُرئ طلباً لتوليد
   شخصٍ حقيقي معروف. والأفتار يُختار في «Ingredients» داخل اللوحة، فذكر الاسم
   لا يفيد المولّد أصلاً — إنما يوقظ فلتر المشاهير. لا اسم في البرومبت أبداً. */
const AVATAR_LOCK = 'IDENTITY — The only person in frame is the character reference the creator has already selected in this generation. It is chosen in the interface, never described here, and it must be reproduced exactly: same face, age, skin tone, hair, beard and build as that saved reference. Never invent, age, westernise, or substitute a different or similar-looking person, and never fall back to a generic professor, scholar, or presenter figure. If no character reference is attached to this generation, keep every human face out of the frame entirely and carry the meaning through hands, silhouette, and the environment instead.'

/* «أنا ومعي ناس» يحتاج قفلاً مختلفاً: القفل الأصلي يقول «الشخص الوحيد في
   الإطار»، فيمنع الآخرين نصّاً. الهوية تبقى مقفلة عليه وحده، والآخرون
   مسموحون بشرط ألّا يشبهه أحدهم — وهو أخطر ما يفعله المولّد هنا. */
const AVATAR_WITH_PEOPLE_LOCK = 'IDENTITY — One figure in this scene is the character reference the creator has already selected in this generation. It is chosen in the interface, never described here, and must be reproduced exactly: same face, age, skin tone, hair, beard and build as that saved reference, never aged, westernised or substituted. Other people may appear in the scene as participants in the action, but none of them may resemble that figure, share its features, wardrobe or build, or be mistaken for it; they are clearly different individuals, and none of them addresses the camera. If no character reference is attached to this generation, keep every human face out of the frame entirely and carry the meaning through hands, silhouette, and the environment instead.'

const avatarLock = (cast: CastMode) => cast === 'avatar_and_people' ? AVATAR_WITH_PEOPLE_LOCK : AVATAR_LOCK

const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]+/g

/*
 * بنك المشاهد.
 *
 * العلّة التي حكم عليها الدكتور (٣٠ أغسطس ٢٠٢٦): «غير جميل وغير مشوّق». كانت
 * كل جملةٍ هنا تصف **حالة** لا **حدثاً**: «معلّمٌ متأمّل يدرس واجهةً رقمية».
 * الحالة تُنتج صورةً ثابتة تتحرك قليلاً — بطاقةً بريدية. والقاعدة الجديدة:
 * كل مشهدٍ فعلٌ مرئيٌّ له قبلٌ وبعد، يُرى فيه شيءٌ **يتغيّر حاله** لا موضعه.
 *
 * ولكل مفهومٍ مساران: `scenes` حين يُسمح بالبشر، و`objects` حين يختار الدكتور
 * «بلا ناس» — فلا يُترك النموذج يترجم مشهداً بشرياً إلى «بلا ناس» بنفسه.
 */
const VISUAL_CONCEPTS: Array<{ pattern: RegExp; scenes: string[]; objects: string[] }> = [
  { pattern: /ذكاء اصطناعي|خوارزم|تكنولوجيا|تقني|رقمي|هاتف|شاشة|منصات|إنترنت|بيانات/, scenes: [
    'A hand stops mid-air over a glowing interface, then deliberately closes it; the room light shifts from cold screen-blue to warm daylight as the decision lands.',
    'Automated suggestions cascade across a surface faster and faster until a single human hand presses one down and the cascade halts.',
    'A screen dims while a paper notebook is pulled into the light; the beam physically travels from one to the other.',
  ], objects: [
    'A dense stream of glowing particles races through a dark space, accelerating, until a single physical object drops into its path and the whole stream reorganises around it.',
    'Cold blue screen light drains out of a room as warm daylight floods in from the side, revealing dust, paper texture and depth that the screen light had flattened.',
    'A tangle of cables and reflected light untangles itself in one continuous motion, resolving into a single clean line that runs to a single lamp.',
  ] },
  { pattern: /طفل|ابن|ابنة|أبناء|أسرة|بيت|والد|أم|أب/, scenes: [
    'A raised hand lowers and opens; the physical distance between two people closes across the shot as tension visibly drains from the frame.',
    'A door held half-shut is pushed slowly open by warm light spilling through, widening across the floor until the room changes character.',
    'A small object is passed between two pairs of hands; the exchange completes and the light warms as it settles.',
  ], objects: [
    'A small chair and a large chair sit apart; light travels across the floor and closes the gap between their shadows until the two shadows touch.',
    'A closed door edges open on its own weight and warm light floods across a cold floor, revealing texture, dust and depth as it advances.',
    'A stack of small worn objects is disturbed and resettles into a stable arrangement, each piece finding its place under a warming light.',
  ] },
  { pattern: /مدرسة|صف|طالب|معلم|تعليم|درس|تعلّم|منهج/, scenes: [
    'A pen stops copying, lifts, and instead circles one word; the whole page reorganises around that mark as focus pulls in.',
    'Rows of identical shapes on a surface begin to break formation until one stands apart and everything else falls out of focus.',
    'A hand sweeps a cluttered desk clear in one motion, leaving one object in a shaft of light.',
  ], objects: [
    'A row of identical objects sits in rigid formation; one shifts out of line and the light immediately reorganises around it while the rest fall into shadow.',
    'Chalk dust drifts through a hard beam of light and slowly reveals a shape that was invisible a second earlier.',
    'A sheet of paper covered in dense marks is lifted into the light; the marks resolve from noise into one legible pattern as the angle changes.',
  ] },
  { pattern: /بحث|دراسة|دراسات|سؤال|أكاديم|مصدر|دليل/, scenes: [
    'Scattered notes are swept and narrowed by a pair of hands until a single page remains lit and everything else falls to shadow.',
    'A magnifier moves across a dense surface, and the moment it stops, one line snaps into sharp focus while the rest blurs away.',
    'A wall of pinned material is stripped down piece by piece until one thread of connection remains taut across the frame.',
  ], objects: [
    'A drift of loose pages is caught by moving air, swirls upward, then settles until a single page remains standing in a shaft of light.',
    'A dense field of small objects contracts inward, tightening, until only one sits at the centre with clean space around it.',
    'Threads stretched across a dark space slacken and fall away one by one until a single taut line remains, catching the light.',
  ] },
  { pattern: /درجة|اختبار|تقييم|تفوق|نجاح|رسوب/, scenes: [
    'A single mark on paper is set beside a growing arrangement of richer evidence; the mark shrinks in the frame as the arrangement expands past it.',
    'A hand covers a number, and everything the number was hiding becomes visible around it.',
    'A stamped page is slid away and what is underneath keeps unfolding well beyond its edge.',
  ] , objects: [
    'A small rigid card sits alone under a hard light; a wider warm light rises around it and the card visibly shrinks in importance as the frame reveals what surrounds it.',
    'A single mark on a surface is overtaken by an expanding pattern of texture and detail that keeps growing past the edge of frame.',
    'A measuring tool is laid over an object it cannot span; the object keeps extending beyond the tool as the camera pulls back.',
  ] },
  { pattern: /غضب|صراخ|خلاف|حدود|سلوك|عقاب|حزم/, scenes: [
    'Fast, agitated motion in the frame decelerates to a full stop on one held breath, and the light steadies with it.',
    'A hand grips hard, then deliberately releases; the object it held settles and stops rattling.',
    'Two moving elements converge on a collision, then one halts a fraction short and the frame stills.',
  ], objects: [
    'A surface vibrating hard with agitated objects slows and settles until every object is perfectly still and one line of light steadies across them.',
    'A door slams toward its frame and stops a hair short, and everything disturbed in the room settles back into stillness behind it.',
    'A taut cord under visible strain slackens in one controlled release without snapping, and the whole frame stops shaking.',
  ] },
  { pattern: /مقارنة|شهرة|متابع|محتوى|إعلان|منصات/, scenes: [
    'A rush of polished images streams past a figure and blows out into overexposure; when it clears, one ordinary object remains lit and still.',
    'Rising figures climb across a surface until they overshoot the frame, and attention falls back to a single physical thing on the table.',
    'A bright display is switched off and the room reveals its real texture and depth for the first time.',
  ], objects: [
    'A blizzard of bright reflective fragments races across the frame, overwhelming it, then thins out and clears to leave one plain object still lit.',
    'A wall of flickering light peaks, blows out to white, then falls away to reveal one matte, ordinary surface with real texture.',
    'Glossy surfaces multiply reflections until the frame is unreadable, then all but one reflection extinguishes.',
  ] },
  { pattern: /قراءة|كتاب|كتب|مقال|معرفة/, scenes: [
    'A book falls open and its pages riffle to a stop on one spread; light lands across it and holds.',
    'A hand marks one line and the surrounding page recedes into soft shadow around the mark.',
    'A closed book is drawn out of a crowded shelf and the gap it leaves fills with light.',
  ], objects: [
    'A closed book opens under its own weight, pages riffling in a wave until they settle on one spread struck by hard side light.',
    'Dust lifts off a stacked spine as it slides out of a shelf, and the gap left behind fills with a shaft of warm light.',
    'A page curls, catches the light along its edge, and flattens; the texture of the paper becomes fully legible as it settles.',
  ] },
  { pattern: /قياد|فريق|مبادرة|إدارة|قرار|مؤسسة/, scenes: [
    'A written directive is set down and, one after another, hands enter the frame and take a piece of it away until only the empty surface remains.',
    'Scattered elements converge and lock into one aligned formation in a single continuous motion.',
    'A single chair is turned to face the others and the whole geometry of the room resolves.',
  ], objects: [
    'Scattered geometric pieces slide across a surface and lock into one aligned formation in a single continuous motion, and the light straightens with them.',
    'A single heavy object is set down at the centre and everything loose on the surface reorients toward it.',
    'A crooked line of objects self-corrects piece by piece until it runs perfectly true and one shaft of light runs along it.',
  ] },
  { pattern: /إرهاق|تعب|نوم|راحة|ضغط|قلق|تركيز|انتباه/, scenes: [
    'A frantically busy frame empties as clutter is lifted away piece by piece until one lit object and clean space remain.',
    'Blinking, competing light sources extinguish one by one until a single steady lamp is left burning.',
    'Rapid overlapping motion decays into one slow, even, breathing rhythm.',
  ], objects: [
    'A dozen small light sources blink and compete, then extinguish one after another until a single steady warm lamp holds the frame alone.',
    'A cluttered surface is progressively cleared by moving air until one object remains in clean space, and the room quietens visibly.',
    'Fast, overlapping ripples across a liquid surface decay into one slow, even, breathing rhythm that finally stills.',
  ] },
  { pattern: /مستقبل|مهارة|وظائف|تغيير|تطور/, scenes: [
    'A stream of objects rushes past a still figure and disintegrates; what the figure is holding stays intact and lit.',
    'A crowded wall of predictions peels away layer by layer until a small, solid set of tools remains.',
    'A path ahead reconfigures itself repeatedly while a single held object never changes.',
  ], objects: [
    'A stream of shifting, temporary forms rushes through the frame and dissolves, while one solid, weathered object at the centre stays completely intact and lit.',
    'A dense wall of layered material peels away sheet by sheet until a small, solid, unchanged core remains.',
    'A surface reconfigures itself repeatedly beneath one heavy object that never moves, and the light on that object never changes.',
  ] },
]

/* المسار الافتراضي حين لا ينطبق أي مفهوم — أحداثٌ لا حالات، وبمسارين. */
const FALLBACK_SCENES = [
  'An abstract idea is made physical by one visible cause-and-effect action that completes on camera: something is set in motion, meets resistance, and resolves.',
  'A cluttered, uncertain frame is reduced by one decisive action until a single clear subject stands in generous negative space.',
  'Two opposing forces meet in frame; one gives way and the balance visibly settles.',
]

const FALLBACK_OBJECTS = [
  'One object is set in motion, meets resistance, and resolves into a new stable state — the whole cause-and-effect visible on camera with no person present.',
  'A crowded field of material is reduced by moving air and light until a single object stands alone in clean space.',
  'Two opposing physical forces meet on a surface; one gives way and the balance visibly settles into stillness.',
]

/**
 * وصف المشهد الإنجليزي — حدثٌ لا حالة، ومسارٌ لكل طاقم.
 * وسطر «التحوّل» في آخره يمنع النموذج من الاكتفاء بلقطةٍ جميلةٍ بلا حكاية.
 */
function visualBriefFor(source: string, role: string, order: number, cast: CastMode = 'people') {
  const concept = VISUAL_CONCEPTS.find((item) => item.pattern.test(source))
  const bank = cast === 'no_people'
    ? (concept?.objects || FALLBACK_OBJECTS)
    : (concept?.scenes || FALLBACK_SCENES)
  const scene = bank[Math.abs(order - 1) % bank.length]
  const castRule = cast === 'no_people'
    ? ' Absolutely no human being appears: no face, no hand, no arm, no silhouette, no shadow or reflection of a person, and nobody entering or leaving frame. The objects, the material, the light and the space carry the entire meaning.'
    : cast === 'people'
      ? ' People are present in the scene and take part in the action, but never as a presenter or spokesperson: nobody addresses the camera, and posture, hands and what they are doing carry the meaning rather than a performance to camera.'
      : cast === 'avatar_and_people'
        ? ' The selected character reference is one figure in the scene and other people take part in the action around that figure; none of them resembles it and none of them addresses the camera.'
        : ''
  return `${scene}${castRule} The visual beat must serve this function: ${roleInEnglish(role)}. Required transformation: the frame must not end the way it began — one thing must visibly change state, not merely change position.`
}

/**
 * حارس الاسم — آخر مصفاة قبل Flow.
 *
 * رفض Flow التوليد بحجّة «توليد شخصٍ معروف» لأن الاسم كان مكتوباً في القفل.
 * أزلتُه من كل نصٍّ ثابت، لكن الاسم قد يتسرّب من عنوان مقالٍ أو من وصف مشهدٍ
 * يبتكره نموذجٌ لغوي. فالمسح هنا حتميٌّ لا يعتمد على انضباط ما قبله: الأفتار
 * المختار داخل اللوحة هو الهوية، والنص لا يحتاج أن يسمّي أحداً.
 */
const REAL_NAME = /\b(?:dr\.?|prof\.?|professor)?\s*ahmad(?:\s+(?:hussain|husain|hussein))?(?:\s+al[-\s]?failakawi|\s+alfailakawi|\s+el[-\s]?failakawi)?\b/gi

function stripRealNames(value: string) {
  return value
    .replace(REAL_NAME, 'the selected character reference')
    .replace(/\bthe selected character reference’s\b/gi, 'the selected character reference’s')
    .replace(/ {2,}/g, ' ')
}

function englishOnly(value: string) {
  return stripRealNames(value)
    .replace(ARABIC_SCRIPT, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function continuationOpening(segment: Pick<LiveDirectorSegment, 'order' | 'continuityMode' | 'cast'>) {
  if (segment.order <= 1) {
    const people = segment.cast !== 'no_people'
    return `OPENING CLIP — This is the first clip in the sequence. Establish the exact visual world, ${people ? 'identity, wardrobe, ' : 'materials, '}location, lighting direction, camera logic, motion rhythm, sound texture, and emotional tone that every following clip must inherit.`
  }
  return `CONTINUATION CLIP ${segment.order} — This clip is a continuation of clip ${segment.order - 1} in the same uninterrupted video sequence. Begin from the exact visual, emotional, spatial, lighting, wardrobe, identity, camera-direction, motion, and sound state established at the end of the immediately previous clip. Do not restart, reintroduce, redesign, or treat this as a separate video. No reference image upload is required; preserve continuity from the previous generated clip and from the written handoff instructions below.`
}

function flowModeLabel(mode: FlowPromptMode) {
  if (mode === 'speech_ar') return 'WITH ARABIC SPEECH'
  if (mode === 'speech_en') return 'WITH ENGLISH SPEECH'
  return 'WITHOUT SPEECH'
}

function buildFlowPrompt(input: {
  segment: Omit<LiveDirectorSegment, 'prompt' | 'promptVersions' | 'flowPrompts'>
  title: string
  tone: LiveDirectorTone
  platform: LiveDirectorPlatform
  palette: string
  mode: FlowPromptMode
  /** النمط البصري المختار؛ يغيّر العدسة والإضاءة والتدرّج والنسيج. */
  look?: FlowLookId
  /** مدة المقطع؛ الثماني ثوانٍ افتراضٌ لا حتم (اشتراك Flow يسمح بأطول). */
  clipSeconds?: number
}) {
  const { segment, mode } = input
  const look = flowLook(input.look)
  const clipSeconds = input.clipSeconds || DEFAULT_FLOW_CLIP_SECONDS
  const avatar = segment.appearance !== 'visual_only'
  const spokenLanguage = mode === 'speech_ar' ? 'Arabic' : mode === 'speech_en' ? 'English' : ''
  const shotText = segment.shotPlan.map((shot, index) => `Shot ${index + 1} (${shot.from.toFixed(1)}-${shot.to.toFixed(1)}s): ${shot.framing}.`).join(' ')
  const cast: CastMode = segment.cast || (avatar ? 'avatar' : 'people')
  const visualBrief = segment.visualBrief || visualBriefFor(`${input.title} ${segment.message}`, segment.role, segment.order, cast)
  const subject = avatar
    ? `${avatarLock(cast)} Keep body movement simple and natural; avoid complex hand choreography.`
    : cast === 'no_people'
      ? 'CAST — There is no person in this clip and no avatar is used. Not a face, not a hand, not an arm, not a silhouette, not a shadow or reflection of a person, and nobody entering or leaving the frame at any moment. The subject is an object, a material, a place, or a physical phenomenon, and it alone carries the meaning through what visibly happens to it.'
      : cast === 'avatar_and_people'
        ? 'CAST — The selected character reference does not appear in this particular clip, but other people from the same scene may. Nobody addresses the camera and nobody stands in as a presenter or as a substitute for that figure. One clear action carries the meaning.'
        : 'CAST — No avatar and no presenter in this clip. People are present in the scene and may be seen fully, but never as a spokesperson: nobody addresses the camera and no single face is the subject. The action they are engaged in carries the meaning.'
  const sound = mode === 'silent'
    ? 'Environmental sound only. No dialogue, no voice-over, no narration, no spoken words, and no vocal reactions.'
    : avatar
      ? `Natural room ambience under the approved avatar performance. Spoken language: ${spokenLanguage}. Use only the exact creator-supplied ${spokenLanguage} line entered separately in Flow. Do not translate, paraphrase, add, omit, or invent any words. Preserve precise lip synchronization through every angle change.`
      : `Subtle natural environmental sound. Spoken language for the separately supplied voice-over: ${spokenLanguage}. Use only the exact creator-supplied line; do not translate, paraphrase, add, omit, or invent any words.`
  const speech = mode === 'silent'
    ? cast === 'no_people'
      ? 'Performance mode: completely silent visual scene with no performer of any kind. The material, the light and the motion carry it alone.'
      : 'Performance mode: completely silent visual performance. Anyone in frame must keep the mouth naturally closed and must not move the lips as if speaking.'
    : avatar
      ? `Performance mode: speaking avatar in ${spokenLanguage}. Deliver one short creator-supplied line with calm, natural pacing and authentic pronunciation. The exact wording is supplied separately in Flow. Never generate subtitles, captions, or visible text.`
      : `Performance mode: ${spokenLanguage} voice-over-ready visual. Keep the scene visually complete while the creator adds one exact short ${spokenLanguage} line separately. Never generate subtitles, captions, or visible text.`
  const overlay = segment.overlayPlan.length
    ? `Editorial overlay: all text is added later in editing, never generated inside Flow. Reserve clean space at ${unique(segment.overlayPlan.map((cue) => `${OVERLAY_POSITION_EN[cue.position]} (${cue.from.toFixed(1)}-${cue.to.toFixed(1)}s)`)).join(', ')}.`
    : 'Editorial overlay: none required for this clip.'
  /* أُعيد بناؤه على صيغة Veo الرسمية (تصوير + موضوع + فعل + سياق + أجواء)
     بعد حكم الدكتور على أول فيديو: كان ثلاثين سطراً متناثرة، إحدى عشرة كلمة
     هدوء، وأربعة أسطر منعٍ متفرّقة — فأنتج رجلاً جالساً في مكتبة بلا حدث.
     الوصف الآن أولاً وأغنى، والقيود ذيلٌ واحد. */
  const body = [
    `Duration: exactly ${clipSeconds} seconds. Vertical 9:16 cinematic film for ${PLATFORM_EN[input.platform] || 'multi-platform vertical distribution'}. Shot on a ${look.lens} at ${look.aperture}; ${look.depthOfField}. ${segment.shotCount === 1 ? 'One continuous shot' : `${segment.shotCount} connected shots in the same unbroken context`}. ${shotText}`,
    cinematographyBlock({ look, seconds: clipSeconds, order: segment.order, shotCount: segment.shotCount, role: segment.role, avatar }),
    `Prompt option: ${flowModeLabel(mode)}.`,
    subject,
    `This clip's job: ${roleInEnglish(segment.role)}. Primary action: ${segment.purpose}. One main action only, carried through without pause.`,
    `Scene: ${visualBrief}`,
    `Clip start state: ${segment.startState}`,
    `Clip end state: ${segment.endState}`,
    'One premium educational environment held throughout — same location, background, time of day and visual moment. Keep it alive rather than static: light shifting across surfaces, dust drifting through a beam, fabric and paper responding to movement, shallow focus breathing with the subject. Something in the frame changes every second.',
    `Look: ${TONE_EN[input.tone] || 'reflective and intellectual'} in feeling, photoreal and tactile, never illustrative or synthetic. Colour palette: ${input.palette}.`,
    `Sound design: ${sound}`,
    speech,
    `Continuity with the previous clip: ${segment.continuityMode}. ${segment.continuity} ${referenceInstruction(segment.continuityMode, segment.referenceStrategy, Boolean(segment.selectedReferenceFrame))}`,
    overlay,
    avatar ? avatarLock(cast) : cast === 'no_people' ? 'NO-PEOPLE LOCK — If the scene as described would normally contain a person, solve it without one. Never insert a human being to complete the composition.' : '',
    `Constraints — VISIBLE-TEXT RULE: generate absolutely no on-screen text of any kind in any language — no titles, captions, subtitles, labels, letters, numbers, signs, interface text, logos or watermarks; ${unique([...segment.negativeConstraints, 'generated dialogue wording', 'cartoon or plastic CGI look', 'morphing artifacts']).join(', ')}.`,
  ].filter(Boolean).join('\n')
  return englishOnly(`${continuationOpening(segment)}\n\n${body}`)
}

function buildFlowPrompts(input: Omit<Parameters<typeof buildFlowPrompt>[0], 'mode'>): FlowPromptVariants {
  return {
    speech_ar: buildFlowPrompt({ ...input, mode: 'speech_ar' }),
    speech_en: buildFlowPrompt({ ...input, mode: 'speech_en' }),
    silent: buildFlowPrompt({ ...input, mode: 'silent' }),
  }
}

function preferredPromptMode(segment: Pick<LiveDirectorSegment, 'voiceMode'>): FlowPromptMode {
  return segment.voiceMode === 'ambient' ? 'silent' : 'speech_ar'
}

export function getFlowPrompt(segment: LiveDirectorSegment, mode: FlowPromptMode) {
  const legacySpeech = segment.flowPrompts?.speech
  return segment.flowPrompts?.[mode]
    || (mode === 'speech_ar' ? legacySpeech : '')
    || englishOnly(segment.prompt)
}

type SegmentDraft = Omit<LiveDirectorSegment, 'prompt' | 'promptVersions' | 'flowPrompts'>

/** يعيد بناء مسارات برومبت المقطع الثلاثة بعد تغيير الترابط أو المرجع أو النص. */
function rebuiltFlowPrompts(segment: SegmentDraft, project: Pick<LiveDirectorProject, 'title' | 'tone' | 'platform'> & { look?: FlowLookId; clipSeconds?: number }) {
  return buildFlowPrompts({ segment, title: project.title, tone: project.tone, platform: project.platform, palette: PALETTE, look: project.look, clipSeconds: project.clipSeconds })
}

function rebuiltPrompt(segment: SegmentDraft, project: Pick<LiveDirectorProject, 'title' | 'tone' | 'platform'>) {
  const variants = rebuiltFlowPrompts(segment, project)
  return variants[preferredPromptMode(segment)]
}

const PALETTE = 'deep slate blue, warm ivory, restrained muted gold accents'

/**
 * الطاقم الافتراضي **ليس** الأفتار.
 *
 * كان `useAvatar: input.useAvatar !== false` — أي أن كل مشروعٍ يُفتح بالأفتار
 * مفروضاً ما لم يُطفأ صراحةً، وهو خطأ: الأفتار يتطلب اختياره داخل Flow، وحين
 * لا يُختار يخترع النموذج شخصاً آخر. صار الافتراض «بشر بلا أفتار»، والأفتار
 * قراراً يُتّخذ لا حالةً تُورَث. و`useAvatar` القديم يبقى مقروءاً للتوافق.
 */
function castFor(input: { castMode?: CastMode; useAvatar?: boolean }): CastMode {
  if (input.castMode) return input.castMode
  return input.useAvatar === true ? 'avatar' : 'people'
}

/** يبقى `useAvatar` صادقاً للمشاريع القديمة واللوحات: هل تظهر نسخته أصلاً؟ */
const avatarFlag = (cast: CastMode) => usesAvatar(cast)

function buildSegments(input: {
  type: LiveDirectorProjectType
  title: string
  narrations: SourcedLine[]
  cast: CastMode
  tone: LiveDirectorTone
  platform: LiveDirectorPlatform
  articleUrl?: string
  look?: FlowLookId
  clipSeconds?: number
}) {
  const count = input.narrations.length
  const clipSeconds = input.clipSeconds && input.clipSeconds > 0 ? input.clipSeconds : DEFAULT_FLOW_CLIP_SECONDS
  const cast = input.cast
  const roles = (input.type === 'article_video' ? ARTICLE_ROLES : PUBLIC_ROLES)[count] || PUBLIC_ROLES[3]
  const appearances = input.narrations.map((_, index) => appearanceFor(index, count, cast))
  return input.narrations.map((line, index) => {
    const narration = line.text
    const role = roles[index] || `المقطع ${index + 1}`
    const appearance = appearances[index]
    const voiceMode = voiceModeFor(appearance, role, count)
    const shotCount = shotsFor(index, role, appearance)
    const negativeConstraints = constraintsFor(appearance, shotCount, cast)
    const continuityMode = continuityModeFor(index, appearances, role)
    const message = clipToClause(narration, 12, role)
    const base: SegmentDraft = {
      id: `clip-${index + 1}`,
      order: index + 1,
      day: Math.floor(index / 3) + 1,
      duration: clipSeconds,
      role,
      purpose: role.includes('الخطاف') ? 'create an immediate visual question without a greeting' : role.includes('الخاتمة') ? 'resolve the visual idea and leave a memorable final beat' : `communicate the ${roleInEnglish(role)} with one visible cause-and-effect action`,
      message,
      visualBrief: visualBriefFor(`${input.title} ${message}`, role, index + 1, cast),
      appearance,
      cast,
      voiceMode,
      // المقطع الصامت يحمل معناه في الصورة وفي خطة النصوص المضافة، لا في جملة منطوقة.
      narration: voiceMode === 'ambient' ? '' : clipToClause(narration, voiceMode === 'voice_over' ? 14 : 11, narration),
      narrationSource: voiceMode === 'ambient' ? 'derived' : line.source,
      resonanceCount: line.resonanceCount,
      shotCount,
      shotPlan: shotPlan(shotCount, appearance, clipSeconds),
      negativeConstraints,
      continuity: `Same ${PALETTE} palette, the same lighting plan and the same lens character as the rest of the project, consistent background logic, and a visual handoff from clip ${Math.max(1, index)} to clip ${index + 2}.`,
      continuityMode,
      referenceStrategy: DEFAULT_REFERENCE[continuityMode],
      referenceSourceClipId: index === 0 ? '' : `clip-${index}`,
      selectedReferenceFrame: '',
      lastFrameImage: '',
      startState: startStateFor(continuityMode),
      endState: endStateFor(role),
      overlayPlan: overlayFor({ role, order: index + 1, count, voiceMode, title: input.title, message, articleUrl: input.articleUrl || '', seconds: clipSeconds }),
      status: 'not_generated',
      videoUrl: '',
      revisionReason: '',
    }
    const flowPrompts = rebuiltFlowPrompts(base, { title: input.title, tone: input.tone, platform: input.platform, look: input.look, clipSeconds })
    const prompt = flowPrompts[preferredPromptMode(base)]
    return { ...base, prompt, flowPrompts, promptVersions: [{ prompt, reason: 'النسخة الأولى', createdAt: now() }] }
  })
}

/** زوايا المسبك موزّعة على المنصات حتى لا يتكرر النص: لكل منصة زاوية مختلفة. */
const HUMAN_ANGLES = ['scene', 'letter', 'confession', 'three-points', 'open-question']
const PROFESSIONAL_ANGLES = ['rule', 'contrast', 'redefine', 'core-claim', 'figure', 'myth-break']
const INVITING_ANGLES = ['invitation', 'open-question', 'paradox']

function socialPack(input: { type: LiveDirectorProjectType; title: string; idea: string; articleUrl?: string; linkedArticle?: ArticleRecord | null; archive?: ArticleRecord[]; forge?: ForgeInput }): LiveDirectorSocialPack {
  const link = input.articleUrl ? `\n${input.articleUrl}` : ''
  const question = input.title.endsWith('؟') ? input.title : `ماذا يتغير لو أخذنا «${clipWords(input.title, 8, input.title)}» بجدية؟`
  let articleDecision: LiveDirectorSocialPack['articleDecision']
  if (input.type === 'public_topic_video') {
    if (input.linkedArticle) articleDecision = 'اربطه بمقالة موجودة'
    else if ((input.archive || []).length) {
      const addition = genuineAdditionMeter(input.title, input.idea, input.archive || [])
      articleDecision = addition.verdict === 'قريب من الأرشيف' ? 'حدّث مقالة قديمة' : addition.verdict === 'إضافة واضحة' ? 'حوّله إلى فكرة مقال' : 'أرسله إلى مجلس التحرير'
    } else articleDecision = 'أرسله إلى مجلس التحرير'
  }
  // مسبك التغريدات هو مصدر النصوص حين يُحقن؛ لا نبني نسخة أفقر منه هنا.
  const ranked = [...(input.forge?.drafts || [])].filter((draft) => draft.text.trim()).sort((left, right) => right.score - left.score)
  const takeDraft = (preferred: string[], used: string[]) =>
    ranked.find((draft) => preferred.includes(draft.angle) && !used.includes(draft.angle))
    || ranked.find((draft) => !used.includes(draft.angle))
  const forX = ranked[0]
  const used = forX ? [forX.angle] : []
  const forInstagram = takeDraft(HUMAN_ANGLES, used)
  if (forInstagram) used.push(forInstagram.angle)
  const forLinkedin = takeDraft(PROFESSIONAL_ANGLES, used)
  if (forLinkedin) used.push(forLinkedin.angle)
  const forCaption = takeDraft(INVITING_ANGLES, used)
  const echo = input.forge?.verifiedLine?.trim() || ''
  const withLink = (text: string) => text.includes('http') || !link ? text : `${text}${link}`

  return {
    coverText: clipWords(input.title, 7, input.title),
    caption: forCaption ? withLink(forCaption.text) : `${question}\n\n${clipWords(input.idea, 34, input.title)}\n\nالفيديو يفتح السؤال؛ والتفصيل يبقى في المادة الأصلية.${link}`,
    x: forX ? withLink(forX.text) : `${question}\n\n${clipWords(echo || input.idea, 26, input.title)}${link}`,
    instagram: forInstagram
      ? `${withLink(forInstagram.text)}\n\nاحفظ الفكرة، ثم اسأل نفسك أين تراها في يومك.`
      : `${question}\n\n${clipWords(input.idea, 30, input.title)}\n\nاحفظ الفكرة، ثم اسأل نفسك أين تراها في يومك.${link}`,
    linkedin: forLinkedin
      ? `${input.title}\n\n${withLink(forLinkedin.text)}\n\nما المعيار الذي تعتمدونه قبل التوسّع في هذا؟`
      : `${input.title}\n\n${clipWords(input.idea, 44, input.title)}\n\nما المعيار الذي تعتمدونه قبل التوسّع في هذا؟${link}`,
    youtube: `${clipWords(echo || input.idea, 55, input.title)}\n\n${input.type === 'article_video' ? `اقرأ المقالة كاملة: ${input.articleUrl || ''}` : 'هذا الفيديو جزء من مشروع د. أحمد الفكري والتربوي.'}`,
    audienceQuestion: question,
    callToAction: input.type === 'article_video' ? 'اقرأ المقالة كاملة من الرابط.' : 'اكتب المثال الذي ترى فيه الفكرة بوضوح.',
    // الوسوم من المسبك (مشتقّة من معجم مفاهيمه)، لا وسمان ثابتان لكل موضوع.
    hashtags: unique([...(forX?.hashtags || []), ...(forInstagram?.hashtags || [])]).slice(0, 2),
    thumbnailIdea: 'لقطة نظيفة عالية التباين من أقوى مشهد، مع مساحة فارغة لإضافة عنوان الغلاف يدوياً خارج Flow.',
    articleDecision,
  }
}

function quality(project: Pick<LiveDirectorProject, 'idea' | 'duration' | 'durationReason' | 'segments' | 'useAvatar' | 'social'> & { clipSeconds?: number; castMode?: CastMode }): LiveDirectorQuality {
  const speechTooLong = project.segments.some((segment) => wordCount(segment.narration) > (segment.appearance === 'visual_only' ? 14 : 11))
  const avatarCount = project.segments.filter((segment) => segment.appearance !== 'visual_only').length
  const repeatedAppearances = new Set(project.segments.map((segment) => `${segment.appearance}:${segment.shotCount}`)).size < Math.min(3, project.segments.length)
  const socialDistinct = new Set([project.social.x, project.social.instagram, project.social.linkedin]).size === 3
  const spokenWords = project.segments.reduce((total, segment) => total + wordCount(segment.narration), 0)
  const modes = project.segments.map((segment) => segment.continuityMode)
  const allDirect = project.segments.length > 2 && modes.slice(1).every((mode) => mode === 'direct')
  const foundingScene = project.segments[0]?.continuityMode === 'independent' && project.segments[0]?.referenceStrategy === 'none'
  const chainSound = project.segments.slice(1).every((segment) => segment.referenceStrategy === 'none' || Boolean(segment.referenceSourceClipId))
  const sameShotCount = new Set(project.segments.map((segment) => segment.shotCount)).size === 1 && project.segments.length > 2
  const notes: string[] = []
  const clipSeconds = project.clipSeconds && project.clipSeconds > 0 ? project.clipSeconds : DEFAULT_FLOW_CLIP_SECONDS
  if (speechTooLong) notes.push(`اختصر جملة أحد المقاطع لتبقى طبيعية خلال ${arabicCountPhrase(clipSeconds, SECOND_FORMS)}.`)
  if (project.useAvatar && avatarCount === project.segments.length && project.segments.length > 1) notes.push('خفّف ظهور الأفتار؛ ليس مطلوباً في كل المقاطع.')
  if (repeatedAppearances) notes.push('نوّع بناء اللقطات أو وظيفة المشهد لمنع الإيقاع المتوقع.')
  if (sameShotCount) notes.push('عدد اللقطات متكرر في كل المقاطع؛ نوّع بين لقطة ولقطتين وثلاث.')
  if (!socialDistinct) notes.push('أعد تمييز لغة المنصات؛ لا تقبل نسخ النص نفسه.')
  if (allDirect) notes.push('كل المقاطع امتداد مباشر؛ أدخل انتقالاً موضوعياً واحداً على الأقل لمنع الملل.')
  if (!foundingScene) notes.push('المقطع الأول يجب أن يكون مشهداً مؤسساً بلا صورة مرجعية.')
  // الميزانية تُقاس على المقاطع الناطقة وحدها؛ المقطع الصامت مقصود ولا يُحسب نقصاً.
  const speaking = project.segments.filter((segment) => segment.narration).length
  if (speaking && (spokenWords < speaking * 7 || spokenWords > speaking * 14)) notes.push(`النص المنطوق ${arabicCountPhrase(spokenWords, WORD_FORMS)} على ${arabicCountPhrase(speaking, PASSAGE_AFTER_PREPOSITION_FORMS)}؛ اجعل كل جملة بين 7 و14 كلمة.`)
  return {
    continuity: !foundingScene || !chainSound ? 'يحتاج مراجعة' : allDirect ? 'يحتاج تبسيطاً' : unique(modes).length >= 3 ? 'ممتاز' : 'جيد',
    idea: wordCount(project.idea) >= 5 ? 'ممتاز' : 'يحتاج مراجعة',
    // كانت قائمةً مثبتة [8,24,48,64] فتُحمّر كل مشروعٍ بمقاطع خمس عشرة ثانية.
    duration: project.durationReason && project.segments.length > 0 && project.duration === project.segments.length * clipSeconds ? 'ممتاز' : 'يحتاج مراجعة',
    clips: speechTooLong ? 'يحتاج تبسيطاً' : repeatedAppearances ? 'جيد' : 'ممتاز',
    avatar: !project.useAvatar || project.segments.length <= 2 || (avatarCount < project.segments.length && avatarCount <= Math.ceil(project.segments.length / 2)) ? 'ممتاز' : 'يحتاج تبسيطاً',
    publishing: socialDistinct ? 'ممتاز' : 'يحتاج مراجعة',
    notes: notes.length ? notes : ['الرسالة والمدة والمقاطع والهوية ومواد النشر متسقة وجاهزة للمراجعة البشرية.'],
  }
}

function seriesPlan(topic: string) {
  return [
    `الجزء الأول: ما المشكلة في ${clipWords(topic, 7, topic)}؟`,
    'الجزء الثاني: لماذا تحدث؟',
    'الجزء الثالث: ماذا نفعل؟',
    'الجزء الرابع: رأي د. أحمد.',
    'الجزء الخامس: سؤال للجمهور.',
  ]
}

export function createArticleVideoProject(input: ArticleVideoInput): LiveDirectorProject {
  const clipSeconds = input.clipSeconds && input.clipSeconds > 0 ? input.clipSeconds : DEFAULT_FLOW_CLIP_SECONDS
  const cast = castFor(input)
  const recommended = recommendArticleVideoDuration(input.article, clipSeconds)
  const recommendation = input.preferredSegments
    ? { segments: input.preferredSegments, duration: input.preferredSegments * clipSeconds, days: Math.ceil(input.preferredSegments / 3), reason: `اختيار يدوي: ${arabicCountPhrase(input.preferredSegments * clipSeconds, SECOND_FORMS)}، مع بقاء حد ثلاثة مقاطع يومياً.` }
    : recommended
  const title = input.article.title
  const idea = input.article.excerpt || clipWords(input.article.body || '', 30, title)
  const narrations = articleNarration(input.article, recommendation.segments, input.forge)
  const segments = buildSegments({ type: 'article_video', title, narrations, cast, tone: input.tone || 'فكرية', platform: input.platform || 'متعدد المنصات', articleUrl: `/articles/${input.article.slug}`, clipSeconds })
  const social = socialPack({ type: 'article_video', title, idea, articleUrl: `/articles/${input.article.slug}`, forge: input.forge })
  const base: LiveDirectorProject = {
    id: projectId('article_video', input.article.slug), type: 'article_video', articleId: input.article.slug, articleUrl: `/articles/${input.article.slug}`,
    title, idea, centralMessage: idea, audience: input.audience || 'الجمهور العام والمهتمون بالتعليم', platform: input.platform || 'متعدد المنصات', tone: input.tone || 'فكرية', useAvatar: avatarFlag(cast), castMode: cast, clipSeconds,
    series: false, seriesPlan: [], duration: recommendation.duration, durationReason: recommendation.reason, segmentCount: recommendation.segments, days: recommendation.days,
    narration: narrations.map((line) => line.text).join(' '), identityLock: avatarLock(cast), continuityNotes: [
      'استخدم أفتار د. أحمد المحفوظ داخل Flow فقط؛ لا تطلب صورة مرجعية جديدة.',
      'الملابس والصوت والهوية المعتمدة ثابتة في كل ظهور.',
      'إضاءة نهارية ناعمة ولوحة أزرق داكن وعاجي ولمسة ذهبية هادئة.',
      'لا يزيد التوليد اليومي على ثلاثة مقاطع؛ اليوم التالي يكمل المشروع ولا يعيده.',
    ], segments, social, quality: {} as LiveDirectorQuality, status: 'prompts_ready', finalVideoUrl: '', youtubeUrl: '', coverUrl: '', source: input.source || `/articles/${input.article.slug}`, sourceSessionId: input.sourceSessionId || '', linkedEditorialDecisionId: input.linkedEditorialDecisionId || '', linkedCampaignId: input.linkedCampaignId || '', createdAtClient: now(), updatedAtClient: now(),
  }
  base.quality = quality(base)
  return base
}

export function createPublicVideoProject(input: PublicVideoInput): LiveDirectorProject {
  const clipSeconds = input.clipSeconds && input.clipSeconds > 0 ? input.clipSeconds : DEFAULT_FLOW_CLIP_SECONDS
  const cast = castFor(input)
  const recommended = recommendPublicVideoDuration(input, clipSeconds)
  const title = suggestStrongTitle(input.topic)
  const idea = input.message?.trim() || input.topic.trim()
  const narrations = publicNarration(input.topic, idea, recommended.segments, input.forge)
  const segments = buildSegments({ type: 'public_topic_video', title, narrations, cast, tone: input.tone || 'فكرية', platform: input.platform || 'متعدد المنصات', articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '', clipSeconds })
  const social = socialPack({ type: 'public_topic_video', title, idea, linkedArticle: input.linkedArticle, articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '', archive: input.archive, forge: input.forge })
  const base: LiveDirectorProject = {
    id: projectId('public_topic_video', input.topic), type: 'public_topic_video', articleId: input.linkedArticle?.slug || '', articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '',
    title, idea, centralMessage: clipWords(idea, 30, title), audience: input.audience || 'الجمهور العام', platform: input.platform || 'متعدد المنصات', tone: input.tone || 'فكرية', useAvatar: avatarFlag(cast), castMode: cast, clipSeconds,
    series: recommended.series, seriesPlan: recommended.series ? seriesPlan(input.topic) : [], duration: recommended.duration, durationReason: recommended.reason, segmentCount: recommended.segments, days: recommended.days,
    narration: narrations.map((line) => line.text).join(' '), identityLock: avatarLock(cast), continuityNotes: [
      'إذا ظهر الأفتار، استخدم النسخة المحفوظة داخل Flow بلا رفع أو وصف جديد.',
      'المكان واللحظة والإضاءة ثابتة داخل كل مقطع، مع رابط بصري بين المقاطع.',
      'غيّر حجم اللقطة أو الزاوية فقط؛ لا تغيّر الشخصية أو الملابس أو الخلفية.',
      'ثلاثة مقاطع يومياً كحد تخطيطي ثابت.',
    ], segments, social, quality: {} as LiveDirectorQuality, status: 'prompts_ready', finalVideoUrl: '', youtubeUrl: '', coverUrl: '', source: input.source || '', sourceSessionId: input.sourceSessionId || '', linkedEditorialDecisionId: input.linkedEditorialDecisionId || '', linkedCampaignId: input.linkedCampaignId || '', createdAtClient: now(), updatedAtClient: now(),
  }
  base.quality = quality(base)
  return base
}

/** يرقّي المشاريع المحفوظة قبل إضافة المسارات الثلاثة، ويعيد بناء البرومبتات بالصيغة الإنجليزية الحالية. */
export function ensureLiveDirectorPromptVariants(project: LiveDirectorProject): LiveDirectorProject {
  const segments = project.segments.map((segment) => {
    const { prompt: _legacyPrompt, promptVersions, flowPrompts: _legacyVariants, ...rest } = segment
    const draft: SegmentDraft = {
      ...rest,
      // المشاريع القديمة بلا حقل طاقم؛ تُشتقّ من ظهور الأفتار فيها كما كانت.
      cast: segment.cast || (segment.appearance !== 'visual_only' ? 'avatar' : project.castMode || (project.useAvatar ? 'avatar' : 'people')),
      duration: segment.duration || project.clipSeconds || DEFAULT_FLOW_CLIP_SECONDS,
      visualBrief: segment.visualBrief || visualBriefFor(`${project.title} ${segment.message}`, segment.role, segment.order, segment.cast || (segment.appearance !== 'visual_only' ? 'avatar' : 'people')),
    }
    const variants = rebuiltFlowPrompts(draft, project)
    const prompt = variants[preferredPromptMode(draft)]
    return {
      ...draft,
      prompt,
      flowPrompts: variants,
      promptVersions: Array.isArray(promptVersions) && promptVersions.length
        ? promptVersions
        : [{ prompt, reason: 'ترقية البرومبت الإنجليزي', createdAt: now() }],
    }
  })
  return { ...project, segments, updatedAtClient: project.updatedAtClient || now() }
}

export const LIVE_DIRECTOR_REPAIR_ISSUES = [
  'تغير الأفتار', 'تغير الوجه أو المظهر', 'تغيرت الملابس', 'الحركة غير طبيعية', 'حركة اليد ضعيفة', 'الكلام غير واضح', 'مزامنة الفم سيئة', 'الزوايا كثيرة', 'الزوايا قليلة والمشهد جامد', 'الانتقال بين الزوايا غير طبيعي', 'المشهد مزدحم', 'الفكرة غير واضحة', 'الكاميرا غير مناسبة', 'الإضاءة غير مناسبة', 'الخلفية تغيرت', 'النتيجة غير واقعية', 'المقطع غير مترابط مع السابق', 'المقطع لا يجهز لما بعده', 'الإطار المرجعي غير مناسب', 'النتيجة تبدو كفيديو مختلف', 'النص طويل', 'المقطع غير احترافي',
] as const

export type LiveDirectorRepairIssue = (typeof LIVE_DIRECTOR_REPAIR_ISSUES)[number]

const REPAIR_HINTS: Record<LiveDirectorRepairIssue, string> = {
  'تغير الأفتار': 'Use strictly the character reference already selected in this generation. Never substitute a similar-looking person; keep one continuous front-facing shot to hold identity.',
  'تغير الوجه أو المظهر': 'Lock facial identity, age and skin tone across every shot; prefer one continuous front-facing shot over angle changes.',
  'تغيرت الملابس': 'Lock the approved saved-avatar wardrobe; do not reinterpret fabric, colour, ghutra or agal between shots.',
  'الحركة غير طبيعية': 'Reduce motion to one natural breath, one small head movement and still hands.',
  'حركة اليد ضعيفة': 'Keep hands out of frame or resting still; remove all hand gestures rather than attempting complex ones.',
  'الكلام غير واضح': 'Shorten the supplied spoken line in the selected language and use one calm continuous shot with a natural speaking pace.',
  'مزامنة الفم سيئة': 'Move the meaning to a voice-over over a visual scene instead of on-camera speech; keep the avatar silent and expressive.',
  'الزوايا كثيرة': 'Reduce the clip to fewer, longer shots; give the viewer time to read one image.',
  'الزوايا قليلة والمشهد جامد': 'Add one controlled angle change on a natural pause to give the clip a pulse, staying in the same location and moment.',
  'الانتقال بين الزوايا غير طبيعي': 'Keep the cut inside the same action and light direction; the second angle must read as the same continuous moment, never a new setup.',
  'المشهد مزدحم': 'Remove secondary objects and people; keep one subject, one action and generous negative space.',
  'الفكرة غير واضحة': 'Replace decoration with one visible cause-and-effect action that directly represents the clip message.',
  'الكاميرا غير مناسبة': 'Use a stable 50mm-equivalent medium shot and one slow push-in only.',
  'الإضاءة غير مناسبة': 'Use soft directional daylight on the subject with stable exposure and clean background separation.',
  'الخلفية تغيرت': 'Hold the exact same background geometry, depth and furniture placement through every shot of this clip.',
  'النتيجة غير واقعية': 'Increase photorealism, natural skin and material texture and restrained practical lighting; remove stylised effects.',
  'المقطع غير مترابط مع السابق': 'Start from the reference frame state: same object, gaze direction, light direction and sound texture that closed the previous clip.',
  'المقطع لا يجهز لما بعده': 'End on a stable visual handoff object and gaze direction that the next clip can inherit.',
  'الإطار المرجعي غير مناسب': 'Ignore the previous reference frame and rebuild continuity from the written notes: same world, same light, same palette.',
  'النتيجة تبدو كفيديو مختلف': 'Restore the established visual identity: same palette, same light direction, same lens character and same environment logic as the approved clips.',
  'النص طويل': 'Shorten the spoken line so it lands comfortably inside eight seconds with a natural pause before the final cut.',
  'المقطع غير احترافي': 'Simplify to one subject, one action and one restrained camera move, with cinematic exposure and clean composition.',
}

/** تعديلات بنيوية حقيقية على المقطع المتضرر وحده — لا مجرد إضافة سطر إلى البرومبت. */
function repairedDraft(segment: LiveDirectorSegment, issue: LiveDirectorRepairIssue): SegmentDraft {
  const draft: SegmentDraft = { ...segment }
  if (issue === 'الزوايا كثيرة' && draft.shotCount > 1) draft.shotCount = (draft.shotCount - 1) as 1 | 2
  if (issue === 'الزوايا قليلة والمشهد جامد' && draft.shotCount < 3) draft.shotCount = (draft.shotCount + 1) as 2 | 3
  if (issue === 'الانتقال بين الزوايا غير طبيعي' && draft.shotCount > 1) draft.shotCount = 1
  if (['الزوايا كثيرة', 'الزوايا قليلة والمشهد جامد', 'الانتقال بين الزوايا غير طبيعي'].includes(issue)) draft.shotPlan = shotPlan(draft.shotCount, draft.appearance, draft.duration)
  // مزامنة الفم الضعيفة تُعالج بتحويل الحديث إلى تعليق صوتي، لا بإعادة المشروع.
  if (issue === 'مزامنة الفم سيئة' && draft.voiceMode === 'avatar_speech') draft.voiceMode = 'voice_over'
  if (issue === 'النص طويل') draft.narration = clipWords(draft.narration, draft.voiceMode === 'voice_over' ? 10 : 8, draft.narration)
  // عدم الترابط: الامتداد المباشر مطلب صارم يصعب على المولّد؛ ننزل إلى امتداد لطيف بدل إعادة البناء.
  if (issue === 'المقطع غير مترابط مع السابق' && draft.continuityMode === 'direct') {
    draft.continuityMode = 'soft'
    draft.referenceStrategy = draft.selectedReferenceFrame ? 'selected_frame' : DEFAULT_REFERENCE.soft
  }
  if (issue === 'النتيجة تبدو كفيديو مختلف' && draft.continuityMode === 'thematic') {
    draft.continuityMode = 'soft'
    draft.referenceStrategy = draft.selectedReferenceFrame ? 'selected_frame' : 'style_only'
  }
  if (issue === 'الإطار المرجعي غير مناسب') {
    draft.selectedReferenceFrame = ''
    draft.referenceStrategy = draft.continuityMode === 'independent' ? 'none' : 'style_only'
  }
  draft.startState = startStateFor(draft.continuityMode)
  draft.negativeConstraints = unique([...constraintsFor(draft.appearance, draft.shotCount, draft.cast || 'people'), ...(issue.includes('الأفتار') || issue.includes('الوجه') ? ['avatar replacement', 'pose reset'] : []), ...(issue === 'الخلفية تغيرت' ? ['inconsistent background'] : []), ...(issue === 'الانتقال بين الزوايا غير طبيعي' ? ['abrupt motion discontinuity'] : [])])
  return draft
}

/** يصلح مقطعاً واحداً ويُبقي مراجع بقية المقاطع بلا تغيير. */
export function repairLiveDirectorSegment(project: LiveDirectorProject, segmentId: string, issue: LiveDirectorRepairIssue) {
  const index = project.segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0) return project
  const previous = project.segments[index]
  const hint = REPAIR_HINTS[issue]
  const draft = repairedDraft(previous, issue)
  const correction = `Targeted correction for this clip only: ${hint}
Preserve every approved continuity choice from the other clips. Do not regenerate or reinterpret the project.`
  const basePrompts = rebuiltFlowPrompts(draft, project)
  const flowPrompts: FlowPromptVariants = {
    speech_ar: `${basePrompts.speech_ar}

${correction}`,
    speech_en: `${basePrompts.speech_en}

${correction}`,
    silent: `${basePrompts.silent}

${correction}`,
  }
  const prompt = flowPrompts[preferredPromptMode(draft)]
  const nextSegment: LiveDirectorSegment = {
    ...draft,
    prompt,
    flowPrompts,
    status: 'needs_revision',
    revisionReason: issue,
    promptVersions: [...(previous.promptVersions || []), { prompt, reason: issue, createdAt: now() }],
  }
  const segments = project.segments.map((segment, segmentIndex) => segmentIndex === index ? nextSegment : segment)
  const next = { ...project, segments, status: 'needs_revision' as const, updatedAtClient: now() }
  return { ...next, quality: quality(next) }
}

/** يغيّر نمط الترابط أو استراتيجية المرجع لمقطع واحد ويعيد بناء برومبته وحده. */
export function setSegmentContinuity(project: LiveDirectorProject, segmentId: string, change: { mode?: ContinuityMode; strategy?: ReferenceStrategy }) {
  const index = project.segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0) return project
  const previous = project.segments[index]
  const mode = change.mode || previous.continuityMode
  const strategy = change.strategy || (change.mode ? DEFAULT_REFERENCE[change.mode] : previous.referenceStrategy)
  const draft: SegmentDraft = { ...previous, continuityMode: mode, referenceStrategy: strategy, startState: startStateFor(mode) }
  const flowPrompts = rebuiltFlowPrompts(draft, project)
  const prompt = flowPrompts[preferredPromptMode(draft)]
  const segments = project.segments.map((segment, segmentIndex) => segmentIndex === index
    ? { ...draft, prompt, flowPrompts, promptVersions: [...(previous.promptVersions || []), { prompt, reason: `تغيير الترابط إلى ${CONTINUITY_LABELS[mode]} · ${REFERENCE_LABELS[strategy]}`, createdAt: now() }] }
    : segment)
  const next = { ...project, segments, updatedAtClient: now() }
  return { ...next, quality: quality(next) }
}

/** يقيس صلاحية الإطار المرجعي قبل اعتماده؛ الضبابي لا يُستخدم تلقائياً. */
export function assessReferenceFrame(input: { sharpness?: number; capturedAt?: number }) {
  const sharpness = typeof input.sharpness === 'number' ? input.sharpness : 1
  if (sharpness < 0.35) return { usable: false, verdict: 'ضعيف' as const, note: 'الإطار ضبابي أو أثناء حركة؛ اختر إطاراً آخر بدل اعتماده تلقائياً.' }
  if (sharpness < 0.6) return { usable: true, verdict: 'مقبول' as const, note: 'الإطار مقبول، لكن إطاراً أهدأ سيعطي بداية أنظف للمقطع التالي.' }
  return { usable: true, verdict: 'جيد' as const, note: 'الإطار مستقر وصالح كبداية بصرية للمقطع التالي.' }
}

/**
 * يثبّت إطاراً مرجعياً من مقطع ويمرّره إلى المقطع التالي وحده.
 * الانتقال الموضوعي يستخدمه مرجع هوية ولون فقط حتى لا يمنع الانتقال المطلوب.
 */
export function applyReferenceFrame(project: LiveDirectorProject, sourceSegmentId: string, input: { frameUrl: string; kind: 'last_frame' | 'selected_frame'; sharpness?: number }) {
  const index = project.segments.findIndex((segment) => segment.id === sourceSegmentId)
  if (index < 0) return { project, applied: false, note: 'لا يوجد مقطع بهذا المعرف.' }
  const assessment = assessReferenceFrame({ sharpness: input.sharpness })
  if (!assessment.usable) return { project, applied: false, note: assessment.note }
  const target = project.segments[index + 1]
  const withFrame = project.segments.map((segment, segmentIndex) => segmentIndex === index ? { ...segment, lastFrameImage: input.frameUrl } : segment)
  if (!target) {
    return { project: { ...project, segments: withFrame, updatedAtClient: now() }, applied: true, note: 'حُفظ الإطار؛ لا يوجد مقطع تالٍ يرثه.' }
  }
  const strategy: ReferenceStrategy = target.continuityMode === 'thematic' ? 'style_only' : input.kind
  const draft: SegmentDraft = { ...target, selectedReferenceFrame: input.frameUrl, referenceSourceClipId: sourceSegmentId, referenceStrategy: strategy }
  const flowPrompts = rebuiltFlowPrompts(draft, project)
  const prompt = flowPrompts[preferredPromptMode(draft)]
  const segments = withFrame.map((segment, segmentIndex) => segmentIndex === index + 1
    ? { ...draft, prompt, flowPrompts, promptVersions: [...(target.promptVersions || []), { prompt, reason: `اعتماد ${REFERENCE_LABELS[strategy]} من ${sourceSegmentId}`, createdAt: now() }] }
    : segment)
  const next = { ...project, segments, updatedAtClient: now() }
  return { project: { ...next, quality: quality(next) }, applied: true, note: `${assessment.note} ورُبط المقطع ${target.order} بالإطار.` }
}

/** النسخة القريبة من دقيقة: مادة Flow تبقى بمدتها المولّدة، والفارق تحرير خارجي. */
export function nearMinuteEditPlan(project: Pick<LiveDirectorProject, 'duration' | 'title' | 'articleUrl'>) {
  const generated = project.duration
  return {
    generated,
    intro: { from: 3, to: 5, note: 'مقدمة خارجية بسيطة: عنوان ثابت أو لقطة غلاف، تُحرَّر خارج Flow.' },
    outro: { from: 4, to: 7, note: project.articleUrl ? 'بطاقة رابط المقال ودعوة القراءة.' : 'بطاقة ختامية بالاسم والدعوة.' },
    finalFrom: generated + 3 + 4,
    finalTo: generated + 5 + 7,
    statement: `المادة المولدة من Flow ${arabicCountPhrase(generated, SECOND_FORMS)}؛ والمدة النهائية بعد التحرير تقارب ${generated + 7}–${generated + 12} ثانية. لا تُنسب المقدمة والخاتمة إلى التوليد.`,
  }
}

/** ملاحظات من أرقام حقيقية فقط؛ تحت العينة الكافية تُعلن قلة البيانات ولا تُخترع نتيجة. */
export function liveDirectorPerformanceInsights(projects: Pick<LiveDirectorProject, 'duration' | 'segments' | 'useAvatar' | 'metrics'>[]) {
  const measured = projects.filter((project) => project.metrics && project.metrics.views > 0)
  if (measured.length < 5) return { enough: false, sample: measured.length, notes: ['لا توجد بيانات كافية بعد.'] }
  const average = (items: typeof measured) => items.reduce((total, item) => total + (item.metrics?.completion || 0), 0) / (items.length || 1)
  const bookended = measured.filter((project) => project.segments[0]?.appearance !== 'visual_only' && project.segments[project.segments.length - 1]?.appearance !== 'visual_only')
  const others = measured.filter((project) => !bookended.includes(project))
  const notes: string[] = [`العينة الحالية ${arabicCountPhrase(measured.length, PUBLISHED_PROJECT_FORMS)} بأرقام مُدخلة يدوياً.`]
  if (bookended.length >= 2 && others.length >= 2) {
    const gap = average(bookended) - average(others)
    if (Math.abs(gap) >= 3) notes.push(gap > 0 ? 'الفيديوهات التي يظهر فيها الأفتار في البداية والخاتمة تحقق إكمالاً أفضل.' : 'الفيديوهات التي تبدأ وتنتهي بمشهد بصري تحقق إكمالاً أفضل من ظهور الأفتار في الطرفين.')
    else notes.push('لا فرق معتد به بين ظهور الأفتار في الطرفين وغيره حتى الآن.')
  }
  return { enough: true, sample: measured.length, notes }
}

export function setLiveDirectorSegmentStatus(project: LiveDirectorProject, segmentId: string, status: LiveDirectorClipStatus, videoUrl = '') {
  const segments = project.segments.map((segment) => segment.id === segmentId ? { ...segment, status, videoUrl: videoUrl || segment.videoUrl } : segment)
  const allApproved = segments.every((segment) => ['approved', 'uploaded'].includes(segment.status))
  return { ...project, segments, status: allApproved ? 'clips_approved' as const : project.status, updatedAtClient: now() }
}

export function isValidYouTubeUrl(value: string) {
  try {
    const url = new URL(value)
    return ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(url.hostname) && Boolean(url.pathname.replace(/\//g, '') || url.searchParams.get('v'))
  } catch { return false }
}

export function liveDirectorDailyPlan(project: LiveDirectorProject) {
  return Array.from({ length: project.days }, (_, dayIndex) => ({
    day: dayIndex + 1,
    clips: project.segments.filter((segment) => segment.day === dayIndex + 1),
  }))
}
