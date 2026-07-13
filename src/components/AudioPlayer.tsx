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
          className="rounded-full bg-accent px-5 py-2.5 text-[.86rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          {active && player.playing ? 'إيقاف مؤقت' : 'تشغيل'}
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
