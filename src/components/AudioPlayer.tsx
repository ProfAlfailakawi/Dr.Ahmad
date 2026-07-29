import { useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO_SPEEDS, usePersistentAudio } from '../lib/persistent-audio'

const ar = (n: number) => String(n).replace(/[0-9]/g, (digit) => '0123456789'[+digit])
const ARTICLE_VOICE_PREFERENCE_KEY = 'article-audio-reading-voice-v1'
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
  avatar?: 'man' | 'woman' | 'dialogue'
}

/* صورة صوت بلا كلام: رجل/امرأة — أحادية اللون، تحترم هوية الموقع */
function VoiceFigure({ kind, size = 16 }: { kind: 'man' | 'woman'; size?: number }) {
  return kind === 'woman' ? (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M7.2 10.4a4.8 4.8 0 1 1 9.6 0c0 1.9.5 3 1.2 4.1-1.5.6-2.6.8-4 .8h-4c-1.4 0-2.5-.2-4-.8.7-1.1 1.2-2.2 1.2-4.1Z" />
      <circle cx="12" cy="9.6" r="3.1" fill="currentColor" stroke="none" opacity=".9" />
      <path d="M5.4 20.2c1.3-2.6 3.8-3.9 6.6-3.9s5.3 1.3 6.6 3.9" />
    </svg>
  ) : (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="8.6" r="3.4" fill="currentColor" stroke="none" opacity=".9" />
      <path d="M5.2 20.2c1.3-2.9 3.9-4.4 6.8-4.4s5.5 1.5 6.8 4.4" />
    </svg>
  )
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

export const openAudioPlayer = (controlId: string, sourceKey?: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('audio-player:open', { detail: { controlId, sourceKey } }))
}

export function AudioPlayer({ sources, title, compact = false, controlId }: { sources: AudioSource[]; title: string; compact?: boolean; controlId?: string }) {
  const player = usePersistentAudio()
  const rootRef = useRef<HTMLDivElement>(null)
  const [selectedKey, setSelectedKey] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const remembered = window.localStorage.getItem(ARTICLE_VOICE_PREFERENCE_KEY)
        if (remembered && sources.some((item) => item.key === remembered)) return remembered
      } catch { /* التخزين اختياري */ }
    }
    return sources.find((item) => item.avatar === 'man')?.key ?? sources[0]?.key ?? ''
  })
  const [expanded, setExpanded] = useState(false)
  const [articleFollow, setArticleFollow] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('article-audio-follow') !== 'off'
  })
  const source = useMemo(() => sources.find((item) => item.key === selectedKey) ?? sources[0], [selectedKey, sources])
  const anyActive = sources.some((item) => player.isActive(item.src))


  useEffect(() => {
    if (sources.some((item) => item.key === selectedKey)) return
    let remembered = ''
    if (typeof window !== 'undefined') {
      try { remembered = window.localStorage.getItem(ARTICLE_VOICE_PREFERENCE_KEY) || '' } catch { /* noop */ }
    }
    const fallback = sources.find((item) => item.key === remembered)
      ?? sources.find((item) => item.avatar === 'man')
      ?? sources[0]
    setSelectedKey(fallback?.key ?? '')
  }, [selectedKey, sources])

  useEffect(() => {
    if (anyActive) setExpanded(true)
  }, [anyActive])

  useEffect(() => {
    if (!expanded) return
    window.dispatchEvent(new CustomEvent('audio-player:expanded', { detail: { controlId } }))
  }, [controlId, expanded])

  useEffect(() => {
    const collapseOthers = (event: Event) => {
      const requested = (event as CustomEvent<{ controlId?: string }>).detail?.controlId
      if (!requested || requested === controlId) return
      setExpanded(false)
    }
    window.addEventListener('audio-player:expanded', collapseOthers)
    return () => window.removeEventListener('audio-player:expanded', collapseOthers)
  }, [controlId])

  useEffect(() => {
    const openRequested = (event: Event) => {
      const detail = (event as CustomEvent<{ controlId?: string; sourceKey?: string }>).detail
      const requested = detail?.controlId
      if (controlId && requested && requested !== controlId) return
      if (detail?.sourceKey && sources.some((item) => item.key === detail.sourceKey)) setSelectedKey(detail.sourceKey)
      setExpanded(true)
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })))
    }
    window.addEventListener('audio-player:open', openRequested)
    return () => window.removeEventListener('audio-player:open', openRequested)
  }, [controlId, sources])

  useEffect(() => {
    const syncFollow = (event: Event) => {
      const next = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
      if (typeof next === 'boolean') setArticleFollow(next)
    }
    window.addEventListener('article-audio-follow-change', syncFollow)
    return () => window.removeEventListener('article-audio-follow-change', syncFollow)
  }, [])

  if (!source) return null

  const active = player.isActive(source.src)
  const current = active ? player.current : 0
  const duration = active ? player.duration : 0
  const percent = duration ? Math.min((current / duration) * 100, 100) : 0
  const isDialogue = source.key === 'dialogue' || source.avatar === 'dialogue'
  const canFollowArticle = typeof window !== 'undefined' && window.location.pathname.startsWith('/articles/') && !isDialogue

  const jumpSentence = (direction: 'next' | 'prev') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('article-audio-jump-sentence', { detail: { direction } }))
    }
  }

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
    if (next?.avatar === 'man' || next?.avatar === 'woman') {
      try { window.localStorage.setItem(ARTICLE_VOICE_PREFERENCE_KEY, key) } catch { /* يبقى الاختيار في الجلسة */ }
    }
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

  const toggleArticleFollow = () => {
    const next = !articleFollow
    setArticleFollow(next)
    try { localStorage.setItem('article-audio-follow', next ? 'on' : 'off') } catch { /* noop */ }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('article-audio-follow-change', { detail: { enabled: next } }))
    }
  }

  return (
    <div ref={rootRef} id={controlId} className={compact ? 'min-w-0 scroll-mt-28' : 'mt-7 scroll-mt-28'}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className={compact
          ? 'group flex min-h-11 w-full items-center gap-2 px-1 text-start transition-colors hover:text-accent'
          : 'group flex w-full items-center gap-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-start transition-colors hover:border-accent/45'}
      >
        <span className={`flex shrink-0 items-center justify-center text-accent ${compact ? 'h-9 w-9' : 'h-9 w-9 rounded-full bg-accent/8'}`}><AudioWave dialogue={isDialogue} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[.82rem] font-semibold text-ink">استمع</span>
          {!compact && <span className="mt-0.5 block truncate text-[.7rem] text-soft">{anyActive ? player.track?.label : sources.length > 1 ? `${sources.length.toLocaleString('en-US')} تجارب صوتية` : source.label}</span>}
        </span>
        <span className={`text-[.82rem] text-soft transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {expanded && (
        <section className="mt-3 rounded-xl border border-hair bg-wash/55 p-4 md:p-5" aria-label="مشغل المقال الصوتي">
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
              <p className="flex items-center gap-1.5 truncate text-[.78rem] font-semibold text-ink">
                {source.key !== 'dialogue' && <VoiceFigure kind={(source as { avatar?: 'man' | 'woman' }).avatar === 'woman' ? 'woman' : 'man'} size={15} />}
                {source.key === 'dialogue' ? 'استمع' : source.label}
              </p>
              <p className="mt-0.5 text-[.68rem] text-soft">{active ? `${clock(current)} / ${clock(duration)}` : 'جاهز للاستماع'}</p>
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
            {canFollowArticle && (
              <button
                type="button"
                onClick={toggleArticleFollow}
                aria-pressed={articleFollow}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[.72rem] font-semibold transition-colors ${articleFollow ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${articleFollow ? 'bg-white' : 'bg-accent'}`} />
                تتبع النص
              </button>
            )}
            {sources.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => choose(item.key)}
                aria-pressed={source.key === item.key}
                aria-label={item.key === 'dialogue' ? item.label : ((item as { avatar?: string }).avatar === 'woman' ? 'القراءة بالصوت النسائي' : 'القراءة بالصوت الرجالي')}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[.72rem] font-semibold transition-colors ${source.key === item.key ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
              >
                <AudioWave dialogue={item.key === 'dialogue'} size={16} />
                {item.key === 'dialogue'
                  ? null
                  : <VoiceFigure kind={(item as { avatar?: 'man' | 'woman' }).avatar === 'woman' ? 'woman' : 'man'} size={17} />}
              </button>
            ))}
            <span className="ms-auto flex items-center gap-1.5">
              {canFollowArticle && articleFollow && active && (
                <>
                  <button type="button" onClick={() => jumpSentence('prev')} title="السابق" aria-label="السابق" className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-[.78rem] text-soft hover:border-accent hover:text-accent">◀</button>
                  <button type="button" onClick={() => jumpSentence('next')} title="التالي" aria-label="التالي" className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-[.78rem] text-soft hover:border-accent hover:text-accent">▶</button>
                </>
              )}
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
