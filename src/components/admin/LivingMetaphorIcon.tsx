/**
 * الأيقونة الحيّة — استعارةٌ من مكتبة الريل (٥٣ صورة) تُختار بحسب معنى التصميم
 * من معجم الدكتور، أو يدوياً من المنتقي، وتتحرّك بألوان التصميم نفسه في زاويته.
 *
 * تُستعمل في استوديو التصاميم والمنشور المستقل معاً عبر مكوّنٍ واحد. لها مفتاح
 * تشغيل/إيقاف، ومفتاح حركة، ومنتقٍ لتبديل الصورة. تُسحب لتتحرّك وتُكبَّر بزاويتها.
 * وموضعها الفعلي يُخزَّن كي يُخبز في PNG المُصدَّر — فما تراه هو ما يُنشر.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { paintMetaphor, METAPHOR_IDS, type MetaphorId } from '../../lib/reel-metaphors'
import { resolvePalette, type CompositionPlan } from '../../lib/social-design-engine'
import { renderCompositionSvg } from '../../lib/social-design-renderer'
import {
  LIVING_ICON_CHANGE, METAPHOR_LABELS_AR,
  readManualPos, writeManualPos, clearManualPos, writeEffectivePlacement,
  readMetaphorChoice, writeMetaphorChoice, resolveMetaphor, emitLivingIconChange,
  type ManualPos,
} from '../../lib/design-overrides'

const STORAGE_KEY = 'reel:living-icon:v1'
const MOTION_KEY = 'reel:living-icon-motion:v1'
const CHANGE_EVENT = LIVING_ICON_CHANGE

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
        title="أيقونة حيّة تُختار من المكتبة بحسب معنى التصميم — تظهر في المعاينة وتُخبز في المنشور، وتتجنّب النص"
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

/* ------------------------------------------------------------------ */
/*        منتقي الصورة — يبدّل استعارة الأيقونة من مكتبة الـ٥٣          */
/* ------------------------------------------------------------------ */

/** مربّعٌ صغير يرسم استعارةً ثابتة بلونٍ محايد — لبطاقة المنتقي. */
function MetaphorThumb({ id, active }: { id: MetaphorId; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const S = 96
    canvas.width = S; canvas.height = S
    ctx.clearRect(0, 0, S, S)
    const ink = active ? '#8A3B2E' : '#3A3F4E'
    paintMetaphor(ctx, id, S / 2, S / 2, S * 0.66, 0.9, 1, { ink, dim: '#9AA0AE', accent: '#8A3B2E', accent2: '#C08457', danger: '#8A3B2E' })
  }, [id, active])
  return <canvas ref={ref} className="h-11 w-11" aria-hidden="true" />
}

/** المنتقي: زرٌّ يفتح شبكةَ الصور؛ اختيارٌ يبدّل صورة الأيقونة لهذا التصميم. */
export function LivingIconPicker({ plan, className = '' }: { plan: CompositionPlan; className?: string }) {
  const [enabled] = useLivingIconEnabled()
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<MetaphorId | null>(() => readMetaphorChoice(plan))
  useEffect(() => { setChoice(readMetaphorChoice(plan)) }, [plan])
  useEffect(() => {
    const sync = () => setChoice(readMetaphorChoice(plan))
    window.addEventListener(CHANGE_EVENT, sync)
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [plan])
  if (!enabled) return null
  const pick = (id: MetaphorId | null) => {
    writeMetaphorChoice(plan, id)
    setChoice(id)
    emitLivingIconChange()
    setOpen(false)
  }
  const current = resolveMetaphor(plan)
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.66rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent"
        title="بدّل صورة الأيقونة من المكتبة"
      >
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent/70" />
        الصورة: {METAPHOR_LABELS_AR[current]}{choice ? '' : ' (تلقائي)'}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 max-h-[19rem] w-[19rem] overflow-y-auto rounded-2xl border border-hair bg-white p-2 shadow-xl">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[.66rem] font-bold text-ink">اختر صورة من المكتبة</span>
            <button type="button" onClick={() => pick(null)} className={`rounded-full border px-2.5 py-1 text-[.6rem] font-semibold transition-colors ${choice ? 'border-hair text-soft hover:border-accent hover:text-accent' : 'border-accent bg-accent/[.08] text-accent'}`} title="اترك الاختيار للنظام بحسب معنى النص">↺ تلقائي</button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {METAPHOR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border p-1 transition-colors ${current === id ? 'border-accent bg-accent/[.06]' : 'border-transparent hover:border-hair hover:bg-canvas'}`}
                title={METAPHOR_LABELS_AR[id]}
              >
                <MetaphorThumb id={id} active={current === id} />
                <span className="w-full truncate text-center text-[.52rem] leading-tight text-soft">{METAPHOR_LABELS_AR[id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*                      الأيقونة الحيّة على المعاينة                    */
/* ------------------------------------------------------------------ */

interface Placement { hide: boolean; top: number; left: number; size: number }

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193) }
  return hash >>> 0
}

/* يقيس ازدحام مستطيلٍ على صورة الرمادي: نسبة البكسلات المنحرفة عن المتوسّط. */
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

  const cols = [inset + iconW / 2, 0.5, 1 - inset - iconW / 2]
  const rows = [inset + iconH / 2, 0.30, 0.5, 0.70, 1 - inset - iconH / 2]
  type Cand = { cx: number; cy: number; score: number }
  const cands: Cand[] = []
  for (const cy of rows) for (const cx of cols) {
    const x0 = cx - iconW / 2, x1 = cx + iconW / 2, y0 = cy - iconH / 2, y1 = cy + iconH / 2
    if (x0 < inset - 0.01 || x1 > 1 - inset + 0.01 || y0 < inset - 0.01 || y1 > 1 - inset + 0.01) continue
    const pad = 0.02
    if (!gray) continue
    const score = busyness(gray, RW, RH, x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    cands.push({ cx, cy, score })
  }
  if (!cands.length) return { hide: true, top: 0, left: 0, size: sizePct }

  cands.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.004) return a.score - b.score
    const da = Math.abs(a.cx - 0.5) + Math.abs(a.cy - 0.5)
    const db = Math.abs(b.cx - 0.5) + Math.abs(b.cy - 0.5)
    if (Math.abs(da - db) > 0.02) return db - da
    return ((seed % 7) - 3) * (a.cy - b.cy)
  })
  const best = cands[0]
  if (gray && best.score > 0.05) return { hide: true, top: 0, left: 0, size: sizePct }
  return { hide: false, top: best.cy - iconH / 2, left: best.cx - iconW / 2, size: sizePct }
}

export function LivingMetaphorIcon({ plan }: { plan: CompositionPlan }) {
  const [motion] = useLivingIconMotion()
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [manual, setManual] = useState<ManualPos | null>(() => readManualPos(plan))
  const [choiceVersion, setChoiceVersion] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const metaphor = useMemo(() => resolveMetaphor(plan), [plan, choiceVersion])
  const colors = useMemo(() => {
    const pal = resolvePalette(plan)
    return { ink: pal.ink, dim: pal.muted, accent: pal.accent, accent2: pal.accentSoft || pal.accent, danger: pal.accent, surface: pal.surface, isDark: pal.isDark }
  }, [plan])

  /* تبديل الصورة من المنتقي يصل عبر هذا الحدث فتُعاد الأيقونة فوراً. */
  useEffect(() => {
    const sync = () => setChoiceVersion((v) => v + 1)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

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

  /* نخزّن الموضع الفعلي المعروض كي يقرأه التصدير فيخبز الأيقونة في PNG. */
  useEffect(() => {
    if (!placement) return
    writeEffectivePlacement(plan, { top: placement.top, left: placement.left, size: placement.size, hidden: placement.hide })
  }, [plan, placement])

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
      if (animate) {
        /* مدارٌ واضح لكن هادئ يجعل الحركة مقروءة حتى حين تكون الاستعارة نفسها
           ساكنة في طورها المكتمل؛ كان الثبات الطويل يوهم أن الأيقونة صورة. */
        const angle = t * .82
        const radius = S * .405
        ctx.save()
        ctx.globalAlpha = .42
        ctx.strokeStyle = colors.accent2
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 9])
        ctx.beginPath(); ctx.arc(S / 2, S / 2, radius, angle, angle + Math.PI * 1.35); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = colors.accent
        ctx.shadowColor = colors.accent
        ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(S / 2 + Math.cos(angle) * radius, S / 2 + Math.sin(angle) * radius, 4.5, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
      const cycle = animate ? t % 6 : 3
      const prog = !animate ? 1 : cycle < 2.1 ? Math.min(1, cycle / 2.1) : cycle < 4.8 ? 1 : Math.max(0, 1 - (cycle - 4.8) / 1.2)
      const breathe = animate ? .97 + .03 * Math.sin(t * 1.6) : 1
      paintMetaphor(ctx, metaphor, S / 2, S / 2, S * 0.6 * breathe, t, prog, paint)
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
      <span className="pointer-events-none absolute inset-0 rounded-full border border-accent/0 transition-colors group-hover:border-accent/50" />
      <span
        onPointerDown={(event) => drag(event, 'resize')}
        className="absolute -bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 cursor-nwse-resize rounded-full border-2 border-accent bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
        aria-label="تكبير/تصغير"
      />
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
