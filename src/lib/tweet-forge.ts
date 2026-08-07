/**
 * مِسبَك التغريدات — كاتبُ تغريداتٍ عربيٌّ محليٌّ بالكامل
 *
 * يكتب تغريداتٍ من مادة الدكتور نفسها: مقالاته وكتبه وأبحاثه ولقاءاته
 * الإعلامية وأخبار الرادار الراهنة، أو من فكرةٍ حرّة يكتبها بيده.
 *
 * ثلاث قواعد تحكم هذا الملف:
 *
 * 1 ــ **لا يُنسب إليه ما لم يقله.** كل جملةٍ تخرج بين قوسين منسوبةً إلى متنٍ
 *     تمرّ على البوّابة نفسها التي تحكم «أصداء المتون» وبوت واتساب: موجودةٌ
 *     في المتن حرفاً بحرف أو لا تخرج. ما عدا ذلك فهو إطارٌ من الاستوديو،
 *     مكتوبٌ بصيغةٍ لا تدّعي قولاً.
 *
 * 2 ــ **بلا شبكة وبلا مقابل.** لا نموذج لغويّ ولا مفتاح API. التنويع يأتي من
 *     أربع عشرة زاويةً بلاغيةً مستقلة × بذرةٍ محكومةٍ بالنص، فلا تتكرر
 *     التغريدة ولا تتشابه الزوايا.
 *
 * 3 ــ **الانتشار مقيسٌ لا مُدَّعى.** كل تغريدةٍ تخرج بدرجةٍ وبأسبابها: ما
 *     رفعها وما خفضها، بإشاراتٍ يمكن للدكتور أن يراها ويحكم عليها بنفسه.
 *
 * ومخرجُ كل تغريدةٍ جاهزٌ للتسليم إلى «منشور مستقل» ليصير تصميماً.
 */

import { splitBodySentences, verifyEcho } from './voice-echoes'
import { resonanceCountOf } from './resonance-quotes'
import { interpretDrAhmadDomain } from './dr-ahmad-domain-glossary'
import { arabicCountPhrase, DAY_AFTER_PREPOSITION_FORMS, POINT_AFTER_PREPOSITION_FORMS } from './arabic-count.ts'

export const TWEET_FORGE_VERSION = '1.0.0'

/** حدّ منصّة X للتغريدة الكلاسيكية؛ العربية تُحسب حرفاً بحرف. */
export const TWEET_LIMIT = 280

/** النطاق الذي تنتشر فيه التغريدة العربية فعلاً: لا برقيةٌ ولا مقال. */
const SWEET_MIN = 120
const SWEET_MAX = 262

/** أدنى درجةٍ يُقبل عندها مفهومٌ من المعجم: ما دونها مطابقةٌ جزئية لا تعرّف. */
const MIN_CONCEPT_SCORE = 100

export type TweetSourceKind = 'article' | 'book' | 'paper' | 'media' | 'news' | 'free'

export interface TweetSource {
  kind: TweetSourceKind
  id: string
  title: string
  /** المتن أو الملخص أو الوصف — منه تُستخرج الجملة الموثّقة. */
  text?: string
  url?: string
  date?: string
  /** الجهة: المجلة للبحث، القناة للقاء، المصدر للخبر. */
  outlet?: string
  /**
   * ما ظلّله القرّاء في هذا المتن. هذه الجُمَل ليست اختيار الدكتور ولا اختيار
   * المحرك — الناسُ صوّتوا عليها بأصابعهم، فتتصدّر حوض الاقتباس وتُكافأ بالدرجة.
   */
  resonantLines?: readonly { text: string; count: number }[]
}

export type TweetAngleId =
  | 'core-claim'
  | 'paradox'
  | 'open-question'
  | 'figure'
  | 'myth-break'
  | 'rule'
  | 'three-points'
  | 'letter'
  | 'contrast'
  | 'redefine'
  | 'scene'
  | 'confession'
  | 'news-read'
  | 'invitation'

export interface TweetAngle {
  id: TweetAngleId
  label: string
  note: string
  /** الزوايا التي لا تصلح إلا لمصدرٍ بعينه. */
  only?: TweetSourceKind[]
}

export const TWEET_ANGLES: Record<TweetAngleId, TweetAngle> = {
  'core-claim': { id: 'core-claim', label: 'الجملة الحاكمة', note: 'أقوى جملةٍ في المتن تُقدَّم عاريةً بلا شرح.' },
  paradox: { id: 'paradox', label: 'المفارقة', note: 'طرفان متقابلان في سطرٍ واحد — أكثر ما يُقتبس.' },
  'open-question': { id: 'open-question', label: 'سؤالٌ مفتوح', note: 'سؤالٌ يفتح باباً ولا يغلقه بجواب.' },
  figure: { id: 'figure', label: 'الرقم أولاً', note: 'رقمٌ من المادة يتصدّر ثم يُفسَّر بجملة.' },
  'myth-break': { id: 'myth-break', label: 'كسر شائع', note: '«يُقال… والحقيقة» — بنيةٌ تستفزّ الردّ.' },
  rule: { id: 'rule', label: 'قاعدة مختصرة', note: 'حكمةٌ قابلةٌ للحفظ وإعادة النشر وحدها.' },
  'three-points': { id: 'three-points', label: 'ثلاث نقاط', note: 'ثلاثةُ أسطرٍ قصيرة — أعلى معدل حفظٍ ومشاركة.' },
  letter: { id: 'letter', label: 'رسالة إلى…', note: 'خطابٌ مباشر لفئةٍ بعينها فيشعر كلٌّ أنه المقصود.' },
  contrast: { id: 'contrast', label: 'بين هذا وذاك', note: 'مقابلةٌ صريحة تُظهر الفرق في سطرين.' },
  redefine: { id: 'redefine', label: 'تعريفٌ جديد', note: '«ليس… بل» — إعادة تعريفٍ تُنقل كما هي.' },
  scene: { id: 'scene', label: 'مشهدٌ قصير', note: 'صورةٌ محسوسة قبل الفكرة المجرّدة.' },
  confession: { id: 'confession', label: 'ما يُغفَل', note: 'يضع الإصبع على ما يمرّ عليه الناس بسرعة.' },
  'news-read': { id: 'news-read', label: 'قراءة في خبر', note: 'خبرٌ راهن يُقرأ بعينٍ تربوية.', only: ['news', 'media'] },
  invitation: { id: 'invitation', label: 'دعوةٌ هادئة', note: 'دعوةٌ للقراءة أو الحضور بلا إلحاح تسويقي.' },
}

export interface TweetSignal {
  /** مفتاحٌ ثابتٌ للمعايرة — لا يتغيّر بتغيّر النص المعروض. */
  key: string
  label: string
  weight: number
  /** الوزن قبل المعايرة، حين عايره الواقع. */
  baseWeight?: number
}

export interface TweetDraft {
  id: string
  angle: TweetAngleId
  angleLabel: string
  text: string
  chars: number
  overLimit: boolean
  /** جملةٌ منسوبةٌ للدكتور ومُتحقَّقٌ من وجودها في متنه حرفاً بحرف. */
  quote: string
  quoteVerified: boolean
  hashtags: string[]
  score: number
  signals: TweetSignal[]
  sourceId: string
  sourceKind: TweetSourceKind
  sourceTitle: string
  url: string
  /** النص المُسلَّم إلى «منشور مستقل» ليصير تصميماً. */
  standalonePost: string
  /** غرض التصميم المرافق للنص في المنشور المستقل. */
  designPurpose: string
  /** ميلُ الدفتر إلى هذه التغريدة (‎-1..1‎) — يظهر فقط بعد خمس عيّناتٍ من نشره. */
  tasteLean?: number
  /** كم قارئاً ظلّل الجملة التي بُنيت عليها هذه التغريدة. */
  resonanceCount?: number
}

export interface TweetThread {
  id: string
  sourceId: string
  sourceTitle: string
  tweets: string[]
  score: number
  url: string
}

export interface TweetForgeOptions {
  /** عدد التغريدات المعروضة بعد الفرز. */
  count?: number
  /** رقمُ الجولة — يغيّر كل شيء عند طلب «تنويع جديد». */
  variation?: number
  /** وسوم مقترحة؛ الافتراضي بلا وسوم (الوسم الزائد يخفض الوصول). */
  withHashtags?: boolean
  audience?: string
  /** زوايا بعينها؛ الافتراضي كل ما يصلح للمصدر. */
  angles?: TweetAngleId[]
  /**
   * دفتر «ما نُشر»: يمنع تكرار ما سبق نشره، ويرفع الزوايا التي يختارها الدكتور.
   * حُقن بدالتين لا بالنوع نفسه كي يبقى المسبك مستقلاً عن طبقة الخزن —
   * فيُختبر بلا Firestore ولا localStorage.
   */
  /** معايرةُ أوزان الإشارات بأرقام التفاعل الحقيقية (مفتاح ← مُضاعِف). */
  calibration?: Readonly<Record<string, number>>
  memory?: {
    /** هل نُشر هذا النص (أو ما يطابقه جوهراً) من قبل؟ */
    isPublished?: (text: string) => boolean
    /** قربُ التغريدة من ذوقه: ‎-1..1‎ — يرجّح الترتيب ولا يحكمه. */
    affinity?: (draft: { angle: TweetAngleId; sourceKind: TweetSourceKind; chars: number }) => number
  }
}

/* ------------------------------------------------------------------ */
/*                            أدواتٌ صغيرة                             */
/* ------------------------------------------------------------------ */

const clean = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const hashString = (value: string) => {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const pick = <T,>(list: readonly T[], seed: string): T => list[hashString(seed) % Math.max(1, list.length)]

const uniqueStrings = (list: string[]) => [...new Set(list.map((item) => clean(item)).filter(Boolean))]

const charCount = (value: string) => [...clean(value)].length

/** أدوات ونواسخ لا تصلح كلمةً محورية. */
const STOPWORDS = new Set([
  'من', 'في', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'الذين', 'كان', 'كانت',
  'يكون', 'تكون', 'قد', 'لقد', 'ثم', 'أو', 'أم', 'بل', 'لكن', 'لأن', 'حتى', 'كل', 'بعض', 'غير', 'بين',
  'عند', 'لدى', 'حين', 'بعد', 'قبل', 'أن', 'إن', 'ما', 'لا', 'لم', 'لن', 'هو', 'هي', 'هم', 'نحن', 'أنت',
  'كما', 'حيث', 'كذلك', 'أيضا', 'أيضاً', 'وهو', 'وهي', 'وقد', 'وما', 'ولا', 'فإن', 'إذا', 'إذ', 'الى',
])

const wordsOf = (value: string) => clean(value).split(/\s+/).filter(Boolean)

const stripPrefix = (word: string) => word.replace(/^(?:وال|فال|بال|كال|ال|و|ف|ب|ل|ك)/, '') || word

/* الكلمة كما تُعرض: تُنزع السوابق الملتصقة قبل أداة التعريف فقط. اللمحة الأمامية
   `(?=ال)` تحمي الكلمات التي تبدأ بالباء أصالةً («بحث»)، وبغيرها كانت الكلمة
   المحورية تخرج «بالمعرفة» فتصير الجملة «بين أن نتحدث عن بالمعرفة». */
const displayWord = (raw: string) => raw
  .replace(/^و(?=[بلك]?ال|لل)/, '')
  .replace(/^ف(?=[بلك]?ال|لل)/, '')
  .replace(/^[بك](?=ال)/, '')
  .replace(/^لل/, 'ال')

/* أسماءُ ذواتٍ لا مفاهيم. الخلط بينهما يُنتج جملاً مشوّهة من نوع «الفرق بين أن
   نعرف الطالب وأن نمارسه» — لذلك تُمنع من الزوايا التي تعامل الكلمة كمفهوم. */
const PERSON_WORDS = new Set([
  'الطالب', 'طالب', 'الطلاب', 'الطلبة', 'المعلم', 'معلم', 'المعلمين', 'المعلمون', 'الطفل', 'طفل', 'الأطفال',
  'الآباء', 'الأب', 'الأم', 'الأمهات', 'الأسرة', 'المدير', 'المديرة', 'الوزير', 'الناس', 'الجيل', 'الأجيال',
  'الباحث', 'الباحثين', 'المدرسة', 'المدارس', 'الجامعة', 'الصف', 'الفصل',
])

const isConceptWord = (word: string) => Boolean(word) && !PERSON_WORDS.has(word) && !PERSON_WORDS.has(stripPrefix(word))

/** أثقل كلمةٍ دلاليةً في النص — تصلح كلمةً بطلة للتصميم. */
function heroWordOf(...sources: string[]): string {
  const counts = new Map<string, { word: string; hits: number }>()
  for (const source of sources) {
    for (const raw of wordsOf(source)) {
      const word = raw.replace(/[^\p{L}\p{N}]/gu, '')
      if (word.length < 4 || STOPWORDS.has(word)) continue
      const key = stripPrefix(word)
      const entry = counts.get(key)
      if (entry) entry.hits += 1
      else counts.set(key, { word, hits: 1 })
    }
  }
  const ranked = [...counts.values()].sort((left, right) => right.hits - left.hits || right.word.length - left.word.length)
  return displayWord(ranked[0]?.word || '')
}

/** جُمَلٌ صالحةٌ للتغريد: أقصر من جُمَل الأصداء وأوسع نطاقاً. */
function tweetableSentences(text: string): string[] {
  return clean(text)
    .split(/(?<=[.!؟…])\s+|\n+/)
    .map((sentence) => sentence.replace(/^[\s«»"'—–-]+/, '').replace(/[\s«»"']+$/, '').trim())
    .filter((sentence) => {
      const size = charCount(sentence)
      return size >= 40 && size <= 200 && wordsOf(sentence).length >= 5
    })
}

const TURN = /(?:^|\s)(?:لكن|لكنّ|بل\s|غير أنّ|غير أن|والحقيقة|ومع ذلك|إنّما|إنما|لا\s.+\sبل)/
const NEGATION_OPENER = /^(?:لا\s|ليس|ليست|لسنا|ما\s)/
const CONCRETE = /(?:مدرسة|صف|بيت|أسرة|طفل|طالب|معلم|كتاب|سؤال|امتحان|درس|وقت|يد|باب|طريق|مقعد|ساعة|يوم)/

/** جملةٌ قابلةٌ للاقتباس وحدها: قصيرةٌ، فيها حكمٌ، وتقف بذاتها. */
function scoreQuotable(sentence: string): number {
  const size = charCount(sentence)
  const lengthFit = size >= 45 && size <= 130 ? 1 : size <= 160 ? .6 : .25
  const turn = TURN.test(sentence) ? .4 : 0
  const opener = NEGATION_OPENER.test(sentence) ? .25 : 0
  const concrete = CONCRETE.test(sentence) ? .25 : 0
  const dangling = /^(?:و?هذا|و?هذه|و?ذلك|و?تلك|و?هنا|و?لذلك|و?لهذا|و?ثم|أما)\b/.test(sentence) ? -.8 : 0
  return lengthFit + turn + opener + concrete + dangling
}

/** أقوى جملةٍ صالحةٍ للتغريد داخل متنٍ واحد. */
function bestTweetableLine(text: string, title: string, offset = 0): string {
  const pool = tweetableSentences(text).filter((sentence) => sentence !== clean(title))
  if (!pool.length) return ''
  const ranked = [...pool].sort((left, right) => scoreQuotable(right) - scoreQuotable(left))
  return ranked[Math.abs(offset) % ranked.length] || ''
}

/** رقمٌ أو نسبةٌ حقيقيةٌ في المادة — لا يُخترع رقمٌ أبداً. */
function figureOf(text: string): { value: string; sentence: string } | null {
  for (const sentence of tweetableSentences(text)) {
    const match = sentence.match(/(\d+(?:[.,]\d+)?\s*(?:٪|%)|\d{2,4})/)
    if (match) return { value: match[1].replace(/\s+/g, ''), sentence }
  }
  return null
}

function questionOf(text: string, title: string): string {
  const fromTitle = /[؟?]/.test(title) ? clean(title) : ''
  if (fromTitle) return fromTitle
  return tweetableSentences(text).find((sentence) => /[؟?]/.test(sentence)) || ''
}

function contrastOf(text: string): string {
  return tweetableSentences(text).find((sentence) => TURN.test(sentence)) || ''
}

/** ثلاثُ جملٍ متمايزةٍ من المتن — لا تتكرر ولا تتداخل. */
function threePointsOf(text: string, title: string): string[] {
  const pool = tweetableSentences(text)
    .filter((sentence) => sentence !== clean(title))
    .sort((left, right) => scoreQuotable(right) - scoreQuotable(left))
  const chosen: string[] = []
  for (const sentence of pool) {
    const shortened = clean(sentence).replace(/[.،]$/, '')
    if (charCount(shortened) > 95) continue
    if (chosen.some((item) => item.slice(0, 22) === shortened.slice(0, 22))) continue
    chosen.push(shortened)
    if (chosen.length === 3) break
  }
  return chosen
}

const KIND_WORD: Record<TweetSourceKind, string> = {
  article: 'مقالي',
  book: 'كتابي',
  paper: 'بحثي',
  media: 'لقائي',
  news: 'الخبر',
  free: '',
}

const AUDIENCE_CALLS = ['المعلّمين', 'الآباء', 'طلبتي', 'زملائي في الميدان', 'كل من يربّي', 'من يصنع القرار التربوي']

/* ------------------------------------------------------------------ */
/*                        قياس الانتشار — بلا ادّعاء                    */
/* ------------------------------------------------------------------ */

const JARGON = /(?:إشكالية|براديغم|إبستمولوجي|سوسيولوجي|ميتودولوجي|في ضوء ما تقدم|من خلال ما سبق|وعليه فإن)/

/**
 * درجةُ قابلية إعادة النشر. كل إشارةٍ فيها قابلةٌ للفحص بالعين، ولا تدّعي
 * تنبؤاً بالأرقام: تقيس بنيةَ النص لا مستقبله.
 */
export function scoreTweet(
  text: string,
  options: {
    hasQuote?: boolean
    hashtags?: number
    links?: number
    resonance?: number
    /**
     * معايرةٌ من الواقع: مُضاعِفٌ لكل مفتاح إشارة، مشتقٌّ من أرقام التفاعل التي
     * أدخلها الدكتور لتغريداتٍ نشرها. غيابها يعني أن الوزن يبقى كما قدّرتُه —
     * فالأداة تفترض حتى تتعلّم، ولا تدّعي أنها تعلّمت قبل أن تُقاس.
     */
    calibration?: Readonly<Record<string, number>>
  } = {},
) {
  const body = clean(text)
  const size = charCount(body)
  const head = body.slice(0, 45)
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const sentences = body.split(/(?<=[.!؟…])\s+/).filter(Boolean)
  const averageWords = sentences.length ? wordsOf(body).length / sentences.length : wordsOf(body).length
  const signals: TweetSignal[] = []
  let score = 46

  /* لكل إشارةٍ مفتاحٌ ثابتٌ لا يتغيّر بتغيّر نصّها المعروض — بلا ذلك تعذّرت
     معايرتها بالواقع (لاحظ أن نصّ إشارة الرنين يحمل عدداً متغيّراً). */
  const add = (key: string, label: string, weight: number) => {
    const tuned = Math.round(weight * (options.calibration?.[key] ?? 1))
    score += tuned
    signals.push({ key, label, weight: tuned, ...(tuned !== weight ? { baseWeight: weight } : {}) })
  }

  if (/[؟?]/.test(head) || /^\d|^لا\s|^ليس|^حين|^أخطر|^أصعب|^ثلاث/.test(head)) add('hook', 'خطّافٌ في أول سطر', 11)
  else add('no-hook', 'البداية تقريرية — لا خطّاف', -8)

  if (size >= SWEET_MIN && size <= SWEET_MAX) add('length-sweet', 'طولٌ في نطاق الانتشار', 10)
  else if (size < SWEET_MIN) add('length-short', 'أقصر من أن تحمل فكرة', -9)
  else add('length-long', 'أطول من نطاق القراءة السريعة', -7)

  if (TURN.test(body)) add('turn', 'فيها منعطفٌ يقلب المعنى', 9)
  if (lines.length >= 3 && lines.length <= 5) add('breathing-lines', 'مُقطَّعةٌ إلى أسطر تُقرأ بلمحة', 7)
  if (lines.length === 1 && size > 190) add('one-block', 'كتلةٌ واحدة بلا تنفّس', -6)

  if (averageWords <= 12) add('short-sentences', 'جُملٌ قصيرة سريعة الالتقاط', 6)
  else if (averageWords > 20) add('long-sentences', 'جُملٌ طويلة تُبطئ القراءة', -7)

  if (CONCRETE.test(body)) add('concrete', 'صورةٌ محسوسة لا تجريد', 5)
  if (JARGON.test(body)) add('jargon', 'لغةٌ أكاديمية تُبعد القارئ العام', -12)

  if (options.hasQuote) add('verified-quote', 'جملةٌ موثّقةٌ من متن الدكتور', 8)
  /* الرنين دليلٌ من الواقع لا تقديرٌ بلاغي: قارئٌ ظلّلها بإصبعه. ولذلك يكافأ
     أعلى من كل إشارةٍ أخرى، وبتدرّجٍ يحترم عدد من ظلّل. */
  if (options.resonance) add('resonance', `سطرٌ ظلّله ${options.resonance} من القرّاء`, Math.min(16, 8 + options.resonance * 2))

  const endsWell = !/https?:\/\/\S*$/.test(body) && !/#\S+$/.test(body)
  if (endsWell) add('ends-well', 'تنتهي بمعنى لا برابط', 6)
  else add('ends-badly', 'تنتهي برابطٍ أو وسم فيضيع الأثر', -6)

  const hashtags = options.hashtags ?? (body.match(/#\S+/g) || []).length
  if (hashtags === 0) add('no-hashtags', 'بلا وسوم — أنقى للوصول', 4)
  else if (hashtags <= 2) add('two-hashtags', 'وسمان على الأكثر', 2)
  else add('many-hashtags', 'وسومٌ كثيرة تخفض الوصول', -10)

  const links = options.links ?? (body.match(/https?:\/\/\S+/g) || []).length
  if (links > 1) add('many-links', 'أكثر من رابطٍ واحد', -8)

  if (/^(?:في مقالي|في كتابي|اقرأ|شاهد|حمّل)/.test(body)) add('promo-opener', 'تفتح بترويجٍ لا بفكرة', -11)
  if (/[!]{2,}|[؟]{2,}/.test(body)) add('repeated-marks', 'علاماتٌ مكرّرة تُضعف الرصانة', -5)
  if (/[\u{1F300}-\u{1FAFF}]/u.test(body)) add('emoji', 'رموزٌ تعبيرية — خارج نبرة الموقع', -4)

  const quotableLine = lines.find((line) => scoreQuotable(line) >= 1.4)
  if (quotableLine) add('quotable-line', 'فيها سطرٌ يُقتبس وحده', 9)

  return { score: Math.max(0, Math.min(99, Math.round(score))), signals: signals.sort((a, b) => b.weight - a.weight) }
}

/* ------------------------------------------------------------------ */
/*                            بناء التغريدات                           */
/* ------------------------------------------------------------------ */

interface SourceReading {
  title: string
  text: string
  quote: string
  quoteVerified: boolean
  hero: string
  /** كلمةٌ محوريةٌ تصلح مفهوماً (لا اسمَ ذات) — شرطُ زوايا التعريف والمقابلة. */
  conceptHero: string
  figure: { value: string; sentence: string } | null
  question: string
  contrast: string
  points: string[]
  url: string
  /** جُملُ المتن مرتّبةً بقابلية الاقتباس — لتدوير الاقتباس بين الزوايا. */
  pool: string[]
  raw: string
  resonant: readonly { text: string; count: number }[]
  /** مفاهيم الدكتور المعياريّة التي تعرّف عليها المعجم في هذه المادة. */
  concepts: string[]
}

function readSource(source: TweetSource, offset: number): SourceReading {
  const title = clean(source.title)
  const text = clean(source.text || '')
  const raw = String(source.text || '')
  const resonant = source.resonantLines || []
  /* رنينُ القرّاء يتصدّر الحوض: جملةٌ ظلّلها سبعةُ قرّاء أثبتت بالفعل أنها
     تستوقف، وهذا دليلٌ لا يملكه أيّ ترتيبٍ بلاغيّ. وترتيبُها بينها بعدد من
     ظلّلها، ثم يأتي بعدها ترتيبُ الجودة المعتاد. */
  const pool = tweetableSentences(text)
    .filter((sentence) => sentence !== title)
    .sort((left, right) => {
      const leftEcho = resonanceCountOf(left, resonant)
      const rightEcho = resonanceCountOf(right, resonant)
      if (leftEcho !== rightEcho) return rightEcho - leftEcho
      return scoreQuotable(right) - scoreQuotable(left)
    })
  const candidate = pool[Math.abs(offset) % Math.max(1, pool.length)] || ''
  /* البوّابة نفسها التي تحكم أصداء المتون: ما لم يوجد في المتن حرفاً بحرف
     لا يخرج بين قوسين ولا يُنسب إلى الدكتور. */
  const quoteVerified = Boolean(candidate) && (verifyEcho(candidate, raw) || verifyEcho(candidate, text))
  /* الكلمة المحورية من العنوان أولاً: احتسابها من المتن بالتكرار كان يرفع
     «الطالب» فوق «التلعيب» لأن الذوات تتكرر أكثر من المفاهيم. */
  /* المعجم أولاً: 290 مفهوماً و1322 اسماً تُشغّل بوت الدكتور، وكان المسبك
     يجهلها فيستخرج الكلمة المحورية بالتكرار وحده. المصطلح المعياري من معجمه
     أدقّ من أثقل كلمةٍ في النص — «التقويم البديل» لا «التقويم» وحدها.

     والعتبة ضرورية: المطابقة الجزئية تُنتج مفاهيم لا وجود لها في النص. نصٌّ
     أسريٌّ لا رقمَ فيه طابق «الأسرة الرقمية» فخرج مفهوم «التربية الرقمية»
     بدرجة 86، بينما المطابقة التامة «التقويم البديل» تبلغ 124. فما دون المئة
     تخمينٌ لا تعرّف. */
  const understanding = interpretDrAhmadDomain(title, text)
  const solidConcepts = understanding.recognizedTerms.filter((term) => term.kind === 'concept' && term.score >= MIN_CONCEPT_SCORE)
  const glossaryHero = solidConcepts[0]?.canonicalAr || ''
  const titleHero = heroWordOf(title || pool[0] || '')
  const hero = glossaryHero || titleHero || heroWordOf(title, text)
  return {
    title,
    text,
    raw,
    pool,
    quote: quoteVerified ? candidate : '',
    quoteVerified,
    hero,
    conceptHero: isConceptWord(hero) ? hero : '',
    figure: figureOf(text),
    question: questionOf(text, title),
    contrast: contrastOf(text),
    points: threePointsOf(text, title),
    url: clean(source.url || ''),
    resonant,
    concepts: solidConcepts.map((term) => term.canonicalAr).slice(0, 4),
  }
}

/**
 * سحبُ جملةٍ لم تُستعمل بعد. التدوير بالبذرة وحده لم يكفِ: الجملة الأقوى في
 * المتن كانت تُنتقى لثلاث زوايا معاً فتخرج ثلاث تغريداتٍ بنصٍّ واحد وإطارٍ
 * مختلف — وهو التكرار نفسه الذي شكا منه الدكتور في التصاميم.
 */
function takeLine(reading: SourceReading, taken: Set<string>, seed: string, predicate?: (sentence: string) => boolean): string {
  const pool = predicate ? reading.pool.filter(predicate) : reading.pool
  if (!pool.length) return ''
  const start = hashString(seed) % pool.length
  for (let step = 0; step < pool.length; step += 1) {
    const candidate = pool[(start + step) % pool.length]
    if (!taken.has(candidate)) return candidate
  }
  return pool[start]
}

/** يقصّ الجملة إلى حدٍّ مع المحافظة على حدود الكلمات. */
function trimTo(value: string, limit: number): string {
  const text = clean(value)
  if (charCount(text) <= limit) return text
  const words = wordsOf(text)
  const out: string[] = []
  for (const word of words) {
    if (charCount([...out, word].join(' ')) > limit - 1) break
    out.push(word)
  }
  return `${out.join(' ')}…`
}

/*
 * الأُطر المكتوبة هنا من الاستوديو لا من الدكتور، ولذلك تلتزم قاعدةً صارمة:
 * لا تدّعي واقعةً في سيرته («غيّرتُ رأيي»، «استغرقت سنوات»)، ولا تنسب رأياً
 * إلى أحد. كلها صيغٌ بلاغيةٌ محايدة تُقدّم جملته هي.
 */
type Take = (seed: string, predicate?: (sentence: string) => boolean) => string
type Composer = (reading: SourceReading, source: TweetSource, seed: string, take: Take) => string[] | string | null

const COMPOSERS: Record<TweetAngleId, Composer> = {
  'core-claim': (_r, _s, seed, take) => {
    const line = take(seed)
    return line ? [`«${trimTo(line, 190)}»`, '', 'جملةٌ من متني أتركها كما هي.'] : null
  },

  paradox: (_r, _s, seed, take) => {
    const line = take(seed, (sentence) => TURN.test(sentence)) || take(seed)
    if (!line) return null
    return [trimTo(line, 210), '', 'المفارقة هنا ليست خطأً في القراءة.']
  },

  'open-question': (r, _s, seed) => {
    const question = r.question || (r.conceptHero ? `${r.conceptHero}: هل نصنعه أم نتوارثه؟` : '')
    if (!question) return null
    const closers = [
      'سؤالٌ أتركه لكم بلا جوابٍ جاهز.',
      'أسأل، ولا أزعم أن الجواب محسوم.',
      'أجيبوني بصدق — لا بما يُقال عادةً.',
    ]
    return [question.replace(/[.،]$/, ''), '', pick(closers, `${seed}:q`)]
  },

  figure: (r) => {
    if (!r.figure) return null
    return [r.figure.value, '', trimTo(r.figure.sentence, 200)]
  },

  'myth-break': (_r, _s, seed, take) => {
    const line = take(seed, (sentence) => TURN.test(sentence)) || take(seed)
    if (!line) return null
    const openers = ['يُختصر هذا كثيراً في جملةٍ واحدة.', 'المسألة تبدو محسومةً من بعيد.', 'الاختصار هنا يُفقد المعنى نصفه.']
    return [pick(openers, `${seed}:m`), 'والأدقّ من ذلك:', trimTo(line, 185)]
  },

  rule: (_r, _s, seed, take) => {
    const line = take(seed)
    if (!line) return null
    const short = trimTo(line, 150).replace(/[.،]$/, '')
    return [short, '', 'قاعدةٌ تُقاس بالعمل لا بالشعار.']
  },

  'three-points': (r) => {
    if (r.points.length < 3) return null
    const heading = r.conceptHero ? `ثلاثُ ملاحظات عن ${r.conceptHero}:` : 'ثلاثُ ملاحظات:'
    const body = r.points.map((point, index) => `${index + 1}. ${trimTo(point, 62)}`)
    return [heading, ...body]
  },

  letter: (r, _s, seed, take) => {
    const line = take(seed) || r.title
    if (!line) return null
    return [`إلى ${pick(AUDIENCE_CALLS, `${seed}:a`)}:`, '', trimTo(line, 190)]
  },

  contrast: (r, _s, seed, take) => {
    if (!r.conceptHero) return null
    const line = take(seed)
    if (!line) return null
    return [`بين أن نتحدث عن ${r.conceptHero} وأن نمارسه مسافةٌ كاملة:`, '', trimTo(line, 175)]
  },

  redefine: (r, _s, seed, take) => {
    if (!r.conceptHero) return null
    const line = take(seed)
    if (!line) return null
    return [`${r.conceptHero} ليس ما يبدو عليه.`, '', trimTo(line, 195)]
  },

  scene: (_r, _s, seed, take) => {
    const line = take(seed, (sentence) => CONCRETE.test(sentence))
    if (!line) return null
    const openers = ['مشهدٌ مألوف:', 'تأمّلوا هذا المشهد:', 'صورةٌ تتكرر في الميدان:']
    return [pick(openers, `${seed}:s`), '', trimTo(line, 195)]
  },

  confession: (_r, _s, seed, take) => {
    const line = take(seed)
    if (!line) return null
    const openers = ['ما لا يُقال عادةً في هذا الباب:', 'الأمر الذي يُغفَل كثيراً:', 'ما يستحق أن يُقال بصراحة:']
    return [pick(openers, `${seed}:c`), '', trimTo(line, 190)]
  },

  'news-read': (r, source, seed, take) => {
    const headline = trimTo(r.title, 120)
    if (!headline) return null
    const line = take(seed)
      || (r.conceptHero ? `والسؤال التربوي: أين موقع ${r.conceptHero} من هذا؟` : '')
    if (!line) return null
    return [headline, '', trimTo(line, 130), source.outlet ? `(المصدر: ${clean(source.outlet)})` : '']
  },

  invitation: (r, source, seed, take) => {
    const word = KIND_WORD[source.kind]
    const line = take(seed) || r.title
    if (!line || !word) return null
    return [trimTo(line, 175), '', `تفصيلُ ذلك في ${word} «${trimTo(r.title, 55)}».`]
  },
}

/* الوسوم تُشتقّ من الفكرة نفسها. الحوض الثابت المنتقى بالبذرة كان يضع
   «#الكويت #الأسرة» على فكرةٍ عن التلعيب — وسمٌ لا يخدم بل يُشتّت. */
const HASHTAG_TOPICS: { test: RegExp; tags: string[] }[] = [
  { test: /تلعيب|لعبة|ألعاب|الدافعي|دافعية|تحفيز/, tags: ['#التلعيب', '#الدافعية'] },
  { test: /ذكاء اصطناع|خوارزم|رقمن|رقمي|تقنية|تكنولوجيا|منصة|افتراضي/, tags: ['#الذكاء_الاصطناعي', '#التعليم_الرقمي'] },
  { test: /تقويم|امتحان|اختبار|درجات|قياس|نتائج/, tags: ['#التقويم', '#الامتحانات'] },
  { test: /قراءة|كتاب|مكتبة|مطالعة/, tags: ['#القراءة'] },
  { test: /أسرة|أسري|والدين|آباء|أمهات|بيت|تنشئة/, tags: ['#الأسرة', '#التربية'] },
  { test: /معلم|معلمين|مدرّس|مدرس|هيئة تدريس/, tags: ['#المعلم'] },
  { test: /منهج|مناهج|مقرر|خطة دراسية/, tags: ['#المناهج'] },
  { test: /جامعة|جامعي|تعليم عال|بحث علمي|أكاديمي|دراسات عليا/, tags: ['#التعليم_العالي'] },
  { test: /موهوب|موهبة|إبداع|ابتكار|تفكير ناقد/, tags: ['#الإبداع', '#التفكير_الناقد'] },
  { test: /طفل|طفولة|روضة|رياض الأطفال/, tags: ['#الطفولة'] },
  { test: /مهارات|المستقبل|سوق العمل|قرن/, tags: ['#مهارات_المستقبل'] },
  { test: /سياسة تعليمية|وزارة|إصلاح|تطوير التعليم|قرار تربوي/, tags: ['#تطوير_التعليم'] },
  { test: /الكويت|كويتي|الخليج|خليجي/, tags: ['#الكويت'] },
  { test: /نفسي|صحة نفسية|قلق|ضغط|احتراق/, tags: ['#الصحة_النفسية'] },
]

const HASHTAG_FALLBACK = ['#التعليم', '#التربية']

/** وسمان على الأكثر، مشتقّان من نص الفكرة — والأقرب دلالةً أولاً. */
/** يحوّل مصطلحاً إلى وسمٍ صالح: كلمةٌ واحدة أو كلمتان بشرطةٍ سفلية. */
function conceptTag(concept: string): string {
  const words = wordsOf(concept).filter((word) => !STOPWORDS.has(word))
  if (!words.length || words.length > 2) return ''
  const tag = words.join('_').replace(/[^\p{L}\p{N}_]/gu, '')
  return tag.length >= 4 ? `#${tag}` : ''
}

function hashtagsFor(reading: SourceReading): string[] {
  const haystack = `${reading.title} ${reading.text}`
  /* **مفاهيمه أولاً.** المعجم يعرف 290 مفهوماً من اصطلاح الدكتور نفسه، وهي
     أدقّ من قائمةٍ عامّةٍ كتبتُها أنا. القائمة تبقى شبكةَ أمانٍ حين يصمت المعجم. */
  const conceptTags = reading.concepts.map(conceptTag).filter(Boolean)
  const matched = HASHTAG_TOPICS.filter((topic) => topic.test.test(haystack)).flatMap((topic) => topic.tags)
  /* الكلمة المحورية وسماً حين تكون كلمةً واحدةً نظيفة لا تكرّر ما اختير. */
  const heroTag = reading.conceptHero ? conceptTag(reading.conceptHero) : ''
  const ordered = uniqueStrings([...conceptTags, heroTag, ...matched, ...HASHTAG_FALLBACK])
  return ordered.slice(0, 2)
}

function assemble(parts: string[], reading: SourceReading, options: { withHashtags: boolean; url: string }) {
  const lines = parts.map((line) => clean(line))
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const hashtags = options.withHashtags ? hashtagsFor(reading) : []
  const tail = [options.url, hashtags.join(' ')].filter(Boolean).join('\n')
  if (tail && charCount(`${text}\n\n${tail}`) <= TWEET_LIMIT) text = `${text}\n\n${tail}`
  else if (options.url && charCount(`${text}\n\n${options.url}`) <= TWEET_LIMIT) text = `${text}\n\n${options.url}`
  return { text, hashtags }
}

/** أي الزوايا تصلح لهذا المصدر. */
export function anglesForSource(source: TweetSource): TweetAngleId[] {
  return (Object.keys(TWEET_ANGLES) as TweetAngleId[]).filter((id) => {
    const only = TWEET_ANGLES[id].only
    if (only) return only.includes(source.kind)
    if (source.kind === 'news' && id === 'invitation') return false
    return true
  })
}

/**
 * يبني التغريدات من مصدرٍ واحد، مرتّبةً بدرجة الانتشار، بلا تكرار.
 * ما لا تصلح له الزاوية يسقط بصمتٍ بدل أن يخرج نصاً ركيكاً.
 */
export function buildTweets(source: TweetSource, options: TweetForgeOptions = {}): TweetDraft[] {
  const variation = Math.max(0, Math.floor(options.variation || 0))
  const withHashtags = Boolean(options.withHashtags)
  const seedBase = `tweet:${source.kind}:${source.id}:${variation}`
  const reading = readSource(source, variation)
  const allowed = options.angles?.length ? options.angles.filter((id) => id in TWEET_ANGLES) : anglesForSource(source)
  const drafts: TweetDraft[] = []
  const seenHeads = new Set<string>()
  /* جُمَلٌ حُجزت لزاويةٍ سابقة. الحوض يُستهلك بالترتيب، وحين ينفد تُعاد الاستعانة
     به (المتون القصيرة لا تحتمل أربع عشرة جملةً متمايزة). */
  const takenLines = new Set<string>()

  for (const angle of allowed) {
    const seed = `${seedBase}:${angle}`
    let claimed = ''
    const take: Take = (lineSeed, predicate) => {
      const line = takeLine(reading, takenLines, lineSeed, predicate)
      if (line) claimed = line
      return line
    }
    const composed = COMPOSERS[angle](reading, source, seed, take)
    if (!composed) continue
    const parts = Array.isArray(composed) ? composed : [composed]
    if (!parts.filter(Boolean).length) continue
    if (claimed) takenLines.add(claimed)
    const { text, hashtags } = assemble(parts, reading, { withHashtags, url: reading.url })
    const head = clean(text).slice(0, 30)
    if (seenHeads.has(head)) continue
    seenHeads.add(head)
    const chars = charCount(text)
    /* البوّابة تُطبَّق على الجملة التي خرجت فعلاً في هذه التغريدة، لا على جملةٍ
       عامةٍ للمصدر — فالزوايا صارت تدوّر بين جُمَل المتن. */
    const usedLine = reading.pool.find((sentence) => {
      /* بعض الزوايا تنزع النقطة الأخيرة، فالمطابقة تُجرَّد من الترقيم الطرفي
         وإلا سقطت جملةٌ موثّقةٌ من العدّ لفارقِ نقطة. */
      const shown = trimTo(sentence, 60).replace(/[….،]+$/, '')
      return shown.length > 12 && text.includes(shown)
    }) || ''
    const lineVerified = Boolean(usedLine) && (verifyEcho(usedLine, reading.raw) || verifyEcho(usedLine, reading.text))
    const resonance = usedLine ? resonanceCountOf(usedLine, reading.resonant) : 0
    const measured = scoreTweet(text, { hasQuote: lineVerified, hashtags: hashtags.length, links: reading.url ? 1 : 0, resonance, calibration: options.calibration })
    drafts.push({
      id: `tw-${hashString(`${seed}:${text}`).toString(16)}`,
      angle,
      angleLabel: TWEET_ANGLES[angle].label,
      text,
      chars,
      overLimit: chars > TWEET_LIMIT,
      quote: lineVerified ? usedLine : '',
      quoteVerified: lineVerified,
      ...(resonance ? { resonanceCount: resonance } : {}),
      hashtags,
      score: measured.score,
      signals: measured.signals,
      sourceId: source.id,
      sourceKind: source.kind,
      sourceTitle: reading.title,
      url: reading.url,
      standalonePost: standalonePostOf(text, reading),
      designPurpose: designPurposeOf(angle, reading),
    })
  }

  /* الدفتر يعمل على طبقتين: يحذف ما نُشر حذفاً (لا تكرار أبداً)، ويرجّح ما
     يشبه ذوقه ترجيحاً (‎±14‎ نقطة) — فالذوق يقدّم ولا يُقصي، والدرجة المعروضة
     تبقى درجة النص نفسه لا درجةً مضروبةً في هوى. */
  const published = options.memory?.isPublished
  const affinity = options.memory?.affinity
  const ranked = drafts
    .filter((draft) => !draft.overLimit)
    .filter((draft) => !published || !published(draft.text))
    .map((draft) => ({ draft, lean: affinity ? affinity(draft) : 0 }))
    .sort((left, right) => (right.draft.score + right.lean * 14) - (left.draft.score + left.lean * 14)
      || left.draft.angle.localeCompare(right.draft.angle))
  return ranked
    .map(({ draft, lean }) => lean ? { ...draft, tasteLean: Number(lean.toFixed(3)) } : draft)
    .slice(0, Math.max(1, options.count || 8))
}

/** نصُّ «منشور مستقل»: بلا رابطٍ ولا وسوم — التصميم لا يقرأ الروابط. */
function standalonePostOf(text: string, reading: SourceReading): string {
  const stripped = text
    .split('\n')
    .filter((line) => !/^https?:\/\//.test(line.trim()) && !/^#/.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return reading.hero ? `${stripped}` : stripped
}

function designPurposeOf(angle: TweetAngleId, reading: SourceReading): string {
  const base = TWEET_ANGLES[angle].note
  return reading.hero ? `${base} الكلمة المحورية: ${reading.hero}.` : base
}

/**
 * خيطٌ من مادةٍ واحدة: افتتاحيةٌ ثم نقاطٌ من المتن ثم خاتمةٌ تدعو للقراءة.
 * كل جملةٍ في الخيط من المتن نفسه — لا إضافةَ رأيٍ لم يكتبه.
 */
export function buildThread(source: TweetSource, options: TweetForgeOptions = {}): TweetThread | null {
  const variation = Math.max(0, Math.floor(options.variation || 0))
  const reading = readSource(source, variation)
  const pool = tweetableSentences(reading.text)
    .filter((sentence) => sentence !== reading.title)
    .sort((left, right) => scoreQuotable(right) - scoreQuotable(left))
  if (pool.length < 3) return null
  const chosen: string[] = []
  for (const sentence of pool) {
    if (chosen.some((item) => item.slice(0, 24) === sentence.slice(0, 24))) continue
    chosen.push(sentence)
    if (chosen.length === 5) break
  }
  const opener = reading.question
    ? `${reading.question.replace(/[.،]$/, '')}\n\nخيطٌ قصير في ${arabicCountPhrase(chosen.length, POINT_AFTER_PREPOSITION_FORMS)}.`
    : `${trimTo(reading.title, 90)}\n\nخيطٌ قصير في ${arabicCountPhrase(chosen.length, POINT_AFTER_PREPOSITION_FORMS)}.`
  const body = chosen.map((sentence, index) => `${index + 1}/${chosen.length}\n${trimTo(sentence, 240)}`)
  const word = KIND_WORD[source.kind] || 'المادة'
  const closer = reading.url
    ? `التفصيل في ${word} «${trimTo(reading.title, 60)}»:\n${reading.url}`
    : `التفصيل في ${word} «${trimTo(reading.title, 60)}».`
  const tweets = [opener, ...body, closer].map((tweet) => tweet.replace(/\n{3,}/g, '\n\n').trim()).filter(Boolean)
  const score = Math.round(tweets.reduce((sum, tweet) => sum + scoreTweet(tweet).score, 0) / tweets.length)
  return { id: `thr-${hashString(`${source.id}:${variation}`).toString(16)}`, sourceId: source.id, sourceTitle: reading.title, tweets, score, url: reading.url }
}

/**
 * دفعةٌ من مصادر متعددة: أفضل تغريدةٍ أو اثنتين من كل مصدر، مرتّبةً بالدرجة.
 * هكذا يرى الدكتور «ماذا أغرّد اليوم؟» من أرشيفه كله في نظرةٍ واحدة.
 */
export function buildTweetBatch(sources: readonly TweetSource[], options: TweetForgeOptions & { perSource?: number } = {}): TweetDraft[] {
  const perSource = Math.max(1, options.perSource || 2)
  const all = sources.flatMap((source) => buildTweets(source, { ...options, count: perSource }))
  return all
    .sort((left, right) => right.score - left.score || left.sourceTitle.localeCompare(right.sourceTitle))
    .slice(0, Math.max(1, options.count || 12))
}

/* ------------------------------------------------------------------ */
/*                            خطة الأسبوع                              */
/* ------------------------------------------------------------------ */

export interface WeeklyTweetDay {
  /** 0 = اليوم، 6 = بعد ستة أيام. */
  offset: number
  /** التاريخ بتوقيت الكويت — يوماً واسماً. */
  dayLabel: string
  iso: string
  draft: TweetDraft | null
  /** لماذا هذه المادة في هذا اليوم — يُعرض للدكتور فيقرّ أو يبدّل. */
  reason: string
  /** مناسبةٌ تقع في هذا اليوم إن وُجدت. */
  occasion?: string
}

export interface WeeklyTweetPlan {
  days: WeeklyTweetDay[]
  filled: number
  averageScore: number
  /** مصادرُ لم تدخل الخطة لأنها نُشرت قريباً — للشفافية لا للحجب الصامت. */
  skipped: string[]
}

const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/**
 * سبعةُ أيامٍ، لكل يومٍ تغريدةٌ من مادةٍ مختلفة وزاويةٍ مختلفة.
 *
 * ثلاث قواعد تحكم التوزيع:
 *  • **لا يتكرر مصدرٌ ولا زاوية في الأسبوع الواحد** — سبعة أيامٍ بصوتٍ واحد ملل.
 *  • **المناسبة تتصدّر يومها.** يوم المناسبة (رمضان/عيد/وطني) يأخذ أقرب مادةٍ
 *    إليها إن وُجدت، وإلا يبقى بمادته العادية مع ذكر المناسبة للدكتور.
 *  • **الخبر الراهن لا يؤجَّل.** إن وُجدت مادةٌ من الرادار وُضعت في أول يومٍ
 *    ممكن، لأن الراهن يفسد بالانتظار.
 *
 * والصمتُ مسموح: يومٌ لا يجد مادةً تستحق يخرج فارغاً بسببٍ مكتوب، ولا يُملأ
 * بتغريدةٍ ضعيفة.
 */
export function buildWeeklyTweetPlan(
  sources: readonly TweetSource[],
  options: TweetForgeOptions & {
    /** بداية الأسبوع؛ تُمرَّر لأن المحرك لا يقرأ الساعة بنفسه (قابليةُ الاختبار). */
    startDate: Date
    /** مناسبةُ يومٍ بعينه: تُستدعى لكل يومٍ فتعيد اسم المناسبة أو لا شيء. */
    occasionOf?: (date: Date) => string | null
    /** أيامُ التهدئة قبل إعادة الطَرق على المصدر نفسه. */
    cooldownDays?: number
    /** كم يوماً مضى على آخر نشرٍ من هذا المصدر (null = لم يُنشر قط). */
    daysSinceSource?: (sourceId: string) => number | null
  },
): WeeklyTweetPlan {
  const cooldown = Math.max(0, options.cooldownDays ?? 21)
  const skipped: string[] = []
  const pool = sources.filter((source) => {
    const since = options.daysSinceSource?.(source.id)
    if (since != null && since < cooldown) { skipped.push(`${source.title} (نُشر قبل ${arabicCountPhrase(since, DAY_AFTER_PREPOSITION_FORMS)})`); return false }
    return true
  })

  /* **أربعةُ مرشحين لكل مادة لا مرشحٌ واحد.** المرشح الواحد كان يُسقط المادة
     كلها متى كانت زاويتها الأقوى محجوزةً ليومٍ سابق — فامتلأ يومٌ وبقيت ستة
     فارغةً وفي الأرشيف مادةٌ وفيرة. الآن لكل مادةٍ زواياها البديلة. */
  const candidates = pool
    .flatMap((source) => buildTweets(source, { ...options, count: 4 }))
    .sort((left, right) => right.score - left.score)

  const usedSources = new Set<string>()
  const angleUses = new Map<TweetAngleId, number>()
  const days: WeeklyTweetDay[] = []

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(options.startDate.getTime() + offset * 86_400_000)
    const occasion = options.occasionOf?.(date) || undefined
    /* المادة لا تتكرر في الأسبوع أبداً (قاعدةٌ صارمة)، والزاوية تُفضَّل جديدةً
       ثم يُسمح بتكرارها مرةً واحدة — تنويعُ الأسلوب مطلوب، لكن ألا نغرّد أصلاً
       من أجله ثمنٌ أغلى منه. */
    const freeSource = candidates.filter((draft) => !usedSources.has(draft.sourceId))
    const fresh = freeSource.filter((draft) => !angleUses.has(draft.angle))
    const relaxed = freeSource.filter((draft) => (angleUses.get(draft.angle) || 0) < 2)
    const tier = fresh.length ? fresh : relaxed
    /* أولويةُ اليوم: الراهن أولاً، ثم ما يخدم المناسبة، ثم الأقوى. */
    const newsFirst = offset <= 1 ? tier.find((draft) => draft.sourceKind === 'news') : undefined
    const occasionMatch = occasion
      ? tier.find((draft) => `${draft.sourceTitle} ${draft.text}`.includes(occasion.split(' ')[0]))
      : undefined
    const chosen = newsFirst || occasionMatch || tier[0] || null
    if (chosen) { usedSources.add(chosen.sourceId); angleUses.set(chosen.angle, (angleUses.get(chosen.angle) || 0) + 1) }
    days.push({
      offset,
      iso: date.toISOString().slice(0, 10),
      dayLabel: WEEKDAYS[date.getDay()],
      draft: chosen,
      occasion,
      reason: !chosen
        ? 'لم تبقَ مادةٌ جديدة تستحق هذا اليوم — الصمت أفضل من تغريدةٍ مكرّرة.'
        : newsFirst === chosen
          ? 'خبرٌ راهن — والراهن يفسد بالتأجيل.'
          : occasionMatch === chosen
            ? `يخدم مناسبة ${occasion}.`
            : chosen.tasteLean && chosen.tasteLean > .15
              ? `زاوية «${chosen.angleLabel}» من أكثر ما تنشره، ودرجتها ${chosen.score}٪.`
              : `أقوى ما بقي: ${chosen.score}٪ · زاوية «${chosen.angleLabel}».`,
    })
  }

  const filledDays = days.filter((day) => day.draft)
  return {
    days,
    filled: filledDays.length,
    averageScore: filledDays.length ? Math.round(filledDays.reduce((sum, day) => sum + (day.draft?.score || 0), 0) / filledDays.length) : 0,
    skipped: skipped.slice(0, 8),
  }
}

/**
 * جملةٌ موثّقةٌ من متنٍ — نقطة الدخول لمن أراد سطراً واحداً مضموناً من كلام
 * الدكتور بلا بناء تغريدةٍ كاملة (بطاقة اقتباس، رسالة بوت، ترويسة تصميم).
 */
export const verifiedLineOf = (body: string, title: string) => {
  const line = bestTweetableLine(clean(body), title)
  if (verifyEcho(line, body)) return line
  return splitBodySentences(body).find((sentence) => verifyEcho(sentence, body)) || ''
}
