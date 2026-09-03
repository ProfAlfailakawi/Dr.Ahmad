/**
 * تحريك الكلمات — «وضع الترتيب»: حين يُفعَّل، تظهر مقابض شفافة فوق كل كتلة نصية
 * في التصميم (العنوان، الاسم، المصدر، الشارة، المتن…). يمسك الدكتور الكلمة
 * ويسحبها لأي مكان، فتُحفظ لهذا التصميم وتُخبز في المنشور المُصدَّر تماماً كما
 * وضعها. زرٌّ واحد يرجّع كل الكلمات لمكانها الأصلي. لا يمسّ جمال التصميم؛ النص
 * يبقى نص SVG حقيقياً، إنما يُزاح بمقدارٍ محفوظ.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type CompositionPlan } from '../../lib/social-design-engine'
import { readWordOffsets, writeWordOffset, clearWordOffsets } from '../../lib/design-overrides'

const MOVE_KEY = 'reel:move-words:v1'
const MOVE_EVENT = 'move-words-change'

function readMoveEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(MOVE_KEY) === 'on'
}

export function useMoveWordsEnabled(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState<boolean>(readMoveEnabled)
  useEffect(() => {
    const sync = () => setOn(readMoveEnabled())
    window.addEventListener(MOVE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(MOVE_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  const update = (next: boolean) => {
    try { localStorage.setItem(MOVE_KEY, next ? 'on' : 'off') } catch { /* محجوب */ }
    setOn(next)
    window.dispatchEvent(new Event(MOVE_EVENT))
  }
  return [on, update]
}

/** مفتاح وضع الترتيب — يظهر بجانب مفتاح الأيقونة. */
export function MoveWordsToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useMoveWordsEnabled()
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      aria-pressed={on}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[.68rem] font-semibold transition-colors ${on ? 'border-accent bg-accent/[.08] text-accent' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'} ${className}`}
      title="حرّك الكلمات: اسحب أي كلمة في التصميم لمكانها الجديد — يُحفظ ويُخبز في المنشور"
    >
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${on ? 'bg-accent' : 'bg-soft/40'}`} />
      تحريك الكلمات {on ? 'مفعّل' : 'متوقف'}
    </button>
  )
}

interface Handle { wk: string; left: number; top: number; width: number; height: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * الطبقة التفاعلية: تُوضع داخل حاوية المعاينة (نسبيّة). تقيس مواضع كتل النص من
 * الـSVG الحيّ وترسم فوقها مقابض شفافة قابلة للسحب. تُعرَض فقط في وضع الترتيب.
 */
export function MovableWordsLayer({ plan }: { plan: CompositionPlan }) {
  const [enabled] = useMoveWordsEnabled()
  const rootRef = useRef<HTMLDivElement>(null)
  const [handles, setHandles] = useState<Handle[]>([])
  const [tick, setTick] = useState(0)
  const [hasOffsets, setHasOffsets] = useState(false)

  const measure = () => {
    const container = rootRef.current?.parentElement
    const svg = container?.querySelector('svg') as SVGSVGElement | null
    if (!container || !svg) { setHandles([]); return }
    const cr = container.getBoundingClientRect()
    if (!cr.width || !cr.height) { setHandles([]); return }
    const groups = Array.from(svg.querySelectorAll('g.dw[data-wk]')) as SVGGElement[]
    const next: Handle[] = []
    const seen = new Set<string>()
    for (const g of groups) {
      const wk = g.getAttribute('data-wk')
      if (!wk || seen.has(wk)) continue
      seen.add(wk)
      const r = g.getBoundingClientRect()
      if (r.width < 3 || r.height < 3) continue
      next.push({ wk, left: (r.left - cr.left) / cr.width, top: (r.top - cr.top) / cr.height, width: r.width / cr.width, height: r.height / cr.height })
    }
    setHandles(next)
    setHasOffsets(Object.keys(readWordOffsets(plan)).length > 0)
  }

  useLayoutEffect(() => { if (enabled) measure(); else setHandles([]) }, [plan, enabled, tick])

  useEffect(() => {
    if (!enabled) return
    const container = rootRef.current?.parentElement
    if (!container) return
    const ro = new ResizeObserver(() => setTick((t) => t + 1))
    ro.observe(container)
    return () => ro.disconnect()
  }, [plan, enabled])

  const drag = (event: React.PointerEvent, handle: Handle) => {
    event.preventDefault(); event.stopPropagation()
    const container = rootRef.current?.parentElement
    const svg = container?.querySelector('svg') as SVGSVGElement | null
    const group = svg?.querySelector(`g.dw[data-wk="${handle.wk}"]`) as SVGGElement | null
    if (!container || !svg || !group) return
    const cr = container.getBoundingClientRect()
    const W = svg.viewBox.baseVal.width || plan.format.width || 1080
    const H = svg.viewBox.baseVal.height || plan.format.height || 1080
    const base = readWordOffsets(plan)[handle.wk] || { dx: 0, dy: 0 }
    const start = { x: event.clientX, y: event.clientY }
    let committed = base
    const onMove = (moveEvent: PointerEvent) => {
      const fracX = (moveEvent.clientX - start.x) / cr.width
      const fracY = (moveEvent.clientY - start.y) / cr.height
      const left = clamp(handle.left + fracX, 0, 1 - handle.width)
      const top = clamp(handle.top + fracY, 0, 1 - handle.height)
      const dx = base.dx + (left - handle.left)
      const dy = base.dy + (top - handle.top)
      committed = { dx, dy }
      group.setAttribute('transform', `translate(${Math.round(dx * W)} ${Math.round(dy * H)})`)
      setHandles((prev) => prev.map((h) => (h.wk === handle.wk ? { ...h, left, top } : h)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      writeWordOffset(plan, handle.wk, committed)
      setHasOffsets(true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resetAll = (event: React.PointerEvent) => {
    event.preventDefault(); event.stopPropagation()
    const container = rootRef.current?.parentElement
    const svg = container?.querySelector('svg')
    svg?.querySelectorAll('g.dw[data-wk]').forEach((g) => g.removeAttribute('transform'))
    clearWordOffsets(plan)
    setHasOffsets(false)
    setTick((t) => t + 1)
  }

  if (!enabled) return <div ref={rootRef} className="hidden" />

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-20">
      {handles.map((h) => (
        <span
          key={h.wk}
          onPointerDown={(event) => drag(event, h)}
          className="pointer-events-auto absolute cursor-move rounded-[3px] border border-dashed border-accent/0 transition-colors hover:border-accent/70 hover:bg-accent/[.06]"
          style={{ left: `${h.left * 100}%`, top: `${h.top * 100}%`, width: `${h.width * 100}%`, height: `${h.height * 100}%` }}
          title="اسحب هذه الكلمة"
        />
      ))}
      {hasOffsets && (
        <button
          type="button"
          onPointerDown={resetAll}
          className="pointer-events-auto absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full border border-accent bg-white/95 px-2.5 py-1 text-[.6rem] font-bold text-accent shadow"
          title="أعد كل الكلمات لأماكنها الأصلية"
        >↺ رجّع الكلمات</button>
      )}
    </div>
  )
}
