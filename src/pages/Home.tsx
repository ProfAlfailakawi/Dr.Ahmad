import { JsonLd, useSeo } from '../components/seo'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
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

const arNum = (n: number) => String(n).padStart(2, '0')
const ytId = (u: string) => (u.match(/v=([\w-]{6,})/) || [])[1] || ''

/* ---------- «فكرة اليوم» — بطاقة واحدة هادئة تتبدل كل منتصف ليل ----------
   تعيد استخدام محرك المختارات اليومي؛ تُحمَّل كسولاً فلا تُثقل الرئيسية */
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
      className={`group relative block h-full overflow-hidden rounded-2xl border border-hair border-r-[3px] border-r-accent bg-wash transition-colors duration-300 hover:border-accent ${compact ? 'p-6 md:p-7' : 'p-8 md:p-11'}`}
    >
      <span aria-hidden className={`pointer-events-none absolute left-5 top-2 select-none font-display leading-none text-accent/10 ${compact ? 'text-[5rem]' : 'text-[5.5rem] md:left-8 md:top-3 md:text-[9rem]'}`}>”</span>
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

/* ---------- «ابدأ من هنا» — ثلاث بوابات هادئة (لا إجبار ولا ازدحام) ---------- */
/* ---------- الشخصنة: «الموقع يعرف من دخل» (فكرة نووية ١) ----------
   سؤال هادئ مرّة واحدة، يُحفظ محلياً، فتتكيّف الرئيسية — بلا نافذة حاجزة ولا ألوان جديدة. */
type Persona = 'reader' | 'scholar' | 'org'
const personasFor = (articleCount: number, paperCount: number): {
  key: Persona; label: string; gate: string; d: string; greet: string
  to: string; links: { to: string; t: string }[]
}[] => [
  { key: 'reader', label: 'قارئ متأمّل', gate: 'للقارئ المتأمل',
    d: `أكثر من ${roundDown10(articleCount)} مقالاً فكرياً — اقرأها، وبعضها بصوتي.`,
    greet: 'بدأتُ لك من الكلمة.', to: '/articles',
    links: [{ to: '/articles', t: 'أحدث ما كتبت' }, { to: '/articles', t: 'كل المقالات' }] },
  { key: 'scholar', label: 'معلّم وباحث', gate: 'للمعلم والباحث',
    d: `${paperCount} بحثاً محكّماً، وأدوات ومفاهيم منتقاة.`,
    greet: 'من المعرفة المحكّمة.', to: '/research',
    links: [{ to: '/research', t: 'المساهمات العلمية' }, { to: '/publications', t: 'الكتب المنشورة' }] },
  { key: 'org', label: 'جهة أو صانع قرار', gate: 'للجهات وصنّاع القرار',
    d: 'استشارة، محاضرة، أو مشروع تحول رقمي — بصيرة لا أرقام فقط.',
    greet: 'جاهزٌ للتعاون.', to: '/contact',
    links: [{ to: '/contact', t: 'احجز موعداً' }, { to: '/cv', t: 'السيرة الذاتية' }, { to: '/upcoming', t: 'اللقاءات القادمة' }] },
]

function WhoAreYou() {
  const { articles, papers } = useCmsContent()
  const personas = useMemo(() => personasFor(articles.length, papers.length), [articles.length, papers.length])
  // القراءة في المُهيّئ (createRoot) تمنع أي وميض للزائر العائد
  const [persona, setPersona] = useState<Persona | null>(() => {
    try { return (localStorage.getItem('visitor:persona') as Persona) || null } catch { return null }
  })
  const [skipped, setSkipped] = useState(() => {
    try { return localStorage.getItem('visitor:skip') === '1' } catch { return false }
  })

  const choose = (p: Persona) => {
    setPersona(p); setSkipped(false)
    try { localStorage.setItem('visitor:persona', p); localStorage.removeItem('visitor:skip') } catch { /* noop */ }
  }
  const skip = () => {
    setSkipped(true)
    try { localStorage.setItem('visitor:skip', '1') } catch { /* noop */ }
  }
  const reset = () => {
    setPersona(null); setSkipped(false)
    try { localStorage.removeItem('visitor:persona'); localStorage.removeItem('visitor:skip') } catch { /* noop */ }
  }

  const active = persona ? personas.find((x) => x.key === persona) ?? null : null

  return (
    <section className="border-t border-hair bg-wash px-6 py-10 md:px-11 md:py-[62px]">
      <div className="mx-auto max-w-shell">
        {active ? (
          /* ── مُشخصَن: لمحة تُقدّم الأنسب له ── */
          <FadeUp>
            <div className="rounded-2xl border border-hair bg-canvas p-7 md:p-9">
              <p className="text-[.76rem] font-semibold uppercase text-accent">بما أنك {active.label}</p>
              <h2 className="mt-3 font-display text-[clamp(1.5rem,3.4vw,2.2rem)] font-semibold leading-[1.4] text-ink">{active.greet}</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {active.links.map((l, i) => (
                  <Magnetic key={l.to} to={l.to}
                    className={`inline-block rounded-full px-6 py-3 text-[.9rem] font-semibold transition-colors duration-300 ${i === 0 ? 'bg-accent text-white hover:bg-accent-deep' : 'border border-hair text-ink hover:border-accent hover:text-accent'}`}>
                    {l.t} ←
                  </Magnetic>
                ))}
              </div>
              <button onClick={reset} className="mt-6 text-[.8rem] text-soft transition-colors hover:text-accent">لستَ {active.label}؟ غيّر اختيارك</button>
            </div>
          </FadeUp>
        ) : skipped ? (
          /* ── تصفّح حرّ: البوابات الثلاث كروابط ── */
          <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
            {personas.map((g, i) => (
              <FadeUp key={g.key} delay={i * 0.08} className="w-[72vw] max-w-[320px] shrink-0 md:w-auto md:max-w-none">
                <Link to={g.to} data-hover className="group flex h-full flex-col rounded-2xl border border-hair bg-canvas p-7 transition-colors duration-300 hover:border-accent">
                  <h3 className="font-display text-[1.15rem] font-semibold text-ink">{g.gate}</h3>
                  <p className="mt-2.5 text-[.92rem] font-light leading-relaxed text-soft">{g.d}</p>
                  <span className="mt-auto pt-5 text-[.85rem] text-soft transition-colors group-hover:text-accent">ابدأ ←</span>
                </Link>
              </FadeUp>
            ))}
          </div>
        ) : (
          /* ── الزيارة الأولى: سؤال هادئ ── */
          <>
            <FadeUp><Label>قبل أن تبدأ</Label></FadeUp>
            <FadeUp delay={0.05}>
              <h2 className="mb-8 font-display text-[clamp(1.6rem,4vw,2.6rem)] font-semibold leading-[1.3] text-ink">ما الذي جاء بك؟</h2>
            </FadeUp>
            <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
              {personas.map((g, i) => (
                <FadeUp key={g.key} delay={0.1 + i * 0.08} className="w-[72vw] max-w-[320px] shrink-0 md:w-auto md:max-w-none">
                  <button onClick={() => choose(g.key)} data-hover className="group flex h-full w-full flex-col rounded-2xl border border-hair bg-canvas p-7 text-right transition-colors duration-300 hover:border-accent">
                    <h3 className="font-display text-[1.15rem] font-semibold text-ink">{g.gate}</h3>
                    <p className="mt-2.5 text-[.92rem] font-light leading-relaxed text-soft">{g.d}</p>
                    <span className="mt-auto pt-5 text-[.85rem] text-soft transition-colors group-hover:text-accent">هذا أنا ←</span>
                  </button>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={0.34}>
              <button onClick={skip} className="mt-7 text-[.85rem] text-soft transition-colors hover:text-accent">أتصفّح بحرّية ←</button>
            </FadeUp>
          </>
        )}
      </div>
    </section>
  )
}

/* ---------- لمحة «سماء المقالات» — نجوم هادئة تمهد للخريطة الكاملة ---------- */
function MiniAtlas() {
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
    <section className="border-t border-hair px-6 py-10 md:px-11 md:py-[62px]">
      <div className="mx-auto max-w-shell">
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
  if (newArticles > 0) bits.push({ to: '/articles', t: newArticles === 1 ? 'مقال جديد' : `${newArticles} مقالات جديدة` })
  if (daysGone >= 1) bits.push({ to: '/curated', t: 'اختيارات تبدّلت' })

  // «تابع من حيث توقفت» يظهر متى وُجد مقالٌ سابق (حتى دون غياب طويل)
  const resume = lastRead && Date.now() - lastRead.at < 45 * 864e5 ? lastRead : null
  if (!bits.length && !resume && !continuation) return null

  return (
    <div className="border-t border-hair bg-wash px-4 py-2.5 sm:px-6 md:px-11">
      <div className="rail mx-auto flex max-w-shell snap-x snap-mandatory items-center gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5 md:whitespace-nowrap">
        {continuation && (
          <Link to={`/articles/${continuation.article.slug}`} className="group flex min-h-12 w-[88vw] max-w-[32rem] shrink-0 snap-start items-center gap-2.5 rounded-xl border border-hair bg-canvas px-4 py-2.5 text-[.78rem] text-soft transition-colors hover:border-accent md:w-auto md:max-w-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-[.82rem]">
            <span className="font-semibold text-accent">كنت تتبع أثر {continuation.label}</span>
            <span className="min-w-0 flex-1 truncate text-ink transition-colors group-hover:text-accent">أكمل من هنا: «{continuation.article.title}»</span>
            <span className="shrink-0 text-accent transition-transform group-hover:-translate-x-0.5">←</span>
          </Link>
        )}
        {resume && (
          <Link to={`/articles/${resume.slug}`} className="group flex min-h-12 w-[88vw] max-w-[32rem] shrink-0 snap-start items-center gap-2.5 rounded-xl border border-hair bg-canvas px-4 py-2.5 text-[.78rem] text-soft transition-colors hover:border-accent md:w-auto md:max-w-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-[.82rem]">
            <span className="font-semibold text-accent">تابع من حيث توقفت</span>
            <span className="min-w-0 flex-1 truncate text-ink transition-colors group-hover:text-accent">«{resume.title}»</span>
            <span className="shrink-0 text-accent transition-transform group-hover:-translate-x-0.5">←</span>
          </Link>
        )}
        {bits.length > 0 && (
          <div className="flex min-h-12 w-[88vw] max-w-[32rem] shrink-0 snap-start flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-hair bg-canvas px-4 py-2.5 text-[.78rem] text-soft md:w-auto md:max-w-none md:flex-nowrap md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-[.82rem]">
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
    { to: '/atlas', t: 'سماء المقالات', dy: -14 },
    { to: '/thought-paths', t: 'مسار الفكرة', dy: -4 },
    { to: '/ask', t: 'العقل الحي', dy: -18 },
    { to: '/decade', t: 'وثيقة العقد', dy: -8 },
    { to: '/questions', t: 'سؤال يُقلق التعليم', dy: -12 },
  ]
  return (
    <section className="border-t border-hair px-6 py-10 md:px-11 md:py-12">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <p className="text-[.78rem] font-semibold text-accent">✦ توقيعات الموقع</p>
        </FadeUp>
        <FadeUp delay={0.08}>
          <div className="relative mt-9">
            {/* الأفق */}
            <span aria-hidden className="pointer-events-none absolute left-0 right-0 top-[13px] h-px bg-hair" />
            <div className="flex flex-wrap items-end gap-x-10 gap-y-8 md:gap-x-14">
              {sigs.map((s, i) => (
                <Link
                  key={s.to}
                  to={s.to}
                  data-hover
                  className="sig-item group relative pt-8"
                  style={{ ['--dy' as string]: `${s.dy}px`, ['--tw' as string]: `${(i * 0.9).toFixed(1)}s` }}
                >
                  <span aria-hidden className="sig-star" />
                  <span className="block font-display text-[.98rem] font-medium text-soft transition-colors duration-300 group-hover:text-ink">
                    {s.t}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ---------- «في مثل هذا الأسبوع» — الذاكرة الحيّة ----------
   يطابق أسبوع السنة الحالي مع الأرشيف (٢٠١٦ فصاعداً) ويُخرج مقالاً كتبه الدكتور
   في مثل هذه الأيام قبل سنوات — يتبدّل أسبوعياً، بلا خادم وبلا تدخل. */
const yearsAgo = (n: number) => (n === 1 ? 'قبل سنة' : n === 2 ? 'قبل سنتين' : n <= 10 ? `قبل ${n} سنوات` : `قبل ${n} سنة`)

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
    <Link to={`/articles/${pick.a.slug}`} data-hover className={`group block h-full rounded-2xl border border-hair bg-canvas transition-colors hover:border-accent ${compact ? 'p-6 md:p-7' : 'max-w-3xl border-0 p-0'}`}>
      <div className="flex items-start gap-3 text-accent">
        <span className="mt-[.7em] h-[1.5px] w-7 shrink-0 bg-accent" />
        <p className="min-w-0 text-[.74rem] font-semibold leading-[1.7]">
          <span className="block sm:inline">في مثل هذا الأسبوع</span>
          <span className="hidden px-1 sm:inline">·</span>
          <span className="block sm:inline">{yearsAgo(n)}</span>
        </p>
      </div>
      <h2 className={`mt-4 font-display font-semibold leading-[1.55] text-ink transition-colors duration-300 group-hover:text-accent ${compact ? 'text-[1.02rem] md:text-[1.08rem]' : 'text-[clamp(1.4rem,3.2vw,2.1rem)]'}`}>
        «{pick.a.title}»
      </h2>
      <p className="mt-3 text-[.76rem] leading-relaxed text-soft transition-colors group-hover:text-accent">
        كُتب في {when}
      </p>
    </Link>
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
  const related = articles.filter((a) => a.cat === active).slice(0, 3)
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
              <Link to={`/articles/${a.slug}`} data-hover className="group flex h-full min-h-[170px] flex-col rounded-2xl border border-hair bg-canvas p-5 transition-colors duration-300 hover:border-accent md:p-6">
                <time className="text-[.72rem] text-soft">{a.date}</time>
                <h3 className="mt-2.5 font-display text-[1rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent md:text-[1.12rem]">{a.title}</h3>
                <span className="mt-auto pt-5 text-[.78rem] text-soft transition-colors group-hover:text-accent">اقرأ</span>
              </Link>
            </FadeUp>
          ))}
        </div>
        <FadeUp delay={0.15}>
          <div className="rail -mx-6 mt-7 flex gap-3 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {quickLinks.map((item) => (
              <Link key={`${item.tag}-${item.to}`} to={item.to} className="group flex min-h-[108px] w-[62vw] max-w-[252px] shrink-0 flex-col justify-between rounded-2xl border border-hair bg-wash px-4 py-3.5 text-right transition-colors hover:border-accent md:w-auto md:max-w-none">
                <span className="inline-flex w-fit rounded-full border border-hair px-2 py-0.5 text-[.66rem] text-soft">{item.tag}</span>
                <span className="line-clamp-2 text-[.86rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">{item.label}</span>
                <span className="text-[.72rem] font-semibold text-accent">افتح المسار</span>
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
    { y: `${peakYear[0]}`, t: `ذروة الإنتاج — ${peakYear[1]} مقالاً في عامٍ واحد.` },
    { y: 'مرجع', t: `أرشيفٌ مؤلَّف — ${books.length} كتب و${papers.length} بحثاً محكّماً.` },
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
    <motion.div
      transition={{ duration: 0.4, ease: EASE }}
      className={`group relative h-full overflow-hidden rounded-2xl border border-hair bg-wash ${compact ? 'p-7 md:p-9' : 'p-8 md:p-12'}`}
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-accent/[.07] blur-3xl" />
      <div className="relative flex h-full flex-col justify-between gap-7">
        <div>
          <span className="inline-flex items-center gap-2.5 text-[.76rem] font-semibold text-accent">
            <span className="pulse relative h-2 w-2 rounded-full bg-accent" />
            الأحدث · مقال
          </span>
          <h2 className={`mt-4 font-display font-semibold leading-[1.45] text-ink ${compact ? 'text-[clamp(1.45rem,3vw,2.2rem)]' : 'max-w-[720px] text-[clamp(1.6rem,3.6vw,2.5rem)]'}`}>
            {latest.title}
          </h2>
          {compact && latest.excerpt && <p className="mt-4 max-w-2xl text-[.94rem] font-light leading-[1.9] text-ink/75">{latest.excerpt}</p>}
        </div>
        <span className="inline-flex w-fit items-center gap-2 text-[.86rem] font-semibold text-accent">اقرأ المقال <span className="transition-transform duration-300 group-hover:-translate-x-1">←</span></span>
      </div>
    </motion.div>
  )
  if (compact) return <Link to={`/articles/${latest.slug}`} data-hover className="block h-full">{content}</Link>
  return (
    <section className="px-6 pb-12 md:px-11 md:pb-[86px]">
      <div className="mx-auto max-w-shell"><FadeUp><Link to={`/articles/${latest.slug}`} data-hover className="block">{content}</Link></FadeUp></div>
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
        <FadeUp delay={0.14} className="w-[58vw] max-w-[270px] shrink-0 md:w-[31vw]"><OnThisWeek compact /></FadeUp>
        <span aria-hidden className="w-px shrink-0" />
      </div>
    </section>
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
      article && { type: 'مقال', kind: 'article', title: article.title, note: article.excerpt, to: `/articles/${article.slug}`, image: '', year: article.iso?.slice(0, 4) },
      book && { type: 'كتاب', kind: 'book', title: book.title, note: book.desc, to: `/publications/${book.slug}`, image: book.cover, year: '' },
      paper && { type: 'بحث محكّم', kind: 'paper', title: paper.titleAr || paper.title, note: paper.meta, to: `/research/${paper.slug}`, image: '', year: paper.iso?.slice(0, 4) },
      mediaItem && { type: 'ظهور إعلامي', kind: 'media', title: mediaItem.title, note: mediaItem.outlet, to: mediaItem.url, image: ytId(mediaItem.url) ? `https://i.ytimg.com/vi/${ytId(mediaItem.url)}/hqdefault.jpg` : '', external: true, year: '' },
    ].filter(Boolean) as { type: string; kind: 'article' | 'book' | 'paper' | 'media'; title: string; note?: string; to: string; image?: string; external?: boolean; year?: string }[]
    // لا يثبت ترتيب الأنواع أيضاً؛ كل زيارة مدخل جديد فعلياً إلى الأرشيف.
    return selected
      .map((item) => ({ item, order: random(1_000_000) }))
      .sort((left, right) => left.order - right.order)
      .map(({ item }) => item)
  }, [articles, books, papers, media])

  return (
    <section className="border-t border-hair bg-wash px-6 py-[52px] md:px-11 md:py-[84px]">
      <div className="mx-auto max-w-shell">
        <SectionHead label="من الأرشيف اليوم" title="أربعة مداخل، تتغيّر مع كل زيارة." />
        <div className="mobile-card-rail grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {items.map((item, index) => {
            const isBook = item.kind === 'book'
            const inner = (
              <div className="group flex h-full min-h-[220px] flex-col overflow-hidden rounded-xl border border-hair bg-canvas transition-colors duration-300 hover:border-accent/45 md:min-h-[270px]">
                {item.image ? (
                  <div className={`flex w-full items-center justify-center ${isBook ? 'h-28 bg-wash p-3 md:h-32' : item.external ? 'selected-media-frame h-28 overflow-hidden md:h-32' : 'h-28 overflow-hidden md:h-32'}`} style={item.external ? ({ '--media-thumb': `url(${item.image})` } as CSSProperties) : undefined}>
                    <img src={item.image} alt="" loading="lazy" className={`${isBook ? 'h-full w-full object-contain' : item.external ? 'selected-media-thumb h-full w-full opacity-95' : 'h-full w-full object-cover opacity-90'}`} />
                  </div>
                ) : (
                  <div className={`archive-editorial-cover archive-editorial-cover--${item.kind}`} aria-hidden="true">
                    <span className="archive-editorial-orbit" />
                    <span className="archive-editorial-kicker">{item.kind === 'paper' ? 'RESEARCH' : item.kind === 'book' ? 'BOOK' : item.kind === 'media' ? 'MEDIA' : 'ESSAY'}</span>
                    <span className="archive-editorial-mark">{item.kind === 'paper' ? 'R' : item.kind === 'book' ? 'B' : item.kind === 'media' ? 'M' : 'A'}</span>
                    <span className="archive-editorial-year">{item.year || 'ARCHIVE'}</span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4 md:p-7">
                  <span className="text-[.72rem] font-semibold text-accent">{item.type}</span>
                  <h3 className="mt-2.5 line-clamp-3 break-words font-display text-[.98rem] font-semibold leading-[1.55] text-ink transition-colors group-hover:text-accent sm:text-[1.05rem] md:mt-3 md:text-[1.3rem]">{item.title}</h3>
                  {item.note && <p className="mt-2 line-clamp-2 text-start text-[.76rem] font-light leading-[1.7] text-soft sm:text-[.8rem] md:mt-2.5 md:line-clamp-3 md:text-[.88rem]">{item.note}</p>}
                </div>
              </div>
            )
            return (
              <FadeUp key={`${item.type}-${item.to}`} delay={index * 0.06} className="min-w-0">
                {item.external ? <a href={item.to} target="_blank" rel="noreferrer" className="block h-full">{inner}</a> : <Link to={item.to} viewTransition className="block h-full">{inner}</Link>}
              </FadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}



function QuietEnding() {
  return (
    <section className="quiet-ending border-t border-hair px-6 py-[54px] md:px-11 md:py-[78px]" aria-labelledby="quiet-ending-title">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <div className="quiet-ending-inner mx-auto max-w-[760px] text-center">
            <span className="quiet-ending-mark" aria-hidden="true" />
            <p className="text-[.72rem] font-semibold tracking-[.08em] text-accent">الخاتمة الهادئة</p>
            <h2 id="quiet-ending-title" className="mt-4 font-display text-[clamp(1.45rem,3.2vw,2.2rem)] font-semibold leading-[1.72] text-ink">
              هذا الموقع لا يعرض أرشيفاً فقط؛ إنه يفتح طريقاً إلى الفكرة.
            </h2>
          </div>
        </FadeUp>
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
          <SectionHead label="المؤلفات" title={`${books.length} كتب.`} to="/publications" />
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
              {topArticles[0] && <Link to={`/articles/${topArticles[0].slug}`} data-hover className="group block">
                <div className="flex items-center gap-2.5 text-[.78rem]"><span className="font-semibold text-accent">{categoryLabel(topArticles[0].cat)}</span><span className="h-1 w-1 rounded-full bg-hair" /><time className="text-soft">{topArticles[0].date}</time></div>
                <h3 className="mt-4 font-display text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-[1.4] text-ink transition-colors group-hover:text-accent">{topArticles[0].title}</h3>
                {topArticles[0].excerpt && <p className="mt-4 max-w-xl text-[1.02rem] font-light leading-[1.9] text-ink/80">{topArticles[0].excerpt}</p>}
              </Link>}
            </FadeUp>
            <FadeUp delay={0.12} className="hidden md:block">
              <div className="flex flex-col divide-y divide-hair border-r border-hair pr-8">
                {topArticles.slice(1, 3).map((article) => <Link key={article.slug} to={`/articles/${article.slug}`} className="group py-6 first:pt-0"><time className="text-[.76rem] text-soft">{article.date}</time><h4 className="mt-2 font-display text-[1.1rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">{article.title}</h4></Link>)}
              </div>
            </FadeUp>
          </div>
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
              {topMedia[0] && <a href={topMedia[0].url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl"><div className="relative overflow-hidden bg-wash" style={{ aspectRatio: '16 / 9' }}>{ytId(topMedia[0].url) && <img src={`https://i.ytimg.com/vi/${ytId(topMedia[0].url)}/hqdefault.jpg`} alt={topMedia[0].title} loading="lazy" className="h-full w-full object-cover" />}<span className="absolute inset-0 bg-ink/10" /><span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/40 text-white">▶</span></div><div className="mt-4"><span className="text-[.74rem] font-semibold text-accent">{topMedia[0].outlet}</span><h3 className="mt-1.5 font-display text-[1.2rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{topMedia[0].title}</h3></div></a>}
            </FadeUp>
            <FadeUp delay={0.12} className="hidden md:block"><div className="flex flex-col divide-y divide-hair border-r border-hair pr-8">{topMedia.slice(1, 3).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="group flex items-start gap-3 py-5 first:pt-0"><span className="mt-1 text-[.7rem] text-accent">▶</span><span><span className="block text-[.72rem] font-semibold text-accent">{item.outlet}</span><span className="mt-1 block text-[.98rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{item.title}</span></span></a>)}</div></FadeUp>
          </div>
        </div>
      </section>
    </>
  )
}

function HomeDepth({ books }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const [active, setActive] = useState<'maps' | null>(null)

  useEffect(() => {
    if (!active) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setActive(null) }
    document.addEventListener('keydown', close)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = previous }
  }, [active])

  return (
    <>
      <section className="border-t border-hair px-6 py-8 md:px-11 md:py-10">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <button type="button" onClick={() => setActive('maps')} className="group flex w-full items-center justify-between gap-5 rounded-3xl border border-hair bg-wash px-5 py-5 text-right transition-colors hover:border-accent md:px-7 md:py-6">
              <span className="min-w-0">
                <span className="block text-[.74rem] font-semibold text-accent">خرائط الفكر</span>
                <span className="mt-1.5 block font-display text-[1.12rem] font-semibold leading-[1.5] text-ink md:text-[1.35rem]">سماء المقالات، رحلة الأثر، وتوقيعات الموقع.</span>
              </span>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-colors group-hover:border-accent">↗</span>
            </button>
          </FadeUp>
        </div>
      </section>

      <AnimatePresence>
        {active && (
          <motion.div className="fixed inset-0 z-[290] bg-ink/35 p-3 pt-[calc(4.75rem+env(safe-area-inset-top))] backdrop-blur-sm md:p-8 md:pt-24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && setActive(null)}>
            <motion.div className="mx-auto h-full max-w-6xl overflow-y-auto rounded-3xl border border-hair bg-canvas shadow-2xl" initial={{ y: 18, scale: .985 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: .99 }} transition={{ duration: .28, ease: EASE }}>
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-hair bg-canvas/90 px-5 py-3 backdrop-blur md:px-7">
                <span className="font-display text-[1rem] font-semibold text-ink">خرائط الفكر والأثر</span>
                <button onClick={() => setActive(null)} className="rounded-full border border-hair px-4 py-1.5 text-[.76rem] text-soft transition-colors hover:border-accent hover:text-accent">إغلاق</button>
              </div>
              <MiniAtlas />
              <ImpactTimeline />
              <Signatures />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function HomeSocialFooter() {
  const [newsletterOpen, setNewsletterOpen] = useState(false)
  return (
    <section className="border-t border-hair px-6 py-7 md:px-11 md:py-9">
      <div className="mx-auto max-w-shell">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {socials.map((s) => (
            <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label} className="flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent">
              <SocialIcon name={s.label} size={16} />
            </a>
          ))}
          <span aria-hidden className="mx-0.5 h-5 w-px bg-hair" />
          {academicProfiles.map((profileLink) => (
            <a key={profileLink.label} href={profileLink.url} target="_blank" rel="noreferrer" aria-label={profileLink.label} title={profileLink.label} className="flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent">
              <SocialIcon name={profileLink.label} size={17} />
            </a>
          ))}
          <button type="button" onClick={() => setNewsletterOpen((value) => !value)} aria-expanded={newsletterOpen} aria-label="النشرة البريدية" title="النشرة البريدية" className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${newsletterOpen ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>
            <SocialIcon name="Mail" size={16} />
          </button>
          <span className="inline-flex items-center gap-2">
            <TebyanProjectLink />
            <ScheduleProjectLink />
          </span>
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

      <HumanCoreHero />

      <div className="home-idea-thread relative">
        <div className="home-idea-thread-line" aria-hidden="true"><i /><i /><i /><i /></div>

        <SinceLastVisit />

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

      <QuietEnding />

      <HomeSocialFooter />
    </Page>
  )
}
