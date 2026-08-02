import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
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
  { id: 'article', label: 'المقالات' },
  { id: 'paper', label: 'الأبحاث' },
  { id: 'book', label: 'الكتب' },
  { id: 'media', label: 'الإعلام' },
  { id: 'question', label: 'الأسئلة' },
  /* بوابة مباشرة إلى ميزة «اسأل هذا الكتاب» كي لا تبقى مدفونة في صفحات
     الكتب. هو تبويبٌ خدمي أكثر من كونه قائمة نتائج. */
  { id: 'askbook', label: 'اسأل كتاباً' },
  /* التبويب الوحيد الذي لا يفتح نصاً بل صوتاً: جملةٌ نُطقت، والنقر يشغّلها
     عند ثانيتها. يبقى آخر الصف لأنه أحدثها وأقلها استعمالاً في البدء. */
  { id: 'spoken', label: 'جُمل منطوقة' },
  /* متون الكتب التسعة كاملة — بإذن الدكتور. فهرسها ثقيل فلا يُجلب إلا عند
     فتح التبويب، ثم يبقى في الذاكرة فتصير النتائج فورية. */
  { id: 'passage', label: 'متون الكتب' },
]

const KIND_BADGE: Record<UnifiedKind | 'passage', string> = {
  passage: 'من كتاب',
  article: 'مقال',
  paper: 'بحث',
  book: 'كتاب',
  media: 'إعلام',
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  useSeo({
    title: 'البحث العميق',
    path: '/search',
    description: 'محرك معرفة موحد يبحث في المقالات والأبحاث والكتب والمواد الإعلامية والأسئلة.',
  })

  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [tab, setTab] = useState<TabId>(() => {
    const requested = searchParams.get('tab') as TabId | null
    return requested && KIND_TABS.some((item) => item.id === requested) ? requested : 'all'
  })
  const [cat, setCat] = useState('الكل')
  const [year, setYear] = useState('الكل')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [askBookSlug, setAskBookSlug] = useState(() => searchParams.get('book') || '')
  const [askBookQuestion, setAskBookQuestion] = useState('')

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
  const normalizedQuery = query.trim()
  const searchStarted = normalizedQuery.length >= 2

  /* عبارة البحث والتبويب يسكنان الرابط — فتُشارك النتائج نفسها برابطها */
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (normalizedQuery) next.set('q', normalizedQuery)
    else next.delete('q')
    if (tab !== 'all') next.set('tab', tab)
    else next.delete('tab')
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery, tab])

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
        sub="محرك معرفة واحد يفتح الأرشيف كله: المقالات والأبحاث والكتب والإعلام والأسئلة."
      />

      <div className="px-6 pt-8 md:px-11"><div className="mx-auto max-w-3xl"><KnowledgeEntry /></div></div>

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="border-b border-hair pb-8">
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="كلمة، فكرة، عنوان، باحث، أو سؤال"
                  aria-label="بحث في الأرشيف كله"
                  className="w-full rounded-none border-0 border-b border-hair bg-transparent py-5 pe-4 ps-14 font-display text-[clamp(1.2rem,4.3vw,2.5rem)] font-semibold leading-[1.5] text-ink outline-none transition-colors placeholder:text-soft/[.45] focus:border-accent"
                />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.4rem] text-accent">⌕</span>
              </div>

              <div className="mt-7 border-t border-hair pt-5">
                {/* تبويبات الأنواع مع عداداتها — قلب المحرك الموحد */}
                <div className="rail -mx-1 flex flex-nowrap gap-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="أنواع نتائج البحث">
                  {KIND_TABS.map((item) => (
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
                  <>اختر كتاباً، ثم اكتب سؤالك لينتقل بك مباشرة إلى قسم «اسأل هذا الكتاب».</>
                ) : (
                  <>
                    {ar(tab === 'spoken' ? spokenHits.length : activeRows.length)} نتيجة
                    <span> عن «{normalizedQuery}»</span>
                    {tab !== 'all' && <span> في {KIND_TABS.find((item) => item.id === tab)?.label}</span>}
                  </>
                )}
              </p>
              {tab !== 'askbook' && keywords.length > 0 && (
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
            <section className="mt-8 rounded-[2rem] border border-hair bg-wash p-5 md:p-7" aria-labelledby="ask-book-gateway-title">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,.95fr)] lg:items-start">
                <div>
                  <span className="text-[.72rem] font-semibold uppercase tracking-[.08em] text-accent">اسأل كتاباً</span>
                  <h2 id="ask-book-gateway-title" className="mt-2 font-display text-[clamp(1.35rem,2.8vw,2rem)] font-semibold leading-[1.45] text-ink">الميزة نفسها، لكن في الواجهة الآن.</h2>
                  <p className="mt-3 max-w-2xl text-[.88rem] leading-[1.9] text-soft">اختر كتاباً من المؤلفات، واكتب سؤالك، ثم انتقل مباشرةً إلى قسم «اسأل هذا الكتاب» داخل صفحته؛ هناك سيجيبك المتن بمقاطعه المنسوبة إلى صفحاتها.</p>
                  <div className="rail mt-5 grid grid-flow-col auto-cols-[min(82vw,18rem)] gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid-flow-row md:auto-cols-auto md:grid-cols-2 md:overflow-visible">
                    {books.map((book) => (
                      <button
                        key={book.slug}
                        type="button"
                        onClick={() => { const next = new URLSearchParams(searchParams); next.set('tab', 'askbook'); next.set('book', book.slug); setAskBookSlug(book.slug); setSearchParams(next, { replace: true }) }}
                        className={`rounded-2xl border px-4 py-3 text-right transition-colors ${askBookSlug === book.slug ? 'border-accent bg-canvas' : 'border-hair bg-canvas/70 hover:border-accent/[.45]'}`}
                      >
                        <strong className="block text-[.82rem] leading-relaxed text-ink">{book.title}</strong>
                        <span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{book.year ? `سنة النشر ${book.year}` : 'من المؤلفات المنشورة'}{book.desc ? ` · ${book.desc.slice(0, 85)}${book.desc.length > 85 ? '…' : ''}` : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[1.75rem] border border-hair bg-canvas p-4 md:p-5">
                  <label htmlFor="ask-book-question" className="block text-[.72rem] font-semibold text-accent">سؤالك عن الكتاب</label>
                  <textarea
                    id="ask-book-question"
                    value={askBookQuestion}
                    onChange={(event) => setAskBookQuestion(event.target.value)}
                    placeholder="مثال: ما دور المعلّم في هذا الكتاب؟"
                    className="mt-2 min-h-36 w-full rounded-[1.4rem] border border-hair bg-wash px-4 py-3 text-[.88rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!askBookSlug || askBookQuestion.trim().length < 2) return
                        navigate(`/publications/${askBookSlug}?book_question=${encodeURIComponent(askBookQuestion.trim())}#ask-book-section`)
                      }}
                      disabled={!askBookSlug || askBookQuestion.trim().length < 2}
                      className="rounded-full bg-accent px-5 py-2.5 text-[.76rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      اذهب إلى جواب الكتاب
                    </button>
                    <button
                      type="button"
                      onClick={() => setAskBookQuestion('ما الفكرة الأساسية في هذا الكتاب؟')}
                      className="rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      ابدأ بسؤال جاهز
                    </button>
                  </div>
                  <p className="mt-3 text-[.68rem] leading-relaxed text-soft">الانتقال يفتح الصفحة نفسها عند القسم المناسب، ويحمّل سؤالك تلقائياً دون أن تبقى الميزة مدفونة في داخل الكتاب.</p>
                </div>
              </div>
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
                    <span className="mt-1.5 shrink-0 text-[.72rem] text-accent/[.65] transition-colors group-hover:text-accent">▷</span>
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
                  <Link to={row.url} className={`group grid gap-3 py-6 md:grid-cols-[7rem_1fr_5.5rem] md:items-baseline ${row.kind === 'book' ? 'pl-12' : ''}`}>
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
                      aria-label={`اسأل كتاب ${row.title}`}
                      title="اسأل هذا الكتاب"
                      className="absolute left-0 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-canvas text-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      <SocialIcon name="Question" size={16} />
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
                  اكتب حرفين على الأقل — البحث يفتح المقالات والأبحاث والكتب والإعلام والأسئلة معاً.
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
