import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { createIdeaDna } from '../lib/idea-dna'
import { ideaWords } from '../lib/idea-life'
import { bookArchiveDate, buildBookWorldTimeline } from '../lib/book-world-timeline'

function scoreAgainst(source: Set<string>, value: string) {
  return ideaWords(value).reduce((total, word) => total + (source.has(word) ? 1 : 0), 0)
}

function Disclosure({
  eyebrow,
  title,
  meta,
  children,
  lockOpen = false,
}: {
  eyebrow: string
  title: string
  meta?: string
  children: ReactNode
  lockOpen?: boolean
}) {
  return (
    <details
      className="group rounded-2xl border border-hair bg-canvas"
      onToggle={(event) => {
        if (lockOpen && !event.currentTarget.open) event.currentTarget.open = true
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <span className="min-w-0">
          <span className="block text-[.66rem] font-semibold text-accent">{eyebrow}</span>
          <strong className="mt-1 block text-[.9rem] leading-relaxed text-ink">{title}</strong>
          {meta && <span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{meta}</span>}
        </span>
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair text-[.9rem] text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-hair px-4 py-4 sm:px-5">{children}</div>
    </details>
  )
}

export function BookWorld({
  book,
  seed,
  articles,
  papers,
}: {
  book: BookRecord
  seed: string
  articles: ArticleRecord[]
  papers: PaperRecord[]
}) {
  const [activeIdea, setActiveIdea] = useState('')
  const model = useMemo(() => {
    const sourceText = `${book.title}\n${book.desc || ''}\n${seed || ''}`
    const source = new Set(ideaWords(sourceText))
    const archive = articles.map((item) => ({
      slug: item.slug,
      title: item.title,
      text: `${item.excerpt || ''} ${item.body || ''}`,
      iso: item.iso,
      year: item.year,
    }))
    const dna = createIdeaDna(sourceText, { context: `عالم كتاب: ${book.title}`, archive })

    const articleMatches = articles
      .map((item) => ({ item, score: scoreAgainst(source, `${item.title} ${item.excerpt || ''} ${item.cat || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || bookArchiveDate(b.item).localeCompare(bookArchiveDate(a.item)))

    const paperMatches = papers
      .map((item) => ({ item, score: scoreAgainst(source, `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)

    const candidateIdeas = Array.from(new Set([
      dna.topic.label,
      ...dna.keywords,
      ...articleMatches.slice(0, 5).flatMap(({ item }) => ideaWords(`${item.title} ${item.cat || ''}`).slice(0, 2)),
    ].map((item) => String(item || '').trim()).filter((item) => item.length >= 3 && item !== 'فكرة عامة')))

    const paths = candidateIdeas
      .map((idea) => {
        const words = new Set(ideaWords(idea))
        if (!words.size) return null
        const pathArticles = articles
          .map((item) => ({ item, score: scoreAgainst(words, `${item.title} ${item.excerpt || ''} ${item.cat || ''}`) }))
          .filter((row) => row.score > 0)
          .sort((a, b) => b.score - a.score || bookArchiveDate(b.item).localeCompare(bookArchiveDate(a.item)))
        const pathPapers = papers
          .map((item) => ({ item, score: scoreAgainst(words, `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) }))
          .filter((row) => row.score > 0)
          .sort((a, b) => b.score - a.score)
        if (!pathArticles.length && !pathPapers.length) return null
        return { idea, articles: pathArticles, papers: pathPapers }
      })
      .filter((row): row is { idea: string; articles: typeof articleMatches; papers: typeof paperMatches } => Boolean(row))
      .slice(0, 7)

    return {
      dna,
      paths,
      ideas: paths.map((path) => path.idea),
    }
  }, [articles, book.desc, book.title, papers, seed])

  const selectedIdea = activeIdea || model.ideas[0] || ''
  const activePath = useMemo(
    () => model.paths.find((path) => path.idea === selectedIdea) || model.paths[0] || null,
    [model.paths, selectedIdea],
  )
  const activeConnections = useMemo(() => ({
    articles: activePath?.articles.slice(0, 3) || [],
    papers: activePath?.papers.slice(0, 2) || [],
    timeline: activePath ? buildBookWorldTimeline(activePath.articles, 6) : [],
  }), [activePath])

  useEffect(() => {
    if (activeIdea && !model.ideas.includes(activeIdea)) setActiveIdea('')
  }, [activeIdea, model.ideas])

  if (!model.paths.length) return null

  return (
    <section className="border-t border-hair bg-wash px-6 py-12 md:px-11 md:py-16" aria-labelledby="book-world-title">
      <div className="mx-auto max-w-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <span className="text-[.7rem] font-semibold uppercase tracking-[.08em] text-accent">عالم الكتاب</span>
            <h2 id="book-world-title" className="mt-2 font-display text-[clamp(1.55rem,3vw,2.2rem)] font-semibold leading-[1.35] text-ink">امتدادات الكتاب داخل الأرشيف</h2>
            <p className="mt-2 text-[.82rem] leading-[1.8] text-soft">خريطة موثقة من المواد المنشورة فعلاً. كل الأقسام مطوية افتراضياً حتى يبقى الكتاب هو العنصر الرئيسي.</p>
          </div>
          <Link to={`/thought-paths?idea=${encodeURIComponent(book.title)}`} className="rounded-full border border-accent/35 px-4 py-2 text-[.74rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">المسار الفكري الكامل ←</Link>
        </div>

        <div className="mt-6 grid gap-3">
          {model.ideas.length > 0 && <Disclosure
            eyebrow={`Idea DNA · ${model.dna.fingerprint.replace('idea-', '').toUpperCase()}`}
            title="بصمة الكتاب ومساراته الفكرية"
            meta={`${model.dna.topic.label} · ${model.dna.tone.label} · عمق ${model.dna.depth.score}% · دليل ${model.dna.evidence.score}%`}
            lockOpen={Boolean(activeIdea)}
          >
            <div className="flex flex-wrap gap-2" aria-label="مسارات أفكار الكتاب">
              {model.ideas.map((idea, index) => {
                const active = selectedIdea === idea
                return (
                  <button
                    type="button"
                    key={`${idea}-${index}`}
                    onClick={() => setActiveIdea(idea)}
                    aria-pressed={active}
                    className={`rounded-full border px-3.5 py-2 text-[.7rem] transition-colors ${active ? 'border-accent bg-accent/[.07] font-semibold text-accent' : 'border-hair bg-wash text-ink hover:border-accent/40'}`}
                  >
                    {idea}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 border-t border-hair pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[.68rem] text-soft">البوابة النشطة · «{selectedIdea}»</span>
                <span className="text-[.64rem] text-soft">{model.dna.audience.primary}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeConnections.articles.map(({ item }) => (
                  <Link key={`active-a-${item.slug}`} to={`/articles/${item.slug}`} className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.66rem] text-ink transition-colors hover:border-accent hover:text-accent">مقال · {item.title}</Link>
                ))}
                {activeConnections.papers.map(({ item }) => (
                  <Link key={`active-p-${item.slug}`} to={`/research/${item.slug}`} className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.66rem] text-ink transition-colors hover:border-accent hover:text-accent">بحث · {item.titleAr || item.title}</Link>
                ))}
              </div>
            </div>
          </Disclosure>}

          {activePath && <Disclosure eyebrow="استمرار الفكرة" title="مواد قريبة في المقالات والأبحاث" meta="صلة موضوعية فقط؛ لا نفترض أنها فصول من الكتاب.">
            <div className="grid gap-2">
              {activeConnections.articles.map(({ item, score }) => (
                <Link key={item.slug} to={`/articles/${item.slug}`} className="group grid gap-1 rounded-xl border border-hair px-3.5 py-3 transition-colors hover:border-accent/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    <strong className="block text-[.8rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{item.title}</strong>
                    <span className="mt-1 block text-[.66rem] text-soft">{bookArchiveDate(item) || 'مقال من الأرشيف'}</span>
                  </span>
                  <span className="w-fit rounded-full bg-wash px-2.5 py-1 text-[.62rem] text-soft">صلة {score}</span>
                </Link>
              ))}
              {activeConnections.papers.map(({ item, score }) => (
                <Link key={item.slug} to={`/research/${item.slug}`} className="group grid gap-1 rounded-xl border border-hair px-3.5 py-3 transition-colors hover:border-accent/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <strong className="text-[.8rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{item.titleAr || item.title}</strong>
                  <span className="w-fit rounded-full bg-wash px-2.5 py-1 text-[.62rem] text-soft">صلة {score}</span>
                </Link>
              ))}
            </div>
          </Disclosure>}

          {activeConnections.timeline.length > 0 && <Disclosure eyebrow="الزمن داخل الأرشيف" title="امتدادات مؤرخة للفكرة" meta="يختار أقوى محطة من كل سنة ويوزّعها على كامل عمر الأرشيف؛ لا يثبت على أحدث سنة.">
            <div className="grid gap-1">
              {activeConnections.timeline.map(({ item, year, date }) => (
                <Link key={`${item.slug}-${year}`} to={`/articles/${item.slug}`} className="grid gap-1 rounded-xl px-2 py-2.5 transition-colors hover:bg-wash sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
                  <span className="text-[.68rem] font-semibold text-accent">{date || year}</span>
                  <span className="text-[.76rem] leading-relaxed text-ink">{item.title}</span>
                </Link>
              ))}
            </div>
          </Disclosure>}
        </div>
      </div>
    </section>
  )
}
