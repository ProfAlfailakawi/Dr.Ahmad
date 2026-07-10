import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { articleCats, essays } from '../data'
import { useCmsContent } from '../lib/content'
import { useSeo } from '../components/seo'

export default function Articles() {
  const { articles } = useCmsContent()
  useSeo({ title: 'مقالاتي الفكرية', path: '/articles', description: `${articles.length} مقالاً فكرياً في التعليم والتقنية والمجتمع، منذ 2016.` })
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('الكل')
  const [showAll, setShowAll] = useState(false)

  const term = q.trim()
  const filtered = articles
    .filter((a) => (cat === 'الكل' ? true : a.cat === cat))
    .filter((a) => (term ? (a.title + ' ' + (a.excerpt || '')).includes(term) : true))
  const shown = showAll ? filtered : filtered.slice(0, 12)

  return (
    <Page>
      <PageHead
        label="المقالات الفكرية"
        title="بصوتي الخاص."
        sub={`${articles.length} مقالاً في التعليم والتقنية والمجتمع، منشورة في الصحافة الكويتية منذ 2016.`}
      />

      {/* featured trio */}
      <section className="border-b border-hair px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto grid max-w-shell gap-8 md:grid-cols-3">
          {essays.map((e, i) => (
            <FadeUp key={e.title} delay={i * 0.08}>
              <article className="border-t-2 border-accent pt-5">
                <span className="text-[.76rem] font-semibold uppercase text-accent">{e.tag}</span>
                <h2 className="my-3 font-display text-[1.34rem] font-medium text-ink">{e.title}</h2>
                <blockquote className="font-display text-[1.02rem] leading-[1.75] text-soft">{e.quote}</blockquote>
              </article>
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
                onChange={(e) => { setQ(e.target.value); setShowAll(false) }}
                placeholder="ابحث في المقالات…"
                aria-label="بحث"
                className="w-full rounded-full border border-hair bg-canvas py-3.5 pe-12 ps-5 text-[.98rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
              />
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-soft">⌕</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {articleCats.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCat(c); setShowAll(false) }}
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

          {filtered.length > 12 && (
            <button onClick={() => setShowAll(!showAll)} className="mt-10 border-b-[1.5px] border-accent pb-1 font-semibold text-accent">
              {showAll ? 'عرض أقل ←' : `عرض جميع المقالات (${filtered.length}) ←`}
            </button>
          )}
        </div>
      </section>
    </Page>
  )
}
