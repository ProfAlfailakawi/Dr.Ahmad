import { useMemo, useState } from 'react'
import { AUDIO_SPEEDS, usePersistentAudio } from '../lib/persistent-audio'

const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])
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

function VoiceAvatar({ kind, size = 28 }: { kind: AudioSource['avatar']; size?: number }) {
  if (kind === 'dialogue') return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M5.5 7.5h13a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-6l-4.8 3.4.9-3.4H8.5a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M18.5 12.5h5a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-.2l.7 2.7-4-2.7h-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (kind === 'woman') return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" fill="currentColor" opacity=".08"/>
      <path d="M10 15.2c0-5 2.5-8 6-8s6 3 6 8v6.2c-1.5-1-3.4-1.5-6-1.5s-4.5.5-6 1.5v-6.2Z" fill="currentColor" opacity=".22"/>
      <circle cx="16" cy="14.4" r="4.8" fill="currentColor" opacity=".66"/>
      <path d="M7.7 26c1.6-4 4.5-6 8.3-6s6.7 2 8.3 6" fill="currentColor" opacity=".66"/>
      <path d="M11.2 13c.7-3.2 2.4-4.8 5.2-4.8 2.4 0 4.2 1.4 4.9 4.3-1.8-.2-3.4-1-4.8-2.2-1.3 1.4-3.1 2.3-5.3 2.7Z" fill="currentColor"/>
    </svg>
  )
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" fill="currentColor" opacity=".08"/>
      <circle cx="16" cy="13.8" r="4.7" fill="currentColor" opacity=".68"/>
      <path d="M7.8 26c1.5-4.2 4.3-6.3 8.2-6.3s6.7 2.1 8.2 6.3" fill="currentColor" opacity=".68"/>
      <path d="M11 12.6c.4-3.5 2.2-5.3 5.4-5.3 2.8 0 4.5 1.7 4.8 5.1-1.2-1-2.5-1.6-4-1.8-1.7-.2-3.8.5-6.2 2Z" fill="currentColor"/>
    </svg>
  )
}

export function AudioPlayer({ sources, title }: { sources: AudioSource[]; title: string }) {
  const player = usePersistentAudio()
  const [selectedKey, setSelectedKey] = useState(sources[0]?.key ?? '')
  const source = useMemo(
    () => sources.find((item) => item.key === selectedKey) ?? sources[0],
    [selectedKey, sources],
  )
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
    if (next && active) {
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
    <div className="mt-9 rounded-2xl border border-hair bg-wash p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair pb-4">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">استماع</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">
            {isDialogue ? 'استمع للحوار.' : 'استمع للقراءة.'}
          </h2>
          <p className="mt-1 text-[.8rem] leading-relaxed text-soft">
            المشغل يستمر أسفل الموقع إذا انتقلت إلى صفحة أخرى.
          </p>
        </div>
        <button
          type="button"
          onClick={() => active && player.playing ? void player.toggle() : void play()}
          aria-label={active && player.playing ? 'إيقاف مؤقت' : 'تشغيل القراءة'}
          title={active && player.playing ? 'إيقاف مؤقت' : 'تشغيل القراءة'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent-deep"
        >
          {active && player.playing ? (
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>
          ) : (
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="-translate-x-[1px]"><path d="M8 5.7v12.6c0 .9 1 1.5 1.8 1l9.2-6.3a1.2 1.2 0 0 0 0-2L9.8 4.7A1.2 1.2 0 0 0 8 5.7Z"/></svg>
          )}
        </button>
      </div>

      {sources.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="اختر تجربة الاستماع">
          <span className="sr-only">اختر تجربة الاستماع</span>
          {sources.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => choose(item.key)}
              aria-pressed={source.key === item.key}
              aria-label={item.label}
              title={item.label}
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
                source.key === item.key ? 'border-accent bg-accent text-canvas shadow-sm' : 'border-hair bg-canvas text-soft hover:-translate-y-0.5 hover:border-accent hover:text-accent'
              }`}
            >
              <VoiceAvatar kind={item.avatar || (item.key === 'dialogue' ? 'dialogue' : 'boy')} size={30} />
              <span className="sr-only">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={(event) => {
            if (!active || !duration) return
            const rect = event.currentTarget.getBoundingClientRect()
            player.seekTo(((rect.right - event.clientX) / rect.width) * duration)
          }}
          className="block h-2 w-full overflow-hidden rounded-full bg-canvas"
          aria-label="شريط تقدم الصوت"
        >
          <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[.76rem] text-soft">
          <span>{clock(current)} / {clock(duration)}</span>
          <span className="h-1 w-1 rounded-full bg-hair" />
          <span className="inline-flex items-center" aria-label={source.label} title={source.label}><VoiceAvatar kind={source.avatar || (source.key === 'dialogue' ? 'dialogue' : 'boy')} size={22} /><span className="sr-only">{source.label}</span></span>
          {active && player.error && <span className="text-soft">· {player.error}</span>}
          <span className="ms-auto flex items-center gap-1.5">
            <button onClick={() => player.jump(-15)} disabled={!active} className="rounded-full border border-hair px-2.5 py-1 disabled:opacity-40">15-</button>
            <button onClick={() => player.jump(15)} disabled={!active} className="rounded-full border border-hair px-2.5 py-1 disabled:opacity-40">15+</button>
            <button onClick={player.cycleSpeed} disabled={!active} className="rounded-full border border-hair px-2.5 py-1 disabled:opacity-40">
              {AUDIO_SPEEDS.includes(player.speed) ? player.speed : 1}x
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
