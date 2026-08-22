/**
 * العارض النووي لاستوديو التصميم الاجتماعي
 *
 * هذا الملف هو «اليد الفنية» للاستوديو: يستلم خطة التكوين من المحرك التحليلي
 * ويحوّلها إلى لوحة SVG مكتملة الإخراج بمستوى استوديوهات التصميم الاحترافية.
 * كل عائلة تصميم لها مشهد فني مستقل ببنيته وإيقاعه وزخرفته المنضبطة —
 * لا قالب واحد بزينة متغيرة. القواعد الصارمة: لا تلوث بصري، لا تكرار نصي،
 * لا كسر لحروف العربية (ممنوع letter-spacing على النص العربي)، والمحتوى القصير
 * يتوسط اللوحة بدل أن يتركها فارغة، وهوية حاضرة بهدوء.
 */

import {
  FRAMING_MODES,
  FONT_MAX_WEIGHT,
  FONT_WIDTH_RATIO,
  TYPOGRAPHY_MODES,
  compositionTextLayout,
  extractInfographicPoints,
  resolvePalette,
  type CompositionPlan,
  type InfographicVariantId,
  type Palette,
  type SocialCampaign,
} from './social-design-engine'
import { currentSeason, seasonStrokePath } from './seasons'

/* ------------------------------------------------------------------ */
/*     تفضيلات الإخراج: ختم الهوية ولمسة الموسم — للمعاينة والتصدير معاً    */
/* ------------------------------------------------------------------ */

/** أنماط الخلفية الراقية — كلها خفيفةٌ جداً، والافتراضي بلا نمط (لا تلوّث). */
export type BackgroundPattern = 'none' | 'dots' | 'lines' | 'giri' | 'mesh'

export interface RenderPreferences {
  /** ختم الشعار المخطوط — اختياري بأمر الدكتور */
  seal: boolean
  /** لمسة الموسم الخطية (رمضان/العيد/الوطني) حين يكون الموسم قائماً */
  seasonal: boolean
  /** نمط خلفيةٍ راقٍ اختياري: نقطية · خطوط · زخرفة إسلامية · تدرّج شبكي */
  pattern: BackgroundPattern
  /** بصمة الموسم: خيطٌ سفليّ واحد بلون الفصل يرث كل تصاميم الفترة (هوية عائلة) */
  familySignature: boolean
  /** الأرقام الهندية (2026) بدل العربية الغربية في البيانات الوصفية */
  arabicNumerals: boolean
}

let renderPreferences: RenderPreferences = { seal: false, seasonal: false, pattern: 'none', familySignature: true, arabicNumerals: true }

/* ------------------------------------------------------------------ */
/*   بصمة الموسم: ما يجعل منشورات الشهر عائلةً واحدة لا أفراداً يتامى     */
/* ------------------------------------------------------------------ */

export type SeasonIdentity = { id: string; label: string; tint: string; index: number }

/** أربع بصماتٍ في السنة، حتميّة من التاريخ فتتشاركها كل تصاميم الفترة. */
export function seasonIdentityFor(date = new Date()): SeasonIdentity {
  const month = date.getMonth()
  const year = date.getFullYear()
  const table: Array<{ id: string; label: string; tint: string }> = [
    { id: 'winter', label: 'شتاء', tint: '#3F6C8E' },
    { id: 'spring', label: 'ربيع', tint: '#5C7F63' },
    { id: 'summer', label: 'صيف', tint: '#B08343' },
    { id: 'autumn', label: 'خريف', tint: '#8A5B4B' },
  ]
  const index = month <= 1 || month === 11 ? 0 : month <= 4 ? 1 : month <= 7 ? 2 : 3
  const season = table[index]
  return { ...season, label: `${season.label} ${year}`, index }
}

/** الخيط السفلي: حضورٌ يُحسّ ولا يُرى — عرضه ثلث القاعدة وسمكه شعرة. */
function familySignatureMark(s: Scene): string {
  if (!renderPreferences.familySignature) return ''
  const identity = seasonIdentityFor()
  const { w, h, min } = s
  const width = w * .18
  const x = s.safeX
  const y = h - Math.max(s.safeY * .55, min * .045)
  return `<g aria-hidden="true" opacity=".55">
    <rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(Math.max(1.4, min * .0035))}" rx="${round(min * .002)}" fill="${identity.tint}"/>
  </g>`
}

/* ------------------------------------------------------------------ */
/*        الطباعة العربية المتقدمة: أرقام هندية وكشيدة صحيحة            */
/* ------------------------------------------------------------------ */

const ARABIC_INDIC = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** يحوّل الأرقام الغربية إلى هندية — للبيانات الوصفية لا لنص الدكتور. */
export function toArabicIndic(value: string): string {
  if (!renderPreferences.arabicNumerals) return value
  return String(value || '').replace(/[0-9]/g, (digit) => ARABIC_INDIC[Number(digit)])
}

/* الحروف التي لا تتصل بما بعدها: لا تُمدّ الكشيدة خلفها أبداً وإلا انفصلت
   الكلمة وبدت خطأً إملائياً. هذه هي القاعدة التي تفرق بين مدٍّ خطّي أصيل
   وتشويهٍ آليٍّ يفضح صانعه. */
const NON_CONNECTING_FORWARD = new Set(['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة', 'ى', 'ء'])

/** مدّ الكلمة بالكشيدة إلى طولٍ مطلوب، بلا كسر اتصال الحروف. */
export function elongateArabic(word: string, extra = 1): string {
  const letters = Array.from(String(word || ''))
  if (letters.length < 3 || extra < 1) return word
  const slots: number[] = []
  for (let index = 0; index < letters.length - 1; index += 1) {
    const current = letters[index]
    const next = letters[index + 1]
    if (NON_CONNECTING_FORWARD.has(current)) continue
    if (next === 'ء' || /\s/.test(next) || !/[ء-ي]/.test(current) || !/[ء-ي]/.test(next)) continue
    slots.push(index + 1)
  }
  if (!slots.length) return word
  /* نمدّ عند الموضع الأوسط: أقرب إلى ذائقة الخطّاط من المدّ عند الطرف. */
  const pick = slots[Math.floor((slots.length - 1) / 2)]
  return `${letters.slice(0, pick).join('')}${'ـ'.repeat(Math.min(4, extra))}${letters.slice(pick).join('')}`
}

export function setRenderPreferences(preferences: Partial<RenderPreferences>) {
  renderPreferences = { ...renderPreferences, ...preferences }
}

export function getRenderPreferences(): RenderPreferences {
  return { ...renderPreferences }
}

/* ------------------------------------------------------------------ */
/*                         أدوات نصية أساسية                           */
/* ------------------------------------------------------------------ */

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const words = (value: string) => String(value || '').trim().split(/\s+/).filter(Boolean)
const hasArabic = (value: string) => /[؀-ۿ]/.test(value)
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const round = (value: number) => Math.round(value * 100) / 100

/** بصمةٌ رقميةٌ ثابتةٌ من نصّ — لاختيار متغيّرٍ فنّيٍّ يتنوّع بين الاتجاهات والدفعات بلا عشوائية. */
const hashString = (value: string) => { let h = 2166136261; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
/** تحويل الأرقام العربية-الهندية إلى غربية (لقراءة قيمة الإحصاءة عدداً). */
const toWesternDigits = (value: string) => String(value || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** تفتيح/تغميق لونٍ سداسيّ (amt>0 نحو الأبيض، amt<0 نحو الأسود) — للتدرّجات الراقية. */
const hexShade = (hex: string, amt: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const mix = (c: number) => amt >= 0 ? Math.round(c + (255 - c) * amt) : Math.round(c * (1 + amt))
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => clamp(mix(c), 0, 255).toString(16).padStart(2, '0'))
  return `#${parts.join('')}`
}

// سياسة الموقع المعتمدة أرقام غربية في كل النصوص (WesternDigitsGuard يفرضها في
// المعاينة)؛ نلتزم بها هنا أيضاً كي يتطابق ملف التصدير مع ما يراه الدكتور.
const arabicNumber = (value: number) => String(value)
const arabicIndex = (value: number) => value < 10 ? `0${value}` : String(value)

/* قياس حقيقي للنص العربي في المتصفح، مع بديل حتمي أثناء البناء الثابت.
   نطبّع القياس على خط 100px، لذلك تبقى دوال التخطيط القديمة متوافقة بينما
   يصير كسر السطر مبنياً على الخط المحمّل نفسه لا على عدّ الحروف. */
let measureContext: CanvasRenderingContext2D | null | undefined
const measureCache = new Map<string, number>()
function measuredUnits(value: string, family = 'Tajawal') {
  const cleanValue = String(value || '')
  const cacheKey = `${family}:${cleanValue}`
  const cached = measureCache.get(cacheKey)
  if (cached != null) return cached
  if (measureContext === undefined) {
    try {
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
      measureContext = canvas?.getContext('2d') || null
    } catch { measureContext = null }
  }
  if (measureContext) {
    /* العائلة ذات الكلمتين («El Messiri») بلا اقتباس تجعل مختصر font غير صالح،
       فيُهمل الإسناد صامتاً ويبقى القياس على خطٍّ سابق. الاقتباس شرط صحة. */
    measureContext.font = `500 100px ${fontStack(family)}`
    measureContext.direction = hasArabic(cleanValue) ? 'rtl' : 'ltr'
    const measured = measureContext.measureText(cleanValue).width / 55.5
    measureCache.set(cacheKey, measured)
    if (measureCache.size > 1200) measureCache.clear()
    return measured
  }
  return Array.from(cleanValue).reduce((total, character) => {
    if (/\s/.test(character)) return total + .42
    if (/[؀-ۿ]/.test(character)) return total + 1
    if (/[A-Z]/.test(character)) return total + .86
    if (/[a-z0-9]/.test(character)) return total + .72
    return total + .5
  }, 0) * (FONT_WIDTH_RATIO[family] || 1)
}

function textUnits(value: string, family?: string) { return measuredUnits(value, family || 'Tajawal') }

/** عرض بالبكسل وفق القياس الفعلي حين يكون Canvas متاحاً. */
const lineWidthPx = (line: string, size: number, family?: string) => measuredUnits(line, family || 'Tajawal') * size * .555

/** موازنة ديناميكية: تفحص نقاط القطع الممكنة وتختار أقل تفاوت بين الأسطر،
    مع عقوبة واضحة للسطر اليتيم والفيضان. */
function balancedWrap(sourceWords: string[], budget: number, maxLines: number, family?: string) {
  const n = sourceWords.length
  const memo = new Map<string, { lines: string[]; score: number; consumed: number }>()
  const solve = (start: number, left: number): { lines: string[]; score: number; consumed: number } => {
    const key = `${start}:${left}`
    const hit = memo.get(key); if (hit) return hit
    if (start >= n || left <= 0) return { lines: [], score: start >= n ? 0 : 1e6, consumed: start }
    let best = { lines: [] as string[], score: 1e9, consumed: start }
    let line = ''
    for (let end = start; end < n; end += 1) {
      line = line ? `${line} ${sourceWords[end]}` : sourceWords[end]
      const width = textUnits(line, family)
      if (width > budget * 1.16 && end > start) break
      const tail = solve(end + 1, left - 1)
      const fill = Math.min(1.4, width / budget)
      const rag = Math.pow(1 - Math.min(fill, 1), 2) * 100
      const overflow = width > budget ? Math.pow(width / budget - 1, 2) * 700 : 0
      const lonely = end === start && end < n - 1 ? 34 : 0
      const finalOrphan = end + 1 === n && start > 0 && (end - start + 1) === 1 ? 85 : 0
      const score = rag + overflow + lonely + finalOrphan + tail.score
      if (score < best.score) best = { lines: [line, ...tail.lines], score, consumed: tail.consumed }
    }
    memo.set(key, best)
    return best
  }
  return solve(0, maxLines)
}

function wrap(value: string, maxUnits: number, maxLines: number, family?: string) {
  const source = words(value)
  if (!source.length) return []
  const budget = Math.max(4, maxUnits)
  const result = balancedWrap(source, budget, Math.max(1, maxLines), family)
  const lines = result.lines.slice(0, maxLines)
  if (result.consumed < source.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, '')}…`
  if (lines.length >= 2) {
    const last = words(lines[lines.length - 1])
    const previous = words(lines[lines.length - 2])
    if (last.length === 1 && previous.length > 2 && !lines[lines.length - 1].endsWith('…')) {
      const moved = previous.pop() as string
      const candidate = `${moved} ${last.join(' ')}`
      if (textUnits(candidate, family) <= budget * 1.05) {
        lines[lines.length - 2] = previous.join(' ')
        lines[lines.length - 1] = candidate
      }
    }
  }
  return lines
}

/** حجم خط يجعل الأسطر تتنفس داخل منطقة محددة بلا فيضان. */
function fitted(lines: string[], base: number, zoneWidth: number, maxHeight: number, lineHeight: number, minimumScale = .5, family?: string) {
  if (!lines.length) return base
  const widest = Math.max(...lines.map((line) => lineWidthPx(line, base, family)), 1)
  const estimatedHeight = base * (1.02 + Math.max(0, lines.length - 1) * lineHeight)
  const scale = Math.min(1, zoneWidth / widest, maxHeight / Math.max(1, estimatedHeight))
  return base * Math.max(minimumScale, scale)
}

/**
 * خطوة «الفهم قبل الرسم»: أفضل مصدر للمتن هو أول نص لا يكرر العنوان
 * ولا يقل عن ثلاث كلمات — هذا ما كان يجعل النتائج القديمة تعرض الجملة
 * نفسها مرتين أو تعرض شظية مثل «محاضرة:».
 */
const normalizeForCompare = (value: string) => String(value || '')
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase()

function distinctBody(plan: CompositionPlan) {
  const title = normalizeForCompare(plan.content.title)
  /* المتن أولاً ثم العنوان الفرعي: حين يحرّر الدكتور حقلاً في الاستوديو يجب
     أن ينعكس فوراً مهما قصُر — كان الشرط «3 كلمات» يبتلع كتابته فتظهر
     المعاينة فارغة. نقبل الآن أي نصٍّ غير فارغ لا يكرّر العنوان. */
  /* العنوان الفرعي صار له مكانه الخاص (الشارة/التمهيد)، فلا يزاحم المتن هنا —
     وبذلك يظهر الاثنان معاً حين يملؤهما الدكتور. */
  for (const candidate of [plan.content.body, plan.content.quote]) {
    const clean = normalizeForCompare(candidate)
    if (!clean) continue
    if (clean === title) continue
    if (title.length > 12 && (clean.startsWith(title) || title.startsWith(clean))) continue
    return candidate
  }
  return ''
}

/* ------------------------------------------------------------------ */
/*                       كتل نصية وهوية مشتركة                         */
/* ------------------------------------------------------------------ */

type Anchor = 'end' | 'middle' | 'start'

interface TextBlockOptions {
  lines: string[]
  x: number
  y: number
  size: number
  fill: string
  lineHeight?: number
  weight?: number
  anchor?: Anchor
  opacity?: number
  family?: string
  letterSpacing?: number
  emphasisWord?: string
  emphasisFill?: string
  emphasisWeight?: number
}

/** يحسم الوزن المتاح فعلياً: Tajawal المحلي ينتهي عند 500 فلا نطلب تغليظاً اصطناعياً. */
/**
 * جذر «الخط غير جميل» (ملاحظة الدكتور 31 يوليو مساءً) — أعمقُ من نسيان
 * fonts.load: **«Alexandria Variable» لا وجود له في المشروع أصلاً**. لا ملف
 * ولا ‎@font-face، واسمه لا يظهر إلا في جدول أنماط الطباعة داخل المحرك. وكان
 * الرسم يُخرج `font-family="Alexandria Variable"` عارياً بلا بديل، فيسقط كل
 * عنوانٍ صامتاً إلى خطّ النظام. (مسار الكانفس كان سليماً لأنه يكتب سلسلةً
 * حقيقية: "El Messiri", "Tajawal", sans-serif — ولهذا بدا الخلل في مسارٍ دون
 * آخر.) الحل: سلسلةُ بدائل عند حافة الكتابة — إن أُضيف الخط يوماً استُعمل،
 * واليوم يهبط الرسم إلى خط الهوية لا إلى خطّ نظامٍ غريب.
 */
const FALLBACK_STACK = `'El Messiri', 'Tajawal', sans-serif`
const fontStack = (family: string) => {
  const name = String(family || '').trim()
  if (!name) return FALLBACK_STACK
  if (name === 'El Messiri' || name === 'Tajawal') return `'${name}', ${name === 'Tajawal' ? `'El Messiri'` : `'Tajawal'`}, sans-serif`
  return `'${name}', ${FALLBACK_STACK}`
}

/** يحسم الوزن المتاح فعلياً: Tajawal ينتهي عند 500 وEl Messiri عند 700،
    فلا نطلب من المتصفح تغليظاً اصطناعياً يشوّه اتصال الحروف العربية. */
const resolveWeight = (family: string, weight: number) => Math.min(weight, FONT_MAX_WEIGHT[family] ?? 900)

/** يبني سطراً مع إبراز كلمة بطولية داخله (tspan متصل يحترم اتجاه العربية). */
function lineContent(line: string, options: TextBlockOptions) {
  const hero = options.emphasisWord?.trim()
  if (!hero || !options.emphasisFill) return esc(line)
  const tokens = line.split(/(\s+)/)
  const target = normalizeForCompare(hero).replace(/^و/, '')
  let done = false
  return tokens.map((token) => {
    if (!done && token.trim() && normalizeForCompare(token).replace(/^و/, '') === target) {
      done = true
      return `<tspan fill="${options.emphasisFill}" font-weight="${options.emphasisWeight || 700}">${esc(token)}</tspan>`
    }
    return esc(token)
  }).join('')
}

function textBlock(options: TextBlockOptions) {
  const { lines, x, y, size, fill } = options
  if (!lines.length) return ''
  const joined = lines.join(' ')
  const rtl = hasArabic(joined)
  const direction = rtl ? 'rtl' : 'ltr'
  let anchor: Anchor = options.anchor || 'end'
  if (rtl) {
    if (anchor === 'end') anchor = 'start'
    else if (anchor === 'start') anchor = 'end'
  }
  const family = options.family || 'Tajawal'
  const weight = resolveWeight(family, options.weight ?? 600)
  // المسافة بين الحروف تقطع اتصال العربية — تُطبَّق على اللاتينية فقط.
  const spacing = rtl ? 0 : (options.letterSpacing || 0)
  const lineHeight = options.lineHeight ?? 1.3
  const inner = lines.map((line, index) => {
    const lineY = y + index * size * lineHeight
    return `<text x="${round(x)}" y="${round(lineY)}" fill="${fill}" opacity="${options.opacity ?? 1}" font-family="${esc(fontStack(family))}" font-size="${round(size)}" font-weight="${weight}" text-anchor="${anchor}" direction="${direction}" unicode-bidi="plaintext"${spacing ? ` letter-spacing="${spacing}"` : ''}>${lineContent(line, options)}</text>`
  }).join('')
  /* كل كتلة نصية تُلفّ بمجموعةٍ لها مفتاحٌ ثابت — فيمسكها الدكتور ويحرّكها،
     وتُطبَّق إزاحته المخزّنة على السلسلة النهائية فتُخبز في المعاينة والتصدير. */
  const wk = wordKey(`${joined}|${Math.round(x)}|${Math.round(y)}|${Math.round(size)}`)
  return `<g class="dw" data-wk="${wk}">${inner}</g>`
}

/** مفتاحٌ قصير ثابت لكتلة نصية — لا يتغيّر بين رسمةٍ وأخرى لنفس التصميم. */
function wordKey(seed: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}

/** يقرأ إزاحات الكلمات المخزّنة لهذا التصميم (بلا استيراد كي لا يكسر الفاحص). */
function readWordOffsetsForRender(plan: CompositionPlan): Record<string, { dx: number; dy: number }> {
  if (typeof localStorage === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(`reel:word-offsets:${plan.fingerprint || plan.id}`) || '{}') || {} } catch { return {} }
}

/** يطبّق الإزاحات على السلسلة: يحقن transform=translate في مجموعة كل كلمة محرّكة. */
function applyWordOffsets(svg: string, plan: CompositionPlan): string {
  const map = readWordOffsetsForRender(plan)
  const keys = Object.keys(map)
  if (!keys.length) return svg
  const W = plan.format.width || 1080, H = plan.format.height || 1080
  let out = svg
  for (const wk of keys) {
    const o = map[wk]
    if (!o) continue
    const tx = Math.round((o.dx || 0) * W), ty = Math.round((o.dy || 0) * H)
    if (!tx && !ty) continue
    out = out.split(`<g class="dw" data-wk="${wk}">`).join(`<g class="dw" data-wk="${wk}" transform="translate(${tx} ${ty})">`)
  }
  return out
}

/** ارتفاع كتلة نصية بعدد أسطرها. */
const blockHeight = (lines: string[], size: number, lineHeight: number) => lines.length
  ? size * (.95 + (lines.length - 1) * lineHeight)
  : 0

/* ------------------------------------------------------------------ */
/*             نظام الرصّة: المحتوى يتوسط اللوحة توسطاً بصرياً            */
/* ------------------------------------------------------------------ */

interface StackItem {
  /** ارتفاع العنصر الكامل */
  h: number
  /** مسافة قبل العنصر */
  gap?: number
  /** يرسم العنصر انطلاقاً من حافته العليا */
  draw: (top: number) => string
}

/**
 * يرص عناصر المشهد رأسياً ثم يضع المجموعة كلها في المركز البصري للنطاق
 * (بانحياز خفيف نحو الأعلى كما تفعل عين المصمم). هذا ما يمنع «الفراغ السفلي»
 * الذي كان يجعل النصوص القصيرة تبدو ضائعة في لوحة خالية.
 */
function drawStack(items: StackItem[], band: { top: number; bottom: number }, bias = .42) {
  const real = items.filter((item) => item.h > 0)
  if (!real.length) return ''
  const total = real.reduce((sum, item) => sum + item.h + (item.gap || 0), 0) - (real[0].gap || 0)
  const room = band.bottom - band.top - total
  let y = band.top + clamp(room, 0, room) * clamp(bias, 0, 1)
  if (room < 0) y = band.top
  const parts: string[] = []
  real.forEach((item, index) => {
    if (index > 0) y += item.gap || 0
    parts.push(item.draw(y))
    y += item.h
  })
  return parts.join('')
}

/** عنصر نصي داخل الرصّة. */
function textItem(options: Omit<TextBlockOptions, 'y'> & { gap?: number }): StackItem {
  const lineHeight = options.lineHeight ?? 1.3
  return {
    h: blockHeight(options.lines, options.size, lineHeight),
    gap: options.gap,
    draw: (top) => textBlock({ ...options, y: top + options.size * .82 }),
  }
}

/* ------------------------------------------------------------------ */
/*                          مشهد التكوين                               */
/* ------------------------------------------------------------------ */

interface Scene {
  plan: CompositionPlan
  palette: Palette
  w: number
  h: number
  min: number
  isTall: boolean
  isWide: boolean
  safeX: number
  safeY: number
  uid: string
  kicker: string
  titleText: string
  bodyText: string
  hero: string
  cta: string
  author: string
  source: string
  slides: number
  displayFamily: string
  bodyFamily: string
  titleWeight: number
  titleLineHeight: number
  /** لوحة قليلة المحتوى: عنوان بلا متن — تكبير وتوسيط بدل الفراغ */
  sparse: boolean
}

function sceneOf(plan: CompositionPlan): Scene {
  const palette = resolvePalette(plan)
  const typography = TYPOGRAPHY_MODES[plan.typography]
  const w = plan.format.width
  const h = plan.format.height
  const min = Math.min(w, h)
  const bodyText = distinctBody(plan)
  const subtitleKey = normalizeForCompare(plan.content.subtitle)
  const bodyKey = normalizeForCompare(bodyText)
  /* الدعوة تظهر متى ملأها الدكتور مهما كان تخطيط الوضع — «الدعوة ما تطلع»
     كان سببها إخفاؤها في تكوينات ctaPlacement='none' رغم كتابتها. */
  const cta = plan.content.cta || ''
  return {
    plan,
    palette,
    w,
    h,
    min,
    isTall: h / w > 1.45,
    isWide: w / h > 1.45,
    safeX: Math.max(plan.format.safeInset * w, w * .055),
    safeY: Math.max(plan.format.safeInset * min, h * .045),
    uid: `n-${plan.fingerprint.replace(/[^a-z0-9_-]/gi, '').slice(0, 16) || 'plan'}`,
    /* الشارة قابلة للحذف بأمر الدكتور: تفريغ حقلها في المحرر ('') يخفيها
       نهائياً بدل أن يسقط الرسم إلى تسمية الاتجاه. */
    kicker: plan.content.kicker === '' ? '' : (subtitleKey && subtitleKey !== bodyKey ? plan.content.subtitle : plan.content.kicker || plan.directionLabel),
    titleText: plan.content.title,
    bodyText,
    hero: plan.content.heroWord || '',
    cta,
    author: plan.content.authorHidden ? '' : (plan.content.author || 'د. أحمد حسين الفيلكاوي'),
    source: plan.content.sourceHidden ? '' : (plan.content.source || 'dr-alfailakawi.com'),
    slides: plan.content.slides.length,
    displayFamily: typography.displayFamily,
    bodyFamily: typography.bodyFamily,
    titleWeight: typography.titleWeight,
    titleLineHeight: typography.lineHeight,
    sparse: !bodyText && !cta,
  }
}

/** يلفّ العنوان ويقيسه داخل منطقة محددة — النص القصير يكسب حضوراً أكبر. */
function fitTitle(s: Scene, zoneWidth: number, opts: { base?: number; maxLines?: number; minScale?: number } = {}) {
  const layout = compositionTextLayout(s.plan)
  const maxLines = opts.maxLines ?? layout.titleMaxLines
  const sparseBoost = s.sparse && words(s.titleText).length <= 8 ? 1.22 : 1
  const base = (opts.base ?? s.min * .066 * TYPOGRAPHY_MODES[s.plan.typography].titleScale) * sparseBoost
  const maxUnits = Math.max(8, zoneWidth / (base * .555))
  const lines = wrap(s.titleText, maxUnits, maxLines, s.displayFamily)
  const size = fitted(lines, base, zoneWidth, s.h * (s.isWide ? .42 : .38), s.titleLineHeight, opts.minScale ?? .5, s.displayFamily)
  return { lines, size }
}

function fitBody(s: Scene, zoneWidth: number, opts: { base?: number; maxLines?: number; text?: string } = {}) {
  const source = opts.text ?? s.bodyText
  if (!source) return { lines: [] as string[], size: 0 }
  const layout = compositionTextLayout(s.plan)
  const base = opts.base ?? s.min * .0285
  const maxLines = opts.maxLines ?? layout.bodyMaxLines
  const maxUnits = Math.max(10, zoneWidth / (base * .555))
  const lines = wrap(source, maxUnits, maxLines, s.bodyFamily)
  const size = fitted(lines, base, zoneWidth, s.h * .28, 1.62, .66, s.bodyFamily)
  return { lines, size }
}

/* ------------------------------------------------------------------ */
/*                       أنظمة التشطيب المشتركة                        */
/* ------------------------------------------------------------------ */

/** خلفية من طبقتين: غسل لوني هادئ + توهج قطري خافت + حبيبات طباعية دقيقة. */
/** نجمةٌ ثمانيةٌ (خاتم) لنمط الزخرفة الإسلامية — مسارٌ مغلقٌ يُبلَّط في الخلفية. */
const octagramPath = (cx: number, cy: number, R: number, r: number) => {
  let d = ''
  for (let i = 0; i < 16; i += 1) {
    const ang = i * Math.PI / 8 - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    d += `${i === 0 ? 'M' : 'L'} ${round(cx + Math.cos(ang) * rad)} ${round(cy + Math.sin(ang) * rad)} `
  }
  return `${d}Z`
}

/** طبقة نمط الخلفية المختار — خفيفةٌ جداً، بألوان اللوحة فلا تنشز. */
function patternLayer(s: Scene): { def: string; rect: string } {
  const kind = renderPreferences.pattern || 'none'
  if (kind === 'none') return { def: '', rect: '' }
  const { palette: p, w, h, uid, min } = s
  const id = `${uid}-pat`
  if (kind === 'dots') {
    const g = round(min * .052)
    return { def: `<pattern id="${id}" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><circle cx="${round(g / 2)}" cy="${round(g / 2)}" r="${round(min * .0045)}" fill="${p.ink}"/></pattern>`, rect: `<rect width="${w}" height="${h}" fill="url(#${id})" opacity="${p.isDark ? .07 : .05}"/>` }
  }
  if (kind === 'lines') {
    const g = round(min * .032)
    return { def: `<pattern id="${id}" width="${g}" height="${g}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${g}" stroke="${p.ink}" stroke-width="1"/></pattern>`, rect: `<rect width="${w}" height="${h}" fill="url(#${id})" opacity="${p.isDark ? .06 : .045}"/>` }
  }
  if (kind === 'giri') {
    const g = round(min * .15)
    return { def: `<pattern id="${id}" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><path d="${octagramPath(g / 2, g / 2, g * .42, g * .17)}" fill="none" stroke="${p.accent}" stroke-width="1.1"/></pattern>`, rect: `<rect width="${w}" height="${h}" fill="url(#${id})" opacity="${p.isDark ? .1 : .07}"/>` }
  }
  return {
    def: `<radialGradient id="${id}-a" cx=".82" cy=".8" r=".5"><stop offset="0" stop-color="${p.accent}" stop-opacity="${p.isDark ? .22 : .14}"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-b" cx=".1" cy=".88" r=".46"><stop offset="0" stop-color="${p.accentSoft}" stop-opacity="${p.isDark ? .32 : .45}"/><stop offset="1" stop-color="${p.accentSoft}" stop-opacity="0"/></radialGradient>`,
    rect: `<rect width="${w}" height="${h}" fill="url(#${id}-a)"/><rect width="${w}" height="${h}" fill="url(#${id}-b)"/>`,
  }
}

/* ══════════ الغلاف الجوّي — درس دساتير DESIGN.md العالمية ══════════
   العالم أكثر من لوحة: غسلٌ وتوهجاتٌ ونسيجٌ ونجومٌ وضوء حافة. كل الطبقات
   تُرسم هنا في `backdrop()` وحدها فتسري على العائلات كلها وشرائح الكاروسيل،
   وغياب `palette.atmo` يُبقي كل لوحةٍ قديمة كما كانت حرفياً. */

/** مولّد عشوائية حتمي: البذرة من بصمة التصميم فلا يتبدل نجمٌ بين تصديرين. */
function seededRandom(seedText: string) {
  let state = 0
  for (const ch of seedText) state = ((state * 31 + ch.charCodeAt(0)) & 0x7fffffff) >>> 0
  state = state || 7
  return () => {
    state = ((state * 1664525 + 1013904223) & 0x7fffffff) >>> 0
    return state / 0x7fffffff
  }
}

/** حقل نجوم مرصد الليل: نثرٌ حتمي دقيق وثلاث نجماتٍ ساطعة بشعاع صليبي. */
function starFieldLayer(s: Scene): string {
  const { palette: p, w, h, min, uid } = s
  const rand = seededRandom(`${uid}:stars`)
  const parts: string[] = []
  const count = 64 + Math.round(rand() * 26)
  for (let index = 0; index < count; index += 1) {
    const x = round(rand() * w)
    const y = round(rand() * h * .94)
    const r = (0.55 + rand() * 1.4).toFixed(1)
    const o = (0.08 + rand() * 0.45).toFixed(2)
    parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${p.ink}" opacity="${o}"/>`)
  }
  for (let index = 0; index < 3; index += 1) {
    const x = round(w * .06 + rand() * w * .88)
    const y = round(h * .05 + rand() * h * .48)
    const len = round(min * (.011 + rand() * .009))
    parts.push(`<g stroke="${p.ink}" stroke-width="1" opacity=".55"><line x1="${x - len}" y1="${y}" x2="${x + len}" y2="${y}"/><line x1="${x}" y1="${y - len}" x2="${x}" y2="${y + len}"/></g>`)
  }
  return `<g>${parts.join('')}</g>`
}

/** ورق مهندس: شبكة دقيقة بخطٍّ أثقل كل أربع خلايا — الدقة نفسها زخرفة. */
function gridPaperLayer(s: Scene): { def: string; rect: string } {
  const { palette: p, w, h, uid, min } = s
  const cell = Math.max(18, round(min * .026))
  const major = cell * 4
  return {
    def: `<pattern id="${uid}-gridm" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><path d="M ${cell} 0 H 0 V ${cell}" fill="none" stroke="${p.ink}" stroke-width="1" opacity=".05"/></pattern><pattern id="${uid}-gridM" width="${major}" height="${major}" patternUnits="userSpaceOnUse"><path d="M ${major} 0 H 0 V ${major}" fill="none" stroke="${p.accent}" stroke-width="1" opacity=".09"/></pattern>`,
    rect: `<rect width="${w}" height="${h}" fill="url(#${uid}-gridm)"/><rect width="${w}" height="${h}" fill="url(#${uid}-gridM)"/>`,
  }
}

/** لمعان حريري قطري لعوالم الفخامة: حزامان خافتان لا يمسّان قراءة النص. */
function silkLayer(s: Scene): { def: string; rect: string } {
  const { w, h, uid } = s
  return {
    def: `<linearGradient id="${uid}-silk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".05"/><stop offset=".55" stop-color="#FFFFFF" stop-opacity=".05"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`,
    rect: `<g transform="rotate(-16 ${round(w / 2)} ${round(h / 2)})"><rect x="${round(-w * .3)}" y="${round(h * .08)}" width="${round(w * 1.6)}" height="${round(h * .26)}" fill="url(#${uid}-silk)"/><rect x="${round(-w * .3)}" y="${round(h * .58)}" width="${round(w * 1.6)}" height="${round(h * .18)}" fill="url(#${uid}-silk)" opacity=".6"/></g>`,
  }
}

/** يحوّل زاوية الغسل (بالدرجات، 180 = من الأعلى للأسفل) إلى متجه تدرّج SVG. */
function washVectorOf(angle: number) {
  const rad = ((angle % 360) * Math.PI) / 180
  const vx = Math.sin(rad) / 2
  const vy = -Math.cos(rad) / 2
  const fix = (value: number) => Number((0.5 + value).toFixed(3))
  return { x1: fix(-vx), y1: fix(-vy), x2: fix(vx), y2: fix(vy) }
}

/** حبر العنوان: يتدرّج حين يحمل العالم تدرّجاً، وإلا فحبر اللوحة الصلب. */
function titleInk(s: Scene): string {
  return s.palette.atmo?.titleGradient ? `url(#${s.uid}-titleink)` : s.palette.ink
}

/** لون اللمسة: ذهبٌ معدنيّ في عوالم الفخامة، وإلا لون الهوية الصلب. */
function accentInk(s: Scene): string {
  return s.palette.atmo?.foil ? `url(#${s.uid}-foil)` : s.palette.accent
}

function backdrop(s: Scene, options: { glow?: 'top-left' | 'top-right' | 'bottom' | 'center' | 'none'; grain?: boolean } = {}) {
  const { palette: p, w, h, uid } = s
  const atmo = p.atmo
  const spectrum = p.spectrum?.length ? p.spectrum : [p.accent, p.accentSoft, p.rule]
  const pat = patternLayer(s)
  const glow = options.glow ?? 'top-left'
  const glowPos = glow === 'top-left' ? { cx: .18, cy: .12 } : glow === 'top-right' ? { cx: .84, cy: .14 } : glow === 'bottom' ? { cx: .5, cy: .95 } : { cx: .5, cy: .5 }
  /* توهجات العالم تحل محل التوهج الواحد؛ وعالمٌ بلا توهجات (كالرخام) صمتٌ مقصود. */
  const auroraDefs = atmo?.glows?.length
    ? atmo.glows.map((g, index) => `<radialGradient id="${uid}-aur${index}" cx="${g.x}" cy="${g.y}" r="${g.r}"><stop offset="0" stop-color="${g.color}" stop-opacity="${g.opacity}"/><stop offset="1" stop-color="${g.color}" stop-opacity="0"/></radialGradient>`).join('')
    : ''
  const auroraRects = atmo?.glows?.length
    ? atmo.glows.map((_, index) => `<rect width="${w}" height="${h}" fill="url(#${uid}-aur${index})"/>`).join('')
    : ''
  const washVec = atmo?.wash ? washVectorOf(atmo.wash.angle) : { x1: 0, y1: 0, x2: 1, y2: 1 }
  const washStops = atmo?.wash
    ? atmo.wash.stops.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`).join('')
    : `<stop offset="0" stop-color="${p.background}"/><stop offset="1" stop-color="${p.surface}"/>`
  const grid = atmo?.gridPaper ? gridPaperLayer(s) : null
  const silk = atmo?.silk ? silkLayer(s) : null
  const grainStrength = (p.isDark ? .05 : .035) * (atmo?.grain ?? 1)
  const vignetteStrength = (atmo?.vignette || 0) * (p.isDark ? .5 : .2)
  const vignetteColor = p.isDark ? '#05070D' : '#2A2118'
  const edgeColor = p.isDark ? '#FFFFFF' : p.accent
  const parts = [
    `<rect width="${w}" height="${h}" fill="url(#${uid}-wash)"/>`,
    atmo ? auroraRects : (glow === 'none' ? '' : `<rect width="${w}" height="${h}" fill="url(#${uid}-glow)"/>`),
    p.dna ? `<rect width="${w}" height="${h}" fill="url(#${uid}-dna-a)"/><rect width="${w}" height="${h}" fill="url(#${uid}-dna-b)"/>` : '',
    pat.rect,
    grid ? grid.rect : '',
    silk ? silk.rect : '',
    atmo?.stars ? starFieldLayer(s) : '',
    options.grain === false || grainStrength <= 0 ? '' : `<rect width="${w}" height="${h}" filter="url(#${uid}-grain)" opacity="${Number(grainStrength.toFixed(3))}"/>`,
    vignetteStrength > 0 ? `<rect width="${w}" height="${h}" fill="url(#${uid}-vig)"/>` : '',
    atmo?.edgeLight ? `<rect x="0" y="0" width="${w}" height="1.5" fill="url(#${uid}-edge)"/>` : '',
  ]
  const defs = `${pat.def}${auroraDefs}${grid ? grid.def : ''}${silk ? silk.def : ''}
    ${vignetteStrength > 0 ? `<radialGradient id="${uid}-vig" cx=".5" cy=".46" r=".78"><stop offset=".58" stop-color="${vignetteColor}" stop-opacity="0"/><stop offset="1" stop-color="${vignetteColor}" stop-opacity="${Number(vignetteStrength.toFixed(3))}"/></radialGradient>` : ''}
    ${atmo?.edgeLight ? `<linearGradient id="${uid}-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${edgeColor}" stop-opacity="0"/><stop offset=".5" stop-color="${edgeColor}" stop-opacity="${p.isDark ? .3 : .4}"/><stop offset="1" stop-color="${edgeColor}" stop-opacity="0"/></linearGradient>` : ''}
    ${atmo?.titleGradient ? `<linearGradient id="${uid}-titleink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${atmo.titleGradient[0]}"/><stop offset="1" stop-color="${atmo.titleGradient[1]}"/></linearGradient>` : ''}
    ${atmo?.foil ? `<linearGradient id="${uid}-foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3E3C2"/><stop offset=".45" stop-color="#D8B36A"/><stop offset="1" stop-color="#9A7A42"/></linearGradient>` : ''}
    <linearGradient id="${uid}-wash" x1="${washVec.x1}" y1="${washVec.y1}" x2="${washVec.x2}" y2="${washVec.y2}">${washStops}</linearGradient>
    <radialGradient id="${uid}-glow" cx="${glowPos.cx}" cy="${glowPos.cy}" r="${s.isWide ? .75 : .62}">
      <stop offset="0" stop-color="${spectrum[0]}" stop-opacity="${p.isDark ? .34 : .22}"/>
      <stop offset="1" stop-color="${spectrum[0]}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${uid}-dna-a" cx=".88" cy=".12" r=".68">
      <stop offset="0" stop-color="${spectrum[1] || spectrum[0]}" stop-opacity="${p.isDark ? .22 : .14}"/>
      <stop offset="1" stop-color="${spectrum[1] || spectrum[0]}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${uid}-dna-b" cx=".12" cy=".92" r=".74">
      <stop offset="0" stop-color="${spectrum[2] || spectrum[0]}" stop-opacity="${p.isDark ? .20 : .12}"/>
      <stop offset="1" stop-color="${spectrum[2] || spectrum[0]}" stop-opacity="0"/>
    </radialGradient>
    <filter id="${uid}-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0"/>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
    <filter id="${uid}-shadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="${Math.round(s.min * .012)}" stdDeviation="${Math.round(s.min * .02)}" flood-color="#0B1016" flood-opacity="${p.isDark ? .5 : .14}"/>
    </filter>`
  return { markup: parts.join(''), defs }
}

/** إطار المقاس المطلوب من الخطة (شعري/زوايا/قوس) بلمسة أرقى من نسخة القالب القديم. */
function frameDecor(s: Scene) {
  const { plan, palette: p, w, h, min } = s
  const heroImage = plan.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background' && item.src)
  /* حين تكون الصورة هي المسرح الرئيسي، فالإطار الطباعي القديم يتحول إلى «قيد»
     بصري فوقها، خصوصاً مع الخطط المعتمدة على صورة بطولية. لذلك نطفئ الإطار في
     هذا السياق ونترك القراءة تعتمد على التعتيم الموجّه وتكوين المشهد نفسه. */
  if (heroImage) return ''
  const frame = FRAMING_MODES[plan.framing]
  const parts: string[] = []
  if (plan.framing === 'hairline-inset' || plan.framing === 'editorial-folio') {
    const inset = Math.round(min * Math.max(.03, frame.inset))
    parts.push(`<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="${Math.round(min * frame.radius)}" fill="none" stroke="${p.rule}" stroke-width="1.4" opacity=".8"/>`)
  }
  if (plan.framing === 'corner-marks') {
    const m = Math.round(min * .05)
    const l = Math.round(min * .055)
    parts.push(`<g stroke="${p.accent}" stroke-width="3" opacity=".85" fill="none">
      <path d="M ${m + l} ${m} H ${m} V ${m + l}"/>
      <path d="M ${w - m - l} ${m} H ${w - m} V ${m + l}"/>
      <path d="M ${m + l} ${h - m} H ${m} V ${h - m - l}"/>
      <path d="M ${w - m - l} ${h - m} H ${w - m} V ${h - m - l}"/>
    </g>`)
  }
  if (plan.framing === 'architectural-arch') {
    const inset = Math.round(min * .055)
    const r = Math.round((w - inset * 2) / 2)
    parts.push(`<path d="M ${inset} ${h - inset} V ${inset + r} A ${r} ${r} 0 0 1 ${w - inset} ${inset + r} V ${h - inset}" fill="none" stroke="${p.rule}" stroke-width="1.6" opacity=".9"/>`)
  }
  return parts.join('')
}

/** توقيع البصمة: أربعة ألوان موزعة كعلامات طباعية دقيقة في أطراف اللوحة. */
function dnaSignature(s: Scene) {
  const colors = s.palette.spectrum
  if (!s.palette.dna || !colors?.length) return ''
  const unit = Math.max(5, Math.round(s.min * .008))
  const gap = Math.max(3, Math.round(unit * .55))
  const x = Math.round(s.safeX * .48)
  const y = Math.round(s.h - s.safeY * .48)
  return `<g data-visual-dna="true" opacity=".92">${colors.slice(0, 4).map((color, index) => `<rect x="${x + index * (unit * 2 + gap)}" y="${y}" width="${unit * 2}" height="${unit}" rx="${unit / 2}" fill="${color}"/>`).join('')}</g>`
}

/** سطر الهوية: مسطرة شعرية، الاسم يميناً، النطاق يساراً بتباعد لاتيني أنيق. */
function identityFooter(s: Scene, options: { mode?: 'standard' | 'center' | 'none'; y?: number; nameless?: boolean } = {}) {
  const { palette: p, w, h, min } = s
  const mode = options.mode ?? 'standard'
  if (mode === 'none') return ''
  const y = options.y ?? h - s.safeY * .92
  const nameSize = Math.max(15, min * .0225)
  const domainSize = Math.max(11, min * .0165)
  /* nameless: للمشاهد التي ترسم الاسم داخل تكوينها — التذييل نطاقٌ فقط،
     فلا يتكرر اسم الدكتور مرتين في التصميم الواحد (ملاحظته بالحرف) */
  if (mode === 'center') {
    return [
      options.nameless || !s.author ? '' : textBlock({ lines: [s.author], x: w / 2, y: y - min * .036, size: nameSize, fill: p.ink, weight: 600, anchor: 'middle', family: 'Tajawal', opacity: .92 }),
      s.source ? textBlock({ lines: [s.source], x: w / 2, y, size: domainSize, fill: p.muted, weight: 500, anchor: 'middle', family: 'Tajawal', letterSpacing: 2.2, opacity: .9 }) : '',
    ].join('')
  }
  const ruleY = y - nameSize * 1.55
  return `
    <line x1="${s.safeX}" y1="${round(ruleY)}" x2="${w - s.safeX}" y2="${round(ruleY)}" stroke="${p.rule}" stroke-width="1.1" opacity=".9"/>
    ${options.nameless || !s.author ? '' : textBlock({ lines: [s.author], x: w - s.safeX, y, size: nameSize, fill: p.ink, weight: 600, anchor: 'end', family: 'Tajawal', opacity: .94 })}
    ${s.source ? textBlock({ lines: [s.source], x: options.nameless ? w - s.safeX : s.safeX, y, size: domainSize, fill: p.muted, weight: 500, anchor: options.nameless ? 'end' : 'start', family: 'Tajawal', letterSpacing: 2 }) : ''}`
}

/** النطاق الرأسي المتاح للمحتوى فوق سطر الهوية. */
function contentBand(s: Scene, options: { top?: number; bottom?: number } = {}) {
  return {
    top: options.top ?? s.safeY + s.h * .02,
    bottom: options.bottom ?? s.h - s.safeY - s.min * .075,
  }
}

/** شارة افتتاحية: نقطة معدنية + نص التصنيف — بديل أنيق عن الشريط الملون الفج. */
function kickerItem(s: Scene, options: { x?: number; anchor?: Anchor; fill?: string; gap?: number } = {}): StackItem {
  if (!s.kicker) return { h: 0, draw: () => '' }
  const { palette: p, w, min } = s
  const size = Math.max(14, min * .0215)
  const fill = options.fill ?? accentInk(s)
  const anchor = options.anchor ?? 'end'
  const x = options.x ?? w - s.safeX
  return {
    h: size * 1.15,
    gap: options.gap,
    draw: (top) => {
      const baseline = top + size * .85
      const dot = anchor === 'middle' ? '' : `<circle cx="${round(x - size * .28)}" cy="${round(baseline - size * .3)}" r="${round(size * .21)}" fill="${fill}"/>`
      const textX = anchor === 'middle' ? x : x - size * 1.05
      /* الأرقام الهندية في الشارة (سنة، عدد، تاريخ): تفصيلٌ صغير يفرق بين
         تصميمٍ عربي مترجَم وتصميمٍ وُلد عربياً. */
      return `${dot}${textBlock({ lines: [toArabicIndic(s.kicker)], x: textX, y: baseline, size, fill, weight: 700, anchor, family: 'Tajawal', opacity: .95 })}`
    },
  }
}

/** فاصل قصير بلون الهوية. */
function ruleItem(s: Scene, options: { x?: number; width?: number; anchor?: 'end' | 'middle'; gap?: number } = {}): StackItem {
  const { palette: p, w, min } = s
  const lineW = options.width ?? min * .085
  const anchor = options.anchor ?? 'end'
  const x = options.x ?? w - s.safeX
  return {
    h: 3,
    gap: options.gap,
    draw: (top) => {
      const x1 = anchor === 'middle' ? x - lineW / 2 : x - lineW
      const x2 = anchor === 'middle' ? x + lineW / 2 : x
      /* مستطيلٌ لا خطّ: تدرّج المعدن لا يظهر على bbox عديم الارتفاع في SVG. */
      return `<rect x="${round(x1)}" y="${round(top)}" width="${round(x2 - x1)}" height="2.6" rx="1.3" fill="${accentInk(s)}"/>`
    },
  }
}

/** زر دعوة على هيئة حبة دواء أنيقة مع سهم عربي. */
function ctaItem(s: Scene, options: { x?: number; align?: 'right' | 'center'; gap?: number } = {}): StackItem {
  if (!s.cta) return { h: 0, draw: () => '' }
  const { palette: p, w, min } = s
  const size = Math.max(15, min * .0235)
  const label = `${s.cta}  ←`
  const padding = size * 1.35
  const pillW = Math.min(w * .8, lineWidthPx(label, size) + padding * 2)
  const pillH = size * 2.35
  const align = options.align ?? 'right'
  const x = options.x ?? (align === 'center' ? (w - pillW) / 2 : w - s.safeX - pillW)
  return {
    h: pillH,
    gap: options.gap,
    draw: (top) => `<g filter="url(#${s.uid}-shadow)"><rect x="${round(x)}" y="${round(top)}" width="${round(pillW)}" height="${round(pillH)}" rx="${round(pillH / 2)}" fill="${accentInk(s)}"/></g>
      ${textBlock({ lines: [label], x: x + pillW / 2, y: top + pillH * .655, size, fill: s.palette.atmo?.foil ? '#241B10' : '#FFFFFF', weight: 700, anchor: 'middle', family: 'Tajawal' })}`,
  }
}

/** مؤشر شرائح الكاروسيل: نقاط دقيقة + عدّاد عربي. */
function carouselItem(s: Scene, options: { gap?: number } = {}): StackItem {
  if (s.slides < 2) return { h: 0, draw: () => '' }
  const { palette: p, w, min } = s
  const count = Math.min(s.slides, 8)
  const gapX = min * .02
  const activeW = min * .034
  const dotR = min * .0065
  const totalW = activeW + (count - 1) * gapX
  return {
    h: min * .055,
    gap: options.gap ?? min * .04,
    draw: (top) => {
      const y = top + dotR * 2
      let x = (w + totalW) / 2
      const parts: string[] = []
      parts.push(`<rect x="${round(x - activeW)}" y="${round(y - dotR)}" width="${round(activeW)}" height="${round(dotR * 2)}" rx="${round(dotR)}" fill="${p.accent}"/>`)
      x -= activeW + gapX
      for (let index = 1; index < count; index += 1) {
        parts.push(`<circle cx="${round(x)}" cy="${round(y)}" r="${round(dotR)}" fill="${p.muted}" opacity=".55"/>`)
        x -= gapX
      }
      parts.push(textBlock({ lines: [`${arabicNumber(1)} / ${arabicNumber(s.slides)}`], x: w / 2, y: y + min * .036, size: Math.max(12, min * .017), fill: p.muted, weight: 500, anchor: 'middle', family: 'Tajawal', opacity: .85 }))
      return parts.join('')
    },
  }
}

/** استخراج أول قيمة رقمية لافتة (للإحصائيات). */
function extractFigure(text: string) {
  const match = String(text || '').match(/([0-9٠-٩]+(?:[.,،][0-9٠-٩]+)?)\s*(٪|%|مليون|مليار|ألف|الف|ضعف|أضعاف)?/u)
  if (!match || !match[1]) return null
  if (!match[2] && match[1].length < 2) return null
  return { value: match[1], unit: match[2] === '%' ? '٪' : (match[2] || '') }
}

/** استخراج شظايا الزمن للإعلانات (تاريخ/ساعة/يوم). */
function extractTiming(text: string) {
  const source = String(text || '')
  const patterns = [
    /\d{1,2}\s*(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)(?:\s*\d{4})?/u,
    /(?:يوم|مساء|صباح)\s+ال\S+/u,
    /الساعة\s+[\d٠-٩:.،]+\s*(?:صباحاً|مساءً|ظهراً|عصراً|صباحا|مساء)?/u,
    /[\d٠-٩]{1,2}[/\-][\d٠-٩]{1,2}(?:[/\-][\d٠-٩]{2,4})?/u,
  ]
  const found: string[] = []
  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match && match[0] && !found.includes(match[0].trim())) found.push(match[0].trim())
    if (found.length >= 3) break
  }
  return found
}

/** عنوان الفعالية بلا شظايا الزمن — الرقاقات تحمل الزمن والعنوان يحمل الفكرة. */
function cleanEventTitle(title: string, timing: string[]) {
  let clean = ` ${title} `
  for (const fragment of timing) clean = clean.split(fragment).join(' ')
  clean = clean
    .replace(/^\s*(?:محاضرة|ندوة|ورشة|دورة|لقاء|دعوة|إعلان|اعلان)\s*[:：]\s*/u, '')
    .replace(/\s*(?:يوم|بتاريخ|الموافق|الساعة)\s*(?=[—–\-،,]|$)/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:\s*[—–\-،,]\s*)+(?=\s*$)/gu, '')
    .replace(/^(?:\s*[—–\-،,]\s*)+/gu, '')
    .replace(/\s*[—–\-،,]\s*(?=[—–\-،,])/gu, '')
    .trim()
  return clean.length >= 6 ? clean : title
}

/**
 * استخراج 3–5 نقاط قصيرة للإنفوجرافيك: الأسطر المرقّمة/المنقّطة أولاً، ثم الجُمل
 * الكاملة، ثم الشظايا المفصولة بفواصل، ثم الكلمات المفتاحية ملاذاً أخيراً. كل نقطة
 * تُقصَّر إلى ثماني كلمات ولا تكرّر العنوان — كي تبقى القائمة نظيفة بلا حشو.
 */
function extractPoints(plan: CompositionPlan, max = 5): string[] {
  /* المصدر الواحد: النقاط التي ملأها المحرك (يراها الناقد أيضاً). عند غيابها
     (خططٌ مُنشأةٌ يدوياً) نستخرجها بالدالة نفسها كي لا يختلف الرسم عن الحكم. */
  const provided = plan.content.points
  if (provided && provided.length) return provided.slice(0, max)
  return extractInfographicPoints(plan.content.original || `${plan.content.title} ${plan.content.body}`, plan.content.title, (plan.content as { keywords?: string[] }).keywords || [], max)
}

/**
 * كلمات مفتاحية لخريطة المعرفة. الأولوية لمفاهيم مستقلة عن العنوان (من المحرك
 * أو من المتن) كي لا تتكرّر كلمات العنوان في العقد فوق ظهورها في السطر —
 * وهي العلّة التي رآها الدكتور: العنوان يظهر ثلاث مرات (سطراً، ومركزاً، وعُقداً).
 * `fromTitle` تُعلم الرسّام أنه لم يجد مفاهيم مستقلة فيسقط سطرَ العنوان المكرّر
 * ويترك الخريطة نفسها (المركز + العُقد) تمثّل الفكرة مرة واحدة.
 */
function mapKeywords(s: Scene): { list: string[]; fromTitle: boolean } {
  const heroNorm = normalizeForCompare(s.hero)
  const titleWords = new Set(words(s.titleText).map((word) => normalizeForCompare(word)))
  const provided = (s.plan.content as { keywords?: string[] }).keywords || []
  const bodyConcepts = words(s.bodyText).filter((word) => word.replace(/[^\p{L}]/gu, '').length >= 4)
  const distinct = [...provided, ...bodyConcepts]
    .filter((word) => {
      const norm = normalizeForCompare(word)
      return norm && norm !== heroNorm && !titleWords.has(norm)
    })
  if (distinct.length) return { list: [...new Set(distinct)].slice(0, 3), fromTitle: false }
  const titleFallback = words(s.titleText)
    .filter((word) => word.replace(/[^\p{L}]/gu, '').length >= 4 && normalizeForCompare(word) !== heroNorm)
  return { list: [...new Set(titleFallback)].slice(0, 3), fromTitle: true }
}

/**
 * ختم الهوية: الشعار المخطوط على قرص ورقي صغير بحلقة شعرية — يعمل على
 * الفاتح والداكن. يتموضع أعلى اليسار (قبالة الشارة اليمنى) وينزل تحت
 * الأشرطة العلوية في تكوينات الحدث والسينما.
 */
function identitySeal(s: Scene, href: string) {
  const { palette: p, h, min } = s
  const r = min * .042
  const topOffset = s.plan.layout === 'event-marquee' ? h * (s.isTall ? .1 : .13) + min * .035
    : s.plan.layout === 'cinematic-window' ? h * (s.isTall ? .07 : .085) + min * .035
      : 0
  const cx = s.safeX + r
  const cy = Math.max(s.safeY + r, topOffset + r)
  const size = r * 1.34
  return `<g opacity=".96">
    <circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="#FCFBF7" stroke="${s.palette.atmo?.foil ? accentInk(s) : p.rule}" stroke-width="${s.palette.atmo?.foil ? 1.8 : 1.2}"/>
    <image href="${esc(href)}" x="${round(cx - size / 2)}" y="${round(cy - size / 2)}" width="${round(size)}" height="${round(size)}" preserveAspectRatio="xMidYMid meet"/>
  </g>`
}

/** لمسة الموسم: رسمة خط واحد رفيعة بلون الهوية — حضورٌ لا زخرفة. */
function seasonalDecor(s: Scene, sealVisible: boolean) {
  const season = currentSeason()
  if (!season) return ''
  const { palette: p, h, min } = s
  const size = min * .095
  const topOffset = s.plan.layout === 'event-marquee' ? h * (s.isTall ? .1 : .13) + min * .035
    : s.plan.layout === 'cinematic-window' ? h * (s.isTall ? .07 : .085) + min * .035
      : 0
  const x = s.safeX
  const y = Math.max(s.safeY, topOffset) + (sealVisible ? min * .1 : 0)
  const star = season.id === 'eid-fitr' || season.id === 'eid-adha'
    ? `<circle cx="78" cy="26" r="4" fill="${p.accent}"/>`
    : ''
  return `<g transform="translate(${round(x)} ${round(y)}) scale(${round(size / 100)})" opacity=".4" aria-hidden="true">
    <path d="${seasonStrokePath(season.id)}" fill="none" stroke="${p.accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${star}
  </g>`
}

/* ------------------------------------------------------------------ */
/*                     المشاهد الفنية الاثنا عشر                        */
/* ------------------------------------------------------------------ */

type Painter = (s: Scene) => { defs?: string; markup: string }

/** 1 — تحريرية صافية: افتتاحية مجلة فاخرة بمحور جانبي وترقيم صفحة. */
const paintEditorialAxis: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const zoneW = w - s.safeX * 2 - w * .1
  const title = fitTitle(s, zoneW)
  const body = fitBody(s, zoneW * .84)
  const axisX = s.safeX + w * .015
  const band = contentBand(s)
  const stack = drawStack([
    kickerItem(s),
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: titleInk(s), weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .035 }),
    ruleItem(s, { gap: min * .05 }),
    textItem({ lines: body.lines, x: w - s.safeX, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.62, gap: min * .05 }),
    ctaItem(s, { gap: min * .06 }),
    carouselItem(s),
  ], band, s.sparse ? .44 : .38)
  return {
    markup: [
      `<line x1="${axisX}" y1="${round(band.top + min * .02)}" x2="${axisX}" y2="${round(band.bottom)}" stroke="${p.rule}" stroke-width="1.4" opacity=".9"/>`,
      `<circle cx="${axisX}" cy="${round(band.top + min * .02)}" r="${round(min * .008)}" fill="${p.accent}"/>`,
      textBlock({ lines: [arabicIndex(s.plan.directionIndex || 1)], x: axisX + min * .022, y: band.bottom, size: min * .02, fill: p.muted, weight: 500, anchor: 'start', family: 'Tajawal', opacity: .8 }),
      stack,
      identityFooter(s),
    ].join(''),
  }
}

/** 2 — الكلمة البطلة: كلمة ضخمة محفورة في الخلفية والعنوان يتقدمها. */
const paintHeroWord: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const hero = s.hero || words(s.titleText)[0] || ''
  const heroSize = Math.min(min * .3, (w * .92) / Math.max(1, textUnits(hero) * .555))
  const title = fitTitle(s, w * .78, { base: min * .064 })
  const body = fitBody(s, w * .62, { maxLines: 2 })
  const engraved = textBlock({ lines: [hero], x: w / 2, y: h * (s.isTall ? .3 : .32), size: heroSize, fill: 'none', anchor: 'middle', family: s.displayFamily, weight: 700 })
    .replace('<text ', `<text stroke="${p.accent}" stroke-width="1.5" stroke-opacity=".2" `)
  const stack = drawStack([
    kickerItem(s, { x: w / 2, anchor: 'middle' }),
    ruleItem(s, { x: w / 2, anchor: 'middle', width: min * .07, gap: min * .028 }),
    textItem({ lines: title.lines, x: w / 2, size: title.size, fill: titleInk(s), weight: 700, anchor: 'middle', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .05 }),
    textItem({ lines: body.lines, x: w / 2, size: body.size, fill: p.muted, weight: 400, anchor: 'middle', family: s.bodyFamily, lineHeight: 1.6, gap: min * .045 }),
    ctaItem(s, { align: 'center', gap: min * .06 }),
    carouselItem(s),
  ], contentBand(s), .46)
  return {
    markup: [engraved, stack, identityFooter(s, { mode: 'center' })].join(''),
  }
}

/** 3 — منصة الاقتباس: علامة تنصيص معمارية واقتباس يتنفس وتوقيع. */
const paintQuoteStage: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const quoteText = s.plan.content.quote || s.titleText
  const zoneW = w - s.safeX * 2 - w * .06
  const base = min * (s.sparse ? .062 : .056)
  const lines = wrap(quoteText, Math.max(8, zoneW / (base * .555)), s.isWide ? 4 : 6)
  const size = fitted(lines, base, zoneW, h * .46, 1.66, .5)
  const markSize = min * .3
  const quoteItem: StackItem = {
    h: blockHeight(lines, size, 1.66),
    gap: min * .06,
    draw: (top) => [
      `<text x="${round(w - s.safeX * .82)}" y="${round(top - min * .01)}" fill="${p.accent}" opacity=".16" font-family="${esc(fontStack(s.displayFamily))}" font-weight="700" font-size="${round(markSize)}" text-anchor="end">”</text>`,
      textBlock({ lines, x: w - s.safeX, y: top + size * .82, size, fill: titleInk(s), weight: 500, family: s.displayFamily, lineHeight: 1.58 }),
    ].join(''),
  }
  const signature: StackItem = {
    h: min * .07,
    gap: min * .075,
    draw: (top) => [
      `<line x1="${w - s.safeX}" y1="${round(top)}" x2="${w - s.safeX - min * .09}" y2="${round(top)}" stroke="${p.accent}" stroke-width="2.4"/>`,
      textBlock({ lines: [s.author], x: w - s.safeX, y: top + min * .05, size: Math.max(16, min * .026), fill: p.accent, weight: 700, family: 'Tajawal' }),
    ].join(''),
  }
  const stack = drawStack([
    kickerItem(s, { gap: min * .02 }),
    quoteItem,
    signature,
    carouselItem(s),
  ], contentBand(s), .42)
  return {
    markup: [stack, identityFooter(s, { mode: 'center', nameless: true })].join(''),
  }
}

/** 4 — الأطروحة المزدوجة: لوح جانبي محكم يواجه متناً هادئاً. */
const paintDualThesis: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const full = s.sparse || s.isTall
  const panelW = full ? w - s.safeX * 2 : w * (s.isWide ? .44 : .5)
  const panelX = w - s.safeX - panelW
  const pad = min * .055
  const title = fitTitle(s, panelW - pad * 2, { base: min * .06 })
  const titleH = blockHeight(title.lines, title.size, s.titleLineHeight)
  const panelH = titleH + pad * 2 + min * .085
  const body = full
    ? fitBody(s, panelW - pad * 2, { maxLines: 4 })
    : fitBody(s, w - panelW - s.safeX * 2 - min * .06, { maxLines: s.isWide ? 4 : 6 })
  const bodyH = blockHeight(body.lines, body.size, 1.68)
  const band = contentBand(s)
  const panelItem: StackItem = {
    h: panelH,
    draw: (top) => [
      `<g filter="url(#${s.uid}-shadow)"><rect x="${round(panelX)}" y="${round(top)}" width="${round(panelW)}" height="${round(panelH)}" rx="${round(min * .028)}" fill="${p.isDark ? p.surface : p.accentSoft}" opacity="${p.isDark ? 1 : .75}"/></g>`,
      `<rect x="${round(panelX + panelW - pad * .42)}" y="${round(top + pad * .9)}" width="${round(min * .006)}" height="${round(panelH - pad * 1.8)}" rx="3" fill="${p.accent}" opacity=".9"/>`,
      drawStack([
        kickerItem(s, { x: panelX + panelW - pad }),
        textItem({ lines: title.lines, x: panelX + panelW - pad, size: title.size, fill: titleInk(s), weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .03 }),
      ], { top: top + pad * .8, bottom: top + panelH - pad * .8 }, .35),
      !full && body.lines.length ? [
        textBlock({ lines: [arabicIndex(1)], x: panelX - min * .06, y: top + pad + min * .012, size: min * .03, fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal', opacity: .9 }),
        textBlock({ lines: body.lines, x: panelX - min * .06, y: top + pad + min * .07, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.68 }),
      ].join('') : '',
    ].join(''),
  }
  const fullBody: StackItem = full && body.lines.length
    ? textItem({ lines: body.lines, x: w - s.safeX - pad, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.68, gap: min * .055 })
    : { h: 0, draw: () => '' }
  const stack = drawStack([
    panelItem,
    fullBody,
    ctaItem(s, { gap: min * .06 }),
    carouselItem(s),
  ], band, .4)
  return { markup: [stack, identityFooter(s)].join('') }
}

/** 5 — سجل الدليل: الرقم بطلاً على دفتر معرفي مسطور. */
const paintEvidenceLedger: Painter = (s) => {
  const { palette: p, w, min } = s
  const figure = extractFigure(`${s.titleText} ${s.bodyText} ${s.plan.content.original}`)
  const title = fitTitle(s, w - s.safeX * 2 - w * .06, { base: min * (figure ? .05 : .058) })
  const body = fitBody(s, w - s.safeX * 2 - w * .14)
  const figureSize = min * .19
  const figureItem: StackItem = figure ? {
    h: figureSize * 1.24,
    gap: min * .035,
    draw: (top) => [
      `<text x="${w - s.safeX}" y="${round(top + figureSize * .92)}" text-anchor="end" direction="ltr"><tspan fill="${p.accent}" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="500" font-size="${round(figureSize)}">${esc(figure.value)}</tspan>${figure.unit ? `<tspan fill="${p.muted}" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="500" font-size="${round(min * .055)}" dx="8">${esc(figure.unit)}</tspan>` : ''}</text>`,
      `<line x1="${w - s.safeX}" y1="${round(top + figureSize * 1.18)}" x2="${w - s.safeX - min * .14}" y2="${round(top + figureSize * 1.18)}" stroke="${p.accent}" stroke-width="3" opacity=".85"/>`,
    ].join(''),
  } : { h: 0, draw: () => '' }
  const ledgerBody: StackItem = body.lines.length ? {
    h: blockHeight(body.lines, body.size, 1.62),
    gap: min * .055,
    draw: (top) => [
      body.lines.map((_, index) => {
        const ruleY = top + (index + .95) * body.size * 1.62
        return `<line x1="${s.safeX}" y1="${round(ruleY)}" x2="${w - s.safeX}" y2="${round(ruleY)}" stroke="${p.rule}" stroke-width="1" opacity=".55"/>`
      }).join(''),
      textBlock({ lines: body.lines, x: w - s.safeX, y: top + body.size * .82, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.62 }),
    ].join(''),
  } : { h: 0, draw: () => '' }
  const stack = drawStack([
    kickerItem(s),
    figureItem,
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: titleInk(s), weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: figure ? '' : s.hero, emphasisFill: accentInk(s), gap: min * .04 }),
    ledgerBody,
    ctaItem(s, { gap: min * .06 }),
    carouselItem(s),
  ], contentBand(s), .4)
  return { markup: [stack, identityFooter(s)].join('') }
}

/** 6 — واجهة الحدث: شريط علوي محكم وتفاصيل زمن ودعوة واضحة. */
const paintEventMarquee: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const bandH = h * (s.isTall ? .1 : .13)
  const timing = extractTiming(s.plan.content.original)
  const cleanTitle = cleanEventTitle(s.titleText, timing)
  const scene = { ...s, titleText: cleanTitle }
  const title = fitTitle(scene as Scene, w - s.safeX * 2, { base: min * .07 })
  const body = fitBody(s, w - s.safeX * 2 - w * .1, { maxLines: 3 })
  const chipSize = Math.max(13, min * .02)
  const chipsItem: StackItem = timing.length ? {
    h: chipSize * 2.3,
    gap: min * .045,
    draw: (top) => timing.slice(0, 2).map((fragment, index) => {
      const chipW = lineWidthPx(fragment, chipSize) + chipSize * 2.4
      const previousWidths = timing.slice(0, index).reduce((sum, other) => sum + lineWidthPx(other, chipSize) + chipSize * 2.4 + min * .02, 0)
      const x = w - s.safeX - chipW - previousWidths
      return `<rect x="${round(x)}" y="${round(top)}" width="${round(chipW)}" height="${round(chipSize * 2.3)}" rx="${round(chipSize * 1.15)}" fill="none" stroke="${p.accent}" stroke-width="1.6"/>
        ${textBlock({ lines: [fragment], x: x + chipW / 2, y: top + chipSize * 1.55, size: chipSize, fill: p.accent, weight: 700, anchor: 'middle', family: 'Tajawal' })}`
    }).join(''),
  } : { h: 0, draw: () => '' }
  const stack = drawStack([
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: p.ink, weight: 700, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s) }),
    chipsItem,
    textItem({ lines: body.lines, x: w - s.safeX, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.6, gap: min * .05 }),
    ctaItem(s, { gap: min * .065 }),
    carouselItem(s),
  ], contentBand(s, { top: bandH + min * .06 }), .38)
  return {
    markup: [
      `<rect x="0" y="0" width="${w}" height="${round(bandH)}" fill="${p.accent}"/>`,
      `<rect x="0" y="${round(bandH)}" width="${w}" height="${round(min * .006)}" fill="${p.isDark ? p.rule : p.accentSoft}"/>`,
      textBlock({ lines: [s.kicker], x: w - s.safeX, y: bandH * .62, size: Math.max(15, min * .024), fill: '#FFFFFF', weight: 700, family: 'Tajawal' }),
      s.source ? textBlock({ lines: [s.source], x: s.safeX, y: bandH * .6, size: Math.max(11, min * .016), fill: 'rgba(255,255,255,.8)', weight: 500, anchor: 'start', family: 'Tajawal', letterSpacing: 1.8 }) : '',
      stack,
      identityFooter(s),
    ].join(''),
  }
}

/** 7 — خريطة المعرفة: عقدة مركزية ومفاهيم تدور حولها بخيوط هادئة. */
const paintKnowledgeMap: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const title = fitTitle(s, w - s.safeX * 2, { base: min * .052, maxLines: 3 })
  const { list: keywords, fromTitle } = mapKeywords(s)
  /* حين تُشتقّ العُقد من العنوان نفسه (لا مفاهيم مستقلة) نُسقط سطر العنوان
     المكرّر ونترك الخريطة تنطق الفكرة مرة واحدة — علاج تكرار العنوان. */
  const showTitleHeading = !fromTitle
  const titleH = showTitleHeading ? blockHeight(title.lines, title.size, s.titleLineHeight) : 0
  const hero = s.hero || words(s.titleText)[0] || '·'
  const band = contentBand(s)
  const titleTop = band.top + min * .01
  const mapTop = titleTop + titleH + (showTitleHeading ? min * .05 : min * .02)
  const centerX = s.isWide ? w * .26 : w / 2
  const centerY = s.isWide ? h * .52 : (mapTop + band.bottom) / 2
  const coreR = clamp(textUnits(hero) * min * .017, min * .1, min * .16)
  const orbitR = Math.min(coreR + min * (s.isWide ? .17 : .15), (band.bottom - mapTop) / 2)
  const angles = s.isWide ? [-70, 25, 115] : [-55, 5, 65]
  const satellites = keywords.map((keyword, index) => {
    const angle = ((angles[index] ?? index * 120) * Math.PI) / 180
    const x = centerX + Math.cos(angle) * orbitR
    const y = centerY + Math.sin(angle) * orbitR
    const r = clamp(textUnits(keyword) * min * .013, min * .052, min * .085)
    return `
      <path d="M ${round(centerX + Math.cos(angle) * coreR)} ${round(centerY + Math.sin(angle) * coreR)} L ${round(x - Math.cos(angle) * r)} ${round(y - Math.sin(angle) * r)}" stroke="${p.accent}" stroke-width="1.5" stroke-dasharray="1 6" stroke-linecap="round" opacity=".7"/>
      <circle cx="${round(x)}" cy="${round(y)}" r="${round(r)}" fill="${p.surface}" stroke="${p.rule}" stroke-width="1.4"/>
      ${textBlock({ lines: [keyword], x, y: y + min * .009, size: Math.max(12, min * .022), fill: p.muted, weight: 500, anchor: 'middle', family: 'Tajawal' })}`
  }).join('')
  return {
    markup: [
      kickerItem(s).draw(titleTop - min * .045),
      showTitleHeading ? textBlock({ lines: title.lines, x: w - s.safeX, y: titleTop + title.size * .82, size: title.size, fill: titleInk(s), weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight }) : '',
      `<circle cx="${round(centerX)}" cy="${round(centerY)}" r="${round(orbitR)}" fill="none" stroke="${p.rule}" stroke-width="1.1" opacity=".55"/>`,
      `<g filter="url(#${s.uid}-shadow)"><circle cx="${round(centerX)}" cy="${round(centerY)}" r="${round(coreR)}" fill="${p.accent}"/></g>`,
      textBlock({ lines: [hero], x: centerX, y: centerY + min * .013, size: clamp((coreR * 1.55) / Math.max(1, textUnits(hero) * .555), min * .022, min * .04), fill: '#FFFFFF', weight: 700, anchor: 'middle', family: s.displayFamily }),
      satellites,
      identityFooter(s),
    ].join(''),
  }
}

/** 8 — المدار الهادئ: أفلاك رقيقة تحتضن فكرة مركزية. */
const paintQuietOrbit: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const cx = w / 2
  const cy = h * (s.isTall ? .44 : .46)
  const outer = min * (s.isWide ? .34 : .37)
  const title = fitTitle(s, Math.min(w * .74, outer * 2.3), { base: min * .058 })
  const body = fitBody(s, Math.min(w * .62, outer * 2), { maxLines: 2 })
  const angle = -Math.PI / 3.4
  const stack = drawStack([
    kickerItem(s, { x: cx, anchor: 'middle' }),
    textItem({ lines: title.lines, x: cx, size: title.size, fill: titleInk(s), weight: s.titleWeight, anchor: 'middle', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .045 }),
    textItem({ lines: body.lines, x: cx, size: body.size, fill: p.muted, weight: 400, anchor: 'middle', family: s.bodyFamily, lineHeight: 1.6, gap: min * .045 }),
  ], { top: cy - outer * .62, bottom: cy + outer * .62 }, .5)
  return {
    markup: [
      `<circle cx="${cx}" cy="${cy}" r="${round(outer)}" fill="none" stroke="${p.rule}" stroke-width="1.2" opacity=".8"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${round(outer * .8)}" fill="none" stroke="${p.accent}" stroke-width="1.1" opacity=".3"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${round(outer * .6)}" fill="none" stroke="${p.rule}" stroke-width="1" opacity=".45"/>`,
      `<circle cx="${round(cx + Math.cos(angle) * outer)}" cy="${round(cy + Math.sin(angle) * outer)}" r="${round(min * .011)}" fill="${p.accent}"/>`,
      `<circle cx="${round(cx - Math.cos(angle * .6) * outer * .8)}" cy="${round(cy - Math.sin(angle * .6) * outer * .8)}" r="${round(min * .007)}" fill="${p.accent}" opacity=".6"/>`,
      stack,
      drawStack([ctaItem(s, { align: 'center' }), carouselItem(s)], { top: cy + outer + min * .04, bottom: h - s.safeY - min * .075 }, .25),
      identityFooter(s),
    ].join(''),
  }
}

/** 9 — فصول الفكرة: أوراق متراكبة بترقيم فصلي، مهيأة للسلاسل. */
const paintChapterStack: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const sheetX = s.safeX * .9
  const sheetW = w - sheetX * 2
  const pad = min * .055
  const title = fitTitle(s, sheetW - pad * 2 - w * .08)
  const body = fitBody(s, sheetW - pad * 2 - w * .04)
  const headerH = min * .1
  const innerStackItems: StackItem[] = [
    textItem({ lines: title.lines, x: sheetX + sheetW - pad, size: title.size, fill: titleInk(s), weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s) }),
    ruleItem(s, { x: sheetX + sheetW - pad, gap: min * .04 }),
    textItem({ lines: body.lines, x: sheetX + sheetW - pad, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.64, gap: min * .05 }),
    ctaItem(s, { x: sheetX + pad, gap: min * .06 }),
  ]
  const innerH = innerStackItems.reduce((sum, item) => sum + item.h + (item.gap || 0), 0)
  const dotsH = s.slides > 1 ? min * .1 : 0
  const sheetH = clamp(headerH + innerH + dotsH + pad * 2.4, h * .44, h * .74)
  const band = contentBand(s)
  const sheetTop = clamp(band.top + (band.bottom - band.top - sheetH) * .42, band.top, Math.max(band.top, band.bottom - sheetH))
  const offset = min * .016
  return {
    markup: [
      `<rect x="${round(sheetX + offset * 2)}" y="${round(sheetTop - offset * 2)}" width="${round(sheetW - offset * 4)}" height="${round(sheetH)}" rx="${round(min * .025)}" fill="${p.surface}" stroke="${p.rule}" stroke-width="1" opacity=".45"/>`,
      `<rect x="${round(sheetX + offset)}" y="${round(sheetTop - offset)}" width="${round(sheetW - offset * 2)}" height="${round(sheetH)}" rx="${round(min * .025)}" fill="${p.surface}" stroke="${p.rule}" stroke-width="1" opacity=".7"/>`,
      `<g filter="url(#${s.uid}-shadow)"><rect x="${round(sheetX)}" y="${round(sheetTop)}" width="${round(sheetW)}" height="${round(sheetH)}" rx="${round(min * .025)}" fill="${p.surface}"/></g>`,
      textBlock({ lines: ['01'], x: sheetX + pad, y: sheetTop + pad + min * .07, size: min * .085, fill: p.accent, weight: 700, anchor: 'start', family: 'Tajawal', opacity: .26 }),
      kickerItem(s, { x: sheetX + sheetW - pad }).draw(sheetTop + pad),
      drawStack(innerStackItems, { top: sheetTop + pad + headerH, bottom: sheetTop + sheetH - pad - dotsH }, .4),
      s.slides > 1 ? carouselItem(s, { gap: 0 }).draw(sheetTop + sheetH - pad - dotsH + min * .02) : '',
      identityFooter(s),
    ].join(''),
  }
}

/** 10 — النافذة السينمائية: أشرطة عرض ولوح عنوان عالي التباين. */
const paintCinematicWindow: Painter = (s) => {
  const { palette: p, w, h, min, uid } = s
  const heroImage = s.plan.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background' && item.src)
  if (heroImage) {
    const zone = heroImage.textZone || 'right'
    const horizontalZone = zone === 'right' || zone === 'left'
    const rightSide = zone !== 'left'
    const contentW = w * (horizontalZone ? (s.isWide ? .52 : .64) : .78)
    const imageLayout = s.plan.layout
    const variant = imageLayout === 'hero-word'
      ? 'monument'
      : ['quote-stage', 'human-note', 'quiet-orbit'].includes(imageLayout)
        ? 'quiet'
        : ['evidence-ledger', 'modular-brief', 'infographic', 'knowledge-map'].includes(imageLayout)
          ? 'ledger'
          : imageLayout === 'event-marquee'
            ? 'marquee'
            : imageLayout === 'cinematic-window'
              ? 'cinematic'
              : 'editorial'
    const titleBase = variant === 'monument'
      ? min * (s.isTall ? .086 : .1)
      : variant === 'quiet'
        ? min * .069
        : variant === 'ledger'
          ? min * .058
          : variant === 'marquee'
            ? min * .078
            : min * (s.isTall ? .062 : .072)
    const title = fitTitle(s, contentW, { base: titleBase, maxLines: variant === 'monument' ? 3 : s.isTall ? 4 : 3 })
    const body = fitBody(s, contentW, { maxLines: variant === 'ledger' ? 4 : variant === 'quiet' ? 3 : s.isTall ? 3 : 2 })
    const titleH = blockHeight(title.lines, title.size, s.titleLineHeight)
    const bodyH = blockHeight(body.lines, body.size, 1.64)
    const titleX = horizontalZone ? (rightSide ? w - s.safeX : s.safeX) : w - s.safeX
    const anchor = horizontalZone ? (rightSide ? 'end' as const : 'start' as const) : 'end' as const
    const top = zone === 'bottom'
      ? h * (variant === 'monument' ? .54 : .5)
      : zone === 'top'
        ? h * .16
        : h * (variant === 'quiet' ? .31 : .24)
    const lineX = anchor === 'end' ? titleX + min * .018 : titleX - min * .018
    const kickerSize = Math.max(13, min * .021)
    const kickerW = Math.min(contentW * .58, lineWidthPx(s.kicker, kickerSize) + min * .08)
    const kickerX = anchor === 'end' ? titleX - kickerW : titleX
    const kickerTextX = kickerX + kickerW / 2
    const titleTop = top + (variant === 'monument' ? min * .035 : min * .085)
    const bodyTop = titleTop + titleH + min * .065
    const ctaTop = bodyTop + bodyH + min * .06
    const textInk = p.isDark ? '#F7F5EF' : p.ink
    const textMuted = p.isDark ? 'rgba(247,245,239,.82)' : p.muted
    const titleMarkup = textBlock({
      lines: title.lines,
      x: titleX,
      y: titleTop + title.size * .82,
      size: title.size,
      fill: textInk,
      weight: variant === 'quiet' ? 600 : 700,
      anchor,
      family: s.displayFamily,
      lineHeight: s.titleLineHeight,
      emphasisWord: s.hero,
      emphasisFill: accentInk(s),
    })
    const bodyMarkup = body.lines.length ? textBlock({
      lines: body.lines,
      x: titleX,
      y: bodyTop + body.size * .82,
      size: body.size,
      fill: textMuted,
      weight: 400,
      anchor,
      family: s.bodyFamily,
      lineHeight: 1.64,
    }) : ''
    const ornament = variant === 'monument'
      ? `<circle cx="${round(anchor === 'end' ? titleX - contentW + min * .04 : titleX + contentW - min * .04)}" cy="${round(titleTop + min * .04)}" r="${round(min * .034)}" fill="none" stroke="${p.accent}" stroke-width="${round(min * .006)}" opacity=".9"/>`
      : variant === 'quiet'
        ? textBlock({ lines: ['”'], x: anchor === 'end' ? titleX : titleX + min * .09, y: titleTop - min * .025, size: min * .12, fill: p.accent, weight: 700, anchor, family: s.displayFamily, opacity: .82 })
        : variant === 'ledger'
          ? `${textBlock({ lines: ['01'], x: anchor === 'end' ? titleX - contentW : titleX + contentW, y: top + min * .035, size: min * .058, fill: p.accent, weight: 700, anchor: anchor === 'end' ? 'start' : 'end', family: 'Tajawal', opacity: .82 })}<line x1="${round(anchor === 'end' ? titleX - contentW : titleX)}" y1="${round(top + min * .06)}" x2="${round(anchor === 'end' ? titleX : titleX + contentW)}" y2="${round(top + min * .06)}" stroke="${p.rule}" stroke-width="1.2" opacity=".8"/>`
          : variant === 'marquee' || variant === 'cinematic'
            ? `<rect x="${round(kickerX)}" y="${round(top)}" width="${round(kickerW)}" height="${round(min * .058)}" rx="${round(variant === 'cinematic' ? min * .029 : min * .012)}" fill="${p.accent}" opacity=".96"/>`
            : `<rect x="${round(lineX)}" y="${round(titleTop - min * .01)}" width="${round(min * .006)}" height="${round(Math.max(titleH, min * .15))}" rx="${round(min * .004)}" fill="${p.accent}"/>`
    const showKickerPill = variant === 'marquee' || variant === 'cinematic'
    return {
      markup: [
        ornament,
        showKickerPill ? textBlock({ lines: [s.kicker], x: kickerTextX, y: top + min * .038, size: kickerSize, fill: '#F7F5EF', weight: 700, anchor: 'middle', family: 'Tajawal' }) : variant === 'ledger' || variant === 'monument' ? '' : textBlock({ lines: [s.kicker], x: titleX, y: top + min * .025, size: kickerSize, fill: p.accent, weight: 700, anchor, family: 'Tajawal' }),
        titleMarkup,
        bodyMarkup,
        s.cta ? textBlock({ lines: [s.cta], x: titleX, y: ctaTop + min * .022, size: Math.max(13, min * .021), fill: p.accent, weight: 700, anchor, family: 'Tajawal' }) : '',
        s.slides > 1 ? textBlock({ lines: [`01/${String(s.slides).padStart(2, '0')}`], x: s.safeX, y: s.safeY * .72, size: Math.max(12, min * .019), fill: 'rgba(247,245,239,.74)', weight: 600, anchor: 'start', family: 'Tajawal' }) : '',
        s.slides > 1 ? carouselItem(s, { gap: 0 }).draw(h - s.safeY - min * .1) : '',
        identityFooter(s, { mode: variant === 'quiet' ? 'center' : 'standard' }),
      ].join(''),
    }
  }
  const barH = h * (s.isTall ? .07 : .085)
  const pad = min * .055
  const title = fitTitle(s, w - s.safeX * 2 - pad * 2, { base: min * .07 })
  const titleH = blockHeight(title.lines, title.size, s.titleLineHeight)
  const windowH = clamp(titleH + pad * 2.6, h * .26, h * .52)
  const body = fitBody(s, w - s.safeX * 2 - pad, { maxLines: 2 })
  const ink = p.isDark ? '#0C1218' : '#17222D'
  const band = contentBand(s, { top: barH + min * .05, bottom: h - barH - min * .05 })
  const windowItem: StackItem = {
    h: windowH,
    draw: (top) => [
      `<g filter="url(#${uid}-shadow)"><rect x="${round(s.safeX)}" y="${round(top)}" width="${round(w - s.safeX * 2)}" height="${round(windowH)}" rx="${round(min * .02)}" fill="url(#${uid}-cine)"/></g>`,
      textBlock({ lines: title.lines, x: w - s.safeX - pad, y: top + (windowH - titleH) / 2 + title.size * .82, size: title.size, fill: '#F7F5EF', weight: 700, family: s.displayFamily, lineHeight: s.titleLineHeight }),
    ].join(''),
  }
  const stack = drawStack([
    windowItem,
    textItem({ lines: body.lines, x: w - s.safeX, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.6, gap: min * .05 }),
    ctaItem(s, { gap: min * .06 }),
    carouselItem(s),
  ], band, .42)
  return {
    defs: `<linearGradient id="${uid}-cine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.accent}"/>
      <stop offset="1" stop-color="${ink}"/>
    </linearGradient>`,
    markup: [
      `<rect x="0" y="0" width="${w}" height="${round(barH)}" fill="${ink}"/>`,
      `<rect x="0" y="${round(h - barH)}" width="${w}" height="${round(barH)}" fill="${ink}"/>`,
      textBlock({ lines: [s.kicker], x: w - s.safeX, y: barH * .64, size: Math.max(13, min * .02), fill: 'rgba(247,245,239,.92)', weight: 700, family: 'Tajawal' }),
      stack,
      s.author ? textBlock({ lines: [s.author], x: w - s.safeX, y: h - barH * .36, size: Math.max(13, min * .02), fill: 'rgba(247,245,239,.9)', weight: 600, family: 'Tajawal' }) : '',
      s.source ? textBlock({ lines: [s.source], x: s.safeX, y: h - barH * .36, size: Math.max(11, min * .015), fill: 'rgba(247,245,239,.62)', weight: 500, anchor: 'start', family: 'Tajawal', letterSpacing: 1.8 }) : '',
    ].join(''),
  }
}

/** 11 — الملاحظة الإنسانية: ورقة دافئة بشريط لاصق وخط تحتي مرسوم باليد. */
const paintHumanNote: Painter = (s) => {
  const { palette: p, w, h, min, uid } = s
  const sheetX = s.safeX
  const sheetW = w - sheetX * 2
  const pad = min * .06
  const title = fitTitle(s, sheetW - pad * 2, { base: min * .054 })
  const body = fitBody(s, sheetW - pad * 2 - w * .04)
  const underlineW = Math.min(sheetW * .5, lineWidthPx(title.lines[title.lines.length - 1] || '', title.size) * .7)
  const innerItems: StackItem[] = [
    kickerItem(s, { x: w - sheetX - pad }),
    {
      ...textItem({ lines: title.lines, x: w - sheetX - pad, size: title.size, fill: p.ink, weight: 500, family: s.displayFamily, lineHeight: 1.55, gap: min * .035 }),
      draw: (top) => [
        textBlock({ lines: title.lines, x: w - sheetX - pad, y: top + title.size * .82, size: title.size, fill: p.ink, weight: 500, family: s.displayFamily, lineHeight: 1.55 }),
        `<path d="M ${round(w - sheetX - pad)} ${round(top + blockHeight(title.lines, title.size, 1.62) + min * .018)} q ${round(-underlineW * .34)} ${round(min * .012)} ${round(-underlineW)} ${round(min * .004)}" fill="none" stroke="${p.accent}" stroke-width="3" stroke-linecap="round" opacity=".55"/>`,
      ].join(''),
    },
    textItem({ lines: body.lines, x: w - sheetX - pad, size: body.size, fill: p.muted, weight: 400, family: 'Tajawal', lineHeight: 1.75, gap: min * .07 }),
    ctaItem(s, { x: sheetX + pad, gap: min * .06 }),
  ]
  const innerH = innerItems.reduce((sum, item) => sum + item.h + (item.gap || 0), 0)
  const signatureH = min * .07
  const sheetH = clamp(innerH + signatureH + pad * 2.6, h * .42, h * .72)
  const band = contentBand(s)
  const sheetTop = clamp(band.top + (band.bottom - band.top - sheetH) * .44, band.top, Math.max(band.top, band.bottom - sheetH))
  return {
    markup: [
      `<g transform="rotate(-1.35 ${w / 2} ${h / 2})" filter="url(#${uid}-shadow)">
        <rect x="${round(sheetX)}" y="${round(sheetTop)}" width="${round(sheetW)}" height="${round(sheetH)}" rx="${round(min * .018)}" fill="${p.surface}" stroke="${p.rule}" stroke-width="1"/>
      </g>`,
      `<rect x="${round(w / 2 - min * .075)}" y="${round(sheetTop - min * .022)}" width="${round(min * .15)}" height="${round(min * .045)}" rx="${round(min * .006)}" fill="${p.accentSoft}" opacity=".92" transform="rotate(-2.4 ${w / 2} ${sheetTop})"/>`,
      drawStack(innerItems, { top: sheetTop + pad, bottom: sheetTop + sheetH - pad - signatureH }, .4),
      textBlock({ lines: [s.author], x: sheetX + pad, y: sheetTop + sheetH - pad * .75, size: Math.max(15, min * .024), fill: p.accent, weight: 700, anchor: 'start', family: s.displayFamily }),
      carouselItem(s, { gap: 0 }).draw(sheetTop + sheetH + min * .025),
      identityFooter(s, { mode: 'center', nameless: true }),
    ].join(''),
  }
}

/** 12 — الملخص المركب: وحدات متدرجة المقام كأنها صفحة هوية مؤسسية. */
const paintModularBrief: Painter = (s) => {
  const { palette: p, w, min, uid } = s
  const gap = min * .022
  const x0 = s.safeX
  const x1 = w - s.safeX
  const contentW = x1 - x0
  const kickerH = min * .09
  const kickerW = Math.min(contentW * .38, lineWidthPx(s.kicker, min * .024) + min * .09)
  const title = fitTitle(s, contentW - min * .12)
  const titleCardH = blockHeight(title.lines, title.size, s.titleLineHeight) + min * .12
  const body = fitBody(s, contentW - min * .12)
  const bodyCardH = body.lines.length ? blockHeight(body.lines, body.size, 1.64) + min * .1 : 0
  const headerItem: StackItem = {
    h: kickerH,
    draw: (top) => [
      `<rect x="${round(x1 - kickerW)}" y="${round(top)}" width="${round(kickerW)}" height="${round(kickerH)}" rx="${round(min * .018)}" fill="${p.accent}"/>`,
      textBlock({ lines: [s.kicker], x: x1 - kickerW / 2, y: top + kickerH * .62, size: Math.max(14, min * .022), fill: '#FFFFFF', weight: 700, anchor: 'middle', family: 'Tajawal' }),
      `<rect x="${round(x0)}" y="${round(top)}" width="${round(contentW - kickerW - gap)}" height="${round(kickerH)}" rx="${round(min * .018)}" fill="${p.surface}" stroke="${p.rule}" stroke-width="1"/>`,
      s.source ? textBlock({ lines: [s.source], x: x0 + (contentW - kickerW - gap) / 2, y: top + kickerH * .6, size: Math.max(11, min * .016), fill: p.muted, weight: 500, anchor: 'middle', family: 'Tajawal', letterSpacing: 1.6 }) : '',
    ].join(''),
  }
  const titleItem: StackItem = {
    h: titleCardH,
    gap,
    draw: (top) => [
      `<g filter="url(#${uid}-shadow)"><rect x="${round(x0)}" y="${round(top)}" width="${round(contentW)}" height="${round(titleCardH)}" rx="${round(min * .02)}" fill="${p.surface}"/></g>`,
      `<rect x="${round(x1 - min * .034)}" y="${round(top + min * .05)}" width="${round(min * .006)}" height="${round(titleCardH - min * .1)}" rx="3" fill="${p.accent}"/>`,
      textBlock({ lines: title.lines, x: x1 - min * .062, y: top + min * .06 + title.size * .82, size: title.size, fill: titleInk(s), weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s) }),
    ].join(''),
  }
  const bodyItem: StackItem = body.lines.length ? {
    h: bodyCardH,
    gap,
    draw: (top) => [
      `<rect x="${round(x0)}" y="${round(top)}" width="${round(contentW)}" height="${round(bodyCardH)}" rx="${round(min * .02)}" fill="${p.isDark ? p.surface : p.accentSoft}" opacity="${p.isDark ? .75 : .5}"/>`,
      textBlock({ lines: body.lines, x: x1 - min * .062, y: top + min * .05 + body.size * .82, size: body.size, fill: p.isDark ? p.muted : p.ink, weight: 400, family: s.bodyFamily, lineHeight: 1.64, opacity: p.isDark ? 1 : .82 }),
    ].join(''),
  } : { h: 0, draw: () => '' }
  const stack = drawStack([
    headerItem,
    titleItem,
    bodyItem,
    ctaItem(s, { gap: gap * 1.6 }),
    carouselItem(s),
  ], contentBand(s), .4)
  return { markup: [stack, identityFooter(s)].join('') }
}

/* 13 — إنفوجرافيك مرقّم بخمسة اتجاهاتٍ فنية (أمر الدكتور: إبداعٌ وتنويع).
   جوهرٌ واحد (عنوان + إحصاءةٌ اختيارية + نقاطٌ مرقّمة)، وخمسُ كسواتٍ متمايزة —
   يُنتقى الاتجاه ببصمة التصميم فيتنوّع بين الاتجاهات والدفعات بلا تكرارٍ ولا عشوائية:
   • السكة    — أقراصٌ فهرسيةٌ يميناً وفواصلُ شعرية (تحريريّ صافٍ).
   • الأرقام  — أرقامٌ ترتيبيةٌ ضخمةٌ محفورةٌ بالخط (مجلاتيّ).
   • البطاقات — كلُّ نقطةٍ في بطاقةٍ لينةٍ بشارةٍ صغيرة (مؤسسيّ مركّب).
   • المسار   — عقدٌ متّصلةٌ بخيطٍ رأسيٍّ للخطوات (تدفّقٌ زمني).
   • الحلقة   — الإحصاءة في حلقةٍ بيانيةٍ بقوسِ نسبتها (بصريّ للأرقام). */
export type InfoVariant = InfographicVariantId

/**
 * انتقاء الاتجاه الفنّي للإنفوجرافيك — مصدرٌ واحدٌ للحقيقة يستدعيه الرسّام والفحص.
 * قائمةٌ مرجّحةٌ بالمحتوى (المسار للخطوات، الحلقة/البطاقات للأرقام) تُنتقى منها ببصمة
 * التصميم، فيتنوّع الاتجاه بين الاتجاهات والدفعات بثباتٍ بلا عشوائية.
 */
export function infographicVariantOf(plan: CompositionPlan): InfoVariant {
  // اختيار الدكتور اليدوي يتقدّم على الانتقاء التلقائي بالبصمة.
  if (plan.infoVariant) return plan.infoVariant
  const figure = extractFigure(`${plan.content.subtitle} ${distinctBody(plan)} ${plan.content.original}`)
  const ordered = /(?:^|\n)\s*(?:[0-9٠-٩]+[.)\-]|أولاً|ثانياً|ثالثاً|أولا|ثانيا|ثالثا|خطوة)/.test(plan.content.original) || /(?:خطوات|كيف)/.test(plan.content.title)
  const pool: InfoVariant[] = ['rail', 'ordinal', 'cards']
  pool.push(ordered ? 'timeline' : 'rail', 'timeline')
  if (figure) pool.push('ring', 'ring', 'cards', 'spotlight')
  return pool[hashString(plan.fingerprint) % pool.length]
}

const paintInfographic: Painter = (s) => {
  const { palette: p, w, min } = s
  const contentW = w - s.safeX * 2
  const figure = extractFigure(`${s.plan.content.subtitle} ${s.bodyText} ${s.plan.content.original}`)
  const pointKeys0 = new Set(extractPoints(s.plan, 6).map((point) => normalizeForCompare(point)))
  const variant = infographicVariantOf(s.plan)

  const maxPoints = variant === 'cards' || variant === 'ring' ? (s.isTall ? 5 : 3) : s.isWide ? 3 : s.isTall ? 5 : 4
  const points = extractPoints(s.plan, maxPoints)
  const pointKeys = new Set(points.map((point) => normalizeForCompare(point)))
  const badgeR = min * .026
  const badgeCol = badgeR * 2 + min * .032
  const title = fitTitle(s, contentW, { base: min * .05, maxLines: 3 })

  /* لا تكرار في اللوحة الواحدة: الشارة الافتتاحية تصنيفٌ (نوع المحتوى) لا جملة،
     والدعوة تُسقَط إن طابقت نقطة — فلا يتكرّر النصّ ثلاث مرات. */
  const kickerScene: Scene = { ...s, kicker: s.plan.content.kicker || s.plan.directionLabel || s.kicker }
  const ctaScene: Scene = { ...s, cta: s.cta && !pointKeys.has(normalizeForCompare(s.cta)) ? s.cta : '' }

  /* تسمية الإحصاءة: جملةُ الرقم منزوعةً منها الأرقام، ولا تكرّر نقطة. */
  const figSize = min * (s.isWide ? .085 : .105)
  let statLabel = ''
  if (figure) {
    const carrier = s.plan.content.original.split(/[\n.؟!،,]+/).find((sentence) => /[0-9٠-٩]/.test(sentence) && words(sentence).length >= 2) || ''
    const stripLead = (value: string) => value.replace(/^\s*(?:نحو|حوالي|قرابة|زهاء|أكثر من|اكثر من|أقل من|اقل من|من|في|إلى|الى|هي|هو|أي|اي)\s+/u, '')
    let derived = stripLead(stripLead(carrier
      .replace(/[0-9٠-٩]+(?:[.,،][0-9٠-٩]+)?\s*(?:٪|%|مليون|مليار|ألف|الف|ضعف|أضعاف)?/u, '')
      .replace(/\s+/g, ' ')
      .trim()))
      .replace(/\s+(?:في|من|على|إلى|الى|عن|مع|بـ)\s*$/u, '')
      .trim()
    if (words(derived).length < 2 || pointKeys0.has(normalizeForCompare(derived))) {
      const sub = s.plan.content.subtitle
      derived = sub && normalizeForCompare(sub) !== normalizeForCompare(s.titleText) && !pointKeys0.has(normalizeForCompare(sub)) ? sub : ''
    }
    statLabel = words(derived).slice(0, 5).join(' ')
  }
  const rowSize = Math.max(15, min * .026)

  /* ── التشطيب الراقي (مستوى Apple): تدرّجات ناعمة وعمقٌ محسوب بلا ضجيج ── */
  const uid = s.uid
  const accGrad = `${uid}-ig-acc`, badgeHi = `${uid}-ig-hi`, hairGrad = `${uid}-ig-hair`, arcGrad = `${uid}-ig-arc`, glowId = `${uid}-ig-glow`
  const infoDefs = `
    <linearGradient id="${accGrad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hexShade(p.accent, .18)}"/><stop offset="1" stop-color="${hexShade(p.accent, -.08)}"/></linearGradient>
    <linearGradient id="${arcGrad}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hexShade(p.accent, .3)}"/><stop offset="1" stop-color="${hexShade(p.accent, -.06)}"/></linearGradient>
    <radialGradient id="${badgeHi}" cx="0.5" cy="0.28" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.4"/><stop offset="0.72" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${hairGrad}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.rule}" stop-opacity="0"/><stop offset="0.5" stop-color="${p.rule}" stop-opacity="0.85"/><stop offset="1" stop-color="${p.rule}" stop-opacity="0"/></linearGradient>
    <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${round(min * .014)}"/></filter>`
  /** قرص فهرسيّ ثلاثيّ الأبعاد: تدرّجٌ لطيفٌ ولمعةٌ علويةٌ ناعمة — يعطي عمق أزرار Apple. */
  const premiumBadge = (cx: number, cy: number, r: number, num: string) => [
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="url(#${accGrad})"/>`,
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="url(#${badgeHi})"/>`,
    textBlock({ lines: [num], x: cx, y: round(cy + r * .37), size: r * 1.02, fill: '#FFFFFF', weight: 700, anchor: 'middle', family: 'Tajawal' }),
  ].join('')
  /** فاصلٌ شعريٌّ يتلاشى عند الطرفين — أرقّ من الخط الصلب. */
  const hairline = (xa: number, xb: number, y: number) => `<rect x="${round(Math.min(xa, xb))}" y="${round(y - .7)}" width="${round(Math.abs(xb - xa))}" height="1.4" fill="url(#${hairGrad})"/>`

  /* ── شارات الإحصاءة (تختلف بالاتجاه) ── */
  const horizontalStat = (): StackItem => figure ? {
    h: figSize * 1.16,
    gap: min * .04,
    draw: (top) => {
      const numW = lineWidthPx(`${figure.value}${figure.unit}`, figSize)
      const labelSize = Math.max(13, min * .024)
      const labelLines = statLabel ? wrap(statLabel, Math.max(8, (contentW - numW - min * .05) / (labelSize * .555)), 2) : []
      const labelH = blockHeight(labelLines, labelSize, 1.4)
      return [
        `<text x="${round(w - s.safeX)}" y="${round(top + figSize * .9)}" text-anchor="end" direction="ltr"><tspan fill="url(#${accGrad})" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="700" font-size="${round(figSize)}">${esc(figure.value)}</tspan>${figure.unit ? `<tspan fill="${p.muted}" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="500" font-size="${round(figSize * .48)}" dx="6">${esc(figure.unit)}</tspan>` : ''}</text>`,
        `<rect x="${round(w - s.safeX - numW)}" y="${round(top + figSize * 1.04)}" width="${round(numW)}" height="${round(min * .006)}" rx="${round(min * .003)}" fill="url(#${accGrad})" opacity=".9"/>`,
        labelLines.length ? textBlock({ lines: labelLines, x: w - s.safeX - numW - min * .05, y: top + (figSize * 1.16 - labelH) / 2 + labelSize * .82, size: labelSize, fill: p.muted, weight: 500, family: s.bodyFamily, lineHeight: 1.4 }) : '',
      ].join('')
    },
  } : { h: 0, draw: () => '' }

  const cardStat = (): StackItem => figure ? {
    h: figSize * 1.5,
    gap: min * .04,
    draw: (top) => {
      const cardH = figSize * 1.5
      const pad = min * .04
      const labelSize = Math.max(13, min * .024)
      const labelLines = statLabel ? wrap(statLabel, Math.max(6, (contentW - pad * 2 - lineWidthPx(`${figure.value}${figure.unit}`, figSize)) / (labelSize * .555)), 2) : []
      const labelH = blockHeight(labelLines, labelSize, 1.35)
      return [
        `<g filter="url(#${s.uid}-shadow)"><rect x="${round(s.safeX)}" y="${round(top)}" width="${round(contentW)}" height="${round(cardH)}" rx="${round(min * .028)}" fill="url(#${accGrad})"/></g>`,
        `<rect x="${round(s.safeX)}" y="${round(top)}" width="${round(contentW)}" height="${round(cardH * .5)}" rx="${round(min * .028)}" fill="#ffffff" opacity=".07"/>`,
        `<text x="${round(w - s.safeX - pad)}" y="${round(top + cardH / 2 + figSize * .34)}" text-anchor="end" direction="ltr"><tspan fill="#FFFFFF" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="700" font-size="${round(figSize)}">${esc(figure.value)}</tspan>${figure.unit ? `<tspan fill="rgba(255,255,255,.82)" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="500" font-size="${round(figSize * .48)}" dx="6">${esc(figure.unit)}</tspan>` : ''}</text>`,
        labelLines.length ? textBlock({ lines: labelLines, x: s.safeX + pad, y: top + cardH / 2 - labelH / 2 + labelSize * .82, size: labelSize, fill: 'rgba(255,255,255,.9)', weight: 500, anchor: 'start', family: s.bodyFamily, lineHeight: 1.35 }) : '',
      ].join('')
    },
  } : { h: 0, draw: () => '' }

  const ringStat = (): StackItem => {
    if (!figure) return { h: 0, draw: () => '' }
    const ringD = min * (s.isWide ? .24 : .3)
    return {
      h: ringD,
      gap: min * .04,
      draw: (top) => {
        const cx = w / 2
        const cy = top + ringD / 2
        const R = ringD / 2 - min * .012
        const num = parseFloat(toWesternDigits(figure.value))
        const pct = figure.unit === '٪' && isFinite(num) ? clamp(num / 100, 0.03, 1) : 0.66
        const a0 = -Math.PI / 2
        const a1 = a0 + pct * Math.PI * 2
        const large = pct > 0.5 ? 1 : 0
        const sx = cx + R * Math.cos(a0), sy = cy + R * Math.sin(a0)
        const ex = cx + R * Math.cos(a1), ey = cy + R * Math.sin(a1)
        const numSize = R * 0.82
        const sw = round(min * .024)
        const arc = `M ${round(sx)} ${round(sy)} A ${round(R)} ${round(R)} 0 ${large} 1 ${round(ex)} ${round(ey)}`
        return [
          `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(R)}" fill="none" stroke="${p.rule}" stroke-width="${sw}" opacity=".45"/>`,
          `<path d="${arc}" fill="none" stroke="url(#${arcGrad})" stroke-width="${sw}" stroke-linecap="round" filter="url(#${glowId})" opacity=".55"/>`,
          `<path d="${arc}" fill="none" stroke="url(#${arcGrad})" stroke-width="${sw}" stroke-linecap="round"/>`,
          `<circle cx="${round(sx)}" cy="${round(sy)}" r="${round(sw / 2)}" fill="${hexShade(p.accent, .3)}"/>`,
          `<text x="${round(cx)}" y="${round(cy + numSize * .34)}" text-anchor="middle" direction="ltr"><tspan fill="url(#${accGrad})" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="700" font-size="${round(numSize)}">${esc(figure.value)}</tspan>${figure.unit ? `<tspan fill="${p.muted}" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="500" font-size="${round(numSize * .4)}" dx="4">${esc(figure.unit)}</tspan>` : ''}</text>`,
          statLabel ? textBlock({ lines: [words(statLabel).slice(0, 4).join(' ')], x: cx, y: cy + R + min * .05, size: Math.max(12, min * .022), fill: p.muted, weight: 500, anchor: 'middle', family: s.bodyFamily }) : '',
        ].join('')
      },
    }
  }

  /* ── صفوف النقاط (تختلف بالاتجاه) ── */
  const railRows = (): StackItem[] => points.map((point, index) => {
    const lines = wrap(point, Math.max(8, (contentW - badgeCol) / (rowSize * .555)), 2)
    const textH = blockHeight(lines, rowSize, 1.42)
    const rowH = Math.max(badgeR * 2, textH)
    return {
      h: rowH,
      gap: index === 0 ? min * .045 : min * .038,
      draw: (top) => {
        const cy = top + rowH / 2
        const cx = w - s.safeX - badgeR
        return [
          index === 0 ? '' : hairline(s.safeX, w - s.safeX, top - min * .019),
          premiumBadge(cx, cy, badgeR, arabicNumber(index + 1)),
          textBlock({ lines, x: w - s.safeX - badgeCol, y: top + (rowH - textH) / 2 + rowSize * .82, size: rowSize, fill: p.ink, weight: 500, family: s.bodyFamily, lineHeight: 1.42 }),
        ].join('')
      },
    }
  })

  const ordinalRows = (): StackItem[] => {
    const ordSize = min * .07
    const ordCol = ordSize * 1.5 + min * .022
    return points.map((point, index) => {
      const lines = wrap(point, Math.max(8, (contentW - ordCol) / (rowSize * .555)), 2)
      const textH = blockHeight(lines, rowSize, 1.44)
      const rowH = Math.max(ordSize, textH)
      return {
        h: rowH,
        gap: index === 0 ? min * .05 : min * .045,
        draw: (top) => {
          const cy = top + rowH / 2
          return [
            `<text x="${round(w - s.safeX)}" y="${round(cy + ordSize * .35)}" fill="none" stroke="${p.accent}" stroke-width="1.4" font-family="${esc(fontStack(s.displayFamily))}" font-weight="700" font-size="${round(ordSize)}" text-anchor="end" direction="ltr" opacity=".92">${esc(arabicIndex(index + 1))}</text>`,
            textBlock({ lines, x: w - s.safeX - ordCol, y: top + (rowH - textH) / 2 + rowSize * .82, size: rowSize, fill: p.ink, weight: 500, family: s.bodyFamily, lineHeight: 1.44 }),
          ].join('')
        },
      }
    })
  }

  const cardRows = (): StackItem[] => {
    const pad = min * .032
    return points.map((point, index) => {
      const lines = wrap(point, Math.max(8, (contentW - badgeCol - pad * 2) / (rowSize * .555)), 2)
      const textH = blockHeight(lines, rowSize, 1.42)
      const cardH = Math.max(badgeR * 2, textH) + pad * 2
      return {
        h: cardH,
        gap: index === 0 ? min * .04 : min * .02,
        draw: (top) => {
          const cy = top + cardH / 2
          const cx = w - s.safeX - pad - badgeR
          return [
            `<g filter="url(#${s.uid}-shadow)"><rect x="${round(s.safeX)}" y="${round(top)}" width="${round(contentW)}" height="${round(cardH)}" rx="${round(min * .024)}" fill="${p.surface}" stroke="${p.rule}" stroke-width="1" opacity="${p.isDark ? 1 : .98}"/></g>`,
            `<rect x="${round(s.safeX)}" y="${round(top)}" width="${round(contentW)}" height="${round(cardH * .5)}" rx="${round(min * .024)}" fill="#ffffff" opacity="${p.isDark ? .03 : .05}"/>`,
            `<rect x="${round(w - s.safeX - min * .0055)}" y="${round(top + pad * .7)}" width="${round(min * .0055)}" height="${round(cardH - pad * 1.4)}" rx="3" fill="url(#${accGrad})"/>`,
            premiumBadge(cx, cy, badgeR, arabicNumber(index + 1)),
            textBlock({ lines, x: w - s.safeX - pad - badgeR * 2 - min * .018, y: top + (cardH - textH) / 2 + rowSize * .82, size: rowSize, fill: p.ink, weight: 500, family: s.bodyFamily, lineHeight: 1.42 }),
          ].join('')
        },
      }
    })
  }

  const timelineRows = (): StackItem[] => {
    const total = points.length
    const lineGap = min * .045
    return points.map((point, index) => {
      const lines = wrap(point, Math.max(8, (contentW - badgeCol) / (rowSize * .555)), 2)
      const textH = blockHeight(lines, rowSize, 1.42)
      const rowH = Math.max(badgeR * 2.1, textH)
      return {
        h: rowH,
        gap: index === 0 ? min * .04 : lineGap,
        draw: (top) => {
          const cy = top + rowH / 2
          const cx = w - s.safeX - badgeR
          const connector = index < total - 1
            ? `<rect x="${round(cx - min * .0018)}" y="${round(cy + badgeR)}" width="${round(min * .0036)}" height="${round(top + rowH + lineGap + badgeR - (cy + badgeR))}" rx="${round(min * .0018)}" fill="url(#${accGrad})" opacity=".55"/>`
            : ''
          return [
            connector,
            `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(badgeR * 1.2)}" fill="none" stroke="url(#${accGrad})" stroke-width="1" opacity=".28"/>`,
            `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(badgeR)}" fill="${p.surface}" stroke="url(#${accGrad})" stroke-width="2.6"/>`,
            textBlock({ lines: [arabicNumber(index + 1)], x: cx, y: round(cy + badgeR * .37), size: badgeR * 1.02, fill: p.accent, weight: 700, anchor: 'middle', family: 'Tajawal' }),
            textBlock({ lines, x: w - s.safeX - badgeCol, y: top + (rowH - textH) / 2 + rowSize * .82, size: rowSize, fill: p.ink, weight: 500, family: s.bodyFamily, lineHeight: 1.42 }),
          ].join('')
        },
      }
    })
  }

  /* الواجهة (spotlight): رقمٌ ضخمٌ بطلٌ كشرائح Apple، ونقاطٌ متمركزةٌ فاصلُها شعريٌّ يتلاشى. */
  const spotlightStat = (): StackItem => {
    if (!figure) return horizontalStat()
    const heroSize = min * (s.isWide ? .2 : .26)
    return {
      h: heroSize * .92 + (statLabel ? min * .05 : 0),
      gap: min * .05,
      draw: (top) => [
        `<text x="${round(w / 2)}" y="${round(top + heroSize * .8)}" text-anchor="middle" direction="ltr"><tspan fill="url(#${accGrad})" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="700" font-size="${round(heroSize)}">${esc(figure.value)}</tspan>${figure.unit ? `<tspan fill="${p.muted}" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="500" font-size="${round(heroSize * .34)}" dx="6">${esc(figure.unit)}</tspan>` : ''}</text>`,
        statLabel ? textBlock({ lines: [words(statLabel).slice(0, 5).join(' ')], x: w / 2, y: top + heroSize * .8 + min * .05, size: Math.max(13, min * .024), fill: p.muted, weight: 500, anchor: 'middle', family: s.bodyFamily }) : '',
      ].join(''),
    }
  }
  const spotlightRows = (): StackItem[] => points.slice(0, s.isTall ? 4 : 3).map((point, index) => {
    const size = Math.max(14, min * .026)
    const lines = wrap(point, Math.max(8, (contentW - min * .1) / (size * .555)), 2)
    const textH = blockHeight(lines, size, 1.4)
    return {
      h: textH,
      gap: index === 0 ? min * .06 : min * .042,
      draw: (top) => [
        index > 0 ? hairline(w / 2 - min * .075, w / 2 + min * .075, top - min * .021) : '',
        textBlock({ lines, x: w / 2, y: top + size * .82, size, fill: p.ink, weight: 500, anchor: 'middle', family: s.bodyFamily, lineHeight: 1.4 }),
      ].join(''),
    }
  })

  const statItem = variant === 'ring' ? ringStat() : variant === 'cards' ? cardStat() : variant === 'spotlight' ? spotlightStat() : horizontalStat()
  const rowItems = variant === 'ordinal' ? ordinalRows()
    : variant === 'cards' ? cardRows()
    : variant === 'timeline' ? timelineRows()
    : variant === 'spotlight' ? spotlightRows()
    : railRows()

  const titleAnchor = variant === 'spotlight' ? 'middle' : 'end'
  const stack = drawStack([
    variant === 'spotlight' ? kickerItem({ ...kickerScene, kicker: kickerScene.kicker } as Scene, { x: w / 2, anchor: 'middle' }) : kickerItem(kickerScene),
    textItem({ lines: title.lines, x: variant === 'spotlight' ? w / 2 : w - s.safeX, size: title.size, fill: titleInk(s), weight: s.titleWeight, anchor: titleAnchor, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: figure ? '' : s.hero, emphasisFill: accentInk(s), gap: min * .03 }),
    statItem,
    ...rowItems,
    ctaItem(ctaScene, { align: variant === 'spotlight' ? 'center' : 'right', gap: min * .05 }),
    carouselItem(s),
  ], contentBand(s), variant === 'spotlight' ? .46 : .4)
  return { defs: infoDefs, markup: [stack, identityFooter(s, variant === 'spotlight' ? { mode: 'center' } : {})].join('') }
}

/** 14 — نول السدو: حزامان منسوجان من مثلثات السدو الكويتي يحرسان الفكرة —
    هوية خليجية معاصرة إجرائية بالكامل (لا صور، لا خطوط زخرفية جاهزة)، فلا
    تتكرر نسجةٌ بين تصميمين لاختلاف المقاس واللوحة والإيقاع. */
const paintSaduWeave: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const rowH = Math.max(9, min * .021)
  const unit = rowH * 2
  const cols = Math.ceil(w / unit) + 1
  const tris = (y: number, flip: boolean) => {
    let d = ''
    for (let i = 0; i < cols; i += 1) {
      const x0 = i * unit
      d += flip
        ? `M ${round(x0)} ${round(y)} L ${round(x0 + unit / 2)} ${round(y + rowH)} L ${round(x0 + unit)} ${round(y)} Z `
        : `M ${round(x0)} ${round(y + rowH)} L ${round(x0 + unit / 2)} ${round(y)} L ${round(x0 + unit)} ${round(y + rowH)} Z `
    }
    return d
  }
  const weaveH = rowH * 3.95
  const band = (top: number) => [
    `<line x1="0" y1="${round(top - rowH * .7)}" x2="${w}" y2="${round(top - rowH * .7)}" stroke="${p.rule}" stroke-width="1.2" opacity=".9"/>`,
    `<path d="${tris(top, false)}" fill="${p.accent}"/>`,
    `<path d="${tris(top + rowH * 1.3, true)}" fill="${p.ink}" opacity="${p.isDark ? .5 : .82}"/>`,
    `<path d="${tris(top + rowH * 2.6, false)}" fill="${p.accentSoft}"/>`,
    `<line x1="0" y1="${round(top + weaveH + rowH * .35)}" x2="${w}" y2="${round(top + weaveH + rowH * .35)}" stroke="${p.rule}" stroke-width="1.2" opacity=".9"/>`,
  ].join('')
  const topBandY = s.safeY * .85
  const bottomBandY = h - s.safeY - weaveH - min * .052
  const title = fitTitle(s, w * .74, { base: min * .069 })
  const body = fitBody(s, w * .58, { maxLines: 3 })
  const stack = drawStack([
    kickerItem(s, { x: w / 2, anchor: 'middle' }),
    textItem({ lines: title.lines, x: w / 2, size: title.size, fill: titleInk(s), weight: 700, anchor: 'middle', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .045 }),
    ruleItem(s, { x: w / 2, anchor: 'middle', width: min * .09, gap: min * .04 }),
    textItem({ lines: body.lines, x: w / 2, size: body.size, fill: p.muted, weight: 400, anchor: 'middle', family: s.bodyFamily, lineHeight: 1.6, gap: min * .05 }),
    ctaItem(s, { align: 'center', gap: min * .055 }),
    carouselItem(s),
  ], contentBand(s), .46)
  return { markup: [band(topBandY), band(bottomBandY), stack, identityFooter(s, { mode: 'center' })].join('') }
}

/** 15 — نَفَس الحبر: الكلمة الأقوى بحبرٍ ممتلئ يتنفس خلف العنوان عبر إزاحة
    اضطرابية حتمية (بذرتها من بصمة الخطة نفسها)، فلكل تصميم نزفُ حبرٍ يخصّه. */
const paintInkVeil: Painter = (s) => {
  const { palette: p, w, h, min, uid } = s
  const hero = s.hero || [...words(s.titleText)].sort((a, b) => b.length - a.length)[0] || ''
  const seed = uid.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const filterId = `${uid}-inkbleed`
  const defs = `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${round(.008 + (seed % 5) * .002)}" numOctaves="2" seed="${seed % 97}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${round(min * .015)}"/></filter>`
  const heroSize = Math.min(min * .5, (w * 1.02) / Math.max(1, textUnits(hero) * .555))
  const inkWord = `<g filter="url(#${filterId})" opacity="${p.isDark ? .22 : .12}">${textBlock({ lines: [hero], x: w / 2, y: h * (s.isTall ? .33 : .39), size: heroSize, fill: p.ink, anchor: 'middle', family: s.displayFamily, weight: 800 })}</g>`
  const drops = [
    `<circle cx="${round(w * (.14 + (seed % 7) * .09))}" cy="${round(h * .14)}" r="${round(min * .011)}" fill="${p.accent}" filter="url(#${filterId})" opacity=".5"/>`,
    `<circle cx="${round(w * .84)}" cy="${round(h * .82)}" r="${round(min * .007)}" fill="${p.ink}" filter="url(#${filterId})" opacity=".4"/>`,
  ].join('')
  const title = fitTitle(s, w * .76, { base: min * .067 })
  const body = fitBody(s, w * .58, { maxLines: 2 })
  const stack = drawStack([
    kickerItem(s, { x: w / 2, anchor: 'middle' }),
    textItem({ lines: title.lines, x: w / 2, size: title.size, fill: titleInk(s), weight: 800, anchor: 'middle', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: hero, emphasisFill: accentInk(s), gap: min * .05 }),
    ruleItem(s, { x: w / 2, anchor: 'middle', width: min * .06, gap: min * .034 }),
    textItem({ lines: body.lines, x: w / 2, size: body.size, fill: p.muted, weight: 400, anchor: 'middle', family: s.bodyFamily, lineHeight: 1.6, gap: min * .05 }),
    ctaItem(s, { align: 'center', gap: min * .06 }),
    carouselItem(s),
  ], contentBand(s), .5)
  return { defs, markup: [inkWord, drops, stack, identityFooter(s, { mode: 'center' })].join('') }
}

/** 16 — كوكبة عصبية: عقدٌ ووصلاتٌ تُحسب حتمياً من بذرة التصميم، ومسارٌ واحد
    مضيء يحمل الفكرة عبر الشبكة — لغة أستاذ الذكاء الاصطناعي بلا أيقونات مبتذلة. */
const paintNeuralConstellation: Painter = (s) => {
  const { palette: p, w, h, min, uid } = s
  const seed = uid.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const pseudo = (index: number) => {
    const value = Math.sin(seed * 7919 + index * 104729) * 43758.5453
    return value - Math.floor(value)
  }
  const nodes = Array.from({ length: 14 }, (_, index) => ({
    x: w * (.06 + pseudo(index) * .42),
    y: h * (.14 + pseudo(index + 40) * .7),
    r: min * (.0045 + pseudo(index + 80) * .006),
  }))
  const edges: string[] = []
  for (let index = 0; index < nodes.length; index += 1) {
    const from = nodes[index]
    const neighbors = nodes
      .map((candidate, candidateIndex) => ({ candidateIndex, distance: Math.hypot(candidate.x - from.x, candidate.y - from.y) }))
      .filter((row) => row.candidateIndex !== index)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 2)
    for (const neighbor of neighbors) {
      if (neighbor.candidateIndex > index) {
        const to = nodes[neighbor.candidateIndex]
        edges.push(`<line x1="${round(from.x)}" y1="${round(from.y)}" x2="${round(to.x)}" y2="${round(to.y)}" stroke="${p.rule}" stroke-width="1" opacity=".55"/>`)
      }
    }
  }
  const pathNodes = [...nodes].sort((left, right) => left.y - right.y).filter((_, index) => index % 3 === 0).slice(0, 4)
  const glowPath = pathNodes.map((node, index) => `${index === 0 ? 'M' : 'L'} ${round(node.x)} ${round(node.y)}`).join(' ')
  const constellation = [
    ...edges,
    `<path d="${glowPath}" fill="none" stroke="${p.accent}" stroke-width="${round(min * .006)}" opacity=".2" stroke-linecap="round"/>`,
    `<path d="${glowPath}" fill="none" stroke="${p.accent}" stroke-width="2" opacity=".9" stroke-linecap="round"/>`,
    ...nodes.map((node) => `<circle cx="${round(node.x)}" cy="${round(node.y)}" r="${round(node.r)}" fill="${p.accentSoft}" stroke="${p.rule}" stroke-width="1"/>`),
    ...pathNodes.map((node) => `<circle cx="${round(node.x)}" cy="${round(node.y)}" r="${round(node.r * 1.7)}" fill="${p.accent}"/>`),
  ].join('')
  const zoneW = w * .46
  const title = fitTitle(s, zoneW, { base: min * .062 })
  const body = fitBody(s, zoneW * .92, { maxLines: 3 })
  const stack = drawStack([
    kickerItem(s),
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: p.ink, weight: 700, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .04 }),
    ruleItem(s, { gap: min * .045 }),
    textItem({ lines: body.lines, x: w - s.safeX, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.6, gap: min * .05 }),
    ctaItem(s, { gap: min * .055 }),
    carouselItem(s),
  ], contentBand(s), .34)
  return { markup: [constellation, stack, identityFooter(s)].join('') }
}

/** 17 — زخرفة السيليكون: النجمة الثمانية تُرسم مساراتِ دوائرَ إلكترونية
    بلحاماتها وانعطافاتها المتعامدة — التراث الهندسي بلغة الرقاقة. */
const paintSiliconArabesque: Painter = (s) => {
  const { palette: p, w, h, min, uid } = s
  const seed = uid.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const cx = w * .25
  const cy = h * (s.isTall ? .3 : .36)
  const R = min * .17
  const rings = [
    `<path d="${octagramPath(cx, cy, R, R * .42)}" fill="none" stroke="${p.accent}" stroke-width="1.8" opacity=".9"/>`,
    `<path d="${octagramPath(cx, cy, R * .72, R * .3)}" fill="none" stroke="${p.rule}" stroke-width="1.2" opacity=".85"/>`,
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(R * .16)}" fill="none" stroke="${p.accent}" stroke-width="1.6"/>`,
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(min * .006)}" fill="${p.accent}"/>`,
  ].join('')
  const traces: string[] = []
  for (let index = 0; index < 6; index += 1) {
    const angle = (index * Math.PI) / 3 - Math.PI / 2 + ((seed % 8) * Math.PI) / 64
    const startX = cx + Math.cos(angle) * R
    const startY = cy + Math.sin(angle) * R
    const bendX = startX + Math.cos(angle) * min * (.06 + (index % 3) * .03)
    const bendY = startY + Math.sin(angle) * min * (.06 + (index % 3) * .03)
    const endY = bendY + (bendY > cy ? 1 : -1) * min * (.05 + ((seed >>> index) % 4) * .02)
    traces.push(
      `<path d="M ${round(startX)} ${round(startY)} L ${round(bendX)} ${round(bendY)} L ${round(bendX)} ${round(endY)}" fill="none" stroke="${p.accent}" stroke-width="1.3" opacity=".8"/>`,
      `<rect x="${round(bendX - min * .004)}" y="${round(bendY - min * .004)}" width="${round(min * .008)}" height="${round(min * .008)}" fill="${p.accentSoft}" stroke="${p.accent}" stroke-width="1"/>`,
      `<circle cx="${round(bendX)}" cy="${round(endY)}" r="${round(min * .006)}" fill="${p.accentSoft}" stroke="${p.accent}" stroke-width="1.2"/>`,
    )
  }
  const zoneW = w * .48
  const title = fitTitle(s, zoneW, { base: min * .063 })
  const body = fitBody(s, zoneW * .9, { maxLines: 3 })
  const stack = drawStack([
    kickerItem(s),
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: p.ink, weight: 700, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .04 }),
    ruleItem(s, { gap: min * .045 }),
    textItem({ lines: body.lines, x: w - s.safeX, size: body.size, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.6, gap: min * .05 }),
    ctaItem(s, { gap: min * .055 }),
    carouselItem(s),
  ], contentBand(s), .36)
  return { markup: [rings, traces.join(''), stack, identityFooter(s)].join('') }
}


/* ------------------------------------------------------------------ */
/*      خمس عائلات تكوين جديدة — لكلٍّ لغةٌ بصرية مستقلة لا شكلٌ مختلف   */
/* ------------------------------------------------------------------ */

/** 18 — الشبكة السويسرية: اثنا عشر عموداً حقيقية، والعنوان يجلس على خط الشبكة
    لا في وسطٍ تقريبي. الشبكة تُرى خافتةً فتُعلن قانونها، وكل كتلةٍ تبدأ من
    عمودٍ معلوم — انضباط بازل بحرفٍ عربي. */
const paintSwissGrid: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const gutter = min * .022
  const left = s.safeX
  const right = w - s.safeX
  const span = right - left
  const colW = (span - gutter * 11) / 12
  /* الأعمدة تُعدّ من اليمين لأن القراءة عربية: العمود 1 أقصى اليمين. */
  const colRight = (index: number) => right - index * (colW + gutter)
  const colLeft = (index: number, spanCols: number) => colRight(index) - spanCols * colW - (spanCols - 1) * gutter
  const guides = Array.from({ length: 12 }, (_, index) => {
    const x = colLeft(index, 1)
    return `<rect x="${round(x)}" y="${round(s.safeY)}" width="${round(colW)}" height="${round(h - s.safeY * 2)}" fill="${p.accent}" opacity=".035"/>`
  }).join('')
  /* العنوان يشغل ثمانية أعمدة من اليمين؛ المتن خمسة — نسبةٌ سويسرية كلاسيكية. */
  const titleZone = colW * 8 + gutter * 7
  const bodyZone = colW * 5 + gutter * 4
  const title = fitTitle(s, titleZone, { base: min * .062, maxLines: 4 })
  const body = fitBody(s, bodyZone, { maxLines: 5 })
  const points = extractPoints(s.plan, 3)
  const baselineY = s.safeY + h * .1
  const rows: string[] = [
    `<line x1="${round(left)}" y1="${round(baselineY)}" x2="${round(right)}" y2="${round(baselineY)}" stroke="${p.ink}" stroke-width="2" opacity=".85"/>`,
    s.kicker ? textBlock({ lines: [toArabicIndic(s.kicker)], x: colRight(0), y: baselineY - min * .018, size: Math.max(13, min * .019), fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal' }) : '',
    /* «العنوان على خط الشبكة»: أعلى كتلة العنوان ملتصقٌ بالخط الأفقي تماماً. */
    textBlock({ lines: title.lines, x: colRight(0), y: baselineY + title.size * .92, size: title.size, fill: p.ink, weight: 700, anchor: 'end', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s) }),
  ]
  const afterTitle = baselineY + title.size * .92 + blockHeight(title.lines, title.size, s.titleLineHeight)
  let cursor = afterTitle + min * .06
  if (body.lines.length) {
    rows.push(textBlock({ lines: body.lines, x: colRight(0), y: cursor, size: body.size, fill: p.muted, weight: 400, anchor: 'end', family: s.bodyFamily, lineHeight: 1.66 }))
    cursor += blockHeight(body.lines, body.size, 1.66) + min * .05
  }
  /* النقاط تنزل في عمودٍ ثانٍ (يسار الشبكة) فيظهر قانون الأعمدة عملياً. */
  if (points.length) {
    const noteSize = Math.max(12, min * .0195)
    const noteZone = colW * 4 + gutter * 3
    points.slice(0, 3).forEach((point, index) => {
      const wrapped = wrap(point, Math.max(10, noteZone / (noteSize * .555)), 3)
      /* التقدير وحده كان يسرّب سطراً خارج الحافة اليسرى (لقطة المعاينة): نُعيد
         القياس الحقيقي ونصغّر عند الحاجة كما تفعل بقية العائلات. */
      const noteFit = fitted(wrapped, noteSize, noteZone, noteSize * 6, 1.55, .7)
      const lines = wrapped
      const y = afterTitle + min * .06 + index * (noteSize * 3.9)
      rows.push(`<line x1="${round(colLeft(8, 4))}" y1="${round(y - noteSize * .9)}" x2="${round(colRight(8))}" y2="${round(y - noteSize * .9)}" stroke="${p.rule}" stroke-width="1"/>`)
      rows.push(textBlock({ lines: [arabicIndex(index + 1)], x: colRight(8), y, size: noteSize * .86, fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal' }))
      rows.push(textBlock({ lines, x: colRight(8), y: y + noteSize * 1.5, size: noteFit, fill: p.muted, weight: 400, anchor: 'end', family: s.bodyFamily, lineHeight: 1.55 }))
    })
  }
  const cta = ctaItem(s, { x: colLeft(0, 12) })
  if (cta.h) rows.push(cta.draw(Math.min(cursor, h - s.safeY - min * .16)))
  return { markup: [guides, rows.join(''), identityFooter(s)].join('') }
}

/** 19 — المجلة بعمودين: نصٌّ عربي في عمودين يفصلهما خطٌّ شعري، وحرفٌ استهلالي
    يفتح العمود الأول. المتن يُقسَم قسمةً حقيقية بين العمودين (لا نسخاً)، فتقرأ
    من اليمين إلى اليسار كصفحة مجلةٍ لا كبطاقة. */
const paintMagazineColumns: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const gutter = min * .055
  const colW = (w - s.safeX * 2 - gutter) / 2
  const title = fitTitle(s, w - s.safeX * 2, { base: min * .058, maxLines: 3 })
  const headTop = s.safeY + h * .035
  const titleBase = headTop + title.size * .9
  const ruleY = titleBase + blockHeight(title.lines, title.size, s.titleLineHeight) + min * .028
  const bodySize = Math.max(13, min * .0235)
  const perCol = Math.max(3, Math.floor((h - ruleY - s.safeY - min * .13) / (bodySize * 1.78)))
  /* العمودان يحتاجان نصاً يملؤهما: المتن المقتطع وحده كان يترك الصفحة خاوية،
     فنُكمل من نصّ الدكتور الأصلي (لا اختلاق) حتى يمتلئ العمودان. */
  const trimmedTitle = normalizeForCompare(s.titleText)
  /* لا يُعاد العنوان في أول العمود: نُسقط الجملة الافتتاحية إن كانت هي العنوان
     نفسه (كانت تُقرأ مرتين في المعاينة الأولى). */
  const stripTitle = (value: string) => String(value || '')
    .split(/(?<=[.؟!])\s+/)
    .filter((sentence) => normalizeForCompare(sentence) !== trimmedTitle)
    .join(' ')
    .trim()
  const overflow = stripTitle(s.plan.content.original || '')
  const source = [stripTitle(s.bodyText), stripTitle(s.plan.content.quote), overflow]
    .filter(Boolean)
    .reduce((best, item) => item.length > best.length ? item : best, '')
  const all = wrap(source, Math.max(12, colW / (bodySize * .555)), perCol * 2)
  const dropChar = (all[0] || source).trim().charAt(0) || ''
  const dropSize = bodySize * 2.9
  /* الحرف الاستهلالي يقتطع سطرين من العمود الأول فقط — لا يزاحم العمود الثاني. */
  /* القسمة نصفان لا «امتلاء الأول ثم الفائض»: العمود الثاني كان يبقى خاوياً
     كلما استوعب الأولُ النصَّ كلَّه، فتفقد الصفحة معنى العمودين. */
  const half = Math.ceil(all.length / 2)
  const rightLines = all.slice(0, half)
  const leftLines = all.slice(half)
  const colTop = ruleY + min * .05
  const indentUnits = lineWidthPx(dropChar || 'ا', dropSize) + min * .014
  const rightBlocks = rightLines.map((line, index) => {
    /* سطران فقط بجانب الحرف الاستهلالي — بارتفاعه تماماً فلا يطفو وحيداً. */
    const narrowed = index < 2
    return textBlock({ lines: [line], x: w - s.safeX - (narrowed ? indentUnits : 0), y: colTop + bodySize + index * bodySize * 1.78, size: bodySize, fill: p.muted, weight: 400, anchor: 'end', family: s.bodyFamily })
  }).join('')
  const leftBlocks = leftLines.map((line, index) => textBlock({
    lines: [line], x: s.safeX + colW, y: colTop + bodySize + index * bodySize * 1.78, size: bodySize, fill: p.muted, weight: 400, anchor: 'end', family: s.bodyFamily,
  })).join('')
  const divider = `<line x1="${round(s.safeX + colW + gutter / 2)}" y1="${round(colTop - min * .01)}" x2="${round(s.safeX + colW + gutter / 2)}" y2="${round(colTop + Math.max(rightLines.length, leftLines.length) * bodySize * 1.78)}" stroke="${p.rule}" stroke-width="1.1" opacity=".95"/>`
  const drop = dropChar
    ? textBlock({ lines: [dropChar], x: w - s.safeX, y: colTop + bodySize + bodySize * 1.5, size: dropSize, fill: p.accent, weight: 700, anchor: 'end', family: s.displayFamily })
    : ''
  return {
    markup: [
      s.kicker ? textBlock({ lines: [toArabicIndic(s.kicker)], x: w - s.safeX, y: headTop - min * .012, size: Math.max(12, min * .018), fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal' }) : '',
      textBlock({ lines: title.lines, x: w - s.safeX, y: titleBase, size: title.size, fill: p.ink, weight: 700, anchor: 'end', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s) }),
      `<line x1="${round(s.safeX)}" y1="${round(ruleY)}" x2="${round(w - s.safeX)}" y2="${round(ruleY)}" stroke="${p.rule}" stroke-width="1.4"/>`,
      divider, drop, rightBlocks, leftBlocks,
      identityFooter(s),
    ].join(''),
  }
}

/** 20 — الملصق التايبوغرافي: بلا صورةٍ ولا زخرفةٍ إطلاقاً. الكلمة نفسها هي
    التصميم: كلماتُ العنوان تنزل سطراً سطراً بأحجامٍ متدرّجة تملأ العرض، وكلمةٌ
    واحدة تحمل اللون. لا إطار ولا مدار ولا نمط — الحرف وحده. */
const paintTypePoster: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const zone = w - s.safeX * 2
  const source = words(s.titleText).slice(0, 7)
  const heroKey = normalizeForCompare(s.hero)
  /* كل سطرٍ يُقاس ليملأ العرض: هذا ما يجعل الكتلة تبدو منحوتةً لا مركّبة. */
  const lines = source.length ? source : words(s.bodyText).slice(0, 5)
  const raw = lines.map((word) => clamp(zone / Math.max(1, textUnits(word) * .555), min * .045, min * .19))
  const ctaBlock = ctaItem(s, { align: 'center' })
  /* الكتلة كلها تُقاس قبل الرسم وتُصغَّر بنسبةٍ واحدة إن تجاوزت الحيّز — بلا
     ذلك كان آخر سطرٍ يخرج من أسفل اللوحة (لقطة المعاينة الأولى). */
  const headroom = s.safeY + min * .075
  const available = h - headroom - s.safeY - min * .09 - (ctaBlock.h ? ctaBlock.h + min * .06 : 0)
  const rawH = raw.reduce((sum, size) => sum + size * 1.06, 0)
  const shrink = rawH > available ? available / rawH : 1
  const sizes = raw.map((size) => size * shrink)
  const totalH = rawH * shrink
  const footprint = totalH + (ctaBlock.h ? ctaBlock.h + min * .06 : 0)
  let y = Math.max(headroom, headroom + (h - headroom - s.safeY - min * .09 - footprint) * .42)
  const stack = lines.map((word, index) => {
    const size = sizes[index]
    const isHero = heroKey && normalizeForCompare(word) === heroKey
    const markup = textBlock({ lines: [word], x: w / 2, y: y + size * .84, size, fill: isHero ? accentInk(s) : titleInk(s), weight: 800, anchor: 'middle', family: s.displayFamily })
    y += size * 1.06
    return markup
  }).join('')
  const kicker = s.kicker
    ? textBlock({ lines: [toArabicIndic(s.kicker)], x: w / 2, y: s.safeY + min * .035, size: Math.max(12, min * .019), fill: p.muted, weight: 700, anchor: 'middle', family: 'Tajawal' })
    : ''
  const cta = ctaBlock.h ? ctaBlock.draw(y + min * .06) : ''
  return { markup: [kicker, stack, cta, identityFooter(s, { mode: 'center' })].join('') }
}

/** 21 — الحاشية: متنٌ مركزيٌّ صغير محكوم العرض، وهامشٌ واسع على اليسار تسكنه
    تعليقاتٌ مرقّمة بخطٍّ رفيع — كمخطوطة عالِمٍ يحاور متنه على الطُرّة. */
const paintMarginalia: Painter = (s) => {
  const { palette: p, w, h, min } = s
  /* المتن ثلثا اللوحة من اليمين، والهامش ثلثها — نسبة المخطوطات. */
  const marginW = (w - s.safeX * 2) * .3
  const gutter = min * .045
  const textW = (w - s.safeX * 2) - marginW - gutter
  const textRight = w - s.safeX
  const marginRight = textRight - textW - gutter
  const title = fitTitle(s, textW, { base: min * .05, maxLines: 4 })
  const body = fitBody(s, textW, { base: min * .026, maxLines: 8 })
  const top = s.safeY + h * .07
  const titleBase = top + title.size * .9
  const bodyTop = titleBase + blockHeight(title.lines, title.size, s.titleLineHeight) + min * .038
  const notes = extractPoints(s.plan, 4)
  const noteSize = Math.max(11, min * .0165)
  const marginParts: string[] = []
  let noteY = top + noteSize * 1.2
  notes.slice(0, 4).forEach((note, index) => {
    const lines = wrap(note, Math.max(8, marginW / (noteSize * .555)), 4)
    const noteFit = fitted(lines, noteSize, marginW, noteSize * 8, 1.6, .7)
    marginParts.push(textBlock({ lines: [arabicIndex(index + 1)], x: marginRight, y: noteY, size: noteSize * .92, fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal' }))
    marginParts.push(textBlock({ lines, x: marginRight, y: noteY + noteSize * 1.62, size: noteFit, fill: p.muted, weight: 400, anchor: 'end', family: s.bodyFamily, lineHeight: 1.6, opacity: .92 }))
    noteY += noteSize * 1.62 + blockHeight(lines, noteFit, 1.6) + noteSize * 1.5
  })
  /* خطّ الطُرّة يفصل المتن عن الحاشية — علامة المخطوطة الأولى. */
  const rail = `<line x1="${round(textRight - textW - gutter / 2)}" y1="${round(top - min * .02)}" x2="${round(textRight - textW - gutter / 2)}" y2="${round(Math.max(noteY, bodyTop + blockHeight(body.lines, body.size, 1.72)))}" stroke="${p.rule}" stroke-width="1"/>`
  const cta = ctaItem(s, { x: textRight - textW })
  return {
    markup: [
      rail,
      s.kicker ? textBlock({ lines: [toArabicIndic(s.kicker)], x: textRight, y: top - min * .022, size: Math.max(12, min * .018), fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal' }) : '',
      textBlock({ lines: title.lines, x: textRight, y: titleBase, size: title.size, fill: p.ink, weight: 700, anchor: 'end', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s) }),
      body.lines.length ? textBlock({ lines: body.lines, x: textRight, y: bodyTop + body.size, size: body.size, fill: p.muted, weight: 400, anchor: 'end', family: s.bodyFamily, lineHeight: 1.72 }) : '',
      marginParts.join(''),
      cta.h ? cta.draw(h - s.safeY - min * .17) : '',
      identityFooter(s),
    ].join(''),
  }
}

/** 22 — الجدول الزمني الرأسي: خطٌّ ينزل من أعلى اللوحة إلى أسفلها، وعليه
    محطاتٌ مؤرّخة بنقاطٍ ونصٍّ قصير. التواريخ تُلتقط من النص نفسه؛ وحين لا
    تاريخ، تُرقَّم المحطات ترقيماً عربياً بلا اختلاق زمنٍ لم يُكتب. */
const paintVerticalTimeline: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const title = fitTitle(s, w - s.safeX * 2 - min * .1, { base: min * .05, maxLines: 3 })
  const top = s.safeY + h * .045
  const titleBase = top + title.size * .9
  const railX = w - s.safeX - min * .045
  const railTop = titleBase + blockHeight(title.lines, title.size, s.titleLineHeight) + min * .055
  const railBottom = h - s.safeY - min * .11
  const stations = (() => {
    const points = extractPoints(s.plan, 5)
    const slides = s.plan.content.slides.map((slide) => slide.title || slide.body).filter(Boolean)
    const source = points.length >= 2 ? points : slides.length >= 2 ? slides : points
    return source.slice(0, 5)
  })()
  if (stations.length < 2) {
    /* بلا محطتين لا جدول زمني: نسقط إلى تكوينٍ رأسيٍّ نظيف بدل خطٍّ فارغ. */
    const body = fitBody(s, w - s.safeX * 2, { maxLines: 5 })
    const stack = drawStack([
      kickerItem(s),
      textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: p.ink, weight: 700, anchor: 'end', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s), gap: min * .04 }),
      ruleItem(s, { gap: min * .035 }),
      textItem({ lines: body.lines, x: w - s.safeX, size: body.size, fill: p.muted, weight: 400, anchor: 'end', family: s.bodyFamily, lineHeight: 1.68, gap: min * .04 }),
      ctaItem(s, { gap: min * .05 }),
    ], contentBand(s), .44)
    return { markup: [stack, identityFooter(s)].join('') }
  }
  const timings = extractTiming(s.plan.content.original || s.bodyText)
  const gap = (railBottom - railTop) / Math.max(1, stations.length - 1)
  const labelSize = Math.max(12, min * .0205)
  const stops = stations.map((station, index) => {
    const y = railTop + index * gap
    const stamp = timings[index] ? toArabicIndic(timings[index]) : `المحطة ${toArabicIndic(String(index + 1))}`
    const labelZone = w - s.safeX * 2 - min * .12
    const lines = wrap(station, Math.max(10, labelZone / (labelSize * .555)), 2)
    const labelFit = fitted(lines, labelSize, labelZone, labelSize * 4, 1.5, .72)
    return [
      `<circle cx="${round(railX)}" cy="${round(y)}" r="${round(min * (index === 0 ? .011 : .0085))}" fill="${index === 0 ? p.accent : p.surface}" stroke="${p.accent}" stroke-width="2"/>`,
      textBlock({ lines: [stamp], x: railX - min * .032, y: y + labelSize * .22, size: labelSize * .82, fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal' }),
      textBlock({ lines, x: railX - min * .032, y: y + labelSize * 1.75, size: labelFit, fill: p.ink, weight: 500, anchor: 'end', family: s.bodyFamily, lineHeight: 1.5 }),
    ].join('')
  }).join('')
  return {
    markup: [
      `<line x1="${round(railX)}" y1="${round(railTop)}" x2="${round(railX)}" y2="${round(railBottom)}" stroke="${p.rule}" stroke-width="1.6"/>`,
      s.kicker ? textBlock({ lines: [toArabicIndic(s.kicker)], x: w - s.safeX, y: top - min * .018, size: Math.max(12, min * .018), fill: p.accent, weight: 700, anchor: 'end', family: 'Tajawal' }) : '',
      textBlock({ lines: title.lines, x: w - s.safeX, y: titleBase, size: title.size, fill: p.ink, weight: 700, anchor: 'end', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: accentInk(s) }),
      stops,
      identityFooter(s),
    ].join(''),
  }
}

const PAINTERS: Record<CompositionPlan['layout'], Painter> = {
  'editorial-axis': paintEditorialAxis,
  'hero-word': paintHeroWord,
  'quote-stage': paintQuoteStage,
  'dual-thesis': paintDualThesis,
  'evidence-ledger': paintEvidenceLedger,
  'event-marquee': paintEventMarquee,
  'knowledge-map': paintKnowledgeMap,
  'quiet-orbit': paintQuietOrbit,
  'chapter-stack': paintChapterStack,
  'cinematic-window': paintCinematicWindow,
  'human-note': paintHumanNote,
  'modular-brief': paintModularBrief,
  infographic: paintInfographic,
  'sadu-weave': paintSaduWeave,
  'ink-veil': paintInkVeil,
  'neural-constellation': paintNeuralConstellation,
  'silicon-arabesque': paintSiliconArabesque,
  'swiss-grid': paintSwissGrid,
  'magazine-columns': paintMagazineColumns,
  'type-poster': paintTypePoster,
  marginalia: paintMarginalia,
  'vertical-timeline': paintVerticalTimeline,
}

/* ------------------------------------------------------------------ */
/*                         نقطة الرسم الرئيسية                          */
/* ------------------------------------------------------------------ */

export interface RenderSvgOptions {
  title?: string
  ariaLabel?: string
  fontCss?: string
  /** مصدر صورة الختم — المعاينة تقرأ /logo.png والتصدير يمرر Data URI مضمّناً */
  sealHref?: string
}

function identityLayer(s: Scene, options: RenderSvgOptions) {
  const sealVisible = renderPreferences.seal
  return [
    sealVisible ? identitySeal(s, options.sealHref || '/logo.png') : '',
    renderPreferences.seasonal ? seasonalDecor(s, sealVisible) : '',
    familySignatureMark(s),
  ].join('')
}

/** الصور البطولية تُرسم تحت التكوين لا فوقه، كي تصبح الصورة هي المسرح ويظل النص
    جزءاً من الإخراج لا ملصقاً موضوعاً فوق صورة. كل معالجة هنا حتمية وتظهر في
    المعاينة والتصدير بالطريقة نفسها. */
function imageUnderlayLayer(s: Scene) {
  const images = [...(s.plan.overlays || [])]
    .filter((item) => item.kind === 'image' && item.src && item.imageRole === 'background')
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  if (!images.length) return { defs: '', markup: '' }
  const { w, h, palette: p } = s
  const definitions: string[] = []
  const markup = images.map((overlay, index) => {
    const id = `hero-${esc(overlay.id).replace(/[^a-zA-Z0-9_-]/g, '')}-${index}`
    const treatment = overlay.imageTreatment || 'cinematic'
    const focusX = clamp(overlay.focalX ?? .5, 0, 1)
    const focusY = clamp(overlay.focalY ?? .5, 0, 1)
    const alignX = focusX < .34 ? 'xMin' : focusX > .66 ? 'xMax' : 'xMid'
    const alignY = focusY < .34 ? 'YMin' : focusY > .66 ? 'YMax' : 'YMid'
    const preserve = `${alignX}${alignY} slice`
    const saturation = treatment === 'documentary' ? .82 : treatment === 'editorial' ? .62 : treatment === 'duotone' ? .18 : treatment === 'none' ? 1 : treatment === 'arch-scrim' ? .58 : treatment === 'split-canvas' ? .76 : .48
    const contrast = treatment === 'none' ? 1 : treatment === 'documentary' ? 1.06 : 1.16
    const filterId = `${id}-filter`
    definitions.push(`<filter id="${filterId}" x="-10%" y="-10%" width="120%" height="120%"><feColorMatrix type="saturate" values="${round(saturation)}"/><feComponentTransfer><feFuncR type="linear" slope="${round(contrast)}" intercept="${round((1 - contrast) / 2)}"/><feFuncG type="linear" slope="${round(contrast)}" intercept="${round((1 - contrast) / 2)}"/><feFuncB type="linear" slope="${round(contrast)}" intercept="${round((1 - contrast) / 2)}"/></feComponentTransfer></filter>`)
    const textZone = overlay.textZone || (focusX < .45 ? 'right' : 'left')
    const shade = clamp(overlay.readabilityShade ?? .72, 0, .95)
    const gradientId = `${id}-shade`
    const gradient = textZone === 'right'
      ? `<linearGradient id="${gradientId}" x1="100%" y1="50%" x2="0%" y2="50%"><stop offset="0%" stop-color="${p.background}" stop-opacity="${round(shade)}"/><stop offset="58%" stop-color="${p.background}" stop-opacity="${round(shade * .42)}"/><stop offset="100%" stop-color="${p.background}" stop-opacity="0"/></linearGradient>`
      : textZone === 'left'
        ? `<linearGradient id="${gradientId}" x1="0%" y1="50%" x2="100%" y2="50%"><stop offset="0%" stop-color="${p.background}" stop-opacity="${round(shade)}"/><stop offset="58%" stop-color="${p.background}" stop-opacity="${round(shade * .42)}"/><stop offset="100%" stop-color="${p.background}" stop-opacity="0"/></linearGradient>`
        : textZone === 'top'
          ? `<linearGradient id="${gradientId}" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="${p.background}" stop-opacity="${round(shade)}"/><stop offset="58%" stop-color="${p.background}" stop-opacity="${round(shade * .35)}"/><stop offset="100%" stop-color="${p.background}" stop-opacity="0"/></linearGradient>`
          : textZone === 'center'
            ? `<radialGradient id="${gradientId}" cx="52%" cy="48%" r="54%"><stop offset="0%" stop-color="${p.background}" stop-opacity="${round(shade)}"/><stop offset="48%" stop-color="${p.background}" stop-opacity="${round(shade * .62)}"/><stop offset="100%" stop-color="${p.background}" stop-opacity="${round(shade * .08)}"/></radialGradient>`
            : `<linearGradient id="${gradientId}" x1="50%" y1="100%" x2="50%" y2="0%"><stop offset="0%" stop-color="${p.background}" stop-opacity="${round(shade)}"/><stop offset="58%" stop-color="${p.background}" stop-opacity="${round(shade * .38)}"/><stop offset="100%" stop-color="${p.background}" stop-opacity="0"/></linearGradient>`
    definitions.push(gradient)
    const vignette = clamp(overlay.vignette ?? .34, 0, .8)
    const vignetteId = `${id}-vignette`
    definitions.push(`<radialGradient id="${vignetteId}" cx="50%" cy="44%" r="72%"><stop offset="48%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="${round(vignette)}"/></radialGradient>`)
    const opacity = clamp(overlay.opacity ?? 1, .1, 1)
    const tint = treatment === 'duotone' ? `<rect width="${w}" height="${h}" fill="${p.accent}" opacity=".22" style="mix-blend-mode:color"/>` : ''
    /* معالجتان تُخرجان الصورة من فخّ «صورة خلف نص»:
       - قوس المحراب (arch-scrim): الصورة كاملة، ولوحٌ مقوّس بلون الخلفية يحتضن
         منطقة النص كأن الكلام في محرابٍ يطل على المشهد.
       - نصفا اللوحة (split-canvas): الصورة تسكن نصفاً وتترك للنص نصفاً صريحاً
         بفاصل شعري وعقدتين — إخراج معارض لا ملصق. */
    const minWH = Math.min(w, h)
    if (treatment === 'arch-scrim') {
      const textRight = textZone !== 'left'
      const panelW = w * .52
      const px = textRight ? w - panelW : 0
      const r = panelW / 2
      const capY = h * .17 + r
      const panelPath = `M ${round(px)} ${h} L ${round(px)} ${round(capY)} A ${round(r)} ${round(r)} 0 0 1 ${round(px + panelW)} ${round(capY)} L ${round(px + panelW)} ${h} Z`
      const inset = minWH * .018
      const archLine = `M ${round(px + inset)} ${round(capY)} A ${round(r - inset)} ${round(r - inset)} 0 0 1 ${round(px + panelW - inset)} ${round(capY)}`
      return `<g data-hero-image="true" opacity="${round(opacity)}"><image href="${esc(overlay.src)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="${preserve}" filter="url(#${filterId})"/>${tint}<rect width="${w}" height="${h}" fill="url(#${vignetteId})"/><path d="${panelPath}" fill="${p.background}" opacity=".94"/><path d="${archLine}" fill="none" stroke="${p.accent}" stroke-width="1.6" opacity=".75"/></g>`
    }
    if (treatment === 'split-canvas') {
      const textRight = textZone !== 'left'
      const imgW = w * .55
      const imgX = textRight ? 0 : w - imgW
      const clipId = `${id}-split`
      definitions.push(`<clipPath id="${clipId}"><rect x="${round(imgX)}" y="0" width="${round(imgW)}" height="${h}"/></clipPath>`)
      const divider = round(textRight ? imgW : w - imgW)
      return `<g data-hero-image="true" opacity="${round(opacity)}"><g clip-path="url(#${clipId})"><image href="${esc(overlay.src)}" x="${round(imgX)}" y="0" width="${round(imgW)}" height="${h}" preserveAspectRatio="${preserve}" filter="url(#${filterId})"/><rect x="${round(imgX)}" width="${round(imgW)}" height="${h}" fill="url(#${vignetteId})"/></g><line x1="${divider}" y1="${round(h * .05)}" x2="${divider}" y2="${round(h * .95)}" stroke="${p.accent}" stroke-width="2.4" opacity=".85"/><circle cx="${divider}" cy="${round(h * .05)}" r="${round(minWH * .006)}" fill="${p.accent}"/><circle cx="${divider}" cy="${round(h * .95)}" r="${round(minWH * .006)}" fill="${p.accent}"/></g>`
    }
    return `<g data-hero-image="true" opacity="${round(opacity)}"><image href="${esc(overlay.src)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="${preserve}" filter="url(#${filterId})"/>${tint}<rect width="${w}" height="${h}" fill="${p.background}" opacity=".07"/><rect width="${w}" height="${h}" fill="url(#${gradientId})"/><rect width="${w}" height="${h}" fill="url(#${vignetteId})"/></g>`
  }).join('')
  return { defs: definitions.join(''), markup }
}

/* ═══ طبقات المحرر الحر (أمر الدكتور): تُرسم فوق التكوين بألوان لوحته ═══ */
function overlaysLayer(s: Scene) {
  const overlays = [...(s.plan.overlays || [])].filter((item) => item.imageRole !== 'background').sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  if (!overlays.length) return ''
  const { palette: p, w, h, min } = s
  const colorOf = (name: string) => name === 'accent' ? p.accent : name === 'muted' ? p.muted : name === 'paper' ? p.surface : p.ink
  const definitions: string[] = []
  const parts = overlays.map((overlay) => {
    const x = overlay.x * w
    const y = overlay.y * h
    const width = Math.max(0.02, overlay.width) * w
    const height = Math.max(0.01, overlay.height) * h
    const color = colorOf(overlay.color)
    const opacity = Math.max(.05, Math.min(1, overlay.opacity ?? 1))
    const rotation = Number(overlay.rotation || 0)
    const cx = x + width / 2
    const cy = y + height / 2
    const transform = rotation ? ` transform="rotate(${round(rotation)} ${round(cx)} ${round(cy)})"` : ''
    const blend = overlay.blendMode && overlay.blendMode !== 'normal' ? ` style="mix-blend-mode:${esc(overlay.blendMode)}"` : ''
    if (overlay.kind === 'image' && overlay.src) {
      const clipId = `ov-clip-${esc(overlay.id).replace(/[^a-zA-Z0-9_-]/g, '')}`
      const mask = overlay.mask || 'rounded'
      if (mask === 'circle') definitions.push(`<clipPath id="${clipId}"><ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(width / 2)}" ry="${round(height / 2)}"/></clipPath>`)
      else if (mask === 'rounded') definitions.push(`<clipPath id="${clipId}"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round(min * .022)}"/></clipPath>`)
      const focusX = clamp(overlay.focalX ?? .5, 0, 1)
      const focusY = clamp(overlay.focalY ?? .5, 0, 1)
      const alignX = focusX < .34 ? 'xMin' : focusX > .66 ? 'xMax' : 'xMid'
      const alignY = focusY < .34 ? 'YMin' : focusY > .66 ? 'YMax' : 'YMid'
      const preserve = `${alignX}${alignY} ${overlay.fit === 'contain' ? 'meet' : 'slice'}`
      return `<g${transform}${blend} opacity="${opacity}"${mask !== 'none' ? ` clip-path="url(#${clipId})"` : ''}><image href="${esc(overlay.src)}" x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" preserveAspectRatio="${preserve}"/></g>`
    }
    if (overlay.kind === 'rule') return `<line${transform}${blend} x1="${round(x)}" y1="${round(y)}" x2="${round(x + width)}" y2="${round(y)}" stroke="${color}" stroke-width="${round(Math.max(1.5, height))}" stroke-linecap="round" opacity="${opacity}"/>`
    if (overlay.kind === 'circle') {
      const radius = Math.min(width, height) / 2
      return `<circle${transform}${blend} cx="${round(cx)}" cy="${round(cy)}" r="${round(radius)}" fill="none" stroke="${color}" stroke-width="${round(Math.max(1.5, min * .004))}" opacity="${opacity}"/>`
    }
    if (overlay.kind === 'rect') return `<rect${transform}${blend} x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round(min * .02)}" fill="none" stroke="${color}" stroke-width="${round(Math.max(1.5, min * .004))}" opacity="${opacity}"/>`
    const size = Math.max(12, (overlay.size || .03) * min)
    const anchor = overlay.align || 'end'
    const anchorX = anchor === 'middle' ? x + width / 2 : anchor === 'start' ? x : x + width
    const maxUnits = Math.max(6, width / Math.max(1, size * .555))
    const lines = wrap(String(overlay.text || ''), maxUnits, 6)
    return `<g${transform}${blend}>${textBlock({ lines, x: anchorX, y: y + size, size, fill: color, weight: overlay.weight || 600, anchor, family: 'Tajawal', opacity })}</g>`
  })
  return `<g data-overlays="true">${definitions.length ? `<defs>${definitions.join('')}</defs>` : ''}${parts.join('')}</g>`
}

export function renderCompositionSvg(plan: CompositionPlan, options: RenderSvgOptions = {}) {
  const s = sceneOf(plan)
  const glow = plan.layout === 'hero-word' || plan.layout === 'quiet-orbit' || plan.layout === 'ink-veil' ? 'center'
    : plan.layout === 'quote-stage' || plan.layout === 'human-note' ? 'top-right'
      : plan.layout === 'cinematic-window' || plan.layout === 'sadu-weave' || plan.layout === 'neural-constellation'
        || plan.layout === 'type-poster' || plan.layout === 'swiss-grid' ? 'none'
        : 'top-left'
  const bg = backdrop(s, { glow })
  const heroImage = plan.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background' && item.src)
  /* الصورة البطولية تمرّ عبر رسّام واعٍ بمنطقة النص، لكنه يحترم عائلة الخطة
     نفسها (اقتباس/حدث/كلمة بطلة/سجل معرفة). هكذا لا تتحول كل النتائج إلى
     النافذة السينمائية ذاتها لمجرد وجود صورة. */
  /* «الملصق التايبوغرافي — بلا صورة إطلاقاً» (شرط الدكتور نصاً): هذه العائلة
     وحدها لا تُسلَّم لرسّام الصورة ولا تُفرَش تحتها صورةٌ بطولية، فالكلمة نفسها
     هي التصميم. باقي العائلات على سلوكها القائم بلا مساس. */
  const typographicOnly = plan.layout === 'type-poster'
  const painter = heroImage && !typographicOnly ? paintCinematicWindow : (PAINTERS[plan.layout] || paintEditorialAxis)
  const scenePaint = painter(s)
  const hero = typographicOnly ? { defs: '', markup: '' } : imageUnderlayLayer(s)
  const accessible = esc(options.ariaLabel || `${plan.directionLabel}: ${plan.content.title}`)
  const fontStyle = options.fontCss ? `<style>${options.fontCss}</style>` : ''
  return applyWordOffsets(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}" role="img" aria-label="${accessible}" direction="rtl" style="width:100%;height:100%;display:block"><title>${esc(options.title || plan.content.title)}</title><defs>${fontStyle}${bg.defs}${scenePaint.defs || ''}${hero.defs}</defs>${bg.markup}${hero.markup}${frameDecor(s)}${scenePaint.markup}${dnaSignature(s)}${overlaysLayer(s)}${identityLayer(s, options)}</svg>`, plan)
}

/* ------------------------------------------------------------------ */
/*        شرائح الكاروسيل: كل شريحة لوحة مكتملة لا صورة مصغرة            */
/* ------------------------------------------------------------------ */

/** يرسم شريحة داخلية من السلسلة بإخراج موحد مع الغلاف: نفس اللوح والخط والهوية،
    مع رقم شبحي كبير، ولمسة تعتمد على دور الشريحة (سؤال/دليل/خاتمة/دعوة). */
function renderCarouselSlideSvg(plan: CompositionPlan, slideIndex: number, options: RenderSvgOptions = {}) {
  const slide = plan.content.slides[slideIndex]
  if (!slide) return renderCompositionSvg(plan, options)
  const s = sceneOf(plan)
  const { palette: p, w, h, min, uid } = s
  const bg = backdrop(s, { glow: slideIndex % 2 ? 'top-right' : 'top-left' })
  const total = plan.content.slides.length
  const isClosing = slide.role === 'closing' || slide.role === 'action'
  const zoneW = w - s.safeX * 2 - w * .08

  const titleBase = min * .06 * TYPOGRAPHY_MODES[plan.typography].titleScale
  const titleLines = wrap(slide.title, Math.max(8, zoneW / (titleBase * .555)), 4)
  const titleSize = fitted(titleLines, titleBase, zoneW, h * .3, s.titleLineHeight, .55)
  const bodyBase = min * .03
  const bodyLines = slide.body ? wrap(slide.body, Math.max(10, (zoneW - w * .04) / (bodyBase * .555)), 6) : []
  const bodySize = fitted(bodyLines, bodyBase, zoneW - w * .04, h * .3, 1.66, .62)

  // مؤشر تقدم يعرف مكانه: الشريحة الفعالة بلون الهوية
  const dotsH = min * .05
  const progress: StackItem = {
    h: dotsH,
    gap: min * .055,
    draw: (top) => {
      const count = Math.min(total, 10)
      const gapX = min * .02
      const activeW = min * .034
      const dotR = min * .0065
      const totalW = activeW + (count - 1) * gapX
      let x = (w + totalW) / 2
      const parts: string[] = []
      for (let index = 0; index < count; index += 1) {
        const active = index === Math.min(slideIndex, count - 1)
        if (active) {
          parts.push(`<rect x="${round(x - activeW)}" y="${round(top + dotR)}" width="${round(activeW)}" height="${round(dotR * 2)}" rx="${round(dotR)}" fill="${p.accent}"/>`)
          x -= activeW + gapX
        } else {
          parts.push(`<circle cx="${round(x - dotR)}" cy="${round(top + dotR * 2)}" r="${round(dotR)}" fill="${p.muted}" opacity=".5"/>`)
          x -= gapX
        }
      }
      // الشارة العلوية تحمل العدّاد نصاً؛ النقاط وحدها هنا تكفي بلا تكرار
      return parts.join('')
    },
  }

  const roleDecor = slide.role === 'question'
    ? `<text x="${round(s.safeX + min * .02)}" y="${round(h * .34)}" fill="${p.accent}" opacity=".12" font-family="${esc(fontStack(s.displayFamily))}" font-weight="700" font-size="${round(min * .3)}" text-anchor="start">؟</text>`
    : slide.role === 'evidence'
      ? `<rect x="${round(w - s.safeX + min * .02)}" y="${round(h * .3)}" width="${round(min * .006)}" height="${round(h * .16)}" rx="3" fill="${p.accent}" opacity=".85" transform="translate(${round(-min * .01)} 0)"/>`
      : ''

  const closingCta: StackItem = isClosing
    ? (s.cta ? ctaItem(s, { align: 'center', gap: min * .06 }) : s.source ? textItem({ lines: [s.source], x: w / 2, size: Math.max(13, min * .02), fill: p.accent, weight: 700, anchor: 'middle', family: 'Tajawal', letterSpacing: 2, gap: min * .06 }) : { h: 0, draw: () => '' })
    : { h: 0, draw: () => '' }

  const stack = drawStack([
    kickerItem({ ...s, kicker: slide.kicker || `${slideIndex + 1} / ${total}` } as Scene, isClosing ? { x: w / 2, anchor: 'middle' } : {}),
    textItem({ lines: titleLines, x: isClosing ? w / 2 : w - s.safeX, size: titleSize, fill: titleInk(s), weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, anchor: isClosing ? 'middle' : 'end', gap: min * .045 }),
    ruleItem(s, isClosing ? { x: w / 2, anchor: 'middle', gap: min * .04 } : { gap: min * .04 }),
    textItem({ lines: bodyLines, x: isClosing ? w / 2 : w - s.safeX, size: bodySize, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.66, anchor: isClosing ? 'middle' : 'end', gap: min * .05 }),
    closingCta,
    progress,
  ], contentBand(s), .42)

  const ghostIndex = `<text x="${round(s.safeX)}" y="${round(s.safeY + min * .16)}" fill="${p.accent}" opacity=".14" font-family="Tajawal, 'El Messiri', sans-serif" font-weight="500" font-size="${round(min * .17)}" text-anchor="start">${arabicIndex(slideIndex + 1)}</text>`
  const fontStyle = options.fontCss ? `<style>${options.fontCss}</style>` : ''
  const accessible = esc(`شريحة ${slideIndex + 1} من ${total}: ${slide.title}`)
  return applyWordOffsets(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${accessible}" direction="rtl" style="width:100%;height:100%;display:block"><title>${accessible}</title><defs>${fontStyle}${bg.defs}</defs>${bg.markup}${ghostIndex}${roleDecor}${stack}${identityFooter(s)}${identityLayer(s, options)}</svg>`, plan)
}

/** كل لوحات التصميم: الغلاف ثم بقية الشرائح إن كانت الخطة سلسلة. */
export function renderCompositionSeries(plan: CompositionPlan, options: RenderSvgOptions = {}) {
  const series = [renderCompositionSvg(plan, options)]
  if (plan.content.slides.length > 1) {
    for (let index = 1; index < plan.content.slides.length; index += 1) series.push(renderCarouselSlideSvg(plan, index, options))
  }
  return series
}

/* ------------------------------------------------------------------ */
/*              تضمين الخطوط داخل ملف التصدير (نقاء التصدير)             */
/* ------------------------------------------------------------------ */

let embeddedFontCssPromise: Promise<string> | null = null
let sealDataUriPromise: Promise<string> | null = null

/** صورة SVG المعزولة عند التصدير لا تصل إلى /logo.png — نضمّن الختم Base64 مرة ونخزنه. */
async function sealDataUri(): Promise<string> {
  if (sealDataUriPromise) return sealDataUriPromise
  sealDataUriPromise = (async () => {
    try {
      const response = await fetch('/logo.png')
      if (!response.ok) return ''
      return `data:image/png;base64,${toBase64(await response.arrayBuffer())}`
    } catch {
      return ''
    }
  })()
  return sealDataUriPromise
}

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  return btoa(binary)
}

/**
 * ملف PNG المُصدَّر يُرسم داخل SVG معزولة؛ لذلك نضمّن خطوط التصميم داخل الملف
 * نفسه. نقرأ خط Alexandria المحمّل عبر Fontsource إضافة إلى الخطوط المحلية،
 * ثم نحوّل woff2 إلى Data URI. هكذا تكون المعاينة والتنزيل متطابقين فعلاً.
 */
async function embeddedFontCss(): Promise<string> {
  if (embeddedFontCssPromise) return embeddedFontCssPromise
  embeddedFontCssPromise = (async () => {
    try {
      const cssParts: string[] = []
      try {
        const cssResponse = await fetch('/fonts/fonts.css')
        if (cssResponse.ok) cssParts.push(await cssResponse.text())
      } catch { /* الخطوط المحلية ليست شرطاً وحيداً */ }
      if (typeof document !== 'undefined') {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            const rules = Array.from(sheet.cssRules || [])
            const fontRules = rules.filter((rule) => rule.cssText?.includes('@font-face')).map((rule) => rule.cssText)
            if (fontRules.length) cssParts.push(fontRules.join('\n'))
          } catch { /* stylesheet خارجي لا يسمح بالقراءة */ }
        }
      }
      const blocks = cssParts.join('\n').match(/@font-face\s*{[^}]+}/g) || []
      const wanted = blocks.filter((block) => /Alexandria|El Messiri|Tajawal/.test(block) && !/latin-ext/i.test(block))
      const urls = [...new Set(wanted.flatMap((block) => block.match(/url\(([^)]+)\)/g) || []).map((token) => token.slice(4, -1).replace(/["']/g, '')))]
      const dataUris = new Map<string, string>()
      await Promise.all(urls.map(async (rawUrl) => {
        try {
          const resolved = new URL(rawUrl, location.href).href
          const response = await fetch(resolved)
          if (!response.ok) return
          const data = `data:font/woff2;base64,${toBase64(await response.arrayBuffer())}`
          dataUris.set(rawUrl, data)
          dataUris.set(resolved, data)
        } catch { /* خط واحد غير متاح لا يوقف التصدير */ }
      }))
      return wanted
        .map((block) => block.replace(/url\(([^)]+)\)/g, (whole, raw: string) => {
          const clean = raw.replace(/["']/g, '')
          const resolved = (() => { try { return new URL(clean, location.href).href } catch { return clean } })()
          const embedded = dataUris.get(clean) || dataUris.get(resolved)
          return embedded ? `url(${embedded})` : whole
        }))
        .join('\n')
    } catch {
      return ''
    }
  })()
  return embeddedFontCssPromise
}

/**
 * أصول التصدير نفسها متاحة لمحركات الحركة أيضاً؛ وإلا رُسم الفيديو بخطّ نظام
 * بينما يخرج PNG بخطوط الهوية، فتختلف المعاينة عن الملف المنشور.
 */
export async function embeddedCompositionFontCss(): Promise<string> {
  return embeddedFontCss()
}

export async function embeddedCompositionSeal(): Promise<string> {
  return sealDataUri()
}

/**
 * جسر توافق لمحرك الفيديو السابق الموجود في بعض نسخ المستودع.
 * محرك الحركة الجديد يقرأ الأصول المضمّنة مباشرة، لكن إبقاء هذا التصدير يمنع
 * كسر TypeScript إلى أن يُزال design-video.ts القديم في ترحيل مستقل وآمن.
 */
export async function rasterizeCompositionToImage(plan: CompositionPlan): Promise<HTMLImageElement> {
  await Promise.race([
    Promise.allSettled([
      '700 64px "El Messiri"', '600 48px "El Messiri"', '400 32px "El Messiri"',
      '700 40px Tajawal', '500 32px Tajawal', '400 28px Tajawal',
    ].map((font) => document.fonts?.load(font, 'أ') ?? Promise.resolve())),
    new Promise((resolve) => window.setTimeout(resolve, 3500)),
  ])
  await document.fonts?.ready
  const fontCss = await embeddedFontCss()
  const svg = renderCompositionSvg(plan, { fontCss })
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

/* ------------------------------------------------------------------ */
/*                        التصدير والتنزيل والطباعة                     */
/* ------------------------------------------------------------------ */

function fileName(plan: CompositionPlan, extension: string) {
  const safe = (plan.content.heroWord || plan.content.title || 'social-design').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'social-design'
  return `${safe}-${plan.format.id}-${plan.fingerprint.slice(0, 8)}.${extension}`
}

function triggerDownload(url: string, name: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export async function downloadCompositionSvg(plan: CompositionPlan) {
  const sealHref = renderPreferences.seal ? await sealDataUri() : ''
  const blob = new Blob([renderCompositionSvg(plan, sealHref ? { sealHref } : {})], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, fileName(plan, 'svg'))
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

async function rasterizeSvg(svg: string, width: number, height: number, type: 'png' | 'jpeg', background: string, name: string, overlay?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('تعذّر فتح لوحة الرسم.')
    if (type === 'jpeg') {
      context.fillStyle = background
      context.fillRect(0, 0, width, height)
    }
    context.drawImage(image, 0, 0, width, height)
    if (overlay) { try { overlay(context, width, height) } catch { /* لا نُفشل التصدير بسبب الأيقونة */ } }
    const mime = type === 'jpeg' ? 'image/jpeg' : 'image/png'
    const output = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('تعذّر تصدير التصميم.')), mime, type === 'jpeg' ? .94 : undefined))
    const outputUrl = URL.createObjectURL(output)
    triggerDownload(outputUrl, name)
    window.setTimeout(() => URL.revokeObjectURL(outputUrl), 1_000)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * تُخبز الأيقونة الحيّة في الصورة المُصدَّرة تماماً كما تظهر في المعاينة: نقرأ
 * موضعها الفعلي المخزَّن وصورتها المعتمدة، ونرسم الإطار الدائري ثم الاستعارة
 * بألوان التصميم. فما يراه الدكتور في اللوحة هو ما يُنشر. تُلغى إن كانت متوقفةً
 * أو مخفيةً أو بلا موضعٍ مخزَّن (لم تُعايَن بعد).
 */
async function livingIconOverlay(plan: CompositionPlan): Promise<((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | undefined> {
  const [{ paintMetaphor }, { readIconEnabled, readEffectivePlacement, resolveMetaphor }] = await Promise.all([
    import('./reel-metaphors'),
    import('./design-overrides'),
  ])
  if (!readIconEnabled()) return undefined
  const place = readEffectivePlacement(plan)
  if (!place || place.hidden) return undefined
  const metaphor = resolveMetaphor(plan)
  const pal = resolvePalette(plan)
  return (ctx, w, h) => {
    const iconW = (place.size / 100) * w
    const cx = place.left * w + iconW / 2
    const cy = place.top * h + iconW / 2
    const r = iconW * 0.46
    ctx.save()
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = pal.surface
    ctx.globalAlpha = pal.isDark ? 0.42 : 0.66
    ctx.fill()
    ctx.globalAlpha = 0.35
    ctx.lineWidth = Math.max(2, iconW * 0.008)
    ctx.strokeStyle = pal.accent
    ctx.stroke()
    ctx.restore()
    ctx.save()
    ctx.globalAlpha = 1
    paintMetaphor(ctx, metaphor, cx, cy, iconW * 0.6, 0.9, 1, { ink: pal.ink, dim: pal.muted, accent: pal.accent, accent2: pal.accentSoft || pal.accent, danger: pal.accent })
    ctx.restore()
  }
}

/** يصدّر التصميم؛ وإن كان سلسلة صدّر كل شرائحها ملفاً ملفاً — كما يليق بكاروسيل حقيقي. */
export async function downloadCompositionRaster(plan: CompositionPlan, type: 'png' | 'jpeg' = 'png') {
  /* نفس جذر «الخطوط غير جيدة»: ctx/SVG لا يُنزّل خطاً لم تستعمله الصفحة بعد،
     فيسقط الرسم لخطّ نظام صامتاً. نطلب الأوزان المستعملة صراحةً أولاً. */
  await Promise.race([
    Promise.allSettled([
      '700 64px "El Messiri"', '600 48px "El Messiri"', '400 32px "El Messiri"',
      '700 40px Tajawal', '500 32px Tajawal', '400 28px Tajawal',
    ].map((font) => document.fonts?.load(font, 'أ') ?? Promise.resolve())),
    new Promise((resolve) => window.setTimeout(resolve, 3500)),
  ])
  await document.fonts?.ready
  const fontCss = await embeddedFontCss()
  const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const sealHref = renderPreferences.seal ? (await sealDataUri() || TRANSPARENT_PIXEL) : ''
  const series = renderCompositionSeries(plan, { fontCss, ...(sealHref ? { sealHref } : {}) })
  const extension = type === 'jpeg' ? 'jpg' : 'png'
  const background = resolvePalette(plan).background
  const iconOverlay = await livingIconOverlay(plan)
  for (const [index, svg] of series.entries()) {
    const base = fileName(plan, extension)
    const name = series.length > 1 ? base.replace(`.${extension}`, `-${index + 1}of${series.length}.${extension}`) : base
    await rasterizeSvg(svg, plan.format.width, plan.format.height, type, background, name, iconOverlay)
    if (index < series.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 160))
  }
}

export function printCompositionPdf(plan: CompositionPlan) {
  const popup = window.open('', '_blank', 'width=900,height=900')
  if (!popup) throw new Error('اسمح بفتح نافذة الطباعة لحفظ PDF.')
  try { popup.opener = null } catch { /* بعض المتصفحات تمنع تعديل opener */ }
  const series = renderCompositionSeries(plan)
  const pages = series.map((svg) => `<section class="page">${svg}</section>`).join('')
  popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(plan.content.title)}</title><link rel="stylesheet" href="${location.origin}/fonts/fonts.css"><style>@page{size:${plan.format.width}px ${plan.format.height}px;margin:0}html,body{margin:0;background:#fff}.page{break-after:page}.page:last-child{break-after:auto}.page svg{display:block;width:100vw;height:100vh}</style></head><body>${pages}<script>addEventListener('load',()=>setTimeout(()=>print(),400))<\/script></body></html>`)
  popup.document.close()
}

export async function downloadSocialCampaignRaster(campaign: SocialCampaign, type: 'png' | 'jpeg' = 'png') {
  for (const [index, asset] of campaign.assets.entries()) {
    await downloadCompositionRaster(asset.plan, type)
    if (index < campaign.assets.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 180))
  }
}

export function printSocialCampaignPdf(campaign: SocialCampaign) {
  const popup = window.open('', '_blank', 'width=1120,height=900')
  if (!popup) throw new Error('اسمح بفتح نافذة الطباعة لحفظ الحملة PDF.')
  try { popup.opener = null } catch { /* noop */ }
  const pages = campaign.assets.map((asset, index) => {
    const svg = renderCompositionSvg(asset.plan, { title: `${campaign.title} — ${asset.label}` })
    return `<section class="page"><header><b>${esc(asset.label)}</b><span>${index + 1}/${campaign.assets.length}</span></header><div class="art">${svg}</div><p>${esc(asset.purpose)}</p></section>`
  }).join('')
  popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(campaign.title)}</title><link rel="stylesheet" href="${location.origin}/fonts/fonts.css"><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Tajawal,Arial,sans-serif;color:#111}.page{height:185mm;display:grid;grid-template-rows:auto 1fr auto;gap:4mm;break-after:page}.page:last-child{break-after:auto}header{display:flex;justify-content:space-between;font-size:12pt}.art{display:grid;place-items:center;min-height:0}.art svg{display:block;max-width:100%;max-height:160mm;width:auto;height:auto;border-radius:4mm}p{margin:0;color:#666;font-size:9pt}@media screen{body{background:#eee;padding:20px}.page{max-width:1100px;margin:0 auto 24px;background:#fff;padding:24px;height:auto;min-height:720px;box-shadow:0 8px 35px #0002}}</style></head><body>${pages}<script>addEventListener('load',()=>setTimeout(()=>print(),400))<\/script></body></html>`)
  popup.document.close()
}
