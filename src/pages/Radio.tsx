import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import schedule from '../data/radio-schedule.json'
import { versionedAudioUrl } from '../components/extras'
import { useSeo } from '../components/seo'
import './radio.css'

/* ═══════════ الإذاعة — بثٌّ متزامن بساعة الكويت ═══════════

   لا خادم بثّ ولا مقابل: حلقةُ يومٍ واحدة (جدولٌ ثابت يبنيه build-listen-index)
   وكلُّ جهازٍ يحسب موضعه فيها من ساعة الكويت، فيسمع الجميع اللحظة نفسها.
   والجملة المنطوقة تُعرض من نصّ الحلقة الموقّت — فالنصّ يتحرك مع الصوت،
   وهذا ما لا تملكه إذاعات الذكاء الاصطناعي التي نقيس عليها.                */

type Item = { slug: string; title: string; cat: string; at: number; dur: number }
type Utterance = { s: number; e: number; sp: string; t: string }

const ITEMS = (schedule as { items: Item[] }).items
const LOOP = (schedule as { loop: number }).loop

/* ساعة الكويت ثابتة على +3 بلا توقيت صيفي — فالحساب حتميٌّ على كل جهاز */
const kuwaitSecondsOfDay = (d: Date) => {
  const utc = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
  return (utc + 3 * 3600) % 86400
}

function positionNow(now = new Date()) {
  const at = kuwaitSecondsOfDay(now) % LOOP
  let lo = 0
  let hi = ITEMS.length - 1
  let idx = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (ITEMS[mid].at <= at) { idx = mid; lo = mid + 1 } else hi = mid - 1
  }
  return { idx, item: ITEMS[idx], into: at - ITEMS[idx].at }
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const kuwaitClock = (d: Date) =>
  d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuwait' })

const cleanLine = (t: string) => t.replace(/⏸/g, '').replace(/\s*~~\s*/g, ' ').replace(/\s+/g, ' ').trim()

const nameDiacritics = /[\u064B-\u065F\u0670]/g
const bareNameKey = (value: string) => value
  .replace(nameDiacritics, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/[^\p{L}]/gu, '')
function nameWithoutTashkeel(value: string) {
  const tokens = value.split(/(\s+)/)
  const lexical = tokens.map((token, index) => ({ index, key: bareNameKey(token) })).filter((item) => item.key)
  for (let cursor = 0; cursor < lexical.length; cursor += 1) {
    if (lexical[cursor].key !== 'احمد') continue
    const second = lexical[cursor + 1]
    const third = lexical[cursor + 2]
    const isFullName = second?.key === 'حسين' && third?.key === 'الفيلكاوي'
    const isShortName = second?.key === 'الفيلكاوي'
    if (!isFullName && !isShortName) continue
    const targets = isFullName ? [lexical[cursor], second, third] : [lexical[cursor], second]
    for (const target of targets) tokens[target.index] = tokens[target.index].replace(nameDiacritics, '')
  }
  return tokens.join('')
}

/* النصوص تسكن الموقع نفسه — لا طلب خارجيّاً ولا CORS. وتُجلب حلقةً حلقة
   (‎~٢٫٧KB) لا فهرساً جامعاً (٦٥٢KB): المستمع يسمع حلقةً واحدة في اللحظة،
   فلا يدفع ثمن مئةٍ وأربعين لا تُقال الآن. والحلقة التالية تُجهَّز مسبقاً
   فلا تُدرَك الفجوة عند الانتقال. */
type SpokenFile = { slug: string; lines: [number, number, string][] }
const spokenCache = new Map<string, Promise<Utterance[]>>()
function loadEpisode(slug: string): Promise<Utterance[]> {
  let ready = spokenCache.get(slug)
  if (!ready) {
    ready = fetch(`/spoken/${encodeURIComponent(slug)}.json`)
      .then((res) => (res.ok ? res.json() : { lines: [] }))
      .then((file: SpokenFile) => (file.lines || []).map((row, i, all) => ({
        s: row[0],
        e: all[i + 1] ? all[i + 1][0] : row[0] + 8,
        sp: row[1] === 1 ? 'نورة' : 'فهد',
        t: cleanLine(row[2]),
      })))
      .catch(() => [] as Utterance[])
    spokenCache.set(slug, ready)
  }
  return ready
}

/* حبيباتٌ خفيفة تمنع الأسطح المسطّحة من أن تبدو رقميّةً باردة */
function paintGrain(canvas: HTMLCanvasElement) {
  const w = Math.max(1, Math.floor(window.innerWidth / 2))
  const h = Math.max(1, Math.floor(window.innerHeight / 2))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 190
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

export default function Radio() {
  useSeo({
    title: 'الإذاعة — بثٌّ متواصل من فكر د. أحمد الفيلكاوي',
    description: 'إذاعةٌ متزامنة بساعة الكويت: حواراتٌ من مقالات د. أحمد الفيلكاوي تُبثّ على مدار اليوم، والجميع يسمع اللحظة نفسها.',
  })

  const grainRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const loadedSlugRef = useRef<string>('')

  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(() => positionNow())
  const [utterances, setUtterances] = useState<Utterance[]>([])
  const [line, setLine] = useState<{ sp: string; t: string; i: number }>({ sp: '', t: '', i: -1 })
  const [hint, setHint] = useState('')
  const [entered, setEntered] = useState(false)

  /* دخولٌ متدرّج: العناصر تصعد واحداً بعد الآخر عند فتح الصفحة */
  useEffect(() => {
    const id = window.setTimeout(() => setEntered(true), 60)
    return () => window.clearTimeout(id)
  }, [])

  /* الحبيبات مرةً عند الدخول وعند تغيّر المقاس */
  useEffect(() => {
    const canvas = grainRef.current
    if (!canvas) return
    paintGrain(canvas)
    const onResize = () => paintGrain(canvas)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* نصّ الحلقة الحالية — قبل التشغيل وبعده. والتالية تُجهَّز في الخلفية كي
     لا تُرى الصفحة فارغةً في لحظة الانتقال بين حلقتين. */
  useEffect(() => {
    let alive = true
    loadEpisode(pos.item.slug).then((list) => { if (alive) setUtterances(list) })
    const next = ITEMS[(pos.idx + 1) % ITEMS.length]
    if (next && next.slug !== pos.item.slug) loadEpisode(next.slug)
    return () => { alive = false }
  }, [pos.item.slug, pos.idx])

  /* نبض الصفحة: كل ثانية يُعاد حساب الموضع من ساعة الكويت */
  useEffect(() => {
    const tick = () => setPos(positionNow())
    const id = setInterval(tick, 1000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible) }
  }, [])

  /* الجملة المنطوقة الآن — تتبع الصوت نفسه لا نبضة الثانية.
     النسخة السابقة كانت تحدّث الموضع مرةً كل ثانية ثم تنتظر 520ms كي تذيب
     السطر القديم؛ لذلك كان النص يتأخر أحياناً أكثر من ثانية عن الصوت. هنا
     نفحص currentTime مباشرةً كل 90ms أثناء الاستماع (250ms قبل التشغيل)،
     ولا نحدّث React إلا عند انتقالنا فعلياً إلى جملة جديدة. */
  useEffect(() => {
    if (!utterances.length) return
    const total = utterances[utterances.length - 1].e || 1
    let lastIndex = line.i

    const syncLine = () => {
      const q = positionNow()
      const audio = audioRef.current
      const usingAudio = Boolean(playing && audio && !audio.paused && loadedSlugRef.current === q.item.slug)
      const anchor = usingAudio && audio
        ? audio.currentTime + 0.08
        : (q.into / q.item.dur) * total

      let lo = 0
      let hi = utterances.length - 1
      let idx = 0
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (utterances[mid].s <= anchor) { idx = mid; lo = mid + 1 }
        else hi = mid - 1
      }
      if (idx === lastIndex) return
      const u = utterances[idx]
      if (!u) return
      lastIndex = idx
      setLine({ sp: u.sp, t: u.t, i: idx })
    }

    syncLine()
    const id = window.setInterval(syncLine, playing ? 90 : 250)
    return () => window.clearInterval(id)
  }, [playing, utterances, pos.item.slug, line.i])

  /* نبضُ الضوء من الكلام نفسه: توقيتات الجُمل تقول متى يُنطق ومتى يُسكت،
     فيتوهّج الضوء مع الكلام ويخفت في الوقفات — صوتٌ مرئيّ بلا تحليل طيف. */
  useEffect(() => {
    let raf = 0
    const root = document.documentElement
    const tick = () => {
      const audio = audioRef.current
      const anchorNow = playing && audio && !audio.paused && loadedSlugRef.current === positionNow().item.slug
        ? audio.currentTime
        : (() => { const q = positionNow(); const total = utterances.length ? utterances[utterances.length - 1].e : 1; return (q.into / q.item.dur) * total })()
      let speaking = false
      for (const u of utterances) if (anchorNow >= u.s && anchorNow < u.e - 0.25) { speaking = true; break }
      const t = performance.now() / 1000
      const wave = 0.5 + 0.5 * Math.sin(t * 2.1) * Math.sin(t * 3.7)
      const level = speaking ? 0.16 + wave * 0.1 : 0.06
      root.style.setProperty('--radio-level', level.toFixed(3))
      const q = positionNow()
      root.style.setProperty('--radio-prog', `${Math.min(100, (q.into / q.item.dur) * 100).toFixed(1)}%`)
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => { window.cancelAnimationFrame(raf); root.style.removeProperty('--radio-level'); root.style.removeProperty('--radio-prog') }
  }, [playing, utterances])

  /* لون الصوت يتنفّس بمن يتكلّم */
  useEffect(() => {
    document.documentElement.style.setProperty('--radio-voice', line.sp === 'نورة' ? 'var(--radio-noura)' : 'var(--radio-fahd)')
    return () => { document.documentElement.style.removeProperty('--radio-voice') }
  }, [line.sp])

  /* المشغّل المتزامن: يلحق الحلقة والموضع اللذين تمليهما ساعة الكويت */
  const syncAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !playing) return
    const { item, into } = positionNow()
    if (into >= item.dur) { audio.pause(); return } /* فاصلٌ بين حلقتين — ننتظر التالية */
    if (loadedSlugRef.current !== item.slug) {
      loadedSlugRef.current = item.slug
      audio.src = versionedAudioUrl(`/audio/${item.slug}.dialogue.mp3`)
      audio.currentTime = 0
      const seek = () => { audio.currentTime = positionNow().into; audio.play().catch(() => setPlaying(false)) }
      audio.addEventListener('loadedmetadata', seek, { once: true })
      audio.load()
      return
    }
    if (audio.paused) { audio.play().catch(() => setPlaying(false)); return }
    if (Math.abs(audio.currentTime - into) > 2.5) audio.currentTime = into
  }, [playing])

  useEffect(() => { syncAudio() }, [pos, syncAudio])

  /* شاشة القفل تعرف ما يُبث */
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: pos.item.title,
      artist: 'إذاعة د. أحمد الفيلكاوي',
      album: 'بثٌّ متزامن بساعة الكويت',
    })
  }, [pos.item.title])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      setHint('')
    } else {
      setPlaying(true)
      setHint('')
      /* التشغيل من إيماءة المستخدم مباشرةً — شرط المتصفحات */
      const { item, into } = positionNow()
      loadedSlugRef.current = item.slug
      audio.src = versionedAudioUrl(`/audio/${item.slug}.dialogue.mp3`)
      const seek = () => { audio.currentTime = positionNow().into; }
      audio.addEventListener('loadedmetadata', seek, { once: true })
      audio.play().catch(() => { setPlaying(false); setHint('تعذّر التشغيل — جرّب مرة أخرى') })
    }
  }

  const ticks = useMemo(() => utterances.map((u, i) => {
    const height = Math.max(22, Math.min(100, ((u.e - u.s) / 9) * 100))
    const who = u.sp === 'نورة' ? 'radio-f' : 'radio-m'
    const state = i < line.i ? ' radio-done' : i === line.i ? ' radio-done radio-live' : ''
    return <span key={i} className={`radio-tick ${who}${state}`} style={{ height: `${height}%` }} />
  }), [utterances, line.i])

  const upcoming = useMemo(() => {
    const rows: { at: string; title: string }[] = []
    let ahead = pos.item.dur - pos.into
    for (let k = 1; k <= 3; k += 1) {
      const nx = ITEMS[(pos.idx + k) % ITEMS.length]
      rows.push({ at: kuwaitClock(new Date(Date.now() + ahead * 1000)), title: nx.title })
      ahead += nx.dur + 8
    }
    return rows
  }, [pos])

  const betweenEpisodes = pos.into >= pos.item.dur

  return (
    <div className={`radio-root${entered ? ' radio-entered' : ''}`} dir="rtl">
      <canvas ref={grainRef} className="radio-grain" aria-hidden="true" />
      <div className="radio-glow" aria-hidden="true" />
      <div className="radio-glow-live" aria-hidden="true" />
      <div className="radio-vignette" aria-hidden="true" />

      <div className="radio-stage">
        <div className="radio-onair">
          <span className="radio-pulse" aria-hidden="true" />
          <span>على الهواء · بساعة الكويت</span>
        </div>

        <div className="radio-now">
          {/* بلا أسماء — اللون وحده يميّز الصوتين */}
          <div className="radio-who">{betweenEpisodes ? 'بعد لحظات' : ''}</div>
          <p key={betweenEpisodes ? `gap-${pos.idx}` : `line-${line.i}`} className="radio-line">
            {betweenEpisodes ? ITEMS[(pos.idx + 1) % ITEMS.length].title : nameWithoutTashkeel(line.t || '…')}
          </p>
          <div className="radio-rhythm" aria-hidden="true">{ticks}</div>
          <div className="radio-meta">
            <b>{pos.item.title}</b>
            <span>· {pos.item.cat}</span>
            <time>{clock(Math.min(pos.into, pos.item.dur))} / {clock(pos.item.dur)}</time>
          </div>
        </div>

        <div className="radio-next">
          {upcoming.map((row, i) => (
            <div key={i} className={`radio-nx${i === 0 ? ' radio-first' : ''}`}>
              <time>{row.at}</time>
              <p>{row.title}</p>
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="radio-play" onClick={toggle} aria-label={playing ? 'إيقاف البثّ' : 'الاستماع للبثّ'}>
        {playing ? 'إيقاف' : 'استمع'}
      </button>
      {hint ? <div className="radio-hint">{hint}</div> : null}

      <audio ref={audioRef} preload="none" />
    </div>
  )
}
