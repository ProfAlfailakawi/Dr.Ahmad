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

const MOBILE_W = 680
const MOBILE_PAD_R = 118
const MOBILE_PAD_L = 22
const MOBILE_STAR_R_MAX = 12
const MOBILE_ROW = 64
const MOBILE_TOP = 38

const arDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const ATLAS_STOP = new Set(['هذا','هذه','ذلك','الذي','التي','على','الى','من','في','عن','مع','بين','بعد','قبل','كان','كانت','يكون','تكون','كيف','لكن','لان','وقد','وهو','وهي','كل','غير','عند','حتى','حول','ماذا','لماذا'])
const ideaTokens = (text = '') => new Set(text
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^\p{L}\p{N} ]/gu, ' ')
  .toLowerCase().split(/\s+/).filter((word) => word.length > 3 && !ATLAS_STOP.has(word)))
const ideaOverlap = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / Math.sqrt(left.size * right.size)
}
type AtlasLink = { from: number; to: number; kind: 'evolution' | 'affinity'; score: number }

export default function Atlas() {
  const { articles } = useCmsContent()
  const cats = useMemo(() => dynamicArticleCategories(articles, false), [articles])
  const H = TOP + Math.max(cats.length, 1) * ROW + 46
  const mobileH = MOBILE_TOP + Math.max(cats.length, 1) * MOBILE_ROW + 48
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
  const [view, setView] = useState<'timeline' | 'graph'>('timeline')

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
      /* العين تقرأ المساحة لا نصف القطر. المدى القديم (٣٫٤ ← ١٢) كان يجعل
         أطول مقال أكبر ١٢ ضعفاً مساحةً وهو أطول مرّتين فقط، فتبتلع نجمةٌ
         واحدة السماء. المدى هنا يجعل الأكبر ضِعف الأصغر مساحةً — كما هو حقاً. */
      const r = 4.5 + ((w - wMin) / (wMax - wMin || 1)) * 2.5
      return { ...a, x, y, r, words: w, i, t, row, jitter }
    })
  }, [articles, cats])

  const mobileStars = useMemo(() => stars.map((star) => ({
    ...star,
    x: MOBILE_W - MOBILE_PAD_R - MOBILE_STAR_R_MAX - star.t * (MOBILE_W - MOBILE_PAD_R - MOBILE_STAR_R_MAX - MOBILE_PAD_L),
    y: MOBILE_TOP + star.row * MOBILE_ROW + MOBILE_ROW / 2 + star.jitter * 0.4,
    r: Math.max(3.9, Math.min(9, star.r * 0.92)),
  })), [stars])

  /* شبكة الأفكار: تخطيط شعاعي حقيقي — كل تصنيف عنقود في قطاع زاوي، والسنة تحدد البعد
     عن المركز (الأقدم داخلاً، الأحدث خارجاً)، فتتحول الخريطة من مسار زمني إلى كوكبة
     مترابطة تُبرز صلات الأفكار بين المواضيع لا تسلسلها الزمني فقط. */
  const graphStars = useMemo(() => {
    const cx = (W + 40) / 2, cy = H / 2 + 6
    const maxR = Math.min(cx - PAD_L - 20, cy - TOP)
    const perCat = new Map<string, number>()
    const catCount = new Map<string, number>()
    for (const star of stars) catCount.set(star.cat, (catCount.get(star.cat) || 0) + 1)
    return stars.map((star) => {
      const row = Math.max(0, cats.indexOf(star.cat))
      const sector = (2 * Math.PI) / Math.max(cats.length, 1)
      const within = perCat.get(star.cat) || 0
      perCat.set(star.cat, within + 1)
      const total = Math.max(catCount.get(star.cat) || 1, 1)
      const spread = total > 1 ? (within / (total - 1) - 0.5) : 0
      const angle = row * sector + sector * 0.5 + spread * sector * 0.62 - Math.PI / 2
      const radius = maxR * (0.36 + star.t * 0.58) + ((star.i * 29) % 17) - 8
      return { ...star, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
    })
  }, [stars, cats, H])

  const graphMobileStars = useMemo(() => {
    const cx = MOBILE_W / 2, cy = mobileH / 2 + 4
    const maxR = Math.min(cx - MOBILE_PAD_L - 14, cy - MOBILE_TOP)
    const perCat = new Map<string, number>()
    const catCount = new Map<string, number>()
    for (const star of stars) catCount.set(star.cat, (catCount.get(star.cat) || 0) + 1)
    return stars.map((star) => {
      const row = Math.max(0, cats.indexOf(star.cat))
      const sector = (2 * Math.PI) / Math.max(cats.length, 1)
      const within = perCat.get(star.cat) || 0
      perCat.set(star.cat, within + 1)
      const total = Math.max(catCount.get(star.cat) || 1, 1)
      const spread = total > 1 ? (within / (total - 1) - 0.5) : 0
      const angle = row * sector + sector * 0.5 + spread * sector * 0.62 - Math.PI / 2
      const radius = maxR * (0.36 + star.t * 0.58) + ((star.i * 23) % 13) - 6
      return { ...star, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, r: Math.max(3.9, Math.min(9, star.r * 0.92)) }
    })
  }, [stars, cats, mobileH])

  const layout = view === 'graph' ? graphStars : stars
  const mobileLayout = view === 'graph' ? graphMobileStars : mobileStars

  const links = useMemo<AtlasLink[]>(() => {
    const output: AtlasLink[] = []
    const seen = new Set<string>()
    const add = (from: number, to: number, kind: AtlasLink['kind'], score: number) => {
      if (from === to) return
      const pair = from < to ? `${from}:${to}` : `${to}:${from}`
      const key = `${kind}:${pair}`
      if (seen.has(key)) return
      seen.add(key)
      output.push({ from, to, kind, score })
    }

    for (const category of cats) {
      const thread = stars.filter((star) => star.cat === category).sort((left, right) => left.iso.localeCompare(right.iso))
      for (let index = 1; index < thread.length; index += 1) add(thread[index - 1].i, thread[index].i, 'evolution', 1)
    }

    const tokens = stars.map((star) => ideaTokens(`${star.title} ${star.excerpt || ''} ${String(star.body || '').slice(0, 900)}`))
    stars.forEach((star, index) => {
      let bestIndex = -1
      let bestScore = 0
      stars.forEach((candidate, candidateIndex) => {
        if (candidateIndex === index || candidate.cat === star.cat) return
        const score = ideaOverlap(tokens[index], tokens[candidateIndex])
        if (score >= 0.13 && score > bestScore) {
          bestIndex = candidateIndex
          bestScore = score
        }
      })
      if (bestIndex >= 0) add(star.i, stars[bestIndex].i, 'affinity', bestScore)
    })
    return output
  }, [stars, cats])

  const years = useMemo(() => {
    const map = new Map<string, { desktop: number[]; mobile: number[] }>()
    stars.forEach((star, index) => {
      const year = star.iso.slice(0, 4)
      if (!map.has(year)) map.set(year, { desktop: [], mobile: [] })
      map.get(year)!.desktop.push(star.x)
      map.get(year)!.mobile.push(mobileStars[index]?.x ?? 0)
    })
    return [...map.entries()].map(([year, points]) => ({
      year,
      x: points.desktop.reduce((a, b) => a + b, 0) / points.desktop.length,
      mobileX: points.mobile.reduce((a, b) => a + b, 0) / points.mobile.length,
    }))
  }, [stars, mobileStars])

  const dim = (star: (typeof stars)[number]) => (activeCat && star.cat !== activeCat ? 0.12 : 1)
  const activeIndex = hover ?? selected
  const active = activeIndex !== null ? layout.find((star) => star.i === activeIndex) : null
  const activeLinks = useMemo(() => activeIndex === null ? [] : links.filter((link) => link.from === activeIndex || link.to === activeIndex), [links, activeIndex])
  const related = useMemo(() => activeLinks.map((link) => {
    const index = link.from === activeIndex ? link.to : link.from
    return { ...link, star: stars.find((item) => item.i === index) }
  }).filter((item): item is AtlasLink & { star: (typeof stars)[number] } => Boolean(item.star))
    .sort((left, right) => left.star.iso.localeCompare(right.star.iso)).slice(0, 6), [activeLinks, activeIndex, stars])
  const tooltipWidth = 310
  const tooltipHeight = 92
  const tooltipX = active ? clamp(active.x - tooltipWidth / 2, PAD_L, W - PAD_R - tooltipWidth) : 0
  const tooltipY = active ? (active.y > 125 ? active.y - tooltipHeight - 18 : active.y + 18) : 0

  const pick = (index: number, slug: string, _pointerType: string) => {
    /* الكمبيوتر كالهاتف الآن: الضغطة الأولى تُظهر بطاقة المقال وتُثبتها (ومنها رابط
       القراءة ومسار الفكرة)، والضغطة الثانية على النجمة نفسها تفتح المقال. */
    if (selected === index) {
      nav(`/articles/${slug}`)
      return
    }
    setSelected(index)
    setHover(null)
    window.setTimeout(() => document.getElementById('atlas-selection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }

  const categoryButtons = (
    <div className="rail -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
      <button
        onClick={() => { setActiveCat(null); setSelected(null) }}
        className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-[.83rem] font-medium transition-colors duration-300 ${
          !activeCat ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
        }`}
      >
        الكل
      </button>
      {cats.map((category) => (
        <button
          key={category}
          onClick={() => { setActiveCat(activeCat === category ? null : category); setSelected(null) }}
          className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-[.83rem] font-medium transition-colors duration-300 ${
            activeCat === category ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
          }`}
        >
          {categoryLabel(category)}
        </button>
      ))}
    </div>
  )

  return (
    <Page>
      <PageHead
        label="خريطة"
        title="سماء المقالات."
        sub="كل نجمة مقال، وكل خط مسارٌ موثّق: تطور داخل الموضوع أو صلة فكرية بين مقالات متباعدة."
      />

      <section className="px-4 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>{categoryButtons}</FadeUp>

          <FadeUp delay={0.04}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="hidden text-[.78rem] font-light text-soft sm:block">قراءة زمنية وروابط هادئة بين الموضوعات والحجج.</p>
              <div className="ms-auto inline-flex rounded-full border border-hair bg-canvas p-1" role="group" aria-label="طريقة عرض خريطة الأفكار">
                <button type="button" onClick={() => setView('timeline')} aria-pressed={view === 'timeline'} className={`rounded-full px-4 py-1.5 text-[.74rem] font-semibold transition-colors ${view === 'timeline' ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>المسار الزمني</button>
                <button type="button" onClick={() => setView('graph')} aria-pressed={view === 'graph'} className={`rounded-full px-4 py-1.5 text-[.74rem] font-semibold transition-colors ${view === 'graph' ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>شبكة الأفكار</button>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.08}>
            <div className="relative overflow-hidden rounded-2xl border border-hair bg-wash lg:overflow-x-auto" onPointerLeave={() => setHover(null)}>
              {/* نسخة الهاتف: تتكيّف مع العرض، بلا تمرير جانبي ولا نافذة عائمة مقصوصة. */}
              <svg viewBox={`0 0 ${MOBILE_W} ${mobileH}`} className="atlas-map-mobile block h-auto w-full lg:hidden" role="img" aria-label="خريطة المقالات">
                {view === 'timeline' && cats.map((category, row) => {
                  const y = MOBILE_TOP + row * MOBILE_ROW + MOBILE_ROW / 2
                  const on = !activeCat || activeCat === category
                  return (
                    <g key={category} opacity={on ? 1 : 0.25}>
                      <line x1={MOBILE_PAD_L} y1={y} x2={MOBILE_W - MOBILE_PAD_R + 8} y2={y} stroke="currentColor" className="text-ink" strokeOpacity={0.055} />
                      <text x={MOBILE_W - MOBILE_PAD_R + 18} y={y + 7} textAnchor="start" className="fill-soft font-sans" style={{ fontSize: 21, fontWeight: 600 }}>
                        {categoryLabel(category)}
                      </text>
                    </g>
                  )
                })}

                {view === 'timeline' && years.map((item) => (
                  <text key={item.year} x={item.mobileX} y={mobileH - 15} textAnchor="middle" className="fill-soft font-sans" style={{ fontSize: 17 }}>
                    {arDigits(item.year)}
                  </text>
                ))}

                {links.map((link) => {
                  const from = mobileLayout.find((star) => star.i === link.from)
                  const to = mobileLayout.find((star) => star.i === link.to)
                  if (!from || !to) return null
                  const connected = activeIndex !== null && (link.from === activeIndex || link.to === activeIndex)
                  if (view === 'timeline' && !connected) return null
                  const hiddenByCategory = activeCat && from.cat !== activeCat && to.cat !== activeCat
                  const graphVisible = view === 'graph' && !connected
                  return <line key={`mobile-link-${link.kind}-${link.from}-${link.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={link.kind === 'evolution' ? 'stroke-accent' : 'stroke-soft'} strokeWidth={connected ? 2.2 : 1.15} strokeOpacity={hiddenByCategory ? 0.03 : connected ? 0.48 : graphVisible ? (link.kind === 'evolution' ? 0.3 : 0.22) : link.kind === 'evolution' ? 0.14 : 0.1} strokeDasharray={link.kind === 'affinity' ? '4 5' : undefined} />
                })}

                {mobileLayout.map((star) => {
                  const isActive = activeIndex === star.i
                  return (
                    <g key={star.slug} role="link" aria-label={`${star.title}، ${star.date}`}>
                      {isActive && <circle cx={star.x} cy={star.y} r={star.r + 12} className="fill-none stroke-accent" strokeOpacity={0.55} strokeWidth={2} />}
                      <circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r + 18}
                        className="cursor-pointer fill-transparent"
                        tabIndex={0}
                        onPointerDown={(event) => { event.preventDefault(); pick(star.i, star.slug, event.pointerType) }}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') nav(`/articles/${star.slug}`) }}
                      />
                      <motion.circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r}
                        className="pointer-events-none fill-accent"
                        initial={reduce ? false : { opacity: 0, scale: 0 }}
                        animate={{ opacity: dim(star) * (isActive ? 1 : 0.68), scale: isActive ? 1.5 : 1 }}
                        transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(star.i * 0.004, 0.3), ease: EASE }}
                        style={{ transformOrigin: `${star.x}px ${star.y}px` }}
                      />
                    </g>
                  )
                })}
              </svg>

              {/* نسخة الكمبيوتر الأصلية الواسعة. */}
              <svg viewBox={`0 0 ${W} ${H}`} className="atlas-map-desktop hidden h-auto w-full min-w-[760px] lg:block" role="img" aria-label="خريطة المقالات">
                {view === 'timeline' && cats.map((category, row) => {
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

                {view === 'timeline' && years.map((item) => (
                  <text key={item.year} x={item.x} y={H - 16} textAnchor="middle" className="fill-soft font-sans" style={{ fontSize: 12 }}>
                    {arDigits(item.year)}
                  </text>
                ))}

                {view === 'graph' && cats.map((category, row) => {
                  const example = graphStars.find((star) => star.cat === category)
                  if (!example) return null
                  const on = !activeCat || activeCat === category
                  return (
                    <text key={`glabel-${category}`} x={example.x} y={example.y - 22} textAnchor="middle" opacity={on ? 0.9 : 0.25} className="fill-soft font-sans" style={{ fontSize: 13, fontWeight: 600 }}>
                      {categoryLabel(category)}
                    </text>
                  )
                })}

                {links.map((link) => {
                  const from = layout.find((star) => star.i === link.from)
                  const to = layout.find((star) => star.i === link.to)
                  if (!from || !to) return null
                  const connected = activeIndex !== null && (link.from === activeIndex || link.to === activeIndex)
                  if (view === 'timeline' && !connected) return null
                  const hiddenByCategory = activeCat && from.cat !== activeCat && to.cat !== activeCat
                  const graphVisible = view === 'graph' && !connected
                  return <line key={`desktop-link-${link.kind}-${link.from}-${link.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={link.kind === 'evolution' ? 'stroke-accent' : 'stroke-soft'} strokeWidth={connected ? 1.8 : .85} strokeOpacity={hiddenByCategory ? 0.025 : connected ? 0.42 : graphVisible ? (link.kind === 'evolution' ? 0.24 : 0.16) : link.kind === 'evolution' ? 0.11 : 0.075} strokeDasharray={link.kind === 'affinity' ? '3 5' : undefined} />
                })}

                {layout.map((star) => {
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
                        onPointerDown={(event) => { event.preventDefault(); pick(star.i, star.slug, event.pointerType) }}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') nav(`/articles/${star.slug}`) }}
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
                    <foreignObject className="atlas-tooltip-foreign" x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight}>
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

          <div id="atlas-selection" className="mt-4 min-h-[94px] scroll-mt-24">
            {active ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-hair bg-canvas p-5">
                <div className="flex flex-wrap items-center gap-2 text-[.74rem] text-soft">
                  <span className="font-semibold text-accent">{categoryLabel(active.cat)}</span>
                  <span>·</span><time>{active.date}</time><span>·</span><span>{arDigits(active.words)} كلمة</span>
                </div>
                <Link to={`/articles/${active.slug}`} className="mt-2 block break-words font-display text-[1.08rem] font-semibold leading-[1.75] text-ink transition-colors hover:text-accent md:text-[1.35rem]">
                  {active.title}
                  <span className="mt-3 block text-[.78rem] font-sans font-semibold text-accent">فتح المقال ←</span>
                </Link>
                {related.length > 0 && (
                  <div className="mt-4 border-t border-hair pt-4">
                    <p className="text-[.7rem] font-semibold text-accent">مسار الفكرة</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {related.map((item) => (
                        <Link key={`${item.kind}-${item.star.slug}`} to={`/articles/${item.star.slug}`} className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft transition-colors hover:border-accent hover:text-accent">
                          {item.kind === 'evolution' ? 'تطور' : 'صلة'} · {arDigits(item.star.iso.slice(0, 4))} · {item.star.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="pt-4 text-center text-[.84rem] font-light leading-relaxed text-soft">
                المقال المحدد ومساره الفكري.
              </p>
            )}
          </div>

          <FadeUp delay={0.14}>
            <div className="mobile-card-rail mt-12 grid gap-6 border-t border-hair pt-9 text-[.88rem] font-light text-soft sm:grid-cols-3">
              <p><span className="font-medium text-ink">الحجم</span> — كلّما كبرت النجمة، طال المقال.</p>
              <p><span className="font-medium text-ink">الصف</span> — موضوع المقال، ويُضاف أي تصنيف جديد تلقائياً.</p>
              <p><span className="font-medium text-ink">الخط</span> — متصل لتطور الفكرة، ومتقطع لصلةٍ بين موضوعين.</p>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
