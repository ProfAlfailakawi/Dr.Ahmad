import { useState } from 'react'
import { Link } from 'react-router'
import nextBook from '../../data/next-book.json' with { type: 'json' }
import { arabicCountPhrase, ARTICLE_AFTER_PREPOSITION_FORMS, ARTICLE_PLAIN_FORMS, BOOK_AFTER_PREPOSITION_FORMS } from '../../lib/arabic-count.ts'

/**
 * الكتاب العاشر — ما لم يُجمع بعد.
 *
 * ليست ميزةً للزوار؛ هي رسالة الموقع إلى صاحبه: «هذه محاورٌ كتبتَ فيها
 * عشر سنوات ولم تجمعها في كتاب». والفهرس تحتها مبنيّ من مقالاته هو، مرتّباً
 * زمنياً — فيبدأ من مسوّدة لا من ورقة بيضاء.
 *
 * الحساب كله في scripts/next-book.mjs، وهذا عرضٌ له فقط.
 */

type Chapter = { theme: string; articles: { slug: string; title: string; year: string }[] }
type Cluster = {
  seed: string
  articles: number
  span: { from: number; to: number } | null
  bookCoverage: number
  verdict: string
  chapters: Chapter[]
}

const file = nextBook as { builtFrom?: { articles: number; books: number }; clusters?: Cluster[] }
const clusters = file.clusters || []

export function NextBookCard() {
  const [open, setOpen] = useState('')

  if (!clusters.length) return null

  return (
    <section className="rounded-2xl border border-hair bg-canvas p-5 md:p-6" aria-labelledby="next-book-title">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="text-[.7rem] font-semibold uppercase tracking-[.08em] text-accent">الكتاب العاشر</span>
          <h2 id="next-book-title" className="mt-1 font-display text-[1.2rem] font-semibold text-ink">ما لم تجمعه في كتابٍ بعد</h2>
        </div>
        <span className="text-[.68rem] text-soft">
          من {arabicCountPhrase(file.builtFrom?.articles || 0, ARTICLE_AFTER_PREPOSITION_FORMS)} مقابل {arabicCountPhrase(file.builtFrom?.books || 0, BOOK_AFTER_PREPOSITION_FORMS)}
        </span>
      </header>

      <div className="mt-5 grid gap-3">
        {clusters.map((cluster) => {
          const expanded = open === cluster.seed
          return (
            <div key={cluster.seed} className="rounded-xl border border-hair bg-wash">
              <button
                type="button"
                onClick={() => setOpen(expanded ? '' : cluster.seed)}
                aria-expanded={expanded}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-right"
              >
                <span className="min-w-0">
                  <strong className="block text-[.95rem] text-ink">«{cluster.seed}»</strong>
                  <span className="mt-0.5 block text-[.68rem] text-soft">
                    {arabicCountPhrase(cluster.articles, ARTICLE_PLAIN_FORMS)}{cluster.span ? ` · ${cluster.span.from}–${cluster.span.to}` : ''} · {cluster.verdict}
                  </span>
                </span>
                <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform ${expanded ? 'rotate-45' : ''}`}>+</span>
              </button>

              {expanded && (
                <div className="border-t border-hair px-4 py-4">
                  <ol className="grid gap-4">
                    {cluster.chapters.map((chapter, index) => (
                      <li key={`${chapter.theme}-${index}`}>
                        <p className="text-[.76rem] font-semibold text-accent">
                          الفصل {index + 1} · {chapter.theme}
                          <span className="mr-2 font-normal text-soft">{arabicCountPhrase(chapter.articles.length, ARTICLE_PLAIN_FORMS)}</span>
                        </p>
                        <ul className="mt-1.5 grid gap-1">
                          {chapter.articles.map((article) => (
                            <li key={article.slug} className="grid gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:items-baseline">
                              <span className="text-[.68rem] tabular-nums text-soft">{article.year}</span>
                              <Link to={`/articles/${article.slug}`} className="text-[.82rem] leading-relaxed text-ink transition-colors hover:text-accent">
                                {article.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 border-t border-hair pt-3 text-[.7rem] leading-relaxed text-soft">
        تحليلٌ آليّ للفجوة بين مقالاتك ومتون كتبك. العناوين والفصول مأخوذة من كلماتك أنت — لا اقتراح موضوعٍ من خارجك.
      </p>
    </section>
  )
}
