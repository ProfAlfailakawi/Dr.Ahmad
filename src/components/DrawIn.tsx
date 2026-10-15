import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPlayedStore, effectiveThreshold } from '../lib/journey-logic.ts'
import { countAt, shouldFlash } from '../lib/draw-logic.ts'

/**
 * الرسم عند الظهور — حركةٌ تُروي ولا تُلفت: أعمدةٌ ترتفع، وحلقاتٌ تُرسم، وأعدادٌ تصل،
 * مرةً واحدة لكل جلسة، ثم تستقرّ على حالها الحقيقيّ.
 *
 * القاعدة (كما في JourneyStepper): الحالة الأولى `rest` هي النهائية كاملة — بلا JS، أو بلا
 * IntersectionObserver، أو مع تقليل الحركة، أو بعد أن عُرضت — فلا يُخفى شيءٌ بالافتراض.
 * `wait` تُطبَّق قبل الرسم الأول فقط حين يقرّر JS أن يعرض، و`go` حين يدخل العنصر الشاشة.
 * الأنماط في src/index.css (قسم «رسم عند الظهور»)، بمنحنى الموقع الوحيد `--E`.
 */

export type DrawPhase = 'rest' | 'wait' | 'go'

const store = createPlayedStore(() => (typeof window === 'undefined' ? undefined : window.sessionStorage))
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function useDrawIn(playKey?: string, threshold = 0.4) {
  const [phase, setPhase] = useState<DrawPhase>('rest')
  const [node, setNode] = useState<Element | null>(null)
  const ref = useCallback((el: Element | null) => setNode(el), [])

  useIsoLayoutEffect(() => {
    if (!node) return
    if (typeof IntersectionObserver === 'undefined'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.classList.contains('site-silent')
      || store.has(playKey)) return
    const rect = node.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const effective = effectiveThreshold(threshold, rect.height, window.innerHeight)

    setPhase('wait')
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= effective - 0.01)) return
      observer.disconnect()
      store.mark(playKey)
      setPhase('go')
    }, { threshold: effective, rootMargin: '0px 0px -8% 0px' })
    observer.observe(node)
    return () => { observer.disconnect(); setPhase('rest') }
  }, [node, playKey, threshold])

  /** تُنشر على العنصر الحاوي: `<div {...draw.props}>` — الأبناء بأصناف dw-* يتبعونها. */
  const props = { ref, 'data-draw': phase === 'rest' ? undefined : phase } as { ref: typeof ref; 'data-draw'?: 'wait' | 'go' }
  return { ref, phase, props }
}

/** أسلوب تأخير عنصرٍ في تتابع (بالميلي ثانية). */
export const drawDelay = (ms: number) => ({ ['--dw-d' as string]: `${Math.round(ms)}ms` }) as CSSProperties

/** قيمة عدّادٍ متحرّكة: 0 → value مرةً واحدة حين تصير المرحلة go، وبعدها تتبع القيمة فوراً بلا إعادة عدّ. */
export function useCountValue(value: number, phase: DrawPhase, ms = 700) {
  const [shown, setShown] = useState<number | null>(null)
  const finished = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (phase !== 'go' || finished.current) return
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      if (t >= 1) { finished.current = true; setShown(null); return }
      setShown(countAt(valueRef.current, t))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, ms])

  /* wait وgo قبل بدء العدّ: صفر (لا وميض للقيمة النهائية)؛ بعد اكتمال العدّ أو في الراحة: القيمة الحقيقية دائماً */
  if (phase !== 'rest' && !finished.current) return shown ?? 0
  return value
}

/**
 * عدّاد: يُمرَّر `phase` من useDrawIn للحاوي. `format` هو المنسِّق نفسه الذي تستعمله الشاشة
 * (أرقام لاتينية في الواجهة العامة). لقارئ الشاشة القيمة النهائية دائماً لا الأرقام الوسيطة.
 */
export function CountUp({ value, phase, format = String, ms = 700, className }: {
  value: number
  phase: DrawPhase
  format?: (n: number) => string
  ms?: number
  className?: string
}) {
  const shown = useCountValue(value, phase, ms)
  if (phase === 'rest' || shown === value) return <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(value)}</span>
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

/**
 * وميضُ تغيّرٍ حقيقيّ: true نحو ثانيةٍ وثلثٍ حين تتغيّر القيمة بعد التركيب (لا عند أول عرض،
 * ولا عند ترطيب التخزين المحلي بعد التركيب مباشرة). لا يتكرر ولا يدور.
 */
export function useChangeFlash(value: number | string, holdMs = 1300) {
  const [flash, setFlash] = useState(false)
  const previous = useRef<number | string>(value)
  const [mountedAt] = useState(() => (typeof performance === 'undefined' ? 0 : performance.now()))

  useEffect(() => {
    const before = previous.current
    previous.current = value
    if (!shouldFlash(before, value, performance.now() - mountedAt)) return
    setFlash(true)
    const timer = window.setTimeout(() => setFlash(false), holdMs)
    return () => window.clearTimeout(timer)
  }, [value, holdMs, mountedAt])

  return flash
}

/**
 * المفتاح المضاف حديثاً إلى مجموعةٍ بعد التركيب (محطةٌ أُنجزت الآن)، أو null.
 * يبقى نحو ثانيةٍ وثلث ثم يزول. لا يُطلق عند أول عرض ولا عند الترطيب السريع، ولا عند الحذف.
 */
export function useNewlyAdded(keys: readonly string[], holdMs = 1300) {
  const [added, setAdded] = useState<string | null>(null)
  const previous = useRef<ReadonlySet<string>>(new Set(keys))
  const [mountedAt] = useState(() => (typeof performance === 'undefined' ? 0 : performance.now()))
  const timer = useRef(0)
  const signature = [...keys].sort().join('\u0001')

  useEffect(() => {
    const before = previous.current
    previous.current = new Set(keys)
    if (performance.now() - mountedAt <= 600) return
    const fresh = keys.find((key) => !before.has(key))
    if (fresh === undefined) return
    window.clearTimeout(timer.current)
    setAdded(fresh)
    timer.current = window.setTimeout(() => setAdded(null), holdMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  useEffect(() => () => window.clearTimeout(timer.current), [])
  return added
}
