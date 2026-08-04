import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { EASE, SocialIcon } from '../ui'

const STORAGE_KEY = 'visitor:onboarded:archive-compass-v1'

const entrances = [
  {
    id: 'meaning',
    eyebrow: 'اكتب الفكرة كما تخطر لك',
    title: 'ابحث بالمعنى',
    desc: 'تصل إلى المقال والكتاب والبحث الأقرب إلى سؤالك، حتى لو اختلفت الكلمات.',
    icon: 'Search',
    path: '/search',
  },
  {
    id: 'relations',
    eyebrow: 'شاهد الصورة التي لا تعرضها القوائم',
    title: 'تتبّع العلاقات',
    desc: 'اكتشف كيف تتصل المقالات بالمؤلفات والأبحاث داخل خريطة معرفية واحدة.',
    icon: 'Link',
    path: '/atlas',
  },
  {
    id: 'question',
    eyebrow: 'ابدأ من فضولك لا من التصنيف',
    title: 'اسأل الأرشيف',
    desc: 'اطرح سؤالاً فكريًا، ثم انتقل إلى المواد التي تناقشه من زوايا متعددة.',
    icon: 'Sparkles',
    path: '/ask',
  },
] as const

export default function FirstVisitOnboarding() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const timer = window.setTimeout(() => setVisible(true), 650)
    return () => window.clearTimeout(timer)
  }, [])

  const finish = (path?: string) => {
    localStorage.setItem(STORAGE_KEY, 'seen')
    setVisible(false)
    if (path) navigate(path)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="fixed inset-0 z-[400] grid place-items-center overflow-y-auto bg-ink/[.52] px-3 py-5 backdrop-blur-sm sm:p-6"
          onClick={() => finish()}
        >
          <motion.section
            initial={{ y: 24, scale: 0.985, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 14, scale: 0.985, opacity: 0 }}
            transition={{ duration: 0.38, ease: EASE }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-[720px] overflow-hidden rounded-[30px] border border-white/[.16] bg-paper shadow-[0_30px_90px_rgb(0_0_0/.28)]"
            dir="rtl"
            aria-modal="true"
            role="dialog"
            aria-labelledby="archive-welcome-title"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_70%_0%,rgb(var(--c-accent)/.18),transparent_68%)]" />

            <button
              type="button"
              onClick={() => finish()}
              aria-label="إغلاق الترحيب"
              className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-paper/[.86] text-soft transition hover:border-accent hover:text-accent"
            >
              <SocialIcon name="Close" size={14} />
            </button>

            <div className="relative px-5 pb-5 pt-8 sm:px-9 sm:pb-8 sm:pt-10">
              <div className="max-w-[560px]">
                <span className="inline-flex items-center gap-2 text-[.7rem] font-extrabold tracking-wide text-accent">
                  <span className="h-1.5 w-8 rounded-full bg-accent" />
                  أهلاً بك في الأرشيف
                </span>
                <h2 id="archive-welcome-title" className="mt-4 max-w-[520px] font-display text-[clamp(1.75rem,5vw,3rem)] font-extrabold leading-[1.35] text-ink">
                  لا تبدأ من القائمة.<br />ابدأ من الفكرة.
                </h2>
                <p className="mt-3 max-w-[560px] text-[.9rem] leading-[1.9] text-soft sm:text-[1rem]">
                  ثلاث طرق ذكية تقودك إلى المعرفة الأقرب لما تبحث عنه، من دون أن تعرف مسبقاً أين توجد.
                </p>
              </div>

              <div className="relative mt-7 overflow-hidden rounded-[24px] border border-hair bg-canvas/[.72] p-2 sm:mt-9 sm:p-3">
                <div className="pointer-events-none absolute bottom-0 right-[13%] top-0 w-px bg-gradient-to-b from-transparent via-accent/[.22] to-transparent max-sm:hidden" />
                <div className="grid gap-1 sm:grid-cols-3 sm:gap-0">
                  {entrances.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => finish(item.path)}
                      className={`group relative min-h-[152px] px-4 py-5 text-right transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.45] sm:min-h-[230px] sm:px-5 sm:py-6 ${index ? 'max-sm:border-t max-sm:border-hair sm:border-r sm:border-hair' : ''}`}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/[.18] bg-accent/[.07] text-accent transition duration-300 group-hover:-translate-y-0.5 group-hover:border-accent/[.35] group-hover:bg-accent group-hover:text-white">
                        <SocialIcon name={item.icon} size={18} />
                      </span>
                      <span className="mt-5 block text-[.68rem] font-bold leading-relaxed text-accent">{item.eyebrow}</span>
                      <strong className="mt-1.5 block font-display text-[1.02rem] font-extrabold text-ink sm:text-[1.08rem]">{item.title}</strong>
                      <span className="mt-2 block text-[.77rem] leading-[1.75] text-soft">{item.desc}</span>
                      <span className="absolute bottom-5 left-4 text-[1rem] text-soft transition-transform duration-300 group-hover:-translate-x-1 group-hover:text-accent sm:left-5">←</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => finish()}
                  className="min-h-12 rounded-full bg-ink px-7 text-[.84rem] font-bold text-paper transition hover:opacity-90 sm:min-w-[210px]"
                >
                  ادخل إلى الأرشيف
                </button>
                <p className="text-center text-[.68rem] leading-relaxed text-soft sm:text-right">تظهر هذه المقدمة مرة واحدة فقط.</p>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
