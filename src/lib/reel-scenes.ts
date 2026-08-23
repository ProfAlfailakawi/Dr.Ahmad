/**
 * مخطِّط الريل السينمائي — يقرأ نص المادة ويحوّله «خطة مشاهد» كاملة.
 *
 * الفلسفة: لا قوالب جامدة تتكرر. المخطِّط يفهم النص عبر محلّل الاستوديو
 * (analyzeSocialContent) ثم يستخرج من المتن نفسه خطوطه الحية — السؤال،
 * المقابلة «ليس/بل»، الاقتباس المشهدي، الرقم — ويختار على أساسها:
 * القالب الحركي، والعالم اللوني، والزخارف، ومزاج الموسيقى.
 * البذرة حتمية من بصمة النص: المادة نفسها تعطي الريل نفسه دائماً،
 * ومادتان مختلفتان لا تتشابهان؛ و«نسخة أخرى» تفتح تنويعاً شقيقاً.
 */

import { analyzeSocialContent, type ContentTone, type ContentTopic } from './social-design-engine'
import { arabicCountPhrase, REEL_SCENE_FORMS, SECOND_FORMS } from './arabic-count.ts'
import { interpretDrAhmadDomain } from './dr-ahmad-domain-glossary'
import { chooseMetaphors, type MetaphorId } from './reel-metaphors'
import { analyzeWorldSemantics } from './world-semantics'
import type { SemanticVerb } from './design-worlds'

/* ------------------------------- الأنواع ------------------------------- */

export type ReelTemplateId = 'question' | 'siren' | 'weave' | 'manuscript' | 'counter'

export type ReelWorldId =
  | 'observatory-night'
  | 'majlis-velvet'
  | 'sadu-night'
  | 'dawn-blush'
  | 'ink-marble'
  | 'magazine-paper'
  | 'lab-notebook'
  | 'dawn-orchard'
  | 'graphite-dusk'
  | 'cream-daylight'
  | 'sand-warm'
  | 'linen-blue'
  | 'pearl-mint'
  | 'copper-eclipse'
  | 'indigo-archive'
  | 'emerald-atlas'
  | 'desert-signal'
  | 'porcelain-cyan'
  | 'coral-future'

export type ReelMotifId =
  | 'dust'
  | 'rings'
  | 'falling-words'
  | 'grid-weave'
  | 'orbit'
  | 'confetti'
  | 'ink-nib'
  | 'underline'

export type ReelMoodId = 'dark' | 'warm' | 'bright' | 'scholar'
export type ReelMotionVerb = SemanticVerb

export interface ReelWorld {
  id: ReelWorldId
  /** الاسم كما يظهر في معارض الاستوديو — للاتساق مع هوية الموقع. */
  label: string
  /** فاتح أم داكن — يقلب ألوان النص والحبيبات. */
  scheme: 'dark' | 'light'
  bgTop: string
  bgMid: string
  bgBottom: string
  glow: string
  ink: string
  dim: string
  accent: string
  accent2: string
  danger: string
}

export interface ReelScene {
  kind: 'signature' | 'hook' | 'shift' | 'idea' | 'truth' | 'close' | 'metaphor'
  /** استعارة مرسومة تتصدّر المشهد — مصدرها معجم الدكتور لا ذوقٌ عام. */
  metaphor?: MetaphorId
  /** بذرة الشكل: تختار من عائلة أشكال الاستعارة نسخةً محدّدة. */
  metaphorVariation?: number
  slug: string
  /** سطر تمهيد صغير فوق السطر الكبير. */
  eyebrow?: string
  /** السطر الكبير — قلب المشهد. */
  line: string
  /** سطر ثانٍ اختياري (للمقابلة «ليس/بل» ونحوها). */
  line2?: string
  /** يلوَّن السطر بلون التوكيد بدل الحبر. */
  accent?: boolean
  /** ثواني المشهد. */
  seconds: number
}

export interface ReelPlan {
  templateId: ReelTemplateId
  world: ReelWorld
  mood: ReelMoodId
  motifs: ReelMotifId[]
  scenes: ReelScene[]
  /** كلمات الضجيج العائمة (لقالب الصفارة) — من مفردات النص نفسه. */
  noiseWords: string[]
  /** رقم للعدّاد إن وُجد في النص. */
  counterTarget: number | null
  seconds: number
  title: string
  author: string
  site: string
  footerMark: string
  seed: number
  variant: number
  /** المفهوم الذي تعرّف عليه المعجم، ومشاهده البصرية — للعرض والتفسير. */
  concept: string | null
  metaphors: MetaphorId[]
  /** الفعل البصري المستنتج من الكلمة؛ هو الذي يحرّك العالم خلف النص. */
  motionVerb: ReelMotionVerb
  /** ترجمة محروقة أسفل الشاشة — تُطفأ بأمر المحرر إن أرادها نظيفة. */
  captions?: boolean
  /** ملخص قرارات المخطِّط — يُعرض للدكتور كي يفهم لماذا اختلف هذا الريل. */
  rationale: string[]
}

/* ------------------------------- العوالم ------------------------------- */

const WORLDS: ReelWorld[] = [
  { id: 'observatory-night', label: 'مرصد الليل', scheme: 'dark', bgTop: '#16233a', bgMid: '#0c1320', bgBottom: '#080d16', glow: '#1e3a5f', ink: '#eaf0fb', dim: '#96a0b4', accent: '#e9c069', accent2: '#7ea6df', danger: '#e2483d' },
  { id: 'majlis-velvet', label: 'مخمل المجلس', scheme: 'dark', bgTop: '#3a1f2e', bgMid: '#241019', bgBottom: '#150a12', glow: '#5c2f43', ink: '#f3e4d6', dim: '#a98f96', accent: '#c8944e', accent2: '#e0a24a', danger: '#d5493c' },
  { id: 'sadu-night', label: 'ليل السدو', scheme: 'dark', bgTop: '#1d1f26', bgMid: '#14161c', bgBottom: '#0e1013', glow: '#2c3140', ink: '#ece9e2', dim: '#969dae', accent: '#d7a75f', accent2: '#8a3b2e', danger: '#c14435' },
  { id: 'dawn-blush', label: 'شفق الفجر', scheme: 'dark', bgTop: '#243a3c', bgMid: '#16262a', bgBottom: '#101a1e', glow: '#2f4d4a', ink: '#e6efe9', dim: '#8fa5a0', accent: '#e6b36a', accent2: '#7db3ad', danger: '#d9584a' },
  { id: 'ink-marble', label: 'حبر ورخام', scheme: 'light', bgTop: '#f6f3ec', bgMid: '#efe9dc', bgBottom: '#e6ddc9', glow: '#fdfaf3', ink: '#241d14', dim: '#7a6f5c', accent: '#8a5e22', accent2: '#2c5a5e', danger: '#a83227' },
  { id: 'magazine-paper', label: 'ورق المجلة', scheme: 'light', bgTop: '#f4efe4', bgMid: '#ece4d2', bgBottom: '#e2d6bd', glow: '#fbf7ee', ink: '#26211a', dim: '#84775f', accent: '#b3541e', accent2: '#4a5f7a', danger: '#a83227' },
  { id: 'lab-notebook', label: 'دفتر المختبر', scheme: 'dark', bgTop: '#1a2430', bgMid: '#121a24', bgBottom: '#0c121a', glow: '#23374a', ink: '#e8eef4', dim: '#8fa2b3', accent: '#6fc7c0', accent2: '#e9c069', danger: '#d9584a' },
  { id: 'dawn-orchard', label: 'بستان الفجر', scheme: 'dark', bgTop: '#1d2e22', bgMid: '#132018', bgBottom: '#0d1710', glow: '#2c4633', ink: '#e9f0e6', dim: '#93a894', accent: '#dcb45f', accent2: '#8fbf8a', danger: '#c95340' },
  { id: 'graphite-dusk', label: 'غسق الغرافيت', scheme: 'dark', bgTop: '#232733', bgMid: '#171a23', bgBottom: '#0f1117', glow: '#333a4d', ink: '#eceef4', dim: '#9aa2b5', accent: '#c9a227', accent2: '#6f8fbf', danger: '#cf5344' },
  // عوالم فاتحة أنيقة — كي لا تخرج كل الريلات داكنة
  { id: 'cream-daylight', label: 'نهار كريمي', scheme: 'light', bgTop: '#faf6ec', bgMid: '#f3ecdb', bgBottom: '#e9dec5', glow: '#fffdf6', ink: '#2a2419', dim: '#8b7d63', accent: '#b25e28', accent2: '#3f6d74', danger: '#a5342a' },
  { id: 'sand-warm', label: 'رمل دافئ', scheme: 'light', bgTop: '#f7efe1', bgMid: '#efe1c9', bgBottom: '#e4d0ad', glow: '#fdf8ee', ink: '#3a2c18', dim: '#907a56', accent: '#c07316', accent2: '#5c6f4a', danger: '#ab3b25' },
  { id: 'linen-blue', label: 'كتان أزرق', scheme: 'light', bgTop: '#f2f5f8', bgMid: '#e6ecf2', bgBottom: '#d5e0ea', glow: '#fbfcfe', ink: '#1f2a36', dim: '#6c7d8e', accent: '#2f6f9e', accent2: '#b0762c', danger: '#b23a2e' },
  { id: 'pearl-mint', label: 'لؤلؤ نعناعي', scheme: 'light', bgTop: '#f3f7f4', bgMid: '#e7efe9', bgBottom: '#d6e5db', glow: '#fbfefc', ink: '#1e2a24', dim: '#6f8177', accent: '#2f8f6f', accent2: '#b08a2c', danger: '#b23a2e' },
  // عوالم سردية جديدة: لكل واحد مادة وضوء لا مجرد لوحة لون أخرى.
  { id: 'copper-eclipse', label: 'كسوف النحاس', scheme: 'dark', bgTop: '#35231f', bgMid: '#201511', bgBottom: '#0f0b09', glow: '#654132', ink: '#f4e9db', dim: '#ae9180', accent: '#e29a55', accent2: '#7995b2', danger: '#e25b43' },
  { id: 'indigo-archive', label: 'أرشيف النيلي', scheme: 'dark', bgTop: '#242648', bgMid: '#15172f', bgBottom: '#0b0d1e', glow: '#3b3f70', ink: '#eff0ff', dim: '#999dc5', accent: '#d8bd72', accent2: '#8e9cff', danger: '#e25d68' },
  { id: 'emerald-atlas', label: 'أطلس الزمرد', scheme: 'dark', bgTop: '#163a35', bgMid: '#0d2522', bgBottom: '#071512', glow: '#275f56', ink: '#e8f5ef', dim: '#8eb1a8', accent: '#e2bd69', accent2: '#74c7b6', danger: '#df5a4c' },
  { id: 'desert-signal', label: 'إشارة الصحراء', scheme: 'light', bgTop: '#fbf1df', bgMid: '#efd9b7', bgBottom: '#dfbc89', glow: '#fff9ef', ink: '#382719', dim: '#8b6f50', accent: '#bd542b', accent2: '#2e6d72', danger: '#a9322a' },
  { id: 'porcelain-cyan', label: 'خزف سماوي', scheme: 'light', bgTop: '#f4fafb', bgMid: '#e1f0f2', bgBottom: '#cce2e5', glow: '#ffffff', ink: '#17313a', dim: '#66838a', accent: '#176f7a', accent2: '#c17a35', danger: '#b23a36' },
  { id: 'coral-future', label: 'مستقبل مرجاني', scheme: 'light', bgTop: '#fff3ee', bgMid: '#f7dfd5', bgBottom: '#eac7bb', glow: '#fffaf7', ink: '#382428', dim: '#8d6b70', accent: '#be4f58', accent2: '#336f78', danger: '#a82f38' },
]

const worldById = new Map(WORLDS.map((world) => [world.id, world]))

/** أي العوالم يليق بأي موضوع — القائمة مرتبة والأولى هي الميل الطبيعي. */
/* كل موضوع يمزج داكناً وفاتحاً كي لا تخرج الريلات كلها سوداء ولا كلها بيضاء —
   والبذرة تدور على المجموعة فيتنوّع المزاج البصري بين مادةٍ وأخرى. */
const TOPIC_WORLDS: Record<ContentTopic, ReelWorldId[]> = {
  ai: ['indigo-archive', 'copper-eclipse', 'porcelain-cyan', 'sadu-night', 'graphite-dusk', 'linen-blue', 'observatory-night', 'lab-notebook', 'pearl-mint'],
  education: ['porcelain-cyan', 'observatory-night', 'cream-daylight', 'ink-marble', 'dawn-blush', 'sand-warm', 'lab-notebook', 'coral-future'],
  family: ['desert-signal', 'sand-warm', 'dawn-orchard', 'cream-daylight', 'dawn-blush', 'magazine-paper', 'coral-future'],
  research: ['indigo-archive', 'lab-notebook', 'porcelain-cyan', 'linen-blue', 'graphite-dusk', 'ink-marble', 'pearl-mint'],
  media: ['copper-eclipse', 'desert-signal', 'majlis-velvet', 'sand-warm', 'sadu-night', 'dawn-blush', 'graphite-dusk'],
  leadership: ['emerald-atlas', 'majlis-velvet', 'graphite-dusk', 'linen-blue', 'observatory-night', 'sadu-night'],
  human: ['coral-future', 'dawn-blush', 'cream-daylight', 'majlis-velvet', 'sand-warm', 'dawn-orchard'],
  book: ['indigo-archive', 'ink-marble', 'sand-warm', 'majlis-velvet', 'magazine-paper', 'cream-daylight'],
  general: ['emerald-atlas', 'desert-signal', 'observatory-night', 'cream-daylight', 'dawn-blush', 'sadu-night', 'sand-warm', 'linen-blue'],
}

const MOOD_BY_TONE: Partial<Record<ContentTone, ReelMoodId>> = {
  bold: 'dark',
  deep: 'dark',
  media: 'dark',
  intellectual: 'scholar',
  academic: 'scholar',
  formal: 'scholar',
  institutional: 'scholar',
  human: 'warm',
  inspiring: 'warm',
  calm: 'warm',
  luxury: 'bright',
  promotional: 'bright',
}

/* ------------------------------ أدوات نصية ------------------------------ */

const AR_PUNCT = /[.!؟…]+/

function fnv(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function mulberry(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length]
}

function splitSentences(text: string): string[] {
  return text
    .split(AR_PUNCT)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 6)
}

const DANGLING_START = /^(?:لكن|لكنّ|بل|و|ف|ثم|أو|أي|حيث|الذي|التي|كما|لأن|إذ|بينما|رغم)\b/
const DANGLING_END = /(?:و|أو|من|إلى|على|في|عن|أن|إن|مع|بين|بعد|قبل|كل|هذا|هذه|التي|الذي|بل|لكن)$/

function selfContainedLine(line: string) {
  const clean = line.replace(/[،؛:.؟!…]+$/u, '').trim()
  const words = clean.split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.length <= 20 && !DANGLING_START.test(clean) && !DANGLING_END.test(clean)
}

/**
 * يختار شذرة تامة من الجملة ولا يقصّها عند عدد أحرف أعمى. إن لم يجد حدّاً
 * دلالياً صالحاً يُبقي الجملة كاملة؛ الرسّام مسؤول عن لفّها على سطرين.
 */
function sceneLine(line: string, max = 92): string {
  const clean = line.replace(/["«»]/g, '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const clauses = clean.split(/(?:[،؛:]|\s+[—–-]\s+)/).map((part) => part.trim()).filter(Boolean)
  const complete = clauses.filter((part) => part.length >= 14 && part.length <= max && selfContainedLine(part))
  return complete[0] || clean
}

function reelMotionVerb(title: string, body = ''): ReelMotionVerb {
  const titleAnalysis = analyzeWorldSemantics(title, 'reel')
  const fullAnalysis = analyzeWorldSemantics(`${title} ${body.slice(0, 1200)}`, 'reel')
  // عنوان المادة هو العقد الدلالي الأقوى؛ لا نسمح لجملة شارحة لاحقة أن تبدّل فعل الفكرة بلا سبب.
  return titleAnalysis.confidence >= .68 ? titleAnalysis.semanticMotionVerb : fullAnalysis.semanticMotionVerb
}

interface MinedText {
  question: string | null
  contrast: { first: string; second: string } | null
  quote: string | null
  number: number | null
  strongLines: string[]
  noiseWords: string[]
}

/** ينقّب المتن عن مادته الحية: سؤال، مقابلة، اقتباس، رقم، وأقوى الجمل. */
function mineText(title: string, body: string): MinedText {
  const full = `${title}. ${body}`
  const sentences = splitSentences(full)

  const rawQuestion = full.split(/[.!…]/).map((part) => part.trim()).find((part) => part.includes('؟') && part.length >= 10 && part.length <= 90)
  const question = rawQuestion ? sceneLine(rawQuestion.replace(/؟+$/, ''), 92) + '؟' : null

  let contrast: MinedText['contrast'] = null
  const contrastMatch = full.match(/(?:ليس|ليست|لم يعد|لا)\s+([^.!؟…]{6,60})(?:…|\.\.\.|،|\.)\s*(?:بل|لكن|إنما)\s+([^.!؟…]{6,60})/)
  if (contrastMatch) {
    contrast = { first: sceneLine(contrastMatch[1], 72), second: sceneLine(contrastMatch[2], 72) }
  } else {
    /* نفيٌ صريح بلا «بل» — كعنوان «الوطن ليس وجهةَ نظر» — يظل مقابلةً حيّة:
       نأخذ المنفيّ طرفاً أول، وأقوى جملة بعده طرفاً ثانياً. */
    const negation = full.match(/(?:ليس|ليست|لم يعد)\s+([^.!؟…،]{6,52})/)
    if (negation) contrast = { first: sceneLine(negation[1], 72), second: '' }
  }

  const quoteMatch = full.match(/«([^»]{14,80})»/)
  const quoteCandidate = quoteMatch ? sceneLine(quoteMatch[1], 92) : null
  const quote = quoteCandidate && quoteCandidate.split(' ').length >= 3 ? quoteCandidate : null

  const numberMatch = full.match(/(?:^|\s)(\d{2,3})\s*[%٪]/) || full.match(/(?:^|\s)(\d{2,3})(?=\s)/)
  const parsedNumber = numberMatch ? parseInt(numberMatch[1], 10) : NaN
  /* أرقام الدكتور تُكتب حروفاً غالباً («تسعين بالمئة»)، فلو اكتفينا بالخانات
     اللاتينية لبقي قالب العدّاد معطّلاً على أغلب متونه. */
  const WORD_NUMBERS: [RegExp, number][] = [
    [/تسعين|تسعون/, 90], [/ثمانين|ثمانون/, 80], [/سبعين|سبعون/, 70], [/ستين|ستون/, 60],
    [/خمسين|خمسون/, 50], [/أربعين|اربعين|أربعون/, 40], [/ثلاثين|ثلاثون/, 30], [/عشرين|عشرون/, 20],
    [/مئة|مائة|المئة الكاملة/, 100], [/ثلثين|ثلثي/, 66], [/نصف/, 50], [/ربع/, 25],
  ]
  let wordNumber: number | null = null
  for (const [pattern, value] of WORD_NUMBERS) {
    if (pattern.test(full)) { wordNumber = value; break }
  }
  const number = Number.isFinite(parsedNumber) && parsedNumber >= 10 && parsedNumber <= 999
    ? parsedNumber
    : wordNumber

  /* انتقاء الجُمل: الشذرة المبتورة تقتل المشهد. نرفض ما يبدأ بحرف عطفٍ أو
     ربطٍ معلَّق، وما ينتهي معلَّقاً، ونرجّح الجملة التامة القصيرة الحاملة لمقابلة. */
  const scoreLine = (line: string) => {
    let score = 0
    if (/(ليس|لا يزال|لم يعد|بل |وحده|أخطر|الحقيقة|السؤال|لأول مرة)/.test(line)) score += 3
    if (/[؟]/.test(line)) score += 2
    const words = line.split(/\s+/).length
    if (words >= 5 && words <= 9) score += 2
    else if (words <= 11) score += 1
    if (line.length <= 46) score += 1
    if (/[«»"]/.test(line)) score += 1
    return score
  }
  const strongLines = sentences
    .map((sentence) => sceneLine(sentence))
    .filter((line) => line.length >= 14 && line.length <= 118 && selfContainedLine(line))
    .sort((a, b) => scoreLine(b) - scoreLine(a))
    .slice(0, 6)

  const stop = new Set(['الذي', 'التي', 'الذين', 'هذا', 'هذه', 'ذلك', 'كان', 'كانت', 'لكن', 'حين', 'حتى', 'إلى', 'على', 'عن', 'في', 'من', 'ما', 'لا', 'أن', 'إن', 'قد', 'كل', 'ثم', 'هو', 'هي', 'بين', 'بعد', 'قبل', 'غير', 'عند', 'فيه', 'كما', 'لأن', 'وهو', 'وهي'])
  const frequency = new Map<string, number>()
  for (const raw of full.split(/[^؀-ۿ]+/)) {
    const word = raw.trim()
    if (word.length < 3 || word.length > 8 || stop.has(word)) continue
    frequency.set(word, (frequency.get(word) || 0) + 1)
  }
  const noiseWords = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)

  return { question, contrast, quote, number, strongLines, noiseWords }
}

/* ------------------------------- المخطِّط ------------------------------- */

export interface ReelSource {
  title: string
  body: string
  author?: string
  site?: string
  cta?: string
}

export function planReel(source: ReelSource, variant = 0): ReelPlan {
  const title = source.title.trim()
  const body = source.body.trim()
  const analysis = analyzeSocialContent(`${title}\n${body}`.slice(0, 4000))
  /* المعجم يقرأ المادة قبل أي قرار بصري: هو من يسمّي المفهوم ويقترح مشاهده
     وعوالمه ومزاجه ومحظوراته — فالاستعارة تخرج من علم الدكتور لا من ذوقٍ عام. */
  const domain = interpretDrAhmadDomain(`${title} ${body.slice(0, 1200)}`)
  /* بوابة صدق حرفية. المعجم يرتّب المفاهيم بالتشابه، فيخرج أحياناً مرشَّحٌ
     عالي الثقة لا سند له في المتن، أو مرشَّحٌ يخالف المصطلح الذي التُقط فعلاً:
       «الوطن ليس وجهة نظر»      ← رُشِّح «برنامج حضور إلكتروني» بلا مصطلح أصلاً
       «جيلٌ بلا جذور»            ← التُقطت «حماية» ورُشِّح «الواقع الافتراضي»
       «السبورة التي لم تعد ترى» ← رُشِّح «Microsoft Teams» بكلمةٍ ليست في النص
     لذلك لا نثق بالترتيب: نطالب بأن يظهر اسم المفهوم نفسه — أو أحد مرادفاته
     المعتبرة — حرفياً في المادة. ما لا يُنطق في المتن لا يحكم صورته. */
  /* تطبيع عربي خفيف قبل المطابقة: التشكيل والهمزات وصور الألف والياء والتاء
     المربوطة تختلف بين المعجم والمتن، فلولا التطبيع لسقطت مطابقاتٌ صحيحة
     («ذكائنا» مقابل «الذكاء»). ويبقى ما لا أثر له في المتن مرفوضاً. */
  const normalizeAr = (value: string) => value
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤئء]/g, '')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
  const haystack = normalizeAr(`${title} ${body}`)
  const literalIn = (term: string) => {
    const clean = normalizeAr(term)
    if (clean.length < 4) return false
    if (haystack.includes(clean)) return true
    /* المصطلح المركّب يُقبل إذا حضرت كلماته الجوهرية كلها في المتن. */
    const words = clean.split(' ').filter((word) => word.length >= 4 && !/^(في|من|على|عن|الى|مع)$/.test(word))
    return words.length >= 2 && words.every((word) => haystack.includes(word))
  }
  const primaryEntry = domain.primary
  const grounded = Boolean(primaryEntry) && (
    literalIn(primaryEntry!.canonicalAr)
    || (primaryEntry!.aliases || []).some((alias) => literalIn(alias))
  )
  const conceptName = grounded ? primaryEntry?.canonicalAr || null : null
  const mined = mineText(title, body)
  const seed = (fnv(`${title}|${body.slice(0, 400)}|لقطة${variant}`) + variant * 7919) >>> 0
  const random = mulberry(seed)
  const rationale: string[] = []

  /* الموضوع المرجَّح: إشارات مفردات تسند المحلّل حين يتردد. */
  const lexicon = `${title} ${body.slice(0, 600)}`
  const motionVerb = reelMotionVerb(title, body)
  const nudgedTopic: ContentTopic =
    /(وداع|رحيل|رحل|فقدنا|قلوب|أحبابنا)/.test(lexicon) ? 'human'
      : /(الوطن|أزمات|إنذار|صفارات)/.test(lexicon) ? 'media'
      : /(ذكاء|خوارزم|روبوت|بيانات)/.test(lexicon) ? 'ai'
      : /(طالب|معلم|مدرسة|امتحان|صف)/.test(lexicon) ? 'education'
      : analysis.topic

  const minedMetaphors = chooseMetaphors(grounded
    ? [conceptName || '', domain.visualScenes.join(' · '), domain.primary?.meaningAr || '', `${title} ${body.slice(0, 600)}`]
    : [`${title} ${body.slice(0, 900)}`], 3)
  /* لا مشهد بلا صورة: المادة الوجدانية قد لا تحمل مفردة استعارية صريحة،
     فنسندها باستعارة تليق بمقامها بدل أن تخرج نصاً عارياً. */
  const TOPIC_FALLBACK: Partial<Record<ContentTopic, MetaphorId[]>> = {
    human: ['ripple', 'constellation'],
    family: ['seed', 'roots'],
    education: ['stairs', 'orbit-loop'],
    ai: ['dissolving-grid', 'lock-key'],
    research: ['lens', 'signal-bars'],
    media: ['ripple', 'constellation'],
    leadership: ['compass', 'stairs'],
    book: ['roots', 'constellation'],
    general: ['ripple', 'orbit-loop'],
  }
  /* بركة الصور تُبنى واسعةً كي تدور عبر مرّات تناول المفهوم بلا تكرار:
     المطابقات المنقّبة أولاً (أدقّها دلالةً)، ثم استعارات الموضوع الاحتياطية،
     ثم عاماتٌ تكمّل العدد — بلا تكرار. */
  const generalPool: MetaphorId[] = ['figure-contemplate', 'ripple', 'horizon-sun', 'open-book', 'constellation', 'orbit-loop', 'spotlight', 'network-grow']
  const metaphorPool: MetaphorId[] = []
  for (const m of [...minedMetaphors, ...(TOPIC_FALLBACK[nudgedTopic] || []), ...(TOPIC_FALLBACK.general || []), ...generalPool]) {
    if (!metaphorPool.includes(m)) metaphorPool.push(m)
    if (metaphorPool.length >= 6) break
  }
  const metaphors: MetaphorId[] = metaphorPool.length ? metaphorPool : ['figure-contemplate']

  /* القالب — شكل النص يرشّح، والموضوع يرجّح، والبذرة تحسم. */
  /* ترجيحٌ صريح: ما ينطق به المتن يسبق ما يميل إليه الموضوع، والبذرة تحسم
     بين المتساويين — فلا يبتلع ميلٌ عامٌّ إشارةً نصيةً واضحة. */
  const weighted: ReelTemplateId[] = []
  /* حرمةُ المقام تسبق الإشارة النصية: الرثاء والطفولة لا يُقرع لهما إنذار
     مهما حملت جملتهما مقابلةً، فتُصرف المقابلة إلى المخطوطة الهادئة. */
  const solemn = nudgedTopic === 'human' || nudgedTopic === 'family'
    || /(وداع|رحيل|رحل|فقدنا|رحمه الله|في ذكرى)/.test(lexicon)
  const weigh = (id: ReelTemplateId, times: number) => {
    const target = solemn && id === 'siren' ? 'manuscript' : id
    for (let i = 0; i < times; i += 1) weighted.push(target)
  }
  if (mined.contrast) weigh('siren', 4)
  if (mined.number !== null) weigh('counter', 4)
  if (mined.question) weigh('question', 3)
  if (mined.quote) weigh('manuscript', 3)
  if (nudgedTopic === 'ai' || nudgedTopic === 'research') weigh('weave', 1)
  if (nudgedTopic === 'human' || nudgedTopic === 'family' || nudgedTopic === 'book') weigh('manuscript', 2)
  if (nudgedTopic === 'education') weigh('question', 2)
  if (nudgedTopic === 'leadership' || nudgedTopic === 'media') weigh('siren', 1)
  /* حتى النص القصير العاري يستحق تنويعاً: القوالب التي لا تشترط مادةً
     منقّبة تبقى مفتوحة، فتحسم البذرة بدل أن يتكرّر قالبٌ واحد أبداً. */
  weigh('weave', 1)
  weigh('manuscript', 1)
  weigh('question', 1)
  const candidates = weighted
  const templateId = pick(random, candidates)
  rationale.push(
    templateId === 'siren' ? 'وجدتُ مقابلة «ليس… بل» فاخترت قالب الصفارة'
      : templateId === 'question' ? 'النص يحمل سؤالاً حياً فاخترت قالب السؤال'
      : templateId === 'counter' ? `وجدتُ رقماً (${mined.number}) فاخترت قالب العدّاد`
      : templateId === 'manuscript' ? 'النبرة إنسانية/اقتباسية فاخترت قالب المخطوطة'
      : 'الموضوع معرفي فاخترت قالب النسيج',
  )

  /* العالم — من الموضوع المرجَّح أعلاه. */
  const worldPool = TOPIC_WORLDS[nudgedTopic] || TOPIC_WORLDS.general
  /* مجرى عشوائي مستقل للعالم: لو اقتسم العالمُ مجرى القالب، لتجمّعت نصوصُ
     موضوعٍ واحد على لونٍ واحد كلما تشابه طول نصّها. */
  /* دوران حتمي بإزاحة مشتقة من العنوان: يضمن أن نصّين مختلفين على موضوع واحد
     لا يقعان على اللون نفسه إلا إذا استُنفدت المجموعة كلها. */
  const rotate = fnv(`${title}·${body.slice(0, 260)}·عالم·${templateId}·${analysis.primaryTone}·${variant}`) % worldPool.length
  const world = worldById.get(worldPool[rotate]) || WORLDS[0]
  rationale.push(`الموضوع «${nudgedTopic}» فتح عوالم: ${worldPool.map((id) => worldById.get(id)?.label).join(' · ')} — ووقع الاختيار على «${world.label}»`)

  /* المزاج الموسيقي: القالب يفرض طبعه أولاً، والنبرة تهذّبه. */
  /* مزاج المعجم يسبق تخمين المحلّل: هو مكتوبٌ لكل مفهوم بيد الدكتور. */
  const GLOSSARY_MOOD: Record<string, ReelMoodId> = {
    human: 'warm', warm: 'warm', calm: 'warm', optimistic: 'warm', collaborative: 'warm',
    academic: 'scholar', precise: 'scholar', data: 'scholar', intellectual: 'scholar', critical: 'scholar',
    bright: 'bright', playful: 'bright', energetic: 'bright', creative: 'bright', dynamic: 'bright',
    dignified: 'dark', institutional: 'dark', confident: 'dark', future: 'dark', immersive: 'dark',
  }
  const domainMood = grounded ? domain.moods.map((m) => GLOSSARY_MOOD[m]).find(Boolean) : undefined
  const tonalMood = domainMood || MOOD_BY_TONE[analysis.primaryTone]
  /* الإشراق الاحتفالي لا يليق بمادة ثقيلة: الذكاء والإعلام والرثاء تُخفَض
     نبرتها إلى الرصانة مهما بدت لغتها لامعة للمحلّل. */
  const grave = solemn || nudgedTopic === 'ai' || nudgedTopic === 'media'
  const softened: ReelMoodId | undefined = tonalMood === 'bright' && grave ? 'scholar' : tonalMood
  const mood: ReelMoodId =
    templateId === 'siren' ? 'dark'
      : templateId === 'manuscript' ? (solemn ? 'warm' : softened === 'bright' ? 'warm' : 'warm')
      : templateId === 'counter' ? (grave ? 'scholar' : 'bright')
      /* السؤال مقامٌ متأمِّل: الإشراق الاحتفالي لا يليق بمن يسأل، فيُخفَض
         إلى الرصانة ويبقى الدفء وحده مسموحاً به. */
      : templateId === 'question' ? (softened === 'warm' ? 'warm' : softened === 'bright' ? 'scholar' : grave ? 'scholar' : 'dark')
      : softened || 'scholar'
  rationale.push(`قالب «${templateId}» طبع الموسيقى «${mood}» (النبرة: ${analysis.primaryTone})`)

  /* الزخارف: أساس القالب + إضافة مبذورة. */
  const baseMotifs: Record<ReelTemplateId, ReelMotifId[]> = {
    question: ['rings', 'dust'],
    siren: ['falling-words', 'rings'],
    weave: ['grid-weave', 'dust'],
    manuscript: ['ink-nib', 'underline'],
    counter: ['confetti', 'dust'],
  }
  const extras: ReelMotifId[] = ['orbit', 'dust', 'underline', 'rings']
  const motifs = [...baseMotifs[templateId]]
  const extra = pick(random, extras)
  if (!motifs.includes(extra)) motifs.push(extra)

  /* المشاهد — تُبنى من المادة الحية المنقّبة، لا من نص محفوظ. */
  const strong = mined.strongLines
  const scenes: ReelScene[] = []
  const usedLines = new Set<string>()
  const normalizeSceneLine = (value: string) => value.replace(/[\u064B-\u0652\u0640\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
  const takeLine = (candidates: Array<string | null | undefined>, fallback: string) => {
    for (const candidate of [...candidates, fallback]) {
      const clean = sceneLine(String(candidate || '').trim())
      const key = normalizeSceneLine(clean)
      if (!clean || key.length < 5 || usedLines.has(key)) continue
      usedLines.add(key)
      return clean
    }
    const repair = `${fallback.replace(/[؟.!…]+$/u, '')} — من زاوية أخرى`
    usedLines.add(normalizeSceneLine(repair))
    return repair
  }
  const addScene = (scene: Omit<ReelScene, 'line'>, candidates: Array<string | null | undefined>, fallback: string) => {
    scenes.push({ ...scene, line: takeLine(candidates, fallback) })
  }

  /* أول ثانية تنطق موضوع المادة، لا شعاراً ثابتاً يتكرر في كل ريل. */
  addScene({ kind: 'signature', slug: 'HOOK / 01', eyebrow: 'الفكرة في ومضة', seconds: 1.35 }, [title, mined.question, strong[0]], 'الفكرة التي تستحق أن نتوقف عندها')

  if (templateId === 'question') {
    addScene({ kind: 'hook', slug: 'ASK / 02', eyebrow: 'سؤال يفتح المادة', accent: true, seconds: 3.4 }, [mined.question, strong[0], strong[1]], 'ما الذي تغيّره هذه الفكرة فعلاً؟')
    addScene({ kind: 'shift', slug: 'LOOK / 03', seconds: 3.2 }, [strong[0], strong[1], strong[2]], 'انظر إلى ما وراء الإجابة السريعة')
    addScene({ kind: 'truth', slug: 'TRUTH / 04', eyebrow: 'وهنا جوهر الأمر', accent: true, seconds: 3.4 }, [strong[1], strong[2], strong[3]], 'الجواب يبدأ من الإنسان')
  } else if (templateId === 'siren') {
    addScene({ kind: 'hook', slug: 'NOISE / 02', eyebrow: 'في الضجيج اليومي', seconds: 3.2 }, [strong[0], strong[1]], 'ليس كل ما يلمع جواباً')
    addScene({ kind: 'shift', slug: 'SIREN / 03', eyebrow: mined.contrast ? `ليس ${sceneLine(mined.contrast.first, 72)}` : 'حين يعلو الاختبار', accent: true, seconds: 3.6 }, [mined.contrast?.second ? `بل ${mined.contrast.second}` : null, strong[1], strong[2]], 'بل ما يثبت أمام السؤال')
    addScene({ kind: 'truth', slug: 'HOLD / 04', seconds: 3.0 }, [strong[2], strong[3], strong[1]], 'يبقى الجوهر حين يهدأ الضجيج')
  } else if (templateId === 'counter') {
    addScene({ kind: 'hook', slug: 'COUNT / 02', eyebrow: 'الرقم يصعد…', seconds: 3.2 }, [`${mined.number}٪ ليست القصة كلها`], 'الرقم ليس القصة كلها')
    addScene({ kind: 'shift', slug: 'GRAY / 03', seconds: 3.2 }, [strong[0], strong[1]], 'ما الذي لا يقيسه الرقم؟')
    addScene({ kind: 'truth', slug: 'ASK / 04', eyebrow: 'السؤال الأصدق', accent: true, seconds: 3.4 }, [strong[1], strong[2]], 'ماذا بقي بعد النتيجة؟')
  } else if (templateId === 'manuscript') {
    addScene({ kind: 'hook', slug: 'INK / 02', eyebrow: 'من المتن', seconds: 3.6 }, [mined.quote, strong[0], strong[1]], 'جملة واحدة قد تفتح المعنى كله')
    addScene({ kind: 'shift', slug: 'WRITE / 03', seconds: 3.2 }, [strong[1], strong[2], strong[0]], 'ما بين السطور أبلغ من العنوان')
    addScene({ kind: 'truth', slug: 'SEAL / 04', eyebrow: 'الخلاصة', accent: true, seconds: 3.2 }, [strong[2], strong[3]], 'المعنى قبل الأداة')
  } else {
    addScene({ kind: 'hook', slug: 'WEAVE / 02', eyebrow: 'خيط أول', seconds: 3.2 }, [strong[0], strong[1]], 'كل فكرة تبدأ بخيط صغير')
    addScene({ kind: 'idea', slug: 'CROSS / 03', seconds: 3.2 }, [strong[1], strong[2]], 'الأداة وحدها لا تنسج شيئاً')
    addScene({ kind: 'truth', slug: 'KNOT / 04', eyebrow: 'العقدة التي تمسك النسيج', accent: true, seconds: 3.4 }, [strong[2], strong[3]], 'المعنى هو ما يمسك النسيج')
  }

  /* مشهد إضافي للمواد الغنية — التنويع في الطول أيضاً. */
  if (body.length > 900 && strong[3]) {
    addScene({ kind: 'idea', slug: 'MORE / 05', seconds: 3.0 }, [strong[3], strong[4], strong[5]], 'ويبقى في الفكرة ما يستحق التأمل')
  }

  /* مشاهد الاستعارة: الفكرة تُرسم لا تُكتب. الأقوى دلالةً أولاً (المكتبة رتّبتها
     بقوة المطابقة) و«لقطة أخرى» تدور على التالية. والمادة الغنية تأخذ مشهدين
     باستعارتين مختلفتين، فيزداد التنويع داخل الريل لا بينه فقط. */
  if (metaphors.length) {
    const firstMetaphor = metaphors[variant % metaphors.length]
    addScene({
      kind: 'metaphor',
      slug: `IMAGE / ${String(scenes.length + 1).padStart(2, '0')}`,
      metaphor: firstMetaphor,
      metaphorVariation: (seed >> 3) + variant * 13,
      eyebrow: conceptName || undefined,
      seconds: 3.2,
    }, [strong[3], strong[4], strong[0], strong[5]], 'هنا تتحول الفكرة إلى صورة')
    const secondMetaphor = metaphors.find((m) => m !== firstMetaphor)
    if (secondMetaphor && body.length > 700 && strong[4]) {
      addScene({
        kind: 'metaphor',
        slug: `IMAGE / ${String(scenes.length + 1).padStart(2, '0')}`,
        metaphor: secondMetaphor,
        metaphorVariation: (seed >> 5) + variant * 29 + 7,
        seconds: 3.0,
      }, [strong[4], strong[5], strong[2]], 'وللفكرة صورة ثانية لا تكرر الأولى')
    }
  }
  const contextualCta = source.cta?.trim() || `أكمل فكرة «${sceneLine(title, 58)}» في الموقع`
  scenes.push({ kind: 'close', slug: `FINAL / ${String(scenes.length + 1).padStart(2, '0')}`, eyebrow: 'الخطوة التالية', line: contextualCta, seconds: 3.6 })

  /* الإيقاع جزءٌ من الهوية: القالب يفرض نَفَسه (الصفارة تلهث، المخطوطة تتمهّل)،
     والبذرة تزيح الإيقاع قليلاً — فلا تخرج الريلات كلها بطولٍ واحد ممل. */
  const tempo = templateId === 'siren' ? 0.86
    : templateId === 'counter' ? 0.92
    : templateId === 'manuscript' ? 1.14
    : templateId === 'weave' ? 1.05
    : 1
  const drift = 0.94 + random() * 0.14
  for (const scene of scenes) {
    if (scene.kind === 'signature') continue
    scene.seconds = Math.round(scene.seconds * tempo * drift * 10) / 10
  }
  /* بوابة إيقاع: 5–8 مشاهد و18–30 ثانية. نعيد توزيع الزمن لا نضيف حشواً. */
  if (scenes.length < 5 || scenes.length > 8) throw new Error(`Reel scene invariant failed: ${scenes.length}`)
  const rawSeconds = scenes.reduce((total, scene) => total + scene.seconds, 0)
  const targetSeconds = Math.max(18, Math.min(30, rawSeconds))
  if (Math.abs(targetSeconds - rawSeconds) > .05) {
    const fixedHook = Math.min(1.5, scenes[0]?.seconds || 1.35)
    const scalable = Math.max(.1, rawSeconds - (scenes[0]?.seconds || 0))
    const scale = (targetSeconds - fixedHook) / scalable
    scenes[0].seconds = fixedHook
    for (let i = 1; i < scenes.length; i += 1) scenes[i].seconds = Math.max(2.2, Math.round(scenes[i].seconds * scale * 10) / 10)
  }
  const corrected = scenes.reduce((total, scene) => total + scene.seconds, 0)
  if (corrected < 18) scenes[scenes.length - 1].seconds = Math.round((scenes[scenes.length - 1].seconds + (18 - corrected)) * 10) / 10
  if (corrected > 30) scenes[scenes.length - 1].seconds = Math.max(2.2, Math.round((scenes[scenes.length - 1].seconds - (corrected - 30)) * 10) / 10)
  const seconds = Math.round(scenes.reduce((total, scene) => total + scene.seconds, 0) * 10) / 10
  if (conceptName) rationale.push(`المعجم تعرّف على «${conceptName}» فاقترح مشاهده البصرية${metaphors.length ? ` — واخترتُ منها: ${metaphors.join(' · ')}` : ''}`)
  rationale.push(`فهمتُ فعل العبارة بصرياً على أنه «${motionVerb}»، فبنيتُ حركة العالم عليه`)
  rationale.push(`${arabicCountPhrase(scenes.length, REEL_SCENE_FORMS)} · ${arabicCountPhrase(seconds, SECOND_FORMS)} · زخارف: ${motifs.join(' + ')}`)

  return {
    templateId,
    world,
    mood,
    motifs,
    scenes,
    noiseWords: mined.noiseWords,
    counterTarget: mined.number,
    seconds,
    title,
    author: source.author || 'د. أحمد حسين الفيلكاوي',
    site: source.site || 'dr-alfailakawi.com',
    footerMark: 'الإنسان قبل الآلة',
    seed,
    variant,
    concept: conceptName,
    metaphors,
    motionVerb,
    rationale,
  }
}

export const REEL_WORLDS = WORLDS

export interface ReelQualityReport {
  score: number
  ready: boolean
  checks: string[]
  warnings: string[]
  signature: string
}

export function reelPerceptualSignature(plan: ReelPlan) {
  const metaphor = plan.scenes.find((scene) => scene.kind === 'metaphor')?.metaphor || 'none'
  const density = plan.scenes.length >= 7 ? 'dense' : plan.scenes.length <= 5 ? 'lean' : 'balanced'
  return [plan.templateId, plan.world.scheme, plan.world.id, plan.motionVerb, metaphor, density, [...plan.motifs].sort().join('+')].join(':')
}

/** بوابة قبل التشغيل والتصدير: تكشف التكرار والبتر والحمولة الزائدة آلياً. */
export function auditReelPlan(plan: ReelPlan): ReelQualityReport {
  const normalize = (value: string) => value.replace(/[\u064B-\u0652\u0640\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
  const seen = new Set<string>()
  const warnings: string[] = []
  let duplicates = 0
  let dangling = 0
  let long = 0
  plan.scenes.forEach((scene) => {
    const key = normalize(scene.line)
    if (seen.has(key)) duplicates += 1
    seen.add(key)
    if (scene.kind !== 'close' && scene.kind !== 'signature' && !selfContainedLine(scene.line)) dangling += 1
    if (scene.line.length > 156) long += 1
  })
  const sceneCountBad = plan.scenes.length < 5 || plan.scenes.length > 8
  const durationBad = plan.seconds < 18 || plan.seconds > 30
  const hookBad = (plan.scenes[0]?.seconds || 99) > 1.5
  const genericOpening = plan.scenes[0]?.line === plan.footerMark || /الإنسان قبل الآلة/.test(plan.scenes[0]?.line || '')
  const genericCta = /^(?:اعرف المزيد|تابعنا|المزيد في الموقع|الفكرة كاملة في الموقع)$/i.test(plan.scenes.at(-1)?.line || '')
  if (duplicates) warnings.push(`${duplicates} تكرار نصي بين المشاهد`)
  if (dangling) warnings.push(`${dangling} جملة معلّقة أو غير مكتملة`)
  if (long) warnings.push(`${long} سطر شديد الطول؛ يجب أن يمر من Canvas fit gate`)
  if (sceneCountBad) warnings.push('عدد المشاهد يجب أن يكون بين 5 و8')
  if (durationBad) warnings.push('مدة الريل يجب أن تكون بين 18 و30 ثانية')
  if (hookBad) warnings.push('المشهد الأول يجب ألا يتجاوز 1.5 ثانية')
  if (genericOpening) warnings.push('الافتتاح عام ولا ينطق موضوع المادة')
  if (genericCta) warnings.push('CTA عام وغير خاص بالمادة')
  const score = Math.max(0, 100 - duplicates * 20 - dangling * 18 - long * 5 - (sceneCountBad ? 18 : 0) - (durationBad ? 20 : 0) - (hookBad ? 10 : 0) - (genericOpening ? 12 : 0) - (genericCta ? 8 : 0))
  return {
    score,
    ready: duplicates === 0 && dangling === 0 && !sceneCountBad && !durationBad && !hookBad && !genericOpening && !genericCta && score >= 82,
    checks: [
      'الافتتاح ينطق موضوع المادة خلال 1–1.5 ثانية',
      '5–8 مشاهد بوظائف سردية مختلفة',
      'كل مشهد يحمل جملة مختلفة ومكتملة',
      'اللفّ البصري وCanvas metrics يمنعان خروج النص',
      `العالم يتحرك بفعل «${plan.motionVerb}»`,
      'CTA ختامي خاص بالمادة',
      'البصمة الصوتية مشتقة من بذرة المادة',
    ],
    warnings,
    signature: reelPerceptualSignature(plan),
  }
}


/* ------------------------------- الذاكرة ------------------------------- */

/**
 * ذاكرة التنويع: تتذكّر كم مرةً تناول الدكتور كل مفهوم، فتعطي كل مرةٍ نسخةً
 * مختلفة (قالباً وعالماً واستعارة) بدل تكرار الشكل نفسه. تسكن localStorage
 * فتبقى عبر الجلسات، وتنهار بهدوءٍ إلى صفرٍ إن غاب التخزين.
 */
const MEMORY_KEY = 'reel:concept-history:v1'

type ConceptHistory = Record<string, { count: number; lastTemplate?: ReelTemplateId; lastWorld?: string; lastMetaphor?: string; usedMetaphors?: string[]; lastSignature?: string; usedSignatures?: string[] }>

function readHistory(): ConceptHistory {
  if (typeof localStorage === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}') as ConceptHistory } catch { return {} }
}

function writeHistory(history: ConceptHistory) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(history)) } catch { /* تخزينٌ ممتلئ أو محجوب */ }
}

/** مفتاح الذاكرة: اسم المفهوم من المعجم إن وُجد، وإلا بصمة العنوان المطبّعة. */
export function reelMemoryKey(source: ReelSource): string {
  const probe = planReel(source, 0)
  if (probe.concept) return `c:${probe.concept}`
  const norm = source.title
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ').trim()
  return `t:${norm}`
}

export interface MemoryAwarePlan { plan: ReelPlan; timesSeenBefore: number; key: string }

/**
 * يبني ريلاً واعياً بالذاكرة: يقرأ كم مرةً ظهر المفهوم، ويختار variant التالي،
 * ويضمن اختلاف القالب عن آخر مرة ما أمكن. لا يكتب الذاكرة — الكتابة عند
 * الاعتماد (commit) كي لا تُستهلك النسخ بمجرّد المعاينة.
 */
export function planReelWithMemory(source: ReelSource): MemoryAwarePlan {
  const key = reelMemoryKey(source)
  const history = readHistory()
  const record = history[key] || { count: 0 }
  const primaryMetaphor = (candidate: ReelPlan) => candidate.scenes.find((scene) => scene.kind === 'metaphor')?.metaphor
  const used = new Set(record.usedMetaphors || [])
  const usedSignatures = new Set(record.usedSignatures || [])
  let variant = record.count
  let plan = planReel(source, variant)
  /* ضمان اختلاف القالب والصورة عن آخر مرة، وتجنّب الصور المستهلكة سابقاً
     ما دام في البركة متسع — نجرّب حتى اثنتي عشرة نسخة. */
  for (let attempt = 0; attempt < 12 && record.count > 0; attempt += 1) {
    const met = primaryMetaphor(plan)
    const templateClash = plan.templateId === record.lastTemplate
    const metaphorClash = met === record.lastMetaphor || (met !== undefined && used.has(met) && used.size < plan.metaphors.length)
    const signature = reelPerceptualSignature(plan)
    const perceptualClash = signature === record.lastSignature || (usedSignatures.has(signature) && usedSignatures.size < 20)
    if (!templateClash && !metaphorClash && !perceptualClash) break
    variant += 1
    plan = planReel(source, variant)
  }
  return { plan, timesSeenBefore: record.count, key }
}

/** يثبّت أن هذه النسخة استُعملت — يُستدعى عند التصدير لا المعاينة. */
export function commitReelMemory(key: string, plan: ReelPlan) {
  const history = readHistory()
  const record = history[key] || { count: 0 }
  const metaphor = plan.scenes.find((scene) => scene.kind === 'metaphor')?.metaphor
  /* نحتفظ بآخر عشرين بصمة/صورة مستعملة كي لا تعود إحداها قبل استنفاد التنوّع. */
  const usedMetaphors = [...(record.usedMetaphors || []), metaphor].filter(Boolean).slice(-20) as string[]
  const signature = reelPerceptualSignature(plan)
  const usedSignatures = [...(record.usedSignatures || []), signature].filter(Boolean).slice(-20)
  history[key] = { count: record.count + 1, lastTemplate: plan.templateId, lastWorld: plan.world.label, lastMetaphor: metaphor, usedMetaphors, lastSignature: signature, usedSignatures }
  writeHistory(history)
}
