import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { searchArticles, topKeywordsFor } from '../lib/cms'
import { useCmsContent } from '../lib/content'
import { dynamicArticleCategories } from '../lib/content-taxonomy'

const ar = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])

const suggestedTopics = [
  'الذكاء الاصطناعي',
  'التعليم',
  'الأسرة',
  'الهوية',
  'التقنية',
  'المستقبل',
]

export default function Search() {
  const { articles } = useCmsContent()
  const [searchParams] = useSearchParams()
  useSeo({
    title: 'البحث العميق',
    path: '/search',
    description: 'بحث متقدم في المقالات حسب النص الكامل والتصنيف والسنة والكلمات المفتاحية.',
  })

  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [cat, setCat] = useState('الكل')
  const [year, setYear] = useState('الكل')
  const [visibleCount, setVisibleCount] = useState(24)

  const categories = useMemo(() => dynamicArticleCategories(articles), [articles])
  const years = useMemo(() => Array.from(new Set(articles.map((article) => article.iso.slice(0, 4))))
    .sort((a, b) => b.localeCompare(a)), [articles])
  const normalizedQuery = query.trim()
  const searchStarted = normalizedQuery.length >= 2
  const results = useMemo(
    () => searchStarted ? searchArticles({ query: normalizedQuery, cat, year }, articles) : [],
    [articles, normalizedQuery, cat, year, searchStarted],
  )
  const keywords = useMemo(() => topKeywordsFor(results.slice(0, 18), 12), [results])
  const visibleResults = results.slice(0, visibleCount)

  const chooseTopic = (topic: string) => {
    setQuery(topic)
    setCat('الكل')
    setYear('الكل')
    setVisibleCount(24)
  }

  return (
    <Page className="content-search page-journey">
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
                  onChange={(event) => { setQuery(event.target.value); setVisibleCount(24) }}
                  placeholder="كلمة، فكرة، عنوان، أو سؤال..."
                  aria-label="بحث في المقالات"
                  className="w-full rounded-none border-0 border-b border-hair bg-transparent py-5 pe-14 ps-4 font-display text-[clamp(1.45rem,4vw,2.5rem)] font-semibold leading-[1.5] text-ink outline-none transition-colors placeholder:text-soft/45 focus:border-accent"
                />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.4rem] text-accent">⌕</span>
              </div>

              {!searchStarted && <div className="mt-7">
                <p className="mb-3 text-[.82rem] font-medium text-soft">أو ابدأ بمحور</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {suggestedTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => chooseTopic(topic)}
                      className={`min-h-11 border-b px-1 py-2 text-[.84rem] font-medium transition-colors ${
                        normalizedQuery === topic
                          ? 'border-accent text-accent'
                          : 'border-transparent text-soft hover:border-accent hover:text-accent'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>}

              {searchStarted && <div className="mt-7 border-t border-hair pt-5">
                <div className="rail flex gap-5 overflow-x-auto pb-1">
                  {categories.map((item) => (
                    <button
                      key={item}
                      onClick={() => { setCat(item); setVisibleCount(24) }}
                      className={`min-h-11 shrink-0 border-b px-1 py-2 text-[.84rem] font-medium transition-colors ${
                        cat === item ? 'border-accent text-accent' : 'border-transparent text-soft hover:border-accent hover:text-accent'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="rail mt-2 flex gap-5 overflow-x-auto pb-1">
                  {['الكل', ...years].map((item) => (
                    <button
                      key={item}
                      onClick={() => { setYear(item); setVisibleCount(24) }}
                      className={`min-h-11 shrink-0 border-b px-1 py-2 text-[.8rem] transition-colors ${
                        year === item ? 'border-accent text-accent' : 'border-transparent text-soft hover:border-accent hover:text-accent'
                      }`}
                    >
                      {item === 'الكل' ? 'كل السنوات' : ar(item)}
                    </button>
                  ))}
                </div>
              </div>}
            </div>
          </FadeUp>

          {searchStarted && <FadeUp delay={0.05}>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[.9rem] text-soft" aria-live="polite">
                {ar(results.length)} نتيجة
                <span> عن «{normalizedQuery}»</span>
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
          </FadeUp>}

          {searchStarted && <ul className="mt-8">
            {visibleResults.map((article, index) => (
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
          </ul>}

          {searchStarted && visibleCount < results.length && (
            <FadeUp>
              <div className="border-t border-hair pt-8 text-center">
                <button
                  onClick={() => setVisibleCount((count) => count + 24)}
                  className="rounded-full border border-accent px-7 py-3 text-[.9rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
                >
                  عرض ٢٤ نتيجة أخرى
                </button>
              </div>
            </FadeUp>
          )}

          {!searchStarted && (
            <FadeUp delay={0.05}>
              <div className="py-16 text-center md:py-20">
                <h2 className="font-display text-[clamp(1.35rem,3vw,1.8rem)] font-semibold text-ink">عمّ تبحث اليوم؟</h2>
                <p className="mx-auto mt-2 max-w-md text-[.9rem] leading-[1.8] text-soft">
                  اكتب حرفين على الأقل، أو اختر أحد المحاور المقترحة أعلاه.
                </p>
              </div>
            </FadeUp>
          )}

          {searchStarted && results.length === 0 && (
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
