import type { ReactNode } from 'react'
import type { EncyclopediaVideoMoment, EncyclopediaTranscriptProgress } from '../lib/encyclopedia-videos'
import type { IndexedEncyclopediaVideo } from '../lib/encyclopedia-video-index'
import { normalizeEncyclopediaText } from '../lib/encyclopedia-video-index'
import type { EncyclopediaPassageMatch, EncyclopediaSlideMatch } from '../lib/encyclopedia-knowledge-search'
import { encyclopediaSlideRangeLabel } from '../lib/encyclopedia-teaching-map'
import { ComposeScene } from './ComposeScene'
import { SocialIcon } from './icons'

const formatArabicNumber = (value: number) => new Intl.NumberFormat('ar-KW-u-nu-arab').format(value)

function formatMoment(seconds: number) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const rest = value % 60
  const text = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`
  return text
}

function fileName(value: string) {
  const clean = String(value || '').split(/[?#]/)[0]
  return clean.split('/').filter(Boolean).at(-1) || ''
}

function highlighted(text: string, query: string, extraTerms: readonly string[] = []): ReactNode {
  const source = String(text || '')
  const terms = [...new Set([query, ...extraTerms].flatMap((value) => normalizeEncyclopediaText(value).split(' ')).filter((term) => term.length > 1))]
  if (!source || !terms.length) return source
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
  const matcher = new RegExp(`(${escaped.join('|')})`, 'giu')
  return source.split(matcher).map((part, index) => terms.includes(normalizeEncyclopediaText(part))
    ? <mark key={`${part}-${index}`} className="rounded-sm bg-accent/[.15] px-0.5 text-inherit">{part}</mark>
    : part)
}

function SourceHeader({ icon, eyebrow, title }: { icon: string; eyebrow: string; title: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="text-[.62rem] font-semibold text-accent">{eyebrow}</span>
        <h3 className="mt-1 font-display text-[1rem] font-semibold leading-[1.55] text-ink">{title}</h3>
      </div>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair bg-canvas text-accent">
        <SocialIcon name={icon} size={15} />
      </span>
    </div>
  )
}

function locationLabel(moment: EncyclopediaVideoMoment | null, video: IndexedEncyclopediaVideo | null) {
  if (moment?.contentType === 'encyclopedia-introduction') return 'مادة تعريفية للموسوعة'
  const door = moment?.doorNumber || moment?.sequence?.doorNumber || video?.doorNumber
  const chapter = moment?.chapterNumber || moment?.sequence?.chapterNumber || video?.chapterNumber
  if (!door && !chapter) return ''
  return [door ? `الباب ${formatArabicNumber(door)}` : '', chapter ? `الفصل ${formatArabicNumber(chapter)}` : ''].filter(Boolean).join(' · ')
}

export function EncyclopediaKnowledgeResults({
  query,
  tab = 'all',
  status,
  moments,
  progress,
  fallbackVideos,
  videoById,
  passages,
  slides,
  playingVideoId,
  playingVideoInstance,
  selectedPlayerUrl,
  onPlay,
  onOpenTeaching,
}: {
  query: string
  tab?: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  moments: EncyclopediaVideoMoment[]
  progress: EncyclopediaTranscriptProgress | null
  fallbackVideos: IndexedEncyclopediaVideo[]
  videoById: Map<string, IndexedEncyclopediaVideo>
  passages: EncyclopediaPassageMatch[]
  slides: EncyclopediaSlideMatch[]
  playingVideoId: string
  playingVideoInstance: string
  selectedPlayerUrl: string
  onPlay: (video: IndexedEncyclopediaVideo, instanceKey: string, startSeconds?: number) => void
  onOpenTeaching: (doorId: string, topic: string) => void
}) {
  const requestedMoment = playingVideoInstance.startsWith('knowledge-')
    ? moments.find((moment) => `knowledge-${moment.videoId}-${moment.startSeconds}` === playingVideoInstance) || null
    : null
  const primaryMoment = requestedMoment || moments.find((moment) => videoById.has(moment.videoId)) || null
  const primaryVideo = primaryMoment ? videoById.get(primaryMoment.videoId) || null : fallbackVideos[0] || null
  const exactMoment = Boolean(primaryMoment?.hasExactTiming && primaryMoment.excerpt)
  const primaryPassage = passages[0] || null
  const primarySlide = slides[0] || null
  const activeInstance = primaryMoment ? `knowledge-${primaryMoment.videoId}-${primaryMoment.startSeconds}` : primaryVideo ? `knowledge-${primaryVideo.id}-0` : ''
  const isPlayingPrimary = Boolean(primaryVideo && playingVideoId === primaryVideo.id && playingVideoInstance === activeInstance)
  const visibleSourceCount = tab === 'all' ? (primarySlide ? 3 : 2) : 1
  const desktopGridClass = visibleSourceCount === 3 ? 'xl:grid-cols-3' : visibleSourceCount === 2 ? 'xl:grid-cols-2' : 'xl:grid-cols-1'
  const progressText = progress
    ? `${formatArabicNumber(progress.processed || progress.completed)} من ${formatArabicNumber(progress.total)} معالجة · ${formatArabicNumber(progress.transcribed || progress.available)} بتفريغ زمني · ${formatArabicNumber(progress.noSpeech || 0)} بلا كلام`
    : 'الفهرس الزمني لا يدّعي ثانية دقيقة من دون تفريغ محفوظ.'

  if (!query.trim()) return null

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-hair bg-canvas" aria-live="polite">
      <div className="border-b border-hair px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[.62rem] font-semibold text-accent">نتيجة معرفية موحّدة</span>
            <h2 className="mt-1 font-display text-[1.05rem] font-semibold text-ink">«{query}» داخل الفيديو والكتاب ومواد التدريس</h2>
          </div>
          <span className="rounded-full border border-hair px-3 py-1.5 text-[.58rem] text-soft">{progressText}</span>
        </div>
      </div>

      <div dir="rtl" data-horizontal-video-rail="true" className={`grid snap-x snap-mandatory auto-cols-[82vw] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:p-6 xl:grid-flow-row ${desktopGridClass} xl:auto-cols-auto xl:overflow-visible`}>
        <article className={`${tab === 'all' || tab === 'video' ? '' : 'hidden'} w-[82vw] max-w-[25rem] shrink-0 snap-start rounded-2xl border border-hair bg-wash/[.45] p-4 md:p-5 xl:w-auto xl:max-w-none`}>
          <SourceHeader icon="Play" eyebrow={exactMoment ? `من اللحظة ${formatMoment(primaryMoment?.startSeconds || 0)}` : 'الفيديو الأقرب'} title={exactMoment ? `شاهد من ${formatMoment(primaryMoment?.startSeconds || 0)}` : 'شاهد من البداية'} />
          {primaryVideo ? (
            <>
              <div className="mt-4 overflow-hidden rounded-xl border border-hair bg-ink">
                {isPlayingPrimary ? (
                  <iframe title={primaryVideo.title} src={selectedPlayerUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="aspect-video w-full" />
                ) : (
                  <button type="button" onClick={() => onPlay(primaryVideo, activeInstance, exactMoment ? primaryMoment?.startSeconds || 0 : 0)} className="group relative block aspect-video w-full text-start">
                    <img src={primaryVideo.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-75" />
                    <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas/95 text-accent shadow-lg"><SocialIcon name="Play" size={18} /></span></span>
                  </button>
                )}
              </div>
              <p className="mt-3 line-clamp-2 text-[.78rem] font-semibold leading-[1.75] text-ink">{primaryVideo.title}</p>
              {locationLabel(primaryMoment, primaryVideo) && <p className="mt-1 text-[.61rem] font-semibold text-accent">{locationLabel(primaryMoment, primaryVideo)}{primaryMoment?.chapterTitle ? ` · ${primaryMoment.chapterTitle}` : ''}</p>}
              {exactMoment ? (
                <blockquote className="mt-2 line-clamp-4 border-s-2 border-accent ps-3 text-[.68rem] leading-[1.85] text-soft">{highlighted(primaryMoment?.excerpt || '', query, primaryMoment?.matchedTerms || [])}</blockquote>
              ) : status === 'loading' ? (
                <p className="mt-2 text-[.65rem] leading-relaxed text-soft">يجري البحث داخل الفهرس الزمني الثابت.</p>
              ) : status === 'error' ? (
                <p className="mt-2 text-[.65rem] leading-relaxed text-soft">تعذّر البحث النصي الآن؛ عُرض أقرب فيديو من الفهرس دون توقيت مختلق.</p>
              ) : null}
              {(primaryPassage || primarySlide) && (
                <div className="mt-3 grid gap-1 border-t border-hair pt-3 text-[.6rem] text-soft">
                  {primaryPassage && <span>الكتاب: صفحة {formatArabicNumber(primaryPassage.page)} · {primaryPassage.chapterTitle || primaryPassage.section}</span>}
                  {primarySlide && <span>التدريس: {primarySlide.topic.title} · {encyclopediaSlideRangeLabel(primarySlide.topic.ranges)}</span>}
                </div>
              )}
            </>
          ) : <div className="mt-4 flex aspect-video items-center justify-center rounded-xl border border-hair bg-wash"><ComposeScene compact lines={[]} /></div>}
        </article>

        <article className={`${tab === 'all' || tab === 'book' ? '' : 'hidden'} w-[82vw] max-w-[25rem] shrink-0 snap-start rounded-2xl border border-hair bg-wash/[.45] p-4 md:p-5 xl:w-auto xl:max-w-none`}>
          <SourceHeader icon="Bookmark" eyebrow="من متن الكتاب" title={primaryPassage ? `صفحة ${formatArabicNumber(primaryPassage.page)}` : 'المقطع الأقرب'} />
          {primaryPassage ? (
            <>
              <p className="mt-5 line-clamp-6 text-[.76rem] leading-[1.95] text-ink/[.85]">{highlighted(primaryPassage.text, query)}</p>
              <div className="mt-4 border-t border-hair pt-3">
                <span className="line-clamp-1 text-[.62rem] text-soft">{primaryPassage.chapterTitle || primaryPassage.section || 'متن الموسوعة'}</span>
              </div>
            </>
          ) : <p className="mt-5 text-[.68rem] leading-relaxed text-soft">لا يوجد مقطع كتاب موثّق يطابق العبارة بهذه الصياغة.</p>}
        </article>

        {primarySlide && (
          <article className={`${tab === 'all' || tab === 'slides' ? '' : 'hidden'} w-[82vw] max-w-[25rem] shrink-0 snap-start rounded-2xl border border-hair bg-wash/[.45] p-4 md:p-5 xl:w-auto xl:max-w-none`}>
            <SourceHeader icon="Image" eyebrow="في مواد التدريس" title={encyclopediaSlideRangeLabel(primarySlide.topic.ranges)} />
            <p className="mt-5 text-[.82rem] font-semibold leading-[1.75] text-ink">{primarySlide.topic.title}</p>
            <p className="mt-2 line-clamp-4 text-[.68rem] leading-[1.85] text-soft">{primarySlide.topic.objective}</p>
            <div className="mt-3 grid gap-1 text-[.6rem] text-soft">
              <span>الباب {formatArabicNumber(primarySlide.doorNumber)} · {primarySlide.topic.chapter}</span>
              {primarySlide.presentation && <span dir="ltr" className="truncate text-end">{fileName(primarySlide.presentation)}</span>}
            </div>
            <div className="mt-4 flex justify-end border-t border-hair pt-3">
              <button type="button" onClick={() => onOpenTeaching(primarySlide.topic.doorId, primarySlide.topic.title)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-hair px-3 text-[.65rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><span>اعرض الشرائح</span><SocialIcon name="ArrowBack" size={13} /></button>
            </div>
          </article>
        )}
      </div>

      {moments.length > 1 && (
        <div className="border-t border-hair px-4 py-4 md:px-6">
          <span className="text-[.62rem] font-semibold text-accent">لحظات أخرى موثقة أو فيديوهات قريبة</span>
          <div dir="rtl" data-horizontal-video-rail="true" className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pe-[18vw] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {moments.slice(1, 6).map((moment) => {
              const video = videoById.get(moment.videoId)
              if (!video) return null
              const exact = Boolean(moment.hasExactTiming && moment.excerpt)
              return (
                <button key={`${moment.videoId}-${moment.startSeconds}`} type="button" onClick={() => onPlay(video, `knowledge-${moment.videoId}-${moment.startSeconds}`, exact ? moment.startSeconds : 0)} className="w-[72vw] max-w-[18rem] shrink-0 snap-start rounded-xl border border-hair bg-wash/40 p-3 text-start transition-colors hover:border-accent">
                  <div className="flex items-center gap-3">
                    <img src={video.thumbnail} alt="" loading="lazy" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0"><span className="text-[.6rem] font-semibold text-accent">{exact ? `شاهد من ${formatMoment(moment.startSeconds)}` : 'الفيديو الأقرب'}</span><strong className="mt-1 line-clamp-2 block text-[.68rem] leading-relaxed text-ink">{video.title}</strong></div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
