/**
 * «من اختياراتي» — الهيكل الإيقاعي:
 *   يومي   ← «جديد اليوم» (يتبدل كل منتصف ليل تلقائياً)
 *   أسبوعي ← «سؤال يُقلق التعليم» (بطاقة عبور إلى /questions)
 *   شهري  ← «كتاب الشهر» (يتبدل أول كل شهر)
 *   رادار الشبكة ← يُلتقط آلياً كل يوم من مصادر موثوقة
 *   الأرشيف ← كل المخزون بفلاتر الأركان المُحياة من الموقع القديم
 *
 * كل عنصر: عربي + إنجليزي + مصدر موثوق مُسمّى.
 * وبطلب الدكتور: البطاقة كلها قابلة للضغط وتقود للمصدر مباشرة.
 */
import { useSeo } from '../components/seo'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { curatedBank, curioKinds, thisMonthsBook, todaysPick, type Curio } from '../data-curated'
import { useExtras } from '../lib/content'

/* غلاف: البطاقة كلها رابط للمصدر إن وُجد */
function CardWrap({ c, className, children }: { c: Curio; className: string; children: React.ReactNode }) {
  if (c.url)
    return (
      <a href={c.url} target="_blank" rel="noreferrer" data-hover className={`${className} group cursor-pointer transition-colors duration-300 hover:border-accent`}>
        {children}
      </a>
    )
  return <div className={className}>{children}</div>
}

function CurioBody({ c }: { c: Curio }) {
  return (
    <>
      <h3 className="font-display text-[1.2rem] font-semibold leading-[1.7] text-ink">{c.ar}</h3>
      {c.arNote && <p className="mt-2 text-[.9rem] font-light leading-relaxed text-soft">{c.arNote}</p>}
      <p className="mt-3 text-[.92rem] text-soft" dir="ltr" style={{ textAlign: 'left' }}>{c.en}</p>
      {c.enNote && <p className="mt-1 text-[.8rem] font-light text-soft/80" dir="ltr" style={{ textAlign: 'left' }}>{c.enNote}</p>}
    </>
  )
}

function SourceLine({ c }: { c: Curio }) {
  return (
    <p className="mt-4 flex items-center justify-between gap-3 border-t border-hair pt-3 text-[.78rem] text-soft">
      <span>المصدر: {c.source}</span>
      {c.url && <span className="shrink-0 text-accent transition-transform duration-300 group-hover:-translate-x-1">اذهب للمصدر ←</span>}
    </p>
  )
}

/* رادار الشبكة — يعرض ما يلتقطه scripts/daily-radar.mjs يومياً.
   يختفي كلياً ما دام الالتقاط غير مفعَّل. */
type RadarItem = { ar: string; arNote?: string; en: string; enNote?: string; source: string; url: string; day: string; status?: string }

function RadarSection() {
  // المنشور فقط — مسودات وضع المراجعة (pending_review) لا تظهر للزوار
  const items = useExtras<RadarItem>('site_radar').filter((r) => !r.status || r.status === 'published')
  if (!items.length) return null
  return (
    <section className="border-b border-hair px-6 py-14 md:px-11 md:py-16">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-display text-xl font-bold text-ink">رادار الشبكة</h2>
              <span className="text-[.8rem] text-soft">التقاط يومي من مصادر موثوقة</span>
            </div>
            <Link to="/radar" data-hover className="text-[.85rem] text-accent transition-colors hover:text-accent-deep">الأرشيف الكامل ←</Link>
          </div>
        </FadeUp>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {items.slice(0, 4).map((r, i) => (
            <FadeUp key={r.day + r.ar} delay={Math.min(i * 0.06, 0.2)}>
              <a href={r.url} target="_blank" rel="noreferrer" data-hover className="group flex h-full flex-col rounded-2xl border border-hair p-6 transition-colors hover:border-accent">
                <span className="text-[.72rem] text-soft">{r.day} · {r.source}</span>
                <h3 className="mt-2.5 font-display text-[1.1rem] font-semibold leading-[1.7] text-ink">{r.ar}</h3>
                {r.arNote && <p className="mt-1.5 text-[.88rem] font-light text-soft">{r.arNote}</p>}
                <p className="mt-2.5 text-[.85rem] text-soft" dir="ltr" style={{ textAlign: 'left' }}>{r.en}</p>
                <span className="mt-auto pt-4 text-[.82rem] text-soft transition-colors group-hover:text-accent">اقرأ المادة في مصدرها ←</span>
              </a>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Curated() {
  useSeo({ title: 'من اختياراتي', path: '/curated', description: 'كل يوم اختيار جديد، كل جمعة سؤال، كل شهر كتاب — بالعربية والإنجليزية، من مصادر موثوقة فقط.' })
  const reduce = useReducedMotion()
  const [kind, setKind] = useState<'الكل' | string>('الكل')
  const [today, setToday] = useState('')

  useEffect(() => {
    try { setToday(new Date().toLocaleDateString('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })) } catch { /* noop */ }
  }, [])

  // مختارات لوحة التحكم تنضم للمخزون
  const extra = useExtras<Curio>('site_picks')
  const daily = todaysPick(extra)
  const book = thisMonthsBook()
  const all = [...extra, ...curatedBank]
  const shown = kind === 'الكل' ? all : all.filter((c) => c.kind === kind)

  return (
    <Page>
      <PageHead
        label="من اختياراتي"
        title="المختارات."
        sub="كل يوم اختيار، كل جمعة سؤال، كل شهر كتاب."
      />

      {/* ─── جديد اليوم ─── */}
      <section className="border-b border-hair px-6 py-14 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2.5 text-[.82rem] font-semibold text-accent">
                <span className="pulse relative h-2 w-2 rounded-full bg-accent" />
                جديد اليوم
              </span>
              <span className="text-[.85rem] text-soft">· {today} · يتبدّل تلقائياً كل منتصف ليل</span>
            </div>
          </FadeUp>
          <FadeUp delay={0.08}>
            <CardWrap c={daily} className="mt-7 block max-w-3xl rounded-2xl border border-accent/40 bg-wash p-7 md:p-9">
              <span className="text-[.74rem] font-semibold text-accent">{daily.kind}</span>
              <div className="mt-3"><CurioBody c={daily} /></div>
              <SourceLine c={daily} />
            </CardWrap>
          </FadeUp>

          {/* الإيقاعان الآخران */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <FadeUp delay={0.14}>
              <CardWrap c={book} className="flex h-full flex-col rounded-2xl border border-hair p-7">
                <span className="text-[.74rem] font-semibold text-accent">كتاب الشهر</span>
                <div className="mt-3 flex-1"><CurioBody c={book} /></div>
                <SourceLine c={book} />
              </CardWrap>
            </FadeUp>
            <FadeUp delay={0.2}>
              <Link to="/questions" data-hover className="group flex h-full flex-col rounded-2xl border border-hair p-7 transition-colors hover:border-accent">
                <span className="text-[.74rem] font-semibold text-accent">سؤال الأسبوع ✦</span>
                <h3 className="mt-3 font-display text-[1.2rem] font-semibold leading-[1.7] text-ink">سؤال يُقلق التعليم</h3>
                <p className="mt-2 text-[.9rem] font-light text-soft">كل جمعة، سؤال واحد لا يبحث عن إجابة سريعة — بل عن أرقٍ نافع.</p>
                <span className="mt-auto pt-5 text-[.85rem] text-soft transition-colors group-hover:text-accent">إلى الزاوية ←</span>
              </Link>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ─── رادار الشبكة ─── */}
      <RadarSection />

      {/* ─── الأرشيف الكامل بأركانه ─── */}
      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="flex flex-wrap gap-2">
              {['الكل', ...curioKinds].map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full border px-4 py-1.5 text-[.85rem] font-medium transition-colors duration-300 ${kind === k ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </FadeUp>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((c, i) => (
              <motion.div
                key={c.ar}
                initial={reduce ? false : { opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: Math.min((i % 6) * 0.06, 0.3), ease: EASE }}
                whileHover={reduce ? {} : { y: -6 }}
                className="h-full"
              >
                <CardWrap c={c} className="flex h-full flex-col rounded-2xl border border-hair bg-canvas p-7">
                  <span className="text-[.74rem] font-semibold text-accent">{c.kind}</span>
                  <div className="mt-3 flex-1"><CurioBody c={c} /></div>
                  <SourceLine c={c} />
                </CardWrap>
              </motion.div>
            ))}
          </div>

          <FadeUp delay={0.1}>
            <p className="mt-14 border-t border-hair pt-8 text-[.85rem] leading-relaxed text-soft">
              ✦ كل عنصر هنا يُذكر مصدره، وبطاقته تقود إليه مباشرة — ولا مكان لاقتباسٍ منحول أو مصدرٍ مجهول.
            </p>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
