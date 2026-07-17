import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { essays } from '../data'
import { useCmsContent } from '../lib/content'
import { useSeo } from '../components/seo'
import { dynamicArticleCategories } from '../lib/content-taxonomy'

export default function Articles() {
  const { articles } = useCmsContent()
  // السنة الأولى تُحسب من المقالات نفسها — تتحدّث تلقائياً مع أي إضافة
  const years = articles.map((a) => Number(a.iso.slice(0, 4))).filter((y) => y >= 1990)
  const firstYear = years.length ? Math.min(...years) : new Date().getFullYear()
  useSeo({ title: 'مقالاتي الفكرية', path: '/articles', description: `${articles.length} مقالاً فكرياً في التعليم والتقنية والمجتمع، منذ ${firstYear}.` })
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('الكل')
  const [visibleCount, setVisibleCount] = useState(18)
  const categories = useMemo(() => dynamicArticleCategories(articles), [articles])
  const featured = useMemo(() => {
    const selected = essays.flatMap((entry) => {
      const live = articles.find((article) => article.slug === entry.slug)
      return live ? [{ ...entry, title: live.title, tag: live.cat || entry.tag }] : []
    })
    if (selected.length) return selected
    return articles.slice(0, 3).map((article) => ({
      slug: article.slug,
      tag: article.cat || 'مقال',
      title: article.title,
      quote: `«${(article.excerpt || '').slice(0, 150)}${(article.excerpt || '').length > 150 ? '…' : ''}»`,
    }))
  }, [articles])

  const term = q.trim()
  const filtered = articles
    .filter((a) => (cat === 'الكل' ? true : a.cat === cat))
    .filter((a) => (term ? (a.title + ' ' + (a.excerpt || '')).includes(term) : true))
  const shown = filtered.slice(0, visibleCount)

  return (
    <Page className="content-articles page-journey">
      <PageHead
        label="المقالات الفكرية"
        title="بصوتي الخاص."
        sub={`${articles.length} مقالاً في التعليم والتقنية والمجتمع، منشورة في الصحافة الكويتية منذ ${firstYear}.`}
      />

      {/* featured trio */}
      <section className="border-b border-hair px-4 py-12 sm:px-6 md:px-11 md:py-20">
        <div className="mobile-paired-grid mx-auto grid max-w-shell grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 md:gap-8">
          {featured.map((e, i) => (
            <FadeUp key={e.title} delay={i * 0.08} className="h-full min-w-0">
              <Link
                to={`/articles/${e.slug}`}
                className="group flex h-full min-w-0 flex-col rounded-2xl border border-hair border-t-2 border-t-accent bg-canvas p-4 text-start shadow-[0_18px_42px_-38px_rgba(21,22,26,.35)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 sm:p-5 md:rounded-none md:border-x-0 md:border-b-0 md:bg-transparent md:px-0 md:shadow-none"
              >
                <span className="text-[.68rem] font-semibold uppercase text-accent sm:text-[.76rem]">{e.tag}</span>
                <h2 className="my-2 break-words font-display text-[1rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent sm:my-3 sm:text-[1.2rem] md:text-[1.34rem]">{e.title}</h2>
                <blockquote className="line-clamp-4 break-words font-display text-[.82rem] leading-[1.75] text-soft sm:text-[.95rem] md:text-[1.02rem]">{e.quote}</blockquote>
                <span className="mt-auto inline-flex pt-4 text-[.7rem] font-semibold text-accent opacity-100 transition-opacity duration-300 md:text-[.78rem] md:opacity-0 md:group-hover:opacity-100">اقرأ المقال ←</span>
              </Link>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* archive */}
      <section className="px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="mb-7 flex justify-end">
              <div className="flex flex-wrap gap-5">
              <Link to="/search" className="group inline-flex items-center gap-2 text-[.88rem] font-semibold text-accent">
                <span>البحث العميق</span>
                <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">←</span>
              </Link>
              <Link to="/atlas" className="group inline-flex items-center gap-2 text-[.88rem] font-semibold text-accent">
                <span>✦ اعرضها كسماء</span>
                <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">←</span>
              </Link>
              </div>
            </div>
            <div className="relative mb-7">
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setVisibleCount(18) }}
                placeholder="ابحث في المقالات…"
                aria-label="بحث"
                className="w-full rounded-full border border-hair bg-canvas py-3.5 pe-12 ps-5 text-[.98rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
              />
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-soft">⌕</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCat(c); setVisibleCount(18) }}
                  className={`rounded-full border px-4 py-1.5 text-[.85rem] font-medium transition-colors duration-300 ${
                    cat === c ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </FadeUp>

          <ul className="mt-10">
            {shown.map((a, i) => (
              <li key={a.slug} className={i === 0 ? '' : 'border-t border-hair'}>
                <Link
                  to={`/articles/${a.slug}`}
                  className="group flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <time className="w-32 shrink-0 text-[.8rem] text-soft">{a.date}</time>
                  <span className="flex-1">
                    <span className="block text-[1.08rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">
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

          {visibleCount < filtered.length && (
            <div className="mt-10 border-t border-hair pt-8 text-center">
              <button onClick={() => setVisibleCount((count) => count + 18)} className="rounded-full border border-accent px-7 py-3 text-[.88rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">
                عرض ١٨ مقالاً إضافياً
              </button>
              <p className="mt-3 text-[.76rem] text-soft">يظهر المحتوى تدريجياً للحفاظ على هدوء الصفحة وسرعتها.</p>
            </div>
          )}
        </div>
      </section>
    </Page>
  )
}
