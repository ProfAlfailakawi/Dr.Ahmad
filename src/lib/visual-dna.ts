/**
 * البصمة البصرية (Visual DNA)
 *
 * يستخرج لوحة ألوانٍ من صورةٍ يرفعها الدكتور — كوانتَزةٌ على Canvas داخل المتصفح،
 * بلا أي خدمةٍ خارجية ولا رفعٍ لخادم (الصورة لا تغادر الجهاز). الفكرة ليست نقلَ
 * ألوان الصورة حرفياً (فتنكسر قراءة النص)، بل: نلتقط «اللون البطل» ومزاج الصورة
 * (فاتح/داكن) ثم نبني حولهما لوحةَ هويةٍ كاملةً مضمونةَ التباين — تماماً كما تفعل
 * أدوات استخراج ألوان العلامات الاحترافية. هكذا يرث التصميمُ روحَ الصورة ويبقى
 * ناصعَ القراءة، فلا يعترض عليه الناقدُ البصري ولا يُحجَب من التصدير.
 */

import type { Palette } from './social-design-engine'

/* ------------------------------- تحويلات لونية ------------------------------- */

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const to255 = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const hex2 = (value: number) => to255(value).toString(16).padStart(2, '0')
const rgbHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

interface Hsl { h: number; s: number; l: number }

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0
  return { h, s, l }
}

function hslHex(h: number, s: number, l: number): string {
  const sn = clamp01(s), ln = clamp01(l)
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = ln - c / 2
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

/* ------------------------------ كوانتَزة الصورة ------------------------------ */

type ImageSource = HTMLImageElement | HTMLCanvasElement

interface Bucket { count: number; r: number; g: number; b: number }

/** يرسم المصدر على لوحةٍ صغيرة ويعيد بياناتِ بكسلاته (بلا تلوّثٍ لأن الصورة محلّية). */
function sampleImageData(source: ImageSource, box = 84): ImageData | null {
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  if (!sw || !sh) return null
  const scale = Math.min(1, box / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, w, h)
  try {
    return ctx.getImageData(0, 0, w, h)
  } catch {
    return null
  }
}

/**
 * يكوّن الألوان في ٤٠٩٦ سلّة (٤ بت لكل قناة) ويعيدها مرتّبةً بعدد البكسلات —
 * مع لونٍ وسطيٍّ دقيق لكل سلّة. يتجاهل الشفّاف وما يقارب الأبيض/الأسود المطلقين.
 */
function quantize(data: ImageData): Bucket[] {
  const buckets = new Map<number, Bucket>()
  const pixels = data.data
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3]
    if (a < 125) continue
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key)
    if (bucket) { bucket.count += 1; bucket.r += r; bucket.g += g; bucket.b += b }
    else buckets.set(key, { count: 1, r, g, b })
  }
  return [...buckets.values()]
    .map((bucket) => ({ count: bucket.count, r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count }))
    .sort((left, right) => right.count - left.count)
}

/* ------------------------------ توليد اللوحة ------------------------------ */

export interface VisualDna {
  /** لوحة هويةٍ كاملةٌ مضمونةُ التباين مبنيّةٌ حول لون الصورة البطل. */
  palette: Palette
  /** أبرز ألوان الصورة الخام — للعرض فقط في اللوحة (شريط البصمة). */
  swatches: string[]
  /** درجة لون البطل (0..360) ومزاج الصورة. */
  hue: number
  isDark: boolean
}

/**
 * يبني لوحةَ هويةٍ كاملةً حول درجةِ لونٍ ومزاج — دالةٌ نقيّةٌ منفصلةٌ عن قراءة
 * الصورة كي تُختبر وحدها: الحبر مقابل الخلفية يبقى فوق عتبة القراءة دوماً.
 */
export function buildDnaPalette(input: { hue: number; isDark: boolean; chroma: number }): Palette {
  const hue = ((input.hue % 360) + 360) % 360
  const chroma = clamp01(input.chroma)
  return input.isDark
    ? {
        // المزاج الداكن: خلفيةٌ ليليةٌ بلمسةِ الدرجة، ونصٌّ ناصع.
        id: 'brand-night',
        label: 'بصمة بصرية',
        background: hslHex(hue, 0.26, 0.10),
        surface: hslHex(hue, 0.22, 0.155),
        ink: hslHex(hue, 0.08, 0.95),
        muted: hslHex(hue, 0.13, 0.72),
        accent: hslHex(hue, Math.min(0.62, Math.max(0.34, chroma)), 0.66),
        accentSoft: hslHex(hue, 0.34, 0.26),
        rule: hslHex(hue, 0.15, 0.30),
        isDark: true,
      }
    : {
        // المزاج الفاتح: ورقٌ ناصعٌ بلمسةِ الدرجة، وحبرٌ داكنٌ مضمونُ التباين.
        id: 'brand-paper',
        label: 'بصمة بصرية',
        background: hslHex(hue, 0.16, 0.965),
        surface: hslHex(hue, 0.10, 0.995),
        ink: hslHex(hue, 0.24, 0.12),
        muted: hslHex(hue, 0.12, 0.44),
        accent: hslHex(hue, Math.max(0.34, chroma), Math.min(0.50, 0.34 + Math.max(0.34, chroma) * 0.2)),
        accentSoft: hslHex(hue, 0.32, 0.88),
        rule: hslHex(hue, 0.12, 0.85),
        isDark: false,
      }
}

/**
 * يستخرج البصمة البصرية من صورةٍ أو لوحة. يعيد null إن تعذّرت القراءة
 * (صورةٌ فارغةٌ أو سياقٌ غير متاح) كي يتعامل النداءُ معها بلطف.
 */
export function extractVisualDna(source: ImageSource): VisualDna | null {
  const imageData = sampleImageData(source)
  if (!imageData) return null
  const buckets = quantize(imageData)
  if (!buckets.length) return null

  const totalPixels = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  // لمعان متوسط مرجّح بعدد البكسلات → قرار الوضع فاتح/داكن.
  const avgLum = buckets.reduce((sum, bucket) => sum + rgbToHsl(bucket.r, bucket.g, bucket.b).l * bucket.count, 0) / totalPixels
  const isDark = avgLum < 0.42

  // اللون البطل: أعلى سلّةٍ درجةَ (عدد × تشبّع × قربٌ من اللمعان المتوسط)، تفادياً
  // للأبيض/الأسود الطاغيَين في الخلفيات. إن كانت الصورة رماديةً بلا لون، نلجأ
  // لدرجة الهوية الزرقاء بتشبّعٍ محسوب — فلا تخرج لوحةٌ باهتةٌ بلا شخصية.
  let best: { hsl: Hsl; score: number } | null = null
  for (const bucket of buckets) {
    const hsl = rgbToHsl(bucket.r, bucket.g, bucket.b)
    const vividness = hsl.s * (1 - Math.abs(hsl.l - 0.5) * 1.2)
    const score = bucket.count * (0.15 + vividness)
    if (hsl.s < 0.12) continue
    if (!best || score > best.score) best = { hsl, score }
  }
  const hue = best ? best.hsl.h : 210
  const chroma = best ? Math.min(0.72, Math.max(0.34, best.hsl.s)) : 0.34

  const swatches = buckets.slice(0, 6).map((bucket) => rgbHex(bucket.r, bucket.g, bucket.b))
  const palette = buildDnaPalette({ hue, isDark, chroma })

  return { palette, swatches, hue, isDark }
}

/** يحمّل ملفاً كصورةٍ ثم يستخرج البصمة — غلافٌ مريحٌ للوحة التحكم. */
export function extractVisualDnaFromFile(file: File): Promise<VisualDna | null> {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) { resolve(null); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { const dna = extractVisualDna(img); URL.revokeObjectURL(url); resolve(dna) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}
