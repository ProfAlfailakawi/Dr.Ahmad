import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getDb, getFirebaseAuth } from '../lib/firebase'
import { categoryLabel } from '../lib/content-taxonomy'
import { SocialIcon } from './icons'

export type ReaderArticle = {
  slug: string
  title: string
  iso: string
  cat: string
  excerpt?: string
  body?: string
}

export type PopularQuote = {
  slug: string
  articleVersion: string
  highlightKey: string
  quoteHash: string
  quote?: string
  paragraph: number
  paragraphId: string
  startOffset: number
  endOffset: number
  count: number
}

type SavedQuote = {
  id: string
  quote: string
  slug: string
  title: string
  paragraph: number
  savedAt: number
  url: string
  note?: string
  articleVersion?: string
  startOffset?: number
  endOffset?: number
  highlightKey?: string
}

type ReaderTheme = 'light' | 'dark' | 'paper'
type ReaderPreferences = {
  scale: number
  lineHeight: number
  width: number
  theme: ReaderTheme
  showPopular: boolean
  focus: boolean
  /* القراءة المشكّلة: النص نفسه بالحركات الكاملة (كل المقالات مشكّلة ١٤٣/١٤٣).
     اختيارٌ على الجهاز، والبنية المقطعية مطابقة للنص المجرّد حرفاً بحرف بعد نزع
     الحركات، فلا يتأثّر تزامن الصوت ولا تظليل العبارات. */
  vocalized: boolean
}

import glossaryVoice from '../data/glossary-voice.json' with { type: 'json' }
import { arabicCountPhrase, CONNECTION_FORMS, MINUTE_FORMS, OCCURRENCE_FORMS } from '../lib/arabic-count.ts'

const VOICE = (glossaryVoice as { voice?: Record<string, { text: string; book: string; slug: string; page: number }> }).voice || {}

type XrayTerm = {
  term: string
  title: string
  definition: string
  note?: string
}

type SelectionSnapshot = {
  text: string
  paragraph: number
  x: number
  y: number
  placement: 'above' | 'below'
}

const PREFS_KEY = 'reader:preferences:v2'
const QUOTES_KEY = 'reader:quotes:v2'
const PROGRESS_PREFIX = 'reader:progress:v2:'
const PENDING_QUOTE_KEY = 'reader:pending-quote:v1'
/* الرقم يظهر من أول اقتباس: عتبة الخمسة كانت تُخفي أثر القارئ تماماً، فيقتبس
   ولا يرى شيئاً يتغيّر — وتموت الفكرة الحماسية للموقع. الآن كل جملة اقتُبست
   تحمل أثرها ظاهراً، ويتصاعد الرقم أمام الجميع مع كل قارئ جديد. */
/* عتبة «العبارة التي احتفظ بها القراء».
   كانت ١٠ ثم ٥، وهُبطت إلى ١ في ١٩ يوليو داخل لقطةٍ عن مزامنة الاقتباسات —
   على الأرجح لتيسير التجريب — ولم تُعَد. وبقيمة ١ يصير حفظُ قارئٍ واحد سبباً
   لتظليل العبارة ووسمها «من أكثر ما احتفظ به القراء»، ويظهر فوقها الرقم ١.
   وهذا يقلب معنى المؤشّر: يَعِد بحكمِ جماعةٍ ويعرض رأي فرد. */
/* عتبة ظهور الخط والرقم تحت الجملة — ٣ قراء (كانت ٥ فبدت الميزة ميتة في أي اختبار صغير) */
export const POPULAR_THRESHOLD = 3

const popularHighlightCache = new Map<string, PopularQuote[]>()

const DEFAULT_PREFS: ReaderPreferences = {
  scale: 1,
  lineHeight: 2,
  width: 66,
  theme: 'light',
  showPopular: true,
  focus: false,
  vocalized: false,
}

const AR_STOP = new Set(['من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'ما', 'لا', 'هذا', 'هذه', 'التي', 'الذي', 'مع', 'أو', 'ثم', 'قد', 'كل', 'بين', 'هو', 'هي', 'كان', 'كانت', 'لكن', 'حتى', 'إذا', 'عند', 'بعد', 'قبل', 'كما', 'لأن', 'حين', 'كيف', 'لماذا', 'أم', 'بل', 'نحن', 'هم', 'أنت', 'أنا', 'به', 'له', 'لها', 'فيه', 'فيها', 'ذلك', 'تلك', 'أي', 'كذلك', 'أيضا', 'دون', 'غير', 'عبر', 'خلال', 'حول', 'نحو'])
const normalizeArabic = (value: string) => value.replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
const normalizeHighlightText = (value: string) => normalizeArabic(value)
  .replace(/[“”«»"']/g, ' ')
  .replace(/[،؛:!?؟.,()[\]{}]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/** Stable content version: changing the article body creates a new highlight namespace. */
export function articleContentVersion(body = '') {
  let hash = 2166136261
  for (let index = 0; index < body.length; index++) {
    hash ^= body.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
const ideaTokens = (value: string) => normalizeArabic(value).replace(/[^ء-ي\s]/g, ' ').split(/\s+/)
  .map((word) => word.replace(/^(وال|فال|بال|كال|ال|و|ف|ب|ل|ك)/, ''))
  .filter((word) => word.length >= 4 && !AR_STOP.has(word))

const GLOSSARY: XrayTerm[] = [
  { term: 'الذكاء الاصطناعي', title: 'الذكاء الاصطناعي', definition: 'أنظمة حاسوبية تنفّذ مهاماً ترتبط عادةً بالإدراك البشري، مثل التعلّم والتحليل والتنبؤ وتوليد المحتوى.', note: 'المعنى التربوي الأهم ليس الأداة وحدها، بل طريقة استخدامها وأثرها في الإنسان.' },
  { term: 'التعلم الآلي', title: 'التعلّم الآلي', definition: 'فرع من الذكاء الاصطناعي يتعلّم الأنماط من البيانات بدل الاعتماد على تعليمات ثابتة لكل حالة.' },
  { term: 'التعلّم الآلي', title: 'التعلّم الآلي', definition: 'فرع من الذكاء الاصطناعي يتعلّم الأنماط من البيانات بدل الاعتماد على تعليمات ثابتة لكل حالة.' },
  { term: 'التعلم العميق', title: 'التعلّم العميق', definition: 'أسلوب في التعلّم الآلي يستخدم شبكات عصبية متعددة الطبقات للتعامل مع أنماط شديدة التعقيد.' },
  { term: 'التفكير النقدي', title: 'التفكير النقدي', definition: 'فحص الادعاءات والأدلة والافتراضات قبل قبول النتيجة، مع القدرة على التفسير والمقارنة وتغيير الرأي عند ظهور دليل أفضل.' },
  { term: 'التقييم التكويني', title: 'التقييم التكويني', definition: 'تقييم يحدث أثناء التعلّم ليكشف ما يحتاجه المتعلّم الآن، ويقود الخطوة التعليمية التالية بدل الاكتفاء بدرجة نهائية.' },
  { term: 'التقويم التكويني', title: 'التقويم التكويني', definition: 'استخدام أدلة التعلّم أثناء الدرس لتحسين التدريس ومساعدة المتعلّم على التقدّم قبل الحكم النهائي.' },
  { term: 'التعليم المدمج', title: 'التعليم المدمج', definition: 'تصميم يجمع التعلّم الحضوري والرقمي ضمن تجربة واحدة مترابطة، لا بوصفهما مسارين منفصلين.' },
  { term: 'الواقع الافتراضي', title: 'الواقع الافتراضي', definition: 'بيئة رقمية غامرة تمنح المستخدم إحساساً بالحضور داخل مكان أو موقف مُحاكى.' },
  { term: 'الميتافيرس', title: 'الميتافيرس', definition: 'تصوّر لفضاءات رقمية مستمرة يتفاعل فيها الناس بهويات وتمثيلات رقمية، وقد تشمل التعلّم والعمل والخدمات.' },
  { term: 'التنمر الإلكتروني', title: 'التنمّر الإلكتروني', definition: 'إيذاء متكرر عبر المنصات الرقمية، مثل الإهانة أو التهديد أو الإقصاء أو نشر محتوى بقصد الإضرار.' },
  { term: 'المرونة النفسية', title: 'المرونة النفسية', definition: 'القدرة على التكيّف والتعافي ومواصلة العمل بعد الضغوط أو الإخفاقات، مع طلب الدعم عند الحاجة.' },
  { term: 'الرفاه النفسي', title: 'الرفاه النفسي', definition: 'حالة تشمل الإحساس بالمعنى والاتزان والقدرة على التعامل مع الحياة، وليست مجرد غياب الاضطراب.' },
  { term: 'الدافعية', title: 'الدافعية', definition: 'القوى الداخلية والخارجية التي تبدأ السلوك وتوجّهه وتحافظ عليه نحو هدف معين.' },
  { term: 'محو الأمية الرقمية', title: 'محو الأمية الرقمية', definition: 'القدرة على الوصول إلى المعلومات الرقمية وفهمها وتقييمها واستخدامها وإنتاجها بأمان ومسؤولية.' },
  { term: 'ChatGPT', title: 'ChatGPT', definition: 'مساعد يعتمد نماذج لغوية لتوليد النصوص وتحليلها والحوار حولها. جودة النتيجة ترتبط بالسؤال والمصدر والتحقق البشري.' },
  { term: 'OECD', title: 'منظمة التعاون الاقتصادي والتنمية', definition: 'منظمة دولية تنتج بيانات وتحليلات وسياسات مقارنة، ومن أشهر أعمالها في التعليم دراسات ومؤشرات دولية واسعة.' },
]

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* التخزين المحلي قد يكون محجوباً */ }
}

function getPreferences(): ReaderPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  const stored = readJson<Partial<ReaderPreferences>>(PREFS_KEY, {})
  const siteTheme: ReaderTheme = window.localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  return {
    scale: Number.isFinite(stored.scale) ? Math.min(1.2, Math.max(.88, Number(stored.scale))) : DEFAULT_PREFS.scale,
    lineHeight: Number.isFinite(stored.lineHeight) ? Math.min(2.42, Math.max(1.85, Number(stored.lineHeight))) : DEFAULT_PREFS.lineHeight,
    width: Number.isFinite(stored.width) ? Math.min(80, Math.max(56, Number(stored.width))) : DEFAULT_PREFS.width,
    theme: stored.theme === 'dark' || stored.theme === 'paper' || stored.theme === 'light' ? stored.theme : siteTheme,
    showPopular: stored.showPopular !== false,
    focus: Boolean(stored.focus),
    vocalized: Boolean(stored.vocalized),
  }
}

function applyPreferences(preferences: ReaderPreferences) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--article-scale', String(preferences.scale))
  root.style.setProperty('--article-line', String(preferences.lineHeight))
  root.style.setProperty('--article-width', `${preferences.width}ch`)
  root.classList.toggle('reader-paper', preferences.theme === 'paper')
  /* الوضع القديم متقاعد: لا يُطبَّق حتى لمن سبق أن فعّله وبقي تفضيله محفوظاً */
  root.classList.remove('reader-focus')
  root.dataset.readerPopular = 'on'

  const dark = preferences.theme === 'dark'
  root.classList.toggle('dark', dark)
  try { window.localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent('reader:theme-changed', { detail: { dark } }))
}

export function useReaderPreferences() {
  const [preferences, setPreferencesState] = useState<ReaderPreferences>(() => getPreferences())

  useEffect(() => {
    applyPreferences(preferences)
    writeJson(PREFS_KEY, preferences)
  }, [preferences])

  useEffect(() => {
    const refresh = () => setPreferencesState(getPreferences())
    window.addEventListener('reader:preferences-changed', refresh)
    return () => window.removeEventListener('reader:preferences-changed', refresh)
  }, [])

  const setPreferences = (patch: Partial<ReaderPreferences>) => {
    setPreferencesState((current) => {
      const next = { ...current, ...patch }
      writeJson(PREFS_KEY, next)
      window.dispatchEvent(new CustomEvent('reader:preferences-changed'))
      return next
    })
  }

  return { preferences, setPreferences }
}

function absoluteTop(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return rect.top + window.scrollY
}

function articleProgress() {
  const body = document.getElementById('article-body')
  if (!body) return 0
  const top = absoluteTop(body)
  const height = body.offsetHeight
  const travel = Math.max(1, height - window.innerHeight * .52)
  return Math.min(1, Math.max(0, (window.scrollY - top) / travel))
}

function targetScrollForProgress(progress: number) {
  const body = document.getElementById('article-body')
  if (!body) return 0
  const top = absoluteTop(body)
  const travel = Math.max(1, body.offsetHeight - window.innerHeight * .52)
  return top + Math.min(1, Math.max(0, progress)) * travel
}

function arabicReadTime(minutes: number) {
  return `${arabicCountPhrase(Math.max(1, minutes), MINUTE_FORMS, (value) => value.toLocaleString('en-US'))} للقراءة`
}

function copyText(text: string) {
  return (async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch { /* نستخدم البديل أدناه */ }
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      return copied
    } catch {
      return false
    }
  })()
}

async function stableHash(value: string) {
  try {
    if (crypto?.subtle) {
      const bytes = new TextEncoder().encode(value)
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
    }
  } catch { /* fallback أدناه */ }
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `f${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function readSavedQuotes() {
  if (typeof window === 'undefined') return [] as SavedQuote[]
  return readJson<SavedQuote[]>(QUOTES_KEY, []).filter((quote) => quote?.id && quote?.quote && quote?.slug)
}

function saveQuotes(quotes: SavedQuote[]) {
  writeJson(QUOTES_KEY, quotes.slice(0, 300))
  window.dispatchEvent(new CustomEvent('reader:quotes-changed'))
}

function saveLocalQuote(article: ReaderArticle, selection: Pick<SelectionSnapshot, 'text' | 'paragraph'>, note = '') {
  const existing = readSavedQuotes()
  const normalized = selection.text.replace(/\s+/g, ' ').trim()
  const id = `${article.slug}:${selection.paragraph}:${normalized.slice(0, 80)}`
  const nextItem: SavedQuote = {
    id,
    quote: normalized,
    slug: article.slug,
    title: article.title,
    paragraph: selection.paragraph,
    savedAt: Date.now(),
    url: `${window.location.origin}/articles/${article.slug}`,
    ...(note.trim() ? { note: note.trim() } : {}),
  }
  const withoutDuplicate = existing.filter((item) => item.id !== id)
  saveQuotes([nextItem, ...withoutDuplicate])
  return nextItem
}

export function ArticleProgressBar({ slug }: { slug: string }) {
  const [progress, setProgress] = useState(0)
  const lastSaved = useRef(0)
  const deepened = useRef(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const next = articleProgress()
      setProgress(next)
      window.dispatchEvent(new CustomEvent('reader:progress', { detail: { slug, progress: next } }))
      if (!deepened.current && next >= .18) {
        deepened.current = true
        window.dispatchEvent(new CustomEvent('reader:deepened', { detail: { slug } }))
      }
      const now = Date.now()
      if (now - lastSaved.current > 750 && next > .015) {
        lastSaved.current = now
        writeJson(`${PROGRESS_PREFIX}${slug}`, { progress: next, updatedAt: now })
      }
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [slug])

  return null
}

export function ReadingTimeLabel({ slug, text }: { slug: string; text?: string }) {
  const totalMinutes = useMemo(() => Math.max(1, Math.ceil((text?.trim().split(/\s+/).length || 0) / 210)), [text])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ slug: string; progress: number }>).detail
      if (detail?.slug === slug) setProgress(detail.progress)
    }
    window.addEventListener('reader:progress', onProgress)
    return () => window.removeEventListener('reader:progress', onProgress)
  }, [slug])

  if (!text) return null
  if (progress < .055) return <span className="text-soft">{arabicReadTime(totalMinutes)}</span>
  const remaining = Math.max(0, Math.ceil(totalMinutes * (1 - progress)))
  return <span className="text-soft">{remaining <= 1 ? 'بقي أقل من دقيقة' : `بقي ${arabicCountPhrase(remaining, MINUTE_FORMS, (value) => value.toLocaleString('en-US'))}`}</span>
}

function SettingChoice<T extends string | number | boolean>({ value, current, label, onClick }: { value: T; current: T; label: string; onClick: () => void }) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-2 text-[.76rem] font-medium transition-colors ${active ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
    >
      {label}
    </button>
  )
}

function scrollToSavedQuote(quote: SavedQuote) {
  const paragraph = document.querySelector<HTMLElement>(`[data-reader-paragraph="${quote.paragraph}"]`)
  if (!paragraph) return false
  paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' })
  paragraph.classList.remove('reader-quote-return')
  window.setTimeout(() => paragraph.classList.add('reader-quote-return'), 80)
  window.setTimeout(() => paragraph.classList.remove('reader-quote-return'), 2400)
  return true
}

export function ReaderControls({ article, saveControl, onSerenity }: { article: ReaderArticle; saveControl?: ReactNode; onSerenity?: () => void }) {
  const { preferences, setPreferences } = useReaderPreferences()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'settings' | 'quotes'>('settings')
  const [quotes, setQuotesState] = useState<SavedQuote[]>(() => readSavedQuotes())
  const [copiedId, setCopiedId] = useState('')
  const [xray, setXray] = useState<XrayTerm | null>(null)

  // بطاقة مفتوحة = زر «العودة للأعلى» يختفي فلا يغطي كلامها (ملاحظة الدكتور: السهم مغطي)
  useEffect(() => {
    document.body.classList.toggle('modal-sheet-open', Boolean(xray))
    return () => document.body.classList.remove('modal-sheet-open')
  }, [xray])
  const initialProgress = useMemo(() => readJson<{ progress?: number; updatedAt?: number }>(`${PROGRESS_PREFIX}${article.slug}`, {}), [article.slug])
  const [showResume, setShowResume] = useState(false)

  useEffect(() => {
    const saved = initialProgress
    const timer = window.setTimeout(() => {
      const progress = Number(saved.progress || 0)
      if (progress > .08 && progress < .9) setShowResume(true)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [article.slug])

  useEffect(() => {
    document.body.classList.toggle('reader-resume-open', showResume)
    return () => document.body.classList.remove('reader-resume-open')
  }, [showResume])

  useEffect(() => {
    const refreshQuotes = () => setQuotesState(readSavedQuotes())
    const openNotebook = () => {
      setQuotesState(readSavedQuotes())
      setTab('quotes')
      setOpen(true)
    }
    const onXray = (event: Event) => setXray((event as CustomEvent<XrayTerm>).detail || null)
    const onPopularLinked = (event: Event) => {
      const detail = (event as CustomEvent<{ localQuoteId?: string; articleVersion?: string; highlightKey?: string; startOffset?: number; endOffset?: number }>).detail
      if (!detail?.localQuoteId || !detail.highlightKey) return
      const current = readSavedQuotes()
      const next = current.map((quote) => quote.id === detail.localQuoteId
        ? { ...quote, articleVersion: detail.articleVersion, highlightKey: detail.highlightKey, startOffset: detail.startOffset, endOffset: detail.endOffset }
        : quote)
      if (JSON.stringify(next) !== JSON.stringify(current)) saveQuotes(next)
    }
    window.addEventListener('reader:quotes-changed', refreshQuotes)
    window.addEventListener('reader:open-notebook', openNotebook)
    window.addEventListener('reader:xray', onXray)
    window.addEventListener('reader:popular-quote-linked', onPopularLinked)
    return () => {
      window.removeEventListener('reader:quotes-changed', refreshQuotes)
      window.removeEventListener('reader:open-notebook', openNotebook)
      window.removeEventListener('reader:xray', onXray)
      window.removeEventListener('reader:popular-quote-linked', onPopularLinked)
    }
  }, [])

  useEffect(() => {
    const pending = readJson<{ slug?: string; paragraph?: number } | null>(PENDING_QUOTE_KEY, null)
    if (!pending || pending.slug !== article.slug || !Number.isInteger(pending.paragraph)) return
    try { window.localStorage.removeItem(PENDING_QUOTE_KEY) } catch { /* noop */ }
    window.setTimeout(() => {
      const quote = readSavedQuotes().find((item) => item.slug === article.slug && item.paragraph === pending.paragraph)
      if (quote) scrollToSavedQuote(quote)
    }, 620)
  }, [article.slug])

  const resume = () => {
    setShowResume(false)
    window.scrollTo({ top: targetScrollForProgress(Number(initialProgress.progress || 0)), behavior: 'smooth' })
  }

  const restart = () => {
    setShowResume(false)
    writeJson(`${PROGRESS_PREFIX}${article.slug}`, { progress: 0, updatedAt: Date.now() })
    const body = document.getElementById('article-body')
    if (body) body.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const removeQuote = (id: string) => {
    const removed = quotes.find((quote) => quote.id === id)
    if (removed) {
      window.dispatchEvent(new CustomEvent('reader:quote-removed', {
        detail: {
          slug: removed.slug,
          body: removed.slug === article.slug ? (article.body || '') : '',
          quote: removed.quote,
          paragraph: removed.paragraph,
          startOffset: removed.startOffset,
          endOffset: removed.endOffset,
          articleVersion: removed.articleVersion,
          highlightKey: removed.highlightKey,
        },
      }))
    }
    const next = quotes.filter((quote) => quote.id !== id)
    setQuotesState(next)
    saveQuotes(next)
  }

  const goToQuote = (quote: SavedQuote) => {
    setOpen(false)
    if (quote.slug === article.slug) {
      window.setTimeout(() => scrollToSavedQuote(quote), 80)
      return
    }
    writeJson(PENDING_QUOTE_KEY, { slug: quote.slug, paragraph: quote.paragraph })
    window.location.assign(`/articles/${quote.slug}#article-body`)
  }

  const shareSavedQuote = async (quote: SavedQuote) => {
    const text = `«${quote.quote}»\n— د. أحمد حسين الفيلكاوي\n${quote.title}\n${quote.url}`
    try {
      if (navigator.share) {
        await navigator.share({ title: quote.title, text, url: quote.url })
        return
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
    }
    await copyText(text)
    setCopiedId(quote.id)
    window.setTimeout(() => setCopiedId(''), 1400)
  }

  return (
    <>
      <div className="reader-control-anchor flex items-center">
        <button
          type="button"
          onClick={() => { setTab('settings'); setOpen(true) }}
          aria-label="أدوات القراءة"
          title="أدوات القراءة"
          className="reader-aa-button flex h-11 min-w-11 items-center justify-center rounded-full border border-hair bg-canvas px-2 text-[.82rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Aa
        </button>
      </div>

      <AnimatePresence>
        {showResume && (
          <motion.aside
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="reader-resume-prompt reader-hide-focus fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[225] mx-auto max-w-sm rounded-2xl border border-hair bg-canvas/[.96] px-4 py-3 shadow-[0_22px_60px_-34px_rgba(21,22,26,.65)] backdrop-blur"
          >
            <p className="text-[.8rem] font-semibold text-ink">متابعة من حيث توقفت؟</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={resume} className="rounded-full bg-accent px-4 py-1.5 text-[.74rem] font-semibold text-white">متابعة</button>
              <button type="button" onClick={restart} className="rounded-full border border-hair px-4 py-1.5 text-[.74rem] text-soft">من البداية</button>
              <button type="button" onClick={() => setShowResume(false)} aria-label="إغلاق" title="إغلاق" className="ms-auto flex h-7 w-7 items-center justify-center rounded-full text-soft"><SocialIcon name="Close" size={14} /></button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="reader-modal-overlay fixed inset-0 z-[310] flex items-end justify-center overflow-y-auto overscroll-contain bg-ink/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => setOpen(false)}>
            <motion.section
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="reader-settings-sheet max-h-[88dvh] w-full max-w-[620px] overflow-y-auto rounded-t-[1.75rem] border border-hair bg-canvas px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_36px_90px_-42px_rgba(21,22,26,.75)] sm:rounded-[1.75rem] sm:p-7"
              dir="rtl"
            >
              <header className="flex items-center justify-between gap-4 border-b border-hair pb-4">
                <div>
                  <p className="text-[.72rem] font-semibold text-accent">قارئ هادئ</p>
                  <h2 className="mt-1 font-display text-[1.22rem] font-semibold text-ink">{tab === 'settings' ? 'أدوات القراءة' : 'اقتباساتي'}</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" title="إغلاق" className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft"><SocialIcon name="Close" size={15} /></button>
              </header>

              <div className="mt-4 flex gap-2" role="tablist" aria-label="أقسام القارئ">
                <button type="button" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')} className={`rounded-full px-4 py-2 text-[.76rem] font-semibold ${tab === 'settings' ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>القراءة</button>
                <button type="button" role="tab" aria-selected={tab === 'quotes'} onClick={() => setTab('quotes')} className={`rounded-full px-4 py-2 text-[.76rem] font-semibold ${tab === 'quotes' ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>اقتباساتي{quotes.length ? ` · ${quotes.length.toLocaleString('en-US')}` : ''}</button>
              </div>

              {tab === 'settings' ? (
                <div className="mt-6 space-y-6">
                  {(saveControl || onSerenity) && (
                    <section className="rounded-2xl border border-hair bg-wash/[.45] p-4">
                      <p className="text-[.76rem] font-semibold text-ink">أدوات المقال</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {saveControl && <span className="inline-flex items-center">{saveControl}</span>}
                        {onSerenity && (
                          <button type="button" onClick={() => { setOpen(false); onSerenity() }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hair bg-canvas px-4 text-[.72rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">
                            <svg aria-hidden viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round"><path d="M5 12h14M7.5 8.5h9M9.5 15.5h5" /><circle cx="12" cy="12" r="9" /></svg>
                            وضع السكينة
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                  <section>
                    <p className="text-[.76rem] font-semibold text-ink">حجم النص</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[.92, 1, 1.1, 1.18].map((value, index) => <SettingChoice key={value} value={value} current={preferences.scale} label={['أصغر', 'متوازن', 'أكبر', 'كبير'][index]} onClick={() => setPreferences({ scale: value })} />)}
                    </div>
                  </section>
                  <section>
                    <p className="text-[.76rem] font-semibold text-ink">تباعد الأسطر</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SettingChoice value={1.92} current={preferences.lineHeight} label="قريب" onClick={() => setPreferences({ lineHeight: 1.92 })} />
                      <SettingChoice value={2.15} current={preferences.lineHeight} label="مريح" onClick={() => setPreferences({ lineHeight: 2.15 })} />
                      <SettingChoice value={2.34} current={preferences.lineHeight} label="واسع" onClick={() => setPreferences({ lineHeight: 2.34 })} />
                    </div>
                  </section>
                  <section>
                    <p className="text-[.76rem] font-semibold text-ink">مساحة القراءة</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SettingChoice value={60} current={preferences.width} label="مركّزة" onClick={() => setPreferences({ width: 60 })} />
                      <SettingChoice value={72} current={preferences.width} label="متوازنة" onClick={() => setPreferences({ width: 72 })} />
                      <SettingChoice value={80} current={preferences.width} label="رحبة" onClick={() => setPreferences({ width: 80 })} />
                    </div>
                  </section>
                  <section>
                    <p className="text-[.76rem] font-semibold text-ink">التشكيل</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SettingChoice value={false} current={preferences.vocalized} label="بدون" onClick={() => setPreferences({ vocalized: false })} />
                      <SettingChoice value={true} current={preferences.vocalized} label="نص مشكّل" onClick={() => setPreferences({ vocalized: true })} />
                    </div>
                  </section>
                  <p className="text-[.7rem] leading-[1.8] text-soft">تُحفظ هذه الاختيارات على هذا الجهاز فقط، وتُطبّق تلقائياً على بقية المقالات.</p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="rounded-2xl border border-hair bg-wash/[.45] px-4 py-3 text-[.74rem] leading-[1.8] text-soft">الاقتباسات محفوظة على هذا الجهاز فقط، من دون حساب أو بريد إلكتروني.</p>
                  {quotes.length ? (
                    <div className="mt-4 space-y-3">
                      {quotes.map((quote) => (
                        <article key={quote.id} className="rounded-2xl border border-hair bg-canvas p-4">
                          <blockquote className="font-display text-[.94rem] font-light leading-[1.9] text-ink">«{quote.quote}»</blockquote>
                      <p className="mt-2 text-[.7rem] leading-relaxed text-soft">{quote.title} · {new Date(quote.savedAt).toLocaleDateString('ar-KW')}</p>
                      {quote.note && <p className="mt-2 rounded-xl bg-wash/[.55] px-3 py-2 text-[.72rem] leading-relaxed text-soft">ملاحظتك: {quote.note}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => goToQuote(quote)} aria-label="الرجوع إلى موضع الاقتباس" title="الرجوع إلى موضعه" className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft hover:border-accent hover:text-accent"><SocialIcon name="ArrowBack" size={15} /></button>
                            <button type="button" onClick={async () => { await copyText(quote.quote); setCopiedId(quote.id); window.setTimeout(() => setCopiedId(''), 1200) }} aria-label="نسخ الاقتباس" title={copiedId === quote.id ? 'نُسخ الاقتباس' : 'نسخ الاقتباس'} className={`flex h-9 w-9 items-center justify-center rounded-full border text-soft hover:border-accent hover:text-accent ${copiedId === quote.id ? 'border-accent text-accent' : 'border-hair'}`}><SocialIcon name={copiedId === quote.id ? 'Check' : 'Copy'} size={15} /></button>
                            <button type="button" onClick={() => void shareSavedQuote(quote)} aria-label="مشاركة الاقتباس" title="مشاركة الاقتباس" className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft hover:border-accent hover:text-accent"><SocialIcon name="Share" size={15} /></button>
                            <button type="button" onClick={() => removeQuote(quote.id)} aria-label="حذف الاقتباس" title="حذف الاقتباس" className="ms-auto flex h-9 w-9 items-center justify-center rounded-full text-soft hover:bg-wash hover:text-accent"><SocialIcon name="Trash" size={15} /></button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="font-display text-[1.05rem] font-semibold text-ink">دفترك هادئ حتى الآن.</p>
                      <p className="mt-2 text-[.78rem] leading-relaxed text-soft">حدّد جملة داخل أي مقال، ثم افتح «بطاقة الاقتباس» واختر «احتفظ بالجملة في دفتر القراءة».</p>
                    </div>
                  )}
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {xray && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="reader-modal-overlay fixed inset-0 z-[315] flex items-end justify-center overflow-y-auto overscroll-contain bg-ink/[.24] backdrop-blur-[1.5px] sm:items-center sm:p-5" onClick={() => setXray(null)}>
            <motion.aside initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="max-h-[86dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[1.6rem] border border-hair bg-canvas px-5 pb-[calc(1.2rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_28px_80px_-40px_rgba(21,22,26,.75)] sm:rounded-[1.6rem] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[.7rem] font-semibold text-accent">توضيح داخل المقال</p><h2 className="mt-1 font-display text-[1.14rem] font-semibold text-ink">{xray.title}</h2></div>
                <button type="button" onClick={() => setXray(null)} aria-label="إغلاق" title="إغلاق" className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-soft"><SocialIcon name="Close" size={14} /></button>
              </div>
              <p className="mt-4 text-[.88rem] font-light leading-[1.95] text-ink/[.88]">{xray.definition}</p>
              {xray.note && <p className="mt-3 border-r border-accent/[.35] ps-3 text-[.76rem] leading-[1.85] text-soft">{xray.note}</p>}
              {/* صوته هو: المصطلح كما ورد في كتبه، منسوباً إلى صفحته. لا
                  يحلّ محلّ التعريف العام أعلاه — يجيء بعده لأنه أعمق. */}
              {VOICE[xray.title] && (
                <figure className="mt-4 border-t border-hair pt-3">
                  <figcaption className="text-[.68rem] font-semibold text-accent">من كتبه</figcaption>
                  <blockquote className="mt-1.5 text-[.8rem] font-light leading-[1.9] text-ink/80">{VOICE[xray.title].text}</blockquote>
                  <p className="mt-1.5 text-[.66rem] text-soft">{VOICE[xray.title].book} · ص {VOICE[xray.title].page}</p>
                </figure>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function usePopularQuotes(slug: string, body = '') {
  const [quotes, setQuotes] = useState<PopularQuote[]>([])
  const { preferences } = useReaderPreferences()
  const version = articleContentVersion(body)

  useEffect(() => {
    let active = true
    const cacheKey = `${slug}:${version}`
    const cachedQuotes = popularHighlightCache.get(cacheKey)
    if (cachedQuotes) setQuotes(cachedQuotes)
    /* بثٌّ حيّ: كان القارئ لا يرى اقتباس غيره إلا بعد تحديث الصفحة، فتضيع لحظة
       الحماسة. الاشتراك الحيّ يرفع الرقم أمام عينيه لحظةَ يقتبسها أيّ إنسان. */
    let unsubscribe: (() => void) | null = null
    void getDb().then(async (db) => {
      if (!db || !active) return
      const { collection, onSnapshot, query, where } = await import('firebase/firestore')
      // One query per article. Version filtering is local so no composite index
      // is required and old article namespaces cannot leak into new text.
      const shape = (docs: { data: () => Record<string, unknown> }[]) => docs
        .map((item) => item.data() as Partial<PopularQuote>)
        .filter((item): item is PopularQuote => item.slug === slug && item.articleVersion === version && Number(item.count) >= POPULAR_THRESHOLD && Number.isInteger(Number(item.paragraph)) && Number.isInteger(Number(item.startOffset)) && Number.isInteger(Number(item.endOffset)))
        .map((item) => ({
          ...item,
          paragraph: Number(item.paragraph),
          paragraphId: String(item.paragraphId ?? item.paragraph),
          startOffset: Number(item.startOffset),
          endOffset: Number(item.endOffset),
          count: Number(item.count),
        }))
      const stop = onSnapshot(query(collection(db, 'article_highlights'), where('slug', '==', slug)), (snapshot) => {
        if (!active) return
        const next = shape(snapshot.docs)
        popularHighlightCache.set(cacheKey, next)
        setQuotes(next)
      }, () => undefined)
      if (active) unsubscribe = stop
      else stop()
    }).catch(() => undefined)

    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string; body?: string; quote?: string; paragraph?: number; startOffset?: number; endOffset?: number; articleVersion?: string; highlightKey?: string; localQuoteId?: string }>).detail
      if (!detail || detail.slug !== slug || typeof detail.quote !== 'string' || !Number.isInteger(detail.paragraph)) return
      const paragraph = detail.paragraph as number
      void syncPopularQuote({
        slug,
        body: detail.body || body,
        quote: detail.quote,
        paragraph,
        startOffset: detail.startOffset,
        endOffset: detail.endOffset,
        articleVersion: detail.articleVersion,
        highlightKey: detail.highlightKey,
        localQuoteId: detail.localQuoteId,
      })
    }
    const onRemoved = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string; body?: string; quote?: string; paragraph?: number; startOffset?: number; endOffset?: number; articleVersion?: string; highlightKey?: string }>).detail
      if (!detail || detail.slug !== slug || typeof detail.quote !== 'string' || !Number.isInteger(detail.paragraph)) return
      const paragraph = detail.paragraph as number
      void removePopularQuote({
        slug,
        body: detail.body || body,
        quote: detail.quote,
        paragraph,
        startOffset: detail.startOffset,
        endOffset: detail.endOffset,
        articleVersion: detail.articleVersion,
        highlightKey: detail.highlightKey,
      })
    }
    window.addEventListener('reader:quote-saved', onSaved)
    window.addEventListener('reader:quote-removed', onRemoved)
    return () => {
      active = false
      unsubscribe?.()
      window.removeEventListener('reader:quote-saved', onSaved)
      window.removeEventListener('reader:quote-removed', onRemoved)
    }
  }, [slug, version, body])

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PopularQuote>).detail
      /* لا نشترط تطابق نسخة النص هنا: التحديث قادم من اقتباس هذا القارئ نفسه على
         هذه الصفحة، وحجبه كان يمنع ظهور الرقم فور الاقتباس. */
      if (!detail || detail.slug !== slug) return
      setQuotes((current) => {
        if (detail.count < POPULAR_THRESHOLD) {
          const next = current.filter((quote) => quote.highlightKey !== detail.highlightKey)
          popularHighlightCache.set(`${slug}:${version}`, next)
          return next
        }
        const found = current.some((quote) => quote.highlightKey === detail.highlightKey)
        const next = found ? current.map((quote) => quote.highlightKey === detail.highlightKey ? detail : quote) : [...current, detail]
        popularHighlightCache.set(`${slug}:${version}`, next)
        return next
      })
    }
    window.addEventListener('reader:popular-quote-updated', onUpdate)
    return () => window.removeEventListener('reader:popular-quote-updated', onUpdate)
  }, [slug, version])

  return quotes
}

function dispatchXray(term: XrayTerm) {
  window.dispatchEvent(new CustomEvent('reader:xray', { detail: term }))
}

export function ReaderParagraphText({ text, popularQuotes = [] }: { text: string; popularQuotes?: PopularQuote[] }) {
  const matches: { start: number; end: number; kind: 'popular' | 'term'; popular?: PopularQuote; term?: XrayTerm }[] = []

  for (const popular of popularQuotes.slice().sort((a, b) => b.count - a.count).slice(0, 3)) {
    const fallbackIndex = popular.quote ? text.indexOf(popular.quote) : -1
    const start = popular.startOffset >= 0 && popular.endOffset > popular.startOffset && popular.endOffset <= text.length
      ? popular.startOffset
      : fallbackIndex
    const rawEnd = start >= 0 ? (popular.endOffset > start ? popular.endOffset : start + (popular.quote?.length || 0)) : -1
    /* ═══ محاذاة حدود التظليل لحدود الكلمات ═══
       الإزاحات تأتي من تحديد القارئ وقد تقع داخل كلمة، فينشطر النص: «الروح»
       تصير «ال» + «روح» ويُحشر رقم العدّاد بينهما فيقصّ الكلمة — وهذا تشويهٌ
       لنصّ الدكتور لا يجوز. نمدّ الحدّ إلى أقرب فراغٍ فلا تُقصّ كلمة أبداً. */
    const snapStart = (position: number) => {
      let at = Math.max(0, Math.min(position, text.length))
      while (at > 0 && !/\s/.test(text[at - 1])) at -= 1
      return at
    }
    const snapEnd = (position: number) => {
      let at = Math.max(0, Math.min(position, text.length))
      while (at < text.length && !/\s/.test(text[at])) at += 1
      return at
    }
    const alignedStart = start >= 0 ? snapStart(start) : -1
    const end = rawEnd > 0 ? snapEnd(rawEnd) : -1
    if (alignedStart >= 0 && end - alignedStart >= 12) matches.push({ start: alignedStart, end, kind: 'popular', popular })
  }

  for (const term of GLOSSARY) {
    const haystack = /[A-Za-z]/.test(term.term) ? text.toLowerCase() : text
    const needle = /[A-Za-z]/.test(term.term) ? term.term.toLowerCase() : term.term
    const index = haystack.indexOf(needle)
    if (index >= 0) matches.push({ start: index, end: index + term.term.length, kind: 'term', term })
  }

  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const accepted: typeof matches = []
  let cursor = -1
  for (const match of matches) {
    if (match.start >= cursor) {
      accepted.push(match)
      cursor = match.end
    }
  }

  if (!accepted.length) return <>{text}</>
  const nodes: ReactNode[] = []
  let index = 0
  accepted.forEach((match, matchIndex) => {
    if (match.start > index) nodes.push(text.slice(index, match.start))
    const content = text.slice(match.start, match.end)
    if (match.kind === 'popular' && match.popular) {
      const hideBadge = (match.popular as PopularQuote & { hideBadge?: boolean }).hideBadge
      nodes.push(<PopularHighlightMark key={`popular-${matchIndex}`} count={match.popular.count} hideBadge={hideBadge}>{content}</PopularHighlightMark>)
    } else if (match.term) {
      const term = match.term
      nodes.push(
        <span
          key={`term-${matchIndex}`}
          role="button"
          tabIndex={0}
          className="reader-xray-term"
          onClick={(event) => { event.stopPropagation(); dispatchXray(term) }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); dispatchXray(term) } }}
        >
          {content}
        </span>,
      )
    }
    index = match.end
  })
  if (index < text.length) nodes.push(text.slice(index))
  return <>{nodes}</>
}

function PopularHighlightMark({ children, count, hideBadge }: { children: ReactNode; count: number; hideBadge?: boolean }) {
  const [open, setOpen] = useState(false)
  const label = `حُفظت ${arabicCountPhrase(count, OCCURRENCE_FORMS, (value) => value.toLocaleString('en-US'))}`
  const toggle = () => setOpen((current) => !current)
  return (
    <span className="reader-popular-wrap relative inline">
      <mark
        className="reader-popular-mark cursor-help"
        title={label}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${label}. من أكثر العبارات التي احتفظ بها القراء`}
        onClick={(event) => { event.stopPropagation(); toggle() }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() }
          if (event.key === 'Escape') setOpen(false)
        }}
      >{children}</mark>
      {!hideBadge && (
        <>
          {'\u2060'}<span className="reader-popular-note" aria-hidden="true">{count.toLocaleString('en-US')}</span>
          {open && (
            <span role="tooltip" className="reader-popular-tip absolute top-full z-20 mt-2 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-hair bg-canvas px-3 py-2 text-[.68rem] font-normal leading-[1.7] text-soft shadow-[0_12px_30px_-18px_rgba(0,0,0,.45)]">
              {label} · من أكثر العبارات التي احتفظ بها القراء
            </span>
          )}
        </>
      )}
    </span>
  )
}

type PopularQuoteInput = {
  slug: string
  body: string
  quote: string
  paragraph: number
  startOffset?: number
  endOffset?: number
  articleVersion?: string
  highlightKey?: string
  localQuoteId?: string
}

function intervalOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  const shortest = Math.max(1, Math.min(aEnd - aStart, bEnd - bStart))
  return overlap / shortest
}

function wordOverlap(left: string, right: string) {
  const a = new Set(normalizeHighlightText(left).split(' ').filter(Boolean))
  const b = new Set(normalizeHighlightText(right).split(' ').filter(Boolean))
  if (!a.size || !b.size) return 0
  let common = 0
  for (const item of a) if (b.has(item)) common++
  return common / Math.max(1, Math.min(a.size, b.size))
}

async function findCanonicalHighlight(input: PopularQuoteInput, version: string, startOffset: number, endOffset: number) {
  const db = await getDb()
  if (!db) return null
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore')
    const snapshot = await getDocs(query(collection(db, 'article_highlights'), where('slug', '==', input.slug)))
    const paragraphText = input.body.split('\n\n')[input.paragraph] || ''
    const candidates = snapshot.docs
      .map((item) => ({ key: item.id, data: item.data() as Partial<PopularQuote> }))
      .filter(({ data }) => data.articleVersion === version && String(data.paragraphId ?? data.paragraph) === String(input.paragraph) && Number.isInteger(Number(data.startOffset)) && Number.isInteger(Number(data.endOffset)))
      .map(({ key, data }) => ({ key, start: Number(data.startOffset), end: Number(data.endOffset), quoteHash: String(data.quoteHash || '') }))
    /* الرقم على الجملة رقمٌ واحد للعالم كله: أي قارئ يظلّلها — كلَّها أو جزءاً منها
       أو يزيد عليها قليلاً — يرفع العدّاد نفسه، ولا يُنشئ عدّاداً موازياً.
       شرط ٨٠٪ الصارم كان يفتح عدّاداً جديداً عند أدنى اختلاف في حدود التحديد،
       فيبقى الرقم الظاهر جامداً بينما تتناثر عدّادات يتيمة بقيمة ١.
       نقبل الاندماج متى تقاطع التحديدان فعلياً وتشاركا نصف الكلمات على الأقل،
       ونختار الأقوى تقاطعاً عند تعدد المرشحين.
       نسمح باختلاف في الطول يصل إلى 30% زيادة أو نقصان من التحديد الأصلي لرفع العداد نفسه. */
    const scored = candidates
      .map((item) => {
        const spans = intervalOverlap(startOffset, endOffset, item.start, item.end)
        const existingText = paragraphText.slice(item.start, item.end)
        const words = wordOverlap(input.quote, existingText)

        const lenUser = Math.max(1, endOffset - startOffset)
        const lenExisting = Math.max(1, item.end - item.start)
        const lenDiffRatio = Math.abs(lenUser - lenExisting) / lenExisting

        // يتقاطعان في حدود الفقرة ذاتها وبنسبة اختلاف لا تتجاوز 30% زيادة أو نقصاناً
        const hasIntersection = Math.max(startOffset, item.start) < Math.min(endOffset, item.end)
        const withinThirtyPercent = lenDiffRatio <= 0.30 && (spans > 0.15 || words > 0.20 || hasIntersection)

        return { item, spans, words, lenDiffRatio, withinThirtyPercent }
      })
      .filter(({ spans, words, withinThirtyPercent }) => withinThirtyPercent || (spans >= .35 && words >= .40))
      .sort((left, right) => {
        if (left.withinThirtyPercent && !right.withinThirtyPercent) return -1
        if (!left.withinThirtyPercent && right.withinThirtyPercent) return 1
        return (right.spans + right.words - right.lenDiffRatio) - (left.spans + left.words - left.lenDiffRatio)
      })
    return scored[0]?.item || null
  } catch {
    return null
  }
}

/** Aggregate highlight write. Personal quote text never leaves localStorage. */
export async function syncPopularQuote(input: PopularQuoteInput) {
  const normalized = normalizeHighlightText(input.quote).slice(0, 600)
  if (normalized.length < 12) return { highlightKey: '', count: 0 }
  const paragraphText = input.body.split('\n\n')[input.paragraph] || ''
  const inferredStart = Math.max(0, paragraphText.indexOf(input.quote))
  const startOffset = Number.isInteger(input.startOffset) && (input.startOffset as number) >= 0 ? Number(input.startOffset) : inferredStart
  const endOffset = Number.isInteger(input.endOffset) && (input.endOffset as number) > startOffset ? Number(input.endOffset) : Math.min(paragraphText.length, startOffset + input.quote.length)
  const version = input.articleVersion || articleContentVersion(input.body)
  const quoteHash = await stableHash(normalized)
  const canonical = await findCanonicalHighlight(input, version, startOffset, endOffset)
  const highlightKey = canonical?.key || await stableHash(`${input.slug}\u0000${version}\u0000${input.paragraph}\u0000${startOffset}\u0000${endOffset}\u0000${quoteHash}`)
  const canonicalStart = canonical?.start ?? startOffset
  const canonicalEnd = canonical?.end ?? endOffset
  const canonicalQuoteHash = canonical?.quoteHash || quoteHash
  const auth = await getFirebaseAuth()
  if (!auth) return { highlightKey, count: 0 }
  const authModule = await import('firebase/auth')
  const user = auth.currentUser || (await authModule.signInAnonymously(auth)).user
  const db = await getDb()
  if (!db || !user) return { highlightKey, count: 0 }
  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  const countRef = doc(db, 'article_highlights', highlightKey)
  const membershipRef = doc(db, 'article_highlight_members', highlightKey, 'readers', user.uid)
  const count = await runTransaction(db, async (transaction) => {
    const [membershipSnapshot, countSnapshot] = await Promise.all([transaction.get(membershipRef), transaction.get(countRef)])
    const previous = countSnapshot.exists() ? Number(countSnapshot.data().count || 0) : 0
    if (membershipSnapshot.exists()) return previous
    const now = serverTimestamp()
    transaction.set(membershipRef, { uid: user.uid, highlightKey, createdAt: now })
    transaction.set(countRef, {
      slug: input.slug,
      articleVersion: version,
      paragraph: input.paragraph,
      paragraphId: String(input.paragraph),
      startOffset: canonicalStart,
      endOffset: canonicalEnd,
      quoteHash: canonicalQuoteHash,
      count: previous + 1,
      updatedAt: now,
    }, { merge: true })
    return previous + 1
  })
  const detail: PopularQuote = { slug: input.slug, articleVersion: version, highlightKey, quoteHash: canonicalQuoteHash, paragraph: input.paragraph, paragraphId: String(input.paragraph), startOffset: canonicalStart, endOffset: canonicalEnd, count }
  if (input.localQuoteId) {
    window.dispatchEvent(new CustomEvent('reader:popular-quote-linked', {
      detail: { localQuoteId: input.localQuoteId, articleVersion: version, highlightKey, startOffset: canonicalStart, endOffset: canonicalEnd },
    }))
  }
  if (count >= POPULAR_THRESHOLD) {
    window.dispatchEvent(new CustomEvent('reader:popular-quote-updated', { detail }))
    popularHighlightCache.delete(`${input.slug}:${version}`)
  }
  return { highlightKey, count }
}

/** Remove the same anonymous membership once and decrement atomically. */
export async function removePopularQuote(input: PopularQuoteInput) {
  const version = input.articleVersion || articleContentVersion(input.body)
  const normalized = normalizeHighlightText(input.quote)
  const quoteHash = await stableHash(normalized)
  const startOffset = Number(input.startOffset || 0)
  const endOffset = Number(input.endOffset || (startOffset + input.quote.length))
  const canonical = input.highlightKey ? null : (input.body ? await findCanonicalHighlight(input, version, startOffset, endOffset) : null)
  const highlightKey = input.highlightKey || canonical?.key || await stableHash(`${input.slug}\u0000${version}\u0000${input.paragraph}\u0000${startOffset}\u0000${endOffset}\u0000${quoteHash}`)
  const auth = await getFirebaseAuth()
  const db = await getDb()
  const authModule = await import('firebase/auth')
  const user = auth?.currentUser || (auth ? (await authModule.signInAnonymously(auth)).user : null)
  if (!db || !user) return { highlightKey, count: 0 }
  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  const countRef = doc(db, 'article_highlights', highlightKey)
  const membershipRef = doc(db, 'article_highlight_members', highlightKey, 'readers', user.uid)
  const count = await runTransaction(db, async (transaction) => {
    const [membershipSnapshot, countSnapshot] = await Promise.all([transaction.get(membershipRef), transaction.get(countRef)])
    if (!membershipSnapshot.exists() || !countSnapshot.exists()) return Number(countSnapshot.data()?.count || 0)
    const previous = Number(countSnapshot.data().count || 0)
    transaction.delete(membershipRef)
    transaction.update(countRef, { count: Math.max(0, previous - 1), updatedAt: serverTimestamp() })
    return Math.max(0, previous - 1)
  })
  window.dispatchEvent(new CustomEvent('reader:popular-quote-updated', { detail: { slug: input.slug, articleVersion: version, highlightKey, quoteHash, paragraph: input.paragraph, paragraphId: String(input.paragraph), startOffset, endOffset, count } }))
  return { highlightKey, count }
}

function wrapCanvasLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

async function quoteCardBlob(quote: string, article: ReaderArticle) {
  try { await document.fonts?.ready } catch { /* noop */ }
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  const dark = document.documentElement.classList.contains('dark')
  const paper = document.documentElement.classList.contains('reader-paper')
  const background = dark ? '#111318' : paper ? '#F7F3E9' : '#FCFCFA'
  const ink = dark ? '#EEECE6' : '#15161A'
  const accent = dark ? '#84A9CA' : '#3E5C78'
  const soft = dark ? '#B2B6BE' : '#7C818B'
  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  const glow = context.createRadialGradient(850, 160, 20, 850, 160, 620)
  glow.addColorStop(0, `${accent}22`)
  glow.addColorStop(1, `${accent}00`)
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)

  context.strokeStyle = `${accent}38`
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(92, 92)
  context.lineTo(988, 92)
  context.stroke()

  context.direction = 'rtl'
  context.textAlign = 'right'
  const quoteSize = quote.length > 330 ? 42 : quote.length > 220 ? 48 : quote.length > 125 ? 56 : 64
  context.font = `500 ${quoteSize}px "El Messiri", "Tajawal", sans-serif`
  context.fillStyle = ink
  const lines = wrapCanvasLines(context, quote, 820).slice(0, 10)
  const lineHeight = quoteSize * 1.75
  const blockHeight = lines.length * lineHeight
  let y = Math.max(250, 650 - blockHeight / 2)
  for (const line of lines) {
    context.fillText(line, 946, y)
    y += lineHeight
  }

  context.fillStyle = accent
  context.fillRect(826, 1042, 120, 4)
  context.font = '700 34px "Tajawal", sans-serif'
  context.fillText('د. أحمد حسين الفيلكاوي', 946, 1110)
  context.font = '500 27px "Tajawal", sans-serif'
  context.fillStyle = soft
  const titleLines = wrapCanvasLines(context, article.title, 760).slice(0, 2)
  let titleY = 1168
  for (const line of titleLines) {
    context.fillText(line, 946, titleY)
    titleY += 43
  }
  context.font = '500 23px "Tajawal", sans-serif'
  context.fillText(`dr-alfailakawi.com/articles/${article.slug}`, 946, 1280)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذّر إنشاء البطاقة')), 'image/png', 1)
  })
}

export function SelectionTools({ current, articles }: { current: ReaderArticle; articles: ReaderArticle[] }) {
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null)
  const [feedback, setFeedback] = useState<'saved' | 'copied' | ''>('')
  const [sheet, setSheet] = useState<'share' | 'thread' | 'card' | null>(null)
  const [cardUrl, setCardUrl] = useState('')
  const [cardBlob, setCardBlob] = useState<Blob | null>(null)
  const [cardBusy, setCardBusy] = useState(false)
  const [quoteSaved, setQuoteSaved] = useState(false)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef<SelectionSnapshot | null>(null)

  useEffect(() => { selectionRef.current = selection }, [selection])
  useEffect(() => () => { if (cardUrl) URL.revokeObjectURL(cardUrl) }, [cardUrl])

  useEffect(() => {
    let timer = 0
    const inspect = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (sheet) return
        const nativeSelection = window.getSelection()
        const text = nativeSelection?.toString().replace(/\s+/g, ' ').trim() || ''
        if (!nativeSelection || !nativeSelection.rangeCount || text.length < 8 || text.length > 600) {
          if (!toolbarRef.current?.matches(':active')) setSelection(null)
          return
        }
        const range = nativeSelection.getRangeAt(0)
        const ancestor = range.commonAncestorContainer
        const element = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor as Element : ancestor.parentElement
        const paragraph = element?.closest<HTMLElement>('[data-reader-paragraph]')
        if (!paragraph?.closest('.article-body')) {
          setSelection(null)
          return
        }
        const paragraphIndex = Number(paragraph.dataset.readerParagraph)
        if (!Number.isInteger(paragraphIndex)) return
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
        const rect = rects[0] || range.getBoundingClientRect()
        if (!rect || (!rect.width && !rect.height)) return
        // Restore the original signature tool exactly where readers expect it:
        // centred above the selected sentence, with safe horizontal clamping.
        const x = Math.min(window.innerWidth - 132, Math.max(132, rect.left + rect.width / 2))
        const y = Math.max(74, rect.top - 10)
        setSelection({ text, paragraph: paragraphIndex, x, y, placement: 'above' })
      }, 110)
    }
    const onOutside = (event: PointerEvent) => {
      if (toolbarRef.current?.contains(event.target as Node) || sheet) return
      const nativeSelection = window.getSelection()?.toString().trim() || ''
      if (!nativeSelection) setSelection(null)
    }
    document.addEventListener('selectionchange', inspect)
    document.addEventListener('pointerup', inspect)
    document.addEventListener('touchend', inspect, { passive: true })
    document.addEventListener('pointerdown', onOutside, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('selectionchange', inspect)
      document.removeEventListener('pointerup', inspect)
      document.removeEventListener('touchend', inspect)
      document.removeEventListener('pointerdown', onOutside, true)
    }
  }, [sheet])

  const currentSelection = selectionRef.current
  const openThread = () => {
    if (!currentSelection) return
    setSheet('thread')
  }

  const openCard = () => {
    if (!currentSelection) return
    setQuoteSaved(false)
    setSheet('card')
    window.setTimeout(() => { void createCard() }, 30)
  }

  const directShare = async () => {
    if (!currentSelection) return
    const text = `«${currentSelection.text}»\n— د. أحمد حسين الفيلكاوي`
    const url = `${window.location.origin}/articles/${current.slug}`
    try {
      if (navigator.share) {
        await navigator.share({ title: current.title, text, url })
        return
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
    }
    await copyText(`${text}\n${current.title}\n${url}`)
    setFeedback('copied')
  }

  const createCard = async () => {
    if (!currentSelection || cardBusy) return
    setCardBusy(true)
    try {
      const blob = await quoteCardBlob(currentSelection.text, current)
      if (cardUrl) URL.revokeObjectURL(cardUrl)
      setCardBlob(blob)
      setCardUrl(URL.createObjectURL(blob))
    } finally {
      setCardBusy(false)
    }
  }

  const shareCard = async () => {
    if (!cardBlob) return
    const file = new File([cardBlob], `quote-${current.slug}.png`, { type: 'image/png' })
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: current.title, text: 'اقتباس من د. أحمد حسين الفيلكاوي', files: [file] })
        return
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
    }
    const anchor = document.createElement('a')
    anchor.href = cardUrl
    anchor.download = `اقتباس-${current.slug}.png`
    anchor.click()
  }

  const downloadCard = async () => {
    if (!cardUrl || !cardBlob) return
    const file = new File([cardBlob], `اقتباس-${current.slug}.png`, { type: 'image/png' })
    const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean; standalone?: boolean }
    const isIos = /iP(?:hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || Boolean(shareNavigator.standalone)
    try {
      if ((isIos || isStandalone) && navigator.share && shareNavigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'بطاقة اقتباس' })
        return
      }
      const anchor = document.createElement('a')
      anchor.href = cardUrl
      anchor.download = file.name
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
      window.open(cardUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const seed = useMemo(() => new Set(ideaTokens(currentSelection?.text || '')), [currentSelection?.text])
  const matches = useMemo(() => {
    if (!seed.size) return []
    return articles
      .filter((article) => article.slug !== current.slug && article.iso.slice(0, 4) !== current.iso.slice(0, 4))
      .map((article) => {
        const bag = new Set(ideaTokens(`${article.title} ${article.excerpt || ''} ${(article.body || '').slice(0, 5000)}`))
        let overlap = 0
        seed.forEach((token) => { if (bag.has(token)) overlap++ })
        return { article, overlap, score: overlap + (article.cat === current.cat ? .75 : 0) }
      })
      .filter((item) => item.overlap > 0 || item.article.cat === current.cat)
      .sort((a, b) => b.score - a.score || a.article.iso.localeCompare(b.article.iso))
      .slice(0, 6)
      .sort((a, b) => a.article.iso.localeCompare(b.article.iso))
  }, [articles, current.cat, current.iso, current.slug, seed])

  const closeSheet = () => {
    setSheet(null)
    setSelection(null)
    setCardBlob(null)
    if (cardUrl) URL.revokeObjectURL(cardUrl)
    setCardUrl('')
    setFeedback('')
    setQuoteSaved(false)
  }

  const keepQuote = () => {
    if (!currentSelection) return
    saveLocalQuote(current, currentSelection)
    setQuoteSaved(true)
  }

  return (
    <>
      <AnimatePresence>
        {selection && !sheet && (
          <motion.div
            ref={toolbarRef}
            initial={{ opacity: 0, y: 6, scale: .94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: .94 }}
            transition={{ duration: .18 }}
            style={{ left: selection.x, top: selection.y, transform: 'translate(-50%,-100%)' }}
            className="reader-selection-toolbar fixed z-[270] flex items-stretch overflow-hidden rounded-full border border-hair bg-canvas shadow-[0_16px_38px_-16px_rgba(0,0,0,.5)]"
            dir="rtl"
          >
            <button
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={openThread}
              aria-label="تتبّع الفكرة عبر السنوات"
              title="تتبّع الفكرة عبر السنوات"
              className="flex h-11 w-12 items-center justify-center text-ink transition-colors hover:bg-accent hover:text-canvas"
            >
              <SocialIcon name="History" size={18} />
            </button>
            <span className="my-1.5 w-px bg-hair" aria-hidden="true" />
            <button
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={openCard}
              aria-label="صناعة بطاقة اقتباس"
              title="صناعة بطاقة اقتباس"
              className="flex h-11 w-12 items-center justify-center text-ink transition-colors hover:bg-accent hover:text-canvas"
            >
              <SocialIcon name="Image" size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && currentSelection && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="reader-modal-overlay fixed inset-0 z-[320] flex items-end justify-center overflow-y-auto overscroll-contain bg-ink/[.38] backdrop-blur-[2px] sm:items-center sm:p-5" onClick={closeSheet}>
            <motion.section initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[1.75rem] border border-hair bg-canvas px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_38px_90px_-42px_rgba(21,22,26,.8)] sm:rounded-[1.75rem] sm:p-7" dir="rtl">
              <header className="flex items-start justify-between gap-4">
                <div><p className="text-[.7rem] font-semibold text-accent">{sheet === 'thread' ? 'الفكرة عبر السنوات' : sheet === 'card' ? 'بطاقة الاقتباس' : 'مشاركة الاقتباس'}</p><h2 className="mt-1 font-display text-[1.16rem] font-semibold text-ink">{current.title}</h2></div>
                <button type="button" onClick={closeSheet} aria-label="إغلاق" title="إغلاق" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-soft"><SocialIcon name="Close" size={16} /></button>
              </header>
              <blockquote className="mt-5 rounded-2xl border border-hair bg-wash/[.45] px-4 py-4 font-display text-[.9rem] font-light leading-[1.9] text-ink">«{currentSelection.text}»</blockquote>

              {sheet === 'card' ? (
                <div className="mt-5">
                  {!cardUrl && <div className="flex aspect-[4/5] items-center justify-center rounded-2xl border border-hair bg-wash text-[.78rem] text-soft">{cardBusy ? 'أصنع البطاقة…' : 'لحظة…'}</div>}
                  {cardUrl && (
                    <>
                      <img src={cardUrl} alt="بطاقة اقتباس" className="mx-auto w-full max-w-[360px] rounded-2xl border border-hair shadow-[0_26px_60px_-36px_rgba(21,22,26,.7)]" />
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={() => void shareCard()} aria-label="مشاركة البطاقة" title="مشاركة البطاقة" className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"><SocialIcon name="Share" size={17} /></button>
                        <button type="button" onClick={() => void downloadCard()} aria-label="حفظ الصورة" title="حفظ الصورة" className="flex h-11 w-11 items-center justify-center rounded-full border border-hair text-soft hover:border-accent hover:text-accent"><SocialIcon name="Download" size={17} /></button>
                      </div>
                      <div className="mt-3 flex justify-center">
                        <button type="button" onClick={keepQuote} aria-pressed={quoteSaved} className="rounded-full border border-accent/[.35] px-4 py-2 text-[.72rem] font-semibold text-accent transition-colors hover:bg-accent/[.08]">
                          {quoteSaved ? 'حُفظت في دفتر القراءة' : 'احتفظ بالجملة في دفتر القراءة'}
                        </button>
                      </div>
                      <p className="mt-2 text-center text-[.68rem] text-soft">1080×1350 — مناسبة لواتساب وX وإنستغرام.</p>
                    </>
                  )}
                  <div className="mt-4 flex justify-center gap-3">
                    <button type="button" onClick={() => setSheet('thread')} className="text-[.74rem] font-semibold text-accent">عبر السنوات</button>
                    <span className="text-hair">·</span>
                    <button type="button" onClick={() => setSheet('share')} className="text-[.74rem] font-semibold text-soft hover:text-accent">خيارات المشاركة</button>
                  </div>
                </div>
              ) : sheet === 'share' ? (
                <div className="mt-5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => void directShare()} className="rounded-full bg-accent px-5 py-3 text-[.8rem] font-semibold text-white">مشاركة النص والرابط</button>
                    <button type="button" onClick={() => void createCard()} disabled={cardBusy} className="rounded-full border border-hair px-5 py-3 text-[.8rem] font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-50">{cardBusy ? 'أصنع البطاقة…' : cardUrl ? 'تحديث البطاقة' : 'إنشاء بطاقة اقتباس'}</button>
                  </div>
                  <button type="button" onClick={() => setSheet('thread')} className="mt-3 w-full rounded-full px-5 py-2.5 text-[.76rem] font-semibold text-soft transition-colors hover:text-accent">تتبّع الفكرة عبر السنوات</button>
                  {feedback === 'copied' && <p className="mt-3 text-center text-[.72rem] text-accent">نُسخ النص والرابط.</p>}
                  {cardUrl && (
                    <div className="mt-5">
                      <img src={cardUrl} alt="بطاقة اقتباس" className="mx-auto w-full max-w-[360px] rounded-2xl border border-hair shadow-[0_26px_60px_-36px_rgba(21,22,26,.7)]" />
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={() => void shareCard()} aria-label="مشاركة البطاقة" title="مشاركة البطاقة" className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"><SocialIcon name="Share" size={17} /></button>
                        <button type="button" onClick={() => void downloadCard()} aria-label="حفظ الصورة" title="حفظ الصورة" className="flex h-11 w-11 items-center justify-center rounded-full border border-hair text-soft hover:border-accent hover:text-accent"><SocialIcon name="Download" size={17} /></button>
                      </div>
                      <p className="mt-2 text-center text-[.68rem] text-soft">صورة عالية الجودة 1080×1350 مناسبة لواتساب وX وإنستغرام.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 border-t border-hair pt-5">
                  {matches.length ? (
                    <ol className="relative space-y-5 before:absolute before:bottom-2 before:right-[6px] before:top-2 before:w-px before:bg-hair">
                      {matches.map(({ article, overlap }) => (
                        <li key={article.slug} className="relative ps-6">
                          <span className="absolute right-0 top-[.42em] h-3 w-3 rounded-full border-2 border-accent bg-canvas" />
                          <span className="text-[.7rem] font-semibold text-accent">{article.iso.slice(0, 4)}</span>
                          <Link to={`/articles/${article.slug}`} onClick={closeSheet} className="mt-1 block font-display text-[.98rem] font-medium leading-[1.65] text-ink transition-colors hover:text-accent">{article.title}</Link>
                          <span className="mt-1 block text-[.7rem] text-soft">{categoryLabel(article.cat)}{overlap ? ` · ${arabicCountPhrase(overlap, CONNECTION_FORMS, (value) => value.toLocaleString('en-US'))}` : ''}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="py-6 text-center text-[.82rem] leading-relaxed text-soft">لا يظهر امتداد زمني واضح لهذه العبارة حتى الآن.</p>
                  )}
                  <button type="button" onClick={() => setSheet('share')} className="mt-5 w-full rounded-full border border-hair px-5 py-2.5 text-[.76rem] font-semibold text-soft hover:border-accent hover:text-accent">العودة إلى المشاركة</button>
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
