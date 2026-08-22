import type { CompositionPlan } from './social-design-engine'
import { resolvePalette } from './social-design-engine'
import {
  embeddedCompositionFontCss,
  embeddedCompositionSeal,
  renderCompositionSvg,
} from './social-design-renderer'
import { paintMetaphor } from './reel-metaphors'
import { readEffectivePlacement, readIconEnabled, resolveMetaphor } from './design-overrides'

/**
 * محرّك فيديو المنشور المستقل. الحركة هنا ليست تكبيراً عاماً للصورة: يقرأ
 * العبارة ويستخرج «فعلها البصري»، ثم يجعل ختم الهوية يتحوّل إلى استعارتها
 * الحيّة ويعود إلى الختم في آخر الإطار، لذلك تبقى الحلقة سلسة.
 */

export type MotionStyle = 'semantic' | 'reveal' | 'kenburns' | 'pulse'
export type MotionProfileId = 'loop' | 'hook' | 'argument'
export type SemanticMotionVerb = 'root' | 'connect' | 'split' | 'rise' | 'weave' | 'orbit' | 'pulse' | 'path' | 'question' | 'balance' | 'reveal'

export const MOTION_PROFILES: Record<MotionProfileId, { label: string; description: string; durationMs: number; fps: number }> = {
  loop: { label: 'حلقة ٤٫٨ ث', description: 'حركة ختمية سلسة تعود إلى أول إطار', durationMs: 4_800, fps: 30 },
  hook: { label: 'خطّاف ٩ ث', description: 'افتتاح سريع ثم كشف الاستعارة', durationMs: 9_000, fps: 30 },
  argument: { label: 'حجّة ١٦٫٨ ث', description: 'نَفَس أهدأ للمنشور الذي يحمل فكرة مركّبة', durationMs: 16_800, fps: 30 },
}

export interface DesignMotionAudit {
  score: number
  ready: boolean
  verb: SemanticMotionVerb
  metaphor: string
  signature: string
  checks: string[]
  warnings: string[]
}

export interface DesignVideoResult {
  blob: Blob
  mime: string
  extension: 'mp4' | 'webm'
  seconds: number
  audit: DesignMotionAudit
}

export interface DesignVideoOptions {
  style?: MotionStyle
  profile?: MotionProfileId
  durationMs?: number
  fps?: number
  audio?: boolean
  onProgress?: (ratio: number) => void
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
const wave = (p: number) => (1 - Math.cos(clamp(p) * Math.PI * 2)) / 2

function planText(plan: CompositionPlan) {
  const c = plan.content
  return [c.kicker, c.title, c.heroWord, c.subtitle, c.quote, c.body, ...(c.points || [])].filter(Boolean).join(' ')
}

export function semanticMotionVerb(plan: CompositionPlan): SemanticMotionVerb {
  const text = planText(plan)
  const tests: Array<[SemanticMotionVerb, RegExp]> = [
    ['balance', /(توازن|ميزان|إنسان.*آلة|آلة.*إنسان|أخلاق|اخلاق|ضمير|عدالة)/],
    ['root', /(جذر|جذور|بذرة|ينمو|نمو|شجرة|غرس|تربية|طفل)/],
    ['rise', /(نسبة|٪|%|رقم|ارتفاع|يصعد|نمو|أداء|نتيجة)/],
    ['split', /(ليس|ليست|بلا |بل |لكن|مقابل|فجوة|انقسام|بينما|اختلاف)/],
    ['question', /(؟|سؤال|لماذا|كيف|ماذا|هل )/],
    ['weave', /(نسيج|خيط|حكاية|سرد|ثقافة|هوية|معنى)/],
    ['orbit', /(مدار|كوكب|كون|دورة|حول|منظومة|نظام)/],
    ['path', /(طريق|مسار|رحلة|مستقبل|اتجاه|تحول|قرار)/],
    ['connect', /(شبك|اتصال|تواصل|بيانات|فريق|مجتمع|علاقة|ربط|ذكاء)/],
    ['pulse', /(نبض|قلب|حياة|إنسان|شعور|أثر)/],
  ]
  return tests.find(([, pattern]) => pattern.test(text))?.[0] || 'reveal'
}

export function auditDesignMotion(plan: CompositionPlan, profile: MotionProfileId = 'loop'): DesignMotionAudit {
  const verb = semanticMotionVerb(plan)
  const metaphor = resolveMetaphor(plan)
  const titleLength = String(plan.content.title || '').trim().length
  const bodyLength = String(plan.content.body || '').trim().length
  const warnings: string[] = []
  const checks = [
    `الفعل البصري «${verb}» مشتق من العبارة`,
    `الاستعارة «${metaphor}» جزء من الفيديو وليست طبقة معاينة فقط`,
    'الإطار الأول والأخير متطابقان حركياً لحلقة بلا قفزة',
    `الإخراج مضبوط على ${MOTION_PROFILES[profile].label}`,
  ]
  if (!titleLength) warnings.push('العنوان فارغ؛ الحركة ستفقد مرساها الدلالية.')
  if (titleLength > 92) warnings.push('العنوان طويل جداً على منشور سريع القراءة.')
  if (bodyLength > 340 && profile === 'loop') warnings.push('النص كثيف على الحلقة القصيرة؛ اختر «حجّة ١٦٫٨ ث».')
  const placement = readEffectivePlacement(plan)
  if (readIconEnabled() && placement?.hidden) warnings.push('موضع الأيقونة محجوب في المعاينة؛ سيستخدم الفيديو موضعاً آمناً بديلاً.')
  const score = clamp(100 - warnings.length * 9 - (!titleLength ? 18 : 0), 0, 100)
  return {
    score,
    ready: score >= 82 && Boolean(titleLength),
    verb,
    metaphor,
    signature: [plan.layout, plan.paletteOverride?.label || plan.palette, verb, metaphor, profile].join(':'),
    checks,
    warnings,
  }
}

async function imageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

async function planToImage(plan: CompositionPlan): Promise<HTMLImageElement> {
  await Promise.race([
    document.fonts?.ready || Promise.resolve(),
    new Promise((resolve) => window.setTimeout(resolve, 3_500)),
  ])
  const [fontCss, sealHref] = await Promise.all([
    embeddedCompositionFontCss(),
    embeddedCompositionSeal(),
  ])
  const svg = renderCompositionSvg(plan, { fontCss, ...(sealHref ? { sealHref } : {}) })
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    return await imageFromUrl(url)
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
  }
}

async function loadLogo() {
  try { return await imageFromUrl('/logo.png') } catch { return null }
}

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export function motionSupported(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && Boolean(pickMime())
}

function drawBase(ctx: CanvasRenderingContext2D, image: CanvasImageSource, w: number, h: number, p: number, style: MotionStyle) {
  const loop = wave(p)
  ctx.fillStyle = '#0b0e12'
  ctx.fillRect(0, 0, w, h)
  if (style === 'reveal') {
    ctx.save()
    const lift = easeOut(Math.min(1, p * 2.4))
    const retreat = easeOut(Math.min(1, (1 - p) * 2.4))
    const visible = Math.min(lift, retreat)
    ctx.globalAlpha = 0.34 + visible * 0.66
    ctx.drawImage(image, 0, 0, w, h)
    ctx.restore()
  } else {
    const strength = style === 'kenburns' ? 0.032 : style === 'pulse' ? 0.015 : 0.009
    const zoom = 1 + strength * loop
    const pan = style === 'kenburns' ? Math.sin(p * Math.PI * 2) * w * 0.006 : 0
    ctx.drawImage(image, -(w * (zoom - 1)) / 2 + pan, -(h * (zoom - 1)) / 2, w * zoom, h * zoom)
  }
}

type PalettePaint = { ink: string; dim: string; accent: string; accent2: string; danger: string }

function drawSemanticVerb(ctx: CanvasRenderingContext2D, verb: SemanticMotionVerb, w: number, h: number, p: number, paint: PalettePaint) {
  const loop = wave(p)
  const phase = p * Math.PI * 2
  const cx = w * 0.5
  const cy = h * 0.5
  ctx.save()
  ctx.globalAlpha = 0.08 + loop * 0.2
  ctx.strokeStyle = paint.accent
  ctx.fillStyle = paint.accent
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2, w * 0.003)
  if (verb === 'root') {
    const y = h * 0.62
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.bezierCurveTo(cx + i * w * 0.025, y + h * 0.04, cx + i * w * 0.065, y + h * (0.08 + loop * 0.03), cx + i * w * 0.11, y + h * 0.14); ctx.stroke()
    }
  } else if (verb === 'connect') {
    const nodes = Array.from({ length: 8 }, (_, i) => ({ x: cx + Math.cos(i * 0.9 + phase * 0.08) * w * (0.16 + (i % 2) * 0.07), y: cy + Math.sin(i * 1.3) * h * 0.18 }))
    nodes.forEach((node, i) => { const next = nodes[(i + 3) % nodes.length]; ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(next.x, next.y); ctx.stroke(); ctx.beginPath(); ctx.arc(node.x, node.y, 3 + 4 * loop, 0, Math.PI * 2); ctx.fill() })
  } else if (verb === 'split') {
    const gap = w * (0.015 + loop * 0.06)
    ctx.beginPath(); ctx.moveTo(cx - gap, h * 0.2); ctx.lineTo(cx - gap, h * 0.8); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + gap, h * 0.2); ctx.lineTo(cx + gap, h * 0.8); ctx.stroke()
  } else if (verb === 'rise') {
    ctx.beginPath(); ctx.moveTo(w * 0.16, h * 0.72); ctx.bezierCurveTo(w * 0.34, h * (0.7 - loop * 0.05), w * 0.58, h * (0.5 - loop * 0.08), w * 0.84, h * (0.28 - loop * 0.04)); ctx.stroke()
  } else if (verb === 'weave') {
    for (let i = 0; i < 6; i += 1) { const y = h * (0.28 + i * 0.085); ctx.beginPath(); ctx.moveTo(w * 0.12, y); ctx.bezierCurveTo(w * 0.34, y + Math.sin(phase + i) * h * 0.025, w * 0.66, y - Math.sin(phase + i) * h * 0.025, w * 0.88, y); ctx.stroke() }
  } else if (verb === 'orbit') {
    for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.ellipse(cx, cy, w * (0.14 + i * 0.08), h * (0.08 + i * 0.055), i * 0.42 + phase * 0.02, 0, Math.PI * 2); ctx.stroke() }
  } else if (verb === 'path') {
    ctx.setLineDash([4, 15]); ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.7); ctx.bezierCurveTo(w * 0.35, h * 0.18, w * 0.62, h * 0.82, w * 0.85, h * 0.3); ctx.stroke(); ctx.setLineDash([])
  } else if (verb === 'question') {
    ctx.font = `700 ${Math.round(w * 0.32)}px Alexandria, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('؟', cx, cy)
  } else if (verb === 'balance') {
    ctx.beginPath(); ctx.moveTo(cx, h * 0.3); ctx.lineTo(cx, h * 0.7); ctx.moveTo(w * 0.28, h * 0.4); ctx.lineTo(w * 0.72, h * 0.4); ctx.stroke()
    ;[w * 0.31, w * 0.69].forEach((x, i) => { ctx.beginPath(); ctx.arc(x, h * (0.53 + (i ? -1 : 1) * Math.sin(phase) * 0.015), w * 0.08, 0, Math.PI); ctx.stroke() })
  } else {
    for (let i = 0; i < 3; i += 1) { ctx.globalAlpha = (0.12 - i * 0.025) * loop; ctx.beginPath(); ctx.arc(cx, cy, w * (0.1 + i * 0.085 + loop * 0.025), 0, Math.PI * 2); ctx.stroke() }
  }
  ctx.restore()
}

function drawMorphingSeal(
  ctx: CanvasRenderingContext2D,
  plan: CompositionPlan,
  logo: HTMLImageElement | null,
  p: number,
  w: number,
  h: number,
  paint: PalettePaint & { surface: string; isDark: boolean },
) {
  if (!readIconEnabled()) return
  const stored = readEffectivePlacement(plan)
  const sizePct = clamp(stored?.size || 18, 10, 28)
  const size = (sizePct / 100) * w
  const left = stored && !stored.hidden ? clamp(stored.left, 0.03, 0.97 - sizePct / 100) : 0.74 - sizePct / 200
  const top = stored && !stored.hidden ? clamp(stored.top, 0.03, 0.94 - (size / h)) : 0.07
  const cx = left * w + size / 2
  const cy = top * h + size / 2
  const morph = Math.pow(Math.sin(p * Math.PI), 2)
  const appear = 1
  ctx.save()
  ctx.globalAlpha = 0.5 * appear
  ctx.fillStyle = paint.surface
  ctx.strokeStyle = paint.accent
  ctx.lineWidth = Math.max(2, size * 0.01)
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
  if (logo) {
    const logoAlpha = (1 - morph) * appear
    ctx.save(); ctx.globalAlpha = logoAlpha; ctx.drawImage(logo, cx - size * 0.25, cy - size * 0.25, size * 0.5, size * 0.5); ctx.restore()
  }
  ctx.save()
  ctx.globalAlpha = morph * appear
  paintMetaphor(ctx, resolveMetaphor(plan), cx, cy, size * 0.62, p * 6, Math.min(1, morph * 1.8), paint, plan.directionIndex + plan.fingerprint.length)
  ctx.restore()
}

function drawFrame(ctx: CanvasRenderingContext2D, image: CanvasImageSource, logo: HTMLImageElement | null, plan: CompositionPlan, p: number, style: MotionStyle) {
  const w = plan.format.width
  const h = plan.format.height
  const palette = resolvePalette(plan)
  const paint = { ink: palette.ink, dim: palette.muted, accent: palette.accent, accent2: palette.accentSoft || palette.accent, danger: palette.accent, surface: palette.surface, isDark: palette.isDark }
  drawBase(ctx, image, w, h, p, style)
  drawSemanticVerb(ctx, semanticMotionVerb(plan), w, h, p, paint)
  drawMorphingSeal(ctx, plan, logo, p, w, h, paint)
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, `rgba(0,0,0,${0.08 + 0.05 * wave(p)})`)
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
}

function buildSoundmark(audio: AudioContext, target: AudioNode, plan: CompositionPlan, durationMs: number) {
  const master = audio.createGain()
  master.gain.setValueAtTime(0.0001, audio.currentTime)
  master.gain.exponentialRampToValueAtTime(0.038, audio.currentTime + 0.04)
  master.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + Math.min(1.3, durationMs / 1000 - 0.08))
  master.connect(target)
  const root = 196 + (plan.fingerprint.length % 5) * 22
  ;[0, 7].forEach((semitones, index) => {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = index ? 'sine' : 'triangle'
    oscillator.frequency.value = root * Math.pow(2, semitones / 12)
    gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.12)
    gain.gain.exponentialRampToValueAtTime(index ? 0.34 : 0.5, audio.currentTime + index * 0.12 + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.12 + 0.58)
    oscillator.connect(gain); gain.connect(master)
    oscillator.start(audio.currentTime + index * 0.12); oscillator.stop(audio.currentTime + index * 0.12 + 0.64)
  })
  return master
}

/** مسار صامت يحفظ الساعة الزمنية للفيديو حتى لو خنق المتصفح رسم تبويبٍ خفي. */
function buildSilentClock(audio: AudioContext, target: AudioNode, durationMs: number) {
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  gain.gain.value = 0.000001
  oscillator.frequency.value = 40
  oscillator.connect(gain); gain.connect(target)
  oscillator.start(audio.currentTime)
  oscillator.stop(audio.currentTime + durationMs / 1000 + 0.2)
}

export async function exportDesignVideo(plan: CompositionPlan, options: DesignVideoOptions = {}): Promise<DesignVideoResult> {
  const mime = pickMime()
  if (!mime) throw new Error('تسجيل الفيديو غير مدعوم في هذا المتصفح')
  const profile = options.profile || 'loop'
  const durationMs = options.durationMs || MOTION_PROFILES[profile].durationMs
  const fps = options.fps || MOTION_PROFILES[profile].fps
  const style = options.style || 'semantic'
  const audit = auditDesignMotion(plan, profile)
  if (!audit.ready) throw new Error(audit.warnings[0] || 'لم يجتز الفيديو بوابة الجاهزية')
  const [image, logo] = await Promise.all([planToImage(plan), loadLogo()])
  /* نُسطّح SVG مرة واحدة؛ رسم صورة SVG الأصلية في كل إطار يجبر المتصفح على
     إعادة تنقيطها ويهبط بمعدل الفيديو إلى بضعة إطارات فقط. */
  const base = document.createElement('canvas')
  base.width = plan.format.width
  base.height = plan.format.height
  const baseContext = base.getContext('2d')
  if (!baseContext) throw new Error('تعذّر تجهيز أصل فيديو المنشور')
  baseContext.drawImage(image, 0, 0, base.width, base.height)
  const canvas = document.createElement('canvas')
  canvas.width = plan.format.width
  canvas.height = plan.format.height
  /* Canvas مفصول أو مخفي يُخنق في بعض Chromium إلى 2–3 إطارات/ثانية.
     لذلك يظهر كنافذة إخراج حيّة صغيرة طوال التسجيل ثم يختفي فوراً. */
  const previewWidth = Math.min(340, Math.max(220, window.innerWidth * .24))
  canvas.style.cssText = `position:fixed;left:18px;bottom:18px;width:${previewWidth}px;height:auto;max-height:56vh;border-radius:18px;border:1px solid rgba(255,255,255,.28);box-shadow:0 24px 70px rgba(0,0,0,.32);pointer-events:none;z-index:2147483646;background:#0b0e12`
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر تجهيز لوحة فيديو المنشور')
  drawFrame(ctx, base, logo, plan, 0, style)

  const videoStream = canvas.captureStream(fps)
  const videoTrack = videoStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined
  let audio: AudioContext | null = null
  let stream: MediaStream = videoStream
  try {
    audio = new AudioContext()
    const sink = audio.createMediaStreamDestination()
    if (options.audio) buildSoundmark(audio, sink, plan, durationMs)
    else buildSilentClock(audio, sink, durationMs)
    stream = new MediaStream([...videoStream.getVideoTracks(), ...sink.stream.getAudioTracks()])
  } catch { audio = null }
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: Math.max(6_000_000, Math.round(plan.format.width * plan.format.height * fps * 0.14)),
    ...(audio ? { audioBitsPerSecond: 96_000 } : {}),
  })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))
  })
  recorder.start(250)
  const startedAt = performance.now()
  await new Promise<void>((resolve) => {
    let raf = 0
    let watchdog = 0
    let finished = false
    const step = (scheduleNext = true) => {
      if (finished) return
      const now = performance.now()
      const elapsed = now - startedAt
      const ratio = clamp(elapsed / durationMs)
      drawFrame(ctx, base, logo, plan, ratio, style)
      videoTrack?.requestFrame?.()
      options.onProgress?.(ratio)
      if (ratio >= 1) {
        finished = true; cancelAnimationFrame(raf); window.clearInterval(watchdog); resolve(); return
      }
      if (scheduleNext) raf = requestAnimationFrame(() => step(true))
    }
    raf = requestAnimationFrame(() => step(true))
    watchdog = window.setInterval(() => step(false), Math.max(20, Math.round(1000 / fps)))
  })
  /* نمنح المرمّز نبضةً أخيرة ليكتب الإطار الختامي قبل إغلاق الحاوية. */
  videoTrack?.requestFrame?.()
  await new Promise((resolve) => window.setTimeout(resolve, Math.max(80, Math.round(2000 / fps))))
  recorder.requestData()
  recorder.stop()
  const blob = await finished
  stream.getTracks().forEach((track) => track.stop())
  if (stream !== videoStream) videoStream.getTracks().forEach((track) => track.stop())
  await audio?.close().catch(() => { /* أُغلق مسبقاً */ })
  canvas.remove()
  const extension = mime.includes('mp4') ? 'mp4' : 'webm'
  return { blob, mime, extension, seconds: durationMs / 1000, audit }
}

export async function downloadDesignVideo(plan: CompositionPlan, options?: DesignVideoOptions): Promise<DesignVideoResult> {
  const result = await exportDesignVideo(plan, options)
  const url = URL.createObjectURL(result.blob)
  const link = document.createElement('a')
  link.href = url
  const name = String(plan.content.title || 'تصميم').slice(0, 48).replace(/[^\p{L}\p{N} ]/gu, '').trim().replace(/\s+/g, '-') || 'design'
  link.download = `${name}-${options?.profile || 'loop'}.${result.extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
  return result
}
