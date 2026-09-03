/**
 * «العتبة» — تقديمٌ سينمائيّ يُعرض مرة واحدة عند أول زيارة.
 *
 * ليس نافذةً تشرح ثلاث أدوات، بل عرضٌ قصير يُري الزائر الموقعَ وهو يعمل:
 * كل مشهدٍ نموذجٌ حيٌّ مصغّر للميزة نفسها، وكل مشهدٍ بابٌ يُدخِله إليها بنقرة.
 *
 * ملاحظات تنفيذية:
 * - المسرح يحمل لوحته الخاصة (ليل ثابت) في الوضعين الفاتح والداكن — لأنه لحظة إظلامٍ مقصودة.
 * - كل الأنماط داخل هذا الملف بقيمٍ صريحة، بلا اعتمادٍ على أصنافٍ قد تسقط صامتة.
 * - الحركات موقوفة افتراضياً ولا تعمل إلا في المشهد النشِط (لا تدور خلف الكواليس).
 * - عند تفضيل تقليل الحركة: يُقفز مباشرةً إلى لوحة الأبواب بلا حركة.
 * - للإعادة في أي وقت: /?intro=1
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { EASE } from '../motion'
import { arabicCountPhrase, ARTICLE_PLAIN_FORMS, BOOK_PLAIN_FORMS, PAPER_FORMS } from '../../lib/arabic-count.ts'

const STORAGE_KEY = 'visitor:threshold-overture:v1'

type Counts = { articles: number; books: number; papers: number; episodes: number }
type ArchiveDay = { title: string; line: string; slug: string; year: string }

/* ───────────────────────── المشاهد المصغّرة ───────────────────────── */

/** الإشعال: جمرةٌ واحدة تتسع حلقةً، ثم يُرسم الأفق وتُضاء أولى النجوم. */
function IgnitionVisual() {
  return (
    <svg viewBox="0 0 520 300" className="tho-art" aria-hidden="true">
      <circle className="tho-ig-ring" cx="260" cy="150" r="10" />
      <circle className="tho-ig-ring tho-d2" cx="260" cy="150" r="10" />
      <line className="tho-ig-horizon" x1="60" y1="150" x2="460" y2="150" />
      <circle className="tho-ig-ember" cx="260" cy="150" r="4.5" />
      {[[150, 96], [340, 108], [386, 196], [128, 200], [214, 74]].map(([x, y], i) => (
        <circle key={i} className={`tho-ig-star tho-d${i + 1}`} cx={x} cy={y} r="1.9" />
      ))}
    </svg>
  )
}

/** سماء المقالات: نجومٌ تظهر تباعاً، ثم تُرسم الخطوط بينها. */
const SKY_STARS = [
  [78, 62], [148, 118], [96, 186], [206, 74], [232, 158], [178, 226],
  [286, 116], [318, 210], [262, 44], [368, 78], [396, 162], [346, 250],
  [438, 118], [128, 254], [204, 288], [462, 214], [58, 128], [300, 274],
] as const
const SKY_LINKS = [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [4, 6], [6, 7], [3, 8], [6, 9], [9, 10], [10, 11], [10, 12], [2, 13], [5, 14], [12, 15], [0, 16], [7, 17]] as const

function SkyVisual() {
  return (
    <svg viewBox="0 0 520 320" className="tho-art" aria-hidden="true">
      <g className="tho-sky-links">
        {SKY_LINKS.map(([a, b], i) => (
          <line key={i} style={{ animationDelay: `${0.5 + i * 0.055}s` }} x1={SKY_STARS[a][0]} y1={SKY_STARS[a][1]} x2={SKY_STARS[b][0]} y2={SKY_STARS[b][1]} />
        ))}
      </g>
      <g className="tho-sky-stars">
        {SKY_STARS.map(([x, y], i) => (
          <circle key={i} style={{ animationDelay: `${i * 0.045}s` }} cx={x} cy={y} r={i % 5 === 0 ? 2.9 : 1.9} />
        ))}
      </g>
    </svg>
  )
}

/** البحث العميق: سؤالٌ يُكشف حرفاً حرفاً، ثم تتقاطر النتائج من أنواعٍ مختلفة. */
function SearchVisual() {
  return (
    <div className="tho-art tho-mock" aria-hidden="true">
      <div className="tho-field">
        <span className="tho-field-glyph">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M10.5 4a6.5 6.5 0 104.03 11.6l3.94 3.94 1.41-1.41-3.94-3.94A6.5 6.5 0 0010.5 4zm0 2a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" /></svg>
        </span>
        <span className="tho-typed"><i>لماذا يتعثّر التعليم رغم وفرة التكنولوجيا؟</i></span>
        <span className="tho-caret" />
      </div>
      <div className="tho-chips">
        {[['مقالة', 'صناعة العقل لا صناعة الأدوات'], ['بحث محكَّم', 'أثر البيئة الرقمية في التحصيل'], ['كتاب', 'حين يسبق السؤالُ الجواب'], ['لقاء', 'التعليم بين الوفرة والمعنى']].map(([kind, name], i) => (
          <span key={kind} className="tho-chip" style={{ animationDelay: `${1.35 + i * 0.17}s` }}>
            <b>{kind}</b>
            <em>{name}</em>
          </span>
        ))}
      </div>
    </div>
  )
}

/** اسأل الأرشيف: سؤالٌ، ثم جوابٌ يُبنى سطراً سطراً وتستقرّ تحته بطاقةُ المصدر. */
function AskVisual() {
  return (
    <div className="tho-art tho-mock" aria-hidden="true">
      <div className="tho-bubble tho-bubble--ask">هل غيّرت التكنولوجيا سؤالَ التعليم أم أدواته فقط؟</div>
      <div className="tho-bubble tho-bubble--answer">
        <span className="tho-ln" style={{ animationDelay: '.75s', width: '100%' }} />
        <span className="tho-ln" style={{ animationDelay: '1.05s', width: '88%' }} />
        <span className="tho-ln" style={{ animationDelay: '1.35s', width: '62%' }} />
        <span className="tho-cite">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M3.9 12a5 5 0 015-5h3v2h-3a3 3 0 000 6h3v2h-3a5 5 0 01-5-5zm4.1-1h8v2H8v-2zm7.1-4h-3v2h3a3 3 0 010 6h-3v2h3a5 5 0 000-10z" /></svg>
          من مقالة منشورة · 2023
        </span>
      </div>
    </div>
  )
}

/** مجلس الفكرة: سؤالٌ يفتح الحلقة، وصوتٌ واحد يقرؤها — كما في فهرس الاستماع نفسه. */
function ListenVisual() {
  return (
    <div className="tho-art tho-mock tho-mock--center" aria-hidden="true">
      <div className="tho-voices">
        <span className="tho-voice">صوتٌ يقرأ</span>
      </div>
      <div className="tho-wave">
        {Array.from({ length: 34 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${(i % 11) * 0.09}s`, height: `${18 + ((i * 37) % 62)}%` }} />
        ))}
      </div>
    </div>
  )
}

/** وثيقة العقد: السنوات تُضاء واحدةً واحدة، والخطُّ يُرسم فوقها.
 *  الزمن يجري من اليمين إلى اليسار كاتجاه القراءة: أقدمُ سنةٍ يميناً وأدناها ارتفاعاً،
 *  فيصعد الخطّ كلّما تقدّمنا يساراً. (لو عُكس لقُرئ العقدُ هبوطاً.) */
const DECADE_POINTS = '58,86 106,74 154,120 202,112 250,156 298,148 346,186 394,178 442,196'
// يُرسم الخطّ معكوساً ليبدأ من أقصى اليمين، وتُضاء السنوات من اليمين كذلك.
const DECADE_PATH = DECADE_POINTS.split(' ').reverse().join(' ')
function DecadeVisual() {
  const stops = DECADE_POINTS.split(' ')
  return (
    <svg viewBox="0 0 500 240" className="tho-art" aria-hidden="true">
      <line className="tho-dec-base" x1="46" y1="212" x2="454" y2="212" />
      {stops.map((stop, i) => (
        <g key={stop} style={{ animationDelay: `${0.35 + (stops.length - 1 - i) * 0.13}s` }} className="tho-dec-tick">
          <line x1={58 + i * 48} y1="206" x2={58 + i * 48} y2="218" />
          <circle cx={58 + i * 48} cy={Number(stop.split(',')[1])} r="3.2" />
        </g>
      ))}
      <polyline className="tho-dec-line" points={DECADE_PATH} />
    </svg>
  )
}

/** مسار الفكرة: سؤالٌ واحد يتفرّع إلى أنواع المحتوى كلّها. */
function PathVisual() {
  return (
    <svg viewBox="0 0 500 260" className="tho-art" aria-hidden="true">
      <g className="tho-path-lines">
        <path style={{ animationDelay: '.45s' }} d="M250 74 C250 128 118 122 118 182" />
        <path style={{ animationDelay: '.62s' }} d="M250 74 C250 130 206 130 206 182" />
        <path style={{ animationDelay: '.79s' }} d="M250 74 C250 130 294 130 294 182" />
        <path style={{ animationDelay: '.96s' }} d="M250 74 C250 128 382 122 382 182" />
      </g>
      <g className="tho-path-node tho-path-node--root">
        <rect x="176" y="34" width="148" height="40" rx="20" />
        <text x="250" y="59">سؤال واحد</text>
      </g>
      <g className="tho-path-leaves">
        {[['مقالة', 118], ['بحث', 206], ['كتاب', 294], ['لقاء', 382]].map(([label, x], i) => (
          <g key={label as string} className="tho-path-node" style={{ animationDelay: `${1.05 + i * 0.14}s` }}>
            <rect x={(x as number) - 42} y="182" width="84" height="36" rx="18" />
            <text x={x as number} y="205">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

/* ───────────────────────── نصّ العرض ───────────────────────── */

type Act = {
  id: string
  kicker: string
  title: string
  line: string
  path?: string
  door?: string
  count?: number
  visual: ReactNode
  ms: number
}

function buildActs(c: Counts, archiveDay?: ArchiveDay | null): Act[] {
  return [
    archiveDay ? {
      id: 'ignition',
      kicker: 'في مثل هذا اليوم',
      title: archiveDay.title,
      line: archiveDay.line,
      path: `/articles/${archiveDay.slug}`,
      door: 'افتح المقال',
      visual: <IgnitionVisual />,
      /* المشهد الافتتاحي وحده قُصِّر (3600→1400، والبديل 3000→1200)
         لأن ما بعده — «سماءٌ واحدة» — هو أكبر عنصرٍ في الصفحة، فوقتُ
         وصوله هو زمن LCP الذي تقيسه محركات البحث على كل قادمٍ جديد.
         مقيس بخنق 4G: الفجوة بين ظهور البطل وظهور هذا المشهد كانت
         4280ms فصارت 2340ms. بقية المشاهد لم تُمسّ — الإيقاع بعد
         الافتتاح كما ضبطتَه. */
      ms: 1400,
    } : {
      id: 'ignition',
      kicker: 'تقديمٌ قصير',
      title: 'هذا أرشيفٌ يفكّر.',
      line: 'عقدٌ من السؤال، مفتوحٌ أمامك بأدواتٍ لم تعتدها في المواقع.',
      visual: <IgnitionVisual />,
      ms: 1200,
    },
    {
      id: 'sky',
      kicker: 'خريطة',
      title: c.articles > 0 ? `${arabicCountPhrase(c.articles, ARTICLE_PLAIN_FORMS)} في سماءٍ واحدة.` : 'المقالات في سماءٍ واحدة.',
      line: 'كل نجمةٍ مقالة، وكل خطٍّ بينهما صلةٌ موثّقة — لا زينة.',
      path: '/atlas',
      door: 'سماء المقالات',
      count: c.articles,
      visual: <SkyVisual />,
      ms: 3900,
    },
    {
      id: 'search',
      kicker: 'بحث',
      title: 'اكتب المعنى، لا الكلمة.',
      line: 'يفهم ما تقصده وإن لم تعرف عنوان المادة، ثم يفتح الكتب والمقالات والأبحاث واللقاءات معاً.',
      path: '/search',
      door: 'البحث العميق',
      count: c.articles + c.books + c.papers,
      visual: <SearchVisual />,
      ms: 4100,
    },
    {
      id: 'ask',
      kicker: 'العقل الحيّ',
      title: 'اسأله، لا تبحث فيه.',
      line: 'يركّب الجواب من نصوصي وحدها ويعيدك إلى الفقرة التي استند إليها. وإن لم يجد دليلاً قال ذلك بوضوح.',
      path: '/ask',
      door: 'اسأل الأرشيف',
      count: c.articles + c.books + c.papers,
      visual: <AskVisual />,
      ms: 4100,
    },
    {
      id: 'listen',
      kicker: 'استمع',
      title: 'الأرشيف يُقرأ بصوت.',
      // بلا عدد هنا عمداً: الصيغة العامة أبلغ، ولا تتقلّب مع نمو الفهرس.
      line: 'ما لا تجد وقتاً لقراءته، تجد وقتاً لسماعه: مقالةٌ كاملة بصوتٍ متمهّل، يفتحها سؤال.',
      path: '/listen',
      door: 'مجلس الفكرة',
      count: c.episodes,
      visual: <ListenVisual />,
      ms: 3900,
    },
    {
      id: 'decade',
      kicker: 'السيرة الفكرية الحيّة',
      title: 'الأرشيف يكتب سيرتي بدلاً عني.',
      line: 'أين بدأ السؤال، ومتى اتّسع، وما الذي بقي يُلحّ عاماً بعد عام — بالنصوص والتواريخ لا بالانطباع.',
      path: '/decade',
      door: 'وثيقة العقد',
      count: Math.max(1, new Date().getFullYear() - 2015 + 1),
      visual: <DecadeVisual />,
      ms: 3900,
    },
    {
      id: 'paths',
      kicker: 'قراءة عابرة للأنواع',
      title: 'ابدأ من سؤال، لا من قائمة.',
      line: 'اختر فكرةً لترى كيف انتقلت بين المقالة والبحث والكتاب والحوار العام.',
      path: '/thought-paths',
      door: 'مسار الفكرة',
      count: c.articles + c.books + c.papers,
      visual: <PathVisual />,
      ms: 3900,
    },
  ]
}

/* ───────────────────────── المكوّن ───────────────────────── */

export default function ThresholdOverture({ articles = 0, books = 0, papers = 0, episodes = 0, archiveDay = null }: Partial<Counts> & { archiveDay?: ArchiveDay | null } = {}) {
  const [open, setOpen] = useState(false)
  const [act, setAct] = useState(0)
  // إيقافان منفصلان: «المسافة» قرارٌ يبقى، وضغطة الإصبع تزول برفعه.
  // دمجُهما كان يجعل مرور الفأرة خارج المسرح يُلغي إيقاف لوحة المفاتيح.
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  // مع تفضيل تقليل الحركة تُعرض لوحة الأبواب من أول رسمة، فلا يلمع مشهدٌ ثم يختفي.
  const [done, setDone] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  )
  const navigate = useNavigate()
  // لا نتّكل على useReducedMotion وحده: يقرأ الاستعلام مرةً عند الاستيراد ويحتفظ به،
  // فنقرأ التفضيل بأنفسنا أيضاً ونأخذ بأيّهما أثبت التفضيل.
  const framerReduced = useReducedMotion()
  const systemReduced = useMemo(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    [],
  )
  const reduced = systemReduced || Boolean(framerReduced)
  const skipRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const touchX = useRef(0)

  const acts = useMemo(() => buildActs({ articles, books, papers, episodes }, archiveDay), [archiveDay, articles, books, papers, episodes])
  const doorGroups = useMemo(() => [
    { label: 'أفهم', ids: new Set(['ask', 'search']) },
    { label: 'أستكشف', ids: new Set(['sky', 'paths', 'decade']) },
    { label: 'أستمتع', ids: new Set(['listen']) },
  ].map((group) => ({ ...group, items: acts.filter((item) => item.path && group.ids.has(item.id)) })), [acts])
  // اللمس يُوجَّه بكلامٍ يخصّه، والفأرة بلوحة المفاتيح.
  const coarsePointer = useMemo(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches), [])
  const total = acts.length
  const atThreshold = done || act >= total

  useEffect(() => {
    let forced = false
    try {
      forced = new URLSearchParams(window.location.search).get('intro') === '1'
      if (!forced && localStorage.getItem(STORAGE_KEY)) return
    } catch { /* وضع التصفح الخاص: يُعرض التقديم ولا يُخزَّن. */ }
    /* 420→240: مهلة الفتح تُضاف كاملةً إلى زمن أكبر عنصرٍ في الصفحة. */
    const timer = window.setTimeout(() => setOpen(true), forced ? 60 : 240)
    return () => window.clearTimeout(timer)
  }, [])

  // عند تفضيل تقليل الحركة: تُعرض لوحة الأبواب مباشرةً بلا عرضٍ متحرك.
  useEffect(() => {
    if (open && reduced) setDone(true)
  }, [open, reduced])

  const close = useCallback((path?: string) => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch { /* لا يمنع الإغلاق */ }
    setOpen(false)
    if (path) window.setTimeout(() => navigate(path), 260)
  }, [navigate])

  const step = useCallback((delta: number) => {
    // الرجوع من لوحة الأبواب يعيد آخر مشهد، لا الذي قبله.
    if (done && delta < 0) { setDone(false); return }
    const next = act + delta
    if (next >= total) { setDone(true); return }
    setDone(false)
    setAct(next < 0 ? 0 : next)
  }, [act, done, total])

  // محرّك التقدّم التلقائي — يتوقّف عند الإيقاف المؤقت وعند لوحة الأبواب.
  useEffect(() => {
    if (!open || paused || held || atThreshold || reduced) return
    const timer = window.setTimeout(() => {
      if (act + 1 >= total) setDone(true)
      else setAct(act + 1)
    }, acts[act]?.ms ?? 3800)
    return () => window.clearTimeout(timer)
  }, [open, paused, held, act, atThreshold, reduced, total, acts])

  // قفل التمرير + لوحة المفاتيح + حصر التنقّل داخل المسرح.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    skipRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(); return }
      if (event.key === ' ') { event.preventDefault(); setPaused((p) => !p); return }
      // في الاتجاه من اليمين لليسار: السهم الأيسر يتقدّم.
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(1); return }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(-1); return }
      if (event.key !== 'Tab') return
      const root = rootRef.current
      if (!root) return
      const stops = root.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!stops.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close, step])

  const current = acts[Math.min(act, total - 1)]

  if (typeof document === 'undefined') return null

  // يُركَّب على <body> مباشرةً: شريط التصفّح وأزرار الإجراءات العائمة مثبّتة داخل شجرة الصفحة،
  // فلو بقي المسرح بينها لظهرت فوقه رغم ارتفاع طبقته.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={rootRef}
          className="tho-root"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="تقديم الموقع"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          /* التسليم يكون سريعاً لأن الطبقة معتمة (‎--night‎): كل مِلّي في هذا
             التلاشي هو مِلّي يرى فيه الزائر التقديمَ والصفحةَ معاً — شبحاً
             مزدوجاً. ٠٫٢٦ تكفي لتبقى الحركة ناعمة ولا يظهر التراكب. */
          exit={{ opacity: 0, transition: { duration: 0.26, ease: EASE } }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <style>{THEATRE_CSS}</style>

          <div className="tho-sky-bg" aria-hidden="true" />
          <div className="tho-grain" aria-hidden="true" />
          <motion.i className="tho-bar tho-bar--top" aria-hidden="true" initial={{ scaleY: 1 }} animate={{ scaleY: atThreshold ? 0.34 : 1 }} transition={{ duration: 0.7, ease: EASE }} />
          <motion.i className="tho-bar tho-bar--bottom" aria-hidden="true" initial={{ scaleY: 1 }} animate={{ scaleY: atThreshold ? 0.34 : 1 }} transition={{ duration: 0.7, ease: EASE }} />

          {/* شريط البكرة + التخطّي */}
          <header className="tho-top">
            <button ref={skipRef} type="button" className="tho-skip" onClick={() => close()}>
              {atThreshold ? 'إغلاق' : 'تخطَّ التقديم'}
            </button>
            {!reduced && (
              <div className="tho-reel" aria-hidden="true">
                {acts.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    tabIndex={-1}
                    className="tho-reel-seg"
                    data-state={index < act || atThreshold ? 'past' : index === act ? 'live' : 'next'}
                    aria-label={`المشهد ${index + 1}`}
                    onClick={() => { setDone(false); setAct(index) }}
                  >
                    {/* المفتاح يحمل رقم المشهد ليُعاد تركيب العنصر فتبدأ حركة التعبئة من جديد عند الرجوع. */}
                    <i key={`${item.id}-${act}-${String(done)}`} style={index === act && !atThreshold ? { animationDuration: `${item.ms}ms`, animationPlayState: paused || held ? 'paused' : 'running' } : undefined} />
                  </button>
                ))}
              </div>
            )}
            <span className="tho-mark">د. أحمد الفيلكاوي</span>
          </header>

          {/* المسرح */}
          <div
            className="tho-stage"
            onPointerDown={() => !atThreshold && setHeld(true)}
            onPointerUp={() => setHeld(false)}
            onPointerCancel={() => setHeld(false)}
            onPointerLeave={() => setHeld(false)}
            onTouchStart={(event) => { touchX.current = event.touches[0].clientX }}
            onTouchEnd={(event) => {
              const delta = event.changedTouches[0].clientX - touchX.current
              if (Math.abs(delta) > 46) step(delta > 0 ? -1 : 1)
            }}
          >
            {/* بلا mode="wait": المشاهد تتلاشى فوق بعضها في خليةٍ واحدة، فالقفز بين الفصول فوريّ لا ينتظر دوره. */}
            <AnimatePresence>
              {atThreshold ? (
                <motion.div
                  key="threshold"
                  className="tho-threshold"
                  initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.22, ease: EASE } }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  <p className="tho-kicker">العتبة</p>
                  <h2 className="tho-title tho-title--sm">كل بابٍ مفتوح.</h2>
                  <p className="tho-line">ادخل من حيث شئت — أو تصفّح على مهلك، فالأرشيف كلّه أمامك.</p>

                  <div className="tho-door-groups">
                    {doorGroups.map((group, groupIndex) => (
                      <section key={group.label} className="tho-door-group" aria-label={group.label}>
                        <p className="tho-door-group-title">{group.label}</p>
                        <div className="tho-doors">
                          {group.items.map((item, index) => (
                            <button
                              key={item.id}
                              type="button"
                              className="tho-door"
                              style={{ animationDelay: `${0.18 + (groupIndex * 2 + index) * 0.07}s` }}
                              onClick={() => close(item.path)}
                            >
                              <span className="tho-door-name">{item.door}{item.count ? <small> · {item.count}</small> : null}</span>
                              <span className="tho-door-line">{item.kicker}</span>
                              <span className="tho-door-arrow" aria-hidden="true">↖</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  {(articles > 0 || books > 0 || papers > 0) && (
                    <p className="tho-tally">
                      {[
                        articles && arabicCountPhrase(articles, ARTICLE_PLAIN_FORMS),
                        papers && arabicCountPhrase(papers, PAPER_FORMS),
                        books && arabicCountPhrase(books, BOOK_PLAIN_FORMS),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <button type="button" className="tho-enter" onClick={() => close()}>ابدأ التصفّح</button>
                  {!reduced && (
                    <button type="button" className="tho-again" onClick={() => { setDone(false); setAct(0) }}>أعد التقديم من البداية</button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={current.id}
                  className="tho-scene"
                  /* بلا تمويه: التمويه يُعيد رسم الطبقة كلَّ إطار، فيبقى العنوان
                     غير مقروءٍ طوال الانتقال ويتعثّر على الأجهزة المتوسطة.
                     الإزاحة والشفافية وحدهما تعطيان الأثر نفسه بلا كلفة. */
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14, transition: { duration: 0.24, ease: EASE } }}
                  transition={{ duration: 0.52, ease: EASE }}
                >
                  <div className="tho-frame is-live">{current.visual}</div>
                  <p className="tho-kicker">{current.kicker}</p>
                  <h2 className="tho-title">{current.title}</h2>
                  <p className="tho-line">{current.line}</p>
                  {current.path && (
                    <button type="button" className="tho-open" onClick={() => close(current.path)}>
                      افتح هذا الباب الآن
                      <span aria-hidden="true">↖</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!atThreshold && !reduced && (
            <footer className="tho-hint">
              <button type="button" className="tho-nav" onClick={() => step(-1)} disabled={act === 0} aria-label="المشهد السابق">→</button>
              <span>{coarsePointer ? 'المسه للإيقاف · اسحب للتنقّل' : 'المسافة للإيقاف · الأسهم للتنقّل'}</span>
              <button type="button" className="tho-nav" onClick={() => step(1)} aria-label="المشهد التالي">←</button>
            </footer>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ───────────────────────── لوحة المسرح ─────────────────────────
   قيمٌ صريحة عمداً: هذه طبقةٌ فوق الموقع كلّه، فلا تتبع سِمة الصفحة.  */

const THEATRE_CSS = `
.tho-root{
  --night:#0b0d12; --night-2:#141922; --glow:132 169 202; --ember:214 183 143;
  --ivory:#efece4; --soft:#9aa4b2; --line:rgba(239,236,228,.13);
  position:fixed; top:0; right:0; bottom:0; left:0; inset:0; z-index:1200; display:flex; flex-direction:column;
  background:var(--night); color:var(--ivory);
  font-family:"Tajawal",system-ui,sans-serif; overflow:hidden;
  -webkit-tap-highlight-color:transparent;
}
.tho-sky-bg{
  position:absolute; inset:0;
  background:
    radial-gradient(78% 52% at 50% 8%, rgb(var(--glow)/.16), transparent 66%),
    radial-gradient(58% 44% at 12% 96%, rgb(var(--ember)/.07), transparent 70%),
    linear-gradient(180deg,var(--night-2),var(--night) 62%);
}
.tho-grain{
  position:absolute; inset:0; opacity:.5; mix-blend-mode:overlay; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.32'/%3E%3C/svg%3E");
}
/* dvh يتبع شريط سفاري المتحرّك في آيفون؛ وسطر vh يبقى للمتصفحات الأقدم. */
.tho-bar{ position:absolute; left:0; right:0; height:clamp(26px,5vh,54px); background:#05070a; z-index:3; }
.tho-bar{ height:clamp(26px,5dvh,54px); }
.tho-bar--top{ top:0; transform-origin:top; }
.tho-bar--bottom{ bottom:0; transform-origin:bottom; }

.tho-top{
  position:relative; z-index:5; display:flex; align-items:center; gap:.75rem;
  padding:clamp(30px,5.4vh,60px) clamp(14px,4vw,30px) 0;
  padding-top:max(clamp(30px,5.4dvh,60px), env(safe-area-inset-top));
}
.tho-skip{
  flex:none; border:1px solid var(--line); background:rgba(239,236,228,.04); color:var(--soft);
  border-radius:999px; padding:.44rem .95rem; font:inherit; font-size:.72rem; cursor:pointer;
  transition:color .25s,border-color .25s,background .25s;
}
.tho-skip:hover{ color:var(--ivory); border-color:rgb(var(--glow)/.55); background:rgb(var(--glow)/.1); }
.tho-mark{ flex:none; font-family:"El Messiri",serif; font-size:.74rem; color:var(--soft); opacity:.72; }
.tho-reel{ flex:1; display:flex; gap:4px; min-width:0; }
.tho-reel-seg{
  flex:1; min-width:0; padding:9px 0; border:0; background:none; cursor:pointer;
  -webkit-appearance:none; appearance:none;
}
.tho-reel-seg::before{
  content:""; display:block; height:2px; border-radius:2px;
  background:rgba(239,236,228,.15); transition:background .25s;
}
.tho-reel-seg:hover::before{ background:rgba(239,236,228,.34); }
.tho-reel-seg > i{
  display:block; height:2px; width:100%; margin-top:-2px; border-radius:2px;
  background:rgb(var(--glow)); transform:scaleX(0); transform-origin:right;
}
.tho-reel-seg[data-state="past"] > i{ transform:scaleX(1); }
.tho-reel-seg[data-state="live"] > i{ animation:tho-fill linear forwards; }
@keyframes tho-fill{ from{transform:scaleX(0)} to{transform:scaleX(1)} }

.tho-stage{
  position:relative; z-index:4; flex:1; display:grid; grid-template-columns:minmax(0,1fr);
  align-content:center; justify-items:center;
  padding:clamp(10px,2.4vh,24px) clamp(18px,5vw,32px);
}
/* المشهد الخارج والداخل يتشاركان الخلية نفسها فيتلاشيان فوق بعضهما بلا قفزة تخطيط. */
.tho-scene,.tho-threshold{ grid-area:1/1; width:100%; max-width:600px; text-align:center; }

.tho-frame{
  position:relative; margin:0 auto clamp(16px,3.2vh,30px);
  /* min-height شبكةُ أمانٍ لمتصفّحٍ لا يعرف aspect-ratio، وإلا انهار الإطار إلى صفر. */
  width:100%; max-width:470px; min-height:170px; aspect-ratio:16/10;
  display:flex; align-items:center; justify-content:center;
  border:1px solid var(--line); border-radius:16px; overflow:hidden;
  background:linear-gradient(160deg,rgba(239,236,228,.05),rgba(239,236,228,.015));
  box-shadow:0 26px 70px -30px rgb(var(--glow)/.4), inset 0 1px 0 rgba(239,236,228,.06);
}
.tho-art{ width:100%; height:100%; display:block; }

.tho-kicker{
  font-size:.66rem; letter-spacing:.14em; color:rgb(var(--glow)); text-transform:none;
  margin:0 0 .55rem;
}
.tho-title{
  font-family:"El Messiri",serif; font-weight:700; line-height:1.32; margin:0;
  font-size:clamp(1.42rem,5.6vw,2.15rem); color:var(--ivory);
}
.tho-title--sm{ font-size:clamp(1.3rem,5vw,1.85rem); }
.tho-line{
  margin:.7rem auto 0; max-width:44ch; color:var(--soft);
  font-size:clamp(.8rem,3.3vw,.94rem); line-height:1.85;
}
.tho-open{
  margin-top:clamp(14px,2.6vh,22px); display:inline-flex; align-items:center; gap:.45rem;
  border:1px solid rgb(var(--glow)/.4); background:rgb(var(--glow)/.1); color:var(--ivory);
  border-radius:999px; padding:.6rem 1.25rem; font:inherit; font-size:.78rem; font-weight:500;
  cursor:pointer; transition:background .25s,border-color .25s,transform .25s;
}
.tho-open:hover{ background:rgb(var(--glow)/.2); border-color:rgb(var(--glow)/.7); transform:translateY(-1px); }
.tho-open span{ font-size:.9em; opacity:.8; }

.tho-hint{
  position:relative; z-index:5; display:flex; align-items:center; justify-content:center; gap:1rem;
  padding:0 clamp(14px,4vw,30px) clamp(30px,5.4vh,60px); color:var(--soft); font-size:.68rem;
  padding-bottom:max(clamp(30px,5.4dvh,60px), env(safe-area-inset-bottom));
}
.tho-nav{
  width:32px; height:32px; border-radius:999px; border:1px solid var(--line);
  background:none; color:var(--soft); font-size:.9rem; cursor:pointer; line-height:1;
  transition:color .25s,border-color .25s;
}
.tho-nav:hover:not(:disabled){ color:var(--ivory); border-color:rgb(var(--glow)/.5); }
.tho-nav:disabled{ opacity:.28; cursor:default; }

/* لوحة الأبواب */
.tho-door-groups{ display:grid; gap:12px; margin:clamp(18px,3.4vh,28px) 0 0; grid-template-columns:repeat(3,minmax(0,1fr)); }
.tho-door-group{ min-width:0; }
.tho-door-group-title{ margin:0 0 6px; padding-inline:.25rem; color:rgb(var(--glow)/.78); font-size:.63rem; font-weight:700; letter-spacing:.08em; }
.tho-doors{
  display:grid; gap:8px; margin:0;
  grid-template-columns:1fr;
}
.tho-door{
  position:relative; text-align:right; padding:.85rem .95rem; cursor:pointer;
  border:1px solid var(--line); border-radius:13px; background:rgba(239,236,228,.035);
  color:var(--ivory); font:inherit; opacity:0;
  animation:tho-rise .6s cubic-bezier(.2,.7,.2,1) forwards;
  transition:border-color .25s,background .25s,transform .25s;
}
.tho-door:hover{ border-color:rgb(var(--glow)/.6); background:rgb(var(--glow)/.11); transform:translateY(-2px); }
.tho-door-name{ display:block; font-family:"El Messiri",serif; font-weight:600; font-size:.92rem; }
.tho-door-name small{ color:var(--soft); font-family:"Tajawal",sans-serif; font-size:.62rem; font-weight:500; }
.tho-door-line{ display:block; margin-top:.15rem; font-size:.66rem; color:var(--soft); }
.tho-door-arrow{ position:absolute; top:.7rem; left:.75rem; font-size:.75rem; color:rgb(var(--glow)); opacity:0; transition:opacity .25s; }
.tho-door:hover .tho-door-arrow{ opacity:1; }
@keyframes tho-rise{ from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

.tho-tally{ margin:clamp(14px,2.6vh,22px) 0 0; font-size:.7rem; color:var(--soft); letter-spacing:.02em; }
.tho-enter{
  margin-top:clamp(12px,2.4vh,20px); border:none; border-radius:999px; cursor:pointer;
  background:rgb(var(--glow)); color:#0b0d12; font:inherit; font-weight:700; font-size:.84rem;
  padding:.72rem 2rem; transition:transform .25s,box-shadow .25s;
  box-shadow:0 12px 34px -14px rgb(var(--glow)/.9);
}
.tho-enter:hover{ transform:translateY(-1px); box-shadow:0 16px 40px -14px rgb(var(--glow)); }
.tho-again{
  display:block; margin:.7rem auto 0; border:none; background:none; cursor:pointer;
  color:var(--soft); font:inherit; font-size:.7rem; text-decoration:underline; text-underline-offset:4px;
}
.tho-again:hover{ color:var(--ivory); }

.tho-root :focus-visible{ outline:2px solid rgb(var(--glow)); outline-offset:3px; border-radius:6px; }

/* ── المشاهد المصغّرة ── */
.tho-frame :is(circle,line,path,polyline,rect,text){ animation-play-state:paused; }
.tho-frame.is-live :is(circle,line,path,polyline,rect,text),
.tho-frame.is-live :is(.tho-chip,.tho-ln,.tho-cite,.tho-typed i,.tho-caret,.tho-wave i,.tho-voice,.tho-bubble){
  animation-play-state:running;
}

/* الإشعال — التحجيم بـtransform لا بخاصية r، لأن تحريك r غير مضمون في كل المتصفحات. */
.tho-ig-ember,.tho-ig-ring{ transform-box:fill-box; transform-origin:center; }
.tho-ig-ember{ fill:rgb(var(--ember)); opacity:0; animation:tho-ember 2.6s ease-out forwards; }
@keyframes tho-ember{ 0%{opacity:0;transform:scale(0)} 20%{opacity:1;transform:scale(1.15);fill:rgb(var(--ember))} 100%{opacity:.95;transform:scale(.8);fill:rgb(var(--glow))} }
.tho-ig-ring{ fill:none; stroke:rgb(var(--glow)/.55); stroke-width:1.4; opacity:0; animation:tho-ring 2.6s cubic-bezier(.2,.7,.2,1) forwards; }
.tho-ig-ring.tho-d2{ animation-delay:.6s; }
@keyframes tho-ring{ 0%{opacity:.85;transform:scale(.4)} 100%{opacity:0;transform:scale(15)} }
.tho-ig-horizon{ stroke:rgba(239,236,228,.22); stroke-width:1; stroke-dasharray:400; stroke-dashoffset:400; animation:tho-draw 1.7s .35s cubic-bezier(.2,.7,.2,1) forwards; }
.tho-ig-star{ fill:var(--ivory); opacity:0; animation:tho-twinkle 1.4s ease-out forwards; }
.tho-ig-star.tho-d1{animation-delay:1.1s}.tho-ig-star.tho-d2{animation-delay:1.3s}.tho-ig-star.tho-d3{animation-delay:1.5s}
.tho-ig-star.tho-d4{animation-delay:1.7s}.tho-ig-star.tho-d5{animation-delay:1.9s}
@keyframes tho-twinkle{ to{opacity:.85} }
@keyframes tho-draw{ to{stroke-dashoffset:0} }

/* سماء المقالات */
.tho-sky-stars circle{
  fill:var(--ivory); opacity:0; transform-box:fill-box; transform-origin:center;
  animation:tho-pop .7s cubic-bezier(.2,.7,.2,1) forwards;
}
@keyframes tho-pop{ 0%{opacity:0;transform:scale(.2)} 100%{opacity:.9;transform:scale(1)} }
.tho-sky-links line{ stroke:rgb(var(--glow)/.55); stroke-width:.9; stroke-dasharray:220; stroke-dashoffset:220; animation:tho-draw 1.15s cubic-bezier(.2,.7,.2,1) forwards; }

/* الواجهات المصغّرة */
.tho-mock{ display:flex; flex-direction:column; justify-content:center; gap:.6rem; padding:clamp(12px,3.4vw,20px); }
.tho-mock--center{ align-items:center; }
.tho-field{
  display:flex; align-items:center; gap:.5rem; padding:.6rem .8rem; border-radius:11px;
  border:1px solid var(--line); background:rgba(239,236,228,.05);
}
.tho-field-glyph{ color:rgb(var(--glow)); display:flex; }
.tho-typed{ flex:1; min-width:0; text-align:right; font-size:clamp(.66rem,2.7vw,.78rem); color:var(--ivory); }
.tho-typed i{
  display:inline-block; font-style:normal;
  -webkit-clip-path:inset(0 0 0 100%); clip-path:inset(0 0 0 100%);
  animation:tho-type 1.5s .3s steps(26) forwards;
}
@keyframes tho-type{ to{ -webkit-clip-path:inset(0 0 0 0); clip-path:inset(0 0 0 0) } }
.tho-caret{ width:1.5px; height:1.05em; background:rgb(var(--glow)); animation:tho-blink .9s steps(2,start) infinite; }
@keyframes tho-blink{ 50%{opacity:0} }
.tho-chips{ display:flex; flex-direction:column; gap:5px; }
.tho-chip{
  display:flex; align-items:baseline; gap:.5rem; padding:.42rem .65rem; border-radius:9px;
  background:rgba(239,236,228,.045); border:1px solid var(--line);
  opacity:0; animation:tho-slide .55s cubic-bezier(.2,.7,.2,1) forwards;
}
.tho-chip b{ flex:none; font-size:.58rem; font-weight:700; color:rgb(var(--glow)); }
.tho-chip em{ font-style:normal; font-size:clamp(.6rem,2.5vw,.7rem); color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@keyframes tho-slide{ from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }

.tho-bubble{ border-radius:12px; padding:.6rem .8rem; font-size:clamp(.62rem,2.6vw,.74rem); line-height:1.7; }
.tho-bubble--ask{ align-self:flex-start; max-width:82%; background:rgb(var(--glow)/.16); border:1px solid rgb(var(--glow)/.3); color:var(--ivory); opacity:0; animation:tho-slide .5s .1s cubic-bezier(.2,.7,.2,1) forwards; }
.tho-bubble--answer{ align-self:flex-end; width:88%; background:rgba(239,236,228,.045); border:1px solid var(--line); display:flex; flex-direction:column; gap:7px; }
.tho-ln{ display:block; height:6px; border-radius:4px; background:rgba(239,236,228,.3); transform:scaleX(0); transform-origin:right; animation:tho-write .55s cubic-bezier(.2,.7,.2,1) forwards; }
@keyframes tho-write{ to{transform:scaleX(1)} }
.tho-cite{
  align-self:flex-start; display:inline-flex; align-items:center; gap:.32rem; margin-top:.15rem;
  padding:.24rem .55rem; border-radius:999px; font-size:.56rem; color:rgb(var(--glow));
  background:rgb(var(--glow)/.13); border:1px solid rgb(var(--glow)/.28);
  opacity:0; animation:tho-pop-in .5s 1.7s cubic-bezier(.2,.7,.2,1) forwards;
}
@keyframes tho-pop-in{ from{opacity:0;transform:translateY(6px) scale(.9)} to{opacity:1;transform:none} }

.tho-voices{ display:flex; gap:.5rem; }
.tho-voice{
  padding:.28rem .8rem; border-radius:999px; font-size:.62rem; border:1px solid var(--line);
  color:var(--soft); animation:tho-speak 2.4s ease-in-out infinite;
}
.tho-voice--b{ animation-delay:1.2s; }
@keyframes tho-speak{ 0%,42%{background:transparent;color:var(--soft);border-color:var(--line)} 12%,32%{background:rgb(var(--glow)/.16);color:var(--ivory);border-color:rgb(var(--glow)/.42)} }
.tho-wave{ display:flex; align-items:center; justify-content:center; gap:3px; width:100%; height:44%; }
.tho-wave i{
  flex:1; max-width:5px; border-radius:3px; background:rgb(var(--glow)/.75);
  transform:scaleY(.22); transform-origin:center;
  animation:tho-pulse 1.05s ease-in-out infinite alternate;
}
@keyframes tho-pulse{ to{transform:scaleY(1)} }

/* وثيقة العقد */
.tho-dec-base{ stroke:rgba(239,236,228,.18); stroke-width:1; }
.tho-dec-tick line{ stroke:rgba(239,236,228,.3); stroke-width:1; }
.tho-dec-tick{ opacity:0; animation:tho-fade .5s ease-out forwards; }
.tho-dec-tick circle{ fill:rgb(var(--glow)); }
@keyframes tho-fade{ to{opacity:1} }
.tho-dec-line{ fill:none; stroke:rgb(var(--glow)); stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:520; stroke-dashoffset:520; animation:tho-draw 2.1s .3s cubic-bezier(.2,.7,.2,1) forwards; }

/* مسار الفكرة */
.tho-path-lines path{ fill:none; stroke:rgb(var(--glow)/.55); stroke-width:1.1; stroke-dasharray:200; stroke-dashoffset:200; animation:tho-draw 1s cubic-bezier(.2,.7,.2,1) forwards; }
.tho-path-node rect{ fill:rgba(239,236,228,.05); stroke:var(--line); stroke-width:1; }
.tho-path-node text{ fill:var(--ivory); font-family:"El Messiri",serif; font-size:15px; text-anchor:middle; }
.tho-path-node--root rect{ fill:rgb(var(--glow)/.16); stroke:rgb(var(--glow)/.45); }
.tho-path-leaves .tho-path-node{ opacity:0; animation:tho-fade .5s ease-out forwards; }

@media (max-width:420px){
  .tho-frame{ max-width:100%; aspect-ratio:4/3; }
  .tho-mark{ display:none; }
  .tho-door-groups{ grid-template-columns:1fr; gap:9px; }
  .tho-door-group{ display:grid; grid-template-columns:3.2rem minmax(0,1fr); gap:7px; align-items:start; }
  .tho-door-group-title{ margin-top:.72rem; }
  .tho-doors{ grid-template-columns:1fr 1fr; }
}
@media (prefers-reduced-motion:reduce){
  .tho-root *{ animation:none !important; transition:none !important; }
  .tho-door{ opacity:1; }
}
`
