import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { getBookKnowledge, type BookKnowledgeConcept } from '../lib/book-knowledge'
import { arabicCountPhrase, PAGE_FORMS } from '../lib/arabic-count.ts'
import structureData from '../data/encyclopedia-structure.json'
import {
  getEncyclopediaVideoCatalog,
  getEncyclopediaVideoMoment,
  resetEncyclopediaVideoCatalog,
  searchEncyclopediaVideoMoments,
  type EncyclopediaTranscriptProgress,
  type EncyclopediaVideoCatalog,
  type EncyclopediaVideoMoment,
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
  indexEncyclopediaVideos,
  normalizeEncyclopediaText,
  scoreIndexedVideo,
  type IndexedEncyclopediaVideo,
} from '../lib/encyclopedia-video-index'
import { FadeUp, Reveal } from './ui'
import { SocialIcon } from './icons'
import { OwnerEdit } from './extras'

const CHANNEL_URL = 'https://www.youtube.com/@موسوعةتكنولوجياالتعليم/videos'
const LAST_VIDEO_KEY = 'encyclopedia:last-video'
const formatArabicNumber = (value: number) => new Intl.NumberFormat('ar-KW-u-nu-arab').format(value)
const formatMomentTime = (seconds: number) => `${formatArabicNumber(Math.floor(Math.max(0, seconds) / 60))}:${formatArabicNumber(Math.max(0, seconds) % 60).padStart(2, '٠')}`

const scoreText = (tokens: readonly string[], value = '') => {
  const normalized = normalizeEncyclopediaText(value)
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? (token.length >= 6 ? 3 : 2) : 0), 0)
}

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

const DOORS: Door[] = structureData.doors.map((door) => ({
  ...door,
  presentation: 'presentation' in door ? door.presentation : undefined,
  topics: door.units.flatMap((unit) => [unit.title, ...unit.keywords]),
}))

const PRESENTATION_DOORS = DOORS.filter((door) => Boolean(door.presentation))
type DoorFilter = 'all' | string
type ChapterFilter = 'all' | number
type TeachingMaterialSelection = { door: Door; topic?: string }

function conceptForText(value: string, concepts: BookKnowledgeConcept[]) {
  const tokens = encyclopediaTokens(value)
  return concepts
    .map((concept) => ({ concept, score: scoreText(tokens, `${concept.title} ${concept.keywords.join(' ')} ${concept.summary} ${concept.question}`) }))
    .sort((left, right) => right.score - left.score)[0]?.concept || null
}

function conceptForDoor(door: Door, concepts: BookKnowledgeConcept[]) {
  return conceptForText(`${door.title} ${door.hints.join(' ')}`, concepts)
}

function doorForVideo(video: IndexedEncyclopediaVideo | null) {
  if (!video?.doorId) return null
  return DOORS.find((door) => door.id === video.doorId) || null
}

function unitForVideo(video: IndexedEncyclopediaVideo | null) {
  const door = doorForVideo(video)
  if (!door || !video?.chapterNumber) return null
  return door.units.find((unit) => unit.number === video.chapterNumber) || null
}

function videoSequence(video: IndexedEncyclopediaVideo) {
  const parts: string[] = []
  if (video.doorNumber) parts.push(`الباب ${formatArabicNumber(video.doorNumber)}`)
  if (video.chapterNumber) parts.push(`الفصل ${formatArabicNumber(video.chapterNumber)}`)
  if (video.videoNumber) parts.push(`المقطع ${formatArabicNumber(video.videoNumber)}`)
  return parts.join(' · ') || 'من الموسوعة المرئية'
}

function relatedVideoForText(value: string, videos: IndexedEncyclopediaVideo[], door?: Door, chapterNumber?: number) {
  const tokens = encyclopediaTokens(value)
  const candidates = videos.filter((video) => {
    if (door && video.doorId !== door.id) return false
    if (chapterNumber && video.chapterNumber && video.chapterNumber !== chapterNumber) return false
    return true
  })
  return candidates
    .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
    .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
    .find((item) => item.score > 0)?.video || candidates[0] || null
}

function bestTeachingTopic(door: Door, value?: string) {
  if (!door.presentation) return null
  const exact = getEncyclopediaTeachingTopic(door.id, value)
  if (exact) return exact
  const tokens = encyclopediaTokens(value || door.title)
  return encyclopediaTeachingTopics
    .filter((topic) => topic.doorId === door.id)
    .map((topic) => ({ topic, score: scoreEncyclopediaTeachingTopic(tokens, topic) }))
    .sort((left, right) => right.score - left.score)[0]?.topic || null
}

function DoorRow({
  door,
  concepts,
  initiallyOpen,
  videoCount,
  catalogLoading,
  onOpenUnit,
  onOpenPath,
  onOpenTeaching,
}: {
  door: Door
  concepts: BookKnowledgeConcept[]
  initiallyOpen: boolean
  videoCount: number
  catalogLoading: boolean
  onOpenUnit: (unit: StructureUnit, door: Door) => void
  onOpenPath: (door: Door) => void
  onOpenTeaching: (door: Door, topic?: string) => void
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const doorConcept = conceptForDoor(door, concepts)
  const bookHref = doorConcept ? `/publications/encyclopedia?book_idea=${encodeURIComponent(doorConcept.title)}#book-knowledge` : '#book-knowledge'
  const countLabel = catalogLoading ? 'يُبنى الفهرس الآن' : videoCount > 0 ? `${formatArabicNumber(videoCount)} مقطعاً` : 'مسار مرئي'

  useEffect(() => {
    if (initiallyOpen && detailsRef.current) detailsRef.current.open = true
  }, [initiallyOpen])

  return (
    <details ref={detailsRef} id={door.id} className="group scroll-mt-28 border-b border-hair last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-4 py-6 marker:hidden [&::-webkit-details-marker]:hidden md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-6 md:py-8">
        <span className="font-display text-[.72rem] font-semibold text-accent">{door.number}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong className="font-display text-[1.18rem] font-semibold leading-[1.55] text-ink md:text-[1.35rem]">{door.title}</strong>
            <span className="text-[.62rem] text-soft">{countLabel}</span>
          </span>
          <span className="mt-1.5 block max-w-3xl text-[.78rem] font-light leading-[1.85] text-soft md:text-[.84rem]">{door.summary}</span>
        </span>
        <span aria-hidden className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
      </summary>

      <div className="grid gap-6 pb-8 ps-[4.1rem] md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:ps-[5.5rem]">
        <div>
          <p className="mb-2 text-[.62rem] font-semibold text-soft">{door.unitsLabel}</p>
          <div className="border-y border-hair">
            {door.units.map((unit) => {
              const hasTeaching = Boolean(door.presentation && bestTeachingTopic(door, unit.title))
              return (
                <div key={`${door.id}-${unit.number}`} className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-hair py-3.5 last:border-b-0">
                  <span className="font-display text-[.63rem] text-accent">{formatArabicNumber(unit.number)}</span>
                  <span className="min-w-0">
                    <strong className="block text-[.77rem] font-medium leading-[1.75] text-ink">{unit.title}</strong>
                    <span className="mt-0.5 block text-[.61rem] text-soft">ص {formatArabicNumber(unit.pageStart)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-[.65rem] font-semibold">
                    <button type="button" onClick={() => onOpenUnit(unit, door)} className="text-accent transition-opacity hover:opacity-65">شاهد الشرح</button>
                    {hasTeaching && <><span aria-hidden className="h-3 w-px bg-hair" /><button type="button" onClick={() => onOpenTeaching(door, unit.title)} className="text-soft transition-colors hover:text-accent">مواد التدريس</button></>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:max-w-[18rem] md:justify-end">
          <Link to={bookHref} className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">اقرأ من الباب</Link>
          <button type="button" onClick={() => onOpenPath(door)} className="inline-flex min-h-10 items-center rounded-full border border-accent/[.3] px-4 text-[.7rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">شاهد الباب</button>
          {door.presentation && <button type="button" onClick={() => onOpenTeaching(door)} className="text-[.67rem] font-semibold text-soft underline decoration-hair underline-offset-4 transition-colors hover:text-accent">مواد الباب</button>}
        </div>
      </div>
    </details>
  )
}

export function EncyclopediaPortal({ book, articles, papers }: { book: BookRecord; articles: ArticleRecord[]; papers: PaperRecord[] }) {
  const knowledge = getBookKnowledge(book.slug)
  const concepts = useMemo(() => knowledge?.concepts.filter((concept) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)/u.test(concept.title)) || [], [knowledge])
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState<EncyclopediaVideoCatalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [activeVideoDoor, setActiveVideoDoor] = useState<DoorFilter>('all')
  const [activeVideoChapter, setActiveVideoChapter] = useState<ChapterFilter>('all')
  const [videoQuery, setVideoQuery] = useState('')
  const [visibleVideoCount, setVisibleVideoCount] = useState(28)
  const [playerReady, setPlayerReady] = useState(false)
  const [selectedMoment, setSelectedMoment] = useState<EncyclopediaVideoMoment | null>(null)
  const [momentLoadingKey, setMomentLoadingKey] = useState('')
  const [queryMoments, setQueryMoments] = useState<EncyclopediaVideoMoment[]>([])
  const [queryMomentsLoading, setQueryMomentsLoading] = useState(false)
  const [videoMoments, setVideoMoments] = useState<EncyclopediaVideoMoment[]>([])
  const [videoMomentsLoading, setVideoMomentsLoading] = useState(false)
  const [transcriptProgress, setTranscriptProgress] = useState<EncyclopediaTranscriptProgress>({ running: false, total: 0, completed: 0, available: 0 })
  const [teachingMaterial, setTeachingMaterial] = useState<TeachingMaterialSelection | null>(null)
  const videoSectionRef = useRef<HTMLElement | null>(null)
  const momentRequestRef = useRef(0)
  const pageCount = Number(book.pageCount) || 696
  const tokens = useMemo(() => encyclopediaTokens(query), [query])

  useEffect(() => {
    const controller = new AbortController()
    setCatalogError(false)
    getEncyclopediaVideoCatalog(controller.signal)
      .then((payload) => {
        setCatalog(payload)
        setTranscriptProgress(payload.transcriptIndex || { running: false, total: payload.videos.length, completed: 0, available: 0 })
      })
      .catch((error) => {
        if ((error as { name?: string })?.name !== 'AbortError') setCatalogError(true)
      })
    return () => controller.abort()
  }, [catalogAttempt])

  const indexedVideos = useMemo(() => indexEncyclopediaVideos(catalog?.videos || [], DOORS, concepts), [catalog, concepts])

  useEffect(() => {
    if (!indexedVideos.length) return
    setSelectedVideoId((current) => {
      if (current && indexedVideos.some((video) => video.id === current)) return current
      let stored = ''
      try { stored = window.localStorage.getItem(LAST_VIDEO_KEY) || '' } catch { /* التخزين المحلي اختياري. */ }
      return indexedVideos.some((video) => video.id === stored) ? stored : indexedVideos[0].id
    })
  }, [indexedVideos])

  useEffect(() => {
    if (!selectedVideoId) return
    setPlayerReady(false)
    try { window.localStorage.setItem(LAST_VIDEO_KEY, selectedVideoId) } catch { /* لا نوقف المشاهدة إذا حُجب التخزين. */ }
  }, [selectedVideoId])

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

  const selectedVideo = indexedVideos.find((video) => video.id === selectedVideoId) || indexedVideos[0] || null
  const selectedDoor = doorForVideo(selectedVideo)
  const selectedUnit = unitForVideo(selectedVideo)
  const activeMoment = selectedMoment?.videoId === selectedVideo?.id ? selectedMoment : null
  const selectedPlayerUrl = selectedVideo ? `${selectedVideo.embedUrl}&playsinline=1${activeMoment?.startSeconds ? `&start=${Math.max(0, Math.floor(activeMoment.startSeconds))}` : ''}` : ''
  const selectedChannelUrl = selectedVideo ? `${selectedVideo.url}${activeMoment?.startSeconds ? `&t=${Math.max(0, Math.floor(activeMoment.startSeconds))}s` : ''}` : CHANNEL_URL

  const doorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const video of indexedVideos) if (video.doorId) counts.set(video.doorId, (counts.get(video.doorId) || 0) + 1)
    return counts
  }, [indexedVideos])

  const availableChapters = useMemo(() => {
    if (activeVideoDoor === 'all') return []
    const chapters = new Set<number>()
    for (const video of indexedVideos) if (video.doorId === activeVideoDoor && video.chapterNumber) chapters.add(video.chapterNumber)
    return [...chapters].sort((a, b) => a - b)
  }, [activeVideoDoor, indexedVideos])

  useEffect(() => {
    if (activeVideoChapter !== 'all' && !availableChapters.includes(activeVideoChapter)) setActiveVideoChapter('all')
  }, [activeVideoChapter, availableChapters])

  const videoTokens = useMemo(() => encyclopediaTokens(videoQuery), [videoQuery])
  const filteredVideos = useMemo(() => {
    const filtered = indexedVideos.filter((video) => {
      if (activeVideoDoor !== 'all' && video.doorId !== activeVideoDoor) return false
      if (activeVideoChapter !== 'all' && video.chapterNumber !== activeVideoChapter) return false
      return !videoTokens.length || scoreIndexedVideo(videoTokens, video) > 0
    })
    if (!videoTokens.length) return filtered
    return filtered
      .map((video) => ({ video, score: scoreIndexedVideo(videoTokens, video) }))
      .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
      .map((item) => item.video)
  }, [activeVideoChapter, activeVideoDoor, indexedVideos, videoTokens])

  const videoMomentMap = useMemo(() => new Map(videoMoments.map((moment) => [moment.videoId, moment])), [videoMoments])
  const listedVideos = useMemo(() => {
    if (!videoTokens.length || !videoMoments.length) return filteredVideos
    const exact = videoMoments
      .map((moment) => indexedVideos.find((video) => video.id === moment.videoId) || indexEncyclopediaVideos([moment.video], DOORS, concepts)[0] || null)
      .filter((video): video is IndexedEncyclopediaVideo => Boolean(video))
      .filter((video) => activeVideoDoor === 'all' || video.doorId === activeVideoDoor)
      .filter((video) => activeVideoChapter === 'all' || video.chapterNumber === activeVideoChapter)
    const unique = new Map<string, IndexedEncyclopediaVideo>()
    for (const video of [...exact, ...filteredVideos]) if (!unique.has(video.id)) unique.set(video.id, video)
    return [...unique.values()]
  }, [activeVideoChapter, activeVideoDoor, concepts, filteredVideos, indexedVideos, videoMoments, videoTokens])

  useEffect(() => setVisibleVideoCount(28), [activeVideoChapter, activeVideoDoor, videoQuery])

  useEffect(() => {
    if (!listedVideos.length) return
    setSelectedVideoId((current) => current && listedVideos.some((video) => video.id === current) ? current : listedVideos[0].id)
  }, [listedVideos])

  const selectedPath = useMemo(() => {
    if (!selectedVideo) return []
    return selectedVideo.doorId ? indexedVideos.filter((video) => video.doorId === selectedVideo.doorId) : indexedVideos
  }, [indexedVideos, selectedVideo])
  const selectedPathIndex = selectedVideo ? selectedPath.findIndex((video) => video.id === selectedVideo.id) : -1
  const previousVideo = selectedPathIndex > 0 ? selectedPath[selectedPathIndex - 1] : null
  const nextVideo = selectedPathIndex >= 0 && selectedPathIndex < selectedPath.length - 1 ? selectedPath[selectedPathIndex + 1] : null

  const teachingGuide = useMemo(() => teachingMaterial ? bestTeachingTopic(teachingMaterial.door, teachingMaterial.topic) : null, [teachingMaterial])
  const teachingDoorGuide = teachingMaterial ? getEncyclopediaTeachingDoor(teachingMaterial.door.id) : null
  const teachingVideo = useMemo(() => teachingMaterial ? relatedVideoForText(teachingMaterial.topic || teachingGuide?.title || teachingMaterial.door.title, indexedVideos, teachingMaterial.door, teachingGuide?.chapterNumbers[0]) : null, [indexedVideos, teachingGuide, teachingMaterial])
  const teachingConcept = useMemo(() => teachingMaterial ? conceptForText(teachingMaterial.topic || teachingGuide?.title || teachingMaterial.door.title, concepts) : null, [concepts, teachingGuide, teachingMaterial])

  const selectVideo = (video: IndexedEncyclopediaVideo, scroll = true, moment: EncyclopediaVideoMoment | null = null, preserveMomentRequest = false) => {
    if (!preserveMomentRequest) momentRequestRef.current += 1
    setSelectedMoment(moment?.videoId === video.id ? moment : null)
    setPlayerReady(false)
    setSelectedVideoId(video.id)
    if (scroll) window.requestAnimationFrame(() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const indexedVideoForMoment = (moment: EncyclopediaVideoMoment) => indexedVideos.find((video) => video.id === moment.videoId) || indexEncyclopediaVideos([moment.video], DOORS, concepts)[0] || null

  const resolveExactMoment = async ({ topic, door, fallback, hints = [], scroll = true }: { topic: string; door: Door; fallback: IndexedEncyclopediaVideo | null; hints?: readonly string[]; scroll?: boolean }) => {
    const key = `${door.id}:${topic}`
    const requestId = momentRequestRef.current + 1
    momentRequestRef.current = requestId
    setMomentLoadingKey(key)
    try {
      const moment = await getEncyclopediaVideoMoment({ topic, doorNumber: door.doorNumber, hints })
      if (momentRequestRef.current !== requestId || !moment) return
      const video = indexedVideoForMoment(moment)
      if (!video) return
      setActiveVideoDoor(video.doorId || door.id)
      setActiveVideoChapter(video.chapterNumber || 'all')
      selectVideo(video, scroll, moment, true)
    } catch {
      if (momentRequestRef.current === requestId && fallback) selectVideo(fallback, scroll, null, true)
    } finally {
      if (momentRequestRef.current === requestId) setMomentLoadingKey((current) => current === key ? '' : current)
    }
  }

  const openVideoPath = (door: Door) => {
    momentRequestRef.current += 1
    setMomentLoadingKey('')
    setActiveVideoDoor(door.id)
    setActiveVideoChapter('all')
    setVideoQuery('')
    setSelectedMoment(null)
    const first = indexedVideos.find((video) => video.doorId === door.id)
    if (first) setSelectedVideoId(first.id)
    window.requestAnimationFrame(() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const openVideoUnit = (unit: StructureUnit, door: Door) => {
    setActiveVideoDoor(door.id)
    setActiveVideoChapter(unit.number)
    setVideoQuery(unit.title)
    const fallback = relatedVideoForText(`${unit.title} ${unit.keywords.join(' ')}`, indexedVideos, door, unit.number)
    if (fallback) selectVideo(fallback, false)
    window.requestAnimationFrame(() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    void resolveExactMoment({ topic: unit.title, door, fallback, hints: unit.keywords, scroll: false })
  }

  const openTeachingMaterials = (door: Door, topic?: string) => {
    if (!door.presentation) return
    setTeachingMaterial({ door, topic })
  }

  const playTeachingVideo = () => {
    if (!teachingMaterial) return
    const topic = teachingMaterial.topic || teachingGuide?.title || teachingMaterial.door.title
    const door = teachingMaterial.door
    const fallback = teachingVideo
    const hints = teachingGuide?.videoHints || []
    setTeachingMaterial(null)
    setActiveVideoDoor(door.id)
    setActiveVideoChapter(teachingGuide?.chapterNumbers[0] || 'all')
    setVideoQuery(topic)
    if (fallback) selectVideo(fallback, true)
    else window.requestAnimationFrame(() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    void resolveExactMoment({ topic, door, fallback, hints, scroll: false })
  }

  const retryCatalog = () => {
    resetEncyclopediaVideoCatalog()
    setCatalog(null)
    setCatalogError(false)
    setCatalogAttempt((value) => value + 1)
  }

  useEffect(() => {
    const clean = query.trim()
    if (clean.length < 2) { setQueryMoments([]); setQueryMomentsLoading(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setQueryMomentsLoading(true)
      searchEncyclopediaVideoMoments(clean, { limit: 5, signal: controller.signal })
        .then((result) => { setQueryMoments(result.moments); setTranscriptProgress(result.progress) })
        .catch((error) => { if ((error as { name?: string })?.name !== 'AbortError') setQueryMoments([]) })
        .finally(() => { if (!controller.signal.aborted) setQueryMomentsLoading(false) })
    }, 360)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

  useEffect(() => {
    const clean = videoQuery.trim()
    if (clean.length < 2) { setVideoMoments([]); setVideoMomentsLoading(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const doorNumber = activeVideoDoor === 'all' ? undefined : DOORS.find((door) => door.id === activeVideoDoor)?.doorNumber
      setVideoMomentsLoading(true)
      searchEncyclopediaVideoMoments(clean, { doorNumber, limit: 8, signal: controller.signal })
        .then((result) => { setVideoMoments(result.moments); setTranscriptProgress(result.progress) })
        .catch((error) => { if ((error as { name?: string })?.name !== 'AbortError') setVideoMoments([]) })
        .finally(() => { if (!controller.signal.aborted) setVideoMomentsLoading(false) })
    }, 420)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeVideoDoor, videoQuery])

  const searchResults = useMemo(() => {
    if (!tokens.length) return { concepts: [], units: [], videos: [], slides: [], articles: [], papers: [] }
    return {
      concepts: concepts
        .map((concept) => ({ concept, score: scoreText(tokens, `${concept.title} ${concept.keywords.join(' ')} ${concept.summary} ${concept.question}`), video: relatedVideoForText(`${concept.title} ${concept.keywords.join(' ')}`, indexedVideos) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 4),
      units: DOORS.flatMap((door) => door.units.map((unit) => ({ door, unit, score: scoreText(tokens, `${door.title} ${unit.title} ${unit.keywords.join(' ')}`) })))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 4),
      videos: indexedVideos
        .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
        .slice(0, 6),
      slides: encyclopediaTeachingTopics
        .map((topic) => ({ topic, door: DOORS.find((door) => door.id === topic.doorId) || null, score: scoreEncyclopediaTeachingTopic(tokens, topic) }))
        .filter((item) => item.door && item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 4),
      articles: articles
        .map((article) => ({ article, score: scoreText(tokens, `${article.title} ${article.excerpt || ''}`) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3),
      papers: papers
        .map((paper) => ({ paper, score: scoreText(tokens, `${paper.titleAr || paper.title} ${paper.meta || ''} ${paper.abstractAr || ''}`) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 2),
    }
  }, [articles, concepts, indexedVideos, papers, tokens])

  const hasSearchResults = queryMoments.length > 0 || searchResults.concepts.length > 0 || searchResults.units.length > 0 || searchResults.videos.length > 0 || searchResults.slides.length > 0 || searchResults.articles.length > 0 || searchResults.papers.length > 0
  const stagedSearchHref = query.trim().length >= 2 ? `/publications/${book.slug}?book_question=${encodeURIComponent(query.trim())}#ask-book-section` : '#encyclopedia-search'
  const catalogLoading = !catalog && !catalogError
  const videoCountLabel = catalog?.count ? `${formatArabicNumber(catalog.count)} فيديو` : catalogError ? 'أعد تحميل الفهرس' : 'المكتبة المرئية'
  const teachingSlideLabel = teachingGuide ? encyclopediaSlideRangeLabel(teachingGuide.ranges) : ''
  const teachingSlidesCount = teachingGuide ? encyclopediaSlideCount(teachingGuide.ranges) : 0

  return (
    <>
      <section className="encyclopedia-hero relative overflow-hidden border-b border-hair px-6 pb-14 pt-28 md:px-11 md:pb-20 md:pt-40">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-[9rem] h-px bg-gradient-to-l from-transparent via-accent/[.2] to-transparent md:top-[12rem]" />
        <div className="relative mx-auto max-w-shell">
          <FadeUp><Link to="/publications" className="text-[.8rem] text-soft transition-colors hover:text-accent">← كل المؤلفات</Link></FadeUp>
          <div className="mt-8 grid items-center gap-10 lg:grid-cols-[minmax(15rem,.58fr)_minmax(0,1.42fr)] lg:gap-16">
            <FadeUp delay={0.05}><div className="mx-auto max-w-[18rem] overflow-hidden rounded-2xl border border-hair bg-white shadow-[0_24px_70px_-48px_rgba(20,31,45,.55)] lg:mx-0"><img src={book.cover} alt={`غلاف كتاب ${book.title}`} width="1024" height="720" fetchPriority="high" decoding="async" className="w-full" /></div></FadeUp>
            <div>
              <FadeUp delay={0.08}>
                <span className="text-[.72rem] font-semibold text-accent">بوابة معرفية مستقلة</span>
                <h1 className="mt-3 max-w-4xl font-display text-[clamp(2.25rem,5vw,4.1rem)] font-bold leading-[1.2] text-ink"><Reveal>{book.title}</Reveal></h1>
                {book.coAuthors && <p className="mt-3 text-[.84rem] text-soft">بالاشتراك مع {book.coAuthors}</p>}
                <OwnerEdit tab="books" slug={book.slug} className="mt-3" />
                <p className="mt-6 max-w-3xl text-[1rem] font-light leading-[2] text-ink/80 md:text-[1.08rem]">ثمرة أكثر من خمس سنوات من العمل؛ تُقرأ وتُشاهد وتُدرّس ويُبحث فيها من مكان واحد.</p>
              </FadeUp>
              <FadeUp delay={0.13}>
                <nav className="mt-8 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-hair bg-hair" aria-label="مداخل الموسوعة">
                  <a href="#encyclopedia-map" className="flex min-h-14 items-center justify-center bg-canvas px-2 text-center text-[.73rem] font-semibold text-ink transition-colors hover:bg-wash hover:text-accent">اقرأ</a>
                  <a href="#encyclopedia-video" className="flex min-h-14 items-center justify-center bg-canvas px-2 text-center text-[.73rem] font-semibold text-ink transition-colors hover:bg-wash hover:text-accent">شاهد</a>
                  <a href="#encyclopedia-teaching-kit" className="flex min-h-14 items-center justify-center bg-canvas px-2 text-center text-[.73rem] font-semibold text-ink transition-colors hover:bg-wash hover:text-accent">مواد التدريس</a>
                  <a href="#encyclopedia-search" aria-label="ابحث في الموسوعة" title="ابحث في الموسوعة" className="group flex min-h-14 items-center justify-center bg-canvas text-ink transition-colors hover:bg-wash hover:text-accent"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair transition-colors group-hover:border-accent" aria-hidden><SocialIcon name="Search" size={16} /></span></a>
                </nav>
              </FadeUp>
              <FadeUp delay={0.18}>
                <dl className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-hair pt-5 text-[.7rem] text-soft">
                  <div><dt className="sr-only">الأبواب</dt><dd><strong className="font-semibold text-ink">{formatArabicNumber(DOORS.length)}</strong> أبواب موثقة من الفهرس</dd></div>
                  <div><dt className="sr-only">الصفحات</dt><dd><strong className="font-semibold text-ink">{arabicCountPhrase(pageCount, PAGE_FORMS, formatArabicNumber)}</strong></dd></div>
                  <div><dt className="sr-only">العروض</dt><dd><strong className="font-semibold text-ink">{formatArabicNumber(PRESENTATION_DOORS.length)}</strong> عروض تدريسية</dd></div>
                  <div><dt className="sr-only">الفيديوهات</dt><dd><strong className="font-semibold text-ink">{videoCountLabel}</strong></dd></div>
                  {book.pdf && <a href={book.pdf} target="_blank" rel="noreferrer" aria-label="فتح نسخة PDF من الموسوعة" title="فتح نسخة PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="CV" size={15} /></a>}
                </dl>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      <section id="encyclopedia-map" className="scroll-mt-24 border-b border-hair px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-map-title">
        <div className="mx-auto max-w-shell">
          <FadeUp><div className="max-w-3xl"><span className="text-[.7rem] font-semibold text-accent">خريطة الموسوعة</span><h2 id="encyclopedia-map-title" className="mt-2 font-display text-[clamp(1.6rem,3.4vw,2.45rem)] font-semibold leading-[1.4] text-ink">خمسة أبواب كما وردت في النسخة الأصلية.</h2><p className="mt-3 text-[.78rem] font-light leading-[1.9] text-soft">افتح الباب، اختر الفصل أو المحور، ثم اقرأ أو شاهد شرحه. العروض الأربعة مواد تدريس إضافية وليست فهرس الكتاب.</p></div></FadeUp>
          <div className="mt-8 border-y border-hair">{DOORS.map((door, index) => <DoorRow key={door.id} door={door} concepts={concepts} initiallyOpen={index === 0} videoCount={doorCounts.get(door.id) || 0} catalogLoading={catalogLoading} onOpenUnit={openVideoUnit} onOpenPath={openVideoPath} onOpenTeaching={openTeachingMaterials} />)}</div>
        </div>
      </section>

      <section id="encyclopedia-search" className="scroll-mt-24 border-b border-hair bg-wash/[.4] px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-search-title">
        <div className="mx-auto max-w-4xl">
          <FadeUp>
            <span className="text-[.7rem] font-semibold text-accent">بحث موحّد</span>
            <h2 id="encyclopedia-search-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.3rem)] font-semibold leading-[1.45] text-ink">اكتب سؤالاً أو مفهوماً.</h2>
            <form onSubmit={(event) => { event.preventDefault(); document.getElementById('encyclopedia-search-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }} className="mt-7 flex items-center gap-2 rounded-full border border-hair bg-canvas p-1.5 shadow-[0_18px_55px_-45px_rgba(20,31,45,.5)]">
              <label htmlFor="encyclopedia-query" className="sr-only">ابحث في موسوعة تكنولوجيا التعليم</label>
              <input id="encyclopedia-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: الفصول المقلوبة، دور المعلم، الفجوة الرقمية…" className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[.84rem] text-ink outline-none placeholder:text-soft/[.6]" />
              <button type="submit" disabled={query.trim().length < 2} aria-label="اعرض نتائج الموسوعة" title="اعرض نتائج الموسوعة" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${query.trim().length >= 2 ? 'bg-accent text-white hover:bg-accent-deep' : 'cursor-not-allowed bg-wash text-soft'}`}><SocialIcon name="Search" size={16} /></button>
            </form>
          </FadeUp>

          {query.trim().length >= 2 && <FadeUp delay={0.06}><div id="encyclopedia-search-results" className="mt-6 scroll-mt-28 border-y border-hair bg-canvas px-4 py-1 md:px-6">
            {!hasSearchResults ? <div className="py-6 text-[.78rem] leading-relaxed text-soft">{queryMomentsLoading ? 'يُفحص الكلام المنطوق داخل المقاطع…' : 'لم يظهر مدخل مختصر بعد. افتح البحث العميق في متن الموسوعة.'}</div> : <div className="divide-y divide-hair">
              {queryMoments.map((moment) => {
                const video = indexedVideoForMoment(moment)
                if (!video) return null
                return <button key={`moment-${moment.videoId}-${moment.startSeconds}`} type="button" onClick={() => { setActiveVideoDoor(video.doorId || 'all'); setActiveVideoChapter(video.chapterNumber || 'all'); selectVideo(video, true, moment) }} className="group grid w-full gap-2 py-4 text-right sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"><span className="text-[.62rem] font-semibold text-accent">من الكلام المنطوق · {formatMomentTime(moment.startSeconds)}</span><span><strong className="block text-[.78rem] font-semibold leading-relaxed text-ink group-hover:text-accent">{moment.topic || video.title}</strong><span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{moment.excerpt}</span></span><span className="text-[.64rem] text-soft">شاهد</span></button>
              })}
              {searchResults.units.map(({ door, unit }) => <button key={`unit-${door.id}-${unit.number}`} type="button" onClick={() => openVideoUnit(unit, door)} className="group grid w-full gap-2 py-4 text-right sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"><span className="text-[.62rem] font-semibold text-accent">{door.title}</span><span><strong className="block text-[.78rem] font-semibold leading-relaxed text-ink group-hover:text-accent">{unit.title}</strong><span className="mt-1 block text-[.66rem] text-soft">ص {formatArabicNumber(unit.pageStart)}</span></span><span className="text-[.64rem] text-soft">شاهد الشرح</span></button>)}
              {searchResults.concepts.map(({ concept, video }) => <div key={`concept-${concept.id}`} className="grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"><span className="text-[.62rem] font-semibold text-accent">من الكتاب</span><span><strong className="block text-[.78rem] font-semibold leading-relaxed text-ink">{concept.title}</strong><span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{concept.summary}</span></span><span className="flex gap-3 text-[.64rem] font-semibold"><Link to={`/publications/${book.slug}?book_idea=${encodeURIComponent(concept.title)}#book-knowledge`} className="text-ink hover:text-accent">اقرأ</Link>{video && <button type="button" onClick={() => selectVideo(video)} className="text-accent">شاهد</button>}</span></div>)}
              {searchResults.videos.map(({ video }) => <button key={`video-${video.id}`} type="button" onClick={() => { setActiveVideoDoor(video.doorId || 'all'); setActiveVideoChapter(video.chapterNumber || 'all'); selectVideo(video) }} className="group grid w-full gap-2 py-4 text-right sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"><span className="text-[.62rem] font-semibold text-accent">فيديو · {videoSequence(video)}</span><strong className="text-[.78rem] font-semibold leading-relaxed text-ink group-hover:text-accent">{video.title}</strong><span className="text-[.64rem] text-soft">شاهد</span></button>)}
              {searchResults.slides.map(({ topic, door }) => door && <button key={`slide-${topic.doorId}-${topic.title}`} type="button" onClick={() => openTeachingMaterials(door, topic.title)} className="group grid w-full gap-2 py-4 text-right sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"><span className="text-[.62rem] font-semibold text-accent">مواد التدريس</span><strong className="text-[.78rem] font-semibold leading-relaxed text-ink group-hover:text-accent">{topic.title}</strong><span className="text-[.64rem] text-soft">{encyclopediaSlideRangeLabel(topic.ranges)}</span></button>)}
              {searchResults.articles.map(({ article }) => <Link key={`article-${article.slug}`} to={`/articles/${article.slug}`} className="group grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"><span className="text-[.62rem] font-semibold text-accent">مقال مرتبط</span><strong className="text-[.78rem] font-semibold leading-relaxed text-ink group-hover:text-accent">{article.title}</strong><span className="text-[.64rem] text-soft">افتح</span></Link>)}
              {searchResults.papers.map(({ paper }) => <Link key={`paper-${paper.slug}`} to={`/research/${paper.slug}`} className="group grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-baseline"><span className="text-[.62rem] font-semibold text-accent">بحث مرتبط</span><strong className="text-[.78rem] font-semibold leading-relaxed text-ink group-hover:text-accent">{paper.titleAr || paper.title}</strong><span className="text-[.64rem] text-soft">افتح</span></Link>)}
            </div>}
            <div className="border-t border-hair py-4 text-left"><Link to={stagedSearchHref} className="text-[.68rem] font-semibold text-accent hover:underline">ابحث بعمق في متن الكتاب ←</Link></div>
          </div></FadeUp>}
        </div>
      </section>

      <section ref={videoSectionRef} id="encyclopedia-video" className="scroll-mt-24 border-b border-hair px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-video-title">
        <div className="mx-auto max-w-shell">
          <FadeUp><div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl"><span className="text-[.7rem] font-semibold text-accent">الموسوعة المرئية</span><h2 id="encyclopedia-video-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-semibold leading-[1.45] text-ink">الفيديو يعمل داخل الصفحة، ويرتبط ببابه وفصله.</h2></div>
            <div className="flex items-center gap-2">
              <strong className="text-[.68rem] font-semibold text-ink">{catalogLoading ? 'جارٍ بناء الفهرس…' : catalog?.count ? `${formatArabicNumber(catalog.count)} مقطعاً` : 'الفهرس يحتاج إعادة تحميل'}</strong>
              {catalogError && <button type="button" onClick={retryCatalog} aria-label="إعادة تحميل فهرس الفيديوهات" title="إعادة التحميل" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="History" size={15} /></button>}
              <a href={CHANNEL_URL} target="_blank" rel="noreferrer" aria-label="فتح قناة الموسوعة على يوتيوب" title="قناة الموسوعة" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="YouTube" size={16} /></a>
            </div>
          </div></FadeUp>

          <div className="mt-8 border-y border-hair py-4">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button type="button" onClick={() => { setActiveVideoDoor('all'); setActiveVideoChapter('all') }} className={`shrink-0 rounded-full px-4 py-2 text-[.68rem] font-semibold transition-colors ${activeVideoDoor === 'all' ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>الكل</button>
              {DOORS.map((door) => <button key={`filter-${door.id}`} type="button" onClick={() => { setActiveVideoDoor(door.id); setActiveVideoChapter('all') }} className={`shrink-0 rounded-full px-4 py-2 text-[.68rem] font-semibold transition-colors ${activeVideoDoor === door.id ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>الباب {door.number}</button>)}
            </div>
            {activeVideoDoor !== 'all' && availableChapters.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><button type="button" onClick={() => setActiveVideoChapter('all')} className={`shrink-0 text-[.64rem] font-semibold ${activeVideoChapter === 'all' ? 'text-accent' : 'text-soft hover:text-accent'}`}>كل فصول الباب</button>{availableChapters.map((chapter) => <button key={`chapter-${chapter}`} type="button" onClick={() => setActiveVideoChapter(chapter)} className={`shrink-0 text-[.64rem] font-semibold ${activeVideoChapter === chapter ? 'text-accent' : 'text-soft hover:text-accent'}`}>الفصل {formatArabicNumber(chapter)}</button>)}</div>}
          </div>

          {catalogError && !indexedVideos.length ? <FadeUp delay={0.06}><div className="mt-8 grid min-h-44 place-items-center border-y border-hair text-center"><div><p className="text-[.78rem] text-soft">تعذّر تحميل الفهرس الآن.</p><button type="button" onClick={retryCatalog} aria-label="إعادة تحميل فهرس الفيديوهات" title="إعادة التحميل" className="mx-auto mt-4 flex h-11 w-11 items-center justify-center rounded-full border border-accent/[.3] text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="History" size={16} /></button></div></div></FadeUp> : <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)] lg:gap-12">
            <FadeUp delay={0.04}>
              {selectedVideo ? <article className="overflow-hidden rounded-2xl border border-hair bg-canvas">
                <div className="relative aspect-video bg-ink">
                  {!playerReady ? <button type="button" onClick={() => setPlayerReady(true)} className="group absolute inset-0 flex items-center justify-center overflow-hidden" aria-label={`تشغيل ${selectedVideo.title}`}><img src={selectedVideo.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.015]" /><span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-canvas/[.92] text-accent shadow-lg"><SocialIcon name="Play" size={20} /></span></button> : <iframe src={selectedPlayerUrl} title={selectedVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 h-full w-full border-0" />}
                </div>
                <div className="p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[.62rem] font-semibold text-accent"><span>{videoSequence(selectedVideo)}</span>{selectedUnit && <span>· {selectedUnit.title}</span>}{activeMoment?.source === 'captions' && <span>· يبدأ من {formatMomentTime(activeMoment.startSeconds)}</span>}</div>
                  <h3 className="mt-2 font-display text-[1.18rem] font-semibold leading-[1.65] text-ink">{selectedVideo.title}</h3>
                  {activeMoment?.excerpt && <p className="mt-3 border-s-2 border-accent/[.3] ps-3 text-[.72rem] leading-[1.85] text-soft">{activeMoment.excerpt}</p>}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {selectedDoor && <Link to={`/publications/${book.slug}?book_idea=${encodeURIComponent(selectedUnit?.title || selectedVideo.concept?.title || selectedDoor.title)}#book-knowledge`} className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.68rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">اقرأ الأصل</Link>}
                    {selectedDoor?.presentation && <button type="button" onClick={() => openTeachingMaterials(selectedDoor, selectedUnit?.title || activeMoment?.topic || selectedVideo.concept?.title)} className="inline-flex min-h-10 items-center rounded-full border border-accent/[.3] px-4 text-[.68rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">مواد التدريس</button>}
                    <a href={selectedChannelUrl} target="_blank" rel="noreferrer" aria-label="فتح هذا الفيديو على يوتيوب" title="فتح على يوتيوب" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="YouTube" size={15} /></a>
                  </div>
                  {(previousVideo || nextVideo) && <div className="mt-6 grid grid-cols-2 gap-3 border-t border-hair pt-5"><button type="button" disabled={!previousVideo} onClick={() => previousVideo && selectVideo(previousVideo, false)} className="min-h-11 rounded-xl border border-hair px-4 text-right text-[.68rem] font-semibold text-ink transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-35">→ السابق</button><button type="button" disabled={!nextVideo} onClick={() => nextVideo && selectVideo(nextVideo, false)} className="min-h-11 rounded-xl border border-hair px-4 text-left text-[.68rem] font-semibold text-ink transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-35">التالي ←</button></div>}
                </div>
              </article> : <div className="aspect-video animate-pulse rounded-2xl border border-hair bg-wash" aria-label="جارٍ تحميل المقطع" />}
            </FadeUp>

            <FadeUp delay={0.08}><aside aria-label="فهرس فيديوهات الموسوعة">
              <label htmlFor="encyclopedia-video-query" className="text-[.68rem] font-semibold text-accent">ابحث داخل المقاطع</label>
              <div className="mt-2 flex items-center rounded-full border border-hair bg-canvas px-4"><SocialIcon name="Search" size={13} /><input id="encyclopedia-video-query" value={videoQuery} onChange={(event) => setVideoQuery(event.target.value)} placeholder="عنوان، مفهوم، باب أو فصل" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[.75rem] text-ink outline-none placeholder:text-soft/[.55]" />{videoQuery && <button type="button" onClick={() => setVideoQuery('')} aria-label="مسح البحث" title="مسح البحث" className="text-soft hover:text-accent"><SocialIcon name="Close" size={12} /></button>}</div>
              <div className="mt-4 max-h-[36rem] overflow-y-auto border-y border-hair pe-1 [scrollbar-color:var(--color-hair)_transparent] [scrollbar-width:thin]">
                {catalogLoading && !indexedVideos.length ? Array.from({ length: 7 }, (_, index) => <div key={`video-loading-${index}`} className="border-b border-hair py-4 last:border-b-0"><span className="block h-2.5 w-20 animate-pulse rounded bg-wash" /><span className="mt-2 block h-3 w-[85%] animate-pulse rounded bg-wash" /></div>) : listedVideos.length ? listedVideos.slice(0, visibleVideoCount).map((video, index) => {
                  const active = selectedVideo?.id === video.id
                  const moment = videoMomentMap.get(video.id) || null
                  return <button key={video.id} type="button" onClick={() => selectVideo(video, false, moment)} aria-current={active ? 'true' : undefined} className={`group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-hair py-4 text-right last:border-b-0 ${active ? 'text-accent' : 'text-ink'}`}><span className={`font-display text-[.64rem] ${active ? 'font-semibold text-accent' : 'text-soft'}`}>{formatArabicNumber(index + 1)}</span><span className="min-w-0"><span className="block text-[.61rem] font-semibold text-accent/[.8]">{videoSequence(video)}</span><strong className="mt-1 block text-[.74rem] font-semibold leading-[1.7] transition-colors group-hover:text-accent">{video.title}</strong></span><span className="pt-0.5 text-[.61rem] text-soft">{moment?.source === 'captions' ? formatMomentTime(moment.startSeconds) : (video.durationText || 'مشاهدة')}</span></button>
                }) : <div className="py-7 text-[.74rem] leading-[1.8] text-soft">{videoMomentsLoading ? 'يُفحص الكلام المنطوق داخل المقاطع…' : 'لا يوجد مقطع مطابق. جرّب عبارة أقصر أو اعرض كل المقاطع.'}</div>}
              </div>
              {listedVideos.length > visibleVideoCount && <button type="button" onClick={() => setVisibleVideoCount((count) => count + 28)} className="mt-4 w-full rounded-full border border-hair py-2.5 text-[.68rem] font-semibold text-accent transition-colors hover:border-accent">عرض {formatArabicNumber(Math.min(28, listedVideos.length - visibleVideoCount))} مقطعاً آخر</button>}
              {!catalogLoading && listedVideos.length > 0 && <p className="mt-3 text-[.62rem] leading-relaxed text-soft">{formatArabicNumber(listedVideos.length)} نتيجة داخل الصفحة. يُحمّل مشغل واحد فقط.</p>}
              {transcriptProgress.running && <p className="mt-2 text-[.61rem] text-soft">تتوسع فهرسة الكلام المنطوق تدريجياً: {formatArabicNumber(transcriptProgress.completed)} من {formatArabicNumber(transcriptProgress.total)}.</p>}
            </aside></FadeUp>
          </div>}
        </div>
      </section>

      <section id="encyclopedia-teaching-kit" className="scroll-mt-24 border-b border-hair bg-wash/[.4] px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-kit-title">
        <div className="mx-auto max-w-shell"><FadeUp><div className="grid gap-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] lg:gap-14">
          <div><span className="text-[.7rem] font-semibold text-accent">مواد التدريس</span><h2 id="encyclopedia-kit-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-semibold leading-[1.45] text-ink">أربعة عروض جاهزة لمن يدرّس المادة.</h2><p className="mt-4 text-[.8rem] font-light leading-[1.9] text-soft">العروض تخص الأبواب الأربعة الأولى فقط؛ أما خريطة الكتاب والفيديوهات فتغطي الأبواب الخمسة.</p></div>
          <div className="border-y border-hair bg-canvas px-4 md:px-6">{PRESENTATION_DOORS.map((door) => {
            const teachingDoor = getEncyclopediaTeachingDoor(door.id)
            return <div key={`kit-${door.id}`} className="grid gap-3 border-b border-hair py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><span className="text-[.64rem] font-semibold text-accent">الباب {door.number}</span><strong className="mt-1 block text-[.88rem] leading-relaxed text-ink">{door.title}</strong><span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{teachingDoor ? `${formatArabicNumber(teachingDoor.slideCount)} شريحة · ${formatArabicNumber(teachingDoor.topics.length)} محاور مفهرسة` : 'عرض تقديمي قابل للتحميل'}{doorCounts.get(door.id) ? ` · ${formatArabicNumber(doorCounts.get(door.id) || 0)} مقطعاً` : ''}</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openVideoPath(door)} className="inline-flex min-h-10 w-fit items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">شاهد الباب</button><button type="button" onClick={() => openTeachingMaterials(door)} className="inline-flex min-h-10 w-fit items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">مواد الباب</button></div></div>
          })}</div>
        </div></FadeUp></div>
      </section>

      <section className="px-6 py-10 md:px-11 md:py-12"><div className="mx-auto flex max-w-shell items-center justify-between gap-5 border-y border-hair py-5"><div><span className="text-[.68rem] font-semibold text-accent">النسخة الأصلية</span><p className="mt-1 text-[.78rem] leading-relaxed text-soft">ملف PDF المعتمد متاح كما كان.</p></div>{book.pdf && <a href={book.pdf} target="_blank" rel="noreferrer" aria-label="فتح نسخة PDF من الموسوعة" title="فتح نسخة PDF" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/[.3] text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="CV" size={17} /></a>}</div></section>

      {teachingMaterial && <div className="encyclopedia-teaching-overlay fixed inset-0 z-[260] flex items-end justify-center bg-ink/[.28] backdrop-blur-[2px] md:items-stretch md:justify-end" onMouseDown={(event) => { if (event.currentTarget === event.target) setTeachingMaterial(null) }}>
        <aside role="dialog" aria-modal="true" aria-labelledby="encyclopedia-teaching-panel-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border-t border-hair bg-canvas px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-24px_70px_-48px_rgba(20,31,45,.7)] md:h-full md:max-h-none md:max-w-[28rem] md:rounded-none md:border-s md:border-t-0 md:px-8 md:pb-8 md:pt-7 md:shadow-[-24px_0_70px_-48px_rgba(20,31,45,.7)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hair md:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-5 border-b border-hair pb-5"><div className="min-w-0"><span className="text-[.66rem] font-semibold text-accent">مواد التدريس</span><h2 id="encyclopedia-teaching-panel-title" className="mt-1.5 font-display text-[1.35rem] font-semibold leading-[1.55] text-ink">{teachingMaterial.topic || teachingMaterial.door.title}</h2><p className="mt-1 text-[.69rem] leading-relaxed text-soft">{teachingGuide?.chapter || `الباب ${teachingMaterial.door.number} · ${teachingMaterial.door.title}`}</p></div><button type="button" onClick={() => setTeachingMaterial(null)} aria-label="إغلاق مواد التدريس" title="إغلاق" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"><SocialIcon name="Close" size={13} /></button></div>

          {teachingGuide ? <>
            <p className="border-b border-hair py-5 text-[.76rem] font-light leading-[1.9] text-ink/80">{teachingGuide.objective}</p>
            <div className="py-5"><span className="text-[.63rem] font-semibold text-soft">خيط المادة</span><div className="mt-3 grid grid-cols-2 border-y border-hair">{teachingConcept ? <Link to={`/publications/${book.slug}?book_idea=${encodeURIComponent(teachingConcept.title)}#book-knowledge`} onClick={() => setTeachingMaterial(null)} className="group min-w-0 border-e border-hair px-2 py-4 text-center transition-colors hover:bg-wash"><span className="block font-display text-[.64rem] text-accent">٠١</span><strong className="mt-1 block text-[.67rem] font-semibold leading-relaxed text-ink group-hover:text-accent">اقرأ الأصل</strong></Link> : <span className="min-w-0 border-e border-hair px-2 py-4 text-center opacity-45"><span className="block font-display text-[.64rem] text-soft">٠١</span><strong className="mt-1 block text-[.67rem] font-semibold leading-relaxed text-soft">اقرأ الأصل</strong></span>}<button type="button" onClick={playTeachingVideo} aria-busy={momentLoadingKey === `${teachingMaterial.door.id}:${teachingMaterial.topic || teachingGuide.title || teachingMaterial.door.title}`} className="group min-w-0 px-2 py-4 text-center transition-colors hover:bg-wash"><span className="block font-display text-[.64rem] text-accent">٠٢</span><strong className="mt-1 block text-[.67rem] font-semibold leading-relaxed text-ink group-hover:text-accent">شاهد الشرح</strong></button></div></div>
            <div className="border-y border-hair py-5"><div className="flex items-center justify-between gap-5"><div className="min-w-0"><span className="text-[.63rem] font-semibold text-accent">موضع الموضوع في العرض</span><p className="mt-1.5 font-display text-[1rem] font-semibold leading-[1.7] text-ink">{teachingSlideLabel}</p><p className="mt-1 text-[.66rem] leading-relaxed text-soft">{formatArabicNumber(teachingSlidesCount)} شريحة مرتبطة من أصل {formatArabicNumber(teachingDoorGuide?.slideCount || 0)} شريحة.</p></div><a href={teachingMaterial.door.presentation || undefined} download={`موسوعة تكنولوجيا التعليم - الباب ${teachingMaterial.door.number}.pptx`} aria-label="تحميل عرض الباب" title="تحميل عرض الباب" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/[.3] text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="Download" size={16} /></a></div>{teachingGuide.ranges.length > 1 && <div className="mt-4 border-t border-hair pt-3">{teachingGuide.ranges.map((range) => <div key={`${range.from}-${range.to}`} className="flex items-baseline justify-between gap-4 py-1.5 text-[.66rem]"><span className="min-w-0 text-soft">{range.label}</span><span className="shrink-0 font-semibold text-ink">{range.from === range.to ? formatArabicNumber(range.from) : `${formatArabicNumber(range.from)}–${formatArabicNumber(range.to)}`}</span></div>)}</div>}</div>
            <details className="group border-b border-hair py-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[.69rem] font-semibold text-ink marker:hidden [&::-webkit-details-marker]:hidden"><span>سؤال افتتاحي للمحاضرة</span><span aria-hidden className="text-accent transition-transform group-open:rotate-45">＋</span></summary><p className="pb-4 text-[.73rem] leading-[1.85] text-soft">{teachingGuide.discussion}</p></details>
          </> : <div className="py-5"><p className="text-[.74rem] font-light leading-[1.9] text-soft">اختر محوراً لعرض موضعه الدقيق والشرح المرئي الأقرب.</p><div className="mt-4 border-y border-hair">{teachingDoorGuide?.topics.map((topic) => <button key={topic.title} type="button" onClick={() => setTeachingMaterial({ door: teachingMaterial.door, topic: topic.title })} className="group flex w-full items-center justify-between gap-4 border-b border-hair py-3.5 text-right last:border-b-0"><span className="min-w-0"><strong className="block text-[.75rem] font-semibold leading-relaxed text-ink transition-colors group-hover:text-accent">{topic.title}</strong><span className="mt-0.5 block text-[.63rem] text-soft">{encyclopediaSlideRangeLabel(topic.ranges)}</span></span><span aria-hidden className="text-accent">←</span></button>)}</div>{teachingMaterial.door.presentation && <a href={teachingMaterial.door.presentation || undefined} download={`موسوعة تكنولوجيا التعليم - الباب ${teachingMaterial.door.number}.pptx`} aria-label="تحميل عرض الباب" title="تحميل عرض الباب" className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent/[.3] text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="Download" size={16} /></a>}</div>}
        </aside>
      </div>}
    </>
  )
}
