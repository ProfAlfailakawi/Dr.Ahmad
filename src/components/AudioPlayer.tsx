import { useEffect, useMemo, useState } from 'react'
import { AUDIO_SPEEDS, usePersistentAudio } from '../lib/persistent-audio'

const ar = (n: number) => String(n).replace(/[0-9]/g, (digit) => '0123456789'[+digit])
const clock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${ar(minutes)}:${ar(rest).padStart(2, '0')}`
}

export type AudioSource = {
  key: string
  label: string
  src: string
  avatar?: 'boy' | 'woman' | 'dialogue'
}

function AudioWave({ dialogue = false, size = 22 }: { dialogue?: boolean; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
      {dialogue ? (
        <>
          <path d="M3.5 7.5h10a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H9l-3.8 2.8.8-2.8H6.5a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M15.8 10.1h1.7a3 3 0 0 1 3 3v1.4a3 3 0 0 1-3 3h-.2l.6 2.2-3.1-2.2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M4 12h2.2M8.4 8.5v7M12 5.5v13M15.6 8.5v7M19.8 11v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".2" />
        </>
      )}
    </svg>
  )
}

export function AudioPlayer({ sources, title }: { sources: AudioSource[]; title: string }) {
  const player = usePersistentAudio()
  const [selectedKey, setSelectedKey] = useState(sources[0]?.key ?? '')
  const [expanded, setExpanded] = useState(false)
  const source = useMemo(() => sources.find((item) => item.key === selectedKey) ?? sources[0], [selectedKey, sources])
  const anyActive = sources.some((item) => player.isActive(item.src))

  useEffect(() => {
    if (!sources.some((item) => item.key === selectedKey)) setSelectedKey(sources[0]?.key ?? '')
  }, [selectedKey, sources])

  useEffect(() => {
    if (anyActive) setExpanded(true)
  }, [anyActive])

  if (!source) return null

  const active = player.isActive(source.src)
  const current = active ? player.current : 0
  const duration = active ? player.duration : 0
  const percent = duration ? Math.min((current / duration) * 100, 100) : 0
  const isDialogue = source.key === 'dialogue'

  const play = () => player.playTrack({
    id: source.src,
    src: source.src,
    title,
    label: source.label,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
  })

  const choose = (key: string) => {
    setSelectedKey(key)
    const next = sources.find((item) => item.key === key)
    if (next && anyActive) {
      void player.playTrack({
        id: next.src,
        src: next.src,
        title,
        label: next.label,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      })
    }
  }

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-3 rounded-2xl border border-hair bg-canvas px-4 py-3 text-start transition-colors hover:border-accent/45"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/8 text-accent"><AudioWave dialogue={isDialogue} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[.82rem] font-semibold text-ink">استمع إلى المقال</span>
          <span className="mt-0.5 block truncate text-[.7rem] text-soft">{anyActive ? player.track?.label : sources.length > 1 ? `${sources.length.toLocaleString('ar-KW')} تجارب صوتية` : source.label}</span>
        </span>
        <span className={`text-[.82rem] text-soft transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {expanded && (
        <section className="mt-3 rounded-2xl border border-hair bg-wash/55 p-4 md:p-5" aria-label="مشغل المقال الصوتي">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => active && player.playing ? void player.toggle() : void play()}
              aria-label={active && player.playing ? 'إيقاف مؤقت' : 'تشغيل'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-deep"
            >
              {active && player.playing ? (
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>
              ) : (
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="-translate-x-px"><path d="M8 5.7v12.6c0 .9 1 1.5 1.8 1l9.2-6.3a1.2 1.2 0 0 0 0-2L9.8 4.7A1.2 1.2 0 0 0 8 5.7Z"/></svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[.78rem] font-semibold text-ink">{source.label}</p>
              <p className="mt-0.5 text-[.68rem] text-soft">{active ? `${clock(current)} / ${clock(duration)}` : 'يحفظ موضع الاستماع على هذا الجهاز'}</p>
            </div>
            <button type="button" onClick={player.cycleSpeed} disabled={!active} className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft disabled:opacity-40">{AUDIO_SPEEDS.includes(player.speed) ? player.speed : 1}x</button>
          </div>

          <button
            type="button"
            onClick={(event) => {
              if (!active || !duration) return
              const rect = event.currentTarget.getBoundingClientRect()
              player.seekTo(((event.clientX - rect.left) / rect.width) * duration)
            }}
            className="mt-4 block h-1.5 w-full overflow-hidden rounded-full bg-canvas"
            aria-label="شريط تقدم الصوت"
          >
            <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {sources.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => choose(item.key)}
                aria-pressed={source.key === item.key}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[.72rem] font-semibold transition-colors ${source.key === item.key ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
              >
                <AudioWave dialogue={item.key === 'dialogue'} size={16} />
                {item.label.replace(/^قراءة\s+/, '')}
              </button>
            ))}
            <span className="ms-auto flex items-center gap-1.5">
              <button type="button" onClick={() => player.jump(-15)} disabled={!active} className="rounded-full border border-hair px-2.5 py-1.5 text-[.68rem] text-soft disabled:opacity-35">15−</button>
              <button type="button" onClick={() => player.jump(15)} disabled={!active} className="rounded-full border border-hair px-2.5 py-1.5 text-[.68rem] text-soft disabled:opacity-35">15+</button>
            </span>
          </div>

          {active && player.error && <p className="mt-3 text-[.7rem] leading-relaxed text-soft">{player.error}</p>}
        </section>
      )}
    </div>
  )
}
