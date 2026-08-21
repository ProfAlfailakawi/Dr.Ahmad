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
]

const worldById = new Map(WORLDS.map((world) => [world.id, world]))

/** أي العوالم يليق بأي موضوع — القائمة مرتبة والأولى هي الميل الطبيعي. */
/* كل موضوع يمزج داكناً وفاتحاً كي لا تخرج الريلات كلها سوداء ولا كلها بيضاء —
   والبذرة تدور على المجموعة فيتنوّع المزاج البصري بين مادةٍ وأخرى. */
const TOPIC_WORLDS: Record<ContentTopic, ReelWorldId[]> = {
  ai: ['sadu-night', 'graphite-dusk', 'linen-blue', 'observatory-night', 'lab-notebook', 'pearl-mint'],
  education: ['observatory-night', 'cream-daylight', 'ink-marble', 'dawn-blush', 'sand-warm', 'lab-notebook'],
  family: ['sand-warm', 'dawn-orchard', 'cream-daylight', 'dawn-blush', 'magazine-paper'],
  research: ['lab-notebook', 'linen-blue', 'graphite-dusk', 'ink-marble', 'pearl-mint'],
  media: ['majlis-velvet', 'sand-warm', 'sadu-night', 'dawn-blush', 'graphite-dusk'],
  leadership: ['majlis-velvet', 'graphite-dusk', 'linen-blue', 'observatory-night', 'sadu-night'],
  human: ['dawn-blush', 'cream-daylight', 'majlis-velvet', 'sand-warm', 'dawn-orchard'],
  book: ['ink-marble', 'sand-warm', 'majlis-velvet', 'magazine-paper', 'cream-daylight'],
  general: ['observatory-night', 'cream-daylight', 'dawn-blush', 'sadu-night', 'sand-warm', 'linen-blue'],
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

/** يقصّ السطر ليصلح مشهداً — الريل يحب الجُمل القصيرة الضاربة. */
function tightLine(line: string, max = 46): string {
  const clean = line.replace(/["«»]/g, '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const words = clean.split(' ')
  let out = ''
  for (const word of words) {
    if ((out + ' ' + word).trim().length > max) break
    out = (out + ' ' + word).trim()
  }
  return (out || clean.slice(0, max)).replace(/[\u060C,؛:\-–—]+$/u, '').trim()
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
  const question = rawQuestion ? tightLine(rawQuestion.replace(/؟+$/, '') , 44) + '؟' : null

  let contrast: MinedText['contrast'] = null
  const contrastMatch = full.match(/(?:ليس|ليست|لم يعد|لا)\s+([^.!؟…]{6,60})(?:…|\.\.\.|،|\.)\s*(?:بل|لكن|إنما)\s+([^.!؟…]{6,60})/)
  if (contrastMatch) {
    contrast = { first: tightLine(contrastMatch[1], 38), second: tightLine(contrastMatch[2], 38) }
  } else {
    /* نفيٌ صريح بلا «بل» — كعنوان «الوطن ليس وجهةَ نظر» — يظل مقابلةً حيّة:
       نأخذ المنفيّ طرفاً أول، وأقوى جملة بعده طرفاً ثانياً. */
    const negation = full.match(/(?:ليس|ليست|لم يعد)\s+([^.!؟…،]{6,52})/)
    if (negation) contrast = { first: tightLine(negation[1], 38), second: '' }
  }

  const quoteMatch = full.match(/«([^»]{14,80})»/)
  const quoteCandidate = quoteMatch ? tightLine(quoteMatch[1], 46) : null
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
  const DANGLING_START = /^(?:لكن|لكنّ|بل|و|ف|ثم|أو|أي|حيث|الذي|التي|كما|لأن|إذ|بينما|رغم)\b/
  const DANGLING_END = /(?:و|أو|من|إلى|على|في|عن|أن|إن|مع|بين|بعد|قبل|كل|هذا|هذه|التي|الذي)$/
  const selfContained = (line: string) => {
    const words = line.split(/\s+/).filter(Boolean)
    if (words.length < 4 || words.length > 12) return false
    if (DANGLING_START.test(line)) return false
    if (DANGLING_END.test(line.replace(/[،؛:.]$/, '').trim())) return false
    return true
  }
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
    .map((sentence) => tightLine(sentence))
    .filter((line) => line.length >= 14 && line.length <= 64 && selfContained(line))
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
  const line = (index: number, fallback: string) => strong[index] || fallback
  const scenes: ReelScene[] = []
  scenes.push({ kind: 'signature', slug: 'MARK / 01', line: 'الإنسان قبل الآلة', seconds: 2.2 })

  if (templateId === 'question') {
    scenes.push({ kind: 'hook', slug: 'ASK / 02', eyebrow: 'سؤال يفتح المادة', line: mined.question || tightLine(title), accent: true, seconds: 3.4 })
    scenes.push({ kind: 'shift', slug: 'LOOK / 03', line: line(0, tightLine(title)), seconds: 3.2 })
    scenes.push({ kind: 'truth', slug: 'TRUTH / 04', eyebrow: 'وهنا جوهر الأمر', line: line(1, 'الجواب يبدأ من الإنسان'), accent: true, seconds: 3.4 })
  } else if (templateId === 'siren') {
    scenes.push({ kind: 'hook', slug: 'NOISE / 02', eyebrow: 'في الضجيج اليومي', line: line(0, tightLine(title)), seconds: 3.2 })
    scenes.push({ kind: 'shift', slug: 'SIREN / 03', eyebrow: mined.contrast ? `ليس ${mined.contrast.first}` : 'حين يعلو الاختبار', line: mined.contrast ? `بل ${mined.contrast.second}` : line(1, 'يسقط ما لا يثبت'), accent: true, seconds: 3.6 })
    scenes.push({ kind: 'truth', slug: 'HOLD / 04', line: line(2, tightLine(title)), seconds: 3.0 })
  } else if (templateId === 'counter') {
    scenes.push({ kind: 'hook', slug: 'COUNT / 02', eyebrow: 'الرقم يصعد…', line: `${mined.number}٪ ليست القصة كلها`, seconds: 3.2 })
    scenes.push({ kind: 'shift', slug: 'GRAY / 03', line: line(0, 'ما الذي لا يقيسه الرقم؟'), seconds: 3.2 })
    scenes.push({ kind: 'truth', slug: 'ASK / 04', eyebrow: 'السؤال الأصدق', line: line(1, 'ماذا بقي بعد النتيجة؟'), accent: true, seconds: 3.4 })
  } else if (templateId === 'manuscript') {
    scenes.push({ kind: 'hook', slug: 'INK / 02', eyebrow: 'من المتن', line: mined.quote || line(0, tightLine(title)), seconds: 3.6 })
    scenes.push({ kind: 'shift', slug: 'WRITE / 03', line: line(1, tightLine(title)), seconds: 3.2 })
    scenes.push({ kind: 'truth', slug: 'SEAL / 04', eyebrow: 'الخلاصة', line: line(2, 'المعنى قبل الأداة'), accent: true, seconds: 3.2 })
  } else {
    scenes.push({ kind: 'hook', slug: 'WEAVE / 02', eyebrow: 'خيط أول', line: line(0, tightLine(title)), seconds: 3.2 })
    scenes.push({ kind: 'idea', slug: 'CROSS / 03', line: line(1, 'الأداة وحدها لا تنسج شيئاً'), seconds: 3.2 })
    scenes.push({ kind: 'truth', slug: 'KNOT / 04', eyebrow: 'العقدة التي تمسك النسيج', line: line(2, tightLine(title)), accent: true, seconds: 3.4 })
  }

  /* مشهد إضافي للمواد الغنية — التنويع في الطول أيضاً. */
  if (body.length > 900 && strong[3]) {
    scenes.push({ kind: 'idea', slug: 'MORE / 05', line: strong[3], seconds: 3.0 })
  }

  /* مشاهد الاستعارة: الفكرة تُرسم لا تُكتب. الأقوى دلالةً أولاً (المكتبة رتّبتها
     بقوة المطابقة) و«لقطة أخرى» تدور على التالية. والمادة الغنية تأخذ مشهدين
     باستعارتين مختلفتين، فيزداد التنويع داخل الريل لا بينه فقط. */
  if (metaphors.length) {
    const firstMetaphor = metaphors[variant % metaphors.length]
    scenes.push({
      kind: 'metaphor',
      slug: `IMAGE / ${String(scenes.length + 1).padStart(2, '0')}`,
      metaphor: firstMetaphor,
      metaphorVariation: (seed >> 3) + variant * 13,
      eyebrow: conceptName || undefined,
      line: strong[3] || strong[0] || tightLine(title, 40),
      seconds: 3.2,
    })
    const secondMetaphor = metaphors.find((m) => m !== firstMetaphor)
    if (secondMetaphor && body.length > 700 && strong[4]) {
      scenes.push({
        kind: 'metaphor',
        slug: `IMAGE / ${String(scenes.length + 1).padStart(2, '0')}`,
        metaphor: secondMetaphor,
        metaphorVariation: (seed >> 5) + variant * 29 + 7,
        line: strong[4],
        seconds: 3.0,
      })
    }
  }
  scenes.push({ kind: 'close', slug: `FINAL / ${String(scenes.length + 1).padStart(2, '0')}`, eyebrow: title.replace(/\s+/g, ' ').trim(), line: 'المقال كاملاً في الموقع', seconds: 3.6 })

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
  const seconds = Math.round(scenes.reduce((total, scene) => total + scene.seconds, 0) * 10) / 10
  if (conceptName) rationale.push(`المعجم تعرّف على «${conceptName}» فاقترح مشاهده البصرية${metaphors.length ? ` — واخترتُ منها: ${metaphors.join(' · ')}` : ''}`)
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
    rationale,
  }
}

export const REEL_WORLDS = WORLDS


/* ------------------------------- الذاكرة ------------------------------- */

/**
 * ذاكرة التنويع: تتذكّر كم مرةً تناول الدكتور كل مفهوم، فتعطي كل مرةٍ نسخةً
 * مختلفة (قالباً وعالماً واستعارة) بدل تكرار الشكل نفسه. تسكن localStorage
 * فتبقى عبر الجلسات، وتنهار بهدوءٍ إلى صفرٍ إن غاب التخزين.
 */
const MEMORY_KEY = 'reel:concept-history:v1'

type ConceptHistory = Record<string, { count: number; lastTemplate?: ReelTemplateId; lastWorld?: string; lastMetaphor?: string; usedMetaphors?: string[] }>

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
  let variant = record.count
  let plan = planReel(source, variant)
  /* ضمان اختلاف القالب والصورة عن آخر مرة، وتجنّب الصور المستهلكة سابقاً
     ما دام في البركة متسع — نجرّب حتى اثنتي عشرة نسخة. */
  for (let attempt = 0; attempt < 12 && record.count > 0; attempt += 1) {
    const met = primaryMetaphor(plan)
    const templateClash = plan.templateId === record.lastTemplate
    const metaphorClash = met === record.lastMetaphor || (met !== undefined && used.has(met) && used.size < plan.metaphors.length)
    if (!templateClash && !metaphorClash) break
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
  /* نحتفظ بآخر ثماني صورٍ مستعملة كي لا تعود إحداها قبل استنفاد التنوّع. */
  const usedMetaphors = [...(record.usedMetaphors || []), metaphor].filter(Boolean).slice(-8) as string[]
  history[key] = { count: record.count + 1, lastTemplate: plan.templateId, lastWorld: plan.world.label, lastMetaphor: metaphor, usedMetaphors }
  writeHistory(history)
}
