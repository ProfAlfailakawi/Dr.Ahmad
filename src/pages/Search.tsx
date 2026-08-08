import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { FadeUp, Page, PageHead } from '../components/ui'
import { KnowledgeEntry } from '../components/KnowledgeEntry'
import { useSeo } from '../components/seo'
import { topKeywordsFor } from '../lib/cms'
import { buildKnowledgeGraph, graphSearch, type KnowledgeKind } from '../lib/knowledge-graph'
import { useCmsContent } from '../lib/content'
import { bestBookConcept, bookKnowledgeAnchor, getBookKnowledge } from '../lib/book-knowledge'
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
import { VoiceFigure, voiceKindForSpeaker } from '../components/VoiceFigure'
import { buildSmartQueryPlan, diversifySmartRows, scoreSmartFields, suggestedDomainTerms } from '../lib/smart-search'
import { normalizeSearchQuery, trackUsage } from '../lib/usage-analytics'
import { arabicCountPhrase, RESULT_FORMS } from '../lib/arabic-count.ts'

const ar = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])

const resultWord = (count: number) => arabicCountPhrase(count, RESULT_FORMS, (value) => ar(value))

const SEARCH_SUGGESTION_STOPWORDS = new Set([
  'الدكتور', 'المقال', 'مقال', 'كتاب', 'كتب', 'بحث', 'ابحاث', 'أبحاث', 'هذا', 'هذه',
  'التي', 'الذي', 'على', 'الى', 'إلى', 'عن', 'في', 'من', 'مع', 'كان', 'بعد', 'قبل',
])

const READY_QUESTION_STORAGE_KEY = 'dr-ahmad:ask-book-ready-questions:v1'

type ReadyQuestionState = {
  used: string[]
  cursor: number
  lastOffered?: string
}

type ReadyQuestionHistory = Record<string, ReadyQuestionState>

function readReadyQuestionHistory(): ReadyQuestionHistory {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READY_QUESTION_STORAGE_KEY) || '{}') as ReadyQuestionHistory
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeReadyQuestionHistory(history: ReadyQuestionHistory) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(READY_QUESTION_STORAGE_KEY, JSON.stringify(history))
  } catch {
    /* التخزين تحسينٌ للتجربة؛ تعطّله لا يعطّل البحث نفسه. */
  }
}

function readyQuestionsForBook(slug = '') {
  const knowledge = getBookKnowledge(slug)
  if (!knowledge) return []
  const questions = knowledge.concepts
    .filter((concept) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)$/u.test(concept.title.trim()))
    .flatMap((concept) => {
      const title = concept.title.trim().replace(/[؟?]+$/u, '')
      return [
        `ماذا يقول الكتاب عن «${title}»؟`,
        `ما الفكرة الأساسية في محور «${title}»؟`,
        `كيف يعالج الكتاب محور «${title}»؟`,
      ]
    })
  return Array.from(new Set(questions))
}

function nextReadyQuestion(slug: string, questions: string[], currentQuestion = '') {
  if (!slug || !questions.length) return ''
  const history = readReadyQuestionHistory()
  const current: ReadyQuestionState = history[slug] || { used: [], cursor: 0 }
  let used = current.used.filter((question) => questions.includes(question))
  const currentText = currentQuestion.trim()

  const pickFrom = (blocked: Set<string>) => {
    for (let offset = 0; offset < questions.length; offset += 1) {
      const index = (current.cursor + offset) % questions.length
      const question = questions[index]
      if (!blocked.has(question)) return { question, nextCursor: (index + 1) % questions.length }
    }
    return null
  }

  let picked = pickFrom(new Set([...used, currentText, current.lastOffered || '']))
  if (!picked) {
    used = []
    picked = pickFrom(new Set([currentText, current.lastOffered || '']))
  }
  if (!picked) picked = pickFrom(new Set())
  if (!picked) return ''

  history[slug] = { used, cursor: picked.nextCursor, lastOffered: picked.question }
  writeReadyQuestionHistory(history)
  return picked.question
}

function markReadyQuestionUsed(slug: string, question: string, questions: string[]) {
  if (!slug || !questions.includes(question)) return
  const history = readReadyQuestionHistory()
  const current: ReadyQuestionState = history[slug] || { used: [], cursor: 0 }
  history[slug] = {
    ...current,
    used: Array.from(new Set([...current.used.filter((item) => questions.includes(item)), question])),
    lastOffered: question,
  }
  writeReadyQuestionHistory(history)
}


/* ═══ محرك المعرفة الموحد ═══
   الكتاب يُبحث عبر خريطة مفاهيم مشتقة من متنه الكامل، لكن النتيجة لا تكشف
   المتن ولا ملف PDF: تعرض المحور وموضعه النصي فقط، من دون أي رابط لفتح الكتاب. */

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
  { id: 'passage', label: 'داخل كتب الدكتور' },
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
    /* صفحة البحث تُفهرس، أما نتيجةُ عبارةٍ بعينها فلا: تُتبع روابطها ولا تُفهرس هي. */
    robots: searchParams.get('q') ? 'noindex, follow' : undefined,
  })

  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [tab, setTab] = useState<TabId>(() => {
    const requested = searchParams.get('tab') as TabId | null
    return requested === 'askbook' || (requested && RESULT_TABS.some((item) => item.id === requested)) ? requested : 'all'
  })

  /* بطاقات طرق البحث تغيّر query string من دون إعادة تحميل الصفحة. لذلك
     نزامن الوضع النشط مع الرابط حتى يختفي البحث العام فور دخول «ابحث في كتاب»
     ويعود فور الرجوع إلى أي مسار آخر. */
  useEffect(() => {
    const requested = searchParams.get('tab') as TabId | null
    const nextTab: TabId = requested === 'askbook' || (requested && RESULT_TABS.some((item) => item.id === requested)) ? requested : 'all'
    setTab((current) => current === nextTab ? current : nextTab)
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('tab') !== 'askbook') return
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
    return () => window.cancelAnimationFrame(frame)
  }, [])

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
  const smartPlan = useMemo(() => buildSmartQueryPlan(normalizedQuery), [normalizedQuery])
  const expandedQuery = smartPlan.semanticText || normalizedQuery
  const domainSuggestions = useMemo(() => suggestedDomainTerms(smartPlan, 6), [smartPlan])

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


  /* نتائج المقالات الغنية (النص الكامل + فلاتر الفئة والسنة) */
  const articleResults = useMemo(() => {
    if (!searchStarted) return []
    const graphRanks = new Map(graphSearch(knowledgeGraph, expandedQuery, 160)
      .filter((row) => row.node.kind === 'article')
      .map((row) => [row.node.slug, row.score]))
    return articles
      .filter((article) => cat === 'الكل' || article.cat === cat)
      .filter((article) => year === 'الكل' || article.year === year)
      .map((article) => ({
        article,
        score: scoreSmartFields(smartPlan, [
          { value: article.title, weight: 5.2, phraseWeight: 1.6, exactWeight: 1.7 },
          { value: article.excerpt, weight: 2.8, phraseWeight: 1.2 },
          { value: article.body, weight: 1.15 },
          { value: article.cat, weight: 1.1 },
        ]) + (graphRanks.get(article.slug) || 0) * .45,
      }))
      .filter((row) => row.score > 7)
      .sort((left, right) => right.score - left.score || right.article.iso.localeCompare(left.article.iso))
      .map((row) => row.article)
  }, [articles, cat, expandedQuery, knowledgeGraph, searchStarted, smartPlan, year])

  /* بقية الأنواع من الخريطة المعرفية — العنوان والوصف العام والمجلة والباحثون */
  const graphResults = useMemo(() => {
    if (!searchStarted) return []
    return graphSearch(knowledgeGraph, expandedQuery, 60).filter((row) => row.node.kind !== 'article')
  }, [expandedQuery, searchStarted, knowledgeGraph])

  /* الأسئلة: بحث مباشر في نص السؤال ورأي الدكتور */
  const questionResults = useMemo(() => {
    if (!searchStarted) return []
    return staticQuestions
      .map((item, index) => ({
        item,
        index,
        hits: scoreSmartFields(smartPlan, [
          { value: item.ar, weight: 5, phraseWeight: 1.5, exactWeight: 1.6 },
          { value: item.take, weight: 2 },
        ]),
      }))
      .filter((row) => row.hits > 7)
      .sort((left, right) => right.hits - left.hits)
      .slice(0, 12)
  }, [searchStarted, smartPlan])

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
    () => (searchStarted && passagesReady ? searchBookPassages(normalizedQuery, 48) : []),
    [normalizedQuery, passagesReady, searchStarted])

  const selectedAskBook = useMemo(() => books.find((book) => book.slug === askBookSlug) || books[0] || null, [askBookSlug, books])
  const readyQuestions = useMemo(() => readyQuestionsForBook(selectedAskBook?.slug || ''), [selectedAskBook?.slug])
  const askBookPlan = useMemo(() => buildSmartQueryPlan(askBookQuestion), [askBookQuestion])
  const askBookAskedPlan = useMemo(() => buildSmartQueryPlan(askBookAsked), [askBookAsked])
  const askBookMatches = useMemo(
    () => (askBookReady && askBookAsked.length >= 2 && selectedAskBook ? searchBookPassages(askBookAsked, 8, selectedAskBook.slug) : []),
    [askBookAsked, askBookReady, selectedAskBook],
  )

  useEffect(() => {
    setAskBookQuestion('')
    setAskBookAsked('')
    setAskBookError('')
  }, [askBookSlug])

  const chooseReadyQuestion = () => {
    if (!selectedAskBook) return
    const question = nextReadyQuestion(selectedAskBook.slug, readyQuestions, askBookQuestion)
    if (!question) return
    setAskBookQuestion(question)
    setAskBookAsked('')
    setAskBookError('')
  }

  const submitAskBook = async () => {
    const question = askBookQuestion.trim()
    if (!selectedAskBook || question.length < 2 || askBookLoading) return
    setAskBookLoading(true)
    setAskBookError('')
    try {
      await loadBookPassages()
      setAskBookReady(true)
      setAskBookAsked(question)
      markReadyQuestionUsed(selectedAskBook.slug, question, readyQuestions)
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

  /* قائمة «الكل» الموحدة: ترتيب هجين بالمعنى مع تنويع الأنواع، حتى لا
     تبتلع المقالاتُ الكتبَ والأبحاثَ واللقاءات في أول الصفحة. */
  type UnifiedRow = { kind: UnifiedKind | 'passage'; slug?: string; title: string; snippet: string; url: string; year?: string; score: number }
  const unifiedRows: UnifiedRow[] = useMemo(() => {
    if (!searchStarted) return []
    const rows: UnifiedRow[] = []
    for (const item of articleResults) {
      rows.push({
        kind: 'article',
        slug: item.slug,
        title: item.title,
        snippet: item.excerpt || '',
        url: `/articles/${item.slug}`,
        year: item.iso.slice(0, 4),
        score: scoreSmartFields(smartPlan, [
          { value: item.title, weight: 5.2, phraseWeight: 1.6, exactWeight: 1.7 },
          { value: item.excerpt, weight: 2.8 },
          { value: item.body, weight: 1.05 },
        ]),
      })
    }
    for (const row of graphResults) {
      const bookMatch = row.node.kind === 'book' ? bestBookConcept(normalizedQuery, row.node.slug) : null
      rows.push({
        kind: row.node.kind as UnifiedKind,
        slug: row.node.slug,
        title: row.node.title,
        snippet: bookMatch && bookMatch.score > 18
          ? `داخل الكتاب: ${bookMatch.concept.title} · ص ${bookMatch.concept.pageStart}. ${bookMatch.concept.summary}`
          : row.node.text.slice(0, 180),
        url: bookMatch && bookMatch.score > 18
          ? `/publications/${row.node.slug}#${bookKnowledgeAnchor(bookMatch.concept)}`
          : row.node.url,
        year: row.node.year,
        score: row.score,
      })
    }
    for (const row of questionResults) {
      rows.push({ kind: 'question', slug: String(row.index), title: row.item.ar, snippet: row.item.take.slice(0, 180), url: '/questions', year: undefined, score: row.hits })
    }
    for (const hit of chapterHits) {
      rows.push({
        kind: 'media',
        slug: `media-${hit.videoId}`,
        title: `${hit.title} · نحو ${stamp(hit.chapter.at)}`,
        snippet: hit.chapter.text.slice(0, 170),
        url: `/media/media-${hit.videoId}`,
        year: undefined,
        score: hit.score * 7,
      })
    }
    for (const match of passageHits) {
      rows.push({
        kind: 'passage',
        slug: match.bookSlug,
        title: match.quote.evidenceType === 'concept'
          ? `${match.bookTitle} · ${match.quote.conceptTitle}`
          : `${match.bookTitle} · ص ${match.quote.page}`,
        snippet: match.quote.text,
        url: `/publications/${match.bookSlug}#book-knowledge`,
        year: undefined,
        score: match.score,
      })
    }
    return diversifySmartRows(rows, rows.length)
  }, [articleResults, chapterHits, graphResults, normalizedQuery, passageHits, questionResults, searchStarted, smartPlan])

  const activeRows = useMemo(() => tab === 'askbook' ? [] : tab === 'all' ? unifiedRows : unifiedRows.filter((row) => row.kind === tab), [tab, unifiedRows])
  const lastTrackedQuery = useRef('')
  const resultOpenedRef = useRef(false)
  useEffect(() => {
    if (!searchStarted) return
    const cleaned = normalizeSearchQuery(normalizedQuery)
    if (!cleaned || cleaned === lastTrackedQuery.current) return
    const refined = Boolean(lastTrackedQuery.current)
    trackUsage(refined ? 'search_refined' : 'search_submitted', { searchType: 'general', query: cleaned, normalizedQuery: normalizeArabic(cleaned) })
    lastTrackedQuery.current = cleaned
    resultOpenedRef.current = false
  }, [normalizedQuery, searchStarted])
  useEffect(() => {
    if (!searchStarted) return
    const total = tab === 'spoken' ? spokenHits.length : activeRows.length
    trackUsage(total ? 'search_results_shown' : 'search_zero_results', { searchType: 'general', query: normalizeSearchQuery(normalizedQuery), resultCount: total, tab })
  }, [activeRows.length, normalizedQuery, searchStarted, spokenHits.length, tab])
  useEffect(() => () => {
    if (searchStarted && !resultOpenedRef.current) trackUsage('search_abandoned', { searchType: 'general', query: normalizeSearchQuery(normalizedQuery), resultCount: activeRows.length })
  }, [activeRows.length, normalizedQuery, searchStarted])

  const keywords = useMemo(() => {
    const seen = new Set<string>()
    return topKeywordsFor(articleResults.slice(0, 18), 20)
      .map((word) => word.trim())
      .filter((word) => {
        const normalized = normalizeArabic(word)
        if (normalized.length < 4 || SEARCH_SUGGESTION_STOPWORDS.has(word) || SEARCH_SUGGESTION_STOPWORDS.has(normalized) || seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      .slice(0, 6)
  }, [articleResults])
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
        sub="يفهم ما تقصده حتى لو لم تعرف عنوان المادة أو كلماتها، ثم يفتح الكتب والمقالات والأبحاث واللقاءات معاً."
      />

      {tab !== 'askbook' && <div className="px-6 pt-8 md:px-11"><div className="mx-auto max-w-3xl"><KnowledgeEntry /></div></div>}

      <section className="px-6 py-10 md:px-11 md:py-12">
        <div className="mx-auto max-w-shell">
          {tab !== 'askbook' && <FadeUp>
            <div className="border-b border-hair pb-8">
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="اكتب بطريقتك: سؤال، موقف، فكرة"
                  enterKeyHint="search"
                  aria-label="بحث في الأرشيف كله"
                  className="w-full rounded-none border-0 border-b border-hair bg-transparent py-4 pe-16 ps-3 font-display text-[clamp(.85rem,2.8vw,2.2rem)] font-semibold leading-[1.5] text-ink outline-none transition-colors placeholder:text-soft/[.45] focus:border-accent sm:py-5 sm:pe-24 sm:ps-4 sm:text-[clamp(1.1rem,3.8vw,2.5rem)]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="مسح البحث"
                    title="مسح البحث"
                    className="absolute left-11 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-soft transition-colors hover:text-accent"
                  >
                    <SocialIcon name="Close" size={14} />
                  </button>
                )}
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
          </FadeUp>}

          {searchStarted && tab !== 'askbook' && <FadeUp delay={0.05}>
            <div className="mt-8 grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-[.9rem] text-soft" aria-live="polite">
                  {resultWord(tab === 'spoken' ? spokenHits.length : activeRows.length)}
                  <span> عن «{normalizedQuery}»</span>
                  {tab !== 'all' && <span> في {RESULT_TABS.find((item) => item.id === tab)?.label}</span>}
                </p>
                {(tab === 'all' || tab === 'article') && keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keywords.slice(0, 6).map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => setQuery(keyword)}
                        className="border-b border-hair pb-0.5 text-[.78rem] text-soft transition-colors hover:border-accent hover:text-accent"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {tab !== 'spoken' && (smartPlan.interpretation || smartPlan.suggestions.length > 0 || domainSuggestions.length > 0) && (
                <section className="rounded-[1.4rem] border border-hair bg-wash px-4 py-3.5" aria-label="فهم محرك البحث وصياغاته المقترحة">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[.66rem] font-semibold text-accent">فهم البحث</span>
                      {smartPlan.interpretation && <p className="mt-1 max-w-3xl text-[.8rem] leading-[1.8] text-ink/80">{smartPlan.interpretation}</p>}
                    </div>
                    <Link to={`/ask?q=${encodeURIComponent(normalizedQuery)}`} className="shrink-0 text-[.7rem] font-semibold text-accent transition-colors hover:text-accent-deep">حوّلها إلى إجابة موثقة ←</Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {smartPlan.suggestions.slice(0, 3).map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.7rem] leading-relaxed text-soft transition-colors hover:border-accent hover:text-accent">{suggestion}</button>
                    ))}
                    {domainSuggestions.slice(0, 3).map((suggestion) => (
                      <button key={`domain-${suggestion}`} type="button" onClick={() => setQuery(suggestion)} className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft transition-colors hover:border-accent hover:text-accent">{suggestion}</button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </FadeUp>}

          {tab === 'askbook' && <FadeUp delay={0.08}>
            <section className="mt-8 min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-hair bg-wash p-4 sm:p-5 md:p-7" aria-labelledby="ask-book-gateway-title">
              <div className="min-w-0">
                <h2 id="ask-book-gateway-title" className="break-words font-display text-[clamp(1.35rem,2.8vw,2rem)] font-semibold leading-[1.45] text-ink">بحث ذكي داخل كتاب من كتب الدكتور.</h2>

                <div dir="rtl" className="ask-book-rail rail mt-5 flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden" aria-label="اختيار الكتاب">
                  {books.map((book) => (
                    <button
                      key={book.slug}
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams)
                        next.set('tab', 'askbook')
                        next.set('book', book.slug)
                        setAskBookSlug(book.slug)
                        setAskBookQuestion('')
                        setAskBookAsked('')
                        setAskBookError('')
                        setSearchParams(next, { replace: true })
                      }}
                      aria-pressed={askBookSlug === book.slug}
                      className={`w-[78vw] max-w-[18rem] shrink-0 snap-start rounded-2xl border px-4 py-3 text-right transition-colors sm:w-[18rem] ${askBookSlug === book.slug ? 'border-accent bg-canvas shadow-sm' : 'border-hair bg-canvas/70 hover:border-accent/[.45]'}`}
                    >
                      <strong className="block break-words text-[.82rem] leading-relaxed text-ink">{book.title}</strong>
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
                  placeholder="اكتب بطريقتك: فكرة، موقف، سؤال، أو عنوان تتذكر معناه فقط"
                  className="min-h-32 w-full min-w-0 max-w-full resize-y rounded-[1.4rem] border border-hair bg-wash px-4 py-3 text-[.88rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent"
                />
                {askBookQuestion.trim().length >= 2 && (askBookPlan.interpretation || askBookPlan.suggestions.length > 0) && (
                  <div className="rounded-[1.2rem] border border-hair bg-wash px-3.5 py-3">
                    {askBookPlan.interpretation && <p className="text-[.72rem] leading-[1.75] text-soft"><span className="font-semibold text-accent">فهم السؤال: </span>{askBookPlan.interpretation}</p>}
                    {askBookPlan.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {askBookPlan.suggestions.slice(0, 3).map((suggestion) => (
                          <button key={suggestion} type="button" onClick={() => { setAskBookQuestion(suggestion); setAskBookAsked(''); setAskBookError('') }} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.68rem] leading-relaxed text-soft transition-colors hover:border-accent hover:text-accent">{suggestion}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="submit" disabled={!selectedAskBook || askBookQuestion.trim().length < 2 || askBookLoading} className="rounded-full bg-accent px-5 py-2.5 text-[.76rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45">{askBookLoading ? 'يجري البحث في المتن…' : 'ابحث في الكتاب'}</button>
                  <button type="button" onClick={chooseReadyQuestion} disabled={!readyQuestions.length} className="rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45">سؤال جاهز</button>
                </div>
                {askBookError && <p className="text-[.72rem] leading-relaxed text-accent" role="alert">{askBookError}</p>}
              </form>

              {askBookAsked && !askBookLoading && askBookReady && askBookMatches.length > 0 && (
                <section className="mt-5 min-w-0 rounded-[1.75rem] border border-hair bg-canvas p-4 md:p-5" aria-live="polite" aria-labelledby="ask-book-answer-title">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-hair pb-4">
                    <div className="min-w-0">
                      <span className="text-[.68rem] font-semibold text-accent">الجواب من الكتاب</span>
                      <h3 id="ask-book-answer-title" className="mt-1 break-words font-display text-[1.05rem] font-semibold leading-relaxed text-ink">{selectedAskBook?.title}</h3>
                      <p className="mt-1 break-words text-[.74rem] leading-relaxed text-soft">«{askBookAsked}»</p>
                    </div>
                  </div>

                  <div className="mt-4 grid min-w-0 gap-3">
                    <p className="text-[.76rem] leading-[1.85] text-soft">{askBookAskedPlan.interpretation || 'بحثتُ عن المعنى والصياغات القريبة داخل عناوين الكتاب ومحاوره ومقاطعه، لا عن الجملة نفسها فقط.'}</p>
                    {askBookMatches.map((match) => (
                      <figure key={`search-ask-${match.bookSlug}-${match.quote.id}`} className="min-w-0 overflow-hidden rounded-2xl border border-hair bg-wash px-4 py-4">
                        <span className="mb-2 inline-flex rounded-full border border-hair bg-canvas px-2.5 py-1 text-[.62rem] font-semibold text-accent">{match.quote.evidenceType === 'concept' ? 'محور مفهرس في الكتاب' : 'مقطع موثق من المتن'}</span>
                        {match.quote.evidenceType === 'concept'
                          ? <p className="break-words border-r-2 border-accent/[.35] pr-3 text-[.88rem] leading-[2] text-ink/[.88]">{match.quote.text}</p>
                          : <blockquote className="break-words border-r-2 border-accent/[.35] pr-3 text-[.88rem] font-light leading-[2] text-ink/[.88]">{match.quote.text}</blockquote>}
                        <figcaption className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 pr-3 text-[.68rem] text-soft">
                          <span className="break-words">{match.bookTitle} · ص {match.quote.page}{match.quote.conceptTitle ? ` · ${match.quote.conceptTitle}` : ''}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )}
              {askBookAsked && !askBookLoading && askBookReady && askBookMatches.length === 0 && (
                <div className="mt-5 rounded-[1.4rem] border border-hair bg-canvas px-4 py-4" role="status">
                  <p className="text-[.78rem] leading-[1.9] text-soft">لم تظهر شواهد كافية داخل هذا الكتاب بعد البحث في المعنى والعناوين والمحاور. لن أختلق جواباً من خارجه.</p>
                  {askBookAskedPlan.suggestions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{askBookAskedPlan.suggestions.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" onClick={() => { setAskBookQuestion(suggestion); setAskBookAsked('') }} className="rounded-full border border-hair px-3 py-1.5 text-[.68rem] text-soft transition-colors hover:border-accent hover:text-accent">{suggestion}</button>)}</div>}
                </div>
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
                      <span className="mt-1.5 flex min-w-0 items-center gap-1.5 truncate text-[.72rem] text-soft">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-hair bg-canvas text-accent" aria-label={voiceKindForSpeaker(hit.speaker) === 'woman' ? 'المتحدثة' : 'المتحدث'}><VoiceFigure kind={voiceKindForSpeaker(hit.speaker)} size={12} /></span>
                        <span className="opacity-45">·</span>
                        <span className="truncate">{hit.title}</span>
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
                  <Link to={row.url} onClick={() => { resultOpenedRef.current = true; trackUsage('search_result_opened', { searchType: 'general', query: normalizeSearchQuery(normalizedQuery), resultType: row.kind, resultId: row.slug || row.url, position: (paged.page - 1) * 20 + index + 1, timeToResultMs: 0 }) }} className={`group grid gap-3 py-6 md:grid-cols-[7rem_1fr_5.5rem] md:items-baseline ${row.kind === 'book' ? 'pb-16' : ''}`}>
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
                      className="absolute bottom-3 left-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/[.35] bg-canvas text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
                    >
                      <SocialIcon name="Search" size={14} />
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
