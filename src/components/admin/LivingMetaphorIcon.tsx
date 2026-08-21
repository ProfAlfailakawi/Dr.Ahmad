/**
 * الأيقونة الحيّة — استعارةٌ من مكتبة الريل (٥٣ صورة) تُختار بحسب معنى التصميم
 * من معجم الدكتور، وتتحرّك بألوان التصميم نفسه في زاويته: كخاتمٍ لا كلصقة.
 *
 * تُستعمل في استوديو التصاميم والمنشور المستقل معاً عبر مكوّنٍ واحد، ولها
 * مفتاح تشغيل/إيقاف يحفظه المتصفح فيتذكّره الدكتور. تظهر في المعاينة فقط ولا
 * تدخل SVG المُصدَّر، فتبقى تصاميم العارض سليمة. وتُحترم رغبة تقليل الحركة.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { interpretDrAhmadDomain } from '../../lib/dr-ahmad-domain-glossary'
import { paintMetaphor, chooseMetaphors, type MetaphorId } from '../../lib/reel-metaphors'
import { resolvePalette, type CompositionPlan } from '../../lib/social-design-engine'
import { renderCompositionSvg } from '../../lib/social-design-renderer'

const STORAGE_KEY = 'reel:living-icon:v1'
const MOTION_KEY = 'reel:living-icon-motion:v1'
const CHANGE_EVENT = 'living-icon-change'

function readEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}
function readMotion(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(MOTION_KEY) !== 'off'
}

/** مفتاحٌ مشترك: يُبقي كل الأماكن متزامنةً في الصفحة نفسها وعبر التبويبات. */
export function useLivingIconEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(readEnabled)
  useEffect(() => {
    const sync = () => setEnabled(readEnabled())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(CHANGE_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  const update = (next: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off') } catch { /* تخزينٌ محجوب */ }
    setEnabled(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
  return [enabled, update]
}

/** مفتاح الحركة: أيقونةٌ متحركة أم ثابتة — مشتركٌ متزامنٌ كسابقه. */
export function useLivingIconMotion(): [boolean, (next: boolean) => void] {
  const [motion, setMotion] = useState<boolean>(readMotion)
  useEffect(() => {
    const sync = () => setMotion(readMotion())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(CHANGE_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  const update = (next: boolean) => {
    try { localStorage.setItem(MOTION_KEY, next ? 'on' : 'off') } catch { /* محجوب */ }
    setMotion(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
  return [motion, update]
}

/** خيار الأيقونة: مفعّلة/متوقفة، وحين تُفعَّل — مع حركة أو بدون. */
export function LivingIconToggle({ className = '' }: { className?: string }) {
  const [enabled, setEnabled] = useLivingIconEnabled()
  const [motion, setMotion] = useLivingIconMotion()
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        aria-pressed={enabled}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[.68rem] font-semibold transition-colors ${enabled ? 'border-accent bg-accent/[.08] text-accent' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
        title="أيقونة حيّة تُختار من المكتبة بحسب معنى التصميم — تظهر في المعاينة، وتتجنّب النص، وتختفي إن لم تجد فراغاً"
      >
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${enabled ? 'bg-accent' : 'bg-soft/40'}`} />
        الأيقونة {enabled ? 'مفعّلة' : 'متوقفة'}
      </button>
      {enabled && (
        <button
          type="button"
          onClick={() => setMotion(!motion)}
          aria-pressed={motion}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[.66rem] font-semibold transition-colors ${motion ? 'border-accent/40 bg-accent/[.05] text-accent' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
          title="مع حركة: الأيقونة تتحرّك. بدون: صورة ثابتة."
        >
          {motion ? '✦ مع حركة' : '● بدون حركة'}
        </button>
      )}
    </span>
  )
}

interface ManualPos { top: number; left: number; size: number }

const posKey = (plan: CompositionPlan) => `reel:living-icon-pos:${plan.fingerprint || plan.id}`

function readManualPos(plan: CompositionPlan): ManualPos | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(posKey(plan))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ManualPos
    if (typeof parsed.top === 'number' && typeof parsed.left === 'number' && typeof parsed.size === 'number') return parsed
    return null
  } catch { return null }
}
function writeManualPos(plan: CompositionPlan, pos: ManualPos) {
  try { localStorage.setItem(posKey(plan), JSON.stringify(pos)) } catch { /* محجوب */ }
}
function clearManualPos(plan: CompositionPlan) {
  try { localStorage.removeItem(posKey(plan)) } catch { /* محجوب */ }
}

function metaphorFor(plan: CompositionPlan): MetaphorId {
  const c = plan.content
  const text = [c.title, c.heroWord, c.quote, c.kicker, c.subtitle, c.body].filter(Boolean).join(' ')
  const domain = interpretDrAhmadDomain(text.slice(0, 1200))
  const chosen = chooseMetaphors([domain.primary?.canonicalAr || '', domain.visualScenes.join(' · '), text.slice(0, 600)], 1)
  return chosen[0] || 'figure-contemplate'
}

/**
 * وضعٌ يقرأ الحقيقة لا يخمّنها: نرسم SVG التصميم على لوحةٍ صغيرة، ونقيس ازدحام
 * البكسلات في مواضع مرشّحة، فنضع الأيقونة في أخلى بقعةٍ تتّسع لها. وإن كان
 * التصميم مزدحماً في كل مكان، تختفي الأيقونة. لا تصادمَ مع نصٍّ أو عنصرٍ أبداً.
 */
interface Placement { hide: boolean; top: number; left: number; size: number }

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193) }
  return hash >>> 0
}

/* يقيس ازدحام مستطيلٍ على صورة الرمادي: نسبة البكسلات التي تنحرف عن متوسّط
   المستطيل انحرافاً محسوساً (نصٌّ ورسومٌ = تباينٌ عالٍ، خلفيةٌ متدرّجة = هدوء). */
function busyness(gray: Uint8ClampedArray, W: number, H: number, x0: number, y0: number, x1: number, y1: number): number {
  const ix0 = Math.max(0, Math.floor(x0 * W)), ix1 = Math.min(W, Math.ceil(x1 * W))
  const iy0 = Math.max(0, Math.floor(y0 * H)), iy1 = Math.min(H, Math.ceil(y1 * H))
  let sum = 0, n = 0
  for (let y = iy0; y < iy1; y += 1) for (let x = ix0; x < ix1; x += 1) { sum += gray[y * W + x]; n += 1 }
  if (!n) return 1
  const mean = sum / n
  let edges = 0
  for (let y = iy0; y < iy1; y += 1) for (let x = ix0; x < ix1; x += 1) { if (Math.abs(gray[y * W + x] - mean) > 22) edges += 1 }
  return edges / n
}

async function computePlacement(plan: CompositionPlan): Promise<Placement> {
  const aspect = (plan.format.width || 1080) / (plan.format.height || 1350)
  const seed = hashString(plan.fingerprint || plan.id)
  const sizePct = 17 + (seed % 3) * 2
  const iconW = sizePct / 100
  const iconH = iconW * aspect
  const inset = 0.045

  /* نرسم التصميم على لوحةٍ منخفضة الدقة ونستخرج الرمادي. */
  const RW = 132, RH = Math.round(RW / aspect)
  let gray: Uint8ClampedArray | null = null
  try {
    const svg = renderCompositionSvg(plan)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('svg')); img.src = url })
    const off = document.createElement('canvas'); off.width = RW; off.height = RH
    const octx = off.getContext('2d', { willReadFrequently: true })
    if (octx) {
      octx.drawImage(img, 0, 0, RW, RH)
      const data = octx.getImageData(0, 0, RW, RH).data
      gray = new Uint8ClampedArray(RW * RH)
      for (let i = 0; i < RW * RH; i += 1) gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114)
    }
  } catch { gray = null }

  /* مواضع مرشّحة: شبكةٌ من المراكز، كلٌّ يحمل مستطيل الأيقونة حوله. */
  const cols = [inset + iconW / 2, 0.5, 1 - inset - iconW / 2]
  const rows = [inset + iconH / 2, 0.30, 0.5, 0.70, 1 - inset - iconH / 2]
  type Cand = { cx: number; cy: number; score: number }
  const cands: Cand[] = []
  for (const cy of rows) for (const cx of cols) {
    const x0 = cx - iconW / 2, x1 = cx + iconW / 2, y0 = cy - iconH / 2, y1 = cy + iconH / 2
    if (x0 < inset - 0.01 || x1 > 1 - inset + 0.01 || y0 < inset - 0.01 || y1 > 1 - inset + 0.01) continue
    /* هامش أمانٍ حول الأيقونة يُقاس أيضاً كي لا تُلامس النص من الأطراف. */
    const pad = 0.02
    if (!gray) continue
    const score = busyness(gray, RW, RH, x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    cands.push({ cx, cy, score })
  }
  if (!cands.length) return { hide: true, top: 0, left: 0, size: sizePct }

  /* الأخلى أولاً؛ وعند التساوي نميل للأطراف بعيداً عن المركز، والبذرة تكسر التعادل. */
  cands.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.004) return a.score - b.score
    const da = Math.abs(a.cx - 0.5) + Math.abs(a.cy - 0.5)
    const db = Math.abs(b.cx - 0.5) + Math.abs(b.cy - 0.5)
    if (Math.abs(da - db) > 0.02) return db - da
    return ((seed % 7) - 3) * (a.cy - b.cy)
  })
  const best = cands[0]

  /* حذرٌ صريح: لو أخلى بقعةٍ ما زالت مزدحمة (>٥٪ حواف)، لا نضع أيقونة. */
  if (gray && best.score > 0.05) return { hide: true, top: 0, left: 0, size: sizePct }

  return { hide: false, top: best.cy - iconH / 2, left: best.cx - iconW / 2, size: sizePct }
}

export function LivingMetaphorIcon({ plan }: { plan: CompositionPlan }) {
  const [motion] = useLivingIconMotion()
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [manual, setManual] = useState<ManualPos | null>(() => readManualPos(plan))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const metaphor = useMemo(() => metaphorFor(plan), [plan])
  const colors = useMemo(() => {
    const pal = resolvePalette(plan)
    return { ink: pal.ink, dim: pal.muted, accent: pal.accent, accent2: pal.accentSoft || pal.accent, danger: pal.accent, surface: pal.surface, isDark: pal.isDark }
  }, [plan])

  /* عند تغيّر التصميم: نقرأ موضعه اليدوي إن وُجد، وإلا نحسب التلقائي بالبكسل. */
  useEffect(() => {
    const saved = readManualPos(plan)
    setManual(saved)
    if (saved) { setPlacement({ hide: false, top: saved.top, left: saved.left, size: saved.size }); return }
    let alive = true
    setPlacement(null)
    computePlacement(plan).then((next) => { if (alive) setPlacement(next) }).catch(() => { if (alive) setPlacement({ hide: true, top: 0, left: 0, size: 18 }) })
    return () => { alive = false }
  }, [plan])

  useEffect(() => {
    if (!placement || placement.hide) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const animate = motion && !reduce
    const S = 260
    canvas.width = S
    canvas.height = S
    let raf = 0
    const started = performance.now()
    const paint = { ink: colors.ink, dim: colors.dim, accent: colors.accent, accent2: colors.accent2, danger: colors.danger }
    const frame = () => {
      const t = animate ? (performance.now() - started) / 1000 : 0.9
      ctx.clearRect(0, 0, S, S)
      ctx.save()
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2)
      ctx.fillStyle = colors.surface
      ctx.globalAlpha = colors.isDark ? 0.42 : 0.66
      ctx.fill()
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 2
      ctx.strokeStyle = colors.accent
      ctx.stroke()
      ctx.restore()
      const prog = animate ? Math.min(1, ((performance.now() - started) / 1000 % 6) / 2.4) : 1
      paintMetaphor(ctx, metaphor, S / 2, S / 2, S * 0.6, t, prog, paint)
      if (animate) raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [metaphor, colors, placement, motion])

  /* السحب للتحريك، وسحب الزاوية للتكبير — بوحدات نسبية تُحفظ لكل تصميم. */
  const drag = (event: React.PointerEvent, mode: 'move' | 'resize') => {
    event.preventDefault()
    event.stopPropagation()
    const parent = wrapRef.current?.parentElement
    if (!parent || !placement) return
    const rect = parent.getBoundingClientRect()
    const aspect = rect.width / rect.height
    const start = { x: event.clientX, y: event.clientY, top: placement.top, left: placement.left, size: placement.size }
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const onMove = (moveEvent: PointerEvent) => {
      if (mode === 'move') {
        const dx = (moveEvent.clientX - start.x) / rect.width
        const dy = (moveEvent.clientY - start.y) / rect.height
        const sizeW = placement.size / 100
        const sizeH = sizeW * aspect
        const left = clamp(start.left + dx, 0, 1 - sizeW)
        const top = clamp(start.top + dy, 0, 1 - sizeH)
        setPlacement((prev) => (prev ? { ...prev, top, left } : prev))
      } else {
        const d = ((moveEvent.clientX - start.x) / rect.width + (moveEvent.clientY - start.y) / rect.height) / 2
        const size = clamp(start.size + d * 100, 8, 42)
        setPlacement((prev) => (prev ? { ...prev, size } : prev))
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setPlacement((prev) => {
        if (prev) { const pos = { top: prev.top, left: prev.left, size: prev.size }; writeManualPos(plan, pos); setManual(pos) }
        return prev
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resetAuto = (event: React.PointerEvent) => {
    event.preventDefault(); event.stopPropagation()
    clearManualPos(plan); setManual(null)
    setPlacement(null)
    computePlacement(plan).then(setPlacement).catch(() => setPlacement({ hide: true, top: 0, left: 0, size: 18 }))
  }

  if (!placement || placement.hide) return null

  return (
    <div
      ref={wrapRef}
      className="group absolute z-10 aspect-square max-w-[160px] min-w-14 cursor-move touch-none"
      style={{ top: `${(placement.top * 100).toFixed(2)}%`, left: `${(placement.left * 100).toFixed(2)}%`, width: `${placement.size}%` }}
      onPointerDown={(event) => drag(event, 'move')}
      title="اسحب لتحريكها · اسحب الزاوية لتكبيرها · ↺ للعودة للتلقائي"
    >
      <canvas ref={canvasRef} className="pointer-events-none h-full w-full drop-shadow" aria-hidden="true" />
      {/* إطارٌ خفيف يظهر عند التمرير ليدلّ أنها قابلة للتحريك. */}
      <span className="pointer-events-none absolute inset-0 rounded-full border border-accent/0 transition-colors group-hover:border-accent/50" />
      {/* مقبض التكبير في الزاوية السفلى. */}
      <span
        onPointerDown={(event) => drag(event, 'resize')}
        className="absolute -bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 cursor-nwse-resize rounded-full border-2 border-accent bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
        aria-label="تكبير/تصغير"
      />
      {/* زر العودة للتموضع التلقائي — يظهر فقط حين يكون هناك موضعٌ يدوي. */}
      {manual && (
        <button
          type="button"
          onPointerDown={resetAuto}
          className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full border border-accent bg-white text-[.62rem] font-bold text-accent opacity-0 shadow transition-opacity group-hover:opacity-100"
          title="عودة للتموضع التلقائي"
        >↺</button>
      )}
    </div>
  )
}
