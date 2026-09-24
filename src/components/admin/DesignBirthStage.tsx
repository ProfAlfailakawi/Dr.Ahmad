import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { playDesignBirth, type BirthController, type BirthPhase } from './design-birth'

/* ═══════════ لحظة الولادة: التصميم الحقيقي يبني نفسه أمام العين ═══════════
   عند اكتمال التوليد لا تظهر النتيجة قفزةً واحدة: عناصر لوحة SVG نفسها —
   المسرح ثم الأسطر بترتيب القراءة ثم المساطر ثم الختم — تجتمع من شتاتٍ
   حتميّ إلى مواضعها الفعلية (design-birth.ts). لا نسخ تقريبية ولا تسليم،
   فلا قفزة. مرةً لكل بصمة تصميم في الجلسة؛ نقرةٌ أو Escape تُظهره فوراً؛
   و«شاهد ولادته» تعيدها متى شئت. لا تعمل إطلاقاً مع تفضيل تقليل الحركة. */

const bornFingerprints = new Set<string>()
const prefersStillness = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export function DesignBirthStage({ fingerprint, children }: { fingerprint: string; children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const birth = useRef<BirthController | null>(null)
  const [phase, setPhase] = useState<BirthPhase>('done')
  const [replayable] = useState(() => !prefersStillness())

  const begin = () => {
    birth.current?.cancel()
    const svg = stageRef.current?.querySelector<SVGSVGElement>('svg')
    if (!svg) { setPhase('done'); return }
    setPhase('playing')
    birth.current = playDesignBirth(svg, fingerprint, setPhase)
  }

  /* قبل أوّل رسم: التصميم لا يومض مكتملاً ثم يتبعثر — يولد من أوّل إطار. */
  useLayoutEffect(() => {
    if (prefersStillness() || bornFingerprints.has(fingerprint)) return
    bornFingerprints.add(fingerprint)
    begin()
    return () => { birth.current?.cancel(); birth.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- الولادة مرتبطة بالبصمة وحدها
  }, [fingerprint])

  const assembling = phase !== 'done'
  useEffect(() => {
    if (!assembling) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') birth.current?.finish() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [assembling])

  return (
    <div
      ref={stageRef}
      className="design-birth relative"
      data-birth={phase}
      aria-busy={assembling || undefined}
      title={assembling ? 'انقر لإظهار التصميم فوراً' : undefined}
      onPointerDownCapture={assembling ? () => birth.current?.finish() : undefined}
    >
      {children}
      {replayable && !assembling && (
        <button
          type="button"
          onClick={begin}
          className="design-birth-replay absolute bottom-3 left-3 z-20 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-hair bg-canvas/[.92] px-3.5 text-[.64rem] font-semibold text-soft backdrop-blur hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="أعد عرض ولادة التصميم"
        >
          <span aria-hidden="true">↺</span>
          شاهد ولادته
        </button>
      )}
    </div>
  )
}
