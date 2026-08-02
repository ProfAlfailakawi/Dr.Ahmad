import type { ArticleRecord } from './cms'
import { genuineAdditionMeter } from './editorial-foresight.ts'
import { strongestQuote, suggestStrongTitle } from './intelligence.ts'
import { polishTypography } from './style-dna.mjs'

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
  duration: 8
  role: string
  purpose: string
  /** المعنى الوحيد الذي يجب أن يصل من هذا المقطع. */
  message: string
  appearance: FlowAppearance
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
  series: boolean
  seriesPlan: string[]
  duration: 8 | 24 | 48 | 64
  durationReason: string
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
  preferredDuration?: 24 | 48 | 64
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

export function recommendArticleVideoDuration(article: Pick<ArticleRecord, 'title' | 'excerpt' | 'body'>) {
  const text = article.body || article.excerpt || ''
  const count = wordCount(text)
  const complex = /دراسة|نتيجة|مقارنة|قصة|حكاية|تجربة|من جهة|في المقابل|أولاً|ثانياً/i.test(text)
  if (count <= 260 && !complex) return { duration: 24 as const, segments: 3, days: 1, reason: 'المقالة قصيرة وتدور حول سؤال واحد؛ الإعلان المركز يخدمها أكثر من شرح مطوّل.' }
  if (count >= 600 && complex) return { duration: 64 as const, segments: 8, days: 3, reason: 'المادة تحمل قصة أو مقارنة ودليلاً يحتاجان مقطعين إضافيين؛ 64 ثانية استثناء مبرر لا استهلاك للرصيد.' }
  return { duration: 48 as const, segments: 6, days: 2, reason: count >= 350 && count <= 450 ? 'هذه المدة هي الأنسب لمقالة بين 350 و450 كلمة: تشرح الجوهر ولا تحاول قراءة المقال كاملاً.' : 'الفكرة تحتاج خطافاً ومشكلة ونقطتين ورأي د. أحمد وخاتمة؛ ستة مقاطع تكفي بلا حشو.' }
}

export function recommendPublicVideoDuration(input: Pick<PublicVideoInput, 'topic' | 'message' | 'wantsSeries'>) {
  const text = `${input.topic} ${input.message || ''}`.trim()
  const count = wordCount(text)
  const manyAxes = input.wantsSeries || count > 180 || /سلسلة|محاور|أجزاء|أسباب.*نتائج.*حلول|كل ما يتعلق/i.test(text)
  const complex = count > 55 || /دراسة|إحصائي|مقارنة|مشكلة.*حل|لماذا.*كيف|موقف.*توضيح|أكثر من جانب/i.test(text)
  if (manyAxes) return { duration: 24 as const, segments: 3, days: 1, series: true, reason: 'الموضوع أكبر من فيديو واحد؛ سيُقسّم إلى سلسلة مستقلة بدل حشره في 48 ثانية.' }
  if (count <= 14 && /[؟?]$|اقتباس|ومضة|جملة/i.test(text)) return { duration: 8 as const, segments: 1, days: 1, series: false, reason: 'الفكرة جملة واحدة أو سؤال؛ لقطة واحدة تحافظ على قوتها.' }
  if (complex) return { duration: 48 as const, segments: 6, days: 2, series: false, reason: 'الموضوع يحتاج تفسيراً ومثالاً ورأياً واضحاً؛ ستة مقاطع تمنع الاختزال المخل.' }
  return { duration: 24 as const, segments: 3, days: 1, series: false, reason: 'موضوع عام واحد؛ 24 ثانية تكفي للخطاف والتفسير والخاتمة في رصيد يوم واحد.' }
}

const ARTICLE_ROLES: Record<number, string[]> = {
  3: ['الخطاف', 'جوهر الفكرة', 'الدعوة إلى قراءة المقال'],
  6: ['الخطاف', 'المشكلة', 'الفكرة الأولى', 'الفكرة الثانية أو المثال', 'رأي د. أحمد', 'الخاتمة والدعوة'],
  8: ['الخطاف', 'المشهد أو المشكلة', 'السؤال المركزي', 'الفكرة الأولى', 'المقارنة أو الدليل', 'الفكرة الثانية', 'رأي د. أحمد', 'الخاتمة والدعوة'],
}

const PUBLIC_ROLES: Record<number, string[]> = {
  1: ['الومضة'],
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

  if (count === 3) return [hook, sourced(clipWords(central, 10, central), 'derived'), closing]
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

function appearanceFor(index: number, count: number, useAvatar: boolean): FlowAppearance {
  if (!useAvatar) return 'visual_only'
  if (count === 1) return 'avatar_direct'
  if (count === 3) return index === 0 ? 'avatar_direct' : index === 2 ? 'avatar_with_object' : 'visual_only'
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

const REFERENCE_HEADER ='Continue from the provided reference frame. Use it as the visual starting point of the new 8-second clip. Preserve the selected Dr. Ahmad avatar, wardrobe, lighting, environment, color palette, background details, time of day and cinematic tone. Continue the motion naturally instead of restarting or redesigning the scene from scratch.'

function referenceInstruction(mode: ContinuityMode, strategy: ReferenceStrategy, hasFrame: boolean) {
  if (strategy === 'none' || mode === 'independent') return 'Reference handling: no uploaded frame is required. Build the opening state from the written sequence instructions.'
  if (!hasFrame) return `Reference handling: no uploaded frame is required. Continue from the immediately previous generated clip using sequence continuity and the written handoff below. ${CONTINUITY_CLAUSES[mode].join(' ')}`
  if (strategy === 'style_only') return `Reference handling: use the optional attached frame for identity, wardrobe, palette and lighting only, not for composition. ${CONTINUITY_CLAUSES[mode].join(' ')}`
  return `${REFERENCE_HEADER} ${CONTINUITY_CLAUSES[mode].join(' ')}`
}

function startStateFor(mode: ContinuityMode) {
  if (mode === 'independent') return 'Open on a settled composed frame that establishes environment, light direction and palette for the whole project.'
  if (mode === 'direct') return 'Open exactly on the visual state of the reference frame: same pose, same gaze direction, same light.'
  if (mode === 'soft') return 'Open inside the same environment as the previous clip, seen from the newly requested angle.'
  return 'Open on the shared visual link — colour, object, motion or sound — carried over from the previous clip.'
}

function endStateFor(role: string) {
  if (role.includes('الخطاف')) return 'End on a held, unresolved beat with the subject still in frame, ready to be inherited by the next clip.'
  if (role.includes('الخاتمة') || role.includes('الدعوة')) return 'End on a stable quiet frame with clean negative space reserved for the title and link added later in editing.'
  return 'End on a stable handoff: one clear object or gaze direction that the next clip can start from.'
}

function overlayFor(input: { role: string; order: number; count: number; voiceMode: VoiceMode; title: string; message: string; articleUrl: string }): OverlayCue[] {
  const cues: OverlayCue[] = []
  if (input.voiceMode === 'ambient') cues.push({ kind: 'عنوان', text: clipWords(input.message, 8, input.title), from: 1, to: 5.5, position: 'وسط الإطار', space: 'اترك ثلث الإطار الأوسط نظيفاً بلا عناصر.' })
  if (input.role.includes('رأي')) cues.push({ kind: 'اقتباس', text: clipWords(input.message, 10, input.title), from: 2, to: 6.5, position: 'أسفل الإطار', space: 'اترك الثلث السفلي هادئاً بلا تفاصيل متحركة.' })
  if (input.order === input.count) {
    cues.push({ kind: 'عنوان', text: clipWords(input.title, 7, input.title), from: 0.5, to: 3.5, position: 'أعلى الإطار', space: 'اترك الثلث العلوي فارغاً.' })
    cues.push({ kind: input.articleUrl ? 'رابط' : 'دعوة', text: input.articleUrl || 'اكتب رأيك في التعليقات', from: 4.5, to: 8, position: 'أسفل الإطار', space: 'اترك الثلث السفلي فارغاً ومستقراً.' })
  }
  return cues
}

function shotsFor(index: number, role: string, appearance: FlowAppearance): 1 | 2 | 3 {
  if (appearance === 'visual_only') return role.includes('الخطاف') || role.includes('الخاتمة') ? 3 : 2
  if (role.includes('الخطاف') || role.includes('الخاتمة')) return 3
  if (role.includes('رأي')) return 1
  return index % 3 === 0 ? 1 : 2
}

function shotPlan(count: 1 | 2 | 3, appearance: FlowAppearance) {
  const avatar = appearance !== 'visual_only'
  if (count === 1) return [{ from: 0, to: 8, framing: avatar ? 'calm medium close-up, front-facing' : 'single controlled cinematic composition' }]
  if (count === 2) return [
    { from: 0, to: 4.2, framing: avatar ? 'front medium shot' : 'close detail of the symbolic object' },
    { from: 4.2, to: 8, framing: avatar ? 'gentle cut to a three-quarter close-up' : 'wider reveal in the same environment' },
  ]
  return [
    { from: 0, to: 2.5, framing: avatar ? 'brief medium opening shot' : 'close visual hook' },
    { from: 2.5, to: 5.5, framing: avatar ? 'close three-quarter angle, continuous speech' : 'second angle on the same subject' },
    { from: 5.5, to: 8, framing: avatar ? 'return to a slightly wider front shot' : 'clean wider closing shot' },
  ]
}

function constraintsFor(appearance: FlowAppearance, count: number) {
  const common = ['generated text', 'visible text in any language', 'Arabic text inside the scene', 'English text inside the scene', 'letters', 'numbers', 'captions', 'subtitles generated inside Flow', 'labels', 'signage', 'interface text', 'logos', 'watermarks', 'multiple locations', 'fast cuts', 'shaky camera', 'visual clutter', 'sudden lighting changes']
  if (appearance === 'visual_only') return [...common, 'extra characters', count <= 2 ? 'multiple camera movements' : 'more than three cuts']
  return [...common, 'face changes', 'identity drift', 'voice changes', 'wardrobe changes', 'age changes', 'lookalike replacement', 'distorted hands', 'extra fingers', 'unnatural mouth movement', 'poor lip synchronization', 'exaggerated gestures', count <= 2 ? 'multiple camera movements' : 'more than three cuts']
}

const AVATAR_LOCK = 'Use Dr. Ahmad’s pre-saved avatar already available in Google Flow. Never create, describe, or substitute a new or similar person. Preserve the approved avatar identity, voice, appearance, wardrobe, realism, and performance continuity across every shot and every clip.'

const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]+/g

const VISUAL_CONCEPTS: Array<{ pattern: RegExp; scenes: string[] }> = [
  { pattern: /ذكاء اصطناعي|خوارزم|تقني|رقمي|هاتف|شاشة|منصات|إنترنت|بيانات/, scenes: [
    'A thoughtful educator studies a restrained digital interface while keeping a real notebook and human conversation visibly central.',
    'A calm human-scale technology scene contrasts automated suggestions with a deliberate human decision.',
    'A clean desk scene shows one digital tool being paused, questioned, and used with visible judgment rather than passive dependence.',
  ] },
  { pattern: /طفل|ابن|ابنة|أبناء|أسرة|بيت|والد|أم|أب/, scenes: [
    'A warm domestic learning moment shows careful listening, emotional safety, and one clear boundary without confrontation.',
    'A quiet family scene centers on eye contact, patience, and a small shared action rather than a lecture.',
    'A human close-up captures hesitation turning into trust through calm presence and respectful distance.',
  ] },
  { pattern: /مدرسة|صف|طالب|معلم|تعليم|درس|تعلّم|منهج/, scenes: [
    'A premium classroom moment shows one learner moving from passive compliance to active understanding through a visible question.',
    'A quiet educational environment contrasts completing a task with genuinely making sense of it.',
    'A single classroom object becomes a visual cause-and-effect metaphor for attention, understanding, and agency.',
  ] },
  { pattern: /بحث|دراسة|دراسات|سؤال|أكاديم|مصدر|دليل/, scenes: [
    'A refined research desk shows many scattered possibilities narrowing into one precise question and one credible source.',
    'A researcher compares evidence calmly, removing noise until one defensible line of inquiry remains.',
    'A close visual sequence moves from a crowded field of notes to one clear, testable question.',
  ] },
  { pattern: /درجة|اختبار|تقييم|تفوق|نجاح|رسوب/, scenes: [
    'A single score on paper is visually placed beside richer evidence of understanding, judgment, and growth.',
    'A calm assessment scene shifts attention from the final number to the thinking process that produced it.',
    'A restrained educational metaphor shows a grade shrinking to its proper size while human capability remains larger in frame.',
  ] },
  { pattern: /غضب|صراخ|خلاف|حدود|سلوك|عقاب|حزم/, scenes: [
    'A tense moment slows down before reaction, showing one breath, one pause, and one clear boundary delivered without aggression.',
    'A quiet visual beat contrasts impulsive escalation with a composed, respectful response.',
    'A close human moment shows repair after tension through accountability, calm tone, and restored connection.',
  ] },
  { pattern: /مقارنة|شهرة|متابع|محتوى|إعلان|منصات/, scenes: [
    'A person steps back from a stream of polished public images and returns attention to one authentic, ordinary moment.',
    'A restrained creator-economy scene contrasts rising metrics with the need to protect identity, privacy, and inner measure.',
    'A calm cinematic composition shows public numbers fading while real human value stays physically present and stable.',
  ] },
  { pattern: /قراءة|كتاب|كتب|مقال|معرفة/, scenes: [
    'A quiet reading ritual begins with one inviting page, one marked idea, and no visual pressure to finish quickly.',
    'A book moves from decorative background to active conversation through a small, deliberate reading habit.',
    'A close tactile scene shows depth winning over distraction through one page, one pause, and one reflected thought.',
  ] },
  { pattern: /قياد|فريق|مبادرة|إدارة|قرار|مؤسسة/, scenes: [
    'A leadership scene shows a written directive becoming a shared action through listening, ownership, and visible participation.',
    'A small team aligns around one clear purpose rather than another decorative initiative.',
    'A composed meeting moment turns silent resistance into an honest, constructive contribution.',
  ] },
  { pattern: /إرهاق|تعب|نوم|راحة|ضغط|قلق|تركيز|انتباه/, scenes: [
    'A demanding routine visibly slows into a healthier rhythm through rest, reduced clutter, and one protected focus period.',
    'A close human moment distinguishes exhaustion from avoidance without judgment or melodrama.',
    'A calm environment shows attention returning after noise, notifications, and competing demands are deliberately removed.',
  ] },
  { pattern: /مستقبل|مهارة|وظائف|تغيير|تطور/, scenes: [
    'A future-facing educational scene keeps human judgment, adaptability, and meaning in the foreground while tools change around them.',
    'A clean visual transition shows temporary technologies moving past while durable human capabilities remain stable.',
    'A learner faces an uncertain path with a small set of enduring skills rather than a crowded wall of predictions.',
  ] },
]

function visualBriefFor(source: string, role: string, order: number) {
  const concept = VISUAL_CONCEPTS.find((item) => item.pattern.test(source))
  const scenes = concept?.scenes || [
    'A refined human-scale educational moment turns an abstract idea into one visible cause-and-effect action.',
    'A calm cinematic scene gives one idea physical clarity through a single subject, one action, and generous negative space.',
    'A thoughtful human moment moves from uncertainty to clearer judgment without spectacle or visual clutter.',
  ]
  const scene = scenes[Math.abs(order - 1) % scenes.length]
  return `${scene} The visual beat must serve this function: ${roleInEnglish(role)}.`
}

function englishOnly(value: string) {
  return value
    .replace(ARABIC_SCRIPT, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function continuationOpening(segment: Pick<LiveDirectorSegment, 'order' | 'continuityMode'>) {
  if (segment.order <= 1) {
    return 'OPENING CLIP — This is the first clip in the sequence. Establish the exact visual world, identity, wardrobe, location, lighting direction, camera logic, motion rhythm, sound texture, and emotional tone that every following clip must inherit.'
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
}) {
  const { segment, mode } = input
  const avatar = segment.appearance !== 'visual_only'
  const spokenLanguage = mode === 'speech_ar' ? 'Arabic' : mode === 'speech_en' ? 'English' : ''
  const shotText = segment.shotPlan.map((shot, index) => `Shot ${index + 1} (${shot.from.toFixed(1)}-${shot.to.toFixed(1)}s): ${shot.framing}.`).join(' ')
  const visualBrief = segment.visualBrief || visualBriefFor(`${input.title} ${segment.message}`, segment.role, segment.order)
  const subject = avatar
    ? `${AVATAR_LOCK} Keep body movement simple and natural; avoid complex hand choreography.`
    : 'No avatar is required in this clip. Use one clear symbolic object or one human-scale educational moment as the main subject.'
  const sound = mode === 'silent'
    ? 'Environmental sound only. No dialogue, no voice-over, no narration, no spoken words, and no vocal reactions.'
    : avatar
      ? `Natural room ambience under the approved avatar performance. Spoken language: ${spokenLanguage}. Use only the exact creator-supplied ${spokenLanguage} line entered separately in Flow. Do not translate, paraphrase, add, omit, or invent any words. Preserve precise lip synchronization through every angle change.`
      : `Subtle natural environmental sound. Spoken language for the separately supplied voice-over: ${spokenLanguage}. Use only the exact creator-supplied line; do not translate, paraphrase, add, omit, or invent any words.`
  const speech = mode === 'silent'
    ? 'Performance mode: completely silent visual performance. The avatar, if present, must keep the mouth naturally closed and must not move the lips as if speaking.'
    : avatar
      ? `Performance mode: speaking avatar in ${spokenLanguage}. Deliver one short creator-supplied line with calm, natural pacing and authentic pronunciation. The exact wording is supplied separately in Flow. Never generate subtitles, captions, or visible text.`
      : `Performance mode: ${spokenLanguage} voice-over-ready visual. Keep the scene visually complete while the creator adds one exact short ${spokenLanguage} line separately. Never generate subtitles, captions, or visible text.`
  const overlay = segment.overlayPlan.length
    ? `Editorial overlay: all text is added later in editing, never generated inside Flow. Reserve clean space at ${unique(segment.overlayPlan.map((cue) => `${OVERLAY_POSITION_EN[cue.position]} (${cue.from.toFixed(1)}-${cue.to.toFixed(1)}s)`)).join(', ')}.`
    : 'Editorial overlay: none required for this clip.'
  const body = [
    'Duration: exactly 8 seconds.',
    `Aspect ratio: 9:16 vertical for ${PLATFORM_EN[input.platform] || 'multi-platform vertical distribution'}.`,
    `Prompt option: ${flowModeLabel(mode)}.`,
    'VISIBLE-TEXT RULE — Generate absolutely no on-screen text of any kind in any language: no titles, captions, subtitles, labels, letters, numbers, signs, interface text, logos, or watermarks.',
    `Avatar usage: ${avatar ? 'yes — use only the pre-saved Dr. Ahmad avatar already stored in Google Flow' : 'no avatar in this clip'}.`,
    `Clip function: ${roleInEnglish(segment.role)}.`,
    subject,
    `Scene concept: ${visualBrief}`,
    'Location: one calm, premium educational environment; keep the same location, background, time of day and visual moment throughout this clip.',
    `Primary action: ${segment.purpose}. One main action only.`,
    `Shot construction: ${segment.shotCount} ${segment.shotCount === 1 ? 'continuous shot' : 'connected shots'} in the same context. ${shotText}`,
    'Camera movement: one restrained motion per shot, either a slow push-in or a locked camera; no competing movements.',
    'Lighting: soft cinematic daylight with consistent direction and exposure across all cuts.',
    `Visual mood: ${TONE_EN[input.tone] || 'reflective and intellectual'}, realistic, quiet, refined. Color palette: ${input.palette}.`,
    `Sound design: ${sound}`,
    speech,
    `Clip start state: ${segment.startState}`,
    `Clip end state: ${segment.endState}`,
    `Continuity with the previous clip: ${segment.continuityMode}.`,
    referenceInstruction(segment.continuityMode, segment.referenceStrategy, Boolean(segment.selectedReferenceFrame)),
    overlay,
    avatar ? `Identity lock: ${AVATAR_LOCK}` : '',
    `Continuity notes: ${segment.continuity}`,
    `Negative constraints: ${unique([...segment.negativeConstraints, 'visible writing in any language', 'Arabic writing', 'English writing', 'subtitles', 'captions', 'generated dialogue wording']).join(', ')}.`,
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
function rebuiltFlowPrompts(segment: SegmentDraft, project: Pick<LiveDirectorProject, 'title' | 'tone' | 'platform'>) {
  return buildFlowPrompts({ segment, title: project.title, tone: project.tone, platform: project.platform, palette: PALETTE })
}

function rebuiltPrompt(segment: SegmentDraft, project: Pick<LiveDirectorProject, 'title' | 'tone' | 'platform'>) {
  const variants = rebuiltFlowPrompts(segment, project)
  return variants[preferredPromptMode(segment)]
}

const PALETTE = 'deep slate blue, warm ivory, restrained muted gold accents'

function buildSegments(input: {
  type: LiveDirectorProjectType
  title: string
  narrations: SourcedLine[]
  useAvatar: boolean
  tone: LiveDirectorTone
  platform: LiveDirectorPlatform
  articleUrl?: string
}) {
  const count = input.narrations.length
  const roles = (input.type === 'article_video' ? ARTICLE_ROLES : PUBLIC_ROLES)[count] || PUBLIC_ROLES[3]
  const appearances = input.narrations.map((_, index) => appearanceFor(index, count, input.useAvatar))
  return input.narrations.map((line, index) => {
    const narration = line.text
    const role = roles[index] || `المقطع ${index + 1}`
    const appearance = appearances[index]
    const voiceMode = voiceModeFor(appearance, role, count)
    const shotCount = shotsFor(index, role, appearance)
    const negativeConstraints = constraintsFor(appearance, shotCount)
    const continuityMode = continuityModeFor(index, appearances, role)
    const message = clipToClause(narration, 12, role)
    const base: SegmentDraft = {
      id: `clip-${index + 1}`,
      order: index + 1,
      day: Math.floor(index / 3) + 1,
      duration: 8,
      role,
      purpose: role.includes('الخطاف') ? 'create an immediate visual question without a greeting' : role.includes('الخاتمة') ? 'resolve the visual idea and leave a memorable final beat' : `communicate the ${roleInEnglish(role)} with one visible cause-and-effect action`,
      message,
      visualBrief: visualBriefFor(`${input.title} ${message}`, role, index + 1),
      appearance,
      voiceMode,
      // المقطع الصامت يحمل معناه في الصورة وفي خطة النصوص المضافة، لا في جملة منطوقة.
      narration: voiceMode === 'ambient' ? '' : clipToClause(narration, voiceMode === 'voice_over' ? 14 : 11, narration),
      narrationSource: voiceMode === 'ambient' ? 'derived' : line.source,
      resonanceCount: line.resonanceCount,
      shotCount,
      shotPlan: shotPlan(shotCount, appearance),
      negativeConstraints,
      continuity: `Same ${PALETTE} palette, soft daylight, 50mm-equivalent realism, consistent background logic, and a visual handoff from clip ${Math.max(1, index)} to clip ${index + 2}.`,
      continuityMode,
      referenceStrategy: DEFAULT_REFERENCE[continuityMode],
      referenceSourceClipId: index === 0 ? '' : `clip-${index}`,
      selectedReferenceFrame: '',
      lastFrameImage: '',
      startState: startStateFor(continuityMode),
      endState: endStateFor(role),
      overlayPlan: overlayFor({ role, order: index + 1, count, voiceMode, title: input.title, message, articleUrl: input.articleUrl || '' }),
      status: 'not_generated',
      videoUrl: '',
      revisionReason: '',
    }
    const flowPrompts = rebuiltFlowPrompts(base, { title: input.title, tone: input.tone, platform: input.platform })
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

function quality(project: Pick<LiveDirectorProject, 'idea' | 'duration' | 'durationReason' | 'segments' | 'useAvatar' | 'social'>): LiveDirectorQuality {
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
  if (speechTooLong) notes.push('اختصر جملة أحد المقاطع لتبقى طبيعية خلال ثماني ثوانٍ.')
  if (project.useAvatar && avatarCount === project.segments.length && project.segments.length > 1) notes.push('خفّف ظهور الأفتار؛ ليس مطلوباً في كل المقاطع.')
  if (repeatedAppearances) notes.push('نوّع بناء اللقطات أو وظيفة المشهد لمنع الإيقاع المتوقع.')
  if (sameShotCount) notes.push('عدد اللقطات متكرر في كل المقاطع؛ نوّع بين لقطة ولقطتين وثلاث.')
  if (!socialDistinct) notes.push('أعد تمييز لغة المنصات؛ لا تقبل نسخ النص نفسه.')
  if (allDirect) notes.push('كل المقاطع امتداد مباشر؛ أدخل انتقالاً موضوعياً واحداً على الأقل لمنع الملل.')
  if (!foundingScene) notes.push('المقطع الأول يجب أن يكون مشهداً مؤسساً بلا صورة مرجعية.')
  // الميزانية تُقاس على المقاطع الناطقة وحدها؛ المقطع الصامت مقصود ولا يُحسب نقصاً.
  const speaking = project.segments.filter((segment) => segment.narration).length
  if (speaking && (spokenWords < speaking * 7 || spokenWords > speaking * 14)) notes.push(`النص المنطوق ${spokenWords} كلمة على ${speaking} مقاطع ناطقة؛ اجعل كل جملة بين 7 و14 كلمة.`)
  return {
    continuity: !foundingScene || !chainSound ? 'يحتاج مراجعة' : allDirect ? 'يحتاج تبسيطاً' : unique(modes).length >= 3 ? 'ممتاز' : 'جيد',
    idea: wordCount(project.idea) >= 5 ? 'ممتاز' : 'يحتاج مراجعة',
    duration: project.durationReason && [8, 24, 48, 64].includes(project.duration) ? 'ممتاز' : 'يحتاج مراجعة',
    clips: speechTooLong ? 'يحتاج تبسيطاً' : repeatedAppearances ? 'جيد' : 'ممتاز',
    avatar: !project.useAvatar || (avatarCount < project.segments.length && avatarCount <= Math.ceil(project.segments.length / 2)) ? 'ممتاز' : 'يحتاج تبسيطاً',
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
  const recommended = recommendArticleVideoDuration(input.article)
  const duration = input.preferredDuration || recommended.duration
  const segmentCount = duration / 8
  const recommendation = input.preferredDuration
    ? { duration, segments: segmentCount, days: Math.ceil(segmentCount / 3), reason: `اختيار يدوي: ${duration} ثانية، مع بقاء حد ثلاثة مقاطع يومياً.` }
    : recommended
  const title = input.article.title
  const idea = input.article.excerpt || clipWords(input.article.body || '', 30, title)
  const narrations = articleNarration(input.article, recommendation.segments, input.forge)
  const segments = buildSegments({ type: 'article_video', title, narrations, useAvatar: input.useAvatar !== false, tone: input.tone || 'فكرية', platform: input.platform || 'متعدد المنصات', articleUrl: `/articles/${input.article.slug}` })
  const social = socialPack({ type: 'article_video', title, idea, articleUrl: `/articles/${input.article.slug}`, forge: input.forge })
  const base: LiveDirectorProject = {
    id: projectId('article_video', input.article.slug), type: 'article_video', articleId: input.article.slug, articleUrl: `/articles/${input.article.slug}`,
    title, idea, centralMessage: idea, audience: input.audience || 'الجمهور العام والمهتمون بالتعليم', platform: input.platform || 'متعدد المنصات', tone: input.tone || 'فكرية', useAvatar: input.useAvatar !== false,
    series: false, seriesPlan: [], duration: recommendation.duration, durationReason: recommendation.reason, segmentCount: recommendation.segments, days: recommendation.days,
    narration: narrations.map((line) => line.text).join(' '), identityLock: AVATAR_LOCK, continuityNotes: [
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
  const recommended = recommendPublicVideoDuration(input)
  const title = suggestStrongTitle(input.topic)
  const idea = input.message?.trim() || input.topic.trim()
  const narrations = publicNarration(input.topic, idea, recommended.segments, input.forge)
  const segments = buildSegments({ type: 'public_topic_video', title, narrations, useAvatar: input.useAvatar !== false, tone: input.tone || 'فكرية', platform: input.platform || 'متعدد المنصات', articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '' })
  const social = socialPack({ type: 'public_topic_video', title, idea, linkedArticle: input.linkedArticle, articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '', archive: input.archive, forge: input.forge })
  const base: LiveDirectorProject = {
    id: projectId('public_topic_video', input.topic), type: 'public_topic_video', articleId: input.linkedArticle?.slug || '', articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '',
    title, idea, centralMessage: clipWords(idea, 30, title), audience: input.audience || 'الجمهور العام', platform: input.platform || 'متعدد المنصات', tone: input.tone || 'فكرية', useAvatar: input.useAvatar !== false,
    series: recommended.series, seriesPlan: recommended.series ? seriesPlan(input.topic) : [], duration: recommended.duration, durationReason: recommended.reason, segmentCount: recommended.segments, days: recommended.days,
    narration: narrations.map((line) => line.text).join(' '), identityLock: AVATAR_LOCK, continuityNotes: [
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
      visualBrief: segment.visualBrief || visualBriefFor(`${project.title} ${segment.message}`, segment.role, segment.order),
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
  'تغير الأفتار': 'Use strictly the pre-saved Dr. Ahmad avatar selected inside Flow. Never substitute a similar-looking person; keep one continuous front-facing shot to hold identity.',
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
  if (['الزوايا كثيرة', 'الزوايا قليلة والمشهد جامد', 'الانتقال بين الزوايا غير طبيعي'].includes(issue)) draft.shotPlan = shotPlan(draft.shotCount, draft.appearance)
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
  draft.negativeConstraints = unique([...constraintsFor(draft.appearance, draft.shotCount), ...(issue.includes('الأفتار') || issue.includes('الوجه') ? ['avatar replacement', 'pose reset'] : []), ...(issue === 'الخلفية تغيرت' ? ['inconsistent background'] : []), ...(issue === 'الانتقال بين الزوايا غير طبيعي' ? ['abrupt motion discontinuity'] : [])])
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

/** النسخة القريبة من دقيقة: مادة Flow تبقى 48 ثانية، والفارق تحرير خارجي. */
export function nearMinuteEditPlan(project: Pick<LiveDirectorProject, 'duration' | 'title' | 'articleUrl'>) {
  const generated = project.duration
  return {
    generated,
    intro: { from: 3, to: 5, note: 'مقدمة خارجية بسيطة: عنوان ثابت أو لقطة غلاف، تُحرَّر خارج Flow.' },
    outro: { from: 4, to: 7, note: project.articleUrl ? 'بطاقة رابط المقال ودعوة القراءة.' : 'بطاقة ختامية بالاسم والدعوة.' },
    finalFrom: generated + 3 + 4,
    finalTo: generated + 5 + 7,
    statement: `المادة المولدة من Flow ${generated} ثانية؛ والمدة النهائية بعد التحرير تقارب ${generated + 7}–${generated + 12} ثانية. لا تُنسب المقدمة والخاتمة إلى التوليد.`,
  }
}

/** ملاحظات من أرقام حقيقية فقط؛ تحت العينة الكافية تُعلن قلة البيانات ولا تُخترع نتيجة. */
export function liveDirectorPerformanceInsights(projects: Pick<LiveDirectorProject, 'duration' | 'segments' | 'useAvatar' | 'metrics'>[]) {
  const measured = projects.filter((project) => project.metrics && project.metrics.views > 0)
  if (measured.length < 5) return { enough: false, sample: measured.length, notes: ['لا توجد بيانات كافية بعد.'] }
  const average = (items: typeof measured) => items.reduce((total, item) => total + (item.metrics?.completion || 0), 0) / (items.length || 1)
  const bookended = measured.filter((project) => project.segments[0]?.appearance !== 'visual_only' && project.segments[project.segments.length - 1]?.appearance !== 'visual_only')
  const others = measured.filter((project) => !bookended.includes(project))
  const notes: string[] = [`العينة الحالية ${measured.length} مشروعاً منشوراً بأرقام مُدخلة يدوياً.`]
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
