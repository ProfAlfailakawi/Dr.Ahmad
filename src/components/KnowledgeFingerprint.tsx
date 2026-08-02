import { useMemo } from 'react'
import { useCmsContent } from '../lib/content'
import { PROJECT_START_YEAR } from '../lib/project-meta'
import { arabicCountPhrase, ARTICLE_FORMS, BOOK_FORMS, PAPER_FORMS } from '../lib/arabic-count.ts'

const C = 250
const R0 = 44
const RING_GAP = 15

export default function KnowledgeFingerprint({ feature = false }: { feature?: boolean }) {
  const { articles, books, papers } = useCmsContent()

  const model = useMemo(() => {
    const byYear = new Map<string, string[]>()
    for (const article of articles) {
      const year = (article.iso || '').slice(0, 4)
      if (!year) continue
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(article.iso)
    }
    const latestActiveYear = Math.max(PROJECT_START_YEAR, ...[...byYear.keys()].map((value) => Number(value) || PROJECT_START_YEAR))
    const years = Array.from({ length: latestActiveYear - PROJECT_START_YEAR + 1 }, (_, index) => String(PROJECT_START_YEAR + index))
    const rings = years.map((year, index) => ({ year, radius: R0 + index * RING_GAP }))
    const maxRing = R0 + Math.max(years.length - 1, 0) * RING_GAP

    const dots = years.flatMap((year, yearIndex) => {
      const items = byYear.get(year) || []
      const radius = R0 + yearIndex * RING_GAP
      return items.map((iso, index) => {
        const date = new Date(iso)
        const angle = ((date.getMonth() + (date.getDate() - 1) / 31) / 12) * Math.PI * 2 - Math.PI / 2
        const wobble = ((index * 53) % 9) - 4
        const r = radius + wobble * 0.55
        return {
          key: `${iso}:${index}`,
          x: +(C + Math.cos(angle) * r).toFixed(1),
          y: +(C + Math.sin(angle) * r).toFixed(1),
          size: +(1.6 + ((index * 31) % 10) / 7).toFixed(2),
          opacity: +(0.42 + ((index * 17) % 10) / 22).toFixed(2),
        }
      })
    })

    const paperRing = maxRing + 22
    const paperDots = papers.map((_, index) => {
      const angle = (index / Math.max(papers.length, 1)) * Math.PI * 2 + 0.35
      return { x: +(C + Math.cos(angle) * paperRing).toFixed(1), y: +(C + Math.sin(angle) * paperRing).toFixed(1) }
    })

    const bookRing = paperRing + 16
    const bookDots = books.map((_, index) => {
      const angle = (index / Math.max(books.length, 1)) * Math.PI * 2 + 1.1
      return { x: +(C + Math.cos(angle) * bookRing).toFixed(1), y: +(C + Math.sin(angle) * bookRing).toFixed(1) }
    })

    return { rings, dots, paperDots, bookDots, years, bookRing }
  }, [articles, books, papers])

  if (!model.dots.length) return null

  const firstYear = model.years[0]
  const lastYear = model.years[model.years.length - 1]
  const wrapper = feature
    ? 'mb-14 overflow-hidden rounded-[30px] border border-accent/[.15] bg-[radial-gradient(circle_at_top_right,rgba(var(--c-accent),0.1),transparent_42%),linear-gradient(180deg,rgba(var(--c-wash),0.55),rgba(var(--c-canvas),1))] p-6 shadow-[0_16px_60px_rgba(15,23,42,.04)] md:p-9'
    : 'mb-14 overflow-hidden rounded-2xl border border-hair bg-wash/40 p-6 md:p-8'
  const svgWidth = feature ? 'max-w-[430px]' : 'max-w-[380px]'
  const textWidth = feature ? 'max-w-[52ch]' : 'max-w-[46ch]'

  return (
    <section className={wrapper} aria-labelledby="knowledge-fingerprint-title">
      <div className={`grid items-center gap-8 ${feature ? 'md:grid-cols-[1.05fr_.95fr] md:gap-14' : 'md:grid-cols-[auto_1fr] md:gap-12'}`}>
        <svg
          viewBox="0 0 500 500"
          className={`mx-auto block w-full ${svgWidth}`}
          role="img"
          aria-label={`البصمة المعرفية: ${arabicCountPhrase(articles.length, ARTICLE_FORMS)} و${arabicCountPhrase(papers.length, PAPER_FORMS)} و${arabicCountPhrase(books.length, BOOK_FORMS)} منذ ${firstYear}`}
        >
          {model.rings.map((ring) => (
            <circle key={ring.year} cx={C} cy={C} r={ring.radius} fill="none" stroke="rgb(var(--c-accent) / .10)" strokeWidth="1" />
          ))}
          <circle cx={C} cy={C} r={model.bookRing - 8} fill="none" stroke="rgb(var(--c-accent) / .13)" strokeWidth="1" strokeDasharray="2 6" />

          <g className="kf-rotate">
            {model.dots.map((dot) => (
              <circle key={dot.key} cx={dot.x} cy={dot.y} r={dot.size} fill="rgb(var(--c-accent))" opacity={dot.opacity} />
            ))}
            {model.paperDots.map((dot, index) => (
              <circle key={`paper-${index}`} cx={dot.x} cy={dot.y} r="3.6" fill="none" stroke="rgb(var(--c-accent) / .7)" strokeWidth="1.3" />
            ))}
            {model.bookDots.map((dot, index) => (
              <circle key={`book-${index}`} cx={dot.x} cy={dot.y} r="6.5" fill="rgb(var(--c-accent))" stroke="rgb(var(--c-canvas))" strokeWidth="2.4" />
            ))}
          </g>

          <circle cx={C} cy={C} r="28" fill="rgb(var(--c-canvas))" stroke="rgb(var(--c-accent) / .3)" strokeWidth="1" />
          <text x={C} y={C + 9} textAnchor="middle" className="fill-accent font-display" style={{ fontSize: 25, fontWeight: 700 }}>أ</text>

          <text x={C} y={C - R0 - 6} textAnchor="middle" className="fill-soft" style={{ fontSize: 10.5 }}>{firstYear}</text>
          <text x={C} y={C - model.bookRing - 6} textAnchor="middle" className="fill-soft" style={{ fontSize: 10.5 }}>{lastYear}</text>
        </svg>

        <div>
          <p className="text-[.72rem] font-semibold text-accent">{feature ? 'توقيع بصري للمسيرة' : 'توقيع بصري'}</p>
          <h2 id="knowledge-fingerprint-title" className="mt-1 font-display text-[1.18rem] font-semibold text-ink md:text-[1.28rem]">البصمة المعرفية.</h2>
          <p className={`mt-3 ${textWidth} text-[.92rem] font-light leading-[1.95] text-soft`}>
            كل حلقة سنة منذ {firstYear}، وكل نقطة مقال في موضع شهره من سنته؛ الحلقات المجوّفة أبحاث محكّمة، والأختام كتب.
            بصمة لا تشبه أحداً — لأنها مبنية من المسيرة نفسها، وتنمو تلقائياً مع كل جديد.
          </p>
          {feature && (
            <p className="mt-3 max-w-[52ch] text-[.8rem] leading-[1.85] text-soft">
              وضعتها هنا في صدر السيرة لأنها لا تعرض رقماً فقط؛ بل تعطي الزائر انطباعاً فورياً عن امتداد الرحلة وتراكمها عبر السنين.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[.8rem] text-soft">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              المقالات
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-accent/70" aria-hidden="true" />
              الأبحاث المحكّمة
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-accent ring-2 ring-canvas" aria-hidden="true" />
              الكتب
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
