import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { useSeo } from '../components/seo'
import { categoryLabel, dynamicArticleCategories } from '../lib/content-taxonomy'
import { ReaderFingerprint } from '../components/ReaderResonance'
import { Pagination, usePagedList } from '../components/Pagination'
import { SocialIcon } from '../components/icons'
import { arabicCountPhrase, ARTICLE_PLAIN_FORMS, MATCHING_RESULT_FORMS } from '../lib/arabic-count.ts'

const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const articleCard = (article: { slug: string; cat?: string; title: string; excerpt?: string }) => ({
  slug: article.slug,
  tag: article.cat ? categoryLabel(article.cat) : 'مقال',
  title: article.title,
  quote: `«${(article.excerpt || '').slice(0, 150)}${(article.excerpt || '').length > 150 ? '…' : ''}»`,
})

function diversifyArticles<T extends { cat?: string; iso: string; slug: string }>(items: readonly T[]) {
  const queues = new Map<string, T[]>()
  for (const item of [...items].sort((left, right) => right.iso.localeCompare(left.iso))) {
    const key = item.cat || 'مقال'
    const queue = queues.get(key) || []
    queue.push(item)
    queues.set(key, queue)
  }
  const categoryOrder = [...queues.keys()].sort((left, right) => {
    const newestLeft = queues.get(left)?.[0]?.iso || ''
    const newestRight = queues.get(right)?.[0]?.iso || ''
    return newestRight.localeCompare(newestLeft) || left.localeCompare(right, 'ar')
  })
  const result: T[] = []
  let previousCategory = ''
  while (result.length < items.length) {
    const available = categoryOrder.filter((category) => (queues.get(category)?.length || 0) > 0)
    if (!available.length) break
    const nextCategory = available.find((category) => category !== previousCategory) || available[0]
    const next = queues.get(nextCategory)?.shift()
    if (!next) break
    result.push(next)
    previousCategory = nextCategory
    categoryOrder.push(categoryOrder.splice(categoryOrder.indexOf(nextCategory), 1)[0])
  }
  return result
}

export default function Articles() {
  const { articles } = useCmsContent()
  const reduce = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()
  // السنة الأولى تُحسب من المقالات نفسها — تتحدّث تلقائياً مع أي إضافة
  const years = articles.map((a) => Number(a.iso.slice(0, 4))).filter((y) => y >= 1990)
  const firstYear = years.length ? Math.min(...years) : new Date().getFullYear()
  useSeo({ title: 'مقالاتي الفكرية', path: '/articles', description: `مقالات فكرية تتتبّع تحولات التعليم والتكنولوجيا والمجتمع منذ انطلاق الرحلة العلمية عام 2015 — ${arabicCountPhrase(articles.length, ARTICLE_PLAIN_FORMS)}.` })
  const q = searchParams.get('q') || ''
  const cat = searchParams.get('cat') || 'الكل'
  const year = searchParams.get('year') || 'الكل'
  const order = searchParams.get('order') === 'latest' ? 'latest' : 'selected'
  const view = searchParams.get('view') === 'scene' ? 'scene' : 'read'
  const setParam = (key: 'q' | 'cat' | 'year' | 'order' | 'view', value: string) => {
    const next = new URLSearchParams(searchParams)
    const defaults: Record<string, string> = { q: '', cat: 'الكل', year: 'الكل', order: 'selected', view: 'read' }
    if (!value || value === defaults[key]) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }
  const categories = useMemo(() => dynamicArticleCategories(articles), [articles])
  const archiveYears = useMemo(() => Array.from(new Set(articles.map((article) => article.iso.slice(0, 4)).filter(Boolean))).sort((left, right) => right.localeCompare(left)), [articles])
  const featured = useMemo(() => {
    if (!articles.length) return []
    /* ثلاث عدسات موضوعية متجددة تلقائياً:
       تضمن تنوع الفئات والمواضيع (مثلاً: تكنولوجيا، مجتمع، تعليم/هوية)،
       وتتبدل دورياً لتضمن إبراز جوانب مختلفة من الإنتاج الفكري. */
    const now = new Date()
    const kuwait = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now)
    const part = (type: string) => kuwait.find((item) => item.type === type)?.value || ''
    // Rotate every 15 minutes or session visit
    const minuteBlock = Math.floor(Number(part('minute') || 0) / 15)
    const period = `${part('year')}-${part('month')}-${part('day')}-${part('hour')}-${minuteBlock}`

    const pool = articles
      .filter((a) => cat === 'الكل' || a.cat === cat)
      .filter((a) => year === 'الكل' || a.iso.startsWith(year))
    const eligible = pool.filter((article) => article.title && (article.excerpt || '').trim().length >= 30)
    if (!eligible.length) return []

    const dated = [...eligible].sort((left, right) => right.iso.localeCompare(left.iso))
    const chosen: typeof eligible = []
    const rank = (items: typeof eligible, salt: string) => [...items].sort((left, right) => stableHash(`${period}:${salt}:${left.slug}`) - stableHash(`${period}:${salt}:${right.slug}`))

    // Card 1: Recent / Key Highlight
    const card1Candidates = rank(dated.slice(0, Math.min(20, dated.length)), 'recent')
    if (card1Candidates[0]) chosen.push(card1Candidates[0])

    // Card 2: Distinct category (or distinct decade/year if inside single category)
    const card2Candidates = rank(eligible.filter((a) => !chosen.some((c) => c.slug === a.slug)), 'card2')
    const card2Best = card2Candidates.find((a) => !chosen.some((c) => c.cat === a.cat) && !chosen.some((c) => c.iso.slice(0, 4) === a.iso.slice(0, 4)))
      || card2Candidates.find((a) => !chosen.some((c) => c.cat === a.cat))
      || card2Candidates.find((a) => !chosen.some((c) => c.iso.slice(0, 4) === a.iso.slice(0, 4)))
      || card2Candidates[0]
    if (card2Best) chosen.push(card2Best)

    // Card 3: Third distinct category & year
    const card3Candidates = rank(eligible.filter((a) => !chosen.some((c) => c.slug === a.slug)), 'card3')
    const card3Best = card3Candidates.find((a) => !chosen.some((c) => c.cat === a.cat) && !chosen.some((c) => c.iso.slice(0, 4) === a.iso.slice(0, 4)))
      || card3Candidates.find((a) => !chosen.some((c) => c.cat === a.cat))
      || card3Candidates.find((a) => !chosen.some((c) => c.iso.slice(0, 4) === a.iso.slice(0, 4)))
      || card3Candidates[0]
    if (card3Best) chosen.push(card3Best)

    return chosen.map(articleCard)
  }, [articles, cat, year])

  const term = q.trim()
  const archiveActive = Boolean(term || cat !== 'الكل' || year !== 'الكل')
  const filtered = articles
    .filter((a) => (cat === 'الكل' ? true : a.cat === cat))
    .filter((a) => (year === 'الكل' ? true : a.iso.startsWith(year)))
    .filter((a) => (term ? (a.title + ' ' + (a.excerpt || '')).includes(term) : true))
  const displayArticles = useMemo(() => {
    if (order === 'latest') return [...filtered].sort((left, right) => right.iso.localeCompare(left.iso))
    const diversified = archiveActive ? filtered : diversifyArticles(filtered)
    const featuredSlugs = new Set(featured.map((item) => item.slug))
    const selected = featured.map((item) => filtered.find((article) => article.slug === item.slug)).filter(Boolean) as typeof filtered
    return [...selected, ...diversified.filter((article) => !featuredSlugs.has(article.slug))]
  }, [archiveActive, featured, filtered, order])
  const paged = usePagedList(displayArticles, view === 'scene' ? 12 : 18, `${cat}|${year}|${term}|${order}|${view}`)
  const shown = paged.pageItems

  return (
    <Page className="content-articles page-journey">
      <PageHead
        label="المقالات الفكرية"
        title="أفكارٌ تلاحق زمنها."
        sub="مقالاتٌ أكتبها منذ انطلاق رحلتي العلمية عام 2015؛ أقرأ فيها تحولات التعليم والتكنولوجيا والمجتمع، وأتتبع ما تتركه في الإنسان والممارسة والحياة العامة."
      />

      <section className="articles-filter-bar border-b border-hair bg-canvas px-4 py-3 sm:px-6 md:sticky md:top-16 md:z-[120] md:bg-canvas/[.96] md:px-11 md:backdrop-blur-md">
        <div className="mx-auto max-w-shell">
          <div className="editorial-tablist flex flex-wrap items-center gap-x-3 gap-y-1 pb-2" role="tablist" aria-label="تصنيفات المقالات">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setParam('cat', c)}
                role="tab"
                aria-selected={cat === c}
                className={`editorial-tab shrink-0 px-3 py-2 text-[.82rem] font-medium ${cat === c ? 'is-active' : ''}`}
              >
                {categoryLabel(c)}
              </button>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <div className="relative">
              <input value={q} onChange={(event) => setParam('q', event.target.value)} placeholder="ابحث في المقالات…" aria-label="بحث" className="w-full rounded-full border border-hair bg-canvas py-3 pe-12 ps-5 text-[.9rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent" />
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-soft"><SocialIcon name="Search" size={17} /></span>
            </div>
            <label className="relative min-w-36">
              <span className="sr-only">تصفية المقالات حسب السنة</span>
              <select value={year} onChange={(event) => setParam('year', event.target.value)} className="min-h-11 w-full appearance-none rounded-full border border-hair bg-canvas py-2 pe-9 ps-4 text-[.82rem] font-medium text-soft outline-none transition-colors hover:border-accent focus:border-accent">
                <option value="الكل">كل السنوات</option>
                {archiveYears.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-soft"><SocialIcon name="ChevronDown" size={13} /></span>
            </label>
            <details className="group relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-hair bg-canvas px-4 text-[.78rem] font-semibold text-accent transition-colors hover:border-accent">استكشف الأرشيف <span aria-hidden className="transition-transform group-open:rotate-180"><SocialIcon name="ChevronDown" size={13} /></span></summary>
              <div className="absolute end-0 top-[calc(100%+.5rem)] z-20 min-w-44 max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-hair bg-canvas p-2 shadow-[0_18px_50px_-30px_rgba(21,22,26,.55)]">
                <Link to="/search" className="block rounded-lg px-3 py-2 text-[.76rem] font-semibold text-ink hover:bg-wash hover:text-accent">البحث العميق</Link>
                <Link to="/atlas" className="block rounded-lg px-3 py-2 text-[.76rem] font-semibold text-ink hover:bg-wash hover:text-accent">سماء المقالات</Link>
              </div>
            </details>
          </div>
          <div className="articles-explore-controls mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-hair/70 pt-2">
            <div className="editorial-tablist flex gap-1" role="group" aria-label="ترتيب المقالات">
              <button type="button" onClick={() => setParam('order', 'selected')} aria-pressed={order === 'selected'} className={`editorial-tab min-h-10 px-3 text-[.72rem] font-semibold ${order === 'selected' ? 'is-active' : ''}`}>مختارة</button>
              <button type="button" onClick={() => setParam('order', 'latest')} aria-pressed={order === 'latest'} className={`editorial-tab min-h-10 px-3 text-[.72rem] font-semibold ${order === 'latest' ? 'is-active' : ''}`}>الأحدث</button>
            </div>
            <div className="editorial-tablist flex gap-1" role="group" aria-label="طريقة عرض المقالات">
              <button type="button" onClick={() => setParam('view', 'read')} aria-pressed={view === 'read'} className={`editorial-tab min-h-10 px-3 text-[.72rem] font-semibold ${view === 'read' ? 'is-active' : ''}`}>قراءة</button>
              <button type="button" onClick={() => setParam('view', 'scene')} aria-pressed={view === 'scene'} className={`editorial-tab min-h-10 px-3 text-[.72rem] font-semibold ${view === 'scene' ? 'is-active' : ''}`}>مشهد</button>
            </div>
          </div>
        </div>
      </section>

      {/* featured trio — بنية موحّدة، والاختلاف تحريري لا زخرفي */}
      {!term && featured.length > 0 && <section className="border-b border-hair px-4 py-10 sm:px-6 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[.85rem] font-bold text-accent">
              {cat === 'الكل' ? 'إضاءات مختارة وقراءات فكرية متنوّعة' : `إضاءات مختارة في قسم (${categoryLabel(cat)})`}
            </h2>
            <span className="text-[.75rem] text-soft">3 عدسات موضوعية متجددة</span>
          </div>
          <motion.div key={`featured:${cat}:${year}`} initial={reduce ? false : { opacity: .58 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : .16 }} className="article-featured-rail spatial-collection mx-0 flex snap-x snap-mandatory gap-4 overflow-x-auto px-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
            {featured.map((entry, index) => {
              const labels = ['الأبرز', 'من الأرشيف', 'زاوية مختلفة']
              return (
                <div key={entry.slug} className="h-auto w-[86vw] max-w-[24rem] shrink-0 snap-start self-stretch md:h-full md:w-auto md:max-w-none md:shrink md:snap-none">
                  <Link to={`/articles/${entry.slug}`} viewTransition className="spatial-card group flex h-full min-w-0 flex-col rounded-2xl border border-hair bg-canvas p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <span className="editorial-micro-label text-[.68rem] font-semibold text-accent">{entry.tag} · {labels[index] || 'مختارة'}</span>
                      <span className="text-[.7rem] font-semibold text-soft">0{index + 1}</span>
                    </div>
                    <h3 className="mt-4 break-words font-display text-[1.16rem] font-bold leading-[1.55] text-ink transition-colors group-hover:text-accent sm:text-[1.26rem]">{entry.title}</h3>
                    <blockquote className="mt-3 line-clamp-4 break-words font-display text-[.88rem] leading-[1.8] text-soft">{entry.quote}</blockquote>
                    <span aria-hidden className="mt-auto pt-6 text-left text-[.9rem] text-accent transition-transform group-hover:-translate-x-1">←</span>
                  </Link>
                </div>
              )
            })}
          </motion.div>
        </div>
      </section>}

      {/* archive */}
      <section className="editorial-breath-section px-6 py-12 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <p className="text-[.82rem] text-soft">
              {archiveActive ? arabicCountPhrase(filtered.length, MATCHING_RESULT_FORMS) : 'المقالات موزعة بتنوّع موضوعي، مع الحفاظ على حضور الأحدث.'}
            </p>
          </FadeUp>

          {view === 'read' ? (
            <motion.ul key={`articles:read:${cat}:${year}:${term}:${order}:${paged.page}`} initial={reduce ? false : { opacity: .55 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : .16 }} id="articles-list" className="spatial-collection mt-10 scroll-mt-28">
              {shown.map((a, i) => (
                <li key={a.slug} className={`spatial-card ${i === 0 ? '' : 'border-t border-hair'}`}>
                  <Link to={`/articles/${a.slug}`} viewTransition className="group flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:gap-6">
                    <time className="w-32 shrink-0 text-[.8rem] text-soft">{a.date}</time>
                    <span className="flex-1">
                      <span style={{ viewTransitionName: `article-${a.slug}` }} className="block text-[1.08rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">{a.title}</span>
                      {a.excerpt && <span className="mt-1.5 block max-w-[62ch] text-[.9rem] font-light leading-[1.75] text-soft">{a.excerpt}</span>}
                    </span>
                    <span className="shrink-0 text-[.78rem] text-soft">{categoryLabel(a.cat)}</span>
                  </Link>
                </li>
              ))}
            </motion.ul>
          ) : (
            <motion.div key={`articles:scene:${cat}:${year}:${term}:${order}:${paged.page}`} initial={reduce ? false : { opacity: .55 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : .16 }} id="articles-list" className="article-scene-grid mt-10 scroll-mt-28">
              {shown.map((a, index) => (
                <Link key={a.slug} to={`/articles/${a.slug}`} viewTransition className="article-scene-card group">
                  <div className="flex items-center justify-between gap-3 text-[.68rem] text-soft"><span className="font-semibold text-accent">{categoryLabel(a.cat)}</span><span>{String(index + 1).padStart(2, '0')}</span></div>
                  <h3 style={{ viewTransitionName: `article-${a.slug}` }} className="mt-5 font-display text-[1.22rem] font-semibold leading-[1.6] text-ink transition-colors group-hover:text-accent">{a.title}</h3>
                  {a.excerpt && <p className="mt-3 line-clamp-4 text-[.84rem] font-light leading-[1.85] text-soft">{a.excerpt}</p>}
                  <div className="mt-auto flex items-center justify-between border-t border-hair pt-4 text-[.72rem] text-soft"><time>{a.date}</time><span className="text-accent transition-transform group-hover:-translate-x-1">اقرأ ←</span></div>
                </Link>
              ))}
            </motion.div>
          )}

          {filtered.length === 0 && (
            <p className="py-16 text-center text-[1rem] font-light text-soft">لا نتائج مطابقة.</p>
          )}

          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={filtered.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="articles-list" label="صفحات المقالات" className="mt-10" />
        </div>
      </section>

      {/* بصمة القارئ — أثرٌ شخصيّ محليّ يُهدى لمن رافق المقالات */}
      <section className="px-6 pb-24 md:px-11">
        <div className="mx-auto max-w-shell">
          <FadeUp><ReaderFingerprint /></FadeUp>
        </div>
      </section>
    </Page>
  )
}
