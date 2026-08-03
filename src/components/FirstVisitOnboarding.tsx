import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'
import { EASE } from './ui'
import { SocialIcon } from './icons'

const STORAGE_KEY = 'site:first-visit-portal:2026-08-03'

const paths = [
  { to: '/articles', number: '01', label: 'المقالات', note: 'أفكار قصيرة تبدأ من سؤال حاضر.' },
  { to: '/publications', number: '02', label: 'المؤلفات', note: 'كتب تتصل بخريطة معرفية قابلة للبحث.' },
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
      className="fixed inset-0 z-[520] flex items-end justify-center overflow-y-auto bg-ink/[.18] pt-16 backdrop-blur-[3px] sm:items-center sm:px-6 sm:py-10"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: .28, ease: EASE }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-title"
      aria-describedby="first-visit-description"
      onMouseDown={(event) => { if (event.currentTarget === event.target) close() }}
    >
      <motion.section
        className="relative w-full max-w-4xl overflow-hidden rounded-t-[2rem] border border-hair bg-canvas/[.98] shadow-[0_-18px_70px_-34px_rgba(20,31,45,.5)] sm:rounded-[2rem] sm:shadow-[0_28px_90px_-42px_rgba(20,31,45,.62)]"
        initial={reduceMotion ? false : { opacity: 0, y: 32, scale: .985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: .48, delay: .05, ease: EASE }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -left-24 -top-28 h-72 w-72 rounded-full border border-accent/[.1]" />
          <span className="absolute -bottom-32 right-[28%] h-64 w-64 rounded-full bg-accent/[.035] blur-3xl" />
        </div>

        <header className="relative flex items-center justify-between gap-5 border-b border-hair px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <span className="block text-[.61rem] font-semibold tracking-[.1em] text-accent">الموقع الرسمي</span>
            <strong className="mt-1 block truncate font-display text-[.9rem] font-semibold text-ink">د. أحمد حسين الفيلكاوي</strong>
          </div>
          <button type="button" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent" aria-label="إغلاق الترحيب" title="إغلاق">
            <SocialIcon name="Close" size={13} />
          </button>
        </header>

        <div className="relative grid gap-8 px-5 py-7 sm:px-7 sm:py-9 md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)] md:gap-10">
          <div className="min-w-0">
            <motion.span
              className="inline-flex items-center gap-3 text-[.67rem] font-semibold text-accent"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .38, delay: .14, ease: EASE }}
            >
              <i className="h-px w-8 bg-accent" aria-hidden />
              أرشيف فكري حي
            </motion.span>
            <motion.h1
              id="first-visit-title"
              className="mt-4 max-w-2xl font-display text-[clamp(2rem,6vw,3.65rem)] font-bold leading-[1.18] tracking-[-.03em] text-ink"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .46, delay: .18, ease: EASE }}
            >
              مساحة واحدة تجمع المقال والكتاب والبحث.
            </motion.h1>
            <motion.p
              id="first-visit-description"
              className="mt-4 max-w-xl text-[.86rem] font-light leading-[1.95] text-soft sm:text-[.94rem]"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .42, delay: .23, ease: EASE }}
            >
              ابدأ من الفكرة التي تهمك؛ ستجد المقالات والمؤلفات والأبحاث متصلة في تجربة واحدة، بينما تبقى الصفحة الرئيسية واضحة خلف هذه النافذة.
            </motion.p>

            <motion.div
              className="mt-6 flex flex-wrap items-center gap-3"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .42, delay: .28, ease: EASE }}
            >
              <button ref={enterRef} type="button" onClick={close} className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[.76rem] font-semibold text-white transition-colors hover:bg-accent-deep">
                ادخل الموقع
              </button>
              <Link to="/thought" onClick={close} className="inline-flex min-h-11 items-center rounded-full border border-hair px-5 text-[.76rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">
                ابدأ من الخريطة الفكرية
              </Link>
            </motion.div>
          </div>

          <motion.nav
            aria-label="نقاط الدخول إلى الموقع"
            className="divide-y divide-hair rounded-2xl border border-hair bg-wash/[.55] px-4"
            initial={reduceMotion ? false : { opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: .46, delay: .24, ease: EASE }}
          >
            {paths.map((item) => (
              <Link key={item.to} to={item.to} onClick={close} className="group grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-3 py-4">
                <span className="font-display text-[.62rem] text-accent">{item.number}</span>
                <span className="min-w-0">
                  <strong className="block font-display text-[.96rem] font-semibold text-ink transition-colors group-hover:text-accent">{item.label}</strong>
                  <span className="mt-1 block text-[.64rem] leading-[1.65] text-soft">{item.note}</span>
                </span>
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-accent transition-all group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                  <SocialIcon name="ArrowBack" size={14} />
                </span>
              </Link>
            ))}
          </motion.nav>
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  )
}
