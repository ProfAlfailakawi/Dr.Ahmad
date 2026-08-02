import { useEffect, useMemo, useRef, useState } from 'react'
import { useCmsContent } from '../lib/content'
import audioMeta from '../data/audio-meta.json'
import {
  arabicCountLabel,
  ARTICLE_FORMS,
  AUDIO_EPISODE_FORMS,
  AUDIO_HOUR_FORMS,
  BOOK_FORMS,
  CATEGORY_FORMS,
  PAPER_FORMS,
  YEAR_IMPACT_FORMS,
} from '../lib/arabic-count.ts'

const arNum = new Intl.NumberFormat('ar-KW-u-nu-latn')

function useCountUp(target: number, active: boolean, ms = 850) {
  const [value, setValue] = useState(active ? 0 : target)
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
    const settle = window.setTimeout(() => setValue(target), ms + 150)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(settle) }
  }, [target, ms, active])
  return value
}

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

type AudioMetaRow = { durationSeconds?: number }

type AudioEpisodeSummary = {
  count: number
  hours: number
}

function summarizeAudio(meta: Record<string, AudioMetaRow>): AudioEpisodeSummary {
  const grouped = new Map<string, { standard?: number; dialogue?: number }>()

  for (const [file, row] of Object.entries(meta)) {
    if (!file.endsWith('.mp3')) continue
    const seconds = typeof row?.durationSeconds === 'number' ? row.durationSeconds : 0
    if (seconds <= 0) continue

    const isDialogue = file.endsWith('.dialogue.mp3')
    const base = file
      .replace(/\.dialogue\.mp3$/u, '')
      .replace(/\.noura\.mp3$/u, '')
      .replace(/\.mp3$/u, '')

    const bucket = grouped.get(base) || {}
    if (isDialogue) bucket.dialogue = seconds
    else bucket.standard = Math.max(bucket.standard || 0, seconds)
    grouped.set(base, bucket)
  }

  let count = 0
  let totalSeconds = 0
  for (const bucket of grouped.values()) {
    if (bucket.standard) { count += 1; totalSeconds += bucket.standard }
    if (bucket.dialogue) { count += 1; totalSeconds += bucket.dialogue }
  }

  return { count, hours: Math.round(totalSeconds / 3600) }
}

export default function ImpactMap() {
  const { articles, papers, books } = useCmsContent()
  const { ref, seen } = useSeen<HTMLElement>()

  const stats = useMemo(() => {
    const years = articles.map((article) => Number(String(article.iso).slice(0, 4))).filter((year) => year > 1990)
    const span = years.length ? Math.max(...years) - Math.min(...years) + 1 : 0
    const categories = new Set(articles.map((article) => article.cat).filter(Boolean)).size
    const audio = summarizeAudio(audioMeta as Record<string, AudioMetaRow>)
    return { articles: articles.length, papers: papers.length, books: books.length, audioCount: audio.count, audioHours: audio.hours, span, categories }
  }, [articles, papers, books])

  const items = [
    { value: stats.articles, label: arabicCountLabel(stats.articles, ARTICLE_FORMS) },
    { value: stats.papers, label: arabicCountLabel(stats.papers, PAPER_FORMS) },
    { value: stats.books, label: arabicCountLabel(stats.books, BOOK_FORMS) },
    { value: stats.audioCount, label: arabicCountLabel(stats.audioCount, AUDIO_EPISODE_FORMS) },
    { value: stats.audioHours, label: arabicCountLabel(stats.audioHours, AUDIO_HOUR_FORMS) },
    { value: stats.span, label: arabicCountLabel(stats.span, YEAR_IMPACT_FORMS) },
    { value: stats.categories, label: arabicCountLabel(stats.categories, CATEGORY_FORMS) },
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
