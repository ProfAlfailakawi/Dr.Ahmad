/**
 * البصمة البصرية: تستخرج عدة ألوان حقيقية من الصورة محلياً، ثم تحوّلها إلى
 * لوحة قابلة للقراءة. لا تغادر الصورة الجهاز ولا تُرفع إلى أي خادم.
 */
import type { Palette } from './social-design-engine'

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const toByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const hex = (value: number) => toByte(value).toString(16).padStart(2, '0')
const rgbHex = (r: number, g: number, b: number) => `#${hex(r)}${hex(g)}${hex(b)}`

type RGB = { r: number; g: number; b: number }
type HSL = { h: number; s: number; l: number }
type ImageSource = HTMLImageElement | HTMLCanvasElement
type Bucket = RGB & { count: number }

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), delta = max - min
  let h = 0
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h = (h * 60 + 360) % 360
  }
  const l = (max + min) / 2
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const sn = clamp(s), ln = clamp(l)
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = ln - c / 2
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}
const hslHex = (h: number, s: number, l: number) => {
  const c = hslToRgb(h, s, l)
  return rgbHex(c.r, c.g, c.b)
}

function hexRgb(value: string): RGB {
  const raw = value.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) }
}
function mix(a: string, b: string, amount: number) {
  const x = hexRgb(a), y = hexRgb(b), t = clamp(amount)
  return rgbHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t)
}
function linear(channel: number) {
  const c = channel / 255
  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4
}
function luminance(value: string) {
  const c = hexRgb(value)
  return .2126 * linear(c.r) + .7152 * linear(c.g) + .0722 * linear(c.b)
}
function contrast(a: string, b: string) {
  const l1 = luminance(a), l2 = luminance(b)
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)
}
function readableAccent(value: string, background: string, isDark: boolean) {
  const hsl = rgbToHsl(hexRgb(value))
  let lightness = isDark ? Math.max(.61, hsl.l) : Math.min(.43, hsl.l)
  let candidate = hslHex(hsl.h, Math.max(.36, hsl.s), lightness)
  for (let i = 0; i < 8 && contrast(candidate, background) < 3.2; i += 1) {
    lightness += isDark ? .045 : -.045
    candidate = hslHex(hsl.h, Math.max(.36, hsl.s), clamp(lightness, .16, .82))
  }
  return candidate
}

function sampleImageData(source: ImageSource, box = 96): ImageData | null {
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  if (!sw || !sh) return null
  const scale = Math.min(1, box / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  try { return ctx.getImageData(0, 0, canvas.width, canvas.height) } catch { return null }
}

function quantize(data: ImageData): Bucket[] {
  const map = new Map<number, Bucket>()
  for (let i = 0; i < data.data.length; i += 4) {
    const a = data.data[i + 3]
    if (a < 125) continue
    const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const current = map.get(key)
    if (current) { current.count += 1; current.r += r; current.g += g; current.b += b }
    else map.set(key, { count: 1, r, g, b })
  }
  return [...map.values()].map((item) => ({ count: item.count, r: item.r / item.count, g: item.g / item.count, b: item.b / item.count })).sort((a, b) => b.count - a.count)
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/** ينتقي ألواناً متباعدة فعلياً بدل أخذ أكثر ست سلال متشابهة. */
function diverseSwatches(buckets: Bucket[], count = 6) {
  const candidates = buckets
    .map((bucket) => ({ ...bucket, hsl: rgbToHsl(bucket), color: rgbHex(bucket.r, bucket.g, bucket.b) }))
    .filter((item) => item.hsl.l > .04 && item.hsl.l < .96)
  const selected: typeof candidates = []
  for (const candidate of candidates) {
    if (!selected.length) { selected.push(candidate); continue }
    const distinct = selected.every((item) => hueDistance(candidate.hsl.h, item.hsl.h) > 22 || Math.abs(candidate.hsl.l - item.hsl.l) > .22)
    if (distinct) selected.push(candidate)
    if (selected.length >= count) break
  }
  for (const candidate of candidates) {
    if (selected.length >= count) break
    if (!selected.some((item) => item.color === candidate.color)) selected.push(candidate)
  }
  return selected.map((item) => item.color)
}

export interface VisualDna {
  palette: Palette
  swatches: string[]
  hue: number
  isDark: boolean
}

/** واجهة الاختبارات القديمة تبقى، لكنها الآن تولّد طيفاً حقيقياً متناسقاً. */
export function buildDnaPalette(input: { hue: number; isDark: boolean; chroma: number }): Palette {
  const h = ((input.hue % 360) + 360) % 360
  const c = clamp(input.chroma, .34, .72)
  const seed = [
    hslHex(h, c, input.isDark ? .66 : .40),
    hslHex(h + 42, Math.max(.38, c * .88), input.isDark ? .70 : .43),
    hslHex(h + 174, Math.max(.34, c * .78), input.isDark ? .64 : .38),
    hslHex(h + 302, Math.max(.30, c * .72), input.isDark ? .72 : .46),
  ]
  return buildDnaPaletteFromSwatches(seed, input.isDark)
}

function buildDnaPaletteFromSwatches(swatches: string[], isDark: boolean): Palette {
  const base = swatches[0] || '#365a7a'
  const background = isDark ? mix(base, '#071018', .78) : mix(base, '#ffffff', .92)
  const surface = isDark ? mix(base, '#ffffff', .06) : mix(base, '#ffffff', .975)
  const spectrum = (swatches.length ? swatches : [base]).slice(0, 4).map((color) => readableAccent(color, background, isDark))
  while (spectrum.length < 4) {
    const hsl = rgbToHsl(hexRgb(spectrum[0] || base))
    spectrum.push(readableAccent(hslHex(hsl.h + spectrum.length * 67, Math.max(.36, hsl.s), hsl.l), background, isDark))
  }
  const ink = isDark ? '#f7f8fa' : '#111820'
  const muted = isDark ? mix(ink, background, .30) : mix(ink, background, .42)
  return {
    id: isDark ? 'brand-night' : 'brand-paper',
    label: 'بصمة بصرية متعددة',
    background,
    surface,
    ink,
    muted,
    accent: spectrum[0],
    accentSoft: mix(spectrum[1], background, isDark ? .58 : .76),
    rule: mix(spectrum[2], background, isDark ? .64 : .78),
    isDark,
    spectrum,
    dna: true,
  }
}

export function extractVisualDna(source: ImageSource): VisualDna | null {
  const data = sampleImageData(source)
  if (!data) return null
  const buckets = quantize(data)
  if (!buckets.length) return null
  const total = buckets.reduce((sum, item) => sum + item.count, 0)
  const average = buckets.reduce((sum, item) => sum + rgbToHsl(item).l * item.count, 0) / total
  const isDark = average < .42
  const swatches = diverseSwatches(buckets, 6)
  const vivid = buckets
    .map((bucket) => ({ hsl: rgbToHsl(bucket), score: bucket.count * (.12 + rgbToHsl(bucket).s * (1 - Math.abs(rgbToHsl(bucket).l - .5))) }))
    .filter((item) => item.hsl.s > .1)
    .sort((a, b) => b.score - a.score)[0]
  const hue = vivid?.hsl.h ?? 210
  return { palette: buildDnaPaletteFromSwatches(swatches, isDark), swatches, hue, isDark }
}

export function extractVisualDnaFromFile(file: File): Promise<VisualDna | null> {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) { resolve(null); return }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { const result = extractVisualDna(image); URL.revokeObjectURL(url); resolve(result) }
    image.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    image.src = url
  })
}
