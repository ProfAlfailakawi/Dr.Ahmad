/**
 * «العقل الحي» — /ask
 * يسأل الزائر سؤالاً حقيقياً، فيعيد الموقع ترتيب أرشيف الدكتور فقط:
 * اقتباسات حرفية، خط زمني، أحدث موقف منشور، وكتاب شخصي خفيف.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toRoot } from '../lib/dialect-lexicon'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { useSeo } from '../components/seo'
import { loadArticleBodies } from '../lib/article-bodies'

const norm = (s: string) => s
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^\w؀-ۿ ]/g, ' ')
  .toLowerCase()

const STOP = new Set(['على','الى','من','في','عن','مع','هذا','هذه','ذلك','التي','الذي','بين','بعد','قبل','عند','حتي','كان','كانت','هل','ما','لا','لم','لن','قد','ثم','او','ام','بل','كل','بعض','غير','نحو','لدي','منذ','حين','حول','ان','لان','كيف','اين','ليس','وهو','وهي','راي','رايك','الدكتور','دكتور','احمد','الفيلكاوي','برايك','شنو','ماذا','لماذا'])
const bareTokens = (s: string) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
/* التوسيع بالقاموس الجبّار: يسأل الزائر «شنو رايه بالعيال؟» فيلتقي بمقال الأستاذ
   عن «الأطفال». والموقع والبوت يفهمان اللهجات نفسها لأنهما يشربان من معجمٍ واحد. */
const tokenize = (s: string) => bareTokens(s).map(toRoot)

type Hit = { slug: string; title: string; iso: string; cat?: string; excerpt?: string; para: string; score: number }
type TimelineItem = { slug: string; title: string; iso: string; cat?: string; excerpt?: string; score: number }
type Ref = { kind: 'كتاب' | 'بحث محكّم'; slug: string; title: string; href: string }
type AskArticle = ArticleRecord & { body?: string }
type Answer = {
  hits: Hit[]
  near: TimelineItem[]
  refs: Ref[]
  timeline: TimelineItem[]
  latest?: TimelineItem
  earliest?: TimelineItem
  tension?: string
}

type TwinCitation = { index: number; slug: string; title: string; quote?: string; url?: string }
type TwinAnswer = { answer: string; citations: TwinCitation[]; grounded: boolean; source: 'ai' | 'local' }

function matchRefs(qTokens: string[], books: BookRecord[], papers: PaperRecord[]): Ref[] {
  const refs: (Ref & { score: number })[] = []
  for (const b of books) {
    const nb = norm(b.title + ' ' + (b.desc || ''))
    let score = 0
    for (const w of qTokens) if (nb.includes(w)) score++
    if (score >= 2) refs.push({ kind: 'كتاب', slug: b.slug, title: b.title, href: `/publications/${b.slug}`, score })
  }
  for (const p of papers) {
    const np = norm(p.title + ' ' + ((p as { meta?: string }).meta || ''))
    let score = 0
    for (const w of qTokens) if (np.includes(w)) score++
    if (score >= 2) refs.push({ kind: 'بحث محكّم', slug: p.slug, title: p.title, href: `/research/${p.slug}`, score })
  }
  return refs.sort((a, b) => b.score - a.score).slice(0, 3)
}

function compactText(text = '', limit = 460) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  const cut = clean.slice(0, limit)
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('؟'), cut.lastIndexOf('!'), cut.lastIndexOf('،'))
  return (end > 200 ? cut.slice(0, end + 1) : cut).trim() + (end > 200 ? '' : '…')
}

function toTimelineItem(entry: { a: AskArticle; score: number }): TimelineItem {
  return {
    slug: entry.a.slug,
    title: entry.a.title,
    iso: entry.a.iso,
    cat: entry.a.cat,
    excerpt: entry.a.excerpt,
    score: entry.score,
  }
}

function answer(question: string, bodies: Record<string, string>, articles: ArticleRecord[], books: BookRecord[], papers: PaperRecord[]): Answer {
  const q = tokenize(question)
  if (!q.length) return { hits: [], near: [], refs: [], timeline: [] }

  const scored = articles.map((article) => {
    const a: AskArticle = { ...article, body: bodies[article.slug] || undefined }
    /* الطرفان يُردّان إلى الجذور: كلماتُ السؤال مُوسَّعة أصلاً في q، وكلماتُ
       المقال نُوسّعها هنا كمجموعةٍ من الجذور. فيلتقي «العيال» بـ«الأطفال». */
    const titleRoots = new Set(tokenize(a.title))
    const excerptRoots = new Set(tokenize(a.excerpt || ''))
    const bodyRoots = a.body ? tokenize(a.body) : []
    const bodyCount = new Map<string, number>()
    for (const root of bodyRoots) bodyCount.set(root, (bodyCount.get(root) || 0) + 1)
    let score = 0
    for (const w of q) {
      if (titleRoots.has(w)) score += 4
      if (excerptRoots.has(w)) score += 2
      score += Math.min(6, bodyCount.get(w) || 0)
    }
    return { a, score }
  }).sort((left, right) => right.score - left.score || right.a.iso.localeCompare(left.a.iso))

  const near = scored.slice(0, 4).filter((item) => item.score > 0).map(toTimelineItem)
  const relevant = scored.filter((item) => item.score >= 3).map(toTimelineItem)
  const chronological = [...relevant].sort((left, right) => left.iso.localeCompare(right.iso))
  const timeline = chronological
    .filter((item, index, all) => index === 0 || index === all.length - 1 || index % Math.max(1, Math.ceil(all.length / 4)) === 0)
    .slice(0, 6)
  const earliest = chronological[0]
  const latest = [...relevant].sort((left, right) => right.iso.localeCompare(left.iso))[0]
  const cats = Array.from(new Set(relevant.map((item) => item.cat).filter(Boolean)))
  const tension = cats.length > 1
    ? `هذا السؤال لا يظهر في باب واحد فقط؛ يمرّ بين ${cats.slice(0, 3).map((cat) => `«${cat}»`).join(' و')}، وكأن الفكرة عند الدكتور ليست تقنية أو تربوية وحدها، بل سؤال إنساني يتغير سياقه.`
    : undefined
  const refs = matchRefs(q, books, papers)
  const top = scored.filter((item) => item.score >= 6).slice(0, 2)

  const hits: Hit[] = []
  for (const { a } of top) {
    if (!a.body) continue
    const paras = a.body.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 60)
    let best = ''
    let bestScore = -1
    for (const p of paras) {
      const paragraph = norm(p)
      let score = 0
      for (const w of q) if (paragraph.includes(w)) score += 1 + Math.min(2, (paragraph.split(w).length - 1) - 1)
      if (p.length > 700) score -= 1
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }
    if (bestScore > 0) hits.push({
      slug: a.slug,
      title: a.title,
      iso: a.iso,
      cat: a.cat,
      excerpt: a.excerpt,
      para: compactText(best),
      score: bestScore,
    })
  }

  return { hits, near, refs, timeline, latest, earliest, tension }
}

function localGroundedAnswer(result: Answer): TwinAnswer {
  const citations = result.hits.slice(0, 3).map((hit, index) => ({
    index: index + 1,
    slug: hit.slug,
    title: hit.title,
    quote: hit.para,
    url: `/articles/${hit.slug}`,
  }))
  if (!citations.length) {
    return {
      answer: 'لم أجد في أرشيفي المنشور ما يكفي للإجابة عن هذا السؤال.',
      citations: [],
      grounded: false,
      source: 'local',
    }
  }
  const years = result.hits.slice(0, 3).map((hit) => hit.iso.slice(0, 4))
  const span = years.length > 1 && new Set(years).size > 1
    ? ` ويتكرر الخيط في نصوص منشورة بين ${years[years.length - 1]} و${years[0]}.`
    : ''
  return {
    answer: `أقرب جواب منشور في أرشيفي يظهر في النص${citations.length > 1 ? 'وص' : ''} الموثّق${citations.length > 1 ? 'ة' : ''} أدناه.${span} لا أضيف هنا رأياً جديداً؛ الاقتباسات الحرفية هي حدود الإجابة المتاحة الآن ${citations.map((item) => `[${item.index}]`).join(' ')}.`,
    citations,
    grounded: true,
    source: 'local',
  }
}

const SUGGESTIONS = [
  'هل الذكاء الاصطناعي يهدد المعلم؟',
  'ما أثر الهاتف على الطفل؟',
  'كيف صار الامتحان مصدر خوف؟',
]

const PERSONAS = [
  { id: 'teacher', label: 'معلم', intro: 'كتاب شخصي للمعلم: يبدأ من السؤال، ثم يحوله إلى مسار قابل للنقاش داخل الصف.' },
  { id: 'parent', label: 'ولي أمر', intro: 'كتاب شخصي لولي الأمر: يقرأ الفكرة من أثرها على الطفل والبيت والطمأنينة.' },
  { id: 'student', label: 'طالب باحث', intro: 'كتاب شخصي للطالب: مصادر مرتبة، سؤال بحثي، ومداخل موثقة للاستشهاد.' },
  { id: 'media', label: 'إعلامي', intro: 'كتاب تحضيري للقاء: خلاصة، زوايا سؤال، ومصادر تساعد على حوار عميق.' },
]

function PersonalBook({ asked, result }: { asked: string; result: Answer }) {
  const [persona, setPersona] = useState(PERSONAS[0].id)
  const active = PERSONAS.find((item) => item.id === persona) || PERSONAS[0]
  const chapters = [
    result.earliest && { label: 'الفصل الأول', item: result.earliest, note: 'أول موضع واضح في الأرشيف يلامس السؤال.' },
    ...result.timeline.slice(1, 4).map((item, index) => ({ label: `الفصل ${index + 2}`, item, note: 'محطة لاحقة في تطور الفكرة.' })),
    result.latest && { label: 'أحدث موقف', item: result.latest, note: 'أقرب إجابة منشورة تمثل الموقف الآن.' },
  ].filter(Boolean) as { label: string; item: TimelineItem; note: string }[]

  if (!chapters.length) return null
  return (
    <section className="mt-10 border-t border-hair pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[.76rem] font-medium text-soft">كتاب شخصي من الأرشيف</p>
          <h3 className="mt-1 font-display text-[1.2rem] font-semibold leading-relaxed text-ink">مسار قراءة يتشكل من المواد المنشورة فقط.</h3>
        </div>
        <button type="button" onClick={() => window.print()} className="min-h-11 border-b border-hair px-1 text-[.78rem] text-soft transition-colors hover:border-accent hover:text-accent">
          تجهيز نسخة مطبوعة
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 border-b border-hair" role="tablist" aria-label="طريقة ترتيب المسار">
        {PERSONAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={persona === item.id}
            onClick={() => setPersona(item.id)}
            className={`shrink-0 border-b py-2 text-[.82rem] transition-colors ${persona === item.id ? 'border-ink font-medium text-ink' : 'border-transparent text-soft hover:text-ink'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-5 text-[.86rem] leading-[1.9] text-soft">{active.intro}</p>
      <p className="mt-4 font-display text-[1.05rem] font-semibold leading-relaxed text-ink">«{asked}»</p>
      <ol className="mt-5 grid gap-4">
        {chapters.map(({ label, item, note }) => (
          <li key={`${label}-${item.slug}`} className="border-t border-hair pt-4 first:border-t-0 first:pt-0">
            <span className="text-[.72rem] font-medium text-soft">{label} · {item.iso.slice(0, 4)}</span>
            <Link to={`/articles/${item.slug}`} className="mt-1 block font-display text-[1rem] font-medium leading-relaxed text-ink transition-colors hover:text-accent">
              {item.title}
            </Link>
            <p className="mt-1 text-[.8rem] leading-relaxed text-soft">{note}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function AskLibrary() {
  const { articles, books, papers } = useCmsContent()
  const [searchParams] = useSearchParams()
  const initialQuestion = (searchParams.get('q') || '').trim()
  useSeo({
    title: 'العقل الحي',
    path: '/ask',
    description: 'اسأل سؤالاً حقيقياً، فيبني الموقع إجابة موثقة من أرشيف د. أحمد حسين الفيلكاوي فقط: مقالات، تطور زمني، ومصادر.',
  })
  const [q, setQ] = useState(initialQuestion)
  const [asked, setAsked] = useState(initialQuestion.length >= 4 ? initialQuestion : '')
  const [bodies, setBodies] = useState<Record<string, string> | null>(null)
  const [bodiesLoading, setBodiesLoading] = useState(false)
  const resRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const result = useMemo(() => (asked && bodies ? answer(asked, bodies, articles, books, papers) : null), [asked, articles, bodies, books, papers])
  const [twin, setTwin] = useState<TwinAnswer | null>(null)
  const [twinLoading, setTwinLoading] = useState(false)

  useEffect(() => {
    let active = true
    if (!asked || bodies) return () => { active = false }
    setBodiesLoading(true)
    loadArticleBodies()
      .then((map) => { if (active) setBodies(map) })
      .finally(() => { if (active) setBodiesLoading(false) })
    return () => { active = false }
  }, [asked, bodies])

  useEffect(() => {
    const controller = new AbortController()
    if (!asked || !result?.hits.length) {
      setTwin(null)
      setTwinLoading(false)
      return () => controller.abort()
    }

    const fallback = localGroundedAnswer(result)
    setTwin(null)
    setTwinLoading(true)
    void fetch('/api/ai/archive-answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        question: asked,
        evidence: result.hits.slice(0, 8).map((hit) => ({
          slug: hit.slug,
          title: hit.title,
          year: hit.iso.slice(0, 4),
          quote: hit.para,
          url: `/articles/${hit.slug}`,
        })),
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`archive-answer:${response.status}`)
      const payload = await response.json() as Partial<TwinAnswer>
      const citations = Array.isArray(payload.citations)
        ? payload.citations.filter((item): item is TwinCitation => Boolean(item && Number.isInteger(Number(item.index)) && typeof item.slug === 'string' && typeof item.title === 'string'))
        : []
      if (typeof payload.answer !== 'string' || !payload.answer.trim() || payload.grounded !== true || !citations.length) {
        setTwin(fallback)
        return
      }
      setTwin({ answer: payload.answer.trim(), citations, grounded: true, source: 'ai' })
    }).catch((error) => {
      if ((error as Error)?.name !== 'AbortError') setTwin(fallback)
    }).finally(() => {
      if (!controller.signal.aborted) setTwinLoading(false)
    })

    return () => controller.abort()
  }, [asked, result])

  const again = () => {
    setAsked('')
    setQ('')
    setTwin(null)
    setTimeout(() => inputRef.current?.focus(), 60)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length < 4) return
    setQ(trimmed)
    setAsked(trimmed)
    setTimeout(() => resRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  return (
    <Page className="content-thought-paths page-journey">
      <PageHead
        label="العقل الحي"
        title="اسأل الأرشيف سؤالاً حقيقياً."
        sub="محادثة موثّقة مع الأرشيف: يركّب الجواب من مقالاتي وأبحاثي وكتبي فقط، ويعيدك إلى النص الحرفي الذي استند إليه. إن لم يجد دليلاً يقول ذلك بوضوح."
      />

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-3xl">
          <FadeUp>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask(q)}
                placeholder="هل سيستبدل الذكاء الاصطناعي المعلم؟"
                aria-label="سؤالك"
                className="min-h-12 flex-1 rounded-xl border border-hair bg-canvas px-5 py-3 text-[1rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
              />
              <button
                onClick={() => ask(q)}
                className="min-h-12 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-colors hover:bg-accent-deep"
              >
                اسأل
              </button>
            </div>
          </FadeUp>

          {!asked && (
            <FadeUp delay={0.08}>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-b border-hair pb-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="shrink-0 border-b border-transparent py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-ink">
                    {s}
                  </button>
                ))}
              </div>
            </FadeUp>
          )}

          <div ref={resRef} className="scroll-mt-28">
            {asked && bodiesLoading && (
              <FadeUp>
                <p className="mt-12 border-t border-hair pt-6 text-center text-soft" aria-live="polite">
                  أرتّب مواد الأرشيف الأقرب إلى السؤال…
                </p>
              </FadeUp>
            )}
            {result && (
              <div className="mt-12">
                {result.hits.length > 0 ? (
                  <>
                    <FadeUp>
                      <section className="border-y border-hair py-7 md:py-9" aria-live="polite">
                        <p className="text-[.75rem] font-medium text-soft">الجواب</p>
                        <h2 className="mt-2 font-display text-[1.16rem] font-semibold leading-relaxed text-ink">خلاصة مرتبطة بمصادرها، لا رأي من خارج الأرشيف.</h2>
                        {twinLoading && !twin ? (
                          <p className="mt-5 animate-pulse text-[.88rem] leading-[1.95] text-soft">أرتّب الشواهد الأقرب إلى سؤالك…</p>
                        ) : twin ? (
                          <>
                            <p className="mt-5 whitespace-pre-line text-[.96rem] font-light leading-[2.05] text-ink/90">{twin.answer}</p>
                            <p className="mt-4 text-[.68rem] leading-relaxed text-soft">{twin.source === 'ai' ? 'الخلاصة محصورة في الشواهد الظاهرة أدناه.' : 'عُرض بديل محلي محافظ لا يتجاوز الشواهد.'}</p>
                          </>
                        ) : null}
                      </section>
                    </FadeUp>

                    <section className="mt-9" aria-labelledby="archive-sources-title">
                      <p id="archive-sources-title" className="text-[.8rem] font-medium text-soft">المصادر والشواهد</p>
                      {twin?.citations.length ? (
                        <ol className="mt-4 grid gap-3 border-b border-hair pb-6">
                          {twin.citations.map((citation) => (
                            <li key={`${citation.index}-${citation.slug}`}>
                              <Link to={`/articles/${citation.slug}`} className="group flex gap-3 text-[.82rem] text-soft transition-colors hover:text-accent">
                                <span className="shrink-0">[{citation.index}]</span>
                                <span className="font-medium text-ink transition-colors group-hover:text-accent">{citation.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      <div className="mt-7 space-y-8">
                        {result.hits.map((h) => (
                          <FadeUp key={h.slug}>
                            <figure className="border-r border-hair pr-5">
                              <blockquote className="font-display text-[1.06rem] font-light leading-[2] text-ink">«{h.para}»</blockquote>
                              <figcaption className="mt-3 text-[.82rem] text-soft">
                                <Link to={`/articles/${h.slug}`} className="transition-colors hover:text-accent">{h.title} — {h.iso.slice(0, 4)}</Link>
                              </figcaption>
                            </figure>
                          </FadeUp>
                        ))}
                      </div>

                      {result.refs.length > 0 && (
                        <div className="mt-9 border-t border-hair pt-6">
                          <p className="text-[.8rem] text-soft">كتب وأبحاث مرتبطة</p>
                          <ul className="mt-3 space-y-3">
                            {result.refs.map((r) => (
                              <li key={r.slug} className="flex gap-3">
                                <span className="w-20 shrink-0 text-[.72rem] text-soft">{r.kind}</span>
                                <Link to={r.href} className="text-[.92rem] text-ink transition-colors hover:text-accent">{r.title}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>

                    <FadeUp>
                      <details className="group mt-10 border-t border-hair pt-6">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[.86rem] font-medium text-ink marker:hidden">
                          <span>امتدادات الإجابة</span>
                          <span aria-hidden className="text-soft transition-transform group-open:rotate-45">＋</span>
                        </summary>
                        <div className="pb-2 pt-4">
                          {result.timeline.length > 1 && (
                            <section>
                              <p className="text-[.78rem] font-medium text-soft">تطور السؤال عبر الأرشيف</p>
                              <ol className="mt-5 grid gap-5 border-r border-hair pr-5">
                                {result.timeline.map((item) => (
                                  <li key={item.slug} className="relative">
                                    <span className="absolute right-[-25px] top-2 h-2 w-2 rounded-full bg-accent" />
                                    <span className="text-[.74rem] text-soft">{item.iso.slice(0, 4)} · {item.cat}</span>
                                    <Link to={`/articles/${item.slug}`} className="mt-1 block font-display text-[1rem] font-medium leading-relaxed text-ink transition-colors hover:text-accent">{item.title}</Link>
                                    {item.excerpt && <p className="mt-1 text-[.84rem] leading-relaxed text-soft">{item.excerpt}</p>}
                                  </li>
                                ))}
                              </ol>
                            </section>
                          )}

                          {(result.latest || result.tension) && (
                            <section className="mt-10 border-t border-hair pt-7">
                              <p className="text-[.76rem] font-medium text-soft">أحدث إجابة منشورة</p>
                              {result.latest && (
                                <Link to={`/articles/${result.latest.slug}`} className="mt-2 block font-display text-[1.1rem] font-semibold leading-relaxed text-ink transition-colors hover:text-accent">
                                  {result.latest.title} <span className="text-[.82rem] font-normal text-soft">({result.latest.iso.slice(0, 4)})</span>
                                </Link>
                              )}
                              {result.tension && <p className="mt-3 text-[.88rem] font-light leading-[1.9] text-soft">{result.tension}</p>}
                            </section>
                          )}

                          <PersonalBook asked={asked} result={result} />
                        </div>
                      </details>
                    </FadeUp>
                  </>                ) : (
                  <FadeUp>
                    <div className="border-y border-hair py-8 md:py-10">
                      <p className="font-display text-[clamp(1.2rem,2.6vw,1.6rem)] font-semibold leading-[1.7] text-ink">
                        لم أكتب في هذا بعد — ربما يكون سؤالَ مقالٍ قادم.
                      </p>
                      {result.near.length > 0 && (
                        <div className="mt-6 border-t border-hair pt-5">
                          <p className="text-[.82rem] text-soft">الأقرب إليه في مكتبتي:</p>
                          <ul className="mt-3 space-y-2">
                            {result.near.map((n) => (
                              <li key={n.slug}>
                                <Link to={`/articles/${n.slug}`} className="group text-[.95rem] text-ink transition-colors hover:text-accent">
                                  {n.title} <span className="text-[.8rem] text-soft">({n.iso.slice(0, 4)})</span>
                                  <span className="inline-block text-accent transition-transform duration-300 group-hover:-translate-x-1"> ←</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </FadeUp>
                )}
              </div>
            )}
            {result && (
              <div className="mt-10 text-center">
                <button onClick={again} className="min-h-11 border-b border-hair px-1 text-[.86rem] font-medium text-soft transition-colors hover:border-accent hover:text-accent">
                  اسأل سؤالاً آخر ↺
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </Page>
  )
}
