import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { useCmsContent } from '../lib/content'
import { ideaWords } from '../lib/idea-life'
import { PROJECT_START_YEAR, getMinimumCompletedJourneyYears } from '../lib/project-meta'

const number = new Intl.NumberFormat('ar-KW-u-nu-latn')

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()

export default function ThoughtOverview() {
  const { articles, books, papers } = useCmsContent()
  useSeo({
    title: 'فكر د. أحمد في لقطة واحدة',
    path: '/thought',
    description: 'لوحة حيّة تلخّص محاور الكتابة والكتب والأبحاث وتحوّل الفكرة عبر السنوات، انطلاقاً من الأرشيف المنشور نفسه.',
  })

  const model = useMemo(() => {
    const dated = articles.filter((article) => /^(?:19|20)\d{2}/.test(article.iso))
    const years = [...new Set(dated.map((article) => article.iso.slice(0, 4)))].sort()
    const categories = [...dated.reduce((map, article) => {
      const key = article.cat || 'فكر عام'
      map.set(key, (map.get(key) || 0) + 1)
      return map
    }, new Map<string, number>()).entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ar'))

    const firstYear = String(PROJECT_START_YEAR)
    const latestYear = years[years.length - 1] || firstYear
    const midpoint = years[Math.max(0, Math.floor(years.length / 2))] || firstYear
    const periods = [
      { label: 'البداية', from: firstYear, to: midpoint },
      { label: 'الاتساع', from: midpoint, to: latestYear },
    ].map((period) => {
      const within = dated.filter((article) => article.iso.slice(0, 4) >= period.from && article.iso.slice(0, 4) <= period.to)
      const ranked = [...within.reduce((map, article) => {
        const key = article.cat || 'فكر عام'
        map.set(key, (map.get(key) || 0) + 1)
        return map
      }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])
      return { ...period, count: within.length, dominant: ranked[0]?.[0] || '—' }
    })

    const linked = dated.map((article) => {
      const source = new Set(ideaWords(`${article.title} ${article.excerpt || ''} ${article.cat || ''}`))
      const score = (value: string) => ideaWords(value).reduce((sum, word) => sum + (source.has(word) ? 1 : 0), 0)
      const book = books.map((item) => ({ item, score: score(`${item.title} ${item.desc || ''}`) })).sort((a, b) => b.score - a.score)[0]
      const paper = papers.map((item) => ({ item, score: score(`${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) })).sort((a, b) => b.score - a.score)[0]
      return {
        article,
        book: book?.score >= 2 ? book.item : null,
        paper: paper?.score >= 2 ? paper.item : null,
        strength: (book?.score || 0) + (paper?.score || 0),
      }
    })
    const strongest = linked.sort((a, b) => b.strength - a.strength || b.article.iso.localeCompare(a.article.iso))[0]

    const byCategoryYear = new Map<string, Map<string, number>>()
    for (const article of dated) {
      const category = article.cat || 'فكر عام'
      if (!byCategoryYear.has(category)) byCategoryYear.set(category, new Map())
      const year = article.iso.slice(0, 4)
      byCategoryYear.get(category)?.set(year, (byCategoryYear.get(category)?.get(year) || 0) + 1)
    }
    const evolution = [...byCategoryYear.entries()].map(([category, counts]) => {
      const activeYears = [...counts.entries()].filter(([, count]) => count > 0).sort((a, b) => a[0].localeCompare(b[0]))
      const first = activeYears[0]?.[1] || 0
      const last = activeYears[activeYears.length - 1]?.[1] || 0
      return { category, years: activeYears.length, total: [...counts.values()].reduce((sum, value) => sum + value, 0), growth: last - first }
    }).sort((a, b) => b.years - a.years || b.total - a.total)

    return {
      years,
      firstYear,
      latestYear,
      categories: categories.slice(0, 6),
      periods,
      recurring: evolution[0],
      evolving: [...evolution].sort((a, b) => b.growth - a.growth || b.years - a.years)[0],
      strongest,
    }
  }, [articles, books, papers])

  const maxCategory = Math.max(1, ...model.categories.map(([, count]) => count))

  return (
    <Page className="content-thought-overview page-journey">
      <PageHead
        label="الخريطة الفكرية"
        title="فكر د. أحمد في لقطة واحدة."
        sub={`لوحة تتولّد من الأرشيف المنشور نفسه: ما الذي تكرّر، وما الذي اتسع، وكيف اتصل المقال بالبحث والكتاب منذ بداية الرحلة العلمية عام 2015 حتى ${model.latestYear}.`}
      />

      <section className="px-6 py-14 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'سنوات الرحلة العلمية', value: `${getMinimumCompletedJourneyYears()}+`, note: `بدأت عام ${PROJECT_START_YEAR}` },
                { label: 'الكتب', value: number.format(books.length), note: 'مؤلفات علمية وفكرية منشورة' },
                { label: 'الأبحاث', value: number.format(papers.length), note: 'دراسات ومساهمات محكمة' },
                { label: 'المقالات', value: number.format(articles.length), note: 'نصوص منشورة داخل الأرشيف' },
              ].map((item) => (
                <div key={item.label} className="flex min-h-[132px] flex-col justify-between rounded-[1.5rem] border border-hair bg-paper p-4 sm:p-5">
                  <div>
                    <span className="text-[.68rem] font-semibold leading-relaxed text-accent">{item.label}</span>
                    <p className="mt-1 text-[.62rem] leading-relaxed text-soft">{item.note}</p>
                  </div>
                  <strong className="mt-4 block font-display text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-none text-ink">{item.value}</strong>
                </div>
              ))}
            </div>
          </FadeUp>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.12fr_.88fr]">
            <FadeUp delay={0.04}>
              <section className="h-full rounded-[1.75rem] border border-hair bg-canvas p-6 md:p-8" aria-labelledby="thought-themes-title">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[.7rem] font-semibold text-accent">المحاور الأكثر حضوراً</p>
                    <h2 id="thought-themes-title" className="mt-1 font-display text-2xl font-semibold text-ink">خريطة الحضور في الأرشيف</h2>
                  </div>
                  <span className="text-[.68rem] text-soft">بحسب عدد المواد المنشورة</span>
                </div>
                <ol className="mt-7 grid gap-4">
                  {model.categories.map(([category, count], index) => (
                    <li key={category}>
                      <div className="flex items-center justify-between gap-4 text-[.78rem]">
                        <span className="font-semibold text-ink">{String(index + 1).padStart(2, '0')} · {category}</span>
                        <span className="text-soft">{number.format(count)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash">
                        <span className="block h-full origin-right rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(9, count / maxCategory * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </FadeUp>

            <FadeUp delay={0.08}>
              <section className="h-full rounded-[1.75rem] border border-accent/25 bg-accent/[.045] p-6 md:p-8" aria-labelledby="thought-return-title">
                <p className="text-[.7rem] font-semibold text-accent">ما الذي بقي يعود؟</p>
                <h2 id="thought-return-title" className="mt-1 font-display text-2xl font-semibold text-ink">المحور الأكثر امتداداً</h2>
                <strong className="mt-7 block font-display text-4xl font-semibold leading-tight text-accent">{model.recurring?.category || '—'}</strong>
                <p className="mt-4 text-[.88rem] font-light leading-[1.9] text-soft">
                  ظهر هذا المحور في {number.format(model.recurring?.years || 0)} سنوات مختلفة داخل الأرشيف، ولذلك يُقرأ هنا بوصفه سؤالاً متجدداً لا موضوعاً عابراً.
                </p>
                <Link to={`/decade?idea=${encodeURIComponent(model.recurring?.category || '')}`} className="mt-6 inline-flex items-center gap-2 text-[.8rem] font-semibold text-accent">تتبّع رحلته عبر السنوات ←</Link>
              </section>
            </FadeUp>
          </div>

          <FadeUp delay={0.1}>
            <section className="mt-6 rounded-[1.75rem] border border-hair bg-paper p-6 md:p-8" aria-labelledby="thought-time-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[.7rem] font-semibold text-accent">الزمن لا الأرقام وحدها</p>
                  <h2 id="thought-time-title" className="mt-1 font-display text-2xl font-semibold text-ink">كيف تغيّر مركز الكتابة؟</h2>
                </div>
                <span className="rounded-full border border-hair bg-canvas px-4 py-2 text-[.72rem] text-soft">أكثر محور اتساعاً: <strong className="text-ink">{model.evolving?.category || '—'}</strong></span>
              </div>
              <div className="relative mt-9 grid gap-5 md:grid-cols-2 before:absolute before:right-4 before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-hair md:before:left-4 md:before:right-4 md:before:top-5 md:before:h-px md:before:w-auto">
                {model.periods.map((period, index) => (
                  <div key={period.label} className="relative ms-9 rounded-2xl border border-hair bg-canvas p-5 md:ms-0 md:mt-7">
                    <span className="absolute -right-[2.25rem] top-4 flex h-4 w-4 items-center justify-center rounded-full border border-accent/40 bg-paper md:-top-[2.2rem] md:right-4"><span className="h-1.5 w-1.5 rounded-full bg-accent" /></span>
                    <span className="text-[.68rem] font-semibold text-accent">{period.label} · {period.from}–{period.to}</span>
                    <strong className="mt-2 block font-display text-xl font-semibold text-ink">{period.dominant}</strong>
                    <p className="mt-2 text-[.78rem] leading-relaxed text-soft">{number.format(period.count)} مادة في هذه المرحلة.</p>
                  </div>
                ))}
              </div>
            </section>
          </FadeUp>

          {model.strongest && (
            <FadeUp delay={0.14}>
              <section className="mt-6 rounded-[1.75rem] border border-hair bg-canvas p-6 md:p-8" aria-labelledby="thought-relation-title">
                <p className="text-[.7rem] font-semibold text-accent">العلاقات الأقوى داخل المكتبة</p>
                <h2 id="thought-relation-title" className="mt-1 font-display text-2xl font-semibold text-ink">فكرة عبر أكثر من وسيط</h2>
                <div className="mt-7 grid gap-3 md:grid-cols-3">
                  <Link to={`/articles/${model.strongest.article.slug}`} className="rounded-2xl border border-hair bg-paper p-5 transition-colors hover:border-accent">
                    <span className="text-[.67rem] font-semibold text-accent">مقال · {model.strongest.article.iso.slice(0, 4)}</span>
                    <strong className="mt-2 block font-display text-[1rem] leading-[1.6] text-ink">{compact(model.strongest.article.title)}</strong>
                  </Link>
                  {model.strongest.paper ? <Link to={`/research/${model.strongest.paper.slug}`} className="rounded-2xl border border-hair bg-paper p-5 transition-colors hover:border-accent"><span className="text-[.67rem] font-semibold text-accent">بحث</span><strong className="mt-2 block font-display text-[1rem] leading-[1.6] text-ink">{model.strongest.paper.titleAr || model.strongest.paper.title}</strong></Link> : <div className="rounded-2xl border border-dashed border-hair p-5 text-[.78rem] text-soft">لا صلة بحثية قوية بما يكفي للعرض.</div>}
                  {model.strongest.book ? <Link to={`/publications/${model.strongest.book.slug}`} className="rounded-2xl border border-hair bg-paper p-5 transition-colors hover:border-accent"><span className="text-[.67rem] font-semibold text-accent">كتاب</span><strong className="mt-2 block font-display text-[1rem] leading-[1.6] text-ink">{model.strongest.book.title}</strong></Link> : <div className="rounded-2xl border border-dashed border-hair p-5 text-[.78rem] text-soft">لا صلة كتابية قوية بما يكفي للعرض.</div>}
                </div>
                <p className="mt-5 text-[.72rem] font-light leading-relaxed text-soft">هذه علاقات دلالية محسوبة من عناوين المواد وملخصاتها، وليست ادعاءً بأن عملاً اقتبس من آخر. يفتح كل عنصر مادته الأصلية للتحقق.</p>
              </section>
            </FadeUp>
          )}
        </div>
      </section>
    </Page>
  )
}
