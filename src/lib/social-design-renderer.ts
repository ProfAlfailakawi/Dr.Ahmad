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
  PALETTES,
  TYPOGRAPHY_MODES,
  compositionTextLayout,
  type CompositionPlan,
  type Palette,
  type SocialCampaign,
} from './social-design-engine'
import { currentSeason, seasonStrokePath } from './seasons'

/* ------------------------------------------------------------------ */
/*     تفضيلات الإخراج: ختم الهوية ولمسة الموسم — للمعاينة والتصدير معاً    */
/* ------------------------------------------------------------------ */

export interface RenderPreferences {
  /** ختم الشعار المخطوط — اختياري بأمر الدكتور */
  seal: boolean
  /** لمسة الموسم الخطية (رمضان/العيد/الوطني) حين يكون الموسم قائماً */
  seasonal: boolean
}

let renderPreferences: RenderPreferences = { seal: false, seasonal: false }

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

// سياسة الموقع المعتمدة أرقام غربية في كل النصوص (WesternDigitsGuard يفرضها في
// المعاينة)؛ نلتزم بها هنا أيضاً كي يتطابق ملف التصدير مع ما يراه الدكتور.
const arabicNumber = (value: number) => String(value)
const arabicIndex = (value: number) => value < 10 ? `0${value}` : String(value)

/** تقدير عرض النص بوحدات نسبية (الحرف العربي = 1). */
function textUnits(value: string) {
  return Array.from(value).reduce((total, character) => {
    if (/\s/.test(character)) return total + .42
    if (/[؀-ۿ]/.test(character)) return total + 1
    if (/[A-Z]/.test(character)) return total + .86
    if (/[a-z0-9]/.test(character)) return total + .72
    return total + .5
  }, 0)
}

/** عرض تقريبي بالبكسل لسطر بحجم خط معيّن. */
const lineWidthPx = (line: string, size: number) => textUnits(line) * size * .555

/** لفّ النص على أسطر ضمن حد وحدات، مع موازنة السطر الأخير كي لا تبقى كلمة يتيمة. */
function wrap(value: string, maxUnits: number, maxLines: number) {
  const source = words(value)
  if (!source.length) return []
  const budget = Math.max(4, maxUnits)
  const lines: string[] = []
  let line = ''
  let consumed = 0
  for (const word of source) {
    const next = line ? `${line} ${word}` : word
    if (textUnits(next) <= budget || !line) line = next
    else {
      lines.push(line)
      consumed += words(line).length
      line = word
      if (lines.length >= maxLines - 1) break
    }
  }
  if (line && lines.length < maxLines) {
    lines.push(line)
    consumed += words(line).length
  }
  if (consumed < source.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, '')}…`
  // موازنة تحريرية: إن انتهى اللف بكلمة واحدة قصيرة في سطر أخير، ننزل إليها كلمة من السطر السابق.
  if (lines.length >= 2) {
    const last = words(lines[lines.length - 1])
    const previous = words(lines[lines.length - 2])
    if (last.length === 1 && previous.length > 2 && !lines[lines.length - 1].endsWith('…')) {
      const moved = previous.pop() as string
      lines[lines.length - 2] = previous.join(' ')
      lines[lines.length - 1] = `${moved} ${last.join(' ')}`
    }
  }
  return lines
}

/** حجم خط يجعل الأسطر تتنفس داخل منطقة محددة بلا فيضان. */
function fitted(lines: string[], base: number, zoneWidth: number, maxHeight: number, lineHeight: number, minimumScale = .5) {
  if (!lines.length) return base
  const widest = Math.max(...lines.map((line) => lineWidthPx(line, base)), 1)
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
     أن ينعكس فوراً مهما قصُر — كان الشرط «٣ كلمات» يبتلع كتابته فتظهر
     المعاينة فارغة. نقبل الآن أي نصٍّ غير فارغ لا يكرّر العنوان. */
  for (const candidate of [plan.content.body, plan.content.subtitle, plan.content.quote]) {
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
const resolveWeight = (family: string, weight: number) => family === 'Tajawal' ? Math.min(weight, 500) : weight

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
  return lines.map((line, index) => {
    const lineY = y + index * size * lineHeight
    return `<text x="${round(x)}" y="${round(lineY)}" fill="${fill}" opacity="${options.opacity ?? 1}" font-family="${esc(family)}" font-size="${round(size)}" font-weight="${weight}" text-anchor="${anchor}" direction="${direction}" unicode-bidi="plaintext"${spacing ? ` letter-spacing="${spacing}"` : ''}>${lineContent(line, options)}</text>`
  }).join('')
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
  slides: number
  displayFamily: string
  bodyFamily: string
  titleWeight: number
  titleLineHeight: number
  /** لوحة قليلة المحتوى: عنوان بلا متن — تكبير وتوسيط بدل الفراغ */
  sparse: boolean
}

function sceneOf(plan: CompositionPlan): Scene {
  const palette = PALETTES[plan.palette]
  const typography = TYPOGRAPHY_MODES[plan.typography]
  const w = plan.format.width
  const h = plan.format.height
  const min = Math.min(w, h)
  const bodyText = distinctBody(plan)
  const cta = plan.ctaPlacement === 'none' ? '' : (plan.content.cta || '')
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
    kicker: plan.content.kicker || plan.directionLabel,
    titleText: plan.content.title,
    bodyText,
    hero: plan.content.heroWord || '',
    cta,
    author: plan.content.author || 'د. أحمد حسين الفيلكاوي',
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
  const lines = wrap(s.titleText, maxUnits, maxLines)
  const size = fitted(lines, base, zoneWidth, s.h * (s.isWide ? .42 : .38), s.titleLineHeight, opts.minScale ?? .5)
  return { lines, size }
}

function fitBody(s: Scene, zoneWidth: number, opts: { base?: number; maxLines?: number; text?: string } = {}) {
  const source = opts.text ?? s.bodyText
  if (!source) return { lines: [] as string[], size: 0 }
  const layout = compositionTextLayout(s.plan)
  const base = opts.base ?? s.min * .0285
  const maxLines = opts.maxLines ?? layout.bodyMaxLines
  const maxUnits = Math.max(10, zoneWidth / (base * .555))
  const lines = wrap(source, maxUnits, maxLines)
  const size = fitted(lines, base, zoneWidth, s.h * .28, 1.62, .66)
  return { lines, size }
}

/* ------------------------------------------------------------------ */
/*                       أنظمة التشطيب المشتركة                        */
/* ------------------------------------------------------------------ */

/** خلفية من طبقتين: غسل لوني هادئ + توهج قطري خافت + حبيبات طباعية دقيقة. */
function backdrop(s: Scene, options: { glow?: 'top-left' | 'top-right' | 'bottom' | 'center' | 'none'; grain?: boolean } = {}) {
  const { palette: p, w, h, uid } = s
  const glow = options.glow ?? 'top-left'
  const glowPos = glow === 'top-left' ? { cx: .18, cy: .12 } : glow === 'top-right' ? { cx: .84, cy: .14 } : glow === 'bottom' ? { cx: .5, cy: .95 } : { cx: .5, cy: .5 }
  const parts = [
    `<rect width="${w}" height="${h}" fill="url(#${uid}-wash)"/>`,
    glow === 'none' ? '' : `<rect width="${w}" height="${h}" fill="url(#${uid}-glow)"/>`,
    options.grain === false ? '' : `<rect width="${w}" height="${h}" filter="url(#${uid}-grain)" opacity="${p.isDark ? .05 : .035}"/>`,
  ]
  const defs = `
    <linearGradient id="${uid}-wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.background}"/>
      <stop offset="1" stop-color="${p.surface}"/>
    </linearGradient>
    <radialGradient id="${uid}-glow" cx="${glowPos.cx}" cy="${glowPos.cy}" r="${s.isWide ? .75 : .62}">
      <stop offset="0" stop-color="${p.accentSoft}" stop-opacity="${p.isDark ? .5 : .55}"/>
      <stop offset="1" stop-color="${p.accentSoft}" stop-opacity="0"/>
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
      options.nameless ? '' : textBlock({ lines: [s.author], x: w / 2, y: y - min * .036, size: nameSize, fill: p.ink, weight: 600, anchor: 'middle', family: 'Tajawal', opacity: .92 }),
      textBlock({ lines: ['dr-alfailakawi.com'], x: w / 2, y, size: domainSize, fill: p.muted, weight: 500, anchor: 'middle', family: 'Tajawal', letterSpacing: 2.2, opacity: .9 }),
    ].join('')
  }
  const ruleY = y - nameSize * 1.55
  return `
    <line x1="${s.safeX}" y1="${round(ruleY)}" x2="${w - s.safeX}" y2="${round(ruleY)}" stroke="${p.rule}" stroke-width="1.1" opacity=".9"/>
    ${options.nameless ? '' : textBlock({ lines: [s.author], x: w - s.safeX, y, size: nameSize, fill: p.ink, weight: 600, anchor: 'end', family: 'Tajawal', opacity: .94 })}
    ${textBlock({ lines: ['dr-alfailakawi.com'], x: options.nameless ? w - s.safeX : s.safeX, y, size: domainSize, fill: p.muted, weight: 500, anchor: options.nameless ? 'end' : 'start', family: 'Tajawal', letterSpacing: 2 })}`
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
  const { palette: p, w, min } = s
  const size = Math.max(14, min * .0215)
  const fill = options.fill ?? p.accent
  const anchor = options.anchor ?? 'end'
  const x = options.x ?? w - s.safeX
  return {
    h: size * 1.15,
    gap: options.gap,
    draw: (top) => {
      const baseline = top + size * .85
      const dot = anchor === 'middle' ? '' : `<circle cx="${round(x - size * .28)}" cy="${round(baseline - size * .3)}" r="${round(size * .21)}" fill="${fill}"/>`
      const textX = anchor === 'middle' ? x : x - size * 1.05
      return `${dot}${textBlock({ lines: [s.kicker], x: textX, y: baseline, size, fill, weight: 700, anchor, family: 'Tajawal', opacity: .95 })}`
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
      return `<line x1="${round(x1)}" y1="${round(top + 1.5)}" x2="${round(x2)}" y2="${round(top + 1.5)}" stroke="${p.accent}" stroke-width="2.6"/>`
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
    draw: (top) => `<g filter="url(#${s.uid}-shadow)"><rect x="${round(x)}" y="${round(top)}" width="${round(pillW)}" height="${round(pillH)}" rx="${round(pillH / 2)}" fill="${p.accent}"/></g>
      ${textBlock({ lines: [label], x: x + pillW / 2, y: top + pillH * .655, size, fill: '#FFFFFF', weight: 700, anchor: 'middle', family: 'Tajawal' })}`,
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
    <circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="#FCFBF7" stroke="${p.rule}" stroke-width="1.2"/>
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

/** ١ — تحريرية صافية: افتتاحية مجلة فاخرة بمحور جانبي وترقيم صفحة. */
const paintEditorialAxis: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const zoneW = w - s.safeX * 2 - w * .1
  const title = fitTitle(s, zoneW)
  const body = fitBody(s, zoneW * .84)
  const axisX = s.safeX + w * .015
  const band = contentBand(s)
  const stack = drawStack([
    kickerItem(s),
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: p.ink, weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: p.accent, gap: min * .035 }),
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

/** ٢ — الكلمة البطلة: كلمة ضخمة محفورة في الخلفية والعنوان يتقدمها. */
const paintHeroWord: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const hero = s.hero || words(s.titleText)[0] || ''
  const heroSize = Math.min(min * .3, (w * .92) / Math.max(1, textUnits(hero) * .555))
  const title = fitTitle(s, w * .78, { base: min * .064 })
  const body = fitBody(s, w * .62, { maxLines: 2 })
  const engraved = textBlock({ lines: [hero], x: w / 2, y: h * (s.isTall ? .3 : .32), size: heroSize, fill: 'none', anchor: 'middle', family: 'El Messiri', weight: 700 })
    .replace('<text ', `<text stroke="${p.accent}" stroke-width="1.5" stroke-opacity=".2" `)
  const stack = drawStack([
    kickerItem(s, { x: w / 2, anchor: 'middle' }),
    ruleItem(s, { x: w / 2, anchor: 'middle', width: min * .07, gap: min * .028 }),
    textItem({ lines: title.lines, x: w / 2, size: title.size, fill: p.ink, weight: 700, anchor: 'middle', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: p.accent, gap: min * .05 }),
    textItem({ lines: body.lines, x: w / 2, size: body.size, fill: p.muted, weight: 400, anchor: 'middle', family: s.bodyFamily, lineHeight: 1.6, gap: min * .045 }),
    ctaItem(s, { align: 'center', gap: min * .06 }),
    carouselItem(s),
  ], contentBand(s), .46)
  return {
    markup: [engraved, stack, identityFooter(s, { mode: 'center' })].join(''),
  }
}

/** ٣ — منصة الاقتباس: علامة تنصيص معمارية واقتباس يتنفس وتوقيع. */
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
      `<text x="${round(w - s.safeX * .82)}" y="${round(top - min * .01)}" fill="${p.accent}" opacity=".16" font-family="El Messiri" font-weight="700" font-size="${round(markSize)}" text-anchor="end">”</text>`,
      textBlock({ lines, x: w - s.safeX, y: top + size * .82, size, fill: p.ink, weight: 500, family: 'El Messiri', lineHeight: 1.66 }),
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

/** ٤ — الأطروحة المزدوجة: لوح جانبي محكم يواجه متناً هادئاً. */
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
        textItem({ lines: title.lines, x: panelX + panelW - pad, size: title.size, fill: p.ink, weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: p.accent, gap: min * .03 }),
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

/** ٥ — سجل الدليل: الرقم بطلاً على دفتر معرفي مسطور. */
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
      `<text x="${w - s.safeX}" y="${round(top + figureSize * .92)}" text-anchor="end" direction="ltr"><tspan fill="${p.accent}" font-family="Tajawal" font-weight="500" font-size="${round(figureSize)}">${esc(figure.value)}</tspan>${figure.unit ? `<tspan fill="${p.muted}" font-family="Tajawal" font-weight="500" font-size="${round(min * .055)}" dx="8">${esc(figure.unit)}</tspan>` : ''}</text>`,
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
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: p.ink, weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: figure ? '' : s.hero, emphasisFill: p.accent, gap: min * .04 }),
    ledgerBody,
    ctaItem(s, { gap: min * .06 }),
    carouselItem(s),
  ], contentBand(s), .4)
  return { markup: [stack, identityFooter(s)].join('') }
}

/** ٦ — واجهة الحدث: شريط علوي محكم وتفاصيل زمن ودعوة واضحة. */
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
    textItem({ lines: title.lines, x: w - s.safeX, size: title.size, fill: p.ink, weight: 700, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: p.accent }),
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
      textBlock({ lines: ['dr-alfailakawi.com'], x: s.safeX, y: bandH * .6, size: Math.max(11, min * .016), fill: 'rgba(255,255,255,.8)', weight: 500, anchor: 'start', family: 'Tajawal', letterSpacing: 1.8 }),
      stack,
      identityFooter(s),
    ].join(''),
  }
}

/** ٧ — خريطة المعرفة: عقدة مركزية ومفاهيم تدور حولها بخيوط هادئة. */
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
      showTitleHeading ? textBlock({ lines: title.lines, x: w - s.safeX, y: titleTop + title.size * .82, size: title.size, fill: p.ink, weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight }) : '',
      `<circle cx="${round(centerX)}" cy="${round(centerY)}" r="${round(orbitR)}" fill="none" stroke="${p.rule}" stroke-width="1.1" opacity=".55"/>`,
      `<g filter="url(#${s.uid}-shadow)"><circle cx="${round(centerX)}" cy="${round(centerY)}" r="${round(coreR)}" fill="${p.accent}"/></g>`,
      textBlock({ lines: [hero], x: centerX, y: centerY + min * .013, size: clamp((coreR * 1.55) / Math.max(1, textUnits(hero) * .555), min * .022, min * .04), fill: '#FFFFFF', weight: 700, anchor: 'middle', family: 'El Messiri' }),
      satellites,
      identityFooter(s),
    ].join(''),
  }
}

/** ٨ — المدار الهادئ: أفلاك رقيقة تحتضن فكرة مركزية. */
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
    textItem({ lines: title.lines, x: cx, size: title.size, fill: p.ink, weight: s.titleWeight, anchor: 'middle', family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: p.accent, gap: min * .045 }),
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

/** ٩ — فصول الفكرة: أوراق متراكبة بترقيم فصلي، مهيأة للسلاسل. */
const paintChapterStack: Painter = (s) => {
  const { palette: p, w, h, min } = s
  const sheetX = s.safeX * .9
  const sheetW = w - sheetX * 2
  const pad = min * .055
  const title = fitTitle(s, sheetW - pad * 2 - w * .08)
  const body = fitBody(s, sheetW - pad * 2 - w * .04)
  const headerH = min * .1
  const innerStackItems: StackItem[] = [
    textItem({ lines: title.lines, x: sheetX + sheetW - pad, size: title.size, fill: p.ink, weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: p.accent }),
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

/** ١٠ — النافذة السينمائية: أشرطة عرض ولوح عنوان عالي التباين. */
const paintCinematicWindow: Painter = (s) => {
  const { palette: p, w, h, min, uid } = s
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
      textBlock({ lines: [s.author], x: w - s.safeX, y: h - barH * .36, size: Math.max(13, min * .02), fill: 'rgba(247,245,239,.9)', weight: 600, family: 'Tajawal' }),
      textBlock({ lines: ['dr-alfailakawi.com'], x: s.safeX, y: h - barH * .36, size: Math.max(11, min * .015), fill: 'rgba(247,245,239,.62)', weight: 500, anchor: 'start', family: 'Tajawal', letterSpacing: 1.8 }),
    ].join(''),
  }
}

/** ١١ — الملاحظة الإنسانية: ورقة دافئة بشريط لاصق وخط تحتي مرسوم باليد. */
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
      ...textItem({ lines: title.lines, x: w - sheetX - pad, size: title.size, fill: p.ink, weight: 500, family: 'El Messiri', lineHeight: 1.62, gap: min * .035 }),
      draw: (top) => [
        textBlock({ lines: title.lines, x: w - sheetX - pad, y: top + title.size * .82, size: title.size, fill: p.ink, weight: 500, family: 'El Messiri', lineHeight: 1.62 }),
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
      textBlock({ lines: [s.author], x: sheetX + pad, y: sheetTop + sheetH - pad * .75, size: Math.max(15, min * .024), fill: p.accent, weight: 700, anchor: 'start', family: 'El Messiri' }),
      carouselItem(s, { gap: 0 }).draw(sheetTop + sheetH + min * .025),
      identityFooter(s, { mode: 'center', nameless: true }),
    ].join(''),
  }
}

/** ١٢ — الملخص المركب: وحدات متدرجة المقام كأنها صفحة هوية مؤسسية. */
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
      textBlock({ lines: ['dr-alfailakawi.com'], x: x0 + (contentW - kickerW - gap) / 2, y: top + kickerH * .6, size: Math.max(11, min * .016), fill: p.muted, weight: 500, anchor: 'middle', family: 'Tajawal', letterSpacing: 1.6 }),
    ].join(''),
  }
  const titleItem: StackItem = {
    h: titleCardH,
    gap,
    draw: (top) => [
      `<g filter="url(#${uid}-shadow)"><rect x="${round(x0)}" y="${round(top)}" width="${round(contentW)}" height="${round(titleCardH)}" rx="${round(min * .02)}" fill="${p.surface}"/></g>`,
      `<rect x="${round(x1 - min * .034)}" y="${round(top + min * .05)}" width="${round(min * .006)}" height="${round(titleCardH - min * .1)}" rx="3" fill="${p.accent}"/>`,
      textBlock({ lines: title.lines, x: x1 - min * .062, y: top + min * .06 + title.size * .82, size: title.size, fill: p.ink, weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, emphasisWord: s.hero, emphasisFill: p.accent }),
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
  ].join('')
}

/* ═══ طبقات المحرر الحر (أمر الدكتور): تُرسم فوق التكوين بألوان لوحته ═══ */
function overlaysLayer(s: Scene) {
  const overlays = s.plan.overlays
  if (!overlays?.length) return ''
  const { palette: p, w, h, min } = s
  const colorOf = (name: string) => name === 'accent' ? p.accent : name === 'muted' ? p.muted : name === 'paper' ? p.surface : p.ink
  const parts = overlays.map((overlay) => {
    const x = overlay.x * w
    const y = overlay.y * h
    const width = Math.max(0.02, overlay.width) * w
    const height = Math.max(0.01, overlay.height) * h
    const color = colorOf(overlay.color)
    const opacity = Math.max(.05, Math.min(1, overlay.opacity))
    if (overlay.kind === 'rule') {
      return `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x + width)}" y2="${round(y)}" stroke="${color}" stroke-width="${round(Math.max(1.5, height))}" stroke-linecap="round" opacity="${opacity}"/>`
    }
    if (overlay.kind === 'circle') {
      const radius = Math.min(width, height) / 2
      return `<circle cx="${round(x + width / 2)}" cy="${round(y + height / 2)}" r="${round(radius)}" fill="none" stroke="${color}" stroke-width="${round(Math.max(1.5, min * .004))}" opacity="${opacity}"/>`
    }
    if (overlay.kind === 'rect') {
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round(min * .02)}" fill="none" stroke="${color}" stroke-width="${round(Math.max(1.5, min * .004))}" opacity="${opacity}"/>`
    }
    const size = Math.max(12, (overlay.size || .03) * min)
    const anchor = overlay.align || 'end'
    const anchorX = anchor === 'middle' ? x + width / 2 : anchor === 'start' ? x : x + width
    const maxChars = Math.max(6, Math.floor(width / (size * .5)))
    const lines = wrap(String(overlay.text || ''), maxChars, 6)
    return textBlock({ lines, x: anchorX, y: y + size, size, fill: color, weight: overlay.weight || 600, anchor, family: 'Tajawal', opacity })
  })
  return `<g data-overlays="true">${parts.join('')}</g>`
}

export function renderCompositionSvg(plan: CompositionPlan, options: RenderSvgOptions = {}) {
  const s = sceneOf(plan)
  const glow = plan.layout === 'hero-word' || plan.layout === 'quiet-orbit' ? 'center'
    : plan.layout === 'quote-stage' || plan.layout === 'human-note' ? 'top-right'
      : plan.layout === 'cinematic-window' ? 'none'
        : 'top-left'
  const bg = backdrop(s, { glow })
  const painter = PAINTERS[plan.layout] || paintEditorialAxis
  const scenePaint = painter(s)
  const accessible = esc(options.ariaLabel || `${plan.directionLabel}: ${plan.content.title}`)
  const fontStyle = options.fontCss ? `<style>${options.fontCss}</style>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}" role="img" aria-label="${accessible}" direction="rtl" style="width:100%;height:100%;display:block"><title>${esc(options.title || plan.content.title)}</title><defs>${fontStyle}${bg.defs}${scenePaint.defs || ''}</defs>${bg.markup}${frameDecor(s)}${scenePaint.markup}${overlaysLayer(s)}${identityLayer(s, options)}</svg>`
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
    ? `<text x="${round(s.safeX + min * .02)}" y="${round(h * .34)}" fill="${p.accent}" opacity=".12" font-family="El Messiri" font-weight="700" font-size="${round(min * .3)}" text-anchor="start">؟</text>`
    : slide.role === 'evidence'
      ? `<rect x="${round(w - s.safeX + min * .02)}" y="${round(h * .3)}" width="${round(min * .006)}" height="${round(h * .16)}" rx="3" fill="${p.accent}" opacity=".85" transform="translate(${round(-min * .01)} 0)"/>`
      : ''

  const closingCta: StackItem = isClosing
    ? (s.cta ? ctaItem(s, { align: 'center', gap: min * .06 }) : textItem({ lines: ['dr-alfailakawi.com'], x: w / 2, size: Math.max(13, min * .02), fill: p.accent, weight: 700, anchor: 'middle', family: 'Tajawal', letterSpacing: 2, gap: min * .06 }))
    : { h: 0, draw: () => '' }

  const stack = drawStack([
    kickerItem({ ...s, kicker: slide.kicker || `${slideIndex + 1} / ${total}` } as Scene, isClosing ? { x: w / 2, anchor: 'middle' } : {}),
    textItem({ lines: titleLines, x: isClosing ? w / 2 : w - s.safeX, size: titleSize, fill: p.ink, weight: s.titleWeight, family: s.displayFamily, lineHeight: s.titleLineHeight, anchor: isClosing ? 'middle' : 'end', gap: min * .045 }),
    ruleItem(s, isClosing ? { x: w / 2, anchor: 'middle', gap: min * .04 } : { gap: min * .04 }),
    textItem({ lines: bodyLines, x: isClosing ? w / 2 : w - s.safeX, size: bodySize, fill: p.muted, weight: 400, family: s.bodyFamily, lineHeight: 1.66, anchor: isClosing ? 'middle' : 'end', gap: min * .05 }),
    closingCta,
    progress,
  ], contentBand(s), .42)

  const ghostIndex = `<text x="${round(s.safeX)}" y="${round(s.safeY + min * .16)}" fill="${p.accent}" opacity=".14" font-family="Tajawal" font-weight="500" font-size="${round(min * .17)}" text-anchor="start">${arabicIndex(slideIndex + 1)}</text>`
  const fontStyle = options.fontCss ? `<style>${options.fontCss}</style>` : ''
  const accessible = esc(`شريحة ${slideIndex + 1} من ${total}: ${slide.title}`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${accessible}" direction="rtl" style="width:100%;height:100%;display:block"><title>${accessible}</title><defs>${fontStyle}${bg.defs}</defs>${bg.markup}${ghostIndex}${roleDecor}${stack}${identityFooter(s)}${identityLayer(s, options)}</svg>`
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
 * ملف PNG المُصدَّر يُرسم داخل صورة SVG معزولة لا تصل إلى خطوط الصفحة،
 * فكانت التنزيلات تخرج بخط النظام لا بخط الهوية. الحل: نضمّن وجهي الهوية
 * (El Messiri وTajawal) كبيانات Base64 داخل ملف التصدير نفسه — مرة واحدة ثم تُخزَّن.
 */
async function embeddedFontCss(): Promise<string> {
  if (embeddedFontCssPromise) return embeddedFontCssPromise
  embeddedFontCssPromise = (async () => {
    try {
      const cssResponse = await fetch('/fonts/fonts.css')
      if (!cssResponse.ok) return ''
      const css = await cssResponse.text()
      const blocks = css.match(/@font-face\s*{[^}]+}/g) || []
      const wanted = blocks.filter((block) => /El Messiri|Tajawal/.test(block) && /U\+0600/.test(block))
      const urls = [...new Set(wanted.flatMap((block) => block.match(/url\(([^)]+)\)/g) || []).map((token) => token.slice(4, -1).replace(/["']/g, '')))]
      const dataUris = new Map<string, string>()
      await Promise.all(urls.map(async (url) => {
        try {
          const response = await fetch(url)
          if (!response.ok) return
          dataUris.set(url, `data:font/woff2;base64,${toBase64(await response.arrayBuffer())}`)
        } catch { /* خط واحد غير متاح لا يوقف التصدير */ }
      }))
      return wanted
        .map((block) => block.replace(/url\(([^)]+)\)/g, (whole, raw: string) => {
          const clean = raw.replace(/["']/g, '')
          return dataUris.has(clean) ? `url(${dataUris.get(clean)})` : whole
        }))
        .join('\n')
    } catch {
      return ''
    }
  })()
  return embeddedFontCssPromise
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

async function rasterizeSvg(svg: string, width: number, height: number, type: 'png' | 'jpeg', background: string, name: string) {
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
    const mime = type === 'jpeg' ? 'image/jpeg' : 'image/png'
    const output = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('تعذّر تصدير التصميم.')), mime, type === 'jpeg' ? .94 : undefined))
    const outputUrl = URL.createObjectURL(output)
    triggerDownload(outputUrl, name)
    window.setTimeout(() => URL.revokeObjectURL(outputUrl), 1_000)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** يصدّر التصميم؛ وإن كان سلسلة صدّر كل شرائحها ملفاً ملفاً — كما يليق بكاروسيل حقيقي. */
export async function downloadCompositionRaster(plan: CompositionPlan, type: 'png' | 'jpeg' = 'png') {
  await document.fonts?.ready
  const fontCss = await embeddedFontCss()
  const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const sealHref = renderPreferences.seal ? (await sealDataUri() || TRANSPARENT_PIXEL) : ''
  const series = renderCompositionSeries(plan, { fontCss, ...(sealHref ? { sealHref } : {}) })
  const extension = type === 'jpeg' ? 'jpg' : 'png'
  const background = PALETTES[plan.palette].background
  for (const [index, svg] of series.entries()) {
    const base = fileName(plan, extension)
    const name = series.length > 1 ? base.replace(`.${extension}`, `-${index + 1}of${series.length}.${extension}`) : base
    await rasterizeSvg(svg, plan.format.width, plan.format.height, type, background, name)
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
