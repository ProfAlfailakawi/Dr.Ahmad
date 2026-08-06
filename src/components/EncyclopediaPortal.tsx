import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { getBookKnowledge, type BookKnowledgeConcept } from '../lib/book-knowledge'
import structureData from '../data/encyclopedia-structure.json'
import {
  getEncyclopediaFallbackCatalog,
  getEncyclopediaVideoCatalog,
  resetEncyclopediaVideoCatalog,
  searchEncyclopediaVideoMoments,
  type EncyclopediaVideoCatalog,
  type EncyclopediaVideoMoment,
  type EncyclopediaTranscriptProgress,
} from '../lib/encyclopedia-videos'
import { searchEncyclopediaKnowledge } from '../lib/encyclopedia-knowledge-search'
import {
  encyclopediaSlideCount,
  encyclopediaSlideRangeLabel,
  encyclopediaTeachingTopics,
  getEncyclopediaTeachingDoor,
  getEncyclopediaTeachingTopic,
  type EncyclopediaTeachingTopic,
} from '../lib/encyclopedia-teaching-map'
import {
  encyclopediaTokens,
  encyclopediaSearchTokens,
  extractEncyclopediaSequence,
  indexEncyclopediaVideos,
  normalizeEncyclopediaText,
  scoreIndexedVideo,
  type IndexedEncyclopediaVideo,
} from '../lib/encyclopedia-video-index'
import { FadeUp, Reveal } from './ui'
import { SocialIcon } from './icons'
import { ClarifiedIconAction } from './ClarifiedIconAction'
import { OwnerEdit } from './extras'
import { EncyclopediaKnowledgeResults } from './EncyclopediaKnowledgeResults'
import { normalizeSearchQuery, trackUsage } from '../lib/usage-analytics'

const CHANNEL_URL = 'https://www.youtube.com/@موسوعةتكنولوجياالتعليم/videos'
const ENCYCLOPEDIA_SAMPLE_PDF = '/files/encyclopedia.pdf?v=20260803-4'
const FEATURED_PINNED_VIDEO_IDS = ['emisZzaICy8', 'JtSaEiD0rzQ'] as const
const FEATURED_ROTATING_COUNT = 10
const MANUAL_VIDEO_PLACEMENTS: Record<string, { doorNumber: number; chapterNumber: number }> = {
  // فيديو «خصائص نمط التدريب والمران»
  pSIVIgPsD9g: { doorNumber: 2, chapterNumber: 4 },
  // فيديو «نبذة تاريخية عن الإنترنت»
  '8u5a5WQ_RGA': { doorNumber: 2, chapterNumber: 2 },
}
const formatArabicNumber = (value: number) => new Intl.NumberFormat('ar-KW-u-nu-arab').format(value)

type StructureUnit = {
  number: number
  title: string
  pageStart: number
  keywords: string[]
}

type Door = {
  id: string
  doorNumber: number
  number: string
  title: string
  summary: string
  presentation?: string
  hints: string[]
  unitsLabel: string
  units: StructureUnit[]
  topics: string[]
}

type TeachingMaterialSelection = { door: Door; topic?: string }
type UnitVideoMap = Map<string, IndexedEncyclopediaVideo[]>

const DOORS: Door[] = structureData.doors.map((door) => ({
  ...door,
  presentation: 'presentation' in door ? door.presentation : undefined,
  topics: door.units.flatMap((unit) => [unit.title, ...unit.keywords]),
}))

const PRESENTATION_DOORS = DOORS.filter((door) => Boolean(door.presentation))

function scoreText(tokens: readonly string[], value = '') {
  const normalized = normalizeEncyclopediaText(value)
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? (token.length >= 6 ? 3 : 2) : 0), 0)
}

function conceptForText(value: string, concepts: BookKnowledgeConcept[]) {
  const tokens = encyclopediaTokens(value)
  return concepts
    .map((concept) => ({ concept, score: scoreText(tokens, `${concept.title} ${concept.keywords.join(' ')} ${concept.summary} ${concept.question}`) }))
    .sort((left, right) => right.score - left.score)[0]?.concept || null
}

function relatedVideoForText(value: string, videos: IndexedEncyclopediaVideo[], door?: Door, chapterNumber?: number) {
  const tokens = encyclopediaTokens(value)
  const candidates = videos.filter((video) => {
    if (door && video.doorId !== door.id) return false
    if (chapterNumber && video.chapterNumber !== chapterNumber) return false
    return true
  })
  return candidates
    .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
    .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
    .find((item) => item.score > 0)?.video || null
}

const unitVideoKey = (doorId: string, unitNumber: number) => `${doorId}:${unitNumber}`

const GENERIC_VIDEO_TERMS = new Set([
  'التعليم', 'التعلم', 'التدريس', 'التكنولوجيا', 'تقنيه', 'تقنيه التعليم', 'تكنولوجيا التعليم',
  'شرح', 'موسوعه', 'فيديو', 'مقطع', 'الطالب', 'المعلم',
].map(normalizeEncyclopediaText))

function directUnitEvidence(video: IndexedEncyclopediaVideo, door: Door, unit: StructureUnit) {
  // نختبر النص الأصلي للفيديو فقط. لا نستخدم searchText لأنه يحتوي كلمات الفصل
  // التي أضافها المفهرس بعد الربط، وإلا أصبح القرار يؤكد نفسه بنفسه.
  const haystack = normalizeEncyclopediaText(`${video.title} ${video.description}`)
  const normalizedTitle = normalizeEncyclopediaText(unit.title)
  const exactTitle = Boolean(normalizedTitle && haystack.includes(normalizedTitle))
  const matchedKeywords = unit.keywords
    .map(normalizeEncyclopediaText)
    .filter((keyword) => keyword.length >= 4 && !GENERIC_VIDEO_TERMS.has(keyword) && haystack.includes(keyword))
  const distinctivePhrases = matchedKeywords.filter((keyword) => keyword.includes(' ') || keyword.length >= 7)
  const doorTitle = normalizeEncyclopediaText(door.title)

  let score = exactTitle ? 80 : 0
  if (doorTitle && haystack.includes(doorTitle)) score += 12
  for (const keyword of matchedKeywords) score += keyword.includes(' ') ? 14 : Math.min(10, 4 + Math.floor(keyword.length / 2))

  return {
    score,
    exactTitle,
    matchedKeywords,
    direct: exactTitle || distinctivePhrases.length >= 1 || matchedKeywords.length >= 2,
  }
}

function linkedVideo(video: IndexedEncyclopediaVideo, door: Door, unit: StructureUnit) {
  const parts = [`الباب ${door.doorNumber}`, `الفصل ${unit.number}`]
  if (video.videoNumber) parts.push(`المقطع ${video.videoNumber}`)
  return {
    ...video,
    doorId: door.id,
    doorNumber: door.doorNumber,
    chapterNumber: unit.number,
    chapterTitle: unit.title,
    sequenceLabel: parts.join(' · '),
  }
}

function appendUnitVideo(map: UnitVideoMap, video: IndexedEncyclopediaVideo, door: Door, unit: StructureUnit) {
  const key = unitVideoKey(door.id, unit.number)
  map.set(key, [...(map.get(key) || []), linkedVideo(video, door, unit)])
}

function buildStrictUnitVideoMap(videos: IndexedEncyclopediaVideo[], doors: Door[]): UnitVideoMap {
  const doorByNumber = new Map(doors.map((door) => [door.doorNumber, door]))
  const assignedVideoIds = new Set<string>()
  const map: UnitVideoMap = new Map()

  // إسنادات اعتمدها المؤلف يدوياً بعد مراجعة الصورة المصغّرة ومحتوى الفيديو.
  // تسبق أي تخمين آلي حتى تبقى هذه المقاطع في فصلها الصحيح دائماً.
  for (const video of videos) {
    const placement = MANUAL_VIDEO_PLACEMENTS[video.id]
    if (!placement) continue
    const door = doorByNumber.get(placement.doorNumber)
    const unit = door?.units.find((item) => item.number === placement.chapterNumber)
    if (!door || !unit) continue
    appendUnitVideo(map, video, door, unit)
    assignedVideoIds.add(video.id)
  }

  // المرحلة الأولى: الخادم يقرأ القوائم التشغيلية وعناوين القناة ويعيد
  // إسناداً موثقاً. هذا هو المصدر الأعلى أولوية ولا يعاد تخمينه في المتصفح.
  for (const video of videos) {
    if (!video.mappingSource || !video.doorNumber || !video.chapterNumber) continue
    const door = doorByNumber.get(video.doorNumber)
    const unit = door?.units.find((item) => item.number === video.chapterNumber)
    if (!door || !unit || assignedVideoIds.has(video.id)) continue
    appendUnitVideo(map, video, door, unit)
    assignedVideoIds.add(video.id)
  }

  // المرحلة الثانية: التسلسل الصريح المكتوب في عنوان أو وصف الفيديو.
  for (const video of videos) {
    if (assignedVideoIds.has(video.id)) continue
    const sequence = extractEncyclopediaSequence(`${video.title} ${video.description || ''}`)
    if (!sequence.doorNumber || !sequence.chapterNumber) continue
    const door = doorByNumber.get(sequence.doorNumber)
    const unit = door?.units.find((item) => item.number === sequence.chapterNumber)
    if (!door || !unit) continue
    appendUnitVideo(map, video, door, unit)
    assignedVideoIds.add(video.id)
  }

  // المرحلة الثالثة: بعض فيديوهات القناة عنوانها هو الموضوع نفسه بلا عبارة «باب/فصل».
  // نقبلها فقط عند وجود تطابق موضوعي مباشر وفائز وحيد؛ لا يوجد أي فيديو احتياطي.
  for (const video of videos) {
    if (assignedVideoIds.has(video.id)) continue
    const sequence = extractEncyclopediaSequence(video.title)
    const candidateDoors = sequence.doorNumber ? [doorByNumber.get(sequence.doorNumber)].filter(Boolean) as Door[] : doors
    const candidates = candidateDoors.flatMap((door) => door.units
      .filter((unit) => !sequence.chapterNumber || unit.number === sequence.chapterNumber)
      .map((unit) => ({ door, unit, ...directUnitEvidence(video, door, unit) })))
      .filter((candidate) => candidate.direct && candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.door.doorNumber - right.door.doorNumber || left.unit.number - right.unit.number)

    const best = candidates[0]
    const second = candidates[1]
    if (!best) continue

    // العنوان الكامل يكفي وحده. أما الكلمات المفتاحية فتحتاج درجة قوية وفارقاً
    // واضحاً عن أقرب فصل آخر حتى لا يتحول الربط إلى تخمين.
    const minimumScore = sequence.doorNumber ? 10 : 14
    const minimumMargin = best.exactTitle ? 0 : 6
    if (best.score < minimumScore || (second && best.score - second.score < minimumMargin)) continue

    appendUnitVideo(map, video, best.door, best.unit)
    assignedVideoIds.add(video.id)
  }

  // المرحلة الرابعة: الاستعانة بالتصنيف المجهز مسبقاً في الفهرس لأي فيديو له باب وفصل
  for (const video of videos) {
    if (assignedVideoIds.has(video.id)) continue
    if (!video.doorNumber || !video.chapterNumber) continue
    const door = doorByNumber.get(video.doorNumber)
    const unit = door?.units.find((item) => item.number === video.chapterNumber)
    if (!door || !unit) continue
    appendUnitVideo(map, video, door, unit)
    assignedVideoIds.add(video.id)
  }

  return map
}

function videosForUnit(door: Door, unit: StructureUnit, videoMap: UnitVideoMap) {
  return videoMap.get(unitVideoKey(door.id, unit.number)) || []
}

function InlineVideoCard({
  video,
  active,
  playerUrl,
  onPlay,
  instanceKey,
  featured = false,
}: {
  video: IndexedEncyclopediaVideo
  active: boolean
  playerUrl: string
  onPlay: (video: IndexedEncyclopediaVideo, instanceKey: string) => void
  instanceKey: string
  featured?: boolean
}) {
  return (
    <article
      id={instanceKey}
      data-video-id={video.id}
      data-featured-card={featured ? 'true' : undefined}
      className={`group w-[76vw] max-w-[19rem] shrink-0 snap-start overflow-hidden rounded-2xl border bg-canvas transition-colors sm:w-[20rem] sm:max-w-[20rem] md:w-[22rem] md:max-w-[22rem] ${active ? 'border-accent' : 'border-hair hover:border-accent'}`}
    >
      <div className="relative aspect-video overflow-hidden bg-ink">
        {active ? (
          <iframe
            src={playerUrl}
            title={video.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button type="button" onClick={() => onPlay(video, instanceKey)} className="absolute inset-0 block h-full w-full" aria-label={`تشغيل ${video.title} داخل الموقع`}>
            <img src={video.thumbnail} alt="" loading="lazy" decoding="async" width="480" height="270" onLoad={(event) => { const image = event.currentTarget; if (image.naturalWidth <= 160 && /ytimg\.com/u.test(image.src)) image.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg` }} onError={(event) => { const image = event.currentTarget; const fallback = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`; if (image.src !== fallback) image.src = fallback }} className="h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0 bg-ink/10" />
            <span aria-hidden className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/40 text-white"><SocialIcon name="Play" size={19} /></span>
          </button>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 text-[.64rem] font-semibold text-accent">
          <span>{video.chapterTitle || video.sequenceLabel || 'الموسوعة المرئية'}</span>
          {video.durationText && <span dir="ltr" className="font-normal text-soft">{video.durationText}</span>}
        </div>
        <h4 className="mt-2 line-clamp-2 text-[.86rem] font-semibold leading-[1.75] text-ink">{video.title}</h4>
      </div>
    </article>
  )
}

function UnitVideoCarousel({
  unitVideos,
  playingVideoId,
  playingVideoInstance,
  selectedPlayerUrl,
  onPlay,
  instancePrefix,
}: {
  unitVideos: IndexedEncyclopediaVideo[]
  playingVideoId: string
  playingVideoInstance: string
  selectedPlayerUrl: string
  onPlay: (video: IndexedEncyclopediaVideo, instanceKey: string) => void
  instancePrefix: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const rail = scrollRef.current
    if (!rail) return
    rail.scrollTo({ left: 0, behavior: 'auto' })
  }, [instancePrefix])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const offset = direction === 'left' ? -320 : 320
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <div className="relative mt-3">
      {unitVideos.length > 1 && (
        <div className="mb-2.5 flex items-center justify-between text-[.66rem] font-semibold">
          <span className="text-accent">
            {formatArabicNumber(unitVideos.length)} مقاطع فيديو داخل هذا الفصل
          </span>
          <div className="flex items-center gap-1.5" dir="ltr">
            <button
              type="button"
              onClick={() => scroll('right')}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-hair bg-canvas text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
              aria-label="التنقل لليمين بين الفيديوهات"
              title="التنقل لليمين"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scroll('left')}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-hair bg-canvas text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
              aria-label="التنقل لليسار بين الفيديوهات"
              title="التنقل لليسار"
            >
              ›
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        dir="rtl"
        data-horizontal-video-rail="true"
        className="-mx-1 flex gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {unitVideos.map((video) => {
          const instanceKey = `${instancePrefix}-${video.id}`
          return (
            <InlineVideoCard
              key={video.id}
              video={video}
              instanceKey={instanceKey}
              active={playingVideoId === video.id && playingVideoInstance === instanceKey}
              playerUrl={playingVideoId === video.id && playingVideoInstance === instanceKey ? selectedPlayerUrl : ''}
              onPlay={onPlay}
            />
          )
        })}
      </div>
    </div>
  )
}

function DoorRow({
  door,
  concepts,
  videoMap,
  query,
  isOpen,
  playingVideoId,
  playingVideoInstance,
  selectedPlayerUrl,
  onPlay,
  onOpenPath,
  onOpenTeaching,
  onToggle,
}: {
  door: Door
  concepts: BookKnowledgeConcept[]
  videoMap: UnitVideoMap
  query: string
  isOpen: boolean
  playingVideoId: string
  playingVideoInstance: string
  selectedPlayerUrl: string
  onPlay: (video: IndexedEncyclopediaVideo, instanceKey: string) => void
  onOpenPath: (door: Door, unit?: StructureUnit) => void
  onOpenTeaching: (door: Door, topic?: string) => void
  onToggle: () => void
}) {
  const summaryRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isOpen) return
    const frame = window.requestAnimationFrame(() => {
      contentRef.current?.querySelectorAll<HTMLElement>('[data-horizontal-video-rail="true"]').forEach((rail) => {
        // في RTL تكون نقطة البداية الطبيعية عند الصفر في Safari/Chrome الحديث.
        // إعادة الضبط عند فتح الباب تمنع وراثة موضع باب سبق تصفحه.
        rail.scrollLeft = 0
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isOpen])

  const tokens = useMemo(() => encyclopediaSearchTokens(query), [query])
  const doorVideos = useMemo(
    () => door.units.flatMap((unit) => videosForUnit(door, unit, videoMap)),
    [door, videoMap],
  )
  const visibleUnits = useMemo(() => {
    if (!tokens.length) return door.units
    return door.units.filter((unit) => {
      const unitVideos = videosForUnit(door, unit, videoMap)
      return scoreText(tokens, `${door.title} ${unit.title} ${unit.keywords.join(' ')}`) > 0 || unitVideos.some((video) => scoreIndexedVideo(tokens, video) > 0)
    })
  }, [door, tokens, videoMap])
  const doorMatches = !tokens.length || visibleUnits.length > 0 || scoreText(tokens, `${door.title} ${door.summary}`) > 0

  if (!doorMatches) return null

  return (
    <details open={isOpen} id={door.id} className="group scroll-mt-24 border-b border-hair last:border-b-0">
      <summary ref={summaryRef} onClick={(event) => {
        event.preventDefault()
        onToggle()
      }} className="grid cursor-pointer list-none grid-cols-[2.6rem_minmax(0,1fr)_auto] items-start gap-4 py-6 marker:hidden [&::-webkit-details-marker]:hidden md:grid-cols-[3.2rem_minmax(0,1fr)_auto] md:py-7">
        <span className="font-display text-[.72rem] font-semibold text-accent">{door.number}</span>
        <span className="min-w-0">
          <span className="flex items-start gap-2">
            <strong className="block min-w-0 font-display text-[1.12rem] font-semibold leading-[1.55] text-ink md:text-[1.28rem]">{door.title}</strong>
            {door.presentation && (
              <ClarifiedIconAction id="encyclopedia-door-materials" label="مواد التدريس المرتبطة بهذا الباب">
                <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenTeaching(door) }} aria-label={`مواد الباب: ${door.title}`} title="مواد الباب" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white">
                  <SocialIcon name="Image" size={15} />
                </button>
              </ClarifiedIconAction>
            )}
          </span>
          <span className="mt-1 block text-[.69rem] leading-relaxed text-soft">
            {formatArabicNumber(door.units.length)} فصول · {doorVideos.length > 0 ? `${formatArabicNumber(doorVideos.length)} فيديو` : 'عروض ومواد تدريسية'}
          </span>
        </span>
        <span aria-hidden className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
      </summary>

      <div ref={contentRef} className="min-w-0 pb-8 ps-[4.2rem] md:ps-[5.6rem]">
        <div className="border-y border-hair" aria-label="فهرس فيديوهات الموسوعة">
          {visibleUnits.map((unit) => {
            const unitVideos = videosForUnit(door, unit, videoMap)
            const hasTeaching = Boolean(door.presentation && getEncyclopediaTeachingTopic(door.id, unit.title))
            return (
              <section key={`${door.id}-${unit.number}`} className="border-b border-hair py-5 last:border-b-0" aria-labelledby={`${door.id}-unit-${unit.number}`}>
                <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-start gap-3">
                  <span className="font-display text-[.64rem] text-accent">{formatArabicNumber(unit.number)}</span>
                  <div className="min-w-0">
                    <h3 id={`${door.id}-unit-${unit.number}`} className="text-[.82rem] font-semibold leading-[1.75] text-ink">{unit.title}</h3>
                    <span className="mt-0.5 block text-[.62rem] text-soft">ص {formatArabicNumber(unit.pageStart)}</span>
                  </div>
                  <div className="flex min-h-9 items-start justify-end">
                    {unitVideos.length > 0 ? (
                      <button type="button" onClick={() => onOpenPath(door, unit)} aria-label={`شاهد الشرح: ${unit.title}`} title="شاهد الشرح" className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white">
                        <SocialIcon name="Play" size={14} />
                      </button>
                    ) : hasTeaching ? (
                      <button type="button" onClick={() => onOpenTeaching(door, unit.title)} aria-label={`مواد التدريس: ${unit.title}`} title="مواد التدريس" className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white">
                        <SocialIcon name="Image" size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>

                {unitVideos.length > 0 && (
                  <UnitVideoCarousel
                    unitVideos={unitVideos}
                    playingVideoId={playingVideoId}
                    playingVideoInstance={playingVideoInstance}
                    selectedPlayerUrl={selectedPlayerUrl}
                    onPlay={onPlay}
                    instancePrefix={`unit-${door.id}-${unit.number}`}
                  />
                )}
              </section>
            )
          })}
        </div>
      </div>
    </details>
  )
}

export function EncyclopediaPortal({ book, articles: _articles, papers: _papers }: { book: BookRecord; articles: ArticleRecord[]; papers: PaperRecord[] }) {
  const knowledge = getBookKnowledge(book.slug)
  const concepts = useMemo(() => knowledge?.concepts.filter((concept) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)/u.test(concept.title)) || [], [knowledge])
  const [catalog, setCatalog] = useState<EncyclopediaVideoCatalog | null>(() => getEncyclopediaFallbackCatalog())
  const [catalogError, setCatalogError] = useState(false)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const initialParams = useMemo(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search), [])
  const [query, setQuery] = useState(() => initialParams.get('q') || '')
  const [resultTab, setResultTab] = useState(() => initialParams.get('tab') || 'all')
  const searchStartedAt = useRef(0)
  const lastTrackedQuery = useRef('')
  const [playingVideoId, setPlayingVideoId] = useState('')
  const [playingVideoInstance, setPlayingVideoInstance] = useState('')
  const [teachingMaterial, setTeachingMaterial] = useState<TeachingMaterialSelection | null>(null)
  const [openDoorId, setOpenDoorId] = useState('')
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [featuredRound, setFeaturedRound] = useState(0)
  const [featuredPaused, setFeaturedPaused] = useState(false)
  const [featuredInView, setFeaturedInView] = useState(false)
  const [playingStartSeconds, setPlayingStartSeconds] = useState(0)
  const [userInitiatedPlayback, setUserInitiatedPlayback] = useState(false)
  const [spokenMoments, setSpokenMoments] = useState<EncyclopediaVideoMoment[]>([])
  const [spokenProgress, setSpokenProgress] = useState<EncyclopediaTranscriptProgress | null>(null)
  const [spokenStatus, setSpokenStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const pendingDoorAnchor = useRef<{ id: string; top: number } | null>(null)

  const updateDeepLink = (changes: Record<string, string | number | null>, mode: 'push' | 'replace' = 'replace') => {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === 0 || value === 'all') url.searchParams.delete(key)
      else url.searchParams.set(key, String(value))
    }
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search)
      setQuery(params.get('q') || '')
      setResultTab(params.get('tab') || 'all')
      const videoId = params.get('video') || ''
      const seconds = Math.max(0, Number(params.get('t') || 0) || 0)
      if (videoId) { setPlayingVideoId(videoId); setPlayingVideoInstance(`deep-${videoId}`); setPlayingStartSeconds(seconds); setUserInitiatedPlayback(false) }
      else { setPlayingVideoId(''); setPlayingVideoInstance(''); setPlayingStartSeconds(0) }
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  useLayoutEffect(() => {
    const pending = pendingDoorAnchor.current
    if (!pending) return
    pendingDoorAnchor.current = null
    const target = document.getElementById(pending.id)
    if (!target) return
    const delta = target.getBoundingClientRect().top - pending.top
    if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, behavior: 'auto' })
  }, [openDoorId])

  useEffect(() => {
    const controller = new AbortController()
    setCatalogError(false)
    getEncyclopediaVideoCatalog(controller.signal)
      .then(setCatalog)
      .catch((error) => {
        if ((error as { name?: string })?.name !== 'AbortError') setCatalogError(true)
      })
    return () => controller.abort()
  }, [catalogAttempt])

  useEffect(() => {
    const cleanQuery = query.trim()
    if (cleanQuery.length < 2) {
      setSpokenMoments([])
      setSpokenProgress(null)
      setSpokenStatus('idle')
      return
    }
    const controller = new AbortController()
    setSpokenMoments([])
    setSpokenStatus('loading')
    const timer = window.setTimeout(() => {
      searchEncyclopediaVideoMoments(cleanQuery, { limit: 8, signal: controller.signal })
        .then((result) => {
          setSpokenMoments(result.moments)
          setSpokenProgress(result.progress)
          setSpokenStatus('ready')
        })
        .catch((error) => {
          if ((error as { name?: string })?.name === 'AbortError') return
          setSpokenMoments([])
          setSpokenStatus('error')
        })
    }, 420)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    if (!teachingMaterial) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTeachingMaterial(null) }
    document.body.style.overflow = 'hidden'
    document.body.classList.add('encyclopedia-sheet-open')
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('encyclopedia-sheet-open')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [teachingMaterial])

  const indexedVideos = useMemo(() => indexEncyclopediaVideos(catalog?.videos || [], DOORS, concepts), [catalog, concepts])
  const unitVideoMap = useMemo(() => buildStrictUnitVideoMap(indexedVideos, DOORS), [indexedVideos])
  const mappedVideos = useMemo(
    () => DOORS.flatMap((door) => door.units.flatMap((unit) => videosForUnit(door, unit, unitVideoMap))),
    [unitVideoMap],
  )
  const supplementalVideos = useMemo(() => {
    const mappedIds = new Set(mappedVideos.map((video) => video.id))
    return indexedVideos.filter((video) => !mappedIds.has(video.id))
  }, [indexedVideos, mappedVideos])
  const visibleVideos = useMemo(() => [...mappedVideos, ...supplementalVideos], [mappedVideos, supplementalVideos])

  const pinnedFeaturedVideos = useMemo(() => {
    const byId = new Map(visibleVideos.map((video) => [video.id, video]))
    return FEATURED_PINNED_VIDEO_IDS.map((id) => byId.get(id)).filter(Boolean) as IndexedEncyclopediaVideo[]
  }, [visibleVideos])

  const featuredRest = useMemo(() => {
    const pinned = new Set(FEATURED_PINNED_VIDEO_IDS)
    return visibleVideos.filter((video) => !pinned.has(video.id as typeof FEATURED_PINNED_VIDEO_IDS[number]))
  }, [visibleVideos])

  const featuredVideos = useMemo(() => {
    if (!featuredRest.length) return pinnedFeaturedVideos
    const count = Math.min(FEATURED_ROTATING_COUNT, featuredRest.length)
    const start = (featuredRound * count) % featuredRest.length
    const rotating = Array.from({ length: count }, (_, index) => featuredRest[(start + index) % featuredRest.length])
    return [...pinnedFeaturedVideos, ...rotating]
  }, [featuredRest, featuredRound, pinnedFeaturedVideos])

  useEffect(() => {
    if (playingVideoId && !visibleVideos.some((video) => video.id === playingVideoId)) {
      setPlayingVideoId('')
      setPlayingVideoInstance('')
      setPlayingStartSeconds(0)
    }
  }, [playingVideoId, visibleVideos])

  const playingVideo = visibleVideos.find((video) => video.id === playingVideoId) || null
  const selectedPlayerUrl = playingVideo
    ? `${playingVideo.embedUrl}${playingVideo.embedUrl.includes('?') ? '&' : '?'}autoplay=${userInitiatedPlayback ? '1' : '0'}&playsinline=1&rel=0&modestbranding=1${playingStartSeconds > 0 ? `&start=${Math.floor(playingStartSeconds)}` : ''}`
    : ''
  const tokens = useMemo(() => encyclopediaSearchTokens(query), [query])

  const searchResults = useMemo(() => ({
    units: DOORS.flatMap((door) => door.units.map((unit) => ({ door, unit, score: scoreText(tokens, `${door.title} ${unit.title} ${unit.keywords.join(' ')}`) })))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score),
    videos: visibleVideos
      .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.video.position - right.video.position),
  }), [tokens, visibleVideos])

  const knowledgeContext = useMemo(() => {
    const exact = spokenMoments.find((moment) => moment.hasExactTiming && moment.excerpt)
    return exact ? {
      transcriptExcerpt: exact.excerpt,
      doorNumber: exact.doorNumber || exact.sequence.doorNumber,
      chapterNumber: exact.chapterNumber || exact.sequence.chapterNumber,
    } : {}
  }, [spokenMoments])
  const knowledgeResults = useMemo(
    () => searchEncyclopediaKnowledge(query, { passageLimit: 6, slideLimit: 6, context: knowledgeContext }),
    [knowledgeContext, query],
  )
  const videoById = useMemo(() => new Map(visibleVideos.map((video) => [video.id, video])), [visibleVideos])
  const knowledgeFallbackVideos = useMemo(
    () => searchResults.videos.slice(0, 6).map((item) => item.video),
    [searchResults.videos],
  )

  const resultCount = query.trim().length >= 2
    ? searchResults.units.length + searchResults.videos.length + knowledgeResults.passages.length + knowledgeResults.slides.length
    : 0

  useEffect(() => {
    if (query.trim().length >= 2) setOpenDoorId('')
  }, [query])

  useEffect(() => {
    if (!playingVideoInstance.startsWith('unit-')) return
    if (!playingVideo?.doorId) return
    if (!openDoorId || playingVideo.doorId !== openDoorId) {
      setPlayingVideoId('')
      setPlayingVideoInstance('')
      setPlayingStartSeconds(0)
    }
  }, [openDoorId, playingVideo?.doorId, playingVideoInstance])

  useEffect(() => {
    if (!playingVideoInstance.startsWith('knowledge-')) return
    setPlayingVideoId('')
    setPlayingVideoInstance('')
    setPlayingStartSeconds(0)
  }, [query])

  const playVideo = (video: IndexedEncyclopediaVideo, instanceKey: string, startSeconds = 0) => {
    // الرابط يحفظ النتيجة والتوقيت، لكن التشغيل يبقى بإجراء صريح من المستخدم.
    setPlayingVideoId(video.id)
    setUserInitiatedPlayback(true)
    updateDeepLink({ q: query.trim(), tab: resultTab, video: video.id, t: Math.max(0, Math.floor(startSeconds)), result: video.id }, 'push')
    trackUsage('search_result_opened', { searchType: 'encyclopedia', query: normalizeSearchQuery(query), resultType: 'video', resultId: video.id, timeToResultMs: searchStartedAt.current ? Date.now() - searchStartedAt.current : 0 })
    setPlayingVideoInstance(instanceKey)
    setPlayingStartSeconds(Math.max(0, Math.floor(startSeconds)))
  }

  const playKnowledgeMoment = (video: IndexedEncyclopediaVideo, instanceKey: string, startSeconds = 0) => {
    playVideo(video, instanceKey, startSeconds)
  }

  const openVideoPath = (door: Door, unit?: StructureUnit) => {
    const targetUnit = unit || door.units.find((item) => videosForUnit(door, item, unitVideoMap).length > 0)
    if (!targetUnit) return
    const video = videosForUnit(door, targetUnit, unitVideoMap)[0]
    if (video) playVideo(video, `unit-${door.id}-${targetUnit.number}-${video.id}`)
  }

  const openTeachingMaterials = (door: Door, topic?: string) => {
    if (!door.presentation) return
    setTeachingMaterial({ door, topic })
  }

  const openTeachingFromSearch = (doorId: string, topic: string) => {
    const door = DOORS.find((item) => item.id === doorId)
    if (door?.presentation) setTeachingMaterial({ door, topic })
  }


  const retryCatalog = () => {
    resetEncyclopediaVideoCatalog()
    setCatalog(getEncyclopediaFallbackCatalog())
    setCatalogError(false)
    setCatalogAttempt((value) => value + 1)
  }

  const teachingDoorGuide = teachingMaterial ? getEncyclopediaTeachingDoor(teachingMaterial.door.id) : null
  const teachingGuide: EncyclopediaTeachingTopic | null = teachingMaterial
    ? getEncyclopediaTeachingTopic(teachingMaterial.door.id, teachingMaterial.topic)
      || teachingDoorGuide?.topics[0]
      || null
    : null
  const teachingVideo = teachingMaterial && teachingGuide
    ? relatedVideoForText(`${teachingGuide.title} ${teachingGuide.videoHints.join(' ')}`, visibleVideos, teachingMaterial.door, teachingGuide.chapterNumbers[0])
    : null
  const teachingSlideLabel = teachingGuide ? encyclopediaSlideRangeLabel(teachingGuide.ranges) : ''
  const teachingSlidesCount = teachingGuide ? encyclopediaSlideCount(teachingGuide.ranges) : 0

  const featuredScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = featuredScrollRef.current
    if (!container || query.trim()) {
      setFeaturedInView(false)
      return
    }
    if (typeof window.IntersectionObserver !== 'function') {
      setFeaturedInView(true)
      return
    }
    const observer = new window.IntersectionObserver(
      ([entry]) => setFeaturedInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.15)),
      { threshold: [0, 0.15, 0.5] },
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [featuredVideos.length, query])

  const moveFeatured = (direction: 1 | -1) => {
    if (!featuredVideos.length) return
    setFeaturedIndex((current) => {
      const next = current + direction
      if (next >= 0 && next < featuredVideos.length) return next
      if (direction > 0) setFeaturedRound((round) => round + 1)
      return direction > 0 ? 0 : featuredVideos.length - 1
    })
  }

  useEffect(() => {
    if (featuredVideos.length < 2 || playingVideoId || featuredPaused || !featuredInView || query.trim()) return
    const timer = window.setInterval(() => moveFeatured(1), 7000)
    return () => window.clearInterval(timer)
  }, [featuredInView, featuredPaused, featuredVideos.length, playingVideoId, query])

  useEffect(() => {
    if (!featuredVideos.length) return
    const container = featuredScrollRef.current
    const cards = container?.querySelectorAll<HTMLElement>('[data-featured-card="true"]')
    const card = cards?.[Math.min(featuredIndex, Math.max(0, cards.length - 1))]
    if (!container || !card) return

    // نحرك شريط البطاقات أفقياً فقط؛ Safari قد يغيّر موضع الصفحة عند تحريك العنصر نفسه.
    // تبدّل الكرت تلقائياً بينما يكون القارئ داخل أبواب الموسوعة أسفل الصفحة.
    // نحرك شريط «أبرز الشروحات» أفقياً فقط ونبقي موضع القراءة ثابتاً تماماً.
    const containerBox = container.getBoundingClientRect()
    const cardBox = card.getBoundingClientRect()
    const isRtl = window.getComputedStyle(container).direction === 'rtl'
    const delta = isRtl ? cardBox.right - containerBox.right : cardBox.left - containerBox.left
    if (Math.abs(delta) < 1) return
    container.scrollBy({ left: delta, behavior: 'smooth' })
  }, [featuredIndex, featuredVideos])

  useEffect(() => {
    if (featuredIndex < featuredVideos.length) return
    setFeaturedIndex(0)
  }, [featuredIndex, featuredVideos.length])

  return (
    <>
      <section className="px-6 pb-14 pt-28 md:px-11 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-shell">
          <FadeUp><Link to="/publications" className="text-[.8rem] text-soft transition-colors hover:text-accent">← كل المؤلفات</Link></FadeUp>

          <div className="mt-8 grid items-start gap-9 lg:grid-cols-[minmax(15rem,.58fr)_minmax(0,1.42fr)] lg:gap-16">
            <FadeUp delay={0.04}>
              <div className="mx-auto w-full max-w-[18rem] overflow-hidden rounded-2xl border border-hair bg-white shadow-[0_24px_70px_-48px_rgba(20,31,45,.55)] lg:mx-0">
                <img src={book.cover} alt={`غلاف كتاب ${book.title}`} width="1024" height="720" fetchPriority="high" decoding="async" className="w-full" />
              </div>
            </FadeUp>

            <FadeUp delay={0.08}>
              <div>
                <span className="sr-only">بوابة معرفية مستقلة</span>
                <span className="text-[.72rem] font-semibold text-accent">كتاب منشور</span>
                <h1 className="mt-3 max-w-4xl font-display text-[clamp(2.1rem,5vw,3.8rem)] font-bold leading-[1.2] text-ink"><Reveal>{book.title}</Reveal></h1>
                {book.coAuthors && <p className="mt-3 text-[.84rem] text-soft">بالاشتراك مع {book.coAuthors}</p>}
                <OwnerEdit tab="books" slug={book.slug} className="mt-3" />
                {book.desc && <p className="mt-5 max-w-3xl text-[.96rem] font-light leading-[1.9] text-ink/80">{book.desc}</p>}

                <dl className="mt-7 grid grid-cols-2 gap-2.5 border-t border-hair pt-5 md:gap-3">
                  {[
                    ['سنة النشر', book.year],
                    ['الطبعة', book.edition],
                    ['الناشر', book.publisher],
                    ['عدد الصفحات', book.pageCount],
                    ['ISBN / ردمك', book.isbn],
                  ].map(([label, value]) => (
                    <div key={label} className={`min-w-0 rounded-2xl border border-hair bg-wash px-3.5 py-3 md:px-4 ${label === 'ISBN / ردمك' ? 'col-span-2' : ''}`}>
                      <dt className="text-[.66rem] leading-relaxed text-soft">{label}</dt>
                      <dd dir={label === 'ISBN / ردمك' ? 'ltr' : undefined} className={`mt-1 break-words text-[.82rem] font-medium leading-relaxed ${label === 'ISBN / ردمك' ? 'text-left tabular-nums' : ''} ${value ? 'text-ink' : 'text-soft/[.65]'}`}>{value || 'غير موثّق بعد'}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link to={`/publications/${book.slug}#ask-book-section`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[.78rem] font-semibold text-white transition-colors hover:bg-accent-deep">
                    <SocialIcon name="Search" size={16} />
                    <span>ابحث في هذا الكتاب</span>
                  </Link>
                  {book.pdf && (
                    <a
                      href={ENCYCLOPEDIA_SAMPLE_PDF}
                      target="_blank"
                      rel="noreferrer"
                      type="application/pdf"
                      aria-label="عرض عيّنة موسوعة تكنولوجيا التعليم بصيغة PDF في المتصفح"
                      className="inline-flex min-h-11 items-center gap-3 rounded-full border border-hair px-5 text-[.78rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      <span>عرض عيّنة الكتاب</span>
                      <span className="text-[.72rem] text-soft">PDF</span>
                    </a>
                  )}
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      <section id="encyclopedia-map" aria-label="خريطة الموسوعة" className="scroll-mt-24 border-y border-hair px-6 py-12 md:px-11 md:py-16" aria-labelledby="encyclopedia-map-title">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <h2 id="encyclopedia-map-title" className="font-display text-[clamp(1.25rem,3vw,1.7rem)] font-semibold leading-[1.4] text-ink">الموسوعة المرئية</h2>
              </div>
              <div className="flex items-center gap-2">
                {catalogError && <button type="button" onClick={retryCatalog} aria-label="إعادة تحميل فهرس الفيديوهات" title="إعادة التحميل" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="History" size={15} /></button>}
                <a href={CHANNEL_URL} target="_blank" rel="noreferrer" aria-label="فتح قناة الموسوعة على يوتيوب" title="قناة الموسوعة" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="YouTube" size={16} /></a>
              </div>
            </div>

            <div id="encyclopedia-search" className="mt-6 flex items-center gap-2 rounded-full border border-hair bg-canvas p-1.5">
              <label htmlFor="encyclopedia-query" className="sr-only">ابحث في موسوعة تكنولوجيا التعليم</label>
              <input id="encyclopedia-query" value={query} onChange={(event) => { const value = event.target.value; setQuery(value); searchStartedAt.current ||= Date.now() }} onKeyDown={(event) => { if (event.key === 'Enter') { const clean = normalizeSearchQuery(query); updateDeepLink({ q: clean, tab: resultTab }, 'push'); if (clean && clean !== lastTrackedQuery.current) { trackUsage(lastTrackedQuery.current ? 'search_refined' : 'search_submitted', { searchType: 'encyclopedia', query: clean }); lastTrackedQuery.current = clean } } }} placeholder="ابحث في فيديو أو صفحة أو شريحة" dir="rtl" className="w-0 min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[clamp(.66rem,3.05vw,.82rem)] text-ink outline-none placeholder:text-soft/[.6] sm:px-4" />
              {query ? <button type="button" onClick={() => { setQuery(''); setResultTab('all'); updateDeepLink({ q: null, tab: null, video: null, t: null, result: null }, 'push') }} aria-label="مسح البحث" title="مسح البحث" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-soft hover:text-accent"><SocialIcon name="Close" size={13} /></button> : <span aria-label="ابحث في الموسوعة" title="ابحث في الموسوعة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"><SocialIcon name="Search" size={15} /></span>}
            </div>
            {query.trim().length >= 2 && <p className="mt-2 text-[.64rem] text-soft">{resultCount ? `${formatArabicNumber(resultCount)} نتيجة مرتبطة` : 'لا توجد نتيجة مطابقة.'}</p>}
          </FadeUp>

          {query.trim().length >= 2 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {['all','video','book','slides','chapters'].map((value) => <button key={value} type="button" onClick={() => { setResultTab(value); updateDeepLink({ q: query.trim(), tab: value }, 'push') }} className={`rounded-full border px-3 py-1.5 text-[.68rem] ${resultTab === value ? 'border-accent bg-accent text-white' : 'border-hair text-soft'}`}>{({all:'الكل',video:'الفيديو',book:'الكتاب',slides:'الشرائح',chapters:'الأبواب والفصول'} as Record<string,string>)[value]}</button>)}
              <button type="button" onClick={async () => { const url = window.location.href; try { if (navigator.share) await navigator.share({ title: 'بحث موسوعة تكنولوجيا التعليم', url }); else await navigator.clipboard.writeText(url) } catch { await navigator.clipboard?.writeText(url).catch(() => undefined) } }} className="rounded-full border border-hair px-3 py-1.5 text-[.68rem] text-accent">مشاركة الرابط</button>
            </div>
          )}
          {query.trim().length >= 2 && (
            <EncyclopediaKnowledgeResults
              query={query.trim()}
              tab={resultTab}
              status={spokenStatus}
              moments={spokenMoments}
              progress={spokenProgress}
              fallbackVideos={knowledgeFallbackVideos}
              videoById={videoById}
              passages={knowledgeResults.passages}
              slides={knowledgeResults.slides}
              playingVideoId={playingVideoId}
              playingVideoInstance={playingVideoInstance}
              selectedPlayerUrl={selectedPlayerUrl}
              onPlay={playKnowledgeMoment}
              onOpenTeaching={openTeachingFromSearch}
            />
          )}

          {!query.trim() && visibleVideos.length > 0 && (
            <div className="mt-7 rounded-2xl border border-hair bg-wash/40 p-4 md:p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="font-display text-[.95rem] font-semibold text-ink">أبرز الشروحات المرئية</h3>
                <div className="flex items-center gap-1.5" dir="ltr">
                  <button
                    type="button"
                    onClick={() => moveFeatured(-1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-hair bg-canvas text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
                    aria-label="التنقل لليمين بين الشروحات المرئية"
                    title="التنقل لليمين"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFeatured(1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-hair bg-canvas text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
                    aria-label="التنقل لليسار بين الشروحات المرئية"
                    title="التنقل لليسار"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div
                ref={featuredScrollRef}
                dir="rtl"
                data-horizontal-video-rail="true"
                onPointerDown={() => setFeaturedPaused(true)}
                onPointerUp={() => window.setTimeout(() => setFeaturedPaused(false), 3500)}
                onPointerCancel={() => setFeaturedPaused(false)}
                onMouseEnter={() => setFeaturedPaused(true)}
                onMouseLeave={() => setFeaturedPaused(false)}
                className="-mx-1 flex gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {featuredVideos.map((video) => (
                  <InlineVideoCard
                    key={`featured-${video.id}`}
                    video={video}
                    instanceKey={`featured-${video.id}`}
                    active={playingVideoId === video.id && playingVideoInstance === `featured-${video.id}`}
                    playerUrl={playingVideoId === video.id && playingVideoInstance === `featured-${video.id}` ? selectedPlayerUrl : ''}
                    onPlay={playVideo}
                    featured
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 border-y border-hair">
            {DOORS.map((door) => (
              <DoorRow
                key={door.id}
                door={door}
                concepts={concepts}
                videoMap={unitVideoMap}
                query={query}
                isOpen={openDoorId === door.id}
                playingVideoId={playingVideoId}
                playingVideoInstance={playingVideoInstance}
                selectedPlayerUrl={selectedPlayerUrl}
                onPlay={playVideo}
                onOpenPath={openVideoPath}
                onOpenTeaching={openTeachingMaterials}
                onToggle={() => {
                  const target = document.getElementById(door.id)
                  pendingDoorAnchor.current = { id: door.id, top: target?.getBoundingClientRect().top ?? 0 }
                  setOpenDoorId((current) => current === door.id ? '' : door.id)
                }}
              />
            ))}
          </div>

          {!catalog && !catalogError && <p className="mt-4 text-[.65rem] text-soft">تُحمّل الفيديوهات بهدوء.</p>}
          {catalog && visibleVideos.length > 0 && <span className="sr-only">جميع فيديوهات الفهرس ظاهرة داخل الموسوعة.</span>}
          {catalog && visibleVideos.length === 0 && <p role="alert" className="mt-4 text-[.68rem] text-red-700">وصلت فيديوهات القناة، لكن خريطة القوائم التشغيلية لم تصل. استخدم زر إعادة التحميل أعلاه.</p>}
          {catalogError && <p role="alert" className="mt-4 text-[.68rem] text-red-700">تعذّر تحميل فيديوهات الموسوعة الآن. استخدم زر إعادة التحميل أعلاه.</p>}
        </div>
      </section>

      <section id="encyclopedia-teaching-kit" className="scroll-mt-24 px-6 py-10 md:px-11 md:py-14">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <details className="group overflow-hidden rounded-2xl border border-hair bg-canvas">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 md:px-7">
                <span>
                  <span className="block font-display text-xl font-semibold text-ink">مواد التدريس</span>
                </span>
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-hair px-5 md:px-7">
                {PRESENTATION_DOORS.map((door) => {
                  const teachingDoor = getEncyclopediaTeachingDoor(door.id)
                  return (
                    <div key={`kit-${door.id}`} className="grid gap-3 border-b border-hair py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <span className="text-[.63rem] font-semibold text-accent">الباب {door.number}</span>
                        <strong className="mt-1 block text-[.82rem] leading-relaxed text-ink">{door.title}</strong>
                        {teachingDoor && <span className="mt-1 block text-[.64rem] text-soft">{formatArabicNumber(teachingDoor.slideCount)} شريحة</span>}
                      </div>
                      <button type="button" onClick={() => openTeachingMaterials(door)} className="inline-flex min-h-10 w-fit items-center rounded-full border border-hair px-4 text-[.68rem] font-semibold text-accent transition-colors hover:border-accent">مواد الباب</button>
                    </div>
                  )
                })}
              </div>
            </details>
          </FadeUp>
        </div>
      </section>

      {teachingMaterial && (
        <div className="encyclopedia-teaching-overlay fixed inset-0 z-[260] flex items-end justify-center bg-ink/[.28] backdrop-blur-[2px] md:items-stretch md:justify-end" onMouseDown={(event) => { if (event.currentTarget === event.target) setTeachingMaterial(null) }}>
          <aside role="dialog" aria-modal="true" aria-labelledby="encyclopedia-teaching-panel-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border-t border-hair bg-canvas px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-24px_70px_-48px_rgba(20,31,45,.7)] md:h-full md:max-h-none md:max-w-[28rem] md:rounded-none md:border-s md:border-t-0 md:px-8 md:pb-8 md:pt-7">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hair md:hidden" aria-hidden />
            <div className="flex items-start justify-between gap-5 border-b border-hair pb-5">
              <div className="min-w-0">
                <span className="text-[.66rem] font-semibold text-accent">مواد التدريس</span>
                <h2 id="encyclopedia-teaching-panel-title" className="mt-1.5 font-display text-[1.3rem] font-semibold leading-[1.55] text-ink">{teachingGuide?.title || teachingMaterial.door.title}</h2>
                <p className="mt-1 text-[.68rem] text-soft">{teachingGuide?.chapter || teachingMaterial.door.title}</p>
              </div>
              <button type="button" onClick={() => setTeachingMaterial(null)} aria-label="إغلاق مواد التدريس" title="إغلاق" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-soft hover:border-accent hover:text-accent"><SocialIcon name="Close" size={13} /></button>
            </div>

            {teachingGuide && (
              <>
                <p className="border-b border-hair py-5 text-[.75rem] leading-[1.85] text-ink/80">{teachingGuide.objective}</p>
                <div className="py-5">
                  <span className="text-[.63rem] font-semibold text-soft">خيط المادة</span>
                  <div className="mt-3 grid grid-cols-2 border-y border-hair">
                    <span className="min-w-0 border-e border-hair px-2 py-4 text-center text-[.68rem] text-soft">المحور المرتبط</span>
                    <button type="button" disabled={!teachingVideo} onClick={() => {
                      if (!teachingVideo) return
                      setTeachingMaterial(null)
                      if (teachingVideo.doorId) setOpenDoorId(teachingVideo.doorId)
                      const instanceKey = teachingVideo.doorId && teachingVideo.chapterNumber
                        ? `unit-${teachingVideo.doorId}-${teachingVideo.chapterNumber}-${teachingVideo.id}`
                        : `featured-${teachingVideo.id}`
                      window.setTimeout(() => playVideo(teachingVideo, instanceKey), 80)
                    }} className="min-w-0 px-2 py-4 text-center text-[.68rem] font-semibold text-accent disabled:opacity-40">شاهد الشرح</button>
                  </div>
                </div>
                <div className="border-y border-hair py-5">
                  <div className="flex items-center justify-between gap-5">
                    <div className="min-w-0">
                      <span className="text-[.63rem] font-semibold text-accent">موضع الموضوع في العرض</span>
                      <p className="mt-1.5 font-display text-[1rem] font-semibold leading-[1.7] text-ink">{teachingSlideLabel}</p>
                      <p className="mt-1 text-[.65rem] text-soft">{formatArabicNumber(teachingSlidesCount)} شريحة مرتبطة.</p>
                    </div>
                    <a href={teachingMaterial.door.presentation} download={`موسوعة تكنولوجيا التعليم - الباب ${teachingMaterial.door.number}.pptx`} aria-label="تحميل عرض الباب" title="تحميل عرض الباب" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/[.3] text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="Download" size={16} /></a>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
