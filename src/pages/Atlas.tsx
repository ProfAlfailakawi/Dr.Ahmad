import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useNavigate } from 'react-router'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { useCmsContent } from '../lib/content'
import { categoryLabel, dynamicArticleCategories } from '../lib/content-taxonomy'
import { trackUsage } from '../lib/usage-analytics'
import { arabicCountPhrase, ARTICLE_AFTER_PREPOSITION_FORMS, WORD_PLAIN_FORMS } from '../lib/arabic-count.ts'
import { readArticleJourney, SPACE_EVENT, type StoredArticle } from '../lib/reading-space'
import { useAtlasSettings, visibleConstellations } from '../lib/atlas-settings'
import { currentSeason } from '../lib/seasons'
import rawArticleCaution from '../data/article-caution.json' with { type: 'json' }
import { sampleVisualArchive } from '../lib/archive-scale.mjs'

const W = 1160
const PAD_R = 150
const PAD_L = 26
const STAR_R_MAX = 12
const ROW = 74
const TOP = 54

const MOBILE_W = 680
const MOBILE_PAD_R = 118
const MOBILE_PAD_L = 22
const MOBILE_STAR_R_MAX = 12
const MOBILE_ROW = 64
const MOBILE_TOP = 38

/* Archive 2036: two SVG surfaces (desktop + mobile) must never grow with the
   entire corpus. Above this threshold the sky switches to deterministic LOD;
   direct-entry, latest, managed and reader-journey stars stay pinned. */
const ATLAS_STAR_BUDGET = 1600
const ATLAS_QUERY_PIN_BUDGET = 80
const ATLAS_FULL_GRAPH_LIMIT = 3200

const arDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const ARTICLE_CAUTION = (rawArticleCaution as { scores?: Record<string, number> }).scores || {}

const ATLAS_STOP = new Set(['هذا','هذه','ذلك','الذي','التي','على','الى','من','في','عن','مع','بين','بعد','قبل','كان','كانت','يكون','تكون','كيف','لكن','لان','وقد','وهو','وهي','كل','غير','عند','حتى','حول','ماذا','لماذا'])
const foldAtlas = (text = '') => text
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .toLowerCase()
const ideaTokens = (text = '') => new Set(foldAtlas(text)
  .replace(/[^\p{L}\p{N} ]/gu, ' ')
  .split(/\s+/).filter((word) => word.length > 3 && !ATLAS_STOP.has(word)))
type AtlasRelation = 'امتداد' | 'تضاد' | 'سياق'
type AtlasLink = { from: number; to: number; kind: 'evolution' | 'affinity'; score: number; relation: AtlasRelation; reason?: string }
type IndexedNeighbor = { kind?: string; slug?: string; score?: number; relation?: AtlasRelation; reason?: string }
type AtlasView = 'timeline' | 'graph'
type AtlasScope = 'mobile' | 'desktop'
type AtlasPoint = { i: number; x: number; y: number; r: number }

const linkKey = (link: AtlasLink) => `${link.kind}:${Math.min(link.from, link.to)}:${Math.max(link.from, link.to)}`
const pathBetween = (from: AtlasPoint, to: AtlasPoint, view: AtlasView) => {
  if (view === 'timeline') {
    const midX = (from.x + to.x) / 2
    const lift = Math.max(10, Math.min(28, Math.abs(from.x - to.x) * 0.08))
    const direction = from.y <= to.y ? -1 : 1
    return `M ${from.x} ${from.y} C ${midX} ${from.y + direction * lift}, ${midX} ${to.y - direction * lift}, ${to.x} ${to.y}`
  }
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const softBend = Math.min(26, Math.hypot(dx, dy) * 0.055)
  const controlX = midX - dy / Math.hypot(dx || 1, dy || 1) * softBend
  const controlY = midY + dx / Math.hypot(dx || 1, dy || 1) * softBend
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
}

const pointerToSvg = (event: ReactPointerEvent<SVGSVGElement>, width: number, height: number, scope: AtlasScope) => {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    scope,
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  }
}

type AtlasAxis = 'education' | 'pedagogy' | 'society' | 'technology' | 'identity' | 'media' | 'research'
const axisOf = (category = ''): AtlasAxis => {
  const value = foldAtlas(category)
  if (/بحث|علم|دراس/.test(value)) return 'research'
  if (/اعلام|صحاف|اذاعة|راديو/.test(value)) return 'media'
  if (/هويه|ثقاف|انتماء/.test(value)) return 'identity'
  if (/تقني|تكنولوج|رقمي|ذكاء|الكترون/.test(value)) return 'technology'
  if (/مجتمع|اسر|انسان/.test(value)) return 'society'
  if (/تربي|معلم|طالب|مدرس/.test(value)) return 'pedagogy'
  return 'education'
}
const axisStyle = (category: string) => ({ '--atlas-axis': `var(--atlas-${axisOf(category)})` } as CSSProperties)
const starStyle = (category: string, caution: number | null) => ({
  ...axisStyle(category),
  /* لون المركز يجيب عن «إلى أي محور تنتمي؟»، أمّا الحلقة الدقيقة فتجيب عن
     «أين تقع نبرتها بين الوعد والتحفّظ؟». مزجهما في fill واحد كان يمحو
     المحاور كلّها بصرياً ويجعل الأسطورة تقول شيئاً لا ترسمه السماء. */
  '--atlas-star-color': 'rgb(var(--atlas-axis))',
  '--atlas-star-heat': caution === null
    ? 'transparent'
    : `color-mix(in srgb, rgb(var(--atlas-warm)) ${100 - caution}%, rgb(var(--c-accent-deep)) ${caution}%)`,
} as CSSProperties)
const articleExcerptLine = (value = '') => {
  const compact = value.replace(/\s+/g, ' ').trim()
  const sentence = compact.match(/^.{24,150}?[.!؟؛…](?:\s|$)/u)?.[0] || compact
  return sentence.length > 122 ? `${sentence.slice(0, 119).trim()}…` : sentence
}
function readJourney() {
  return typeof window === 'undefined' ? [] as StoredArticle[] : readArticleJourney()
}

export default function Atlas() {
  const openedAt = useMemo(() => performance.now(), [])
  useEffect(() => {
    trackUsage('atlas_opened', { entry: document.referrer && new URL(document.referrer).origin === location.origin ? 'internal' : 'direct' }, { onceKey: 'atlas-opened' })
    return () => trackUsage('atlas_interaction', { type: 'session_duration', durationMs: Math.round(performance.now() - openedAt) })
  }, [openedAt])
  const { articles } = useCmsContent()
  const atlasSettings = useAtlasSettings()
  /* المحرَّرة بيده ثم المولّدة من الأرشيف — مُنتقٍ يستحقّ أن يُفتح. */
  const constellations = useMemo(() => visibleConstellations(atlasSettings), [atlasSettings])
  const atmosphere = useMemo(() => {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: '2-digit', hour12: false }).format(new Date()))
    return { period: hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'dusk' : 'night', seasonal: Boolean(currentSeason()) }
  }, [])
  const cats = useMemo(() => dynamicArticleCategories(articles, false), [articles])
  const H = TOP + Math.max(cats.length, 1) * ROW + 46
  const mobileH = MOBILE_TOP + Math.max(cats.length, 1) * MOBILE_ROW + 48
  useSeo({
    title: 'سماء المقالات',
    path: '/atlas',
    description: `خريطة بصرية لـ${arabicCountPhrase(articles.length, ARTICLE_AFTER_PREPOSITION_FORMS)} — كل نجمة تمثّل مقالاً، وحجمها طوله.`,
  })
  const systemReduce = useReducedMotion()
  /* عند اتساع الأرشيف نحافظ على السماء نفسها بصرياً، لكن نوقف الحركة
     الفردية لكل نجمة حتى لا تتحول آلاف النجوم إلى آلاف حلقات animation. */
  const reduce = Boolean(systemReduce) || articles.length > ATLAS_STAR_BUDGET
  const nav = useNavigate()
  const [hover, setHover] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  /* حالة الخريطة تعيش في الرابط (مقترح معتمد): مشاركة المشهد نفسه ممكنة */
  const [activeCat, setActiveCat] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('cat') || null
  })
  const [view, setView] = useState<AtlasView>(() => {
    if (typeof window === 'undefined') return 'timeline'
    return new URLSearchParams(window.location.search).get('view') === 'graph' ? 'graph' : 'timeline'
  })
  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') || ''
  })
  /* عندما يصل القارئ من «موقعها في السماء»، نحافظ على هوية المقال القادم
     ونهيّئ نجمته مباشرة بدل إسقاطه في خريطة عامة بلا سياق. */
  const [entrySlug] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('star') || ''
  })
  const [lens, setLens] = useState<{ x: number; y: number; scope: AtlasScope } | null>(null)
  const [showGraphDiscovery, setShowGraphDiscovery] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIndexes, setCompareIndexes] = useState<number[]>([])
  const [activeConstellation, setActiveConstellation] = useState('')
  const [showJourney, setShowJourney] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('journey') === '1')
  const [journey, setJourney] = useState<StoredArticle[]>(() => readJourney())
  const [graphNeighbors, setGraphNeighbors] = useState<Record<string, IndexedNeighbor[]> | null>(null)
  const [readerResonance, setReaderResonance] = useState<Map<string, number>>(new Map())

  /* الشبكة والتفاعل المجمع يصلان بعد أول رسم. في الأرشيف الكبير لا نحمل
     ملف علاقاتٍ ضخماً إلى الهاتف لمجرد فتح السماء؛ مسار التطور الزمني يبقى
     كاملاً بصرياً ضمن LOD، بينما البحث/الدخول المباشر يثبت النجمة المطلوبة. */
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (articles.length <= ATLAS_FULL_GRAPH_LIMIT) {
        void import('../data/article-graph-neighbors.json').then((module) => {
          if (!active) return
          const raw = (module.default || module) as { neighbors?: Record<string, IndexedNeighbor[]> }
          setGraphNeighbors(raw.neighbors || {})
        })
      } else {
        setGraphNeighbors({})
      }
      void (async () => {
        try {
          const [{ getDb }, firestore] = await Promise.all([import('../lib/firebase'), import('firebase/firestore')])
          const db = await getDb()
          if (!db || !active) return
          /* لا نسحب سجل التفاعل كاملاً كلما كبر الأرشيف. يكفي أعلى الإشارات
             لقياس الصدى البصري، والنجوم الأخرى تبقى بحجمها التحريري الطبيعي. */
          const highlights = firestore.collection(db, 'article_highlights')
          let snapshot
          try {
            snapshot = await firestore.getDocs(firestore.query(highlights, firestore.orderBy('count', 'desc'), firestore.limit(1200)))
          } catch {
            snapshot = await firestore.getDocs(firestore.query(highlights, firestore.limit(1200)))
          }
          const totals = new Map<string, number>()
          snapshot.forEach((row) => {
            const data = row.data() as { slug?: unknown; count?: unknown }
            const slug = typeof data.slug === 'string' ? data.slug : ''
            const count = Math.max(0, Number(data.count) || 0)
            if (slug && count >= 3) totals.set(slug, (totals.get(slug) || 0) + count)
          })
          if (active) setReaderResonance(totals)
        } catch { /* الصدى تحسين؛ السماء تبقى كاملة عند تعذّره. */ }
      })()
    }, 900)
    return () => { active = false; window.clearTimeout(timer) }
  }, [articles.length])

  useEffect(() => {
    const sync = () => setJourney(readJourney())
    window.addEventListener(SPACE_EVENT, sync)
    window.addEventListener('reader:journey-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SPACE_EVENT, sync)
      window.removeEventListener('reader:journey-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (view === 'graph') return
    const usedKey = 'atlas:graph-discovered:v2'
    const sessionKey = 'atlas:graph-discovery-shown:v2'
    try {
      if (localStorage.getItem(usedKey) === '1' || sessionStorage.getItem(sessionKey) === '1') return
      sessionStorage.setItem(sessionKey, '1')
    } catch { /* التخزين تحسين بصري فقط. */ }
    const show = window.setTimeout(() => setShowGraphDiscovery(true), 1200)
    const hide = window.setTimeout(() => setShowGraphDiscovery(false), 6500)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [view])

  const chooseGraphView = () => {
    try { localStorage.setItem('atlas:graph-discovered:v2', '1') } catch { /* noop */ }
    setShowGraphDiscovery(false)
    setView('graph')
    trackUsage('atlas_interaction', { type: 'view_graph' })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (view === 'graph') params.set('view', 'graph'); else params.delete('view')
    if (activeCat) params.set('cat', activeCat); else params.delete('cat')
    if (query.trim()) params.set('q', query.trim()); else params.delete('q')
    const search = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`)
  }, [view, activeCat, query])

  const deferredAtlasQuery = useDeferredValue(query)
  const articleIndexBySlug = useMemo(() => new Map(articles.map((article, index) => [article.slug, index])), [articles])
  const latestArticleSlug = useMemo(() => {
    let latest = articles[0]
    for (let index = 1; index < articles.length; index += 1) if (!latest || articles[index].iso > latest.iso) latest = articles[index]
    return latest?.slug || ''
  }, [articles])
  const atlasBaseArticles = useMemo(() => sampleVisualArchive(articles, ATLAS_STAR_BUDGET, {
    keyOf: (article) => article.slug,
    groupOf: (article) => `${article.cat}|${article.iso.slice(0, 4)}`,
    pinKeys: [entrySlug, atlasSettings.dailyStarSlug || '', latestArticleSlug, ...journey.slice(-80).map((item) => item.slug)].filter(Boolean),
  }), [articles, atlasSettings.dailyStarSlug, entrySlug, journey, latestArticleSlug])
  const queryPinnedArticles = useMemo(() => {
    if (articles.length <= ATLAS_STAR_BUDGET) return []
    const needle = foldAtlas(deferredAtlasQuery.trim())
    if (needle.length < 2) return []
    const output: typeof articles = []
    for (const article of articles) {
      if (!foldAtlas(`${article.title} ${article.excerpt || ''} ${categoryLabel(article.cat)}`).includes(needle)) continue
      output.push(article)
      if (output.length >= ATLAS_QUERY_PIN_BUDGET) break
    }
    return output
  }, [articles, deferredAtlasQuery])
  const atlasArticles = useMemo(() => {
    if (!queryPinnedArticles.length) return atlasBaseArticles
    const merged = new Map(atlasBaseArticles.map((article) => [article.slug, article]))
    for (const article of queryPinnedArticles) merged.set(article.slug, article)
    return [...merged.values()].sort((left, right) => (articleIndexBySlug.get(left.slug) ?? 0) - (articleIndexBySlug.get(right.slug) ?? 0))
  }, [articleIndexBySlug, atlasBaseArticles, queryPinnedArticles])

  const stars = useMemo(() => {
    const activeYears = Array.from(new Set(articles.map((a) => a.iso.slice(0, 4)).filter(Boolean)))
      .sort((a, b) => Number(a) - Number(b))
    const yearIndex = new Map(activeYears.map((year, index) => [year, index]))
    const yearDenominator = Math.max(activeYears.length - 1 + 0.72, 1)
    let wMin = Number.POSITIVE_INFINITY
    let wMax = 260
    for (const article of articles) {
      const count = article.body ? article.body.trim().split(/\s+/).length : Math.max(article.words || 0, 260)
      wMin = Math.min(wMin, count)
      wMax = Math.max(wMax, count)
    }
    if (!Number.isFinite(wMin)) wMin = 260

    return atlasArticles.map((a, sampleIndex) => {
      const i = articleIndexBySlug.get(a.slug) ?? sampleIndex
      const date = new Date(a.iso)
      const year = a.iso.slice(0, 4)
      const start = new Date(`${year}-01-01T00:00:00Z`).getTime()
      const end = new Date(`${Number(year) + 1}-01-01T00:00:00Z`).getTime()
      const withinYear = Math.min(Math.max((date.getTime() - start) / (end - start || 1), 0), 1)
      const ordinal = (yearIndex.get(year) || 0) + withinYear * 0.72
      const t = activeYears.length <= 1 ? 0.5 : ordinal / yearDenominator
      const x = W - PAD_R - STAR_R_MAX - t * (W - PAD_R - STAR_R_MAX - PAD_L)
      const row = Math.max(0, cats.indexOf(a.cat))
      const jitter = ((i * 37) % 21) - 10
      const y = TOP + row * ROW + ROW / 2 + jitter * 0.55
      const w = a.body ? a.body.trim().split(/\s+/).length : Math.max(a.words || 0, 260)
      /* العين تقرأ المساحة لا نصف القطر. المدى القديم (3٫4 ← 12) كان يجعل
         أطول مقال أكبر 12 ضعفاً مساحةً وهو أطول مرّتين فقط، فتبتلع نجمةٌ
         واحدة السماء. المدى هنا يجعل الأكبر ضِعف الأصغر مساحةً — كما هو حقاً. */
      const baseRadius = 4.5 + ((w - wMin) / (wMax - wMin || 1)) * 2.5
      const resonance = readerResonance.get(a.slug) || 0
      const r = baseRadius * (1 + Math.min(.12, Math.log2(resonance + 1) * .018))
      const caution = Number.isFinite(ARTICLE_CAUTION[a.slug]) ? ARTICLE_CAUTION[a.slug] : null
      return { ...a, x, y, r, words: w, i, t, row, jitter, caution, resonance }
    })
  }, [articleIndexBySlug, articles, atlasArticles, cats, readerResonance])

  const entryStar = useMemo(() => entrySlug ? stars.find((star) => star.slug === entrySlug) || null : null, [entrySlug, stars])

  useEffect(() => {
    if (!entryStar) return
    setSelected(entryStar.i)
    setHover(null)
  }, [entryStar?.i])

  const mobileStars = useMemo(() => stars.map((star) => ({
    ...star,
    x: MOBILE_W - MOBILE_PAD_R - MOBILE_STAR_R_MAX - star.t * (MOBILE_W - MOBILE_PAD_R - MOBILE_STAR_R_MAX - MOBILE_PAD_L),
    y: MOBILE_TOP + star.row * MOBILE_ROW + MOBILE_ROW / 2 + star.jitter * 0.4,
    r: Math.max(3.9, Math.min(9, star.r * 0.92)),
  })), [stars])

  const graphGeometry = useMemo(() => {
    const cx = (W + 40) / 2
    const cy = H / 2 + 6
    const maxR = Math.min(cx - PAD_L - 20, cy - TOP)
    return { cx, cy, maxR, rings: [0.38, 0.62, 0.86].map((ratio) => maxR * ratio) }
  }, [H])

  const mobileGraphGeometry = useMemo(() => {
    const cx = MOBILE_W / 2
    const cy = mobileH / 2 + 4
    const maxR = Math.min(cx - MOBILE_PAD_L - 14, cy - MOBILE_TOP)
    return { cx, cy, maxR, rings: [0.38, 0.62, 0.86].map((ratio) => maxR * ratio) }
  }, [mobileH])

  /* شبكة الأفكار: تخطيط شعاعي حقيقي — كل تصنيف عنقود في قطاع زاوي، والسنة تحدد البعد
     عن المركز (الأقدم داخلاً، الأحدث خارجاً)، فتتحول الخريطة من مسار زمني إلى كوكبة
     مترابطة تُبرز صلات الأفكار بين المواضيع لا تسلسلها الزمني فقط. */
  const graphStars = useMemo(() => {
    const perCat = new Map<string, number>()
    const catCount = new Map<string, number>()
    for (const star of stars) catCount.set(star.cat, (catCount.get(star.cat) || 0) + 1)
    return stars.map((star) => {
      const row = Math.max(0, cats.indexOf(star.cat))
      const sector = (2 * Math.PI) / Math.max(cats.length, 1)
      const within = perCat.get(star.cat) || 0
      perCat.set(star.cat, within + 1)
      const total = Math.max(catCount.get(star.cat) || 1, 1)
      const spread = total > 1 ? (within / (total - 1) - 0.5) : 0
      const angle = row * sector + sector * 0.5 + spread * sector * 0.62 - Math.PI / 2
      const radius = graphGeometry.maxR * (0.36 + star.t * 0.58) + ((star.i * 29) % 17) - 8
      return { ...star, x: graphGeometry.cx + Math.cos(angle) * radius, y: graphGeometry.cy + Math.sin(angle) * radius }
    })
  }, [stars, cats, graphGeometry])

  const graphMobileStars = useMemo(() => {
    const perCat = new Map<string, number>()
    const catCount = new Map<string, number>()
    for (const star of stars) catCount.set(star.cat, (catCount.get(star.cat) || 0) + 1)
    return stars.map((star) => {
      const row = Math.max(0, cats.indexOf(star.cat))
      const sector = (2 * Math.PI) / Math.max(cats.length, 1)
      const within = perCat.get(star.cat) || 0
      perCat.set(star.cat, within + 1)
      const total = Math.max(catCount.get(star.cat) || 1, 1)
      const spread = total > 1 ? (within / (total - 1) - 0.5) : 0
      const angle = row * sector + sector * 0.5 + spread * sector * 0.62 - Math.PI / 2
      const radius = mobileGraphGeometry.maxR * (0.36 + star.t * 0.58) + ((star.i * 23) % 13) - 6
      return { ...star, x: mobileGraphGeometry.cx + Math.cos(angle) * radius, y: mobileGraphGeometry.cy + Math.sin(angle) * radius, r: Math.max(3.9, Math.min(9, star.r * 0.92)) }
    })
  }, [stars, cats, mobileGraphGeometry])

  const layout = view === 'graph' ? graphStars : stars
  const mobileLayout = view === 'graph' ? graphMobileStars : mobileStars

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('star')
    if (!slug) return
    const target = stars.find((star) => star.slug === slug)
    if (target) setSelected(target.i)
  }, [stars])

  const links = useMemo<AtlasLink[]>(() => {
    const output: AtlasLink[] = []
    const seen = new Set<string>()
    const add = (from: number, to: number, kind: AtlasLink['kind'], score: number, relation: AtlasRelation, reason?: string) => {
      if (from === to) return
      const pair = from < to ? `${from}:${to}` : `${to}:${from}`
      const key = `${kind}:${pair}`
      if (seen.has(key)) return
      seen.add(key)
      output.push({ from, to, kind, score, relation, reason })
    }

    for (const category of cats) {
      const thread = stars.filter((star) => star.cat === category).sort((left, right) => left.iso.localeCompare(right.iso))
      for (let index = 1; index < thread.length; index += 1) add(thread[index - 1].i, thread[index].i, 'evolution', 1, 'امتداد', 'تعاقب زمني داخل المحور نفسه')
    }
    if (graphNeighbors) {
      const bySlug = new Map(stars.map((star) => [star.slug, star]))
      for (const star of stars) for (const neighbor of graphNeighbors[`article:${star.slug}`] || []) {
        if (neighbor.kind !== 'article' || !neighbor.slug) continue
        const target = bySlug.get(neighbor.slug)
        if (!target || target.cat === star.cat) continue
        add(star.i, target.i, 'affinity', Number(neighbor.score) || 0, neighbor.relation || 'سياق', neighbor.reason)
      }
    }
    return output
  }, [stars, cats, graphNeighbors])

  const years = useMemo(() => {
    const map = new Map<string, { desktop: number[]; mobile: number[] }>()
    const fullCounts = new Map<string, number>()
    for (const article of articles) {
      const year = article.iso.slice(0, 4)
      if (year) fullCounts.set(year, (fullCounts.get(year) || 0) + 1)
    }
    stars.forEach((star, index) => {
      const year = star.iso.slice(0, 4)
      if (!map.has(year)) map.set(year, { desktop: [], mobile: [] })
      map.get(year)!.desktop.push(star.x)
      map.get(year)!.mobile.push(mobileStars[index]?.x ?? 0)
    })
    return [...map.entries()].map(([year, points]) => ({
      year,
      x: points.desktop.reduce((a, b) => a + b, 0) / points.desktop.length,
      mobileX: points.mobile.reduce((a, b) => a + b, 0) / points.mobile.length,
      count: fullCounts.get(year) || points.desktop.length,
    }))
  }, [articles, stars, mobileStars])

  /* «ابحث عن فكرة في السماء» (مقترح معتمد): النجوم غير المطابقة تخفت ولا تختفي */
  const searchMatches = useMemo(() => {
    const needle = foldAtlas(query.trim())
    if (!needle) return null
    return new Set(stars
      .filter((star) => foldAtlas(`${star.title} ${star.excerpt || ''} ${categoryLabel(star.cat)}`).includes(needle))
      .map((star) => star.i))
  }, [query, stars])

  const constellation = useMemo(
    () => constellations.find((item) => item.id === activeConstellation) || null,
    [activeConstellation, constellations],
  )
  const constellationIndexes = useMemo(() => new Set(
    (constellation?.slugs || []).map((slug) => stars.find((star) => star.slug === slug)?.i).filter((index): index is number => index !== undefined),
  ), [constellation, stars])
  const constellationPath = useMemo(() => (constellation?.slugs || [])
    .map((slug) => layout.find((star) => star.slug === slug))
    .filter((star): star is (typeof layout)[number] => Boolean(star)), [constellation, layout])
  const mobileConstellationPath = useMemo(() => (constellation?.slugs || [])
    .map((slug) => mobileLayout.find((star) => star.slug === slug))
    .filter((star): star is (typeof mobileLayout)[number] => Boolean(star)), [constellation, mobileLayout])
  const journeyStars = useMemo(() => journey
    .map((item) => layout.find((star) => star.slug === item.slug))
    .filter((star): star is (typeof layout)[number] => Boolean(star)), [journey, layout])
  const mobileJourneyStars = useMemo(() => journey
    .map((item) => mobileLayout.find((star) => star.slug === item.slug))
    .filter((star): star is (typeof mobileLayout)[number] => Boolean(star)), [journey, mobileLayout])
  const journeyIndexes = useMemo(() => new Set(journeyStars.map((star) => star.i)), [journeyStars])

  const dim = (star: (typeof stars)[number]) => {
    if (searchMatches && !searchMatches.has(star.i)) return 0.08
    if (constellation && !constellationIndexes.has(star.i)) return 0.11
    return activeCat && star.cat !== activeCat ? 0.12 : 1
  }
  const activeIndex = hover ?? selected
  const active = activeIndex !== null ? layout.find((star) => star.i === activeIndex) : null
  const mobileActive = activeIndex !== null ? mobileLayout.find((star) => star.i === activeIndex) : null
  const activeLinks = useMemo(() => activeIndex === null ? [] : links.filter((link) => link.from === activeIndex || link.to === activeIndex), [links, activeIndex])
  const connectedIndexes = useMemo(() => {
    const set = new Set<number>()
    if (activeIndex === null) return set
    set.add(activeIndex)
    activeLinks.forEach((link) => { set.add(link.from); set.add(link.to) })
    return set
  }, [activeIndex, activeLinks])
  const timelineTrail = useMemo(() => {
    if (activeIndex === null) return []
    const current = stars.find((star) => star.i === activeIndex)
    if (!current) return []
    const thread = stars.filter((star) => star.cat === current.cat).sort((left, right) => left.iso.localeCompare(right.iso))
    const index = thread.findIndex((star) => star.i === activeIndex)
    return [
      thread[index - 1] ? { star: thread[index - 1], label: 'قبلها' } : null,
      { star: current, label: 'النجمة الحالية' },
      thread[index + 1] ? { star: thread[index + 1], label: 'بعدها' } : null,
    ].filter((item): item is { star: (typeof stars)[number]; label: string } => Boolean(item))
  }, [activeIndex, stars])
  const ideaTrail = useMemo(() => activeLinks
    .filter((link) => link.kind === 'affinity')
    .sort((left, right) => right.score - left.score)
    .map((link) => {
      const index = link.from === activeIndex ? link.to : link.from
      const star = stars.find((item) => item.i === index)
      return star ? { ...link, star } : null
    })
    .filter((item): item is AtlasLink & { star: (typeof stars)[number] } => Boolean(item))
    .slice(0, 3), [activeLinks, activeIndex, stars])
  const trailIndexSet = useMemo(() => new Set([
    ...timelineTrail.map((item) => item.star.i),
    ...ideaTrail.map((item) => item.star.i),
  ]), [ideaTrail, timelineTrail])
  const ambientLinkIds = useMemo(() => new Set(
    [...links]
      .filter((link) => link.kind === 'affinity')
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.min(24, Math.max(10, Math.round(stars.length * 0.16))))
      .map(linkKey),
  ), [links, stars.length])
  const dayStarIndex = useMemo(() => {
    if (!stars.length) return null
    const managed = atlasSettings.dailyStarSlug && stars.find((star) => star.slug === atlasSettings.dailyStarSlug)
    if (managed) return managed.i
    const today = new Date()
    const seed = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000)
    return stars[(seed * 17 + stars.length * 11) % stars.length]?.i ?? null
  }, [atlasSettings.dailyStarSlug, stars])
  const latestStarIndex = useMemo(() => {
    if (!stars.length) return null
    return stars.reduce((best, star) => star.iso > best.iso ? star : best, stars[0]).i
  }, [stars])
  const starPresence = (star: (typeof layout)[number], isActive: boolean, scope: AtlasScope) => {
    const categoryPresence = dim(star)
    if (categoryPresence < 1) return categoryPresence
    if (activeIndex !== null) {
      if (isActive) return 1
      if (trailIndexSet.has(star.i)) return 0.88
      if (connectedIndexes.has(star.i)) return 0.66
      return view === 'graph' ? 0.24 : 0.28
    }
    if (lens?.scope === scope) {
      const distance = Math.hypot(star.x - lens.x, star.y - lens.y)
      const near = scope === 'mobile' ? 58 : 76
      const far = scope === 'mobile' ? 118 : 154
      if (distance <= near) return 0.9
      if (distance <= far) return 0.72
      return view === 'graph' ? 0.48 : 0.54
    }
    if (star.i === dayStarIndex || star.i === latestStarIndex || (showJourney && journeyIndexes.has(star.i))) return 0.9
    return view === 'graph' ? 0.58 : 0.64
  }
  const related = useMemo(() => activeLinks.map((link) => {
    const index = link.from === activeIndex ? link.to : link.from
    return { ...link, star: stars.find((item) => item.i === index) }
  }).filter((item): item is AtlasLink & { star: (typeof stars)[number] } => Boolean(item.star))
    .sort((left, right) => left.star.iso.localeCompare(right.star.iso)).slice(0, 6), [activeLinks, activeIndex, stars])
  const ideaSignature = useMemo(() => active ? Array.from(ideaTokens(`${active.title} ${active.excerpt || ''}`)).slice(0, 4) : [], [active])
  const tooltipWidth = 310
  const tooltipHeight = 126
  const tooltipX = active ? clamp(active.x - tooltipWidth / 2, PAD_L, W - PAD_R - tooltipWidth) : 0
  const tooltipY = active ? (active.y > 125 ? active.y - tooltipHeight - 18 : active.y + 18) : 0
  const viewHint = view === 'timeline'
    ? 'المسار الزمني صار يقرأ ولادة الفكرة: سنوات خافتة، ونهرٌ يظهر قبل النجمة وبعدها عند الاختيار.'
    : 'شبكة الأفكار تعرض أقوى القرابات فقط: كوكبات ذكية لا شبكة أسلاك مزدحمة.'
  const comparedStars = compareIndexes.map((index) => stars.find((star) => star.i === index)).filter((star): star is (typeof stars)[number] => Boolean(star))
  const journeyTopAxis = useMemo(() => {
    const counts = new Map<string, number>()
    journeyStars.forEach((star) => counts.set(star.cat, (counts.get(star.cat) || 0) + 1))
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || ''
  }, [journeyStars])

  const pick = (index: number, slug: string, _pointerType: string) => {
    if (compareMode) {
      setCompareIndexes((current) => current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current.slice(-1), index])
      setSelected(index)
      setHover(null)
      return
    }
    /* الكمبيوتر كالهاتف الآن: الضغطة الأولى تُظهر بطاقة المقال وتُثبتها (ومنها رابط
       القراءة ومسار الفكرة)، والضغطة الثانية على النجمة نفسها تفتح المقال. */
    if (selected === index) {
      nav(`/articles/${slug}`, { viewTransition: !reduce })
      return
    }
    setSelected(index)
    setHover(null)
    window.setTimeout(() => document.getElementById('atlas-selection')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }), 80)
  }

  const handleStarKey = (event: ReactKeyboardEvent<SVGCircleElement>, star: (typeof layout)[number], scope: AtlasScope) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(star.i, star.slug, 'keyboard')
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const points = scope === 'mobile' ? mobileLayout : layout
    const direction = event.key
    const candidate = points
      .filter((item) => item.i !== star.i)
      .map((item) => ({
        item,
        dx: item.x - star.x,
        dy: item.y - star.y,
      }))
      .filter(({ dx, dy }) => direction === 'ArrowLeft' ? dx < -1 : direction === 'ArrowRight' ? dx > 1 : direction === 'ArrowUp' ? dy < -1 : dy > 1)
      .sort((left, right) => Math.hypot(left.dx, left.dy) - Math.hypot(right.dx, right.dy))[0]?.item
    if (!candidate) return
    document.querySelector<SVGCircleElement>(`[data-atlas-scope="${scope}"][data-star-index="${candidate.i}"]`)?.focus()
  }

  const shareJourney = async () => {
    if (!journeyStars.length) return
    const { renderQuoteCard } = await import('../lib/quote-card')
    const branded = await renderQuoteCard('', {
      attribution: `بصمتي القارئة · قرأت ${journeyStars.length} من ${articles.length}`,
      dark: true,
    })
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const context = canvas.getContext('2d')
    if (!context) return
    const base = new Image()
    base.src = branded
    await new Promise<void>((resolve) => { base.onload = () => resolve(); base.onerror = () => resolve() })
    if (base.complete && base.naturalWidth) context.drawImage(base, 0, 0, 1080, 1080)
    else { context.fillStyle = '#111215'; context.fillRect(0, 0, 1080, 1080) }
    context.strokeStyle = 'rgba(132,169,202,.22)'
    context.lineWidth = 3
    context.beginPath()
    journeyStars.forEach((star, index) => {
      const x = 100 + ((star.x / W) * 880)
      const y = 250 + ((star.y / H) * 520)
      if (!index) context.moveTo(x, y); else context.lineTo(x, y)
    })
    context.stroke()
    journeyStars.forEach((star) => {
      const x = 100 + ((star.x / W) * 880)
      const y = 250 + ((star.y / H) * 520)
      context.beginPath()
      context.fillStyle = `rgb(${getComputedStyle(document.querySelector('.atlas-night') || document.documentElement).getPropertyValue(`--atlas-${axisOf(star.cat)}`).trim() || '132 169 202'})`
      context.arc(x, y, Math.max(8, star.r * 1.8), 0, Math.PI * 2)
      context.fill()
    })
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], 'reader-constellation.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'بصمتي القارئة' })
      else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    } catch { /* إلغاء المشاركة لا يحتاج رسالة خطأ. */ }
  }

  const categoryButtons = (
    <div className="atlas-axis-filter mb-8 flex flex-wrap gap-x-4 gap-y-2 md:pb-0" aria-label="تصفية السماء حسب المحور">
      <button
        onClick={() => { setActiveCat(null); setSelected(null) }}
        className={`atlas-axis-filter__item min-h-11 shrink-0 whitespace-nowrap border-b px-1 py-1.5 text-[.8rem] font-medium transition-colors duration-200 ${
          !activeCat ? 'border-accent text-ink' : 'border-transparent text-soft hover:border-hair hover:text-ink'
        }`}
      >
        <span className="atlas-axis-filter__spectrum" aria-hidden="true" />
        الكل
      </button>
      {cats.map((category) => (
        <button
          key={category}
          onClick={() => { setActiveCat(activeCat === category ? null : category); setSelected(null) }}
          className={`atlas-axis-filter__item min-h-11 shrink-0 whitespace-nowrap border-b px-1 py-1.5 text-[.8rem] font-medium transition-colors duration-200 ${
            activeCat === category ? 'border-accent text-ink' : 'border-transparent text-soft hover:border-hair hover:text-ink'
          }`}
          style={axisStyle(category)}
        >
          <span className="atlas-axis-filter__dot" aria-hidden="true" />
          {categoryLabel(category)}
        </button>
      ))}
    </div>
  )

  return (
    <Page>
      <PageHead
        label="خريطة"
        title="سماء المقالات."
        sub="كل نجمة مقال، وكل خط مسارٌ موثّق: تطور داخل الموضوع أو صلة فكرية بين مقالات متباعدة."
      />

      <section className="px-4 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {entryStar && (
            <FadeUp>
              <aside className="atlas-arrival mb-6 border-y border-accent/20 py-4" aria-live="polite">
                <span className="text-[.66rem] font-semibold text-accent">المقال القادم</span>
                <strong className="mt-1 block break-words font-display text-[1rem] font-semibold leading-[1.7] text-ink md:text-[1.15rem]">{entryStar.title}</strong>
              </aside>
            </FadeUp>
          )}
          <FadeUp>{categoryButtons}</FadeUp>

          <FadeUp delay={0.04}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="w-full sm:max-w-[19rem]">
                <input
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setSelected(null) }}
                  placeholder="ابحث عن فكرة في السماء…"
                  aria-label="ابحث عن فكرة في خريطة المقالات"
                  className="min-h-11 w-full rounded-full border border-hair bg-canvas px-4 py-2 text-[.82rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
                />
                {searchMatches !== null && (
                  <p className="mt-1.5 ps-4 text-[.7rem] font-light text-soft">
                    {searchMatches.size === 0 ? 'لا نجمة تحمل هذه الفكرة حالياً.' : searchMatches.size === 1 ? 'نجمة واحدة تضيء.' : searchMatches.size === 2 ? 'نجمتان تضيئان.' : `${arDigits(searchMatches.size)} ${searchMatches.size <= 10 ? 'نجوم تضيء' : 'نجمة تضيء'}.`}
                  </p>
                )}
              </div>
              <p className="hidden max-w-[30rem] text-[.78rem] font-light text-soft lg:block">{viewHint}</p>
              <div className="atlas-view-switch ms-auto inline-flex rounded-full border border-hair bg-canvas p-1" role="group" aria-label="طريقة عرض خريطة الأفكار">
                <button type="button" onClick={() => { setView('timeline'); trackUsage('atlas_interaction', { type: 'view_timeline' }) }} aria-pressed={view === 'timeline'} className={`min-h-11 rounded-full px-4 py-1.5 text-[.74rem] font-semibold transition-colors ${view === 'timeline' ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>المسار الزمني</button>
                <button type="button" onClick={chooseGraphView} aria-pressed={view === 'graph'} className={`atlas-graph-switch relative min-h-11 rounded-full px-4 py-1.5 text-[.74rem] font-semibold transition-colors ${view === 'graph' ? 'bg-accent text-white' : 'text-soft hover:text-accent'} ${showGraphDiscovery ? 'is-discovering' : ''}`}>
                  شبكة الأفكار
                </button>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.06}>
            <div className="mb-5 flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={() => { setCompareMode((value) => !value); setCompareIndexes([]) }} aria-pressed={compareMode} className={`min-h-11 rounded-full border px-4 text-[.72rem] font-semibold transition-colors ${compareMode ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>مقارنة نجمتين</button>
              {journeyStars.length > 0 && <button type="button" onClick={() => setShowJourney((value) => !value)} aria-pressed={showJourney} className={`min-h-11 rounded-full border px-4 text-[.72rem] font-semibold transition-colors ${showJourney ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>بصمتي · {arDigits(journeyStars.length)}</button>}
              {constellations.length > 0 && (
                <label className="sr-only" htmlFor="atlas-constellation">اختر كوكبة</label>
              )}
              {constellations.length > 0 && (
                <select id="atlas-constellation" value={activeConstellation} onChange={(event) => setActiveConstellation(event.target.value)} className="atlas-constellation-select min-h-11 w-[12.5rem] max-w-full rounded-full border border-hair bg-canvas px-4 text-[.72rem] font-semibold text-soft outline-none focus:border-accent">
                  <option value="">كل الكوكبات</option>
                  {constellations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              )}
            </div>
          </FadeUp>

          <FadeUp delay={0.08}>
            <div className={`atlas-night atlas-atmosphere--${atmosphere.period}${atmosphere.seasonal ? ' is-seasonal' : ''} relative overflow-hidden rounded-2xl border border-hair lg:overflow-x-auto ${view === 'graph' ? 'is-graph' : 'is-timeline'}`} onPointerLeave={() => { setHover(null); setLens(null) }}>
              {/* نسخة الهاتف: تتكيّف مع العرض، بلا تمرير جانبي ولا نافذة عائمة مقصوصة. */}
              <svg
                viewBox={`0 0 ${MOBILE_W} ${mobileH}`}
                className="atlas-map-mobile block h-auto w-full lg:hidden"
                role="img"
                aria-label="خريطة المقالات"
                onPointerMove={(event) => { if (event.pointerType === 'mouse') setLens(pointerToSvg(event, MOBILE_W, mobileH, 'mobile')) }}
              >
                {view === 'timeline' && years.map((item) => (
                  <line key={`mobile-year-ray-${item.year}`} x1={item.mobileX} y1={18} x2={item.mobileX} y2={mobileH - 34} className="stroke-accent" strokeWidth={Math.min(9, 2 + item.count)} strokeOpacity={0.026 + Math.min(item.count * 0.006, 0.042)} strokeLinecap="round" />
                ))}

                {view === 'timeline' && cats.map((category, row) => {
                  const y = MOBILE_TOP + row * MOBILE_ROW + MOBILE_ROW / 2
                  const on = !activeCat || activeCat === category
                  return (
                    <g key={category} opacity={on ? 1 : 0.25}>
                      <line x1={MOBILE_PAD_L} y1={y} x2={MOBILE_W - MOBILE_PAD_R + 8} y2={y} stroke="currentColor" className="text-ink" strokeOpacity={0.055} />
                      <line x1={MOBILE_W - MOBILE_PAD_R + 5} y1={y} x2={MOBILE_W - MOBILE_PAD_R + 17} y2={y} stroke={`rgb(var(--atlas-${axisOf(category)}))`} strokeWidth={3} strokeLinecap="round" />
                      <text x={MOBILE_W - MOBILE_PAD_R + 25} y={y + 5} textAnchor="start" className="fill-soft font-sans" style={{ fontSize: 13.5, fontWeight: activeCat === category ? 700 : 500 }}>{categoryLabel(category)}</text>
                    </g>
                  )
                })}

                {view === 'graph' && mobileGraphGeometry.rings.map((radius, index) => (
                  <circle key={`mobile-orbit-${radius}`} cx={mobileGraphGeometry.cx} cy={mobileGraphGeometry.cy} r={radius} className="fill-none stroke-accent" strokeOpacity={index === 2 ? 0.07 : 0.045} strokeWidth={1} />
                ))}

                {view === 'timeline' && years.map((item) => (
                  <text key={item.year} x={item.mobileX} y={mobileH - 15} textAnchor="middle" className="fill-soft font-sans" style={{ fontSize: 17 }}>
                    {arDigits(item.year)}
                  </text>
                ))}

                {links.map((link) => {
                  const from = mobileLayout.find((star) => star.i === link.from)
                  const to = mobileLayout.find((star) => star.i === link.to)
                  if (!from || !to) return null
                  const connected = activeIndex !== null && (link.from === activeIndex || link.to === activeIndex)
                  if (view === 'timeline' && link.kind === 'affinity' && !connected) return null
                  if (view === 'timeline' && link.kind === 'evolution' && !connected && (!activeCat || from.cat !== activeCat || to.cat !== activeCat)) return null
                  if (view === 'graph' && !connected && !ambientLinkIds.has(linkKey(link))) return null
                  const hiddenByCategory = (activeCat && from.cat !== activeCat && to.cat !== activeCat) || (searchMatches !== null && !searchMatches.has(link.from) && !searchMatches.has(link.to))
                  const graphVisible = view === 'graph' && !connected
                  return <path key={`mobile-link-${link.kind}-${link.from}-${link.to}`} d={pathBetween(from, to, view)} fill="none" className={link.kind === 'evolution' ? 'stroke-accent' : 'stroke-soft'} strokeWidth={connected ? 2.2 : 1.05} strokeOpacity={hiddenByCategory ? 0.025 : connected ? 0.52 : graphVisible ? 0.18 : link.kind === 'evolution' ? 0.105 : 0.08} strokeDasharray={link.kind === 'affinity' ? '4 5' : undefined} strokeLinecap="round" />
                })}

                {mobileConstellationPath.length > 1 && mobileConstellationPath.slice(1).map((star, index) => (
                  <motion.path key={`mobile-constellation-${star.slug}`} d={pathBetween(mobileConstellationPath[index], star, view)} fill="none" className="stroke-accent" strokeWidth={2.4} strokeOpacity={0.54} strokeLinecap="round" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.54 }} transition={{ duration: 0.48, delay: reduce ? 0 : index * 0.08, ease: EASE }} />
                ))}
                {showJourney && mobileJourneyStars.length > 1 && mobileJourneyStars.slice(1).map((star, index) => (
                  <path key={`mobile-journey-${star.slug}`} d={pathBetween(mobileJourneyStars[index], star, view)} fill="none" className="stroke-accent" strokeWidth={2} strokeOpacity={0.38} strokeDasharray="2 6" strokeLinecap="round" />
                ))}

                {activeIndex !== null && timelineTrail.length > 1 && timelineTrail.slice(1).map((item, index) => {
                  const from = mobileLayout.find((star) => star.i === timelineTrail[index].star.i)
                  const to = mobileLayout.find((star) => star.i === item.star.i)
                  if (!from || !to) return null
                  return <motion.path key={`mobile-time-trail-${item.star.slug}`} d={pathBetween(from, to, 'timeline')} fill="none" className="stroke-accent" strokeWidth={3.2} strokeOpacity={0.38} strokeLinecap="round" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.38 }} transition={{ duration: 0.55, ease: EASE }} />
                })}

                {mobileActive && ideaTrail.map((item) => {
                  const to = mobileLayout.find((star) => star.i === item.star.i)
                  if (!to) return null
                  return <motion.path key={`mobile-idea-trail-${item.star.slug}`} d={pathBetween(mobileActive, to, 'graph')} fill="none" className="stroke-accent" strokeWidth={2.2} strokeOpacity={0.3} strokeDasharray="2 7" strokeLinecap="round" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.3 }} transition={{ duration: 0.5, ease: EASE }} />
                })}

                {mobileLayout.map((star) => {
                  const isActive = activeIndex === star.i
                  const presence = starPresence(star, isActive, 'mobile')
                  return (
                    <g key={star.slug} role="link" aria-label={`${star.title}، ${star.date}`}>
                      {(star.i === dayStarIndex || isActive) && (
                        <motion.circle
                          cx={star.x}
                          cy={star.y}
                          r={star.r + (isActive ? 12 : 9)}
                          className="pointer-events-none fill-none stroke-accent"
                          strokeOpacity={isActive ? 0.55 : 0.24}
                          strokeWidth={isActive ? 2 : 1.25}
                          /* الهالة تُحرَّك بمصفوفة مفاتيح، ومصفوفات المفاتيح لا تُحَلّ عند أول رسم؛
                             فما لم نُعطِ Motion قيمةً ابتدائية لكل مفتاح يحرّكه، يكتب الإطار الأول
                             r="undefined" فوق قيمة React (نصف قطر صفر ورسالة خطأ في الطرفية).
                             القيمة هنا هي أول مفتاح بعينه، فلا يتغيّر شيء مما يراه الزائر. */
                          initial={reduce ? false : { r: star.r + 8, opacity: 0.32 }}
                          animate={reduce ? undefined : { r: [star.r + 8, star.r + (isActive ? 14 : 12), star.r + 8], opacity: [0.32, 0.12, 0.32] }}
                          transition={{ duration: isActive ? 2.8 : 4.2, repeat: Infinity, ease: EASE }}
                        />
                      )}
                      {star.hasAudio && <circle cx={star.x} cy={star.y} r={star.r + 4.6} className="pointer-events-none fill-none stroke-accent" strokeOpacity={presence * 0.18} strokeWidth={0.9} strokeDasharray="1 4" />}
                      <circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r + 18}
                        className="cursor-pointer fill-transparent"
                        tabIndex={0}
                        data-atlas-scope="mobile"
                        data-star-index={star.i}
                        onPointerDown={(event) => { event.preventDefault(); pick(star.i, star.slug, event.pointerType) }}
                        onFocus={() => setHover(star.i)}
                        onBlur={() => setHover(null)}
                        onKeyDown={(event) => handleStarKey(event, star, 'mobile')}
                      />
                      <motion.circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r}
                        className={`atlas-star-core pointer-events-none${compareIndexes.includes(star.i) ? ' is-compared' : ''}${showJourney && journeyIndexes.has(star.i) ? ' is-visited' : ''}`}
                        initial={reduce ? false : { opacity: 0, scale: 0 }}
                        animate={{ opacity: presence, scale: isActive ? 1.5 : star.i === latestStarIndex ? 1.12 : 1 }}
                        transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(star.i * 0.004, 0.3), ease: EASE }}
                        style={{ ...starStyle(star.cat, star.caution), transformOrigin: `${star.x}px ${star.y}px`, ...(isActive ? { viewTransitionName: `article-${star.slug}` } : {}) }}
                      />
                      {constellationIndexes.has(star.i) && <text x={star.x + 12} y={star.y - 9} className="fill-soft font-sans" style={{ fontSize: 15, fontWeight: 700 }}>{constellationPath.findIndex((item) => item.i === star.i) + 1}</text>}
                    </g>
                  )
                })}
              </svg>

              {/* نسخة الكمبيوتر الأصلية الواسعة. */}
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="atlas-map-desktop hidden h-auto w-full min-w-[760px] lg:block"
                role="img"
                aria-label="خريطة المقالات"
                onPointerMove={(event) => { if (event.pointerType === 'mouse') setLens(pointerToSvg(event, W, H, 'desktop')) }}
              >
                {view === 'timeline' && years.map((item) => (
                  <line key={`desktop-year-ray-${item.year}`} x1={item.x} y1={22} x2={item.x} y2={H - 34} className="stroke-accent" strokeWidth={Math.min(8, 1.5 + item.count * 0.7)} strokeOpacity={0.024 + Math.min(item.count * 0.005, 0.04)} strokeLinecap="round" />
                ))}

                {view === 'timeline' && cats.map((category, row) => {
                  const y = TOP + row * ROW + ROW / 2
                  const on = !activeCat || activeCat === category
                  return (
                    <g key={category} opacity={on ? 1 : 0.25}>
                      <line x1={PAD_L} y1={y} x2={W - PAD_R + 10} y2={y} stroke="currentColor" className="text-ink" strokeOpacity={0.05} />
                      <line x1={W - PAD_R + 7} y1={y} x2={W - PAD_R + 20} y2={y} stroke={`rgb(var(--atlas-${axisOf(category)}))`} strokeWidth={2.5} strokeLinecap="round" />
                      <text x={W - PAD_R + 28} y={y + 4} textAnchor="start" className="fill-soft font-sans" style={{ fontSize: 10.5, fontWeight: activeCat === category ? 700 : 500 }}>{categoryLabel(category)}</text>
                    </g>
                  )
                })}

                {view === 'graph' && graphGeometry.rings.map((radius, index) => (
                  <circle key={`desktop-orbit-${radius}`} cx={graphGeometry.cx} cy={graphGeometry.cy} r={radius} className="fill-none stroke-accent" strokeOpacity={index === 2 ? 0.075 : 0.045} strokeWidth={1} />
                ))}

                {view === 'timeline' && years.map((item) => (
                  <text key={item.year} x={item.x} y={H - 16} textAnchor="middle" className="fill-soft font-sans" style={{ fontSize: 12 }}>
                    {arDigits(item.year)}
                  </text>
                ))}

                {links.map((link) => {
                  const from = layout.find((star) => star.i === link.from)
                  const to = layout.find((star) => star.i === link.to)
                  if (!from || !to) return null
                  const connected = activeIndex !== null && (link.from === activeIndex || link.to === activeIndex)
                  if (view === 'timeline' && link.kind === 'affinity' && !connected) return null
                  if (view === 'timeline' && link.kind === 'evolution' && !connected && (!activeCat || from.cat !== activeCat || to.cat !== activeCat)) return null
                  if (view === 'graph' && !connected && !ambientLinkIds.has(linkKey(link))) return null
                  const hiddenByCategory = (activeCat && from.cat !== activeCat && to.cat !== activeCat) || (searchMatches !== null && !searchMatches.has(link.from) && !searchMatches.has(link.to))
                  const graphVisible = view === 'graph' && !connected
                  return <path key={`desktop-link-${link.kind}-${link.from}-${link.to}`} d={pathBetween(from, to, view)} fill="none" className={link.kind === 'evolution' ? 'stroke-accent' : 'stroke-soft'} strokeWidth={connected ? 1.9 : .82} strokeOpacity={hiddenByCategory ? 0.022 : connected ? 0.44 : graphVisible ? 0.16 : link.kind === 'evolution' ? 0.092 : 0.064} strokeDasharray={link.kind === 'affinity' ? '3 5' : undefined} strokeLinecap="round" />
                })}

                {constellationPath.length > 1 && constellationPath.slice(1).map((star, index) => (
                  <motion.path key={`desktop-constellation-${star.slug}`} d={pathBetween(constellationPath[index], star, view)} fill="none" className="stroke-accent" strokeWidth={2} strokeOpacity={0.5} strokeLinecap="round" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.5 }} transition={{ duration: 0.5, delay: reduce ? 0 : index * 0.08, ease: EASE }} />
                ))}
                {showJourney && journeyStars.length > 1 && journeyStars.slice(1).map((star, index) => (
                  <path key={`desktop-journey-${star.slug}`} d={pathBetween(journeyStars[index], star, view)} fill="none" className="stroke-accent" strokeWidth={1.7} strokeOpacity={0.36} strokeDasharray="2 6" strokeLinecap="round" />
                ))}

                {activeIndex !== null && timelineTrail.length > 1 && timelineTrail.slice(1).map((item, index) => {
                  const from = layout.find((star) => star.i === timelineTrail[index].star.i)
                  const to = layout.find((star) => star.i === item.star.i)
                  if (!from || !to) return null
                  return <motion.path key={`desktop-time-trail-${item.star.slug}`} d={pathBetween(from, to, 'timeline')} fill="none" className="stroke-accent" strokeWidth={2.8} strokeOpacity={0.34} strokeLinecap="round" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.34 }} transition={{ duration: 0.55, ease: EASE }} />
                })}

                {active && ideaTrail.map((item) => {
                  const to = layout.find((star) => star.i === item.star.i)
                  if (!to) return null
                  return <motion.path key={`desktop-idea-trail-${item.star.slug}`} d={pathBetween(active, to, 'graph')} fill="none" className="stroke-accent" strokeWidth={1.9} strokeOpacity={0.28} strokeDasharray="2 7" strokeLinecap="round" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.28 }} transition={{ duration: 0.5, ease: EASE }} />
                })}

                {layout.map((star) => {
                  const isActive = activeIndex === star.i
                  const presence = starPresence(star, isActive, 'desktop')
                  return (
                    <g key={star.slug} role="link" aria-label={`${star.title}، ${star.date}`}>
                      {(star.i === dayStarIndex || isActive) && (
                        <motion.circle
                          cx={star.x}
                          cy={star.y}
                          r={star.r + (isActive ? 10 : 8)}
                          className="pointer-events-none fill-none stroke-accent"
                          strokeOpacity={isActive ? 0.42 : 0.22}
                          strokeWidth={isActive ? 1.4 : 1.05}
                          /* القيمة الابتدائية لازمة هنا كما في نسخة الجوال أعلاه. */
                          initial={reduce ? false : { r: star.r + 7, opacity: 0.3 }}
                          animate={reduce ? undefined : { r: [star.r + 7, star.r + (isActive ? 13 : 11), star.r + 7], opacity: [0.3, 0.1, 0.3] }}
                          transition={{ duration: isActive ? 2.8 : 4.4, repeat: Infinity, ease: EASE }}
                        />
                      )}
                      {star.hasAudio && <circle cx={star.x} cy={star.y} r={star.r + 4.2} className="pointer-events-none fill-none stroke-accent" strokeOpacity={presence * 0.18} strokeWidth={0.75} strokeDasharray="1 4" />}
                      <circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r + 11}
                        className="cursor-pointer fill-transparent"
                        tabIndex={0}
                        data-atlas-scope="desktop"
                        data-star-index={star.i}
                        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHover(star.i) }}
                        onFocus={() => setHover(star.i)}
                        onBlur={() => setHover(null)}
                        onPointerDown={(event) => { event.preventDefault(); pick(star.i, star.slug, event.pointerType) }}
                        onKeyDown={(event) => handleStarKey(event, star, 'desktop')}
                      />
                      <motion.circle
                        cx={star.x}
                        cy={star.y}
                        r={star.r}
                        className={`atlas-star-core pointer-events-none${compareIndexes.includes(star.i) ? ' is-compared' : ''}${showJourney && journeyIndexes.has(star.i) ? ' is-visited' : ''}`}
                        initial={reduce ? false : { opacity: 0, scale: 0 }}
                        animate={{ opacity: presence, scale: isActive ? 1.65 : star.i === latestStarIndex ? 1.12 : 1 }}
                        transition={{ duration: 0.45, delay: reduce ? 0 : Math.min(star.i * 0.006, 0.4), ease: EASE }}
                        style={{ ...starStyle(star.cat, star.caution), transformOrigin: `${star.x}px ${star.y}px`, ...(isActive ? { viewTransitionName: `article-${star.slug}` } : {}) }}
                      />
                      {constellationIndexes.has(star.i) && <text x={star.x + 9} y={star.y - 7} className="fill-soft font-sans" style={{ fontSize: 10.5, fontWeight: 700 }}>{constellationPath.findIndex((item) => item.i === star.i) + 1}</text>}
                    </g>
                  )
                })}

                {active && (
                  <g className="pointer-events-none">
                    <circle cx={active.x} cy={active.y} r={active.r + 10} className="fill-none stroke-accent" strokeOpacity={0.42} strokeWidth={1.4} />
                    <foreignObject className="atlas-tooltip-foreign" x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight}>
                      <div className="atlas-tooltip h-full rounded-xl border border-accent/[.35] bg-canvas/95 px-4 py-3 text-right shadow-xl backdrop-blur" dir="rtl">
                        <p className="truncate text-[11px] font-semibold" style={{ ...axisStyle(active.cat), color: 'rgb(var(--atlas-axis))' }}>{categoryLabel(active.cat)} · {arDigits(active.iso.slice(0, 4))}</p>
                        <p className="mt-1 truncate font-display text-[13px] font-semibold leading-[1.5] text-ink">{active.title}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] font-light leading-[1.65] text-soft">{articleExcerptLine(active.excerpt || active.body || '')}</p>
                        <p className="mt-1 text-[9.5px] font-medium text-soft/80">اضغط لتثبيت المسار · اضغط مرة ثانية للقراءة</p>
                      </div>
                    </foreignObject>
                  </g>
                )}
              </svg>
            </div>
          </FadeUp>

          {compareMode && (
            <section className="mt-4 rounded-xl border border-hair bg-wash/[.42] p-4" aria-live="polite">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[.72rem] font-semibold text-accent">كيف تتحاور الفكرتان؟</p>
                <span className="text-[.68rem] text-soft">{comparedStars.length}/2</span>
              </div>
              {comparedStars.length < 2 ? (
                <p className="mt-2 text-[.76rem] font-light text-soft">اختر نجمتين من السماء.</p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {comparedStars.map((star) => (
                    <Link key={star.slug} to={`/articles/${star.slug}`} className="group rounded-xl border border-hair bg-canvas p-4 transition-colors hover:border-accent">
                      <span className="text-[.66rem] font-semibold" style={{ ...axisStyle(star.cat), color: 'rgb(var(--atlas-axis))' }}>{categoryLabel(star.cat)} · {arDigits(star.iso.slice(0, 4))}</span>
                      <strong className="mt-1.5 block font-display text-[.92rem] leading-[1.65] text-ink transition-colors group-hover:text-accent">{star.title}</strong>
                      <span className="mt-2 line-clamp-2 block text-[.72rem] font-light leading-[1.75] text-soft">{articleExcerptLine(star.excerpt || star.body || '')}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {showJourney && journeyStars.length > 0 && (
            <section className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/[.22] bg-canvas p-4">
              <div>
                <p className="text-[.72rem] font-semibold text-accent">قرأتَ {arDigits(journeyStars.length)} من {arDigits(articles.length)} · محورك الغالب: {categoryLabel(journeyTopAxis)}</p>
                <p className="mt-1 text-[.68rem] font-light text-soft">أول نجمة: {journeyStars[0]?.title} · آخر نجمة: {journeyStars[journeyStars.length - 1]?.title}</p>
              </div>
              <button type="button" onClick={() => void shareJourney()} className="min-h-11 rounded-full border border-hair px-4 text-[.72rem] font-semibold text-accent transition-colors hover:border-accent">شارك بصمتي</button>
            </section>
          )}

          {constellation && constellationPath.length > 1 && (
            <ol className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={`ترتيب قراءة ${constellation.title}`}>
              {constellationPath.map((star, index) => (
                <li key={star.slug} className="contents"><Link to={`/articles/${star.slug}`} className="min-w-[12rem] rounded-xl border border-hair bg-canvas p-3 text-[.72rem] text-soft transition-colors hover:border-accent hover:text-accent"><span className="font-bold text-accent">{index + 1}</span><span className="mx-2">←</span>{star.title}</Link></li>
              ))}
            </ol>
          )}

          <div id="atlas-selection" className="mt-4 min-h-[94px] scroll-mt-24">
            {active ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-hair bg-canvas p-5">
                <div className="flex flex-wrap items-center gap-2 text-[.74rem] text-soft">
                  <span className="font-semibold text-accent">{categoryLabel(active.cat)}</span>
                  <span>·</span><time>{active.date}</time><span>·</span><span>{arabicCountPhrase(active.words, WORD_PLAIN_FORMS, arDigits)}</span>
                  {active.hasAudio && <><span>·</span><span>له صوت</span></>}
                  {active.i === dayStarIndex && <><span>·</span><span className="text-accent">نجمة اليوم</span></>}
                </div>
                <Link to={`/articles/${active.slug}`} className="mt-2 block break-words font-display text-[1.08rem] font-semibold leading-[1.75] text-ink transition-colors hover:text-accent md:text-[1.35rem]">
                  {active.title}
                  <span className="mt-3 block text-[.78rem] font-sans font-semibold text-accent">فتح المقال ←</span>
                </Link>
                {active.excerpt && <p className="mt-2 line-clamp-2 text-[.76rem] font-light leading-[1.8] text-soft">{active.excerpt}</p>}
                {(ideaSignature.length > 0 || timelineTrail.length > 0 || related.length > 0) && (
                  <div className="mt-4 grid gap-4 border-t border-hair pt-4 md:grid-cols-[1fr_1.1fr]">
                    <div>
                      <p className="text-[.7rem] font-semibold text-accent">المسار الزمني</p>
                      <div className="mt-2 space-y-2">
                        {timelineTrail.map((item) => (
                          <Link key={`time-${item.star.slug}`} to={`/articles/${item.star.slug}`} className={`group flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${item.star.i === active.i ? 'border-accent/[.45] bg-accent/5 text-ink' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent opacity-70" />
                            <span className="min-w-0">
                              <span className="block text-[.66rem] font-semibold">{item.label} · {arDigits(item.star.iso.slice(0, 4))}</span>
                              <span className="line-clamp-1 text-[.76rem] leading-[1.65]">{item.star.title}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[.7rem] font-semibold text-accent">شبكة الأفكار</p>
                      {ideaSignature.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {ideaSignature.map((word) => (
                            <span key={word} className="rounded-full bg-wash px-2.5 py-1 text-[.66rem] font-medium text-soft">{word}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(ideaTrail.length ? ideaTrail : related.slice(0, 3)).map((item) => {
                          /* «لماذا ارتبطتا؟» (مقترح معتمد): الكلمات التي يتقاسمها المقالان */
                          const activeTokens = ideaTokens(`${active.title} ${active.excerpt || ''}`)
                          const otherTokens = ideaTokens(`${item.star.title} ${item.star.excerpt || ''}`)
                          const shared = [...activeTokens].filter((token) => otherTokens.has(token)).slice(0, 2)
                          return (
                            <Link key={`idea-${item.kind}-${item.star.slug}`} to={`/articles/${item.star.slug}`} className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft transition-colors hover:border-accent hover:text-accent">
                              {item.relation} · {arDigits(item.star.iso.slice(0, 4))} · {item.star.title}
                              {item.reason
                                ? <span className="text-accent/80"> · {item.reason}</span>
                                : item.kind === 'affinity' && shared.length > 0 && <span className="text-accent/80"> · يجمعهما: {shared.join('، ')}</span>}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="pt-4 text-center text-[.84rem] font-light leading-relaxed text-soft">
                حرّك المؤشر فوق السماء أو اختر نجمة: سيظهر مسارها الزمني وكوكبة الأفكار حولها بهدوء.
              </p>
            )}
          </div>

          <FadeUp delay={0.14}>
            <div className="mobile-card-rail mt-12 grid gap-6 border-t border-hair pt-9 text-[.88rem] font-light text-soft sm:grid-cols-3">
              <p><span className="font-medium text-ink">الحجم</span> — كلّما كبرت النجمة، طال المقال.</p>
              <p><span className="font-medium text-ink">المسار</span> — خط متصل يروي قبل المقال وبعده داخل الموضوع نفسه.</p>
              <p><span className="font-medium text-ink">الكوكبة</span> — خط متقطع لصلةٍ فكرية، وهالة رقيقة للمقالات الصوتية.</p>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
