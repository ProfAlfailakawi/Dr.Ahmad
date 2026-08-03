import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { getBookKnowledge, type BookKnowledgeConcept } from '../lib/book-knowledge'
import { arabicCountPhrase, PAGE_FORMS } from '../lib/arabic-count.ts'
import { getEncyclopediaVideoCatalog, type EncyclopediaVideoCatalog } from '../lib/encyclopedia-videos'
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

const scoreText = (tokens: readonly string[], value = '') => {
  const normalized = normalizeEncyclopediaText(value)
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? (token.length >= 6 ? 3 : 2) : 0), 0)
}

const DOORS = [
  {
    id: 'door-1', doorNumber: 1, number: '٠١', title: 'المفاهيم والأسس',
    summary: 'مفهوم تكنولوجيا التعليم، وتصميم التدريس، والوسائل التعليمية، والمفاهيم المتداخلة معها.',
    topics: ['مفهوم تكنولوجيا التعليم', 'التدريس والتعليم والتعلّم', 'تصميم التدريس', 'تصميم التعليم', 'الاتصال التعليمي', 'الوسائل التعليمية'],
    presentation: '/files/encyclopedia/encyclopedia-door-1.pptx',
    hints: ['مفهوم تكنولوجيا التعليم', 'تصميم التدريس', 'الوسائل التعليمية'],
  },
  {
    id: 'door-2', doorNumber: 2, number: '٠٢', title: 'المستحدثات والإنترنت في التعليم',
    summary: 'خصائص المستحدثات، وتوظيفها وأثرها ومعوقاتها، واستخدام الإنترنت في التعليم.',
    topics: ['المستحدثات التكنولوجية', 'خصائص المستحدثات', 'توظيف المستحدثات', 'معوقات التوظيف', 'الإنترنت في التعليم', 'التعلّم عبر الإنترنت'],
    presentation: '/files/encyclopedia/encyclopedia-door-2.pptx',
    hints: ['المستحدثات', 'الإنترنت في التعليم'],
  },
  {
    id: 'door-3', doorNumber: 3, number: '٠٣', title: 'نماذج التعليم الإلكتروني والتعليم عن بُعد',
    summary: 'الحوسبة السحابية، والفصول المقلوبة، والتعليم المخلوط، وأجيال الويب، والكتاب الإلكتروني.',
    topics: ['الحوسبة السحابية', 'الفصول المقلوبة', 'التعليم المخلوط', 'الويب في التعليم', 'الكتاب الإلكتروني', 'التعليم عن بُعد'],
    presentation: '/files/encyclopedia/encyclopedia-door-3.pptx',
    hints: ['التعليم الإلكتروني', 'التعليم عن بعد', 'الحوسبة السحابية', 'الكتاب الإلكتروني'],
  },
  {
    id: 'door-4', doorNumber: 4, number: '٠٤', title: 'تعليم القرن الحادي والعشرين',
    summary: 'دور المعلم والمتعلم، ومهارات القرن الحادي والعشرين، وتصنيف بلوم، والفجوة الرقمية.',
    topics: ['معلم القرن الحادي والعشرين', 'مهارات المتعلم', 'تصنيف بلوم', 'تصنيف بلوم الرقمي', 'الفجوة الرقمية', 'التربية المستدامة'],
    presentation: '/files/encyclopedia/encyclopedia-door-4.pptx',
    hints: ['القرن الحادي والعشرين', 'بلوم', 'الفجوة الرقمية'],
  },
] as const

type Door = (typeof DOORS)[number]
type DoorFilter = 'all' | Door['id']
type AudienceKey = 'student' | 'teacher' | 'faculty' | 'family'

const AUDIENCES: Record<AudienceKey, { label: string; title: string; text: string; steps: string[]; action: string; href: string }> = {
  student: { label: 'الطالب', title: 'ادرس بترتيب واضح، ثم ارجع إلى المصدر.', text: 'اختر الباب، اقرأ محاوره، شاهد الشرح، ثم حمّل العرض للمراجعة.', steps: ['اختر الباب', 'اقرأ المفهوم', 'شاهد شرحه', 'راجع العرض'], action: 'ابدأ خريطة الموسوعة', href: '#encyclopedia-map' },
  teacher: { label: 'المعلم', title: 'حوّل المادة إلى درس من غير أن تبدأ من الصفر.', text: 'العروض جاهزة للتدريس، والفيديوهات مرتبطة بموضوعات الأبواب، والنص الأصلي يبقى مرجعك.', steps: ['حدّد الموضوع', 'حمّل العرض', 'اختر الفيديو', 'ارجع إلى الفصل'], action: 'افتح حقيبة التدريس', href: '#encyclopedia-teaching-kit' },
  faculty: { label: 'الأستاذ والمدرب', title: 'مرجع، ومادة محاضرة، ومسار مشاهدة في مكان واحد.', text: 'ابنِ محاضرة أو مقرراً، وشارك روابط موضوعية، وابحث في المتن بدل تصفح مئات الصفحات.', steps: ['ابنِ المسار', 'شارك الباب', 'استخدم الشرائح', 'وسّع بالمراجع'], action: 'ابحث في الموسوعة', href: '#encyclopedia-search' },
  family: { label: 'ولي الأمر والقارئ', title: 'ادخل من السؤال، لا من المصطلح الأكاديمي.', text: 'اكتب ما يشغلك في التعليم والتكنولوجيا؛ وستقودك الصفحة إلى أقرب مفهوم وفيديو وفصل.', steps: ['اكتب سؤالك', 'اقرأ النتيجة', 'شاهد التفسير', 'توسّع عند الحاجة'], action: 'اكتب سؤالك', href: '#encyclopedia-search' },
}

function conceptForDoor(door: Door, concepts: BookKnowledgeConcept[]) {
  const hints = door.hints.map(normalizeEncyclopediaText)
  return concepts.find((concept) => {
    const haystack = normalizeEncyclopediaText(`${concept.title} ${concept.keywords.join(' ')}`)
    return hints.some((hint) => haystack.includes(hint) || hint.includes(normalizeEncyclopediaText(concept.title)))
  }) || null
}

function doorForVideo(video: IndexedEncyclopediaVideo | null) {
  if (!video?.doorId) return null
  return DOORS.find((door) => door.id === video.doorId) || null
}

function videoSequence(video: IndexedEncyclopediaVideo) {
  const parts: string[] = []
  if (video.doorNumber) parts.push(`الباب ${formatArabicNumber(video.doorNumber)}`)
  if (video.chapterNumber) parts.push(`الفصل ${formatArabicNumber(video.chapterNumber)}`)
  if (video.videoNumber) parts.push(`المقطع ${formatArabicNumber(video.videoNumber)}`)
  return parts.join(' · ') || 'من الموسوعة المرئية'
}

function relatedVideoForConcept(concept: BookKnowledgeConcept, videos: IndexedEncyclopediaVideo[]) {
  const direct = videos.find((video) => video.concept?.id === concept.id)
  if (direct) return direct
  const tokens = encyclopediaTokens(`${concept.title} ${concept.keywords.join(' ')}`)
  return videos
    .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.video || null
}

function DoorRow({
  door,
  concept,
  initiallyOpen,
  videoCount,
  catalogLoading,
  onOpenTopic,
  onOpenPath,
}: {
  door: Door
  concept: BookKnowledgeConcept | null
  initiallyOpen: boolean
  videoCount: number
  catalogLoading: boolean
  onOpenTopic: (topic: string, door: Door) => void
  onOpenPath: (door: Door) => void
}) {
  const bookHref = concept ? `/publications/encyclopedia?book_idea=${encodeURIComponent(concept.title)}#book-knowledge` : '#book-knowledge'
  const countLabel = catalogLoading
    ? 'تُفهرس المقاطع الآن'
    : videoCount > 0
      ? `${formatArabicNumber(videoCount)} مقطعاً مرتبطاً`
      : 'مسار مرئي'
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (initiallyOpen && detailsRef.current) detailsRef.current.open = true
  }, [initiallyOpen])

  return (
    <details ref={detailsRef} id={door.id} className="group scroll-mt-28 border-b border-hair last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-4 py-6 marker:hidden [&::-webkit-details-marker]:hidden md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-6 md:py-8">
        <span className="font-display text-[.72rem] font-semibold text-accent">{door.number}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="font-display text-[1.18rem] font-semibold leading-[1.55] text-ink md:text-[1.35rem]">{door.title}</strong><span className="text-[.62rem] text-soft">{countLabel}</span></span>
          <span className="mt-1.5 block max-w-3xl text-[.78rem] font-light leading-[1.85] text-soft md:text-[.84rem]">{door.summary}</span>
        </span>
        <span aria-hidden className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
      </summary>
      <div className="grid gap-6 pb-8 ps-[4.1rem] md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:ps-[5.5rem]">
        <div className="border-y border-hair">
          {door.topics.map((topic) => (
            <div key={topic} className="flex min-w-0 items-center justify-between gap-4 border-b border-hair py-3 last:border-b-0">
              <span className="min-w-0 text-[.78rem] leading-relaxed text-ink">{topic}</span>
              <button type="button" onClick={() => onOpenTopic(topic, door)} className="shrink-0 text-[.66rem] font-semibold text-accent transition-opacity hover:opacity-65">شاهد شرحه ←</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 md:max-w-[18rem] md:justify-end">
          <Link to={bookHref} className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">ابدأ من الكتاب</Link>
          <button type="button" onClick={() => onOpenPath(door)} className="inline-flex min-h-10 items-center rounded-full border border-accent/30 px-4 text-[.7rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">المسار المرئي</button>
          <a href={door.presentation} download={`موسوعة تكنولوجيا التعليم - الباب ${door.number}.pptx`} className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[.7rem] font-semibold text-white transition-colors hover:bg-accent-deep">تحميل العرض</a>
        </div>
      </div>
    </details>
  )
}

export function EncyclopediaPortal({ book, articles, papers }: { book: BookRecord; articles: ArticleRecord[]; papers: PaperRecord[] }) {
  const knowledge = getBookKnowledge(book.slug)
  const concepts = useMemo(() => knowledge?.concepts.filter((concept) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)/u.test(concept.title)) || [], [knowledge])
  const [audience, setAudience] = useState<AudienceKey>('student')
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState<EncyclopediaVideoCatalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [activeVideoDoor, setActiveVideoDoor] = useState<DoorFilter>('all')
  const [videoQuery, setVideoQuery] = useState('')
  const [visibleVideoCount, setVisibleVideoCount] = useState(24)
  const [playerReady, setPlayerReady] = useState(false)
  const videoSectionRef = useRef<HTMLElement | null>(null)
  const pageCount = Number(book.pageCount) || 696
  const activeAudience = AUDIENCES[audience]
  const tokens = useMemo(() => encyclopediaTokens(query), [query])

  useEffect(() => {
    const controller = new AbortController()
    getEncyclopediaVideoCatalog(controller.signal)
      .then((payload) => { setCatalog(payload); setCatalogError(false) })
      .catch((error) => { if ((error as { name?: string })?.name !== 'AbortError') setCatalogError(true) })
    return () => controller.abort()
  }, [])

  const indexedVideos = useMemo(
    () => indexEncyclopediaVideos(catalog?.videos || [], DOORS, concepts),
    [catalog, concepts],
  )

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

  const selectedVideo = indexedVideos.find((video) => video.id === selectedVideoId) || indexedVideos[0] || null
  const selectedDoor = doorForVideo(selectedVideo)
  const doorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const video of indexedVideos) if (video.doorId) counts.set(video.doorId, (counts.get(video.doorId) || 0) + 1)
    return counts
  }, [indexedVideos])

  const videoTokens = useMemo(() => encyclopediaTokens(videoQuery), [videoQuery])
  const filteredVideos = useMemo(() => {
    const filtered = indexedVideos.filter((video) => {
      if (activeVideoDoor !== 'all' && video.doorId !== activeVideoDoor) return false
      return !videoTokens.length || scoreIndexedVideo(videoTokens, video) > 0
    })
    if (!videoTokens.length) return filtered
    return filtered
      .map((video) => ({ video, score: scoreIndexedVideo(videoTokens, video) }))
      .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
      .map((item) => item.video)
  }, [activeVideoDoor, indexedVideos, videoTokens])

  useEffect(() => {
    setVisibleVideoCount(24)
  }, [activeVideoDoor, videoQuery])

  useEffect(() => {
    if (!filteredVideos.length) return
    setSelectedVideoId((current) => (
      current && filteredVideos.some((video) => video.id === current)
        ? current
        : filteredVideos[0].id
    ))
  }, [filteredVideos])

  const selectedPath = useMemo(() => {
    if (!selectedVideo) return []
    return selectedVideo.doorId ? indexedVideos.filter((video) => video.doorId === selectedVideo.doorId) : indexedVideos
  }, [indexedVideos, selectedVideo])
  const selectedPathIndex = selectedVideo ? selectedPath.findIndex((video) => video.id === selectedVideo.id) : -1
  const previousVideo = selectedPathIndex > 0 ? selectedPath[selectedPathIndex - 1] : null
  const nextVideo = selectedPathIndex >= 0 && selectedPathIndex < selectedPath.length - 1 ? selectedPath[selectedPathIndex + 1] : null

  const selectVideo = (video: IndexedEncyclopediaVideo, scroll = true) => {
    setSelectedVideoId(video.id)
    if (scroll) window.requestAnimationFrame(() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const openVideoPath = (door: Door) => {
    setActiveVideoDoor(door.id)
    setVideoQuery('')
    const first = indexedVideos.find((video) => video.doorId === door.id)
    if (first) setSelectedVideoId(first.id)
    window.requestAnimationFrame(() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const openVideoTopic = (topic: string, door: Door) => {
    setActiveVideoDoor(door.id)
    setVideoQuery(topic)
    const topicTokens = encyclopediaTokens(topic)
    const first = indexedVideos
      .filter((video) => video.doorId === door.id)
      .map((video) => ({ video, score: scoreIndexedVideo(topicTokens, video) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.video
    if (first) setSelectedVideoId(first.id)
    window.requestAnimationFrame(() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const searchResults = useMemo(() => {
    if (!tokens.length) return { concepts: [], doors: [], videos: [], articles: [], papers: [] }
    return {
      concepts: concepts
        .map((concept) => ({ concept, score: scoreText(tokens, `${concept.title} ${concept.keywords.join(' ')} ${concept.summary} ${concept.question}`), video: relatedVideoForConcept(concept, indexedVideos) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 4),
      doors: DOORS
        .map((door) => ({ door, score: scoreText(tokens, `${door.title} ${door.summary} ${door.topics.join(' ')}`) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 2),
      videos: indexedVideos
        .map((video) => ({ video, score: scoreIndexedVideo(tokens, video) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
        .slice(0, 6),
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

  const hasSearchResults = searchResults.concepts.length > 0 || searchResults.doors.length > 0 || searchResults.videos.length > 0 || searchResults.articles.length > 0 || searchResults.papers.length > 0
  const stagedSearchHref = query.trim().length >= 2 ? `/publications/${book.slug}?book_question=${encodeURIComponent(query.trim())}#ask-book-section` : '#encyclopedia-search'
  const catalogLoading = !catalog && !catalogError
  const videoCountLabel = catalog?.count ? `${formatArabicNumber(catalog.count)} فيديو` : 'المكتبة المرئية'

  return (
    <>
      <section className="encyclopedia-hero relative overflow-hidden border-b border-hair px-6 pb-14 pt-28 md:px-11 md:pb-20 md:pt-40">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-[9rem] h-px bg-gradient-to-l from-transparent via-accent/20 to-transparent md:top-[12rem]" />
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
                <p className="mt-6 max-w-3xl text-[1rem] font-light leading-[2] text-ink/80 md:text-[1.08rem]">ثمرة أكثر من خمس سنوات من العمل؛ جُمعت هنا لتُقرأ وتُشاهد وتُدرّس ويُبحث فيها من مكان واحد.</p>
              </FadeUp>
              <FadeUp delay={0.13}>
                <nav className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hair bg-hair sm:grid-cols-4" aria-label="مداخل الموسوعة">
                  {[['اقرأ', '#encyclopedia-map'], ['شاهد', '#encyclopedia-video'], ['حمّل العروض', '#encyclopedia-teaching-kit'], ['ابحث', '#encyclopedia-search']].map(([label, href]) => <a key={href} href={href} className="flex min-h-14 items-center justify-center bg-canvas px-3 text-center text-[.76rem] font-semibold text-ink transition-colors hover:bg-wash hover:text-accent">{label}</a>)}
                </nav>
              </FadeUp>
              <FadeUp delay={0.18}>
                <dl className="mt-7 flex flex-wrap gap-x-7 gap-y-3 border-t border-hair pt-5 text-[.7rem] text-soft">
                  <div><dt className="sr-only">الأبواب</dt><dd><strong className="font-semibold text-ink">٤</strong> أبواب</dd></div>
                  <div><dt className="sr-only">الصفحات</dt><dd><strong className="font-semibold text-ink">{arabicCountPhrase(pageCount, PAGE_FORMS, formatArabicNumber)}</strong></dd></div>
                  <div><dt className="sr-only">العروض</dt><dd><strong className="font-semibold text-ink">٤</strong> عروض جاهزة</dd></div>
                  <div><dt className="sr-only">الفيديوهات</dt><dd><strong className="font-semibold text-ink">{videoCountLabel}</strong></dd></div>
                  {book.year && <div><dt className="sr-only">سنة النشر</dt><dd><strong className="font-semibold text-ink">{book.year}</strong> سنة النشر</dd></div>}
                  {book.isbn && <div><dt className="sr-only">الردمك</dt><dd dir="ltr" className="text-left"><strong className="font-semibold text-ink">{book.isbn}</strong> <span dir="rtl">ردمك</span></dd></div>}
                </dl>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-hair px-6 py-12 md:px-11 md:py-16" aria-labelledby="encyclopedia-audience-title">
        <div className="mx-auto max-w-shell"><FadeUp><div className="grid gap-8 lg:grid-cols-[minmax(0,.65fr)_minmax(0,1.35fr)] lg:gap-14">
          <div><span className="text-[.7rem] font-semibold text-accent">ابدأ من حاجتك</span><h2 id="encyclopedia-audience-title" className="mt-2 font-display text-[clamp(1.45rem,3vw,2.15rem)] font-semibold leading-[1.45] text-ink">الموسوعة نفسها، لكن الطريق يتغيّر بحسب القارئ.</h2></div>
          <div>
            <div role="tablist" aria-label="اختر طريقة الاستفادة" className="flex max-w-full gap-1 overflow-x-auto border-b border-hair pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(Object.entries(AUDIENCES) as [AudienceKey, (typeof AUDIENCES)[AudienceKey]][]).map(([key, item]) => <button key={key} type="button" role="tab" aria-selected={audience === key} onClick={() => setAudience(key)} className={`shrink-0 rounded-full px-4 py-2 text-[.72rem] font-semibold transition-colors ${audience === key ? 'bg-accent text-white' : 'text-soft hover:bg-wash hover:text-ink'}`}>{item.label}</button>)}
            </div>
            <div className="pt-6" role="tabpanel"><h3 className="font-display text-[1.2rem] font-semibold leading-[1.6] text-ink">{activeAudience.title}</h3><p className="mt-2 max-w-3xl text-[.84rem] font-light leading-[1.9] text-soft">{activeAudience.text}</p><ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3 text-[.7rem] text-soft">{activeAudience.steps.map((step, index) => <li key={step} className="flex items-center gap-2"><span className="font-display text-accent">{['٠١', '٠٢', '٠٣', '٠٤'][index]}</span><span>{step}</span>{index < activeAudience.steps.length - 1 && <span aria-hidden className="text-hair">←</span>}</li>)}</ol><a href={activeAudience.href} className="mt-6 inline-flex min-h-10 items-center rounded-full border border-accent/30 px-4 text-[.72rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">{activeAudience.action} ←</a></div>
          </div>
        </div></FadeUp></div>
      </section>

      <section id="encyclopedia-map" className="scroll-mt-24 border-b border-hair px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-map-title">
        <div className="mx-auto max-w-shell">
          <FadeUp><div className="max-w-3xl"><span className="text-[.7rem] font-semibold text-accent">خريطة الموسوعة</span><h2 id="encyclopedia-map-title" className="mt-2 font-display text-[clamp(1.6rem,3.4vw,2.45rem)] font-semibold leading-[1.4] text-ink">أربعة أبواب، وكل باب يفتح النص والفيديو والعرض معاً.</h2></div></FadeUp>
          <div className="mt-8 border-y border-hair">{DOORS.map((door, index) => <DoorRow key={door.id} door={door} concept={conceptForDoor(door, concepts)} initiallyOpen={index === 0} videoCount={doorCounts.get(door.id) || 0} catalogLoading={catalogLoading} onOpenTopic={openVideoTopic} onOpenPath={openVideoPath} />)}</div>
        </div>
      </section>

      <section id="encyclopedia-search" className="scroll-mt-24 border-b border-hair bg-wash/40 px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-search-title">
        <div className="mx-auto max-w-4xl">
          <FadeUp>
            <span className="text-[.7rem] font-semibold text-accent">بحث موحّد</span>
            <h2 id="encyclopedia-search-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.3rem)] font-semibold leading-[1.45] text-ink">اكتب سؤالاً أو مفهوماً.</h2>
            <form onSubmit={(event) => { event.preventDefault(); document.getElementById('encyclopedia-search-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }} className="mt-7 flex items-center gap-2 rounded-full border border-hair bg-canvas p-1.5 shadow-[0_18px_55px_-45px_rgba(20,31,45,.5)]">
              <label htmlFor="encyclopedia-query" className="sr-only">ابحث في موسوعة تكنولوجيا التعليم</label>
              <input id="encyclopedia-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: الفصول المقلوبة، دور المعلم، الفجوة الرقمية…" className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[.84rem] text-ink outline-none placeholder:text-soft/60" />
              <button type="submit" disabled={query.trim().length < 2} aria-label="اعرض نتائج الموسوعة" title="اعرض نتائج الموسوعة" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${query.trim().length >= 2 ? 'bg-accent text-white hover:bg-accent-deep' : 'cursor-not-allowed bg-wash text-soft'}`}><SocialIcon name="Search" size={16} /></button>
            </form>
          </FadeUp>

          {query.trim().length >= 2 && <FadeUp delay={0.06}><div id="encyclopedia-search-results" className="mt-6 scroll-mt-28 border-y border-hair bg-canvas px-4 py-1 md:px-6">
            {!hasSearchResults ? <div className="py-6 text-[.78rem] leading-relaxed text-soft">لم يظهر مدخل مختصر بعد. افتح البحث العميق في متن الموسوعة لفحص المقاطع والعناوين كاملة.</div> : <div className="divide-y divide-hair">
              {searchResults.concepts.map(({ concept, video }) => <div key={`concept-${concept.id}`} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div><span className="text-[.64rem] font-semibold text-accent">من الكتاب · ص {formatArabicNumber(concept.pageStart)}</span><h3 className="mt-1 text-[.9rem] font-semibold leading-relaxed text-ink">{concept.title}</h3><p className="mt-1 text-[.73rem] leading-[1.8] text-soft">{concept.summary}</p></div><div className="flex flex-wrap gap-3 text-[.68rem] font-semibold"><Link to={`/publications/${book.slug}?book_idea=${encodeURIComponent(concept.title)}#book-knowledge`} className="text-accent hover:underline">افتح في الكتاب</Link>{video && <button type="button" onClick={() => selectVideo(video)} className="text-accent hover:underline">شاهد شرحه</button>}</div></div>)}
              {searchResults.videos.map(({ video }) => <button key={`video-${video.id}`} type="button" onClick={() => { setActiveVideoDoor(video.doorId as DoorFilter || 'all'); setVideoQuery(query); selectVideo(video) }} className="group flex w-full items-center justify-between gap-5 py-4 text-right"><span className="min-w-0"><span className="text-[.64rem] font-semibold text-accent">مقطع مرئي · {videoSequence(video)}</span><strong className="mt-1 block truncate text-[.84rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{video.title}</strong></span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-colors group-hover:border-accent"><SocialIcon name="Play" size={12} /></span></button>)}
              {searchResults.doors.map(({ door }) => <div key={`door-${door.id}`} className="flex items-center justify-between gap-4 py-4"><span><span className="text-[.64rem] font-semibold text-accent">باب كامل</span><strong className="mt-1 block text-[.84rem] text-ink">{door.title}</strong></span><button type="button" onClick={() => openVideoPath(door)} className="shrink-0 text-[.68rem] font-semibold text-accent">افتح مساره ←</button></div>)}
              {searchResults.articles.map(({ article }) => <Link key={`article-${article.slug}`} to={`/articles/${article.slug}`} className="group flex items-center justify-between gap-4 py-4"><span><span className="text-[.64rem] font-semibold text-accent">مقال مرتبط</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{article.title}</strong></span><span className="text-soft">←</span></Link>)}
              {searchResults.papers.map(({ paper }) => <Link key={`paper-${paper.slug}`} to={`/research/${paper.slug}`} className="group flex items-center justify-between gap-4 py-4"><span><span className="text-[.64rem] font-semibold text-accent">بحث مرتبط</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{paper.titleAr || paper.title}</strong></span><span className="text-soft">←</span></Link>)}
            </div>}
            <div className="border-t border-hair py-4"><Link to={stagedSearchHref} className="text-[.72rem] font-semibold text-accent">ابحث بعمق داخل متن الموسوعة الموثق ←</Link></div>
          </div></FadeUp>}
        </div>
      </section>

      <section ref={videoSectionRef} id="encyclopedia-video" className="scroll-mt-24 border-b border-hair px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-video-title">
        <div className="mx-auto max-w-shell">
          <FadeUp><div className="flex flex-col justify-between gap-5 border-b border-hair pb-7 md:flex-row md:items-end">
            <div className="max-w-3xl"><span className="text-[.7rem] font-semibold text-accent">الموسوعة المرئية</span><h2 id="encyclopedia-video-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-semibold leading-[1.45] text-ink">الفيديو طريق ثانٍ إلى الفصل نفسه.</h2><p className="mt-3 text-[.8rem] font-light leading-[1.9] text-soft">تُفهرس القناة تلقائياً، وتُرتب المقاطع بحسب الباب والفصل، ويقود كل مقطع إلى النص والعرض المرتبطين به.</p></div>
            <div className="flex items-center gap-3 text-[.68rem] text-soft"><strong className="font-semibold text-ink">{catalogLoading ? 'جارٍ بناء الفهرس…' : catalog?.count ? `${formatArabicNumber(catalog.count)} مقطعاً` : 'الفهرس غير متاح الآن'}</strong><span aria-hidden>·</span><a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">القناة الأصلية</a></div>
          </div></FadeUp>

          {catalogError && !indexedVideos.length ? <FadeUp delay={0.06}><div className="mt-8 flex flex-col justify-between gap-4 border-y border-hair py-6 sm:flex-row sm:items-center"><p className="max-w-2xl text-[.78rem] leading-[1.9] text-soft">تعذّر تحديث فهرس القناة في هذه اللحظة. تبقى العروض والكتاب متاحين، ويمكن فتح القناة الأصلية إلى أن يعود الفهرس.</p><a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-10 w-fit items-center rounded-full border border-accent/30 px-4 text-[.7rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">افتح القناة</a></div></FadeUp> : <>
            <FadeUp delay={0.05}><div className="flex max-w-full gap-1 overflow-x-auto border-b border-hair py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="تصفية فيديوهات الموسوعة">
              <button type="button" onClick={() => { setActiveVideoDoor('all'); setVideoQuery('') }} aria-pressed={activeVideoDoor === 'all'} className={`shrink-0 rounded-full px-4 py-2 text-[.7rem] font-semibold transition-colors ${activeVideoDoor === 'all' ? 'bg-accent text-white' : 'text-soft hover:bg-wash hover:text-ink'}`}>كل المقاطع</button>
              {DOORS.map((door) => <button key={`filter-${door.id}`} type="button" onClick={() => { setActiveVideoDoor(door.id); setVideoQuery('') }} aria-pressed={activeVideoDoor === door.id} className={`shrink-0 rounded-full px-4 py-2 text-[.7rem] font-semibold transition-colors ${activeVideoDoor === door.id ? 'bg-accent text-white' : 'text-soft hover:bg-wash hover:text-ink'}`}>الباب {door.number}<span className="ms-1 opacity-70">{doorCounts.get(door.id) ? `(${formatArabicNumber(doorCounts.get(door.id) || 0)})` : ''}</span></button>)}
            </div></FadeUp>

            <div className="mt-8 grid gap-9 lg:grid-cols-[minmax(0,1.28fr)_minmax(18rem,.72fr)] lg:gap-12">
              <FadeUp>
                {selectedVideo ? <article aria-live="polite">
                  <div className="overflow-hidden rounded-2xl border border-hair bg-ink shadow-[0_24px_70px_-48px_rgba(20,31,45,.55)]">
                    {playerReady ? <iframe src={`${selectedVideo.embedUrl}&playsinline=1`} title={selectedVideo.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="aspect-video w-full" /> : <button type="button" onClick={() => setPlayerReady(true)} className="group relative block aspect-video w-full overflow-hidden text-white" aria-label={`افتح مشغل ${selectedVideo.title}`}><img src={selectedVideo.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-[1.015] group-hover:opacity-65" /><span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/10" /><span className="absolute inset-0 flex items-center justify-center"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/55 bg-ink/45 backdrop-blur-sm transition-transform group-hover:scale-105"><SocialIcon name="Play" size={18} /></span></span><span className="absolute inset-x-5 bottom-4 text-right text-[.68rem] font-semibold">افتح المشغل</span></button>}
                  </div>
                  <div className="pt-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[.65rem] text-soft"><span className="font-semibold text-accent">{videoSequence(selectedVideo)}</span>{selectedVideo.durationText && <span>{selectedVideo.durationText}</span>}{selectedVideo.publishedText && <span>{selectedVideo.publishedText}</span>}{selectedPath.length > 1 && selectedPathIndex >= 0 && <span>{formatArabicNumber(selectedPathIndex + 1)} من {formatArabicNumber(selectedPath.length)} في هذا المسار</span>}</div>
                    <h3 className="mt-2 font-display text-[1.18rem] font-semibold leading-[1.65] text-ink md:text-[1.35rem]">{selectedVideo.title}</h3>
                    {selectedVideo.description && <p className="mt-2 line-clamp-2 text-[.75rem] font-light leading-[1.85] text-soft">{selectedVideo.description}</p>}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {selectedVideo.concept && <Link to={`/publications/${book.slug}?book_idea=${encodeURIComponent(selectedVideo.concept.title)}#book-knowledge`} className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.69rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">اقرأ الموضوع في الكتاب</Link>}
                      {selectedDoor && <a href={selectedDoor.presentation} download={`موسوعة تكنولوجيا التعليم - الباب ${selectedDoor.number}.pptx`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-accent/30 px-4 text-[.69rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="Download" size={12} />عرض الباب</a>}
                      <a href={selectedVideo.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.69rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">شاهده في القناة</a>
                    </div>
                    {(previousVideo || nextVideo) && <div className="mt-6 grid grid-cols-2 gap-3 border-t border-hair pt-5"><button type="button" disabled={!previousVideo} onClick={() => previousVideo && selectVideo(previousVideo, false)} className="min-h-11 rounded-xl border border-hair px-4 text-right text-[.68rem] font-semibold text-ink transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-35">→ المقطع السابق</button><button type="button" disabled={!nextVideo} onClick={() => nextVideo && selectVideo(nextVideo, false)} className="min-h-11 rounded-xl border border-hair px-4 text-left text-[.68rem] font-semibold text-ink transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-35">المقطع التالي ←</button></div>}
                  </div>
                </article> : <div className="aspect-video animate-pulse rounded-2xl border border-hair bg-wash" aria-label="جارٍ تحميل المقطع" />}
              </FadeUp>

              <FadeUp delay={0.08}><aside aria-label="فهرس فيديوهات الموسوعة">
                <label htmlFor="encyclopedia-video-query" className="text-[.68rem] font-semibold text-accent">ابحث داخل المقاطع</label>
                <div className="mt-2 flex items-center rounded-full border border-hair bg-canvas px-4"><SocialIcon name="Search" size={13} /><input id="encyclopedia-video-query" value={videoQuery} onChange={(event) => setVideoQuery(event.target.value)} placeholder="عنوان، مفهوم، باب أو فصل" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[.75rem] text-ink outline-none placeholder:text-soft/55" />{videoQuery && <button type="button" onClick={() => setVideoQuery('')} aria-label="مسح البحث" title="مسح البحث" className="text-soft hover:text-accent"><SocialIcon name="Close" size={12} /></button>}</div>

                <div className="mt-4 max-h-[35rem] overflow-y-auto border-y border-hair pe-1 [scrollbar-color:var(--color-hair)_transparent] [scrollbar-width:thin]">
                  {catalogLoading && !indexedVideos.length ? Array.from({ length: 7 }, (_, index) => <div key={`video-loading-${index}`} className="border-b border-hair py-4 last:border-b-0"><span className="block h-2.5 w-20 animate-pulse rounded bg-wash" /><span className="mt-2 block h-3 w-[85%] animate-pulse rounded bg-wash" /></div>) : filteredVideos.length ? filteredVideos.slice(0, visibleVideoCount).map((video, index) => {
                    const active = selectedVideo?.id === video.id
                    return <button key={video.id} type="button" onClick={() => selectVideo(video, false)} aria-current={active ? 'true' : undefined} className={`group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-hair py-4 text-right last:border-b-0 ${active ? 'text-accent' : 'text-ink'}`}><span className={`font-display text-[.64rem] ${active ? 'font-semibold text-accent' : 'text-soft'}`}>{formatArabicNumber(index + 1)}</span><span className="min-w-0"><span className="block text-[.61rem] font-semibold text-accent/80">{videoSequence(video)}</span><strong className="mt-1 block text-[.74rem] font-semibold leading-[1.7] transition-colors group-hover:text-accent">{video.title}</strong></span><span className="pt-0.5 text-[.61rem] text-soft">{video.durationText || 'مشاهدة'}</span></button>
                  }) : <div className="py-7 text-[.74rem] leading-[1.8] text-soft">لا يوجد مقطع مطابق داخل هذا الباب. جرّب عبارة أقصر أو اعرض كل المقاطع.</div>}
                </div>
                {filteredVideos.length > visibleVideoCount && <button type="button" onClick={() => setVisibleVideoCount((count) => count + 24)} className="mt-4 w-full rounded-full border border-hair py-2.5 text-[.68rem] font-semibold text-accent transition-colors hover:border-accent">عرض {formatArabicNumber(Math.min(24, filteredVideos.length - visibleVideoCount))} مقطعاً آخر</button>}
                {!catalogLoading && filteredVideos.length > 0 && <p className="mt-3 text-[.62rem] leading-relaxed text-soft">يعرض الفهرس {formatArabicNumber(filteredVideos.length)} نتيجة، ويحمّل مشغلاً واحداً فقط للمحافظة على خفة الصفحة.</p>}
              </aside></FadeUp>
            </div>
          </>}
        </div>
      </section>

      <section id="encyclopedia-teaching-kit" className="scroll-mt-24 border-b border-hair bg-wash/40 px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-kit-title">
        <div className="mx-auto max-w-shell"><FadeUp><div className="grid gap-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] lg:gap-14">
          <div><span className="text-[.7rem] font-semibold text-accent">حقيبة تدريس الموسوعة</span><h2 id="encyclopedia-kit-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-semibold leading-[1.45] text-ink">عروض الأبواب جاهزة للتحميل.</h2><p className="mt-4 text-[.8rem] font-light leading-[1.9] text-soft">للطالب والمعلم والأستاذ والمدرب. الملفات متاحة للاستخدام التعليمي مع حفظ حقوق المؤلفين.</p></div>
          <div className="border-y border-hair bg-canvas px-4 md:px-6">{DOORS.map((door) => <div key={`kit-${door.id}`} className="grid gap-3 border-b border-hair py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><span className="text-[.64rem] font-semibold text-accent">الباب {door.number}</span><strong className="mt-1 block text-[.88rem] leading-relaxed text-ink">{door.title}</strong><span className="mt-1 block text-[.68rem] leading-relaxed text-soft">عرض تقديمي قابل للتحميل{doorCounts.get(door.id) ? ` · مرتبط بـ ${formatArabicNumber(doorCounts.get(door.id) || 0)} مقطعاً` : ''}</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openVideoPath(door)} className="inline-flex min-h-10 w-fit items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">شاهد مسار الباب</button><a href={door.presentation} download={`موسوعة تكنولوجيا التعليم - الباب ${door.number}.pptx`} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-accent/30 px-4 text-[.7rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="Download" size={13} />تحميل العرض</a></div></div>)}</div>
        </div></FadeUp></div>
      </section>

      <section className="px-6 py-11 md:px-11 md:py-14"><div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-5 border-y border-hair py-6"><div><span className="text-[.68rem] font-semibold text-accent">النسخة الأصلية</span><p className="mt-1 text-[.8rem] leading-relaxed text-soft">للقراءة الرسمية والبيانات الببليوغرافية.</p></div><div className="flex flex-wrap gap-2">{book.pdf && <a href={book.pdf} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">عرض عيّنة الكتاب</a>}<a href="#book-knowledge" className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[.7rem] font-semibold text-white transition-colors hover:bg-accent-deep">افتح العالم المعرفي</a></div></div></section>
    </>
  )
}
