import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'
import { EASE, FadeUp, Label, Reveal, SectionHead } from '../ui'
import { Newsletter } from '../extras'
import { staticQuestions, LAUNCH_DATE } from '../../pages/Questions'
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from '../../lib/cms'
import type { Event as SiteEvent } from '../../data'
import type { Curio } from '../../data-curated'
import { categoryLabel } from '../../lib/content-taxonomy'

type Persona = 'reader' | 'scholar' | 'org'
const PERSONAS: { key: Persona; label: string; title: string; desc: string; links: { to: string; label: string }[] }[] = [
  { key: 'reader', label: 'قارئ متأمّل', title: 'ابدأ من الكلمة.', desc: 'مقالات فكرية، مسارات قراءة، وصوت يرافقك بلا استعجال.', links: [{ to: '/articles', label: 'أحدث المقالات' }, { to: '/thought-paths', label: 'مسارات الفكرة' }] },
  { key: 'scholar', label: 'معلّم وباحث', title: 'ابدأ من المعرفة المحكّمة.', desc: 'أبحاث، كتب، ومداخل أكاديمية قابلة للاستخدام والتطوير.', links: [{ to: '/research', label: 'الأبحاث المحكمة' }, { to: '/publications', label: 'المؤلفات' }] },
  { key: 'org', label: 'جهة أو صانع قرار', title: 'ابدأ من الأثر.', desc: 'استشارة، محاضرة، أو مشروع تحوّل رقمي يضع الإنسان أولاً.', links: [{ to: '/contact#booking-form', label: 'احجز موعداً' }, { to: '/cv', label: 'السيرة الأكاديمية' }] },
]

const ytId = (url: string) => (url.match(/[?&]v=([\w-]{6,})/) || url.match(/youtu\.be\/([\w-]{6,})/))?.[1] || ''
const yearsAgo = (n: number) => (n === 1 ? 'قبل سنة' : n === 2 ? 'قبل سنتين' : n <= 10 ? `قبل ${n} سنوات` : `قبل ${n} سنة`)

function ReturningNote({ articles }: { articles: ArticleRecord[] }) {
  const [snapshot] = useState(() => {
    try {
      const previous = Number(localStorage.getItem('visit:last') || 0)
      localStorage.setItem('visit:last', String(Date.now()))
      const lastRead = JSON.parse(localStorage.getItem('read:last') || 'null') as { slug: string; title: string; at: number } | null
      return { previous, lastRead }
    } catch { return { previous: 0, lastRead: null } }
  })
  const away = snapshot.previous ? Date.now() - snapshot.previous : 0
  const lastIso = snapshot.previous ? new Date(snapshot.previous).toISOString().slice(0, 10) : ''
  const newArticles = away >= 12 * 3600e3 ? articles.filter((article) => article.iso > lastIso).length : 0
  const currentLastRead = snapshot.lastRead?.slug ? articles.find((article) => article.slug === snapshot.lastRead?.slug) : undefined
  const resume = currentLastRead && snapshot.lastRead && Date.now() - snapshot.lastRead.at < 45 * 864e5
    ? { slug: currentLastRead.slug, title: currentLastRead.title, at: snapshot.lastRead.at }
    : null
  useEffect(() => {
    if (!snapshot.lastRead?.slug || currentLastRead) return
    try { localStorage.removeItem('read:last') } catch { /* noop */ }
  }, [currentLastRead, snapshot.lastRead?.slug])
  if (!newArticles && !resume) return null
  return (
    <div className="mb-5 flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-hair bg-canvas px-4 py-2.5 text-[.8rem] text-soft">
      {resume && <Link to={`/articles/${resume.slug}`} className="group"><span className="font-semibold text-accent">تابع من حيث توقفت</span> · <span className="text-ink group-hover:text-accent">«{resume.title}»</span></Link>}
      {newArticles > 0 && <Link to="/articles" className="transition-colors hover:text-accent"><span className="font-semibold text-accent">منذ زيارتك:</span> {newArticles === 1 ? 'مقال جديد' : `${newArticles} مقالات جديدة`}</Link>}
    </div>
  )
}

function historicPick(articles: ArticleRecord[]) {
  const today = new Date()
  const dayOfYear = (date: Date) => Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 864e5)
  const target = dayOfYear(today)
  const year = today.getFullYear()
  const candidates = articles.map((article) => ({ article, date: new Date(`${article.iso}T12:00:00`) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()) && date.getFullYear() < year)
    .map((entry) => {
      let difference = Math.abs(dayOfYear(entry.date) - target)
      if (difference > 182) difference = 365 - difference
      return { ...entry, difference }
    })
    .filter((entry) => entry.difference <= 7)
    .sort((left, right) => left.difference - right.difference || left.date.getFullYear() - right.date.getFullYear())
  if (!candidates.length) return null
  return candidates[Math.floor(today.getTime() / (7 * 864e5)) % candidates.length]
}

export function NowStation({ articles }: { articles: ArticleRecord[] }) {
  const latest = articles[0]
  const historic = useMemo(() => historicPick(articles), [articles])
  const [curio, setCurio] = useState<Curio | null>(null)
  useEffect(() => {
    let active = true
    import('../../data-curated').then((module) => { if (active) setCurio(module.todaysPick()) })
    return () => { active = false }
  }, [])
  if (!latest) return null
  return (
    <section className="border-t border-hair bg-wash px-6 py-[58px] md:px-11 md:py-[88px]">
      <div className="mx-auto max-w-shell">
        <ReturningNote articles={articles} />
        <SectionHead label="الآن" title="ما يستحق انتباهك اليوم." to="/articles" cta="كل المقالات" />
        <div className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
          <FadeUp>
            <Link to={`/articles/${latest.slug}`} data-hover className="group relative flex min-h-[330px] flex-col justify-between overflow-hidden rounded-3xl border border-hair bg-canvas p-7 transition-colors hover:border-accent md:p-10">
              <span className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-accent/[.075] blur-3xl" />
              <div className="relative">
                <p className="flex items-center gap-2.5 text-[.78rem] font-semibold text-accent"><span className="pulse relative h-2 w-2 rounded-full bg-accent" />الأحدث · {categoryLabel(latest.cat)}</p>
                <h2 className="mt-6 max-w-3xl font-display text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-[1.42] text-ink transition-colors group-hover:text-accent">{latest.title}</h2>
                {latest.excerpt && <p className="mt-5 max-w-2xl text-[1rem] font-light leading-[1.95] text-soft">{latest.excerpt}</p>}
              </div>
              <div className="relative mt-10 flex items-center justify-between gap-4 border-t border-hair pt-5 text-[.86rem]">
                <span className="text-soft">{latest.date}</span><span className="font-semibold text-accent">اقرأ واستمع ←</span>
              </div>
            </Link>
          </FadeUp>
          <div className="grid gap-5">
            {curio && <FadeUp delay={0.08}>
              <Link to="/curated" className="group block rounded-2xl border border-hair bg-canvas p-6 transition-colors hover:border-accent">
                <p className="text-[.75rem] font-semibold text-accent">فكرة اليوم · {curio.kind}</p>
                <p className="mt-3 font-display text-[1.15rem] font-semibold leading-[1.75] text-ink transition-colors group-hover:text-accent">{curio.ar}</p>
                <p className="mt-4 text-[.78rem] text-soft">{curio.source} · تتبدّل يومياً</p>
              </Link>
            </FadeUp>}
            {historic && <FadeUp delay={0.14}>
              <Link to={`/articles/${historic.article.slug}`} className="group block rounded-2xl border border-hair bg-canvas p-6 transition-colors hover:border-accent">
                <p className="text-[.75rem] font-semibold text-accent">في مثل هذا الأسبوع · {yearsAgo(new Date().getFullYear() - historic.date.getFullYear())}</p>
                <p className="mt-3 font-display text-[1.08rem] font-semibold leading-[1.7] text-ink transition-colors group-hover:text-accent">«{historic.article.title}»</p>
                <p className="mt-4 text-[.78rem] text-soft">من ذاكرة الأرشيف ←</p>
              </Link>
            </FadeUp>}
          </div>
        </div>
      </div>
    </section>
  )
}

const AXES: Record<string, string[]> = {
  التعليم: ['تعليم', 'تدريس', 'مناهج', 'تعلم', 'مدرس', 'طلبة'],
  التربية: ['تربية', 'طفل', 'أطفال', 'أبناء', 'أسرة'],
  المجتمع: ['مجتمع', 'إعلام', 'شباب', 'اجتماعي'],
  التقنية: ['تكنولوجيا', 'ذكاء', 'رقمي', 'بيانات', 'تطبيقات', 'افتراضي'],
  الهوية: ['هوية', 'تراث', 'لغة', 'قيم', 'احتياجات'],
}

export function ThoughtCompassStation({ articles, books, papers }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[] }) {
  const [active, setActive] = useState(Object.keys(AXES)[0])
  const keys = AXES[active]
  const score = (text: string) => keys.reduce((total, key) => total + (text.includes(key) ? 1 : 0), 0)
  const relatedArticles = [...articles].sort((a, b) => score(`${b.title} ${b.excerpt} ${b.cat}`) - score(`${a.title} ${a.excerpt} ${a.cat}`)).slice(0, 3)
  const relatedBook = [...books].sort((a, b) => score(`${b.title} ${b.desc}`) - score(`${a.title} ${a.desc}`))[0]
  const relatedPaper = [...papers].sort((a, b) => score(`${b.title} ${b.meta}`) - score(`${a.title} ${a.meta}`))[0]
  return (
    <section className="border-t border-hair px-6 py-[58px] md:px-11 md:py-[96px]">
      <div className="mx-auto max-w-shell">
        <FadeUp><Label>بوصلة الفكر</Label><h2 className="font-display text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-[1.25] text-ink"><Reveal>ادخل من الفكرة، لا من نوع الملف.</Reveal></h2></FadeUp>
        <div className="mt-8 flex flex-wrap gap-2">
          {Object.keys(AXES).map((axis) => <button key={axis} onClick={() => setActive(axis)} className={`shrink-0 rounded-full border px-5 py-2 text-[.86rem] font-semibold transition-colors ${active === axis ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>{axis}</button>)}
        </div>
        <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_.38fr] lg:gap-12">
          <div className="divide-y divide-hair border-y border-hair">
            {relatedArticles.map((article, index) => <FadeUp key={article.slug} delay={index * .06}><Link to={`/articles/${article.slug}`} className="group flex items-start gap-5 py-5"><span className="font-display text-[1.2rem] font-bold text-accent/70">0{index + 1}</span><span className="flex-1"><span className="block font-display text-[1.12rem] font-medium leading-[1.65] text-ink group-hover:text-accent">{article.title}</span><span className="mt-1 block text-[.78rem] text-soft">مقال · {article.date}</span></span><span className="text-accent">←</span></Link></FadeUp>)}
          </div>
          <FadeUp delay={0.12}>
            <div className="rounded-2xl border border-hair bg-wash p-6">
              <p className="text-[.75rem] font-semibold text-accent">تعمّق في {active}</p>
              {relatedPaper && <Link to={`/research/${relatedPaper.slug}`} className="mt-4 block border-b border-hair pb-4"><span className="text-[.72rem] text-soft">بحث محكّم</span><span className="mt-1 block font-display text-[.98rem] font-medium leading-[1.6] text-ink hover:text-accent">{relatedPaper.title}</span></Link>}
              {relatedBook && <Link to={`/publications/${relatedBook.slug}`} className="mt-4 block"><span className="text-[.72rem] text-soft">كتاب</span><span className="mt-1 block font-display text-[.98rem] font-medium leading-[1.6] text-ink hover:text-accent">{relatedBook.title}</span></Link>}
              <Link to="/thought-paths" className="mt-6 inline-block font-semibold text-accent">المسار الكامل ←</Link>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

function WeeklyPollCompact() {
  const week = Math.max(0, Math.floor((Date.now() - new Date(LAUNCH_DATE).getTime()) / (7 * 864e5))) % staticQuestions.length
  const question = staticQuestions[week]
  const key = `poll:${week}`
  const [voted, setVoted] = useState<string | null>(() => { try { return localStorage.getItem(key) } catch { return null } })
  const vote = (value: string) => { setVoted(value); try { localStorage.setItem(key, value) } catch { /* noop */ } }
  return (
    <details className="group rounded-2xl border border-hair bg-canvas p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span><span className="block text-[.75rem] font-semibold text-accent">سؤال متجدد</span><span className="mt-1 block font-display text-[1rem] font-semibold leading-[1.65] text-ink">{question.ar}</span></span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span></summary>
      <div className="mt-5 border-t border-hair pt-5">
        {!voted ? <div className="flex flex-wrap gap-2">{['أوافق', 'لا أوافق', 'المسألة أعقد'].map((option) => <button key={option} onClick={() => vote(option)} className="rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft hover:border-accent hover:text-accent">{option}</button>)}</div> : <div><p className="text-[.82rem] text-soft">اخترت: <span className="font-semibold text-accent">{voted}</span></p><p className="mt-3 text-[.9rem] leading-[1.9] text-ink">{question.take}</p></div>}
        <Link to="/questions" className="mt-4 inline-block text-[.82rem] font-semibold text-accent">كل الأسئلة ←</Link>
      </div>
    </details>
  )
}

function VisitorPathSheet({ open, close }: { open: boolean; close: () => void }) {
  const [persona, setPersona] = useState<Persona | null>(() => { try { return localStorage.getItem('visitor:persona') as Persona | null } catch { return null } })
  const choose = (value: Persona) => { setPersona(value); try { localStorage.setItem('visitor:persona', value) } catch { /* noop */ } }
  const active = persona ? PERSONAS.find((item) => item.key === persona) : null
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, open])
  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[260] flex items-end justify-center bg-ink/[.35] p-3 backdrop-blur-sm md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}><motion.div role="dialog" aria-modal="true" aria-label="اختر مسارك" onMouseDown={(event) => event.stopPropagation()} className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-hair bg-canvas p-6 shadow-2xl md:p-9" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: .35, ease: EASE }}><div className="flex items-start justify-between gap-4"><div><p className="text-[.76rem] font-semibold text-accent">مسارك الشخصي</p><h2 className="mt-1 font-display text-2xl font-semibold text-ink">لا أغيّر الموقع عليك؛ أختصر لك البداية فقط.</h2></div><button onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft">×</button></div>{active ? <div className="mt-7 rounded-2xl border border-accent/30 bg-wash p-6"><p className="text-[.76rem] font-semibold text-accent">بما أنك {active.label}</p><h3 className="mt-2 font-display text-xl font-semibold text-ink">{active.title}</h3><p className="mt-2 text-[.9rem] leading-relaxed text-soft">{active.desc}</p><div className="mt-5 flex flex-wrap gap-2">{active.links.map((link) => <Link key={link.to} to={link.to} onClick={close} className="rounded-full bg-accent px-5 py-2.5 text-[.84rem] font-semibold text-white">{link.label} ←</Link>)}</div><button onClick={() => setPersona(null)} className="mt-5 text-[.78rem] text-soft hover:text-accent">تغيير المسار</button></div> : <div className="mt-7 grid gap-3 md:grid-cols-3">{PERSONAS.map((item) => <button key={item.key} onClick={() => choose(item.key)} className="rounded-2xl border border-hair bg-wash p-5 text-right transition-colors hover:border-accent"><span className="font-display text-[1rem] font-semibold text-ink">{item.label}</span><span className="mt-2 block text-[.82rem] leading-relaxed text-soft">{item.desc}</span></button>)}</div>}</motion.div></motion.div>}</AnimatePresence>
}

export function SelectedWorksStation({ articles, books, papers, media }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const [pathOpen, setPathOpen] = useState(false)
  const book = books[0], article = articles[0], paper = papers[0], appearance = media[0]
  const deep = [
    { to: '/atlas', label: 'سماء المقالات', note: 'الأرشيف كخريطة زمنية' },
    { to: '/ask', label: 'العقل الحي', note: 'اسأل المكتبة مباشرة' },
    { to: '/decade', label: 'وثيقة العقد', note: 'رحلة الفكرة والأثر' },
    { to: '/questions', label: 'سؤال يُقلق التعليم', note: 'زاوية أسبوعية تفاعلية' },
  ]
  return (
    <section className="border-t border-hair bg-wash px-6 py-[58px] md:px-11 md:py-[96px]">
      <div className="mx-auto max-w-shell">
        <SectionHead label="أعمال مختارة" title="أربع نوافذ. عالم واحد." to="/search" cta="ابحث في كل الأرشيف" />
        <div className="grid gap-4 md:grid-cols-2">
          {book && <FadeUp><Link to={`/publications/${book.slug}`} className="group grid min-h-[230px] grid-cols-[.7fr_1.3fr] overflow-hidden rounded-2xl border border-hair bg-canvas transition-colors hover:border-accent"><div className="overflow-hidden bg-white"><img src={book.cover} alt={book.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div><div className="flex flex-col justify-between p-6"><div><p className="text-[.74rem] font-semibold text-accent">كتاب مختار</p><h3 className="mt-3 font-display text-[1.18rem] font-semibold leading-[1.55] text-ink group-hover:text-accent">{book.title}</h3></div><span className="text-[.82rem] text-soft">استكشف الكتاب ←</span></div></Link></FadeUp>}
          {paper && <FadeUp delay={.06}><Link to={`/research/${paper.slug}`} className="group flex min-h-[230px] flex-col justify-between rounded-2xl border border-hair bg-canvas p-7 transition-colors hover:border-accent"><div><p className="text-[.74rem] font-semibold text-accent">بحث محكّم</p><h3 className="mt-4 font-display text-[1.25rem] font-semibold leading-[1.65] text-ink group-hover:text-accent">{paper.title}</h3><p className="mt-3 text-[.8rem] leading-relaxed text-soft">{paper.meta}</p></div><span className="mt-5 text-[.82rem] text-accent">اقرأ البحث ←</span></Link></FadeUp>}
          {article && <FadeUp delay={.1}><Link to={`/articles/${article.slug}`} className="group flex min-h-[215px] flex-col justify-between rounded-2xl border border-hair bg-canvas p-7 transition-colors hover:border-accent"><div><p className="text-[.74rem] font-semibold text-accent">مقال بصوتي</p><h3 className="mt-4 font-display text-[1.25rem] font-semibold leading-[1.65] text-ink group-hover:text-accent">{article.title}</h3></div><span className="mt-5 text-[.82rem] text-soft">قراءة واستماع ←</span></Link></FadeUp>}
          {appearance && <FadeUp delay={.14}><a href={appearance.url} target="_blank" rel="noreferrer" className="group grid min-h-[215px] grid-rows-[1fr_auto] overflow-hidden rounded-2xl border border-hair bg-canvas transition-colors hover:border-accent"><div className="selected-media-frame relative min-h-[145px] overflow-hidden bg-ink/10" style={{ '--media-thumb': ytId(appearance.url) ? `url(https://i.ytimg.com/vi/${ytId(appearance.url)}/hqdefault.jpg)` : 'none' } as CSSProperties}>{ytId(appearance.url) && <img src={`https://i.ytimg.com/vi/${ytId(appearance.url)}/hqdefault.jpg`} alt={appearance.title} loading="lazy" className="selected-media-thumb h-full w-full transition-opacity duration-300 group-hover:opacity-95" />}<span className="absolute inset-0 flex items-center justify-center bg-ink/10"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas/90 text-accent">▶</span></span></div><div className="p-5"><p className="text-[.72rem] font-semibold text-accent">{appearance.outlet}</p><h3 className="mt-1 font-display text-[1rem] font-semibold leading-[1.55] text-ink group-hover:text-accent">{appearance.title}</h3></div></a></FadeUp>}
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_.52fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {deep.map((item, index) => <FadeUp key={item.to} delay={Math.min(index * .04, .16)}><Link to={item.to} className="group block rounded-2xl border border-hair bg-canvas p-5 transition-colors hover:border-accent"><span className="font-display text-[1rem] font-semibold text-ink group-hover:text-accent">{item.label}</span><span className="mt-1 block text-[.78rem] text-soft">{item.note}</span></Link></FadeUp>)}
          </div>
          <div className="grid gap-3">
            <button onClick={() => setPathOpen(true)} className="rounded-2xl border border-accent/[.35] bg-accent/[.045] p-5 text-right transition-colors hover:border-accent"><span className="text-[.74rem] font-semibold text-accent">ابدأ وفق اهتمامك</span><span className="mt-1 block font-display text-[1.05rem] font-semibold text-ink">مسار شخصي اختياري، بلا تعطيل للزيارة.</span></button>
            <WeeklyPollCompact />
          </div>
        </div>
      </div>
      <VisitorPathSheet open={pathOpen} close={() => setPathOpen(false)} />
    </section>
  )
}

export function ClosingStation({ upcoming, aboutHeading, about }: { upcoming: SiteEvent[]; aboutHeading: string; about: string }) {
  return (
    <section className="border-t border-hair px-6 py-[58px] md:px-11 md:py-[88px]">
      <div className="mx-auto max-w-shell">
        <div className="grid gap-10 border-b border-hair pb-12 md:grid-cols-2 md:gap-16 md:pb-16">
          <FadeUp><Label>الرؤية</Label><h2 className="font-display text-[clamp(1.8rem,4.2vw,2.8rem)] font-semibold leading-[1.35] text-ink">{aboutHeading.replace('\n', ' ')}</h2><p className="mt-5 text-[1rem] font-light leading-[1.95] text-soft">{about}</p><Link to="/cv" className="mt-6 inline-block font-semibold text-accent">السيرة الكاملة ←</Link></FadeUp>
          <FadeUp delay={.08}><Newsletter /></FadeUp>
        </div>
        <div className="mt-10 grid gap-8">
          <FadeUp><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[.76rem] font-semibold text-accent">اللقاءات القادمة</p><h2 className="mt-1 font-display text-[1.55rem] font-semibold text-ink">أين ألتقيك؟</h2></div><Link to="/upcoming" className="text-[.82rem] font-semibold text-accent">الجدول ←</Link></div>{upcoming.length ? <ul className="space-y-2.5">{upcoming.slice(0, 2).map((event) => <li key={`${event.iso}-${event.title}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-hair px-4 py-3"><time className="text-[.76rem] font-semibold text-accent">{event.date}</time><span className="min-w-0 flex-1"><span className="block font-display text-[.95rem] font-medium text-ink">{event.title}</span><span className="block text-[.72rem] text-soft">{event.org} · {event.place}</span></span>{event.url && <a href={event.url} target="_blank" rel="noreferrer" className="text-[.76rem] font-semibold text-accent">التسجيل ←</a>}</li>)}</ul> : <div className="rounded-xl border border-hair bg-wash px-4 py-4 text-[.86rem] text-soft">لا لقاءات معلنة حالياً. <Link to="/contact#booking-form" className="font-semibold text-accent">احجز موعداً ←</Link></div>}</FadeUp>

        </div>
      </div>
    </section>
  )
}
