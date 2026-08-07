import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FadeUp, Page, Reveal } from '../components/ui'
import { useSeo } from '../components/seo'
import { useCmsContent } from '../lib/content'
import { MediaSaveButton } from '../components/MySpace'
import { mergeMediaArchive, formatMediaTime } from '../lib/media-archive'

const normalize = (value = '') => value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase()

export default function MediaDetail() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const { media: cmsMedia, loading } = useCmsContent()
  const media = useMemo(() => mergeMediaArchive(cmsMedia), [cmsMedia])
  const item = media.find((entry) => entry.slug === slug)
  const [start, setStart] = useState(() => Math.max(0, Number(params.get('t')) || 0))
  const [query, setQuery] = useState('')
  const transcript = item?.transcript || null
  const audioRef = useRef<HTMLAudioElement>(null)
  const related = useMemo(() => item ? media.filter((entry) => entry.slug !== item.slug).slice(0, 8) : [], [item, media])
  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (!q || !transcript?.segments) return transcript?.segments || []
    return transcript.segments.filter((segment) => normalize(segment.searchText || segment.displayText || segment.text).includes(q))
  }, [query, transcript])
  const isAudio = item?.kind === 'audio' || item?.kind === 'radio'
  const audioBase = (import.meta.env.VITE_MEDIA_AUDIO_BASE_URL || import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
  /* الرابط المحفوظ في اللوحة (وهو رابط تنزيل موقّع من Firebase Storage) يعلو دائماً؛
     ومجلد الاستضافة الخارجي لا يُستعمل إلا حين يُعرَّف متغيره فعلاً. */
  const hostedAudio = item?.audioFile && audioBase ? `${audioBase}/${item.audioFile.split('/').map(encodeURIComponent).join('/')}` : ''
  const audioSource = isAudio ? (item?.audioUrl || hostedAudio || item?.url || '').trim() : ''
  const player = !isAudio && item?.id ? `https://www.youtube-nocookie.com/embed/${item.id}?rel=0&start=${Math.floor(start)}` : ''
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioSource) return
    const seek = () => { audio.currentTime = Math.min(Math.max(0, start), Number.isFinite(audio.duration) ? audio.duration : start) }
    if (audio.readyState >= 1) seek()
    else audio.addEventListener('loadedmetadata', seek, { once: true })
    return () => audio.removeEventListener('loadedmetadata', seek)
  }, [audioSource, start])
  useSeo({ title: item?.title || 'ظهور إعلامي', path: `/media/${slug}`, description: item?.topics || 'مادة من الأرشيف الإعلامي.' })
  if (!item && loading) return <Page><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!item) return <Page><div className="px-6 pt-44 text-center text-soft">لم يُعثر على المادة.</div></Page>

  return <Page className="content-media page-journey">
    <article className="px-6 pb-16 pt-32 md:px-11 md:pt-40">
      <div className="mx-auto max-w-[1080px]">
        <FadeUp><Link to="/media" className="text-[.8rem] text-soft hover:text-accent">← الأرشيف الإعلامي</Link></FadeUp>
        <FadeUp delay={.04}><header className="mt-6 border-b border-hair pb-8"><div className="flex flex-wrap items-center gap-2 text-[.72rem] text-soft"><span className="font-semibold text-accent">{item.program || 'ظهور إعلامي'}</span><span>·</span><span>{item.outlet}</span>{item.date && <><span>·</span><time>{item.date}</time></>}{item.duration && <><span>·</span><span dir="ltr">{item.duration}</span></>}</div><h1 className="mt-4 font-display text-[clamp(2rem,5vw,3.4rem)] font-bold leading-[1.25] text-ink"><Reveal>{item.title}</Reveal></h1>{item.topics && <p className="mt-4 max-w-3xl text-[.86rem] leading-[1.9] text-soft">{item.topics}</p>}<div className="mt-5"><MediaSaveButton slug={item.slug} /></div></header></FadeUp>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.75fr)]">
          <FadeUp delay={.08}><section>
            {player ? <div className="overflow-hidden rounded-[1.4rem] border border-hair bg-ink shadow-[0_24px_60px_rgba(20,31,45,.12)]" style={{ aspectRatio: '16 / 9' }}><iframe key={`${item.id}-${start}`} src={player} title={item.title} allow="encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div> : audioSource ? <div className="rounded-[1.4rem] border border-hair bg-wash p-6 shadow-[0_18px_48px_rgba(20,31,45,.08)]"><span className="text-[.68rem] font-semibold text-accent">التسجيل الصوتي</span><audio ref={audioRef} controls preload="metadata" className="mt-4 w-full" src={audioSource}>متصفحك لا يدعم تشغيل الصوت.</audio></div> : <div className="rounded-[1.4rem] border border-hair bg-wash p-6 text-center"><p className="text-[.78rem] text-soft">لم يُضف ملف صوت صالح لهذه المادة بعد.</p></div>}
            {start > 0 && <div className="mt-3 flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-[.72rem]"><span className="text-ink">يبدأ العرض من <strong className="text-accent">{formatMediaTime(start)}</strong></span><button type="button" onClick={() => setStart(0)} className="text-soft hover:text-accent">من البداية</button></div>}
          </section></FadeUp>

          <FadeUp delay={.12}><aside className="rounded-[1.4rem] border border-hair bg-wash p-5"><span className="text-[.68rem] font-semibold text-accent">بطاقة الأرشيف</span><dl className="mt-4 grid gap-4 text-[.76rem]"><div><dt className="text-soft">النوع</dt><dd className="mt-1 font-semibold text-ink">{item.kind === 'audio' || item.kind === 'radio' ? 'مادة إذاعية' : 'لقاء مرئي'}</dd></div><div><dt className="text-soft">المصدر</dt><dd className="mt-1 font-semibold text-ink">{item.outlet}</dd></div>{transcript?.available && <div><dt className="text-soft">الفهرسة</dt><dd className="mt-1 font-semibold text-ink">{transcript.segmentCount} مقطعاً زمنياً</dd></div>}</dl>{item.url && !isAudio && <a href={item.url} target="_blank" rel="noreferrer" className="mt-6 block rounded-xl border border-hair bg-canvas px-4 py-3 text-center text-[.74rem] font-semibold text-accent hover:border-accent">افتح المصدر الأصلي</a>}</aside></FadeUp>
        </div>

        {transcript?.available && <FadeUp delay={.16}><section className="mt-10 rounded-[1.5rem] border border-hair bg-canvas p-5 md:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-[.68rem] font-semibold text-accent">النص الزمني</span><h2 className="mt-1 font-display text-2xl font-semibold text-ink">ابحث وانتقل إلى اللحظة</h2></div><span className="text-[.7rem] text-soft">{transcript.segmentCount} مقطعاً</span></div><div className="mt-5 rounded-xl border border-hair bg-wash px-4 py-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث داخل كلام اللقاء…" className="w-full bg-transparent text-[.82rem] text-ink outline-none placeholder:text-soft/70" /></div><div className="mt-5 max-h-[42rem] space-y-2 overflow-y-auto pr-1">{matches.map((segment) => <button key={`${segment.start}-${segment.end}`} type="button" onClick={() => { setStart(segment.start); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="group grid w-full gap-3 rounded-xl border border-transparent p-3 text-right transition hover:border-accent/30 hover:bg-wash md:grid-cols-[5rem_minmax(0,1fr)]"><span className="font-mono text-[.72rem] font-bold text-accent">{formatMediaTime(segment.start)}</span><span className="text-[.8rem] leading-[1.9] text-ink/[.85]">{segment.displayText || segment.text}</span></button>)}{!matches.length && <p className="py-8 text-center text-[.78rem] text-soft">لا توجد عبارة مطابقة داخل هذا اللقاء.</p>}</div></section></FadeUp>}

        {related.length > 0 && <FadeUp delay={.2}><section className="mt-12 border-t border-hair pt-8" aria-labelledby="media-related-title">
          <div className="flex items-end justify-between gap-4"><div><span className="text-[.68rem] font-semibold text-accent">امتداد اللقاء</span><h2 id="media-related-title" className="mt-1 font-display text-2xl font-semibold text-ink">مواد أخرى من الأرشيف</h2></div><Link to="/media" className="text-[.72rem] font-semibold text-accent">شاهد الكل ←</Link></div>
          <div dir="rtl" className="media-related-rail mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [touch-action:pan-x]">
            {related.map((entry) => <Link key={entry.slug} to={`/media/${entry.slug}`} className="w-[min(82vw,19rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-hair bg-canvas transition hover:border-accent">
              <div className="aspect-video overflow-hidden bg-wash">{entry.id && entry.kind !== 'audio' && entry.kind !== 'radio' ? <img src={entry.thumbnail || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`} alt="" loading="lazy" onLoad={(event) => { const img = event.currentTarget; if (!entry.thumbnail && img.naturalWidth <= 120 && img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`; }} onError={(event) => { const img = event.currentTarget; if (img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`; else img.style.display = 'none'; }} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl text-accent">◉</div>}</div>
              <div className="p-4"><span className="text-[.65rem] font-semibold text-accent">{entry.program || entry.outlet}</span><strong className="mt-1 line-clamp-2 block text-[.82rem] leading-[1.7] text-ink">{entry.title}</strong></div>
            </Link>)}
          </div>
        </section></FadeUp>}
      </div>
    </article>
  </Page>
}
