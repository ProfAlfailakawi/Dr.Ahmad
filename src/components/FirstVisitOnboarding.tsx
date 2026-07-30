import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { EASE } from './ui'

const STORAGE_KEY = 'site:first-visit-onboarding:seen'

const steps = [
  {
    eyebrow: 'أهلاً بك',
    title: 'هذا ليس موقعاً يعرض ما كُتب فقط؛ بل يريك كيف تعيش الفكرة.',
    body: 'مساحة تجمع التعليم والتكنولوجيا والإنسان في أرشيف واحد؛ المقال يقود إلى بحث، والكتاب يفتح أسئلة، وما كُتب قبل سنوات يمكن أن يعود اليوم بمعنى جديد.',
  },
  {
    eyebrow: 'تحت السطح',
    title: 'بعض أقوى أدوات الموقع لا تحتاج أن تصرخ كي تكون موجودة.',
    body: 'داخل القراءة ستجد طبقات تظهر وقت الحاجة فقط؛ صُممت لتخدم الفكرة لا لتزاحمها.',
    features: [
      ['حياة الفكرة', 'ترى امتداد الفكرة في المقالات والكتب والأبحاث المرتبطة بها.'],
      ['عبر السنوات', 'حدّد جملة داخل مقال لتتبع صداها في الأرشيف عبر الزمن.'],
      ['اسأل المكتبة', 'انتقل من سؤال قصير إلى مواد موثقة في الأرشيف من دون أن تضيع بين القوائم.'],
      ['قراءة بصوت آخر', 'حين يتوافر الصوت، تستمع للمقال أو للحوار من المكان نفسه.'],
    ],
  },
  {
    eyebrow: 'فلسفة التصفح',
    title: 'ابدأ بما يثير فضولك، لا بما تفرضه القائمة.',
    body: 'يمكنك الدخول من مقال أو بحث أو كتاب أو «وثيقة العقد». الموقع مصمم كي تكشف الروابط بنفسك، بهدوء، من دون أن يحوّل المعرفة إلى لوحة أزرار.',
  },
] as const

function rememberSeen() {
  try { window.localStorage.setItem(STORAGE_KEY, '1') } catch { /* التخزين المحلي قد يكون محجوباً */ }
}

export default function FirstVisitOnboarding() {
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const primaryRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let seen = false
    try { seen = window.localStorage.getItem(STORAGE_KEY) === '1' } catch { /* noop */ }
    if (seen) return
    const timer = window.setTimeout(() => setVisible(true), 720)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => primaryRef.current?.focus(), 80)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      rememberSeen()
      setVisible(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [visible])

  const close = () => {
    rememberSeen()
    setVisible(false)
  }

  const advance = () => {
    if (step >= steps.length - 1) { close(); return }
    setStep((current) => Math.min(steps.length - 1, current + 1))
  }

  if (typeof document === 'undefined') return null
  const current = steps[step]

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          data-first-visit-onboarding="true"
          className="fixed inset-0 z-[520] flex items-end justify-center bg-ink/45 p-3 backdrop-blur-[7px] sm:items-center sm:p-6"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: .28, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-visit-title"
          aria-describedby="first-visit-description"
        >
          <motion.section
            className="relative w-full max-w-[760px] overflow-hidden rounded-[28px] border border-hair bg-canvas shadow-2xl"
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: .985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: .99 }}
            transition={{ duration: .42, ease: EASE }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-accent/70 to-transparent" />
            <div className="p-6 sm:p-9 md:p-11">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[.68rem] font-semibold uppercase tracking-[.12em] text-accent">{current.eyebrow}</span>
                <button type="button" onClick={close} className="rounded-full px-2 py-1 text-[.72rem] text-soft transition-colors hover:text-accent" aria-label="تخطي المقدمة">تخطي</button>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: .3, ease: EASE }}
                >
                  <h2 id="first-visit-title" className="mt-5 max-w-[650px] font-display text-[clamp(1.55rem,4vw,2.35rem)] font-semibold leading-[1.45] text-ink">{current.title}</h2>
                  <p id="first-visit-description" className="mt-4 max-w-[650px] text-[.92rem] font-light leading-[2] text-soft sm:text-[1rem]">{current.body}</p>

                  {'features' in current && current.features && (
                    <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                      {current.features.map(([title, note], index) => (
                        <div key={title} className="rounded-2xl border border-hair bg-wash p-4">
                          <span className="text-[.62rem] font-semibold text-accent">0{index + 1}</span>
                          <strong className="mt-2 block text-[.84rem] text-ink">{title}</strong>
                          <p className="mt-1 text-[.72rem] leading-[1.75] text-soft">{note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-hair pt-5">
                <div className="flex items-center gap-1.5" aria-label={`الخطوة ${step + 1} من ${steps.length}`}>
                  {steps.map((_, index) => (
                    <span key={index} aria-hidden className={`h-1.5 rounded-full transition-all duration-300 ${index === step ? 'w-7 bg-accent' : 'w-1.5 bg-ink/15 dark:bg-white/20'}`} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {step > 0 && <button type="button" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} className="rounded-full border border-hair px-4 py-2.5 text-[.78rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">السابق</button>}
                  <button ref={primaryRef} type="button" onClick={advance} className="rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-semibold text-white transition-colors hover:bg-accent-deep">
                    {step === steps.length - 1 ? 'ابدأ التصفح' : 'التالي'}
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
