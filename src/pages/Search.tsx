import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { articleCats } from '../data'
import { articleYears, searchArticles, topKeywordsFor } from '../lib/cms'

const ar = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])

export default function Search() {
  useSeo({
    title: 'البحث العميق',
    path: '/search',
    description: 'بحث متقدم في المقالات حسب النص الكامل والتصنيف والسنة والكلمات المفتاحية.',
  })

  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('الكل')
  const [year, setYear] = useState('الكل')

  const results = useMemo(() => searchArticles({ query, cat, year }), [query, cat, year])
  const keywords = useMemo(() => topKeywordsFor(results.slice(0, 18), 12), [results])

  return (
    <Page>
      <PageHead
        label="بحث"
        title="البحث العميق."
        sub="ابحث في العناوين والنصوص الكاملة، ثم صفّ النتائج حسب السنة أو الموضوع."
      />

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="border-b border-hair pb-8">
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="كلمة، فكرة، عنوان، أو سؤال..."
                  aria-label="بحث في المقالات"
                  className="w-full rounded-none border-0 border-b border-hair bg-transparent py-5 pe-14 ps-4 font-display text-[clamp(1.45rem,4vw,2.5rem)] font-semibold leading-[1.5] text-ink outline-none transition-colors placeholder:text-soft/45 focus:border-accent"
                />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.4rem] text-accent">⌕</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {articleCats.map((item) => (
                  <button
                    key={item}
                    onClick={() => setCat(item)}
                    className={`rounded-full border px-4 py-1.5 text-[.84rem] font-medium transition-colors ${
                      cat === item ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['الكل', ...articleYears].map((item) => (
                  <button
                    key={item}
                    onClick={() => setYear(item)}
                    className={`rounded-full border px-4 py-1.5 text-[.8rem] transition-colors ${
                      year === item ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
                    }`}
                  >
                    {item === 'الكل' ? 'كل السنوات' : ar(item)}
                  </button>
                ))}
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.05}>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[.9rem] text-soft">
                {ar(results.length)} نتيجة
                {query.trim() && <span> عن «{query.trim()}»</span>}
              </p>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keywords.slice(0, 8).map((keyword) => (
                    <button
                      key={keyword}
                      onClick={() => setQuery(keyword)}
                      className="border-b border-hair pb-0.5 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FadeUp>

          <ul className="mt-8">
            {results.map((article, index) => (
              <FadeUp key={article.slug} delay={Math.min(index * 0.025, 0.25)}>
                <li className={index === 0 ? '' : 'border-t border-hair'}>
                  <Link to={`/articles/${article.slug}`} className="group grid gap-3 py-6 md:grid-cols-[10rem_1fr_7rem] md:items-baseline">
                    <time className="text-[.82rem] text-soft">{article.date}</time>
                    <span>
                      <span className="block font-display text-[1.25rem] font-semibold leading-[1.55] text-ink transition-colors group-hover:text-accent">
                        {article.title}
                      </span>
                      <span className="mt-1.5 block max-w-[72ch] text-[.92rem] font-light leading-[1.8] text-soft">
                        {article.excerpt}
                      </span>
                    </span>
                    <span className="text-[.8rem] text-accent md:text-left">{article.cat}</span>
                  </Link>
                </li>
              </FadeUp>
            ))}
          </ul>

          {results.length === 0 && (
            <FadeUp>
              <div className="border-t border-hair py-20 text-center">
                <p className="font-display text-[1.5rem] font-semibold text-ink">لا نتائج دقيقة.</p>
                <p className="mt-3 text-[.95rem] text-soft">جرّب كلمة أوسع، أو ألغِ أحد الفلاتر.</p>
              </div>
            </FadeUp>
          )}
        </div>
      </section>
    </Page>
  )
}
