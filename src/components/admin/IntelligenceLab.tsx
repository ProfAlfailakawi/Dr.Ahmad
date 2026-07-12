import { useEffect, useMemo, useState } from 'react'
import { books, papers } from '../../data'
import type { ArticleRecord } from '../../lib/cms'
import { fetchPublishedExtras, getDb } from '../../lib/firebase'
import {
  articleSystem,
  automaticSeries,
  ideaLab,
  monthlyPlan,
  publicationGate,
  topicMemory,
} from '../../lib/intelligence'

const card = 'rounded-2xl border border-hair bg-wash p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const softBtn = 'rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent'
const primaryBtn = 'rounded-full bg-accent px-5 py-2 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'

function CopyButton({ value, label = 'نسخ' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setDone(true)
        window.setTimeout(() => setDone(false), 1800)
      }}
      className={softBtn}
    >
      {done ? 'تم النسخ ✓' : label}
    </button>
  )
}

function SmallList({ title, items, path }: { title: string; items: { slug: string; title: string }[]; path: string }) {
  return (
    <div>
      <p className="text-[.76rem] font-semibold text-accent">{title}</p>
      {items.length ? (
        <ul className="mt-2 grid gap-1.5">
          {items.map((item) => (
            <li key={item.slug}>
              <a href={`${path}/${item.slug}`} target="_blank" rel="noreferrer" className="text-[.84rem] leading-relaxed text-ink transition-colors hover:text-accent">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[.84rem] text-soft">لا رابط واضح بعد.</p>}
    </div>
  )
}

function ReadinessCard({ articles }: { articles: ArticleRecord[] }) {
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<{ label: string; ok: boolean; note: string }[]>([])

  const run = async () => {
    setBusy(true)
    const test = async (url: string, contains?: string) => {
      try {
        const response = await fetch(url, { cache: 'no-store' })
        const text = await response.text()
        return response.ok && (!contains || text.includes(contains))
      } catch { return false }
    }
    const [sitemap, rss, podcast, robots] = await Promise.all([
      test('/sitemap.xml', '<urlset'),
      test('/feed.xml', '<rss'),
      test('/podcast.xml', '<rss'),
      test('/robots.txt', 'Sitemap:'),
    ])
    const withAudio = articles.filter((article) => article.hasAudio).length
    const missingImages = books.filter((book) => !book.cover).length
    setChecks([
      { label: 'Sitemap', ok: sitemap, note: sitemap ? 'يفتح ويحتوي XML.' : 'يحتاج نشر/توليد.' },
      { label: 'RSS', ok: rss, note: rss ? 'الخلاصة متاحة.' : 'الخلاصة غير متاحة.' },
      { label: 'Podcast', ok: podcast, note: podcast ? 'خلاصة البودكاست متاحة.' : 'خلاصة البودكاست غير متاحة.' },
      { label: 'Robots', ok: robots, note: robots ? 'يوجه لمحركات البحث.' : 'يحتاج مراجعة.' },
      { label: 'الصوت', ok: withAudio === articles.length, note: `${withAudio} من ${articles.length} مقالاً لديها صوت.` },
      { label: 'الصور', ok: missingImages === 0, note: missingImages ? `${missingImages} غلاف يحتاج مراجعة.` : 'أغلفة الكتب متاحة.' },
    ])
    setBusy(false)
  }

  const ok = checks.length && checks.every((check) => check.ok)
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">جاهزية النشر</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">{ok ? 'جاهز للنشر.' : checks.length ? 'يحتاج انتباه.' : 'فحص هادئ قبل الإطلاق.'}</h2>
        </div>
        <button type="button" onClick={run} disabled={busy} className={primaryBtn}>{busy ? 'أفحص…' : 'افحص الآن'}</button>
      </div>
      {checks.length > 0 && (
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {checks.map((check) => (
            <li key={check.label} className="rounded-xl border border-hair bg-canvas px-4 py-3">
              <span className={`me-2 ${check.ok ? 'text-accent' : 'text-soft'}`}>{check.ok ? '✓' : '!'}</span>
              <span className="font-semibold text-ink">{check.label}</span>
              <p className="mt-1 text-[.78rem] text-soft">{check.note}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function IdeaLabCard({ articles }: { articles: ArticleRecord[] }) {
  const [idea, setIdea] = useState('الخوف من الامتحان')
  const result = useMemo(() => ideaLab(idea, articles, books, papers), [articles, idea])
  const bundle = [
    `عنوان أقوى: ${result.title}`,
    `زاوية: ${result.angle}`,
    `مقال قصير:\n${result.shortArticle}`,
    `LinkedIn:\n${result.linkedin}`,
    `بودكاست:\n${result.podcast}`,
  ].join('\n\n---\n\n')
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">مختبر الفكرة</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">اكتب فكرة خاماً… والموقع يردّ من أرشيفك.</h2>
      <input className={`${input} mt-5`} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="مثال: الذكاء الاصطناعي في التعليم" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
        <div className="rounded-2xl border border-hair bg-canvas p-5">
          <p className="font-display text-lg font-semibold text-ink">{result.title}</p>
          <p className="mt-3 text-[.9rem] leading-relaxed text-soft">{result.angle}</p>
          <div className="mt-4 whitespace-pre-wrap text-[.9rem] leading-loose text-ink">{result.shortArticle}</div>
          <div className="mt-4 flex flex-wrap gap-2"><CopyButton value={bundle} label="نسخ الحزمة" /></div>
        </div>
        <div className="grid gap-4">
          <SmallList title="مقالات مرتبطة" items={result.relatedArticles} path="/articles" />
          <SmallList title="أبحاث مناسبة" items={result.relatedPapers} path="/research" />
          <SmallList title="كتب قريبة" items={result.relatedBooks} path="/publications" />
        </div>
      </div>
    </section>
  )
}

function ArticleSystemCard({ articles }: { articles: ArticleRecord[] }) {
  const [slug, setSlug] = useState(articles[0]?.slug || '')
  const article = articles.find((item) => item.slug === slug) || articles[0]
  const result = useMemo(() => article ? articleSystem(article, articles, books, papers) : null, [article, articles])
  if (!article || !result) return null
  const full = [
    `مختصر:\n${result.summary}`,
    `نسخة أكاديمية:\n${result.academic}`,
    `X:\n${result.xPost}`,
    `LinkedIn:\n${result.linkedin}`,
    `فيديو دقيقة:\n${result.videoScript}`,
    `سؤال طلاب:\n${result.studentQuestion}`,
    `شريحة:\n${result.slide}`,
    `بودكاست:\n${result.podcast}`,
    `اقتباسات:\n${result.quotes.join('\n')}`,
  ].join('\n\n---\n\n')
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">تحويل المقال إلى منظومة</p>
      <select className={`${input} mt-4`} value={article.slug} onChange={(event) => setSlug(event.target.value)}>
        {articles.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
      </select>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          ['نسخة مختصرة', result.summary],
          ['منشور LinkedIn', result.linkedin],
          ['نص فيديو دقيقة', result.videoScript],
          ['سؤال للطلاب', result.studentQuestion],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl border border-hair bg-canvas p-4">
            <p className="font-semibold text-ink">{title}</p>
            <p className="mt-2 text-[.86rem] leading-relaxed text-soft">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><CopyButton value={full} label="نسخ المنظومة كاملة" /></div>
    </section>
  )
}

function MemoryAndGateCard({ articles }: { articles: ArticleRecord[] }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const memory = useMemo(() => topicMemory(title, body, articles, books, papers), [articles, body, title])
  const gate = useMemo(() => publicationGate({ title, body, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), excerpt: body.slice(0, 160), cat: 'تلقائي' }, articles), [articles, body, title])
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">ذاكرة المواضيع + بوابة قبل النشر</p>
      <div className="mt-4 grid gap-3">
        <input className={input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان المقال الجديد أو فكرته" />
        <textarea className={`${input} min-h-32 leading-loose`} value={body} onChange={(event) => setBody(event.target.value)} placeholder="اكتب مسودة قصيرة…" />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-hair bg-canvas p-4">
          <p className="font-semibold text-ink">ذاكرة الفكرة</p>
          <p className="mt-2 text-[.86rem] leading-relaxed text-soft">{memory.note}</p>
          <SmallList title="أقرب مقالات" items={memory.relatedArticles} path="/articles" />
        </div>
        <div className="rounded-xl border border-hair bg-canvas p-4">
          <p className="font-semibold text-ink">{gate.ready ? 'جاهز مبدئياً' : 'يحتاج ضبطاً قبل النشر'}</p>
          <ul className="mt-2 grid gap-1.5 text-[.84rem] text-soft">
            {(gate.issues.length ? gate.issues : ['العنوان، النص، المقتطف، والـslug تبدو سليمة.']).map((issue) => <li key={issue}>• {issue}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}

function StrategyCards({ articles }: { articles: ArticleRecord[] }) {
  const series = useMemo(() => automaticSeries(articles), [articles])
  const plan = useMemo(() => monthlyPlan(articles, books, papers), [articles])
  const noAudio = articles.filter((article) => !article.hasAudio)
  const withAudio = articles.filter((article) => article.hasAudio)
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">غرفة التحكم الصوتية</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <span className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{withAudio.length}</strong><small className="text-soft">مقالات بصوت</small></span>
          <span className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-ink">{noAudio.length}</strong><small className="text-soft">تحتاج صوت</small></span>
        </div>
        <p className="mt-4 text-[.84rem] leading-relaxed text-soft">الحلقات الحوارية المعتمدة تبقى في خلاصة البودكاست فقط بعد اجتياز بوابة الجودة. إعادة التوليد تتم من سكربت الصوت حتى لا نضيف زرًا خطيرًا داخل المتصفح.</p>
      </section>
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">مدير النشر الشهري</p>
        <ol className="mt-4 grid gap-2">
          {plan.map((week) => (
            <li key={week.week} className="rounded-xl border border-hair bg-canvas p-3 text-[.84rem] leading-relaxed">
              <span className="font-semibold text-accent">الأسبوع {week.week}: </span>
              <span className="text-ink">{week.article.title}</span>
              <span className="block text-soft">{week.action} · مرافق: {week.companion}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className={`${card} lg:col-span-2`}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">سلاسل فكرية تلقائية</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {series.map((group) => (
            <div key={group.title} className="rounded-xl border border-hair bg-canvas p-4">
              <p className="font-display text-lg font-semibold text-ink">{group.title}</p>
              <ul className="mt-3 grid gap-1.5">
                {group.items.slice(0, 4).map((item) => <li key={item.slug}><a className="text-[.83rem] text-soft hover:text-accent" href={`/articles/${item.slug}`} target="_blank" rel="noreferrer">{item.title}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function NowCard() {
  const [form, setForm] = useState({ question: '', note: '', link: '' })
  const [saved, setSaved] = useState('')
  const save = async () => {
    const db = await getDb()
    if (!db || !form.question.trim()) return
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
    await addDoc(collection(db, 'site_now'), { ...form, status: 'published', createdAt: serverTimestamp() })
    setForm({ question: '', note: '', link: '' })
    setSaved('حُفظت الفكرة في صفحة ماذا أفكر الآن ✓')
    window.setTimeout(() => setSaved(''), 2500)
  }
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">ماذا أفكر الآن؟</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input className={input} value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} placeholder="سؤال يشغلني" />
        <input className={input} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="ملاحظة قصيرة" />
        <input className={input} dir="ltr" value={form.link} onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} placeholder="/articles/..." />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} className={primaryBtn}>حفظ فكرة</button>
        {saved && <span className="text-[.82rem] text-accent">{saved}</span>}
      </div>
    </section>
  )
}

type RadarItem = { id: string; ar?: string; arNote?: string; source?: string; url?: string }
function DoctorRadarCard({ articles }: { articles: ArticleRecord[] }) {
  const [items, setItems] = useState<RadarItem[]>([])
  useEffect(() => {
    let active = true
    fetchPublishedExtras<RadarItem>('site_radar').then((value) => { if (active) setItems(value.slice(0, 5)) })
    return () => { active = false }
  }, [])
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">رادار الدكتور</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">خمس صيدات تستحق تعليقك.</h2>
      <div className="mt-5 grid gap-3">
        {items.length ? items.map((item) => {
          const related = ideaLab(`${item.ar || ''} ${item.arNote || ''}`, articles, books, papers).relatedArticles[0]
          const draft = `تعليق مقترح:\n${item.ar}\n\nاللافت هنا أنه لا يتعلق بالخبر وحده، بل بسؤال أعمق: ماذا يحدث للإنسان عندما تتغير أدوات التعليم؟${related ? `\n\nيرتبط هذا بما كتبته في: ${related.title}` : ''}`
          return (
            <div key={item.id} className="rounded-xl border border-hair bg-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[.9rem] font-semibold leading-relaxed text-ink">{item.ar}</p>
                  {item.arNote && <p className="mt-1 text-[.82rem] leading-relaxed text-soft">{item.arNote}</p>}
                  {related && <p className="mt-2 text-[.78rem] text-accent">يرتبط بمقال: {related.title}</p>}
                </div>
                <CopyButton value={draft} label="اكتب تعليقاً" />
              </div>
            </div>
          )
        }) : <p className="rounded-xl border border-hair bg-canvas p-4 text-[.86rem] text-soft">تظهر هنا صيدات الرادار بعد تشغيل/نشر الرادار اليومي.</p>}
      </div>
    </section>
  )
}

export function IntelligenceLab({ articles }: { articles: ArticleRecord[] }) {
  return (
    <div className="grid gap-5">
      <ReadinessCard articles={articles} />
      <IdeaLabCard articles={articles} />
      <DoctorRadarCard articles={articles} />
      <ArticleSystemCard articles={articles} />
      <MemoryAndGateCard articles={articles} />
      <StrategyCards articles={articles} />
      <NowCard />
    </div>
  )
}
