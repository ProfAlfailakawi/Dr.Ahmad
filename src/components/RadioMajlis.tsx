import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { loadAudioPeaks } from '../lib/audio-peaks'
import './radio-majlis.css'

/* ═══════════ المجلس المتوهّج — طبقة بصرية فوق الإذاعة، لا تمسّ البثّ ═══════════

   جمرتان: فهد ونورة. تتوهّج جمرةُ من يتكلّم الآن بموجة الصوت الحقيقية للحلقة
   (audio-peaks.json نفسه الذي يرسم موجة المشغّل)، وتخبو الأخرى إلى سكونها.
   وحولهما قرصُ أربعٍ وعشرين ساعة بساعة الكويت: نقطةٌ عند اللحظة الحيّة، ويمكن
   سحبُ القرص لمعاينة ما يُبثّ في ساعةٍ أخرى. المعاينة قراءةٌ فقط: لا تلمس
   المشغّل ولا الموضع ولا المزامنة، وعند الإفلات تعود إلى الحيّ.            */

type Item = { slug: string; title: string; cat: string; at: number; dur: number }
type Utterance = { s: number; e: number; sp: string; t: string }

type Props = {
  items: Item[]
  loop: number
  idx: number
  into: number
  /* لاحقة ملف الصوت (‎.dialogue‎ أو ‎.dialogue-kw‎) — مفتاح الموجة في audio-peaks.json */
  suffix: string
  speaker: string
  playing: boolean
  utterances: Utterance[]
  audioRef: RefObject<HTMLAudioElement | null>
  loadedSlugRef: RefObject<string>
}

const DAY = 86400
const FAHD = 'فهد'
const NOURA = 'نورة'

const kuwaitSecondsOfDay = (d: Date) =>
  (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() + 3 * 3600) % DAY

function itemAt(items: Item[], loop: number, secondOfDay: number) {
  const at = secondOfDay % loop
  let lo = 0
  let hi = items.length - 1
  let idx = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (items[mid].at <= at) { idx = mid; lo = mid + 1 } else hi = mid - 1
  }
  /* في الفاصل بين حلقتين: المعاينة تعرض الحلقة الآتية */
  if (at - items[idx].at >= items[idx].dur) idx = (idx + 1) % items.length
  return idx
}

const dayClock = (secondOfDay: number) => {
  const utcSecond = (((secondOfDay - 3 * 3600) % DAY) + DAY) % DAY
  const d = new Date(Date.UTC(2000, 0, 1, 0, 0, 0) + utcSecond * 1000)
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuwait' })
}
const arNum = (n: number) => n.toLocaleString('ar-EG')
const aheadLabel = (seconds: number) => {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return 'الآن'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `بعد ${arNum(m)} د`
  return m ? `بعد ${arNum(h)} س ${arNum(m)} د` : `بعد ${arNum(h)} س`
}

const R = 84
const C = 100
const point = (secondOfDay: number, radius = R) => {
  const a = (secondOfDay / DAY) * Math.PI * 2
  return { x: C + radius * Math.sin(a), y: C - radius * Math.cos(a) }
}
const arcPath = (from: number, to: number, radius = R) => {
  const span = ((to - from) % DAY + DAY) % DAY
  if (span < 30) return ''
  const p0 = point(from, radius)
  const p1 = point(to, radius)
  const large = span > DAY / 2 ? 1 : 0
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

export default function RadioMajlis({ items, loop, idx, into, suffix, speaker, playing, utterances, audioRef, loadedSlugRef }: Props) {
  const item = items[idx]
  const reduced = usePrefersReducedMotion()
  const fahdRef = useRef<HTMLSpanElement>(null)
  const nouraRef = useRef<HTMLSpanElement>(null)
  const dialRef = useRef<SVGSVGElement>(null)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const draggingRef = useRef(false)

  /* موجة الحلقة الحالية — قراءةٌ من الملف الموجود، بلا طلب صوتٍ إضافي */
  useEffect(() => {
    let alive = true
    setPeaks(null)
    void loadAudioPeaks(`/audio/${item.slug}${suffix}.mp3`).then((values) => { if (alive) setPeaks(values) })
    return () => { alive = false }
  }, [item.slug, suffix])

  /* موضع الموجة الآن: من الصوت نفسه إن كان يُسمع، وإلا من ساعة الكويت — كما يفعل السطر المنطوق */
  const intoRef = useRef(into)
  intoRef.current = into
  const speakerRef = useRef(speaker)
  speakerRef.current = speaker

  const range = useMemo(() => {
    if (!peaks || !peaks.length) return null
    let lo = Infinity
    let hi = -Infinity
    for (const p of peaks) { if (p < lo) lo = p; if (p > hi) hi = p }
    return { lo, hi }
  }, [peaks])

  const levelNow = useCallback(() => {
    if (!peaks || !peaks.length || !range) return null
    const audio = audioRef.current
    const live = Boolean(playing && audio && !audio.paused && loadedSlugRef.current === item.slug)
    const t = live && audio ? audio.currentTime : intoRef.current
    const dur = live && audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : item.dur
    if (t >= dur) return 0
    const f = Math.max(0, Math.min(0.9999, t / dur)) * (peaks.length - 1)
    const i = Math.floor(f)
    const v = peaks[i] + (peaks[Math.min(peaks.length - 1, i + 1)] - peaks[i]) * (f - i)
    const norm = range.hi > range.lo ? (v - range.lo) / (range.hi - range.lo) : 0.6
    /* الوقفات بين الجمل تخفت حتى لو بقيت القمّة عالية */
    let speaking = !utterances.length
    for (const u of utterances) if (t >= u.s && t < u.e - 0.25) { speaking = true; break }
    return speaking ? 0.35 + norm * 0.65 : 0.22
  }, [audioRef, item.dur, item.slug, loadedSlugRef, peaks, playing, range, utterances])

  useEffect(() => {
    const fahd = fahdRef.current
    const noura = nouraRef.current
    if (!fahd || !noura) return
    const REST = 0.12
    const apply = (lit: number) => {
      const sp = speakerRef.current
      fahd.style.setProperty('--ember', (sp === FAHD ? lit : REST).toFixed(3))
      noura.style.setProperty('--ember', (sp === NOURA ? lit : REST).toFixed(3))
    }
    if (reduced) {
      /* سكونٌ تامّ: جمرةُ المتكلّم مضاءةٌ بثبات بالصنف is-speaking وحده (CSS)، بلا نبض */
      fahd.style.removeProperty('--ember')
      noura.style.removeProperty('--ember')
      return
    }
    let raf = 0
    let smooth = 0.4
    const tick = () => {
      const target = levelNow()
      smooth += ((target ?? 0.62) - smooth) * 0.18
      apply(smooth)
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [levelNow, reduced, speaker])

  /* ── القرص ── */
  const nowSec = kuwaitSecondsOfDay(new Date())
  const shown = preview ?? nowSec

  const secondsFromPointer = (clientX: number, clientY: number) => {
    const svg = dialRef.current
    if (!svg) return nowSec
    const box = svg.getBoundingClientRect()
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)
    let a = Math.atan2(dx, -dy)
    if (a < 0) a += Math.PI * 2
    return (Math.round(((a / (Math.PI * 2)) * DAY) / 60) * 60) % DAY
  }
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    draggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setPreview(secondsFromPointer(e.clientX, e.clientY))
  }
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    setPreview(secondsFromPointer(e.clientX, e.clientY))
  }
  /* الإفلات يعيد إلى البثّ الحيّ — والمشغّل لم يُمسّ أصلاً */
  const release = () => { draggingRef.current = false; setPreview(null) }

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.key === 'PageUp' || e.key === 'PageDown' ? 3600 : 900
    const base = preview ?? nowSec
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); setPreview((base + step) % DAY) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); setPreview((base - step + DAY) % DAY) }
    else if ((e.key === 'Escape' || e.key === 'Enter' || e.key === 'Home') && preview !== null) { e.preventDefault(); setPreview(null) }
  }

  const previewRows = useMemo(() => {
    if (preview === null || !items.length || loop <= 0) return null
    const first = itemAt(items, loop, preview)
    return [0, 1, 2].map((k) => items[(first + k) % items.length])
  }, [items, loop, preview])

  /* بدايات دورة الجدول (يدور أكثر من مرة في اليوم) */
  const loopMarks = useMemo(() => {
    const marks: number[] = []
    if (loop > 0) for (let s = 0; s < DAY; s += loop) marks.push(s)
    return marks
  }, [loop])

  const hourTicks = useMemo(() => Array.from({ length: 24 }, (_, h) => {
    const major = h % 6 === 0
    const a = point(h * 3600, R + 7)
    const b = point(h * 3600, R + (major ? 13 : 10))
    return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`radio-majlis__hour${major ? ' is-major' : ''}`} />
  }), [])
  const hourLabels = useMemo(() => [0, 6, 12, 18].map((h) => {
    const p = point(h * 3600, R - 15)
    return <text key={h} x={p.x} y={p.y} className="radio-majlis__label" textAnchor="middle" dominantBaseline="central">{arNum(h)}</text>
  }), [])

  const nowPt = point(nowSec)
  const prevPt = preview === null ? null : point(preview)
  const valueText = preview === null
    ? `الآن ${dayClock(nowSec)}: ${item.title}`
    : `${dayClock(preview)} — ${previewRows?.[0]?.title ?? ''}`

  const speakerName = speaker === NOURA ? NOURA : speaker === FAHD ? FAHD : ''

  return (
    <section className={`radio-majlis${preview !== null ? ' is-previewing' : ''}`} aria-label="المجلس — من يتكلّم وما يُبثّ على مدار اليوم">
      <div className="radio-majlis__dial-wrap">
        <svg
          ref={dialRef}
          className="radio-majlis__dial"
          viewBox="0 0 200 200"
          role="slider"
          tabIndex={0}
          aria-label="قرص اليوم بساعة الكويت — اسحب لمعاينة ما يُبثّ، والإفلات يعيدك إلى البثّ الحيّ"
          aria-valuemin={0}
          aria-valuemax={DAY - 60}
          aria-valuenow={shown}
          aria-valuetext={valueText}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={() => { if (draggingRef.current) release() }}
          onKeyDown={onKeyDown}
          onBlur={() => { if (!draggingRef.current) setPreview(null) }}
        >
          <circle cx={C} cy={C} r={R} className="radio-majlis__ring" />
          <path d={arcPath(0, nowSec)} className="radio-majlis__elapsed" />
          {loopMarks.map((s) => {
            const a = point(s, R - 4)
            const b = point(s, R + 4)
            return <line key={s} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="radio-majlis__loop" />
          })}
          {hourTicks}
          {hourLabels}
          {prevPt ? <path d={arcPath(nowSec, preview as number)} className="radio-majlis__ahead" /> : null}
          <circle cx={nowPt.x} cy={nowPt.y} r={5.5} className="radio-majlis__now" />
          {prevPt ? <circle cx={prevPt.x} cy={prevPt.y} r={8} className="radio-majlis__handle" /> : null}
        </svg>

        {/* الجمرتان في قلب القرص — الترتيب من اليمين: فهد ثم نورة، بلا أسماء كبقية الإذاعة */}
        <div className="radio-majlis__hearth" aria-hidden="true">
          <span ref={fahdRef} className={`radio-ember radio-ember--fahd${speaker === FAHD ? ' is-speaking' : ''}`} />
          <span ref={nouraRef} className={`radio-ember radio-ember--noura${speaker === NOURA ? ' is-speaking' : ''}`} />
        </div>
      </div>

      <div className="radio-majlis__read" aria-live="polite">
        {previewRows ? (
          <>
            <div className="radio-majlis__when">
              <time>{dayClock(preview as number)}</time>
              <span>· {aheadLabel(((preview as number) - nowSec + DAY) % DAY)}</span>
            </div>
            <p className="radio-majlis__title">{previewRows[0].title}</p>
            <span className="radio-majlis__cat">{previewRows[0].cat}</span>
            <ol className="radio-majlis__then">
              {previewRows.slice(1).map((row, i) => <li key={`${row.slug}-${i}`}>{row.title}</li>)}
            </ol>
            <span className="radio-majlis__back">أفلِت للعودة إلى البثّ الحيّ</span>
          </>
        ) : (
          <>
            <div className="radio-majlis__when">
              <time>{dayClock(nowSec)}</time>
              <span className="sr-only">{speakerName ? ` · يتكلّم ${speakerName}` : ''}</span>
            </div>
            <span className="radio-majlis__hint">اسحب على القرص لترى ما يُبثّ في أي ساعة</span>
          </>
        )}
      </div>
    </section>
  )
}
