import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { EncyclopediaVideoMoment } from '../lib/encyclopedia-videos'
import type { IndexedEncyclopediaVideo } from '../lib/encyclopedia-video-index'
import type { EncyclopediaPassageMatch, EncyclopediaSlideMatch } from '../lib/encyclopedia-knowledge-search'
import { encyclopediaSlideRangeLabel } from '../lib/encyclopedia-teaching-map'
import { SocialIcon } from './icons'

/**
 * استعراض كل النتائج، لا أفضلَها وحدها.
 *
 * المحرّك كان يحسب أكثر مما تعرض الواجهة، فيقرأ الزائر «٢٤ نتيجة» ولا يستطيع
 * بلوغ إلا أربع. هنا يُلغى هذا الفرق: العدد المعلن هو العدد القابل للاستعراض.
 *
 * الأداء: لا يُحمّل فيديو ولا شريحة — بياناتٌ وصفية فقط، وكشفٌ تدريجي بدل
 * إخراج القائمة كاملةً دفعةً واحدة.
 */

export type BrowserTab = 'all' | 'video' | 'book' | 'slides' | 'chapters'

export type UnitMatch = {
  door: { id: string; title: string; doorNumber?: number }
  unit: { number: number; title: string; keywords: string[] }
  score: number
}

const PAGE_SIZE = 6
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

function Row({ eyebrow, title, meta, note, icon, onOpen, thumbnail }: {
  eyebrow: string
  title: string
  meta: string[]
  note?: string
  icon: string
  onOpen?: () => void
  thumbnail?: string
}) {
  const shell = `flex w-full items-start gap-3 rounded-xl border border-hair bg-canvas p-3 text-start transition-colors${onOpen ? ' hover:border-accent' : ''}`
  const inner = (
    <>
      {thumbnail
        ? <img src={thumbnail} alt="" loading="lazy" width={96} height={54} className="h-[3.4rem] w-24 shrink-0 rounded-lg object-cover" />
        : <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent"><SocialIcon name={icon} size={14} /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[.6rem] font-semibold text-accent">{eyebrow}</span>
        <strong className="mt-0.5 line-clamp-2 block text-[.76rem] font-semibold leading-[1.7] text-ink">{title}</strong>
        {meta.length > 0 && <span className="mt-1 block text-[.62rem] text-soft">{meta.filter(Boolean).join(' · ')}</span>}
        {note && <span className="mt-1 line-clamp-2 block text-[.64rem] leading-[1.8] text-soft">{note}</span>}
      </span>
    </>
  )
  return onOpen
    ? <button type="button" onClick={onOpen} className={shell}>{inner}</button>
    : <div className={shell}>{inner}</div>
}

function Group({ id, title, count, children, empty }: {
  id: string
  title: string
  count: number
  children: ReactNode
  empty: string
}) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  /* تبديل عبارة البحث يعيد الكشف إلى بدايته؛ تبديل التبويب لا يعيد البحث. */
  useEffect(() => { setVisible(PAGE_SIZE) }, [id])
  const items = (Array.isArray(children) ? (children as ReactNode[]).flat(2) : [children]).filter(Boolean)
  const shown = items.slice(0, visible)
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[.78rem] font-semibold text-ink">{title}</h3>
        <span className="text-[.62rem] text-soft">{count ? `${formatArabicNumber(count)} نتيجة` : 'لا نتيجة'}</span>
      </div>
      {count ? (
        <>
          {/* ارتفاعٌ محجوز مسبقاً للصف حتى لا يقفز التخطيط عند الكشف. */}
          <div className="grid gap-2">{shown}</div>
          {visible < items.length && (
            <button
              type="button"
              onClick={() => setVisible((current) => current + PAGE_SIZE)}
              className="justify-self-start rounded-full border border-hair px-4 py-1.5 text-[.68rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
            >
              عرض المزيد ({formatArabicNumber(items.length - visible)})
            </button>
          )}
        </>
      ) : <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-center text-[.7rem] text-soft">{empty}</p>}
    </section>
  )
}

export function EncyclopediaResultBrowser({
  query, tab, videos, moments, passages, slides, units, videoById, onPlay, onOpenTeaching, onOpenDoor,
}: {
  query: string
  tab: BrowserTab | string
  videos: { video: IndexedEncyclopediaVideo; score: number }[]
  moments: EncyclopediaVideoMoment[]
  passages: EncyclopediaPassageMatch[]
  slides: EncyclopediaSlideMatch[]
  units: UnitMatch[]
  videoById: Map<string, IndexedEncyclopediaVideo>
  onPlay: (video: IndexedEncyclopediaVideo, instanceKey: string, startSeconds?: number) => void
  onOpenTeaching: (doorId: string, topic: string) => void
  onOpenDoor: (doorId: string) => void
}) {
  /* اللحظات الموثّقة تُعرض داخل الفيديو — أوضح من تبويبٍ مستقل لها. */
  const exactMoments = useMemo(
    () => moments.filter((moment) => moment.hasExactTiming && moment.excerpt && videoById.has(moment.videoId)),
    [moments, videoById],
  )
  const key = `${query}:${tab}`
  if (query.trim().length < 2) return null

  const showAll = tab === 'all'
  const total = videos.length + exactMoments.length + passages.length + slides.length + units.length
  if (!total) {
    return (
      <div className="mt-6 rounded-2xl border border-hair bg-canvas px-5 py-8 text-center">
        <p className="text-[.82rem] font-semibold text-ink">لا نتيجة مطابقة لـ«{query}».</p>
        <p className="mt-1.5 text-[.72rem] leading-relaxed text-soft">جرّب مصطلحاً أعمّ، أو ابحث باسم الباب أو الفصل.</p>
      </div>
    )
  }

  return (
    <div className="mt-6 grid gap-7 rounded-2xl border border-hair bg-wash/[.35] p-4 md:p-6">
      {(showAll || tab === 'video') && (
        <Group id={`${key}-moments`} title="لحظات موثّقة داخل الفيديو" count={exactMoments.length} empty="لا لحظة بتفريغٍ زمنيّ محفوظ لهذه العبارة.">
          {exactMoments.map((moment) => {
            const video = videoById.get(moment.videoId)
            if (!video) return null
            return (
              <Row
                key={`${moment.videoId}-${moment.startSeconds}`}
                eyebrow={`من اللحظة ${formatMoment(moment.startSeconds)}`}
                title={video.title}
                thumbnail={video.thumbnail}
                icon="Play"
                meta={[
                  moment.doorNumber ? `الباب ${formatArabicNumber(moment.doorNumber)}` : '',
                  moment.chapterTitle || '',
                  video.durationText,
                ]}
                note={moment.excerpt}
                onOpen={() => onPlay(video, `browse-${moment.videoId}-${moment.startSeconds}`, moment.startSeconds)}
              />
            )
          })}
        </Group>
      )}

      {(showAll || tab === 'video') && (
        <Group id={`${key}-videos`} title="فيديوهات مطابقة" count={videos.length} empty="لا فيديو يطابق هذه العبارة في الفهرس.">
          {videos.map(({ video }) => (
            <Row
              key={video.id}
              eyebrow={video.sequenceLabel || 'الموسوعة المرئية'}
              title={video.title}
              thumbnail={video.thumbnail}
              icon="Play"
              meta={[
                video.doorNumber ? `الباب ${formatArabicNumber(video.doorNumber)}` : '',
                video.chapterTitle || '',
                video.durationText,
              ]}
              onOpen={() => onPlay(video, `browse-${video.id}`, 0)}
            />
          ))}
        </Group>
      )}

      {(showAll || tab === 'book') && (
        <Group id={`${key}-passages`} title="مقاطع من متن الكتاب" count={passages.length} empty="لا مقطع موثّق في المتن بهذه الصياغة.">
          {passages.map((passage) => (
            <Row
              key={passage.id}
              eyebrow={passage.page ? `صفحة ${formatArabicNumber(passage.page)}` : 'متن الموسوعة'}
              title={passage.conceptTitle || passage.chapterTitle || passage.section || 'مقطع من المتن'}
              icon="Bookmark"
              meta={[
                passage.doorNumber ? `الباب ${formatArabicNumber(passage.doorNumber)}` : '',
                passage.chapterTitle || '',
                passage.matchReason,
              ]}
              note={passage.text}
            />
          ))}
        </Group>
      )}

      {(showAll || tab === 'slides') && (
        <Group id={`${key}-slides`} title="محاور في مواد التدريس" count={slides.length} empty="لا محور تدريسيّ مرتبط بهذه العبارة.">
          {slides.map((slide) => (
            <Row
              key={`${slide.topic.doorId}-${slide.topic.title}`}
              eyebrow={encyclopediaSlideRangeLabel(slide.topic.ranges) || 'مادة تدريس'}
              title={slide.topic.title}
              icon="Image"
              meta={[
                slide.doorNumber ? `الباب ${formatArabicNumber(slide.doorNumber)}` : '',
                slide.topic.chapter,
                slide.presentation ? 'عرض متاح' : 'بلا معاينة',
              ]}
              note={slide.topic.objective}
              onOpen={() => onOpenTeaching(slide.topic.doorId, slide.topic.title)}
            />
          ))}
        </Group>
      )}

      {(showAll || tab === 'chapters') && (
        <Group id={`${key}-units`} title="أبوابٌ وفصول" count={units.length} empty="لا باب ولا فصل يطابق العبارة.">
          {units.map(({ door, unit }) => (
            <Row
              key={`${door.id}-${unit.number}`}
              eyebrow={door.doorNumber ? `الباب ${formatArabicNumber(door.doorNumber)}` : door.title}
              title={unit.title}
              icon="Bookmark"
              meta={[door.title, `الفصل ${formatArabicNumber(unit.number)}`, unit.keywords.slice(0, 3).join('، ')]}
              onOpen={() => onOpenDoor(door.id)}
            />
          ))}
        </Group>
      )}
    </div>
  )
}
