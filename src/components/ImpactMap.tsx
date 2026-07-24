import { useEffect, useMemo, useState } from 'react'
import { useCmsContent } from '../lib/content'
import audioMeta from '../data/audio-meta.json'

/*
 * خريطة الأثر: حصيلةُ الجسد المعرفي في أرقامٍ هادئة — مقالات، أبحاث، كتب،
 * حلقات مسموعة وساعاتها، سنوات، أبواب. تُعدّ الأرقامَ حيّاً من محتوى اللوحة،
 * وتُحرّكها صعوداً عند ظهورها. لا تلوّث: خطٌّ واحدٌ من البطاقات بهوية الموقع.
 */
const arNum = new Intl.NumberFormat('ar-KW-u-nu-arab')

function useCountUp(target: number, ms = 1150) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target <= 0) { setValue(0); return }
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
  }, [target, ms])
  return value
}

function Stat({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value)
  return (
    <div className="impact-map-stat">
      <strong className="impact-map-value font-display">{arNum.format(shown)}</strong>
      <span className="impact-map-label">{label}</span>
    </div>
  )
}

export default function ImpactMap() {
  const { articles, papers, books } = useCmsContent()

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
    <section className="impact-map-section px-6 py-10 md:px-11 md:py-12" aria-label="خريطة الأثر — الحصيلة بالأرقام">
      <div className="mx-auto max-w-shell">
        <p className="impact-map-eyebrow">الحصيلة في أرقام</p>
        <div className="impact-map-grid mt-5">
          {items.map((item) => <Stat key={item.label} value={item.value} label={item.label} />)}
        </div>
      </div>
    </section>
  )
}
