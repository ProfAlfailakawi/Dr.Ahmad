import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * «الكتاب المفتوح» للمقال: في وضع الكتاب (صفحتان) يجري النص أعمدةً داخل نافذة
 * بارتفاع الشاشة، فيملأ عمودٌ كل صفحة ثم ينتقل إلى الصفحة التي بجانبها، ثم
 * تُقلَب الورقة. التقليب أفقي (سحب أو أسهم) ويستقر دائماً على ورقة كاملة.
 * الشرط نفسه في index.css (BOOK)، ولا يُعمل به خارجه إطلاقاً.
 */
export const BOOK_QUERY =
  'screen and (min-width:721px) and (max-width:1000px) and (min-height:520px) and (max-height:960px) and (orientation:landscape)'

/** حتى متى يجري تقليب برمجي (ms): أثناءه لا نعيد التثبيت فنقطع الحركة. */
const animating = new WeakMap<Element, number>()

const isRtl = (el: Element) => getComputedStyle(el).direction === 'rtl'

/** هل النافذة تعمل فعلاً كمقياس أفقي للكتاب (لا مجرد عنصر عادي)؟ */
export function isBookFlow(flow: Element | null): flow is HTMLElement {
  return !!flow && getComputedStyle(flow).overflowX === 'auto' && getComputedStyle(flow).columnCount !== 'auto'
}

/** مسافة ورقة كاملة: عرض النافذة + فجوة العمودين. */
export function bookFlowStep(flow: HTMLElement) {
  const gap = parseFloat(getComputedStyle(flow).columnGap) || 0
  return flow.clientWidth + gap
}

export function bookFlowSpread(flow: HTMLElement) {
  const step = bookFlowStep(flow)
  return step > 0 ? Math.round(Math.abs(flow.scrollLeft) / step) : 0
}

export function bookFlowSpreads(flow: HTMLElement) {
  const step = bookFlowStep(flow)
  return step > 0 ? Math.max(1, Math.ceil((flow.scrollWidth - 2) / step)) : 1
}

export function bookFlowGo(flow: HTMLElement, spread: number, smooth = true) {
  const last = bookFlowSpreads(flow) - 1
  const n = Math.min(last, Math.max(0, spread))
  const left = (isRtl(flow) ? -1 : 1) * n * bookFlowStep(flow)
  animating.set(flow, smooth ? performance.now() + 900 : 0)
  flow.scrollTo({ left, behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior) })
}

/** يقلّب إلى الورقة التي فيها العنصر (مثلاً بعد إعادة التخطيط أو القفز لمقطع). */
export function bookFlowReveal(el: Element, smooth = false) {
  const flow = el.closest<HTMLElement>('[data-book-flow]')
  if (!isBookFlow(flow)) return false
  const step = bookFlowStep(flow)
  if (step <= 0) return false
  const f = flow.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const off = isRtl(flow) ? f.right - r.right + Math.abs(flow.scrollLeft) : r.left - f.left + Math.abs(flow.scrollLeft)
  bookFlowGo(flow, Math.floor((off + 1) / step), smooth)
  return true
}

export function useBookMedia() {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(BOOK_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(BOOK_QUERY)
    const h = () => setOn(mq.matches)
    h()
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return on
}

/** ترقيم الأوراق وتقليبها وتثبيتها على الورقة الكاملة. */
export function useBookPaging(ref: RefObject<HTMLElement | null>, resetKey: string) {
  const book = useBookMedia()
  const [state, setState] = useState({ spread: 0, spreads: 1 })

  const measure = useCallback(() => {
    const flow = ref.current
    if (!flow || !isBookFlow(flow)) return
    setState((s) => {
      const n = { spread: bookFlowSpread(flow), spreads: bookFlowSpreads(flow) }
      return n.spread === s.spread && n.spreads === s.spreads ? s : n
    })
  }, [ref])

  useEffect(() => {
    const flow = ref.current
    if (!book || !flow) return
    flow.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior })
    let idle = 0
    const settle = () => {
      if (performance.now() < (animating.get(flow) ?? 0)) { idle = window.setTimeout(settle, 160); return }
      const step = bookFlowStep(flow)
      if (step <= 0) return
      const abs = Math.abs(flow.scrollLeft)
      const target = Math.min(bookFlowSpreads(flow) - 1, Math.max(0, Math.round(abs / step))) * step
      if (Math.abs(abs - target) > 1.5) bookFlowGo(flow, Math.round(abs / step))
      measure()
    }
    const onScroll = () => { measure(); window.clearTimeout(idle); idle = window.setTimeout(settle, 140) }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const forward = (e.key === 'ArrowLeft') === isRtl(flow)
      bookFlowGo(flow, bookFlowSpread(flow) + (forward ? 1 : -1))
    }
    flow.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    const ro = new ResizeObserver(() => { measure(); settle() })
    ro.observe(flow)
    flow.childNodes.forEach((c) => { if (c.nodeType === 1) ro.observe(c as Element) })
    // الصور والخطوط تغيّر عدد الأعمدة بعد التحميل.
    const late = window.setTimeout(measure, 1200)
    measure()
    return () => {
      window.clearTimeout(idle); window.clearTimeout(late)
      flow.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKey)
      ro.disconnect()
    }
  }, [book, ref, measure, resetKey])

  const go = useCallback((delta: number) => {
    const flow = ref.current
    if (flow) bookFlowGo(flow, bookFlowSpread(flow) + delta)
  }, [ref])

  return { book, ...state, go }
}
