/* أربع لمسات «نووية» أنيقة — أحادية اللون + لكنة #3E5C78، بلا تلوث بصري:
   ١) الجسر: كاتب ↔ باحث   — يربط هويتَي الدكتور حول الفكرة نفسها.
   ٢) نبض المقال            — يُشير إلى الجملة التي توقّف عندها أكثر القرّاء (رنين جمعي).
   ٣) الاقتباس السينمائي     — كشفٌ متحرك، كلمةً كلمة، لجملةٍ مختارة.
   ٤) بصمة القارئ           — أثرٌ شخصيّ محليّ بالكامل (بلا خادم، بلا تتبّع) يُهدى للقارئ.
   كل مكوّن مستقل ونقيّ: يستقبل بياناته أو يقرأ التخزين المحلي، ويختفي بلطف حين لا مادة له. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { getDb } from '../lib/firebase'

const READER_QUOTES_KEY = 'reader:quotes:v2'
const READER_READ_KEY = 'reader:read:v1'

/* ═══════════════ ١) الجسر: كاتب ↔ باحث ═══════════════ */
type BridgePaper = { slug: string; title: string }
export function WriterResearcherBridge({ articleTitle, paper }: { articleTitle: string; paper?: BridgePaper | null }) {
  const reduce = useReducedMotion()
  if (!paper) return null
  return (
    <motion.section
      aria-label="الجسر بين الكاتب والباحث"
      className="my-14 overflow-hidden rounded-[2rem] border border-hair bg-wash/50 px-5 py-8 md:px-10 md:py-10"
      initial={reduce ? undefined : { opacity: 0, y: 18 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-center text-[.74rem] font-semibold uppercase tracking-[.18em] text-accent">الجسر</p>
      <div className="mt-6 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-6">
        <div className="rounded-2xl border border-hair bg-canvas px-5 py-6 text-center md:text-right">
          <p className="text-[.72rem] font-semibold uppercase tracking-wide text-soft">بوصفي كاتباً</p>
          <p className="mt-2 font-display text-[1.05rem] font-semibold leading-[1.7] text-ink">{articleTitle}</p>
          <p className="mt-2 text-[.8rem] font-light text-soft">تأمّلٌ يطرح السؤال.</p>
        </div>
        <div className="flex items-center justify-center" aria-hidden>
          <span className="hidden h-px w-10 bg-gradient-to-l from-transparent via-accent/50 to-transparent md:block" />
          <span className="mx-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/40 text-accent">⇄</span>
          <span className="hidden h-px w-10 bg-gradient-to-r from-transparent via-accent/50 to-transparent md:block" />
        </div>
        <Link
          to={`/research/${paper.slug}`}
          className="group rounded-2xl border border-accent/30 bg-canvas px-5 py-6 text-center transition-colors hover:border-accent md:text-right"
        >
          <p className="text-[.72rem] font-semibold uppercase tracking-wide text-accent">بوصفي باحثاً</p>
          <p className="mt-2 font-display text-[1.05rem] font-semibold leading-[1.7] text-ink transition-colors group-hover:text-accent">{paper.title}</p>
          <p className="mt-2 text-[.8rem] font-light text-soft">دليلٌ يقترب من الجواب ←</p>
        </Link>
      </div>
      <p className="mt-6 text-center text-[.82rem] font-light leading-relaxed text-soft">
        الفكرة نفسها، بصوتين: مقالٌ يفتحها للناس، وبحثٌ يختبرها بالأدلّة.
      </p>
    </motion.section>
  )
}

/* ═══════════════ ٢) نبض المقال ═══════════════ */
export function ArticlePulse({ slug }: { slug: string }) {
  const [count, setCount] = useState(0)
  const [readers, setReaders] = useState(0)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { collection, getDocs, query, where } = await import('firebase/firestore')
        const snap = await getDocs(query(collection(db, 'article_highlights'), where('slug', '==', slug)))
        let top = 0
        let sum = 0
        snap.forEach((d) => { const c = Number(d.data().count || 0); sum += c; if (c > top) top = c })
        if (alive) { setCount(top); setReaders(sum) }
      } catch { /* الصمت أفضل من بطاقة خطأ */ }
    })()
    return () => { alive = false }
  }, [slug])

  // الأثر الصامت (أمر الدكتور): لا أرقام ولا عدّادات — حضورٌ لا مقياس. النبضة وحدها
  // تقول إن جملةً هنا لامست كثيرين، والقارئ يكتشفها بنفسه. الرنين يظهر فقط حين يكون حقيقياً.
  void readers
  if (count < 3) return null
  return (
    <a
      href="#article-body"
      className="group mt-10 flex items-center gap-4 rounded-2xl border border-hair bg-wash/40 px-5 py-4 transition-colors hover:border-accent/40"
      aria-label="نبض المقال — جملةٌ لامست كثيرين"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/30" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent/80" />
      </span>
      <span className="text-[.85rem] font-light leading-relaxed text-soft">
        <span className="font-semibold text-accent">نبض المقال —</span>{' '}
        جملةٌ في هذا النص توقّف عندها كثيرون. اقرأه على مهل، وستعرفها حين تمرّ بها.
      </span>
    </a>
  )
}

/* ═══════════════ ٣) الاقتباس السينمائي المتحرك ═══════════════ */
export function CinematicQuote({ quote }: { quote?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const words = useMemo(() => (quote || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), [quote])
  if (words.length < 3 || words.length > 34) return null
  return (
    <div ref={ref} className="my-16 md:my-20">
      <div className="mx-auto max-w-3xl px-2 text-center">
        <span aria-hidden className="mx-auto mb-5 block h-px w-12 bg-accent/50" />
        <p className="font-display text-[clamp(1.5rem,3.8vw,2.4rem)] font-semibold leading-[1.7] text-ink">
          {words.map((word, index) => (
            <motion.span
              key={`${word}-${index}`}
              className="inline-block whitespace-pre"
              initial={reduce ? undefined : { opacity: 0.12, y: 6 }}
              animate={reduce ? undefined : inView ? { opacity: 1, y: 0 } : { opacity: 0.12, y: 6 }}
              transition={{ duration: 0.5, delay: Math.min(index * 0.06, 2), ease: [0.16, 1, 0.3, 1] }}
            >
              {word}{index < words.length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </p>
        <span aria-hidden className="mx-auto mt-5 block h-px w-12 bg-accent/50" />
      </div>
    </div>
  )
}

/* ═══════════════ ٤) بصمة القارئ ═══════════════ */
type SavedQuote = { slug: string; title: string; cat?: string; savedAt: number; quote: string }
const CAT_LABEL: Record<string, string> = {
  'مقال': 'مقالات', 'تعليم': 'التعليم', 'تقنية': 'التقنية والتعلم', 'ذكاء': 'الذكاء الاصطناعي',
  'مجتمع': 'المجتمع', 'تربية': 'التربية', 'رقمي': 'التحول الرقمي',
}
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

function readJourney(): { quotes: SavedQuote[]; read: string[] } {
  try {
    const q = JSON.parse(window.localStorage.getItem(READER_QUOTES_KEY) || '[]')
    const r = JSON.parse(window.localStorage.getItem(READER_READ_KEY) || '[]')
    return {
      quotes: Array.isArray(q) ? q.filter((x) => x?.slug && x?.quote) : [],
      read: Array.isArray(r) ? r.filter((x) => typeof x === 'string') : [],
    }
  } catch { return { quotes: [], read: [] } }
}

/** يسجّل مقالاً في سجلّ القراءة المحلي (خاص بالجهاز، بلا خادم). يُستدعى عند فتح مقال. */
export function markArticleRead(slug: string) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(READER_READ_KEY) || '[]')
    const set = new Set<string>(Array.isArray(raw) ? raw : [])
    if (set.has(slug)) return
    set.add(slug)
    window.localStorage.setItem(READER_READ_KEY, JSON.stringify([...set].slice(-400)))
    window.dispatchEvent(new CustomEvent('reader:journey-changed'))
  } catch { /* noop */ }
}

/* بصمة بصرية فريدة تُولَّد من أرقام القارئ نفسها — لا صورتين متطابقتين. */
function fingerprintPath(seed: number) {
  const rings: string[] = []
  let s = seed || 1
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  for (let i = 0; i < 5; i++) {
    const r = 12 + i * 8 + rand() * 4
    const gap = 0.15 + rand() * 0.5
    const rot = rand() * 360
    rings.push(`<circle cx="60" cy="60" r="${r.toFixed(1)}" fill="none" stroke="rgb(62 92 120 / ${(0.9 - i * 0.13).toFixed(2)})" stroke-width="1.5" stroke-dasharray="${(r * gap).toFixed(1)} ${(r * (1 - gap) * 0.5).toFixed(1)}" transform="rotate(${rot.toFixed(0)} 60 60)"/>`)
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${rings.join('')}</svg>`)}`
}

export function ReaderFingerprint() {
  const [{ quotes, read }, setState] = useState<{ quotes: SavedQuote[]; read: string[] }>({ quotes: [], read: [] })
  useEffect(() => {
    const load = () => setState(readJourney())
    load()
    window.addEventListener('reader:quotes-changed', load)
    window.addEventListener('reader:journey-changed', load)
    return () => {
      window.removeEventListener('reader:quotes-changed', load)
      window.removeEventListener('reader:journey-changed', load)
    }
  }, [])

  const data = useMemo(() => {
    const articles = new Set<string>([...read, ...quotes.map((q) => q.slug)])
    const catCount = new Map<string, number>()
    for (const q of quotes) { const c = q.cat || 'مقال'; catCount.set(c, (catCount.get(c) || 0) + 1) }
    const topCat = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const times = quotes.map((q) => q.savedAt).filter(Boolean).sort((a, b) => a - b)
    const first = times[0] ? new Date(times[0]) : null
    const seed = quotes.reduce((acc, q) => acc + q.quote.length + q.slug.length, articles.size * 31 + read.length * 7)
    return {
      articles: articles.size,
      sentences: quotes.length,
      theme: topCat ? (CAT_LABEL[topCat] || topCat) : '',
      since: first ? `${MONTHS[first.getMonth()]} ${first.getFullYear().toLocaleString('ar-KW', { useGrouping: false })}` : '',
      seed,
      lastQuote: quotes.length ? quotes[quotes.length - 1].quote : '',
    }
  }, [quotes, read])

  if (data.articles === 0 && data.sentences === 0) {
    return (
      <section aria-label="بصمة القارئ" className="rounded-[2rem] border border-hair bg-wash/40 px-6 py-10 text-center">
        <p className="text-[.74rem] font-semibold uppercase tracking-[.18em] text-accent">بصمتك القارئة</p>
        <p className="mx-auto mt-3 max-w-md text-[.9rem] font-light leading-relaxed text-soft">
          حين تقرأ مقالاً أو تحفظ جملةً لامستك، تتشكّل هنا بصمةٌ خاصة بك وحدك — تبقى على جهازك، لا يراها أحد.
        </p>
      </section>
    )
  }

  const ar = (n: number) => n.toLocaleString('ar-KW')
  return (
    <section aria-label="بصمة القارئ" className="overflow-hidden rounded-[2rem] border border-hair bg-wash/50 px-6 py-9 md:px-10">
      <div className="flex flex-col items-center gap-7 md:flex-row md:items-center md:gap-10">
        <img src={fingerprintPath(data.seed)} alt="" aria-hidden width={112} height={112} className="h-28 w-28 shrink-0 opacity-90" />
        <div className="min-w-0 flex-1 text-center md:text-right">
          <p className="text-[.74rem] font-semibold uppercase tracking-[.18em] text-accent">بصمتك القارئة</p>
          <p className="mt-3 font-display text-[1.15rem] font-semibold leading-[1.8] text-ink">
            لامستَ <span className="text-accent">{ar(data.articles)}</span> من المقالات،
            واحتفظتَ بـ<span className="text-accent">{ar(data.sentences)}</span> من الجُمل
            {data.theme ? <> — أكثر ما يشغلك <span className="text-accent">{data.theme}</span></> : null}.
          </p>
          {data.since ? <p className="mt-2 text-[.82rem] font-light text-soft">منذ {data.since} · تبقى هذه البصمة على جهازك وحده.</p> : null}
          {/* المرآة: كما تنمو بصمته المعرفية (في السيرة) من كل بحثٍ وكتاب، تنمو بصمتُك من كل جملةٍ لامستك. */}
          <p className="mt-3 text-[.78rem] font-light italic leading-relaxed text-soft/90">
            كما لبصمته المعرفية شكلٌ ينمو من كل ما يكتب، لرحلتك بصمةٌ تنمو من كل ما يمسّك.
          </p>
          {data.lastQuote ? (
            <p className="mt-4 border-r-2 border-accent/35 pe-1 ps-4 text-right text-[.9rem] font-light italic leading-[1.9] text-ink/80">
              «{data.lastQuote.length > 150 ? `${data.lastQuote.slice(0, 147)}…` : data.lastQuote}»
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
