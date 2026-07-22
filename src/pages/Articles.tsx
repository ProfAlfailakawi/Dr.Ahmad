import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { useSeo } from '../components/seo'
import { dynamicArticleCategories } from '../lib/content-taxonomy'
import { ReaderFingerprint } from '../components/ReaderResonance'
import { Pagination, usePagedList } from '../components/Pagination'

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
  tag: article.cat || 'مقال',
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
  // السنة الأولى تُحسب من المقالات نفسها — تتحدّث تلقائياً مع أي إضافة
  const years = articles.map((a) => Number(a.iso.slice(0, 4))).filter((y) => y >= 1990)
  const firstYear = years.length ? Math.min(...years) : new Date().getFullYear()
  useSeo({ title: 'مقالاتي الفكرية', path: '/articles', description: `${articles.length} مقالاً فكرياً في التعليم والتقنية والمجتمع، منذ ${firstYear}.` })
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('الكل')
  const categories = useMemo(() => dynamicArticleCategories(articles), [articles])
  const featured = useMemo(() => {
    if (!articles.length) return []
    /* ثلاث عدسات مستقلة: حديث، أرشيف، ومفاجأة موضوعية. تتبدل كل ست ساعات
       وتتعمد اختلاف الفئة والسنة، فلا تظل الواجهة معلّقة على موضوع واحد. */
    const now = new Date()
    const kuwait = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(now)
    const part = (type: string) => kuwait.find((item) => item.type === type)?.value || ''
    const period = `${part('year')}-${part('month')}-${part('day')}-${Math.floor(Number(part('hour') || 0) / 6)}`
    const eligible = articles.filter((article) => article.title && (article.excerpt || '').trim().length >= 45)
    const dated = [...eligible].sort((left, right) => right.iso.localeCompare(left.iso))
    const latestYear = Number(dated[0]?.iso.slice(0, 4)) || new Date().getFullYear()
    const chosen: typeof eligible = []
    const rank = (pool: typeof eligible, salt: string) => [...pool].sort((left, right) => stableHash(`${period}:${salt}:${left.slug}`) - stableHash(`${period}:${salt}:${right.slug}`))
    const pick = (pool: typeof eligible, salt: string, forceNewCategory = true, forceNewYear = false) => {
      const remaining = rank(pool.filter((article) => !chosen.some((item) => item.slug === article.slug)), salt)
      const strict = remaining.find((article) => (!forceNewCategory || !chosen.some((item) => item.cat === article.cat)) && (!forceNewYear || !chosen.some((item) => item.iso.slice(0, 4) === article.iso.slice(0, 4))))
      const categoryDifferent = remaining.find((article) => !chosen.some((item) => item.cat === article.cat))
      const next = strict || categoryDifferent || remaining[0]
      if (next) chosen.push(next)
    }

    pick(dated.slice(0, Math.min(36, dated.length)), 'recent', false)
    pick(eligible.filter((article) => Number(article.iso.slice(0, 4)) <= latestYear - 3), 'archive', true, true)
    pick(eligible, 'cross-topic', true, true)
    while (chosen.length < Math.min(3, eligible.length)) pick(eligible, `fill-${chosen.length}`, true)
    return chosen.map(articleCard)
  }, [articles])

  const term = q.trim()
  const archiveActive = Boolean(term || cat !== 'الكل')
  const filtered = articles
    .filter((a) => (cat === 'الكل' ? true : a.cat === cat))
    .filter((a) => (term ? (a.title + ' ' + (a.excerpt || '')).includes(term) : true))
  const displayArticles = archiveActive ? filtered : diversifyArticles(filtered)
  const paged = usePagedList(displayArticles, 18, `${cat}|${term}`)
  const shown = paged.pageItems

  return (
    <Page className="content-articles page-journey">
      <PageHead
        label="المقالات الفكرية"
        title="بصوتي الخاص."
        sub={`${articles.length} مقالاً في التعليم والتقنية والمجتمع، منشورة في الصحافة الكويتية منذ ${firstYear}.`}
      />

      <section className="sticky top-16 z-[120] border-b border-hair bg-canvas/92 px-4 py-3 backdrop-blur-md sm:px-6 md:px-11">
        <div className="mx-auto grid max-w-shell gap-3 lg:grid-cols-[minmax(260px,.62fr)_minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في المقالات…"
              aria-label="بحث"
              className="w-full rounded-full border border-hair bg-canvas py-3 pe-12 ps-5 text-[.94rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
            />
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-soft">⌕</span>
          </div>
          <div className="rail -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full border px-4 py-2 text-[.82rem] font-medium transition-colors duration-300 ${
                  cat === c ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-[.8rem] font-semibold text-accent lg:justify-end">
            <Link to="/search" className="transition-opacity hover:opacity-70">البحث العميق ←</Link>
            <Link to="/atlas" className="transition-opacity hover:opacity-70">سماء المقالات ←</Link>
          </div>
        </div>
      </section>

      {/* featured trio - 3 distinct, expressive card variations */}
      {!archiveActive && <section className="border-b border-hair px-4 py-10 sm:px-6 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[.85rem] font-bold text-accent">إضاءات مختارة وقراءات فكرية</h2>
            <span className="text-[.75rem] text-soft">3 عدسات موضوعية متجددة</span>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featured.map((e, i) => {
              // Card style variation 0: Highlight Hero Card
              if (i === 0) {
                return (
                  <FadeUp key={e.title} delay={0} className="h-full min-w-0">
                    <Link
                      to={`/articles/${e.slug}`}
                      viewTransition
                      className="group flex h-full min-w-0 flex-col justify-between rounded-2xl border border-accent/30 bg-accent/[.045] p-6 shadow-sm transition-all duration-300 hover:border-accent hover:bg-accent/[.07] hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[.7rem] font-bold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                            {e.tag} · أبرز مقال
                          </span>
                          <span className="text-[.75rem] font-bold text-accent">01</span>
                        </div>
                        <h3 style={{ viewTransitionName: `article-${e.slug}` }} className="mt-4 break-words font-display text-[1.18rem] font-bold leading-[1.5] text-ink transition-colors group-hover:text-accent sm:text-[1.32rem]">
                          {e.title}
                        </h3>
                        <blockquote className="mt-3 line-clamp-4 break-words font-display text-[.9rem] leading-[1.8] text-soft">
                          {e.quote}
                        </blockquote>
                      </div>
                      <div className="mt-6 flex items-center justify-between border-t border-accent/20 pt-4 text-[.78rem] font-bold text-accent">
                        <span>اقرأ المقال الكامل</span>
                        <span className="transition-transform group-hover:translate-x-1">←</span>
                      </div>
                    </Link>
                  </FadeUp>
                )
              }

              // Card style variation 1: Archival Framed Card
              if (i === 1) {
                return (
                  <FadeUp key={e.title} delay={0.08} className="h-full min-w-0">
                    <Link
                      to={`/articles/${e.slug}`}
                      viewTransition
                      className="group flex h-full min-w-0 flex-col justify-between rounded-2xl border border-hair border-t-4 border-t-accent bg-paper p-6 transition-all duration-300 hover:border-accent/50 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex rounded-md border border-hair bg-canvas px-2.5 py-1 text-[.7rem] font-bold text-soft">
                            {e.tag} · قراءة من الأرشيف
                          </span>
                          <span className="text-[.75rem] font-bold text-soft">02</span>
                        </div>
                        <h3 style={{ viewTransitionName: `article-${e.slug}` }} className="mt-4 break-words font-display text-[1.12rem] font-bold leading-[1.52] text-ink transition-colors group-hover:text-accent sm:text-[1.25rem]">
                          {e.title}
                        </h3>
                        <blockquote className="mt-3 line-clamp-4 break-words font-display text-[.88rem] leading-[1.8] text-soft/90">
                          {e.quote}
                        </blockquote>
                      </div>
                      <div className="mt-6 flex items-center justify-between border-t border-hair pt-4 text-[.78rem] font-semibold text-soft group-hover:text-accent">
                        <span>استكشف هذا المقال</span>
                        <span className="transition-transform group-hover:translate-x-1">←</span>
                      </div>
                    </Link>
                  </FadeUp>
                )
              }

              // Card style variation 2: Editorial Cross-topic Card
              return (
                <FadeUp key={e.title} delay={0.16} className="h-full min-w-0">
                  <Link
                    to={`/articles/${e.slug}`}
                    viewTransition
                    className="group flex h-full min-w-0 flex-col justify-between rounded-2xl border border-hair border-r-4 border-r-accent bg-canvas p-6 transition-all duration-300 hover:border-accent/60 hover:bg-paper hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[.7rem] font-bold text-accent">
                          {e.tag} · إضاءة موضوعية
                        </span>
                        <span className="text-[.75rem] font-bold text-soft">03</span>
                      </div>
                      <h3 style={{ viewTransitionName: `article-${e.slug}` }} className="mt-4 break-words font-display text-[1.12rem] font-bold leading-[1.52] text-ink transition-colors group-hover:text-accent sm:text-[1.25rem]">
                        {e.title}
                      </h3>
                      <blockquote className="mt-3 line-clamp-4 break-words font-display text-[.88rem] font-normal leading-[1.8] text-soft">
                        {e.quote}
                      </blockquote>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-hair pt-4 text-[.78rem] font-semibold text-soft group-hover:text-accent">
                      <span>مقال ذو صلة</span>
                      <span className="transition-transform group-hover:translate-x-1">←</span>
                    </div>
                  </Link>
                </FadeUp>
              )
            })}
          </div>
        </div>
      </section>}

      {/* archive */}
      <section className="px-6 py-12 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <p className="text-[.82rem] text-soft">
              {archiveActive ? `${filtered.length} نتيجة مطابقة` : 'المقالات موزعة بتنوّع موضوعي، مع الحفاظ على حضور الأحدث.'}
            </p>
          </FadeUp>

          <ul id="articles-list" className="mt-10 scroll-mt-28">
            {shown.map((a, i) => (
              <li key={a.slug} className={i === 0 ? '' : 'border-t border-hair'}>
                <Link
                  to={`/articles/${a.slug}`}
                  viewTransition
                  className="group flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <time className="w-32 shrink-0 text-[.8rem] text-soft">{a.date}</time>
                  <span className="flex-1">
                    <span style={{ viewTransitionName: `article-${a.slug}` }} className="block text-[1.08rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">
                      {a.title}
                    </span>
                    {a.excerpt && (
                      <span className="mt-1.5 block max-w-[62ch] text-[.9rem] font-light leading-[1.75] text-soft">
                        {a.excerpt}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[.78rem] text-soft">{a.cat}</span>
                </Link>
              </li>
            ))}
          </ul>

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
