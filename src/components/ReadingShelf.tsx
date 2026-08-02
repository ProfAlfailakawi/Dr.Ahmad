import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { ArticleRecord } from '../lib/cms'
import { isArticleSaved, toggleSavedArticle } from '../lib/reading-space'
import { matchBookQuotes, searchBookPassages } from '../lib/book-quotes'
import { searchMediaChapters, stamp } from '../lib/media-chapters'

/**
 * الرفّ الشخصي — من نتيجة بحثٍ إلى خطة قراءة.
 *
 * الفكرة: الزائر يبحث فيحصل على قائمة؛ والمعلّم يحتاج **ترتيباً**: بمَ يبدأ،
 * وبمَ يثنّي، وأين يقف. هذا القسم يرتّب المواد تدريجياً — من الأقصر إلى
 * الأعمق — ويجعلها قابلةً للطباعة والحفظ في «مساحتي».
 *
 * لا يخترع محتوى: يرتّب ما ظهر في البحث فعلاً.
 */

type Step = {
  order: number
  kind: string
  title: string
  note: string
  to?: string
  href?: string
}

export function ReadingShelf({ query, articles }: { query: string; articles: ArticleRecord[] }) {
  const [saved, setSaved] = useState(false)

  const steps = useMemo<Step[]>(() => {
    if (query.trim().length < 2) return []
    const list: Step[] = []

    /* ١) مقالان قصيران أولاً: مدخلٌ لا يرهق. */
    for (const article of articles.slice(0, 2)) {
      list.push({
        order: list.length + 1,
        kind: 'مقال',
        title: article.title,
        note: 'مدخلٌ قصير إلى الفكرة',
        to: `/articles/${article.slug}`,
      })
    }

    /* ٢) لحظةٌ مسموعة: يسمع صوته في الموضوع قبل أن يتعمّق. */
    const chapter = searchMediaChapters(query, 1)[0]
    if (chapter) {
      list.push({
        order: list.length + 1,
        kind: 'لقاء',
        title: `${chapter.title} · نحو ${stamp(chapter.chapter.at)}`,
        note: 'يسمع الفكرة بصوته قبل أن يقرأ عنها',
        to: `/media/media-${chapter.videoId}`,
      })
    }

    /* ٣) ثم المتن: أعمق الطبقات وأثقلها — يُختم بها لا يُبدأ. */
    const deep = searchBookPassages(query, 2)
    const fallback = deep.length ? deep : matchBookQuotes(query, 2)
    for (const match of fallback) {
      list.push({
        order: list.length + 1,
        kind: 'كتاب',
        title: `${match.bookTitle} · ص ${match.quote.page}`,
        note: match.quote.conceptTitle || 'المحور في متن الكتاب',
        to: `/publications/${match.bookSlug}#book-knowledge`,
      })
    }

    return list.length >= 2 ? list : []
  }, [articles, query])

  if (!steps.length) return null

  /* toggleSavedArticle يقلب الحالة: استدعاؤه على محفوظٍ يحذفه. لذلك نضيف
     غير المحفوظ فقط — الحفظ لا يجوز أن يمحو ما حفظه الزائر قبلُ. */
  const saveAll = () => {
    for (const article of articles.slice(0, 2)) {
      if (!isArticleSaved(article.slug)) toggleSavedArticle(article)
    }
    setSaved(true)
  }

  return (
    <section className="mt-10 rounded-2xl border border-hair bg-wash px-5 py-5 md:px-7 md:py-6" aria-labelledby="reading-shelf-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[.7rem] font-semibold uppercase tracking-[.08em] text-accent">رفّك</span>
          <h2 id="reading-shelf-title" className="mt-1 font-display text-[1.15rem] font-semibold leading-[1.4] text-ink">
            خطة قراءة عن «{query}»
          </h2>
          <p className="mt-1 text-[.76rem] leading-relaxed text-soft">مرتّبة من الأقصر إلى الأعمق: مقالٌ يفتح، ولقاءٌ يقرّب، ومتنٌ يُرسّخ.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveAll}
            className="rounded-full border border-accent/35 px-4 py-2 text-[.72rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
          >
            {saved ? 'حُفظت في مساحتي ✓' : 'احفظ في مساحتي'}
          </button>
          <Link
            to={`/concept/${encodeURIComponent(query)}`}
            className="rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            سيرة المفهوم
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            اطبع الخطة
          </button>
        </div>
      </div>

      <ol className="mt-5 grid gap-2">
        {steps.map((step) => (
          <li key={`${step.order}-${step.title}`}>
            <Link
              to={step.to || '/'}
              className="group grid gap-2 rounded-xl border border-hair bg-canvas px-4 py-3 transition-colors hover:border-accent/45 sm:grid-cols-[2.2rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-[.72rem] font-semibold text-accent">{step.order}</span>
              <span className="min-w-0">
                <strong className="block text-[.84rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{step.title}</strong>
                <span className="mt-0.5 block text-[.68rem] text-soft">{step.note}</span>
              </span>
              <span className="w-fit rounded-full bg-wash px-2.5 py-1 text-[.62rem] text-soft">{step.kind}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
