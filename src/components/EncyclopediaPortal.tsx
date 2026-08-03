import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { bookKnowledgeAnchor, getBookKnowledge, type BookKnowledgeConcept } from '../lib/book-knowledge'
import structureData from '../data/encyclopedia-structure.json'
import {
  getEncyclopediaVideoCatalog,
  resetEncyclopediaVideoCatalog,
  type EncyclopediaVideoCatalog,
} from '../lib/encyclopedia-videos'
import {
  encyclopediaSlideCount,
  encyclopediaSlideRangeLabel,
  encyclopediaTeachingTopics,
  getEncyclopediaTeachingDoor,
  getEncyclopediaTeachingTopic,
  scoreEncyclopediaTeachingTopic,
  type EncyclopediaTeachingTopic,
} from '../lib/encyclopedia-teaching-map'
import {
  encyclopediaTokens,
  extractEncyclopediaSequence,
  indexEncyclopediaVideos,
  normalizeEncyclopediaText,
  scoreIndexedVideo,
  type IndexedEncyclopediaVideo,
} from '../lib/encyclopedia-video-index'
import { FadeUp, Reveal } from './ui'
import { SocialIcon } from './icons'
import { OwnerEdit } from './extras'

const CHANNEL_URL = 'https://www.youtube.com/@موسوعةتكنولوجياالتعليم/videos'
const ENCYCLOPEDIA_SAMPLE_PDF = '/files/encyclopedia.pdf?v=20260803-4'
const ENCYCLOPEDIA_SAMPLE_FILENAME = 'موسوعة-تكنولوجيا-التعليم-المقدمة-والفهرس.pdf'
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
}: {
  video: IndexedEncyclopediaVideo
  active: boolean
  playerUrl: string
  onPlay: (video: IndexedEncyclopediaVideo) => void
}) {
  return (
    <article id={`video-${video.id}`} className={`group w-[82vw] max-w-[22rem] shrink-0 snap-start overflow-hidden rounded-2xl border bg-canvas transition-colors ${active ? 'border-accent' : 'border-hair hover:border-accent'}`}>
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
          <button type="button" onClick={() => onPlay(video)} className="absolute inset-0 block h-full w-full" aria-label={`تشغيل ${video.title} داخل الموقع`}>
            <img src={video.thumbnail} alt="" loading="lazy" decoding="async" width="480" height="270" className="h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0 bg-ink/10" />
            <span aria-hidden className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/40 text-white"><SocialIcon name="Play" size={19} /></span>
          </button>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 text-[.64rem] font-semibold text-accent">
          <span>{video.sequenceLabel || 'الموسوعة المرئية'}</span>
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
  selectedPlayerUrl,
  onPlay,
}: {
  unitVideos: IndexedEncyclopediaVideo[]
  playingVideoId: string
  selectedPlayerUrl: string
  onPlay: (video: IndexedEncyclopediaVideo) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

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
              aria-label="التنقل لليصار بين الفيديوهات"
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
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:none] [touch-action:pan-x_pinch-zoom] [&::-webkit-scrollbar]:hidden"
      >
        {unitVideos.map((video) => (
          <InlineVideoCard
            key={video.id}
            video={video}
            active={playingVideoId === video.id}
            playerUrl={playingVideoId === video.id ? selectedPlayerUrl : ''}
            onPlay={onPlay}
          />
        ))}
      </div>
    </div>
  )
}

function DoorRow({
  door,
  concepts,
  videoMap,
  query,
  initiallyOpen,
  playingVideoId,
  selectedPlayerUrl,
  onPlay,
  onOpenPath,
  onOpenTeaching,
}: {
  door: Door
  concepts: BookKnowledgeConcept[]
  videoMap: UnitVideoMap
  query: string
  initiallyOpen: boolean
  playingVideoId: string
  selectedPlayerUrl: string
  onPlay: (video: IndexedEncyclopediaVideo) => void
  onOpenPath: (door: Door, unit?: StructureUnit) => void
  onOpenTeaching: (door: Door, topic?: string) => void
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const tokens = useMemo(() => encyclopediaTokens(query), [query])
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
  const doorConcept = conceptForText(`${door.title} ${door.hints.join(' ')}`, concepts)
  const bookHref = doorConcept ? `/publications/encyclopedia?book_idea=${encodeURIComponent(doorConcept.title)}#book-knowledge` : '#book-knowledge'

  useEffect(() => {
    if (initiallyOpen && detailsRef.current) detailsRef.current.open = true
    if (tokens.length && doorMatches && detailsRef.current) detailsRef.current.open = true
  }, [doorMatches, initiallyOpen, tokens.length])

  if (!doorMatches) return null

  return (
    <details ref={detailsRef} id={door.id} className="group scroll-mt-24 border-b border-hair last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-[2.6rem_minmax(0,1fr)_auto] items-start gap-4 py-6 marker:hidden [&::-webkit-details-marker]:hidden md:grid-cols-[3.2rem_minmax(0,1fr)_auto] md:py-7">
        <span className="font-display text-[.72rem] font-semibold text-accent">{door.number}</span>
        <span className="min-w-0">
          <strong className="block font-display text-[1.12rem] font-semibold leading-[1.55] text-ink md:text-[1.28rem]">{door.title}</strong>
          <span className="mt-1 block text-[.69rem] leading-relaxed text-soft">
            {formatArabicNumber(door.units.length)} فصول · {doorVideos.length > 0 ? `${formatArabicNumber(doorVideos.length)} فيديو` : 'عروض ومواد تدريسية'}
          </span>
        </span>
        <span aria-hidden className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
      </summary>

      <div className="pb-8 ps-[4.2rem] md:ps-[5.6rem]">
        <div className="border-y border-hair" aria-label="فهرس فيديوهات الموسوعة">
          {visibleUnits.map((unit) => {
            const unitVideos = videosForUnit(door, unit, videoMap)
            const concept = conceptForText(`${unit.title} ${unit.keywords.join(' ')}`, concepts)
            const hasTeaching = Boolean(door.presentation && getEncyclopediaTeachingTopic(door.id, unit.title))
            return (
              <section key={`${door.id}-${unit.number}`} className="border-b border-hair py-5 last:border-b-0" aria-labelledby={`${door.id}-unit-${unit.number}`}>
                <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3">
                  <span className="font-display text-[.64rem] text-accent">{formatArabicNumber(unit.number)}</span>
                  <div className="min-w-0">
                    <h3 id={`${door.id}-unit-${unit.number}`} className="text-[.82rem] font-semibold leading-[1.75] text-ink">{unit.title}</h3>
                    <span className="mt-0.5 block text-[.62rem] text-soft">ص {formatArabicNumber(unit.pageStart)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[.64rem] font-semibold">
                    {unitVideos.length > 0 && <button type="button" onClick={() => onOpenPath(door, unit)} className="text-accent transition-opacity hover:opacity-65">شاهد الشرح</button>}
                    {concept && <Link to={`/publications/encyclopedia?book_idea=${encodeURIComponent(concept.title)}#${bookKnowledgeAnchor(concept)}`} className="text-soft transition-colors hover:text-accent">اقرأ</Link>}
                    {hasTeaching && <button type="button" onClick={() => onOpenTeaching(door, unit.title)} className="text-soft transition-colors hover:text-accent">مواد التدريس</button>}
                  </div>
                </div>

                {unitVideos.length > 0 && (
                  <UnitVideoCarousel
                    unitVideos={unitVideos}
                    playingVideoId={playingVideoId}
                    selectedPlayerUrl={selectedPlayerUrl}
                    onPlay={onPlay}
                  />
                )}
              </section>
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[.67rem] font-semibold">
          <Link to={bookHref} className="text-ink transition-colors hover:text-accent">اقرأ من الباب</Link>
          {door.presentation && <button type="button" onClick={() => onOpenTeaching(door)} className="text-accent">مواد الباب</button>}
        </div>
      </div>
    </details>
  )
}

export function EncyclopediaPortal({ book, articles: _articles, papers: _papers }: { book: BookRecord; articles: ArticleRecord[]; papers: PaperRecord[] }) {
  const knowledge = getBookKnowledge(book.slug)
  const concepts = useMemo(() => knowledge?.concepts.filter((concept) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)/u.test(concept.title)) || [], [knowledge])
  const [catalog, setCatalog] = useState<EncyclopediaVideoCatalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [playingVideoId, setPlayingVideoId] = useState('')
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [teachingMaterial, setTeachingMaterial] = useState<TeachingMaterialSelection | null>(null)

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

  useEffect(() => {
    if (playingVideoId && !mappedVideos.some((video) => video.id === playingVideoId)) setPlayingVideoId('')
  }, [mappedVideos, playingVideoId])

  const playingVideo = mappedVideos.find((video) => video.id === playingVideoId) || null
  const selectedPlayerUrl = playingVideo
    ? `${playingVideo.embedUrl}${playingVideo.embedUrl.includes('?') ? '&' : '?'}autoplay=1&playsinline=1&rel=0&modestbranding=1`
    : ''
  const tokens = useMemo(() => encyclopediaTokens(query), [query])

  const searchResults = useMemo(() => ({
    units: DOORS.flatMap((door) => door.units.map((unit) => ({ door, unit, score: scoreText(tokens, `${door.title} ${unit.title} ${unit.keywords.join(' ')}`) })))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score),
    videos: mappedVideos
      .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.video.position - right.video.position),
    slides: encyclopediaTeachingTopics
      .map((topic) => ({ topic, score: scoreEncyclopediaTeachingTopic(tokens, topic) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score),
  }), [mappedVideos, tokens])

  const resultCount = query.trim().length >= 2
    ? searchResults.units.length + searchResults.videos.length + searchResults.slides.length
    : 0

  const playVideo = (video: IndexedEncyclopediaVideo) => {
    setPlayingVideoId(video.id)
    window.requestAnimationFrame(() => document.getElementById(`video-${video.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const openVideoPath = (door: Door, unit?: StructureUnit) => {
    const video = unit
      ? videosForUnit(door, unit, unitVideoMap)[0]
      : door.units.flatMap((item) => videosForUnit(door, item, unitVideoMap))[0]
    if (video) playVideo(video)
  }

  const openTeachingMaterials = (door: Door, topic?: string) => {
    if (!door.presentation) return
    setTeachingMaterial({ door, topic })
  }

  const downloadPdf = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (pdfDownloading) return
    setPdfDownloading(true)
    setPdfError(false)
    try {
      // fetch ثم Blob يتجاوز عطب Safari القديم الذي كان يعامل ملف PDF كتنقل داخل التطبيق.
      const response = await fetch(ENCYCLOPEDIA_SAMPLE_PDF, {
        cache: 'no-store',
        headers: { accept: 'application/pdf' },
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.toLowerCase().includes('application/pdf')) throw new Error(`PDF HTTP ${response.status}`)
      const blob = await response.blob()
      if (blob.size < 100_000) throw new Error('PDF payload is incomplete')
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = ENCYCLOPEDIA_SAMPLE_FILENAME
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch {
      setPdfError(true)
    } finally {
      setPdfDownloading(false)
    }
  }

  const retryCatalog = () => {
    resetEncyclopediaVideoCatalog()
    setCatalog(null)
    setCatalogError(false)
    setCatalogAttempt((value) => value + 1)
  }

  const teachingDoorGuide = teachingMaterial ? getEncyclopediaTeachingDoor(teachingMaterial.door.id) : null
  const teachingGuide: EncyclopediaTeachingTopic | null = teachingMaterial
    ? getEncyclopediaTeachingTopic(teachingMaterial.door.id, teachingMaterial.topic)
      || teachingDoorGuide?.topics[0]
      || null
    : null
  const teachingConcept = teachingMaterial && teachingGuide
    ? conceptForText(`${teachingGuide.title} ${teachingGuide.chapter} ${teachingGuide.videoHints.join(' ')}`, concepts)
    : null
  const teachingVideo = teachingMaterial && teachingGuide
    ? relatedVideoForText(`${teachingGuide.title} ${teachingGuide.videoHints.join(' ')}`, mappedVideos, teachingMaterial.door, teachingGuide.chapterNumbers[0])
    : null
  const teachingSlideLabel = teachingGuide ? encyclopediaSlideRangeLabel(teachingGuide.ranges) : ''
  const teachingSlidesCount = teachingGuide ? encyclopediaSlideCount(teachingGuide.ranges) : 0

  const whyWritten = book.whyWritten || 'مرجع موسوعي يجمع مفاهيم تكنولوجيا التعليم وتاريخها ونظمها وتطبيقاتها في خريطة واحدة.'
  const targetAudience = book.targetAudience || 'طلبة كليات التربية، والمعلمون، وأعضاء هيئة التدريس، والباحثون، ومصممو التعلّم.'
  const entryGuide = 'ابدأ من الباب أو الفصل الأقرب إلى سؤالك، ثم اقرأ الأصل أو شاهد شرحه داخل الصفحة.'

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

                <div className="mt-6 grid gap-2">
                  {[
                    ['لماذا كُتب الكتاب؟', whyWritten],
                    ['الفئة المستهدفة', targetAudience],
                    ['طريقة الدخول', entryGuide],
                  ].map(([title, text]) => (
                    <details key={title} className="group rounded-2xl border border-hair bg-wash">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5">
                        <span className="text-[.8rem] font-semibold leading-relaxed text-accent">{title}</span>
                        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <p className="border-t border-hair px-4 py-4 text-[.84rem] leading-[1.85] text-soft">{text}</p>
                    </details>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link to={`/publications/${book.slug}#ask-book-section`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[.78rem] font-semibold text-white transition-colors hover:bg-accent-deep">
                    <SocialIcon name="Search" size={16} />
                    <span>ابحث في هذا الكتاب</span>
                  </Link>
                  {book.pdf && (
                    <a
                      href={ENCYCLOPEDIA_SAMPLE_PDF}
                      download={ENCYCLOPEDIA_SAMPLE_FILENAME}
                      type="application/pdf"
                      onClick={downloadPdf}
                      aria-busy={pdfDownloading}
                      aria-label="تحميل مقدمة وفهرس موسوعة تكنولوجيا التعليم بصيغة PDF"
                      className="inline-flex min-h-11 items-center gap-3 rounded-full border border-hair px-5 text-[.78rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent aria-busy:pointer-events-none aria-busy:opacity-60"
                    >
                      <span>{pdfDownloading ? 'جارٍ تجهيز الملف…' : 'تحميل المقدمة والفهرس'}</span>
                      <span className="text-[.72rem] text-soft">PDF</span>
                      <span className="sr-only">ملف PDF المعتمد متاح كما كان، وهو المقدمة والفهرس فقط وليس الكتاب الكامل.</span>
                    </a>
                  )}
                </div>
                {pdfError && <p role="alert" className="mt-2 text-[.66rem] text-red-700">تعذّر تنزيل الملف. أعد المحاولة بعد تحديث الصفحة.</p>}
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
                <span className="text-[.68rem] font-semibold text-accent">الفهرس المرئي</span>
                <h2 id="encyclopedia-map-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.3rem)] font-semibold leading-[1.4] text-ink">الأبواب والفصول والفيديو في مكان واحد.</h2>
              </div>
              <div className="flex items-center gap-2">
                {catalogError && <button type="button" onClick={retryCatalog} aria-label="إعادة تحميل فهرس الفيديوهات" title="إعادة التحميل" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="History" size={15} /></button>}
                <a href={CHANNEL_URL} target="_blank" rel="noreferrer" aria-label="فتح قناة الموسوعة على يوتيوب" title="قناة الموسوعة" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="YouTube" size={16} /></a>
              </div>
            </div>

            <div id="encyclopedia-search" className="mt-6 flex items-center gap-2 rounded-full border border-hair bg-canvas p-1.5">
              <label htmlFor="encyclopedia-query" className="sr-only">ابحث في موسوعة تكنولوجيا التعليم</label>
              <input id="encyclopedia-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في باب أو فصل أو فيديو" className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[.82rem] text-ink outline-none placeholder:text-soft/[.6]" />
              {query ? <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث" title="مسح البحث" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-soft hover:text-accent"><SocialIcon name="Close" size={13} /></button> : <span aria-label="ابحث في الموسوعة" title="ابحث في الموسوعة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"><SocialIcon name="Search" size={15} /></span>}
            </div>
            {query.trim().length >= 2 && <p className="mt-2 text-[.64rem] text-soft">{resultCount ? `${formatArabicNumber(resultCount)} نتيجة مرتبطة` : 'لا توجد نتيجة مطابقة.'}</p>}
          </FadeUp>

          <div className="mt-7 border-y border-hair">
            {DOORS.map((door, index) => (
              <DoorRow
                key={door.id}
                door={door}
                concepts={concepts}
                videoMap={unitVideoMap}
                query={query}
                initiallyOpen={false}
                playingVideoId={playingVideoId}
                selectedPlayerUrl={selectedPlayerUrl}
                onPlay={playVideo}
                onOpenPath={openVideoPath}
                onOpenTeaching={openTeachingMaterials}
              />
            ))}
          </div>
          {!catalog && !catalogError && <p className="mt-4 text-[.65rem] text-soft">تُحمّل الفيديوهات بهدوء.</p>}
          {catalog && mappedVideos.length > 0 && <p className="mt-4 text-[.65rem] text-soft">ظهر {formatArabicNumber(mappedVideos.length)} فيديو في مواضعه الموثقة داخل الأبواب والفصول.</p>}
          {catalog && mappedVideos.length === 0 && <p role="alert" className="mt-4 text-[.68rem] text-red-700">وصلت فيديوهات القناة، لكن خريطة القوائم التشغيلية لم تصل. استخدم زر إعادة التحميل أعلاه.</p>}
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
                  <span className="mt-1 block text-[.7rem] text-soft">العروض الأربعة الأولى فقط.</span>
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
                    {teachingConcept ? <Link to={`/publications/${book.slug}?book_idea=${encodeURIComponent(teachingConcept.title)}#book-knowledge`} onClick={() => setTeachingMaterial(null)} className="min-w-0 border-e border-hair px-2 py-4 text-center text-[.68rem] font-semibold text-ink hover:text-accent">اقرأ الأصل</Link> : <span className="min-w-0 border-e border-hair px-2 py-4 text-center text-[.68rem] text-soft">اقرأ الأصل</span>}
                    <button type="button" disabled={!teachingVideo} onClick={() => { if (teachingVideo) { setTeachingMaterial(null); playVideo(teachingVideo) } }} className="min-w-0 px-2 py-4 text-center text-[.68rem] font-semibold text-accent disabled:opacity-40">شاهد الشرح</button>
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
