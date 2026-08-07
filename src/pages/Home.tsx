import { JsonLd, useSeo } from '../components/seo'
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'
import { EASE, FadeUp, Label, Magnetic, Page, Reveal, ScheduleProjectLink, SectionHead, SocialIcon, TebyanProjectLink } from '../components/ui'
import { academicProfiles, profile, roundDown10, socials, upcoming, type Event as SiteEvent } from '../data'
import { useCmsContent, useExtras } from '../lib/content'
import { firebaseEnabled, getDb } from '../lib/firebase'
import { Newsletter } from '../components/extras'
import { type Curio } from '../data-curated'
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from '../lib/cms'
import HumanCoreHero from '../components/home/HumanCoreHero'
import { ideaContinuation } from '../lib/idea-memory'
import { sortUpcomingEvents } from '../lib/events'
import { categoryLabel, dynamicArticleCategories } from '../lib/content-taxonomy'
import { PROJECT_START_YEAR } from '../lib/project-meta'
import { listenIsOpen, rotatingQuestion, type ListenEpisode } from '../lib/listen-catalog'
import { SPACE_EVENT, isArticleSaved, toggleSavedArticle } from '../lib/reading-space'
import { SocialIcon as ActionIcon } from '../components/icons'
import { trackUsage } from '../lib/usage-analytics'
import { arabicCountPhrase, ARTICLE_THOUGHT_AFTER_PREPOSITION_FORMS, ARTICLE_FORMS, BOOK_FORMS, BOOK_PLAIN_FORMS, NEW_ARTICLE_FORMS, PAPER_FORMS, YEAR_AFTER_PREPOSITION_FORMS } from '../lib/arabic-count.ts'

/* افتتاحيةُ العتبة ٧٦٨ سطراً ولا يراها إلا الزائر الأول (تحرسها localStorage)،
   فإبقاؤها في حزمة الدخول يُثقل كلَّ زائرٍ عائد بلا فائدة ويتجاوز ميزانية الأداء */
const ThresholdOverture = lazy(() => import('../components/home/ThresholdOverture'))
/* الإذاعة تُطلّ على الصفحة الرئيسية كسولةً: من لم تُفتح لديه لا يدفع بايتاً. */
const OnAirNow = lazy(() => import('../components/home/OnAirNow'))

const arNum = (n: number) => String(n).padStart(2, '0')
const ytId = (u: string) => (u.match(/v=([\w-]{6,})/) || [])[1] || ''

function HomeMediaThumb({ url, title }: { url: string; title: string }) {
  const videoId = ytId(url)
  const [source, setSource] = useState(() => videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '')

  if (!source) return <div className="h-full w-full bg-wash" aria-hidden="true" />

  return (
    <img
      src={source}
      alt={title}
      loading="lazy"
      width="480"
      height="360"
      className="h-full w-full object-cover"
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth <= 120 && source.includes('/hqdefault.')) {
          setSource(source.replace('/hqdefault.', '/mqdefault.'))
        }
      }}
      onError={() => {
        if (source.includes('/hqdefault.')) setSource(source.replace('/hqdefault.', '/mqdefault.'))
      }}
    />
  )
}

function QuickArticleActions({ article, className = '' }: { article: ArticleRecord; className?: string }) {
  const [saved, setSaved] = useState(() => isArticleSaved(article.slug))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const sync = () => setSaved(isArticleSaved(article.slug))
    window.addEventListener(SPACE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(SPACE_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [article.slug])

  const shareArticle = async () => {
    const url = `${window.location.origin}/articles/${article.slug}`
    try {
      if (navigator.share) await navigator.share({ title: article.title, url })
      else await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSaved(toggleSavedArticle(article)) }}
        aria-label={saved ? 'إزالة المقال من مساحتي' : 'حفظ المقال في مساحتي'}
        title={saved ? 'إزالة المقال من مساحتي' : 'حفظ المقال في مساحتي'}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-[.9rem] transition-colors ${saved ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
      >
        <ActionIcon name="Bookmark" size={16} />
      </button>
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); void shareArticle() }}
        aria-label={copied ? 'تمت مشاركة المقال' : 'مشاركة المقال'}
        title={copied ? 'تمت مشاركة المقال' : 'مشاركة المقال'}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-[.9rem] transition-colors ${copied ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
      >
        <ActionIcon name={copied ? 'Check' : 'Share'} size={16} />
      </button>
    </div>
  )
}

/* ---------- «فكرة اليوم» — بطاقة واحدة هادئة تتبدل كل منتصف ليل ----------
   تعيد استخدام محرك المختارات اليومي؛ تُحمَّل كسولاً فلا تُثقل الرئيسية */
/* سؤالٌ واحد من مجلس الفكرة داخل شريط «الآن» — بلا قسمٍ جديد ولا صورة ولا
   عدّاد: بطاقةٌ رابعة في شريطٍ قائم، تحمل سؤالاً من حوارٍ مسموع ويتبدّل مع
   الوقت. ولا تظهر إطلاقاً قبل أن يمتلئ المجلس. */
function MajlisSpark() {
  const [episode, setEpisode] = useState<ListenEpisode | null>(null)
  useEffect(() => { setEpisode(rotatingQuestion()) }, [])
  if (!listenIsOpen || !episode) return null
  return (
    <Link
      to="/listen"
      data-hover
      className="group relative flex h-full flex-col rounded-2xl border border-hair bg-canvas p-6 transition-colors duration-300 hover:border-accent md:p-7"
    >
      <p className="mb-4 flex items-center gap-2.5 text-[.76rem] font-semibold text-accent">
        <SocialIcon name="Play" size={13} />
        مجلس الفكرة
      </p>
      <p className="font-display text-[1.08rem] font-semibold leading-[1.75] text-ink transition-colors group-hover:text-accent">
        {episode.question || episode.title}
      </p>
      <p className="mt-auto flex items-center gap-2 border-t border-hair pt-4 text-[.74rem] text-soft">
        <span className="truncate">{episode.title}</span>
        <span className="ms-auto shrink-0 text-accent transition-transform duration-300 group-hover:-translate-x-1">استمع ←</span>
      </p>
    </Link>
  )
}

function DailySpark({ compact = false }: { compact?: boolean }) {
  const [c, setC] = useState<Curio | null>(null)
  useEffect(() => {
    let on = true
    import('../data-curated').then((m) => { if (on) setC(m.todaysPick()) })
    return () => { on = false }
  }, [])
  if (!c) return null

  const card = (
    <Link
      to="/curated"
      data-hover
      className={`group relative block h-full overflow-hidden rounded-2xl border border-hair bg-canvas transition-colors duration-300 hover:border-accent ${compact ? 'p-6 md:p-7' : 'p-8 md:p-11'}`}
    >
      <span aria-hidden className="pointer-events-none absolute left-5 top-5 h-8 w-8 rounded-full border border-accent/20" />
      <p className="relative mb-4 flex items-center gap-2.5 text-[.76rem] font-semibold text-accent">
        <span className="pulse relative h-1.5 w-1.5 rounded-full bg-accent" />
        فكرة اليوم · {c.kind}
      </p>
      <p className={`relative font-display font-semibold leading-[1.75] text-ink transition-colors group-hover:text-accent ${compact ? 'text-[1.08rem]' : 'max-w-3xl text-[clamp(1.35rem,3vw,2rem)]'}`}>
        {c.ar}
      </p>
      {!compact && c.en && (
        <p className="relative mt-3 max-w-2xl text-[.95rem] font-light text-soft" dir="ltr" style={{ textAlign: 'left' }}>{c.en}</p>
      )}
      <p className={`relative flex flex-wrap items-center gap-2 border-t border-hair text-soft ${compact ? 'mt-5 pt-4 text-[.74rem]' : 'mt-6 pt-4 text-[.82rem]'}`}>
        <span>{c.source}</span>
        {!compact && <><span className="text-hair">·</span><span>تتبدّل كل منتصف ليل</span></>}
        <span className="ms-auto text-accent transition-transform duration-300 group-hover:-translate-x-1">المزيد ←</span>
      </p>
    </Link>
  )

  if (compact) return card
  return (
    <section className="border-t border-hair px-6 py-12 md:px-11 md:py-[62px]">
      <div className="mx-auto max-w-shell"><FadeUp>{card}</FadeUp></div>
    </section>
  )
}

/* ---------- لمحة «سماء المقالات» — نجوم هادئة تمهد للخريطة الكاملة ---------- */
function MiniAtlas() {
  const discoveryRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = discoveryRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { trackUsage('atlas_impression', { sourcePage: '/', position: 'home_mini_atlas' }, { onceKey: 'atlas-impression:home-mini' }); observer.disconnect() }
    }, { threshold: 0.35 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const reduce = useReducedMotion()
  const { articles } = useCmsContent()
  // موضع حتمي: الزمن أفقياً (الأقدم يميناً كما في السماء الكاملة)، وتشتت رأسي من بصمة العنوان
  const t0 = new Date('2019-01-01').getTime()
  const t1 = new Date('2026-12-31').getTime()
  const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7)
  // عيّنة هادئة موزعة عبر الزمن — لا كل الأرشيف (الزحام يقتل السحر، والسماء الكاملة في /atlas)
  const step = Math.max(1, Math.ceil(articles.length / 54))
  const sample = articles.filter((_, i) => i % step === 0)
  const stars = sample.map((a) => ({
    slug: a.slug, title: a.title,
    x: 100 - ((new Date(a.iso).getTime() - t0) / (t1 - t0)) * 100,
    y: 12 + (hash(a.slug) % 76),
    r: 2 + (hash(a.title) % 3),
  }))
  return (
    <section ref={discoveryRef} className="border-t border-hair px-6 py-10 md:px-11 md:py-[62px]">
      <div className="mx-auto max-w-shell" onClick={(event) => { const target = event.target as HTMLElement; if (target.closest('a[href="/atlas"]')) trackUsage('atlas_discovered', { sourcePage: '/', position: 'home_mini_atlas' }) }}>
        <SectionHead label="سماء المقالات" title="كل نجمة مقال." to="/atlas" cta="الخريطة الكاملة" />
        <FadeUp>
          <div className="relative mt-7 h-[120px] overflow-hidden rounded-2xl border border-hair bg-wash md:mt-10 md:h-[150px]">
            {stars.map((s, i) => (
              <Link
                key={s.slug}
                to={`/articles/${s.slug}`}
                title={s.title}
                data-hover
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ right: `${s.x}%`, top: `${s.y}%` }}
              >
                <motion.span
                  className="block rounded-full bg-accent/70 transition-colors duration-300 group-hover:bg-accent"
                  style={{ width: s.r * 2, height: s.r * 2 }}
                  initial={reduce ? false : { opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: Math.min(i * 0.012, 0.9), ease: EASE }}
                />
              </Link>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ---------- «منذ زيارتك الأخيرة» — الموقع يتذكّر (فكرة نووية ٣ لصديقه) ----------
   تخزين محلي بسيط: يظهر سطر هادئ للعائد بعد ٱ٢ ساعة+ يخبره بالجديد فقط. */
function SinceLastVisit() {
  const { articles } = useCmsContent()
  const [last] = useState<number | null>(() => {
    try {
      const prev = localStorage.getItem('visit:last')
      localStorage.setItem('visit:last', String(Date.now()))
      return prev ? +prev : null
    } catch { return null }
  })
  // آخر مقالٍ فتحه الزائر (من جهازه فقط) — يُعرض له بهدوء ليُكمل من حيث توقّف
  const [lastReadRaw] = useState<{ slug?: string; at?: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem('read:last') || 'null') } catch { return null }
  })
  const lastReadArticle = lastReadRaw?.slug ? articles.find((article) => article.slug === lastReadRaw.slug) : undefined
  const lastRead = lastReadArticle ? { slug: lastReadArticle.slug, title: lastReadArticle.title, at: Number(lastReadRaw?.at || 0) } : null

  useEffect(() => {
    if (!lastReadRaw?.slug || lastReadArticle) return
    try { localStorage.removeItem('read:last') } catch { /* noop */ }
  }, [lastReadArticle, lastReadRaw?.slug])

  const away = last ? Date.now() - last : 0
  const showSince = last && away >= 12 * 3600e3
  const lastIso = last ? new Date(last).toISOString().slice(0, 10) : ''
  const newArticles = showSince ? articles.filter((a) => a.iso > lastIso).length : 0
  const daysGone = showSince ? Math.floor(away / 864e5) : 0
  const continuation = ideaContinuation(articles)

  const bits: { to: string; t: string }[] = []
  if (newArticles > 0) bits.push({ to: '/articles', t: arabicCountPhrase(newArticles, NEW_ARTICLE_FORMS) })
  if (daysGone >= 1) bits.push({ to: '/curated', t: 'اختيارات تبدّلت' })

  // «تابع من حيث توقفت» يظهر متى وُجد مقالٌ سابق (حتى دون غياب طويل)
  const resume = lastRead && Date.now() - lastRead.at < 45 * 864e5 ? lastRead : null
  if (!bits.length && !resume && !continuation) return null

  return (
    <div className="border-t border-hair bg-wash px-4 py-2.5 sm:px-6 md:px-11">
      <div className="rail mx-auto flex max-w-shell items-center gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5 md:whitespace-nowrap">
        {continuation && (
          <Link to={`/articles/${continuation.article.slug}`} className="group grid min-h-14 w-[88vw] max-w-[32rem] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-xl border border-hair bg-canvas px-4 py-2.5 text-[.78rem] text-soft transition-colors hover:border-accent md:flex md:min-h-12 md:w-auto md:max-w-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-[.82rem]">
            <span className="col-start-1 block font-semibold leading-[1.45] text-accent md:inline">كنت تتبع أثر {continuation.label}</span>
            <span className="col-start-1 line-clamp-1 min-w-0 leading-[1.45] text-ink transition-colors group-hover:text-accent md:inline md:flex-1">أكمل من هنا: «{continuation.article.title}»</span>
            <span className="col-start-2 row-span-2 row-start-1 shrink-0 self-center text-accent transition-transform group-hover:-translate-x-0.5 md:inline">←</span>
          </Link>
        )}
        {resume && (
          <Link to={`/articles/${resume.slug}`} className="group flex min-h-12 w-[88vw] max-w-[32rem] shrink-0 items-center gap-2.5 rounded-xl border border-hair bg-canvas px-4 py-2.5 text-[.78rem] text-soft transition-colors hover:border-accent md:w-auto md:max-w-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-[.82rem]">
            <span className="font-semibold text-accent">تابع من حيث توقفت</span>
            <span className="min-w-0 flex-1 truncate text-ink transition-colors group-hover:text-accent">«{resume.title}»</span>
            <span className="shrink-0 text-accent transition-transform group-hover:-translate-x-0.5">←</span>
          </Link>
        )}
        {bits.length > 0 && (
          <div className="flex min-h-12 w-[88vw] max-w-[32rem] shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-hair bg-canvas px-4 py-2.5 text-[.78rem] text-soft md:w-auto md:max-w-none md:flex-nowrap md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-[.82rem]">
            <span className="w-full font-semibold text-accent md:w-auto">منذ زيارتك الأخيرة</span>
            {bits.map((b, i) => (
              <Link key={b.to} to={b.to} className="transition-colors hover:text-accent">
                {b.t}{i < bits.length - 1 ? ' ·' : ''}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- «كوكبة التوقيعات» — العائلة المعلنة لما لا يشبه غيره ----------
   أفقٌ شعري تعلوه نجوم بارتفاعات متفاوتة (صدى «سماء المقالات»)؛ كل نجمة
   تتلألأ بهدوء وتتوهج حين يلمس الزائر اسمها. لون واحد، حركة همس. */
function Signatures() {
  const sigs = [
    { to: '/atlas', t: 'سماء المقالات' },
    { to: '/thought-paths', t: 'مسار الفكرة' },
    { to: '/ask', t: 'العقل الحي' },
    { to: '/decade', t: 'وثيقة العقد' },
    { to: '/questions', t: 'سؤال يُقلق التعليم' },
  ]
  return (
    <section className="border-t border-hair px-6 py-8 md:px-11 md:py-10">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <p className="text-[.76rem] font-semibold text-accent">توقيعات الموقع</p>
        </FadeUp>
        <FadeUp delay={0.08}>
          <nav className="signatures-rail relative mt-6 flex snap-x snap-proximity items-start gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="توقيعات الموقع">
            {sigs.map((signature, index) => (
              <Link
                key={signature.to}
                to={signature.to}
                data-hover
                className="sig-item group relative flex min-w-[9.5rem] snap-start flex-col items-center px-3 pt-7 text-center md:min-w-0 md:flex-1"
                style={{ ['--tw' as string]: `${(index * 0.65).toFixed(2)}s` }}
              >
                <span aria-hidden className="sig-star" />
                <span aria-hidden className="sig-stem" />
                <span className="block font-display text-[.92rem] font-medium leading-[1.55] text-soft transition-colors duration-300 group-hover:text-ink">
                  {signature.t}
                </span>
              </Link>
            ))}
          </nav>
        </FadeUp>
      </div>
    </section>
  )
}

/* ---------- «في مثل هذا الأسبوع» — الذاكرة الحيّة ----------
   يطابق أسبوع السنة الحالي مع الأرشيف (٢٠١٦ فصاعداً) ويُخرج مقالاً كتبه الدكتور
   في مثل هذه الأيام قبل سنوات — يتبدّل أسبوعياً، بلا خادم وبلا تدخل. */
const yearsAgo = (n: number) => `قبل ${arabicCountPhrase(n, YEAR_AFTER_PREPOSITION_FORMS)}`

function OnThisWeek({ compact = false }: { compact?: boolean }) {
  const { articles } = useCmsContent()
  const today = new Date()
  const doy = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 864e5)
  const t = doy(today)
  const y = today.getFullYear()

  const cands = articles
    .map((a) => ({ a, d: new Date(a.iso + 'T12:00:00') }))
    .filter((x) => !Number.isNaN(x.d.getTime()) && x.d.getFullYear() < y)
    .map((x) => {
      let diff = Math.abs(doy(x.d) - t)
      if (diff > 182) diff = 365 - diff
      return { ...x, diff }
    })
    .filter((x) => x.diff <= 7)
    .sort((p, q) => p.diff - q.diff || p.d.getFullYear() - q.d.getFullYear())

  if (!cands.length) return null
  const week = Math.floor(today.getTime() / (7 * 864e5))
  const pick = cands[week % cands.length]
  const n = y - pick.d.getFullYear()
  const when = pick.d.toLocaleDateString('ar-u-nu-latn', { month: 'long', year: 'numeric' })

  const card = (
    <div data-hover className={`group relative h-full rounded-2xl border border-hair bg-canvas transition-colors hover:border-accent ${compact ? 'p-6 md:p-7' : 'max-w-3xl border-0 p-0'}`}>
      <Link to={`/articles/${pick.a.slug}`} aria-label={`اقرأ مقال: ${pick.a.title}`} className="absolute inset-0 z-0"><span className="sr-only">{pick.a.title}</span></Link>
      <div className="pointer-events-none relative z-10">
        <div className="flex min-w-0 flex-col items-start gap-3 text-accent">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-[1.5px] w-7 shrink-0 bg-accent" />
            <p className="min-w-0 whitespace-nowrap text-[clamp(.7rem,2.25vw,.74rem)] font-semibold leading-none">
              في مثل هذا الأسبوع {yearsAgo(n)}
            </p>
          </div>
          <QuickArticleActions article={pick.a} className="pointer-events-auto shrink-0 flex-nowrap" />
        </div>
        <h2 className={`mt-4 font-display font-semibold leading-[1.55] text-ink transition-colors duration-300 group-hover:text-accent ${compact ? 'text-[1.02rem] md:text-[1.08rem]' : 'text-[clamp(1.4rem,3.2vw,2.1rem)]'}`}>
          «{pick.a.title}»
        </h2>
        <p className="mt-3 text-[.76rem] leading-relaxed text-soft transition-colors group-hover:text-accent">كُتب في {when}</p>
      </div>
    </div>
  )

  if (compact) return card
  return (
    <section className="border-t border-hair px-6 py-10 md:px-11 md:py-[62px]">
      <div className="mx-auto max-w-shell"><FadeUp>{card}</FadeUp></div>
    </section>
  )
}

/* ---------- «بوصلة الفكر» (فكرة نووية ٣) ----------
   تصفّح بالفكرة لا بنوع الملف: كل محور يصله أعماله. أرشيف → عقل يُستكشف. */
const AXIS_KEYS: Record<string, string[]> = {
  'التعليم': ['تعليم', 'تدريس', 'مناهج', 'تعلم', 'التعلم', 'مدرس', 'طلبة', 'التعليمية'],
  'التربية': ['تربية', 'طفل', 'أطفال', 'أبناء', 'أسرة'],
  'مجتمع': ['مجتمع', 'إعلام', 'شباب', 'اجتماعي'],
  'تقنية': ['تكنولوجيا', 'ذكاء', 'رقمي', 'بيانات', 'تطبيقات', 'أجهزة', 'افتراضي'],
  'هوية': ['هوية', 'تراث', 'لغة', 'قيم', 'احتياجات'],
}
function axisDeepDive(axis: string, papers: PaperRecord[], books: BookRecord[]) {
  const keys = AXIS_KEYS[axis] || []
  const hit = <T extends { title: string }>(items: T[], extra: (x: T) => string) => {
    let top: T | null = null, best = 0
    for (const it of items) {
      const text = it.title + ' ' + extra(it)
      let s = 0; for (const k of keys) if (text.includes(k)) s++
      if (s > best) { best = s; top = it }
    }
    return top
  }
  return {
    paper: hit(papers, (paper) => paper.meta || ''),
    book: hit(books, (book) => book.desc || ''),
  }
}

function ThoughtCompass() {
  const { articles, books, papers } = useCmsContent()
  const axes = useMemo(() => dynamicArticleCategories(articles, false).map((key) => ({ key, label: categoryLabel(key) })), [articles])
  const [active, setActive] = useState('التعليم')
  useEffect(() => {
    if (axes.length && !axes.some((axis) => axis.key === active)) setActive(axes[0].key)
  }, [active, axes])
  /* «تصفّح بالفكرة» كانت تأخذ أول ثلاثة كما وردت في المصفوفة بلا ترتيب صريح،
     فيتغيّر المعروض بتغيّر مصدر البيانات. الترتيب الآن بالأحدث صراحةً: المحور
     يفتح على آخر ما كتبه الدكتور فيه، وهو ما يتوقعه القارئ. (التواريخ نفسها
     سليمة — راجعتها: مقالات أبريل ٢٠٢٦ نُشرت فعلاً بإيقاع أسبوعي، والأرشيف
     القديم يحتفظ بتواريخه الأصلية كما في صفحة كل مقال.) */
  const related = [...articles]
    .filter((a) => a.cat === active)
    .sort((left, right) => String(right.iso || right.date || '').localeCompare(String(left.iso || left.date || '')))
    .slice(0, 3)
  const dive = axisDeepDive(active, papers, books)
  const axisLabel = axes.find((a) => a.key === active)?.label || active

  const quickLinks = [
    { to: '/thought-paths', label: 'مسار الفكرة الكامل', tag: 'مسار' },
    { to: '/articles', label: `كل ما كتبته في ${axisLabel}`, tag: 'أرشيف' },
    dive.paper ? { to: `/research/${dive.paper.slug}`, label: dive.paper.title, tag: 'بحث' } : null,
    dive.book ? { to: `/publications/${dive.book.slug}`, label: dive.book.title, tag: 'كتاب' } : null,
  ].filter(Boolean) as { to: string; label: string; tag: string }[]

  return (
    <section className="border-t border-hair px-6 py-10 md:px-11 md:py-[86px]">
      <div className="mx-auto max-w-shell">
        <FadeUp><Label>بوصلة الفكر</Label></FadeUp>
        <FadeUp delay={0.05}>
          <h2 className="mb-7 font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink md:mb-10">
            <Reveal>تصفّح بالفكرة.</Reveal>
          </h2>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="rail -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:gap-2.5 md:overflow-visible md:px-0">
            {axes.map((a) => (
              <button
                key={a.key}
                onMouseEnter={() => setActive(a.key)}
                onClick={() => setActive(a.key)}
                data-hover
                className={`shrink-0 rounded-full border px-4 py-2 font-display text-[.92rem] transition-colors duration-300 md:px-5 md:text-[1.02rem] ${
                  active === a.key ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </FadeUp>

        <div className="rail -mx-6 mt-7 flex gap-3 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-10 md:gap-5 md:px-0">
          {related.map((a, i) => (
            <FadeUp key={a.slug} delay={Math.min(i * 0.06, 0.2)} className="w-[56vw] max-w-[248px] shrink-0 md:w-[31%] md:max-w-none">
              <div data-hover className="group relative flex h-full min-h-[170px] flex-col rounded-2xl border border-hair bg-canvas p-5 transition-colors duration-300 hover:border-accent md:p-6">
                <Link to={`/articles/${a.slug}`} aria-label={`اقرأ مقال: ${a.title}`} className="absolute inset-0 z-0"><span className="sr-only">{a.title}</span></Link>
                <div className="pointer-events-none relative z-10 flex h-full min-w-0 flex-col">
                  <div className="flex items-start justify-between gap-3"><time className="text-[.72rem] text-soft">{a.date}</time><QuickArticleActions article={a} className="pointer-events-auto shrink-0" /></div>
                  <h3 className="mt-2.5 font-display text-[1rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent md:text-[1.12rem]">{a.title}</h3>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
        <FadeUp delay={0.15}>
          <div className="rail -mx-6 mt-7 flex gap-3 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {quickLinks.map((item) => (
              <Link key={`${item.tag}-${item.to}`} to={item.to} className="group flex min-h-[108px] w-[62vw] max-w-[252px] shrink-0 flex-col justify-between rounded-2xl border border-hair bg-wash px-4 py-3.5 text-right transition-colors hover:border-accent md:w-auto md:max-w-none">
                <span className="inline-flex w-fit rounded-full border border-hair px-2 py-0.5 text-[.66rem] text-soft">{item.tag}</span>
                <span className="line-clamp-2 text-[.86rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">{item.label}</span>
                <span aria-hidden className="text-left text-[.9rem] text-accent transition-transform group-hover:-translate-x-1">←</span>
              </Link>
            ))}
            <span aria-hidden className="w-px shrink-0 md:hidden" />
          </div>
        </FadeUp>
      </div>
    </section>
  )
}


/* ---------- «الأثر» — رحلة فكر لا أرقام صاخبة (فكرة نووية ٥) ----------
   خط زمني هادئ يُحسب من المحتوى نفسه، فيقول «ماذا صنعت» لا «كم». */
function ImpactTimeline() {
  const { articles, books, papers } = useCmsContent()
  const years = articles.map((a) => +a.iso.slice(0, 4))
  if (!articles.length) return null
  const firstYear = Math.min(PROJECT_START_YEAR, ...years)
  const latestYear = Math.max(...years)
  const byYear: Record<number, number> = {}
  years.forEach((y) => { byYear[y] = (byYear[y] || 0) + 1 })
  const peakYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0]
  const latest = articles[0]

  const steps = [
    { y: String(firstYear), t: 'البداية — انطلاق الرحلة العلمية التي تشكّل منها المشروع الفكري.' },
    { y: `${peakYear[0]}`, t: `ذروة الإنتاج — ${arabicCountPhrase(Number(peakYear[1]), ARTICLE_FORMS)} في عامٍ واحد.` },
    { y: 'مرجع', t: `أرشيفٌ مؤلَّف — ${arabicCountPhrase(books.length, BOOK_FORMS)} و${arabicCountPhrase(papers.length, PAPER_FORMS)}.` },
    { y: String(latestYear), t: `الأحدث — «${latest.title}».` },
  ]

  return (
    <section className="border-t border-hair px-6 py-10 md:px-11 md:py-[86px]">
      <div className="mx-auto max-w-shell">
        <FadeUp><Label>الأثر</Label></FadeUp>
        <FadeUp delay={0.05}>
          <h2 className="mb-8 font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink md:mb-12">
            <Reveal>رحلة فكر.</Reveal>
          </h2>
        </FadeUp>
        <ol className="relative mr-2 border-r-2 border-hair pr-8">
          {steps.map((s, i) => (
            <FadeUp key={s.t} delay={Math.min(i * 0.1, 0.4)} className={i > 0 && i < steps.length - 1 ? 'hidden md:block' : ''}>
              <li className="relative pb-7 last:pb-0 md:pb-10">
                <span className="absolute right-[-2.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-accent bg-canvas" />
                <span className="font-display text-[1.05rem] font-bold text-accent">{s.y}</span>
                <p className="mt-1.5 max-w-xl text-[1.05rem] font-light leading-[1.85] text-ink/80">{s.t}</p>
              </li>
            </FadeUp>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------- The single "Latest" card ---------- */
function LatestCard({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion()
  const { articles } = useCmsContent()
  const latest = articles[0]
  if (!latest) return null
  const content = (
    <motion.article
      transition={{ duration: 0.4, ease: EASE }}
      className={`group relative h-full overflow-hidden rounded-2xl border border-hair bg-canvas transition-colors duration-300 hover:border-accent ${compact ? 'p-7 md:p-9' : 'p-8 md:p-12'}`}
    >
      <Link to={`/articles/${latest.slug}`} data-hover aria-label={`اقرأ مقال: ${latest.title}`} className="absolute inset-0 z-0"><span className="sr-only">{latest.title}</span></Link>
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-accent/[.07] blur-3xl" />
      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between gap-7">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2.5 text-[.76rem] font-semibold text-accent">
              <span className="pulse relative h-2 w-2 rounded-full bg-accent" />
              الأحدث · مقال
            </span>
            <div className="pointer-events-auto"><QuickArticleActions article={latest} /></div>
          </div>
          <h2 className={`mt-4 font-display font-semibold leading-[1.45] text-ink ${compact ? 'text-[clamp(1.45rem,3vw,2.2rem)]' : 'max-w-[720px] text-[clamp(1.6rem,3.6vw,2.5rem)]'}`}>
            {latest.title}
          </h2>
          {compact && latest.excerpt && <p className="mt-4 max-w-2xl text-[.94rem] font-light leading-[1.9] text-ink/75">{latest.excerpt}</p>}
        </div>

      </div>
    </motion.article>
  )
  if (compact) return content
  return (
    <section className="px-6 pb-12 md:px-11 md:pb-[86px]">
      <div className="mx-auto max-w-shell"><FadeUp>{content}</FadeUp></div>
    </section>
  )
}

type LaunchSettings = {
  active?: boolean
  kind?: 'article' | 'book' | 'paper' | 'media'
  slug?: string
  eyebrow?: string
  note?: string
  endsAt?: { seconds?: number } | string | null
}

function launchEndsAt(value: LaunchSettings['endsAt']) {
  if (!value) return 0
  if (typeof value === 'string') return Date.parse(value) || 0
  return Number(value.seconds || 0) * 1000
}

function LaunchSpotlight({ articles, books, papers, media }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const [settings, setSettings] = useState<LaunchSettings | null>(null)
  useEffect(() => {
    let active = true
    if (!firebaseEnabled) return
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'site_settings', 'launch'))
        if (active && snap.exists()) setSettings(snap.data() as LaunchSettings)
      } catch { /* وضع الإطلاق اختياري؛ لا يؤثر في الرئيسية */ }
    })()
    return () => { active = false }
  }, [])

  const ends = launchEndsAt(settings?.endsAt)
  const activeLaunch = Boolean(settings?.active && settings.kind && settings.slug && (!ends || ends >= Date.now()))
  const article = activeLaunch && settings?.kind === 'article' ? articles.find((item) => item.slug === settings.slug) : undefined
  const book = activeLaunch && settings?.kind === 'book' ? books.find((item) => item.slug === settings.slug) : undefined
  const paper = activeLaunch && settings?.kind === 'paper' ? papers.find((item) => item.slug === settings.slug) : undefined
  const mediaItem = activeLaunch && settings?.kind === 'media' ? media.find((item) => item.slug === settings.slug) : undefined
  const item = article || book || paper || mediaItem
  useEffect(() => {
    document.body.classList.toggle('launch-spotlight-active', Boolean(item))
    return () => document.body.classList.remove('launch-spotlight-active')
  }, [item])
  if (!item || !settings) return null

  const title = item.title
  const description = settings.note || (article?.excerpt ?? book?.desc ?? paper?.meta ?? mediaItem?.outlet ?? '')
  const to = article ? `/articles/${article.slug}` : book ? `/publications/${book.slug}` : paper ? `/research/${paper.slug}` : mediaItem?.url || '/'
  const kindLabel = article ? 'مقال جديد' : book ? 'إصدار جديد' : paper ? 'بحث جديد' : 'ظهور جديد'
  const cover = book?.cover || (mediaItem && ytId(mediaItem.url) ? `https://i.ytimg.com/vi/${ytId(mediaItem.url)}/hqdefault.jpg` : '')
  const LinkTag = mediaItem ? 'a' : Link
  const linkProps = mediaItem ? { href: to, target: '_blank', rel: 'noreferrer' } : { to }

  return (
    <section className="relative flex min-h-[88svh] items-center overflow-hidden border-b border-hair bg-ink px-6 py-24 text-canvas md:px-11">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_65%_at_75%_45%,rgba(138,173,204,.23),transparent_66%)]" />
      <div className="relative mx-auto grid w-full max-w-shell items-center gap-12 md:grid-cols-[1.15fr_.85fr] md:gap-16">
        <FadeUp>
          <p className="flex items-center gap-3 text-[.78rem] font-semibold text-[rgb(var(--c-accent))]">
            <span className="pulse relative h-2 w-2 rounded-full bg-[rgb(var(--c-accent))]" />
            {settings.eyebrow || 'وضع الإطلاق'} · {kindLabel}
          </p>
          <h2 className="mt-6 max-w-3xl font-display text-[clamp(2.35rem,6vw,4.7rem)] font-bold leading-[1.24] text-white">{title}</h2>
          {description && <p className="mt-6 max-w-2xl text-[1.05rem] font-light leading-[2] text-white/70">{description}</p>}
          <LinkTag {...(linkProps as any)} className="mt-9 inline-flex rounded-full bg-white px-8 py-3.5 font-semibold text-ink transition-colors duration-300 hover:bg-white/90">
            اقرأ الآن ←
          </LinkTag>
        </FadeUp>
        <FadeUp delay={0.12}>
          <div className="relative mx-auto max-w-[420px]">
            {cover ? (
              <div className="overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_16px_30px_-24px_rgba(0,0,0,.55)]">
                <img src={cover} alt={title} className="aspect-[4/3] h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-full border border-white/15 bg-white/[.04] p-12 text-center">
                <span className="font-display text-[clamp(1.35rem,3vw,2.1rem)] font-semibold leading-[1.7] text-white/90">فكرة تستحق أن تتصدّر المشهد.</span>
              </div>
            )}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

function NowHub() {
  return (
    <section className="border-t border-hair py-[46px] md:py-[68px]">
      <div className="mx-auto max-w-shell px-6 md:px-11">
        <SectionHead label="الآن" title="ما يستحق انتباهك." />
      </div>
      <div className="rail home-motion-rail mt-1 flex gap-4 overflow-x-auto px-6 pb-5 md:gap-5 md:px-[max(2.75rem,calc((100vw-1180px)/2))]">
        <FadeUp className="w-[70vw] max-w-[500px] shrink-0 md:w-[48vw]"><LatestCard compact /></FadeUp>
        <FadeUp delay={0.08} className="w-[58vw] max-w-[270px] shrink-0 md:w-[34vw]"><DailySpark compact /></FadeUp>
        {listenIsOpen && <FadeUp delay={0.12} className="w-[58vw] max-w-[270px] shrink-0 md:w-[31vw]"><MajlisSpark /></FadeUp>}
        <FadeUp delay={0.14} className="w-[58vw] max-w-[270px] shrink-0 md:w-[31vw]"><OnThisWeek compact /></FadeUp>
        <span aria-hidden className="w-px shrink-0" />
      </div>
    </section>
  )
}

type SelectedArchiveItem = { type: string; kind: 'article' | 'book' | 'paper' | 'media'; title: string; note?: string; to: string; image?: string; external?: boolean; year?: string; article?: ArticleRecord }

function ArchiveCardCover({ item }: { item: SelectedArchiveItem }) {
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState(item.image || '')
  const isBook = item.kind === 'book'
  const showImage = Boolean(source && !failed)
  if (!showImage) {
    return (
      <div className={`archive-editorial-cover archive-editorial-cover--${item.kind} pointer-events-none`} aria-hidden="true">
        <span className="archive-editorial-orbit" />
        <span className="archive-editorial-kicker">{item.kind === 'paper' ? 'RESEARCH' : item.kind === 'book' ? 'BOOK' : item.kind === 'media' ? 'MEDIA' : 'ESSAY'}</span>
        <span className="archive-editorial-mark">{item.kind === 'paper' ? 'R' : item.kind === 'book' ? 'B' : item.kind === 'media' ? 'M' : 'A'}</span>
        <span className="archive-editorial-year">{item.year || 'ARCHIVE'}</span>
      </div>
    )
  }
  return (
    <div className={`pointer-events-none relative z-[1] flex w-full items-center justify-center ${isBook ? 'h-28 bg-wash p-3 md:h-32' : item.external ? 'selected-media-frame h-28 overflow-hidden md:h-32' : 'h-28 overflow-hidden md:h-32'}`} style={item.external ? ({ '--media-thumb': `url(${source})` } as CSSProperties) : undefined}>
      <img
        src={source}
        alt=""
        loading="lazy"
        onLoad={(event) => {
          if (item.external && event.currentTarget.naturalWidth <= 120 && source.includes('/hqdefault.')) setSource(source.replace('/hqdefault.', '/mqdefault.'))
        }}
        onError={() => {
          if (item.external && source.includes('/hqdefault.')) setSource(source.replace('/hqdefault.', '/mqdefault.'))
          else setFailed(true)
        }}
        className={`${isBook ? 'h-full w-full object-contain' : item.external ? 'selected-media-thumb h-full w-full opacity-95' : 'h-full w-full object-cover opacity-90'}`}
      />
    </div>
  )
}

function SelectedWorks({ articles, books, papers, media }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const items = useMemo(() => {
    const random = (max: number) => {
      if (max <= 1) return 0
      if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) return crypto.getRandomValues(new Uint32Array(1))[0] % max
      return Math.floor(Math.random() * max)
    }
    const historyKey = 'home:selected-works:v2'
    let previous: Record<string, string> = {}
    try {
      if (typeof window !== 'undefined') previous = JSON.parse(window.localStorage.getItem(historyKey) || '{}') as Record<string, string>
    } catch { /* زيارة خاصة أو تخزين غير متاح */ }
    const choose = <T extends { slug?: string; url?: string }>(pool: T[], key: string) => {
      if (!pool.length) return undefined
      const alternatives = pool.filter((item) => (item.slug || item.url || '') !== previous[key])
      const source = alternatives.length ? alternatives : pool
      return source[random(source.length)]
    }
    const article = choose(articles, 'article')
    const book = choose(books, 'book')
    const paper = choose(papers, 'paper')
    const mediaItem = choose(media, 'media')
    const nextHistory = {
      article: article?.slug || '',
      book: book?.slug || '',
      paper: paper?.slug || '',
      media: mediaItem?.slug || mediaItem?.url || '',
    }
    try { if (typeof window !== 'undefined') window.localStorage.setItem(historyKey, JSON.stringify(nextHistory)) } catch { /* لا يؤثر في التنويع الحالي */ }
    const selected = [
      /* بطاقة المشاركة المولّدة لكل مقال (١٤٣ بطاقة بهوية الموقع تُبنى في
         build-static) تصلح غلافاً حقيقياً — فلا يبقى صفُّ «أربع زوايا»
         نصفَه صوراً ونصفَه حروفاً مجردة. وإن غابت البطاقة سقط الغلاف
         التحريري المرسوم تلقائياً كما كان (onError في البطاقة). */
      article && { type: 'مقال', kind: 'article', title: article.title, note: article.excerpt, to: `/articles/${article.slug}`, image: `/og/articles/${article.slug}.jpg`, year: article.iso?.slice(0, 4), article },
      book && { type: 'كتاب', kind: 'book', title: book.title, note: book.desc, to: `/publications/${book.slug}`, image: book.cover, year: '' },
      paper && { type: 'بحث محكّم', kind: 'paper', title: paper.titleAr || paper.title, note: paper.meta, to: `/research/${paper.slug}`, image: '', year: paper.iso?.slice(0, 4) },
      mediaItem && { type: 'ظهور إعلامي', kind: 'media', title: mediaItem.title, note: mediaItem.outlet, to: mediaItem.url, image: ytId(mediaItem.url) ? `https://i.ytimg.com/vi/${ytId(mediaItem.url)}/hqdefault.jpg` : '', external: true, year: '' },
    ].filter(Boolean) as SelectedArchiveItem[]
    // لا يثبت ترتيب الأنواع أيضاً؛ كل زيارة مدخل جديد فعلياً إلى الأرشيف.
    return selected
      .map((item) => ({ item, order: random(1_000_000) }))
      .sort((left, right) => left.order - right.order)
      .map(({ item }) => item)
  }, [articles, books, papers, media])

  return (
    <section className="border-t border-hair bg-wash px-6 py-[52px] md:px-11 md:py-[84px]">
      <div className="mx-auto max-w-shell">
        <SectionHead label="من الأرشيف اليوم" title="أربع زوايا، ورؤية تتجدّد." />
        <div className="mobile-card-rail grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {items.map((item, index) => {
            const inner = (
              <div className="group relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-xl border border-hair bg-canvas transition-colors duration-300 hover:border-accent/[.45] md:min-h-[270px]">
                {item.article && <Link to={item.to} aria-label={`اقرأ مقال: ${item.title}`} className="absolute inset-0 z-0"><span className="sr-only">{item.title}</span></Link>}
                <ArchiveCardCover item={item} />
                <div className="pointer-events-none relative z-10 flex flex-1 flex-col p-4 md:p-7">
                  <span className="text-[.72rem] font-semibold text-accent">{item.type}</span>
                  <h3 className="mt-2.5 line-clamp-3 break-words font-display text-[.98rem] font-semibold leading-[1.55] text-ink transition-colors group-hover:text-accent sm:text-[1.05rem] md:mt-3 md:text-[1.3rem]">{item.title}</h3>
                  {item.note && <p className="mt-2 line-clamp-2 text-start text-[.76rem] font-light leading-[1.7] text-soft sm:text-[.8rem] md:mt-2.5 md:line-clamp-3 md:text-[.88rem]">{item.note}</p>}
                  {item.article && <div className="pointer-events-auto mt-auto pt-4"><QuickArticleActions article={item.article} /></div>}
                </div>
              </div>
            )
            return (
              <FadeUp key={`${item.type}-${item.to}`} delay={index * 0.06} className="min-w-0">
                {item.article ? inner : item.external ? <a href={item.to} target="_blank" rel="noreferrer" className="block h-full">{inner}</a> : <Link to={item.to} viewTransition className="block h-full">{inner}</Link>}
              </FadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}



function ProfileAndBooksLayer({ books }: { books: BookRecord[] }) {
  return (
    <>
      <section className="px-6 py-10 md:px-11 md:py-[70px]">
        <div className="mx-auto grid max-w-shell items-start gap-10 md:grid-cols-2 md:gap-14">
          <FadeUp>
            <Label>نبذة</Label>
            <h2 className="font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink">
              {profile.aboutHeading.split('\n').map((line, i) => <Reveal key={i} delay={i * 0.08}>{line}</Reveal>)}
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-[1.12rem] font-light leading-[1.9] text-ink/80">{profile.about}</p>
            <Link to="/cv" className="mt-7 inline-block border-b-[1.5px] border-accent pb-1 font-semibold text-accent">السيرة الكاملة ←</Link>
          </FadeUp>
        </div>
      </section>
      <section className="border-t border-hair bg-wash py-12 md:py-[70px]">
        <div className="mx-auto max-w-shell px-6 md:px-11">
          <SectionHead label="المؤلفات" title={`${arabicCountPhrase(books.length, BOOK_PLAIN_FORMS)}.`} to="/publications" />
        </div>
        <div className="mx-auto grid max-w-shell grid-cols-2 gap-x-4 gap-y-8 px-6 md:grid-cols-3 md:gap-x-8 md:gap-y-12 md:px-11 lg:grid-cols-4">
          {books.map((book, i) => (
            <Card key={book.slug} delay={Math.min(i * 0.035, 0.18)}>
              <Link to={`/publications/${book.slug}`} viewTransition className="group block">
                <div className="overflow-hidden rounded-xl border border-hair bg-white" style={{ aspectRatio: '1024 / 700' }}>
                  <img src={book.cover} alt={book.title} loading="lazy" width="1024" height="700" className="h-full w-full object-cover" />
                </div>
                <h3 className="mt-3 text-wrap-balance font-display text-[1rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent md:text-[1.08rem]">{book.title}</h3>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}

function EditorialLayer({ articles, papers, media }: { articles: ArticleRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const topArticles = articles.slice(0, 3)
  const topPapers = papers.slice(0, 3)
  const topMedia = media.slice(0, 3)
  return (
    <>
      <section className="px-6 py-12 md:px-11 md:py-[70px]">
        <div className="mx-auto max-w-shell">
          <SectionHead label="المقالات الفكرية" title="أفكارٌ تلاحق زمنها." to="/articles" cta="عرض الكل" />
          <div className="grid gap-8 md:grid-cols-[1.5fr_.5fr] md:gap-12">
            <FadeUp>
              {topArticles[0] && <div className="group block">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link to={`/articles/${topArticles[0].slug}`} data-hover className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 text-[.78rem]"><span className="font-semibold text-accent">{categoryLabel(topArticles[0].cat)}</span><span className="h-1 w-1 rounded-full bg-hair" /><time className="text-soft">{topArticles[0].date}</time></div>
                    <h3 className="mt-4 font-display text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-[1.4] text-ink transition-colors group-hover:text-accent">{topArticles[0].title}</h3>
                    {topArticles[0].excerpt && <p className="mt-4 max-w-xl text-[1.02rem] font-light leading-[1.9] text-ink/80">{topArticles[0].excerpt}</p>}
                  </Link>
                  <QuickArticleActions article={topArticles[0]} className="shrink-0" />
                </div>
              </div>}
            </FadeUp>
            <FadeUp delay={0.12} className="hidden md:block">
              <div className="flex flex-col divide-y divide-hair border-r border-hair pr-8">
                {topArticles.slice(1, 3).map((article) => <div key={article.slug} className="group relative py-6 first:pt-0"><Link to={`/articles/${article.slug}`} aria-label={`اقرأ مقال: ${article.title}`} className="absolute inset-0 z-0"><span className="sr-only">{article.title}</span></Link><div className="pointer-events-none relative z-10"><div className="flex items-start justify-between gap-3"><time className="text-[.76rem] text-soft">{article.date}</time><QuickArticleActions article={article} className="pointer-events-auto shrink-0" /></div><h4 className="mt-2 font-display text-[1.1rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">{article.title}</h4></div></div>)}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>
      {/* «العقل الحي» (/ask) كان مبنياً ويعمل ولا يعرفه أحد: صفحةٌ تحاور الأرشيف
          كله. البروز هنا سطرٌ واحدٌ بلغة الصفحة نفسها — بلا بطاقةٍ جديدة ولا لون. */}
      <section className="border-t border-hair px-6 py-10 md:px-11 md:py-[58px]">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Link to="/ask" data-hover className="group flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
              <span className="min-w-0">
                <span className="block text-[.78rem] font-semibold text-accent">العقل الحي</span>
                <span className="mt-2 block font-display text-[clamp(1.35rem,2.8vw,1.95rem)] font-semibold leading-[1.45] text-ink transition-colors group-hover:text-accent">اسأل الأرشيف سؤالاً حقيقياً.</span>
                <span className="mt-3 block max-w-xl text-[.95rem] font-light leading-[1.9] text-ink/75">مقالاتٌ وأبحاثٌ وكتبٌ ولقاءات — يجيبك منها لا من خارجها.</span>
              </span>
              <span className="shrink-0 border-b-[1.5px] border-accent pb-1 text-[.9rem] font-semibold text-accent">اسأل الآن ←</span>
            </Link>
          </FadeUp>
        </div>
      </section>
      <section className="border-t border-hair bg-wash px-6 py-10 md:px-11 md:py-[70px]">
        <div className="mx-auto max-w-shell">
          <SectionHead label="المساهمات العلمية" title="من السؤال إلى الدليل." to="/research" cta="عرض الكل" />
          <ol className="mt-2">
            {topPapers.map((paper, i) => <FadeUp key={paper.slug} delay={Math.min(i * 0.06, 0.24)}><li className={i ? 'border-t border-hair' : ''}><Link to={`/research/${paper.slug}`} className="group flex items-baseline gap-6 py-6"><span className="w-8 shrink-0 font-display text-[1.4rem] font-bold text-accent/70">{arNum(i + 1)}</span><span className="flex-1"><span className="block text-[1.1rem] font-medium leading-[1.7] text-ink transition-colors group-hover:text-accent">{paper.title}</span><span className="mt-1 block text-[.8rem] text-soft">{paper.meta}</span></span><span className="text-soft">←</span></Link></li></FadeUp>)}
          </ol>
        </div>
      </section>
      <section className="border-t border-hair px-6 py-10 md:px-11 md:py-[70px]">
        <div className="mx-auto max-w-shell">
          <SectionHead label="الظهور الإعلامي" title="على الشاشة." to="/media" cta="عرض الكل" />
          <div className="grid gap-8 md:grid-cols-[1.55fr_.45fr] md:gap-12">
            <FadeUp>
              {topMedia[0] && <a href={topMedia[0].url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl"><div className="relative overflow-hidden bg-wash" style={{ aspectRatio: '16 / 9' }}><HomeMediaThumb url={topMedia[0].url} title={topMedia[0].title} /><span className="absolute inset-0 bg-ink/10" /><span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/40 text-white"><SocialIcon name="Play" size={22} /></span></div><div className="mt-4"><span className="text-[.74rem] font-semibold text-accent">{topMedia[0].outlet}</span><h3 className="mt-1.5 font-display text-[1.2rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{topMedia[0].title}</h3></div></a>}
            </FadeUp>
            <FadeUp delay={0.12} className="hidden md:block"><div className="flex flex-col divide-y divide-hair border-r border-hair pr-8">{topMedia.slice(1, 3).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="group flex items-start gap-3 py-5 first:pt-0"><span className="mt-1 text-accent"><SocialIcon name="Play" size={13} /></span><span><span className="block text-[.72rem] font-semibold text-accent">{item.outlet}</span><span className="mt-1 block text-[.98rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{item.title}</span></span></a>)}</div></FadeUp>
          </div>
        </div>
      </section>
    </>
  )
}

function HomeDepth({ books }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const [active, setActive] = useState<'maps' | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])
    const frame = window.requestAnimationFrame(() => (focusable()[0] || dialogRef.current)?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setActive(null); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const items = focusable()
      if (!items.length) { event.preventDefault(); dialogRef.current.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      window.requestAnimationFrame(() => previouslyFocused?.focus())
    }
  }, [active])

  const modal = (
    <AnimatePresence>
      {active && (
        <motion.div className="home-thought-maps-overlay fixed inset-0 z-[1000] bg-ink/[.35] p-3 pt-[calc(4.75rem+env(safe-area-inset-top))] backdrop-blur-sm md:p-8 md:pt-24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && setActive(null)}>
          <motion.div ref={dialogRef} id="home-thought-maps-dialog" role="dialog" aria-modal="true" aria-labelledby="home-thought-maps-title" tabIndex={-1} className="mx-auto h-full max-w-6xl overflow-y-auto rounded-3xl border border-hair bg-canvas shadow-2xl outline-none" initial={{ y: 18, scale: .985 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: .99 }} transition={{ duration: .28, ease: EASE }}>
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-hair bg-canvas/90 px-5 py-3 backdrop-blur md:px-7">
              <h2 id="home-thought-maps-title" className="font-display text-[1rem] font-semibold text-ink">خرائط الفكر والأثر</h2>
              <button onClick={() => setActive(null)} aria-label="إغلاق خرائط الفكر" title="إغلاق" className="flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"><ActionIcon name="Close" size={16} /></button>
            </div>
            <MiniAtlas />
            <ImpactTimeline />
            <Signatures />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <section className="border-t border-hair px-6 py-8 md:px-11 md:py-10">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <button ref={triggerRef} type="button" onClick={() => setActive('maps')} aria-haspopup="dialog" aria-expanded={Boolean(active)} aria-controls="home-thought-maps-dialog" className="group flex w-full items-center justify-between gap-5 border-y border-hair px-1 py-5 text-right transition-colors hover:border-accent md:py-6">
              <span className="flex min-w-0 items-center gap-4">
                <span aria-hidden className="relative h-9 w-9 shrink-0">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-hair" />
                  <span className="absolute right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent" />
                  <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-accent bg-canvas" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[.72rem] font-semibold text-accent">خرائط الفكر والأثر</span>
                  <span className="mt-1 block font-display text-[1.03rem] font-semibold leading-[1.55] text-ink md:text-[1.2rem]">مدخل واحد إلى سماء المقالات، رحلة الأثر، وتوقيعات الموقع.</span>
                </span>
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-all group-hover:border-accent group-hover:-translate-x-0.5">←</span>
            </button>
          </FadeUp>
        </div>
      </section>

      {typeof document !== 'undefined' ? createPortal(modal, document.body) : modal}
    </>
  )
}

function HomeSocialFooter() {
  const [newsletterOpen, setNewsletterOpen] = useState(false)
  const iconButton = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-[border-color,color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent'
  return (
    <section className="border-t border-hair px-6 py-7 md:px-11 md:py-9">
      <div className="mx-auto max-w-shell">
        <div className="grid justify-items-center gap-3.5">
          <div className="max-w-full overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="منصات الدكتور">
            <div className="mx-auto flex min-w-max items-center justify-center gap-2.5">
              {socials.map((s) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label} className={iconButton}>
                  <SocialIcon name={s.label} size={16} />
                </a>
              ))}
              {academicProfiles.map((profileLink) => (
                <a key={profileLink.label} href={profileLink.url} target="_blank" rel="noreferrer" aria-label={profileLink.label} title={profileLink.label} className={iconButton}>
                  <SocialIcon name={profileLink.label} size={17} />
                </a>
              ))}
            </div>
          </div>
          {/* فاصلٌ أوسع قليلاً: المجموعتان مختلفتان فعلاً (منصّاته ثم أدوات الموقع)،
              وتلاصقهما كان يجعل ٧+٣ تُقرأ صفاً واحداً مكسوراً لا مجموعتين. */}
          <div className="mt-2.5 flex items-center justify-center gap-2.5" aria-label="أدوات الموقع">
            <button
              type="button"
              onClick={() => {
                const willOpen = !newsletterOpen
                setNewsletterOpen(willOpen)
                /* بأمر الدكتور: ضغطة البريد توصل المؤشر مباشرة إلى حقل البريد */
                if (willOpen) window.setTimeout(() => document.getElementById('newsletter-inline-email')?.focus(), 320)
              }}
              aria-expanded={newsletterOpen}
              aria-label="النشرة البريدية"
              title="النشرة البريدية"
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-[border-color,color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent ${newsletterOpen ? 'border-accent bg-accent text-white hover:text-white' : ''}`}
            >
              <SocialIcon name="Mail" size={18} />
            </button>
            <TebyanProjectLink />
            <ScheduleProjectLink />
          </div>
        </div>
        <AnimatePresence initial={false}>
          {newsletterOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .28, ease: EASE }} className="overflow-hidden">
              <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-hair bg-wash p-4"><Newsletter compact /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}


/* ---------- Soft card wrapper ---------- */
function Card({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.48, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  useSeo({ title: 'د. أحمد حسين الفيلكاوي — أستاذ تكنولوجيا التعليم والذكاء الاصطناعي', path: '/' })
  const { articles, books, papers, media } = useCmsContent()
  const addedEvents = useExtras<SiteEvent & { id: string }>('site_upcoming')
  const upcomingItems = sortUpcomingEvents([...addedEvents, ...upcoming])


  return (
    <Page className="home-page">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': 'https://dr-alfailakawi.com/#website', url: 'https://dr-alfailakawi.com/', name: 'د. أحمد حسين الفيلكاوي', inLanguage: 'ar', publisher: { '@id': 'https://dr-alfailakawi.com/#person' } },
          { '@type': 'ProfilePage', '@id': 'https://dr-alfailakawi.com/#profile', url: 'https://dr-alfailakawi.com/', mainEntity: { '@id': 'https://dr-alfailakawi.com/#person' } },
          { '@type': 'Person', '@id': 'https://dr-alfailakawi.com/#person', name: 'د. أحمد حسين الفيلكاوي', alternateName: 'Dr. Ahmad H. Alfailakawi', url: 'https://dr-alfailakawi.com/', jobTitle: 'أستاذ تكنولوجيا التعليم والذكاء الاصطناعي', sameAs: ['https://scholar.google.com/citations?user=WVAtInIAAAAJ&hl=en', 'https://www.researchgate.net/profile/Ahmad-Alfailakawi'] },
        ],
      }} />
      <LaunchSpotlight articles={articles} books={books} papers={papers} media={media} />

      <Suspense fallback={null}>
        <ThresholdOverture articles={articles.length} books={books.length} papers={papers.length} />
      </Suspense>

      <HumanCoreHero />

      <div className="home-idea-thread relative">
        <div className="home-idea-thread-line" aria-hidden="true"><i /><i /><i /><i /></div>

        <SinceLastVisit />

        {listenIsOpen && (
          <Suspense fallback={null}>
            <OnAirNow />
          </Suspense>
        )}

        <NowHub />

        <ThoughtCompass />

        <SelectedWorks articles={articles} books={books} papers={papers} media={media} />

        <HomeDepth articles={articles} books={books} papers={papers} media={media} />

        {/* لا يظهر شريط اللقاء إلا عند وجود موعد معلن فعلياً. */}
        {upcomingItems[0] && (
          <section className="border-t border-hair py-5 md:py-6">
            <div className="mx-auto max-w-shell px-6 md:px-11">
              <FadeUp>
                <div className="flex min-h-[72px] items-center gap-4 rounded-xl border border-hair bg-wash px-4 py-3 md:px-5">
                  <span className="shrink-0 text-[.72rem] font-semibold text-accent">اللقاء القادم</span>
                  <Link to="/upcoming" className="group min-w-0 flex-1">
                    <span className="block truncate font-display text-[.95rem] font-semibold text-ink transition-colors group-hover:text-accent">{upcomingItems[0].title}</span>
                    <span className="mt-0.5 block truncate text-[.7rem] text-soft">{upcomingItems[0].date} · {upcomingItems[0].place}</span>
                  </Link>
                  <Link to="/upcoming" aria-label="كل اللقاءات" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent">↗</Link>
                </div>
              </FadeUp>
            </div>
          </section>
        )}
      </div>


      <HomeSocialFooter />
    </Page>
  )
}
