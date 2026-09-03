import { useMemo } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { arabicCountPhrase, MATERIAL_FORMS } from '../../lib/arabic-count.ts'

const card = 'min-w-0 max-w-full overflow-hidden rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'

export function VisitorJourneySuggestion({ articles }: { articles: ArticleRecord[] }) {
  const paths = useMemo(() => {
    const groups = new Map<string, ArticleRecord[]>()
    for (const article of articles) {
      const key = article.cat || 'فكر عام'
      const list = groups.get(key) || []
      list.push(article)
      groups.set(key, list)
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([category, list]) => ({ category, first: list[0], next: list[1], count: list.length }))
  }, [articles])

  return (
    <section className={card} aria-labelledby="visitor-journey-suggestion-title">
      <div className="grid min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[.76rem] font-semibold uppercase text-accent">ذكاء رحلة الزائر</p>
          <h2 id="visitor-journey-suggestion-title" className="mt-2 font-display text-[1.3rem] font-semibold text-ink">اقتراح واحد هادئ يتكوّن من مسار القراءة.</h2>
          <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">يعتمد على آخر قراءة ومحور الاهتمام على جهاز الزائر، من دون ملف شخصي ومن دون إضافة بطاقات مزدحمة إلى الواجهة العامة.</p>
        </div>
        <span className="rounded-full border border-accent/25 bg-accent/[.06] px-3 py-1.5 text-[.72rem] font-semibold text-accent">فعّال</span>
      </div>
      <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-3">
        {paths.map((path) => (
          <div key={path.category} className="min-w-0 rounded-2xl border border-hair bg-canvas p-3 sm:p-4">
            <p className="text-[.72rem] font-semibold text-accent">{path.category} · {arabicCountPhrase(path.count, MATERIAL_FORMS)}</p>
            <p className="mt-2 font-display text-[.92rem] font-semibold leading-[1.55] text-ink">{path.first?.title}</p>
            {path.next && <p className="mt-2 text-[.74rem] leading-relaxed text-soft">ثم: {path.next.title}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
