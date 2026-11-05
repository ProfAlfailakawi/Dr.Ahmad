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
import {
  collectRecording, createCaptureSession, createFrameLoop, detectCaptureSupport, firstFailure, trackVisibility,
  verifyRecordedVideo, type FileVerification,
} from './video-capture-core'

/** هل يدعم المتصفح تسجيل الفيديو؟ (لإخفاء الزر بلطفٍ إن لم يدعم). الدعم والصيغة من الأساس المشترك. */
export function designVideoSupported(): boolean {
  return detectCaptureSupport({ preference: 'mp4-first' }).supported
}

/** هل لهذا التصميم حركةٌ فعلية تُسجَّل؟ (أيقونة مفعّلة وظاهرة). */
export function designHasMotion(plan: CompositionPlan): boolean {
  const place = readEffectivePlacement(plan)
  return readIconEnabled() && !!place && !place.hidden
}

export interface DesignVideoResult { blob: Blob; mime: string; seconds: number; frameCount: number; verification: FileVerification }

export async function exportDesignVideo(plan: CompositionPlan, options: { seconds?: number; onProgress?: (ratio: number) => void } = {}): Promise<DesignVideoResult> {
  const support = detectCaptureSupport({ preference: 'mp4-first' })
  if (!support.supported) throw new Error(`هذا المتصفح لا يدعم تسجيل الفيديو — ${support.reasons[0]}`)
  const mime = support.mime
  const seconds = options.seconds ?? 4
  const W = plan.format.width, H = plan.format.height
  const visibility = trackVisibility()
  if (visibility.hiddenAtStart) { visibility.dispose(); throw new Error('التبويب مخفي — أبقِ هذا التبويب ظاهراً أثناء التصدير ثم أعد المحاولة.') }
  const session = createCaptureSession()
  try {
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

    const stream = session.stream(canvas.captureStream(30))
    let recorder: MediaRecorder
    try { recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 }) }
    catch (error) { throw new Error(`تعذّر بدء MediaRecorder: ${error instanceof Error ? error.message : String(error)}`) }
    const collector = collectRecording(recorder, mime, 'MediaRecorder أبلغ عن خطأ أثناء تسجيل التصميم المتحرك.')

    draw(0)
    recorder.start(200)
    /* حلقة واحدة: لا rAF + setInterval متسابقان كما كانت النسخة السابقة. */
    const loop = createFrameLoop({
      fps: 30,
      onFrame: ({ t }) => {
        const failure = collector.failure()
        if (failure) throw failure
        options.onProgress?.(Math.min(1, t / seconds))
        if (t >= seconds) return false
        draw(t)
      },
    })
    const stats = await loop.run()
    const blob = await collector.finish()
    /* الحركة هنا موضعية بطبيعتها (أيقونة فوق خلفية ثابتة)، وفحص الشبكة يلتقطها؛ الصوت غير مطلوب. */
    const { verification, measured } = await verifyRecordedVideo({
      blob, frames: stats.frames, fps: 30, minBytes: 6_000,
      expected: { seconds, width: W, height: H, toleranceSeconds: Math.max(.9, seconds * .15) },
      extraChecks: [visibility.wasHidden ? { id: 'visibility', label: 'ظهور التبويب', status: 'fail' as const, detail: 'أُخفي التبويب أثناء التسجيل؛ قد تكون الإطارات متقطعة.' } : null],
    })
    const hard = firstFailure(verification)
    if (hard) throw new Error(hard)
    return { blob, mime, seconds: measured.duration || seconds, frameCount: stats.frames, verification }
  } finally {
    visibility.dispose()
    await session.dispose()
  }
}

/** يصدّر الفيديو ثم ينزّله ملفاً — بامتداد mp4 أو webm بحسب دعم المتصفح. يعيد النتيجة ليعرض المستدعي حالة الفحص. */
export async function downloadDesignVideo(plan: CompositionPlan, options: { seconds?: number; onProgress?: (ratio: number) => void } = {}): Promise<DesignVideoResult> {
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
  return result
}
