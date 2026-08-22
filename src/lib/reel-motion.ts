/**
 * محرّك الريل السينمائي — يرسم خطة المشاهد على Canvas بمقاس 1080×1920،
 * يؤلّف موسيقى المشهد داخل المتصفح (WebAudio — بلا أي خدمة خارجية)،
 * ويسجّل الصورة والصوت معاً عبر MediaRecorder ملفَّ فيديو جاهزاً للنشر.
 *
 * الجمال هنا صناعة لا صدفة: كشف الكتابة يجري من اليمين كما يكتب القلم،
 * والمشاهد تتعانق بتلاشٍ قصير بدل القطع، والحبيبات والإظلام الطرفي
 * يمنحان الصورة ملمس الفيلم، وكل قالب يحمل زخارفه وضرباته الصوتية.
 */

import type { ReelPlan, ReelScene, ReelMotifId, ReelWorld } from './reel-scenes'
import { mulberry } from './reel-scenes'
import { paintMetaphor } from './reel-metaphors'

export const REEL_WIDTH = 1080
export const REEL_HEIGHT = 1920
const FPS = 30
const CROSS_FADE = 0.35

/* ------------------------------- دعم المتصفح ------------------------------- */

function pickReelMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export function reelExportSupported(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && typeof AudioContext !== 'undefined'
    && Boolean(pickReelMime())
}

/** خط الاستوديو مع بدائل صريحة — السقوط الصامت لخط النظام ممنوع. */
const DISPLAY_FONT = '"El Messiri", "Tajawal", serif'
const BODY_FONT = '"Tajawal", "El Messiri", sans-serif'

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  try {
    /* خط الموقع الجميل شرط لا تحسين: إن لم يكن El Messiri حاضراً
       نحقن ورقة خطوط الموقع نفسها (/fonts/fonts.css) ثم ننتظر التحميل. */
    if (!document.fonts.check('700 20px "El Messiri"') && !document.querySelector('link[data-reel-fonts]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/fonts/fonts.css'
      link.setAttribute('data-reel-fonts', '1')
      document.head.appendChild(link)
      await new Promise<void>((resolve) => {
        link.onload = () => resolve()
        link.onerror = () => resolve()
        window.setTimeout(resolve, 1500)
      })
    }
    await Promise.all([
      document.fonts.load('700 90px "El Messiri"', 'الإنسان قبل الآلة'),
      document.fonts.load('400 48px "El Messiri"', 'مشهد'),
      document.fonts.load(`700 40px ${BODY_FONT}`, 'LIVE'),
    ])
    await document.fonts.ready
  } catch {
    /* الخطوط المضمنة في الموقع ستُحمَّل من CSS على أي حال. */
  }
}

/* ------------------------------- عناصر الرسم ------------------------------- */

interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; ph: number; c: number; word?: string }

interface Stage {
  plan: ReelPlan
  random: () => number
  dust: Particle[]
  words: Particle[]
  confetti: Particle[]
  grain: HTMLCanvasElement[]
  bg: HTMLCanvasElement
  vignette: HTMLCanvasElement
}

function offscreen(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر تجهيز لوحة الرسم')
  return { canvas, ctx }
}

function buildStage(plan: ReelPlan): Stage {
  const random = mulberry(plan.seed ^ 0x5eed)
  const world = plan.world

  const { canvas: bg, ctx: bgc } = offscreen(REEL_WIDTH, REEL_HEIGHT)
  const sky = bgc.createLinearGradient(0, 0, 0, REEL_HEIGHT)
  sky.addColorStop(0, world.bgTop)
  sky.addColorStop(0.55, world.bgMid)
  sky.addColorStop(1, world.bgBottom)
  bgc.fillStyle = sky
  bgc.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT)
  const glow = bgc.createRadialGradient(REEL_WIDTH * 0.5, REEL_HEIGHT * 0.3, 0, REEL_WIDTH * 0.5, REEL_HEIGHT * 0.3, REEL_HEIGHT * 0.62)
  glow.addColorStop(0, world.glow + (world.scheme === 'light' ? 'e6' : '66'))
  glow.addColorStop(1, world.glow + '00')
  bgc.fillStyle = glow
  bgc.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT)

  const { canvas: vignette, ctx: vgc } = offscreen(REEL_WIDTH, REEL_HEIGHT)
  const edge = vgc.createRadialGradient(REEL_WIDTH / 2, REEL_HEIGHT / 2, REEL_HEIGHT * 0.3, REEL_WIDTH / 2, REEL_HEIGHT / 2, REEL_HEIGHT * 0.74)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(1, world.scheme === 'light' ? 'rgba(64,44,16,0.32)' : 'rgba(0,0,0,0.52)')
  vgc.fillStyle = edge
  vgc.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT)

  const grain: HTMLCanvasElement[] = []
  for (let sheet = 0; sheet < 4; sheet += 1) {
    const { canvas: layer, ctx: layerCtx } = offscreen(REEL_WIDTH, REEL_HEIGHT)
    layerCtx.globalAlpha = world.scheme === 'light' ? 0.05 : 0.06
    for (let index = 0; index < 900; index += 1) {
      layerCtx.fillStyle = random() > 0.5 ? '#ffffff' : '#000000'
      layerCtx.fillRect(random() * REEL_WIDTH, random() * REEL_HEIGHT, 1.6, 1.6)
    }
    grain.push(layer)
  }

  const dust: Particle[] = []
  for (let index = 0; index < 120; index += 1) {
    dust.push({ x: random() * REEL_WIDTH, y: random() * REEL_HEIGHT, vx: (random() - 0.5) * 10, vy: -8 - random() * 22, r: 1.5 + random() * 4.5, a: 0.2 + random() * 0.4, ph: random() * 6.28, c: index % 3 })
  }
  const words: Particle[] = plan.noiseWords.slice(0, 9).map((word, index) => ({
    word, x: 90 + random() * (REEL_WIDTH - 180), y: 160 + random() * (REEL_HEIGHT - 460),
    vx: (random() - 0.5) * 12, vy: (random() - 0.5) * 8, r: 46 + (index % 3) * 14, a: 0.10 + random() * 0.10, ph: random() * 6.28, c: index % 2,
  }))
  const confetti: Particle[] = []
  for (let index = 0; index < 110; index += 1) {
    confetti.push({ x: random() * REEL_WIDTH, y: -random() * REEL_HEIGHT, vx: (random() - 0.5) * 14, vy: 30 + random() * 60, r: 3 + random() * 7, a: 0.5 + random() * 0.4, ph: random() * 6.28, c: index % 2 })
  }

  return { plan, random, dust, words, confetti, grain, bg, vignette }
}

/* ------------------------------- نص مكشوف ------------------------------- */

interface LineSprite { canvas: HTMLCanvasElement; width: number; height: number; baseline: number }
const spriteCache = new Map<string, LineSprite>()

function lineSprite(text: string, px: number, color: string, weight = 700, font = DISPLAY_FONT): LineSprite {
  const key = `${text}|${px}|${color}|${weight}|${font}`
  const cached = spriteCache.get(key)
  if (cached) return cached
  const probe = offscreen(8, 8).ctx
  probe.font = `${weight} ${px}px ${font}`
  const metrics = probe.measureText(text)
  const width = Math.ceil(metrics.width) + px
  const height = Math.ceil(px * 1.7)
  const { canvas, ctx } = offscreen(Math.max(8, width), height)
  ctx.font = `${weight} ${px}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, canvas.width / 2, height / 2)
  const sprite = { canvas, width: metrics.width, height, baseline: height / 2 }
  spriteCache.set(key, sprite)
  return sprite
}

interface TextBlockLayout { px: number; lines: string[]; lineHeight: number; height: number }

/** لفّ عربي مقاس فعلياً بالخط النهائي — لا قصّ حروف ولا خروج من إطار 9:16. */
function fitTextBlock(text: string, base: number, maxLines = 3, maxWidth = REEL_WIDTH * 0.84): TextBlockLayout {
  const probe = offscreen(8, 8).ctx
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  for (let px = base; px >= 34; px -= 3) {
    probe.font = `700 ${px}px ${DISPLAY_FONT}`
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (probe.measureText(next).width <= maxWidth || !current) current = next
      else { lines.push(current); current = word }
    }
    if (current) lines.push(current)
    if (lines.length <= maxLines && lines.every((line) => probe.measureText(line).width <= maxWidth)) {
      const lineHeight = px * 1.2
      return { px, lines, lineHeight, height: lines.length * lineHeight }
    }
  }
  /* لا نبتُر النص حتى في الحالة القصوى؛ نزيد الأسطر ويظل كله داخل العرض. */
  const px = 34
  probe.font = `700 ${px}px ${DISPLAY_FONT}`
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (probe.measureText(next).width <= maxWidth || !current) current = next
    else { lines.push(current); current = word }
  }
  if (current) lines.push(current)
  const lineHeight = px * 1.2
  return { px, lines, lineHeight, height: lines.length * lineHeight }
}

/** كشف من اليمين لليسار مع ريشة متوهجة عند جبهة الكتابة. */
function writeLine(ctx: CanvasRenderingContext2D, text: string, px: number, color: string, cy: number, progress: number, glowColor?: string, nib = false) {
  const sprite = lineSprite(text, px, color)
  const full = sprite.canvas.width
  const x0 = (REEL_WIDTH - full) / 2
  const y0 = cy - sprite.height / 2
  const visible = Math.max(0, Math.min(1, progress)) * full
  if (visible <= 1) return
  if (glowColor && progress > 0.1) {
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.shadowColor = glowColor
    ctx.shadowBlur = 34
    ctx.drawImage(sprite.canvas, full - visible, 0, visible, sprite.height, x0 + full - visible, y0, visible, sprite.height)
    ctx.restore()
  }
  ctx.drawImage(sprite.canvas, full - visible, 0, visible, sprite.height, x0 + full - visible, y0, visible, sprite.height)
  if (nib && progress > 0.03 && progress < 0.97) {
    const frontX = x0 + full - visible
    ctx.save()
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(frontX, cy, Math.max(4, px * 0.07), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function writeTextBlock(ctx: CanvasRenderingContext2D, text: string, base: number, color: string, cy: number, progress: number, glowColor?: string, nib = false, maxLines = 3) {
  const block = fitTextBlock(text, base, maxLines)
  const startY = cy - (block.lines.length - 1) * block.lineHeight / 2
  block.lines.forEach((line, index) => {
    const lineStart = index / block.lines.length * 0.34
    const lineProgress = Math.max(0, Math.min(1, (progress - lineStart) / Math.max(0.2, 1 - lineStart)))
    writeLine(ctx, line, block.px, color, startY + index * block.lineHeight, lineProgress, glowColor, nib && index === block.lines.length - 1)
  })
  return block
}

function fadeLine(ctx: CanvasRenderingContext2D, text: string, px: number, color: string, cy: number, alpha: number, weight = 500, font = BODY_FONT, rise = 14) {
  if (alpha <= 0) return
  const probe = offscreen(8, 8).ctx
  let fitted = px
  while (fitted > 22) {
    probe.font = `${weight} ${fitted}px ${font}`
    if (probe.measureText(text).width <= REEL_WIDTH * 0.86) break
    fitted -= 2
  }
  const sprite = lineSprite(text, fitted, color, weight, font)
  ctx.save()
  ctx.globalAlpha = Math.min(1, alpha)
  ctx.drawImage(sprite.canvas, (REEL_WIDTH - sprite.canvas.width) / 2, cy - sprite.height / 2 + (1 - Math.min(1, alpha)) * rise)
  ctx.restore()
}

/* ------------------------------- الزخارف ------------------------------- */

function drawMotifs(ctx: CanvasRenderingContext2D, stage: Stage, motifs: ReelMotifId[], t: number, dt: number, sceneKind: ReelScene['kind'], crisis: number) {
  const world = stage.plan.world
  if (motifs.includes('dust')) {
    for (const p of stage.dust) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.y < -30) { p.y = REEL_HEIGHT + 30; p.x = stage.random() * REEL_WIDTH }
      const alpha = Math.max(0, p.a * (0.5 + 0.5 * Math.sin(t * 1.4 + p.ph))) * (world.scheme === 'light' ? 0.5 : 1)
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.c === 0 ? world.accent : p.c === 1 ? world.ink : world.accent2
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  if (motifs.includes('falling-words') && stage.words.length) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of stage.words) {
      if (crisis > 0.01) { p.vy += 90 * crisis * dt; p.a *= 1 - 0.5 * crisis * dt }
      p.x += p.vx * dt * (1 + crisis * 2)
      p.y += p.vy * dt
      if (p.a <= 0.008 || p.y > REEL_HEIGHT + 60) continue
      ctx.globalAlpha = Math.max(0, p.a)
      ctx.font = `700 ${p.r}px ${DISPLAY_FONT}`
      ctx.fillStyle = p.c === 0 ? world.ink : world.danger
      ctx.fillText(p.word || '', p.x, p.y)
    }
    ctx.globalAlpha = 1
  }
  if (motifs.includes('rings')) {
    const cx = REEL_WIDTH / 2
    const cy = REEL_HEIGHT * 0.4
    const strength = sceneKind === 'shift' ? 1 : 0.4
    for (let ring = 0; ring < 3; ring += 1) {
      const phase = (t * 0.55 + ring / 3) % 1
      const radius = 70 + phase * 470
      const alpha = (1 - phase) * 0.5 * strength
      if (alpha <= 0.01) continue
      ctx.globalAlpha = alpha
      ctx.strokeStyle = sceneKind === 'shift' ? world.danger : world.accent2
      ctx.lineWidth = Math.max(1, 6 * (1 - phase))
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  if (motifs.includes('grid-weave')) {
    const step = 54
    ctx.lineWidth = 1
    for (let x = step; x < REEL_WIDTH; x += step) {
      for (let y = step; y < REEL_HEIGHT; y += step) {
        const near = 1 - Math.min(1, Math.abs(y - REEL_HEIGHT * 0.46) / 300)
        const alpha = (world.scheme === 'light' ? 0.10 : 0.13) * (1 - near * 0.85)
        if (alpha <= 0.012) continue
        const jitter = near * (0.5 + crisis)
        const jx = Math.sin(t * 3 + x * 0.08 + y * 0.05) * 5 * jitter
        const jy = Math.cos(t * 2.5 + y * 0.07) * 5 * jitter
        ctx.globalAlpha = alpha
        ctx.strokeStyle = world.accent2
        ctx.beginPath()
        ctx.moveTo(x + jx - 7, y + jy)
        ctx.lineTo(x + jx + 7, y + jy)
        ctx.moveTo(x + jx, y + jy - 7)
        ctx.lineTo(x + jx, y + jy + 7)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }
  if (motifs.includes('orbit')) {
    const cx = REEL_WIDTH / 2
    const cy = REEL_HEIGHT * 0.4
    const radius = 300
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = world.accent2
    ctx.setLineDash([2, 10])
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    const angle = t * 0.9
    ctx.globalAlpha = 0.9
    ctx.fillStyle = world.accent
    ctx.shadowColor = world.accent
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
  if (motifs.includes('confetti') && sceneKind !== 'close') {
    const gray = crisis
    for (const p of stage.confetti) {
      p.x += p.vx * dt
      p.y += p.vy * dt * (1 + gray)
      if (p.y > REEL_HEIGHT + 20) { p.y = -20; p.x = stage.random() * REEL_WIDTH }
      ctx.globalAlpha = Math.max(0, p.a * (1 - gray * 0.6))
      ctx.fillStyle = gray > 0.4 ? world.dim : p.c === 0 ? world.accent : world.ink
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

/** حقلٌ دلالي يحرك العالم نفسه بحسب فعل الكلمة، لا بحسب اسم القالب فقط. */
function drawSemanticField(ctx: CanvasRenderingContext2D, plan: ReelPlan, progress: number, t: number) {
  const world = plan.world
  const cx = REEL_WIDTH / 2
  const cy = REEL_HEIGHT * 0.46
  const breathe = 0.5 + 0.5 * Math.sin(t * 1.35)
  ctx.save()
  ctx.strokeStyle = world.accent
  ctx.fillStyle = world.accent
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = world.scheme === 'light' ? 0.1 : 0.14
  if (plan.motionVerb === 'root') {
    const grow = Math.min(1, progress * 1.8)
    for (let branch = -4; branch <= 4; branch += 1) {
      ctx.beginPath(); ctx.moveTo(cx, cy + 260); ctx.bezierCurveTo(cx + branch * 25, cy + 330, cx + branch * 58, cy + 410 * grow, cx + branch * 92, cy + 470 * grow); ctx.stroke()
    }
  } else if (plan.motionVerb === 'connect') {
    const nodes = Array.from({ length: 9 }, (_, index) => ({ x: cx + Math.cos(index * 1.7 + t * 0.08) * (190 + (index % 3) * 78), y: cy + Math.sin(index * 1.2) * 330 }))
    nodes.forEach((node, index) => { const other = nodes[(index + 4) % nodes.length]; ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(other.x, other.y); ctx.stroke(); ctx.beginPath(); ctx.arc(node.x, node.y, 5 + breathe * 4, 0, Math.PI * 2); ctx.fill() })
  } else if (plan.motionVerb === 'split') {
    const gap = 18 + progress * 65
    ctx.globalAlpha *= 1.35
    ctx.beginPath(); ctx.moveTo(cx - gap, 300); ctx.lineTo(cx - gap, 1540); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + gap, 300); ctx.lineTo(cx + gap, 1540); ctx.stroke()
  } else if (plan.motionVerb === 'rise') {
    ctx.beginPath(); ctx.moveTo(120, 1400); ctx.bezierCurveTo(340, 1310, 610, 1060 - progress * 80, 940, 570 - progress * 130); ctx.stroke()
  } else if (plan.motionVerb === 'weave') {
    for (let row = 0; row < 7; row += 1) { const y = 530 + row * 125; ctx.beginPath(); ctx.moveTo(80, y); ctx.bezierCurveTo(340, y + Math.sin(t + row) * 34, 740, y - Math.sin(t + row) * 34, 1000, y); ctx.stroke() }
  } else if (plan.motionVerb === 'orbit') {
    for (let ring = 0; ring < 4; ring += 1) { ctx.beginPath(); ctx.ellipse(cx, cy, 130 + ring * 105, 80 + ring * 72, ring * 0.38 + t * 0.018, 0, Math.PI * 2); ctx.stroke() }
  } else if (plan.motionVerb === 'path') {
    ctx.setLineDash([5, 20]); ctx.beginPath(); ctx.moveTo(120, 1400); ctx.bezierCurveTo(350, 420, 690, 1510, 950, 470); ctx.stroke(); ctx.setLineDash([])
  } else if (plan.motionVerb === 'question') {
    ctx.font = `700 520px ${DISPLAY_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('؟', cx, cy)
  } else if (plan.motionVerb === 'balance') {
    ctx.beginPath(); ctx.moveTo(cx, 520); ctx.lineTo(cx, 1360); ctx.moveTo(250, 720); ctx.lineTo(830, 720); ctx.stroke()
    ;[315, 765].forEach((x, index) => { ctx.beginPath(); ctx.arc(x, 930 + (index ? -1 : 1) * Math.sin(t) * 24, 120, 0, Math.PI); ctx.stroke() })
  } else if (plan.motionVerb === 'pulse') {
    for (let ring = 0; ring < 4; ring += 1) { ctx.globalAlpha = (world.scheme === 'light' ? 0.1 : 0.16) * (1 - ring * 0.16); ctx.beginPath(); ctx.arc(cx, cy, 120 + ring * 110 + breathe * 22, 0, Math.PI * 2); ctx.stroke() }
  } else {
    const sweep = (t * 0.12 % 1) * REEL_HEIGHT
    const gradient = ctx.createLinearGradient(0, sweep - 180, 0, sweep + 180)
    gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(0.5, world.accent); gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient; ctx.globalAlpha = 0.08; ctx.fillRect(0, sweep - 180, REEL_WIDTH, 360)
  }
  ctx.restore()
}

/* ------------------------------- رسم المشهد ------------------------------- */

function drawScene(ctx: CanvasRenderingContext2D, stage: Stage, scene: ReelScene, local: number, t: number, dt: number) {
  const plan = stage.plan
  const world = plan.world
  const progress = Math.max(0, Math.min(1, local / scene.seconds))
  const crisis = scene.kind === 'shift' ? Math.min(1, progress * 1.8) : scene.kind === 'truth' || scene.kind === 'close' ? 1 : 0

  drawMotifs(ctx, stage, plan.motifs, t, dt, scene.kind, crisis)
  drawSemanticField(ctx, plan, progress, t)

  const centerY = REEL_HEIGHT * 0.46
  const accentColor = scene.accent ? world.accent : world.ink
  const nib = plan.motifs.includes('ink-nib')

  if (scene.kind === 'signature') {
    const settle = Math.min(1, progress * 1.5)
    ctx.save()
    ctx.globalAlpha = settle
    const scale = 1.22 - 0.22 * (1 - Math.pow(1 - settle, 3))
    ctx.translate(REEL_WIDTH / 2, centerY)
    ctx.scale(scale, scale)
    ctx.translate(-REEL_WIDTH / 2, -centerY)
    writeTextBlock(ctx, scene.line, 92, world.ink, centerY - 30, settle, world.accent, false, 3)
    ctx.restore()
    fadeLine(ctx, plan.footerMark, 36, world.accent, centerY + 150, Math.min(1, (progress - 0.35) * 2.4), 600, DISPLAY_FONT)
  } else if (scene.kind === 'close') {
    fadeLine(ctx, scene.eyebrow || '', 44, world.dim, REEL_HEIGHT * 0.33, Math.min(1, progress * 3))
    writeTextBlock(ctx, scene.line, 78, world.accent, REEL_HEIGHT * 0.43, Math.min(1, progress * 1.6), world.accent, nib, 2)
    fadeLine(ctx, plan.author, 40, world.ink, REEL_HEIGHT * 0.55, Math.min(1, (progress - 0.3) * 2.6), 600, DISPLAY_FONT)
    fadeLine(ctx, plan.site, 36, world.accent, REEL_HEIGHT * 0.61, Math.min(1, (progress - 0.45) * 2.6), 700, BODY_FONT)
    if (progress > 0.55) {
      const pulse = 1 + 0.16 * Math.sin(t * 3.2)
      ctx.globalAlpha = Math.min(1, (progress - 0.55) * 3)
      ctx.fillStyle = world.accent
      ctx.shadowColor = world.accent
      ctx.shadowBlur = 16
      ctx.beginPath()
      ctx.arc(REEL_WIDTH / 2, REEL_HEIGHT * 0.7, 8 * pulse, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }
  } else if (scene.kind === 'metaphor' && scene.metaphor) {
    /* الفكرة تُرسم أمام العين: الاستعارة تدخل بمسحٍ رأسيٍّ ناعم من الأسفل
       (كأنها تُخطّ الآن) مع تكبيرٍ طفيف يستقر — لا ظهورٌ فوري بارد. */
    const drawP = Math.min(1, progress * 1.5)
    const enter = 1 - Math.pow(1 - Math.min(1, progress * 2.2), 3)
    ctx.save()
    const scale = 0.9 + 0.1 * enter
    ctx.translate(REEL_WIDTH / 2, REEL_HEIGHT * 0.38)
    ctx.scale(scale, scale)
    ctx.translate(-REEL_WIDTH / 2, -REEL_HEIGHT * 0.38)
    if (enter < 0.999) {
      /* قناع كشفٍ يصعد: يُظهر الرسم تدريجياً من أسفله إلى أعلاه. */
      const revealY = REEL_HEIGHT * 0.38 + REEL_WIDTH * 0.34 - (REEL_WIDTH * 0.7) * enter
      ctx.beginPath()
      ctx.rect(0, revealY, REEL_WIDTH, REEL_HEIGHT)
      ctx.clip()
    }
    paintMetaphor(ctx, scene.metaphor, REEL_WIDTH / 2, REEL_HEIGHT * 0.38, REEL_WIDTH * 0.62, t, drawP, {
      ink: world.ink, dim: world.dim, accent: world.accent, accent2: world.accent2, danger: world.danger,
    }, scene.metaphorVariation || 0)
    ctx.restore()
    if (scene.eyebrow) fadeLine(ctx, scene.eyebrow, 38, world.accent, REEL_HEIGHT * 0.585, Math.min(1, (progress - 0.15) * 2.6), 600, DISPLAY_FONT)
    writeTextBlock(ctx, scene.line, 62, world.ink, REEL_HEIGHT * 0.68, Math.min(1, (progress - 0.25) * 1.8), undefined, nib, 3)
  } else {
    if (scene.eyebrow) fadeLine(ctx, scene.eyebrow, 42, world.dim, centerY - 150, Math.min(1, progress * 3))
    const block = writeTextBlock(ctx, scene.line, scene.accent ? 84 : 74, accentColor, centerY, Math.min(1, progress * 1.55), scene.accent ? world.accent : undefined, nib, 3)
    if (scene.line2) {
      writeTextBlock(ctx, scene.line2, 60, world.ink, centerY + block.height * 0.72, Math.min(1, (progress - 0.3) * 1.8), undefined, nib, 2)
    }
    if (plan.motifs.includes('underline') && progress > 0.66) {
      const grow = Math.min(1, (progress - 0.66) * 3.2)
      const width = 320 * grow
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(REEL_WIDTH / 2 + 160, centerY + block.height * 0.72)
      ctx.lineTo(REEL_WIDTH / 2 + 160 - width, centerY + block.height * 0.72)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (plan.templateId === 'counter' && scene.kind === 'hook' && plan.counterTarget) {
      const value = Math.round(plan.counterTarget * Math.min(1, progress * 1.4))
      fadeLine(ctx, `${value}٪`, 190, world.accent, centerY - 260, Math.min(1, progress * 2.2), 700, DISPLAY_FONT, 0)
    }
  }
}

/**
 * ترجمة محروقة: السطر يُقسَّم كلماتٍ تضيء تباعاً مع زمن المشهد.
 * سببها أن أغلب المشاهدة تجري صامتة، فالكلمة المضيئة تُبقي العين ممسوكة.
 */
function drawCaption(ctx: CanvasRenderingContext2D, world: ReelWorld, text: string, progress: number) {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return
  const px = 34
  const gap = 14
  const lit = Math.min(words.length, Math.floor(progress * words.length) + 1)
  const sprites = words.map((word, index) => lineSprite(word, px, index < lit ? world.ink : world.dim, index < lit ? 700 : 500, BODY_FONT))
  /* لفٌّ على سطرين كحدٍّ أقصى — الترجمة تخدم النص ولا تزاحمه. */
  const maxWidth = REEL_WIDTH * 0.84
  const rows: { items: typeof sprites; width: number }[] = []
  let current: typeof sprites = []
  let width = 0
  for (const sprite of sprites) {
    const next = width + sprite.canvas.width + (current.length ? gap : 0)
    if (next > maxWidth && current.length) { rows.push({ items: current, width }); current = [sprite]; width = sprite.canvas.width }
    else { current.push(sprite); width = next }
  }
  if (current.length) rows.push({ items: current, width })
  const shown = rows.slice(-2)
  const baseY = REEL_HEIGHT - 210 - (shown.length - 1) * (px * 1.5)
  shown.forEach((row, rowIndex) => {
    /* عربيٌّ من اليمين: نبدأ من الحافة اليمنى للسطر ونمضي يساراً. */
    let x = (REEL_WIDTH + row.width) / 2
    const y = baseY + rowIndex * px * 1.5
    for (const sprite of row.items) {
      x -= sprite.canvas.width
      ctx.drawImage(sprite.canvas, x, y - sprite.height / 2)
      x -= gap
    }
  })
}

function drawChrome(ctx: CanvasRenderingContext2D, stage: Stage, scene: ReelScene, t: number) {
  const world = stage.plan.world
  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 30px ${BODY_FONT}`
  ctx.fillStyle = world.dim
  ctx.globalAlpha = 0.85
  ctx.fillText(scene.slug, 52, 84)
  ctx.strokeStyle = world.dim
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(52, 100)
  ctx.lineTo(168, 100)
  ctx.stroke()
  ctx.textAlign = 'right'
  ctx.globalAlpha = 0.95
  ctx.fillStyle = world.danger
  ctx.font = `700 28px ${BODY_FONT}`
  ctx.fillText('LIVE', REEL_WIDTH - 74, 84)
  ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 4)
  ctx.beginPath()
  ctx.arc(REEL_WIDTH - 46, 74, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  const mark = lineSprite(stage.plan.footerMark, 30, world.dim, 600, DISPLAY_FONT)
  ctx.globalAlpha = 0.85
  ctx.drawImage(mark.canvas, (REEL_WIDTH - mark.canvas.width) / 2, REEL_HEIGHT - 118)
  ctx.globalAlpha = 1
}

/** الإطار الكامل عند لحظة زمنية — مع تلاشٍ متبادل بين المشاهد. */
export function drawReelFrame(ctx: CanvasRenderingContext2D, stage: Stage, t: number, dt: number) {
  const plan = stage.plan
  /* الخلفية تتنفّس: تكبيرٌ بطيءٌ جداً وإزاحةٌ خفيفة تمنحان المشهد حياةً
     بدل صورةٍ جامدة — بمقدارٍ لا يُلاحَظ واعياً لكنه يُحسّ. */
  const breathe = 1.015 + 0.015 * Math.sin(t * 0.28)
  const driftX = Math.sin(t * 0.16) * REEL_WIDTH * 0.006
  const driftY = Math.cos(t * 0.13) * REEL_HEIGHT * 0.004
  ctx.save()
  ctx.translate(REEL_WIDTH / 2 + driftX, REEL_HEIGHT / 2 + driftY)
  ctx.scale(breathe, breathe)
  ctx.translate(-REEL_WIDTH / 2, -REEL_HEIGHT / 2)
  ctx.drawImage(stage.bg, 0, 0)
  ctx.restore()

  let start = 0
  let index = 0
  for (; index < plan.scenes.length; index += 1) {
    if (t < start + plan.scenes[index].seconds) break
    start += plan.scenes[index].seconds
  }
  const sceneIndex = Math.min(index, plan.scenes.length - 1)
  const scene = plan.scenes[sceneIndex]
  const local = t - start

  drawScene(ctx, stage, scene, local, t, dt)

  /* عناق المشاهد: بداية المشهد تُرسم فوق ذيل سابقه بشفافية صاعدة. */
  if (sceneIndex > 0 && local < CROSS_FADE) {
    const prev = plan.scenes[sceneIndex - 1]
    ctx.save()
    ctx.globalAlpha = 1 - local / CROSS_FADE
    drawScene(ctx, stage, prev, prev.seconds - CROSS_FADE + local, t, 0)
    ctx.restore()
  }

  ctx.drawImage(stage.vignette, 0, 0)
  if (scene.kind !== 'signature' && scene.kind !== 'close' && plan.captions !== false) {
    drawCaption(ctx, plan.world, scene.line, Math.max(0, Math.min(1, local / Math.max(0.1, scene.seconds - 0.4))))
  }
  drawChrome(ctx, stage, scene, t)
  const sheet = stage.grain[Math.floor(t * FPS) % stage.grain.length]
  ctx.drawImage(sheet, 0, 0)
}

/* ------------------------------- الموسيقى ------------------------------- */

interface MoodSpec { roots: number[][]; padLevel: number; kickLevel: number; brightness: number }

const MOODS: Record<ReelPlan['mood'], MoodSpec> = {
  dark: { roots: [[55, 82.41, 110], [58.27, 87.31, 116.54], [49, 73.42, 98], [55, 82.41, 130.81]], padLevel: 0.05, kickLevel: 0.5, brightness: 620 },
  warm: { roots: [[87.31, 130.81, 174.61], [98, 146.83, 196], [110, 164.81, 220], [87.31, 130.81, 220]], padLevel: 0.045, kickLevel: 0.34, brightness: 900 },
  bright: { roots: [[130.81, 196, 261.63], [146.83, 220, 293.66], [164.81, 246.94, 329.63], [130.81, 196, 329.63]], padLevel: 0.042, kickLevel: 0.3, brightness: 1400 },
  scholar: { roots: [[110, 164.81, 220], [103.83, 155.56, 207.65], [98, 146.83, 196], [110, 174.61, 220]], padLevel: 0.03, kickLevel: 0.2, brightness: 1100 },
}

function buildScore(audio: AudioContext, destination: AudioNode, plan: ReelPlan) {
  const master = audio.createGain()
  master.gain.value = 0
  const lowpass = audio.createBiquadFilter()
  lowpass.type = 'lowpass'
  const mood = MOODS[plan.mood]
  lowpass.frequency.value = 8000
  master.connect(lowpass)
  lowpass.connect(destination)

  const t0 = audio.currentTime + 0.08
  master.gain.setValueAtTime(0, t0)
  master.gain.linearRampToValueAtTime(0.9, t0 + 0.9)
  master.gain.setValueAtTime(0.9, t0 + plan.seconds - 1.1)
  master.gain.linearRampToValueAtTime(0.0001, t0 + plan.seconds)

  const noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1

  const tone = (time: number, freq: number, duration: number, peak: number, type: OscillatorType = 'sine', detune = 0, cutoff = 0) => {
    const osc = audio.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    if (cutoff) {
      const filter = audio.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = cutoff
      osc.connect(filter)
      filter.connect(gain)
    } else osc.connect(gain)
    gain.connect(master)
    osc.start(time)
    osc.stop(time + duration + 0.05)
  }
  const kick = (time: number, peak = mood.kickLevel) => {
    const osc = audio.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, time)
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.22)
    const gain = audio.createGain()
    gain.gain.setValueAtTime(peak, time)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.4)
    osc.connect(gain)
    gain.connect(master)
    osc.start(time)
    osc.stop(time + 0.45)
  }
  const noise = (time: number, duration: number, peak: number, from: number, to: number) => {
    const src = audio.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = true
    const band = audio.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 0.9
    band.frequency.setValueAtTime(from, time)
    band.frequency.exponentialRampToValueAtTime(Math.max(60, to), time + duration)
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(peak, time + Math.min(0.05, duration * 0.3))
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    src.connect(band)
    band.connect(gain)
    gain.connect(master)
    src.start(time)
    src.stop(time + duration + 0.05)
  }
  const bellHit = (time: number, freq: number, peak: number) => {
    tone(time, freq, 1.9, peak)
    tone(time, freq * 2.76, 1.1, peak * 0.35)
    tone(time, freq * 5.4, 0.7, peak * 0.16)
  }
  const chord = (time: number, freqs: number[], duration: number) => {
    for (const freq of freqs) {
      tone(time, freq, duration, mood.padLevel, 'sawtooth', -6, mood.brightness)
      tone(time, freq, duration, mood.padLevel, 'sawtooth', 6, mood.brightness)
    }
  }

  const pluck = (time: number, freq: number, peak: number) => {
    const osc = audio.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.5)
    osc.connect(gain); gain.connect(master); osc.start(time); osc.stop(time + 0.55)
  }
  const shaker = (time: number, peak: number) => noise(time, 0.08, peak, 6000, 4000)

  /* بصمة افتتاحية من نغمتين مشتقة من بذرة المادة؛ ثابتة لنفس الفكرة ومختلفة
     للأفكار الأخرى، وتبقى أخفض من الكلام كي لا تتحول إلى شعار صاخب. */
  const markRoot = 220 * Math.pow(2, (plan.seed % 7) / 12)
  tone(t0 + 0.04, markRoot, 0.46, 0.035, 'triangle', -3, 4200)
  tone(t0 + 0.16, markRoot * Math.pow(2, 7 / 12), 0.62, 0.026, 'sine', 2, 5200)

  /* فراش متحوّل على طول الريل. */
  const segment = plan.seconds / mood.roots.length
  mood.roots.forEach((freqs, index) => chord(t0 + index * segment, freqs, segment + 0.8))

  /* بصمة صوتية لكل قالب — كي لا تتشابه الريلات سمعياً:
     - السؤال: نبضة قلبٍ خافتة تحت الفراش (تأمّل)
     - الصفارة: طبقة توتر منخفضة مستمرة (ترقّب)
     - العدّاد: إيقاع نقرات صاعد (عدّ)
     - المخطوطة: خشخشة ورقٍ ناعمة (حميمية)
     - النسيج: أربيجيو رفيع متكرر (تشابك) */
  const beatEvery = plan.templateId === 'counter' ? 0.5 : plan.templateId === 'weave' ? 0.66 : plan.templateId === 'question' ? 1.0 : 0
  if (beatEvery > 0) {
    for (let b = t0 + 1.2; b < t0 + plan.seconds - 1.2; b += beatEvery) {
      if (plan.templateId === 'question') kick(b, mood.kickLevel * 0.4)
      else if (plan.templateId === 'counter') { shaker(b, 0.05); if (Math.round((b - t0) / beatEvery) % 4 === 0) kick(b, mood.kickLevel * 0.5) }
      else pluck(b, mood.roots[0][0] * 4, 0.03)
    }
  }
  if (plan.templateId === 'siren') {
    /* طبقة توتر منخفضة تحت كامل المشهد. */
    const drone = audio.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = mood.roots[0][0] * 0.5
    const dg = audio.createGain(); dg.gain.value = 0.02
    const df = audio.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 200
    drone.connect(df); df.connect(dg); dg.connect(master); drone.start(t0); drone.stop(t0 + plan.seconds)
  }

  /* ضربات المشاهد. */
  let cursor = 0
  plan.scenes.forEach((scene, index) => {
    const at = t0 + cursor
    if (index > 0) {
      /* تنويع صوت الانتقال: مسحٌ عالٍ، أو هبوطٌ منخفض، أو نبضةُ جرس — بالتناوب. */
      const kind = index % 3
      if (kind === 0) noise(at, 0.4, 0.16, 3800, 260)
      else if (kind === 1) noise(at - 0.2, 0.5, 0.12, 260, 2600)
      else bellHit(at, mood.roots[0][0] * 8, 0.04)
    }
    if (scene.kind === 'hook') { kick(at + 0.12); bellHit(at + 0.14, 523.25, 0.06) }
    if (scene.kind === 'shift') {
      noise(at - 0.5, 0.6, 0.1, 260, 3200)
      kick(at + 0.1, mood.kickLevel + 0.14)
      if (plan.templateId === 'siren') {
        const wail = audio.createOscillator()
        wail.type = 'sine'
        const wailGain = audio.createGain()
        wailGain.gain.setValueAtTime(0.0001, at)
        wailGain.gain.linearRampToValueAtTime(0.05, at + 0.4)
        wailGain.gain.exponentialRampToValueAtTime(0.0001, at + Math.min(2.6, scene.seconds))
        const lfo = audio.createOscillator()
        lfo.frequency.value = 0.9
        const lfoGain = audio.createGain()
        lfoGain.gain.value = 160
        lfo.connect(lfoGain)
        lfoGain.connect(wail.frequency)
        wail.frequency.value = 560
        wail.connect(wailGain)
        wailGain.connect(master)
        wail.start(at)
        lfo.start(at)
        wail.stop(at + 2.7)
        lfo.stop(at + 2.7)
      }
    }
    if (scene.kind === 'truth') { kick(at + 0.1, mood.kickLevel + 0.1); bellHit(at + 0.14, 659.25, 0.08) }
    if (scene.kind === 'idea') bellHit(at + 0.12, 587.33, 0.05)
    if (scene.kind === 'close') {
      bellHit(at + 0.2, 880, 0.09)
      const scale = plan.mood === 'dark' ? [220, 261.63, 329.63, 392, 523.25] : [261.63, 329.63, 392, 523.25, 659.25]
      scale.forEach((freq, step) => tone(at + 0.3 + step * 0.24, freq, 0.9, 0.045, 'triangle', 0, 2200))
    }
    /* خدش القلم أثناء الكشف الكتابي — لقالب المخطوطة خاصة. */
    if (plan.templateId === 'manuscript' && scene.kind !== 'signature') {
      for (let beat = at + 0.25; beat < at + scene.seconds * 0.6; beat += 0.34) noise(beat, 0.12, 0.05, 1600, 1100)
    }
    if (plan.templateId === 'counter' && scene.kind === 'hook') {
      for (let tick = 0; tick < 6; tick += 1) tone(at + 0.2 + tick * 0.32, 720 + tick * 110, 0.06, 0.07, 'triangle', 0, 5200)
      noise(at + 0.2, 1.6, 0.08, 320, 3200)
    }
    if (plan.templateId === 'weave') {
      for (let beat = at + 0.4; beat < at + scene.seconds - 0.4; beat += 0.62) tone(beat, 987.77, 0.05, 0.028, 'triangle', 0, 6200)
    }
    cursor += scene.seconds
  })
  return master
}

/* ------------------------------- تشغيل وتصدير ------------------------------- */

export interface ReelHandle { stop: () => void }

export async function playReelPreview(canvas: HTMLCanvasElement, plan: ReelPlan, options: { audio?: boolean; onDone?: () => void } = {}): Promise<ReelHandle> {
  await ensureFonts()
  spriteCache.clear()
  canvas.width = REEL_WIDTH
  canvas.height = REEL_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر تجهيز لوحة الرسم')
  const stage = buildStage(plan)
  let raf = 0
  let stopped = false
  let audio: AudioContext | null = null
  if (options.audio !== false) {
    try {
      audio = new AudioContext()
      buildScore(audio, audio.destination, plan)
    } catch { audio = null }
  }
  const startedAt = performance.now()
  let last = startedAt
  let done = false
  let timer = 0
  const step = () => {
    if (stopped || done) return
    const now = performance.now()
    const t = (now - startedAt) / 1000
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (t >= plan.seconds) {
      done = true
      window.clearInterval(timer)
      drawReelFrame(ctx, stage, plan.seconds - 0.001, 0)
      options.onDone?.()
      return
    }
    drawReelFrame(ctx, stage, t, dt)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  /* مؤقّت احتياطي — التبويب الخلفي يخنق rAF فلا تتجمد المعاينة. */
  timer = window.setInterval(step, Math.round(1000 / FPS))
  return {
    stop: () => {
      stopped = true
      cancelAnimationFrame(raf)
      window.clearInterval(timer)
      if (audio) { audio.close().catch(() => { /* أُغلق مسبقاً */ }) }
    },
  }
}

export interface ReelExportResult { blob: Blob; mime: string; seconds: number }

export async function exportReelVideo(plan: ReelPlan, options: { canvas?: HTMLCanvasElement; onProgress?: (ratio: number) => void } = {}): Promise<ReelExportResult> {
  const mime = pickReelMime()
  if (!mime) throw new Error('هذا المتصفح لا يدعم تسجيل الفيديو — جرّب Chrome')
  await ensureFonts()
  spriteCache.clear()
  const canvas = options.canvas || document.createElement('canvas')
  canvas.width = REEL_WIDTH
  canvas.height = REEL_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر تجهيز لوحة الرسم')
  const stage = buildStage(plan)

  const audio = new AudioContext()
  const sink = audio.createMediaStreamDestination()
  buildScore(audio, sink, plan)

  const videoStream = canvas.captureStream(FPS)
  const mixed = new MediaStream([...videoStream.getVideoTracks(), ...sink.stream.getAudioTracks()])
  /* 5.2 ميغابت/ث تكفي لنصٍّ حادٍّ على تدرّجٍ هادئ عند 1080×1920، وتنزل
     بالملف إلى نحو نصف حجمه السابق بلا فرقٍ مرئي على الهاتف. */
  const recorder = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 5_200_000, audioBitsPerSecond: 128_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const finished = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] })) })

  drawReelFrame(ctx, stage, 0, 0)
  recorder.start(250)
  const startedAt = performance.now()
  let last = startedAt
  await new Promise<void>((resolve) => {
    let raf = 0
    let timer = 0
    const step = () => {
      const now = performance.now()
      const t = (now - startedAt) / 1000
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const ratio = Math.min(1, t / plan.seconds)
      options.onProgress?.(ratio)
      if (t >= plan.seconds + 0.15) {
        cancelAnimationFrame(raf)
        window.clearInterval(timer)
        resolve()
        return
      }
      drawReelFrame(ctx, stage, Math.min(t, plan.seconds - 0.001), dt)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    /* مؤقّت احتياطي كي لا يتجمد التسجيل إن خُنق rAF في تبويب خلفي. */
    timer = window.setInterval(step, Math.round(1000 / FPS))
  })
  recorder.stop()
  const blob = await finished
  videoStream.getTracks().forEach((track) => track.stop())
  await audio.close().catch(() => { /* أُغلق مسبقاً */ })
  return { blob, mime, seconds: plan.seconds }
}

export function downloadReelBlob(result: ReelExportResult, title: string) {
  const extension = result.mime.includes('mp4') ? 'mp4' : 'webm'
  const safe = title.slice(0, 42).replace(/[^\p{L}\p{N} ]/gu, '').trim().replace(/\s+/g, '-') || 'reel'
  const url = URL.createObjectURL(result.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safe}.${extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
