import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { FadeUp, Page, PageHead } from '../components/ui'
import { KnowledgeEntry } from '../components/KnowledgeEntry'
import { useSeo } from '../components/seo'
import { searchArticles, topKeywordsFor } from '../lib/cms'
import { buildKnowledgeGraph, graphSearch, type KnowledgeKind } from '../lib/knowledge-graph'
import { useCmsContent } from '../lib/content'
import { bestBookConcept, bookKnowledgeAnchor } from '../lib/book-knowledge'
import { categoryLabel, dynamicArticleCategories } from '../lib/content-taxonomy'
import { usePersistentAudio } from '../lib/persistent-audio'
import { versionedAudioUrl } from '../components/extras'
import { loadSpokenIndex, searchSpoken, type SpokenHit } from '../lib/spoken-search'
import { loadBookPassages, searchBookPassages } from '../lib/book-quotes'
import { searchMediaChapters, stamp } from '../lib/media-chapters'
import { ReadingShelf } from '../components/ReadingShelf'
import { Pagination, usePagedList } from '../components/Pagination'
import { staticQuestions } from '../questions-data'
import { SocialIcon } from '../components/icons'

const ar = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])


/* ═══ محرك المعرفة الموحد ═══
   الكتاب يُبحث عبر خريطة مفاهيم مشتقة من متنه الكامل، لكن النتيجة لا تكشف
   المتن ولا ملف PDF: تعرض المحور وموضعه فقط وتفتح صفحة الكتاب نفسها. */

type UnifiedKind = KnowledgeKind | 'question'
type TabId = 'all' | UnifiedKind | 'spoken' | 'passage' | 'askbook'

const KIND_TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'article', label: 'مقالات الدكتور' },
  { id: 'paper', label: 'أبحاث الدكتور' },
  { id: 'book', label: 'كتب الدكتور' },
  { id: 'media', label: 'لقاءات الدكتور' },
  { id: 'question', label: 'الأسئلة' },
  /* التبويب الوحيد الذي لا يفتح نصاً بل صوتاً: جملةٌ نُطقت، والنقر يشغّلها
     عند ثانيتها. يبقى آخر الصف لأنه أحدثها وأقلها استعمالاً في البدء. */
  { id: 'spoken', label: 'جُمل منطوقة' },
  /* متون الكتب التسعة كاملة — بإذن الدكتور. فهرسها ثقيل فلا يُجلب إلا عند
     فتح التبويب، ثم يبقى في الذاكرة فتصير النتائج فورية. */
  { id: 'passage', label: 'متون كتب الدكتور' },
]

const RESULT_TABS = KIND_TABS.filter((item) => item.id !== 'askbook')

const KIND_BADGE: Record<UnifiedKind | 'passage', string> = {
  passage: 'من كتب الدكتور',
  article: 'من مقالات الدكتور',
  paper: 'من أبحاث الدكتور',
  book: 'من كتب الدكتور',
  media: 'من لقاءات الدكتور',
  question: 'سؤال',
  audio: 'صوت',
  curated: 'مختارة',
  podcast: 'بودكاست',
  social: 'منشور',
  concept: 'مفهوم',
}

/* مرادفات عربية شائعة: «التنشئة الرقمية» تجد «التربية الرقمية» وأخواتها */
const SYNONYMS: [RegExp, string][] = [
  [/التنشئه الرقميه|التنشئة الرقمية/, 'التربية الرقمية'],
  [/الذكاء الصناعي|\bai\b/i, 'الذكاء الاصطناعي'],
  [/التعليم الالكتروني|التعلم الالكتروني/, 'التعليم الإلكتروني التعلم'],
  [/الجوال|الموبايل/, 'الهاتف'],
  [/السوشل ميديا|السوشيال ميديا|مواقع التواصل/, 'وسائل التواصل الاجتماعي'],
  [/العيال|الاطفال/, 'الطفل الأبناء'],
  [/المدرسه عن بعد|الدراسه عن بعد/, 'التعليم عن بعد'],
  [/الامتحانات|الاختبارات/, 'الامتحان التقويم'],
]

function expandQuery(query: string) {
  const additions: string[] = []
  for (const [pattern, expansion] of SYNONYMS) {
    if (pattern.test(query)) additions.push(expansion)
  }
  return additions.length ? `${query} ${additions.join(' ')}` : query
}

const normalizeArabic = (value = '') => value
  .toLowerCase()
  .replace(/[ً-ٰٟ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/* اقتراح تصحيح: عند صفر نتائج نقارن الكلمة بمفردات الأرشيف نفسه (مسافة تحرير ≤ 2) */
function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

export default function Search() {
  const { articles, books, papers, media } = useCmsContent()
  const [searchParams, setSearchParams] = useSearchParams()
  useSeo({
    title: 'البحث العميق',
    path: '/search',
    description: 'محرك معرفة موحد يبحث في المقالات والأبحاث والكتب والمواد الإعلامية والأسئلة.',
  })

  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [tab, setTab] = useState<TabId>(() => {
    const requested = searchParams.get('tab') as TabId | null
    return requested === 'askbook' || (requested && RESULT_TABS.some((item) => item.id === requested)) ? requested : 'all'
  })
  const [cat, setCat] = useState('الكل')
  const [year, setYear] = useState('الكل')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [askBookSlug, setAskBookSlug] = useState(() => searchParams.get('book') || '')
  const [askBookQuestion, setAskBookQuestion] = useState('')
  const [askBookAsked, setAskBookAsked] = useState('')
  const [askBookReady, setAskBookReady] = useState(false)
  const [askBookLoading, setAskBookLoading] = useState(false)
  const [askBookError, setAskBookError] = useState('')

  useEffect(() => {
    const requested = searchParams.get('book') || ''
    if (requested && books.some((book) => book.slug === requested) && requested !== askBookSlug) {
      setAskBookSlug(requested)
      return
    }
    if ((!askBookSlug || !books.some((book) => book.slug === askBookSlug)) && books[0]?.slug) setAskBookSlug(books[0].slug)
  }, [askBookSlug, books, searchParams])

  const categories = useMemo(() => dynamicArticleCategories(articles), [articles])
  const years = useMemo(() => Array.from(new Set(articles.map((article) => article.iso.slice(0, 4))))
    .sort((a, b) => b.localeCompare(a)), [articles])
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim()
  const searchStarted = normalizedQuery.length >= 2

  /* نحدّث الرابط بعد هدوء الكتابة بقليل. سابقاً كان كل حرف يغيّر location.search،
     ومدير التمرير يعيد الصفحة إلى الأعلى؛ فكان الحقل يبدو وكأنه يعلّق. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(window.location.search)
      const typed = query.trim()
      if (typed) next.set('q', typed)
      else next.delete('q')
      if (tab !== 'all') next.set('tab', tab)
      else next.delete('tab')
      const search = next.toString()
      const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
      /* لا نمر عبر Router أثناء كل حرف: مدير التمرير كان يعامل كل تحديث للرابط
         كتنقل جديد فيدفع الصفحة فوق وتحت. replaceState يحفظ الرابط بلا Layout Shift. */
      window.history.replaceState(window.history.state, '', url)
    }, 240)
    return () => window.clearTimeout(timer)
  }, [query, tab])

  const knowledgeGraph = useMemo(() => buildKnowledgeGraph({ articles, books, papers, media }), [articles, books, media, papers])

  const expandedQuery = useMemo(() => expandQuery(normalizedQuery), [normalizedQuery])

  /* نتائج المقالات الغنية (النص الكامل + فلاتر الفئة والسنة) */
  const articleResults = useMemo(() => {
    if (!searchStarted) return []
    const lexical = searchArticles({ query: expandedQuery, cat, year }, articles)
    const graphRanks = new Map(graphSearch(knowledgeGraph, expandedQuery, 120).filter((row) => row.node.kind === 'article').map((row) => [row.node.slug, row.score]))
    return lexical.slice().sort((left, right) => (graphRanks.get(right.slug) || 0) - (graphRanks.get(left.slug) || 0) || right.iso.localeCompare(left.iso))
  }, [articles, expandedQuery, cat, year, searchStarted, knowledgeGraph])

  /* بقية الأنواع من الخريطة المعرفية — العنوان والوصف العام والمجلة والباحثون */
  const graphResults = useMemo(() => {
    if (!searchStarted) return []
    return graphSearch(knowledgeGraph, expandedQuery, 60).filter((row) => row.node.kind !== 'article')
  }, [expandedQuery, searchStarted, knowledgeGraph])

  /* الأسئلة: بحث مباشر في نص السؤال ورأي الدكتور */
  const questionResults = useMemo(() => {
    if (!searchStarted) return []
    const needle = normalizeArabic(expandedQuery)
    const words = needle.split(' ').filter((word) => word.length > 2)
    if (!words.length) return []
    return staticQuestions
      .map((item, index) => {
        const haystack = normalizeArabic(`${item.ar} ${item.take}`)
        const hits = words.filter((word) => haystack.includes(word)).length
        return { item, index, hits }
      })
      .filter((row) => row.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 12)
  }, [expandedQuery, searchStarted])

  /* ── البحث في المنطوق ──
     الفهرس ثقيل، فلا يُجلب إلا حين يفتح الزائر التبويب فعلاً. وبعد جلبه مرّة
     يبقى في الذاكرة، فتصير النتائج فورية مع كل حرفٍ يكتبه. */
  const player = usePersistentAudio()
  const [spokenReady, setSpokenReady] = useState(false)
  const [spokenIndex, setSpokenIndex] = useState<Awaited<ReturnType<typeof loadSpokenIndex>>>([])
  useEffect(() => {
    if (tab !== 'spoken' || spokenReady) return
    let on = true
    void loadSpokenIndex().then((index) => { if (on) { setSpokenIndex(index); setSpokenReady(true) } })
    return () => { on = false }
  }, [spokenReady, tab])

  const spokenHits: SpokenHit[] = useMemo(
    () => (searchStarted && spokenReady ? searchSpoken(spokenIndex, normalizedQuery) : []),
    [normalizedQuery, searchStarted, spokenIndex, spokenReady])

  /* ── متون الكتب ──
     الفهرس الكامل (تسعة كتب) يُجلب عند أول بحثٍ في هذا التبويب أو في «الكل»،
     فلا يثقل أول زيارة، ويبقى بعدها في الذاكرة. */
  const [passagesReady, setPassagesReady] = useState(false)
  useEffect(() => {
    if (!searchStarted || passagesReady) return
    if (tab !== 'passage' && tab !== 'all') return
    let on = true
    void loadBookPassages().then(() => { if (on) setPassagesReady(true) })
    return () => { on = false }
  }, [passagesReady, searchStarted, tab])

  const passageHits = useMemo(
    () => (searchStarted && passagesReady ? searchBookPassages(expandedQuery, 40) : []),
    [expandedQuery, passagesReady, searchStarted])

  const selectedAskBook = useMemo(() => books.find((book) => book.slug === askBookSlug) || books[0] || null, [askBookSlug, books])
  const askBookMatches = useMemo(
    () => (askBookReady && askBookAsked.length >= 2 && selectedAskBook ? searchBookPassages(askBookAsked, 6, selectedAskBook.slug) : []),
    [askBookAsked, askBookReady, selectedAskBook],
  )

  const submitAskBook = async () => {
    const question = askBookQuestion.trim()
    if (!selectedAskBook || question.length < 2 || askBookLoading) return
    setAskBookLoading(true)
    setAskBookError('')
    try {
      await loadBookPassages()
      setAskBookReady(true)
      setAskBookAsked(question)
    } catch {
      setAskBookError('تعذّر فتح فهرس الكتاب الآن. أعد المحاولة بعد لحظة.')
    } finally {
      setAskBookLoading(false)
    }
  }

  /* دقيقة الفكرة: البحث لا يعيد اللقاء فحسب، بل الموضع الذي قيلت فيه الجملة. */
  const chapterHits = useMemo(
    () => (searchStarted ? searchMediaChapters(expandedQuery, 6) : []),
    [expandedQuery, searchStarted])

  /* الاستماع من نتيجة البحث: لا ينتقل الزائر ولا تُفتح صفحة — يشتغل المشغّل
     المقيم أسفل الشاشة عند ثانية الجملة نفسها. */
  const playSpoken = (hit: SpokenHit) => {
    const src = versionedAudioUrl(`/audio/${hit.slug}.dialogue.mp3`)
    void player.playTrack({
      id: src,
      src,
      title: hit.title,
      label: 'مجلس الفكرة',
      path: `/articles/${hit.slug}`,
      startAt: hit.startSec,
    })
  }

  const counts: Record<TabId, number> = useMemo(() => {
    const paper = graphResults.filter((row) => row.node.kind === 'paper').length
    const book = graphResults.filter((row) => row.node.kind === 'book').length
    const mediaCount = graphResults.filter((row) => row.node.kind === 'media').length + chapterHits.length
    const kindCount = (kind: UnifiedKind) => graphResults.filter((row) => row.node.kind === kind).length
    return {
      article: articleResults.length,
      paper,
      book,
      media: mediaCount,
      question: questionResults.length,
      audio: kindCount('audio'),
      curated: kindCount('curated'),
      podcast: kindCount('podcast'),
      social: kindCount('social'),
      concept: kindCount('concept'),
      all: articleResults.length + paper + book + mediaCount + questionResults.length + passageHits.length,
      spoken: spokenHits.length,
      passage: passageHits.length,
      askbook: books.length,
    }
  }, [articleResults, chapterHits, graphResults, questionResults, spokenHits, passageHits])

  /* قائمة «الكل» الموحدة: كل نتيجة بنوعها، مرتبة بالمواءمة */
  type UnifiedRow = { kind: UnifiedKind | 'passage'; slug?: string; title: string; snippet: string; url: string; year?: string; score: number }
  const unifiedRows: UnifiedRow[] = useMemo(() => {
    if (!searchStarted) return []
    const rows: UnifiedRow[] = []
    const articleRank = new Map(articleResults.map((item, index) => [item.slug, articleResults.length - index]))
    for (const item of articleResults) {
      rows.push({ kind: 'article', slug: item.slug, title: item.title, snippet: item.excerpt || '', url: `/articles/${item.slug}`, year: item.iso.slice(0, 4), score: 1000 + (articleRank.get(item.slug) || 0) })
    }
    for (const row of graphResults) {
      const bookMatch = row.node.kind === 'book' ? bestBookConcept(expandedQuery, row.node.slug) : null
      rows.push({
        kind: row.node.kind as UnifiedKind,
        slug: row.node.slug,
        title: row.node.title,
        snippet: bookMatch && bookMatch.score > 0
          ? `داخل الكتاب: ${bookMatch.concept.title} · ص ${bookMatch.concept.pageStart}. ${bookMatch.concept.summary}`
          : row.node.text.slice(0, 180),
        url: bookMatch && bookMatch.score > 0
          ? `/publications/${row.node.slug}#${bookKnowledgeAnchor(bookMatch.concept)}`
          : row.node.url,
        year: row.node.year,
        score: row.score * 12,
      })
    }
    for (const row of questionResults) {
      rows.push({ kind: 'question', slug: String(row.index), title: row.item.ar, snippet: row.item.take.slice(0, 180), url: '/questions', year: undefined, score: row.hits * 10 })
    }
    for (const hit of chapterHits) {
      rows.push({
        kind: 'media',
        slug: `media-${hit.videoId}`,
        title: `${hit.title} · نحو ${stamp(hit.chapter.at)}`,
        snippet: hit.chapter.text.slice(0, 170),
        url: `/media/media-${hit.videoId}`,
        year: undefined,
        score: hit.score * 8,
      })
    }
    /* المقطع من المتن يدخل النتائج بنصّه هو: يقرأ الباحث كلام الدكتور نفسه،
       ويعرف من أي كتابٍ وأي صفحة، ثم يفتح صفحة الكتاب لا ملفاً. */
    for (const match of passageHits) {
      rows.push({
        kind: 'passage',
        slug: match.bookSlug,
        title: `${match.bookTitle} · ص ${match.quote.page}`,
        snippet: match.quote.text,
        url: `/publications/${match.bookSlug}#book-knowledge`,
        year: undefined,
        score: match.score * 9,
      })
    }
    return rows.sort((a, b) => b.score - a.score)
  }, [articleResults, chapterHits, expandedQuery, graphResults, passageHits, questionResults, searchStarted])

  const activeRows = useMemo(() => tab === 'askbook' ? [] : tab === 'all' ? unifiedRows : unifiedRows.filter((row) => row.kind === tab), [tab, unifiedRows])

  const keywords = useMemo(() => topKeywordsFor(articleResults.slice(0, 18), 12), [articleResults])
  const paged = usePagedList(activeRows, 20, `${normalizedQuery}|${tab}|${cat}|${year}`)
  const visibleRows = paged.pageItems

  /* «هل تقصد؟» — يُحسب فقط حين لا نتائج إطلاقاً */
  const didYouMean = useMemo(() => {
    if (!searchStarted || counts.all > 0) return ''
    const lastWord = normalizeArabic(normalizedQuery).split(' ').filter(Boolean).pop() || ''
    if (lastWord.length < 3) return ''
    const vocabulary = new Set<string>()
    for (const node of knowledgeGraph.nodes) for (const token of node.tokens.slice(0, 30)) vocabulary.add(token)
    let best = ''
    let bestDistance = 3
    for (const candidate of vocabulary) {
      const distance = editDistance(lastWord, candidate)
      if (distance < bestDistance) { bestDistance = distance; best = candidate }
    }
    return best && best !== lastWord ? normalizedQuery.replace(/\S+\s*$/u, best) : ''
  }, [counts.all, knowledgeGraph, normalizedQuery, searchStarted])


  return (
    <Page className="content-search page-journey">
      <PageHead
        label="بحث"
        title="البحث العميق."
        sub="محرك معرفة واحد يفتح أرشيف الدكتور كله: مقالاته وأبحاثه وكتبه ولقاءاته وأسئلته."
      />

      <div className="px-6 pt-8 md:px-11"><div className="mx-auto max-w-3xl"><KnowledgeEntry /></div></div>

      <div className="px-6 pt-7 md:px-11">
        <div className="mx-auto max-w-shell">
          <button
            type="button"
            onClick={() => {
              setTab('askbook')
              const next = new URLSearchParams(window.location.search)
              next.set('tab', 'askbook')
              window.history.replaceState(window.history.state, '', `${window.location.pathname}?${next.toString()}`)
            }}
            className={`group flex w-full items-center justify-between gap-5 rounded-[1.65rem] border px-5 py-5 text-right transition-colors md:px-7 ${tab === 'askbook' ? 'border-accent bg-accent/[.045]' : 'border-hair bg-wash/[.45] hover:border-accent/[.55]'}`}
            aria-pressed={tab === 'askbook'}
          >
            <span className="min-w-0">
              <span className="block text-[.7rem] font-semibold text-accent">ميزة مستقلة</span>
              <strong className="mt-1 block font-display text-[clamp(1.15rem,2.2vw,1.55rem)] font-semibold text-ink">ابحث في كتاب</strong>
              <span className="mt-1 block text-[.78rem] leading-relaxed text-soft">اختر كتاباً واحداً، ثم ابحث في متنه الموثق فقط.</span>
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white"><SocialIcon name="Search" size={17} /></span>
          </button>
        </div>
      </div>

      <section className="px-6 py-10 md:px-11 md:py-12">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="border-b border-hair pb-8">
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="كلمة، فكرة، عنوان، كتاب، أو سؤال"
                  enterKeyHint="search"
                  aria-label="بحث في الأرشيف كله"
                  className="w-full rounded-none border-0 border-b border-hair bg-transparent py-5 pe-4 ps-14 font-display text-[clamp(1.2rem,4.3vw,2.5rem)] font-semibold leading-[1.5] text-ink outline-none transition-colors placeholder:text-soft/[.45] focus:border-accent"
                />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent"><SocialIcon name="Search" size={19} /></span>
              </div>

              <div className="mt-7 border-t border-hair pt-5">
                {/* تبويبات الأنواع مع عداداتها — قلب المحرك الموحد */}
                <div className="rail -mx-1 flex flex-nowrap gap-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="أنواع نتائج البحث">
                  {RESULT_TABS.map((item) => (
                    <button
                      key={item.id}
                      role="tab"
                      aria-selected={tab === item.id}
                      onClick={() => setTab(item.id)}
                      className={`min-h-11 shrink-0 border-b px-1 py-2 text-[.86rem] font-medium transition-colors ${
                        tab === item.id ? 'border-accent text-accent' : 'border-transparent text-soft hover:border-accent hover:text-accent'
                      }`}
                    >
                      {item.label}
                      {/* «جُمل منطوقة» لا تُظهر رقماً قبل أن يُفتح فهرسها:
                          صفرٌ قبل القراءة يكذب على الزائر بأنه لا شيء. */}
                      <span className="ms-1.5 text-[.72rem] text-soft">
                        {!searchStarted && item.id !== 'askbook' ? '' : ((item.id === 'spoken' && !spokenReady) || (item.id === 'passage' && !passagesReady) ? '' : ar(counts[item.id]))}
                      </span>
                    </button>
                  ))}
                </div>

                {/* الفلاتر مغلقة افتراضياً — تُفتح عند الحاجة (مقترح معتمد) */}
                {searchStarted && (tab === 'all' || tab === 'article') && (
                  <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setFiltersOpen((value) => !value)}
                        className="text-[.78rem] font-semibold text-soft transition-colors hover:text-accent"
                        aria-expanded={filtersOpen}
                      >
                        {filtersOpen ? 'إخفاء فلاتر المقالات ▴' : `فلاتر المقالات ▾${cat !== 'الكل' || year !== 'الكل' ? ' · مفعّلة' : ''}`}
                      </button>
                      {filtersOpen && (
                        <>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                            {categories.map((item) => (
                              <button
                                key={categoryLabel(item)}
                                onClick={() => setCat(item)}
                                className={`min-h-11 shrink-0 border-b px-1 py-2 text-[.84rem] font-medium transition-colors ${
                                  cat === item ? 'border-accent text-accent' : 'border-transparent text-soft hover:border-accent hover:text-accent'
                                }`}
                              >
                                {categoryLabel(item)}
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                            {['الكل', ...years].map((item) => (
                              <button
                                key={categoryLabel(item)}
                                onClick={() => setYear(item)}
                                className={`min-h-11 shrink-0 border-b px-1 py-2 text-[.8rem] transition-colors ${
                                  year === item ? 'border-accent text-accent' : 'border-transparent text-soft hover:border-accent hover:text-accent'
                                }`}
                              >
                                {item === 'الكل' ? 'كل السنوات' : ar(item)}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                )}
              </div>
            </div>
          </FadeUp>

          {(searchStarted || tab === 'askbook') && <FadeUp delay={0.05}>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[.9rem] text-soft" aria-live="polite">
                {tab === 'askbook' ? (
                  <>اختر كتاباً واكتب ما تبحث عنه؛ تظهر الإجابة من متن الكتاب نفسه.</>
                ) : (
                  <>
                    {ar(tab === 'spoken' ? spokenHits.length : activeRows.length)} نتيجة
                    <span> عن «{normalizedQuery}»</span>
                    {tab !== 'all' && <span> في {RESULT_TABS.find((item) => item.id === tab)?.label}</span>}
                  </>
                )}
              </p>
              {(tab === 'all' || tab === 'article') && keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keywords.slice(0, 8).map((keyword) => (
                    <button
                      key={keyword}
                      onClick={() => setQuery(keyword)}
                      className="border-b border-hair pb-0.5 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FadeUp>}

          {tab === 'askbook' && <FadeUp delay={0.08}>
            <section className="mt-8 min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-hair bg-wash p-4 sm:p-5 md:p-7" aria-labelledby="ask-book-gateway-title">
              <div className="min-w-0">
                <span className="text-[.72rem] font-semibold uppercase tracking-[.08em] text-accent">ميزة خاصة · ابحث في كتاب</span>
                <h2 id="ask-book-gateway-title" className="mt-2 break-words font-display text-[clamp(1.35rem,2.8vw,2rem)] font-semibold leading-[1.45] text-ink">بحث مباشر داخل متن كتاب من كتب الدكتور.</h2>
                <p className="mt-3 max-w-2xl text-[.88rem] leading-[1.9] text-soft">اختر كتاباً من كتب الدكتور ثم اكتب سؤالك أو مفهومك. تظهر أقرب الإجابات الموثقة من متن الكتاب المختار فقط.</p>

                <div dir="rtl" className="ask-book-rail rail mt-5 flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [touch-action:pan-x_pinch-zoom] [&::-webkit-scrollbar]:hidden" aria-label="اختيار الكتاب">
                  {books.map((book) => (
                    <button
                      key={book.slug}
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams)
                        next.set('tab', 'askbook')
                        next.set('book', book.slug)
                        setAskBookSlug(book.slug)
                        setAskBookAsked('')
                        setAskBookError('')
                        setSearchParams(next, { replace: true })
                      }}
                      aria-pressed={askBookSlug === book.slug}
                      className={`w-[78vw] max-w-[18rem] shrink-0 snap-start rounded-2xl border px-4 py-3 text-right transition-colors sm:w-[18rem] ${askBookSlug === book.slug ? 'border-accent bg-canvas shadow-sm' : 'border-hair bg-canvas/70 hover:border-accent/[.45]'}`}
                    >
                      <strong className="block break-words text-[.82rem] leading-relaxed text-ink">{book.title}</strong>
                      <span className="mt-1 block line-clamp-2 text-[.68rem] leading-relaxed text-soft">{book.year ? `من كتب الدكتور · ${book.year}` : 'من كتب الدكتور'}{book.desc ? ` · ${book.desc}` : ''}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={(event) => { event.preventDefault(); void submitAskBook() }} className="mt-5 grid min-w-0 gap-3 rounded-[1.75rem] border border-hair bg-canvas p-4 md:p-5">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <label htmlFor="ask-book-question" className="text-[.72rem] font-semibold text-accent">سؤالك عن {selectedAskBook?.title || 'الكتاب'}</label>
                  {askBookAsked && <button type="button" onClick={() => { setAskBookQuestion(''); setAskBookAsked(''); setAskBookError('') }} aria-label="مسح السؤال والجواب" title="مسح السؤال والجواب" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"><SocialIcon name="Close" size={15} /></button>}
                </div>
                <textarea
                  id="ask-book-question"
                  value={askBookQuestion}
                  onChange={(event) => setAskBookQuestion(event.target.value)}
                  placeholder="مثال: ما دور المعلّم في هذا الكتاب؟"
                  className="min-h-32 w-full min-w-0 max-w-full resize-y rounded-[1.4rem] border border-hair bg-wash px-4 py-3 text-[.88rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="submit" disabled={!selectedAskBook || askBookQuestion.trim().length < 2 || askBookLoading} className="rounded-full bg-accent px-5 py-2.5 text-[.76rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45">{askBookLoading ? 'يفتح متن الكتاب…' : 'ابحث في الكتاب'}</button>
                  <button type="button" onClick={() => setAskBookQuestion('ما الفكرة الأساسية في هذا الكتاب؟')} className="rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">سؤال جاهز</button>
                </div>
                {askBookError && <p className="text-[.72rem] leading-relaxed text-accent" role="alert">{askBookError}</p>}
              </form>

              {askBookAsked && !askBookLoading && (
                <section className="mt-5 min-w-0 rounded-[1.75rem] border border-hair bg-canvas p-4 md:p-5" aria-live="polite" aria-labelledby="ask-book-answer-title">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-hair pb-4">
                    <div className="min-w-0">
                      <span className="text-[.68rem] font-semibold text-accent">الجواب من متن الكتاب</span>
                      <h3 id="ask-book-answer-title" className="mt-1 break-words font-display text-[1.05rem] font-semibold leading-relaxed text-ink">{selectedAskBook?.title}</h3>
                      <p className="mt-1 break-words text-[.74rem] leading-relaxed text-soft">«{askBookAsked}»</p>
                    </div>
                    {selectedAskBook && <Link to={`/publications/${selectedAskBook.slug}#book-knowledge`} className="shrink-0 text-[.7rem] font-semibold text-accent transition-colors hover:text-accent-deep">افتح صفحة الكتاب ←</Link>}
                  </div>

                  {askBookReady && askBookMatches.length > 0 ? (
                    <div className="mt-4 grid min-w-0 gap-3">
                      <p className="text-[.76rem] leading-[1.85] text-soft">وجدتُ أقرب المقاطع التي يجيب بها الكتاب نفسه؛ رتبتها بحسب صلتها بالسؤال، وكل مقطع منسوب إلى صفحته.</p>
                      {askBookMatches.map((match) => (
                        <figure key={`search-ask-${match.bookSlug}-${match.quote.id}`} className="min-w-0 overflow-hidden rounded-2xl border border-hair bg-wash px-4 py-4">
                          <blockquote className="break-words border-r-2 border-accent/[.35] pr-3 text-[.88rem] font-light leading-[2] text-ink/[.88]">{match.quote.text}</blockquote>
                          <figcaption className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 pr-3 text-[.68rem] text-soft">
                            <span className="break-words">{match.bookTitle} · ص {match.quote.page}{match.quote.conceptTitle ? ` · ${match.quote.conceptTitle}` : ''}</span>
                            <Link to={`/publications/${match.bookSlug}#book-knowledge`} className="font-semibold text-accent">في الكتاب ←</Link>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : askBookReady ? (
                    <div className="mt-4 rounded-2xl border border-hair bg-wash px-4 py-5 text-[.78rem] leading-[1.9] text-soft">لم أجد في هذا الكتاب مقطعاً موثقاً يجيب عن السؤال بهذه الصياغة. جرّب مفهوماً أقرب إلى عنوان فصل أو كلمة أساسية، ولن أقدّم جواباً من خارج المتن.</div>
                  ) : null}
                </section>
              )}
            </section>
          </FadeUp>}

          {/* نتائج المنطوق: جملةٌ قيلت، وتحتها متحدثها وحلقتها وثانيتها. لا رابط
              ينقل الزائر — النقر يشغّل الصوت عند الجملة نفسها والزائر مكانه. */}
          {searchStarted && tab === 'spoken' && (
            <ul id="search-results" className="mt-8 scroll-mt-28">
              {!spokenReady && <li className="py-10 text-[.88rem] text-soft">يفتح المنطوق…</li>}
              {spokenReady && spokenHits.map((hit, index) => (
                <li key={`${hit.slug}-${hit.startSec}`} className={index === 0 ? '' : 'border-t border-hair'}>
                  <button
                    type="button"
                    onClick={() => playSpoken(hit)}
                    className="group flex w-full items-start gap-3.5 py-5 text-start transition-colors"
                  >
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair text-accent/[.75] transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white"><SocialIcon name="Play" size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.05rem] leading-[1.8] text-ink transition-colors group-hover:text-accent">
                        {hit.text}
                      </span>
                      <span className="mt-1.5 block truncate text-[.72rem] text-soft">
                        {hit.speaker}
                        <span className="mx-1.5 opacity-45">·</span>
                        {hit.title}
                        <span className="mx-1.5 opacity-45">·</span>
                        {Math.floor(hit.startSec / 60)}:{String(Math.floor(hit.startSec % 60)).padStart(2, '0')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {spokenReady && !spokenHits.length && (
                <li className="border-t border-hair py-16 text-center text-[.92rem] text-soft">
                  {spokenIndex.length ? 'لم تُقل هذه الكلمة في أي حلقة بعد.' : 'الحلقات المسموعة في طريقها.'}
                </li>
              )}
            </ul>
          )}

          {/* الرفّ: من قائمة نتائج إلى خطة قراءة مرتّبة — قبل القائمة نفسها،
              لأن الزائر الذي يعرف بمَ يبدأ لا يحتاج أن يقرأ القائمة كلها. */}
          {searchStarted && tab === 'all' && <ReadingShelf query={normalizedQuery} articles={articleResults} />}

          {searchStarted && tab !== 'spoken' && tab !== 'askbook' && <ul id="search-results" className="mt-8 scroll-mt-28">
            {visibleRows.map((row, index) => (
              <FadeUp key={`${row.kind}-${row.url}-${row.title.slice(0, 30)}`} delay={Math.min(index * 0.025, 0.25)}>
                <li className={`relative ${index === 0 ? '' : 'border-t border-hair'}`}>
                  <Link to={row.url} className={`group grid gap-3 py-6 md:grid-cols-[7rem_1fr_5.5rem] md:items-baseline ${row.kind === 'book' ? 'pb-16' : ''}`}>
                    <span className={`h-fit w-fit rounded-full px-3 py-1 text-[.7rem] font-bold ${row.kind === 'article' ? 'bg-accent/10 text-accent' : 'border border-hair text-soft'}`}>
                      {KIND_BADGE[row.kind]}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-[1.2rem] font-semibold leading-[1.55] text-ink transition-colors group-hover:text-accent">
                        {row.title}
                      </span>
                      {row.snippet && (
                        <span className="mt-1.5 block max-w-[72ch] text-[.9rem] font-light leading-[1.8] text-soft">
                          {row.snippet}{row.snippet.length >= 178 ? '…' : ''}
                        </span>
                      )}
                    </span>
                    <span className="text-[.8rem] text-soft md:text-left">{row.year ? ar(row.year) : ''}</span>
                  </Link>
                  {row.kind === 'book' && row.slug && (
                    <Link
                      to={`/search?tab=askbook&book=${encodeURIComponent(row.slug)}`}
                      aria-label={`ابحث داخل كتاب ${row.title}`}
                      title="ابحث في هذا الكتاب"
                      className="absolute bottom-3 left-0 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-accent/[.35] bg-canvas px-3 text-[.68rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
                    >
                      <SocialIcon name="Search" size={14} />
                      <span>ابحث فيه</span>
                    </Link>
                  )}
                </li>
              </FadeUp>
            ))}
          </ul>}

          {searchStarted && tab !== 'spoken' && tab !== 'askbook' && <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={activeRows.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="search-results" label="صفحات نتائج البحث" className="mt-8" />}

          {!searchStarted && tab !== 'askbook' && (
            <FadeUp delay={0.05}>
              <div className="py-16 text-center md:py-20">
                <h2 className="font-display text-[clamp(1.35rem,3vw,1.8rem)] font-semibold text-ink">عمّ تبحث اليوم؟</h2>
                <p className="mx-auto mt-2 max-w-md text-[.9rem] leading-[1.8] text-soft">
                  اكتب حرفين على الأقل — البحث يفتح مقالات الدكتور وأبحاثه وكتبه ولقاءاته والأسئلة معاً.
                </p>
              </div>
            </FadeUp>
          )}

          {searchStarted && tab !== 'spoken' && tab !== 'askbook' && activeRows.length === 0 && (
            <FadeUp>
              <div className="border-t border-hair py-20 text-center">
                <p className="font-display text-[1.5rem] font-semibold text-ink">لا نتائج دقيقة.</p>
                {didYouMean ? (
                  <p className="mt-3 text-[.95rem] text-soft">
                    هل تقصد{' '}
                    <button type="button" onClick={() => setQuery(didYouMean)} className="font-semibold text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
                      «{didYouMean}»
                    </button>
                    ؟
                  </p>
                ) : (
                  <p className="mt-3 text-[.95rem] text-soft">جرّب كلمة أوسع، أو بدّل التبويب، أو ألغِ أحد الفلاتر.</p>
                )}
              </div>
            </FadeUp>
          )}
        </div>
      </section>
    </Page>
  )
}
