import type { CompositionPlan } from './social-design-engine'
import { renderCompositionSvg } from './social-design-renderer'

/*
 * محرّك الحركة — يحوّل تصميماً ثابتاً إلى فيديوٍ حيّ داخل المتصفح، بلا خادمٍ ولا
 * تكلفة: يرسم التصميم على canvas بحركةٍ سينمائية (ظهورٌ ناعم + زحفُ كِن-بيرنز +
 * نبضةُ تظليل)، ويلتقط الإطارات عبر MediaRecorder إلى ملف WebM جاهزٍ للمشاركة
 * كـReel. حلمُ الصديق «الحركة والفيديو» في مساره المجاني الكامل.
 */

export type MotionStyle = 'reveal' | 'kenburns' | 'pulse'

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

async function planToImage(plan: CompositionPlan): Promise<HTMLImageElement> {
  const svg = renderCompositionSvg(plan)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
    return image
  } finally {
    // نؤجّل الإبطال حتى تُرسم الصورة أول مرة
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
}

function pickMime(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export function motionSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function' && Boolean(pickMime())
}

/** يرسم إطاراً واحداً بالحركة المطلوبة عند لحظةٍ نسبية p∈[0,1]. */
function drawFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number, p: number, style: MotionStyle) {
  ctx.save()
  ctx.fillStyle = '#0B0E12'
  ctx.fillRect(0, 0, w, h)
  const fade = Math.min(1, easeInOut(Math.min(1, p / 0.16)) + 0.02)
  ctx.globalAlpha = fade
  if (style === 'kenburns' || style === 'reveal') {
    const zoom = 1 + 0.06 * easeInOut(p)
    const dx = (w * (zoom - 1)) / 2
    const dy = (h * (zoom - 1)) / 2
    const panX = style === 'kenburns' ? Math.sin(p * Math.PI) * w * 0.012 : 0
    ctx.drawImage(image, -dx + panX, -dy, w * zoom, h * zoom)
    if (style === 'reveal') {
      // كاشفٌ رأسيّ لطيف من الأسفل يرتفع مع الزمن
      const reveal = easeInOut(Math.min(1, p / 0.55))
      const grad = ctx.createLinearGradient(0, h, 0, 0)
      grad.addColorStop(Math.max(0, reveal - 0.12), 'rgba(11,14,18,0)')
      grad.addColorStop(reveal, 'rgba(11,14,18,0)')
      grad.addColorStop(Math.min(1, reveal + 0.001), 'rgba(11,14,18,0.0)')
    }
  } else {
    const pulse = 1 + 0.015 * Math.sin(p * Math.PI * 4)
    const dx = (w * (pulse - 1)) / 2
    const dy = (h * (pulse - 1)) / 2
    ctx.drawImage(image, -dx, -dy, w * pulse, h * pulse)
  }
  ctx.globalAlpha = 1
  // نبضةُ تظليلٍ سينمائية خفيفة
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.33, w / 2, h / 2, Math.max(w, h) * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, `rgba(0,0,0,${0.16 + 0.06 * Math.sin(p * Math.PI)})`)
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/**
 * يصدّر التصميم فيديو WebM. الحركة تُلتقط في الزمن الحقيقي عبر MediaRecorder،
 * فتخرج نسخةٌ حيّةٌ جاهزةٌ للمشاركة. يُرجِع Blob، ويُبلّغ التقدّم اختيارياً.
 */
export async function exportDesignVideo(
  plan: CompositionPlan,
  { style = 'kenburns', durationMs = 4200, fps = 30, onProgress }: { style?: MotionStyle; durationMs?: number; fps?: number; onProgress?: (ratio: number) => void } = {},
): Promise<Blob> {
  const mime = pickMime()
  if (!mime) throw new Error('تسجيل الفيديو غير مدعوم في هذا المتصفح')
  const image = await planToImage(plan)
  const w = plan.format.width
  const h = plan.format.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  drawFrame(ctx, image, w, h, 0, style)

  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
  })

  recorder.start()
  const start = performance.now()
  await new Promise<void>((resolve) => {
    let raf = 0
    let timer = 0
    const step = () => {
      const elapsed = performance.now() - start
      const p = Math.min(1, elapsed / durationMs)
      drawFrame(ctx, image, w, h, p, style)
      onProgress?.(p)
      if (p >= 1) {
        cancelAnimationFrame(raf)
        clearInterval(timer)
        resolve()
        return
      }
      raf = requestAnimationFrame(step)
    }
    // نقود الإطارات بـrequestAnimationFrame للسلاسة، ومعه مؤقّتٌ احتياطي كي
    // لا يتجمّد التصدير إن خُنق rAF (تبويبٌ في الخلفية أو نافذةٌ مخفيّة).
    raf = requestAnimationFrame(step)
    timer = window.setInterval(step, Math.max(20, Math.round(1000 / fps)))
  })
  recorder.stop()
  stream.getTracks().forEach((track) => track.stop())
  return done
}

/** يصدّر ويُنزّل مباشرةً باسمٍ من عنوان التصميم. */
export async function downloadDesignVideo(plan: CompositionPlan, options?: Parameters<typeof exportDesignVideo>[1]) {
  const blob = await exportDesignVideo(plan, options)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const name = String(plan.content.title || 'تصميم').slice(0, 40).replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'design'
  link.download = `${name}.webm`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
