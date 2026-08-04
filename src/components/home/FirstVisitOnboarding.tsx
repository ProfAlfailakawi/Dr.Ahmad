import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { EASE, SocialIcon } from '../ui'

const STORAGE_KEY = 'visitor:onboarded:archive-guide-v2'

const entrances = [
  {
    id: 'meaning',
    number: '01',
    title: 'ابحث بالفكرة',
    desc: 'اكتب ما يدور في ذهنك، وسيصل البحث إلى المعنى الأقرب.',
    icon: 'Search',
    path: '/search',
  },
  {
    id: 'relations',
    number: '02',
    title: 'اكتشف الروابط',
    desc: 'شاهد الصلات بين المقالات والمؤلفات والأبحاث.',
    icon: 'Link',
    path: '/atlas',
  },
  {
    id: 'question',
    number: '03',
    title: 'ابدأ بسؤال',
    desc: 'دع الأرشيف يقودك إلى زوايا متعددة للفكرة نفسها.',
    icon: 'Sparkles',
    path: '/ask',
  },
] as const

export default function FirstVisitOnboarding() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const timer = window.setTimeout(() => setVisible(true), 500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [visible])

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
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden bg-ink/[.58] p-3 backdrop-blur-sm sm:p-6"
          onClick={() => finish()}
        >
          <motion.section
            initial={{ y: 18, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.985, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[460px] flex-col overflow-hidden rounded-[28px] border border-white/[.18] bg-paper shadow-[0_28px_80px_rgb(0_0_0/.3)]"
            dir="rtl"
            aria-modal="true"
            role="dialog"
            aria-labelledby="archive-welcome-title"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_78%_0%,rgb(var(--c-accent)/.2),transparent_72%)]" />

            <button
              type="button"
              onClick={() => finish()}
              aria-label="إغلاق الترحيب"
              className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-hair bg-paper/[.9] text-soft transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.45]"
            >
              <SocialIcon name="Close" size={13} />
            </button>

            <div className="relative overflow-y-auto overscroll-contain px-5 pb-5 pt-7 sm:px-7 sm:pb-7 sm:pt-8">
              <header className="pl-12">
                <span className="inline-flex items-center gap-2 text-[.68rem] font-extrabold text-accent">
                  <span className="h-1.5 w-6 rounded-full bg-accent" />
                  مرحباً بك
                </span>
                <h2 id="archive-welcome-title" className="mt-3 font-display text-[clamp(1.65rem,7vw,2.25rem)] font-extrabold leading-[1.3] text-ink">
                  ابدأ من فكرتك،<br />لا من القوائم.
                </h2>
                <p className="mt-2 max-w-[360px] text-[.82rem] leading-[1.75] text-soft sm:text-[.9rem]">
                  ثلاثة مداخل تساعدك على الوصول إلى عمق الأرشيف بسرعة ووضوح.
                </p>
              </header>

              <div className="mt-5 overflow-hidden rounded-[22px] border border-hair bg-canvas/[.68]">
                {entrances.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => finish(item.path)}
                    className={`group grid w-full grid-cols-[46px_1fr_24px] items-center gap-3 px-4 py-3.5 text-right transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/[.45] sm:grid-cols-[50px_1fr_26px] sm:px-5 sm:py-4 ${index ? 'border-t border-hair' : ''}`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-[15px] border border-accent/[.18] bg-accent/[.08] text-accent transition duration-300 group-hover:border-accent/[.35] group-hover:bg-accent group-hover:text-white">
                      <SocialIcon name={item.icon} size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[.58rem] font-extrabold tracking-widest text-accent">{item.number}</span>
                        <strong className="font-display text-[.95rem] font-extrabold text-ink sm:text-[1rem]">{item.title}</strong>
                      </span>
                      <span className="mt-1 block text-[.72rem] leading-[1.65] text-soft sm:text-[.76rem]">{item.desc}</span>
                    </span>
                    <span className="text-[1rem] text-soft transition-transform duration-300 group-hover:-translate-x-1 group-hover:text-accent">←</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-2.5">
                <button
                  type="button"
                  onClick={() => finish('/search')}
                  className="min-h-12 rounded-full bg-ink px-6 text-[.82rem] font-bold text-paper transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.45]"
                >
                  ابدأ البحث
                </button>
                <button
                  type="button"
                  onClick={() => finish()}
                  className="min-h-9 rounded-full text-[.68rem] font-semibold text-soft transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.45]"
                >
                  استكشف الأرشيف كما هو
                </button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
