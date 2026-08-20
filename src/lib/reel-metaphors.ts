/**
 * مكتبة الاستعارات البصرية للريل — مشاهد تُرسم، لا صور تُستورد.
 *
 * لماذا رسمٌ لا صور: الصور الجاهزة تُقحم وجوهاً وأماكن ليست من عالم الدكتور،
 * وتفرض تراخيص ونسباً واختلافَ ألوانٍ يكسر هوية الريل. أما الاستعارة المرسومة
 * فترث لوحة العالم ذاتها، وتتحرّك مع الإيقاع، وتُصدَّر بلا وزنٍ يُذكر.
 *
 * وكل استعارة هنا مشتقّة من «المشاهد البصرية» المكتوبة في معجم الدكتور
 * (٢٩٠ مفهوماً، لكلٍّ منها visualScenes وpreferredWorlds وavoid)، فالمعجم
 * هو من يختار الاستعارة لا ذوقٌ عام.
 */

export type MetaphorId =
  | 'bridge'
  | 'roots'
  | 'orbit-loop'
  | 'weave'
  | 'scale'
  | 'seed'
  | 'dissolving-grid'
  | 'compass'
  | 'stairs'
  | 'lens'
  | 'hourglass'
  | 'branching-path'
  | 'signal-bars'
  | 'lock-key'
  | 'constellation'
  | 'ripple'

export interface MetaphorPaint {
  ink: string
  dim: string
  accent: string
  accent2: string
  danger: string
}

/** كل استعارة تُرسم داخل مربعٍ افتراضي 1×1 حول المركز؛ الحجم يأتي من الخارج. */
type Draw = (ctx: CanvasRenderingContext2D, size: number, t: number, progress: number, paint: MetaphorPaint) => void

const TAU = Math.PI * 2
const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)

function stroke(ctx: CanvasRenderingContext2D, color: string, width: number, alpha = 1) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

const PAINTERS: Record<MetaphorId, Draw> = {
  /* جسرٌ يُبنى بين ضفتين — للتعلّم عن بُعد والدمج والربط. */
  bridge: (ctx, size, t, p, paint) => {
    const w = size, h = size * 0.5
    const grow = ease(p)
    stroke(ctx, paint.dim, size * 0.02, 0.5)
    ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.4); ctx.lineTo(-w * 0.3, h * 0.4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.4); ctx.lineTo(w / 2, h * 0.4); ctx.stroke()
    stroke(ctx, paint.accent, size * 0.025, 1)
    ctx.beginPath()
    const span = w * 0.6 * grow
    ctx.moveTo(-w * 0.3, h * 0.4)
    ctx.quadraticCurveTo(-w * 0.3 + span / 2, h * 0.4 - size * 0.34 * grow, -w * 0.3 + span, h * 0.4)
    ctx.stroke()
    for (let i = 1; i < 5; i += 1) {
      const f = i / 5
      if (f > grow) break
      const x = -w * 0.3 + span * f
      const arc = h * 0.4 - Math.sin(f * Math.PI) * size * 0.3 * grow
      stroke(ctx, paint.accent2, size * 0.012, 0.7)
      ctx.beginPath(); ctx.moveTo(x, arc); ctx.lineTo(x, h * 0.4); ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* جذورٌ تحت شجرة — للهوية والانتماء والجذور الثقافية. */
  roots: (ctx, size, t, p, paint) => {
    const grow = ease(p)
    stroke(ctx, paint.ink, size * 0.03, 1)
    ctx.beginPath(); ctx.moveTo(0, size * 0.08); ctx.lineTo(0, -size * 0.3 * grow); ctx.stroke()
    const limb = (angle: number, len: number, width: number, color: string, delay: number) => {
      const g = ease(Math.max(0, (p - delay) / (1 - delay)))
      if (g <= 0) return
      stroke(ctx, color, width, 0.9)
      ctx.beginPath(); ctx.moveTo(0, size * 0.08)
      ctx.quadraticCurveTo(Math.cos(angle) * len * 0.5 * g, size * 0.08 + Math.sin(angle) * len * 0.4 * g,
        Math.cos(angle) * len * g, size * 0.08 + Math.sin(angle) * len * g)
      ctx.stroke()
    }
    limb(Math.PI * 0.75, size * 0.34, size * 0.018, paint.accent, 0.15)
    limb(Math.PI * 0.25, size * 0.34, size * 0.018, paint.accent, 0.22)
    limb(Math.PI * 0.6, size * 0.24, size * 0.012, paint.accent2, 0.35)
    limb(Math.PI * 0.4, size * 0.24, size * 0.012, paint.accent2, 0.42)
    const canopy = ease(Math.max(0, (p - 0.3) / 0.7))
    stroke(ctx, paint.accent2, size * 0.016, 0.55 * canopy)
    ctx.beginPath(); ctx.arc(0, -size * 0.32, size * 0.16 * canopy, 0, TAU); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* حلقة تعلّم دائرية بأربع محطات — لدورات التعلّم والتقويم. */
  'orbit-loop': (ctx, size, t, p, paint) => {
    const r = size * 0.32
    const grow = ease(p)
    stroke(ctx, paint.accent2, size * 0.014, 0.85)
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * grow); ctx.stroke()
    for (let i = 0; i < 4; i += 1) {
      const a = -Math.PI / 2 + (i / 4) * TAU
      if ((i / 4) > grow) break
      const x = Math.cos(a) * r, y = Math.sin(a) * r
      ctx.globalAlpha = 1
      ctx.fillStyle = paint.ink
      ctx.beginPath(); ctx.arc(x, y, size * 0.035, 0, TAU); ctx.fill()
      stroke(ctx, paint.accent, size * 0.01, 1)
      ctx.beginPath(); ctx.arc(x, y, size * 0.055, 0, TAU); ctx.stroke()
    }
    const runner = -Math.PI / 2 + t * 1.1
    ctx.globalAlpha = 1
    ctx.fillStyle = paint.accent
    ctx.shadowColor = paint.accent
    ctx.shadowBlur = size * 0.08
    ctx.beginPath(); ctx.arc(Math.cos(runner) * r, Math.sin(runner) * r, size * 0.022, 0, TAU); ctx.fill()
    ctx.shadowBlur = 0
  },

  /* خيوط سداة ولحمة تتقاطع — للنسيج المعرفي والتصميم التعليمي. */
  weave: (ctx, size, t, p, paint) => {
    const half = size * 0.34
    const lines = 6
    const grow = ease(p)
    for (let i = 0; i < lines; i += 1) {
      const f = i / (lines - 1)
      const y = -half + f * half * 2
      stroke(ctx, paint.accent2, size * 0.012, 0.55)
      ctx.beginPath(); ctx.moveTo(-half, y); ctx.lineTo(-half + half * 2 * grow, y); ctx.stroke()
    }
    const cross = ease(Math.max(0, (p - 0.3) / 0.7))
    for (let i = 0; i < lines; i += 1) {
      const f = i / (lines - 1)
      const x = -half + f * half * 2
      stroke(ctx, paint.accent, size * 0.014, 0.85)
      ctx.beginPath(); ctx.moveTo(x, -half); ctx.lineTo(x, -half + half * 2 * cross); ctx.stroke()
    }
    if (cross > 0.9) {
      ctx.globalAlpha = 0.9
      ctx.fillStyle = paint.ink
      ctx.beginPath(); ctx.arc(0, 0, size * 0.028, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* ميزانٌ يترجّح ثم يستقر — للتقويم والحوكمة والعدل. */
  scale: (ctx, size, t, p, paint) => {
    const settle = ease(p)
    const tilt = Math.sin(t * 1.6) * (1 - settle) * 0.28
    stroke(ctx, paint.dim, size * 0.02, 0.8)
    ctx.beginPath(); ctx.moveTo(0, size * 0.3); ctx.lineTo(0, -size * 0.26); ctx.stroke()
    ctx.save()
    ctx.translate(0, -size * 0.26)
    ctx.rotate(tilt)
    stroke(ctx, paint.accent, size * 0.022, 1)
    ctx.beginPath(); ctx.moveTo(-size * 0.28, 0); ctx.lineTo(size * 0.28, 0); ctx.stroke()
    for (const side of [-1, 1]) {
      const x = side * size * 0.28
      stroke(ctx, paint.accent2, size * 0.012, 0.9)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size * 0.1); ctx.stroke()
      ctx.beginPath(); ctx.arc(x, size * 0.14, size * 0.055, Math.PI, TAU); ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /* بذرة تنبت — للنمو والتعلّم المبكر والطفولة. */
  seed: (ctx, size, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.dim, size * 0.014, 0.5)
    ctx.beginPath(); ctx.moveTo(-size * 0.3, size * 0.26); ctx.lineTo(size * 0.3, size * 0.26); ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = paint.accent
    ctx.beginPath(); ctx.ellipse(0, size * 0.2, size * 0.045, size * 0.06, 0, 0, TAU); ctx.fill()
    stroke(ctx, paint.accent2, size * 0.02, 1)
    ctx.beginPath(); ctx.moveTo(0, size * 0.16)
    ctx.quadraticCurveTo(size * 0.04, size * 0.16 - size * 0.2 * g, 0, size * 0.16 - size * 0.36 * g)
    ctx.stroke()
    const leaf = ease(Math.max(0, (p - 0.45) / 0.55))
    if (leaf > 0) {
      ctx.globalAlpha = leaf
      ctx.fillStyle = paint.accent2
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(side * size * 0.08 * leaf, size * 0.16 - size * 0.26, size * 0.075 * leaf, size * 0.032, side * 0.5, 0, TAU)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  },

  /* شبكة آلية تتفكك أمام لمسة إنسانية — للذكاء الاصطناعي والإنسان. */
  'dissolving-grid': (ctx, size, t, p, paint) => {
    const step = size * 0.11
    const reach = ease(p) * size * 0.42
    for (let x = -size * 0.36; x <= size * 0.36; x += step) {
      for (let y = -size * 0.36; y <= size * 0.36; y += step) {
        const d = Math.hypot(x, y)
        const gone = d < reach
        const alpha = gone ? Math.max(0, 0.5 - (reach - d) / (size * 0.3)) : 0.5
        if (alpha <= 0.02) continue
        const j = gone ? (reach - d) / size : 0
        stroke(ctx, paint.accent2, size * 0.008, alpha)
        const jx = x + Math.sin(t * 3 + x) * size * 0.03 * j
        const jy = y + Math.cos(t * 3 + y) * size * 0.03 * j
        ctx.beginPath(); ctx.moveTo(jx - size * 0.018, jy); ctx.lineTo(jx + size * 0.018, jy)
        ctx.moveTo(jx, jy - size * 0.018); ctx.lineTo(jx, jy + size * 0.018); ctx.stroke()
      }
    }
    ctx.globalAlpha = 0.95
    ctx.fillStyle = paint.accent
    ctx.shadowColor = paint.accent
    ctx.shadowBlur = size * 0.14
    ctx.beginPath(); ctx.arc(0, 0, size * 0.035 + size * 0.008 * Math.sin(t * 4), 0, TAU); ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  },

  /* بوصلة تستقر على اتجاه — للقيادة والرؤية والقرار. */
  compass: (ctx, size, t, p, paint) => {
    const r = size * 0.32
    stroke(ctx, paint.dim, size * 0.012, 0.6)
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke()
    ctx.setLineDash([size * 0.01, size * 0.03])
    stroke(ctx, paint.accent2, size * 0.008, 0.5)
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke()
    ctx.setLineDash([])
    const settle = ease(p)
    const angle = -Math.PI / 2 + (1 - settle) * Math.sin(t * 3.4) * 1.4
    ctx.save(); ctx.rotate(angle)
    ctx.globalAlpha = 1
    ctx.fillStyle = paint.accent
    ctx.beginPath(); ctx.moveTo(0, -r * 0.86); ctx.lineTo(size * 0.045, 0); ctx.lineTo(-size * 0.045, 0); ctx.closePath(); ctx.fill()
    ctx.fillStyle = paint.dim
    ctx.beginPath(); ctx.moveTo(0, r * 0.86); ctx.lineTo(size * 0.045, 0); ctx.lineTo(-size * 0.045, 0); ctx.closePath(); ctx.fill()
    ctx.restore()
    ctx.fillStyle = paint.ink
    ctx.beginPath(); ctx.arc(0, 0, size * 0.032, 0, TAU); ctx.fill()
  },

  /* سلّم مراحل يصعد — للتدرّج والمهارة والتقدّم. */
  stairs: (ctx, size, t, p, paint) => {
    const steps = 4
    const w = size * 0.16, h = size * 0.11
    const grow = ease(p)
    for (let i = 0; i < steps; i += 1) {
      const f = (i + 1) / steps
      if (f > grow + 0.12) break
      const x = -size * 0.32 + i * w
      const y = size * 0.26 - i * h
      const on = f <= grow
      stroke(ctx, on ? paint.accent : paint.dim, size * 0.016, on ? 1 : 0.4)
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - h); ctx.stroke()
    }
    const climberF = Math.min(1, grow)
    ctx.globalAlpha = 1
    ctx.fillStyle = paint.accent2
    ctx.shadowColor = paint.accent2
    ctx.shadowBlur = size * 0.07
    ctx.beginPath()
    ctx.arc(-size * 0.32 + climberF * w * steps - w * 0.5, size * 0.26 - (climberF * steps - 0.5) * h - size * 0.03, size * 0.028, 0, TAU)
    ctx.fill()
    ctx.shadowBlur = 0
  },

  /* عدسة تُقرّب حتى تتضح — للتقصّي والبحث والانتباه. */
  lens: (ctx, size, t, p, paint) => {
    const r = size * 0.24
    const focus = ease(p)
    ctx.save()
    ctx.translate(size * 0.05 * (1 - focus), size * 0.05 * (1 - focus))
    stroke(ctx, paint.accent, size * 0.022, 1)
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(r * 0.72, r * 0.72); ctx.lineTo(r * 1.5, r * 1.5); ctx.stroke()
    ctx.restore()
    const bars = 3
    for (let i = 0; i < bars; i += 1) {
      const y = -size * 0.06 + i * size * 0.06
      const blur = (1 - focus) * size * 0.02
      stroke(ctx, paint.ink, size * 0.014, focus * 0.85)
      ctx.beginPath(); ctx.moveTo(-r * 0.5 + blur, y); ctx.lineTo(r * 0.5 - blur, y); ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* ساعة رملية — للوقت والتأجيل والفرصة. */
  hourglass: (ctx, size, t, p, paint) => {
    const w = size * 0.22, h = size * 0.3
    stroke(ctx, paint.accent, size * 0.02, 1)
    ctx.beginPath()
    ctx.moveTo(-w, -h); ctx.lineTo(w, -h); ctx.lineTo(0, 0); ctx.lineTo(w, h); ctx.lineTo(-w, h); ctx.lineTo(0, 0); ctx.closePath()
    ctx.stroke()
    const fall = ease(p)
    ctx.globalAlpha = 0.85
    ctx.fillStyle = paint.accent2
    ctx.beginPath()
    ctx.moveTo(-w * (1 - fall), -h + h * fall * 0.9); ctx.lineTo(w * (1 - fall), -h + h * fall * 0.9); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, 0); ctx.lineTo(w * fall, h); ctx.lineTo(-w * fall, h); ctx.closePath(); ctx.fill()
    if (fall > 0.05 && fall < 0.95) {
      ctx.fillStyle = paint.accent
      ctx.beginPath(); ctx.arc(0, (t * 2 % 1) * h * 0.8, size * 0.012, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* مسارٌ يتفرّع إلى خيارين — للقرار والمفاضلة. */
  'branching-path': (ctx, size, t, p, paint) => {
    const grow = ease(p)
    stroke(ctx, paint.ink, size * 0.02, 0.95)
    ctx.beginPath(); ctx.moveTo(0, size * 0.32); ctx.lineTo(0, size * 0.32 - size * 0.28 * Math.min(1, grow * 2)); ctx.stroke()
    const split = ease(Math.max(0, (p - 0.4) / 0.6))
    if (split > 0) {
      const y0 = size * 0.32 - size * 0.28
      stroke(ctx, paint.dim, size * 0.016, 0.55)
      ctx.beginPath(); ctx.moveTo(0, y0)
      ctx.quadraticCurveTo(-size * 0.18 * split, y0 - size * 0.12 * split, -size * 0.26 * split, y0 - size * 0.24 * split)
      ctx.stroke()
      stroke(ctx, paint.accent, size * 0.02, 1)
      ctx.beginPath(); ctx.moveTo(0, y0)
      ctx.quadraticCurveTo(size * 0.18 * split, y0 - size * 0.12 * split, size * 0.26 * split, y0 - size * 0.24 * split)
      ctx.stroke()
      if (split > 0.8) {
        ctx.globalAlpha = 1
        ctx.fillStyle = paint.accent
        ctx.shadowColor = paint.accent; ctx.shadowBlur = size * 0.08
        ctx.beginPath(); ctx.arc(size * 0.26, y0 - size * 0.24, size * 0.03, 0, TAU); ctx.fill()
        ctx.shadowBlur = 0
      }
    }
    ctx.globalAlpha = 1
  },

  /* أعمدة إشارة تتصاعد — للبيانات والقياس والأثر. */
  'signal-bars': (ctx, size, t, p, paint) => {
    const bars = 5
    const w = size * 0.075
    const gap = size * 0.035
    const totalW = bars * w + (bars - 1) * gap
    const grow = ease(p)
    for (let i = 0; i < bars; i += 1) {
      const f = (i + 1) / bars
      const local = Math.max(0, Math.min(1, (grow - i * 0.09) * 1.5))
      const h = size * (0.08 + f * 0.34) * local
      const x = -totalW / 2 + i * (w + gap)
      ctx.globalAlpha = 1
      ctx.fillStyle = i === bars - 1 ? paint.accent : paint.accent2
      if (i === bars - 1 && local > 0.9) { ctx.shadowColor = paint.accent; ctx.shadowBlur = size * 0.07 }
      ctx.fillRect(x, size * 0.26 - h, w, h)
      ctx.shadowBlur = 0
    }
    stroke(ctx, paint.dim, size * 0.01, 0.45)
    ctx.beginPath(); ctx.moveTo(-totalW / 2 - gap, size * 0.26); ctx.lineTo(totalW / 2 + gap, size * 0.26); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* قفلٌ ومفتاح — للخصوصية والأمن الرقمي والحوكمة. */
  'lock-key': (ctx, size, t, p, paint) => {
    const open = ease(Math.max(0, (p - 0.45) / 0.55))
    const bw = size * 0.22, bh = size * 0.2
    stroke(ctx, paint.accent2, size * 0.022, 1)
    ctx.save()
    ctx.translate(0, -bh * 0.75)
    ctx.rotate(-open * 0.5)
    ctx.beginPath(); ctx.arc(0, 0, bw * 0.52, Math.PI, TAU); ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.fillStyle = paint.accent
    ctx.beginPath()
    const rr = size * 0.02
    const x = -bw / 2, y = -bh * 0.05
    ctx.moveTo(x + rr, y); ctx.arcTo(x + bw, y, x + bw, y + bh, rr)
    ctx.arcTo(x + bw, y + bh, x, y + bh, rr); ctx.arcTo(x, y + bh, x, y, rr); ctx.arcTo(x, y, x + bw, y, rr)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = paint.ink
    ctx.beginPath(); ctx.arc(0, y + bh * 0.45, size * 0.022, 0, TAU); ctx.fill()
  },

  /* كوكبةٌ تتصل — للشبكة المعرفية والمجتمع والأطلس. */
  constellation: (ctx, size, t, p, paint) => {
    const nodes = [
      [-0.3, -0.18], [-0.05, -0.32], [0.24, -0.12], [0.3, 0.18], [0.0, 0.3], [-0.26, 0.16],
    ] as [number, number][]
    const grow = ease(p)
    stroke(ctx, paint.accent2, size * 0.01, 0.6)
    for (let i = 0; i < nodes.length; i += 1) {
      const f = i / nodes.length
      if (f > grow) break
      const a = nodes[i], b = nodes[(i + 1) % nodes.length]
      ctx.beginPath(); ctx.moveTo(a[0] * size, a[1] * size); ctx.lineTo(b[0] * size, b[1] * size); ctx.stroke()
    }
    nodes.forEach((n, i) => {
      const f = i / nodes.length
      if (f > grow + 0.1) return
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + i)
      ctx.globalAlpha = tw
      ctx.fillStyle = i === 0 ? paint.accent : paint.ink
      ctx.beginPath(); ctx.arc(n[0] * size, n[1] * size, size * (i === 0 ? 0.028 : 0.018), 0, TAU); ctx.fill()
    })
    ctx.globalAlpha = 1
  },

  /* دوائر أثرٍ تتسع — للتأثير والانتشار والصدى. */
  ripple: (ctx, size, t, p, paint) => {
    for (let i = 0; i < 4; i += 1) {
      const phase = ((t * 0.5 + i * 0.25) % 1)
      const r = size * (0.06 + phase * 0.36)
      const alpha = (1 - phase) * 0.7 * ease(p)
      if (alpha <= 0.02) continue
      stroke(ctx, i % 2 ? paint.accent2 : paint.accent, size * 0.014 * (1 - phase) + size * 0.004, alpha)
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = paint.ink
    ctx.beginPath(); ctx.arc(0, 0, size * 0.03, 0, TAU); ctx.fill()
  },
}

/** يرسم استعارةً في المركز المعطى. */
export function paintMetaphor(
  ctx: CanvasRenderingContext2D,
  id: MetaphorId,
  cx: number,
  cy: number,
  size: number,
  t: number,
  progress: number,
  paint: MetaphorPaint,
) {
  const painter = PAINTERS[id]
  if (!painter) return
  ctx.save()
  ctx.translate(cx, cy)
  painter(ctx, size, t, progress, paint)
  ctx.restore()
  ctx.globalAlpha = 1
}

export const METAPHOR_IDS = Object.keys(PAINTERS) as MetaphorId[]

/**
 * يختار الاستعارة من «المشاهد البصرية» المكتوبة في المعجم — لا من ذوقٍ عام.
 * نقرأ نصّ المشاهد وأسماء المفاهيم، ونطابقها بمفردات كل استعارة.
 */
const METAPHOR_CUES: { id: MetaphorId; cues: RegExp }[] = [
  { id: 'bridge', cues: /(جسر|يربط|الربط|مسافة|بُعد|بعد|وصل|تواصل|دمج|بين مكانين|مكانين)/ },
  { id: 'roots', cues: /(جذور|هوية|انتماء|أصل|تراث|ثقاف|نشأة|منبت)/ },
  { id: 'orbit-loop', cues: /(دورة|حلقة|تكرار|مراجعة|تغذية راجعة|دوّار|مستمر|دائري)/ },
  { id: 'weave', cues: /(نسيج|تشاب|تكامل|بنية|منظومة|ترابط|شبكة معرف|تصميم)/ },
  { id: 'scale', cues: /(توازن|ميزان|عدل|حوكمة|مساءلة|تقويم|قياس|معايير|مفاضلة)/ },
  { id: 'seed', cues: /(نمو|بذرة|طفل|طفولة|مبكر|ينمو|يتشكل|نشء|رعاية)/ },
  { id: 'dissolving-grid', cues: /(ذكاء اصطناعي|خوارزم|آلة|أتمتة|بيانات ضخمة|روبوت|رقمنة|تنازل)/ },
  { id: 'compass', cues: /(اتجاه|رؤية|قيادة|بوصلة|قرار|توجيه|استراتيج|مسار واضح)/ },
  { id: 'stairs', cues: /(تدرّج|تدرج|مراحل|مستوى|تقدّم|تقدم|مهارة|إتقان|سلّم|صعود)/ },
  { id: 'lens', cues: /(بحث|تقص|تحليل|تدقيق|فحص|انتباه|تركيز|ملاحظة|دقّة|دقة)/ },
  { id: 'hourglass', cues: /(وقت|زمن|تأجيل|فرصة|سرعة|بطء|مهلة|انتظار|عمر)/ },
  { id: 'branching-path', cues: /(خيار|مفترق|بديل|طريقان|قرار بين|تفرّع|تفرع|إمّا)/ },
  { id: 'signal-bars', cues: /(بيانات|مؤشر|أثر|نتائج|إحصاء|قياس أداء|رقم|نسبة|تحسّن|تحسن)/ },
  { id: 'lock-key', cues: /(خصوصية|أمن|حماية|سرية|صلاحيات|اختراق|بيانات الطلبة|أخلاق)/ },
  { id: 'constellation', cues: /(شبكة|مجتمع|اتصال|روابط|أطلس|معرفة مترابطة|أفراد|جماعة)/ },
  { id: 'ripple', cues: /(أثر|انتشار|صدى|تأثير|يمتد|موجة|يتسع|ينتقل)/ },
]

export function chooseMetaphors(sources: string[], limit = 3): MetaphorId[] {
  const hay = sources.join(' · ')
  const hits: { id: MetaphorId; score: number }[] = []
  for (const { id, cues } of METAPHOR_CUES) {
    const matches = hay.match(new RegExp(cues.source, 'g'))
    if (matches?.length) hits.push({ id, score: matches.length })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit).map((hit) => hit.id)
}
