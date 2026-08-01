/**
 * استخراج الإطار المرجعي داخل المتصفح من الملف المحلي قبل الرفع.
 * يتم كل شيء على جهاز د. أحمد: لا خدمة فيديو ولا معالجة على خادم ولا مكتبة إضافية.
 */

export type ExtractedFrame = {
  blob: Blob
  previewUrl: string
  atSecond: number
  duration: number
  /** حدّة تقريبية بين 0 و1؛ المنخفضة تعني إطاراً ضبابياً أو أثناء حركة. */
  sharpness: number
}

const MEASURE_WIDTH = 160

/** حدّة تقريبية عبر متوسط فرق الجيران (تقريب لابلاسي) على نسخة صغيرة من الإطار. */
function measureSharpness(canvas: HTMLCanvasElement) {
  const width = MEASURE_WIDTH
  const height = Math.max(1, Math.round((canvas.height / Math.max(1, canvas.width)) * width))
  const small = document.createElement('canvas')
  small.width = width
  small.height = height
  const context = small.getContext('2d', { willReadFrequently: true })
  if (!context) return 1
  context.drawImage(canvas, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  const gray = new Float32Array(width * height)
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4
    gray[index] = (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) / 255
  }
  let total = 0
  let samples = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const laplacian = Math.abs(4 * gray[index] - gray[index - 1] - gray[index + 1] - gray[index - width] - gray[index + width])
      total += laplacian
      samples += 1
    }
  }
  if (!samples) return 1
  // معايرة عملية: 0.045 وما فوق تُقرأ صورة حادة؛ ما دونها يقترب من الضبابي.
  return Math.min(1, (total / samples) / 0.045)
}

function drawToBlob(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 720
  canvas.height = video.videoHeight || 1280
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('تعذّر تجهيز لوحة الرسم لاستخراج الإطار.')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const sharpness = measureSharpness(canvas)
  return new Promise<{ blob: Blob; sharpness: number }>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve({ blob, sharpness }) : reject(new Error('تعذّر تحويل الإطار إلى صورة.')), 'image/jpeg', 0.92)
  })
}

/**
 * يلتقط إطاراً من ملف فيديو محلي.
 * حين لا يُحدَّد الوقت يُؤخذ الإطار قبل النهاية بقليل — لا النهاية تماماً، لأنها قد تكون أثناء حركة.
 */
export function extractVideoFrame(file: File, atSecond?: number) {
  return new Promise<ExtractedFrame>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    let settled = false
    const fail = (message: string) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(objectUrl)
      reject(new Error(message))
    }
    const timer = window.setTimeout(() => fail('انتهت مهلة قراءة الفيديو؛ جرّب ملفاً آخر أو ارفع صورة الإطار يدوياً.'), 20000)
    video.onerror = () => { window.clearTimeout(timer); fail('تعذّرت قراءة ملف الفيديو في المتصفح.') }
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8
      const target = typeof atSecond === 'number' ? Math.min(Math.max(0, atSecond), Math.max(0, duration - 0.05)) : Math.max(0, duration - 0.12)
      video.currentTime = target
    }
    video.onseeked = () => {
      void drawToBlob(video)
        .then(({ blob, sharpness }) => {
          if (settled) return
          settled = true
          window.clearTimeout(timer)
          URL.revokeObjectURL(objectUrl)
          resolve({ blob, previewUrl: URL.createObjectURL(blob), atSecond: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : 8, sharpness })
        })
        .catch((reason) => { window.clearTimeout(timer); fail(reason instanceof Error ? reason.message : 'تعذّر استخراج الإطار.') })
    }
    video.src = objectUrl
  })
}

/** يقيس حدّة صورة مرجعية مرفوعة يدوياً بالمقياس نفسه. */
export function measureImageSharpness(file: File) {
  return new Promise<number>((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || 1
      canvas.height = image.naturalHeight || 1
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (context) context.drawImage(image, 0, 0)
      const sharpness = context ? measureSharpness(canvas) : 1
      URL.revokeObjectURL(objectUrl)
      resolve(sharpness)
    }
    // صورة يتعذّر قياسها لا تُعطَّل؛ تُمرَّر بحيادية ويقرر د. أحمد بعينه.
    image.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(1) }
    image.src = objectUrl
  })
}
