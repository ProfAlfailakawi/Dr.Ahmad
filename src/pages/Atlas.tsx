import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { useCmsContent } from '../lib/content'
import { categoryLabel, dynamicArticleCategories } from '../lib/content-taxonomy'

const W = 1160
const PAD_R = 150
const PAD_L = 26
const STAR_R_MAX = 12
const ROW = 74
const TOP = 54

const arDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function Atlas() {
  const { articles } = useCmsContent()
  const cats = useMemo(() => dynamicArticleCategories(articles, false), [articles])
  const H = TOP + Math.max(cats.length, 1) * ROW + 46
  useSeo({
    title: 'سماء المقالات',
    path: '/atlas',
    description: `خريطة بصرية لـ${articles.length} مقالاً — كل نجمة مقال، وحجمها طوله.`,
  })
  const reduce = useReducedMotion()
  const nav = useNavigate()
  const [hover, setHover] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)

  const stars = useMemo(() => {
    const activeYears = Array.from(new Set(articles.map((a) => a.iso.slice(0, 4)).filter(Boolean)))
      .sort((a, b) => Number(a) - Number(b))
    const yearIndex = new Map(activeYears.map((year, index) => [year, index]))
    const yearDenominator = Math.max(activeYears.length - 1 + 0.72, 1)
    const words = articles.map((a) => (a.body ? a.body.trim().split(/\s+/).length : Math.max(a.words || 0, 260)))
    const wMin = Math.min(...words, 260)
    const wMax = Math.max(...words, 260)

    return articles.map((a, i) => {
      const date = new Date(a.iso)
      const year = a.iso.slice(0, 4)
      const start = new Date(`${year}-01-01T00:00:00Z`).getTime()
      const end = new Date(`${Number(year) + 1}-01-01T00:00:00Z`).getTime()
      const withinYear = Math.min(Math.max((date.getTime() - start) / (end - start || 1), 0), 1)
      const ordinal = (yearIndex.get(year) || 0) + withinYear * 0.72
      const t = activeYears.length <= 1 ? 0.5 : ordinal / yearDenominator
      const x = W - PAD_R - STAR_R_MAX - t * (W - PAD_R - STAR_R_MAX - PAD_L)
      const row = Math.max(0, cats.indexOf(a.cat))
      const jitter = ((i * 37) % 21) - 10
      const y = TOP + row * ROW + ROW / 2 + jitter * 0.55
      const w = words[i]
      const r = 3.4 + ((w - wMin) / (wMax - wMin || 1)) * 8.6
      return { ...a, x, y, r, words: w, i }
    })
  }, [articles, cats])

  const years = useMemo(() => {
    const map = new Map<string, number[]>()
    stars.forEach((star) => {
      const year = star.iso.slice(0, 4)
      if (!map.has(year)) map.set(year, [])
      map.get(year)!.push(star.x)
    })
    return [...map.entries()].map(([year, xs]) => ({ year, x: xs.reduce((a, b) => a + b, 0) / xs.length }))
  }, [stars])

  const dim = (star: (typeof stars)[number]) => (activeCat && star.cat !== activeCat ? 0.12 : 1)
  const activeIndex = hover ?? selected
  const active = activeIndex !== null ? stars.find((star) => star.i === activeIndex) : null
  const tooltipWidth = 310
  const tooltipHeight = 92
  const tooltipX = active ? clamp(active.x - tooltipWidth / 2, PAD_L, W - PAD_R - tooltipWidth) : 0
  const tooltipY = active ? (active.y > 125 ? active.y - tooltipHeight - 18 : active.y + 18) : 0

  const pick = (index: number, slug: string, pointerType: string) => {
    if (pointerType === 'mouse') {
      nav(`/articles/${slug}`)
      return
    }
    if (selected === index) nav(`/articles/${slug}`)
    else {
      setSelected(index)
      setHover(null)
    }
  }

  return (
    <Page>
      <PageHead
        label="خريطة"
        title="سماء المقالات."
        sub="كل نجمة مقال. المسها أو مرّر فوقها ليظهر اسمها، ثم اضغط لفتح المقال."
      />

      <section className="px-4 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="mb-8 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCat(null)}
                className={`rounded-full border px-4 py-1.5 text-[.83rem] font-medium transition-colors duration-300 ${
                  !activeCat ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
                }`}
              >
                الكل
              </button>
              {cats.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCat(activeCat === category ? null : category)}
                  className={`rounded-full border px-4 py-1.5 text-[.83rem] font-medium transition-colors duration-300 ${
                    activeCat === category ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
                  }`}
                >
                  {categoryLabel(category)}
                </button>
              ))}
            </div>
          </FadeUp>

          <FadeUp delay={0.08}>
            <div className="relative overflow-x-auto rounded-2xl border border-hair bg-wash" onPointerLeave={() => setHover(null)}>
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[760px]" role="img" aria-label="خريطة المقالات">
                {cats.map((category, row) => {
                  const y = TOP + row * ROW + ROW / 2
                  const on = !activeCat || activeCat === category
                  return (
                    <g key={category} opacity={on ? 1 : 0.25}>
                      <line x1={PAD_L} y1={y} x2={W - PAD_R + 10} y2={y} stroke="currentColor" className="text-ink" strokeOpacity={0.05} />
                      <text x={W - PAD_R + 26} y={y + 5} textAnchor="start" className="fill-soft font-sans" style={{ fontSize: 13.5, fontWeight: 500 }}>
                        {categoryLabel(category)}
                      </text>
                    </g>
                  )
                })}

                {years.map((item) => (
                  <text key={item.year} x={item.x} y={H - 16} textAnchor="middle" className="fill-soft font-sans" style={{ fontSize: 12 }}>
                    {arDigits(item.year)}
                  </text>
                ))}

                {stars.map((star) => {
                  const isActive = activeIndex === star.i
                  return (
                    <g key={star.slug} role="link" aria-label={`${star.title}، ${star.date}`}>
                      <circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r + 11}
                        className="cursor-pointer fill-transparent"
                        tabIndex={0}
                        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHover(star.i) }}
                        onFocus={() => setHover(star.i)}
                        onBlur={() => setHover(null)}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          pick(star.i, star.slug, event.pointerType)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') nav(`/articles/${star.slug}`)
                        }}
                      />
                      <motion.circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r}
                        className="pointer-events-none fill-accent"
                        initial={reduce ? false : { opacity: 0, scale: 0 }}
                        animate={{ opacity: dim(star) * (isActive ? 1 : 0.62), scale: isActive ? 1.65 : 1 }}
                        transition={{ duration: 0.45, delay: reduce ? 0 : Math.min(star.i * 0.006, 0.4), ease: EASE }}
                        style={{ transformOrigin: `${star.x}px ${star.y}px` }}
                      />
                    </g>
                  )
                })}

                {active && (
                  <g className="pointer-events-none">
                    <circle cx={active.x} cy={active.y} r={active.r + 10} className="fill-none stroke-accent" strokeOpacity={0.42} strokeWidth={1.4} />
                    <foreignObject x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight}>
                      <div className="atlas-tooltip h-full rounded-xl border border-accent/35 bg-canvas/95 px-4 py-3 text-right shadow-xl backdrop-blur" dir="rtl">
                        <p className="truncate text-[11px] font-semibold text-accent">{categoryLabel(active.cat)} · {active.date}</p>
                        <p className="mt-1 line-clamp-2 font-display text-[14px] font-semibold leading-[1.55] text-ink">{active.title}</p>
                      </div>
                    </foreignObject>
                  </g>
                )}
              </svg>
            </div>
          </FadeUp>

          <div className="mt-5 min-h-[86px]">
            {active ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-hair bg-canvas p-5">
                <div className="flex flex-wrap items-center gap-2 text-[.74rem] text-soft">
                  <span className="font-semibold text-accent">{categoryLabel(active.cat)}</span>
                  <span>·</span><time>{active.date}</time><span>·</span><span>{arDigits(active.words)} كلمة</span>
                </div>
                <Link to={`/articles/${active.slug}`} className="mt-2 block font-display text-[1.15rem] font-semibold leading-[1.6] text-ink transition-colors hover:text-accent md:text-[1.35rem]">
                  {active.title} ←
                </Link>
              </motion.div>
            ) : (
              <p className="pt-5 text-center text-[.88rem] font-light leading-relaxed text-soft">
                على الهاتف: لمسة أولى تُظهر اسم المقال، ولمسة ثانية تفتحه. على الكمبيوتر: مرّر المؤشر لتقرأ الاسم.
              </p>
            )}
          </div>

          <FadeUp delay={0.14}>
            <div className="mobile-card-rail mt-12 grid gap-6 border-t border-hair pt-9 text-[.88rem] font-light text-soft sm:grid-cols-3">
              <p><span className="font-medium text-ink">الحجم</span> — كلّما كبرت النجمة، طال المقال.</p>
              <p><span className="font-medium text-ink">الصف</span> — موضوع المقال، ويُضاف أي تصنيف جديد تلقائياً.</p>
              <p><span className="font-medium text-ink">الموضع</span> — من الأقدم يميناً إلى الأحدث يساراً.</p>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
