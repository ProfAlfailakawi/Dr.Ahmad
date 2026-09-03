import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSeo } from '../components/seo'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent, useExtras } from '../lib/content'
import type { ArticleRecord } from '../lib/cms'
import { toRoot } from '../lib/dialect-lexicon'
import { loadArticleBodies } from '../lib/article-bodies'
import { predictionRecordsFor, type IdeaLifeRemoteRecord } from '../lib/idea-life'

const number = new Intl.NumberFormat('ar-KW-u-nu-latn')

type YearChapter = {
  year: number
  articles: ArticleRecord[]
  dominant: string
  representative?: ArticleRecord
}

function dominantCategory(items: ArticleRecord[]) {
  const counts = new Map<string, number>()
  items.forEach((article) => counts.set(article.cat, (counts.get(article.cat) || 0) + 1))
  return Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))[0]?.[0] || ''
}

function representative(items: ArticleRecord[], dominant = dominantCategory(items)) {
  return [...items].sort((left, right) => {
    const score = (article: ArticleRecord) =>
      (article.cat === dominant ? 80 : 0)
      + (article.body ? 20 : 0)
      + (article.source ? 8 : 0)
      + Math.min(article.words, 2400) / 120
    return score(right) - score(left) || right.iso.localeCompare(left.iso)
  })[0]
}

function chapterRange(chapters: YearChapter[]) {
  if (!chapters.length) return ''
  return chapters.length === 1
    ? String(chapters[0].year)
    : `${chapters[0].year}–${chapters[chapters.length - 1].year}`
}

/* العنوان يتبع ما يُعرض فعلاً. كتابة «ثلاثة فصول» فوق بطاقتين كذبٌ صغير،
   والصغير منه يُفقد الثقة في الكبير. */
function chapterCountWord(count: number) {
  return count === 1 ? 'فصلٌ واحد' : count === 2 ? 'فصلان' : `${['', '', '', 'ثلاثة'][count] || count} فصول`
}

/* رحلة فكرةٍ بعينها عبر السنوات: يكتب القارئ «الامتحان» أو «العيال» فيرى متى
   بدأ الدكتور يكتب فيها، وكيف تنقّلت بين أبوابه، وأين استقرّت. والتصفية تمرّ
   بالقاموس الجبّار فيلتقي سؤال العاميّة بمقال الفصحى. */
function matchesIdea(article: ArticleRecord, roots: string[], bodies: Record<string, string>): boolean {
  if (!roots.length) return true
  const haystack = `${article.title} ${article.excerpt || ''} ${article.cat} ${bodies[article.slug] || ''}`
  const words = new Set(
    haystack.split(/[\s.,،؛:!؟()«»"'…]+/).filter((w) => w.length > 2).map(toRoot),
  )
  return roots.some((root) => words.has(root))
}

export default function Decade() {
  const { articles, loading } = useCmsContent()
  const [params, setParams] = useSearchParams()
  const idea = (params.get('فكرة') || params.get('idea') || '').trim()
  const exactArticleSlug = (params.get('مقال') || '').trim()
  const mode = params.get('عرض') === 'تنبؤات' ? 'predictions' : 'journey'
  const [draft, setDraft] = useState(idea)
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [bodiesReady, setBodiesReady] = useState(false)
  /* مشاركة بطاقة توقع (مقترح معتمد): رابط يفتح السجل على التوقع نفسه */
  const [copiedPrediction, setCopiedPrediction] = useState('')
  const sharePrediction = (slug: string, key: string) => {
    const query = new URLSearchParams({ 'عرض': 'تنبؤات', 'مقال': slug })
    const url = `${window.location.origin}/decade?${query.toString()}`
    const done = () => { setCopiedPrediction(key); window.setTimeout(() => setCopiedPrediction(''), 2400) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(done)
    else done()
  }
  const remoteIdeaLife = useExtras<IdeaLifeRemoteRecord>('site_idea_life')

  const updateQuery = (nextIdea = idea, nextMode: 'journey' | 'predictions' = mode, nextArticleSlug = exactArticleSlug) => {
    const next: Record<string, string> = {}
    if (nextIdea.trim()) next['فكرة'] = nextIdea.trim()
    if (nextMode === 'predictions') next['عرض'] = 'تنبؤات'
    if (nextArticleSlug.trim()) next['مقال'] = nextArticleSlug.trim()
    setParams(next)
  }

  useEffect(() => { setDraft(idea) }, [idea])
  /* المتون تُجلب عند الحاجة وحدها: الرحلة بلا فكرةٍ لا تحتاجها، ومع فكرةٍ
     تصير ضرورية — فالعنوان وحده لا يكفي للحكم بأن المقال يخصّها. */
  useEffect(() => {
    const needsBodies = Boolean(idea) || mode === 'predictions'
    if (!needsBodies || bodiesReady) return
    let alive = true
    void loadArticleBodies()
      .then((data) => { if (alive) setBodies(data || {}) })
      .catch(() => {})
      .finally(() => { if (alive) setBodiesReady(true) })
    return () => { alive = false }
  }, [idea, mode, bodiesReady])

  useSeo({
    title: mode === 'predictions' ? (idea ? `تنبؤات حول: ${idea}` : 'التنبؤات والمراجعات') : (idea ? `رحلة فكرة: ${idea}` : 'وثيقة العقد'),
    path: '/decade',
    description: mode === 'predictions'
      ? 'سجل آلي يلتقط التوقعات من النصوص الأصلية، ويحفظها في سياقها، ويراجع اتجاهها وتوقيتها وحجمها ونطاقها عند ظهور أدلة لاحقة.'
      : idea
        ? `كيف تنقّلت فكرة «${idea}» في كتابات د. أحمد الفيلكاوي عبر السنوات — بالنصوص والتواريخ.`
        : 'سيرة فكرية حيّة تُعيد قراءة عشر سنوات من المقالات: التحولات، والموضوعات الأكثر حضوراً، والنصوص الممثلة لكل مرحلة.',
  })

  const document = useMemo(() => {
    const roots = idea.split(/\s+/).filter((w) => w.length > 2).map(toRoot)
    const dated = articles
      .filter((article) => /^(?:19|20)\d{2}/.test(article.iso))
      .filter((article) => !exactArticleSlug || article.slug === exactArticleSlug)
      .filter((article) => matchesIdea(article, roots, bodies))
    if (!dated.length) return null

    // النطاق الكامل من أول مقال فعلي إلى آخره — يتجدّد تلقائياً مع أي إضافة (لا يبدأ من latestYear-9)
    const allYears = dated.map((article) => Number(article.iso.slice(0, 4)))
    const latestYear = Math.max(...allYears)
    const firstYear = Math.min(...allYears)
    const span = latestYear - firstYear + 1
    const decadeArticles = dated
    const chapters: YearChapter[] = Array.from({ length: span }, (_, offset) => {
      const year = firstYear + offset
      const yearArticles = decadeArticles.filter((article) => Number(article.iso.slice(0, 4)) === year)
      const dominant = dominantCategory(yearArticles)
      return { year, articles: yearArticles, dominant, representative: representative(yearArticles, dominant) }
    })

    const categoryCounts = Array.from(decadeArticles.reduce((map, article) => {
      map.set(article.cat, (map.get(article.cat) || 0) + 1)
      return map
    }, new Map<string, number>())).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))

    const slices = [chapters.slice(0, 3), chapters.slice(3, 6), chapters.slice(6)]
    /* الفصل الفارغ لا يُعرض أصلاً: بطاقةٌ تقول «لا توجد مادة» ليست معلومة،
       بل فراغٌ يحمل تاريخاً. نُسقطها كاملةً — ويتمدّد الباقي مكانها. */
    const stages = slices.map((stage, index) => {
      const stageArticles = stage.flatMap((chapter) => chapter.articles)
      const dominant = dominantCategory(stageArticles)
      return {
        label: `الفصل ${['الأول', 'الثاني', 'الثالث'][index]}`,
        range: chapterRange(stage),
        count: stageArticles.length,
        dominant,
        article: representative(stageArticles, dominant),
      }
    }).filter((stage) => stage.count > 0)

    const growth = chapters.slice(1).map((chapter, index) => ({
      chapter,
      previous: chapters[index],
      delta: chapter.articles.length - chapters[index].articles.length,
    })).sort((a, b) => b.delta - a.delta)[0]

    const themeShifts = chapters.slice(1).map((chapter, index) => ({ chapter, previous: chapters[index] }))
      .filter(({ chapter, previous }) => chapter.dominant && previous.dominant && chapter.dominant !== previous.dominant)
    const themeShift = themeShifts[themeShifts.length - 1]

    const firstActive = chapters.find((chapter) => chapter.articles.length > 0)
    const turns = [
      firstActive && {
        year: firstActive.year,
        title: 'بداية نافذة العقد',
        description: `يظهر في الأرشيف ${number.format(firstActive.articles.length)} ${firstActive.articles.length === 1 ? 'نص' : 'نصوص'}، وكان «${firstActive.dominant}» الموضوع الأكثر حضوراً.`,
      },
      growth && growth.delta > 0 && {
        year: growth.chapter.year,
        title: 'اتساع في الإنتاج',
        description: `ارتفع عدد المقالات من ${number.format(growth.previous.articles.length)} إلى ${number.format(growth.chapter.articles.length)} مقارنةً بالعام السابق.`,
      },
      themeShift && {
        year: themeShift.chapter.year,
        title: 'تحوّل في مركز الاهتمام',
        description: `تغيّر الموضوع الأكثر حضوراً في الأرشيف السنوي من «${themeShift.previous.dominant}» إلى «${themeShift.chapter.dominant}».`,
      },
    ].filter(Boolean) as { year: number; title: string; description: string }[]

    return {
      firstYear,
      latestYear,
      span,
      articles: decadeArticles,
      chapters,
      categories: categoryCounts,
      stages,
      turns,
    }
  }, [articles, idea, bodies, exactArticleSlug])

  const predictionRegister = useMemo(() => {
    // السجل يُحسب في وضع التنبؤات وحده: حسابه الزوجي الثقيل كان يجمّد
    // دخول «وثيقة العقد» أربع ثوانٍ رغم أن وضع الرحلة لا يعرضه أصلاً.
    if (mode !== 'predictions') return []
    const roots = idea.split(/\s+/).filter((word) => word.length > 2).map(toRoot)
    return articles
      .filter((article) => /^(?:19|20)\d{2}/.test(article.iso))
      .filter((article) => !exactArticleSlug || article.slug === exactArticleSlug)
      .filter((article) => matchesIdea(article, roots, bodies))
      .flatMap((article) => {
        const complete = { ...article, body: article.body || bodies[article.slug] }
        const remote = remoteIdeaLife.find((item) => item.slug === article.slug && (!item.kind || item.kind === 'article'))
        return predictionRecordsFor(complete, articles, remote).map((prediction) => ({ article: complete, prediction }))
      })
      .sort((left, right) => right.article.iso.localeCompare(left.article.iso))
  }, [articles, bodies, idea, remoteIdeaLife, exactArticleSlug, mode])

  return (
    <Page className="content-decade page-journey">
      <PageHead
        label={mode === 'predictions' ? 'الزمن يراجع النص' : (idea ? 'رحلة فكرة' : 'السيرة الفكرية الحيّة')}
        title={mode === 'predictions' ? 'التنبؤات والمراجعات.' : (idea ? `«${idea}» عبر السنوات.` : 'وثيقة العقد.')}
        sub={mode === 'predictions'
          ? 'ما الذي وضعته الكتابة أمام المستقبل؟ سجلٌ يستخرج العبارة من أصلها، ثم يراجع الاتجاه والتوقيت والحجم والنطاق من دون تحويل القضايا المعقدة إلى صح أو خطأ.'
          : idea
            ? 'متى بدأتْ هذه الفكرة تُلحّ، وكيف تنقّلت بين أبوابه، وأين استقرّت — بالنصوص والتواريخ لا بالانطباع.'
            : 'ليست سيرة وظائف ومناصب؛ بل قراءة تتولّد من الأرشيف نفسه: أين بدأ السؤال، ومتى اتسع، وما الذي بقي يُلحّ عاماً بعد عام.'}
      />

      <nav className="border-b border-hair px-6 md:px-11" aria-label="أوضاع وثيقة العقد">
        <div className="mx-auto flex max-w-shell gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: 'journey' as const, label: 'رحلة الكتابة' },
            { key: 'predictions' as const, label: 'التنبؤات والمراجعات' },
          ].map((item) => (
            <button key={item.key} type="button" onClick={() => updateQuery(idea, item.key)} className={`relative shrink-0 py-4 text-[.8rem] font-semibold transition-colors ${mode === item.key ? 'text-ink' : 'text-soft hover:text-accent'}`}>
              {item.label}
              {mode === item.key && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </nav>

      {/* حقل الفكرة: يكتب القارئ «الامتحان» أو «العيال» فيرى رحلتها وحدها.
          والاقتراحات مأخوذةٌ من أكثر ما كتب فيه الدكتور، فلا يبدأ من فراغ. */}
      <section className="border-b border-hair px-6 py-8 md:px-11">
        <div className="mx-auto max-w-shell">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const value = draft.trim()
              updateQuery(value, mode, '')
            }}
            className="flex flex-wrap items-center gap-3"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={mode === 'predictions' ? 'صفِّ التنبؤات بفكرة — الشهادة، الذكاء الاصطناعي…' : 'اكتب فكرةً — الامتحان، الهوية، الذكاء الاصطناعي…'}
              className="min-w-[16rem] flex-1 rounded-full border border-hair bg-canvas px-5 py-2.5 text-[.88rem] text-ink outline-none focus:border-accent"
            />
            <button type="submit" className="rounded-full bg-accent px-6 py-2.5 text-[.85rem] font-semibold text-white transition-opacity hover:opacity-90">
              {mode === 'predictions' ? 'صفِّ السجل' : 'تتبّع الرحلة'}
            </button>
            {idea && (
              <button type="button" onClick={() => { setDraft(''); updateQuery('', mode, '') }} className="text-[.82rem] text-soft transition-colors hover:text-accent">
                العقد كاملاً ↺
              </button>
            )}
          </form>
          {exactArticleSlug && idea && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[.74rem] leading-relaxed text-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              فُتح السجل من مقال «{idea}»؛ العنوان مكتوب والنتيجة مصفّاة وجاهزة للقارئ.
            </p>
          )}
          {!idea && (
            <div className="mt-3 flex flex-wrap gap-2">
              {['الامتحان', 'الهوية', 'الذكاء الاصطناعي', 'الأطفال', 'المعلم', 'الشهادة'].map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => { setDraft(seed); updateQuery(seed, mode, '') }}
                  className="rounded-full border border-hair bg-wash px-4 py-1.5 text-[.78rem] text-soft transition-colors hover:border-accent hover:text-accent"
                >
                  {seed}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {mode === 'predictions' ? (
        (loading || !bodiesReady) && !predictionRegister.length ? (
          <div className="px-6 py-24 text-center text-soft">يُقرأ ما وضعته النصوص أمام الزمن…</div>
        ) : predictionRegister.length === 0 ? (
          <div className="px-6 py-24 text-center text-soft">لم يُرصد في هذا النطاق توقعٌ صريح يستحق فتح سجلٍ له.</div>
        ) : (
          <section className="px-6 py-14 md:px-11 md:py-20">
            <div className="mx-auto max-w-3xl">
              <FadeUp>
                <div className="flex flex-wrap items-end justify-between gap-5 border-b border-hair pb-7">
                  <div>
                    <span className="text-[.75rem] font-semibold text-accent">سجل حيّ يتجدد تلقائياً</span>
                    <h2 className="mt-2 font-display text-[clamp(1.6rem,3.6vw,2.45rem)] font-bold leading-[1.35] text-ink">{number.format(predictionRegister.length)} توقعاً تحت المراجعة.</h2>
                  </div>
                  <p className="max-w-[22rem] text-[.78rem] font-light leading-[1.8] text-soft">العبارة محفوظة من النص الأصلي. لا تتغير حالتها إلا عندما تظهر إشارة لاحقة أو دليل عام يمكن الرجوع إليه.</p>
                </div>
              </FadeUp>
              <FadeUp>
                {/* منهجية التقييم بكلمات لا أرقام — مقترح معتمد */}
                <div className="mt-6 rounded-2xl border border-hair bg-wash/40 px-5 py-4">
                  <p className="text-[.72rem] font-semibold text-accent">كيف يُقرأ هذا السجل؟</p>
                  <p className="mt-2 text-[.78rem] font-light leading-[1.9] text-soft">
                    يُلتقط التوقع بصيغته الحرفية من النص المنشور بتاريخه، ثم يُراجع على أربعة أبعاد: الاتجاه والتوقيت والحجم والنطاق.
                    والحكم كلماتٌ واضحة لا نِسب: «ظهرت إشارة لاحقة» حين تصل كتابةٌ أحدث تفتح الاتجاه نفسه، و«تحتاج زمناً أطول» لما لم تمضِ عليه سنتان،
                    و«قيد المتابعة» لما ينتظر دليلاً عاماً يُحال إليه. لا يتحول توقعٌ إلى «متحقق» بغير مصدرٍ يمكن الرجوع إليه.
                  </p>
                </div>
              </FadeUp>

              <div className="mt-3 divide-y divide-hair border-b border-hair">
                {predictionRegister.map(({ article, prediction }, index) => (
                  <FadeUp key={`${article.slug}:${prediction.quote}`} delay={Math.min(index * .025, .18)}>
                    <details open={Boolean(exactArticleSlug) && index === 0} className="group py-6">
                      <summary className="cursor-pointer list-none marker:hidden">
                        <div className="flex items-start justify-between gap-5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[.68rem] font-semibold text-accent">
                              <time>{article.iso.slice(0, 4)}</time><span className="text-hair">·</span><span>{prediction.status}</span>
                            </div>
                            <blockquote className="mt-2 font-display text-[1.03rem] font-medium leading-[1.85] text-ink md:text-[1.14rem]">«{prediction.quote}»</blockquote>
                            <p className="mt-2 line-clamp-1 text-[.74rem] text-soft">من مقال: {article.title}</p>
                          </div>
                          <span className="relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair" aria-hidden="true">
                            <span className="absolute h-px w-3 bg-accent" /><span className="absolute h-3 w-px bg-accent transition-transform group-open:rotate-90" />
                          </span>
                        </div>
                      </summary>
                      <div className="mt-6 border-t border-hair pt-5">
                        <dl className="grid gap-x-9 gap-y-5 sm:grid-cols-2">
                          {[
                            ['الاتجاه العام', prediction.dimensions.direction],
                            ['التوقيت', prediction.dimensions.timing],
                            ['حجم التأثير', prediction.dimensions.scale],
                            ['النطاق', prediction.dimensions.scope],
                          ].map(([term, detail]) => (
                            <div key={term}>
                              <dt className="text-[.68rem] font-semibold text-accent">{term}</dt>
                              <dd className="mt-1.5 text-[.8rem] font-light leading-[1.8] text-soft">{detail}</dd>
                            </div>
                          ))}
                        </dl>
                        {prediction.laterArticle && (
                          <Link to={`/articles/${prediction.laterArticle.slug}`} className="mt-6 block border-t border-hair pt-4 text-[.78rem] leading-[1.75] text-soft transition-colors hover:text-accent">
                            كتابة لاحقة على الخيط نفسه: «{prediction.laterArticle.title}» ←
                          </Link>
                        )}
                        {prediction.evidence?.length ? (
                          <div className="mt-5 border-t border-hair pt-4">
                            <p className="text-[.68rem] font-semibold text-accent">دليل عام قابل للتحقق</p>
                            {prediction.evidence.map((evidence) => (
                              <a key={evidence.url} href={evidence.url} target="_blank" rel="noreferrer" className="mt-2 block text-[.78rem] leading-[1.75] text-soft transition-colors hover:text-accent">{evidence.title} ↗</a>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                          <Link to={`/articles/${article.slug}`} className="inline-block border-b border-accent/30 pb-1 text-[.74rem] font-semibold text-accent">اقرأ النص في سياقه الأصلي ←</Link>
                          <button
                            type="button"
                            onClick={() => sharePrediction(article.slug, `${article.slug}:${prediction.quote}`)}
                            className="text-[.72rem] font-semibold text-soft transition-colors hover:text-accent"
                          >
                            {copiedPrediction === `${article.slug}:${prediction.quote}` ? 'نُسخ رابط التوقع ✓' : 'شارك هذا التوقع ⧉'}
                          </button>
                        </div>
                      </div>
                    </details>
                  </FadeUp>
                ))}
              </div>
            </div>
          </section>
        )
      ) : (loading || (Boolean(idea) && !bodiesReady)) && !document ? (
        <div className="px-6 py-24 text-center text-soft">تُقرأ خيوط الأرشيف…</div>
      ) : !document ? (
        <div className="px-6 py-24 text-center text-soft">لا توجد مقالات مؤرخة تكفي لبناء الوثيقة بعد.</div>
      ) : (
        <>
          <section className="border-b border-hair px-6 py-14 md:px-11 md:py-20">
            <div className="mx-auto max-w-shell">
              <FadeUp>
                <p className="max-w-3xl font-display text-[clamp(1.35rem,3vw,2rem)] font-medium leading-[1.8] text-ink">
                  من {document.firstYear} إلى {document.latestYear}: {document.span === 10 ? 'عشر سنوات' : `${number.format(document.span)} سنة`} تقرأ نفسها من خلال {number.format(document.articles.length)} مقالاً، لا لتختصر الفكرة في رقم، بل لتكشف حركتها.
                </p>
              </FadeUp>
            </div>
          </section>

          <section className="border-b border-hair px-6 py-16 md:px-11 md:py-24">
            <div className="mx-auto max-w-shell">
              <FadeUp>
                <span className="text-[.78rem] font-semibold text-accent">{chapterCountWord(document.stages.length)}</span>
                <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] font-bold text-ink">كيف تحرّكت الكتابة؟</h2>
              </FadeUp>
              <div className={`mobile-card-rail mt-10 grid gap-px overflow-hidden rounded-2xl border border-hair bg-hair ${document.stages.length >= 3 ? 'lg:grid-cols-3' : document.stages.length === 2 ? 'lg:grid-cols-2' : ''}`}>
                {document.stages.map((stage, index) => (
                  <FadeUp key={stage.range} delay={index * 0.06} className="bg-canvas p-7 md:p-8">
                    <div className="flex items-center justify-between gap-4 text-[.76rem]">
                      <span className="font-semibold text-accent">{stage.label}</span>
                      <span className="text-soft">{stage.range}</span>
                    </div>
                    <p className="mt-5 text-[.82rem] text-soft">{number.format(stage.count)} مقالاً · الأبرز موضوعياً: {stage.dominant || '—'}</p>
                    {stage.article ? (
                      <Link to={`/articles/${stage.article.slug}`} className="group mt-5 block border-t border-hair pt-5">
                        <span className="text-[.72rem] text-soft">أبرز مقال في هذه المرحلة</span>
                        <strong className="mt-2 block font-display text-[1.12rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">
                          {stage.article.title}
                        </strong>
                        <span className="mt-3 inline-block text-[.76rem] font-semibold text-accent">اقرأ النص ←</span>
                      </Link>
                    ) : (
                      <p className="mt-5 border-t border-hair pt-5 text-[.82rem] text-soft">لا توجد مادة مؤرخة في هذا الفصل.</p>
                    )}
                  </FadeUp>
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-hair px-6 py-16 md:px-11 md:py-24">
            <div className="mx-auto grid max-w-shell gap-16 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <FadeUp>
                  <span className="text-[.78rem] font-semibold text-accent">الموضوعات المُلحّة</span>
                  <h2 className="mt-3 font-display text-[clamp(1.7rem,3.5vw,2.5rem)] font-bold text-ink">ما الذي عاد أكثر؟</h2>
                </FadeUp>
                <div className="mt-8 space-y-5">
                  {document.categories.slice(0, 6).map(([category, count], index) => {
                    const maximum = document.categories[0]?.[1] || 1
                    return (
                      <FadeUp key={category} delay={Math.min(index * 0.04, 0.2)}>
                        <div className="flex items-center justify-between gap-4 text-[.84rem]">
                          <span className="font-medium text-ink">{category}</span>
                          <span className="text-soft">{number.format(count)}</span>
                        </div>
                        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-hair">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(5, (count / maximum) * 100)}%` }} />
                        </div>
                      </FadeUp>
                    )
                  })}
                </div>
              </div>

              <div>
                <FadeUp>
                  <span className="text-[.78rem] font-semibold text-accent">منعطفات قابلة للقياس</span>
                  <h2 className="mt-3 font-display text-[clamp(1.7rem,3.5vw,2.5rem)] font-bold text-ink">حين تغيّرت الإشارة.</h2>
                </FadeUp>
                <ol className="mt-8 border-r border-hair pe-6 md:pe-9">
                  {document.turns.map((turn, index) => (
                    <FadeUp key={`${turn.title}-${turn.year}`} delay={index * 0.06}>
                      <li className="relative pb-9 last:pb-0">
                        <span className="absolute -right-[5px] top-2 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-accent" />
                        <time className="text-[.75rem] font-semibold text-accent">{turn.year}</time>
                        <h3 className="mt-1 font-display text-[1.18rem] font-semibold text-ink">{turn.title}</h3>
                        <p className="mt-2 text-[.88rem] font-light leading-[1.9] text-soft">{turn.description}</p>
                      </li>
                    </FadeUp>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 md:px-11 md:py-24">
            <div className="mx-auto max-w-3xl">
              <FadeUp>
                <span className="text-[.78rem] font-semibold text-accent">الخط الزمني السنوي</span>
                <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] font-bold text-ink">العقد، سنةً سنة.</h2>
              </FadeUp>
              <ol className="mt-10 divide-y divide-hair border-y border-hair">
                {/* السنوات ذات المقالات فقط — لا نعرض سنوات فارغة */}
                {document.chapters.filter((chapter) => chapter.articles.length > 0).map((chapter, index) => (
                  <FadeUp key={chapter.year} delay={Math.min(index * 0.025, 0.18)}>
                    {/* رابط سنة (مقترح معتمد): #y-2023 يقود مباشرة إلى سطر السنة */}
                    <li id={`y-${chapter.year}`} className="grid scroll-mt-28 gap-3 py-6 sm:grid-cols-[90px_1fr] sm:gap-7">
                      <a href={`#y-${chapter.year}`} className="font-display text-[1.35rem] font-semibold text-accent transition-colors hover:text-accent-deep" title="رابط مباشر لهذه السنة">
                        <time>{chapter.year}</time>
                      </a>
                      <div>
                        <p className="text-[.78rem] text-soft">{number.format(chapter.articles.length)} مقالاً · {chapter.dominant}</p>
                        {chapter.representative && (
                          <Link to={`/articles/${chapter.representative.slug}`} className="mt-1.5 block font-display text-[1.05rem] font-medium leading-[1.65] text-ink transition-colors hover:text-accent">
                            {chapter.representative.title} ←
                          </Link>
                        )}
                      </div>
                    </li>
                  </FadeUp>
                ))}
              </ol>
            </div>
          </section>
        </>
      )}
    </Page>
  )
}
