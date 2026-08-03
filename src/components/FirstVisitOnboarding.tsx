import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'
import { EASE } from './ui'

const STORAGE_KEY = 'site:first-visit-portal:2026-08-03'

const paths = [
  { to: '/articles', number: '01', label: 'المقالات', note: 'أفكارٌ قصيرة تبدأ من سؤالٍ حاضر.' },
  { to: '/publications', number: '02', label: 'المؤلفات', note: 'كتبٌ تمتدّ إلى خرائط ومعرفةٍ قابلة للبحث.' },
  { to: '/research', number: '03', label: 'الأبحاث', note: 'الدليل الأكاديمي خلف الفكرة والتطبيق.' },
] as const

function rememberSeen() {
  try { window.localStorage.setItem(STORAGE_KEY, '1') } catch { /* التخزين المحلي قد يكون محجوباً */ }
}

export default function FirstVisitOnboarding() {
  const reduceMotion = useReducedMotion()
  const enterRef = useRef<HTMLButtonElement | null>(null)
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem(STORAGE_KEY) !== '1' } catch { return true }
  })

  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => enterRef.current?.focus(), 120)
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

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      data-first-visit-onboarding="true"
      className="fixed inset-0 z-[520] overflow-y-auto bg-canvas text-ink"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: .36, ease: EASE }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-title"
      aria-describedby="first-visit-description"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.span
          className="absolute -left-[18vw] -top-[24vw] h-[58vw] w-[58vw] rounded-full border border-accent/[.13]"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 46, repeat: Infinity, ease: 'linear' }}
        />
        <motion.span
          className="absolute -bottom-[32vw] -right-[16vw] h-[72vw] w-[72vw] rounded-full border border-accent/[.1]"
          animate={reduceMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 58, repeat: Infinity, ease: 'linear' }}
        />
        <span className="absolute inset-y-0 left-[12%] w-px bg-gradient-to-b from-transparent via-accent/[.12] to-transparent" />
        <span className="absolute inset-y-0 right-[12%] w-px bg-gradient-to-b from-transparent via-accent/[.08] to-transparent" />
        <span className="absolute left-1/2 top-[18%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-accent/[.035] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[92rem] flex-col px-5 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 md:px-12 lg:px-16">
        <header className="flex items-center justify-between gap-5 border-b border-hair pb-4">
          <div className="min-w-0">
            <span className="block text-[.62rem] font-semibold tracking-[.12em] text-accent">الموقع الرسمي</span>
            <strong className="mt-1 block truncate font-display text-[.86rem] font-semibold text-ink sm:text-[.98rem]">د. أحمد حسين الفيلكاوي</strong>
          </div>
          <button type="button" onClick={close} className="shrink-0 rounded-full border border-hair px-4 py-2 text-[.7rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent" aria-label="تخطي بوابة الترحيب">
            تخطي
          </button>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)] md:gap-16 md:py-14 lg:gap-24">
          <div className="min-w-0">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .55, delay: .08, ease: EASE }}
            >
              <span className="inline-flex items-center gap-3 text-[.68rem] font-semibold text-accent">
                <i className="h-px w-10 bg-accent" aria-hidden />
                أرشيفٌ فكري حيّ
              </span>
              <h1 id="first-visit-title" className="mt-5 max-w-4xl font-display text-[clamp(2.15rem,6.5vw,5.4rem)] font-bold leading-[1.16] tracking-[-.035em] text-ink">
                الفكرة لا تسكن صفحةً واحدة.
                <span className="mt-2 block font-light text-accent">إنها تعبر الكتاب والبحث والمقال.</span>
              </h1>
              <p id="first-visit-description" className="mt-6 max-w-2xl text-[.9rem] font-light leading-[2] text-soft sm:text-[1rem] md:text-[1.08rem]">
                ادخل من السؤال الذي يشبهك، ثم دع الموقع يكشف الروابط بين ما كُتب وما يُبحث وما يستحق أن يُعاد التفكير فيه.
              </p>
            </motion.div>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .5, delay: .24, ease: EASE }}
            >
              <button ref={enterRef} type="button" onClick={close} className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-[.78rem] font-semibold text-white transition-colors hover:bg-accent-deep">
                ادخل الموقع
              </button>
              <Link to="/thought" onClick={close} className="inline-flex min-h-12 items-center rounded-full border border-hair px-6 text-[.78rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">
                ابدأ من الخريطة الفكرية
              </Link>
            </motion.div>
          </div>

          <motion.nav
            aria-label="نقاط الدخول إلى الموقع"
            className="divide-y divide-hair border-y border-hair"
            initial={reduceMotion ? false : { opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: .58, delay: .2, ease: EASE }}
          >
            {paths.map((item) => (
              <Link key={item.to} to={item.to} onClick={close} className="group grid grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-4 py-5 sm:py-6">
                <span className="font-display text-[.68rem] text-accent">{item.number}</span>
                <span className="min-w-0">
                  <strong className="block font-display text-[1.05rem] font-semibold text-ink transition-colors group-hover:text-accent sm:text-[1.18rem]">{item.label}</strong>
                  <span className="mt-1 block text-[.7rem] leading-[1.75] text-soft">{item.note}</span>
                </span>
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-all group-hover:border-accent group-hover:bg-accent group-hover:text-white">←</span>
              </Link>
            ))}
          </motion.nav>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4 text-[.62rem] leading-relaxed text-soft">
          <span>التعليم · التكنولوجيا · الإنسان</span>
          <span>الكويت</span>
        </footer>
      </div>
    </motion.div>,
    document.body,
  )
}
