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

function VoiceAvatar({ kind, size = 34 }: { kind: AudioSource['avatar']; size?: number }) {
  if (kind === 'dialogue') return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M6.5 9.5h16a4 4 0 0 1 4 4v6.2a4 4 0 0 1-4 4H15l-6 4.3 1.2-4.3H10.5a4 4 0 0 1-4-4v-6.2a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M23.8 16.1h6.1a3.6 3.6 0 0 1 3.6 3.6v5.1a3.6 3.6 0 0 1-3.6 3.6h-.2l.9 3.4-5.1-3.4h-4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="15" cy="16.5" r="1.25" fill="currentColor"/><circle cx="20" cy="16.5" r="1.25" fill="currentColor"/>
    </svg>
  )
  if (kind === 'woman') return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity=".08"/>
      <path d="M10.8 19.2c0-7 3.7-11.8 9.4-11.8 5.8 0 9.2 4.7 9.2 11.7v9.2c-2.4-2.2-5.3-3.3-9.2-3.3-4 0-7 1.1-9.4 3.3v-9.1Z" fill="currentColor" opacity=".23"/>
      <path d="M12.5 18.5c.2-5.8 3.1-9.1 7.8-9.1 4.5 0 7.3 3.2 7.6 8.8-2.4-.1-4.7-1.3-6.8-3.4-1.7 2.1-4.7 3.4-8.6 3.7Z" fill="currentColor"/>
      <ellipse cx="20.2" cy="18.6" rx="5.6" ry="6" fill="currentColor" opacity=".82"/>
      <path d="M8.8 34c1.8-6.1 5.6-9.2 11.4-9.2 5.7 0 9.5 3.1 11.2 9.2" fill="currentColor" opacity=".82"/>
      <path d="M28.2 13.7c3.5 1.6 4.7 4.4 3.7 8.2-1.5-1-2.7-1.2-3.8-.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity=".08"/>
      <path d="M11.4 16.8c.7-6.1 3.9-9.2 9.7-9.2 5.2 0 8.3 3 8.8 8.8-2-1.5-4.4-2.3-7.1-2.4-3.2-.2-7 .8-11.4 2.8Z" fill="currentColor"/>
      <ellipse cx="20.3" cy="18.4" rx="5.8" ry="6.2" fill="currentColor" opacity=".84"/>
      <path d="M8.6 34c1.9-6.2 5.8-9.3 11.7-9.3 5.8 0 9.6 3.1 11.4 9.3" fill="currentColor" opacity=".84"/>
      <path d="M13.2 12.4c2.6-2.3 5.4-3.3 8.4-3.1 2.4.2 4.5 1 6.2 2.6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/>
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
              className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all ${
                source.key === item.key ? 'border-accent bg-accent text-canvas shadow-[0_8px_22px_-14px_rgba(21,22,26,.65)]' : 'border-accent/25 bg-canvas text-accent/85 hover:-translate-y-0.5 hover:border-accent hover:bg-wash'
              }`}
            >
              <VoiceAvatar kind={item.avatar || (item.key === 'dialogue' ? 'dialogue' : 'boy')} size={38} />
              {source.key === item.key && <span aria-hidden className="absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-canvas" />}
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
