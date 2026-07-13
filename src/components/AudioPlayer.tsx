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
          <span className="me-1 text-[.8rem] text-soft">التجربة</span>
          {sources.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => choose(item.key)}
              aria-pressed={source.key === item.key}
              className={`rounded-full border px-3.5 py-1 text-[.8rem] transition-colors ${
                source.key === item.key ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
              }`}
            >
              {item.key === 'dialogue' ? 'الحوار' : item.label}
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
          <span>{source.label}</span>
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
