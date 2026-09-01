import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { usePersistentAudio } from '../lib/persistent-audio'
import { rtlSeekFraction, rtlSeekSeconds } from '../lib/audio-seek'
import { listenIsOpen } from '../lib/listen-catalog'
import { SocialIcon } from './icons'
import { VoiceFigure, voiceKindForSpeaker } from './VoiceFigure'
import { arabicCountPhrase, AUDIO_TRIAL_FORMS } from '../lib/arabic-count.ts'
import { loadAudioPeaks } from '../lib/audio-peaks'
import { dialogueVariantKey, dialogueVariantPreference, rememberDialogueVariant } from '../lib/dialogue-variant'

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
  /** نصّ الحلقة الحوارية المنشور بجانب صوتها — منه الفصول والنص المتزامن. */
  transcript?: string
  /** بدايةٌ مقصودة بالثانية (رابط لحظة ‎?t=‎). */
  startAt?: number
  /** نسخةٌ خفيفة من النص المنطوق تُستعمل إذا تعذّر Transcript المنشور. */
  fallbackTranscript?: string
  /** المادة الجديدة تبدأ من الصفر ولا تستأنف موضعاً قديماً. */
  startFresh?: boolean
}

type DialogueLine = { speaker?: string; text: string; startSec?: number; endSec?: number }
type DialogueChapter = { index: number; title: string; startSec: number; endSec: number }
type DialogueScript = { chapters: DialogueChapter[]; utterances: DialogueLine[] }


async function dialogueScriptFrom(primary?: string, fallback?: string): Promise<DialogueScript | null> {
  const load = async (url?: string) => {
    if (!url) return null
    const response = await fetch(url, { cache: 'force-cache' })
    if (!response.ok) return null
    return response.json() as Promise<Record<string, unknown>>
  }
  try {
    const data = await load(primary)
    if (data && Array.isArray(data.utterances)) {
      return {
        chapters: Array.isArray(data.chapters) ? data.chapters as DialogueChapter[] : [],
        utterances: (data.utterances as DialogueLine[]).filter((line) => line && typeof line.text === 'string'),
      }
    }
  } catch { /* ننتقل إلى النسخة الخفيفة */ }
  try {
    const data = await load(fallback)
    const lines = Array.isArray(data?.lines) ? data.lines as unknown[][] : []
    if (!lines.length) return null
    const utterances: DialogueLine[] = lines
      .filter((row) => Array.isArray(row) && typeof row[0] === 'number' && typeof row[2] === 'string')
      .map((row, index, all) => ({
        startSec: Number(row[0]),
        endSec: typeof all[index + 1]?.[0] === 'number' ? Number(all[index + 1][0]) : undefined,
        speaker: Number(row[1]) === 1 ? 'نورة' : 'فهد',
        text: String(row[2]),
      }))
    return utterances.length ? { chapters: [], utterances } : null
  } catch { return null }
}

/* نصُّ الحلقة يتوهّج مع الصوت، وفصولٌ عند جسور المحرّر يقفز إليها المستمع.
   التوقيت من Timeline التركيب نفسه لا من تقدير، فإن غاب (حلقةٌ قديمة قبل
   التوقيت) بقي النصّ كاملاً مقروءاً بلا توهّجٍ ولا فصول — نقصٌ في الميزة
   لا كسرٌ في الصفحة. مكوّنٌ مستقل بذاكرة: نبضُ الثانية لا يُعيد بناء أربعين
   سطراً، وإنما يتحرك السطر المضيء وحده. */
const DialogueScriptView = memo(function DialogueScriptView({ script, activeIndex, onJump }: {
  script: DialogueScript
  activeIndex: number
  onJump: (seconds: number) => void
}) {
  const listRef = useRef<HTMLOListElement>(null)
  const timed = script.utterances.some((line) => typeof line.startSec === 'number')
  /* أدبُ المتابعة: من يقرأ متقدّماً على الصوت لا يُسحب إلى الوراء كل ثانية.
     إن حرّك القارئ النصّ بيده سكن التتبّع ستّ ثوانٍ ثم عاد وحده — بلا زرٍّ
     يتعلّمه ولا إعداد. والحركة التي نصنعها نحن لا تُحسب حركةً منه. */
  const followSuspendedUntil = useRef(0)
  const selfScrolling = useRef(false)

  useEffect(() => {
    const list = listRef.current
    const node = list?.children[activeIndex] as HTMLElement | undefined
    if (activeIndex < 0 || !list || !node || Date.now() < followSuspendedUntil.current) return
    /* لا نحرّك النصّ ما دام السطر المضيء مرئياً: الحركة عند الحاجة وحدها،
       فلا يرتجّ النصّ مع كل جملة. وحين يخرج السطر نُنزل الشريط ليتوسّطه. */
    const lineTop = node.offsetTop
    const lineBottom = lineTop + node.clientHeight
    const viewTop = list.scrollTop
    if (lineTop >= viewTop + 24 && lineBottom <= viewTop + list.clientHeight - 24) return
    const target = Math.max(0, Math.min(list.scrollHeight - list.clientHeight,
      lineTop - list.clientHeight / 2 + node.clientHeight / 2))
    selfScrolling.current = true
    list.scrollTo({ top: target, behavior: 'smooth' })
    /* بعض المتصفّحات تتجاهل الانسياب البرمجي داخل صندوقٍ متمرّر فلا يتحرّك شيء
       (رُصد حيّاً). نتحقّق بعد لحظة: إن لم يبدأ الشريط بالحركة أوصلناه فوراً —
       فالوصول أهمّ من نعومة الوصول. */
    const ensure = window.setTimeout(() => {
      if (Math.abs(list.scrollTop - viewTop) < 2) list.scrollTop = target
    }, 220)
    const settle = window.setTimeout(() => { selfScrolling.current = false }, 900)
    return () => { window.clearTimeout(ensure); window.clearTimeout(settle) }
  }, [activeIndex])

  const activeChapter = script.chapters.findIndex((chapter, index) => {
    const line = script.utterances[activeIndex]
    if (!line || typeof line.startSec !== 'number') return false
    const next = script.chapters[index + 1]
    return line.startSec >= chapter.startSec && (!next || line.startSec < next.startSec)
  })

  return (
    <div className="mt-4 border-t border-hair pt-4">
      {script.chapters.length > 1 && (
        <>
          <p className="text-[.68rem] font-semibold tracking-wide text-soft">محاور الحلقة</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {script.chapters.map((chapter, index) => (
              <button
                key={chapter.index}
                type="button"
                onClick={() => onJump(chapter.startSec)}
                aria-current={index === activeChapter ? 'true' : undefined}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-[.7rem] transition-colors ${index === activeChapter ? 'border-accent bg-accent/[.08] text-accent' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
              >
                <span className="text-[.62rem] opacity-70">{ar(chapter.index)}</span>
                <span className="truncate">{chapter.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <ol
        ref={listRef}
        onScroll={() => { if (!selfScrolling.current) followSuspendedUntil.current = Date.now() + 6000 }}
        className="mt-3 max-h-72 space-y-1 overflow-y-auto pe-1"
        aria-label="نص الحلقة"
      >
        {script.utterances.map((line, index) => {
          const seekable = typeof line.startSec === 'number'
          const isActive = index === activeIndex
          return (
            <li key={index}>
              <button
                type="button"
                disabled={!seekable}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => seekable && onJump(line.startSec as number)}
                className={`block w-full rounded-lg px-2.5 py-1.5 text-start text-[.78rem] leading-relaxed transition-colors ${isActive ? 'bg-accent/[.08] text-ink' : 'text-soft'} ${seekable ? 'hover:bg-wash hover:text-ink' : 'cursor-default'}`}
              >
                {line.speaker && (
                  <span
                    className={`me-2 inline-flex h-6 w-6 translate-y-[2px] items-center justify-center rounded-full border align-middle ${isActive ? 'border-accent/[.35] bg-accent/[.08] text-accent' : 'border-hair bg-canvas text-soft/80'}`}
                    aria-label={voiceKindForSpeaker(line.speaker) === 'woman' ? 'المتحدثة' : 'المتحدث'}
                    title={voiceKindForSpeaker(line.speaker) === 'woman' ? 'المتحدثة' : 'المتحدث'}
                  >
                    <VoiceFigure kind={voiceKindForSpeaker(line.speaker)} size={14} />
                  </span>
                )}
                {line.text}
              </button>
            </li>
          )
        })}
      </ol>
      {!timed && <p className="mt-2 px-2.5 text-[.68rem] text-soft">هذه حلقة أُنتجت قبل التوقيت؛ يظهر نصّها كاملاً بلا تتبّع.</p>}
      {/* بابٌ واحد هادئ إلى بقية الحلقات، لا يراه إلا من يستمع الآن. */}
      {listenIsOpen && (
        <Link to="/listen" className="mt-3 inline-block px-2.5 text-[.72rem] text-soft transition-colors hover:text-accent">
          مجلس الفكرة ←
        </Link>
      )}
    </div>
  )
})

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

function MeasuredWave({ peaks, fill }: { peaks: number[]; fill: number }) {
  const path = useMemo(() => peaks.map((peak, index) => {
    const x = index + .5
    const half = Math.max(2, Math.min(48, peak * .48))
    return `M${x} ${50 - half}V${50 + half}`
  }).join(''), [peaks])
  const width = Math.max(1, peaks.length)
  return (
    <span className="audio-measured-wave" aria-hidden="true">
      <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none"><path d={path} /></svg>
      <svg className="audio-measured-wave__fill" viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" style={{ clipPath: `inset(0 0 0 ${100 - Math.max(0, Math.min(100, fill))}%)` }}><path d={path} /></svg>
    </span>
  )
}

export const openAudioPlayer = (controlId: string, sourceKey?: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('audio-player:open', { detail: { controlId, sourceKey } }))
}

export function AudioPlayer({ sources, title, compact = false, controlId, showChapters = false }:
  { sources: AudioSource[]; title: string; compact?: boolean; controlId?: string; showChapters?: boolean }) {
  const player = usePersistentAudio()
  const rootRef = useRef<HTMLDivElement>(null)
  const [selectedKey, setSelectedKey] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const remembered = window.localStorage.getItem(ARTICLE_VOICE_PREFERENCE_KEY)
        if (remembered && sources.some((item) => item.key === remembered)) return remembered
      } catch { /* التخزين اختياري */ }
    }
    const dialoguePreferred = dialogueVariantKey(dialogueVariantPreference())
    if (dialoguePreferred === 'dialogue-kuwaiti'
      && sources.some((item) => item.key === dialoguePreferred)) return dialoguePreferred
    if (sources.length > 0 && sources.every((item) => item.avatar === 'dialogue')
      && sources.some((item) => item.key === dialoguePreferred)) return dialoguePreferred
    return sources.find((item) => item.avatar === 'man')?.key ?? sources[0]?.key ?? ''
  })
  const [expanded, setExpanded] = useState(false)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [articleFollow, setArticleFollow] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('article-audio-follow') !== 'off'
  })
  const source = useMemo(() => sources.find((item) => item.key === selectedKey) ?? sources[0], [selectedKey, sources])
  const anyActive = sources.some((item) => player.isActive(item.src))


  useEffect(() => {
    if (!anyActive && sources.length > 0 && sources.every((item) => item.avatar === 'dialogue')) {
      const preferred = dialogueVariantKey(dialogueVariantPreference())
      if (preferred !== selectedKey && sources.some((item) => item.key === preferred)) {
        setSelectedKey(preferred)
        return
      }
    }
    if (sources.some((item) => item.key === selectedKey)) return
    let remembered = ''
    if (typeof window !== 'undefined') {
      try { remembered = window.localStorage.getItem(ARTICLE_VOICE_PREFERENCE_KEY) || '' } catch { /* noop */ }
    }
    const fallback = sources.find((item) => item.key === remembered)
      ?? sources.find((item) => item.avatar === 'man')
      ?? sources[0]
    setSelectedKey(fallback?.key ?? '')
  }, [anyActive, selectedKey, sources])

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

  /* نصّ الحلقة لا يُجلب إلا حين يفتح المستمع المشغّل فعلاً: لا بايت واحد
     يُحمَّل على من لا يستمع، ولا يُثقَل أول رسمٍ للصفحة. */
  const transcriptSrc = source?.transcript
  const fallbackTranscriptSrc = source?.fallbackTranscript
  const [script, setScript] = useState<DialogueScript | null>(null)
  useEffect(() => {
    setScript(null)
    if (!expanded || (!transcriptSrc && !fallbackTranscriptSrc)) return
    let on = true
    void dialogueScriptFrom(transcriptSrc, fallbackTranscriptSrc)
      .then((data) => { if (on && data) setScript(data) })
      .catch(() => { /* الحلقة تُسمع وإن تعذّر نصّها */ })
    return () => { on = false }
  }, [expanded, fallbackTranscriptSrc, transcriptSrc])

  useEffect(() => {
    setPeaks(null)
    if (!expanded || !source?.src) return
    let active = true
    void loadAudioPeaks(source.src).then((values) => { if (active) setPeaks(values) })
    return () => { active = false }
  }, [expanded, source?.src])

  /* ═══ محاور الحلقة في شريط التقدّم ═══
     كانت المحاور مدفونةً داخل لوحة نصّ الحلقة، فلا تُرى إلا بفتحةٍ ثانية —
     ولم تكن تُرى أصلاً في مجلس الفكرة لأن اللوحة لا تُفتح هناك. نجلب المحاور
     وحدها (بلا انتظار اللوحة) حيث تُطلب صراحةً، فيبقى المقال كما هو تماماً
     ولا يُحمَّل بايتٌ على من لا يستمع. */
  const [chapters, setChapters] = useState<DialogueChapter[]>([])
  useEffect(() => {
    setChapters([])
    if (!showChapters || !transcriptSrc) return
    let on = true
    fetch(transcriptSrc, { cache: 'force-cache' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!on || !Array.isArray(data?.chapters)) return
        setChapters(data.chapters.filter((chapter: DialogueChapter) => typeof chapter?.startSec === 'number'))
      })
      .catch(() => { /* الحلقة تُسمع وإن تعذّرت محاورها */ })
    return () => { on = false }
  }, [showChapters, transcriptSrc])

  /* القفز إلى محورٍ أو سطرٍ قبل بدء التشغيل: المتصفّح لا يعرف مدة الملف بعد،
     فـseekTo يسقط صامتاً. نحفظ الطلب ونُنفّذه لحظة تُعرف المدة. */
  const [pendingSeek, setPendingSeek] = useState<number | null>(null)
  useEffect(() => {
    if (pendingSeek === null) return
    if (!player.isActive(source?.src) || !player.duration) return
    player.seekTo(pendingSeek)
    setPendingSeek(null)
  }, [pendingSeek, player, source?.src])

  if (!source) return null

  const active = player.isActive(source.src)
  const current = active ? player.current : 0
  const duration = active ? player.duration : 0
  const percent = duration ? Math.min((current / duration) * 100, 100) : 0
  const isDialogue = source.key === 'dialogue' || source.avatar === 'dialogue'
  const canFollowArticle = typeof window !== 'undefined' && window.location.pathname.startsWith('/articles/') && !isDialogue

  const play = () => player.playTrack({
    id: source.src,
    src: source.src,
    title,
    label: source.label,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    ...(source.startAt ? { startAt: source.startAt } : {}),
    ...(source.startFresh ? { startFresh: true } : {}),
  })

  /* السطر المضيء: آخرُ مداخلةٍ بدأت قبل اللحظة الحالية. المداخلات مرتّبة
     زمنياً فنقف عند أول مداخلةٍ لم يحن وقتها بعد. */
  let activeIndex = -1
  if (active && script) {
    for (let index = 0; index < script.utterances.length; index++) {
      const start = script.utterances[index].startSec
      if (typeof start !== 'number') continue
      if (start <= current + 0.15) activeIndex = index
      else break
    }
  }

  /* حدود المقاطع: يبدأ الأول من الصفر ليبتلع المقدمة الموسيقية، وينتهي
     الأخير عند نهاية الملف ليبتلع الخاتمة — فلا فجوة في الشريط ولا قفزة. */
  const segments = duration > 0 && chapters.length > 1
    ? chapters.map((chapter, index) => ({
      title: String(chapter.title || ''),
      from: index === 0 ? 0 : Number(chapter.startSec) || 0,
      to: index + 1 < chapters.length ? (Number(chapters[index + 1].startSec) || duration) : duration,
      seekTo: Number(chapter.startSec) || 0,
    })).filter((segment) => segment.to > segment.from)
    : []
  const activeSegment = segments.findIndex((segment, index) =>
    current >= segment.from && (index + 1 === segments.length || current < segment.to))

  const jumpTo = (seconds: number) => {
    if (active && duration) { player.seekTo(seconds); return }
    setPendingSeek(seconds)
    void play()
  }

  const choose = (key: string) => {
    setSelectedKey(key)
    const next = sources.find((item) => item.key === key)
    if (next?.avatar === 'man' || next?.avatar === 'woman') {
      try { window.localStorage.setItem(ARTICLE_VOICE_PREFERENCE_KEY, key) } catch { /* يبقى الاختيار في الجلسة */ }
    } else if (next?.avatar === 'dialogue') {
      rememberDialogueVariant(key === 'dialogue-kuwaiti' ? 'kuwaiti' : 'standard')
    }
    if (next && anyActive) {
      void player.playTrack({
        id: next.src,
        src: next.src,
        title,
        label: next.label,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
        ...(next.startFresh ? { startFresh: true } : {}),
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
          : 'group flex w-full items-center gap-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-start transition-colors hover:border-accent/[.45]'}
      >
        <span className={`flex shrink-0 items-center justify-center text-accent ${compact ? 'h-9 w-9' : 'h-9 w-9 rounded-full bg-accent/[.08]'}`}><AudioWave dialogue={isDialogue} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[.82rem] font-semibold text-ink">استمع</span>
          {!compact && <span className="mt-0.5 block truncate text-[.7rem] text-soft">{anyActive ? player.track?.label : sources.length > 1 ? arabicCountPhrase(sources.length, AUDIO_TRIAL_FORMS, (value) => value.toLocaleString('en-US')) : source.label}</span>}
        </span>
        <span className={`text-soft transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}><SocialIcon name="ChevronDown" size={14} /></span>
      </button>

      {expanded && (
        <section className="mt-3 rounded-xl border border-hair bg-wash/[.55] p-4 md:p-5" aria-label="مشغل المقال الصوتي">
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
                {!isDialogue && <VoiceFigure kind={(source as { avatar?: 'man' | 'woman' }).avatar === 'woman' ? 'woman' : 'man'} size={15} />}
                {source.label}
              </p>
              <p className="mt-0.5 truncate text-[.68rem] text-soft">
                {active
                  ? `${clock(current)} / ${clock(duration)}${segments[activeSegment]?.title ? ` · ${segments[activeSegment].title}` : ''}`
                  : 'جاهز للاستماع'}
              </p>
            </div>
          </div>

          {/* الشريط نفسه هو التنقّل: يُقسَم بعدد المحاور فلا يُضاف عنصرٌ واحد
              إلى الواجهة. نقرةٌ على قطعةٍ تقفز إلى محورها، والنقر داخل القطعة
              يبحث بدقّةٍ كما كان. وحين لا محاور يبقى الشريط كما هو حرفاً. */}
          {segments.length > 1 ? (
            <div className="mt-4 flex w-full items-center gap-[3px]" role="group" aria-label="محاور الحلقة">
              {segments.map((segment, index) => {
                const span = segment.to - segment.from
                const fill = Math.max(0, Math.min(100, ((current - segment.from) / span) * 100))
                return (
                  <button
                    key={`${segment.from}-${index}`}
                    type="button"
                    title={segment.title}
                    aria-label={`المحور ${index + 1}${segment.title ? `: ${segment.title}` : ''}`}
                    aria-current={activeSegment === index ? 'true' : undefined}
                    onClick={(event) => {
                      const within = rtlSeekFraction(event.currentTarget, event.clientX)
                      jumpTo(segment.from + within * span)
                    }}
                    style={{ flexGrow: span, flexBasis: 0 }}
                    className={`audio-wave-progress audio-wave-segment block h-7 overflow-hidden rounded-md transition-opacity hover:opacity-85${peaks ? ' has-measured-wave' : ''}${active && player.playing ? ' is-playing' : ''}`}
                  >
                    {peaks
                      ? <MeasuredWave peaks={peaks.slice(Math.floor((segment.from / duration) * peaks.length), Math.max(1, Math.ceil((segment.to / duration) * peaks.length)))} fill={fill} />
                      : <span className="audio-wave-fill block h-full transition-[width]" style={{ width: `${fill}%` }} />}
                  </button>
                )
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                if (!active || !duration) return
                player.seekTo(rtlSeekSeconds(event.currentTarget, event.clientX, duration))
              }}
              className={`audio-wave-progress mt-4 block h-7 w-full overflow-hidden rounded-md${peaks ? ' has-measured-wave' : ''}${active && player.playing ? ' is-playing' : ''}`}
              aria-label="شريط تقدم الصوت"
            >
              {peaks ? <MeasuredWave peaks={peaks} fill={percent} /> : <span className="audio-wave-fill block h-full transition-[width]" style={{ width: `${percent}%` }} />}
            </button>
          )}


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
            {/* مصدرٌ واحد لا يُختار: شارةٌ وحيدة تُضغط فلا يتغيّر شيء زحمةٌ لا خيار. */}
            {sources.length > 1 && sources.map((item) => {
              const dialogueChoice = item.avatar === 'dialogue'
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => choose(item.key)}
                  aria-pressed={source.key === item.key}
                  aria-label={dialogueChoice ? item.label : ((item as { avatar?: string }).avatar === 'woman' ? 'القراءة بالصوت النسائي' : 'القراءة بالصوت الرجالي')}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[.72rem] font-semibold transition-colors ${source.key === item.key ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
                >
                  <AudioWave dialogue={dialogueChoice} size={16} />
                  {dialogueChoice
                    ? <span>{item.label}</span>
                    : <VoiceFigure kind={(item as { avatar?: 'man' | 'woman' }).avatar === 'woman' ? 'woman' : 'man'} size={17} />}
                </button>
              )
            })}
          </div>


          {script && script.utterances.length > 0 && (
            <DialogueScriptView script={script} activeIndex={activeIndex} onJump={jumpTo} />
          )}

          {active && player.error && <p className="mt-3 text-[.7rem] leading-relaxed text-soft">{player.error}</p>}
        </section>
      )}
    </div>
  )
}
