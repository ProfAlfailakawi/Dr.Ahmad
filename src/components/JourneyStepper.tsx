import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { createPlayedStore, effectiveThreshold, journeyStepMs, journeyTarget, linkFilled, shownState, type JourneyState } from '../lib/journey-logic.ts'

export { journeyStepMs }
export type { JourneyState }

/**
 * محطّاتٌ تُضاء واحدةً بعد أخرى حين تدخل الشاشة، ثم تستقرّ على حالها الحقيقيّ.
 *
 * القاعدة: الحالة الممرَّرة (`done` / `current` / `pending`) هي الحقيقة. الحركة
 * لا تقرّر إلا «كم محطةً من الصادقة أُضيئت حتى الآن»؛ فلا تُملأ محطةٌ حالها
 * `pending`، ولا تتجاوز الحركةُ آخر محطةٍ منجزة أو جارية. وتُعرض مرةً واحدة
 * لكل تركيب (و`playKey` يمنع إعادتها عند العودة إلى الصفحة في الجلسة نفسها).
 *
 * الحالة الأولى للمكوّن (render الأول، أو بلا IntersectionObserver، أو مع تقليل الحركة)
 * هي الحالة النهائية كاملة. ملاحظة: صفحات الموقع الساكنة قشرةٌ لتطبيق React، فلا يُخرج
 * البناءُ ماركَب هذه المحطات بلا JS؛ والمقصود هنا ألا يكون ثمة وميضٌ للحالة الأخيرة
 * ولا إخفاءٌ لها حين لا تعمل الحركة.
 */

export type JourneyStation = {
  key: string
  state: JourneyState
  /** عنوان المحطة — يظهر في النمط `full` ويُقرأ لقارئ الشاشة في غيره. */
  label: string
  note?: string
  Icon?: ComponentType<{ 'aria-hidden'?: boolean; size?: string | number; strokeWidth?: number }>
}

const STATE_TEXT: Record<JourneyState, string> = { done: 'أُنجزت', current: 'الحالية', pending: 'لم تُنجز بعد' }

/** مفاتيح ما عُرض فعلاً في هذه الجلسة — لا يُعاد عرض المقدّمة عند العودة. */
const store = createPlayedStore(() => (typeof window === 'undefined' ? undefined : window.sessionStorage))
const alreadyPlayed = store.has
const markPlayed = store.mark

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** بعد آخر محطة تبقى الهالة قائمةً حتى تنتهي دورتها الوحيدة ثم تستقرّ. */
const SETTLE_MS = 1600

/**
 * `target`: عدد المحطات الصادقة الإضاءة (فهرس آخر محطة منجزة/جارية + 1).
 * يُرجع `lit`: عدد المحطات المضاءة حتى الآن، أو `null` = استقرّ فاعرض الحالات الحقيقية.
 */
export function useJourneyReveal({ target, stepMs, delayMs = 0, threshold = 0.5, enabled = true, playKey }: {
  target: number
  stepMs: number
  delayMs?: number
  threshold?: number
  enabled?: boolean
  playKey?: string
}) {
  /* الحالة الأولى null = النهائية: هكذا يخرج الإخراج بلا JS وفي أول رسم. */
  const [lit, setLit] = useState<number | null>(null)
  const [node, setNode] = useState<HTMLElement | null>(null)
  const targetRef = useRef(target)
  targetRef.current = target
  const stepMsRef = useRef(stepMs)
  stepMsRef.current = stepMs
  const ref = useCallback((el: HTMLElement | null) => setNode(el), [])

  useIsoLayoutEffect(() => {
    if (!node || !enabled) return
    if (typeof IntersectionObserver === 'undefined'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || alreadyPlayed(playKey)) return

    /* العتبة قد لا تُبلغ أبداً (عنصرٌ أطول من الشاشة، أو نافذةٌ قصيرة): فنُنزلها إلى
       ما يمكن بلوغه، وإن لم يكن للعنصر قياسٌ الآن فلا نُخفي حالته الحقيقية أصلاً. */
    const rect = node.getBoundingClientRect()
    if (!rect.height || !rect.width) return
    const effective = effectiveThreshold(threshold, rect.height, window.innerHeight)

    setLit(0) // قبل الرسم: لا وميض للحالة النهائية
    let count = 0
    let timer = 0
    let waited = 0
    let settling = false
    const settle = () => { markPlayed(playKey); setLit(null) }

    const tick = () => {
      const goal = targetRef.current
      if (count < goal) {
        count += 1
        setLit(count)
        timer = window.setTimeout(tick, stepMsRef.current)
      } else if (goal > 0) {
        // الهالة تُكمل دورتها الوحيدة ثم تستقرّ
        if (!settling) { settling = true; timer = window.setTimeout(settle, SETTLE_MS) }
      } else {
        // التقدّم قد يصل بعد التركيب (localStorage أو محتوى متأخر): ننتظره بصبر، فإن بدأ
        // (target من 0 إلى أكثر) تبدأ المقدّمة حينها. وكل المحطات «لم تُنجز» حالتها الحقيقية أصلاً.
        waited += 120
        if (waited > 4000) setLit(null) // لا تقدّم يأتي: استقرّ دون أن نعدّها عُرضت
        else timer = window.setTimeout(tick, 120)
      }
    }

    const observer = new IntersectionObserver((entries) => {
      // isIntersecting يصدق بمقدار بكسلٍ واحد؛ نشترط بلوغ العتبة الفعلية قبل البدء
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= effective - 0.01)) return
      observer.disconnect()
      timer = window.setTimeout(tick, delayMs + 120)
    }, { threshold: effective, rootMargin: '0px 0px -8% 0px' })
    observer.observe(node)

    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
      setLit(null)
    }
    // التشغيل مرةً لكل عنصر؛ target وstepMs يُقرآن عبر مرجع كي لا تُعاد الحركة عند تغيّر البيانات.
  }, [node, enabled, playKey, delayMs, threshold])

  return { ref, lit }
}

export type JourneyVariant = 'full' | 'dots' | 'strip'

/**
 * - `full`: أيقونة وعنوان وملاحظة؛ أفقيّ من `md`، وعموديّ على الهاتف.
 * - `dots`: نقاطٌ موصولة بخطوط (بطاقات المسارات) — بلا نص.
 * - `strip`: شريطٌ مضغوط بأرقام المحطات (تفاصيل المسار).
 */
export function JourneyStepper({ steps, variant = 'full', label, playKey, delayMs = 0, animate = true, decorative = false, stateText, className = '' }: {
  steps: JourneyStation[]
  variant?: JourneyVariant
  label?: string
  playKey?: string
  /** تأخير بدء التسلسل (تتابعٌ بين بطاقاتٍ متجاورة). */
  delayMs?: number
  animate?: boolean
  /** زخرفيّ: يُخفى عن قارئ الشاشة (النص الحقيقيّ موجودٌ حوله). */
  decorative?: boolean
  /** نصّ الحالة لقارئ الشاشة؛ يُستبدل حين لا يناسب «أُنجزت» (كشرحٍ ثابتٍ لا تقدّمٍ لأحد). */
  stateText?: Partial<Record<JourneyState, string>>
  className?: string
}) {
  const target = journeyTarget(steps.map((step) => step.state))
  const stepMs = journeyStepMs(steps.length)
  const texts = { ...STATE_TEXT, ...stateText }
  const { ref, lit } = useJourneyReveal({
    target,
    stepMs,
    delayMs,
    enabled: animate && steps.length > 0,
    playKey,
    threshold: variant === 'full' ? 0.6 : 0.9,
  })

  const shown = steps.map((step, index) => shownState(step.state, index, lit))

  return (
    <ol
      ref={ref as (el: HTMLOListElement | null) => void}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      data-journey={variant}
      data-reveal={lit ?? 'done'}
      style={{ ['--journey-n' as string]: steps.length, ['--journey-step' as string]: `${stepMs}ms` } as CSSProperties}
      className={`journey journey--${variant} ${className}`.trim()}
    >
      {steps.map((step, index) => {
        const state = shown[index]
        const link = index < steps.length - 1
        const just = lit !== null && lit > 0 && index === lit - 1 && state !== 'pending'
        /* الأخيرة تأخذ الهالة كاملةً قبل الاستقرار؛ ما قبلها هالةٌ أقصر من زمن المحطة فلا تُقطع. */
        const last = just && lit === target
        const { Icon } = step
        return (
          <li
            key={step.key}
            className="journey__item"
            data-state={state}
            data-just={just || undefined}
            data-last={last || undefined}
            data-link={linkFilled(shown, index) ? 'on' : undefined}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="journey__node">
              {variant === 'strip' ? <span className="journey__num">{index + 1}</span> : Icon && variant === 'full' ? <Icon aria-hidden size="1.1rem" strokeWidth={1.6} /> : null}
            </span>
            {link && <span className="journey__link" aria-hidden="true" />}
            {variant === 'full' ? (
              <span className="journey__text">
                <span className="journey__index">{index + 1}</span>
                <span className="journey__title">{step.label}</span>
                {step.note && <span className="journey__note">{step.note}</span>}
                {!decorative && <span className="sr-only">{` — ${texts[step.state]}`}</span>}
              </span>
            ) : null}
            {!decorative && variant !== 'full' && <span className="sr-only">{`${index + 1}. ${step.label} — ${texts[step.state]}`}</span>}
          </li>
        )
      })}
    </ol>
  )
}
