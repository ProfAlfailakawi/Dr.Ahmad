/**
 * محرك الاستوديو الاجتماعي المحلي
 *
 * طبقة ذكاء تصميم حتمية (deterministic) بلا شبكة أو API. تحلل النص العربي،
 * تقترح المخرج والمنصة، ثم تبني خطط تكوين متباعدة فعلياً يستطيع عارض Canvas
 * أو HTML/CSS تنفيذها. لا يرسم هذا الملف الصورة بنفسه؛ مهمته أن يكون «عقل»
 * الاستوديو المستقل عن تقنية الرسم، وأن يبقي النص الأصلي محفوظاً دائماً.
 */

export const SOCIAL_DESIGN_ENGINE_VERSION = '2.1.0'

export type ContentKind =
  | 'quote'
  | 'core-idea'
  | 'summary'
  | 'provocative-question'
  | 'announcement'
  | 'invitation'
  | 'information'
  | 'statistic'
  | 'recommendation'
  | 'lecture'
  | 'course'
  | 'consultation'
  | 'media-appearance'
  | 'book'
  | 'research'
  | 'article'
  | 'carousel'
  | 'reel-cover'
  | 'linkedin-post'
  | 'x-post'
  | 'impression-card'
  | 'knowledge-design'

export type ContentTone =
  | 'formal'
  | 'institutional'
  | 'luxury'
  | 'human'
  | 'inspiring'
  | 'deep'
  | 'bold'
  | 'calm'
  | 'academic'
  | 'media'
  | 'promotional'
  | 'intellectual'

export type ContentTopic =
  | 'ai'
  | 'education'
  | 'family'
  | 'research'
  | 'media'
  | 'leadership'
  | 'human'
  | 'book'
  | 'general'

export type DesignDensity = 'minimal' | 'balanced' | 'rich'

export type SocialPlatform =
  | 'instagram'
  | 'story'
  | 'reel'
  | 'linkedin'
  | 'x'
  | 'pinterest'
  | 'presentation'
  | 'thumbnail'

export type SocialFormatId =
  | 'instagram-square'
  | 'instagram-portrait'
  | 'instagram-carousel'
  | 'story'
  | 'reel-cover'
  | 'linkedin-landscape'
  | 'linkedin-square'
  | 'x-landscape'
  | 'x-square'
  | 'pinterest-tall'
  | 'widescreen-cover'
  | 'video-thumbnail'

export type LayoutFamilyId =
  | 'editorial-axis'
  | 'hero-word'
  | 'quote-stage'
  | 'dual-thesis'
  | 'evidence-ledger'
  | 'event-marquee'
  | 'knowledge-map'
  | 'quiet-orbit'
  | 'chapter-stack'
  | 'cinematic-window'
  | 'human-note'
  | 'modular-brief'

export type TypographyModeId =
  | 'display-monumental'
  | 'editorial-serif'
  | 'rational-sans'
  | 'number-led'
  | 'quotation-signature'
  | 'academic-index'
  | 'cinematic-title'
  | 'conversational'

export type SpatialPatternId =
  | 'asymmetric-air'
  | 'centered-monument'
  | 'right-rail'
  | 'split-balance'
  | 'diagonal-flow'
  | 'modular-grid'
  | 'low-horizon'
  | 'layered-depth'
  | 'topographic-stack'
  | 'open-corners'

export type AccentStrategyId =
  | 'hero-keyword'
  | 'single-rule'
  | 'quiet-seal'
  | 'data-marker'
  | 'soft-orbit'
  | 'editorial-index'
  | 'contrast-band'
  | 'corner-signal'
  | 'paper-note'
  | 'none'

export type FramingModeId =
  | 'open-canvas'
  | 'hairline-inset'
  | 'editorial-folio'
  | 'architectural-arch'
  | 'cinematic-crop'
  | 'corner-marks'
  | 'floating-sheet'
  | 'full-bleed'

export type CtaPlacementId =
  | 'none'
  | 'footer-inline'
  | 'lower-rail'
  | 'edge-tab'
  | 'closing-slide'
  | 'under-title'

export type PaletteId =
  | 'brand-paper'
  | 'brand-night'
  | 'ink-white'
  | 'scholar-blue'
  | 'warm-parchment'
  | 'graphite-gold'
  | 'quiet-stone'
  | 'signal-ivory'

export type SlideRole = 'cover' | 'context' | 'insight' | 'evidence' | 'question' | 'action' | 'closing'

export interface SocialFormatSpec {
  id: SocialFormatId
  label: string
  platform: SocialPlatform
  width: number
  height: number
  safeInset: number
  maxTitleWords: number
  maxBodyWords: number
  supportsCarousel: boolean
}

export interface DesignLibraryEntry<Id extends string> {
  id: Id
  label: string
  description: string
}

export interface LayoutFamily extends DesignLibraryEntry<LayoutFamilyId> {
  idealKinds: readonly ContentKind[]
  idealTones: readonly ContentTone[]
  preferredDensities: readonly DesignDensity[]
  textBias: 'title' | 'quote' | 'body' | 'data' | 'sequence' | 'event'
  decorationBudget: 0 | 1 | 2 | 3
}

export interface TypographyMode extends DesignLibraryEntry<TypographyModeId> {
  displayFamily: 'El Messiri' | 'Tajawal'
  bodyFamily: 'Tajawal' | 'El Messiri'
  titleWeight: 400 | 500 | 600 | 700
  titleScale: number
  lineHeight: number
  maxLines: number
}

export interface SpatialPattern extends DesignLibraryEntry<SpatialPatternId> {
  columns: 1 | 2 | 3 | 4 | 6 | 8 | 12
  titleWidth: number
  titleX: number
  titleY: number
  bodyWidth: number
  bodyX: number
  bodyY: number
  align: 'right' | 'center'
}

export interface AccentStrategy extends DesignLibraryEntry<AccentStrategyId> {
  intensity: 0 | 1 | 2 | 3
  semanticTarget: 'none' | 'keyword' | 'index' | 'data' | 'frame' | 'cta'
}

export interface FramingMode extends DesignLibraryEntry<FramingModeId> {
  inset: number
  radius: number
  stroke: 0 | 1 | 2
}

export interface CtaPlacement extends DesignLibraryEntry<CtaPlacementId> {
  reserveRatio: number
}

export interface Palette {
  id: PaletteId
  label: string
  background: string
  surface: string
  ink: string
  muted: string
  accent: string
  accentSoft: string
  rule: string
  isDark: boolean
}

export interface TextMetrics {
  characters: number
  words: number
  sentences: number
  paragraphs: number
  bullets: number
  hasQuestion: boolean
  hasNumber: boolean
  hasExplicitCta: boolean
  isShort: boolean
  isLong: boolean
}

export interface ClassificationScore<T extends string> {
  id: T
  score: number
  confidence: number
  reasons: string[]
}

export interface CarouselSlide {
  id: string
  index: number
  role: SlideRole
  kicker: string
  title: string
  body: string
  sourceText: string
}

export interface ParsedContentStructure {
  original: string
  title: string
  subtitle: string
  quote: string
  keyPoint: string
  heroWord: string
  cta: string
  author: string
  source: string
  category: string
  keywords: string[]
  slides: CarouselSlide[]
}

export interface FormatRecommendation {
  format: SocialFormatId
  score: number
  reason: string
}

export interface SmartSuggestion {
  id: 'shorten' | 'carousel' | 'hero-word' | 'story' | 'linkedin' | 'poster' | 'cta' | 'quiet-version'
  label: string
  reason: string
  priority: number
}

export interface SocialContentAnalysis {
  normalizedText: string
  topic: ContentTopic
  primaryKind: ContentKind
  kinds: ClassificationScore<ContentKind>[]
  primaryTone: ContentTone
  tones: ClassificationScore<ContentTone>[]
  density: DesignDensity
  metrics: TextMetrics
  structure: ParsedContentStructure
  recommendedFormats: FormatRecommendation[]
  suggestions: SmartSuggestion[]
  confidence: number
}

export interface PlanGeometry {
  safeInset: number
  columns: number
  titleZone: { x: number; y: number; width: number; maxLines: number }
  bodyZone: { x: number; y: number; width: number; maxLines: number }
  visualWeight: 'top' | 'center' | 'bottom' | 'distributed'
  decorationBudget: 0 | 1 | 2 | 3
}

export interface PlanContent {
  original: string
  kicker: string
  title: string
  subtitle: string
  body: string
  quote: string
  heroWord: string
  cta: string
  author: string
  source: string
  slides: CarouselSlide[]
  keywords?: string[]
  omittedWordCount: number
  overflowStrategy: 'none' | 'trimmed-preview' | 'carousel'
}

export interface DesignLocks {
  content: boolean
  style: boolean
  color: boolean
  format: boolean
}

export interface DesignSignature {
  layout: LayoutFamilyId
  typography: TypographyModeId
  spatial: SpatialPatternId
  accent: AccentStrategyId
  framing: FramingModeId
  cta: CtaPlacementId
  palette: PaletteId
  format: SocialFormatId
}

export interface VisualQuality {
  score: number
  band: 'exceptional' | 'excellent' | 'strong' | 'needs-work'
  readability: number
  hierarchy: number
  whitespace: number
  contrast: number
  textContrast: number
  backgroundContrast: number
  density: number
  visualWeight: number
  rtlAlignment: number
  fit: number
  lineFit: number
  originality: number
  platformFit: number
  issues: string[]
  strengths: string[]
}

export type TasteTrait = 'titlePresence' | 'surfaceMode' | 'whitespaceMode' | 'identityPosition' | 'designCharacter'

export interface DesignTasteProfile {
  version: 1
  samples: number
  positiveSamples: number
  negativeSamples: number
  updatedAt?: string
  weights: Partial<Record<keyof DesignSignature, Record<string, number>>>
  traits?: Partial<Record<TasteTrait, Record<string, number>>>
}

export type CampaignAssetRole = 'hero' | 'story' | 'reel' | 'linkedin' | 'closing' | 'quote' | 'teaser' | 'reminder'

export interface SocialCampaignAsset {
  id: string
  role: CampaignAssetRole
  label: string
  purpose: string
  plan: CompositionPlan
}

export interface SocialCampaign {
  id: string
  title: string
  createdAt: string
  assets: SocialCampaignAsset[]
  qualityScore: number
  coherenceScore: number
  diversityScore: number
  ready: boolean
  warnings: string[]
}

/* الطبقة الحرة (أمر الدكتور: محرر طبقات بالسحب): عنصر يضاف فوق التكوين
   بإحداثيات نسبية 0..1 — يرسمه المصيّر بألوان اللوحة نفسها فلا ينشز */
export interface PlanOverlay {
  id: string
  kind: 'text' | 'rule' | 'circle' | 'rect'
  x: number
  y: number
  width: number
  height: number
  text?: string
  size?: number
  weight?: number
  color: 'ink' | 'accent' | 'muted' | 'paper'
  opacity: number
  align?: 'start' | 'middle' | 'end'
}

export interface CompositionPlan {
  id: string
  fingerprint: string
  version: string
  directionIndex: number
  directionLabel: string
  rationale: string[]
  /** طبقات المحرر الحر — اختيارية ولا تدخل في بصمة التصميم */
  overlays?: PlanOverlay[]
  format: SocialFormatSpec
  platform: SocialPlatform
  density: DesignDensity
  layout: LayoutFamilyId
  typography: TypographyModeId
  spatial: SpatialPatternId
  accent: AccentStrategyId
  framing: FramingModeId
  ctaPlacement: CtaPlacementId
  palette: PaletteId
  geometry: PlanGeometry
  content: PlanContent
  analysis: Pick<SocialContentAnalysis, 'topic' | 'primaryKind' | 'primaryTone' | 'confidence'>
  fitness: number
  novelty: number
  quality?: VisualQuality
  tasteAffinity?: number
  locksApplied: DesignLocks
}

export interface DesignHistoryEntry {
  fingerprint: string
  signature: DesignSignature
  generatedAt?: string
}

/* ═══════════ محلل الأوامر العربية والخليجية (مقترحات صديق الدكتور ١-٧ و١١) ═══════════
   «أبي بوستر فاخر لمحاضرة بعنوان مستقبل المعلم» تُفهم محلياً بلا أي سحابة:
   يُستخرج النوع والنبرة والمقاس والقيود، وتُجرَّد كلمات الأمر من المحتوى الحقيقي،
   ويُعرض للدكتور ما فُهم بدرجة ثقة وافتراضات صريحة — فهمٌ قاعدي صادق لا ادعاء ذكاء. */
export type StudioCommandParse = {
  content: string
  contextHint: string
  tone?: ContentTone
  format?: SocialFormatId
  platform?: SocialPlatform
  preferLayout?: LayoutFamilyId
  heroWord?: string
  noBody: boolean
  noCta: boolean
  understood: { label: string; value: string }[]
  assumptions: string[]
  confidence: number
}

const COMMAND_TONES: [RegExp, ContentTone, string][] = [
  [/(?:^|\s)(?:فاخر|فخم|ملكي|راقي)(?:\s|$)/, 'luxury', 'فاخرة'],
  [/(?:^|\s)(?:هادئ|هادي|بهدوء)(?:\s|$)/, 'calm', 'هادئة'],
  [/(?:^|\s)(?:أكاديمي|اكاديمي|علمي)(?:\s|$)/, 'academic', 'أكاديمية'],
  [/(?:^|\s)(?:رسمي|مؤسسي)(?:\s|$)/, 'formal', 'رسمية'],
  [/(?:^|\s)(?:جريء|جري|قوي|صارخ)(?:\s|$)/, 'bold', 'جريئة'],
  [/(?:^|\s)(?:إنساني|انساني|دافئ)(?:\s|$)/, 'human', 'إنسانية'],
  [/(?:^|\s)(?:ملهم|محفز)(?:\s|$)/, 'inspiring', 'ملهمة'],
  [/(?:^|\s)(?:عميق|تأملي|داكن|غامق)(?:\s|$)/, 'deep', 'عميقة/داكنة'],
]

const COMMAND_FORMATS: [RegExp, SocialFormatId, SocialPlatform | undefined, string][] = [
  [/(?:^|\s)(?:ستوري|استوري|قصة|قصه)(?:\s|$)/, 'story', 'story', 'ستوري'],
  [/(?:^|\s)(?:ريل|ريلز)(?:\s|$)/, 'reel-cover', 'reel', 'غلاف ريل'],
  [/(?:^|\s)(?:كاروسيل|سلسلة|سلسله|شرائح)(?:\s|$)/, 'instagram-carousel', 'instagram', 'كاروسيل'],
  [/(?:^|\s)(?:تغريدة|تغريده|تويتر)(?:\s|$)/, 'x-square', 'x', 'منشور X'],
  [/(?:^|\s)(?:لينكد\s?إن|لينكد\s?ان|linkedin)(?:\s|$)/i, 'linkedin-square', 'linkedin', 'منشور LinkedIn'],
  [/(?:^|\s)(?:بنترست|pinterest)(?:\s|$)/i, 'pinterest-tall', 'pinterest', 'تصميم Pinterest'],
]

const COMMAND_KIND_HINTS: [RegExp, string, string][] = [
  [/(?:^|\s)(?:لمحاضرة|لمحاضره|محاضرة|محاضره|لندوة|لندوه)(?:\s|$)/, 'محاضرة', 'إعلان محاضرة'],
  [/(?:^|\s)(?:لكتاب|كتاب|لإصدار|لاصدار)(?:\s|$)/, 'كتاب', 'تصميم كتاب'],
  [/(?:^|\s)(?:لبحث|بحث|لدراسة|لدراسه)(?:\s|$)/, 'بحث', 'تصميم بحث'],
  [/(?:^|\s)(?:لدورة|لدوره|دورة تدريبية|دوره تدريبيه)(?:\s|$)/, 'دورة تدريبية', 'إعلان دورة'],
  [/(?:^|\s)(?:لدعوة|لدعوه|دعوة|دعوه)(?:\s|$)/, 'دعوة', 'بطاقة دعوة'],
  [/(?:^|\s)(?:إعلان|اعلان)(?:\s|$)/, 'إعلان', 'إعلان'],
  [/(?:^|\s)(?:اقتباس|مقولة|مقوله)(?:\s|$)/, 'اقتباس', 'بطاقة اقتباس'],
]

const COMMAND_OPENERS = /^\s*(?:أبي|ابي|أبغى|ابغى|ابغي|أبا|ابا|أريد|اريد|بغيت|ودي|سوّ لي|سو لي|سوي لي|سويلي|صمم لي|صمملي|اصنع لي|اعمل لي|اعطني|عطني)\s+/
const COMMAND_ARTIFACTS = /^\s*(?:تصميم|بوستر|بوست|منشور|صورة|صوره|بطاقة|بطاقه)\s*/
const COMMAND_CONNECTORS = /^\s*(?:عن|حول|بخصوص|إلى|الى|بعنوان|عنوانه|عنوانها)[:\s]+/

export function parseStudioCommand(raw: string): StudioCommandParse {
  const original = String(raw || '').replace(/\s+/g, ' ').trim()
  const understood: StudioCommandParse['understood'] = []
  const assumptions: string[] = []
  let working = original
  let signals = 0
  let tone: ContentTone | undefined
  let format: SocialFormatId | undefined
  let platform: SocialPlatform | undefined
  let preferLayout: LayoutFamilyId | undefined
  let heroWord: string | undefined
  let contextParts: string[] = []
  let noBody = false
  let noCta = false

  const consume = (pattern: RegExp) => {
    const match = working.match(pattern)
    if (!match) return false
    working = working.replace(pattern, ' ').replace(/\s+/g, ' ').trim()
    return true
  }

  /* القيود أولاً — تصلح في أي موضع من الجملة */
  if (consume(/(?:^|\s)(?:بدون|بلا)\s*(?:متن|نص طويل)(?:\s|$)/)) { noBody = true; signals += 1; understood.push({ label: 'قيد', value: 'بدون متن' }) }
  if (consume(/(?:^|\s)(?:بدون|بلا)\s*(?:دعوة|دعوه|زر)(?:\s|$)/)) { noCta = true; signals += 1; understood.push({ label: 'قيد', value: 'بدون دعوة' }) }

  /* الكلمة البطلة: «خل النجاح بطل» أو «اجعل الإنسان كلمة بطلة» */
  const hero = working.match(/(?:اجعل|خل|خلي|خله)\s+(?:كلمة\s+)?([؀-ۿ]{2,})\s+(?:كلمة\s+)?بطل(?:ة|ه)?/)
  if (hero) {
    heroWord = hero[1]
    preferLayout = 'hero-word'
    signals += 1
    understood.push({ label: 'الكلمة البطلة', value: heroWord })
    working = working.replace(hero[0], ' ').replace(/\s+/g, ' ').trim()
  }

  for (const [pattern, id, platformId, label] of COMMAND_FORMATS) {
    if (consume(pattern)) { format = id; platform = platformId; signals += 1; understood.push({ label: 'المقاس', value: label }); break }
  }
  for (const [pattern, id, label] of COMMAND_TONES) {
    if (consume(pattern)) { tone = id; signals += 1; understood.push({ label: 'النبرة', value: label }); break }
  }
  for (const [pattern, hint, label] of COMMAND_KIND_HINTS) {
    if (consume(pattern)) { contextParts.push(hint); signals += 1; understood.push({ label: 'النوع', value: label }); break }
  }

  /* أفعال الطلب وكلمات القالب — تُجرَّد من بداية الجملة على جولات */
  for (let round = 0; round < 4; round += 1) {
    let stripped = false
    if (consume(COMMAND_OPENERS)) { stripped = true; signals += 1 }
    if (consume(COMMAND_ARTIFACTS)) { stripped = true; signals += 1 }
    if (consume(COMMAND_CONNECTORS)) stripped = true
    if (!stripped) break
  }

  const content = working.trim() || original
  if (!working.trim()) assumptions.push('الجملة كلها كلمات أمر؛ استعملت النص كما هو محتوىً.')
  if (noBody) assumptions.push('سأخفض الكثافة لأدنى درجة — إسقاط المتن كلياً يتم من محرر التصميم.')
  if (noCta) assumptions.push('إسقاط الدعوة نهائياً يتم من محرر التصميم؛ خففت حضورها هنا.')
  if (tone === 'deep') assumptions.push('«داكن/عميق» يميل باللوحات نحو العمق الليلي المتاح في هذه النبرة.')
  if (content !== original) understood.push({ label: 'المحتوى الحقيقي', value: content.length > 60 ? `${content.slice(0, 57)}…` : content })

  const confidence = Math.min(.95, .5 + signals * .11)
  return { content, contextHint: contextParts.join(' · '), tone, format, platform, preferLayout, heroWord, noBody, noCta, understood, assumptions, confidence }
}

export interface SocialDesignRequest {
  text: string
  context?: string
  author?: string
  source?: string
  platform?: SocialPlatform | 'auto'
  format?: SocialFormatId | 'auto'
  tone?: ContentTone | 'auto'
  density?: DesignDensity | 'auto'
  count?: number
  seed?: string | number
  locks?: Partial<DesignLocks>
  basePlan?: CompositionPlan
  history?: readonly (DesignHistoryEntry | CompositionPlan)[]
  noveltyThreshold?: number
  tasteProfile?: DesignTasteProfile
  /** رغبة صريحة من المستخدم بعائلة تكوين بعينها (زر «اجعلها كلمة بطلة» مثلاً) */
  preferLayout?: LayoutFamilyId
}

export interface SocialDesignResult {
  analysis: SocialContentAnalysis
  plans: CompositionPlan[]
  generation: {
    seed: string
    requestedCount: number
    producedCount: number
    historyCompared: number
    noveltyThreshold: number
    warnings: string[]
    candidateCount: number
    rejectedCount: number
    averageQuality: number
  }
}

export const SOCIAL_FORMATS: Record<SocialFormatId, SocialFormatSpec> = {
  'instagram-square': { id: 'instagram-square', label: 'Instagram 1:1', platform: 'instagram', width: 1080, height: 1080, safeInset: 0.085, maxTitleWords: 18, maxBodyWords: 42, supportsCarousel: false },
  'instagram-portrait': { id: 'instagram-portrait', label: 'Instagram 4:5', platform: 'instagram', width: 1080, height: 1350, safeInset: 0.085, maxTitleWords: 22, maxBodyWords: 58, supportsCarousel: false },
  'instagram-carousel': { id: 'instagram-carousel', label: 'Instagram Carousel 4:5', platform: 'instagram', width: 1080, height: 1350, safeInset: 0.085, maxTitleWords: 18, maxBodyWords: 54, supportsCarousel: true },
  story: { id: 'story', label: 'Story 9:16', platform: 'story', width: 1080, height: 1920, safeInset: 0.105, maxTitleWords: 20, maxBodyWords: 54, supportsCarousel: false },
  'reel-cover': { id: 'reel-cover', label: 'Reel cover 9:16', platform: 'reel', width: 1080, height: 1920, safeInset: 0.13, maxTitleWords: 13, maxBodyWords: 20, supportsCarousel: false },
  'linkedin-landscape': { id: 'linkedin-landscape', label: 'LinkedIn 1.91:1', platform: 'linkedin', width: 1200, height: 627, safeInset: 0.075, maxTitleWords: 18, maxBodyWords: 34, supportsCarousel: false },
  'linkedin-square': { id: 'linkedin-square', label: 'LinkedIn 1:1', platform: 'linkedin', width: 1200, height: 1200, safeInset: 0.08, maxTitleWords: 24, maxBodyWords: 56, supportsCarousel: true },
  'x-landscape': { id: 'x-landscape', label: 'X 16:9', platform: 'x', width: 1600, height: 900, safeInset: 0.07, maxTitleWords: 18, maxBodyWords: 30, supportsCarousel: false },
  'x-square': { id: 'x-square', label: 'X 1:1', platform: 'x', width: 1080, height: 1080, safeInset: 0.08, maxTitleWords: 18, maxBodyWords: 36, supportsCarousel: false },
  'pinterest-tall': { id: 'pinterest-tall', label: 'Pinterest 2:3', platform: 'pinterest', width: 1000, height: 1500, safeInset: 0.08, maxTitleWords: 24, maxBodyWords: 66, supportsCarousel: false },
  'widescreen-cover': { id: 'widescreen-cover', label: 'غلاف 16:9', platform: 'presentation', width: 1920, height: 1080, safeInset: 0.07, maxTitleWords: 20, maxBodyWords: 34, supportsCarousel: false },
  'video-thumbnail': { id: 'video-thumbnail', label: 'Thumbnail 16:9', platform: 'thumbnail', width: 1280, height: 720, safeInset: 0.07, maxTitleWords: 10, maxBodyWords: 16, supportsCarousel: false },
}

export const LAYOUT_FAMILIES: Record<LayoutFamilyId, LayoutFamily> = {
  'editorial-axis': { id: 'editorial-axis', label: 'محور تحريري', description: 'عنوان مضبوط على محور رأسي ومساحة بيضاء تشبه افتتاحيات المجلات.', idealKinds: ['article', 'core-idea', 'research', 'knowledge-design'], idealTones: ['intellectual', 'academic', 'formal', 'calm'], preferredDensities: ['minimal', 'balanced'], textBias: 'body', decorationBudget: 1 },
  'hero-word': { id: 'hero-word', label: 'الكلمة البطلة', description: 'كلمة مركزية كبيرة تمسك الفكرة ويأتي العنوان حولها بإيقاع قليل الضجيج.', idealKinds: ['quote', 'core-idea', 'provocative-question', 'impression-card'], idealTones: ['bold', 'deep', 'inspiring', 'luxury'], preferredDensities: ['minimal'], textBias: 'title', decorationBudget: 1 },
  'quote-stage': { id: 'quote-stage', label: 'منصة الاقتباس', description: 'اقتباس واسع النفس مع توقيع صغير وفاصل دقيق.', idealKinds: ['quote', 'recommendation', 'impression-card'], idealTones: ['human', 'deep', 'calm', 'luxury'], preferredDensities: ['minimal', 'balanced'], textBias: 'quote', decorationBudget: 1 },
  'dual-thesis': { id: 'dual-thesis', label: 'الأطروحة المزدوجة', description: 'مجالان متوازنان للمقارنة أو السؤال والجواب من دون صناديق ثقيلة.', idealKinds: ['provocative-question', 'core-idea', 'recommendation', 'knowledge-design'], idealTones: ['bold', 'intellectual', 'academic'], preferredDensities: ['balanced'], textBias: 'body', decorationBudget: 1 },
  'evidence-ledger': { id: 'evidence-ledger', label: 'سجل الدليل', description: 'رقم أو حقيقة أولاً، ثم تفسير مختصر في شبكة معرفية هادئة.', idealKinds: ['statistic', 'research', 'information', 'summary'], idealTones: ['academic', 'institutional', 'formal'], preferredDensities: ['balanced', 'rich'], textBias: 'data', decorationBudget: 2 },
  'event-marquee': { id: 'event-marquee', label: 'واجهة الحدث', description: 'عنوان الحدث والزمن والدعوة ضمن بناء إعلامي واضح قابل للمسح السريع.', idealKinds: ['announcement', 'lecture', 'course', 'media-appearance', 'invitation', 'consultation'], idealTones: ['media', 'promotional', 'institutional', 'formal'], preferredDensities: ['balanced', 'rich'], textBias: 'event', decorationBudget: 2 },
  'knowledge-map': { id: 'knowledge-map', label: 'خريطة المعرفة', description: 'عقدة مركزية ومسارات معنى خفيفة للمفاهيم المركبة.', idealKinds: ['knowledge-design', 'research', 'summary', 'carousel'], idealTones: ['academic', 'intellectual', 'institutional'], preferredDensities: ['rich'], textBias: 'sequence', decorationBudget: 3 },
  'quiet-orbit': { id: 'quiet-orbit', label: 'المدار الهادئ', description: 'فكرة مركزية وحركة دائرية شبه صامتة تمنح العمق بلا زحام.', idealKinds: ['core-idea', 'quote', 'reel-cover', 'impression-card'], idealTones: ['deep', 'calm', 'luxury', 'inspiring'], preferredDensities: ['minimal', 'balanced'], textBias: 'title', decorationBudget: 2 },
  'chapter-stack': { id: 'chapter-stack', label: 'فصول الفكرة', description: 'تتابع رقمي أو شرائحي يوضح الانتقال من مدخل إلى نتيجة.', idealKinds: ['carousel', 'summary', 'recommendation', 'article'], idealTones: ['formal', 'academic', 'intellectual'], preferredDensities: ['balanced', 'rich'], textBias: 'sequence', decorationBudget: 1 },
  'cinematic-window': { id: 'cinematic-window', label: 'النافذة السينمائية', description: 'مساحة عريضة مشدودة بصرياً للغلاف واللقاء والريل.', idealKinds: ['media-appearance', 'reel-cover', 'announcement', 'lecture'], idealTones: ['media', 'bold', 'luxury'], preferredDensities: ['minimal', 'balanced'], textBias: 'title', decorationBudget: 2 },
  'human-note': { id: 'human-note', label: 'الملاحظة الإنسانية', description: 'ورقة شخصية راقية وهوامش لينة لصوت إنساني قريب.', idealKinds: ['quote', 'recommendation', 'consultation', 'impression-card'], idealTones: ['human', 'calm', 'inspiring'], preferredDensities: ['minimal', 'balanced'], textBias: 'quote', decorationBudget: 1 },
  'modular-brief': { id: 'modular-brief', label: 'الملخص المركب', description: 'وحدات متفاوتة المقاس تختصر إعلاناً أو معرفة كثيفة من دون تكديس.', idealKinds: ['course', 'consultation', 'book', 'research', 'information', 'linkedin-post'], idealTones: ['institutional', 'academic', 'promotional', 'formal'], preferredDensities: ['balanced', 'rich'], textBias: 'body', decorationBudget: 2 },
}

export const TYPOGRAPHY_MODES: Record<TypographyModeId, TypographyMode> = {
  'display-monumental': { id: 'display-monumental', label: 'عنوان نُصبي', description: 'كلمات قليلة بحضور قوي ومسافة أسطر متماسكة.', displayFamily: 'El Messiri', bodyFamily: 'Tajawal', titleWeight: 700, titleScale: 1.16, lineHeight: 1.38, maxLines: 4 },
  'editorial-serif': { id: 'editorial-serif', label: 'تحريري', description: 'هرمية مجلة فاخرة للعنوان والمتن.', displayFamily: 'El Messiri', bodyFamily: 'Tajawal', titleWeight: 600, titleScale: 1, lineHeight: 1.55, maxLines: 6 },
  'rational-sans': { id: 'rational-sans', label: 'هندسي واضح', description: 'وضوح مؤسسي سريع القراءة بوزن محسوب.', displayFamily: 'Tajawal', bodyFamily: 'Tajawal', titleWeight: 700, titleScale: 0.95, lineHeight: 1.45, maxLines: 5 },
  'number-led': { id: 'number-led', label: 'الرقم أولاً', description: 'رقم أو نسبة كبيرة يعقبها تفسير مختصر.', displayFamily: 'Tajawal', bodyFamily: 'Tajawal', titleWeight: 700, titleScale: 1.2, lineHeight: 1.35, maxLines: 4 },
  'quotation-signature': { id: 'quotation-signature', label: 'اقتباس وتوقيع', description: 'صوت هادئ مع علامات اقتباس وهوية مؤلف مقتصدة.', displayFamily: 'El Messiri', bodyFamily: 'Tajawal', titleWeight: 500, titleScale: 1.03, lineHeight: 1.72, maxLines: 7 },
  'academic-index': { id: 'academic-index', label: 'فهرس أكاديمي', description: 'عناوين دقيقة وترقيم صغير يشبه أوراق البحث.', displayFamily: 'El Messiri', bodyFamily: 'Tajawal', titleWeight: 600, titleScale: 0.9, lineHeight: 1.58, maxLines: 6 },
  'cinematic-title': { id: 'cinematic-title', label: 'عنوان سينمائي', description: 'كتلة عنوان قصيرة عالية التباين للغلاف.', displayFamily: 'El Messiri', bodyFamily: 'Tajawal', titleWeight: 700, titleScale: 1.12, lineHeight: 1.34, maxLines: 4 },
  conversational: { id: 'conversational', label: 'صوت قريب', description: 'إيقاع عربي مريح يناسب السؤال والنبرة الإنسانية.', displayFamily: 'El Messiri', bodyFamily: 'Tajawal', titleWeight: 500, titleScale: 0.98, lineHeight: 1.66, maxLines: 7 },
}

export const SPATIAL_PATTERNS: Record<SpatialPatternId, SpatialPattern> = {
  'asymmetric-air': { id: 'asymmetric-air', label: 'هواء غير متماثل', description: 'كتلة نصية إلى اليمين وفراغ بطولي محسوب.', columns: 12, titleWidth: 0.66, titleX: 0.26, titleY: 0.2, bodyWidth: 0.48, bodyX: 0.44, bodyY: 0.62, align: 'right' },
  'centered-monument': { id: 'centered-monument', label: 'مركز نُصبي', description: 'تكوين مركزي ثابت يليق بالجمل القصيرة.', columns: 6, titleWidth: 0.76, titleX: 0.12, titleY: 0.31, bodyWidth: 0.62, bodyX: 0.19, bodyY: 0.68, align: 'center' },
  'right-rail': { id: 'right-rail', label: 'سكة يمينية', description: 'محور قراءة عربي واضح من أعلى اليمين.', columns: 8, titleWidth: 0.68, titleX: 0.24, titleY: 0.18, bodyWidth: 0.58, bodyX: 0.34, bodyY: 0.58, align: 'right' },
  'split-balance': { id: 'split-balance', label: 'ميزان ثنائي', description: 'نصفان متوازنان من دون حدود ثقيلة.', columns: 12, titleWidth: 0.42, titleX: 0.53, titleY: 0.27, bodyWidth: 0.4, bodyX: 0.08, bodyY: 0.3, align: 'right' },
  'diagonal-flow': { id: 'diagonal-flow', label: 'تدفق قطري', description: 'انتقال بصري ناعم بين كتلتين متباعدتين.', columns: 12, titleWidth: 0.62, titleX: 0.3, titleY: 0.14, bodyWidth: 0.5, bodyX: 0.08, bodyY: 0.67, align: 'right' },
  'modular-grid': { id: 'modular-grid', label: 'شبكة وحدات', description: 'وحدات معلومات موزونة ضمن شبكة مرنة.', columns: 12, titleWidth: 0.62, titleX: 0.3, titleY: 0.14, bodyWidth: 0.78, bodyX: 0.11, bodyY: 0.52, align: 'right' },
  'low-horizon': { id: 'low-horizon', label: 'أفق منخفض', description: 'العنوان فوق خط أفق واسع يمنح الغلاف حضوراً.', columns: 8, titleWidth: 0.72, titleX: 0.14, titleY: 0.22, bodyWidth: 0.56, bodyX: 0.22, bodyY: 0.7, align: 'center' },
  'layered-depth': { id: 'layered-depth', label: 'عمق طبقي', description: 'مستويات قليلة متداخلة بإزاحات صغيرة.', columns: 12, titleWidth: 0.66, titleX: 0.26, titleY: 0.25, bodyWidth: 0.5, bodyX: 0.1, bodyY: 0.64, align: 'right' },
  'topographic-stack': { id: 'topographic-stack', label: 'تتابع طبوغرافي', description: 'خطوات رأسية بإيقاع متفاوت للكاروسيل.', columns: 8, titleWidth: 0.7, titleX: 0.22, titleY: 0.15, bodyWidth: 0.66, bodyX: 0.18, bodyY: 0.48, align: 'right' },
  'open-corners': { id: 'open-corners', label: 'زوايا مفتوحة', description: 'تكوين عريض لا يشعر بأنه محاصر داخل بطاقة.', columns: 12, titleWidth: 0.74, titleX: 0.18, titleY: 0.24, bodyWidth: 0.52, bodyX: 0.4, bodyY: 0.64, align: 'right' },
}

export const ACCENT_STRATEGIES: Record<AccentStrategyId, AccentStrategy> = {
  'hero-keyword': { id: 'hero-keyword', label: 'كلمة محورية', description: 'تكبير كلمة واحدة لا تلوين الجملة كلها.', intensity: 2, semanticTarget: 'keyword' },
  'single-rule': { id: 'single-rule', label: 'خط واحد', description: 'فاصل شعري دقيق يضبط الإيقاع.', intensity: 1, semanticTarget: 'frame' },
  'quiet-seal': { id: 'quiet-seal', label: 'ختم هادئ', description: 'علامة هوية صغيرة لا تنافس النص.', intensity: 1, semanticTarget: 'index' },
  'data-marker': { id: 'data-marker', label: 'علامة رقمية', description: 'إشارة بصرية للرقم أو الدليل الأساسي.', intensity: 2, semanticTarget: 'data' },
  'soft-orbit': { id: 'soft-orbit', label: 'مدار خافت', description: 'قوس أو دائرة شفافة تمنح العمق.', intensity: 2, semanticTarget: 'frame' },
  'editorial-index': { id: 'editorial-index', label: 'فهرس تحريري', description: 'رقم صفحة أو تصنيف صغير في الهامش.', intensity: 1, semanticTarget: 'index' },
  'contrast-band': { id: 'contrast-band', label: 'شريط تباين', description: 'شريط واحد يربط العنوان بالدعوة.', intensity: 2, semanticTarget: 'cta' },
  'corner-signal': { id: 'corner-signal', label: 'إشارة زاوية', description: 'علامة هندسية مقتصدة في زاوية واحدة.', intensity: 1, semanticTarget: 'frame' },
  'paper-note': { id: 'paper-note', label: 'ملاحظة ورقية', description: 'طبقة ورق دافئة خفيفة للصوت الإنساني.', intensity: 2, semanticTarget: 'keyword' },
  none: { id: 'none', label: 'بلا زينة', description: 'النص والفراغ وحدهما يصنعان التصميم.', intensity: 0, semanticTarget: 'none' },
}

export const FRAMING_MODES: Record<FramingModeId, FramingMode> = {
  'open-canvas': { id: 'open-canvas', label: 'لوحة مفتوحة', description: 'لا إطار؛ الفراغ هو الحد.', inset: 0, radius: 0, stroke: 0 },
  'hairline-inset': { id: 'hairline-inset', label: 'إطار شعري', description: 'حد رفيع داخل منطقة الأمان.', inset: 0.045, radius: 0.02, stroke: 1 },
  'editorial-folio': { id: 'editorial-folio', label: 'صفحة تحريرية', description: 'هوامش كتابية ورقم صغير.', inset: 0.035, radius: 0, stroke: 1 },
  'architectural-arch': { id: 'architectural-arch', label: 'قوس معماري', description: 'قوس هندسي ناعم لا زخرفة كثيفة.', inset: 0.06, radius: 0.12, stroke: 1 },
  'cinematic-crop': { id: 'cinematic-crop', label: 'قص سينمائي', description: 'حافتان أفقيتان تركزان مجال الرؤية.', inset: 0, radius: 0, stroke: 0 },
  'corner-marks': { id: 'corner-marks', label: 'علامات الزوايا', description: 'أربع علامات صغيرة بدلاً من صندوق كامل.', inset: 0.04, radius: 0, stroke: 1 },
  'floating-sheet': { id: 'floating-sheet', label: 'ورقة عائمة', description: 'سطح داخلي واسع بظل شبه معدوم.', inset: 0.055, radius: 0.045, stroke: 1 },
  'full-bleed': { id: 'full-bleed', label: 'امتداد كامل', description: 'الخلفية تمتد للحافة مع نص داخل الأمان.', inset: 0, radius: 0, stroke: 0 },
}

export const CTA_PLACEMENTS: Record<CtaPlacementId, CtaPlacement> = {
  none: { id: 'none', label: 'بلا دعوة', description: 'لا تضاف دعوة حين لا يحتاجها المحتوى.', reserveRatio: 0 },
  'footer-inline': { id: 'footer-inline', label: 'تذييل مباشر', description: 'دعوة صغيرة على خط الهوية.', reserveRatio: 0.08 },
  'lower-rail': { id: 'lower-rail', label: 'سكة سفلية', description: 'دعوة واضحة في حيز سفلي منفصل بخفة.', reserveRatio: 0.13 },
  'edge-tab': { id: 'edge-tab', label: 'لسان طرفي', description: 'دعوة مقتضبة على طرف التصميم.', reserveRatio: 0.07 },
  'closing-slide': { id: 'closing-slide', label: 'شريحة ختامية', description: 'تؤجل الدعوة إلى نهاية الكاروسيل.', reserveRatio: 0 },
  'under-title': { id: 'under-title', label: 'تحت العنوان', description: 'دعوة قصيرة بعد العنوان مباشرة في الإعلانات.', reserveRatio: 0.1 },
}

export const PALETTES: Record<PaletteId, Palette> = {
  'brand-paper': { id: 'brand-paper', label: 'ورق الهوية', background: '#F8F6F0', surface: '#FFFFFF', ink: '#17191D', muted: '#68717A', accent: '#3E5C78', accentSoft: '#DCE5EC', rule: '#D9D7D0', isDark: false },
  'brand-night': { id: 'brand-night', label: 'ليل الهوية', background: '#111820', surface: '#192430', ink: '#F7F5EF', muted: '#B8C1C8', accent: '#90AEC7', accentSoft: '#263D51', rule: '#344654', isDark: true },
  'ink-white': { id: 'ink-white', label: 'حبر وأبيض', background: '#FFFFFF', surface: '#F7F7F5', ink: '#111214', muted: '#6B6F75', accent: '#24272C', accentSoft: '#E8E9E8', rule: '#DADBDA', isDark: false },
  'scholar-blue': { id: 'scholar-blue', label: 'أزرق الباحث', background: '#EAF0F4', surface: '#F8FBFD', ink: '#152434', muted: '#607180', accent: '#294E6D', accentSoft: '#C8D9E5', rule: '#BFCED8', isDark: false },
  'warm-parchment': { id: 'warm-parchment', label: 'مخطوط دافئ', background: '#F3ECDD', surface: '#FCF9F1', ink: '#201B15', muted: '#756B5C', accent: '#3E5C78', accentSoft: '#DED3BB', rule: '#D4C7AE', isDark: false },
  'graphite-gold': { id: 'graphite-gold', label: 'جرافيت وذهب', background: '#202226', surface: '#292C31', ink: '#F4F1E9', muted: '#BCB8AE', accent: '#C5A76C', accentSoft: '#443D31', rule: '#494A4C', isDark: true },
  'quiet-stone': { id: 'quiet-stone', label: 'حجر هادئ', background: '#ECECEA', surface: '#F8F8F6', ink: '#202225', muted: '#6C7073', accent: '#566B78', accentSoft: '#D5DADC', rule: '#CFD0CD', isDark: false },
  'signal-ivory': { id: 'signal-ivory', label: 'عاج وإشارة', background: '#FFFDF7', surface: '#F7F1E4', ink: '#181A1E', muted: '#706B61', accent: '#9B713D', accentSoft: '#EFE0C5', rule: '#E0D7C8', isDark: false },
}

const KIND_LABELS: Record<ContentKind, string> = {
  quote: 'اقتباس', 'core-idea': 'فكرة رئيسية', summary: 'ملخص', 'provocative-question': 'سؤال جدلي', announcement: 'إعلان', invitation: 'دعوة', information: 'معلومة', statistic: 'إحصائية', recommendation: 'توصية', lecture: 'إعلان محاضرة', course: 'دورة تدريبية', consultation: 'استشارة', 'media-appearance': 'لقاء إعلامي', book: 'كتاب', research: 'بحث', article: 'مقال', carousel: 'سلسلة/كاروسيل', 'reel-cover': 'غلاف ريل/ستوري', 'linkedin-post': 'منشور LinkedIn', 'x-post': 'منشور X', 'impression-card': 'بطاقة انطباعية', 'knowledge-design': 'تصميم معرفي',
}

const TONE_LABELS: Record<ContentTone, string> = {
  formal: 'رسمي', institutional: 'مؤسسي', luxury: 'فاخر', human: 'إنساني', inspiring: 'ملهم', deep: 'عميق', bold: 'جريء', calm: 'هادئ', academic: 'أكاديمي', media: 'إعلامي', promotional: 'ترويجي', intellectual: 'فكري',
}

const TOPIC_LABELS: Record<ContentTopic, string> = {
  ai: 'الذكاء الاصطناعي والتقنية', education: 'التعليم والتعلّم', family: 'الأسرة والتربية', research: 'البحث والمعرفة', media: 'الإعلام والمجتمع الرقمي', leadership: 'القيادة والمستقبل', human: 'الإنسان والمعنى', book: 'الكتب والقراءة', general: 'فكرة عامة',
}

type WeightedSignal = { pattern: RegExp; weight: number; reason: string }

const KIND_SIGNALS: Record<ContentKind, readonly WeightedSignal[]> = {
  quote: [
    { pattern: /[«”\"]|(?:^|\s)(?:قال|اقتباس)(?:\s|:)/, weight: 5, reason: 'صيغة اقتباس صريحة' },
    { pattern: /^(?:.{15,170})$/s, weight: 1, reason: 'جملة مستقلة قابلة للاقتباس' },
  ],
  'core-idea': [
    { pattern: /(?:الفكره|الجوهر|ليس.+بل|لا.+بل|المعني)/, weight: 4, reason: 'أطروحة أو مقابلة مركزية' },
    { pattern: /^(?:.{20,220})$/s, weight: 2, reason: 'فكرة مركزة' },
  ],
  summary: [
    { pattern: /(?:ملخص|الخلاصه|باختصار|في نقاط|اهم ما)/, weight: 8, reason: 'طلب أو صيغة تلخيص' },
    { pattern: /(?:^|\n)\s*[-•–—]|(?:اولا|ثانيا|ثالثا)/, weight: 4, reason: 'بنية نقاط' },
  ],
  'provocative-question': [
    { pattern: /[؟?]/, weight: 7, reason: 'علامة استفهام' },
    { pattern: /^(?:هل|لماذا|كيف|متي|اين|ماذا|ما الذي|من الذي|ايهما)(?:\s|$)/, weight: 6, reason: 'أداة استفهام' },
  ],
  announcement: [
    { pattern: /(?:اعلان|يسرنا|نعلن|موعد|قريبا|يفتتح|يطلق)/, weight: 7, reason: 'لغة إعلان' },
    { pattern: /(?:اليوم|غدا|الساعه|بتاريخ|الموافق|\d{1,2}[\/-]\d{1,2})/, weight: 3, reason: 'توقيت أو تاريخ' },
  ],
  invitation: [
    { pattern: /(?:ندعوكم|يسرنا دعوتكم|انضم|احجز|سجل|التسجيل|كونوا معنا|نلتقيكم)/, weight: 8, reason: 'دعوة مباشرة' },
  ],
  information: [
    { pattern: /(?:معلومه|هل تعلم|تشير|يعرف|يعني|هو|هي)/, weight: 4, reason: 'صيغة تفسيرية' },
  ],
  statistic: [
    { pattern: /[0-9٠-٩]+\s*(?:٪|%|بالمئه|مليون|مليار|الف)/, weight: 9, reason: 'قيمة عددية' },
    /* حدود كلمات صريحة (صمام ملاحظة الصديق): مشتقات مثل «الرقمية/الرقمنة»
       ليست لغة إحصاء ولا يجوز أن توهم المصنف */
    { pattern: /(?:^|\s)(?:نسبه|احصائيه?|اضعاف|ثلث|ربع|نصف)(?:\s|$)/, weight: 6, reason: 'لغة إحصائية' },
  ],
  recommendation: [
    { pattern: /(?:انصح|نوصي|توصيه|يفضل|من الافضل|علينا|ينبغي|يجب)/, weight: 7, reason: 'توصية أو فعل مطلوب' },
  ],
  lecture: [
    { pattern: /(?:محاضره|ندوه|ملتقي|ورشه|جلسه حواريه)/, weight: 10, reason: 'نوع فعالية معرفية' },
  ],
  course: [
    { pattern: /(?:دوره|برنامج تدريبي|تدريب|محاور الدوره|شهاده حضور)/, weight: 10, reason: 'محتوى تدريبي' },
  ],
  consultation: [
    { pattern: /(?:استشاره|استشارات|احجز موعد|جلسه استشاريه|تواصل للحجز)/, weight: 10, reason: 'خدمة استشارية' },
  ],
  'media-appearance': [
    { pattern: /(?:لقاء|مقابله|استضافه|على شاشه|عبر اذاعه|بودكاست|برنامج تلفزيوني)/, weight: 9, reason: 'ظهور إعلامي' },
  ],
  book: [
    { pattern: /(?:كتاب|اصدار|مؤلف|الفصل|قراءه في)/, weight: 8, reason: 'محتوى كتاب' },
  ],
  research: [
    { pattern: /(?:بحث|دراسه|نتائج|منهج|عينه|مجله محكمه|ورقه علميه|باحث)/, weight: 8, reason: 'لغة بحثية' },
  ],
  article: [
    { pattern: /(?:مقال|اقرا المقال|في هذا المقال|الكاتب)/, weight: 8, reason: 'إشارة إلى مقال' },
  ],
  carousel: [
    { pattern: /(?:كاروسيل|شرائح|اسحب|سلسله|خطوات|نقاط)/, weight: 7, reason: 'بنية شرائحية' },
    { pattern: /(?:^|\n)\s*[-•–—]|(?:اولا|ثانيا|ثالثا)/, weight: 4, reason: 'تسلسل قابل للتقسيم' },
  ],
  'reel-cover': [
    { pattern: /(?:ريل|ستوري|قصه|غلاف حلقه|شاهد)/, weight: 8, reason: 'صيغة فيديو أو قصة' },
  ],
  'linkedin-post': [
    { pattern: /(?:لينكد.?ان|linkedin|قيادات|مهني)/, weight: 7, reason: 'سياق مهني' },
  ],
  'x-post': [
    { pattern: /(?:تغريده|منشور x|تويتر|twitter)/, weight: 8, reason: 'سياق X' },
  ],
  'impression-card': [
    { pattern: /(?:شعور|انطباع|تامل|لحظه|اثر|روح)/, weight: 5, reason: 'نبرة انطباعية' },
  ],
  'knowledge-design': [
    { pattern: /(?:مفهوم|نموذج|اطار|محاور|عناصر|ابعاد|معرف)/, weight: 6, reason: 'بنية معرفية' },
  ],
}

const TONE_SIGNALS: Record<ContentTone, readonly WeightedSignal[]> = {
  formal: [{ pattern: /(?:نود|يتم|وفقا|بناء على|يسرنا|الساده)/, weight: 5, reason: 'صياغة رسمية' }],
  institutional: [{ pattern: /(?:مؤسس|جامع|وزار|اداره|استراتيج|سياس|قياد)/, weight: 6, reason: 'سياق مؤسسي' }],
  luxury: [{ pattern: /(?:حصري|خاص|رفيع|فخم|نخب|مختار)/, weight: 4, reason: 'إشارة إلى الخصوصية والفخامة' }],
  human: [{ pattern: /(?:انسان|طفل|اسره|مشاعر|كرامه|تعاطف|قلب|علاقه)/, weight: 6, reason: 'مركز إنساني' }],
  inspiring: [{ pattern: /(?:امل|نستطيع|يمكننا|ابدأ|فرصه|يلهم|حلم|يصنع المستقبل)/, weight: 5, reason: 'لغة تحفيزية' }],
  deep: [{ pattern: /(?:معني|وعي|جوهر|لماذا|ما وراء|سؤال|فلسف|اثر)/, weight: 5, reason: 'فكرة تأملية' }],
  bold: [{ pattern: /(?:لن|لا يجب|خطا|خطر|يفشل|سرق|نرفض|حقيقه|ليس.+بل)/, weight: 6, reason: 'موقف حاسم' }],
  calm: [{ pattern: /(?:بهدوء|تامل|مساحه|رفق|قليل|خطوه|توازن)/, weight: 5, reason: 'إيقاع هادئ' }],
  academic: [{ pattern: /(?:بحث|دراسه|نتائج|منهج|عينه|تحليل|اكاديمي|تعلم)/, weight: 7, reason: 'لغة أكاديمية' }],
  media: [{ pattern: /(?:لقاء|اعلام|خبر|برنامج|بودكاست|حلقه|مباشر)/, weight: 7, reason: 'سياق إعلامي' }],
  promotional: [{ pattern: /(?:سجل|احجز|انضم|الان|مقاعد|عرض|متاح|التسجيل)/, weight: 7, reason: 'دعوة ترويجية' }],
  intellectual: [{ pattern: /(?:فكره|سؤال|معرفه|وعي|نقد|نقيس|نفهم|مفهوم)/, weight: 6, reason: 'طرح فكري' }],
}

const TOPIC_SIGNALS: Record<ContentTopic, readonly WeightedSignal[]> = {
  ai: [{ pattern: /(?:ذكاء اصطناعي|خوارزم|تقني|تكنولوجيا|روبوت|نماذج لغويه|بيانات)/, weight: 7, reason: 'مصطلحات تقنية' }],
  education: [{ pattern: /(?:تعليم|تعلم|معلم|طالب|مدرس|صف|تقويم|تقييم|منهج|تربوي)/, weight: 7, reason: 'مصطلحات تعليمية' }],
  family: [{ pattern: /(?:طفل|اطفال|اسره|والد|اموم|مراهق|تربيه منزليه)/, weight: 7, reason: 'مصطلحات أسرية' }],
  research: [{ pattern: /(?:بحث|دراسه|منهج|عينه|نتائج|احصائ|اكاديمي|جامع)/, weight: 7, reason: 'مصطلحات بحثية' }],
  media: [{ pattern: /(?:اعلام|خبر|مقابله|بودكاست|تلفزيون|منصات اجتماعيه|محتوي)/, weight: 7, reason: 'مصطلحات إعلامية' }],
  leadership: [{ pattern: /(?:قياد|مستقبل|استراتيج|قرار|تحول|ابتكار|رياد)/, weight: 7, reason: 'مصطلحات قيادة ومستقبل' }],
  human: [{ pattern: /(?:انسان|كرامه|قيم|اخلاق|وعي|روح|تعاطف|هويه)/, weight: 7, reason: 'مصطلحات إنسانية' }],
  book: [{ pattern: /(?:كتاب|قراءه|مؤلف|اصدار|فصل)/, weight: 7, reason: 'مصطلحات كتب' }],
  general: [],
}

const ARABIC_STOP_WORDS = new Set([
  'في', 'من', 'الى', 'علي', 'عن', 'ما', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'تلك', 'ان', 'كان', 'كانت', 'يكون', 'تكون', 'مع', 'او', 'ثم', 'بل', 'لكن', 'لا', 'لم', 'لن', 'كل', 'بين', 'بعد', 'قبل', 'عند', 'الذي', 'التي', 'الذين', 'كيف', 'لماذا', 'هل', 'نحن', 'انا', 'انت', 'هم', 'كما', 'قد', 'فقط', 'دون', 'حول', 'خلال', 'عبر', 'عندما', 'لدي', 'لها', 'له', 'بها', 'به', 'اذا', 'اي', 'ايضا',
])

const DEFAULT_LOCKS: DesignLocks = { content: false, style: false, color: false, format: false }

const normalizeWhitespace = (value: string) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\t\u00A0]+/g, ' ')
  .replace(/ {2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

export const normalizeArabicForDesign = (value: string) => normalizeWhitespace(value)
  .toLocaleLowerCase('ar')
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[“”]/g, '"')
  .replace(/[،؛]/g, (mark) => mark === '،' ? ',' : ';')

const wordsOf = (value: string) => normalizeWhitespace(value).match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) || []

const splitSentences = (value: string) => {
  const clean = normalizeWhitespace(value)
  if (!clean) return []
  const parts = clean
    .split(/(?<=[.!؟?؛;:])\s+|\n+/u)
    .map((part) => part.replace(/^[-•–—]\s*/, '').trim())
    .filter(Boolean)
  return parts.length ? parts : [clean]
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

const roundScore = (value: number) => Math.round(clamp(value, 0, 100))

const hashString = (value: string) => {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const hashHex = (value: string) => hashString(value).toString(16).padStart(8, '0')

const seededOrder = <T,>(items: readonly T[], seed: string, discriminator = '') => [...items]
  .map((item, index) => ({ item, index, weight: hashString(`${seed}:${discriminator}:${index}:${String(item)}`) }))
  .sort((left, right) => left.weight - right.weight || left.index - right.index)
  .map(({ item }) => item)

const truncateWords = (value: string, maximum: number) => {
  const words = normalizeWhitespace(value).split(/\s+/).filter(Boolean)
  if (words.length <= maximum) return value.trim()
  return `${words.slice(0, maximum).join(' ').replace(/[،؛:,.!?؟]+$/u, '')}…`
}

const chooseFirst = <T extends string>(values: readonly T[], seed: string, discriminator: string): T => {
  if (!values.length) throw new Error(`مكتبة التصميم فارغة: ${discriminator}`)
  return values[hashString(`${seed}:${discriminator}`) % values.length]
}

const signalScores = <T extends string>(text: string, rules: Record<T, readonly WeightedSignal[]>, fallback: T) => {
  const entries = (Object.entries(rules) as [T, readonly WeightedSignal[]][]).map(([id, signals]) => {
    const reasons: string[] = []
    let score = 0
    for (const signal of signals) {
      if (signal.pattern.test(text)) {
        score += signal.weight
        reasons.push(signal.reason)
      }
    }
    return { id, score, confidence: 0, reasons }
  })
  const maximum = Math.max(...entries.map((entry) => entry.score), 0)
  if (maximum === 0) {
    const fallbackEntry = entries.find((entry) => entry.id === fallback)
    if (fallbackEntry) {
      fallbackEntry.score = 1
      fallbackEntry.reasons = ['اختيار افتراضي محافظ']
    }
  }
  const adjustedMaximum = Math.max(...entries.map((entry) => entry.score), 1)
  return entries
    .map((entry) => ({ ...entry, confidence: roundScore((entry.score / adjustedMaximum) * 100) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
}

const textMetrics = (text: string): TextMetrics => {
  const words = wordsOf(text)
  const paragraphs = text.split(/\n{2,}|\n/).map((part) => part.trim()).filter(Boolean)
  const sentences = splitSentences(text)
  const normalized = normalizeArabicForDesign(text)
  return {
    characters: [...text].length,
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    bullets: (text.match(/(?:^|\n)\s*(?:[-•–—]|[0-9٠-٩]+[.)-])/g) || []).length,
    hasQuestion: /[؟?]/.test(text) || /^(?:هل|لماذا|كيف|متي|اين|ماذا|ما الذي)(?:\s|$)/.test(normalized),
    hasNumber: /[0-9٠-٩]/.test(text),
    hasExplicitCta: /(?:سجل|احجز|انضم|اقرا|شاهد|تواصل|شارك|اكتشف|تابع|حمل)/.test(normalized),
    isShort: words.length <= 18,
    isLong: words.length >= 72 || sentences.length >= 6 || paragraphs.length >= 4,
  }
}

const extractKeywords = (text: string, limit = 8) => {
  const frequency = new Map<string, { display: string; count: number; first: number }>()
  wordsOf(text).forEach((display, index) => {
    const key = normalizeArabicForDesign(display).replace(/[^\p{L}\p{N}]/gu, '')
    if (key.length < 3 || ARABIC_STOP_WORDS.has(key)) return
    const current = frequency.get(key)
    frequency.set(key, current ? { ...current, count: current.count + 1 } : { display, count: 1, first: index })
  })
  return [...frequency.entries()]
    .sort(([, left], [, right]) => {
      const leftScore = left.count * 12 + Math.min(left.display.length, 10) - left.first * 0.015
      const rightScore = right.count * 12 + Math.min(right.display.length, 10) - right.first * 0.015
      return rightScore - leftScore
    })
    .slice(0, limit)
    .map(([, entry]) => entry.display)
}

const titleCandidate = (text: string, sentences: readonly string[]) => {
  const firstLine = text.split('\n').map((part) => part.trim()).find(Boolean) || ''
  if (wordsOf(firstLine).length >= 3 && wordsOf(firstLine).length <= 16) return firstLine.replace(/[.:؛]+$/u, '')
  const candidates = sentences
    .map((sentence, index) => ({
      sentence,
      score: (/[؟?]/.test(sentence) ? 10 : 0)
        + (/(?:لا.+بل|ليس.+بل)/.test(normalizeArabicForDesign(sentence)) ? 8 : 0)
        + (wordsOf(sentence).length >= 5 && wordsOf(sentence).length <= 18 ? 7 : 0)
        - index * 0.25,
    }))
    .sort((left, right) => right.score - left.score)
  return truncateWords(candidates[0]?.sentence || text, 18).replace(/[.:؛]+$/u, '')
}

const explicitQuote = (text: string) => {
  const match = text.match(/[«“"]([^»”"]{12,260})[»”"]/u)
  return match?.[1]?.trim() || ''
}

const explicitCta = (sentences: readonly string[]) => sentences.find((sentence) => /(?:سجل|احجز|انضم|اقرا|شاهد|تواصل|شارك|اكتشف|تابع|حمل)/.test(normalizeArabicForDesign(sentence))) || ''

const fallbackCta = (kind: ContentKind) => {
  if (['course', 'lecture', 'invitation', 'announcement'].includes(kind)) return 'اطّلع على التفاصيل'
  if (kind === 'consultation') return 'احجز موعدك'
  if (kind === 'article' || kind === 'research' || kind === 'book') return 'اقرأ المادة كاملة'
  if (kind === 'media-appearance' || kind === 'reel-cover') return 'شاهد اللقاء'
  return ''
}

const slideRole = (sentence: string, index: number, total: number, kind: ContentKind): SlideRole => {
  if (index === 0) return 'cover'
  if (index === total - 1 && /(?:سجل|احجز|انضم|اقرا|شاهد|تواصل|شارك|اكتشف|تابع)/.test(normalizeArabicForDesign(sentence))) return 'action'
  if (index === total - 1) return 'closing'
  if (/[؟?]/.test(sentence)) return 'question'
  if (/[0-9٠-٩]|٪|%/.test(sentence) || kind === 'research' || kind === 'statistic') return 'evidence'
  return index === 1 ? 'context' : 'insight'
}

/** بنود مرقّمة صراحةً (أولاً/ثانياً/…): حدودها هي حدود الشرائح — لا قصّ في منتصف بند. */
const ORDINAL_MARKER = /(?:أولاً|اولاً|أولا|اولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)/u

function splitByOrdinals(text: string) {
  const segments = text.split(new RegExp(`(?=(?:^|\\s)${ORDINAL_MARKER.source}\\s*[:：ـ-])`, 'u'))
    .map((part) => part.trim())
    .filter(Boolean)
  // مقدمة + بندان فأكثر، وإلا فلا معنى للتقسيم البنودي
  return segments.length >= 3 ? segments : null
}

const stripOrdinalPrefix = (value: string) => value.replace(new RegExp(`^\\s*${ORDINAL_MARKER.source}\\s*[:：ـ-]\\s*`, 'u'), '').trim() || value

export function segmentTextForCarousel(
  input: string,
  options: { minimumSlides?: number; maximumSlides?: number; targetWordsPerSlide?: number; kind?: ContentKind } = {},
): CarouselSlide[] {
  const text = normalizeWhitespace(input)
  if (!text) return []
  const minimumSlides = clamp(Math.round(options.minimumSlides ?? 3), 2, 10)
  const maximumSlides = clamp(Math.round(options.maximumSlides ?? 8), minimumSlides, 12)
  const target = clamp(Math.round(options.targetWordsPerSlide ?? 34), 16, 64)
  const kind = options.kind || 'core-idea'
  const ordinalChunks = splitByOrdinals(text)
  if (ordinalChunks) {
    // كل بند شريحة كما كتبه صاحبه؛ ودعوة ختامية ملتصقة بآخر بند تستقل بشريحتها.
    const expanded = [...ordinalChunks]
    const last = expanded[expanded.length - 1]
    const lastSentences = splitSentences(last)
    if (lastSentences.length > 1 && /(?:سجل|احجز|انضم|اقرا|شاهد|تواصل|شارك|اكتشف|تابع|حمل)/.test(normalizeArabicForDesign(lastSentences[lastSentences.length - 1]))) {
      expanded[expanded.length - 1] = lastSentences.slice(0, -1).join(' ')
      expanded.push(lastSentences[lastSentences.length - 1])
    }
    const limited = expanded.slice(0, maximumSlides)
    if (limited.length < expanded.length) limited[limited.length - 1] = expanded.slice(limited.length - 1).join(' ')
    return limited.map((chunk, index) => {
      const display = stripOrdinalPrefix(chunk)
      const role = slideRole(chunk, index, limited.length, kind)
      const title = truncateWords(display, role === 'cover' ? 13 : 10)
      const remaining = display.startsWith(title.replace(/…$/u, '')) && wordsOf(display).length > wordsOf(title).length
        ? display.slice(title.replace(/…$/u, '').length).trim().replace(/^[،؛:,.!?؟]+\s*/u, '')
        : ''
      return {
        id: `slide-${index + 1}-${hashHex(chunk)}`,
        index: index + 1,
        role,
        kicker: role === 'cover' ? KIND_LABELS[kind] : `${index + 1} / ${limited.length}`,
        title,
        body: remaining,
        sourceText: chunk,
      }
    })
  }
  const sourceSentences = splitSentences(text)
  const chunks: string[] = []
  let active: string[] = []
  let activeWords = 0
  const flush = () => {
    if (!active.length) return
    chunks.push(active.join(' ').trim())
    active = []
    activeWords = 0
  }
  for (const sentence of sourceSentences) {
    const sentenceWords = wordsOf(sentence)
    if (sentenceWords.length > target * 1.45) {
      flush()
      const clauses = sentence.split(/(?<=[،؛,:])\s*/u).map((part) => part.trim()).filter(Boolean)
      if (clauses.length > 1) {
        for (const clause of clauses) {
          const clauseWords = wordsOf(clause).length
          if (activeWords && activeWords + clauseWords > target * 1.2) flush()
          active.push(clause)
          activeWords += clauseWords
        }
        flush()
      } else {
        const tokens = sentence.split(/\s+/)
        for (let start = 0; start < tokens.length; start += target) chunks.push(tokens.slice(start, start + target).join(' '))
      }
      continue
    }
    if (activeWords && activeWords + sentenceWords.length > target * 1.2) flush()
    active.push(sentence)
    activeWords += sentenceWords.length
  }
  flush()

  while (chunks.length < minimumSlides) {
    const splitIndex = chunks.reduce((best, chunk, index, all) => wordsOf(chunk).length > wordsOf(all[best] || '').length ? index : best, 0)
    const tokens = chunks[splitIndex]?.split(/\s+/) || []
    if (tokens.length < 10) break
    const midpoint = Math.ceil(tokens.length / 2)
    chunks.splice(splitIndex, 1, tokens.slice(0, midpoint).join(' '), tokens.slice(midpoint).join(' '))
  }
  while (chunks.length > maximumSlides) {
    const tail = chunks.pop()
    if (!tail) break
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${tail}`.trim()
  }

  return chunks.map((chunk, index) => {
    const role = slideRole(chunk, index, chunks.length, kind)
    const title = truncateWords(chunk, role === 'cover' ? 13 : 10)
    const remaining = chunk.startsWith(title.replace(/…$/u, '')) && wordsOf(chunk).length > wordsOf(title).length
      ? chunk.slice(title.replace(/…$/u, '').length).trim().replace(/^[،؛:,.!?؟]+\s*/u, '')
      : ''
    return {
      id: `slide-${index + 1}-${hashHex(chunk)}`,
      index: index + 1,
      role,
      kicker: role === 'cover' ? KIND_LABELS[kind] : `${index + 1} / ${chunks.length}`,
      title,
      body: remaining,
      sourceText: chunk,
    }
  })
}

const topicFor = (normalized: string): ContentTopic => {
  const ranked = signalScores<ContentTopic>(normalized, TOPIC_SIGNALS, 'general')
  return ranked[0]?.id || 'general'
}

const densityFor = (metrics: TextMetrics, kind: ContentKind): DesignDensity => {
  if (metrics.isShort && !['course', 'lecture', 'announcement'].includes(kind)) return 'minimal'
  if (metrics.isLong || metrics.bullets >= 3 || ['research', 'course', 'knowledge-design', 'carousel'].includes(kind)) return 'rich'
  return 'balanced'
}

const recommendedFormats = (kind: ContentKind, tone: ContentTone, metrics: TextMetrics): FormatRecommendation[] => {
  const scores = new Map<SocialFormatId, { score: number; reasons: string[] }>()
  const add = (format: SocialFormatId, score: number, reason: string) => {
    const current = scores.get(format) || { score: 0, reasons: [] }
    current.score += score
    current.reasons.push(reason)
    scores.set(format, current)
  }
  add('instagram-portrait', 30, 'مقاس اجتماعي متوازن افتراضياً')
  if (metrics.isShort) {
    add('instagram-square', 45, 'الجملة القصيرة تحتمل حضوراً نُصبياً')
    add('x-landscape', 34, 'سريع وواضح في X')
  }
  if (metrics.isLong || metrics.bullets >= 2 || ['summary', 'carousel', 'research'].includes(kind)) {
    add('instagram-carousel', 72, 'النص يحتاج تدرجاً بين شرائح')
    add('linkedin-square', 48, 'مناسب للشرح المهني')
  }
  if (['announcement', 'lecture', 'course', 'invitation', 'consultation'].includes(kind)) {
    add('story', 62, 'الفعالية تحتاج نسخة عمودية سريعة')
    add('instagram-portrait', 54, 'يستوعب العنوان والتفاصيل والدعوة')
    add('linkedin-landscape', 42, 'نسخة مؤسسية للمشاركة')
  }
  if (['media-appearance', 'reel-cover'].includes(kind)) {
    add('reel-cover', 70, 'غلاف عمودي للحلقة أو المقطع')
    add('video-thumbnail', 58, 'غلاف أفقي للفيديو')
  }
  if (['article', 'research', 'book', 'linkedin-post'].includes(kind) || ['academic', 'institutional'].includes(tone)) {
    add('linkedin-landscape', 52, 'وضوح معرفي ومؤسسي')
    add('widescreen-cover', 32, 'غلاف للمادة أو العرض')
  }
  if (kind === 'provocative-question' || kind === 'quote') {
    add('instagram-square', 62, 'مساحة مركزة للسؤال أو الاقتباس')
    add('story', 38, 'نسخة لحظية سهلة المشاركة')
  }
  return [...scores.entries()]
    .map(([format, value]) => ({ format, score: roundScore(value.score), reason: value.reasons.join('؛ ') }))
    .sort((left, right) => right.score - left.score || left.format.localeCompare(right.format))
    .slice(0, 5)
}

const smartSuggestions = (kind: ContentKind, tone: ContentTone, metrics: TextMetrics, structure: ParsedContentStructure): SmartSuggestion[] => {
  const suggestions: SmartSuggestion[] = []
  if (wordsOf(structure.title).length > 15) suggestions.push({ id: 'shorten', label: 'اختصر العنوان بصرياً', reason: 'العنوان أطول من مجال القراءة السريعة على الهاتف.', priority: 92 })
  if (metrics.isLong || metrics.bullets >= 2) suggestions.push({ id: 'carousel', label: 'وسّعها إلى كاروسيل', reason: `البنية تحمل ${metrics.sentences} وحدات معنى يمكن توزيعها بهدوء.`, priority: 96 })
  if (metrics.isShort && structure.heroWord) suggestions.push({ id: 'hero-word', label: `اجعل «${structure.heroWord}» كلمة بطلة`, reason: 'الفكرة قصيرة وقوية وتتحمل تكويناً قليل العناصر.', priority: 88 })
  if (['lecture', 'course', 'announcement', 'media-appearance'].includes(kind)) suggestions.push({ id: 'story', label: 'أنشئ نسخة Story', reason: 'صيغة الحدث تستفيد من المقاس العمودي والدعوة الواضحة.', priority: 90 })
  if (['research', 'article', 'knowledge-design'].includes(kind)) suggestions.push({ id: 'linkedin', label: 'نسخة أقوى لـ LinkedIn', reason: 'المحتوى معرفي ويستفيد من هرمية مهنية.', priority: 83 })
  if (kind === 'provocative-question' || tone === 'bold') suggestions.push({ id: 'poster', label: 'نسخة ملصق فكري', reason: 'السؤال أو الموقف الحاسم يصلح عنواناً بصرياً كبيراً.', priority: 86 })
  if (!metrics.hasExplicitCta && ['lecture', 'course', 'announcement', 'consultation'].includes(kind)) suggestions.push({ id: 'cta', label: 'أضف دعوة واضحة', reason: 'المحتوى الدعائي يحتاج خطوة تالية محددة.', priority: 94 })
  if (tone === 'bold' || tone === 'promotional') suggestions.push({ id: 'quiet-version', label: 'نسخة أكثر هدوءاً', reason: 'اتجاه هادئ موازٍ يمنع أن تكون كل النتائج صاخبة.', priority: 70 })
  return suggestions.sort((left, right) => right.priority - left.priority)
}

export function analyzeSocialContent(input: string, context = '', metadata: { author?: string; source?: string } = {}): SocialContentAnalysis {
  const text = normalizeWhitespace(input)
  if (!text) throw new Error('اكتب فكرة أو نصاً قبل تشغيل محرك التصميم.')
  const combined = normalizeWhitespace(`${text}\n${context}`)
  const normalized = normalizeArabicForDesign(combined)
  const metrics = textMetrics(text)
  // النص نفسه هو الحاكم في تحديد النوع؛ السياق مرجِّح بنصف الوزن فقط —
  // كي لا يقلب «من محاضرة عن كذا» اقتباساً صريحاً إلى إعلان محاضرة.
  const kindsFromText = signalScores<ContentKind>(normalizeArabicForDesign(text), KIND_SIGNALS, 'core-idea')
  const kindsFromContext = context.trim() ? signalScores<ContentKind>(normalizeArabicForDesign(context), KIND_SIGNALS, 'core-idea') : []
  const mergedKindScores = new Map<ContentKind, { score: number; reasons: string[] }>()
  for (const entry of kindsFromText) mergedKindScores.set(entry.id, { score: entry.score, reasons: [...entry.reasons] })
  for (const entry of kindsFromContext) {
    const current = mergedKindScores.get(entry.id) || { score: 0, reasons: [] }
    current.score += entry.score * 0.45
    for (const reason of entry.reasons) if (!current.reasons.includes(reason)) current.reasons.push(`${reason} (من السياق)`)
    mergedKindScores.set(entry.id, current)
  }
  const mergedMaximum = Math.max(...[...mergedKindScores.values()].map((entry) => entry.score), 1)
  const kinds = [...mergedKindScores.entries()]
    .map(([id, entry]) => ({ id, score: entry.score, confidence: roundScore((entry.score / mergedMaximum) * 100), reasons: entry.reasons }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
  let primaryKind: ContentKind = kinds[0]?.id || 'core-idea'
  // السؤال الصريح سلطة بنيوية أعلى، بينما أسماء الخدمات أعلى من «فكرة عامة».
  if (metrics.hasQuestion && !['lecture', 'course', 'consultation', 'media-appearance'].includes(primaryKind)) primaryKind = 'provocative-question'
  if (metrics.isLong && kinds.some((entry) => entry.id === 'carousel' && entry.score >= 4)) primaryKind = 'carousel'
  const tones = signalScores<ContentTone>(normalized, TONE_SIGNALS, 'intellectual')
  const primaryTone: ContentTone = tones[0]?.id || 'intellectual'
  const topic = topicFor(normalized)
  const sentences = splitSentences(text)
  const keywords = extractKeywords(text)
  const title = titleCandidate(text, sentences)
  const quote = explicitQuote(text) || (primaryKind === 'quote' ? truncateWords(sentences[0] || title, 34) : '')
  const keyPoint = [...sentences]
    .sort((left, right) => {
      const leftScore = (/[؟?]/.test(left) ? 5 : 0) + (/(?:لا.+بل|ليس.+بل)/.test(normalizeArabicForDesign(left)) ? 8 : 0) + Math.min(wordsOf(left).length, 24)
      const rightScore = (/[؟?]/.test(right) ? 5 : 0) + (/(?:لا.+بل|ليس.+بل)/.test(normalizeArabicForDesign(right)) ? 8 : 0) + Math.min(wordsOf(right).length, 24)
      return rightScore - leftScore
    })[0] || title
  // مقارنة بلا علامات ترقيم: «حديثة.» و«حديثة» جملة واحدة — كانت النقطة
  // الختامية تخدع الاختيار فيُعاد العنوان نفسه بوصفه جملة ثانية.
  const contentKey = (value: string) => normalizeArabicForDesign(value).replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
  const titleContentKey = contentKey(title)
  const subtitle = sentences.find((sentence) => {
    const key = contentKey(sentence)
    return key && key !== titleContentKey && wordsOf(sentence).length >= 3
  }) || ''
  const cta = explicitCta(sentences) || fallbackCta(primaryKind)
  const slides = segmentTextForCarousel(text, {
    minimumSlides: metrics.isLong ? 4 : 3,
    maximumSlides: metrics.words > 180 ? 8 : metrics.words > 90 ? 6 : 5,
    kind: primaryKind,
  })
  const structure: ParsedContentStructure = {
    original: text,
    title,
    subtitle: truncateWords(subtitle, 34),
    quote,
    keyPoint: truncateWords(keyPoint, 36),
    heroWord: keywords[0] || wordsOf(title)[0] || '',
    cta,
    author: metadata.author?.trim() || '',
    source: metadata.source?.trim() || '',
    category: TOPIC_LABELS[topic],
    keywords,
    slides,
  }
  const density = densityFor(metrics, primaryKind)
  const formats = recommendedFormats(primaryKind, primaryTone, metrics)
  const topKindConfidence = kinds.find((entry) => entry.id === primaryKind)?.confidence || 65
  const topToneConfidence = tones.find((entry) => entry.id === primaryTone)?.confidence || 60
  return {
    normalizedText: normalized,
    topic,
    primaryKind,
    kinds: kinds.slice(0, 5),
    primaryTone,
    tones: tones.slice(0, 4),
    density,
    metrics,
    structure,
    recommendedFormats: formats,
    suggestions: smartSuggestions(primaryKind, primaryTone, metrics, structure),
    confidence: roundScore((topKindConfidence * 0.58) + (topToneConfidence * 0.24) + (formats[0]?.score || 60) * 0.18),
  }
}

const TYPOGRAPHY_BY_BIAS: Record<LayoutFamily['textBias'], readonly TypographyModeId[]> = {
  title: ['display-monumental', 'cinematic-title', 'editorial-serif'],
  quote: ['quotation-signature', 'conversational', 'editorial-serif'],
  body: ['editorial-serif', 'rational-sans', 'academic-index'],
  data: ['number-led', 'academic-index', 'rational-sans'],
  sequence: ['academic-index', 'rational-sans', 'editorial-serif'],
  event: ['cinematic-title', 'rational-sans', 'display-monumental'],
}

const SPATIAL_BY_LAYOUT: Record<LayoutFamilyId, readonly SpatialPatternId[]> = {
  'editorial-axis': ['right-rail', 'asymmetric-air', 'open-corners'],
  'hero-word': ['centered-monument', 'asymmetric-air', 'low-horizon'],
  'quote-stage': ['asymmetric-air', 'centered-monument', 'open-corners'],
  'dual-thesis': ['split-balance', 'diagonal-flow', 'layered-depth'],
  'evidence-ledger': ['modular-grid', 'right-rail', 'topographic-stack'],
  'event-marquee': ['right-rail', 'diagonal-flow', 'modular-grid'],
  'knowledge-map': ['modular-grid', 'layered-depth', 'topographic-stack'],
  'quiet-orbit': ['centered-monument', 'low-horizon', 'asymmetric-air'],
  'chapter-stack': ['topographic-stack', 'right-rail', 'modular-grid'],
  'cinematic-window': ['low-horizon', 'open-corners', 'diagonal-flow'],
  'human-note': ['asymmetric-air', 'right-rail', 'layered-depth'],
  'modular-brief': ['modular-grid', 'right-rail', 'split-balance'],
}

const ACCENT_BY_LAYOUT: Record<LayoutFamilyId, readonly AccentStrategyId[]> = {
  'editorial-axis': ['single-rule', 'editorial-index', 'none'],
  'hero-word': ['hero-keyword', 'single-rule', 'none'],
  'quote-stage': ['quiet-seal', 'single-rule', 'paper-note'],
  'dual-thesis': ['contrast-band', 'single-rule', 'corner-signal'],
  'evidence-ledger': ['data-marker', 'editorial-index', 'single-rule'],
  'event-marquee': ['contrast-band', 'corner-signal', 'single-rule'],
  'knowledge-map': ['soft-orbit', 'data-marker', 'editorial-index'],
  'quiet-orbit': ['soft-orbit', 'hero-keyword', 'none'],
  'chapter-stack': ['editorial-index', 'single-rule', 'corner-signal'],
  'cinematic-window': ['contrast-band', 'corner-signal', 'none'],
  'human-note': ['paper-note', 'quiet-seal', 'single-rule'],
  'modular-brief': ['data-marker', 'corner-signal', 'editorial-index'],
}

const FRAME_BY_LAYOUT: Record<LayoutFamilyId, readonly FramingModeId[]> = {
  'editorial-axis': ['editorial-folio', 'open-canvas', 'hairline-inset'],
  'hero-word': ['open-canvas', 'full-bleed', 'corner-marks'],
  'quote-stage': ['floating-sheet', 'open-canvas', 'hairline-inset'],
  'dual-thesis': ['corner-marks', 'open-canvas', 'hairline-inset'],
  'evidence-ledger': ['hairline-inset', 'editorial-folio', 'corner-marks'],
  'event-marquee': ['full-bleed', 'cinematic-crop', 'hairline-inset'],
  'knowledge-map': ['corner-marks', 'hairline-inset', 'open-canvas'],
  'quiet-orbit': ['open-canvas', 'architectural-arch', 'full-bleed'],
  'chapter-stack': ['editorial-folio', 'corner-marks', 'hairline-inset'],
  'cinematic-window': ['cinematic-crop', 'full-bleed', 'open-canvas'],
  'human-note': ['floating-sheet', 'open-canvas', 'editorial-folio'],
  'modular-brief': ['hairline-inset', 'corner-marks', 'floating-sheet'],
}

const PALETTE_BY_TONE: Record<ContentTone, readonly PaletteId[]> = {
  formal: ['brand-paper', 'ink-white', 'scholar-blue', 'quiet-stone'],
  institutional: ['scholar-blue', 'brand-paper', 'brand-night', 'quiet-stone'],
  luxury: ['graphite-gold', 'signal-ivory', 'brand-night', 'warm-parchment'],
  human: ['warm-parchment', 'brand-paper', 'signal-ivory', 'quiet-stone'],
  inspiring: ['signal-ivory', 'scholar-blue', 'brand-night', 'brand-paper'],
  deep: ['brand-night', 'graphite-gold', 'warm-parchment', 'ink-white'],
  bold: ['brand-night', 'ink-white', 'graphite-gold', 'scholar-blue'],
  calm: ['quiet-stone', 'brand-paper', 'warm-parchment', 'ink-white'],
  academic: ['scholar-blue', 'ink-white', 'brand-paper', 'brand-night'],
  media: ['brand-night', 'scholar-blue', 'ink-white', 'graphite-gold'],
  promotional: ['brand-paper', 'brand-night', 'signal-ivory', 'scholar-blue'],
  intellectual: ['brand-paper', 'ink-white', 'brand-night', 'warm-parchment'],
}

const DIRECTION_LABELS: Record<LayoutFamilyId, string> = {
  'editorial-axis': 'تحريرية صافية', 'hero-word': 'كلمة تقود المشهد', 'quote-stage': 'اقتباس يتنفس', 'dual-thesis': 'مواجهة فكرية', 'evidence-ledger': 'الدليل أولاً', 'event-marquee': 'واجهة إعلامية', 'knowledge-map': 'خريطة المعنى', 'quiet-orbit': 'مدار هادئ', 'chapter-stack': 'فصول متتابعة', 'cinematic-window': 'غلاف سينمائي', 'human-note': 'صوت إنساني', 'modular-brief': 'ملخص مؤسسي',
}

const platformFormats = (platform: SocialPlatform) => (Object.values(SOCIAL_FORMATS) as SocialFormatSpec[]).filter((format) => format.platform === platform)

const resolveFormat = (request: SocialDesignRequest, analysis: SocialContentAnalysis): SocialFormatSpec => {
  if (request.format && request.format !== 'auto') return SOCIAL_FORMATS[request.format]
  if (request.platform && request.platform !== 'auto') {
    const candidates = platformFormats(request.platform)
    const recommendation = analysis.recommendedFormats.find((item) => candidates.some((format) => format.id === item.format))
    return SOCIAL_FORMATS[recommendation?.format || candidates[0]?.id || 'instagram-portrait']
  }
  return SOCIAL_FORMATS[analysis.recommendedFormats[0]?.format || 'instagram-portrait']
}

const layoutFitness = (layout: LayoutFamily, analysis: SocialContentAnalysis, density: DesignDensity, format: SocialFormatSpec) => {
  let score = 42
  if (layout.idealKinds.includes(analysis.primaryKind)) score += 25
  if (analysis.kinds.slice(0, 3).some((kind) => layout.idealKinds.includes(kind.id))) score += 8
  if (layout.idealTones.includes(analysis.primaryTone)) score += 16
  if (layout.preferredDensities.includes(density)) score += 9
  if (format.supportsCarousel && layout.textBias === 'sequence') score += 8
  if (format.height / format.width > 1.5 && ['event', 'sequence'].includes(layout.textBias)) score += 5
  if (format.width / format.height > 1.6 && ['title', 'event'].includes(layout.textBias)) score += 5
  if (analysis.metrics.isShort && ['title', 'quote'].includes(layout.textBias)) score += 6
  if (analysis.metrics.isLong && ['sequence', 'body'].includes(layout.textBias)) score += 6
  return roundScore(score)
}

const ctaPlacementFor = (analysis: SocialContentAnalysis, format: SocialFormatSpec, layout: LayoutFamilyId, seed: string): CtaPlacementId => {
  if (!analysis.structure.cta) return 'none'
  if (format.supportsCarousel) return 'closing-slide'
  if (['event-marquee', 'cinematic-window'].includes(layout)) return chooseFirst(['under-title', 'lower-rail', 'edge-tab'], seed, `cta:${layout}`)
  return chooseFirst(['footer-inline', 'lower-rail', 'edge-tab'], seed, `cta:${layout}`)
}

const geometryFor = (format: SocialFormatSpec, spatialId: SpatialPatternId, typographyId: TypographyModeId, layout: LayoutFamily) => {
  const spatial = SPATIAL_PATTERNS[spatialId]
  const typography = TYPOGRAPHY_MODES[typographyId]
  const landscape = format.width / format.height > 1.35
  const tall = format.height / format.width > 1.5
  const titleY = clamp(spatial.titleY + (landscape ? -0.035 : tall ? 0.025 : 0), format.safeInset, 0.72)
  const bodyY = clamp(spatial.bodyY + (landscape ? -0.04 : tall ? 0.035 : 0), titleY + 0.17, 0.86)
  return {
    safeInset: format.safeInset,
    columns: spatial.columns,
    titleZone: { x: spatial.titleX, y: titleY, width: spatial.titleWidth, maxLines: typography.maxLines },
    bodyZone: { x: spatial.bodyX, y: bodyY, width: spatial.bodyWidth, maxLines: tall ? 7 : landscape ? 3 : 5 },
    visualWeight: layout.textBias === 'event' ? 'top' : layout.textBias === 'sequence' ? 'distributed' : spatial.titleY > 0.28 ? 'center' : 'top',
    decorationBudget: layout.decorationBudget,
  } satisfies PlanGeometry
}

const contentForPlan = (analysis: SocialContentAnalysis, format: SocialFormatSpec, layout: LayoutFamily): PlanContent => {
  const structure = analysis.structure
  const titleLimit = Math.max(7, Math.round(format.maxTitleWords * (layout.textBias === 'title' ? 0.72 : 1)))
  const bodyLimit = Math.max(12, Math.round(format.maxBodyWords * (layout.textBias === 'body' ? 1 : 0.75)))
  const title = truncateWords(layout.textBias === 'quote' && structure.quote ? structure.quote : structure.title, titleLimit)
  // المتن لا يكرر العنوان أبداً: النص القصير يترك العنوان وحيداً بدل عرض الجملة مرتين.
  const titleKey = normalizeArabicForDesign(title.replace(/…$/u, ''))
  const distinct = (value: string) => {
    const key = normalizeArabicForDesign(String(value || '').replace(/…$/u, ''))
    return Boolean(key) && key !== titleKey && !(titleKey.length > 12 && (key.startsWith(titleKey) || titleKey.startsWith(key)))
  }
  const bodyCandidates = layout.textBias === 'data'
    ? [structure.keyPoint, structure.subtitle]
    : [structure.subtitle, structure.keyPoint]
  const sourceBody = bodyCandidates.find(distinct) || ''
  const body = truncateWords(sourceBody, bodyLimit)
  const included = Math.min(analysis.metrics.words, wordsOf(title).length + wordsOf(body).length)
  // الشرائح تُرفق أيضاً حين تكون بنية النص تسلسلية صراحةً (أولاً/ثانياً أو نقاط)
  // لا فقط حين يفيض عدد الكلمات — كي لا يضيع كاروسيل حقيقي لمجرد أنه موجز.
  const carousel = format.supportsCarousel && (
    analysis.metrics.words > format.maxTitleWords + format.maxBodyWords
    || analysis.primaryKind === 'carousel'
    || analysis.metrics.bullets >= 2
  ) && structure.slides.length >= 2
  return {
    original: structure.original,
    kicker: KIND_LABELS[analysis.primaryKind],
    title,
    subtitle: distinct(structure.subtitle) ? truncateWords(structure.subtitle, Math.round(bodyLimit * 0.72)) : '',
    body,
    quote: truncateWords(structure.quote, bodyLimit),
    heroWord: structure.heroWord,
    cta: structure.cta,
    author: structure.author,
    source: structure.source,
    slides: carousel ? structure.slides : [],
    keywords: structure.keywords.slice(0, 6),
    omittedWordCount: Math.max(0, analysis.metrics.words - included),
    overflowStrategy: carousel ? 'carousel' : analysis.metrics.words > included ? 'trimmed-preview' : 'none',
  }
}

export const signatureOf = (plan: CompositionPlan): DesignSignature => ({
  layout: plan.layout,
  typography: plan.typography,
  spatial: plan.spatial,
  accent: plan.accent,
  framing: plan.framing,
  cta: plan.ctaPlacement,
  palette: plan.palette,
  format: plan.format.id,
})

const signatureString = (signature: DesignSignature) => [
  signature.layout, signature.typography, signature.spatial, signature.accent,
  signature.framing, signature.cta, signature.palette, signature.format,
].join('|')

export const fingerprintDesign = (signatureOrPlan: DesignSignature | CompositionPlan) => {
  const signature = 'version' in signatureOrPlan ? signatureOf(signatureOrPlan) : signatureOrPlan
  return `sd-${hashHex(signatureString(signature))}`
}

export const designHistoryEntry = (plan: CompositionPlan, generatedAt?: string): DesignHistoryEntry => ({
  fingerprint: plan.fingerprint,
  signature: signatureOf(plan),
  ...(generatedAt ? { generatedAt } : {}),
})

export function designSimilarity(left: DesignSignature | CompositionPlan, right: DesignSignature | CompositionPlan) {
  const a = 'version' in left ? signatureOf(left) : left
  const b = 'version' in right ? signatureOf(right) : right
  const weights: [keyof DesignSignature, number][] = [
    ['layout', 0.3], ['spatial', 0.2], ['typography', 0.15], ['framing', 0.1],
    ['accent', 0.08], ['palette', 0.08], ['format', 0.06], ['cta', 0.03],
  ]
  return Number(weights.reduce((score, [key, weight]) => score + (a[key] === b[key] ? weight : 0), 0).toFixed(4))
}

const normalizeHistory = (history: SocialDesignRequest['history']) => (history || []).map((entry) => 'version' in entry ? designHistoryEntry(entry) : entry)

const noveltyAgainst = (signature: DesignSignature, history: readonly DesignHistoryEntry[]) => history.length
  ? 1 - Math.max(...history.map((entry) => designSimilarity(signature, entry.signature)))
  : 1

const planId = (seed: string, index: number, signature: DesignSignature) => `social-${hashHex(`${seed}:${index}:${signatureString(signature)}`)}`

const planRationale = (analysis: SocialContentAnalysis, layout: LayoutFamily, format: SocialFormatSpec, novelty: number) => [
  `${KIND_LABELS[analysis.primaryKind]} بنبرة ${TONE_LABELS[analysis.primaryTone]}`,
  `${layout.label}: ${layout.description}`,
  `${format.label} هو الأقرب لبنية النص`,
  novelty < 0.35 ? 'أُبعدت عناصره الثانوية عن أقرب تكوين محفوظ' : 'تكوين بعيد عن السجل البصري القريب',
]

const makeCandidate = (
  layout: LayoutFamily,
  analysis: SocialContentAnalysis,
  format: SocialFormatSpec,
  density: DesignDensity,
  seed: string,
  variant: number,
  history: readonly DesignHistoryEntry[],
): CompositionPlan => {
  const typography = chooseFirst(TYPOGRAPHY_BY_BIAS[layout.textBias], seed, `${layout.id}:type:${variant}`)
  const spatial = chooseFirst(SPATIAL_BY_LAYOUT[layout.id], seed, `${layout.id}:space:${variant}`)
  const accent = chooseFirst(ACCENT_BY_LAYOUT[layout.id], seed, `${layout.id}:accent:${variant}`)
  const framing = chooseFirst(FRAME_BY_LAYOUT[layout.id], seed, `${layout.id}:frame:${variant}`)
  const palette = chooseFirst(PALETTE_BY_TONE[analysis.primaryTone], seed, `${layout.id}:palette:${variant}`)
  const ctaPlacement = ctaPlacementFor(analysis, format, layout.id, `${seed}:${variant}`)
  const signature: DesignSignature = { layout: layout.id, typography, spatial, accent, framing, cta: ctaPlacement, palette, format: format.id }
  const novelty = noveltyAgainst(signature, history)
  const fitness = layoutFitness(layout, analysis, density, format)
  const draft: CompositionPlan = {
    id: planId(seed, variant, signature),
    fingerprint: fingerprintDesign(signature),
    version: SOCIAL_DESIGN_ENGINE_VERSION,
    directionIndex: variant,
    directionLabel: DIRECTION_LABELS[layout.id],
    rationale: planRationale(analysis, layout, format, novelty),
    format,
    platform: format.platform,
    density,
    layout: layout.id,
    typography,
    spatial,
    accent,
    framing,
    ctaPlacement,
    palette,
    geometry: geometryFor(format, spatial, typography, layout),
    content: contentForPlan(analysis, format, layout),
    analysis: { topic: analysis.topic, primaryKind: analysis.primaryKind, primaryTone: analysis.primaryTone, confidence: analysis.confidence },
    fitness,
    novelty: Number(novelty.toFixed(4)),
    locksApplied: { ...DEFAULT_LOCKS },
  }
  return { ...draft, quality: critiqueCompositionPlan(draft) }
}

export function applyDesignLocks(base: CompositionPlan, candidate: CompositionPlan, requested: Partial<DesignLocks> = {}): CompositionPlan {
  const locks = { ...DEFAULT_LOCKS, ...requested }
  let result: CompositionPlan = { ...candidate, locksApplied: locks }
  if (locks.content) result = { ...result, content: base.content, analysis: base.analysis }
  if (locks.style) {
    result = {
      ...result,
      density: base.density,
      layout: base.layout,
      typography: base.typography,
      spatial: base.spatial,
      accent: base.accent,
      framing: base.framing,
      ctaPlacement: base.ctaPlacement,
      geometry: base.geometry,
      directionLabel: base.directionLabel,
    }
  }
  if (locks.color) result = { ...result, palette: base.palette }
  if (locks.format) result = { ...result, format: base.format, platform: base.platform }
  const signature = signatureOf(result)
  const locked = {
    ...result,
    id: `${candidate.id}-locked-${hashHex(signatureString(signature))}`,
    fingerprint: fingerprintDesign(signature),
  }
  return { ...locked, quality: critiqueCompositionPlan(locked) }
}

const selectDiverse = (
  candidates: readonly CompositionPlan[],
  count: number,
  history: readonly DesignHistoryEntry[],
  noveltyThreshold: number,
  tasteProfile?: DesignTasteProfile,
) => {
  const selected: CompositionPlan[] = []
  const remaining = [...candidates]
  while (selected.length < count && remaining.length) {
    let bestIndex = 0
    let bestScore = -Infinity
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index]
      const pairwiseNovelty = selected.length
        ? 1 - Math.max(...selected.map((plan) => designSimilarity(candidate, plan)))
        : 1
      const thresholdBonus = candidate.novelty >= noveltyThreshold ? 10 : 0
      const quality = candidate.quality || critiqueCompositionPlan(candidate, selected)
      const affinity = tasteAffinity(tasteProfile, candidate)
      const score = candidate.fitness * .34 + quality.score * .36 + candidate.novelty * 18 + pairwiseNovelty * 22 + thresholdBonus + affinity * 10
      if (score > bestScore) { bestScore = score; bestIndex = index }
    }
    const [picked] = remaining.splice(bestIndex, 1)
    if (!picked) break
    selected.push({ ...picked, directionIndex: selected.length + 1, tasteAffinity: tasteAffinity(tasteProfile, picked) })
    // التنوع البنيوي شرط، لا نسمح لنفس العائلة أن تتخفى بلون مختلف.
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (remaining[index].layout === picked.layout) remaining.splice(index, 1)
    }
  }
  return selected.map((plan) => {
    const novelty = Number(noveltyAgainst(signatureOf(plan), [...history, ...selected.filter((item) => item.id !== plan.id).map((item) => designHistoryEntry(item))]).toFixed(4))
    const enriched = { ...plan, novelty, tasteAffinity: tasteAffinity(tasteProfile, plan) }
    return { ...enriched, quality: critiqueCompositionPlan(enriched, selected) }
  })
}

const overrideAnalysis = (analysis: SocialContentAnalysis, request: SocialDesignRequest): SocialContentAnalysis => {
  const tone = request.tone && request.tone !== 'auto' ? request.tone : analysis.primaryTone
  const density = request.density && request.density !== 'auto' ? request.density : analysis.density
  return tone === analysis.primaryTone && density === analysis.density ? analysis : { ...analysis, primaryTone: tone, density }
}

export function generateSocialDesigns(request: SocialDesignRequest): SocialDesignResult {
  const analysis = overrideAnalysis(analyzeSocialContent(request.text, request.context, { author: request.author, source: request.source }), request)
  // لجنة الجودة تعمل دائمًا على ثمانية اتجاهات نهائية داخليًا، ولا تعرض إلا أقوى أربعة.
  const requestedCount = 8
  const visibleCount = 4
  const seed = String(request.seed ?? `${normalizeArabicForDesign(request.text)}:${analysis.primaryKind}:${analysis.primaryTone}`)
  const format = resolveFormat(request, analysis)
  const density = request.density && request.density !== 'auto' ? request.density : analysis.density
  const history = normalizeHistory(request.history)
  const noveltyThreshold = clamp(request.noveltyThreshold ?? 0.32, 0, 0.9)
  const locks = { ...DEFAULT_LOCKS, ...request.locks }
  const warnings: string[] = []
  if (Object.values(locks).some(Boolean) && !request.basePlan) warnings.push('طُلب قفل عناصر من دون تصميم أساس؛ أُهملت الأقفال لهذه الدفعة.')

  // الرغبة الصريحة سلطة: العائلة المطلوبة تتصدر الترتيب ويرتفع لياقة مرشحيها
  // بما يضمن حضورها في الأربعة المعروضة — من دون إلغاء التنويع حولها.
  const preferenceBoost = (layoutId: LayoutFamilyId) => request.preferLayout === layoutId ? 55 : 0
  const rankedLayouts = seededOrder(Object.values(LAYOUT_FAMILIES), seed, 'layout-order')
    .sort((left, right) => (layoutFitness(right, analysis, density, format) + preferenceBoost(right.id)) - (layoutFitness(left, analysis, density, format) + preferenceBoost(left.id)))
  const candidates: CompositionPlan[] = []
  for (const [layoutIndex, layout] of rankedLayouts.entries()) {
    for (let variant = 0; variant < 4; variant += 1) {
      const candidate = makeCandidate(layout, analysis, format, density, seed, layoutIndex * 7 + variant, history)
      const boosted = preferenceBoost(layout.id) ? { ...candidate, fitness: roundScore(candidate.fitness + preferenceBoost(layout.id)) } : candidate
      candidates.push(request.basePlan ? applyDesignLocks(request.basePlan, boosted, locks) : boosted)
    }
  }

  const critiqued = candidates.map((candidate) => ({ ...candidate, quality: critiqueCompositionPlan(candidate, candidates) }))
  const valid = critiqued.filter((candidate) => !candidate.quality?.issues.some((issue) => issue.startsWith('خطأ:')) && (candidate.quality?.score || 0) >= 68)
  const strong = valid.filter((candidate) => (candidate.quality?.score || 0) >= 76 && (candidate.quality?.lineFit || 0) >= 76)
  const candidatePool = strong.length >= requestedCount ? strong : valid.length ? valid : critiqued
  const finalists = selectDiverse(candidatePool, requestedCount, history, noveltyThreshold, request.tasteProfile)
  let plans = finalists
    .map((plan) => ({ ...plan, quality: critiqueCompositionPlan(plan, finalists), tasteAffinity: tasteAffinity(request.tasteProfile, plan) }))
    .sort((left, right) => ((right.quality?.score || 0) + (right.tasteAffinity || 0) * 8) - ((left.quality?.score || 0) + (left.tasteAffinity || 0) * 8))
    .slice(0, visibleCount)
  // وعد الزر يُنفَّذ حرفياً: إن طلب المستخدم عائلة بعينها ولم تصعد بجودتها،
  // نصعد أقوى مرشح منها إلى الصدارة بدل أن يضيع الطلب في فرز الجودة العام.
  if (request.preferLayout && !plans.some((plan) => plan.layout === request.preferLayout)) {
    const champion = [...finalists, ...candidatePool]
      .filter((plan) => plan.layout === request.preferLayout)
      .sort((left, right) => (right.quality?.score || 0) - (left.quality?.score || 0))[0]
    if (champion) {
      const enriched = { ...champion, quality: critiqueCompositionPlan(champion, finalists), tasteAffinity: tasteAffinity(request.tasteProfile, champion) }
      plans = [enriched, ...plans.filter((plan) => plan.fingerprint !== enriched.fingerprint)].slice(0, visibleCount)
    }
  }
  plans = plans.map((plan, index) => ({ ...plan, directionIndex: index + 1 }))
  if (plans.some((plan) => plan.novelty < noveltyThreshold)) warnings.push('السجل البصري كثيف؛ اختير أبعد تكوين ممكن مع المحافظة على ملاءمة النص.')
  if (finalists.length < requestedCount) warnings.push(`الأقفال الحالية سمحت بفحص ${finalists.length} اتجاهات متمايزة فقط قبل اختيار أقوى أربعة.`)
  return {
    analysis,
    plans,
    generation: { seed, requestedCount, producedCount: plans.length, historyCompared: history.length, noveltyThreshold, warnings, candidateCount: candidates.length, rejectedCount: candidates.length - candidatePool.length, averageQuality: plans.length ? Math.round(plans.reduce((sum, plan) => sum + (plan.quality?.score || 0), 0) / plans.length) : 0 },
  }
}

export function transformDesignFormat(
  plan: CompositionPlan,
  target: SocialFormatId,
  options: { locks?: Partial<DesignLocks>; respectFormatLock?: boolean; seed?: string | number } = {},
): CompositionPlan {
  const locks = { ...plan.locksApplied, ...options.locks }
  if ((options.respectFormatLock ?? true) && locks.format) return plan
  const format = SOCIAL_FORMATS[target]
  const seed = String(options.seed ?? `${plan.id}:${target}`)
  const landscape = format.width / format.height > 1.35
  const tall = format.height / format.width > 1.5
  const spatialCandidates: SpatialPatternId[] = landscape
    ? ['low-horizon', 'open-corners', 'split-balance', 'right-rail']
    : tall
      ? ['right-rail', 'topographic-stack', 'asymmetric-air', 'centered-monument']
      : ['asymmetric-air', 'centered-monument', 'modular-grid', 'right-rail']
  const spatial = locks.style ? plan.spatial : chooseFirst(spatialCandidates, seed, 'format-transform')
  const layout = LAYOUT_FAMILIES[plan.layout]
  const content: PlanContent = {
    ...plan.content,
    slides: format.supportsCarousel
      ? (plan.content.slides.length ? plan.content.slides : segmentTextForCarousel(plan.content.original, { kind: plan.analysis.primaryKind }))
      : [],
    overflowStrategy: format.supportsCarousel && wordsOf(plan.content.original).length > format.maxBodyWords ? 'carousel' : plan.content.overflowStrategy,
  }
  const transformed: CompositionPlan = {
    ...plan,
    id: `social-${hashHex(`${plan.id}:${target}:${seed}`)}`,
    format,
    platform: format.platform,
    spatial,
    geometry: geometryFor(format, spatial, plan.typography, layout),
    content,
    locksApplied: locks,
    rationale: [...plan.rationale.filter((line) => !line.includes(' هو الأقرب لبنية النص')), `حُوّل إلى ${format.label} مع إعادة حساب مناطق الأمان`],
  }
  const next = { ...transformed, fingerprint: fingerprintDesign(transformed) }
  return { ...next, quality: critiqueCompositionPlan(next), tasteAffinity: plan.tasteAffinity }
}

export function regenerateFromPlan(
  basePlan: CompositionPlan,
  options: Omit<SocialDesignRequest, 'text' | 'basePlan'> & { text?: string } = {},
) {
  return generateSocialDesigns({
    ...options,
    text: options.text || basePlan.content.original,
    basePlan,
    history: [...(options.history || []), designHistoryEntry(basePlan)],
  })
}

export function compositionCssVariables(plan: CompositionPlan): Record<string, string> {
  const palette = PALETTES[plan.palette]
  const typography = TYPOGRAPHY_MODES[plan.typography]
  const frame = FRAMING_MODES[plan.framing]
  return {
    '--social-width': `${plan.format.width}px`,
    '--social-height': `${plan.format.height}px`,
    '--social-safe': `${Math.round(plan.geometry.safeInset * 10000) / 100}%`,
    '--social-bg': palette.background,
    '--social-surface': palette.surface,
    '--social-ink': palette.ink,
    '--social-muted': palette.muted,
    '--social-accent': palette.accent,
    '--social-accent-soft': palette.accentSoft,
    '--social-rule': palette.rule,
    '--social-display-font': `"${typography.displayFamily}", "Tajawal", sans-serif`,
    '--social-body-font': `"${typography.bodyFamily}", sans-serif`,
    '--social-title-scale': String(typography.titleScale),
    '--social-title-leading': String(typography.lineHeight),
    '--social-frame-inset': `${frame.inset * 100}%`,
    '--social-frame-radius': `${frame.radius * 100}%`,
    '--social-title-x': `${plan.geometry.titleZone.x * 100}%`,
    '--social-title-y': `${plan.geometry.titleZone.y * 100}%`,
    '--social-title-w': `${plan.geometry.titleZone.width * 100}%`,
    '--social-body-x': `${plan.geometry.bodyZone.x * 100}%`,
    '--social-body-y': `${plan.geometry.bodyZone.y * 100}%`,
    '--social-body-w': `${plan.geometry.bodyZone.width * 100}%`,
  }
}


const estimateWrappedLineCount = (value: string, maxChars: number) => {
  const source = wordsOf(value)
  if (!source.length) return 0
  let lines = 1
  let current = 0
  for (const word of source) {
    const width = Math.max(1, [...word].length)
    if (current && current + 1 + width > maxChars) {
      lines += 1
      current = width
    } else current += (current ? 1 : 0) + width
  }
  return lines
}

export function compositionTextLayout(plan: CompositionPlan) {
  const landscape = plan.format.width / plan.format.height > 1.35
  const typography = TYPOGRAPHY_MODES[plan.typography]
  const normalizedTitleWidth = clamp(plan.geometry.titleZone.width / .72, .58, 1.24)
  const normalizedBodyWidth = clamp(plan.geometry.bodyZone.width / .72, .58, 1.24)
  const titleMaxChars = clamp(Math.round((landscape ? 27 : 20) * normalizedTitleWidth / Math.max(.78, typography.titleScale)), 10, 38)
  const bodyMaxChars = clamp(Math.round((landscape ? 46 : 32) * normalizedBodyWidth), 18, 58)
  const titleMaxLines = Math.max(1, typography.maxLines)
  const bodyMaxLines = plan.density === 'minimal' ? 2 : plan.density === 'rich' ? Math.min(6, plan.geometry.bodyZone.maxLines) : Math.min(4, plan.geometry.bodyZone.maxLines)
  const bodySource = plan.content.subtitle || plan.content.body || plan.content.quote
  return {
    titleMaxChars,
    bodyMaxChars,
    titleMaxLines,
    bodyMaxLines,
    estimatedTitleLines: estimateWrappedLineCount(plan.content.title, titleMaxChars),
    estimatedBodyLines: estimateWrappedLineCount(bodySource, bodyMaxChars),
  }
}


const tasteTraitsOf = (plan: CompositionPlan): Record<TasteTrait, string> => {
  const typography = TYPOGRAPHY_MODES[plan.typography]
  const palette = PALETTES[plan.palette]
  const whitespace = plan.quality?.whitespace ?? critiqueCompositionPlan(plan).whitespace
  return {
    titlePresence: typography.titleScale >= 1.08 ? 'large' : typography.titleScale <= .94 ? 'quiet' : 'balanced',
    surfaceMode: palette.isDark ? 'dark' : 'light',
    whitespaceMode: whitespace >= 88 ? 'airy' : whitespace < 72 ? 'dense' : 'balanced',
    identityPosition: plan.ctaPlacement === 'footer-inline' ? 'footer' : plan.ctaPlacement === 'none' ? 'minimal' : 'inline',
    designCharacter: ['editorial-axis', 'quote-stage', 'human-note', 'chapter-stack'].includes(plan.layout) ? 'editorial' : ['event-marquee', 'modular-brief', 'evidence-ledger'].includes(plan.layout) ? 'institutional' : 'expressive',
  }
}

export function createEmptyTasteProfile(): DesignTasteProfile {
  return { version: 1, samples: 0, positiveSamples: 0, negativeSamples: 0, weights: {}, traits: {} }
}

const signatureDimensions: (keyof DesignSignature)[] = ['layout', 'typography', 'spatial', 'accent', 'framing', 'cta', 'palette', 'format']

export function updateTasteProfile(profile: DesignTasteProfile | undefined, plan: CompositionPlan, signal: 1 | -1): DesignTasteProfile {
  const current = profile || createEmptyTasteProfile()
  const weights: DesignTasteProfile['weights'] = {}
  for (const dimension of signatureDimensions) weights[dimension] = { ...(current.weights[dimension] || {}) }
  const signature = signatureOf(plan)
  for (const dimension of signatureDimensions) {
    const value = String(signature[dimension])
    const dimensionWeights = weights[dimension] || (weights[dimension] = {})
    dimensionWeights[value] = clamp(Number(dimensionWeights[value] || 0) + signal * (dimension === 'layout' || dimension === 'spatial' ? 1.35 : 1), -12, 12)
  }
  const traits: NonNullable<DesignTasteProfile['traits']> = {}
  for (const [key, values] of Object.entries(current.traits || {})) traits[key as TasteTrait] = { ...(values || {}) }
  for (const [key, value] of Object.entries(tasteTraitsOf(plan)) as [TasteTrait, string][]) {
    const bucket = traits[key] || (traits[key] = {})
    bucket[value] = clamp(Number(bucket[value] || 0) + signal * 1.2, -12, 12)
  }
  return {
    version: 1,
    samples: current.samples + 1,
    positiveSamples: current.positiveSamples + (signal > 0 ? 1 : 0),
    negativeSamples: current.negativeSamples + (signal < 0 ? 1 : 0),
    updatedAt: new Date().toISOString(),
    weights,
    traits,
  }
}

export function tasteAffinity(profile: DesignTasteProfile | undefined, plan: CompositionPlan) {
  if (!profile?.samples) return .5
  const signature = signatureOf(plan)
  let weighted = 0
  let total = 0
  for (const dimension of signatureDimensions) {
    const importance = dimension === 'layout' ? 1.45 : dimension === 'spatial' ? 1.25 : dimension === 'typography' ? 1.1 : 1
    weighted += Number(profile.weights[dimension]?.[String(signature[dimension])] || 0) * importance
    total += 12 * importance
  }
  for (const [key, value] of Object.entries(tasteTraitsOf(plan)) as [TasteTrait, string][]) {
    weighted += Number(profile.traits?.[key]?.[value] || 0) * 1.15
    total += 12 * 1.15
  }
  return Number(clamp(.5 + weighted / Math.max(1, total) * .5, 0, 1).toFixed(4))
}

const qualityBand = (score: number): VisualQuality['band'] => score >= 96 ? 'exceptional' : score >= 90 ? 'excellent' : score >= 80 ? 'strong' : 'needs-work'
const boundedQuality = (value: number) => Math.round(clamp(value, 0, 100))
const contrastQuality = (ratio: number) => boundedQuality(ratio >= 7 ? 100 : ratio >= 4.5 ? 84 + (ratio - 4.5) / 2.5 * 15 : ratio >= 3 ? 56 + (ratio - 3) / 1.5 * 27 : ratio * 18)

export function critiqueCompositionPlan(plan: CompositionPlan, peers: readonly CompositionPlan[] = []): VisualQuality {
  const palette = PALETTES[plan.palette]
  const backgroundInkRatio = contrastRatio(palette.background, palette.ink)
  const surfaceInkRatio = contrastRatio(palette.surface, palette.ink)
  const backgroundMutedRatio = contrastRatio(palette.background, palette.muted)
  const surfaceMutedRatio = contrastRatio(palette.surface, palette.muted)
  const accentBackgroundRatio = contrastRatio(palette.background, palette.accent)
  const accentSurfaceRatio = contrastRatio(palette.surface, palette.accent)
  const mainContrastRatio = Math.min(backgroundInkRatio, surfaceInkRatio)
  const secondaryContrastRatio = Math.min(backgroundMutedRatio, surfaceMutedRatio)
  const accentContrastRatio = Math.min(accentBackgroundRatio, accentSurfaceRatio)
  const titleWords = wordsOf(plan.content.title).length
  const bodyWords = wordsOf(plan.content.body || plan.content.subtitle || plan.content.quote).length
  const titleLoad = titleWords / Math.max(1, plan.format.maxTitleWords)
  const bodyLoad = bodyWords / Math.max(1, plan.format.maxBodyWords)
  /* تصميم «العنوان وحده» خيار فني مشروع (ملاحظة الصديق): كان يُحاكم على متنٍ
     غير موجود فتهبط كثافته ظلماً — حمولته تُقاس على العنوان وحده بمثاليةٍ تليق به */
  const titleOnly = bodyWords === 0
  const textLoad = titleOnly ? titleLoad : titleLoad * .58 + bodyLoad * .42
  const lineLayout = compositionTextLayout(plan)
  const titleLineLoad = lineLayout.estimatedTitleLines / Math.max(1, lineLayout.titleMaxLines)
  const bodyLineLoad = lineLayout.estimatedBodyLines / Math.max(1, lineLayout.bodyMaxLines)
  const zones = [plan.geometry.titleZone, plan.geometry.bodyZone]
  const safe = zones.every((zone) => zone.x >= 0 && zone.y >= 0 && zone.x + zone.width <= 1.001 && zone.y + Math.min(.32, zone.maxLines * .055) <= .95)
  const duplicate = peers.some((peer) => peer.id !== plan.id && designSimilarity(plan, peer) >= .82)
  const issues: string[] = []
  const strengths: string[] = []
  const textContrast = contrastQuality(Math.min(mainContrastRatio, secondaryContrastRatio))
  const backgroundContrast = contrastQuality(Math.min(mainContrastRatio, accentContrastRatio))
  const contrast = boundedQuality(textContrast * .72 + backgroundContrast * .28)
  const readability = boundedQuality(100 - Math.max(0, titleLoad - .70) * 58 - Math.max(0, bodyLoad - .74) * 48 - Math.max(0, 86 - textContrast) * .42 - (safe ? 0 : 48))
  const hierarchy = boundedQuality(72 + (plan.content.heroWord ? 8 : 0) + (titleWords <= 12 ? 10 : titleWords <= 17 ? 5 : 0) + (plan.content.kicker ? 4 : 0) - (titleWords > 21 ? 20 : 0) - (bodyLoad > .92 ? 8 : 0))
  const idealLoad = titleOnly
    ? (plan.density === 'minimal' ? .3 : .48)
    : plan.density === 'minimal' ? .34 : plan.density === 'rich' ? .68 : .51
  const density = boundedQuality(100 - Math.abs(textLoad - idealLoad) * 118 - Math.max(0, plan.geometry.decorationBudget - (plan.density === 'rich' ? 2 : 1)) * 7)
  const whitespace = boundedQuality(density * .72 + (100 - plan.geometry.decorationBudget * 10) * .28)
  const fit = boundedQuality(100 - Math.max(0, titleLoad - 1) * 78 - Math.max(0, bodyLoad - 1) * 72 - (plan.content.overflowStrategy === 'trimmed-preview' ? 9 : 0))
  const lineFit = boundedQuality(100 - Math.max(0, titleLineLoad - 1) * 90 - Math.max(0, bodyLineLoad - 1) * 80)
  const originality = boundedQuality(plan.novelty * 100 - (duplicate ? 30 : 0))
  const platformFit = boundedQuality(76 + (plan.format.platform === plan.platform ? 13 : 0) + (plan.format.supportsCarousel && plan.content.slides.length > 1 ? 8 : 0) - (plan.format.id === 'reel-cover' && bodyWords > 18 ? 18 : 0))
  const titleRight = plan.geometry.titleZone.x + plan.geometry.titleZone.width
  const bodyRight = plan.geometry.bodyZone.x + plan.geometry.bodyZone.width
  const rtlAlignment = boundedQuality(100 - Math.abs(titleRight - bodyRight) * 220 - Math.abs(plan.geometry.titleZone.x - plan.geometry.bodyZone.x) * 45)
  const titleCenter = plan.geometry.titleZone.y + Math.min(.22, plan.geometry.titleZone.maxLines * .035)
  const bodyCenter = plan.geometry.bodyZone.y + Math.min(.30, plan.geometry.bodyZone.maxLines * .035)
  const occupiedCenter = titleCenter * .58 + bodyCenter * .42
  const targetCenter = plan.geometry.visualWeight === 'top' ? .30 : plan.geometry.visualWeight === 'bottom' ? .66 : plan.geometry.visualWeight === 'center' ? .48 : .50
  const visualWeight = boundedQuality(100 - Math.abs(occupiedCenter - targetCenter) * 185 - Math.max(0, Math.abs(plan.geometry.titleZone.width - plan.geometry.bodyZone.width) - .34) * 45)
  if (!safe) issues.push('خطأ: عنصر نصي خارج منطقة الأمان.')
  if (textContrast < 82) issues.push('تباين النصوص الأساسية أو الثانوية ضعيف فعلياً.')
  if (backgroundContrast < 78) issues.push('الفصل بين العناصر والخلفية غير كافٍ.')
  if (readability < 78) issues.push('القراءة على الهاتف تحتاج تخفيفاً أو تكبيراً.')
  if (density < 76) issues.push('كثافة العناصر لا تناسب المساحة المتاحة.')
  if (whitespace < 76) issues.push('نسبة البياض والمسافات غير متوازنة.')
  if (visualWeight < 76) issues.push('الوزن البصري لا ينسجم مع موضع العناصر الرئيسي.')
  if (rtlAlignment < 82) issues.push('محاذاة RTL بين كتل النص غير دقيقة.')
  if (hierarchy < 80) issues.push('التسلسل البصري لا يبرز العنصر الرئيسي بوضوح.')
  if (fit < 78) issues.push('المحتوى أطول من المساحة المريحة.')
  if (lineLayout.estimatedTitleLines > lineLayout.titleMaxLines) issues.push('خطأ: العنوان سيتجاوز عدد الأسطر الآمن.')
  if (lineLayout.estimatedBodyLines > lineLayout.bodyMaxLines) issues.push('المتن سيتجاوز عدد الأسطر المريح.')
  if (duplicate) issues.push('قريب بصرياً من اتجاه آخر.')
  if (textContrast >= 94 && backgroundContrast >= 90) strengths.push('تباين نص وخلفية ممتاز')
  if (whitespace >= 90 && density >= 88) strengths.push('فراغات وكثافة محسوبة')
  if (hierarchy >= 92) strengths.push('تسلسل بصري واضح')
  if (rtlAlignment >= 94) strengths.push('محاذاة RTL دقيقة')
  if (visualWeight >= 90) strengths.push('وزن بصري متزن')
  if (lineFit >= 94 && readability >= 90) strengths.push('قراءة هاتفية مريحة')
  if (originality >= 80) strengths.push('تكوين متمايز')
  if (platformFit >= 92) strengths.push('ملائم للمنصة')
  const raw = readability * .16 + hierarchy * .13 + whitespace * .10 + contrast * .15 + fit * .09 + lineFit * .10 + originality * .04 + platformFit * .05 + density * .06 + visualWeight * .06 + rtlAlignment * .06
  const core = [readability, hierarchy, whitespace, textContrast, backgroundContrast, fit, lineFit, density, visualWeight, rtlAlignment]
  const coreMinimum = Math.min(...core)
  let score = boundedQuality(raw)
  const titleOverflow = lineLayout.estimatedTitleLines > lineLayout.titleMaxLines
  const bodyOverflow = lineLayout.estimatedBodyLines > lineLayout.bodyMaxLines
  if (titleOverflow || bodyOverflow) score = Math.min(score, 62)
  if (textContrast < 88 || backgroundContrast < 84) score = Math.min(score, 82)
  if (coreMinimum < 70 || !safe) score = Math.min(score, 72)
  if (coreMinimum < 78) score = Math.min(score, 79)
  if (coreMinimum < 84) score = Math.min(score, 87)
  const deservesNinety = core.every((value) => value >= 90)
    && textContrast >= 94
    && backgroundContrast >= 90
    && readability >= 92
    && hierarchy >= 90
    && lineFit >= 94
    && rtlAlignment >= 92
    && visualWeight >= 88
    && !duplicate
    && !titleOverflow
    && !bodyOverflow
  if (!deservesNinety) score = Math.min(score, 89)
  const deservesExceptional = core.every((value) => value >= 95)
    && originality >= 86
    && platformFit >= 94
    && issues.length === 0
  if (!deservesExceptional) score = Math.min(score, 95)
  return { score, band: qualityBand(score), readability, hierarchy, whitespace, contrast, textContrast, backgroundContrast, density, visualWeight, rtlAlignment, fit, lineFit, originality, platformFit, issues, strengths }
}

export interface SocialCampaignRequest extends SocialDesignRequest {
  basePlan?: CompositionPlan
}

const campaignRoles: { role: CampaignAssetRole; label: string; purpose: string; format: SocialFormatId; tone?: ContentTone; density?: DesignDensity }[] = [
  { role: 'hero', label: 'المنشور الرئيسي', purpose: 'القطعة المركزية التي تحمل الفكرة كاملة', format: 'instagram-portrait', density: 'balanced' },
  { role: 'story', label: 'Story', purpose: 'مدخل سريع يُقرأ في ثوانٍ', format: 'story', density: 'minimal' },
  { role: 'reel', label: 'غلاف Reel', purpose: 'عنوان قوي وآمن داخل منطقة الغلاف', format: 'reel-cover', tone: 'bold', density: 'minimal' },
  { role: 'linkedin', label: 'LinkedIn', purpose: 'نسخة معرفية مهنية أهدأ', format: 'linkedin-landscape', tone: 'institutional', density: 'balanced' },
  { role: 'closing', label: 'الشريحة الختامية', purpose: 'خاتمة تحمل الهوية ودعوة واضحة من دون ازدحام', format: 'instagram-square', tone: 'institutional', density: 'minimal' },
  { role: 'quote', label: 'بطاقة اقتباس', purpose: 'جملة قابلة للحفظ والمشاركة', format: 'instagram-square', tone: 'deep', density: 'minimal' },
  { role: 'teaser', label: 'تشويق قبل النشر', purpose: 'يفتح سؤالًا ولا يحرق الفكرة', format: 'story', tone: 'intellectual', density: 'minimal' },
  { role: 'reminder', label: 'تذكير بعد النشر', purpose: 'يعيد الفكرة بصياغة عملية ودعوة واضحة', format: 'instagram-square', tone: 'calm', density: 'balanced' },
]

const campaignText = (role: CampaignAssetRole, analysis: SocialContentAnalysis) => {
  const title = analysis.structure.title || analysis.structure.keyPoint || analysis.normalizedText
  const quote = analysis.structure.quote || analysis.structure.keyPoint || title
  const hero = analysis.structure.heroWord || wordsOf(title)[0] || 'الفكرة'
  const sourceSentences = splitSentences(analysis.structure.original).filter((sentence) => wordsOf(sentence).length >= 3)
  const lead = sourceSentences[0] || analysis.structure.keyPoint || title
  const support = sourceSentences.find((sentence) => sentence !== lead) || analysis.structure.subtitle || quote
  const sourceQuestion = sourceSentences.find((sentence) => /[؟?]/.test(sentence))
  if (role === 'story') return `${truncateWords(title, 14)}\n\n${truncateWords(support, 18)}`
  if (role === 'reel') return `${hero}\n${truncateWords(title, 10)}`
  if (role === 'linkedin') return `${title}\n\n${truncateWords(lead, 26)}\n${truncateWords(support, 24)}`
  if (role === 'closing') return `${truncateWords(analysis.structure.keyPoint || title, 15)}\n\n${analysis.structure.cta || 'اقرأ الفكرة كاملة في موقع د. أحمد الفيلكاوي.'}`
  if (role === 'quote') return truncateWords(quote, 28)
  if (role === 'teaser') return sourceQuestion
    ? truncateWords(sourceQuestion, 18)
    : `ما الذي تكشفه فكرة «${hero}» حين نضعها تحت الاختبار؟`
  if (role === 'reminder') return `${truncateWords(quote, 20)}\n\nاقرأ الفكرة في سياقها الكامل.`
  return analysis.structure.original
}

export function generateSocialCampaign(request: SocialCampaignRequest): SocialCampaign {
  const analysis = analyzeSocialContent(request.text, request.context, { author: request.author, source: request.source })
  const history = [...normalizeHistory(request.history)]
  const assets: SocialCampaignAsset[] = []
  const usedLayouts = new Set<LayoutFamilyId>()
  /* تماسك ألوان الحملة (مقترح الصديق ١٧): لوحة الأساس تُورَّث للحملة كلها فقط
     إن كانت قوية التباين — الضعيفة تُستبدل بأقوى اللوحات تبايناً فلا تسمّم
     القطع السبع كلها بميراثٍ باهت */
  let base = request.basePlan
  if (base) {
    const baseQuality = base.quality || critiqueCompositionPlan(base)
    if (baseQuality.textContrast < 82 || baseQuality.backgroundContrast < 78) {
      const strongest = (Object.keys(PALETTES) as PaletteId[])
        .map((id) => {
          const candidate = { ...base!, palette: id }
          const quality = critiqueCompositionPlan(candidate)
          return { id, quality }
        })
        .filter((item) => item.quality.textContrast >= 82 && item.quality.backgroundContrast >= 78)
        .sort((left, right) => right.quality.score - left.quality.score)[0]
      if (strongest) base = { ...base, palette: strongest.id, quality: strongest.quality }
    }
  }
  const warnings: string[] = []

  for (const [index, spec] of campaignRoles.entries()) {
    const roleText = campaignText(spec.role, analysis)
    let picked: CompositionPlan | undefined
    let fallback: CompositionPlan | undefined
    for (let attempt = 0; attempt < 8 && !picked; attempt += 1) {
      const result = generateSocialDesigns({
        ...request,
        text: roleText,
        format: spec.format,
        platform: 'auto',
        tone: spec.tone || request.tone,
        density: spec.density || request.density,
        count: 8,
        seed: `${request.seed || request.text}:campaign:${spec.role}:${index}:${attempt}`,
        history,
        basePlan: base,
        locks: base ? { color: true, content: false, style: false, format: false } : request.locks,
        tasteProfile: request.tasteProfile,
        noveltyThreshold: Math.max(.36, request.noveltyThreshold || 0),
      })
      fallback ||= result.plans[0]
      picked = result.plans.find((plan) =>
        !usedLayouts.has(plan.layout)
        && (plan.quality?.score || 0) >= 78
        && (plan.quality?.lineFit || 0) >= 80
        && !plan.quality?.issues.some((issue) => issue.startsWith('خطأ:')))
    }
    if (!picked) {
      const roleAnalysis = overrideAnalysis(
        analyzeSocialContent(roleText, request.context, { author: request.author, source: request.source }),
        { ...request, text: roleText, tone: spec.tone || request.tone, density: spec.density || request.density },
      )
      const roleFormat = SOCIAL_FORMATS[spec.format]
      const roleDensity = spec.density || (request.density && request.density !== 'auto' ? request.density : roleAnalysis.density)
      const rescueCandidates = Object.values(LAYOUT_FAMILIES)
        .filter((layout) => !usedLayouts.has(layout.id))
        .flatMap((layout, layoutIndex) => Array.from({ length: 4 }, (_, variant) => {
          const candidate = makeCandidate(
            layout,
            roleAnalysis,
            roleFormat,
            roleDensity,
            `${request.seed || request.text}:campaign-rescue:${spec.role}:${layout.id}`,
            layoutIndex * 7 + variant,
            history,
          )
          return base ? applyDesignLocks(base, candidate, { color: true, content: false, style: false, format: false }) : candidate
        }))
        .map((candidate) => ({ ...candidate, quality: critiqueCompositionPlan(candidate, [...assets.map((asset) => asset.plan), candidate]) }))
        .filter((candidate) => (candidate.quality?.score || 0) >= 68
          && (candidate.quality?.lineFit || 0) >= 76
          && !candidate.quality?.issues.some((issue) => issue.startsWith('خطأ:')))
        .sort((left, right) => ((right.quality?.score || 0) + right.novelty * 8) - ((left.quality?.score || 0) + left.novelty * 8))
      picked = rescueCandidates[0]
    }
    picked ||= fallback
    if (!picked) {
      warnings.push(`تعذّر بناء ${spec.label} من دون خفض الجودة.`)
      continue
    }
    if ((picked.quality?.score || 0) < 68 || picked.quality?.issues.some((issue) => issue.startsWith('خطأ:'))) warnings.push(`${spec.label} يحتاج مراجعة بصرية قبل النشر.`)
    usedLayouts.add(picked.layout)
    history.push(designHistoryEntry(picked))
    assets.push({ id: `${spec.role}-${picked.id}`, role: spec.role, label: spec.label, purpose: spec.purpose, plan: picked })
  }

  const qualityScore = assets.length ? Math.round(assets.reduce((sum, asset) => sum + (asset.plan.quality?.score || 0), 0) / assets.length) : 0
  const paletteCount = new Set(assets.map((asset) => asset.plan.palette)).size
  const coherenceScore = assets.length ? Math.round(72 + (paletteCount === 1 ? 18 : paletteCount <= 2 ? 10 : 2) + Math.min(10, analysis.confidence / 10)) : 0
  const diversityScore = assets.length ? Math.round(new Set(assets.map((asset) => asset.plan.layout)).size / assets.length * 100) : 0
  const ready = assets.length === campaignRoles.length
    && qualityScore >= 75
    && diversityScore >= 75
    && assets.every((asset) => (asset.plan.quality?.lineFit || 0) >= 76 && !asset.plan.quality?.issues.some((issue) => issue.startsWith('خطأ:')))
  if (!ready && !warnings.length) warnings.push('الحملة لم تجتز لجنة الجودة كاملة؛ أعد توليدها قبل النشر.')

  return {
    id: `campaign-${hashHex(`${request.text}:${request.seed || ''}:${assets.map((asset) => asset.plan.fingerprint).join(':')}`)}`,
    title: analysis.structure.title || truncateWords(request.text, 12),
    createdAt: new Date().toISOString(),
    assets,
    qualityScore,
    coherenceScore: boundedQuality(coherenceScore),
    diversityScore: boundedQuality(diversityScore),
    ready,
    warnings,
  }
}

export interface PlanValidationIssue {
  severity: 'error' | 'warning'
  code: 'missing-title' | 'unsafe-zone' | 'title-overflow' | 'body-overflow' | 'duplicate-style' | 'missing-carousel' | 'low-contrast'
  message: string
}

const hexLuminance = (hex: string) => {
  const value = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return 0.5
  const components = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722
}

const contrastRatio = (left: string, right: string) => {
  const a = hexLuminance(left)
  const b = hexLuminance(right)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export function validateCompositionPlan(plan: CompositionPlan, peers: readonly CompositionPlan[] = []): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = []
  if (!plan.content.title.trim()) issues.push({ severity: 'error', code: 'missing-title', message: 'التصميم بلا عنوان.' })
  const titleWords = wordsOf(plan.content.title).length
  const bodyWords = wordsOf(plan.content.body).length
  const lineLayout = compositionTextLayout(plan)
  if (titleWords > plan.format.maxTitleWords) issues.push({ severity: 'warning', code: 'title-overflow', message: `العنوان ${titleWords} كلمة ويتجاوز المجال المريح (${plan.format.maxTitleWords}).` })
  if (bodyWords > plan.format.maxBodyWords) issues.push({ severity: 'warning', code: 'body-overflow', message: `المتن ${bodyWords} كلمة ويتجاوز المجال المريح (${plan.format.maxBodyWords}).` })
  if (lineLayout.estimatedTitleLines > lineLayout.titleMaxLines) issues.push({ severity: 'error', code: 'title-overflow', message: `العنوان يحتاج ${lineLayout.estimatedTitleLines} أسطر والمتاح ${lineLayout.titleMaxLines}.` })
  if (lineLayout.estimatedBodyLines > lineLayout.bodyMaxLines) issues.push({ severity: 'warning', code: 'body-overflow', message: `المتن يحتاج ${lineLayout.estimatedBodyLines} أسطر والمتاح ${lineLayout.bodyMaxLines}.` })
  for (const zone of [plan.geometry.titleZone, plan.geometry.bodyZone]) {
    if (zone.x < 0 || zone.y < 0 || zone.x + zone.width > 1.001 || zone.y > 0.94) {
      issues.push({ severity: 'error', code: 'unsafe-zone', message: 'إحدى مناطق النص خرجت من حدود اللوحة.' })
      break
    }
  }
  if (plan.format.supportsCarousel && plan.content.overflowStrategy === 'carousel' && plan.content.slides.length < 2) issues.push({ severity: 'error', code: 'missing-carousel', message: 'النص يحتاج كاروسيل لكن الشرائح غير موجودة.' })
  const palette = PALETTES[plan.palette]
  if (contrastRatio(palette.background, palette.ink) < 4.5) issues.push({ severity: 'error', code: 'low-contrast', message: 'تباين النص الأساسي أقل من 4.5:1.' })
  if (peers.some((peer) => peer.id !== plan.id && designSimilarity(plan, peer) >= 0.82)) issues.push({ severity: 'warning', code: 'duplicate-style', message: 'التكوين قريب جداً من تصميم آخر في الدفعة.' })
  return issues
}

export function auditDesignBatch(plans: readonly CompositionPlan[]) {
  const issues = plans.flatMap((plan) => validateCompositionPlan(plan, plans).map((issue) => ({ planId: plan.id, ...issue })))
  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    uniqueLayouts: new Set(plans.map((plan) => plan.layout)).size,
    uniqueFingerprints: new Set(plans.map((plan) => plan.fingerprint)).size,
    issues,
  }
}

