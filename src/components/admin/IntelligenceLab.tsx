import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { books, papers } from '../../data'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { fetchPublishedExtras } from '../../lib/firebase'
import { beginAdminTask } from '../../lib/admin-task-state'
import { PersonalKnowledgeGraph } from './PersonalKnowledgeGraph'
import { AnswerQualityLab } from './AnswerQualityLab'
import type { AdminTab } from './admin-navigation'
import { arabicCountPhrase, ARTICLE_PLAIN_FORMS, ARTICLE_WITH_AUDIO_FORMS, COVER_FORMS } from '../../lib/arabic-count.ts'
import {
  articleSystem,
  automaticSeries,
  ideaLab,
  monthlyPlan,
} from '../../lib/intelligence'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const softBtn = 'rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent'
const primaryBtn = 'rounded-full bg-accent px-5 py-2 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'

type RadarItem = { id: string; ar?: string; arNote?: string; en?: string; source?: string; url?: string }

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

function LabLayer({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-hair bg-canvas p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-hair pb-4">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">طبقة عمل</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{title}</h2>
        </div>
        <p className="max-w-2xl text-[.86rem] leading-relaxed text-soft">{note}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

function ToolDetails({
  title,
  note,
  children,
  defaultOpen = false,
}: {
  title: string
  note: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className={`${card} group`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block font-display text-lg font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-[.82rem] leading-relaxed text-soft">{note}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-5 border-t border-hair pt-5">{children}</div>
    </details>
  )
}

function ReadinessCard({ articles }: { articles: ArticleRecord[] }) {
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<{ label: string; ok: boolean; note: string }[]>([])

  const run = async () => {
    const task = beginAdminTask('فحص جاهزية الموقع')
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
    const nextChecks = [
      { label: 'Sitemap', ok: sitemap, note: sitemap ? 'يفتح ويحتوي XML.' : 'يحتاج نشر/توليد.' },
      { label: 'RSS', ok: rss, note: rss ? 'الخلاصة متاحة.' : 'الخلاصة غير متاحة.' },
      { label: 'Podcast', ok: podcast, note: podcast ? 'خلاصة البودكاست متاحة.' : 'خلاصة البودكاست غير متاحة.' },
      { label: 'Robots', ok: robots, note: robots ? 'يوجه لمحركات البحث.' : 'يحتاج مراجعة.' },
      { label: 'الصوت', ok: withAudio === articles.length, note: `${arabicCountPhrase(withAudio, ARTICLE_WITH_AUDIO_FORMS)} من أصل ${arabicCountPhrase(articles.length, ARTICLE_PLAIN_FORMS)}.` },
      { label: 'الصور', ok: missingImages === 0, note: missingImages ? `${arabicCountPhrase(missingImages, COVER_FORMS)}.` : 'أغلفة الكتب متاحة.' },
    ]
    setChecks(nextChecks)
    if (nextChecks.every((check) => check.ok)) task.complete('الموقع جاهز')
    else task.needsInput('نتائج الفحص تحتاج مراجعة')
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

function MonthlyPlanDetails({ articles }: { articles: ArticleRecord[] }) {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat('ar-KW-u-nu-latn', { month: 'long', year: 'numeric' }).format(now)
  const plan = useMemo(() => monthlyPlan(articles, books, papers, now), [articles, period])
  return (
    <ToolDetails title={`خطة ${monthLabel}`} note="تتبدّل تلقائياً مع بداية كل شهر، وتنوّع بين التصنيفات والأرشيف والزوايا الجديدة.">
      <ol className="grid gap-2 md:grid-cols-2">
        {plan.map((week) => (
          <li key={`${week.period}-${week.week}`} className="rounded-xl border border-hair bg-canvas p-4 text-[.84rem] leading-relaxed">
            <span className="font-semibold text-accent">الأسبوع {week.week}: </span>
            <span className="text-ink">{week.article.title}</span>
            <span className="mt-1 block text-soft">{week.action}</span>
            <span className="mt-1 block text-[.76rem] text-soft">المرافق: {week.companion}</span>
          </li>
        ))}
      </ol>
    </ToolDetails>
  )
}

function SeriesDetails({ articles }: { articles: ArticleRecord[] }) {
  const series = useMemo(() => automaticSeries(articles), [articles])
  return (
    <ToolDetails title="سلاسل فكرية تلقائية" note="ترتيب داخلي يساعدك على رؤية المسارات. لا يظهر للناس إلا إذا حوّلناه لاحقاً إلى صفحة عامة.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {series.map((group) => (
          <div key={group.title} className="rounded-xl border border-hair bg-canvas p-4">
            <p className="font-display text-lg font-semibold text-ink">{group.title}</p>
            <ul className="mt-3 grid gap-1.5">
              {group.items.slice(0, 4).map((item) => <li key={item.slug}><a className="text-[.83rem] text-soft hover:text-accent" href={`/articles/${item.slug}`} target="_blank" rel="noreferrer">{item.title}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
    </ToolDetails>
  )
}

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
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">خمس لقطات تستحق تعليقك.</h2>
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
                  {related && (
                    <a href={`/articles/${related.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[.78rem] text-accent transition-colors hover:text-accent-deep">
                      يرتبط بمقال: {related.title} ←
                    </a>
                  )}
                </div>
                <CopyButton value={draft} label="اكتب تعليقاً" />
              </div>
            </div>
          )
        }) : <p className="rounded-xl border border-hair bg-canvas p-4 text-[.86rem] text-soft">تظهر هنا لقطات الرادار بعد تشغيل/نشر الرادار اليومي.</p>}
      </div>
    </section>
  )
}


function AudioWorkspaceBridge({ onOpen }: { onOpen: (tab: AdminTab) => void }) {
  return (
    <section className={`${card} border-accent/25 bg-accent/[.035]`}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">الامتداد الصوتي</p>
      <h3 className="mt-1 font-display text-xl font-semibold text-ink">الفكرة تُطوَّر هنا، وإنتاج صوتها يعيش في منظومته الرسمية.</h3>
      <p className="mt-2 max-w-2xl text-[.84rem] leading-relaxed text-soft">لا نكرر غرفة التحكم أو بوابة الجودة داخل المختبر. انتقل إلى قافلة الصوت لمعرفة الحالة، أو غرفة الإنتاج لاتخاذ القرار، أو المكتبة للسماع والإدارة.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpen('sound-caravan')} className={softBtn}>قافلة الصوت</button>
        <button type="button" onClick={() => onOpen('production')} className={softBtn}>غرفة الإنتاج</button>
        <button type="button" onClick={() => onOpen('audio-library')} className={softBtn}>مكتبة الصوت</button>
      </div>
    </section>
  )
}

export function IntelligenceLab({ articles, onOpen }: { articles: ArticleRecord[]; onOpen: (tab: AdminTab) => void }) {
  const [richArticles, setRichArticles] = useState<ArticleRecord[]>(articles)
  const [view, setView] = useState<'before' | 'develop' | 'system' | 'quality'>(() => {
    if (typeof window === 'undefined') return 'before'
    try {
      const requested = sessionStorage.getItem('admin:lab-view')
      sessionStorage.removeItem('admin:lab-view')
      return requested === 'develop' || requested === 'quality' ? requested : 'before'
    } catch { return 'before' }
  })

  useEffect(() => {
    let active = true
    setRichArticles(articles)
    loadArticleBodies()
      .then((bodies) => {
        if (!active) return
        setRichArticles(articles.map((article) => ({ ...article, body: article.body || bodies[article.slug] })))
      })
      .catch(() => {
        if (active) setRichArticles(articles)
      })
    return () => { active = false }
  }, [articles])

  return (
    <div className="grid gap-5">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">المختبر المتقدم</p>
        <p className="mt-2 text-[.88rem] leading-relaxed text-soft">الأدوات نفسها باقية، ومختبر الجودة الداخلي منفصل حتى لا يلوث واجهة الموقع العامة.</p>
        <div className="mt-5 flex min-w-0 flex-wrap gap-2 pb-1 md:flex-nowrap md:overflow-x-auto">
          {([['before','قبل النشر'],['develop','تطوير الفكرة'],['system','تحويل المقال والصوت'],['quality','جودة اسأل المكتبة']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setView(key)} className={`shrink-0 rounded-full px-4 py-2 text-[.8rem] font-semibold ${view === key ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft'}`}>{label}</button>)}
        </div>
      </section>

      {view === 'before' && <LabLayer title="قبل النشر" note="فحص الجاهزية وخطة نشر تتغير تلقائياً كل شهر."><ReadinessCard articles={richArticles} /><MonthlyPlanDetails articles={richArticles} /></LabLayer>}

      {view === 'develop' && <LabLayer title="تطوير الفكرة" note="مساحة هادئة لتطوير سؤال أو خبر أو ملاحظة، وربطه بتاريخك الفكري."><PersonalKnowledgeGraph /><IdeaLabCard articles={richArticles} /><DoctorRadarCard articles={richArticles} /><SeriesDetails articles={richArticles} /></LabLayer>}

      {view === 'quality' && <LabLayer title="جودة اسأل المكتبة" note="مختبر داخلي صامت يختبر قلب الإجابة ولا يضيف أي عنصر إلى الموقع العام."><AnswerQualityLab articles={richArticles} /></LabLayer>}

      {view === 'system' && <LabLayer title="تحويل المقال إلى منظومة" note="تحويل المقال الواحد إلى محاضرة، منشورات، سؤال طلاب، وبودكاست — من دون نشر تلقائي."><ArticleSystemCard articles={richArticles} /><AudioWorkspaceBridge onOpen={onOpen} /></LabLayer>}
    </div>
  )
}
