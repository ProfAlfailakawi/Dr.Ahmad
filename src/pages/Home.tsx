import { useSeo } from '../components/seo'
import { useEffect, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { EASE, FadeUp, Label, Magnetic, Page, Reveal, SectionHead } from '../components/ui'
import { articles, books, latest, media, papers, profile, upcoming } from '../data'
import { Newsletter } from '../components/extras'
import { curatedBank, thisMonthsBook, type Curio } from '../data-curated'

const arNum = (n: number) => String(n).padStart(2, '0').replace(/[0-9]/g, (d) => '0123456789'[+d])
const ytId = (u: string) => (u.match(/v=([\w-]{6,})/) || [])[1] || ''
type Paper = (typeof papers)[number] & { slug: string }

/* ---------- «فكرة اليوم» — بطاقة واحدة هادئة تتبدل كل منتصف ليل ----------
   تعيد استخدام محرك المختارات اليومي؛ تُحمَّل كسولاً فلا تُثقل الرئيسية */
function DailySpark() {
  const [c, setC] = useState<Curio | null>(null)
  useEffect(() => {
    let on = true
    import('../data-curated').then((m) => { if (on) setC(m.todaysPick()) })
    return () => { on = false }
  }, [])
  if (!c) return null
  return (
    <section className="border-t border-hair px-6 py-[56px] md:px-11 md:py-[72px]">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          {/* بطاقة مميّزة بنفس الثيم: حافة مميّزة + علامة اقتباس كبيرة خافتة */}
          <Link
            to="/curated"
            data-hover
            className="group relative block overflow-hidden rounded-2xl border border-hair border-r-[3px] border-r-accent bg-wash p-8 transition-colors duration-300 hover:border-accent md:p-11"
          >
            <span aria-hidden className="pointer-events-none absolute -top-6 left-6 select-none font-display text-[8rem] leading-none text-accent/10 md:text-[11rem]">”</span>
            <p className="relative mb-5 flex items-center gap-2.5 text-[.8rem] font-semibold text-accent">
              <span className="pulse relative h-1.5 w-1.5 rounded-full bg-accent" />
              فكرة اليوم · {c.kind}
            </p>
            <p className="relative max-w-3xl font-display text-[clamp(1.35rem,3vw,2rem)] font-semibold leading-[1.7] text-ink transition-colors group-hover:text-accent">
              {c.ar}
            </p>
            {c.en && (
              <p className="relative mt-3 max-w-2xl text-[.95rem] font-light text-soft" dir="ltr" style={{ textAlign: 'left' }}>{c.en}</p>
            )}
            <p className="relative mt-6 flex flex-wrap items-center gap-2 border-t border-hair pt-4 text-[.82rem] text-soft">
              <span>{c.source}</span>
              <span className="text-hair">·</span>
              <span>تتبدّل كل منتصف ليل</span>
              <span className="ms-auto text-accent transition-transform duration-300 group-hover:-translate-x-1">المزيد في المختارات ←</span>
            </p>
          </Link>
        </FadeUp>
      </div>
    </section>
  )
}

/* ---------- «ابدأ من هنا» — ثلاث بوابات هادئة (لا إجبار ولا ازدحام) ---------- */
function StartHere() {
  const gates = [
    { to: '/articles', t: 'للقارئ المتأمل', d: 'اثنان وسبعون مقالاً بصوتٍ خاص — اقرأها أو استمع إليها.' },
    { to: '/research', t: 'للمعلم والباحث', d: 'ثمانية عشر بحثاً محكّماً، وأدوات ومفاهيم منتقاة.' },
    { to: '/contact', t: 'للجهات وصنّاع القرار', d: 'استشارة، محاضرة، أو مشروع تحول رقمي — بصيرة لا أرقام فقط.' },
  ]
  return (
    <section className="border-t border-hair bg-wash px-6 py-[56px] md:px-11 md:py-[72px]">
      <div className="mx-auto grid max-w-shell gap-5 md:grid-cols-3">
        {gates.map((g, i) => (
          <FadeUp key={g.to} delay={i * 0.08}>
            <Link to={g.to} data-hover className="group flex h-full flex-col rounded-2xl border border-hair bg-canvas p-7 transition-colors duration-300 hover:border-accent">
              <h3 className="font-display text-[1.15rem] font-semibold text-ink">{g.t}</h3>
              <p className="mt-2.5 text-[.92rem] font-light leading-relaxed text-soft">{g.d}</p>
              <span className="mt-auto pt-5 text-[.85rem] text-soft transition-colors group-hover:text-accent">ابدأ ←</span>
            </Link>
          </FadeUp>
        ))}
      </div>
    </section>
  )
}

/* ---------- لمحة «سماء المقالات» — نجوم هادئة تمهد للخريطة الكاملة ---------- */
function MiniAtlas() {
  const reduce = useReducedMotion()
  // موضع حتمي: الزمن أفقياً (الأقدم يميناً كما في السماء الكاملة)، وتشتت رأسي من بصمة العنوان
  const t0 = new Date('2019-01-01').getTime()
  const t1 = new Date('2026-12-31').getTime()
  const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7)
  const stars = articles.map((a) => ({
    slug: a.slug, title: a.title,
    x: 100 - ((new Date(a.iso).getTime() - t0) / (t1 - t0)) * 100,
    y: 12 + (hash(a.slug) % 76),
    r: 2 + (hash(a.title) % 3),
  }))
  return (
    <section className="border-t border-hair px-6 py-[56px] md:px-11 md:py-[72px]">
      <div className="mx-auto max-w-shell">
        <SectionHead label="سماء المقالات" title="كل نجمة مقال." to="/atlas" cta="الخريطة الكاملة" />
        <FadeUp>
          <div className="relative mt-10 h-[150px] overflow-hidden rounded-2xl border border-hair bg-wash">
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
                  className="block rounded-full bg-accent/70 transition-all duration-300 group-hover:scale-[2.2] group-hover:bg-accent"
                  style={{ width: s.r * 2, height: s.r * 2 }}
                  initial={reduce ? false : { opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: Math.min(i * 0.012, 0.9), ease: EASE }}
                />
              </Link>
            ))}
            <span className="pointer-events-none absolute bottom-3 right-4 text-[.72rem] text-soft">مرّر على نجمة — واضغطها لتقرأ</span>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ---------- The single "Latest" card ---------- */
function LatestCard() {
  const reduce = useReducedMotion()
  return (
    <section className="px-6 pb-[70px] md:px-11 md:pb-[100px]">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <motion.div
            whileHover={reduce ? {} : { y: -4 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="group relative overflow-hidden rounded-2xl border border-hair bg-wash p-8 md:p-12"
          >
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-accent/[.07] blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-2.5 text-[.78rem] font-semibold text-accent">
                  <span className="pulse relative h-2 w-2 rounded-full bg-accent" />
                  الأحدث · {latest.kind}
                </span>
                <h2 className="mt-4 max-w-[720px] font-display text-[clamp(1.6rem,3.6vw,2.5rem)] font-semibold leading-[1.35] text-ink">
                  {latest.title}
                </h2>
              </div>
              <Link
                to={latest.to}
                data-hover
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[1.5px] border-accent text-[1.4rem] text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-white md:h-20 md:w-20"
                aria-label="اقرأ المزيد"
              >
                ←
              </Link>
            </div>
          </motion.div>
        </FadeUp>
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
      transition={{ duration: 0.7, delay, ease: EASE }}
      whileHover={reduce ? {} : { y: -6 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  useSeo({ title: 'د. أحمد الفيلكاوي — أستاذ تكنولوجيا التعليم', path: '/' })
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const parY = useTransform(scrollY, [0, 800], [0, 40])
  const tx = useMotionValue(0)
  const ty = useMotionValue(0)
  const stx = useSpring(tx, { stiffness: 120, damping: 20 })
  const sty = useSpring(ty, { stiffness: 120, damping: 20 })

  useEffect(() => {
    if (reduce) return
    const m = (e: MouseEvent) => {
      tx.set((e.clientX / window.innerWidth - 0.5) * 14)
      ty.set((e.clientY / window.innerHeight - 0.5) * 14)
    }
    window.addEventListener('mousemove', m)
    return () => window.removeEventListener('mousemove', m)
  }, [reduce, tx, ty])

  const topArticles = articles.slice(0, 3)
  const topPapers = (papers as Paper[]).slice(0, 3)
  // موحّد مع نظام «المختارات» الجديد: كتاب الشهر + مختارتان موثّقتان
  const topPicks: Curio[] = [thisMonthsBook(), curatedBank[6], curatedBank[11]]
  const topMedia = media.slice(0, 3)

  return (
    <Page>
      {/* hero — البيان الفكري أولاً (100svh للجوال) */}
      <header className="relative flex min-h-[100svh] items-center px-6 pb-16 pt-24 md:px-11 md:pb-24 md:pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_78%_40%,rgba(62,92,120,.06),transparent_62%)]" />
        <div className="relative z-10 mx-auto grid w-full max-w-shell items-center gap-8 md:grid-cols-[1.15fr_.85fr] md:gap-16">
          {/* البيان أولاً — على الجوال والكمبيوتر */}
          <div className="order-1">
            {/* الجملة التي تراها أول ثانية — بيان الدكتور الفكري، لا نبذة */}
            <h1 className="font-display text-[clamp(2.1rem,5.4vw,4rem)] font-bold leading-[1.28] text-ink">
              {['أُبقي الإنسانَ', 'في قلبِ الآلة.'].map((line, i) => (
                <span key={line} className="block overflow-hidden">
                  <motion.span
                    className="block"
                    initial={reduce ? false : { y: '115%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 1, delay: 0.25 + i * 0.14, ease: EASE }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.div className="my-7 h-[2px] bg-accent" initial={{ width: 0 }} animate={{ width: 74 }} transition={{ duration: 0.9, delay: 0.7, ease: EASE }} />

            {/* الاسم والصفة — أصغر، ثانويّان */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.85, ease: EASE }}
            >
              <p className="font-display text-[clamp(1.15rem,2.4vw,1.6rem)] font-semibold text-ink">د. {profile.name}</p>
              <p className="mt-1.5 text-[.95rem] font-light text-soft">أستاذ تكنولوجيا التعليم · مؤلف · باحث · مستشار</p>
            </motion.div>

            {/* زرّ واحد فقط */}
            <motion.div
              className="mt-9"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1, ease: EASE }}
            >
              <Magnetic to="/articles" className="inline-block rounded-full bg-accent px-9 py-4 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                ادخل إلى عالمي الفكري ←
              </Magnetic>
            </motion.div>
          </div>

          <div className="order-2 flex justify-center">
            <motion.div style={{ y: parY }}>
              <motion.div style={{ x: stx, y: sty }} className="portrait-wrap" data-hover>
                <motion.div
                  className="portrait relative max-w-[210px] overflow-hidden rounded-2xl shadow-[0_36px_64px_-36px_rgba(21,22,26,.42)] sm:max-w-[260px] md:max-w-[400px]"
                  initial={reduce ? false : { opacity: 0, y: 26, scale: 1.03 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 1.1, delay: 0.75, ease: EASE }}
                >
                  <img src="/portrait.webp" alt={`د. ${profile.fullName}`} className="block w-full" />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="cue absolute bottom-8 left-1/2 -translate-x-1/2 text-[.74rem] text-soft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
        >
          اكتشف
          <span className="relative mx-auto mt-2.5 block h-[30px] w-px overflow-hidden bg-hair" />
        </motion.div>
      </header>

      <LatestCard />

      <DailySpark />

      {/* about */}
      <section className="border-t border-hair px-6 py-[70px] md:px-11 md:py-[100px]">
        <div className="mx-auto grid max-w-shell items-start gap-10 md:grid-cols-2 md:gap-14">
          <FadeUp>
            <Label>نبذة</Label>
            <h2 className="font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink">
              {profile.aboutHeading.split('\n').map((line, i) => (
                <Reveal key={i} delay={i * 0.08}>{line}</Reveal>
              ))}
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-[1.12rem] font-light leading-[1.9] text-ink/80">{profile.about}</p>
            <Link to="/cv" className="mt-7 inline-block border-b-[1.5px] border-accent pb-1 font-semibold text-accent">
              السيرة الكاملة ←
            </Link>
          </FadeUp>
        </div>
      </section>

      <StartHere />

      {/* books */}
      <section className="border-t border-hair bg-wash py-[70px] md:py-[100px]">
        <div className="mx-auto max-w-shell px-6 md:px-11">
          <SectionHead label="المؤلفات" title="تسعة كتب." to="/publications" />
        </div>
        <div className="rail flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 md:px-11">
          {books.map((b, i) => (
            <Card key={b.isbn} delay={Math.min(i * 0.05, 0.3)} className="w-[240px] shrink-0 snap-start md:w-[300px]">
              <Link to={`/publications/${b.slug}`} data-hover className="group block">
                <div className="overflow-hidden rounded-xl bg-white shadow-[0_22px_44px_-26px_rgba(21,22,26,.4)] transition-transform duration-500 group-hover:-translate-y-1.5" style={{ aspectRatio: '1024 / 700' }}>
                  <img src={b.cover} alt={b.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                {/* انعكاس فاخر خافت — معرض لا شبكة منتجات */}
                <div aria-hidden className="mt-0.5 h-10 overflow-hidden rounded-b-xl opacity-25 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,.5),transparent)]" style={{ transform: 'scaleY(-1)' }}>
                  <img src={b.cover} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                </div>
                <h3 className="mt-2 font-display text-[1.15rem] font-medium leading-[1.45] text-ink transition-colors group-hover:text-accent">{b.title}</h3>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <MiniAtlas />

      {/* articles — latest 3 */}
      <section className="border-t border-hair px-6 py-[70px] md:px-11 md:py-[100px]">
        <div className="mx-auto max-w-shell">
          <SectionHead label="مقالاتي الفكرية" title="بصوتي الخاص." to="/articles" />
          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {topArticles.map((a, i) => (
              <Card key={a.slug} delay={i * 0.07}>
                <Link
                  to={`/articles/${a.slug}`}
                  data-hover
                  className="group flex h-full flex-col rounded-2xl border border-hair bg-canvas p-6 transition-colors md:p-7 duration-300 hover:border-accent"
                >
                  <div className="flex items-center gap-2.5 text-[.75rem]">
                    <span className="font-semibold text-accent">{a.cat}</span>
                    <span className="h-1 w-1 rounded-full bg-hair" />
                    <time className="text-soft">{a.date}</time>
                  </div>
                  <h3 className="mt-4 font-display text-[1.28rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">
                    {a.title}
                  </h3>
                  <span className="mt-auto pt-7 text-[.85rem] text-soft transition-colors group-hover:text-accent">اقرأ ←</span>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* research — latest 3 */}
      <section className="border-t border-hair bg-wash px-6 py-[70px] md:px-11 md:py-[100px]">
        <div className="mx-auto max-w-shell">
          <SectionHead label="المساهمات العلمية" title="أبحاث محكّمة." to="/research" />
          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {topPapers.map((p, i) => (
              <Card key={p.url} delay={i * 0.07}>
                <Link
                  to={`/research/${p.slug}`}
                  data-hover
                  className="group flex h-full flex-col rounded-2xl border border-hair bg-canvas p-6 transition-colors md:p-7 duration-300 hover:border-accent"
                >
                  <span className="font-display text-[1.5rem] font-semibold text-accent">{arNum(i + 1)}</span>
                  <h3 className="mt-4 text-[1.08rem] font-medium leading-[1.7] text-ink transition-colors group-hover:text-accent">
                    {p.title}
                  </h3>
                  <span className="mt-3 text-[.78rem] text-soft">{p.meta}</span>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* media — latest 3 */}
      <section className="border-t border-hair px-6 py-[70px] md:px-11 md:py-[100px]">
        <div className="mx-auto max-w-shell">
          <SectionHead label="الظهور الإعلامي" title="على الشاشة." to="/media" />
          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {topMedia.map((m, i) => (
              <Card key={m.url} delay={i * 0.07}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  data-hover
                  className="group block h-full overflow-hidden rounded-2xl border border-hair bg-canvas transition-colors duration-300 hover:border-accent"
                >
                  <div className="relative overflow-hidden bg-wash" style={{ aspectRatio: '16 / 9' }}>
                    {ytId(m.url) && (
                      <img
                        src={`https://i.ytimg.com/vi/${ytId(m.url)}/hqdefault.jpg`}
                        alt={m.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/20" />
                    <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white/80 bg-ink/40 text-[.85rem] text-white backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:border-accent group-hover:bg-accent">
                      ▶
                    </span>
                  </div>
                  <div className="p-6">
                    <span className="text-[.72rem] font-semibold text-accent">{m.outlet}</span>
                    <h3 className="mt-2 text-[1.02rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">{m.title}</h3>
                  </div>
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* curated — latest 3 */}
      <section className="border-t border-hair bg-wash px-6 py-[70px] md:px-11 md:py-[100px]">
        <div className="mx-auto max-w-shell">
          <div className="mb-10 flex items-end justify-between gap-6">
            <FadeUp>
              <span className="mb-4 inline-flex items-center gap-2.5 text-[.8rem] font-semibold text-accent">
                <span className="pulse relative h-2 w-2 rounded-full bg-accent" />
                يتجدّد باستمرار
              </span>
              <h2 className="font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink">
                <Reveal>من اختياراتي.</Reveal>
              </h2>
            </FadeUp>
            <Link to="/curated" className="group shrink-0 pb-2 text-[.92rem] font-semibold text-accent">
              الكل<span className="inline-block transition-transform duration-300 group-hover:-translate-x-1.5"> ←</span>
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {topPicks.map((p, i) => {
              const Wrap = (p.url ? 'a' : Link) as React.ElementType
              const props = p.url ? { href: p.url, target: '_blank', rel: 'noreferrer' } : { to: '/curated' }
              return (
                <Card key={p.ar} delay={i * 0.07}>
                  <Wrap {...props} data-hover className="group flex h-full flex-col rounded-2xl border border-hair bg-canvas p-6 transition-colors md:p-7 duration-300 hover:border-accent">
                    <span className="text-[.74rem] font-semibold text-accent">{p.kind}</span>
                    <h3 className="mt-3.5 font-display text-[1.2rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">
                      {p.ar}
                    </h3>
                    {p.arNote && <p className="mt-2.5 text-[.88rem] font-light text-soft">{p.arNote}</p>}
                    <span className="mt-auto pt-7 text-[.82rem] text-soft transition-colors group-hover:text-accent">{p.source} ←</span>
                  </Wrap>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* upcoming + newsletter */}
      <section className="border-t border-hair px-6 py-[70px] md:px-11 md:py-[100px]">
        <div className="mx-auto grid max-w-shell gap-12 md:grid-cols-2 md:gap-14">
          <FadeUp>
            <SectionHead label="اللقاءات القادمة" title="أين ألتقيك؟" to="/upcoming" cta="الجدول" />
            {upcoming.length > 0 ? (
              <ul className="space-y-5">
                {upcoming.slice(0, 2).map((e) => (
                  <li key={e.iso + e.title} className="border-r-2 border-hair pr-6 transition-colors hover:border-accent">
                    <span className="block text-[.84rem] font-semibold text-accent">{e.date}</span>
                    <span className="mt-1 block font-display text-[1.15rem] font-medium leading-[1.55] text-ink">{e.title}</span>
                    <span className="text-[.85rem] text-soft">{e.org} · {e.place}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[1.02rem] font-light leading-[1.9] text-soft">
                لا لقاءات معلنة حالياً. اشترك في النشرة ليصلك الإعلان أولاً.
              </p>
            )}
          </FadeUp>

          <FadeUp delay={0.1}>
            <Newsletter />
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
