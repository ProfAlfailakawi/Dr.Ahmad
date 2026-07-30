import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { createIdeaDna } from '../lib/idea-dna'
import { ideaWords } from '../lib/idea-life'

const compact = (value = '', max = 220) => {
  const clean = String(value).replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const boundary = Math.max(cut.lastIndexOf('،'), cut.lastIndexOf(' '))
  return `${cut.slice(0, boundary > max * .7 ? boundary : max).trim()}…`
}

function scoreAgainst(source: Set<string>, value: string) {
  return ideaWords(value).reduce((total, word) => total + (source.has(word) ? 1 : 0), 0)
}

function yearOf(value?: string) {
  return String(value || '').match(/(?:19|20)\d{2}/)?.[0] || ''
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
    const archive = articles.map((item) => ({ slug: item.slug, title: item.title, text: `${item.excerpt || ''} ${item.body || ''}`, iso: item.iso, year: item.year }))
    const dna = createIdeaDna(sourceText, { context: `عالم كتاب: ${book.title}`, archive })

    const articleMatches = articles
      .map((item) => ({ item, score: scoreAgainst(source, `${item.title} ${item.excerpt || ''} ${item.cat || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || String(b.item.iso || '').localeCompare(String(a.item.iso || '')))

    const paperMatches = papers
      .map((item) => ({ item, score: scoreAgainst(source, `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)

    const ideas = Array.from(new Set([
      dna.topic.label,
      ...dna.keywords,
      ...articleMatches.slice(0, 5).flatMap(({ item }) => ideaWords(`${item.title} ${item.cat || ''}`).slice(0, 2)),
    ].map((item) => String(item || '').trim()).filter((item) => item.length >= 3 && item !== 'فكرة عامة'))).slice(0, 7)

    while (ideas.length < 7) {
      const fallback = ['السؤال المركزي', 'التطبيق', 'الإنسان', 'التعليم', 'المستقبل', 'القرار', 'الأثر'][ideas.length]
      if (!ideas.includes(fallback)) ideas.push(fallback)
      else break
    }

    const timeline = articleMatches
      .map(({ item, score }) => ({ item, score, year: yearOf(item.iso || item.year) }))
      .filter((row) => row.year)
      .sort((a, b) => a.year.localeCompare(b.year) || a.item.title.localeCompare(b.item.title))
      .slice(-6)

    return {
      dna,
      ideas,
      articles: articleMatches.slice(0, 4),
      papers: paperMatches.slice(0, 3),
      timeline,
      echoes: articleMatches.filter(({ item }) => item.excerpt?.trim()).slice(0, 2),
    }
  }, [articles, book.desc, book.slug, book.title, papers, seed])

  const selectedIdea = activeIdea || model.ideas[0] || ''
  const selectedWords = useMemo(() => new Set(ideaWords(selectedIdea)), [selectedIdea])
  const activeConnections = useMemo(() => {
    if (!selectedWords.size) return { articles: model.articles.slice(0, 2), papers: model.papers.slice(0, 1) }
    const articleRows = articles
      .map((item) => ({ item, score: scoreAgainst(selectedWords, `${item.title} ${item.excerpt || ''} ${item.cat || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
    const paperRows = papers
      .map((item) => ({ item, score: scoreAgainst(selectedWords, `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
    return { articles: articleRows, papers: paperRows }
  }, [articles, model.articles, model.papers, papers, selectedWords])

  return (
    <section className="border-t border-hair bg-wash px-6 py-14 md:px-11 md:py-20" aria-labelledby="book-world-title">
      <div className="mx-auto max-w-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <span className="text-[.72rem] font-semibold uppercase tracking-[.08em] text-accent">Book World · عالم الكتاب</span>
            <h2 id="book-world-title" className="mt-2 font-display text-[clamp(1.7rem,3.4vw,2.5rem)] font-semibold leading-[1.35] text-ink">الكتاب ليس كرتاً؛ هذه خريطة الأفكار التي يفتحها داخل الأرشيف.</h2>
            <p className="mt-3 text-[.84rem] leading-[1.85] text-soft">الخريطة مشتقة من وصف الكتاب ومن المواد المنشورة فعلاً في الموقع. لا تفترض فصولاً أو اقتباسات غير متاحة، بل تكشف الامتدادات الموثقة حول فكرته.</p>
          </div>
          <Link to={`/thought-paths?idea=${encodeURIComponent(book.title)}`} className="rounded-full border border-accent/35 px-4 py-2 text-[.76rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">افتح المسار الفكري الكامل ←</Link>
        </div>

        <div className="mt-8 rounded-3xl border border-accent/20 bg-canvas p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[.66rem] font-semibold uppercase text-accent">Idea DNA · {model.dna.fingerprint.replace('idea-', '').toUpperCase()}</span>
              <p className="mt-1 text-[.78rem] text-soft">{model.dna.topic.label} · {model.dna.tone.label} · عمق {model.dna.depth.score}% · دليل {model.dna.evidence.score}%</p>
            </div>
            <span className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.68rem] text-soft">{model.dna.audience.primary}</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="سبع بوابات لأفكار الكتاب">
            {model.ideas.map((idea, index) => {
              const active = selectedIdea === idea
              return (
                <button type="button" key={`${idea}-${index}`} onClick={() => setActiveIdea(idea)} aria-pressed={active} className={`min-h-28 rounded-2xl border p-3.5 text-right transition-all ${active ? 'border-accent bg-accent/[.07] shadow-[0_12px_30px_rgba(33,58,86,.08)]' : 'border-hair bg-wash hover:border-accent/40'}`}>
                  <span className="text-[.62rem] font-semibold text-accent">0{index + 1}</span>
                  <strong className="mt-5 block text-[.78rem] leading-[1.65] text-ink">{idea}</strong>
                  <span className={`mt-2 block text-[.6rem] ${active ? 'text-accent' : 'text-soft'}`}>{active ? 'البوابة النشطة' : 'استكشف هذا المسار'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-accent/20 bg-canvas p-4 sm:p-5" data-book-world-active-idea="true">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><span className="text-[.64rem] font-semibold text-accent">البوابة النشطة</span><strong className="mt-1 block text-[.9rem] text-ink">{selectedIdea}</strong></div>
            <span className="text-[.62rem] text-soft">اضغط أي فكرة أعلاه لتتغير الوصلات أمامك فوراً</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeConnections.articles.map(({ item, score }) => <Link key={`active-a-${item.slug}`} to={`/articles/${item.slug}`} className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.66rem] text-ink transition-colors hover:border-accent hover:text-accent">مقال · {item.title} <span className="text-soft">({score})</span></Link>)}
            {activeConnections.papers.map(({ item, score }) => <Link key={`active-p-${item.slug}`} to={`/research/${item.slug}`} className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.66rem] text-ink transition-colors hover:border-accent hover:text-accent">بحث · {item.titleAr || item.title} <span className="text-soft">({score})</span></Link>)}
            {!activeConnections.articles.length && !activeConnections.papers.length && <span className="text-[.68rem] text-soft">هذه البوابة لا تملك وصلة أرشيفية قوية بعد؛ ستتوسع تلقائياً مع نمو الموقع.</span>}
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl border border-hair bg-canvas p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[.68rem] font-semibold text-accent">استمرار الفكرة</span>
                <h3 className="mt-1 font-display text-xl font-semibold text-ink">مواد لاحقة وقريبة في الأرشيف</h3>
              </div>
              <span className="text-[.66rem] text-soft">صلة موضوعية، لا ترتيب فصول</span>
            </div>
            <div className="mt-4 grid gap-2">
              {model.articles.map(({ item, score }) => (
                <Link key={item.slug} to={`/articles/${item.slug}`} className="group grid gap-1 rounded-xl border border-hair px-4 py-3 transition-colors hover:border-accent/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    <strong className="block truncate text-[.86rem] text-ink transition-colors group-hover:text-accent">{item.title}</strong>
                    <span className="mt-1 block text-[.68rem] text-soft">{item.date || item.iso || 'مقال من الأرشيف'}</span>
                  </span>
                  <span className="w-fit rounded-full bg-wash px-2.5 py-1 text-[.64rem] text-soft">صلة {score}</span>
                </Link>
              ))}
              {model.papers.map(({ item, score }) => (
                <Link key={item.slug} to={`/research/${item.slug}`} className="group grid gap-1 rounded-xl border border-hair px-4 py-3 transition-colors hover:border-accent/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    <strong className="block truncate text-[.84rem] text-ink transition-colors group-hover:text-accent">{item.titleAr || item.title}</strong>
                    <span className="mt-1 block text-[.68rem] text-soft">بحث قريب من عالم الكتاب</span>
                  </span>
                  <span className="w-fit rounded-full bg-wash px-2.5 py-1 text-[.64rem] text-soft">صلة {score}</span>
                </Link>
              ))}
              {!model.articles.length && !model.papers.length && <p className="rounded-xl border border-hair p-4 text-[.8rem] leading-relaxed text-soft">لا توجد مادة منشورة ذات صلة كافية حتى الآن. سيكبر هذا العالم تلقائياً مع نمو الأرشيف.</p>}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-3xl border border-hair bg-canvas p-5 sm:p-6">
              <span className="text-[.68rem] font-semibold text-accent">أصداء موثقة</span>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">كيف تعود الفكرة بصيغ أخرى؟</h3>
              <div className="mt-4 grid gap-3">
                {model.echoes.map(({ item }) => (
                  <blockquote key={item.slug} className="rounded-xl border-r-2 border-accent/45 bg-wash px-4 py-3">
                    <p className="text-[.78rem] leading-[1.8] text-ink/80">{compact(item.excerpt, 210)}</p>
                    <Link to={`/articles/${item.slug}`} className="mt-2 block text-[.66rem] font-semibold text-accent">صدى من مقال: {item.title}</Link>
                  </blockquote>
                ))}
                {!model.echoes.length && <p className="text-[.78rem] leading-relaxed text-soft">لا يوجد مقتطف أرشيفي مناسب بعد.</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-hair bg-canvas p-5 sm:p-6">
              <span className="text-[.68rem] font-semibold text-accent">الزمن داخل الأرشيف</span>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">امتدادات مؤرخة للفكرة</h3>
              <div className="mt-4 grid gap-2">
                {model.timeline.map(({ item, year }) => (
                  <Link key={`${item.slug}-${year}`} to={`/articles/${item.slug}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-wash">
                    <span className="font-display text-[.78rem] font-semibold text-accent">{year}</span>
                    <span className="text-[.76rem] leading-relaxed text-ink">{item.title}</span>
                  </Link>
                ))}
                {!model.timeline.length && <p className="text-[.78rem] leading-relaxed text-soft">ستظهر هنا الامتدادات الزمنية حين تتوافر مواد مؤرخة مرتبطة بما يكفي.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
