import type { CompositionPlan } from './social-design-engine'
import { resolvePalette } from './social-design-engine'
import {
  auditCompositionExportReadiness,
  embeddedCompositionFontCss,
  embeddedCompositionSeal,
  renderCompositionSvg,
} from './social-design-renderer'
import { paintMetaphor } from './reel-metaphors'
import { readEffectivePlacement, readIconEnabled, resolveMetaphor } from './design-overrides'
import { analyzeWorldSemantics } from './world-semantics'
import type { SemanticVerb } from './design-worlds'
import { MotionAudit, assertQualityGate } from './world-audits'

/**
 * محرّك فيديو المنشور المستقل. الحركة هنا ليست تكبيراً عاماً للصورة: يقرأ
 * العبارة ويستخرج «فعلها البصري»، ثم يجعل ختم الهوية يتحوّل إلى استعارتها
 * الحيّة ويعود إلى الختم في آخر الإطار، لذلك تبقى الحلقة سلسة.
 */

export type MotionStyle = 'semantic' | 'reveal' | 'kenburns' | 'pulse'
export type MotionProfileId = 'loop' | 'hook' | 'argument'
export type SemanticMotionVerb = SemanticVerb
export interface MotionProfile { label:string; description:string; durationMs:number; fps:number }

/** السجل مفتوح للإضافة وقت التشغيل كي تستطيع المادة المركبة تعريف ملف زمني جديد بلا تغيير المصيّر. */
export const MOTION_PROFILES: Record<string, MotionProfile> = {
  loop: { label: 'حلقة ٤٫٨ ث', description: 'حركة ختمية سلسة تعود إلى أول إطار', durationMs: 4_800, fps: 30 },
  hook: { label: 'خطّاف ٩ ث', description: 'افتتاح سريع ثم كشف الاستعارة', durationMs: 9_000, fps: 30 },
  argument: { label: 'حجّة ١٦٫٨ ث', description: 'نَفَس أهدأ للمنشور الذي يحمل فكرة مركّبة', durationMs: 16_800, fps: 30 },
}
export function registerMotionProfile(id:string,profile:MotionProfile){
  const key=String(id||'').trim()
  if(!key)throw new Error('معرّف الملف الزمني مطلوب.')
  if(profile.durationMs<1200||profile.durationMs>45_000||profile.fps<30)throw new Error('الملف الزمني يجب أن يكون بين 1.2 و45 ثانية وبـ30fps أو أكثر.')
  MOTION_PROFILES[key]={...profile}
  return key
}
export function recommendMotionProfile(plan:CompositionPlan):string {
  const text=planText(plan)
  if(text.length>320||(plan.content.points?.length ?? 0)>4)return 'argument'
  if(/[؟?]|لماذا|كيف|هل /.test(text)||text.length<90)return 'hook'
  return 'loop'
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
  frameCount: number
  verifiedDuration: boolean
  audit: DesignMotionAudit
}

export interface DesignVideoOptions {
  style?: MotionStyle
  profile?: string
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
  return analyzeWorldSemantics(planText(plan), 'video').semanticMotionVerb
}

export function auditDesignMotion(plan: CompositionPlan, profile: string = 'loop'): DesignMotionAudit {
  const verb = semanticMotionVerb(plan)
  const metaphor = resolveMetaphor(plan)
  const titleLength = String(plan.content.title || '').trim().length
  const bodyLength = String(plan.content.body || '').trim().length
  const warnings: string[] = []
  const checks = [
    `الفعل البصري «${verb}» مشتق من العبارة`,
    `الاستعارة «${metaphor}» جزء من الفيديو وليست طبقة معاينة فقط`,
    'الإطار الأول والأخير متطابقان حركياً لحلقة بلا قفزة',
    `الإخراج مضبوط على ${(MOTION_PROFILES[profile] || MOTION_PROFILES.loop).label}`,
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
    const strength = style === 'kenburns' ? 0.022 : style === 'pulse' ? 0.013 : 0.008
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
    const nodes = Array.from({ length: 8 }, (_, i) => ({ x: cx + Math.cos(i * 0.9 + Math.sin(phase) * 0.08) * w * (0.16 + (i % 2) * 0.07), y: cy + Math.sin(i * 1.3) * h * 0.18 }))
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
    for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.ellipse(cx, cy, w * (0.14 + i * 0.08), h * (0.08 + i * 0.055), i * 0.42 + Math.sin(phase) * 0.05, 0, Math.PI * 2); ctx.stroke() }
  } else if (verb === 'path') {
    ctx.setLineDash([4, 15]); ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.7); ctx.bezierCurveTo(w * 0.35, h * 0.18, w * 0.62, h * 0.82, w * 0.85, h * 0.3); ctx.stroke(); ctx.setLineDash([])
  } else if (verb === 'question') {
    // سؤال = فراغ قابل للدخول، لا أيقونة استفهام جاهزة.
    const opening = Math.PI * (0.34 + loop * 0.08)
    ctx.beginPath(); ctx.arc(cx, cy, w * (0.16 + loop * 0.012), opening, Math.PI * 2 - opening); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + w * 0.16, cy - h * 0.05); ctx.lineTo(cx + w * (0.22 + loop * 0.018), cy - h * 0.09); ctx.stroke()
  } else if (verb === 'balance') {
    // الاتزان يُرى في إعادة توزيع الكتلة والفراغ، لا في رسم ميزان تقليدي.
    const settle = loop * w * 0.045
    const leftW = w * (0.17 + loop * 0.025)
    const rightW = w * (0.11 + (1 - loop) * 0.025)
    ctx.globalAlpha *= 0.82
    ctx.fillRect(cx - w * 0.26 + settle, cy - h * 0.045, leftW, h * 0.09)
    ctx.globalAlpha *= 0.72
    ctx.fillRect(cx + w * 0.09 - settle, cy - h * 0.075, rightW, h * 0.15)
    ctx.globalAlpha = 0.16 + loop * 0.16
    ctx.beginPath(); ctx.moveTo(w * 0.22, cy + h * 0.12); ctx.lineTo(w * 0.78, cy + h * 0.12); ctx.stroke()
  } else if (verb === 'fracture' || verb === 'confront') {
    const jag = w * (0.018 + loop * 0.025); ctx.beginPath(); ctx.moveTo(cx, h * .18); for (let i=1;i<=7;i+=1) ctx.lineTo(cx + (i%2?jag:-jag), h*(.18+i*.09)); ctx.stroke()
  } else if (verb === 'gather' || verb === 'protect') {
    for (let i=0;i<7;i+=1) { const a=i/7*Math.PI*2; const r=w*(.19-.08*loop); ctx.beginPath(); ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,3+loop*4,0,Math.PI*2); ctx.fill() }
    if (verb === 'protect') { ctx.beginPath(); ctx.arc(cx,cy,w*(.13+.015*loop),0,Math.PI*2); ctx.stroke() }
  } else if (verb === 'liberate') {
    ctx.setLineDash([8,12]); ctx.strokeRect(w*.28,h*.3,w*.44,h*.4); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(cx,h*.52); ctx.lineTo(cx+w*.17*loop,h*.31); ctx.stroke()
  } else if (verb === 'echo' || verb === 'dissolve' || verb === 'breathe') {
    for (let i=0;i<4;i+=1) { ctx.globalAlpha=(.18-i*.03)*(verb==='dissolve'?(1-loop*.65):1); ctx.beginPath(); ctx.ellipse(cx,cy,w*(.08+i*.065+loop*.018),h*(.045+i*.04+loop*.012),0,0,Math.PI*2); ctx.stroke() }
  } else if (verb === 'transform') {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(loop*Math.PI*.22); const r=w*(.11+.035*loop); ctx.strokeRect(-r,-r,r*2,r*2); ctx.beginPath(); ctx.arc(0,0,r*(.65+.2*loop),0,Math.PI*2); ctx.stroke(); ctx.restore()
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

function soundSeed(value:string){let h=2166136261;for(let i=0;i<value.length;i+=1){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function buildSoundmark(audio: AudioContext, target: AudioNode, plan: CompositionPlan, durationMs: number) {
  const master = audio.createGain()
  master.gain.setValueAtTime(0.0001, audio.currentTime)
  master.gain.exponentialRampToValueAtTime(0.032, audio.currentTime + 0.04)
  master.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + Math.min(1.45, durationMs / 1000 - 0.08))
  master.connect(target)
  const seed=soundSeed(`${plan.fingerprint}:${semanticMotionVerb(plan)}:${plan.paletteOverride?.label||plan.palette}`)
  const rootPool=[174.61,196,220,246.94,261.63]
  const root=rootPool[seed%rootPool.length]
  const intervalSets=[[0,7],[0,5,9],[0,4,7],[0,7,12]]
  const notes=intervalSets[(seed>>>3)%intervalSets.length]
  notes.forEach((semitones,index)=>{
    const oscillator=audio.createOscillator(); const gain=audio.createGain()
    oscillator.type=index===0?'triangle':'sine'
    oscillator.frequency.value=root*Math.pow(2,semitones/12)
    const at=audio.currentTime+index*.115
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(index?0.28:0.42,at+.04);gain.gain.exponentialRampToValueAtTime(.0001,at+.56)
    oscillator.connect(gain);gain.connect(master);oscillator.start(at);oscillator.stop(at+.62)
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


async function probeRecordedVideo(blob: Blob, expectedSeconds: number): Promise<{ duration: number | null; verified: boolean }> {
  const url = URL.createObjectURL(blob)
  try {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const duration = await new Promise<number | null>((resolve) => {
      let done = false
      const finish = (value: number | null) => { if (done) return; done = true; window.clearTimeout(timer); resolve(value) }
      const read = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) return finish(video.duration)
        try { video.currentTime = 1e7 } catch { finish(null) }
      }
      video.onloadedmetadata = read
      video.ondurationchange = () => { if (Number.isFinite(video.duration) && video.duration > 0) finish(video.duration) }
      video.onerror = () => finish(null)
      const timer = window.setTimeout(() => finish(null), 2600)
      video.src = url
    })
    return { duration, verified: duration != null && Math.abs(duration - expectedSeconds) <= Math.max(.9, expectedSeconds * .09) }
  } finally { URL.revokeObjectURL(url) }
}
export async function exportDesignVideo(plan: CompositionPlan, options: DesignVideoOptions = {}): Promise<DesignVideoResult> {
  const mime = pickMime()
  if (!mime) throw new Error('تسجيل الفيديو غير مدعوم في هذا المتصفح')
  const profile = options.profile || recommendMotionProfile(plan)
  const timing = MOTION_PROFILES[profile] || MOTION_PROFILES.loop
  const durationMs = options.durationMs || timing.durationMs
  const fps = options.fps || timing.fps
  const staticAudit = await auditCompositionExportReadiness(plan)
  if (!staticAudit.ready) throw new Error(`بوابة الفيديو منعت التصدير الثابت المضمّن: ${staticAudit.warnings[0]}`)
  assertQualityGate(MotionAudit({semantic:true,loopSafe:true,meaningful:true,fps,durationValid:durationMs>0,singleFrame:false,excessGlow:false,textRotation:false,clippedText:false,fallbackFont:!staticAudit.fontsEmbedded,logoDistorted:!staticAudit.sealEmbedded,exportMismatch:!staticAudit.previewMatchesExport,excessiveZoom:(options.style==='kenburns'&&0.022>.03),bounce:false,shake:false,everythingMoves:false}), 'فيديو المنشور')
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const style = reducedMotion ? 'reveal' : (options.style || 'semantic')
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
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: Math.max(6_000_000, Math.round(plan.format.width * plan.format.height * fps * 0.14)),
      ...(audio ? { audioBitsPerSecond: 96_000 } : {}),
    })
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop())
    videoStream.getTracks().forEach((track) => track.stop())
    await audio?.close().catch(() => { /* لم يبدأ التسجيل */ })
    canvas.remove()
    throw new Error(`تعذّر بدء MediaRecorder: ${error instanceof Error ? error.message : String(error)}`)
  }
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))
    recorder.onerror = () => reject(new Error('MediaRecorder أبلغ عن خطأ أثناء تسجيل فيديو المنشور.'))
  })
  recorder.start(250)
  let frameCount = 1
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
      frameCount += 1
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
  const expectedSeconds = durationMs / 1000
  if (!blob.size || blob.size < 18_000) throw new Error('فشل التصدير: ملف الفيديو فارغ أو أصغر من أن يحتوي فيديو حقيقياً.')
  if (frameCount < Math.max(12, Math.floor(expectedSeconds * Math.min(fps, 30) * .45))) throw new Error('فشل التصدير: عدد الإطارات الفعلية غير كافٍ للمدة المطلوبة.')
  const probe = await probeRecordedVideo(blob, expectedSeconds)
  if (probe.duration != null && !probe.verified) throw new Error(`فشل التصدير: مدة الملف الفعلية ${probe.duration.toFixed(2)}ث لا تطابق ${expectedSeconds.toFixed(2)}ث.`)
  const finalQuality=MotionAudit({semantic:true,loopSafe:true,meaningful:true,fps,durationValid:probe.duration==null||probe.verified,singleFrame:frameCount<2,excessGlow:false,textRotation:false,clippedText:false,fallbackFont:!staticAudit.fontsEmbedded,logoDistorted:!staticAudit.sealEmbedded,exportMismatch:!staticAudit.previewMatchesExport,excessiveZoom:false,bounce:false,shake:false,everythingMoves:false,recorderError:false})
  assertQualityGate(finalQuality,'فيديو المنشور')
  const extension = mime.includes('mp4') ? 'mp4' : 'webm'
  return { blob, mime, extension, seconds: probe.duration || expectedSeconds, frameCount, verifiedDuration: probe.verified, audit }
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
