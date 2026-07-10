import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { articleCats } from '../data'
import { useCmsContent } from '../lib/content'

/* الأبعاد */
const W = 1160
const PAD_R = 132   // مساحة أسماء التصنيفات (يمين)
const PAD_L = 26
const ROW = 74
const TOP = 54

const cats = articleCats.filter((c) => c !== 'الكل')
const H = TOP + cats.length * ROW + 46

const arDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])

export default function Atlas() {
  const { articles } = useCmsContent()
  useSeo({
    title: 'سماء المقالات',
    path: '/atlas',
    description: `خريطة بصرية لـ${articles.length} مقالاً — كل نجمة مقال، وحجمها طوله.`,
  })
  const reduce = useReducedMotion()
  const nav = useNavigate()
  const [hover, setHover] = useState<number | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)

  const stars = useMemo(() => {
    const times = articles.map((a) => new Date(a.iso).getTime())
    const min = Math.min(...times)
    const max = Math.max(...times)
    const words = articles.map((a) => (a.body ? a.body.trim().split(/\s+/).length : 260))
    const wMin = Math.min(...words)
    const wMax = Math.max(...words)

    return articles.map((a, i) => {
      const t = (new Date(a.iso).getTime() - min) / (max - min || 1)
      // RTL: الأقدم يمين، الأحدث يسار
      const x = W - PAD_R - t * (W - PAD_R - PAD_L)
      const row = cats.indexOf(a.cat)
      // إزاحة عمودية خفيفة مشتقّة من الفهرس — تكسر الصف المستقيم
      const jitter = ((i * 37) % 21) - 10
      const y = TOP + row * ROW + ROW / 2 + jitter * 0.55
      const w = words[i]
      const r = 3.4 + ((w - wMin) / (wMax - wMin || 1)) * 8.6
      return { ...a, x, y, r, words: w, i }
    })
  }, [articles])

  const years = useMemo(() => {
    const map = new Map<string, number[]>()
    stars.forEach((s) => {
      const y = s.iso.slice(0, 4)
      if (!map.has(y)) map.set(y, [])
      map.get(y)!.push(s.x)
    })
    return [...map.entries()].map(([y, xs]) => ({ y, x: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length }))
  }, [stars])

  const dim = (s: (typeof stars)[number]) => (activeCat && s.cat !== activeCat ? 0.12 : 1)
  const active = hover !== null ? stars.find((s) => s.i === hover) : null

  return (
    <Page>
      <PageHead
        label="خريطة"
        title="سماء المقالات."
        sub="كل نجمة مقال. حجمها طوله، وصفّها موضوعه، وموضعها زمنه. مرّر لتقرأ، واضغط لتفتح."
      />

      <section className="px-4 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {/* مرشّحات */}
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
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCat(activeCat === c ? null : c)}
                  className={`rounded-full border px-4 py-1.5 text-[.83rem] font-medium transition-colors duration-300 ${
                    activeCat === c ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </FadeUp>

          {/* الخريطة */}
          <FadeUp delay={0.08}>
            <div className="relative overflow-x-auto rounded-2xl border border-hair bg-wash">
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[760px]" role="img" aria-label="خريطة المقالات">
                {/* صفوف التصنيفات */}
                {cats.map((c, r) => {
                  const y = TOP + r * ROW + ROW / 2
                  const on = !activeCat || activeCat === c
                  return (
                    <g key={c} opacity={on ? 1 : 0.25}>
                      <line x1={PAD_L} y1={y} x2={W - PAD_R + 10} y2={y} stroke="currentColor" className="text-ink" strokeOpacity={0.05} />
                      <text
                        x={W - PAD_R + 26}
                        y={y + 5}
                        textAnchor="start"
                        className="fill-soft font-sans"
                        style={{ fontSize: 13.5, fontWeight: 500 }}
                      >
                        {c}
                      </text>
                    </g>
                  )
                })}

                {/* محور السنوات */}
                {years.map((y) => (
                  <text key={y.y} x={y.x} y={H - 16} textAnchor="middle" className="fill-soft font-sans" style={{ fontSize: 12 }}>
                    {arDigits(y.y)}
                  </text>
                ))}

                {/* النجوم */}
                {stars.map((s) => {
                  const isHover = hover === s.i
                  // منطق اللمس: اللمسة الأولى تُحدّد النجمة (تُظهر بطاقتها)، والثانية تفتح المقال.
                  // على الكمبيوتر لا يتغير شيء: التحويم يحدّد والنقر يفتح.
                  const pick = () => (hover === s.i ? nav(`/articles/${s.slug}`) : setHover(s.i))
                  return (
                    <g key={s.slug}>
                      {/* هدف لمس أوسع وشفاف حول النجمة */}
                      <circle
                        cx={s.x} cy={s.y} r={s.r + 9}
                        className="cursor-pointer fill-transparent"
                        onMouseEnter={() => setHover(s.i)}
                        onMouseLeave={() => setHover(null)}
                        onClick={pick}
                      />
                      <motion.circle
                        cx={s.x}
                        cy={s.y}
                        r={s.r}
                        className="pointer-events-none fill-accent"
                        initial={reduce ? false : { opacity: 0, scale: 0 }}
                        animate={{ opacity: dim(s) * (isHover ? 1 : 0.62), scale: isHover ? 1.7 : 1 }}
                        transition={{ duration: 0.5, delay: reduce ? 0 : Math.min(s.i * 0.008, 0.5), ease: EASE }}
                        style={{ transformOrigin: `${s.x}px ${s.y}px` }}
                      >
                        <title>{s.title}</title>
                      </motion.circle>
                    </g>
                  )
                })}

                {/* هالة النجمة النشطة */}
                {active && (
                  <circle cx={active.x} cy={active.y} r={active.r + 9} className="fill-none stroke-accent" strokeOpacity={0.35} strokeWidth={1} />
                )}
              </svg>
            </div>
          </FadeUp>

          {/* بطاقة المقال المحوم عليه */}
          <div className="mt-6 min-h-[92px]">
            {active ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="rounded-xl border border-hair bg-canvas p-6"
              >
                <div className="flex flex-wrap items-center gap-2.5 text-[.76rem]">
                  <span className="font-semibold text-accent">{active.cat}</span>
                  <span className="h-1 w-1 rounded-full bg-hair" />
                  <time className="text-soft">{active.date}</time>
                  <span className="h-1 w-1 rounded-full bg-hair" />
                  <span className="text-soft">{arDigits(active.words)} كلمة</span>
                </div>
                <Link
                  to={`/articles/${active.slug}`}
                  className="mt-2 block font-display text-[1.25rem] font-medium leading-[1.55] text-ink transition-colors hover:text-accent md:text-[1.45rem]"
                >
                  {active.title}
                </Link>
              </motion.div>
            ) : (
              <p className="pt-6 text-center text-[.9rem] font-light text-soft">
                مرّر فوق أي نجمة — وبالجوال المسّها مرة لتعرفها ومرة لتفتحها… {arDigits(articles.length)} مقالاً عبر {arDigits(years.length)} سنوات.
              </p>
            )}
          </div>

          {/* دليل القراءة */}
          <FadeUp delay={0.14}>
            <div className="mt-14 grid gap-8 border-t border-hair pt-10 text-[.9rem] font-light text-soft sm:grid-cols-3">
              <p><span className="font-medium text-ink">الحجم</span> — كلّما كبرت النجمة، طال المقال.</p>
              <p><span className="font-medium text-ink">الصف</span> — موضوع المقال.</p>
              <p><span className="font-medium text-ink">الموضع</span> — من الأقدم يميناً إلى الأحدث يساراً.</p>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
