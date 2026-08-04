import type { EncyclopediaVideoMoment, EncyclopediaTranscriptProgress } from '../lib/encyclopedia-videos'
import type { IndexedEncyclopediaVideo } from '../lib/encyclopedia-video-index'
import type { EncyclopediaPassageMatch, EncyclopediaSlideMatch } from '../lib/encyclopedia-knowledge-search'
import { encyclopediaSlideRangeLabel } from '../lib/encyclopedia-teaching-map'
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
  return text.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function passageHref(match: EncyclopediaPassageMatch) {
  return `/files/encyclopedia.pdf#page=${Math.max(1, Math.floor(match.page || 1))}`
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

export function EncyclopediaKnowledgeResults({
  query,
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
  const exactMoment = Boolean(primaryMoment && (primaryMoment.source === 'captions' || primaryMoment.source === 'transcribed') && primaryMoment.excerpt)
  const primaryPassage = passages[0] || null
  const primarySlide = slides[0] || null
  const hasAny = Boolean(primaryVideo || primaryPassage || primarySlide)
  if (!hasAny && status !== 'loading') return null

  const completed = Number(progress?.completed) || 0
  const available = Number(progress?.available) || 0
  const total = Number(progress?.catalogued || progress?.total) || 0
  const progressLabel = status === 'loading'
    ? `نبحث الآن في ${formatArabicNumber(total || 169)} فيديو`
    : available > 0
      ? `${formatArabicNumber(available)} فيديو بتوقيت منطوق موثّق`
      : completed > 0
        ? `فُحص ${formatArabicNumber(completed)} من ${formatArabicNumber(total || completed)} فيديو`
        : `فهرس ${formatArabicNumber(total || 169)} فيديو`
  const primaryInstance = primaryVideo ? `knowledge-${primaryVideo.id}-${primaryMoment?.startSeconds || 0}` : ''
  const primaryActive = Boolean(primaryVideo && playingVideoId === primaryVideo.id && playingVideoInstance === primaryInstance)

  return (
    <section aria-live="polite" aria-label={`نتائج البحث الموحدة عن ${query}`} className="mt-7 overflow-hidden rounded-[1.6rem] border border-hair bg-canvas shadow-[0_28px_90px_-68px_rgba(20,31,45,.75)]">
      <div className="relative overflow-hidden border-b border-hair px-5 py-5 md:px-7 md:py-6">
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-24 h-52 w-52 rounded-full border border-accent/[.12]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 right-[22%] h-44 w-44 rounded-full border border-accent/[.08]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-[.63rem] font-semibold text-accent">نتيجة معرفية موحّدة</span>
            <h2 className="mt-1.5 font-display text-[clamp(1.2rem,3vw,1.65rem)] font-semibold leading-[1.5] text-ink">«{query}» بين الفيديو والكتاب والعرض</h2>
          </div>
          {total > 0 && (
            <span className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.6rem] text-soft">
              {progressLabel}
            </span>
          )}
        </div>
      </div>

      <div dir="rtl" className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-6 md:py-6 xl:grid xl:grid-cols-3 xl:overflow-visible">
        <article className="w-[82vw] max-w-[25rem] shrink-0 snap-start rounded-2xl border border-hair bg-wash/[.45] p-4 md:p-5 xl:w-auto xl:max-w-none">
          <SourceHeader icon="Play" eyebrow="داخل الكلام المنطوق" title={exactMoment ? `اللحظة ${formatMoment(primaryMoment?.startSeconds || 0)}` : 'الفيديو الأقرب'} />
          {primaryVideo ? (
            <>
              <div id={primaryInstance} className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl border border-hair bg-ink text-white">
                {primaryActive ? (
                  <iframe src={selectedPlayerUrl} title={primaryVideo.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
                ) : (
                  <button type="button" onClick={() => onPlay(primaryVideo, primaryInstance, primaryMoment?.startSeconds || 0)} className="group absolute inset-0 block h-full w-full" aria-label={exactMoment ? `تشغيل ${primaryVideo.title} من اللحظة ${formatMoment(primaryMoment?.startSeconds || 0)}` : `تشغيل ${primaryVideo.title}`}>
                    <img src={primaryVideo.thumbnail} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.02]" />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-transparent" />
                    <span aria-hidden className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/[.45]"><SocialIcon name="Play" size={17} /></span>
                    {exactMoment && <span className="absolute bottom-3 end-3 rounded-full bg-ink/75 px-3 py-1 text-[.65rem] font-semibold" dir="ltr">{formatMoment(primaryMoment?.startSeconds || 0)}</span>}
                  </button>
                )}
              </div>
              <p className="mt-3 line-clamp-2 text-[.78rem] font-semibold leading-[1.75] text-ink">{primaryVideo.title}</p>
              {exactMoment ? (
                <blockquote className="mt-2 line-clamp-3 border-s-2 border-accent ps-3 text-[.68rem] leading-[1.8] text-soft">{primaryMoment?.excerpt}</blockquote>
              ) : (
                <p className="mt-2 text-[.65rem] leading-relaxed text-soft">{status === 'loading' ? 'يجري فحص الترجمة الزمنية للوصول إلى الثانية الدقيقة.' : status === 'error' ? 'تعذّر فحص النص المنطوق الآن؛ عُرض أقرب فيديو من الفهرس من دون ادّعاء توقيت.' : 'لا يُنسب توقيت دقيق إلا بعد العثور على العبارة في النص المنطوق.'}</p>
              )}
            </>
          ) : (
            <div className="mt-4 aspect-video animate-pulse rounded-xl border border-hair bg-wash" />
          )}
        </article>

        <article className="w-[82vw] max-w-[25rem] shrink-0 snap-start rounded-2xl border border-hair bg-wash/[.45] p-4 md:p-5 xl:w-auto xl:max-w-none">
          <SourceHeader icon="Bookmark" eyebrow="من متن الكتاب" title={primaryPassage ? `صفحة ${formatArabicNumber(primaryPassage.page)}` : 'المقطع الأقرب'} />
          {primaryPassage ? (
            <>
              <p className="mt-5 line-clamp-6 text-[.76rem] leading-[1.95] text-ink/[.85]">{primaryPassage.text}</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-hair pt-3">
                <span className="line-clamp-1 text-[.62rem] text-soft">{primaryPassage.chapterTitle || primaryPassage.section || 'متن الموسوعة'}</span>
                <a href={passageHref(primaryPassage)} target="_blank" rel="noreferrer" type="application/pdf" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-hair px-3 text-[.65rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white">
                  <span>افتح صفحة {formatArabicNumber(primaryPassage.page)}</span>
                  <SocialIcon name="ArrowBack" size={13} />
                </a>
              </div>
            </>
          ) : (
            <p className="mt-5 text-[.68rem] leading-relaxed text-soft">لا يوجد مقطع نصي موثّق يطابق العبارة بهذه الصياغة.</p>
          )}
        </article>

        <article className="w-[82vw] max-w-[25rem] shrink-0 snap-start rounded-2xl border border-hair bg-wash/[.45] p-4 md:p-5 xl:w-auto xl:max-w-none">
          <SourceHeader icon="Image" eyebrow="في مواد التدريس" title={primarySlide ? encyclopediaSlideRangeLabel(primarySlide.topic.ranges) : 'المحور الأقرب'} />
          {primarySlide ? (
            <>
              <p className="mt-5 text-[.82rem] font-semibold leading-[1.75] text-ink">{primarySlide.topic.title}</p>
              <p className="mt-2 line-clamp-4 text-[.68rem] leading-[1.85] text-soft">{primarySlide.topic.objective}</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-hair pt-3">
                <span className="line-clamp-1 text-[.62rem] text-soft">الباب {formatArabicNumber(primarySlide.doorNumber)} · {primarySlide.topic.chapter}</span>
                <button type="button" onClick={() => onOpenTeaching(primarySlide.topic.doorId, primarySlide.topic.title)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-hair px-3 text-[.65rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white">
                  <span>اعرض الشرائح</span>
                  <SocialIcon name="ArrowBack" size={13} />
                </button>
              </div>
            </>
          ) : (
            <p className="mt-5 text-[.68rem] leading-relaxed text-soft">لا يرتبط هذا البحث بمحور في العروض الأربعة حالياً.</p>
          )}
        </article>
      </div>

      {moments.length > 1 && (
        <div className="border-t border-hair px-4 py-4 md:px-6">
          <span className="text-[.62rem] font-semibold text-accent">لحظات أخرى داخل الفيديوهات</span>
          <div dir="rtl" className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {moments.slice(1, 6).map((moment) => {
              const video = videoById.get(moment.videoId)
              if (!video) return null
              const exact = (moment.source === 'captions' || moment.source === 'transcribed') && Boolean(moment.excerpt)
              return (
                <button key={`${moment.videoId}-${moment.startSeconds}`} type="button" onClick={() => onPlay(video, `knowledge-${moment.videoId}-${moment.startSeconds}`, moment.startSeconds)} className="w-[72vw] max-w-[18rem] shrink-0 snap-start rounded-xl border border-hair bg-wash/40 p-3 text-start transition-colors hover:border-accent">
                  <div className="flex items-center gap-3">
                    <img src={video.thumbnail} alt="" loading="lazy" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <span className="text-[.6rem] font-semibold text-accent">{exact ? formatMoment(moment.startSeconds) : 'من البداية'}</span>
                      <strong className="mt-1 line-clamp-2 block text-[.68rem] leading-relaxed text-ink">{video.title}</strong>
                    </div>
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
