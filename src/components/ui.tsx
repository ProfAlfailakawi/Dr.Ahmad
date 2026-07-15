import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, AnimatePresence } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { LINK_OUT, SHOW_EN_TOGGLE, articles, books, papers, profile, socials, links } from '../data'
import { ThemeToggle } from './extras'
import { useCvLinks } from '../lib/settings'
import { SocialIcon } from './icons'

export { EASE } from './motion'
export { SocialIcon } from './icons'
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
    }, 700)
    return () => clearTimeout(t)
  }, [reduce])

  const show = reduce || inView || safety

  return (
    // الحشوة العمودية تمنع قصّ التنوين والهمزات فوق الحروف وذيولها تحتها، والهامش السالب يلغي أثرها على التخطيط
    <span ref={ref} className={`-my-[0.3em] block overflow-hidden py-[0.3em] ${className}`}>
      <motion.span
        className="block"
        initial={reduce ? false : { y: '150%' }}
        animate={show ? { y: 0 } : { y: '150%' }}
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
      initial={reduce ? false : { opacity: 0, y: 22 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
      transition={{ duration: 0.72, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/* ---------- Label ---------- */
export const Label = ({ children, center = false }: { children: React.ReactNode; center?: boolean }) => (
  <div className={`signature-label mb-5 flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
    <span className="h-[1.5px] w-7 bg-accent" />
    <span className="text-[.8rem] font-semibold uppercase text-accent">{children}</span>
  </div>
)

/* ---------- Page heading (used by inner pages) ---------- */
export function PageHead({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <header className="page-head border-b border-hair px-6 pb-12 pt-32 md:px-11 md:pb-14 md:pt-40">
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
  const [visible, setVisible] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const rx = useSpring(x, { stiffness: 400, damping: 40, mass: 0.4 })
  const ry = useSpring(y, { stiffness: 400, damping: 40, mass: 0.4 })
  const loc = useLocation()
  // لوحة التحكم تحتاج مؤشر النظام الدقيق؛ المؤشر المخصص مخصص لواجهة الزائر فقط.
  const isAdmin = loc.pathname.startsWith('/admin')

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce || isAdmin) {
      setEnabled(false)
      setVisible(false)
      document.body.classList.remove('cursor-none-desktop')
      return
    }

    setEnabled(true)
    document.body.classList.add('cursor-none-desktop')

    const move = (event: MouseEvent) => {
      x.set(event.clientX)
      y.set(event.clientY)
      setVisible(true)
    }
    const leave = () => setVisible(false)
    const enter = () => setVisible(true)
    const over = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a, button, [role="button"], input, textarea, select, summary, [data-hover]') : null
      setBig(Boolean(target))
    }
    const out = (event: PointerEvent) => {
      const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest('a, button, [role="button"], input, textarea, select, summary, [data-hover]') : null
      if (!next) setBig(false)
    }

    window.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mouseleave', leave)
    document.addEventListener('mouseenter', enter)
    document.addEventListener('pointerover', over, { passive: true })
    document.addEventListener('pointerout', out, { passive: true })

    return () => {
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseleave', leave)
      document.removeEventListener('mouseenter', enter)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.body.classList.remove('cursor-none-desktop')
    }
  }, [x, y, isAdmin])

  if (!enabled || isAdmin) return null
  return (
    <>
      <motion.div
        aria-hidden
        className="cursor-ring pointer-events-none fixed z-[9998] rounded-full border-[1.5px]"
        style={{ left: rx, top: ry, x: '-50%', y: '-50%' }}
        animate={{
          opacity: visible ? 1 : 0,
          width: big ? 70 : 34,
          height: big ? 70 : 34,
          borderColor: big ? 'rgba(0,0,0,0)' : '#3E5C78',
          backgroundColor: big ? 'rgba(62,92,120,.09)' : 'rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        aria-hidden
        className="cursor-dot pointer-events-none fixed z-[9999] h-[5px] w-[5px] rounded-full bg-accent"
        style={{ left: x, top: y, x: '-50%', y: '-50%' }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.12 }}
      />
    </>
  )
}

/* ---------- Section head: label + title + "الكل" ---------- */
export function SectionHead({ label, title, to, cta = 'الكل' }: { label: string; title: string; to?: string; cta?: string }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-6">
      <FadeUp>
        <Label>{label}</Label>
        <h2 className="font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink">
          <Reveal>{title}</Reveal>
        </h2>
      </FadeUp>
      {to && (
        <Link to={to} className="group shrink-0 pb-2 text-[.92rem] font-semibold text-accent">
          {cta}
          <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1.5"> ←</span>
        </Link>
      )}
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
type NavItem = { to: string; label: string; allLabel?: string; showAllLink?: boolean; highlight?: boolean; sub?: { to: string; label: string }[] }
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'ابدأ من هنا',
    items: [
      { to: '/articles', label: 'المقالات الفكرية', allLabel: 'عرض كل المقالات', sub: [
        { to: '/atlas', label: 'سماء المقالات' },
        { to: '/thought-paths', label: 'مسارات الفكرة' },
      ] },
      { to: '/search', label: 'مركز البحث', highlight: true, showAllLink: false, sub: [
        { to: '/search', label: 'البحث العميق' },
        { to: '/ask', label: 'اسأل العقل الحي' },
      ] },
    ],
  },
  {
    label: 'المكتبة',
    items: [
      { to: '/research', label: 'الأبحاث المحكمة' },
      { to: '/publications', label: 'الكتب المنشورة' },
      { to: '/inbox', label: 'من بريدي' },
      { to: '/curated', label: 'المختارات', allLabel: 'عرض كل المختارات', sub: [
        { to: '/questions', label: 'سؤال يُقلق التعليم' },
        { to: '/radar', label: 'أرشيف الرادار' },
      ] },
    ],
  },
  {
    label: 'عن الدكتور',
    items: [
      { to: '/cv', label: 'السيرة الأكاديمية' },
      { to: '/media', label: 'الظهور الإعلامي' },
      { to: '/upcoming', label: 'اللقاءات القادمة' },
      { to: '/decade', label: 'وثيقة العقد' },
    ],
  },
]

function Overlay({ close }: { close: () => void }) {
  const reduce = useReducedMotion()
  const loc = useLocation()
  const dialogRef = useRef<HTMLDivElement>(null)
  // الفروع مطويّة عند فتح القائمة؛ العنوان يفتح الصفحة والسهم وحده يفتح الفروع.
  const [openSub, setOpenSub] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.offsetParent !== null)

    const frame = window.requestAnimationFrame(() => (focusable()[0] || dialog).focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [close])

  return (
    <motion.div
      ref={dialogRef}
      id="site-menu-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="القائمة الرئيسية"
      tabIndex={-1}
      className="site-menu-overlay fixed inset-0 z-[220] isolate flex flex-col bg-canvas outline-none"
      style={{ backgroundColor: 'rgb(var(--c-canvas))' }}
      initial={reduce ? { opacity: 0 } : { y: '-100%' }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: '-100%' }}
      transition={{ duration: 0.75, ease: EASE }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_75%_35%,rgba(62,92,120,.055),transparent_65%)]" />

      <div className="relative flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-start px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5.4rem+env(safe-area-inset-top))] md:items-center md:px-11 md:py-28">
        <div className="mx-auto grid w-full max-w-shell gap-5 md:grid-cols-3 md:gap-x-12 md:gap-y-10">
          {GROUPS.map((g, gi) => (
            <div key={g.label} className="border-b border-hair pb-5 md:border-0 md:pb-0">
              <motion.span
                className="block text-[.68rem] font-semibold uppercase text-accent md:text-[.72rem]"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + gi * 0.08, ease: EASE }}
              >
                {g.label}
              </motion.span>

              <ul className="mt-3 space-y-1 md:mt-4">
                {g.items.map((it, ii) => {
                  const expanded = openSub === it.to
                  const active = loc.pathname === it.to || Boolean(it.sub?.some((sub) => sub.to === loc.pathname))
                  const subId = `menu-sub-${gi}-${ii}`
                  return (
                  <li key={it.to} className="-my-[0.2em] overflow-hidden py-[0.2em]">
                    <motion.div
                      initial={reduce ? false : { y: '150%' }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.7, delay: 0.45 + gi * 0.08 + ii * 0.06, ease: EASE }}
                    >
                      {it.sub ? (
                        <div className="group py-1">
                          <button
                            type="button"
                            onClick={() => setOpenSub(expanded ? null : it.to)}
                            aria-expanded={expanded}
                            aria-controls={subId}
                            className={`site-menu-control flex w-full items-center justify-between gap-3 text-right font-display text-[1.15rem] font-medium leading-[1.5] transition-colors duration-300 hover:text-accent md:text-[1.35rem] ${
                              active || expanded ? 'text-accent' : 'text-ink'
                            }`}
                          >
                            <span className="min-w-0 flex-1">{it.label}</span>
                            <span className="flex items-center gap-2 text-[.72rem] font-sans font-semibold text-soft">
                              <span className="hidden sm:inline">{expanded ? 'إخفاء الفروع' : 'استكشف الفروع'}</span>
                              <motion.svg
                                aria-hidden
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                animate={{ rotate: expanded ? 180 : 0 }}
                                transition={{ duration: 0.3, ease: EASE }}
                              >
                                <path d="M6 9l6 6 6-6" />
                              </motion.svg>
                            </span>
                          </button>
                          {it.showAllLink !== false && (
                            <Link
                              to={it.to}
                              onClick={close}
                              className="site-menu-control mt-1 inline-flex rounded-full border border-hair px-3 py-1 text-[.72rem] font-semibold text-soft transition-colors duration-300 hover:border-accent hover:text-accent"
                            >
                              {it.allLabel || `فتح ${it.label}`}
                            </Link>
                          )}
                        </div>
                      ) : (
                        <Link
                          to={it.to}
                          onClick={close}
                          className={`site-menu-control flex items-center gap-2.5 py-1 font-display text-[1.15rem] font-medium leading-[1.5] transition-colors duration-300 hover:text-accent md:py-1.5 md:text-[1.35rem] ${
                            loc.pathname === it.to ? 'text-accent' : it.highlight ? 'text-accent' : 'text-ink'
                          }`}
                        >
                          {it.highlight && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />}
                          {it.label}
                        </Link>
                      )}
                      {it.sub && (
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <motion.ul
                              id={subId}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.35, ease: EASE }}
                              className="mt-1 overflow-hidden border-r border-hair pr-4"
                            >
                              {it.sub.map((s) => (
                                <li key={s.to}>
                                  <Link
                                    to={s.to}
                                    onClick={close}
                                    className={`site-menu-control block py-1.5 text-[.9rem] font-light transition-colors duration-300 hover:text-accent ${
                                      loc.pathname === s.to ? 'text-accent' : 'text-soft'
                                    }`}
                                  >
                                    {s.label}
                                  </Link>
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      )}
                    </motion.div>
                  </li>
                )})}
              </ul>
            </div>
          ))}
        </div>
        </div>
      </div>

      <motion.div
        className="site-menu-footer relative border-t border-hair px-6 pb-[max(.85rem,env(safe-area-inset-bottom))] pt-3.5 md:px-11 md:py-7"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-3.5 md:gap-5">
          <Link
            to="/contact#booking-form"
            onClick={close}
            className="rounded-full bg-accent px-5 py-2 text-[.82rem] font-semibold text-white transition-colors duration-300 hover:bg-accent-deep md:px-6 md:py-2.5 md:text-[.88rem]"
          >
            احجز موعداً مباشراً
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-soft">
            <div className="flex items-center gap-2 sm:hidden">
              <ThemeToggle />
              {SHOW_EN_TOGGLE && (
                <Link to="/en" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-[.66rem] font-semibold">EN</Link>
              )}
            </div>
            <span className="mx-1 hidden h-5 w-px bg-hair sm:block" />
            {socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} className="transition-colors hover:text-accent">
                <SocialIcon name={s.label} />
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* خريطة التبديل بين المرآتين — الصفحات الثلاث تتقابل، وما عداها يذهب لرئيسية اللغة الأخرى */
const EN_OF: Record<string, string> = { '/': '/en', '/cv': '/en/cv', '/research': '/en/research' }
const AR_OF: Record<string, string> = { '/en': '/', '/en/cv': '/cv', '/en/research': '/research' }

const normalizeSearch = (value: string) => value
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[ـ،؛؟!?.,:()«»"']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const SMART_GROUPS = [
  ['تقييم', 'تقويم', 'قياس', 'درجات', 'اختبار', 'امتحان', 'اقيم', 'نقيس'],
  ['ذكاء اصطناعي', 'الذكاء الاصطناعي', 'ai', 'شات جي بي تي', 'chatgpt', 'تقنيه', 'رقمي'],
  ['طالب', 'طلاب', 'طلبه', 'متعلم', 'طفل', 'ابناء'],
  ['معلم', 'مدرس', 'استاذ', 'تدريس'],
  ['تعليم', 'تعلم', 'مدرسه', 'منهج', 'مناهج'],
  ['تربيه', 'اسره', 'والدين', 'اب', 'ام'],
  ['هويه', 'قيم', 'لغه', 'تراث'],
  ['بحث', 'دراسه', 'علمي', 'محكم'],
  ['كتاب', 'مؤلف', 'اصدار', 'موسوعه'],
  ['سيره', 'cv', 'خبره', 'مسار اكاديمي'],
  ['تواصل', 'حجز', 'موعد', 'محاضره', 'ورشه', 'استشاره'],
]

const expandSearchTerms = (value: string) => {
  const normalized = normalizeSearch(value)
  const base = normalized.split(' ').filter((token) => token.length > 1)
  const terms = new Set(base)
  for (const group of SMART_GROUPS) {
    const normalizedGroup = group.map(normalizeSearch)
    if (normalizedGroup.some((term) => normalized.includes(term) || base.includes(term))) {
      normalizedGroup.forEach((term) => terms.add(term))
    }
  }
  return { normalized, terms: [...terms] }
}

type QuickResult = { to: string; title: string; meta: string; text: string; kind: 'article' | 'book' | 'paper' | 'page' }

function SearchPalette({ close }: { close: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [close])

  const index = useMemo<QuickResult[]>(() => [
    ...articles.map((item) => ({
      to: `/articles/${item.slug}`,
      title: item.title,
      meta: `مقال · ${item.date}`,
      kind: 'article' as const,
      text: `${item.title} ${item.excerpt || ''} ${item.cat}`,
    })),
    ...books.map((item) => ({
      to: `/publications/${item.slug}`,
      title: item.title,
      meta: 'كتاب',
      kind: 'book' as const,
      text: `${item.title} ${item.desc || ''} ${item.isbn || ''}`,
    })),
    ...papers.map((item) => ({
      to: `/research/${item.slug}`,
      title: item.title,
      meta: 'بحث محكّم',
      kind: 'paper' as const,
      text: `${item.title} ${(item as { meta?: string }).meta || ''} ${(item as { journal?: string }).journal || ''}`,
    })),
    { to: '/cv', title: 'السيرة الأكاديمية والمهنية', meta: 'صفحة', kind: 'page' as const, text: 'السيرة الاكاديمية الدكتور احمد حسين الفيلكاوي الخبرة المسار المهني cv' },
    { to: '/contact#booking-form', title: 'الحجز والتواصل', meta: 'صفحة', kind: 'page' as const, text: 'حجز موعد محاضرة ورشة لقاء تواصل استشارة' },
    { to: '/atlas', title: 'سماء المقالات', meta: 'خريطة', kind: 'page' as const, text: 'سماء المقالات خريطة الارشيف الزمن' },
    { to: '/thought-paths', title: 'مسارات الفكرة', meta: 'مسار', kind: 'page' as const, text: 'مسارات الفكر الفكرة موضوع تعليم تربية تقنية هوية مجتمع' },
  ], [])

  const results = useMemo(() => {
    const { normalized, terms } = expandSearchTerms(query)
    if (!normalized) return []
    return index
      .map((item) => {
        const title = normalizeSearch(item.title)
        const hay = normalizeSearch(`${item.title} ${item.text}`)
        let score = 0
        if (title === normalized) score += 120
        if (title.startsWith(normalized)) score += 70
        if (title.includes(normalized)) score += 48
        if (hay.includes(normalized)) score += 25
        for (const term of terms) {
          if (title.includes(term)) score += 12
          else if (hay.includes(term)) score += 5
        }
        if (item.kind === 'article') score += 1
        return { item, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.length - b.item.title.length)
      .slice(0, 12)
      .map(({ item }) => item)
  }, [index, query])

  const encodedQuery = encodeURIComponent(query.trim())
  const deepTo = encodedQuery ? `/search?q=${encodedQuery}` : '/search'
  const askTo = encodedQuery ? `/ask?q=${encodedQuery}` : '/ask'
  const suggested = query.trim() && results.length ? results[0] : null

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="مركز البحث الذكي"
      className="fixed inset-0 z-[260] bg-ink/25 p-0 backdrop-blur-sm sm:px-4 sm:pt-[calc(5.5rem+env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <motion.div
        className="mx-auto flex h-[100dvh] max-w-2xl flex-col overflow-hidden bg-canvas shadow-2xl sm:h-auto sm:max-h-[82dvh] sm:rounded-3xl sm:border sm:border-hair"
        initial={reduce ? false : { y: -12, scale: 0.985 }}
        animate={{ y: 0, scale: 1 }}
        exit={reduce ? undefined : { y: -8, scale: 0.985 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        <div className="flex items-center gap-3 border-b border-hair px-4 pb-3 pt-[calc(.85rem+env(safe-area-inset-top))] sm:px-5 sm:py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><SocialIcon name="Search" size={17} /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="اكتب سؤالاً بطريقتك…"
            aria-label="مركز البحث الذكي"
            className="min-w-0 flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-soft/70"
          />
          {query && <button type="button" onClick={() => setQuery('')} className="text-[.76rem] text-soft transition-colors hover:text-accent">مسح</button>}
          <button type="button" onClick={close} className="rounded-full border border-hair px-3 py-1.5 text-[.75rem] text-soft transition-colors hover:border-accent hover:text-accent">إغلاق</button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-hair px-3 py-3 sm:px-4">
          <Link
            to={deepTo}
            onClick={close}
            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-hair bg-wash/55 px-3 py-3 text-right transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/[.055] sm:px-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-105">
              <SocialIcon name="Search" size={18} />
            </span>
            <span className="min-w-0">
              <strong className="block truncate font-display text-[.88rem] font-semibold text-ink transition-colors group-hover:text-accent sm:text-[.94rem]">البحث العميق</strong>
              <span className="mt-0.5 hidden text-[.67rem] text-soft sm:block">يفتش في كامل الأرشيف</span>
            </span>
          </Link>
          <Link
            to={askTo}
            onClick={close}
            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[.055] px-3 py-3 text-right transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/[.09] sm:px-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_20px_-12px_rgb(var(--c-accent))] transition-transform duration-300 group-hover:scale-105">
              <SocialIcon name="Spark" size={18} />
            </span>
            <span className="min-w-0">
              <strong className="block truncate font-display text-[.88rem] font-semibold text-ink transition-colors group-hover:text-accent sm:text-[.94rem]">اسأل العقل الحي</strong>
              <span className="mt-0.5 hidden text-[.67rem] text-soft sm:block">إجابة من مكتبة الدكتور</span>
            </span>
          </Link>
        </div>

        {suggested && (
          <Link to={suggested.to} onClick={close} className="group mx-3 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/[.055] px-4 py-3 sm:mx-4">
            <span className="min-w-0"><span className="block text-[.68rem] font-semibold text-accent">أفضل تطابق</span><span className="mt-0.5 block truncate font-display text-[.94rem] font-semibold text-ink group-hover:text-accent">{suggested.title}</span></span>
            <span className="text-accent">↗</span>
          </Link>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[48vh]">
          {!query.trim() ? null : results.length ? results.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={close}
              className="group block rounded-2xl px-4 py-3 transition-colors hover:bg-wash"
            >
              <span className="text-[.7rem] font-semibold text-accent">{item.meta}</span>
              <span className="mt-1 block font-display text-[.98rem] font-medium leading-relaxed text-ink transition-colors group-hover:text-accent">{item.title}</span>
            </Link>
          )) : (
            <div className="px-5 py-10 text-center">
              <p className="font-display text-[1rem] font-semibold text-ink">لم أجد تطابقاً واضحاً.</p>
              <p className="mt-2 text-[.8rem] text-soft">جرّب عبارة أقصر، أو أرسل السؤال نفسه إلى «العقل الحي».</p>
              <div className="mt-4 flex justify-center gap-2"><Link to={askTo} onClick={close} className="rounded-full bg-accent px-4 py-2 text-[.76rem] font-semibold text-white">العقل الحي</Link><Link to={deepTo} onClick={close} className="rounded-full border border-hair px-4 py-2 text-[.76rem] font-semibold text-soft">البحث العميق</Link></div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40 })
  const loc = useLocation()
  const closeMenu = useCallback(() => setOpen(false), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 50)), [scrollY])
  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (loc.pathname.startsWith('/admin')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [loc.pathname])

  const english = loc.pathname === '/en' || loc.pathname.startsWith('/en/')
  const solid = (scrolled || (loc.pathname !== '/' && loc.pathname !== '/en')) && !open

  /* ---- الهيدر الإنجليزي: ثلاثة روابط هادئة بلا قائمة ---- */
  if (english) {
    const items = [
      { to: '/en', label: 'Home' },
      { to: '/en/cv', label: 'CV' },
      { to: '/en/research', label: 'Research' },
    ]
    return (
      <>
        <motion.div className="fixed left-0 top-0 z-[240] h-[2px] w-full origin-left bg-accent" style={{ scaleX: progress }} />
        <AnimatePresence>{searchOpen && <SearchPalette key="search" close={closeSearch} />}</AnimatePresence>
        <nav aria-label="Main navigation" dir="ltr" className={`site-nav ${solid ? 'is-solid' : ''} fixed inset-x-0 top-0 z-[230] border-b transition-[background-color,border-color] duration-500 ${solid ? 'border-hair bg-canvas/[.9] backdrop-blur-lg backdrop-saturate-150' : 'border-transparent'}`}>
          <div className={`mx-auto flex max-w-shell items-center justify-between px-6 transition-all duration-300 md:px-11 ${solid ? 'h-16' : 'h-[76px]'}`}>
            <Link to="/en" aria-label="Ahmad H. Alfailakawi">
              <img src="/logo.png" alt="" className="h-[36px] w-[60px] object-contain opacity-90 dark:invert" style={{ objectPosition: 'left' }} />
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-5 pe-2 text-[.88rem]">
                {items.map((it) => (
                  <Link key={it.to} to={it.to} className={`transition-colors hover:text-accent ${loc.pathname === it.to ? 'font-semibold text-accent' : 'font-medium text-ink'}`}>
                    {it.label}
                  </Link>
                ))}
              </span>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Quick search"
                title="Quick search (⌘K)"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"
              >
                <SocialIcon name="Search" size={16} />
              </button>
              <ThemeToggle />
              <Link
                to={AR_OF[loc.pathname] || '/'}
                aria-label="النسخة العربية"
                title="النسخة العربية"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-[.82rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent"
              >
                ع
              </Link>
            </div>
          </div>
        </nav>
      </>
    )
  }

  return (
    <>
      <motion.div className="fixed right-0 top-0 z-[240] h-[2px] w-full origin-right bg-accent" style={{ scaleX: progress }} />

      <AnimatePresence>{open && <Overlay key="ov" close={closeMenu} />}</AnimatePresence>
      <AnimatePresence>{searchOpen && <SearchPalette key="search" close={closeSearch} />}</AnimatePresence>

      <nav aria-label="التنقّل الرئيسي" className={`site-nav ${solid ? 'is-solid' : ''} fixed inset-x-0 top-0 z-[230] border-b transition-[background-color,border-color] duration-500 ${solid ? 'border-hair bg-canvas/[.9] backdrop-blur-lg backdrop-saturate-150' : 'border-transparent'}`}>
        <div className={`mx-auto flex max-w-shell items-center justify-between px-6 transition-all duration-300 md:px-11 ${solid ? 'h-16' : 'h-[76px]'}`}>
          <Link to="/" aria-label={profile.name}>
            <img src="/logo.png" alt="" className="h-[36px] w-[60px] object-contain opacity-90 dark:invert" style={{ objectPosition: 'right' }} />
          </Link>

          <div className="flex items-center gap-3">
            {/* زر الإنجليزية مخفي حتى بناء الموقع كاملاً بالإنجليزية — الكشف بقلب SHOW_EN_TOGGLE في data.ts */}
            {SHOW_EN_TOGGLE && (
              <Link
                to={EN_OF[loc.pathname] || '/en'}
                aria-label="English version"
                title="English"
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-hair text-[.68rem] font-semibold tracking-wide text-soft transition-colors hover:border-accent hover:text-accent ${open ? 'invisible pointer-events-none' : ''}`}
              >
                EN
              </Link>
            )}
            <ThemeToggle className={`hidden sm:flex ${open ? 'invisible pointer-events-none' : ''}`} />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="مركز البحث الموحد"
              title="مركز البحث (⌘K)"
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent ${open ? 'invisible pointer-events-none' : ''}`}
            >
              <SocialIcon name="Search" size={16} />
            </button>
            <Link
              to="/contact#booking-form"
              aria-label="حجز موعد"
              title="حجز موعد"
              className={`hidden h-9 w-9 items-center justify-center rounded-full border border-accent text-accent transition-colors hover:bg-accent hover:text-white sm:flex ${open ? 'invisible pointer-events-none' : ''}`}
            >
              <SocialIcon name="Calendar" size={16} />
            </Link>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
            aria-controls="site-menu-dialog"
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
  const cv = useCvLinks()
  const loc = useLocation()
  const english = loc.pathname === '/en' || loc.pathname.startsWith('/en/')

  if (english) {
    return (
      <footer dir="ltr" className="site-footer border-t border-hair px-6 py-12 md:px-11">
        <div className="mx-auto max-w-shell">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <Link to="/en">
              <img src="/logo.png" alt="Ahmad H. Alfailakawi" className="h-10 w-16 object-contain dark:invert" style={{ objectPosition: 'left' }} />
            </Link>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[.9rem] text-soft">
              <Link to="/" className="transition-colors hover:text-accent">العربية</Link>
              <span className="flex items-center gap-3">
                <a href={cv.en || cv.ar} target="_blank" rel="noreferrer" aria-label="CV (PDF)" title="CV (PDF)" className="text-soft transition-colors hover:text-accent">
                  <SocialIcon name="CV" />
                </a>
                {socials.map((s) => (
                  <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label} className="text-soft transition-colors hover:text-accent">
                    <SocialIcon name={s.label} />
                  </a>
                ))}
              </span>
              <span className="inline-flex items-center gap-2">
                <TebyanProjectLink label="Tebyan" />
                <ScheduleProjectLink label="Schedule" />
              </span>
            </div>
          </div>
          <div className="mt-8 border-t border-hair pt-5 text-[.78rem] text-soft">
            <span>© {new Date().getFullYear()} Ahmad H. Alfailakawi — All rights reserved</span>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="site-footer border-t border-hair px-6 py-12 md:px-11">
      <div className="mx-auto max-w-shell">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Link to="/">
            <img src="/logo.png" alt={profile.name} className="h-10 w-16 object-contain dark:invert" style={{ objectPosition: 'right' }} />
          </Link>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[.9rem] text-soft">
            <span className="flex items-center gap-3">
              <a href={cv.ar} target="_blank" rel="noreferrer" aria-label="السيرة الذاتية PDF" title="السيرة الذاتية PDF" className="text-soft transition-colors hover:text-accent">
                <SocialIcon name="CV" />
              </a>
              {socials.map((s) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label} className="text-soft transition-colors hover:text-accent">
                  <SocialIcon name={s.label} />
                </a>
              ))}
            </span>
            <span className="inline-flex items-center gap-2">
              <TebyanProjectLink />
              <ScheduleProjectLink />
            </span>
          </div>
        </div>
        <div className="mt-8 border-t border-hair pt-5 text-[.78rem] text-soft">
          <span>© {new Date().getFullYear()} {profile.fullName} — جميع الحقوق محفوظة</span>
        </div>
      </div>
    </footer>
  )
}

export function TebyanProjectLink({ label = 'تبيان' }: { label?: string }) {
  return (
    <a
      href="https://tebyan.dr-alfailakawi.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تبيان — منصة عامة مستقلة"
      title="تبيان — منصة عامة مستقلة"
      className="tebyan-link group inline-flex items-center gap-2 border-s border-hair ps-4 text-soft transition-colors duration-300 hover:text-[#1f7f72]"
    >
      <img src="/tebyan-icon.png" alt="" className="h-5 w-5 rounded-full object-cover opacity-80 transition-opacity duration-300 group-hover:opacity-100" loading="lazy" />
      <span className="tebyan-link-label text-[.82rem] font-medium">{label}</span>
      <span aria-hidden className="text-[.72rem] transition-transform duration-300 group-hover:-translate-x-0.5">↗</span>
    </a>
  )
}

export function ScheduleProjectLink({ label = 'الجدول الدراسي' }: { label?: string }) {
  return (
    <a
      href="https://schedule.dr-alfailakawi.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="schedule-link group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent"
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3.2v2.4M14 3.2v2.4M4.1 7h11.8" />
        <rect x="3.2" y="4.5" width="13.6" height="12.1" rx="2.1" />
        <path d="M6.4 10.1h2.2M11.4 10.1h2.2M6.4 13.2h2.2M11.4 13.2h2.2" />
      </svg>
      <span className="sr-only">{label}</span>
    </a>
  )
}

/* ---------- Page transition wrapper ---------- */
export function Page({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <motion.div
      className={`signature-page w-full max-w-full overflow-x-hidden ${className}`}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
