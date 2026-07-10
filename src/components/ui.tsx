import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, AnimatePresence } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { LINK_OUT, profile, socials, links } from '../data'
import { ThemeToggle } from './extras'

export { EASE } from './motion'
import { EASE } from './motion'

/* ---------- Masked reveal ----------
   يعتمد useInView مع شبكة أمان: إن كان العنصر داخل الشاشة ولم يُطلق المراقب
   (يحدث خلف شاشة التحميل أو مع انتقالات الصفحات) يُكشف النصّ قسراً.
   لا يُترك عنوانٌ مخفياً أبداً. */
export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })
  const [safety, setSafety] = useState(false)

  useEffect(() => {
    if (reduce) { setSafety(true); return }
    const t = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // داخل الشاشة رأسياً؟ اكشفه.
      if (r.top < window.innerHeight && r.bottom > 0) setSafety(true)
    }, 900)
    return () => clearTimeout(t)
  }, [reduce])

  const show = reduce || inView || safety

  return (
    <span ref={ref} className={`block overflow-hidden ${className}`}>
      <motion.span
        className="block"
        initial={reduce ? false : { y: '115%' }}
        animate={show ? { y: 0 } : { y: '115%' }}
        transition={{ duration: 1, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  )
}

/* ---------- Fade up ---------- */
export function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.12 })
  const [safety, setSafety] = useState(false)

  useEffect(() => {
    if (reduce) { setSafety(true); return }
    const t = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight && r.bottom > 0) setSafety(true)
    }, 900)
    return () => clearTimeout(t)
  }, [reduce])

  const show = reduce || inView || safety

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/* ---------- Label ---------- */
export const Label = ({ children, center = false }: { children: React.ReactNode; center?: boolean }) => (
  <div className={`mb-5 flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
    <span className="h-[1.5px] w-7 bg-accent" />
    <span className="text-[.8rem] font-semibold uppercase tracking-[.13em] text-accent">{children}</span>
  </div>
)

/* ---------- Page heading (used by inner pages) ---------- */
export function PageHead({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <header className="border-b border-hair px-6 pb-12 pt-32 md:px-11 md:pb-14 md:pt-40">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <Label>{label}</Label>
          <h1 className="font-display text-[clamp(2.4rem,6vw,4rem)] font-bold leading-[1.15] text-ink">
            <Reveal>{title}</Reveal>
          </h1>
          {sub && <p className="mt-4 max-w-[620px] text-[1.05rem] font-light text-ink/80">{sub}</p>}
        </FadeUp>
      </div>
    </header>
  )
}

/* ---------- Safe link (old-site links gated) ---------- */
export function SafeLink({
  href,
  external,
  className = '',
  children,
  ...rest
}: {
  href?: string
  external?: boolean
  className?: string
  children: React.ReactNode
  [k: string]: any
}) {
  const allowed = external || (LINK_OUT && !!href)
  if (!allowed) return <div className={className} {...rest}>{children}</div>
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} {...rest}>
      {children}
    </a>
  )
}

/* ---------- Magnetic button ---------- */
export function Magnetic({ children, className = '', to, href }: { children: React.ReactNode; className?: string; to?: string; href?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 300, damping: 20 })
  const sy = useSpring(y, { stiffness: 300, damping: 20 })
  const reduce = useReducedMotion()

  const move = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - r.left - r.width / 2) * 0.25)
    y.set((e.clientY - r.top - r.height / 2) * 0.4)
  }
  const leave = () => { x.set(0); y.set(0) }

  const inner = to ? <Link to={to} className={className}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>
  return (
    <motion.div ref={ref} onMouseMove={move} onMouseLeave={leave} style={{ x: sx, y: sy }} className="inline-block">
      {inner}
    </motion.div>
  )
}

/* ---------- Custom cursor ---------- */
export function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const [big, setBig] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const rx = useSpring(x, { stiffness: 400, damping: 40, mass: 0.4 })
  const ry = useSpring(y, { stiffness: 400, damping: 40, mass: 0.4 })
  const loc = useLocation()

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce) return
    setEnabled(true)
    document.body.classList.add('cursor-none-desktop')
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY) }
    window.addEventListener('mousemove', move)
    return () => { window.removeEventListener('mousemove', move); document.body.classList.remove('cursor-none-desktop') }
  }, [x, y])

  useEffect(() => {
    if (!enabled) return
    const targets = document.querySelectorAll('a, button, img, [data-hover]')
    const on = () => setBig(true)
    const off = () => setBig(false)
    targets.forEach((t) => { t.addEventListener('mouseenter', on); t.addEventListener('mouseleave', off) })
    return () => targets.forEach((t) => { t.removeEventListener('mouseenter', on); t.removeEventListener('mouseleave', off) })
  }, [enabled, loc.pathname])

  if (!enabled) return null
  return (
    <>
      <motion.div
        className="cursor-ring pointer-events-none fixed z-[251] rounded-full border-[1.5px]"
        style={{ left: rx, top: ry, x: '-50%', y: '-50%' }}
        animate={{
          width: big ? 70 : 34,
          height: big ? 70 : 34,
          borderColor: big ? 'rgba(0,0,0,0)' : '#3E5C78',
          backgroundColor: big ? 'rgba(62,92,120,.07)' : 'rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.28 }}
      />
      <motion.div className="cursor-dot pointer-events-none fixed z-[252] h-[5px] w-[5px] rounded-full bg-accent" style={{ left: x, top: y, x: '-50%', y: '-50%' }} />
    </>
  )
}

/* ---------- Section head: label + title + "الكل" ---------- */
export function SectionHead({ label, title, to, cta = 'الكل' }: { label: string; title: string; to: string; cta?: string }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-6">
      <FadeUp>
        <Label>{label}</Label>
        <h2 className="font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink">
          <Reveal>{title}</Reveal>
        </h2>
      </FadeUp>
      <Link to={to} className="group shrink-0 pb-2 text-[.92rem] font-semibold text-accent">
        {cta}
        <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1.5"> ←</span>
      </Link>
    </div>
  )
}

/* ---------- Accordion (CV sections) ---------- */
export function Accordion({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string
  count?: string | number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const reduce = useReducedMotion()
  return (
    <div className="border-b border-hair">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="group flex w-full items-baseline justify-between gap-5 py-6 text-right">
        <span className="flex items-baseline gap-3">
          <span className="font-display text-[1.22rem] font-medium text-ink transition-colors group-hover:text-accent md:text-[1.4rem]">{title}</span>
          {count !== undefined && <span className="text-[.82rem] text-soft">{count}</span>}
        </span>
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
          <span className="absolute h-[1.5px] w-3.5 bg-accent" />
          <motion.span className="absolute h-[1.5px] w-3.5 bg-accent" animate={{ rotate: open ? 0 : 90 }} transition={{ duration: 0.35, ease: EASE }} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pb-9">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- Nav: closed menu, opens full-screen ---------- */
const GROUPS = [
  {
    label: 'هويتي الأكاديمية',
    items: [
      { to: '/', label: 'الرئيسية' },
      { to: '/cv', label: 'السيرة الأكاديمية' },
      { to: '/research', label: 'المساهمات العلمية' },
      { to: '/publications', label: 'الكتب المنشورة' },
    ],
  },
  {
    label: 'محتواي المعرفي',
    items: [
      { to: '/articles', label: 'مقالاتي الفكرية' },
      { to: '/search', label: 'البحث العميق' },
      { to: '/questions', label: 'سؤال يُقلق التعليم' },
      { to: '/radar', label: 'أرشيف الرادار' },
      { to: '/atlas', label: 'سماء المقالات' },
      { to: '/media', label: 'الظهور الإعلامي' },
      { to: '/upcoming', label: 'اللقاءات القادمة' },
    ],
  },
  {
    label: 'من اختياراتي',
    items: [
      { to: '/curated', label: 'المختارات' },
      { to: '/inbox', label: 'من بريدي الوارد' },
    ],
  },
]

function Overlay({ close }: { close: () => void }) {
  const reduce = useReducedMotion()
  const loc = useLocation()

  return (
    <motion.div
      className="fixed inset-0 z-[220] flex flex-col bg-canvas"
      initial={reduce ? { opacity: 0 } : { y: '-100%' }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: '-100%' }}
      transition={{ duration: 0.75, ease: EASE }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_75%_35%,rgba(62,92,120,.07),transparent_65%)]" />

      <div className="relative flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center px-6 pb-12 pt-24 md:px-11">
        <div className="mx-auto grid w-full max-w-shell gap-y-10 md:grid-cols-3 md:gap-x-12">
          {GROUPS.map((g, gi) => (
            <div key={g.label}>
              <motion.span
                className="block text-[.7rem] font-semibold uppercase tracking-[.14em] text-accent"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + gi * 0.08, ease: EASE }}
              >
                {g.label}
              </motion.span>

              <ul className="mt-4 space-y-0.5">
                {g.items.map((it, ii) => (
                  <li key={it.to} className="overflow-hidden">
                    <motion.div
                      initial={reduce ? false : { y: '110%' }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.7, delay: 0.45 + gi * 0.08 + ii * 0.06, ease: EASE }}
                    >
                      <Link
                        to={it.to}
                        onClick={close}
                        className={`block py-1.5 font-display text-[clamp(1.15rem,1.9vw,1.5rem)] font-medium leading-[1.5] transition-colors duration-300 hover:text-accent ${
                          loc.pathname === it.to ? 'text-accent' : 'text-ink'
                        }`}
                      >
                        {it.label}
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        </div>
      </div>

      <motion.div
        className="relative border-t border-hair px-6 py-8 md:px-11"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-5">
          <Link
            to="/contact"
            onClick={close}
            className="rounded-full bg-accent px-7 py-3 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
          >
            للاستشارة أو التعاون
          </Link>
          <div className="flex flex-wrap gap-6 text-[.88rem] text-soft">
            {socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40 })
  const loc = useLocation()

  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 50)), [scrollY])
  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const solid = (scrolled || loc.pathname !== '/') && !open

  return (
    <>
      <motion.div className="fixed right-0 top-0 z-[240] h-[2px] w-full origin-right bg-accent" style={{ scaleX: progress }} />

      <AnimatePresence>{open && <Overlay key="ov" close={() => setOpen(false)} />}</AnimatePresence>

      <nav className={`fixed inset-x-0 top-0 z-[230] border-b transition-[background-color,border-color] duration-500 ${solid ? 'border-hair bg-canvas/[.82] backdrop-blur-lg backdrop-saturate-150' : 'border-transparent'}`}>
        <div className={`mx-auto flex max-w-shell items-center justify-between px-6 transition-all duration-300 md:px-11 ${solid ? 'h-16' : 'h-[76px]'}`}>
          <Link to="/" aria-label={profile.name}>
            <img src="/logo.png" alt="" className="h-[34px] w-14 object-contain opacity-90 dark:invert" style={{ objectPosition: 'right' }} />
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
            className="group flex items-center gap-3.5"
          >
            <span className="hidden text-[.9rem] font-medium text-ink transition-colors group-hover:text-accent sm:block">
              {open ? 'إغلاق' : 'القائمة'}
            </span>
            <span className="relative flex h-9 w-9 flex-col items-center justify-center gap-[6px] rounded-full border border-hair transition-colors duration-300 group-hover:border-accent">
              <motion.span
                className="block h-[1.5px] w-4 bg-ink transition-colors group-hover:bg-accent"
                animate={open ? { rotate: 45, y: 3.75 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              />
              <motion.span
                className="block h-[1.5px] w-4 bg-ink transition-colors group-hover:bg-accent"
                animate={open ? { rotate: -45, y: -3.75 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              />
            </span>
          </button>
          </div>
        </div>
      </nav>
    </>
  )
}

/* ---------- Footer ---------- */
export function Footer() {
  return (
    <footer className="border-t border-hair px-6 py-12 md:px-11">
      <div className="mx-auto max-w-shell">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Link to="/">
            <img src="/logo.png" alt={profile.name} className="h-10 w-16 object-contain dark:invert" style={{ objectPosition: 'right' }} />
          </Link>
          <div className="flex flex-wrap gap-5 text-[.9rem] text-soft">
            <Link to="/about" className="transition-colors hover:text-accent">حول الموقع</Link>
            <Link to="/search" className="transition-colors hover:text-accent">البحث</Link>
            <a href="/feed.xml" className="transition-colors hover:text-accent">RSS</a>
            <Link to="/inbox" className="transition-colors hover:text-accent">من بريدي الوارد</Link>
            <a href={links.cv} target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">السيرة PDF</a>
            {socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">{s.label}</a>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-between gap-2.5 border-t border-hair pt-5 text-[.78rem] text-soft">
          <span>© {new Date().getFullYear()} {profile.fullName} — جميع الحقوق محفوظة</span>
        </div>
      </div>
    </footer>
  )
}

/* ---------- Page transition wrapper ---------- */
export function Page({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
