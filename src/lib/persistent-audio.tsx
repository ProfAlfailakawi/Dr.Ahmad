import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { trackListen } from './views'
import { storeLastAudio } from './reading-space'

const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])
const clock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${ar(minutes)}:${ar(rest).padStart(2, '0')}`
}

export const AUDIO_SPEEDS = [1, 1.25, 1.5] as const

export type PersistentTrack = {
  id: string
  src: string
  title: string
  label: string
  path: string
}

type Status = 'idle' | 'loading' | 'ready' | 'error'
type AudioState = {
  track: PersistentTrack | null
  playing: boolean
  current: number
  duration: number
  speed: (typeof AUDIO_SPEEDS)[number]
  status: Status
  error: string
}

type AudioApi = AudioState & {
  playTrack: (track: PersistentTrack) => Promise<void>
  toggle: () => Promise<void>
  pause: () => void
  close: () => void
  seekTo: (seconds: number) => void
  jump: (seconds: number) => void
  cycleSpeed: () => void
  isActive: (src?: string) => boolean
}

const AudioContext = createContext<AudioApi | null>(null)

export function PersistentAudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const milestones = useRef<Set<number>>(new Set())
  const [state, setState] = useState<AudioState>({
    track: null,
    playing: false,
    current: 0,
    duration: 0,
    speed: 1,
    status: 'idle',
    error: '',
  })

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const savePosition = () => {
      if (!state.track || !Number.isFinite(el.currentTime)) return
      try { localStorage.setItem(`audio:pos:${state.track.id}`, String(el.currentTime)) } catch { /* noop */ }
      storeLastAudio(state.track, el.currentTime, Number.isFinite(el.duration) ? el.duration : state.duration)
    }
    const onTime = () => {
      setState((prev) => ({ ...prev, current: el.currentTime || 0 }))
      if (state.track && el.duration && Number.isFinite(el.duration)) {
        const ratio = el.currentTime / el.duration
        for (const m of [25, 50, 75]) {
          if (ratio >= m / 100 && !milestones.current.has(m)) {
            milestones.current.add(m)
            trackListen(state.track.path, state.track.title, m, state.track.label)
          }
        }
      }
    }
    const onMeta = () => {
      setState((prev) => ({ ...prev, duration: Number.isFinite(el.duration) ? el.duration : 0, status: 'ready', error: '' }))
      if (state.track) {
        try {
          const saved = Number(localStorage.getItem(`audio:pos:${state.track.id}`) || 0)
          if (saved > 5 && saved < (el.duration || 0) - 5) el.currentTime = saved
        } catch { /* noop */ }
      }
    }
    const onCanPlay = () => setState((prev) => ({ ...prev, status: 'ready', error: '' }))
    const onLoad = () => setState((prev) => ({ ...prev, status: 'loading', error: '' }))
    const onWaiting = () => { if (!el.paused) setState((prev) => ({ ...prev, status: 'loading' })) }
    const onPlaying = () => {
      if (state.track) storeLastAudio(state.track, el.currentTime || 0, Number.isFinite(el.duration) ? el.duration : 0)
      setState((prev) => ({ ...prev, playing: true, status: 'ready', error: '' }))
    }
    const onPause = () => { savePosition(); setState((prev) => ({ ...prev, playing: false })) }
    const onEnd = () => {
      savePosition()
      setState((prev) => ({ ...prev, playing: false, current: el.duration || prev.current }))
    }
    const onError = () => {
      setState((prev) => ({
        ...prev,
        playing: false,
        status: 'error',
        error: el.error?.code === 3 ? 'ملف الصوت تالف أو غير مدعوم.' : 'تعذّر تحميل الصوت. تحقق من الاتصال ثم أعد المحاولة.',
      }))
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
    window.addEventListener('beforeunload', savePosition)
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
      window.removeEventListener('beforeunload', savePosition)
    }
  }, [state.track])

  const api = useMemo<AudioApi>(() => {
    const playTrack = async (track: PersistentTrack) => {
      const el = audioRef.current
      if (!el) return
      const same = state.track?.src === track.src
      milestones.current = same ? milestones.current : new Set()
      if (!same) {
        setState((prev) => ({ ...prev, track, current: 0, duration: 0, status: 'loading', error: '' }))
        el.src = track.src
        el.playbackRate = state.speed
        el.load()
      } else {
        setState((prev) => ({ ...prev, track }))
      }
      try {
        await el.play()
      } catch {
        setState((prev) => ({ ...prev, playing: false, status: 'error', error: 'منع المتصفح التشغيل. حاول مرة أخرى.' }))
      }
    }
    const toggle = async () => {
      const el = audioRef.current
      if (!el || !state.track) return
      if (!el.paused) { el.pause(); return }
      try { await el.play() } catch {
        setState((prev) => ({ ...prev, playing: false, status: 'error', error: 'منع المتصفح التشغيل. حاول مرة أخرى.' }))
      }
    }
    const pause = () => audioRef.current?.pause()
    const close = () => {
      const el = audioRef.current
      if (el) {
        el.pause()
        el.removeAttribute('src')
        el.load()
      }
      setState((prev) => ({ ...prev, track: null, playing: false, current: 0, duration: 0, status: 'idle', error: '' }))
    }
    const seekTo = (seconds: number) => {
      const el = audioRef.current
      if (!el || !state.duration) return
      el.currentTime = Math.min(Math.max(seconds, 0), state.duration)
      setState((prev) => ({ ...prev, current: el.currentTime }))
    }
    const jump = (seconds: number) => seekTo(state.current + seconds)
    const cycleSpeed = () => {
      const next = AUDIO_SPEEDS[(AUDIO_SPEEDS.indexOf(state.speed) + 1) % AUDIO_SPEEDS.length]
      if (audioRef.current) audioRef.current.playbackRate = next
      setState((prev) => ({ ...prev, speed: next }))
    }
    return { ...state, playTrack, toggle, pause, close, seekTo, jump, cycleSpeed, isActive: (src?: string) => Boolean(src && state.track?.src === src) }
  }, [state])

  return (
    <AudioContext.Provider value={api}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </AudioContext.Provider>
  )
}

export function usePersistentAudio() {
  const value = useContext(AudioContext)
  if (!value) throw new Error('usePersistentAudio must be used inside PersistentAudioProvider')
  return value
}

export function PersistentAudioDock() {
  const audio = usePersistentAudio()
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  useEffect(() => {
    document.body.classList.toggle('audio-dock-open', Boolean(audio.track))
    document.body.classList.toggle('audio-dock-admin', Boolean(audio.track && isAdmin))
    return () => {
      document.body.classList.remove('audio-dock-open')
      document.body.classList.remove('audio-dock-admin')
    }
  }, [audio.track, isAdmin])

  if (!audio.track) return null
  const percent = audio.duration ? Math.min((audio.current / audio.duration) * 100, 100) : 0

  if (isAdmin) {
    return (
      <div className="persistent-audio-dock fixed inset-x-3 bottom-[calc(5.7rem+env(safe-area-inset-bottom))] z-[275] mx-auto max-w-[520px] rounded-2xl border border-hair bg-canvas/97 p-2.5 shadow-[0_22px_65px_-34px_rgba(21,22,26,.6)] backdrop-blur md:bottom-5 md:left-5 md:right-auto md:mx-0 md:w-[min(420px,calc(100vw-2.5rem))]">
        <div className="flex items-center gap-2.5">
          <button onClick={() => void audio.toggle()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white" aria-label={audio.playing ? 'إيقاف مؤقت' : 'تشغيل'}>
            {audio.playing ? '❚❚' : '▶'}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[.78rem] font-semibold text-ink">{audio.track.title}</p>
              <span className="shrink-0 text-[.68rem] text-soft">{clock(audio.current)} / {clock(audio.duration)}</span>
            </div>
            <button
              type="button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                audio.seekTo(((rect.right - event.clientX) / rect.width) * audio.duration)
              }}
              className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-wash"
              aria-label="شريط تقدم الصوت"
            >
              <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </button>
          </div>
          <button onClick={audio.cycleSpeed} className="hidden rounded-full border border-hair px-2 py-1 text-[.68rem] text-soft sm:inline-flex">{audio.speed}x</button>
          <button onClick={audio.close} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair text-soft" aria-label="إغلاق المشغل">×</button>
        </div>
      </div>
    )
  }

  return (
    <div className="reader-hide-focus fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-[230] mx-auto max-w-3xl rounded-2xl border border-hair bg-canvas/95 p-3 shadow-[0_24px_70px_-34px_rgba(21,22,26,.55)] backdrop-blur md:bottom-5">
      <div className="flex items-center gap-3">
        <button onClick={() => void audio.toggle()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white" aria-label={audio.playing ? 'إيقاف مؤقت' : 'تشغيل'}>
          {audio.playing ? '❚❚' : '▶'}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[.82rem] font-semibold text-ink">{audio.track.title}</p>
            <span className="shrink-0 text-[.72rem] text-soft">{audio.track.label}</span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              audio.seekTo(((rect.right - event.clientX) / rect.width) * audio.duration)
            }}
            className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-wash"
            aria-label="شريط تقدم الصوت"
          >
            <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
          </button>
          {audio.error ? <p className="mt-1 text-[.72rem] text-soft">{audio.error}</p> : (
            <p className="mt-1 text-[.72rem] text-soft">{clock(audio.current)} / {clock(audio.duration)}</p>
          )}
        </div>
        <button onClick={() => audio.jump(-15)} className="hidden rounded-full border border-hair px-2.5 py-1 text-[.75rem] text-soft sm:inline-flex">١٥-</button>
        <button onClick={() => audio.jump(15)} className="hidden rounded-full border border-hair px-2.5 py-1 text-[.75rem] text-soft sm:inline-flex">١٥+</button>
        <button onClick={audio.cycleSpeed} className="rounded-full border border-hair px-2.5 py-1 text-[.75rem] text-soft">{ar(audio.speed)}x</button>
        <button onClick={audio.close} className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-soft" aria-label="إغلاق المشغل">×</button>
      </div>
    </div>
  )
}
