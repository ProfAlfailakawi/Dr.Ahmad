/**
 * «العقل الحي» — /ask
 * يسأل الزائر سؤالاً حقيقياً، فيعيد الموقع ترتيب أرشيف الدكتور فقط:
 * اقتباسات حرفية، خط زمني، أحدث موقف منشور، وكتاب شخصي خفيف.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { articles, books, papers } from '../data'
import { useSeo } from '../components/seo'
import { loadArticleBodies } from '../lib/article-bodies'

const norm = (s: string) => s
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^\w؀-ۿ ]/g, ' ')
  .toLowerCase()

const STOP = new Set(['على','الى','من','في','عن','مع','هذا','هذه','ذلك','التي','الذي','بين','بعد','قبل','عند','حتي','كان','كانت','هل','ما','لا','لم','لن','قد','ثم','او','ام','بل','كل','بعض','غير','نحو','لدي','منذ','حين','حول','ان','لان','كيف','اين','ليس','وهو','وهي','راي','رايك','الدكتور','دكتور','احمد','الفيلكاوي','برايك','شنو','ماذا','لماذا'])
const tokenize = (s: string) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))

type Hit = { slug: string; title: string; iso: string; cat?: string; excerpt?: string; para: string; score: number }
type TimelineItem = { slug: string; title: string; iso: string; cat?: string; excerpt?: string; score: number }
type Ref = { kind: 'كتاب' | 'بحث محكّم'; slug: string; title: string; href: string }
type AskArticle = (typeof articles)[number] & { body?: string }
type Answer = {
  hits: Hit[]
  near: TimelineItem[]
  refs: Ref[]
  timeline: TimelineItem[]
  latest?: TimelineItem
  earliest?: TimelineItem
  tension?: string
}

function matchRefs(qTokens: string[]): Ref[] {
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

function answer(question: string, bodies: Record<string, string>): Answer {
  const q = tokenize(question)
  if (!q.length) return { hits: [], near: [], refs: [], timeline: [] }

  const scored = articles.map((article) => {
    const a: AskArticle = { ...article, body: bodies[article.slug] || undefined }
    const title = norm(a.title)
    const excerpt = norm(a.excerpt || '')
    const body = a.body ? norm(a.body) : ''
    let score = 0
    for (const w of q) {
      if (title.includes(w)) score += 4
      if (excerpt.includes(w)) score += 2
      if (body) {
        let index = 0
        let count = 0
        while (count < 6 && (index = body.indexOf(w, index)) !== -1) {
          count++
          index += w.length
        }
        score += count
      }
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
  const refs = matchRefs(q)
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
    <FadeUp>
      <section className="mt-10 rounded-2xl border border-hair bg-wash p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[.76rem] font-semibold text-accent">الكتاب الذي يكتب نفسه</p>
            <h2 className="mt-1 font-display text-[1.35rem] font-semibold leading-relaxed text-ink">كتاب شخصي من الأرشيف، لا من الخيال.</h2>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent"
          >
            تجهيز PDF
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {PERSONAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPersona(item.id)}
              className={`rounded-full px-4 py-1.5 text-[.82rem] transition-colors ${persona === item.id ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-hair bg-canvas p-5">
          <p className="text-[.86rem] leading-relaxed text-soft">{active.intro}</p>
          <p className="mt-4 font-display text-[1.1rem] font-semibold leading-relaxed text-ink">«{asked}»</p>
          <ol className="mt-5 grid gap-3">
            {chapters.map(({ label, item, note }) => (
              <li key={`${label}-${item.slug}`} className="border-t border-hair pt-3 first:border-t-0 first:pt-0">
                <span className="text-[.72rem] font-semibold text-accent">{label} · {item.iso.slice(0, 4)}</span>
                <Link to={`/articles/${item.slug}`} className="mt-1 block font-display text-[1rem] font-medium leading-relaxed text-ink transition-colors hover:text-accent">
                  {item.title}
                </Link>
                <p className="mt-1 text-[.8rem] leading-relaxed text-soft">{note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </FadeUp>
  )
}

export default function AskLibrary() {
  useSeo({
    title: 'العقل الحي',
    path: '/ask',
    description: 'اسأل سؤالاً حقيقياً، فيبني الموقع إجابة موثقة من أرشيف د. أحمد حسين الفيلكاوي فقط: مقالات، تطور زمني، ومصادر.',
  })
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const [bodies, setBodies] = useState<Record<string, string> | null>(null)
  const [bodiesLoading, setBodiesLoading] = useState(false)
  const resRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const result = useMemo(() => (asked && bodies ? answer(asked, bodies) : null), [asked, bodies])

  useEffect(() => {
    let active = true
    if (!asked || bodies) return () => { active = false }
    setBodiesLoading(true)
    loadArticleBodies()
      .then((map) => { if (active) setBodies(map) })
      .finally(() => { if (active) setBodiesLoading(false) })
    return () => { active = false }
  }, [asked, bodies])

  const again = () => {
    setAsked('')
    setQ('')
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
    <Page>
      <PageHead
        label="العقل الحي"
        title="اسأل الأرشيف سؤالاً حقيقياً."
        sub="لا يتقمص الموقع رأيي ولا يخترع جواباً باسمي. يعيد بناء المسار من مقالاتي وأبحاثي وكتبي فقط: ماذا كتبت، متى بدأ الخيط، وأين يقف أحدث نص منشور."
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
                className="flex-1 rounded-full border border-hair bg-canvas px-6 py-3.5 text-[1rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
              />
              <button
                onClick={() => ask(q)}
                className="rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
              >
                اسأل
              </button>
            </div>
          </FadeUp>

          {!asked && (
            <FadeUp delay={0.08}>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="text-[.8rem] text-soft">جرّب:</span>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-hair px-4 py-1.5 text-[.83rem] text-soft transition-colors hover:border-accent hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            </FadeUp>
          )}

          <div ref={resRef} className="scroll-mt-28">
            {asked && bodiesLoading && (
              <FadeUp>
                <div className="mt-12 rounded-2xl border border-hair bg-wash p-8 text-center text-soft">
                  أفتح الأرشيف الكامل… لحظة واحدة.
                </div>
              </FadeUp>
            )}
            {result && (
              <div className="mt-12">
                {result.hits.length > 0 ? (
                  <>
                    <p className="text-[.8rem] font-semibold text-accent">إجابة موثقة — بكلماتي حرفياً</p>
                    <div className="mt-5 space-y-8">
                      {result.hits.map((h) => (
                        <FadeUp key={h.slug}>
                          <figure className="border-r-2 border-accent pr-5">
                            <blockquote className="font-display text-[1.08rem] font-light leading-[2] text-ink">«{h.para}»</blockquote>
                            <figcaption className="mt-3">
                              <Link to={`/articles/${h.slug}`} className="group inline-flex items-baseline gap-2 text-[.88rem] text-soft transition-colors hover:text-accent">
                                <span>من مقال: <span className="font-medium">{h.title}</span> — {h.iso.slice(0, 4)}</span>
                                <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">←</span>
                              </Link>
                            </figcaption>
                          </figure>
                        </FadeUp>
                      ))}
                    </div>

                    {result.timeline.length > 1 && (
                      <FadeUp>
                        <section className="mt-10 border-t border-hair pt-7">
                          <p className="text-[.8rem] font-semibold text-accent">كيف تحرك السؤال عبر الأرشيف؟</p>
                          <ol className="mt-5 grid gap-4">
                            {result.timeline.map((item) => (
                              <li key={item.slug} className="relative border-r border-hair pr-5">
                                <span className="absolute right-[-5px] top-2 h-2.5 w-2.5 rounded-full bg-accent" />
                                <span className="text-[.74rem] font-semibold text-accent">{item.iso.slice(0, 4)} · {item.cat}</span>
                                <Link to={`/articles/${item.slug}`} className="mt-1 block font-display text-[1.02rem] font-medium leading-relaxed text-ink transition-colors hover:text-accent">
                                  {item.title}
                                </Link>
                                {item.excerpt && <p className="mt-1 text-[.84rem] leading-relaxed text-soft">{item.excerpt}</p>}
                              </li>
                            ))}
                          </ol>
                        </section>
                      </FadeUp>
                    )}

                    {(result.latest || result.tension) && (
                      <FadeUp>
                        <section className="mt-9 rounded-2xl border border-hair bg-wash p-6">
                          <p className="text-[.76rem] font-semibold text-accent">أحدث إجابة منشورة الآن</p>
                          {result.latest && (
                            <Link to={`/articles/${result.latest.slug}`} className="mt-2 block font-display text-[1.15rem] font-semibold leading-relaxed text-ink transition-colors hover:text-accent">
                              {result.latest.title} <span className="text-[.85rem] text-soft">({result.latest.iso.slice(0, 4)})</span>
                            </Link>
                          )}
                          {result.tension && <p className="mt-3 text-[.88rem] font-light leading-relaxed text-soft">{result.tension}</p>}
                        </section>
                      </FadeUp>
                    )}

                    {result.refs.length > 0 && (
                      <div className="mt-8 border-t border-hair pt-5">
                        <p className="text-[.8rem] text-soft">ومن أعمالي الموثّقة في هذا:</p>
                        <ul className="mt-2.5 space-y-1.5">
                          {result.refs.map((r) => (
                            <li key={r.slug}>
                              <Link to={r.href} className="group text-[.92rem] text-ink transition-colors hover:text-accent">
                                <span className="me-2 rounded-full border border-hair px-2 py-0.5 text-[.7rem] text-soft">{r.kind}</span>
                                {r.title}
                                <span className="inline-block text-accent transition-transform duration-300 group-hover:-translate-x-1"> ←</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="mt-10 border-t border-hair pt-5 text-[.8rem] font-light leading-[1.9] text-soft">
                      كل فقرة مرتبطة بمصدر حقيقي. التحليل هنا ترتيبٌ للأرشيف لا اختراعٌ لرأي جديد.
                    </p>
                    <PersonalBook asked={asked} result={result} />
                  </>
                ) : (
                  <FadeUp>
                    <div className="rounded-2xl border border-hair bg-wash p-8 md:p-10">
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
                <button onClick={again} className="rounded-full border border-hair px-6 py-2.5 text-[.9rem] font-medium text-soft transition-colors hover:border-accent hover:text-accent">
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
