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
  // مشاهد إنسانية — أشكال مبسّطة في مواقف، لا رموز مجرّدة
  | 'figure-contemplate'
  | 'group-idea'
  | 'teacher-students'
  | 'child-screen'
  | 'hand-write'
  | 'figure-climb'
  | 'two-facing'
  | 'crowd-scatter'
  | 'figure-crossroads'
  // استعارات مشهدية إضافية
  | 'open-door'
  | 'mirror'
  | 'mask-face'
  | 'mountain-peak'
  | 'horizon-sun'
  | 'open-book'
  | 'spotlight'
  | 'anchor'
  | 'thread-cut'
  | 'wave-break'
  | 'maze'
  | 'network-grow'
  // موجة ثانية — تغطية كل المواضيع
  | 'brain-circuit'
  | 'data-flow'
  | 'vr-portal'
  | 'megaphone'
  | 'shield-check'
  | 'puzzle-fit'
  | 'target-hit'
  | 'gears-turn'
  | 'heart-pulse'
  | 'chart-rise'
  | 'quote-marks'
  | 'globe-connect'
  | 'flame-torch'
  | 'balance-human-machine'
  | 'sprout-hand'
  | 'clock-gears'
  | 'lightbulb'
  | 'magnet'
  | 'funnel'
  | 'telescope'
  | 'fingerprint'
  | 'handshake'
  | 'book-stack'
  | 'graduation-cap'
  | 'speech-bubbles'
  | 'tree-grow'
  | 'river-flow'
  | 'infinity-loop'
  | 'rocket'
  | 'pyramid'
  | 'spiral'
  | 'atom'
  | 'microscope'
  | 'dna-helix'
  | 'lantern'
  | 'signpost'

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
  /* ── مشاهد إنسانية مبسّطة ─────────────────────────────────────────── */

  /* شخصٌ يجلس متأمّلاً وفوقه فقاعة فكرة — للتأمل والوعي والمعنى. */
  'figure-contemplate': (ctx, size, t, p, paint) => {
    const g = ease(p)
    const s = size
    stroke(ctx, paint.ink, s * 0.02, g)
    ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.05, 0, TAU); ctx.stroke() // رأس
    ctx.beginPath(); ctx.moveTo(0, s * 0.08); ctx.quadraticCurveTo(-s * 0.02, s * 0.2, s * 0.08, s * 0.24); ctx.stroke() // جذع منحنٍ
    ctx.beginPath(); ctx.moveTo(0, s * 0.14); ctx.lineTo(s * 0.1, s * 0.12); ctx.stroke() // ذراع لليد على الذقن
    const bob = Math.sin(t * 1.4) * s * 0.01
    const think = ease(Math.max(0, (p - 0.35) / 0.65))
    if (think > 0) {
      stroke(ctx, paint.accent2, s * 0.01, 0.6 * think)
      ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.06, s * 0.012, 0, TAU); ctx.stroke()
      ctx.beginPath(); ctx.arc(-s * 0.17, -s * 0.14, s * 0.02, 0, TAU); ctx.stroke()
      ctx.globalAlpha = think
      ctx.fillStyle = paint.accent
      ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.09 * think
      ctx.beginPath(); ctx.arc(-s * 0.24, -s * 0.26 + bob, s * 0.05, 0, TAU); ctx.fill()
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  },

  /* جماعة تقف حول مصباح فكرة في المركز — للفريق والحوار وولادة الفكرة. */
  'group-idea': (ctx, size, t, p, paint) => {
    const s = size
    const bulbG = ease(Math.min(1, p * 1.6))
    // دوائر أثر تحت المصباح
    for (let i = 0; i < 3; i += 1) {
      const ph = ((t * 0.4 + i * 0.33) % 1)
      stroke(ctx, paint.accent2, s * 0.008, (1 - ph) * 0.4 * bulbG)
      ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * (0.08 + ph * 0.28), s * (0.03 + ph * 0.1), 0, 0, TAU); ctx.stroke()
    }
    // مصباح
    ctx.globalAlpha = bulbG
    ctx.fillStyle = paint.accent
    ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.12 * bulbG
    ctx.beginPath(); ctx.arc(0, -s * 0.02, s * 0.05, 0, TAU); ctx.fill()
    ctx.shadowBlur = 0
    stroke(ctx, paint.accent, s * 0.012, bulbG)
    ctx.beginPath(); ctx.moveTo(-s * 0.02, s * 0.04); ctx.lineTo(s * 0.02, s * 0.04); ctx.stroke()
    // خمسة أشخاص حول المركز
    const people = 5
    for (let i = 0; i < people; i += 1) {
      const app = ease(Math.max(0, (p - 0.1 - i * 0.12) * 2))
      if (app <= 0) continue
      const a = -Math.PI / 2 + (i / people) * TAU
      const R = s * 0.32
      const x = Math.cos(a) * R, y = Math.sin(a) * R * 0.62 + s * 0.06
      ctx.globalAlpha = app
      stroke(ctx, paint.ink, s * 0.016, app)
      ctx.beginPath(); ctx.arc(x, y - s * 0.05, s * 0.028, 0, TAU); ctx.stroke() // رأس
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.02); ctx.lineTo(x, y + s * 0.06); ctx.stroke() // جذع
      ctx.beginPath(); ctx.moveTo(x - s * 0.03, y + s * 0.09); ctx.lineTo(x, y + s * 0.06); ctx.lineTo(x + s * 0.03, y + s * 0.09); ctx.stroke() // ثوب
    }
    ctx.globalAlpha = 1
  },

  /* معلّم أمام سبورة وثلاثة متعلمين — للتعليم والصف والمعرفة. */
  'teacher-students': (ctx, size, t, p, paint) => {
    const s = size
    const g = ease(p)
    // سبورة
    stroke(ctx, paint.accent2, s * 0.014, 0.8 * g)
    ctx.strokeRect(-s * 0.4, -s * 0.34, s * 0.34, s * 0.24)
    stroke(ctx, paint.dim, s * 0.008, 0.6 * ease(Math.max(0, (p - 0.3) / 0.7)))
    for (let i = 0; i < 3; i += 1) { const y = -s * 0.28 + i * s * 0.06; ctx.beginPath(); ctx.moveTo(-s * 0.36, y); ctx.lineTo(-s * 0.36 + s * 0.26 * g, y); ctx.stroke() }
    // معلّم
    stroke(ctx, paint.accent, s * 0.018, g)
    ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.06, s * 0.032, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.028); ctx.lineTo(-s * 0.16, s * 0.1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.16, s * 0.02); ctx.lineTo(-s * 0.24, -s * 0.04); ctx.stroke() // ذراع يشير للسبورة
    ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.14); ctx.lineTo(-s * 0.16, s * 0.1); ctx.lineTo(-s * 0.12, s * 0.14); ctx.stroke()
    // ثلاثة طلاب
    for (let i = 0; i < 3; i += 1) {
      const app = ease(Math.max(0, (p - 0.25 - i * 0.12) * 2))
      if (app <= 0) continue
      const x = s * 0.08 + i * s * 0.13
      ctx.globalAlpha = app
      stroke(ctx, paint.ink, s * 0.014, app)
      ctx.beginPath(); ctx.arc(x, s * 0.02, s * 0.026, 0, TAU); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, s * 0.05); ctx.lineTo(x, s * 0.14); ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* طفل صغير أمام شاشة كبيرة تطغى عليه — للطفل والتكنولوجيا والشاشات. */
  'child-screen': (ctx, size, t, p, paint) => {
    const s = size
    const g = ease(p)
    const glow = 0.5 + 0.5 * Math.sin(t * 3)
    // شاشة
    ctx.globalAlpha = g
    ctx.fillStyle = paint.accent2
    ctx.shadowColor = paint.accent2; ctx.shadowBlur = s * 0.1 * glow
    ctx.fillRect(s * 0.02, -s * 0.3, s * 0.34, s * 0.34)
    ctx.shadowBlur = 0
    ctx.fillStyle = paint.dim
    ctx.globalAlpha = 0.4 * g
    ctx.fillRect(s * 0.06, -s * 0.26, s * 0.26, s * 0.05)
    ctx.fillRect(s * 0.06, -s * 0.18, s * 0.18, s * 0.04)
    // طفل صغير ينظر لأعلى
    ctx.globalAlpha = g
    stroke(ctx, paint.ink, s * 0.016, g)
    ctx.beginPath(); ctx.arc(-s * 0.22, s * 0.06, s * 0.03, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.22, s * 0.09); ctx.lineTo(-s * 0.22, s * 0.2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.26, s * 0.24); ctx.lineTo(-s * 0.22, s * 0.2); ctx.lineTo(-s * 0.18, s * 0.24); ctx.stroke()
    // شعاع ضوء الشاشة على الطفل
    stroke(ctx, paint.accent2, s * 0.006, 0.3 * g)
    ctx.beginPath(); ctx.moveTo(s * 0.02, -s * 0.13); ctx.lineTo(-s * 0.19, s * 0.04); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* يدٌ تكتب بريشة ويسيل الحبر — للكتابة والتأليف والفكرة المدوّنة. */
  'hand-write': (ctx, size, t, p, paint) => {
    const s = size
    const g = ease(p)
    // سطر يُكتب
    stroke(ctx, paint.ink, s * 0.02, 1)
    ctx.beginPath()
    const x0 = -s * 0.3, x1 = s * 0.28
    const penX = x1 - (x1 - x0) * g
    ctx.moveTo(x1, s * 0.12)
    for (let x = x1; x >= penX; x -= s * 0.02) {
      ctx.lineTo(x, s * 0.12 + Math.sin((x1 - x) / s * 22) * s * 0.02)
    }
    ctx.stroke()
    // ريشة/قلم
    if (g < 0.98) {
      ctx.save(); ctx.translate(penX, s * 0.12); ctx.rotate(-0.9)
      stroke(ctx, paint.accent, s * 0.02, 1)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.24); ctx.stroke()
      ctx.fillStyle = paint.accent
      ctx.beginPath(); ctx.moveTo(-s * 0.012, 0); ctx.lineTo(s * 0.012, 0); ctx.lineTo(0, s * 0.03); ctx.closePath(); ctx.fill()
      ctx.restore()
      // قطرة حبر
      ctx.fillStyle = paint.accent
      ctx.globalAlpha = 0.7
      ctx.beginPath(); ctx.arc(penX, s * 0.12, s * 0.02, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* شخصٌ يصعد سلّماً نحو قمّة مضيئة — للطموح والتقدّم والمثابرة. */
  'figure-climb': (ctx, size, t, p, paint) => {
    const s = size
    const g = ease(p)
    const steps = 4
    for (let i = 0; i < steps; i += 1) {
      const f = (i + 1) / steps
      const on = f <= g + 0.12
      const x = -s * 0.28 + i * s * 0.14, y = s * 0.24 - i * s * 0.11
      stroke(ctx, on ? paint.accent : paint.dim, s * 0.014, on ? 0.9 : 0.4)
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.14, y); ctx.lineTo(x + s * 0.14, y - s * 0.11); ctx.stroke()
    }
    // قمّة مضيئة
    const top = ease(Math.max(0, (p - 0.6) / 0.4))
    if (top > 0) {
      ctx.globalAlpha = top
      ctx.fillStyle = paint.accent
      ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.12 * top
      ctx.beginPath(); ctx.arc(s * 0.34, -s * 0.24, s * 0.03, 0, TAU); ctx.fill()
      ctx.shadowBlur = 0
    }
    // متسلّق
    const cf = Math.min(0.86, g)
    const cx = -s * 0.28 + cf * s * 0.14 * steps - s * 0.06
    const cy = s * 0.24 - cf * steps * s * 0.11 - s * 0.06
    ctx.globalAlpha = 1
    stroke(ctx, paint.ink, s * 0.016, 1)
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.04, s * 0.026, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.014); ctx.lineTo(cx, cy + s * 0.05); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx - s * 0.03, cy + s * 0.02); ctx.lineTo(cx + s * 0.03, cy - s * 0.02); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* شخصان متقابلان بينهما خط — للحوار والاختلاف والتفاهم. */
  'two-facing': (ctx, size, t, p, paint) => {
    const s = size
    const g = ease(p)
    const draw = (x: number, dir: number, color: string, app: number) => {
      if (app <= 0) return
      stroke(ctx, color, s * 0.02, app)
      ctx.beginPath(); ctx.arc(x, -s * 0.04, s * 0.036, 0, TAU); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s * 0.14); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, s * 0.04); ctx.lineTo(x + dir * s * 0.08, s * 0.02); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x - s * 0.04, s * 0.2); ctx.lineTo(x, s * 0.14); ctx.lineTo(x + s * 0.04, s * 0.2); ctx.stroke()
    }
    draw(-s * 0.26, 1, paint.accent, ease(Math.min(1, p * 2)))
    draw(s * 0.26, -1, paint.accent2, ease(Math.max(0, (p - 0.2) * 2)))
    // خط الحوار بينهما
    const link = ease(Math.max(0, (p - 0.45) / 0.55))
    if (link > 0) {
      stroke(ctx, paint.ink, s * 0.008, 0.6 * link)
      ctx.setLineDash([s * 0.02, s * 0.02])
      ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.02); ctx.lineTo(-s * 0.18 + (s * 0.36) * link, -s * 0.02); ctx.stroke()
      ctx.setLineDash([])
      const dot = 0.5 + 0.5 * Math.sin(t * 3)
      ctx.fillStyle = paint.accent; ctx.globalAlpha = link * dot
      ctx.beginPath(); ctx.arc(0, -s * 0.02, s * 0.018, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* حشدٌ يتفرّق ويبقى واحدٌ ثابت — للضجيج والثبات والتفرّد. */
  'crowd-scatter': (ctx, size, t, p, paint) => {
    const s = size
    const scatter = ease(p)
    const n = 7
    for (let i = 0; i < n; i += 1) {
      const base = -s * 0.3 + (i / (n - 1)) * s * 0.6
      const drift = (i % 2 ? 1 : -1) * scatter * s * 0.2 * ((i % 3) + 1) / 2
      const fade = 1 - scatter * 0.85
      if (fade <= 0.05) continue
      ctx.globalAlpha = fade
      stroke(ctx, paint.dim, s * 0.012, fade)
      const x = base + drift, y = s * 0.06 + scatter * s * 0.1 * (i % 2 ? 1 : -1)
      ctx.beginPath(); ctx.arc(x, y - s * 0.05, s * 0.022, 0, TAU); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.03); ctx.lineTo(x, y + s * 0.05); ctx.stroke()
    }
    // الثابت في المركز
    ctx.globalAlpha = 1
    stroke(ctx, paint.accent, s * 0.02, 1)
    ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.036, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.lineTo(0, s * 0.1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.045, s * 0.16); ctx.lineTo(0, s * 0.1); ctx.lineTo(s * 0.045, s * 0.16); ctx.stroke()
    const halo = 0.4 + 0.3 * Math.sin(t * 2)
    stroke(ctx, paint.accent2, s * 0.008, halo)
    ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.14, 0, TAU); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* شخصٌ أمام طريقين متفرّعين — للقرار والمفاضلة الإنسانية. */
  'figure-crossroads': (ctx, size, t, p, paint) => {
    const s = size
    const g = ease(p)
    // الطريقان
    stroke(ctx, paint.dim, s * 0.016, 0.6)
    ctx.beginPath(); ctx.moveTo(0, s * 0.16); ctx.lineTo(0, -s * 0.02); ctx.stroke()
    const split = ease(Math.max(0, (p - 0.3) / 0.7))
    stroke(ctx, paint.dim, s * 0.012, 0.5 * split)
    ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.lineTo(-s * 0.26 * split, -s * 0.26 * split); ctx.stroke()
    stroke(ctx, paint.accent, s * 0.016, split)
    ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.lineTo(s * 0.26 * split, -s * 0.26 * split); ctx.stroke()
    // الشخص عند المفترق
    ctx.globalAlpha = g
    stroke(ctx, paint.ink, s * 0.018, g)
    ctx.beginPath(); ctx.arc(0, s * 0.2, s * 0.03, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, s * 0.23); ctx.lineTo(0, s * 0.16); ctx.stroke()
    if (split > 0.8) { ctx.fillStyle = paint.accent; ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.08; ctx.beginPath(); ctx.arc(s * 0.26, -s * 0.26, s * 0.026, 0, TAU); ctx.fill(); ctx.shadowBlur = 0 }
    ctx.globalAlpha = 1
  },

  /* ── استعارات مشهدية إضافية ───────────────────────────────────────── */

  /* بابٌ ينفتح على ضوء — للفرصة والانفتاح والبداية. */
  'open-door': (ctx, size, t, p, paint) => {
    const s = size, g = ease(p)
    stroke(ctx, paint.dim, s * 0.02, 0.8)
    ctx.strokeRect(-s * 0.16, -s * 0.28, s * 0.32, s * 0.56)
    const open = ease(Math.min(1, p * 1.3))
    // ضوء يتسرب
    ctx.globalAlpha = open
    const grad = ctx.createLinearGradient(-s * 0.16, 0, s * 0.16, 0)
    grad.addColorStop(0, paint.accent + 'cc'); grad.addColorStop(1, paint.accent + '00')
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.28); ctx.lineTo(-s * 0.16 + s * 0.3 * open, -s * 0.28); ctx.lineTo(-s * 0.16 + s * 0.24 * open, s * 0.28); ctx.lineTo(-s * 0.16, s * 0.28); ctx.closePath(); ctx.fill()
    // الباب المفتوح
    stroke(ctx, paint.accent, s * 0.018, 1)
    ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.28); ctx.lineTo(-s * 0.16 - s * 0.1 * open, -s * 0.22); ctx.lineTo(-s * 0.16 - s * 0.1 * open, s * 0.22); ctx.lineTo(-s * 0.16, s * 0.28); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* مرآةٌ تعكس صورةً باهتة — للوعي بالذات والمراجعة. */
  mirror: (ctx, size, t, p, paint) => {
    const s = size, g = ease(p)
    stroke(ctx, paint.accent, s * 0.02, g)
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.16, s * 0.24, 0, 0, TAU); ctx.stroke()
    // الشخص
    stroke(ctx, paint.ink, s * 0.016, g)
    ctx.beginPath(); ctx.arc(-s * 0.02, -s * 0.05, s * 0.03, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.02, -s * 0.02); ctx.lineTo(-s * 0.02, s * 0.12); ctx.stroke()
    // الانعكاس الباهت
    const refl = ease(Math.max(0, (p - 0.35) / 0.65))
    ctx.globalAlpha = 0.35 * refl
    ctx.save(); ctx.scale(-1, 1); ctx.translate(-s * 0.001, 0)
    stroke(ctx, paint.accent2, s * 0.014, 0.35 * refl)
    ctx.beginPath(); ctx.arc(s * 0.02, -s * 0.05, s * 0.028, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(s * 0.02, -s * 0.02); ctx.lineTo(s * 0.02, s * 0.12); ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /* قناعٌ يسقط عن وجه — للصدق مقابل التصنّع. */
  'mask-face': (ctx, size, t, p, paint) => {
    const s = size, g = ease(p)
    // الوجه الحقيقي
    stroke(ctx, paint.ink, s * 0.018, g)
    ctx.beginPath(); ctx.arc(0, -s * 0.02, s * 0.16, 0, TAU); ctx.stroke()
    ctx.fillStyle = paint.ink; ctx.globalAlpha = g
    ctx.beginPath(); ctx.arc(-s * 0.06, -s * 0.05, s * 0.012, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.arc(s * 0.06, -s * 0.05, s * 0.012, 0, TAU); ctx.fill()
    stroke(ctx, paint.accent, s * 0.012, g)
    ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.06, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke() // ابتسامة صادقة
    // القناع يسقط
    const fall = ease(Math.max(0, (p - 0.4) / 0.6))
    if (fall > 0) {
      ctx.save(); ctx.translate(s * 0.02 + fall * s * 0.14, fall * s * 0.34); ctx.rotate(fall * 0.6)
      ctx.globalAlpha = (1 - fall * 0.5)
      stroke(ctx, paint.accent2, s * 0.014, 1)
      ctx.beginPath(); ctx.arc(0, 0, s * 0.12, -0.2 * Math.PI, 1.2 * Math.PI); ctx.stroke()
      ctx.restore()
    }
    ctx.globalAlpha = 1
  },

  /* قمّة جبلٍ تُتسلَّق — للتحدّي والإنجاز والذروة. */
  'mountain-peak': (ctx, size, t, p, paint) => {
    const s = size, g = ease(p)
    stroke(ctx, paint.dim, s * 0.016, 0.7)
    ctx.beginPath(); ctx.moveTo(-s * 0.36, s * 0.26); ctx.lineTo(-s * 0.05, -s * 0.06); ctx.lineTo(s * 0.1, s * 0.1); ctx.lineTo(s * 0.36, s * 0.26); ctx.stroke()
    // القمّة
    stroke(ctx, paint.accent, s * 0.02, ease(Math.min(1, p * 1.4)))
    ctx.beginPath(); ctx.moveTo(-s * 0.05 - s * 0.12, -s * 0.06 + s * 0.12); ctx.lineTo(-s * 0.05, -s * 0.06); ctx.lineTo(-s * 0.05 + s * 0.09, -s * 0.06 + s * 0.09); ctx.stroke()
    // علم على القمّة
    const flag = ease(Math.max(0, (p - 0.55) / 0.45))
    if (flag > 0) {
      stroke(ctx, paint.ink, s * 0.012, flag)
      ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.06); ctx.lineTo(-s * 0.05, -s * 0.06 - s * 0.14 * flag); ctx.stroke()
      ctx.fillStyle = paint.accent; ctx.globalAlpha = flag
      ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.2); ctx.lineTo(-s * 0.05 + s * 0.08, -s * 0.17); ctx.lineTo(-s * 0.05, -s * 0.14); ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* شمسٌ تشرق عند الأفق — للأمل والبداية والتجدّد. */
  'horizon-sun': (ctx, size, t, p, paint) => {
    const s = size, rise = ease(p)
    stroke(ctx, paint.dim, s * 0.014, 0.6)
    ctx.beginPath(); ctx.moveTo(-s * 0.38, s * 0.14); ctx.lineTo(s * 0.38, s * 0.14); ctx.stroke()
    const cy = s * 0.14 - rise * s * 0.24
    // أشعة
    for (let i = 0; i < 8; i += 1) {
      const a = -Math.PI + (i / 7) * Math.PI
      const len = s * (0.1 + 0.05 * Math.sin(t * 2 + i))
      stroke(ctx, paint.accent, s * 0.01, 0.5 * rise)
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.1, cy + Math.sin(a) * s * 0.1); ctx.lineTo(Math.cos(a) * (s * 0.1 + len), cy + Math.sin(a) * (s * 0.1 + len)); ctx.stroke()
    }
    ctx.save(); ctx.beginPath(); ctx.rect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.14 + s * 0.4); ctx.clip()
    ctx.globalAlpha = rise; ctx.fillStyle = paint.accent
    ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.12 * rise
    ctx.beginPath(); ctx.arc(0, cy, s * 0.1, 0, TAU); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    ctx.globalAlpha = 1
  },

  /* كتابٌ يُفتح وتخرج منه صفحات — للمعرفة والقراءة والتأليف. */
  'open-book': (ctx, size, t, p, paint) => {
    const s = size, open = ease(Math.min(1, p * 1.3))
    stroke(ctx, paint.accent, s * 0.018, 1)
    // نصفان
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.02); ctx.quadraticCurveTo(-s * 0.18 * open, -s * 0.1 * open, -s * 0.32 * open, -s * 0.04)
    ctx.lineTo(-s * 0.3 * open, s * 0.18); ctx.quadraticCurveTo(-s * 0.16 * open, s * 0.12, 0, s * 0.18); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.02); ctx.quadraticCurveTo(s * 0.18 * open, -s * 0.1 * open, s * 0.32 * open, -s * 0.04)
    ctx.lineTo(s * 0.3 * open, s * 0.18); ctx.quadraticCurveTo(s * 0.16 * open, s * 0.12, 0, s * 0.18); ctx.stroke()
    stroke(ctx, paint.ink, s * 0.014, open); ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.lineTo(0, s * 0.18); ctx.stroke()
    // صفحة تطير
    const fly = ease(Math.max(0, (p - 0.45) / 0.55))
    if (fly > 0) {
      ctx.globalAlpha = 1 - fly * 0.6
      stroke(ctx, paint.accent2, s * 0.01, 1)
      const fx = -fly * s * 0.1, fy = -s * 0.04 - fly * s * 0.3
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + s * 0.08, fy - s * 0.04); ctx.lineTo(fx + s * 0.1, fy + s * 0.06); ctx.lineTo(fx + s * 0.02, fy + s * 0.08); ctx.closePath(); ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* دائرة ضوءٍ تسلّط على نقطة — للتركيز والكشف والانتباه. */
  spotlight: (ctx, size, t, p, paint) => {
    const s = size, g = ease(p)
    const grad = ctx.createRadialGradient(0, -s * 0.1, 0, 0, s * 0.1, s * 0.4)
    grad.addColorStop(0, paint.accent + Math.round(180 * g).toString(16).padStart(2, '0'))
    grad.addColorStop(1, paint.accent + '00')
    ctx.globalAlpha = 1
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.28); ctx.lineTo(s * 0.05, -s * 0.28); ctx.lineTo(s * 0.24 * g, s * 0.22); ctx.lineTo(-s * 0.24 * g, s * 0.22); ctx.closePath(); ctx.fill()
    // الشخص تحت الضوء
    const reveal = ease(Math.max(0, (p - 0.3) / 0.7))
    if (reveal > 0) {
      ctx.globalAlpha = reveal
      stroke(ctx, paint.ink, s * 0.02, reveal)
      ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.036, 0, TAU); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, s * 0.06); ctx.lineTo(0, s * 0.16); ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* مرساةٌ تثبت في العمق — للثبات والأصالة والجذر. */
  anchor: (ctx, size, t, p, paint) => {
    const s = size, drop = ease(p)
    const cy = -s * 0.24 + drop * s * 0.34
    stroke(ctx, paint.dim, s * 0.008, 0.5)
    ctx.setLineDash([s * 0.015, s * 0.02]); ctx.beginPath(); ctx.moveTo(0, -s * 0.28); ctx.lineTo(0, cy); ctx.stroke(); ctx.setLineDash([])
    ctx.save(); ctx.translate(0, cy)
    stroke(ctx, paint.accent, s * 0.02, 1)
    ctx.beginPath(); ctx.arc(0, -s * 0.04, s * 0.03, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -s * 0.01); ctx.lineTo(0, s * 0.16); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-s * 0.06, s * 0.04); ctx.lineTo(s * 0.06, s * 0.04); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, s * 0.16); ctx.quadraticCurveTo(-s * 0.14, s * 0.14, -s * 0.1, s * 0.04); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, s * 0.16); ctx.quadraticCurveTo(s * 0.14, s * 0.14, s * 0.1, s * 0.04); ctx.stroke()
    ctx.restore()
    // موج عند السطح
    stroke(ctx, paint.accent2, s * 0.008, 0.5)
    ctx.beginPath(); for (let x = -s * 0.36; x < s * 0.36; x += s * 0.04) ctx.lineTo(x, -s * 0.28 + Math.sin(x / s * 18 + t * 2) * s * 0.012); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* خيطٌ يُقطع بمقصّ — للحسم والقطيعة والفصل. */
  'thread-cut': (ctx, size, t, p, paint) => {
    const s = size, cut = ease(p)
    const gapX = cut * s * 0.14
    stroke(ctx, paint.ink, s * 0.014, 1)
    ctx.beginPath(); ctx.moveTo(-s * 0.34, 0); ctx.lineTo(-gapX, cut > 0.5 ? s * 0.05 : 0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(s * 0.34, 0); ctx.lineTo(gapX, cut > 0.5 ? -s * 0.05 : 0); ctx.stroke()
    // المقص
    ctx.save(); ctx.translate(0, 0); ctx.rotate(Math.sin(t * 6) * 0.06 * (1 - cut))
    stroke(ctx, paint.accent, s * 0.014, 1)
    const spread = (1 - cut) * s * 0.05 + s * 0.02
    ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.02); ctx.lineTo(-spread, -s * 0.02); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.02); ctx.lineTo(-spread, s * 0.02); ctx.stroke()
    stroke(ctx, paint.accent, s * 0.012, 1)
    ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.03, s * 0.02, 0, TAU); ctx.stroke()
    ctx.beginPath(); ctx.arc(s * 0.14, s * 0.03, s * 0.02, 0, TAU); ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /* موجةٌ تنكسر — للتحوّل والأزمة ولحظة الانعطاف. */
  'wave-break': (ctx, size, t, p, paint) => {
    const s = size, g = ease(p)
    stroke(ctx, paint.accent2, s * 0.016, 0.9)
    ctx.beginPath()
    for (let x = -s * 0.38; x <= s * 0.05; x += s * 0.02) {
      const y = Math.sin((x + s * 0.38) / s * 6) * s * 0.05
      ctx.lineTo(x, y)
    }
    // الانكسار
    const crest = ease(Math.min(1, p * 1.4))
    ctx.quadraticCurveTo(s * 0.12, -s * 0.22 * crest, s * 0.24 * crest, -s * 0.02)
    ctx.quadraticCurveTo(s * 0.3 * crest, s * 0.08, s * 0.2 * crest, s * 0.12)
    ctx.stroke()
    // رذاذ
    if (crest > 0.6) {
      ctx.fillStyle = paint.accent
      for (let i = 0; i < 6; i += 1) {
        ctx.globalAlpha = (0.7 - i * 0.1) * g
        const a = -0.4 - i * 0.2
        ctx.beginPath(); ctx.arc(s * 0.2 + Math.cos(a) * s * 0.12, -s * 0.1 + Math.sin(a) * s * 0.12 + (t * 40 % 20) * 0.001 * s, s * 0.012, 0, TAU); ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  },

  /* متاهةٌ يُهتدى للطريق فيها — للتعقيد والحيرة والحل. */
  maze: (ctx, size, t, p, paint) => {
    const s = size, solve = ease(p)
    const n = 5, cell = s * 0.12
    stroke(ctx, paint.dim, s * 0.008, 0.5)
    for (let i = 0; i <= n; i += 1) {
      const o = -s * 0.3 + i * cell
      ctx.beginPath(); ctx.moveTo(-s * 0.3, o); ctx.lineTo(s * 0.3, o); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(o, -s * 0.3); ctx.lineTo(o, s * 0.3); ctx.stroke()
    }
    // خيط الحل
    const path: [number, number][] = [[-0.3, 0.3], [-0.3, 0.06], [-0.06, 0.06], [-0.06, -0.18], [0.18, -0.18], [0.18, 0.3]]
    stroke(ctx, paint.accent, s * 0.018, 1)
    ctx.beginPath()
    const total = path.length - 1
    for (let i = 0; i < path.length; i += 1) {
      const seg = i / total
      if (seg > solve) {
        const prev = path[i - 1]; const cur = path[i]; const f = (solve - (i - 1) / total) * total
        ctx.lineTo((prev[0] + (cur[0] - prev[0]) * f) * s, (prev[1] + (cur[1] - prev[1]) * f) * s)
        break
      }
      ctx.lineTo(path[i][0] * s, path[i][1] * s)
    }
    ctx.stroke()
    ctx.fillStyle = paint.accent; ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.06
    const head = path[Math.min(path.length - 1, Math.floor(solve * total) + 1)]
    ctx.beginPath(); ctx.arc(head[0] * s, head[1] * s, s * 0.02, 0, TAU); ctx.fill(); ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  },

  /* شبكةٌ تنمو من عقدة — للنمو المؤسسي والتوسّع والأثر المتصل. */
  'network-grow': (ctx, size, t, p, paint) => {
    const s = size
    const nodes: [number, number][] = [[0, 0], [-0.22, -0.14], [0.2, -0.16], [-0.18, 0.18], [0.22, 0.14], [0, -0.28], [0.3, 0], [-0.3, 0.02]]
    const grow = ease(p)
    const shown = Math.max(1, Math.floor(grow * nodes.length))
    stroke(ctx, paint.accent2, s * 0.01, 0.6)
    for (let i = 1; i < shown; i += 1) {
      const parent = nodes[Math.floor((i - 1) / 2)]
      ctx.beginPath(); ctx.moveTo(parent[0] * s, parent[1] * s); ctx.lineTo(nodes[i][0] * s, nodes[i][1] * s); ctx.stroke()
    }
    for (let i = 0; i < shown; i += 1) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 2 + i)
      ctx.globalAlpha = pulse
      ctx.fillStyle = i === 0 ? paint.accent : paint.ink
      ctx.beginPath(); ctx.arc(nodes[i][0] * s, nodes[i][1] * s, s * (i === 0 ? 0.03 : 0.02), 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* ── الموجة الثانية: تغطية كل المواضيع ───────────────────────────── */

  /* دماغٌ نصفه دوائر إلكترونية — للذكاء الاصطناعي والتعلّم الآلي. */
  'brain-circuit': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.ink, s * 0.016, g)
    ctx.beginPath(); ctx.arc(-s * 0.06, 0, s * 0.22, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke() // نصف عضوي
    for (let i = 0; i < 3; i += 1) { const y = -s * 0.12 + i * s * 0.12; stroke(ctx, paint.accent2, s * 0.006, 0.6 * g); ctx.beginPath(); ctx.arc(-s * 0.06, y, s * (0.04 + i * 0.02), Math.PI * 1.5, Math.PI * 0.5, true); ctx.stroke() }
    // نصف دائرة إلكترونية
    const circ = ease(Math.max(0, (p - 0.3) / 0.7))
    stroke(ctx, paint.accent, s * 0.01, circ)
    for (let i = 0; i < 4; i += 1) {
      const y = -s * 0.16 + i * s * 0.1
      ctx.beginPath(); ctx.moveTo(s * 0.02, y); ctx.lineTo(s * 0.14, y); ctx.stroke()
      ctx.fillStyle = paint.accent; ctx.globalAlpha = circ * (0.6 + 0.4 * Math.sin(t * 3 + i))
      ctx.beginPath(); ctx.arc(s * 0.16, y, s * 0.014, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* بياناتٌ تتدفّق عبر أنبوب إلى وعاء — لتحليل البيانات ومعالجتها. */
  'data-flow': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.accent2, s * 0.018, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.2); ctx.quadraticCurveTo(0, -s * 0.05, s * 0.02, s * 0.18); ctx.stroke()
    // نقاط بيانات تجري
    const n = 6
    for (let i = 0; i < n; i += 1) {
      const ph = ((t * 0.5 + i / n) % 1)
      const x = -s * 0.3 + (s * 0.32) * ph, y = -s * 0.2 + (s * 0.38) * ph * ph
      ctx.globalAlpha = g * (1 - ph * 0.3)
      ctx.fillStyle = i % 2 ? paint.accent : paint.ink
      ctx.beginPath(); ctx.arc(x, y, s * 0.016, 0, TAU); ctx.fill()
    }
    // الوعاء
    stroke(ctx, paint.accent, s * 0.016, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.16); ctx.lineTo(-s * 0.08, s * 0.26); ctx.lineTo(s * 0.12, s * 0.26); ctx.lineTo(s * 0.16, s * 0.16); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* بوابةٌ افتراضية دائرية بعمق — للواقع الافتراضي والبيئات الغامرة. */
  'vr-portal': (ctx, s, t, p, paint) => {
    const g = ease(p)
    for (let i = 0; i < 5; i += 1) {
      const r = s * (0.08 + i * 0.05)
      const rot = t * (0.3 + i * 0.1)
      stroke(ctx, i % 2 ? paint.accent : paint.accent2, s * 0.01, (1 - i * 0.15) * g)
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, rot, 0, TAU); ctx.stroke()
    }
    ctx.globalAlpha = g
    ctx.fillStyle = paint.accent
    ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.14 * (0.7 + 0.3 * Math.sin(t * 3))
    ctx.beginPath(); ctx.arc(0, 0, s * 0.04, 0, TAU); ctx.fill()
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
  },

  /* مكبّر صوتٍ تخرج منه موجات — للإعلام والتأثير والرسالة. */
  megaphone: (ctx, s, t, p, paint) => {
    const g = ease(p)
    ctx.save(); ctx.rotate(-0.2)
    stroke(ctx, paint.accent, s * 0.018, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.06); ctx.lineTo(-s * 0.06, -s * 0.12); ctx.lineTo(-s * 0.06, s * 0.12); ctx.lineTo(-s * 0.24, s * 0.06); ctx.closePath(); ctx.stroke()
    ctx.fillStyle = paint.accent; ctx.globalAlpha = g * 0.3; ctx.fill()
    ctx.restore()
    // موجات صوت
    for (let i = 0; i < 3; i += 1) {
      const ph = ((t * 0.6 + i * 0.33) % 1)
      stroke(ctx, paint.accent2, s * 0.012, (1 - ph) * 0.8 * g)
      ctx.beginPath(); ctx.arc(s * 0.02, -s * 0.02, s * (0.1 + ph * 0.26), -0.5, 0.5); ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* درعٌ فيه علامة صحّ — للأمن والحماية والحوكمة. */
  'shield-check': (ctx, s, t, p, paint) => {
    const g = ease(Math.min(1, p * 1.3))
    stroke(ctx, paint.accent2, s * 0.02, g)
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.26); ctx.lineTo(s * 0.18, -s * 0.16); ctx.lineTo(s * 0.18, s * 0.04)
    ctx.quadraticCurveTo(s * 0.18, s * 0.2, 0, s * 0.28)
    ctx.quadraticCurveTo(-s * 0.18, s * 0.2, -s * 0.18, s * 0.04)
    ctx.lineTo(-s * 0.18, -s * 0.16); ctx.closePath(); ctx.stroke()
    const check = ease(Math.max(0, (p - 0.5) / 0.5))
    if (check > 0) {
      stroke(ctx, paint.accent, s * 0.024, check)
      ctx.beginPath(); ctx.moveTo(-s * 0.08, 0)
      if (check > 0.4) ctx.lineTo(-s * 0.02, s * 0.07)
      ctx.stroke()
      if (check > 0.5) { stroke(ctx, paint.accent, s * 0.024, check); ctx.beginPath(); ctx.moveTo(-s * 0.02, s * 0.07); ctx.lineTo(s * 0.1, -s * 0.08); ctx.stroke() }
    }
    ctx.globalAlpha = 1
  },

  /* قطعتا أحجية تتلاقيان — للتكامل والحل والانسجام. */
  'puzzle-fit': (ctx, s, t, p, paint) => {
    const fit = ease(p)
    const gap = (1 - fit) * s * 0.14
    const knob = (x: number, dir: number, color: string) => {
      stroke(ctx, color, s * 0.016, 1)
      ctx.beginPath()
      ctx.moveTo(x - dir * s * 0.12, -s * 0.12); ctx.lineTo(x, -s * 0.12)
      ctx.lineTo(x, -s * 0.04); ctx.arc(x + dir * s * 0.03, -s * 0.04, s * 0.03, dir < 0 ? Math.PI : 0, dir < 0 ? 0 : Math.PI, dir < 0)
      ctx.lineTo(x, s * 0.04); ctx.lineTo(x, s * 0.12); ctx.lineTo(x - dir * s * 0.12, s * 0.12); ctx.stroke()
    }
    ctx.save(); ctx.translate(-gap, 0); knob(-s * 0.02, 1, paint.accent); ctx.restore()
    ctx.save(); ctx.translate(gap, 0); knob(s * 0.02, -1, paint.accent2); ctx.restore()
    if (fit > 0.9) { ctx.globalAlpha = (fit - 0.9) * 10; ctx.fillStyle = paint.accent; ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.1; ctx.beginPath(); ctx.arc(0, 0, s * 0.02, 0, TAU); ctx.fill(); ctx.shadowBlur = 0 }
    ctx.globalAlpha = 1
  },

  /* سهمٌ يصيب مركز الهدف — للتركيز والإنجاز والدقّة. */
  'target-hit': (ctx, s, t, p, paint) => {
    const g = ease(p)
    for (let i = 3; i >= 1; i -= 1) { stroke(ctx, i === 1 ? paint.accent : paint.dim, s * 0.014, (i === 1 ? 1 : 0.5) * g); ctx.beginPath(); ctx.arc(0, 0, s * 0.08 * i, 0, TAU); ctx.stroke() }
    const hit = ease(Math.max(0, (p - 0.4) / 0.6))
    if (hit > 0) {
      const fromX = -s * 0.4 + hit * s * 0.4, fromY = -s * 0.4 + hit * s * 0.4
      stroke(ctx, paint.accent, s * 0.016, 1)
      ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(fromX + s * 0.1, fromY + s * 0.1); ctx.stroke()
      if (hit > 0.95) { ctx.fillStyle = paint.accent; ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.12; ctx.beginPath(); ctx.arc(0, 0, s * 0.03, 0, TAU); ctx.fill(); ctx.shadowBlur = 0 }
    }
    ctx.globalAlpha = 1
  },

  /* تروسٌ تتشابك وتدور — للأنظمة والتشغيل والمنهجية. */
  'gears-turn': (ctx, s, t, p, paint) => {
    const g = ease(p)
    const gear = (cx: number, cy: number, r: number, teeth: number, rot: number, color: string) => {
      stroke(ctx, color, s * 0.014, g)
      ctx.beginPath()
      for (let i = 0; i < teeth; i += 1) {
        const a = rot + (i / teeth) * TAU
        const r1 = r, r2 = r * 1.22
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
        ctx.lineTo(cx + Math.cos(a + 0.18) * r2, cy + Math.sin(a + 0.18) * r2)
        ctx.lineTo(cx + Math.cos(a + 0.36) * r1, cy + Math.sin(a + 0.36) * r1)
      }
      ctx.closePath(); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, TAU); ctx.stroke()
    }
    gear(-s * 0.1, -s * 0.02, s * 0.12, 8, t * 0.8, paint.accent)
    gear(s * 0.12, s * 0.08, s * 0.09, 7, -t * 1.0 + 0.4, paint.accent2)
    ctx.globalAlpha = 1
  },

  /* نبضُ قلبٍ على خطٍّ حيوي — للإنسانية والصحة النفسية والحياة. */
  'heart-pulse': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.dim, s * 0.01, 0.4 * g)
    ctx.beginPath(); ctx.moveTo(-s * 0.34, 0); ctx.lineTo(s * 0.34, 0); ctx.stroke()
    // خط النبض
    const sweep = ease(Math.min(1, p * 1.4))
    stroke(ctx, paint.accent, s * 0.018, 1)
    ctx.beginPath()
    const pts: [number, number][] = [[-0.34, 0], [-0.1, 0], [-0.05, -0.14], [0.0, 0.2], [0.06, -0.24], [0.12, 0], [0.34, 0]]
    for (let i = 0; i < pts.length; i += 1) { if (pts[i][0] / 0.68 + 0.5 > sweep) break; ctx.lineTo(pts[i][0] * s, pts[i][1] * s) }
    ctx.stroke()
    // قلب صغير ينبض
    const beat = 1 + 0.15 * Math.sin(t * 5)
    ctx.save(); ctx.translate(s * 0.24, -s * 0.14); ctx.scale(beat, beat)
    ctx.fillStyle = paint.accent; ctx.globalAlpha = g
    ctx.beginPath(); ctx.moveTo(0, s * 0.03); ctx.bezierCurveTo(-s * 0.04, -s * 0.02, -s * 0.02, -s * 0.05, 0, -s * 0.02); ctx.bezierCurveTo(s * 0.02, -s * 0.05, s * 0.04, -s * 0.02, 0, s * 0.03); ctx.fill()
    ctx.restore(); ctx.globalAlpha = 1
  },

  /* رسمٌ بيانيّ صاعد بسهم — للنمو والنتائج والتقدّم القابل للقياس. */
  'chart-rise': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.dim, s * 0.012, 0.5 * g)
    ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.22); ctx.lineTo(-s * 0.28, -s * 0.24); ctx.moveTo(-s * 0.28, s * 0.22); ctx.lineTo(s * 0.3, s * 0.22); ctx.stroke()
    const pts: [number, number][] = [[-0.24, 0.14], [-0.12, 0.04], [-0.02, 0.1], [0.1, -0.08], [0.24, -0.18]]
    stroke(ctx, paint.accent, s * 0.018, 1)
    ctx.beginPath()
    const drawTo = Math.floor(g * (pts.length - 1)) + 1
    for (let i = 0; i < Math.min(drawTo, pts.length); i += 1) ctx.lineTo(pts[i][0] * s, pts[i][1] * s)
    ctx.stroke()
    if (g > 0.85) { const last = pts[pts.length - 1]; stroke(ctx, paint.accent, s * 0.016, 1); ctx.beginPath(); ctx.moveTo(last[0] * s, last[1] * s); ctx.lineTo(last[0] * s - s * 0.05, last[1] * s + s * 0.02); ctx.moveTo(last[0] * s, last[1] * s); ctx.lineTo(last[0] * s - s * 0.02, last[1] * s + s * 0.05); ctx.stroke() }
    ctx.globalAlpha = 1
  },

  /* علامتا اقتباس كبيرتان — للحكمة والمقولة والكلمة. */
  'quote-marks': (ctx, s, t, p, paint) => {
    const g = ease(Math.min(1, p * 1.6))
    ctx.fillStyle = paint.accent; ctx.globalAlpha = g
    const mark = (cx: number, cy: number, sc: number) => {
      for (const dx of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + dx * s * 0.075 * sc, cy, s * 0.07 * sc, 0, TAU); ctx.fill()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath(); ctx.arc(cx + dx * s * 0.075 * sc + s * 0.03 * sc, cy - s * 0.03 * sc, s * 0.048 * sc, 0, TAU); ctx.fill()
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = paint.accent
      }
    }
    mark(-s * 0.14, -s * 0.06, 1)
    const second = ease(Math.max(0, (p - 0.3) / 0.7))
    ctx.globalAlpha = second * g; if (second > 0) mark(s * 0.14, s * 0.06, 1)
    // سطر بينهما
    const line = ease(Math.max(0, (p - 0.45) / 0.55))
    stroke(ctx, paint.ink, s * 0.008, 0.6 * line)
    ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(-s * 0.1 + s * 0.2 * line, 0); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* كرةٌ أرضية بخطوطٍ متصلة — للعالمية والتواصل والانتشار. */
  'globe-connect': (ctx, s, t, p, paint) => {
    const g = ease(p)
    const r = s * 0.22
    stroke(ctx, paint.accent2, s * 0.014, g)
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke()
    for (let i = 1; i < 3; i += 1) { stroke(ctx, paint.dim, s * 0.008, 0.5 * g); ctx.beginPath(); ctx.ellipse(0, 0, r * (1 - i * 0.3), r, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r, i * r * 0.4 - r * 0.4); ctx.lineTo(r, i * r * 0.4 - r * 0.4); ctx.stroke() }
    // نقاط اتصال تومض
    const nodes = [[-0.6, -0.3], [0.5, -0.5], [0.7, 0.2], [-0.4, 0.6]]
    const conn = ease(Math.max(0, (p - 0.3) / 0.7))
    nodes.forEach((n, i) => {
      const x = n[0] * r, y = n[1] * r
      stroke(ctx, paint.accent, s * 0.008, conn * 0.7)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke()
      ctx.fillStyle = paint.accent; ctx.globalAlpha = conn * (0.6 + 0.4 * Math.sin(t * 3 + i))
      ctx.beginPath(); ctx.arc(x, y, s * 0.014, 0, TAU); ctx.fill()
    })
    ctx.globalAlpha = 1
  },

  /* شعلةٌ في يدٍ ترفعها — للإلهام والريادة والقيادة. */
  'flame-torch': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.ink, s * 0.018, g)
    ctx.beginPath(); ctx.moveTo(0, s * 0.26); ctx.lineTo(0, -s * 0.02); ctx.stroke()
    const flick = Math.sin(t * 8) * s * 0.01
    const flame = ease(Math.min(1, p * 1.5))
    ctx.globalAlpha = flame
    const grad = ctx.createRadialGradient(flick, -s * 0.14, 0, 0, -s * 0.1, s * 0.16)
    grad.addColorStop(0, paint.accent); grad.addColorStop(0.6, paint.danger + 'aa'); grad.addColorStop(1, paint.danger + '00')
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.quadraticCurveTo(-s * 0.08, -s * 0.12, flick, -s * 0.26); ctx.quadraticCurveTo(s * 0.08, -s * 0.12, 0, -s * 0.02); ctx.fill()
    ctx.shadowColor = paint.accent; ctx.shadowBlur = s * 0.1 * flame
    ctx.fillStyle = paint.accent; ctx.beginPath(); ctx.arc(flick * 0.5, -s * 0.1, s * 0.02, 0, TAU); ctx.fill()
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
  },

  /* كفّان: واحدة دافئة وواحدة معدنية تتوازنان — لأطروحة الإنسان قبل الآلة. */
  'balance-human-machine': (ctx, s, t, p, paint) => {
    const g = ease(p)
    const tilt = Math.sin(t * 1.2) * (1 - ease(Math.min(1, p * 1.4))) * 0.14
    stroke(ctx, paint.dim, s * 0.016, 0.8 * g)
    ctx.beginPath(); ctx.moveTo(0, s * 0.24); ctx.lineTo(0, -s * 0.22); ctx.stroke()
    ctx.save(); ctx.translate(0, -s * 0.22); ctx.rotate(tilt)
    stroke(ctx, paint.ink, s * 0.016, g); ctx.beginPath(); ctx.moveTo(-s * 0.26, 0); ctx.lineTo(s * 0.26, 0); ctx.stroke()
    // كفة الإنسان (قلب)
    ctx.fillStyle = paint.accent; ctx.globalAlpha = g
    ctx.beginPath(); ctx.moveTo(-s * 0.26, s * 0.1); ctx.bezierCurveTo(-s * 0.32, s * 0.04, -s * 0.28, s * 0.02, -s * 0.26, s * 0.06); ctx.bezierCurveTo(-s * 0.24, s * 0.02, -s * 0.2, s * 0.04, -s * 0.26, s * 0.1); ctx.fill()
    // كفة الآلة (مربع/شبكة)
    stroke(ctx, paint.accent2, s * 0.012, g)
    ctx.strokeRect(s * 0.2, s * 0.03, s * 0.1, s * 0.1)
    ctx.beginPath(); ctx.moveTo(s * 0.25, s * 0.03); ctx.lineTo(s * 0.25, s * 0.13); ctx.moveTo(s * 0.2, s * 0.08); ctx.lineTo(s * 0.3, s * 0.08); ctx.stroke()
    ctx.restore(); ctx.globalAlpha = 1
  },

  /* يدٌ تحتضن برعماً — للرعاية والتربية والنمو الإنساني. */
  'sprout-hand': (ctx, s, t, p, paint) => {
    const g = ease(p)
    // كفّ مقعّرة
    stroke(ctx, paint.ink, s * 0.016, g)
    ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke()
    // برعم ينمو
    const grow = ease(Math.max(0, (p - 0.2) / 0.8))
    stroke(ctx, paint.accent2, s * 0.016, grow)
    ctx.beginPath(); ctx.moveTo(0, s * 0.02); ctx.lineTo(0, s * 0.02 - s * 0.24 * grow); ctx.stroke()
    if (grow > 0.4) {
      const leaf = ease((grow - 0.4) / 0.6)
      ctx.fillStyle = paint.accent; ctx.globalAlpha = leaf
      for (const dir of [-1, 1]) { ctx.beginPath(); ctx.ellipse(dir * s * 0.05 * leaf, s * 0.02 - s * 0.18, s * 0.06 * leaf, s * 0.026, dir * 0.6, 0, TAU); ctx.fill() }
    }
    ctx.globalAlpha = 1
  },

  /* ساعةٌ تروسها تدور — للوقت والإدارة والكفاءة. */
  'clock-gears': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.accent2, s * 0.016, g)
    ctx.beginPath(); ctx.arc(0, 0, s * 0.24, 0, TAU); ctx.stroke()
    for (let i = 0; i < 12; i += 1) { const a = (i / 12) * TAU; stroke(ctx, paint.dim, s * 0.006, 0.6 * g); ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22); ctx.lineTo(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24); ctx.stroke() }
    stroke(ctx, paint.accent, s * 0.016, 1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 1.2 - Math.PI / 2) * s * 0.12, Math.sin(t * 1.2 - Math.PI / 2) * s * 0.12); ctx.stroke()
    stroke(ctx, paint.ink, s * 0.02, 1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 0.1 - Math.PI / 2) * s * 0.16, Math.sin(t * 0.1 - Math.PI / 2) * s * 0.16); ctx.stroke()
    ctx.fillStyle = paint.accent; ctx.beginPath(); ctx.arc(0, 0, s * 0.02, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  },


  /* مصباحٌ يُضيء — الفكرة والإلهام والحلّ. */
  lightbulb: (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.accent2, s * 0.012, 0.7 * g)
    for (let i = 0; i < 8; i += 1) { const a = (i / 8) * TAU, r0 = s * 0.2, r1 = s * 0.27 + Math.sin(t * 2 + i) * s * 0.012; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, -s * 0.06 + Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, -s * 0.06 + Math.sin(a) * r1); ctx.stroke() }
    ctx.fillStyle = paint.accent; ctx.globalAlpha = 0.14 * g; ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.15, 0, TAU); ctx.fill(); ctx.globalAlpha = 1
    stroke(ctx, paint.accent, s * 0.02, g); ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.15, 0, TAU); ctx.stroke()
    stroke(ctx, paint.ink, s * 0.012, g); ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.02); ctx.lineTo(-s * 0.02, -s * 0.09); ctx.lineTo(s * 0.02, -s * 0.02); ctx.lineTo(s * 0.05, -s * 0.09); ctx.stroke()
    stroke(ctx, paint.dim, s * 0.016, g); ctx.beginPath(); ctx.moveTo(-s * 0.06, s * 0.1); ctx.lineTo(s * 0.06, s * 0.1); ctx.moveTo(-s * 0.05, s * 0.14); ctx.lineTo(s * 0.05, s * 0.14); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* مغناطيسٌ على شكل حدوة — الجذب والتأثير والدافعية. */
  magnet: (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.accent, s * 0.055, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.16); ctx.lineTo(-s * 0.14, -s * 0.02); ctx.arc(0, -s * 0.02, s * 0.14, Math.PI, 0, false); ctx.lineTo(s * 0.14, s * 0.16); ctx.stroke()
    stroke(ctx, paint.danger, s * 0.055, g); ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.16); ctx.lineTo(-s * 0.14, s * 0.07); ctx.stroke()
    stroke(ctx, paint.ink, s * 0.055, g); ctx.beginPath(); ctx.moveTo(s * 0.14, s * 0.16); ctx.lineTo(s * 0.14, s * 0.07); ctx.stroke()
    stroke(ctx, paint.accent2, s * 0.01, 0.6 * g)
    for (let i = 1; i <= 2; i += 1) { const off = i * s * 0.06; ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.16 - off * 0.2); ctx.quadraticCurveTo(0, s * 0.14 - off - s * 0.08, s * 0.14, s * 0.16 - off * 0.2); ctx.stroke() }
    ctx.globalAlpha = 1
  },

  /* قمعٌ يصفّي الكثرة إلى جوهر — التصفية والتلخيص والانتقاء. */
  funnel: (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.accent, s * 0.018, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.22, -s * 0.16); ctx.lineTo(s * 0.22, -s * 0.16); ctx.lineTo(s * 0.05, s * 0.04); ctx.lineTo(s * 0.05, s * 0.16); ctx.lineTo(-s * 0.05, s * 0.16); ctx.lineTo(-s * 0.05, s * 0.04); ctx.closePath(); ctx.stroke()
    stroke(ctx, paint.dim, s * 0.012, 0.7 * g)
    for (let i = 0; i < 4; i += 1) { const x = -s * 0.16 + i * s * 0.1; ctx.beginPath(); ctx.arc(x, -s * 0.12, s * 0.02, 0, TAU); ctx.stroke() }
    const drop = (t * 0.5) % 1
    ctx.fillStyle = paint.accent2; ctx.globalAlpha = g; ctx.beginPath(); ctx.arc(0, s * 0.16 + drop * s * 0.08, s * 0.022, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* تلسكوبٌ يستشرف البعيد — الرؤية والاستشراف والمستقبل. */
  telescope: (ctx, s, t, p, paint) => {
    const g = ease(p)
    ctx.save(); ctx.rotate(-0.5)
    stroke(ctx, paint.ink, s * 0.05, g); ctx.beginPath(); ctx.moveTo(-s * 0.16, 0); ctx.lineTo(s * 0.14, 0); ctx.stroke()
    stroke(ctx, paint.accent, s * 0.07, g); ctx.beginPath(); ctx.moveTo(s * 0.08, 0); ctx.lineTo(s * 0.2, 0); ctx.stroke()
    ctx.restore()
    stroke(ctx, paint.dim, s * 0.014, g); ctx.beginPath(); ctx.moveTo(-s * 0.06, s * 0.06); ctx.lineTo(-s * 0.12, s * 0.2); ctx.moveTo(-s * 0.02, s * 0.07); ctx.lineTo(s * 0.04, s * 0.2); ctx.stroke()
    stroke(ctx, paint.accent2, s * 0.01, 0.7 * g)
    for (let i = 0; i < 3; i += 1) { const a = -0.9 + i * 0.25, r = s * 0.24 + i * s * 0.03; ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.09, r, a - 0.12, a + 0.12); ctx.stroke() }
    ctx.globalAlpha = 1
  },

  /* بصمةٌ — الهوية والخصوصية والتفرّد. */
  fingerprint: (ctx, s, t, p, paint) => {
    const g = ease(p)
    for (let i = 0; i < 5; i += 1) {
      const rr = s * (0.06 + i * 0.038)
      stroke(ctx, i % 2 ? paint.accent : paint.ink, s * 0.012, (0.5 + i * 0.1) * g)
      ctx.beginPath(); ctx.arc(0, 0, rr, Math.PI * 0.15, Math.PI * 1.75); ctx.stroke()
    }
    stroke(ctx, paint.accent2, s * 0.012, g); ctx.beginPath(); ctx.arc(0, 0, s * 0.024, 0, TAU); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* مصافحةٌ — الاتفاق والشراكة والثقة. */
  handshake: (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.accent, s * 0.05, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.02); ctx.lineTo(-s * 0.04, s * 0.06); ctx.stroke()
    stroke(ctx, paint.ink, s * 0.05, g)
    ctx.beginPath(); ctx.moveTo(s * 0.24, -s * 0.02); ctx.lineTo(s * 0.04, s * 0.06); ctx.stroke()
    ctx.fillStyle = paint.accent2; ctx.globalAlpha = g; ctx.beginPath(); ctx.arc(0, s * 0.055, s * 0.055, 0, TAU); ctx.fill(); ctx.globalAlpha = 1
    stroke(ctx, paint.accent2, s * 0.01, 0.6 * g)
    for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.moveTo(i * s * 0.05, -s * 0.06); ctx.lineTo(i * s * 0.07, -s * 0.12); ctx.stroke() }
    ctx.globalAlpha = 1
  },

  /* كومةُ كتب — المعرفة المتراكمة والمرجعية والعمق. */
  'book-stack': (ctx, s, t, p, paint) => {
    const g = ease(p)
    const cols = [paint.accent, paint.ink, paint.accent2]
    for (let i = 0; i < 3; i += 1) {
      const y = s * 0.14 - i * s * 0.11, w = s * (0.34 - i * 0.03), off = (i % 2 ? 1 : -1) * s * 0.02
      const rise = ease(Math.max(0, (p - i * 0.18) / 0.5))
      stroke(ctx, cols[i], s * 0.014, rise)
      ctx.beginPath(); ctx.rect(-w / 2 + off, y - s * 0.08 * rise, w, s * 0.08 * rise); ctx.stroke()
      stroke(ctx, paint.dim, s * 0.008, 0.6 * rise); ctx.beginPath(); ctx.moveTo(-w / 2 + off + s * 0.03, y - s * 0.04 * rise); ctx.lineTo(w / 2 + off - s * 0.03, y - s * 0.04 * rise); ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* قبعةُ تخرّج — التعليم والإنجاز والكفاءة. */
  'graduation-cap': (ctx, s, t, p, paint) => {
    const g = ease(p)
    ctx.fillStyle = paint.ink; ctx.globalAlpha = g
    ctx.beginPath(); ctx.moveTo(0, -s * 0.14); ctx.lineTo(s * 0.26, -s * 0.02); ctx.lineTo(0, s * 0.1); ctx.lineTo(-s * 0.26, -s * 0.02); ctx.closePath(); ctx.fill()
    ctx.globalAlpha = 1
    stroke(ctx, paint.accent, s * 0.016, g); ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.02); ctx.lineTo(-s * 0.14, s * 0.13); ctx.quadraticCurveTo(0, s * 0.2, s * 0.14, s * 0.13); ctx.lineTo(s * 0.14, s * 0.02); ctx.stroke()
    stroke(ctx, paint.accent2, s * 0.012, g); ctx.beginPath(); ctx.moveTo(s * 0.26, -s * 0.02); ctx.lineTo(s * 0.26, s * 0.1); ctx.stroke()
    ctx.fillStyle = paint.accent2; ctx.beginPath(); ctx.arc(s * 0.26, s * 0.12, s * 0.022, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* فقاعتا حوار — النقاش والتواصل والرأي. */
  'speech-bubbles': (ctx, s, t, p, paint) => {
    const g = ease(p)
    const bub = (x: number, y: number, r: number, col: string, a: number) => { stroke(ctx, col, s * 0.016, a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.8); ctx.lineTo(x - r * 0.1, y + r * 1.25); ctx.lineTo(x + r * 0.2, y + r * 0.9); ctx.stroke() }
    bub(-s * 0.1, -s * 0.06, s * 0.14, paint.accent, g)
    bub(s * 0.12, s * 0.02, s * 0.11, paint.accent2, ease(Math.max(0, (p - 0.3) / 0.7)))
    stroke(ctx, paint.ink, s * 0.012, 0.7 * g)
    for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.arc(-s * 0.1 + i * s * 0.05, -s * 0.06, s * 0.012, 0, TAU); ctx.stroke() }
    ctx.globalAlpha = 1
  },

  /* شجرةٌ تنمو — النموّ والتجذّر والثمر. */
  'tree-grow': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.ink, s * 0.03, g); ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.lineTo(0, -s * 0.02); ctx.stroke()
    const branch = (ang: number, len: number, depth: number) => { if (depth <= 0) return; const gr = ease(Math.max(0, (p - (3 - depth) * 0.2) / 0.6)); if (gr <= 0) return; ctx.save(); ctx.rotate(ang); stroke(ctx, depth === 3 ? paint.ink : paint.accent, s * 0.012 * depth, gr); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * gr); ctx.stroke(); ctx.translate(0, -len * gr); branch(-0.5, len * 0.7, depth - 1); branch(0.5, len * 0.7, depth - 1); ctx.restore() }
    ctx.save(); ctx.translate(0, -s * 0.02); branch(0, s * 0.14, 3); ctx.restore()
    ctx.fillStyle = paint.accent2; ctx.globalAlpha = 0.16 * g; ctx.beginPath(); ctx.arc(0, -s * 0.16, s * 0.16, 0, TAU); ctx.fill(); ctx.globalAlpha = 1
  },

  /* نهرٌ يجري — التدفّق والاستمرار والمسار. */
  'river-flow': (ctx, s, t, p, paint) => {
    const g = ease(p)
    for (let i = 0; i < 3; i += 1) {
      stroke(ctx, i === 1 ? paint.accent : paint.accent2, s * (0.02 - i * 0.004), (0.5 + (2 - i) * 0.2) * g)
      ctx.beginPath()
      for (let x = -0.26; x <= 0.26; x += 0.02) { const y = Math.sin(x * 10 + t + i) * s * 0.05 + (i - 1) * s * 0.03; const px = x * s; if (x === -0.26) ctx.moveTo(px, y); else ctx.lineTo(px, y) }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  /* لانهاية — الاستمرارية والدورة والترابط. */
  'infinity-loop': (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.accent, s * 0.02, g)
    ctx.beginPath()
    for (let i = 0; i <= 60; i += 1) { const a = (i / 60) * TAU, x = Math.sin(a) * s * 0.22, y = Math.sin(a * 2) * s * 0.11; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) }
    ctx.stroke()
    const a = (t * 0.6) % TAU
    ctx.fillStyle = paint.accent2; ctx.globalAlpha = g; ctx.beginPath(); ctx.arc(Math.sin(a) * s * 0.22, Math.sin(a * 2) * s * 0.11, s * 0.03, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* صاروخٌ ينطلق — الانطلاق والتسارع والطموح. */
  rocket: (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.ink, s * 0.018, g)
    ctx.beginPath(); ctx.moveTo(0, -s * 0.22); ctx.quadraticCurveTo(s * 0.1, -s * 0.05, s * 0.08, s * 0.08); ctx.lineTo(-s * 0.08, s * 0.08); ctx.quadraticCurveTo(-s * 0.1, -s * 0.05, 0, -s * 0.22); ctx.stroke()
    stroke(ctx, paint.accent, s * 0.014, g); ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.04, 0, TAU); ctx.stroke()
    stroke(ctx, paint.accent2, s * 0.014, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.02); ctx.lineTo(-s * 0.16, s * 0.12); ctx.lineTo(-s * 0.08, s * 0.08); ctx.moveTo(s * 0.08, s * 0.02); ctx.lineTo(s * 0.16, s * 0.12); ctx.lineTo(s * 0.08, s * 0.08); ctx.stroke()
    const fl = 0.6 + Math.sin(t * 8) * 0.4
    ctx.fillStyle = paint.danger; ctx.globalAlpha = g; ctx.beginPath(); ctx.moveTo(-s * 0.05, s * 0.09); ctx.lineTo(0, s * 0.09 + s * 0.12 * fl); ctx.lineTo(s * 0.05, s * 0.09); ctx.closePath(); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* هرمٌ — التراتب والأساس المتين والبناء. */
  pyramid: (ctx, s, t, p, paint) => {
    const g = ease(p)
    const cols = [paint.accent, paint.ink, paint.accent2]
    for (let i = 0; i < 3; i += 1) {
      const rise = ease(Math.max(0, (p - (2 - i) * 0.2) / 0.6)); if (rise <= 0) continue
      const yTop = s * 0.16 - (i + 1) * s * 0.1, yBot = s * 0.16 - i * s * 0.1
      const wTop = (i + 1) * s * 0.08, wBot = i * s * 0.08
      stroke(ctx, cols[i], s * 0.012, rise)
      ctx.beginPath(); ctx.moveTo(-wBot, yBot); ctx.lineTo(-wTop, yTop); ctx.lineTo(wTop, yTop); ctx.lineTo(wBot, yBot); ctx.stroke()
    }
    stroke(ctx, paint.accent2, s * 0.014, g); ctx.beginPath(); ctx.moveTo(-s * 0.24, s * 0.16); ctx.lineTo(s * 0.24, s * 0.16); ctx.stroke()
    ctx.globalAlpha = 1
  },

  /* حلزونٌ — التطوّر التدريجي والتعمّق. */
  spiral: (ctx, s, t, p, paint) => {
    const turns = 3.2, g = ease(p)
    stroke(ctx, paint.accent, s * 0.016, g)
    ctx.beginPath()
    const N = Math.floor(90 * g)
    for (let i = 0; i <= N; i += 1) { const f = i / 90, a = f * turns * TAU + t * 0.3, r = f * s * 0.24; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) }
    ctx.stroke()
    ctx.fillStyle = paint.accent2; ctx.globalAlpha = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.024, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* ذرّةٌ — العلم والبنية والطاقة. */
  atom: (ctx, s, t, p, paint) => {
    const g = ease(p)
    for (let i = 0; i < 3; i += 1) {
      ctx.save(); ctx.rotate((i / 3) * Math.PI)
      stroke(ctx, paint.accent, s * 0.012, 0.8 * g)
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.24, s * 0.09, 0, 0, TAU); ctx.stroke()
      const a = t * 1.6 + i * 2.1
      ctx.fillStyle = paint.accent2; ctx.globalAlpha = g; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.09, s * 0.022, 0, TAU); ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = paint.ink; ctx.globalAlpha = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.04, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* مجهرٌ — البحث والتدقيق والملاحظة الدقيقة. */
  microscope: (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.ink, s * 0.02, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.02, -s * 0.18); ctx.lineTo(s * 0.08, -s * 0.02); ctx.stroke()
    stroke(ctx, paint.accent, s * 0.03, g); ctx.beginPath(); ctx.arc(-s * 0.02, -s * 0.18, s * 0.03, 0, TAU); ctx.stroke()
    stroke(ctx, paint.ink, s * 0.016, g); ctx.beginPath(); ctx.moveTo(s * 0.02, -s * 0.08); ctx.lineTo(-s * 0.06, s * 0.08); ctx.stroke()
    stroke(ctx, paint.accent2, s * 0.018, g); ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 0.16); ctx.lineTo(s * 0.14, s * 0.16); ctx.stroke()
    stroke(ctx, paint.ink, s * 0.014, g); ctx.beginPath(); ctx.moveTo(-s * 0.06, s * 0.08); ctx.lineTo(-s * 0.02, s * 0.16); ctx.stroke()
    ctx.fillStyle = paint.accent; ctx.globalAlpha = 0.5 * g; ctx.beginPath(); ctx.arc(-s * 0.02, s * 0.13, s * 0.02, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* حلزونٌ وراثي — الأصل والتكوين والتوريث. */
  'dna-helix': (ctx, s, t, p, paint) => {
    const g = ease(p)
    const N = 10
    for (let i = 0; i <= N; i += 1) {
      const f = i / N, y = (f - 0.5) * s * 0.44, a = f * TAU * 1.6 + t
      const x1 = Math.cos(a) * s * 0.14, x2 = Math.cos(a + Math.PI) * s * 0.14
      const app = ease(Math.max(0, (p - f * 0.4)))
      if (app <= 0) continue
      stroke(ctx, paint.dim, s * 0.008, 0.5 * app); ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
      ctx.fillStyle = paint.accent; ctx.globalAlpha = app; ctx.beginPath(); ctx.arc(x1, y, s * 0.02, 0, TAU); ctx.fill()
      ctx.fillStyle = paint.accent2; ctx.beginPath(); ctx.arc(x2, y, s * 0.02, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  /* فانوسٌ — الهداية والتراث والنور في العتمة. */
  lantern: (ctx, s, t, p, paint) => {
    const g = ease(p)
    ctx.fillStyle = paint.accent; ctx.globalAlpha = 0.16 * g; ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1
    stroke(ctx, paint.ink, s * 0.016, g)
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.1); ctx.lineTo(s * 0.1, -s * 0.1); ctx.lineTo(s * 0.12, s * 0.12); ctx.lineTo(-s * 0.12, s * 0.12); ctx.closePath(); ctx.stroke()
    stroke(ctx, paint.dim, s * 0.014, g); ctx.beginPath(); ctx.moveTo(-s * 0.13, s * 0.12); ctx.lineTo(s * 0.13, s * 0.12); ctx.moveTo(-s * 0.07, -s * 0.1); ctx.lineTo(-s * 0.07, -s * 0.16); ctx.lineTo(s * 0.07, -s * 0.16); ctx.lineTo(s * 0.07, -s * 0.1); ctx.stroke()
    const fl = 0.7 + Math.sin(t * 6) * 0.3
    ctx.fillStyle = paint.danger; ctx.globalAlpha = g; ctx.beginPath(); ctx.moveTo(0, s * 0.06); ctx.quadraticCurveTo(s * 0.04, -s * 0.02, 0, -s * 0.06 * fl); ctx.quadraticCurveTo(-s * 0.04, -s * 0.02, 0, s * 0.06); ctx.fill()
    ctx.globalAlpha = 1
  },

  /* لافتةُ اتجاه — القرار والتوجيه ووضوح المسار. */
  signpost: (ctx, s, t, p, paint) => {
    const g = ease(p)
    stroke(ctx, paint.ink, s * 0.022, g); ctx.beginPath(); ctx.moveTo(0, s * 0.22); ctx.lineTo(0, -s * 0.16); ctx.stroke()
    const board = (y: number, dir: number, col: string, a: number) => { const w = s * 0.24; ctx.fillStyle = col; ctx.globalAlpha = 0.85 * a; ctx.beginPath(); if (dir > 0) { ctx.moveTo(-s * 0.02, y - s * 0.05); ctx.lineTo(w * 0.7, y - s * 0.05); ctx.lineTo(w * 0.85, y); ctx.lineTo(w * 0.7, y + s * 0.05); ctx.lineTo(-s * 0.02, y + s * 0.05); } else { ctx.moveTo(s * 0.02, y - s * 0.05); ctx.lineTo(-w * 0.7, y - s * 0.05); ctx.lineTo(-w * 0.85, y); ctx.lineTo(-w * 0.7, y + s * 0.05); ctx.lineTo(s * 0.02, y + s * 0.05); } ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1 }
    board(-s * 0.08, 1, paint.accent, g)
    board(s * 0.04, -1, paint.accent2, ease(Math.max(0, (p - 0.3) / 0.7)))
    ctx.globalAlpha = 1
  },
}

/** يرسم استعارةً في المركز المعطى. */
/* استعارات لا تُقلب أفقياً: النص/الاتجاه فيها يفقد معناه لو انعكس. */
const NO_MIRROR = new Set<MetaphorId>(['teacher-students', 'hand-write', 'open-book', 'chart-rise', 'quote-marks', 'stairs', 'figure-climb', 'clock-gears'])

/**
 * طبقة التوليد الاحتمالي: كل استعارة عائلةٌ من الأشكال لا شكلٌ واحد.
 * البذرة تختار — بحتميةٍ — انعكاساً أفقياً، ودورةً طفيفة، وتبديلاً لدور
 * لوني التوكيد، وتحجيماً خفيفاً، وإزاحةً صغيرة. فيتضاعف كل رسمٍ إلى عشرات
 * الأشكال المتمايزة بلا مساسٍ بمقروئيته — وهكذا تبلغ المكتبةُ الفعلية عشراتِ
 * الآلاف من الصور دون رسم كلٍّ منها باليد.
 */
function variationTransform(variation: number, id: MetaphorId, paint: MetaphorPaint): {
  mirror: boolean; rotate: number; scale: number; dx: number; dy: number; paint: MetaphorPaint
} {
  const v = Math.abs(Math.floor(variation))
  const mirror = !NO_MIRROR.has(id) && (v & 1) === 1
  const rotate = (((v >> 1) % 5) - 2) * 0.035          // ±0.07 راديان — ميلٌ خفيف
  const scale = 0.94 + ((v >> 3) % 5) * 0.025           // 0.94 → 1.04
  const dx = (((v >> 5) % 3) - 1) * 0.03                // إزاحة أفقية طفيفة (نسبة للحجم)
  const dy = (((v >> 6) % 3) - 1) * 0.02
  /* تبديل دور لوني التوكيد أحياناً — يمنح الشكل مزاجاً لونياً جديداً. */
  const swap = ((v >> 7) & 1) === 1
  const nextPaint = swap ? { ...paint, accent: paint.accent2, accent2: paint.accent } : paint
  return { mirror, rotate, scale, dx, dy, paint: nextPaint }
}

export function paintMetaphor(
  ctx: CanvasRenderingContext2D,
  id: MetaphorId,
  cx: number,
  cy: number,
  size: number,
  t: number,
  progress: number,
  paint: MetaphorPaint,
  variation = 0,
) {
  const painter = PAINTERS[id]
  if (!painter) return
  const v = variationTransform(variation, id, paint)
  ctx.save()
  ctx.translate(cx + v.dx * size, cy + v.dy * size)
  ctx.scale(v.mirror ? -v.scale : v.scale, v.scale)
  ctx.rotate(v.rotate)
  painter(ctx, size, t, progress, v.paint)
  ctx.restore()
  ctx.globalAlpha = 1
}

export const METAPHOR_IDS = Object.keys(PAINTERS) as MetaphorId[]

/**
 * يختار الاستعارة من «المشاهد البصرية» المكتوبة في المعجم — لا من ذوقٍ عام.
 * نقرأ نصّ المشاهد وأسماء المفاهيم، ونطابقها بمفردات كل استعارة.
 */
const METAPHOR_CUES: { id: MetaphorId; cues: RegExp }[] = [
  // الموجة الثانية — مقدَّمة كي تُرجَّح عند وجود مصطلحها الخاص
  { id: 'balance-human-machine', cues: /(الإنسان قبل الآلة|إنسانية الآلة|توازن الإنسان|الإنسان والآلة|يتنازل الإنسان|الآلة والإنسان)/ },
  { id: 'brain-circuit', cues: /(تعلّم آلي|تعلم آلي|شبكة عصبية|ذكاء اصطناعي|نموذج لغوي|خوارزمية تتعلم|عقل رقمي)/ },
  // الموجة الثالثة — رموزٌ جديدة تُرجَّح عند مصطلحها الخاص
  { id: 'lightbulb', cues: /(فكرة|إلهام|ابتكار|إبداع|حلّ|ومضة|بصيرة)/ },
  { id: 'rocket', cues: /(انطلاق|تسارع|إطلاق|طموح|قفزة|نهضة|تسريع)/ },
  { id: 'tree-grow', cues: /(نموّ|نمو|تجذّر|ازدهار|ثمر|رعاية|تنمية)/ },
  { id: 'graduation-cap', cues: /(تخرّج|تعلّم|تعليم|كفاءة|شهادة|إتقان|مهارة)/ },
  { id: 'microscope', cues: /(بحث علمي|تدقيق|فحص|ملاحظة|منهج|دقّة|تمحيص)/ },
  { id: 'telescope', cues: /(استشراف|رؤية مستقبلية|المستقبل|أفق|تنبّؤ|بُعد النظر)/ },
  { id: 'handshake', cues: /(اتفاق|شراكة|تعاون|توافق|تحالف|ثقة متبادلة)/ },
  { id: 'speech-bubbles', cues: /(حوار|نقاش|تواصل|مناظرة|رأي|أخذ وردّ)/ },
  { id: 'signpost', cues: /(قرار|توجيه|اتجاه|اختيار مسار|بوصلة القرار|وجهة)/ },
  { id: 'funnel', cues: /(تصفية|تلخيص|انتقاء|تقطير|جوهر|خلاصة)/ },
  { id: 'fingerprint', cues: /(هوية|خصوصية|بصمة|تفرّد|أصالة شخصية)/ },
  { id: 'atom', cues: /(علم|فيزياء|بنية|طاقة|جوهر المادة|أساس علمي)/ },
  { id: 'infinity-loop', cues: /(استمرارية|دورة|لا نهاية|تكرار|دوام|حلقة)/ },
  { id: 'dna-helix', cues: /(أصل|تكوين|توريث|جينات|شيفرة|تركيبة)/ },
  { id: 'book-stack', cues: /(معرفة متراكمة|مرجع|مصادر|قراءة|مكتبة|اطّلاع)/ },
  { id: 'lantern', cues: /(هداية|تراث|نور|إرشاد|ضياء|منارة)/ },
  { id: 'data-flow', cues: /(بيانات|تدفّق|تدفق|معالجة|بيانات ضخمة|تحليل بيانات|قاعدة بيانات|معلومات)/ },
  { id: 'vr-portal', cues: /(واقع افتراضي|واقع معزز|بيئة غامرة|ميتافيرس|عالم افتراضي|محاكاة|غامر)/ },
  { id: 'megaphone', cues: /(إعلام|رسالة|صوت|منبر|خطاب|دعوة|نشر|تأثير إعلامي|رأي عام)/ },
  { id: 'shield-check', cues: /(أمن|حماية|خصوصية|أمان|موثوق|تحقق|سلامة|درع|صلاحية)/ },
  { id: 'puzzle-fit', cues: /(تكامل|انسجام|قطعة ناقصة|يكتمل|حل|تناسب|ينسجم|اجتماع أجزاء)/ },
  { id: 'target-hit', cues: /(هدف|دقّة|إصابة|تركيز|غاية|يحقق|يصيب|إتقان|مرمى)/ },
  { id: 'gears-turn', cues: /(نظام|منهجية|آلية|تشغيل|بنية عمل|منظومة تعمل|إجراءات|عملية)/ },
  { id: 'heart-pulse', cues: /(صحة نفسية|إنسانية|حياة|مشاعر|وجدان|قلب|نبض|رفاه|توازن نفسي)/ },
  { id: 'chart-rise', cues: /(نمو|ارتفاع|تحسّن|نتائج|تقدّم|أداء|مؤشرات|صعود|إنجاز مقيس)/ },
  { id: 'quote-marks', cues: /(مقولة|حكمة|اقتباس|كلمة|قال|عبارة|قول مأثور|نصيحة)/ },
  { id: 'globe-connect', cues: /(عالمية|تواصل|انتشار|شبكة عالمية|ربط|أممي|كوني|عبر العالم|دولي)/ },
  { id: 'flame-torch', cues: /(إلهام|ريادة|شعلة|قيادة ملهمة|حماس|يقود|نور|طليعة|مبادرة)/ },
  { id: 'sprout-hand', cues: /(رعاية|تربية|احتضان|ينمّي|يرعى|عناية|تنشئة|يحتضن|بذرة إنسان)/ },
  { id: 'clock-gears', cues: /(وقت|إدارة الوقت|كفاءة|تنظيم|جدولة|ساعة|إنتاجية|زمن العمل)/ },
  // مشاهد إنسانية — مقدَّمة في الترتيب كي تُرجَّح حين يذكر النص إنساناً في موقف
  { id: 'figure-contemplate', cues: /(يتأمل|تأمل|يفكر|التفكير|وعي|يتساءل|صمت|يتوقف ليفكر|في داخله|نفسه)/ },
  { id: 'group-idea', cues: /(فريق|جماعة|اجتماع|نقاش|حوار جماعي|عصف ذهني|ولادة فكرة|حولها|معاً|زملاء)/ },
  { id: 'teacher-students', cues: /(معلّم|معلم|مدرّس|صف|طلاب|طالب|حصة|تدريس|فصل دراسي|سبورة|تلاميذ)/ },
  { id: 'child-screen', cues: /(طفل|أطفال|شاشة|جهاز|هاتف|مقطع|ريل|إدمان|طفولة رقمية)/ },
  { id: 'hand-write', cues: /(يكتب|الكتابة|قلم|مقال|تدوين|يؤلف|كاتب|صحيفة|يسطر)/ },
  { id: 'figure-climb', cues: /(طموح|يصعد|صعود|كفاح|مثابرة|يسعى|إنجاز|يرتقي|يجتهد)/ },
  { id: 'two-facing', cues: /(اختلاف|رأيان|حوار|نقاش بين|تفاهم|وجهتا نظر|طرفان|جدل|مقابل)/ },
  { id: 'crowd-scatter', cues: /(ضجيج|زحام|قطيع|تفرّق|يتفرق|ثبات|يبقى وحده|صخب|ضوضاء|جموع)/ },
  { id: 'figure-crossroads', cues: /(مفترق|قرار مصيري|اختيار صعب|أمام طريقين|حيرة|يقرر مصير)/ },
  // استعارات مشهدية
  { id: 'open-door', cues: /(فرصة|باب|انفتاح|بداية جديدة|مدخل|يفتح|عتبة|فرص)/ },
  { id: 'mirror', cues: /(مرآة|ذات|نفسه|مراجعة الذات|يرى نفسه|صورته|وعي بالذات)/ },
  { id: 'mask-face', cues: /(قناع|تصنّع|زيف|ظاهر|حقيقة مخفية|ينجح لكن|تظاهر|مجاملة|خلف الوجه)/ },
  { id: 'mountain-peak', cues: /(قمّة|جبل|تحدٍّ|ذروة|إنجاز كبير|يتسلق|هدف بعيد|صعوبة)/ },
  { id: 'horizon-sun', cues: /(أمل|شروق|فجر|بداية|تجدّد|غد|إشراق|مستقبل مشرق|عام جديد)/ },
  { id: 'open-book', cues: /(كتاب|قراءة|معرفة|صفحة|علم|مؤلَّف|موسوعة|مطالعة|تأليف)/ },
  { id: 'spotlight', cues: /(تركيز|ضوء|يكشف|انتباه|تسليط|بروز|في دائرة الضوء|يُبرز)/ },
  { id: 'anchor', cues: /(ثبات|أصالة|جذر|رسوخ|مبدأ|لا يتزحزح|ركيزة|صمود|ثابت)/ },
  { id: 'thread-cut', cues: /(حسم|قطيعة|فصل|يقطع|انفصال|نهاية علاقة|بتر|حدّ فاصل)/ },
  { id: 'wave-break', cues: /(تحوّل|أزمة|انعطاف|موجة|انكسار|لحظة فارقة|منعطف|عاصفة)/ },
  { id: 'maze', cues: /(تعقيد|حيرة|متاهة|تخبّط|يبحث عن مخرج|ضياع|طريق مسدود|يهتدي)/ },
  { id: 'network-grow', cues: /(نمو مؤسسي|توسّع|تحوّل رقمي|شبكة تنمو|انتشار مؤسسة|بنية تتوسع|تطوير)/ },
  // رموز مجرّدة
  { id: 'bridge', cues: /(جسر|يربط|الربط|مسافة|بُعد|وصل|تواصل|دمج|بين مكانين|مكانين)/ },
  { id: 'roots', cues: /(جذور|هوية|انتماء|أصل|تراث|ثقاف|نشأة|منبت)/ },
  { id: 'orbit-loop', cues: /(دورة|حلقة|تكرار|مراجعة|تغذية راجعة|دوّار|مستمر|دائري)/ },
  { id: 'weave', cues: /(نسيج|تشاب|تكامل|بنية|منظومة|ترابط|شبكة معرف|تصميم تعليمي)/ },
  { id: 'scale', cues: /(توازن|ميزان|عدل|حوكمة|مساءلة|تقويم|قياس|معايير|مفاضلة)/ },
  { id: 'seed', cues: /(بذرة|ينمو|يتشكل|نشء|رعاية|براعم|إنبات)/ },
  { id: 'dissolving-grid', cues: /(ذكاء اصطناعي|ذكائنا|خوارزم|آلة|أتمتة|بيانات ضخمة|روبوت|رقمنة|تنازل)/ },
  { id: 'compass', cues: /(اتجاه|رؤية|قيادة|بوصلة|توجيه|استراتيج|مسار واضح)/ },
  { id: 'stairs', cues: /(مراحل|مستوى|مهارة|إتقان|سلّم|تدرّج|تدرج)/ },
  { id: 'lens', cues: /(تقص|تحليل|تدقيق|فحص|ملاحظة|دقّة|دقة|بحث علمي)/ },
  { id: 'hourglass', cues: /(وقت|زمن|تأجيل|سرعة|بطء|مهلة|انتظار|عمر)/ },
  { id: 'branching-path', cues: /(بديل|طريقان|تفرّع|تفرع|إمّا)/ },
  { id: 'signal-bars', cues: /(بيانات|مؤشر|نتائج|إحصاء|قياس أداء|نسبة|تحسّن|تحسن)/ },
  { id: 'lock-key', cues: /(خصوصية|أمن|سرية|صلاحيات|اختراق|بيانات الطلبة|أخلاقيات)/ },
  { id: 'constellation', cues: /(أطلس|معرفة مترابطة|كوكبة|نجوم|روابط معرفية)/ },
  { id: 'ripple', cues: /(صدى|تأثير يمتد|يتسع|ينتقل الأثر)/ },
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
