import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router'
import { LINK_OUT, SHOW_EN_TOGGLE, academicProfiles, profile, socials, links, upcoming, type Event as SiteEvent } from '../data'
import { useCmsContent, useExtras } from '../lib/content'
import { sortUpcomingEvents } from '../lib/events'
import { listenIsOpen } from '../lib/listen-catalog'
import { ThemeToggle } from './extras'
import { MySpace } from './MySpace'
import { useCvLinks } from '../lib/settings'
import { SocialIcon } from './icons'
import { ClarifiedIconAction } from './ClarifiedIconAction'

export { EASE } from './motion'
export { SocialIcon } from './icons'
import { EASE } from './motion'

/* اسمٌ ثابت وآمن للانتقال المشترك بين بطاقة المادة وصفحتها.
   لا يحمل العنوان نفسه (حتى لا تدخل العربية في custom-ident)، ولا يحتاج تخزيناً
   أو listener؛ React Router يلتقط اللقطتين، والمتصفح يحرّك العنصر نفسه. */
export function sharedViewName(kind: string, key: string) {
  const source = `${kind}:${key}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `vt-${kind.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-${(hash >>> 0).toString(36)}`
}

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
    }, 520)
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
        transition={{ duration: 0.64, ease: EASE, delay }}
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
    }, 650)
    return () => clearTimeout(t)
  }, [reduce])

  const show = reduce || inView || safety

  return (
    <motion.div
      ref={ref}
      className={`site-fade-up ${className}`.trim()}
      initial={reduce ? false : { opacity: 0, y: 11 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 11 }}
      transition={{ duration: 0.42, ease: EASE, delay: Math.min(delay, 0.12) }}
    >
      {children}
    </motion.div>
  )
}

/* ---------- Label ---------- */
export function Label({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  return (
    <div ref={ref} className={`signature-label mb-5 flex items-center gap-3 ${inView && !reduce ? 'is-visible' : ''} ${center ? 'justify-center' : ''}`}>
      <span className="h-[1.5px] w-7 bg-accent" />
      <span className="text-[.8rem] font-semibold uppercase text-accent">{children}</span>
    </div>
  )
}

/* ---------- أثر الفكرة: توقيع بصري حيّ، لا شريط تقدّم تقليدي ---------- */
export function ThoughtTrace() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.32 })
  const dotY = useTransform(progress, [0, 1], ['0%', '100%'])

  if (location.pathname === '/admin' || location.pathname === '/launch' || location.pathname.startsWith('/cv-file/')) return null

  return (
    <div className="idea-signature-trace" aria-hidden="true">
      <span className="idea-signature-trace__base" />
      <motion.span className="idea-signature-trace__ink" style={reduce ? undefined : { scaleY: progress }} />
      <i className="idea-signature-trace__branch idea-signature-trace__branch--a" />
      <i className="idea-signature-trace__branch idea-signature-trace__branch--b" />
      <i className="idea-signature-trace__branch idea-signature-trace__branch--c" />
      <motion.b className="idea-signature-trace__dot" style={reduce ? { top: '18%' } : { top: dotY }} />
    </div>
  )
}

/* ---------- Page heading (used by inner pages) ---------- */
export function PageHead({ label, title, sub }: { label: string; title: string; sub?: string }) {
  const headRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = headRef.current
    if (!node || typeof window === 'undefined') return
    const emit = (compact: boolean) => window.dispatchEvent(new CustomEvent('site:page-title', { detail: { title, label, compact } }))
    emit(false)
    if (!('IntersectionObserver' in window)) return () => emit(false)
    const observer = new IntersectionObserver(([entry]) => emit(!entry.isIntersecting), { rootMargin: '-64px 0px 0px 0px', threshold: 0.08 })
    observer.observe(node)
    return () => {
      observer.disconnect()
      window.dispatchEvent(new CustomEvent('site:page-title', { detail: { title: '', label: '', compact: false } }))
    }
  }, [label, title])

  return (
    <header ref={headRef} className="page-head page-head-scene spatial-stage border-b border-hair px-6 pb-12 pt-28 md:px-11 md:pb-12 md:pt-32">
      <div className="page-head-scene__inner mx-auto max-w-shell">
        <FadeUp>
          <Label>{label}</Label>
          <h1 style={{ viewTransitionName: 'page-title' }} className="scene-heading__title font-display text-[clamp(2.4rem,6vw,4rem)] font-bold leading-[1.25] text-ink">
            <Reveal>{title}</Reveal>
          </h1>
          <span className="scene-heading__rule" aria-hidden="true"><i /></span>
          {sub && <p className="page-head-scene__sub mt-4 max-w-[620px] text-[1.05rem] font-light leading-[1.9] text-ink/80">{sub}</p>}
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

/* ---------- Section head: label + title + "الكل" ---------- */
export function SectionHead({ label, title, to, cta = 'الكل' }: { label: string; title: string; to?: string; cta?: string }) {
  return (
    <div className="section-head-scene mb-10 flex items-end justify-between gap-6">
      <FadeUp>
        <Label>{label}</Label>
        <h2 className="scene-heading__title font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink">
          <Reveal>{title}</Reveal>
        </h2>
        <span className="scene-heading__rule scene-heading__rule--section" aria-hidden="true"><i /></span>
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
type NavItem = {
  to: string
  label: string
  description?: string
  allLabel?: string
  showAllLink?: boolean
  action?: 'search'
  sub?: { to: string; label: string; description?: string }[]
}
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'ابدأ من هنا',
    items: [
      { to: '/articles', label: 'المقالات الفكرية', allLabel: 'جميع المقالات' },
      /* الإذاعة تسكن تحت مجلس الفكرة لأنّ مادتها منه: الحلقات نفسها تُبثّ
         متتابعةً بساعة الكويت. وتختفي معه حين لا حلقة — بقانون «لا رابط
         إلى صفحةٍ فارغة» نفسه. */
      { to: '/listen', label: 'مجلس الفكرة', allLabel: 'كل الحلقات', sub: [
        { to: '/radio', label: 'الإذاعة', description: 'بثٌّ متواصل بساعة الكويت' },
      ] },
      /* «أبحث عن مادة» و«أسأل الأرشيف» يظهران داخل الأداة نفسها (KnowledgeEntry
         في /search و/ask)، فسردهما هنا تكرارٌ لما سيراه بعد نقرةٍ واحدة.
         الوصلة الآن مباشرةٌ إلى الأداة، والطريقان يُختاران داخلها. */
      { to: '/search', label: 'البحث في المعرفة', description: 'مادة منشورة أو سؤال موثّق' },
      { to: '/thought', label: 'الخريطة الفكرية', description: 'الصورة الكبرى للمشروع الفكري' },
      { to: '/atlas', label: 'سماء المقالات', description: 'خريطة تفاعلية للمقالات عبر الزمن وصلات الأفكار' },
    ],
  },
  {
    label: 'المكتبة',
    items: [
      { to: '/research', label: 'الأبحاث المحكمة' },
      { to: '/publications', label: 'الكتب المنشورة' },
      { to: '/curated', label: 'المختارات', allLabel: 'جميع المختارات', sub: [
        { to: '/questions', label: 'سؤال يُقلق التعليم', description: 'أسئلة تربوية' },
        { to: '/radar', label: 'أرشيف الرادار', description: 'ما يستحق المتابعة' },
        { to: '/inbox', label: 'رسائل على الهامش', description: 'رسائل قصيرة وأسئلة تفتح زوايا جديدة' },
      ] },
    ],
  },
  {
    label: 'عن الدكتور',
    items: [
      { to: '/cv', label: 'السيرة الأكاديمية' },
      { to: '/media', label: 'الظهور الإعلامي' },
      { to: '/upcoming', label: 'اللقاءات القادمة' },
    ],
  },
]

const isPrimaryNavActive = (item: NavItem, pathname: string) => {
  if (item.to === '/thought') return pathname === '/thought' || pathname === '/thought-paths' || pathname === '/decade' || pathname === '/impact' || pathname.startsWith('/impact/')
  if (item.to === '/curated') return pathname === '/curated' || pathname === '/questions' || pathname === '/radar' || pathname === '/inbox'
  return pathname === item.to || Boolean(item.sub?.some((sub) => sub.to === pathname))
}

function Overlay({ close, openSearch }: { close: () => void; openSearch: () => void }) {
  const reduce = useReducedMotion()
  const loc = useLocation()
  const dialogRef = useRef<HTMLDivElement>(null)
  // العنوان والسهم يفتحان الفروع معاً؛ ورابط «جميع…» يبقى واضحاً ومستقلاً.
  const [openSub, setOpenSub] = useState<string | null>(null)

  /* «اللقاءات القادمة» تُخفى من القائمة حين لا لقاء مُعلَناً — كي لا يقود الرابط
     إلى صفحةٍ فارغة. القائمة مغلقةٌ حتى يفتحها الزائر، وبيانات اللقاءات تُحمَّل
     مع الصفحة، فتستقر الحالة قبل أن تُرى — بلا وميض. تعود فور إعلان لقاءٍ جديد. */
  const cmsUpcoming = useExtras<SiteEvent & { id: string }>('site_upcoming')
  /* «مجلس الفكرة» يخضع لقانون «اللقاء القادم» نفسه: لا يُعرض رابطٌ إلى صفحةٍ لم تمتلئ. */
  const hasUpcoming = useMemo(() => sortUpcomingEvents([...cmsUpcoming, ...upcoming]).length > 0, [cmsUpcoming])
  const groups = useMemo(
    () => GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        (item.to !== '/upcoming' || hasUpcoming) && (item.to !== '/listen' || listenIsOpen)),
    })).filter((group) => group.items.length),
    [hasUpcoming],
  )

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
      className="site-menu-overlay site-menu-overlay--ar fixed inset-0 z-[220] isolate flex flex-col bg-canvas outline-none"
      style={{ backgroundColor: 'rgb(var(--c-canvas))' }}
      initial={reduce ? { opacity: 0 } : { y: '-100%' }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: '-100%' }}
      transition={{ duration: 0.46, ease: EASE }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_75%_35%,rgba(62,92,120,.055),transparent_65%)]" />

      <div className="relative flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-start px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5.4rem+env(safe-area-inset-top))] md:items-center md:px-11 md:py-28">
        <div className="site-menu-groups mx-auto grid w-full max-w-shell gap-5 md:grid-cols-3 md:gap-x-12 md:gap-y-10">
          {groups.map((g, gi) => (
            <div key={g.label} className="border-b border-hair pb-5 md:border-0 md:pb-0">
              <motion.span
                className="block text-[.68rem] font-semibold uppercase text-accent md:text-[.72rem]"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.09 + gi * 0.025, ease: EASE }}
              >
                <span>{g.label}</span>
              </motion.span>

              <ul className="mt-3 space-y-1 md:mt-4">
                {g.items.map((it, ii) => {
                  const expanded = openSub === it.to
                  const active = isPrimaryNavActive(it, loc.pathname)
                  const subId = `menu-sub-${gi}-${ii}`
                  return (
                  <li key={it.to} className="-my-[0.2em] overflow-hidden py-[0.2em]">
                    <motion.div
                      initial={reduce ? false : { y: '150%' }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.34, delay: 0.12 + gi * 0.025 + ii * 0.018, ease: EASE }}
                    >
                      {it.sub ? (
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => setOpenSub(expanded ? null : it.to)}
                            aria-label={expanded ? `طي فروع ${it.label}` : `عرض فروع ${it.label}`}
                            aria-expanded={expanded}
                            aria-controls={subId}
                            className={`site-menu-control group flex min-h-11 w-full items-start justify-between gap-4 text-right transition-colors duration-300 hover:text-accent ${active ? 'text-accent' : 'text-ink'}`}
                          >
                            <span className="min-w-0 flex-1 font-display text-[1.15rem] font-medium leading-[1.5] md:text-[1.35rem]">
                              <span className="block">{it.label}</span>
                              {it.description && <span className="mt-0.5 block font-sans text-[.7rem] font-normal text-soft">{it.description}</span>}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 self-center rounded-full border border-hair px-2.5 py-1.5 text-[.62rem] font-normal text-soft transition-colors group-hover:border-accent group-hover:text-accent">
                              <span>{expanded ? 'إغلاق' : 'فروع'}</span>
                              <motion.svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE }}><path d="M6 9l6 6 6-6" /></motion.svg>
                            </span>
                          </button>
                          {it.showAllLink !== false && (
                            <Link
                              to={it.to}
                              onClick={close}
                              className="site-menu-control mt-0.5 inline-flex min-h-11 items-center py-2 text-[.72rem] font-medium text-soft transition-colors hover:text-accent"
                            >
                              {it.allLabel} <span aria-hidden className="ms-1">←</span>
                            </Link>
                          )}
                        </div>
                      ) : it.action === 'search' ? (
                        <button
                          type="button"
                          onClick={openSearch}
                          className="site-menu-control flex w-full items-center py-1 text-right font-display text-[1.15rem] font-medium leading-[1.5] text-ink transition-colors duration-300 hover:text-accent md:py-1.5 md:text-[1.35rem]"
                        >
                          <span>
                            <span className="block">{it.label}</span>
                            {it.description && <span className="mt-0.5 block font-sans text-[.7rem] font-normal text-soft">{it.description}</span>}
                          </span>
                        </button>
                      ) : (
                        <Link
                          to={it.to}
                          onClick={close}
                          aria-current={active ? 'page' : undefined}
                          className={`site-menu-control flex items-center gap-2.5 py-1 font-display text-[1.15rem] font-medium leading-[1.5] transition-colors duration-300 hover:text-accent md:py-1.5 md:text-[1.35rem] ${
                            active ? 'text-accent' : 'text-ink'
                          }`}
                        >
                          <span>
                            <span className="block">{it.label}</span>
                            {it.description && <span className="mt-0.5 block font-sans text-[.7rem] font-normal text-soft">{it.description}</span>}
                          </span>
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
                                    aria-current={loc.pathname === s.to ? 'page' : undefined}
                                    className={`site-menu-control block py-1.5 text-[.9rem] font-light transition-colors duration-300 hover:text-accent ${
                                      loc.pathname === s.to ? 'text-accent' : 'text-soft'
                                    }`}
                                  >
                                    <span className="block text-ink">{s.label}</span>
                                    {s.description && <span className="mt-0.5 block text-[.68rem] text-soft/80">{s.description}</span>}
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
        transition={{ duration: 0.36, delay: 0.42 }}
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
            <div className="flex items-center gap-2">
              <ThemeToggle className="h-11 w-11" />
              {SHOW_EN_TOGGLE && (
                <Link to="/en" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-full border border-hair text-[.66rem] font-semibold">EN</Link>
              )}
            </div>
            <span className="mx-1 hidden h-5 w-px bg-hair sm:block" />
            {socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} className="transition-colors hover:text-accent">
                <SocialIcon name={s.label} />
              </a>
            ))}
            <span aria-hidden className="mx-0.5 h-4 w-px bg-hair" />
            {academicProfiles.map((profileLink) => (
              <a key={profileLink.label} href={profileLink.url} target="_blank" rel="noreferrer" aria-label={profileLink.label} title={profileLink.label} className="transition-colors hover:text-accent">
                <SocialIcon name={profileLink.label} />
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EnglishOverlay({ close, openSearch }: { close: () => void; openSearch: () => void }) {
  const reduce = useReducedMotion()
  const loc = useLocation()
  const items = [
    { to: '/en', label: 'Home', description: 'Overview' },
    { to: '/en/cv', label: 'Academic CV', description: 'Experience and education' },
    { to: '/en/research', label: 'Research', description: 'Peer-reviewed work' },
    { to: '/en/contact', label: 'Contact', description: 'Consulting, keynotes and media' },
  ]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])
  return (
    <motion.div
      id="site-menu-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
      dir="ltr"
      className="site-menu-overlay fixed inset-0 z-[220] isolate flex flex-col bg-canvas"
      initial={reduce ? { opacity: 0 } : { y: '-100%' }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: '-100%' }}
      transition={{ duration: .44, ease: EASE }}
    >
      <div className="flex flex-1 items-center overflow-y-auto px-6 py-28 md:px-11">
        <div className="mx-auto w-full max-w-shell">
          <p className="text-[.72rem] font-semibold uppercase text-accent">Navigate</p>
          <nav className="mt-6 grid gap-1 md:max-w-2xl" aria-label="English pages">
            {items.map((item) => (
              <Link key={item.to} to={item.to} onClick={close} className={`site-menu-control border-b border-hair py-4 transition-colors hover:text-accent ${loc.pathname === item.to ? 'text-accent' : 'text-ink'}`}>
                <span className="block font-display text-[1.4rem] font-medium md:text-[1.8rem]">{item.label}</span>
                <span className="mt-1 block text-[.76rem] font-light text-soft">{item.description}</span>
              </Link>
            ))}
          </nav>
          <button type="button" onClick={openSearch} className="site-menu-control mt-7 min-h-11 border-b border-hair py-2 text-[.86rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">Search the archive</button>
        </div>
      </div>
      <div className="border-t border-hair px-6 py-4 md:px-11 md:py-6">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4">
          <div className="flex items-center gap-2"><ThemeToggle className="h-11 w-11" /><Link to={AR_OF[loc.pathname] || '/'} onClick={close} className="flex h-11 min-w-11 items-center justify-center rounded-full border border-hair px-3 text-[.76rem] font-semibold text-soft">العربية</Link></div>
          <Link to="/en/contact#booking-form" onClick={close} className="rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white">Book a meeting</Link>
        </div>
      </div>
    </motion.div>
  )
}

/* خريطة التبديل بين المرآتين — الصفحات الثلاث تتقابل، وما عداها يذهب لرئيسية اللغة الأخرى */
const EN_OF: Record<string, string> = { '/': '/en', '/cv': '/en/cv', '/research': '/en/research', '/contact': '/en/contact' }
const AR_OF: Record<string, string> = { '/en': '/', '/en/cv': '/cv', '/en/research': '/research', '/en/contact': '/contact' }

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
  const { articles, books, papers } = useCmsContent()
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
  ], [articles, books, papers])

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
  const bookTo = '/search?tab=askbook'
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
        className="mx-auto flex h-[100dvh] max-w-2xl flex-col overflow-hidden bg-canvas sm:h-auto sm:max-h-[82dvh] sm:rounded-xl sm:border sm:border-hair"
        initial={reduce ? false : { y: -12, scale: 0.985 }}
        animate={{ y: 0, scale: 1 }}
        exit={reduce ? undefined : { y: -8, scale: 0.985 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        <div className="flex items-center gap-3 border-b border-hair px-4 pb-3 pt-[calc(.85rem+env(safe-area-inset-top))] sm:px-5 sm:py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center text-accent"><SocialIcon name="Search" size={18} /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="اكتب سؤالاً بطريقتك…"
            aria-label="مركز البحث الذكي"
            className="min-w-0 flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-soft/70"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث" title="مسح البحث" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-soft transition-colors hover:bg-wash hover:text-accent"><SocialIcon name="Close" size={15} /></button>}
          <button type="button" onClick={close} aria-label="إغلاق البحث" title="إغلاق" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"><SocialIcon name="Close" size={16} /></button>
        </div>

        <nav aria-label="مسارات البحث" className="search-palette-shortcuts">
          <Link to={deepTo} onClick={close} className="search-palette-shortcut"><span>البحث المتقدم</span><span aria-hidden>←</span></Link>
          <Link to={askTo} onClick={close} className="search-palette-shortcut"><span>اسأل الأرشيف</span><span aria-hidden>←</span></Link>
          <Link to={bookTo} onClick={close} className="search-palette-shortcut"><span>ابحث في كتاب</span><span aria-hidden>←</span></Link>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[48vh]">
          {!query.trim() ? null : results.length ? results.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={close}
              className="group block rounded-xl px-4 py-3 transition-colors hover:bg-wash"
            >
              <span className="text-[.7rem] font-semibold text-accent">{item.meta}</span>
              <span className="mt-1 block font-display text-[.98rem] font-medium leading-relaxed text-ink transition-colors group-hover:text-accent">{item.title}</span>
            </Link>
          )) : (
            <div className="px-5 py-10 text-center">
              <p className="font-display text-[1rem] font-semibold text-ink">لم أجد تطابقاً واضحاً.</p>
              <p className="mt-2 text-[.8rem] text-soft">جرّب عبارة أقصر، أو استخدم أحد مسارات البحث أعلاه.</p>
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
  const [showMenuDiscovery, setShowMenuDiscovery] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40 })
  const loc = useLocation()
  const navigate = useNavigate()
  const [pageEcho, setPageEcho] = useState<{ title: string; compact: boolean }>({ title: '', compact: false })
  const ownerPressTimer = useRef<number | null>(null)
  const ownerPressTriggered = useRef(false)
  const [ownerPressActive, setOwnerPressActive] = useState(false)
  const standaloneMode = () => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    } catch { return false }
  }
  const ownerPressStart = (event: React.PointerEvent) => {
    if (!standaloneMode() || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (ownerPressTimer.current) window.clearTimeout(ownerPressTimer.current)
    ownerPressTriggered.current = false
    setOwnerPressActive(true)
    ownerPressTimer.current = window.setTimeout(() => {
      ownerPressTriggered.current = true
      setOwnerPressActive(false)
      try { navigator.vibrate?.(35) } catch { /* unsupported */ }
      navigate('/admin?source=pwa-logo')
    }, 1350)
  }
  const ownerPressEnd = () => {
    if (ownerPressTimer.current) window.clearTimeout(ownerPressTimer.current)
    ownerPressTimer.current = null
    setOwnerPressActive(false)
  }
  const ownerLogoClick = (event: React.MouseEvent) => {
    if (ownerPressTriggered.current) {
      event.preventDefault()
      ownerPressTriggered.current = false
      return
    }
    /* النقر العادي لا يمرّ عبر /launch ولا يعيد شاشة العودة؛ يذهب مباشرةً
       إلى الرئيسية حتى داخل الـPWA وبعد إغلاق أي لوحة أو نافذة. */
    event.preventDefault()
    navigate(loc.pathname === '/en' || loc.pathname.startsWith('/en/') ? '/en' : '/')
  }
  const ownerLogoContextMenu = (event: React.MouseEvent) => { if (standaloneMode()) event.preventDefault() }
  const closeMenu = useCallback(() => setOpen(false), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useEffect(() => () => {
    if (ownerPressTimer.current) window.clearTimeout(ownerPressTimer.current)
  }, [])
  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 50)), [scrollY])
  useEffect(() => setOpen(false), [loc.pathname, loc.search, loc.hash])
  useEffect(() => {
    // Safari قد يعيد الصفحة من bfcache بالحالة السابقة، فتظهر القائمة وكأنها
    // جزء من الرئيسية. كل عودة فعلية للصفحة تبدأ والقائمة مغلقة.
    const resetTransientPanels = () => {
      setOpen(false)
      setSearchOpen(false)
      document.body.style.overflow = ''
    }
    window.addEventListener('pageshow', resetTransientPanels)
    return () => window.removeEventListener('pageshow', resetTransientPanels)
  }, [])
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

  useEffect(() => {
    setPageEcho({ title: '', compact: false })
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; compact?: boolean }>).detail
      setPageEcho({ title: String(detail?.title || ''), compact: Boolean(detail?.compact) })
    }
    window.addEventListener('site:page-title', sync)
    return () => window.removeEventListener('site:page-title', sync)
  }, [loc.pathname])

  useEffect(() => {
    const englishPath = loc.pathname === '/en' || loc.pathname.startsWith('/en/')
    if (englishPath) return
    const usedKey = 'site:menu-discovered:v2'
    const sessionKey = 'site:menu-discovery-shown:v2'
    try {
      if (localStorage.getItem(usedKey) === '1' || sessionStorage.getItem(sessionKey) === '1') return
      sessionStorage.setItem(sessionKey, '1')
    } catch { /* التخزين تحسين بصري فقط. */ }
    const show = window.setTimeout(() => setShowMenuDiscovery(true), 1650)
    const hide = window.setTimeout(() => setShowMenuDiscovery(false), 6800)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [loc.pathname])

  const toggleArabicMenu = () => {
    try { localStorage.setItem('site:menu-discovered:v2', '1') } catch { /* noop */ }
    setShowMenuDiscovery(false)
    setOpen((value) => !value)
  }

  const english = loc.pathname === '/en' || loc.pathname.startsWith('/en/')
  const solid = (scrolled || (loc.pathname !== '/' && loc.pathname !== '/en')) && !open
  const showReadingProgress = /^\/articles\/[^/]+$/.test(loc.pathname) || /^\/research\/[^/]+$/.test(loc.pathname) || loc.pathname === '/decade' || loc.pathname === '/thought-paths' || loc.pathname.startsWith('/impact') || loc.pathname.startsWith('/concept/')

  /* ---- الهيدر الإنجليزي: الشعار والبحث والقائمة فقط؛ الروابط داخل القائمة. ---- */
  if (english) {
    return (
      <>
        {showReadingProgress && <motion.div className="site-scroll-progress fixed left-0 z-[240] h-[2px] w-full origin-left bg-accent" style={{ scaleX: progress }} animate={{ top: solid ? 63 : 75 }} transition={{ duration: .25, ease: EASE }} />}
        <AnimatePresence>{open && <EnglishOverlay key="en-ov" close={closeMenu} openSearch={() => { closeMenu(); setSearchOpen(true) }} />}</AnimatePresence>
        <AnimatePresence>{searchOpen && <SearchPalette key="search" close={closeSearch} />}</AnimatePresence>
        <nav aria-label="Main navigation" dir="ltr" className={`site-nav ${solid ? 'is-solid' : ''} fixed inset-x-0 top-0 z-[230] border-b transition-[background-color,border-color] duration-500 ${solid ? 'border-hair bg-canvas/[.9] backdrop-blur-lg backdrop-saturate-150' : 'border-transparent'}`}>
          <div className={`relative mx-auto flex max-w-shell items-center justify-between px-6 transition-all duration-300 md:px-11 ${solid ? 'h-16' : 'h-[76px]'}`}>
            <AnimatePresence initial={false}>
              {pageEcho.compact && pageEcho.title && solid && !open && !searchOpen && (
                <motion.span key={pageEcho.title} aria-hidden="true" initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }} transition={{ duration: .34, ease: EASE }} className="nav-page-echo pointer-events-none absolute left-1/2 hidden max-w-[42vw] -translate-x-1/2 truncate font-display text-[.82rem] font-semibold text-ink/80 md:block">{pageEcho.title}</motion.span>
              )}
            </AnimatePresence>
            <Link to="/en" aria-label="Ahmad H. Alfailakawi" className={`pwa-owner-logo relative ${ownerPressActive ? 'is-holding' : ''}`} onContextMenu={ownerLogoContextMenu} onPointerDown={ownerPressStart} onPointerUp={ownerPressEnd} onPointerCancel={ownerPressEnd} onPointerLeave={ownerPressEnd} onClick={ownerLogoClick}>
              <img decoding="async" src="/logo.png" alt="" className="h-[36px] w-[60px] object-contain opacity-90 dark:invert" style={{ objectPosition: 'left' }} />
              <span aria-hidden className="pwa-owner-progress" />
            </Link>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSearchOpen(true)} aria-label="Quick search" title="Quick search (⌘K)" className={`flex h-11 w-11 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent ${open ? 'invisible pointer-events-none' : ''}`}>
                <SocialIcon name="Search" size={16} />
              </button>
              <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="site-menu-dialog" className="group flex min-h-11 items-center gap-3.5">
                <span className="hidden text-[.9rem] font-medium text-ink transition-colors group-hover:text-accent sm:block">{open ? 'Close' : 'Menu'}</span>
                <span className="relative flex h-11 w-11 flex-col items-center justify-center gap-[6px] rounded-full border border-hair transition-colors duration-300 group-hover:border-accent">
                  <motion.span className="block h-[1.5px] w-4 bg-ink" animate={open ? { rotate: 45, y: 3.75 } : { rotate: 0, y: 0 }} transition={{ duration: .35, ease: EASE }} />
                  <motion.span className="block h-[1.5px] w-4 bg-ink" animate={open ? { rotate: -45, y: -3.75 } : { rotate: 0, y: 0 }} transition={{ duration: .35, ease: EASE }} />
                </span>
              </button>
            </div>
          </div>
        </nav>
      </>
    )
  }

  return (
    <>
      {showReadingProgress && <motion.div className="site-scroll-progress fixed right-0 z-[240] h-[2px] w-full origin-right bg-accent" style={{ scaleX: progress }} animate={{ top: solid ? 63 : 75 }} transition={{ duration: .25, ease: EASE }} />}

      <AnimatePresence>{open && <Overlay key="ov" close={closeMenu} openSearch={() => { closeMenu(); setSearchOpen(true) }} />}</AnimatePresence>
      <AnimatePresence>{searchOpen && <SearchPalette key="search" close={closeSearch} />}</AnimatePresence>

      <nav aria-label="التنقّل الرئيسي" className={`site-nav ${solid ? 'is-solid' : ''} fixed inset-x-0 top-0 z-[230] border-b transition-[background-color,border-color] duration-500 ${solid ? 'border-hair bg-canvas/[.9] backdrop-blur-lg backdrop-saturate-150' : 'border-transparent'}`}>
        <div className={`relative mx-auto flex max-w-shell items-center justify-between px-6 transition-all duration-300 md:px-11 ${solid ? 'h-16' : 'h-[76px]'}`}>
          <AnimatePresence initial={false}>
            {pageEcho.compact && pageEcho.title && solid && !open && !searchOpen && (
              <motion.span key={pageEcho.title} aria-hidden="true" initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }} transition={{ duration: .34, ease: EASE }} className="nav-page-echo pointer-events-none absolute left-1/2 hidden max-w-[42vw] -translate-x-1/2 truncate font-display text-[.82rem] font-semibold text-ink/80 md:block">{pageEcho.title}</motion.span>
            )}
          </AnimatePresence>
          <Link to="/" aria-label={profile.name} className={`pwa-owner-logo relative ${ownerPressActive ? 'is-holding' : ''}`} onContextMenu={ownerLogoContextMenu} onPointerDown={ownerPressStart} onPointerUp={ownerPressEnd} onPointerCancel={ownerPressEnd} onPointerLeave={ownerPressEnd} onClick={ownerLogoClick}>
            <img decoding="async" src="/logo.png" alt="" className="h-[36px] w-[60px] object-contain opacity-90 dark:invert" style={{ objectPosition: 'right' }} />
            <span aria-hidden className="pwa-owner-progress" />
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="مركز البحث الموحد"
              title="مركز البحث (⌘K)"
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent ${open ? 'invisible pointer-events-none' : ''}`}
            >
              <SocialIcon name="Search" size={16} />
            </button>
          <button
            type="button"
            onClick={toggleArabicMenu}
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
            aria-controls="site-menu-dialog"
            className={`site-menu-trigger group relative flex min-h-11 items-center gap-3.5 ${showMenuDiscovery ? 'is-discovering' : ''}`}
          >
            {showMenuDiscovery && (
              <span className="site-menu-discovery" aria-hidden="true">
                كل أبواب الموقع هنا
              </span>
            )}
            <span className="hidden text-[.9rem] font-medium text-ink transition-colors group-hover:text-accent sm:block">
              {open ? 'إغلاق' : 'القائمة'}
            </span>
            <span className="relative flex h-11 w-11 flex-col items-center justify-center gap-[6px] rounded-full border border-hair transition-colors duration-300 group-hover:border-accent">
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

/* ---------- Social dock: حضور رقمي واحد بدلاً من جدار أيقونات ---------- */
export function SocialDock({ english = false, centered = false }: { english?: boolean; centered?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`site-social-dock ${open ? 'is-open' : ''} ${centered ? 'is-centered' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={english ? 'Open social profiles' : 'فتح روابط التواصل'}
        title={english ? 'Social profiles' : 'تواصل معي'}
        className="site-social-dock__trigger"
      >
        <SocialIcon name="Share" size={17} />
      </button>
      <div className="site-social-dock__panel" aria-label={english ? 'Social and academic profiles' : 'الحضور الرقمي والأكاديمي'}>
        <div className="site-social-dock__socials">
          {socials.map((item) => (
            <a key={item.label} href={item.url} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
              <SocialIcon name={item.label} size={16} />
            </a>
          ))}
        </div>
        <span className="site-social-dock__divider" aria-hidden="true" />
        <div className="site-social-dock__academic">
          {academicProfiles.map((item) => (
            <ClarifiedIconAction key={item.label} id={`social-dock-${item.label.toLowerCase().replace(/\s+/g, '-')}`} label={item.label}>
              <a href={item.url} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                <SocialIcon name={item.label} size={17} />
              </a>
            </ClarifiedIconAction>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Footer ---------- */
export function Footer() {
  const cv = useCvLinks()
  const loc = useLocation()
  const english = loc.pathname === '/en' || loc.pathname.startsWith('/en/')
  const year = new Date().getFullYear()

  if (english) {
    return (
      <footer dir="ltr" className="site-footer site-footer--calm border-t border-hair px-6 py-8 md:px-11 md:py-10">
        <div className="mx-auto max-w-shell">
          <div className="site-footer__main">
            <Link to="/en" className="site-footer__mark">
              <img decoding="async" src="/logo.png" alt="Ahmad H. Alfailakawi" className="h-9 w-14 object-contain dark:invert" />
            </Link>
            <SocialDock english />
            <nav className="site-footer__utility" aria-label="Site links">
              <Link to="/" className="site-footer__text-link">العربية</Link>
              <ClarifiedIconAction id="footer-cv-en" label="CV">
                <a href={cv.en || cv.ar} target="_blank" rel="noreferrer" aria-label="CV" title="CV" className="site-footer__icon-link"><SocialIcon name="CV" size={17} /></a>
              </ClarifiedIconAction>
              <TebyanProjectLink label="Tebyan" iconOnly className="site-footer__project" />
              <ScheduleProjectLink label="Schedule" iconOnly className="site-footer__project" />
            </nav>
          </div>
          <div className="site-footer__rights">© {year} Ahmad H. Alfailakawi · All rights reserved</div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="site-footer site-footer--calm border-t border-hair px-6 py-8 md:px-11 md:py-10">
      <div className="mx-auto max-w-shell">
        <div className="site-footer__main">
          <Link to="/" className="site-footer__mark">
            <img decoding="async" src="/logo.png" alt={profile.name} className="h-9 w-14 object-contain dark:invert" />
          </Link>
          <SocialDock />
          <nav className="site-footer__utility" aria-label="روابط الموقع المختصرة">
            <MySpace variant="footer" />
            <ClarifiedIconAction id="footer-cv-ar" label="السيرة الذاتية">
              <a href={cv.ar} target="_blank" rel="noreferrer" aria-label="السيرة الذاتية" title="السيرة الذاتية" className="site-footer__icon-link"><SocialIcon name="CV" size={17} /></a>
            </ClarifiedIconAction>
            <TebyanProjectLink label="تبيان" iconOnly className="site-footer__project" />
            <ScheduleProjectLink label="الجدول" iconOnly className="site-footer__project" />
          </nav>
        </div>
        <div className="site-footer__rights">© {year} {profile.fullName} · جميع الحقوق محفوظة</div>
      </div>
    </footer>
  )
}

export function TebyanProjectLink({ label = 'تبيان', iconOnly = true, className = '' }: { label?: string; iconOnly?: boolean; className?: string }) {
  const link = (
    <a
      href="https://tebyan.dr-alfailakawi.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تبيان — منصة عامة مستقلة"
      title="تبيان — منصة عامة مستقلة"
      className={`tebyan-link inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-[border-color,color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent ${iconOnly ? 'w-10' : 'min-w-10 gap-2 px-3.5 text-[.72rem] font-semibold'} ${className}`.trim()}
    >
      <SocialIcon name="Tebyan" size={18} />
      {!iconOnly && <span>{label}</span>}
    </a>
  )
  return iconOnly
    ? <ClarifiedIconAction id="project-tebyan" label="تبيان: منصة عامة مستقلة">{link}</ClarifiedIconAction>
    : link
}

export function ScheduleProjectLink({ label = 'الجدول الدراسي', iconOnly = true, className = '' }: { label?: string; iconOnly?: boolean; className?: string }) {
  const link = (
    <a
      href="https://schedule.dr-alfailakawi.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`schedule-link inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-[border-color,color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent ${iconOnly ? 'w-10' : 'min-w-10 gap-2 px-3.5 text-[.72rem] font-semibold'} ${className}`.trim()}
    >
      <SocialIcon name="Schedule" size={18} />
      {!iconOnly && <span>{label}</span>}
    </a>
  )
  return iconOnly
    ? <ClarifiedIconAction id="project-schedule" label="فتح برنامج الجدول الدراسي">{link}</ClarifiedIconAction>
    : link
}

/* ---------- Page transition wrapper ---------- */
export function Page({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  /* صفحات PageHead ترسل العنوان بنفسها. أمّا صفحات التفاصيل ذات الهيرو الخاص
     فنلتقط أول H1 فقط، ونحوّله إلى صدى صغير في الشريط حين يغادر الشاشة.
     لا scroll listener ولا إعادة رسم مستمرة: مراقب تقاطع واحد لكل صفحة. */
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window === 'undefined' || root.querySelector('.page-head')) return
    let intersection: IntersectionObserver | null = null
    let mutation: MutationObserver | null = null
    let bound = false

    const bind = () => {
      if (bound) return true
      const heading = root.querySelector('h1') as HTMLElement | null
      if (!heading) return false
      const title = heading.textContent?.replace(/\s+/g, ' ').trim() || ''
      if (!title) return false
      bound = true
      const emit = (compact: boolean) => window.dispatchEvent(new CustomEvent('site:page-title', { detail: { title, label: '', compact } }))
      emit(false)
      if ('IntersectionObserver' in window) {
        intersection = new IntersectionObserver(([entry]) => emit(!entry.isIntersecting), { rootMargin: '-64px 0px 0px 0px', threshold: 0.08 })
        intersection.observe(heading)
      }
      return true
    }

    if (!bind() && 'MutationObserver' in window) {
      mutation = new MutationObserver(() => {
        if (bind()) mutation?.disconnect()
      })
      mutation.observe(root, { childList: true, subtree: true })
    }

    return () => {
      intersection?.disconnect()
      mutation?.disconnect()
      if (bound) window.dispatchEvent(new CustomEvent('site:page-title', { detail: { title: '', label: '', compact: false } }))
    }
  }, [className])

  return <div ref={rootRef} className={`signature-page w-full max-w-full overflow-x-clip ${className}`}>{children}</div>
}
