import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { EASE, SocialIcon } from '../ui'

const ONBOARDING_STORAGE_KEY = 'visitor:onboarded:v2'

interface HiddenFeature {
  id: string
  eyebrow: string
  title: string
  desc: string
  icon: string
  path: string
}

const HIDDEN_FEATURES: HiddenFeature[] = [
  {
    id: 'semantic-search',
    eyebrow: 'أبعد من مطابقة الكلمات',
    title: 'بحث يفهم المعنى',
    desc: 'يصل إلى المقال والبحث والكتاب والموضع الأقرب إلى سؤالك، حتى عندما تختلف صياغة الكلمات.',
    icon: 'Search',
    path: '/search',
  },
  {
    id: 'knowledge-atlas',
    eyebrow: 'العلاقات التي لا تظهر في القوائم',
    title: 'أطلس الأفكار',
    desc: 'يكشف الصلات بين المؤلفات والأبحاث والمقالات ويحوّل الأرشيف إلى خريطة معرفية مترابطة.',
    icon: 'Link',
    path: '/atlas',
  },
  {
    id: 'questions',
    eyebrow: 'مدخل مختلف للقراءة',
    title: 'أسئلة تقودك إلى المعرفة',
    desc: 'ابدأ بسؤال فكري، ثم انتقل مباشرة إلى المواد التي تناقشه من زوايا متعددة داخل الأرشيف.',
    icon: 'Spark',
    path: '/questions',
  },
]

export default function FirstVisitOnboarding() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return

    const timer = window.setTimeout(() => setVisible(true), 550)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [visible])

  const markAsSeen = () => localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')

  const dismiss = () => {
    markAsSeen()
    setVisible(false)
  }

  const openFeature = (path: string) => {
    markAsSeen()
    setVisible(false)
    navigate(path)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
          className="fixed inset-0 z-[400] grid place-items-center overflow-y-auto bg-ink/[.58] px-3 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[10px] sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) dismiss()
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-visit-title"
            initial={reduce ? false : { y: 24, scale: 0.975, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 16, scale: 0.98, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.38, ease: EASE }}
            className="relative my-auto w-full max-w-[540px] overflow-hidden rounded-[2rem] border border-white/70 bg-paper shadow-[0_34px_100px_-36px_rgba(8,22,38,.72)]"
            dir="rtl"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_78%_10%,rgba(62,92,120,.16),transparent_54%)]" />

            <div className="relative px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/[.15] bg-accent/[.055] px-3 py-1.5 text-[.68rem] font-extrabold text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_0_4px_rgba(62,92,120,.10)]" />
                  جولة واحدة فقط
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="إغلاق الجولة"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hair bg-canvas text-soft transition hover:border-accent/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.35]"
                >
                  <SocialIcon name="Close" size={14} />
                </button>
              </div>

              <header className="mt-6 max-w-[30rem]">
                <p className="text-[.7rem] font-extrabold tracking-[.08em] text-accent">خلف الواجهة الواضحة</p>
                <h2 id="first-visit-title" className="mt-2 font-display text-[clamp(1.65rem,7vw,2.35rem)] font-extrabold leading-[1.35] text-ink">
                  مزايا خفيّة تجعل الأرشيف أذكى.
                </h2>
                <p className="mt-3 max-w-[29rem] text-[.82rem] leading-[1.9] text-soft sm:text-[.88rem]">
                  لا تحتاج إلى شرح الأقسام الظاهرة. هذه ثلاثة مداخل عميقة قد لا تلاحظها من الزيارة الأولى.
                </p>
              </header>

              <div className="mt-6 grid gap-2.5">
                {HIDDEN_FEATURES.map((feature, index) => (
                  <motion.button
                    key={feature.id}
                    type="button"
                    onClick={() => openFeature(feature.path)}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : 0.12 + index * 0.06, duration: 0.3, ease: EASE }}
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] border border-hair bg-canvas/80 p-3.5 text-right transition hover:-translate-y-0.5 hover:border-accent/30 hover:bg-paper hover:shadow-[0_16px_38px_-28px_rgba(20,45,70,.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:p-4"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[.95rem] border border-accent/[.15] bg-accent/[.07] text-accent transition group-hover:bg-accent group-hover:text-white">
                      <SocialIcon name={feature.icon} size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[.62rem] font-bold text-accent">{feature.eyebrow}</span>
                      <strong className="mt-0.5 block font-display text-[.9rem] font-extrabold leading-relaxed text-ink sm:text-[.96rem]">{feature.title}</strong>
                      <span className="mt-0.5 block text-[.7rem] leading-[1.7] text-soft sm:text-[.74rem]">{feature.desc}</span>
                    </span>
                    <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-hair text-[.82rem] text-soft transition group-hover:-translate-x-1 group-hover:border-accent/25 group-hover:text-accent">←</span>
                  </motion.button>
                ))}
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={() => openFeature('/search')}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[.82rem] font-extrabold text-white shadow-[0_15px_34px_-22px_rgba(8,22,38,.8)] transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.35]"
                >
                  ابدأ بالبحث الذكي
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="min-h-12 rounded-2xl border border-hair px-5 text-[.76rem] font-bold text-soft transition hover:border-accent/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                >
                  سأستكشف بنفسي
                </button>
              </div>

              <p className="mt-4 text-center text-[.62rem] text-soft/75">بعد الإغلاق لن تظهر هذه الجولة مرة أخرى على هذا الجهاز.</p>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
