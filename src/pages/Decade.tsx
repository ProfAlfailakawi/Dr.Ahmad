import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSeo } from '../components/seo'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import type { ArticleRecord } from '../lib/cms'

const number = new Intl.NumberFormat('ar-KW-u-nu-latn')

type YearChapter = {
  year: number
  articles: ArticleRecord[]
  dominant: string
  representative?: ArticleRecord
}

function dominantCategory(items: ArticleRecord[]) {
  const counts = new Map<string, number>()
  items.forEach((article) => counts.set(article.cat, (counts.get(article.cat) || 0) + 1))
  return Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))[0]?.[0] || ''
}

function representative(items: ArticleRecord[], dominant = dominantCategory(items)) {
  return [...items].sort((left, right) => {
    const score = (article: ArticleRecord) =>
      (article.cat === dominant ? 80 : 0)
      + (article.body ? 20 : 0)
      + (article.source ? 8 : 0)
      + Math.min(article.words, 2400) / 120
    return score(right) - score(left) || right.iso.localeCompare(left.iso)
  })[0]
}

function chapterRange(chapters: YearChapter[]) {
  if (!chapters.length) return ''
  return chapters.length === 1
    ? String(chapters[0].year)
    : `${chapters[0].year}–${chapters[chapters.length - 1].year}`
}

export default function Decade() {
  const { articles, loading } = useCmsContent()
  useSeo({
    title: 'وثيقة العقد',
    path: '/decade',
    description: 'سيرة فكرية حيّة تُعيد قراءة عشر سنوات من المقالات: التحولات، والموضوعات الأكثر حضوراً، والنصوص الممثلة لكل مرحلة.',
  })

  const document = useMemo(() => {
    const dated = articles.filter((article) => /^(?:19|20)\d{2}/.test(article.iso))
    if (!dated.length) return null

    // النطاق الكامل من أول مقال فعلي إلى آخره — يتجدّد تلقائياً مع أي إضافة (لا يبدأ من latestYear-9)
    const allYears = dated.map((article) => Number(article.iso.slice(0, 4)))
    const latestYear = Math.max(...allYears)
    const firstYear = Math.min(...allYears)
    const span = latestYear - firstYear + 1
    const decadeArticles = dated
    const chapters: YearChapter[] = Array.from({ length: span }, (_, offset) => {
      const year = firstYear + offset
      const yearArticles = decadeArticles.filter((article) => Number(article.iso.slice(0, 4)) === year)
      const dominant = dominantCategory(yearArticles)
      return { year, articles: yearArticles, dominant, representative: representative(yearArticles, dominant) }
    })

    const categoryCounts = Array.from(decadeArticles.reduce((map, article) => {
      map.set(article.cat, (map.get(article.cat) || 0) + 1)
      return map
    }, new Map<string, number>())).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))

    const slices = [chapters.slice(0, 3), chapters.slice(3, 6), chapters.slice(6)]
    const stages = slices.map((stage, index) => {
      const stageArticles = stage.flatMap((chapter) => chapter.articles)
      const dominant = dominantCategory(stageArticles)
      return {
        label: `الفصل ${['الأول', 'الثاني', 'الثالث'][index]}`,
        range: chapterRange(stage),
        count: stageArticles.length,
        dominant,
        article: representative(stageArticles, dominant),
      }
    })

    const growth = chapters.slice(1).map((chapter, index) => ({
      chapter,
      previous: chapters[index],
      delta: chapter.articles.length - chapters[index].articles.length,
    })).sort((a, b) => b.delta - a.delta)[0]

    const themeShifts = chapters.slice(1).map((chapter, index) => ({ chapter, previous: chapters[index] }))
      .filter(({ chapter, previous }) => chapter.dominant && previous.dominant && chapter.dominant !== previous.dominant)
    const themeShift = themeShifts[themeShifts.length - 1]

    const firstActive = chapters.find((chapter) => chapter.articles.length > 0)
    const turns = [
      firstActive && {
        year: firstActive.year,
        title: 'بداية نافذة العقد',
        description: `يظهر في الأرشيف ${number.format(firstActive.articles.length)} ${firstActive.articles.length === 1 ? 'نص' : 'نصوص'}، وكان «${firstActive.dominant}» الموضوع الأكثر حضوراً.`,
      },
      growth && growth.delta > 0 && {
        year: growth.chapter.year,
        title: 'اتساع في الإنتاج',
        description: `ارتفع عدد المقالات من ${number.format(growth.previous.articles.length)} إلى ${number.format(growth.chapter.articles.length)} مقارنةً بالعام السابق.`,
      },
      themeShift && {
        year: themeShift.chapter.year,
        title: 'تحوّل في مركز الاهتمام',
        description: `تغيّر الموضوع الأكثر حضوراً في الأرشيف السنوي من «${themeShift.previous.dominant}» إلى «${themeShift.chapter.dominant}».`,
      },
    ].filter(Boolean) as { year: number; title: string; description: string }[]

    return {
      firstYear,
      latestYear,
      span,
      articles: decadeArticles,
      chapters,
      categories: categoryCounts,
      stages,
      turns,
    }
  }, [articles])

  return (
    <Page>
      <PageHead
        label="السيرة الفكرية الحيّة"
        title="وثيقة العقد."
        sub="ليست سيرة وظائف ومناصب؛ بل قراءة تتولّد من الأرشيف نفسه: أين بدأ السؤال، ومتى اتسع، وما الذي بقي يُلحّ عاماً بعد عام."
      />

      {loading && !document ? (
        <div className="px-6 py-24 text-center text-soft">تُقرأ خيوط الأرشيف…</div>
      ) : !document ? (
        <div className="px-6 py-24 text-center text-soft">لا توجد مقالات مؤرخة تكفي لبناء الوثيقة بعد.</div>
      ) : (
        <>
          <section className="border-b border-hair px-6 py-14 md:px-11 md:py-20">
            <div className="mx-auto max-w-shell">
              <FadeUp>
                <p className="max-w-3xl font-display text-[clamp(1.35rem,3vw,2rem)] font-medium leading-[1.8] text-ink">
                  من {document.firstYear} إلى {document.latestYear}: {document.span === 10 ? 'عشر سنوات' : `${number.format(document.span)} سنة`} تقرأ نفسها من خلال {number.format(document.articles.length)} مقالاً، لا لتختصر الفكرة في رقم، بل لتكشف حركتها.
                </p>
                <p className="mt-5 max-w-2xl text-[.86rem] font-light leading-[1.9] text-soft">
                  تُحدَّث هذه الصفحة تلقائياً مع كل إضافة أو تعديل في لوحة المحتوى. واختيار النص الممثل يعتمد على اكتماله وحضور موضوع المرحلة، لا على ادعاء أنه الأكثر قراءة.
                </p>
              </FadeUp>
            </div>
          </section>

          <section className="border-b border-hair px-6 py-16 md:px-11 md:py-24">
            <div className="mx-auto max-w-shell">
              <FadeUp>
                <span className="text-[.78rem] font-semibold text-accent">ثلاثة فصول</span>
                <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] font-bold text-ink">كيف تحرّكت الكتابة؟</h2>
              </FadeUp>
              <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-hair bg-hair lg:grid-cols-3">
                {document.stages.map((stage, index) => (
                  <FadeUp key={stage.range} delay={index * 0.06} className="bg-canvas p-7 md:p-8">
                    <div className="flex items-center justify-between gap-4 text-[.76rem]">
                      <span className="font-semibold text-accent">{stage.label}</span>
                      <span className="text-soft">{stage.range}</span>
                    </div>
                    <p className="mt-5 text-[.82rem] text-soft">{number.format(stage.count)} مقالاً · الأبرز موضوعياً: {stage.dominant || '—'}</p>
                    {stage.article ? (
                      <Link to={`/articles/${stage.article.slug}`} className="group mt-5 block border-t border-hair pt-5">
                        <span className="text-[.72rem] text-soft">أبرز مقال في هذه المرحلة</span>
                        <strong className="mt-2 block font-display text-[1.12rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">
                          {stage.article.title}
                        </strong>
                        <span className="mt-3 inline-block text-[.76rem] font-semibold text-accent">اقرأ النص ←</span>
                      </Link>
                    ) : (
                      <p className="mt-5 border-t border-hair pt-5 text-[.82rem] text-soft">لا توجد مادة مؤرخة في هذا الفصل.</p>
                    )}
                  </FadeUp>
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-hair px-6 py-16 md:px-11 md:py-24">
            <div className="mx-auto grid max-w-shell gap-16 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <FadeUp>
                  <span className="text-[.78rem] font-semibold text-accent">الموضوعات المُلحّة</span>
                  <h2 className="mt-3 font-display text-[clamp(1.7rem,3.5vw,2.5rem)] font-bold text-ink">ما الذي عاد أكثر؟</h2>
                </FadeUp>
                <div className="mt-8 space-y-5">
                  {document.categories.slice(0, 6).map(([category, count], index) => {
                    const maximum = document.categories[0]?.[1] || 1
                    return (
                      <FadeUp key={category} delay={Math.min(index * 0.04, 0.2)}>
                        <div className="flex items-center justify-between gap-4 text-[.84rem]">
                          <span className="font-medium text-ink">{category}</span>
                          <span className="text-soft">{number.format(count)}</span>
                        </div>
                        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-hair">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(5, (count / maximum) * 100)}%` }} />
                        </div>
                      </FadeUp>
                    )
                  })}
                </div>
              </div>

              <div>
                <FadeUp>
                  <span className="text-[.78rem] font-semibold text-accent">منعطفات قابلة للقياس</span>
                  <h2 className="mt-3 font-display text-[clamp(1.7rem,3.5vw,2.5rem)] font-bold text-ink">حين تغيّرت الإشارة.</h2>
                </FadeUp>
                <ol className="mt-8 border-r border-hair pe-6 md:pe-9">
                  {document.turns.map((turn, index) => (
                    <FadeUp key={`${turn.title}-${turn.year}`} delay={index * 0.06}>
                      <li className="relative pb-9 last:pb-0">
                        <span className="absolute -right-[calc(1.5rem+5px)] top-2 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-accent md:-right-[calc(2.25rem+5px)]" />
                        <time className="text-[.75rem] font-semibold text-accent">{turn.year}</time>
                        <h3 className="mt-1 font-display text-[1.18rem] font-semibold text-ink">{turn.title}</h3>
                        <p className="mt-2 text-[.88rem] font-light leading-[1.9] text-soft">{turn.description}</p>
                      </li>
                    </FadeUp>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 md:px-11 md:py-24">
            <div className="mx-auto max-w-3xl">
              <FadeUp>
                <span className="text-[.78rem] font-semibold text-accent">الخط الزمني السنوي</span>
                <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] font-bold text-ink">العقد، سنةً سنة.</h2>
              </FadeUp>
              <ol className="mt-10 divide-y divide-hair border-y border-hair">
                {/* السنوات ذات المقالات فقط — لا نعرض سنوات فارغة */}
                {document.chapters.filter((chapter) => chapter.articles.length > 0).map((chapter, index) => (
                  <FadeUp key={chapter.year} delay={Math.min(index * 0.025, 0.18)}>
                    <li className="grid gap-3 py-6 sm:grid-cols-[90px_1fr] sm:gap-7">
                      <time className="font-display text-[1.35rem] font-semibold text-accent">{chapter.year}</time>
                      <div>
                        <p className="text-[.78rem] text-soft">{number.format(chapter.articles.length)} مقالاً · {chapter.dominant}</p>
                        {chapter.representative && (
                          <Link to={`/articles/${chapter.representative.slug}`} className="mt-1.5 block font-display text-[1.05rem] font-medium leading-[1.65] text-ink transition-colors hover:text-accent">
                            {chapter.representative.title} ←
                          </Link>
                        )}
                      </div>
                    </li>
                  </FadeUp>
                ))}
              </ol>
            </div>
          </section>
        </>
      )}
    </Page>
  )
}
