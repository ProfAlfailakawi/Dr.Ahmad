import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { EASE } from './motion'

const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])
const clock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${ar(minutes)}:${ar(rest).padStart(2, '0')}`
}

const SPEEDS = [1, 1.25, 1.5] as const

export type AudioSource = {
  key: string
  label: string
  src: string
}

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error'

export function AudioPlayer({ sources, title }: { sources: AudioSource[]; title: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [selectedKey, setSelectedKey] = useState(sources[0]?.key ?? '')
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [error, setError] = useState('')

  const source = useMemo(
    () => sources.find((item) => item.key === selectedKey) ?? sources[0],
    [selectedKey, sources],
  )

  useEffect(() => {
    if (!source && selectedKey) setSelectedKey('')
    else if (source && source.key !== selectedKey) setSelectedKey(source.key)
  }, [selectedKey, source])

  useEffect(() => {
    const el = audio.current
    if (!el || !source) return

    el.pause()
    el.playbackRate = speed
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
    setError('')
    setStatus('loading')
    el.load()
  }, [source?.src]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = audio.current
    if (!el) return

    const onTime = () => setCurrent(el.currentTime)
    const onMeta = () => {
      setDuration(Number.isFinite(el.duration) ? el.duration : 0)
      setStatus('ready')
      setError('')
    }
    const onCanPlay = () => {
      setStatus('ready')
      setError('')
    }
    const onLoad = () => setStatus('loading')
    const onWaiting = () => { if (!el.paused) setStatus('loading') }
    const onPlaying = () => { setPlaying(true); setStatus('ready') }
    const onPause = () => setPlaying(false)
    const onEnd = () => { setPlaying(false); setCurrent(el.duration || 0) }
    const onError = () => {
      setPlaying(false)
      setStatus('error')
      const code = el.error?.code
      setError(code === 3
        ? 'ملف الصوت تالف أو غير مدعوم.'
        : 'تعذّر تحميل الصوت. تحقّق من الاتصال ثم أعد المحاولة.')
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('canplay', onCanPlay)
    el.addEventListener('loadstart', onLoad)
    el.addEventListener('waiting', onWaiting)
    el.addEventListener('playing', onPlaying)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnd)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('loadstart', onLoad)
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('playing', onPlaying)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('error', onError)
    }
  }, [])

  const retry = () => {
    const el = audio.current
    if (!el) return
    setError('')
    setStatus('loading')
    el.load()
  }

  const toggle = async () => {
    const el = audio.current
    if (!el || !source) return
    if (status === 'error') {
      retry()
      return
    }
    if (!el.paused) {
      el.pause()
      return
    }
    try {
      if (el.ended) {
        el.currentTime = 0
        setCurrent(0)
      }
      setStatus('loading')
      await el.play()
    } catch {
      setPlaying(false)
      setStatus('error')
      setError('منع المتصفّح التشغيل. حاول مرةً أخرى.')
    }
  }

  const seekTo = (seconds: number) => {
    const el = audio.current
    if (!el || !duration) return
    const next = Math.min(Math.max(seconds, 0), duration)
    el.currentTime = next
    setCurrent(next)
  }

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    // RTL: البداية من اليمين.
    const ratio = (rect.right - event.clientX) / rect.width
    seekTo(ratio * duration)
  }

  const seekWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = current + 5
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = current - 5
    if (event.key === 'PageUp') next = current + 30
    if (event.key === 'PageDown') next = current - 30
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = duration
    if (next === null) return
    event.preventDefault()
    seekTo(next)
  }

  const jump = (seconds: number) => seekTo(current + seconds)

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audio.current) audio.current.playbackRate = next
  }

  if (!source) return null

  const percent = duration ? Math.min((current / duration) * 100, 100) : 0
  const isLoading = status === 'loading'

  return (
    <div className="mt-9 rounded-2xl border border-hair bg-wash p-5 md:p-6" aria-busy={isLoading}>
      <audio ref={audio} src={source.src} preload="metadata" />

      {sources.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-hair pb-4" role="group" aria-label="اختر صوت القراءة">
          <span className="me-1 text-[.8rem] text-soft">الصوت</span>
          {sources.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedKey(item.key)}
              aria-pressed={source.key === item.key}
              className={`rounded-full border px-3.5 py-1 text-[.8rem] transition-colors ${
                source.key === item.key ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <motion.button
          type="button"
          onClick={toggle}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.2, ease: EASE }}
          aria-label={status === 'error' ? 'إعادة محاولة تحميل الصوت' : playing ? 'إيقاف مؤقت' : 'استمع للمقال'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-canvas transition-colors hover:bg-accent-deep disabled:opacity-60"
        >
          <span className={`text-[.9rem] leading-none ${isLoading ? 'animate-pulse' : ''}`} aria-hidden>
            {status === 'error' ? '↻' : isLoading ? '…' : playing ? '❚❚' : '▶'}
          </span>
        </motion.button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[.86rem] font-medium text-ink">
              {status === 'error' ? 'الصوت غير متاح' : isLoading ? 'جارٍ تحميل الصوت…' : playing ? `يقرأ الآن بصوت ${source.label}` : `استمع بصوت ${source.label}`}
            </span>
            <span className="shrink-0 font-mono text-[.78rem] text-soft" dir="ltr">
              {clock(current)} / {duration ? clock(duration) : '—'}
            </span>
          </div>

          <div
            onClick={seek}
            onKeyDown={seekWithKeyboard}
            role="slider"
            aria-label="موضع القراءة"
            aria-valuenow={Math.round(current)}
            aria-valuetext={`${clock(current)} من ${clock(duration)}`}
            aria-valuemin={0}
            aria-valuemax={Math.max(Math.round(duration), 0)}
            aria-disabled={!duration}
            tabIndex={duration ? 0 : -1}
            dir="rtl"
            className="group mt-2.5 h-2.5 cursor-pointer rounded-full bg-hair focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <div className="relative h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${percent}%` }}>
              <span className="absolute -left-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hair pt-4">
        <button type="button" onClick={() => jump(-15)} disabled={!duration} className="rounded-full border border-hair px-3.5 py-1.5 text-[.8rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40">
          ↺ 15ث
        </button>
        <button type="button" onClick={() => jump(15)} disabled={!duration} className="rounded-full border border-hair px-3.5 py-1.5 text-[.8rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40">
          ↻ 15ث
        </button>
        <button type="button" onClick={cycleSpeed} className="rounded-full border border-hair px-3.5 py-1.5 text-[.8rem] text-soft transition-colors hover:border-accent hover:text-accent">
          السرعة {ar(speed)}×
        </button>
        <a
          href={source.src}
          download
          className="ms-auto text-[.8rem] text-soft transition-colors hover:text-accent"
          aria-label={`تحميل صوت ${title} بصوت ${source.label}`}
        >
          تحميل MP3
        </a>
      </div>

      <div className="mt-3 min-h-5 text-[.8rem]" aria-live="polite">
        {error && (
          <p className="text-soft">
            {error}{' '}
            <button type="button" onClick={retry} className="font-semibold text-accent underline underline-offset-4">أعد المحاولة</button>
          </p>
        )}
      </div>
    </div>
  )
}
