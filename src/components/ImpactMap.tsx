import { useEffect, useMemo, useRef, useState } from 'react'
import { useCmsContent } from '../lib/content'
import audioMeta from '../data/audio-meta.json'

/*
 * خريطة الأثر: حصيلةُ الجسد المعرفي في أرقامٍ هادئة — مقالات، أبحاث، كتب،
 * حلقات مسموعة وساعاتها، سنوات، أبواب. تُعدّ الأرقامَ حيّاً من محتوى اللوحة،
 * وتُحرّكها صعوداً عند ظهورها. لا تلوّث: خطٌّ واحدٌ من البطاقات بهوية الموقع.
 */
const arNum = new Intl.NumberFormat('ar-KW-u-nu-arab')

/* الحركة كانت تبدأ لحظة تركيب المكوّن — والشريط أسفل الطيّة، فتنتهي الأرقام
   صعودها في ثانية واحدة قبل أن يصل إليها الزائر أصلاً، فلا يرى إلا أرقاماً
   ساكنة. (وتعليق الملف كان يَعِد بـ«تُحرّكها عند ظهورها» ولم يكن ذلك منفَّذاً.)
   الآن تنتظر حتى يقع الشريط في المرأى فعلاً ثم تصعد أمام عينيه — وهذا هو
   المقصود: أن يشهد الحركة لا أن تسبقه. ومن أوقف الحركة في نظامه (تفضيل
   `prefers-reduced-motion`) يرى الأرقام كاملةً فوراً، فلا نفرض عليه حركة. */
function useCountUp(target: number, active: boolean, ms = 1150) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    if (target <= 0) { setValue(0); return }
    const still = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (still) { setValue(target); return }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // ضمانُ الوصول للهدف ولو خُنق rAF (تبويبٌ في الخلفية أو نافذةٌ مخفيّة)
    const settle = window.setTimeout(() => setValue(target), ms + 150)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(settle) }
  }, [target, ms, active])
  return value
}

/* المراقب يُطلق الحركة مرّةً واحدة عند أول ظهور ثم ينفصل — فلا تتكرّر كلّما
   مرّ الزائر. ومن غاب عنه IntersectionObserver (متصفّح قديم) تبدأ عنده فوراً
   كما كانت، فلا يخسر شيئاً. */
function useSeen<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true)
        observer.disconnect()
      }
    }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [seen])
  return { ref, seen }
}

function Stat({ value, label, active }: { value: number; label: string; active: boolean }) {
  const shown = useCountUp(value, active)
  return (
    <div className="impact-map-stat">
      <strong className="impact-map-value font-display">{arNum.format(shown)}</strong>
      <span className="impact-map-label">{label}</span>
    </div>
  )
}

export default function ImpactMap() {
  const { articles, papers, books } = useCmsContent()
  const { ref, seen } = useSeen<HTMLElement>()

  const stats = useMemo(() => {
    const years = articles.map((article) => Number(String(article.iso).slice(0, 4))).filter((year) => year > 1990)
    const span = years.length ? Math.max(...years) - Math.min(...years) + 1 : 0
    const categories = new Set(articles.map((article) => article.cat).filter(Boolean)).size
    const audioEntries = Object.values(audioMeta as Record<string, { durationSeconds?: number }>)
      .filter((meta) => meta && typeof meta.durationSeconds === 'number' && meta.durationSeconds > 0)
    const audioCount = audioEntries.length
    const audioHours = Math.round(audioEntries.reduce((sum, meta) => sum + (meta.durationSeconds || 0), 0) / 3600)
    return { articles: articles.length, papers: papers.length, books: books.length, audioCount, audioHours, span, categories }
  }, [articles, papers, books])

  const items = [
    { value: stats.articles, label: 'مقالة فكرية' },
    { value: stats.papers, label: 'بحثاً محكّماً' },
    { value: stats.books, label: 'كتاباً منشوراً' },
    { value: stats.audioCount, label: 'حلقة مسموعة' },
    { value: stats.audioHours, label: 'ساعة استماع' },
    { value: stats.span, label: 'سنة من الأثر' },
    { value: stats.categories, label: 'باباً معرفياً' },
  ].filter((item) => item.value > 0)

  if (items.length < 3) return null

  return (
    <section ref={ref} className="impact-map-section px-6 py-10 md:px-11 md:py-12" aria-label="خريطة الأثر — الحصيلة بالأرقام">
      <div className="mx-auto max-w-shell">
        <p className="impact-map-eyebrow">الحصيلة في أرقام</p>
        <div className="impact-map-grid mt-5">
          {items.map((item) => <Stat key={item.label} value={item.value} label={item.label} active={seen} />)}
        </div>
      </div>
    </section>
  )
}
