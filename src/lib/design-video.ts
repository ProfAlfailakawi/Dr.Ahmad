/**
 * تصدير التصميم فيديو متحرّكاً — الخيار الثاني بجانب PNG الثابت. نرسم التصميم
 * صورةً ثابتة (بخطوطٍ مضمّنة) كخلفية، ثم نرسم الأيقونة الحيّة فوقها إطاراً بعد
 * إطار ونسجّل عبر MediaRecorder (بلا صوت). مجاناً من المتصفح، بنفس تقنية الريلز.
 * ما تراه في المعاينة — بأيقونته المتحركة ومواضع كلماته — هو ما يُسجَّل.
 */

import { paintMetaphor } from './reel-metaphors'
import { resolvePalette, type CompositionPlan } from './social-design-engine'
import { rasterizeCompositionToImage } from './social-design-renderer'
import { readIconEnabled, readEffectivePlacement, resolveMetaphor } from './design-overrides'

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  for (const mime of candidates) { try { if (MediaRecorder.isTypeSupported(mime)) return mime } catch { /* تابع */ } }
  return null
}

/** هل يدعم المتصفح تسجيل الفيديو؟ (لإخفاء الزر بلطفٍ إن لم يدعم). */
export function designVideoSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!pickMime()
}

/** هل لهذا التصميم حركةٌ فعلية تُسجَّل؟ (أيقونة مفعّلة وظاهرة). */
export function designHasMotion(plan: CompositionPlan): boolean {
  const place = readEffectivePlacement(plan)
  return readIconEnabled() && !!place && !place.hidden
}

export interface DesignVideoResult { blob: Blob; mime: string; seconds: number }

export async function exportDesignVideo(plan: CompositionPlan, options: { seconds?: number; onProgress?: (ratio: number) => void } = {}): Promise<DesignVideoResult> {
  const mime = pickMime()
  if (!mime) throw new Error('هذا المتصفح لا يدعم تسجيل الفيديو — جرّب Chrome')
  const seconds = options.seconds ?? 4
  const W = plan.format.width, H = plan.format.height
  const bg = await rasterizeCompositionToImage(plan)
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر تجهيز لوحة الرسم')

  const pal = resolvePalette(plan)
  const place = readEffectivePlacement(plan)
  const showIcon = readIconEnabled() && !!place && !place.hidden
  const metaphor = resolveMetaphor(plan)
  const iconW = showIcon && place ? (place.size / 100) * W : 0
  const cx = showIcon && place ? place.left * W + iconW / 2 : 0
  const cy = showIcon && place ? place.top * H + iconW / 2 : 0
  const paint = { ink: pal.ink, dim: pal.muted, accent: pal.accent, accent2: pal.accentSoft || pal.accent, danger: pal.accent }

  const draw = (t: number) => {
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(bg, 0, 0, W, H)
    if (!showIcon) return
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
    const prog = Math.min(1, (t % 6) / 2.4)
    paintMetaphor(ctx, metaphor, cx, cy, iconW * 0.6, t, prog, paint)
    ctx.restore()
  }

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const finished = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] })) })

  draw(0)
  recorder.start(200)
  const startedAt = performance.now()
  await new Promise<void>((resolve) => {
    let raf = 0, timer = 0
    const step = () => {
      const t = (performance.now() - startedAt) / 1000
      options.onProgress?.(Math.min(1, t / seconds))
      if (t >= seconds) { cancelAnimationFrame(raf); window.clearInterval(timer); resolve(); return }
      draw(t)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    /* مؤقّت احتياطي كي لا يتجمّد التسجيل إن خُنق rAF في تبويبٍ خلفي. */
    timer = window.setInterval(step, 33)
  })
  recorder.stop()
  const blob = await finished
  stream.getTracks().forEach((track) => track.stop())
  return { blob, mime, seconds }
}

/** يصدّر الفيديو ثم ينزّله ملفاً — بامتداد mp4 أو webm بحسب دعم المتصفح. */
export async function downloadDesignVideo(plan: CompositionPlan, options: { seconds?: number; onProgress?: (ratio: number) => void } = {}): Promise<void> {
  const result = await exportDesignVideo(plan, options)
  const ext = result.mime.includes('mp4') ? 'mp4' : 'webm'
  const safe = (plan.content.title || 'design').slice(0, 42).replace(/[^\p{L}\p{N} ]/gu, '').trim().replace(/\s+/g, '-') || 'design'
  const url = URL.createObjectURL(result.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safe}.${ext}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
