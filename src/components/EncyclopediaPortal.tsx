import { useEffect, useMemo, useRef, useState } from 'react'
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
  indexEncyclopediaVideos,
  normalizeEncyclopediaText,
  scoreIndexedVideo,
  type IndexedEncyclopediaVideo,
} from '../lib/encyclopedia-video-index'
import { FadeUp, Reveal } from './ui'
import { SocialIcon } from './icons'
import { OwnerEdit } from './extras'

const CHANNEL_URL = 'https://www.youtube.com/@موسوعةتكنولوجياالتعليم/videos'
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
    if (chapterNumber && video.chapterNumber && video.chapterNumber !== chapterNumber) return false
    return true
  })
  return candidates
    .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
    .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
    .find((item) => item.score > 0)?.video || candidates[0] || null
}

function videosForUnit(door: Door, unit: StructureUnit, videos: IndexedEncyclopediaVideo[]) {
  const exact = videos.filter((video) => video.doorId === door.id && video.chapterNumber === unit.number)
  if (exact.length) return exact
  const fallback = relatedVideoForText(`${unit.title} ${unit.keywords.join(' ')}`, videos, door)
  return fallback ? [fallback] : []
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

function DoorRow({
  door,
  concepts,
  videos,
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
  videos: IndexedEncyclopediaVideo[]
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
  const doorVideos = videos.filter((video) => video.doorId === door.id)
  const visibleUnits = useMemo(() => {
    if (!tokens.length) return door.units
    return door.units.filter((unit) => {
      const unitVideos = videosForUnit(door, unit, videos)
      return scoreText(tokens, `${door.title} ${unit.title} ${unit.keywords.join(' ')}`) > 0 || unitVideos.some((video) => scoreIndexedVideo(tokens, video) > 0)
    })
  }, [door, tokens, videos])
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
          <span className="mt-1 block text-[.69rem] leading-relaxed text-soft">{formatArabicNumber(door.units.length)} فصول · {formatArabicNumber(doorVideos.length)} فيديو</span>
        </span>
        <span aria-hidden className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
      </summary>

      <div className="pb-8 ps-[4.2rem] md:ps-[5.6rem]">
        <div className="border-y border-hair" aria-label="فهرس فيديوهات الموسوعة">
          {visibleUnits.map((unit) => {
            const unitVideos = videosForUnit(door, unit, videos)
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
                  <div dir="rtl" className="-mx-1 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:none] [touch-action:pan-x_pinch-zoom] [&::-webkit-scrollbar]:hidden">
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
  const playingVideo = indexedVideos.find((video) => video.id === playingVideoId) || null
  const selectedPlayerUrl = playingVideo
    ? `${playingVideo.embedUrl}${playingVideo.embedUrl.includes('?') ? '&' : '?'}autoplay=1&playsinline=1&rel=0&modestbranding=1`
    : ''
  const tokens = useMemo(() => encyclopediaTokens(query), [query])

  const searchResults = useMemo(() => ({
    units: DOORS.flatMap((door) => door.units.map((unit) => ({ door, unit, score: scoreText(tokens, `${door.title} ${unit.title} ${unit.keywords.join(' ')}`) })))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score),
    videos: indexedVideos
      .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.video.position - right.video.position),
    slides: encyclopediaTeachingTopics
      .map((topic) => ({ topic, score: scoreEncyclopediaTeachingTopic(tokens, topic) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score),
  }), [indexedVideos, tokens])

  const resultCount = query.trim().length >= 2
    ? searchResults.units.length + searchResults.videos.length + searchResults.slides.length
    : 0

  const playVideo = (video: IndexedEncyclopediaVideo) => {
    setPlayingVideoId(video.id)
    window.requestAnimationFrame(() => document.getElementById(`video-${video.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const openVideoPath = (door: Door, unit?: StructureUnit) => {
    const video = unit
      ? videosForUnit(door, unit, indexedVideos)[0]
      : indexedVideos.find((item) => item.doorId === door.id)
    if (video) playVideo(video)
  }

  const openTeachingMaterials = (door: Door, topic?: string) => {
    if (!door.presentation) return
    setTeachingMaterial({ door, topic })
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
    ? relatedVideoForText(`${teachingGuide.title} ${teachingGuide.videoHints.join(' ')}`, indexedVideos, teachingMaterial.door, teachingGuide.chapterNumbers[0])
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
                    <a href={book.pdf} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-3 rounded-full border border-hair px-5 text-[.78rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">
                      <span>عرض عيّنة الكتاب</span>
                      <span className="text-[.72rem] text-soft">PDF</span>
                      <span className="sr-only">ملف PDF المعتمد متاح كما كان</span>
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
                videos={indexedVideos}
                query={query}
                initiallyOpen={index === 0}
                playingVideoId={playingVideoId}
                selectedPlayerUrl={selectedPlayerUrl}
                onPlay={playVideo}
                onOpenPath={openVideoPath}
                onOpenTeaching={openTeachingMaterials}
              />
            ))}
          </div>
          {!catalog && !catalogError && <p className="mt-4 text-[.65rem] text-soft">تُحمّل الفيديوهات بهدوء.</p>}
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
