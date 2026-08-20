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
  kind: 'signature' | 'hook' | 'shift' | 'idea' | 'truth' | 'close'
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
]

const worldById = new Map(WORLDS.map((world) => [world.id, world]))

/** أي العوالم يليق بأي موضوع — القائمة مرتبة والأولى هي الميل الطبيعي. */
const TOPIC_WORLDS: Record<ContentTopic, ReelWorldId[]> = {
  ai: ['sadu-night', 'lab-notebook', 'observatory-night', 'graphite-dusk'],
  education: ['observatory-night', 'ink-marble', 'lab-notebook', 'magazine-paper'],
  family: ['dawn-orchard', 'magazine-paper', 'dawn-blush', 'ink-marble'],
  research: ['lab-notebook', 'ink-marble', 'observatory-night', 'graphite-dusk'],
  media: ['majlis-velvet', 'sadu-night', 'dawn-blush', 'graphite-dusk'],
  leadership: ['majlis-velvet', 'sadu-night', 'observatory-night', 'graphite-dusk'],
  human: ['dawn-blush', 'magazine-paper', 'majlis-velvet', 'dawn-orchard'],
  book: ['ink-marble', 'majlis-velvet', 'magazine-paper', 'dawn-orchard'],
  general: ['observatory-night', 'dawn-blush', 'sadu-night', 'magazine-paper'],
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
  const number = Number.isFinite(parsedNumber) && parsedNumber >= 10 && parsedNumber <= 999 ? parsedNumber : null

  const strongLines = sentences
    .filter((sentence) => sentence.length >= 12 && sentence.length <= 70)
    .sort((a, b) => {
      const score = (line: string) =>
        (/(ليس|لا |لم |بل |وحده|كل |أخطر|الحقيقة|السؤال)/.test(line) ? 2 : 0) + (line.length <= 46 ? 1 : 0)
      return score(b) - score(a)
    })
    .slice(0, 6)
    .map((line) => tightLine(line))

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
  if (nudgedTopic === 'ai' || nudgedTopic === 'research') weigh('weave', 2)
  if (nudgedTopic === 'human' || nudgedTopic === 'family' || nudgedTopic === 'book') weigh('manuscript', 2)
  if (nudgedTopic === 'education') weigh('question', 1)
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
  const worldRandom = mulberry((seed ^ fnv(`${title}·عالم·${templateId}`)) >>> 0)
  const world = worldById.get(worldPool[Math.floor(worldRandom() * worldPool.length) % worldPool.length]) || WORLDS[0]
  rationale.push(`الموضوع «${nudgedTopic}» فتح عوالم: ${worldPool.map((id) => worldById.get(id)?.label).join(' · ')} — ووقع الاختيار على «${world.label}»`)

  /* المزاج الموسيقي: القالب يفرض طبعه أولاً، والنبرة تهذّبه. */
  const tonalMood = MOOD_BY_TONE[analysis.primaryTone]
  /* الإشراق الاحتفالي لا يليق بمادة ثقيلة: الذكاء والإعلام والرثاء تُخفَض
     نبرتها إلى الرصانة مهما بدت لغتها لامعة للمحلّل. */
  const grave = solemn || nudgedTopic === 'ai' || nudgedTopic === 'media'
  const softened: ReelMoodId | undefined = tonalMood === 'bright' && grave ? 'scholar' : tonalMood
  const mood: ReelMoodId =
    templateId === 'siren' ? 'dark'
      : templateId === 'manuscript' ? (solemn ? 'warm' : softened === 'bright' ? 'warm' : 'warm')
      : templateId === 'counter' ? (grave ? 'scholar' : 'bright')
      : templateId === 'question' ? (softened === 'warm' || softened === 'bright' ? softened : grave ? 'scholar' : 'dark')
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

  scenes.push({ kind: 'close', slug: `FINAL / ${String(scenes.length + 1).padStart(2, '0')}`, eyebrow: tightLine(title, 40), line: 'المقال كاملاً في الموقع', seconds: 3.6 })

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
    rationale,
  }
}

export const REEL_WORLDS = WORLDS
