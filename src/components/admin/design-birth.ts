/**
 * «ولادة التصميم» — تصميم SVG الحقيقي يبني نفسه أمام العين.
 *
 * النسخة الأولى كانت تُحرّك نسخاً HTML تقريبية (خطّ آخر، حجم آخر، موضع مشتق
 * من geometry الخطة) ثم تُذيبها في التصميم؛ فكانت القطع تحطّ في غير مواضعها
 * (يساراً بـ10–22% من العرض في اتجاه RTL، وبعيداً رأسياً حتى 27%) ثم يقفز
 * العنوان لحظة التسليم. هنا لا نسخ ولا تسليم: نُحرّك عناصر اللوحة المرسومة
 * نفسها — الأرضية ثابتة، ثم العمارة، ثم الأسطر سطراً سطراً بترتيب القراءة،
 * ثم الختم. كل عنصر ينتهي حيث هو فعلاً، بخطّه ولونه وحجمه، فلا قفزة ممكنة.
 *
 * القواعد:
 * - transform وopacity حصراً، بالمنحنى الموحّد EASE، عبر Web Animations.
 * - كل حركة بـ fill:'backwards' فقط: بعد انتهائها يعود العنصر لحالته الطبيعية
 *   كما رسمها المحرّك تماماً؛ لا أنماط عالقة ولا حالة نهائية مزيّفة.
 * - الشفافية الأصلية لكل عنصر (سمة opacity) هي غاية الحركة، لا 1 — فالزخارف
 *   الخافتة لا «تومض» ثم تعود.
 * - العنصر الذي يحمل سمة transform لا يُحرَّك بـ CSS transform (كان سيطغى على
 *   السمة أثناء الحركة ثم يقفز)؛ يكتفي بالشفافية.
 * - الشتات حتميّ من بصمة التصميم: الولادة نفسها في كل إعادة.
 */
import { EASE } from '../motion'

const HOUSE_EASE = `cubic-bezier(${EASE.join(',')})`

export type BirthPhase = 'playing' | 'sealing' | 'done'

export type BirthController = {
  /** يقفز إلى الحالة النهائية فوراً (نقرة التخطّي أو Escape). */
  finish: () => void
  /** يلغي كل شيء بلا أثر (تفكيك المكوّن). */
  cancel: () => void
}

type Box = { top: number; bottom: number; left: number; right: number; cx: number; cy: number; area: number }

type Word = { el: SVGGraphicsElement; box: Box; start: number }

const WORD_START = 160
const WORD_SPREAD = 800
const WORD_DURATION = 950
const CAMERA_DURATION = 1800

/** شتاتٌ حتميّ في [-1, 1] مشتقٌّ من البصمة ورقم العنصر. */
export function birthJitter(fingerprint: string, index: number): number {
  let hash = 9
  for (let i = 0; i < fingerprint.length; i++) hash = ((hash << 5) - hash + fingerprint.charCodeAt(i)) | 0
  const raw = Math.sin(hash * 0.000037 + index * 12.9898) * 43758.5453
  return (raw - Math.floor(raw)) * 2 - 1
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, cx: r.left + r.width / 2, cy: r.top + r.height / 2, area: r.width * r.height }
}

/** الشفافية التي رسمها المحرّك للعنصر — غاية الحركة. */
const restingOpacity = (el: Element) => {
  const value = Number.parseFloat(getComputedStyle(el).opacity)
  return Number.isFinite(value) ? value : 1
}

const NON_VISUAL = new Set(['title', 'desc', 'defs', 'style', 'metadata', 'script', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'filter', 'pattern', 'symbol'])

/**
 * يُطلق الولادة على لوحة SVG مركّبة للتوّ. يُستدعى من useLayoutEffect فتُطبَّق
 * الحالة الأولى قبل أوّل رسم — لا وميض للتصميم مكتملاً قبل أن يولد.
 */
export function playDesignBirth(svg: SVGSVGElement, fingerprint: string, onPhase: (phase: BirthPhase) => void): BirthController {
  const animations: Animation[] = []
  const touched: { el: SVGElement | HTMLElement; box: string; origin: string }[] = []
  let sealTimer = 0
  let settled = false

  const canvas = boxOf(svg)
  if (canvas.area < 1) {
    onPhase('done')
    return { finish: () => undefined, cancel: () => undefined }
  }
  const viewBox = svg.viewBox?.baseVal
  const unitW = viewBox && viewBox.width ? viewBox.width : canvas.right - canvas.left
  const unitH = viewBox && viewBox.height ? viewBox.height : canvas.bottom - canvas.top
  const canvasW = canvas.right - canvas.left
  const canvasH = canvas.bottom - canvas.top

  const prepare = (el: SVGElement | HTMLElement, origin: string) => {
    touched.push({ el, box: el.style.transformBox, origin: el.style.transformOrigin })
    el.style.transformBox = 'fill-box'
    el.style.transformOrigin = origin
  }
  const run = (el: Element, keyframes: Keyframe[], delay: number, duration: number) => {
    const animation = el.animate(keyframes, { delay, duration, fill: 'backwards', easing: 'linear' })
    animations.push(animation)
    return animation
  }

  /* ١) الكلمات: كل سطرٍ في كتلةٍ نصية (g.dw) — بترتيب القراءة العربية:
     من الأعلى إلى الأسفل، ثم من اليمين إلى اليسار في الصفّ الواحد. */
  const rowTolerance = canvasH * 0.02
  const lines = [...svg.querySelectorAll<SVGGraphicsElement>('g.dw text')]
    .map((el) => ({ el, box: boxOf(el) }))
    .filter((item) => item.box.area > 0)
    .sort((a, b) => (Math.abs(a.box.top - b.box.top) > rowTolerance ? a.box.top - b.box.top : b.box.right - a.box.right))
  const step = lines.length > 1 ? Math.min(120, WORD_SPREAD / (lines.length - 1)) : 0
  const words: Word[] = lines.map((item, index) => ({ ...item, start: WORD_START + index * step }))

  words.forEach(({ el, box, start }, index) => {
    /* السطر الكبير (العنوان) يأتي من شتاتٍ أقرب — الكتلة الضخمة إن طارت بعيداً
       بدت فوضى لا اجتماعاً؛ والأسطر الصغيرة تأتي من أبعد. */
    const share = box.area / canvas.area
    const reach = Math.max(0.35, Math.min(1, 1 - share * 3))
    const dx = birthJitter(fingerprint, index * 3 + 1) * unitW * 0.2 * reach
    const dy = birthJitter(fingerprint, index * 3 + 2) * unitH * 0.14 * reach
    const rot = birthJitter(fingerprint, index * 3 + 3) * 6 * reach
    const opacity = restingOpacity(el)
    prepare(el, 'center')
    run(el, [
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.9)`, opacity: 0, easing: HOUSE_EASE },
      { offset: 0.6, transform: `translate(${dx * 0.16}px, ${dy * 0.16}px) rotate(${rot * 0.18}deg) scale(1.012)`, opacity, easing: HOUSE_EASE },
      { transform: 'none', opacity },
    ], start, WORD_DURATION)
  })

  /* ٢) الأرضية والعمارة: أبناء اللوحة المباشرون. الطبقات التي تغطي اللوحة كلّها
     في أوّلها هي الورق — تبقى ثابتة، فالتصميم يولد عليها لا معها. */
  const children = [...svg.children].filter((el): el is SVGGraphicsElement => !NON_VISUAL.has(el.tagName) && el instanceof SVGGraphicsElement)
  let groundEnded = false
  const nearestWord = (box: Box) => {
    let best: Word | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const word of words) {
      const distance = Math.hypot((word.box.cx - box.cx) / canvasW, (word.box.cy - box.cy) / canvasH)
      if (distance < bestDistance) { bestDistance = distance; best = word }
    }
    return bestDistance < 0.22 ? best : null
  }

  children.forEach((el, index) => {
    const box = boxOf(el)
    const share = box.area / canvas.area
    if (!groundEnded && share >= 0.95) return
    groundEnded = true
    if (box.area <= 0 || el.querySelector('g.dw')) return
    const opacity = restingOpacity(el)
    const canTransform = !el.hasAttribute('transform')
    const width = box.right - box.left
    const height = box.bottom - box.top
    const isImage = el.tagName === 'image' || Boolean(el.querySelector('image'))

    /* الصورة البطولية تتظهّر كصورةٍ فوتوغرافية في الحوض: من الضوء إلى التفاصيل. */
    if (isImage) {
      if (canTransform) prepare(el, 'center')
      run(el, [
        { transform: canTransform ? 'scale(1.06)' : undefined, opacity: 0, easing: HOUSE_EASE },
        { transform: canTransform ? 'none' : undefined, opacity },
      ].map(dropUndefined), 0, 1150)
      return
    }

    /* الألواح الكبرى هي المسرح: تحضر أولاً وتستقرّ بلا قفزة. */
    if (share >= 0.1) {
      if (canTransform) prepare(el, 'center')
      run(el, [
        { transform: canTransform ? 'scale(1.025)' : undefined, opacity: 0, easing: HOUSE_EASE },
        { transform: canTransform ? 'none' : undefined, opacity },
      ].map(dropUndefined), Math.min(140, index * 20), 820)
      return
    }

    /* المساطر والخطوط الشعرية تُخَطّ بالقلم: الأفقية من اليمين (اتجاه الكتابة)،
       والرأسية من الأعلى — وتُخطّ بعد أن يحطّ السطر الذي تجاوره. */
    const partner = nearestWord(box)
    const after = partner ? partner.start + WORD_DURATION * 0.45 : WORD_START + index * 30
    const thinH = height <= canvasH * 0.012 && width > height * 3
    const thinV = width <= canvasW * 0.012 && height > width * 3
    if (canTransform && (thinH || thinV)) {
      prepare(el, thinH ? 'right center' : 'center top')
      run(el, [
        { transform: thinH ? 'scaleX(0)' : 'scaleY(0)', opacity, easing: HOUSE_EASE },
        { transform: 'none', opacity },
      ], after, 640)
      return
    }

    /* النقاط والشارات وحبّة الدعوة: تنبثق مع سطرها — فتسبق حبّةُ الدعوة نصَّها
       بقليل، وتولد نقطةُ الشارة مع الشارة. */
    const born = partner ? Math.max(0, partner.start - 60) : WORD_START + index * 30
    if (canTransform) prepare(el, 'center')
    run(el, [
      { transform: canTransform ? 'scale(.6)' : undefined, opacity: 0, easing: HOUSE_EASE },
      { transform: canTransform ? 'none' : undefined, opacity },
    ].map(dropUndefined), born, 620)
  })

  /* ٣) الكاميرا: اللوحة كلّها تستقرّ من اقترابٍ طفيف — دخولُ عدسةٍ لا تكبير.
     على عنصر svg نفسه (طبقة HTML مركّبة) فكلفتها شبه معدومة. */
  run(svg, [
    { transform: 'scale(1.035)', easing: HOUSE_EASE },
    { transform: 'none' },
  ], 0, CAMERA_DURATION)

  const lastStart = words.length ? words[words.length - 1].start : WORD_START
  sealTimer = window.setTimeout(() => onPhase('sealing'), lastStart + WORD_DURATION * 0.5)

  const restore = () => {
    for (const item of touched) {
      item.el.style.transformBox = item.box
      item.el.style.transformOrigin = item.origin
    }
    touched.length = 0
  }
  const settle = () => {
    if (settled) return
    settled = true
    window.clearTimeout(sealTimer)
    restore()
    onPhase('done')
  }

  if (animations.length) {
    Promise.all(animations.map((animation) => animation.finished)).then(settle, () => undefined)
  } else {
    settle()
  }

  return {
    finish: () => {
      for (const animation of animations) {
        try { animation.finish() } catch { /* حركةٌ أُلغيت قبلها */ }
      }
      settle()
    },
    cancel: () => {
      settled = true
      window.clearTimeout(sealTimer)
      for (const animation of animations) animation.cancel()
      restore()
    },
  }
}

function dropUndefined(frame: Keyframe): Keyframe {
  const clean: Keyframe = {}
  for (const [key, value] of Object.entries(frame)) if (value !== undefined) clean[key] = value
  return clean
}
