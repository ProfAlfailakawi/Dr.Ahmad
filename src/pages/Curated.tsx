/**
 * «من اختياراتي» — الهيكل الإيقاعي:
 *   يومي   ← «جديد اليوم» (يتبدل كل منتصف ليل تلقائياً)
 *   كل يومين ← «سؤال يُقلق التعليم» (بطاقة عبور إلى /questions)
 *   شهري  ← «كتاب الشهر» (يتبدل أول كل شهر)
 *   رادار الشبكة ← أربع محاولات يومية من مصادر موثوقة، بلا تكرار
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
import { curatedBank, curioKinds, thisMonthsBook, type Curio } from '../data-curated'
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

const fmtAdded = (iso: string) => {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}

const timestampIso = (value: unknown) => {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10)
  if (typeof value !== 'object') return ''
  const candidate = value as { seconds?: unknown; toDate?: () => Date; toMillis?: () => number }
  try {
    if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString().slice(0, 10)
    if (typeof candidate.toMillis === 'function') return new Date(candidate.toMillis()).toISOString().slice(0, 10)
    if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000).toISOString().slice(0, 10)
  } catch { /* ignore malformed timestamps */ }
  return ''
}

const todayIso = () => new Date().toISOString().slice(0, 10)

/* إضافات افتتاحية حقيقية من أرشيف الدكتور؛ تبقى ظاهرة حتى قبل أول تشغيل ناجح للأتمتة. */
const freshCurated: Curio[] = [
  {
    kind: 'رؤية عميقة',
    ar: 'الذكاء الاصطناعي يُدرّس… والعقل البشري يُقصى',
    arNote: 'مقال من الأرشيف يضع معيار الفهم الإنساني قبل سرعة الإجابة.',
    en: 'AI teaches… while the human mind is pushed aside',
    enNote: 'An archive essay that puts human understanding before answer speed.',
    source: 'مقالات د. أحمد حسين الفيلكاوي',
    url: '/articles/artificial-intelligence-teaches-while-the-human-mind-is-pushed-aside-2',
    added: '2026-07-14',
  },
  {
    kind: 'الرف المنسي',
    ar: 'حوكمة الذكاء الاصطناعي والبيانات الضخمة',
    arNote: 'عودة إلى كتاب يربط التقنية بالقرار والمسؤولية المؤسسية.',
    en: 'Governing artificial intelligence and big data',
    enNote: 'A return to a book connecting technology with institutional judgment and responsibility.',
    source: 'مؤلفات د. أحمد حسين الفيلكاوي',
    url: '/publications/mega-data',
    added: '2026-07-13',
  },
  {
    kind: 'رؤية عميقة',
    ar: 'مشروع التعليم عن بُعد… من الفكرة إلى التجربة العامة',
    arNote: 'لقاء تلفزيوني يعيد فتح سؤال البنية التحتية ودور المعلم في التعليم الرقمي.',
    en: 'Distance education: from an idea to a public learning experience',
    enNote: 'A television conversation revisiting infrastructure and the teacher’s role in digital learning.',
    source: 'تلفزيون دولة الكويت · برنامج معاكم',
    url: 'https://www.youtube.com/watch?v=ydhZ9IcGaVc',
    added: '2026-07-12',
  },
  {
    kind: 'اقتباس وتأمل',
    ar: 'المعلم… وما أدراك ما المعلم',
    arNote: 'وقفة من الأرشيف مع الدور الذي لا تختصره منصة ولا أداة.',
    en: 'The teacher — a role no platform can reduce',
    enNote: 'An archive reflection on the part of teaching that no platform or tool can replace.',
    source: 'مقالات د. أحمد حسين الفيلكاوي',
    url: '/articles/the-teacher-what-do-you-know-about-the-teacher',
    added: '2026-07-11',
  },
]

const radarKind = (item: RadarItem): Curio['kind'] => {
  const text = `${item.ar} ${item.arNote || ''} ${item.en}`
  if (/أداة|منصة|تطبيق|tool|platform/i.test(text)) return 'أداة تستحق'
  if (/مفهوم|مصطلح|framework|literacy/i.test(text)) return 'مفهوم ناشئ'
  return 'رؤية عميقة'
}

const radarAsCurio = (item: RadarItem): Curio => ({
  kind: radarKind(item),
  ar: item.ar,
  arNote: item.arNote,
  en: item.en || item.ar,
  enNote: item.enNote,
  source: item.source,
  url: item.url,
  added: timestampIso(item.createdAt) || item.day || todayIso(),
})

function SourceLine({ c }: { c: Curio }) {
  return (
    <div className="mt-4 border-t border-hair pt-3 text-[.78rem] text-soft">
      <p className="flex items-center justify-between gap-3">
        <span>المصدر: {c.source}</span>
        {c.url && <span className="shrink-0 text-accent transition-transform duration-300 group-hover:-translate-x-1">اذهب للمصدر ←</span>}
      </p>
      {c.added && <p className="mt-1.5 text-[.7rem] font-light text-soft/70">أُضيفت في {fmtAdded(c.added)}</p>}
    </div>
  )
}

/* رادار الشبكة — يعرض ما يلتقطه scripts/daily-radar.mjs يومياً.
   يختفي كلياً ما دام الالتقاط غير مفعَّل. */
type RadarItem = { id?: string; ar: string; arNote?: string; en: string; enNote?: string; source: string; url: string; day: string; status?: string; createdAt?: unknown }

function RadarSection() {
  // المنشور فقط — مسودات وضع المراجعة (pending_review) لا تظهر للزوار
  const items = useExtras<RadarItem>('site_radar', { realtime: true }).filter((r) => !r.status || r.status === 'published')
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
  useSeo({ title: 'من اختياراتي', path: '/curated', description: 'اختيار متجدد يوميًا، سؤال جديد كل يومين، وكتاب شهري — بالعربية والإنجليزية ومن مصادر موثوقة.' })
  const reduce = useReducedMotion()
  const [kind, setKind] = useState<'الكل' | string>('الكل')
  const [today, setToday] = useState('')

  useEffect(() => {
    try { setToday(new Date().toLocaleDateString('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })) } catch { /* noop */ }
  }, [])

  // المختارات الحية + صيدات الرادار تنضم إلى الدورة فوراً.
  const extra = useExtras<Curio & { id?: string; createdAt?: unknown }>('site_picks', { realtime: true })
  const radarItems = useExtras<RadarItem>('site_radar', { realtime: true })
    .filter((item) => !item.status || item.status === 'published')
  const livePicks: Curio[] = extra.map((item) => ({
    ...item,
    added: item.added || timestampIso(item.createdAt) || todayIso(),
  }))
  const radarPicks = radarItems.map(radarAsCurio)
  const dynamic = [...livePicks, ...radarPicks]
    .filter((item) => item.ar && item.en && item.source)
    .filter((item, index, allItems) => allItems.findIndex((candidate) => (candidate.url || candidate.ar) === (item.url || item.ar)) === index)
    .sort((left, right) => (right.added || '').localeCompare(left.added || ''))
  const rotationPool = [...freshCurated, ...curatedBank]
  const fallbackIndex = rotationPool.length ? Math.floor(Date.now() / 86_400_000) % rotationPool.length : 0
  const fallbackDaily = { ...rotationPool[fallbackIndex], added: todayIso() }
  const daily = dynamic[0] || fallbackDaily
  const book = thisMonthsBook()
  const all = [...dynamic, ...freshCurated, ...curatedBank]
    .filter((item, index, allItems) => allItems.findIndex((candidate) => (candidate.url || candidate.ar) === (item.url || item.ar)) === index)
  const shown = kind === 'الكل' ? all : all.filter((c) => c.kind === kind)

  return (
    <Page>
      <PageHead
        label="من اختياراتي"
        title="المختارات."
        sub="تتجدد تلقائيًا من المختارات الحية وصيدات الرادار، مع سؤال دوري وكتاب شهري."
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
              <span className="text-[.85rem] text-soft">· {today} · يتحدّث فور وصول مختارة أو صيدة رادار جديدة</span>
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
                <span className="text-[.74rem] font-semibold text-accent">سؤال متجدد ✦</span>
                <h3 className="mt-3 font-display text-[1.2rem] font-semibold leading-[1.7] text-ink">سؤال يُقلق التعليم</h3>
                <p className="mt-2 text-[.9rem] font-light text-soft">سؤال جديد كل يومين؛ قصير في صياغته، واسع في أثره.</p>
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
