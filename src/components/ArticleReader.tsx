import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../lib/firebase'

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
  quoteHash: string
  quote: string
  paragraph: number
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
}

type ReaderTheme = 'light' | 'dark' | 'paper'
type ReaderPreferences = {
  scale: number
  lineHeight: number
  width: number
  theme: ReaderTheme
  showPopular: boolean
  focus: boolean
}

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
const DEVICE_KEY = 'reader:anonymous-device:v1'
const PROGRESS_PREFIX = 'reader:progress:v2:'
const PENDING_QUOTE_KEY = 'reader:pending-quote:v1'
const POPULAR_THRESHOLD = 10

const DEFAULT_PREFS: ReaderPreferences = {
  scale: 1,
  lineHeight: 2.15,
  width: 72,
  theme: 'light',
  showPopular: true,
  focus: false,
}

const AR_STOP = new Set(['من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'ما', 'لا', 'هذا', 'هذه', 'التي', 'الذي', 'مع', 'أو', 'ثم', 'قد', 'كل', 'بين', 'هو', 'هي', 'كان', 'كانت', 'لكن', 'حتى', 'إذا', 'عند', 'بعد', 'قبل', 'كما', 'لأن', 'حين', 'كيف', 'لماذا', 'أم', 'بل', 'نحن', 'هم', 'أنت', 'أنا', 'به', 'له', 'لها', 'فيه', 'فيها', 'ذلك', 'تلك', 'أي', 'كذلك', 'أيضا', 'دون', 'غير', 'عبر', 'خلال', 'حول', 'نحو'])
const normalizeArabic = (value: string) => value.replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
const ideaTokens = (value: string) => normalizeArabic(value).replace(/[^ء-ي\s]/g, ' ').split(/\s+/)
  .map((word) => word.replace(/^(وال|فال|بال|كال|ال|و|ف|ب|ل|ك)/, ''))
  .filter((word) => word.length >= 4 && !AR_STOP.has(word))

const GLOSSARY: XrayTerm[] = [
  { term: 'الذكاء الاصطناعي', title: 'الذكاء الاصطناعي', definition: 'أنظمة حاسوبية تنفّذ مهامًا ترتبط عادةً بالإدراك البشري، مثل التعلّم والتحليل والتنبؤ وتوليد المحتوى.', note: 'المعنى التربوي الأهم ليس الأداة وحدها، بل طريقة استخدامها وأثرها في الإنسان.' },
  { term: 'التعلم الآلي', title: 'التعلّم الآلي', definition: 'فرع من الذكاء الاصطناعي يتعلّم الأنماط من البيانات بدل الاعتماد على تعليمات ثابتة لكل حالة.' },
  { term: 'التعلّم الآلي', title: 'التعلّم الآلي', definition: 'فرع من الذكاء الاصطناعي يتعلّم الأنماط من البيانات بدل الاعتماد على تعليمات ثابتة لكل حالة.' },
  { term: 'التعلم العميق', title: 'التعلّم العميق', definition: 'أسلوب في التعلّم الآلي يستخدم شبكات عصبية متعددة الطبقات للتعامل مع أنماط شديدة التعقيد.' },
  { term: 'التفكير النقدي', title: 'التفكير النقدي', definition: 'فحص الادعاءات والأدلة والافتراضات قبل قبول النتيجة، مع القدرة على التفسير والمقارنة وتغيير الرأي عند ظهور دليل أفضل.' },
  { term: 'التقييم التكويني', title: 'التقييم التكويني', definition: 'تقييم يحدث أثناء التعلّم ليكشف ما يحتاجه المتعلّم الآن، ويقود الخطوة التعليمية التالية بدل الاكتفاء بدرجة نهائية.' },
  { term: 'التقويم التكويني', title: 'التقويم التكويني', definition: 'استخدام أدلة التعلّم أثناء الدرس لتحسين التدريس ومساعدة المتعلّم على التقدّم قبل الحكم النهائي.' },
  { term: 'التعليم المدمج', title: 'التعليم المدمج', definition: 'تصميم يجمع التعلّم الحضوري والرقمي ضمن تجربة واحدة مترابطة، لا بوصفهما مسارين منفصلين.' },
  { term: 'الواقع الافتراضي', title: 'الواقع الافتراضي', definition: 'بيئة رقمية غامرة تمنح المستخدم إحساسًا بالحضور داخل مكان أو موقف مُحاكى.' },
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
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* التخزين المحلي قد يكون محجوبًا */ }
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
  }
}

function applyPreferences(preferences: ReaderPreferences) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--article-scale', String(preferences.scale))
  root.style.setProperty('--article-line', String(preferences.lineHeight))
  root.style.setProperty('--article-width', `${preferences.width}ch`)
  root.classList.toggle('reader-paper', preferences.theme === 'paper')
  root.classList.toggle('reader-focus', preferences.focus)
  root.dataset.readerPopular = preferences.showPopular ? 'on' : 'off'

  const dark = preferences.theme === 'dark'
  root.classList.toggle('dark', dark)
  try { window.localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent('reader:theme-changed', { detail: { dark } }))
}

function useReaderPreferences() {
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
  if (minutes <= 1) return 'دقيقة واحدة للقراءة'
  if (minutes === 2) return 'دقيقتان للقراءة'
  if (minutes <= 10) return `${minutes.toLocaleString('ar-KW')} دقائق للقراءة`
  return `${minutes.toLocaleString('ar-KW')} دقيقة للقراءة`
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

function getAnonymousDeviceId() {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const next = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(DEVICE_KEY, next)
    return next
  } catch {
    return `session-${Math.random().toString(36).slice(2)}`
  }
}

function readSavedQuotes() {
  if (typeof window === 'undefined') return [] as SavedQuote[]
  return readJson<SavedQuote[]>(QUOTES_KEY, []).filter((quote) => quote?.id && quote?.quote && quote?.slug)
}

function saveQuotes(quotes: SavedQuote[]) {
  writeJson(QUOTES_KEY, quotes.slice(0, 300))
  window.dispatchEvent(new CustomEvent('reader:quotes-changed'))
}

export function ArticleProgressBar({ slug }: { slug: string }) {
  const [progress, setProgress] = useState(0)
  const lastSaved = useRef(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const next = articleProgress()
      setProgress(next)
      window.dispatchEvent(new CustomEvent('reader:progress', { detail: { slug, progress: next } }))
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

  return (
    <div className="reader-progress-track fixed inset-x-0 top-0 z-[245] h-[2px]" aria-hidden>
      <span className="block h-full origin-right bg-accent" style={{ transform: `scaleX(${progress})` }} />
    </div>
  )
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
  return <span className="text-soft">{remaining <= 1 ? 'بقي أقل من دقيقة' : `بقي ${remaining.toLocaleString('ar-KW')} دقائق`}</span>
}

function SettingChoice<T extends string | number>({ value, current, label, onClick }: { value: T; current: T; label: string; onClick: () => void }) {
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

export function ReaderControls({ article }: { article: ReaderArticle }) {
  const { preferences, setPreferences } = useReaderPreferences()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'settings' | 'quotes'>('settings')
  const [quotes, setQuotesState] = useState<SavedQuote[]>(() => readSavedQuotes())
  const [copiedId, setCopiedId] = useState('')
  const [xray, setXray] = useState<XrayTerm | null>(null)
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
    const refreshQuotes = () => setQuotesState(readSavedQuotes())
    const onXray = (event: Event) => setXray((event as CustomEvent<XrayTerm>).detail || null)
    window.addEventListener('reader:quotes-changed', refreshQuotes)
    window.addEventListener('reader:xray', onXray)
    return () => {
      window.removeEventListener('reader:quotes-changed', refreshQuotes)
      window.removeEventListener('reader:xray', onXray)
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
      <div className="reader-control-anchor mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => { setTab('settings'); setOpen(true) }}
          aria-label="إعدادات القراءة والاقتباسات"
          title="إعدادات القراءة"
          className="reader-aa-button flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-canvas text-[.82rem] font-semibold tracking-[-.05em] text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Aa
        </button>
      </div>

      <AnimatePresence>
        {showResume && (
          <motion.aside
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="reader-resume-prompt reader-hide-focus fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[225] mx-auto max-w-sm rounded-2xl border border-hair bg-canvas/96 px-4 py-3 shadow-[0_22px_60px_-34px_rgba(21,22,26,.65)] backdrop-blur"
          >
            <p className="text-[.8rem] font-semibold text-ink">متابعة من حيث توقفت؟</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={resume} className="rounded-full bg-accent px-4 py-1.5 text-[.74rem] font-semibold text-white">متابعة</button>
              <button type="button" onClick={restart} className="rounded-full border border-hair px-4 py-1.5 text-[.74rem] text-soft">من البداية</button>
              <button type="button" onClick={() => setShowResume(false)} aria-label="إغلاق" className="ms-auto h-7 w-7 rounded-full text-soft">×</button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[310] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => setOpen(false)}>
            <motion.section
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="reader-settings-sheet max-h-[88dvh] w-full max-w-[620px] overflow-y-auto rounded-t-[1.75rem] border border-hair bg-canvas px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_36px_90px_-42px_rgba(21,22,26,.75)] sm:rounded-[1.75rem] sm:p-7"
              dir="rtl"
            >
              <header className="flex items-center justify-between gap-4 border-b border-hair pb-4">
                <div>
                  <p className="text-[.72rem] font-semibold text-accent">قارئ هادئ</p>
                  <h2 className="mt-1 font-display text-[1.22rem] font-semibold text-ink">{tab === 'settings' ? 'إعدادات القراءة' : 'اقتباساتي'}</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft">×</button>
              </header>

              <div className="mt-4 flex gap-2" role="tablist" aria-label="أقسام القارئ">
                <button type="button" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')} className={`rounded-full px-4 py-2 text-[.76rem] font-semibold ${tab === 'settings' ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>القراءة</button>
                <button type="button" role="tab" aria-selected={tab === 'quotes'} onClick={() => setTab('quotes')} className={`rounded-full px-4 py-2 text-[.76rem] font-semibold ${tab === 'quotes' ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>اقتباساتي{quotes.length ? ` · ${quotes.length.toLocaleString('ar-KW')}` : ''}</button>
              </div>

              {tab === 'settings' ? (
                <div className="mt-6 space-y-6">
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
                    <p className="text-[.76rem] font-semibold text-ink">الخلفية</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SettingChoice value="light" current={preferences.theme} label="فاتحة" onClick={() => setPreferences({ theme: 'light' })} />
                      <SettingChoice value="dark" current={preferences.theme} label="داكنة" onClick={() => setPreferences({ theme: 'dark' })} />
                      <SettingChoice value="paper" current={preferences.theme} label="ورقية" onClick={() => setPreferences({ theme: 'paper' })} />
                    </div>
                  </section>
                  <section className="grid gap-3 border-t border-hair pt-5">
                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-hair bg-wash/45 px-4 py-3">
                      <span><span className="block text-[.8rem] font-semibold text-ink">وضع التركيز</span><span className="mt-0.5 block text-[.7rem] text-soft">يخفي التنقل والعناصر الثانوية أثناء القراءة.</span></span>
                      <input type="checkbox" checked={preferences.focus} onChange={(event) => setPreferences({ focus: event.target.checked })} className="h-4 w-4 accent-[rgb(var(--c-accent))]" />
                    </label>
                  </section>
                  <p className="text-[.7rem] leading-[1.8] text-soft">تُحفظ هذه الاختيارات على هذا الجهاز فقط، وتُطبّق تلقائيًا على بقية المقالات.</p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="rounded-2xl border border-hair bg-wash/45 px-4 py-3 text-[.74rem] leading-[1.8] text-soft">الاقتباسات محفوظة على هذا الجهاز فقط، من دون حساب أو بريد إلكتروني.</p>
                  {quotes.length ? (
                    <div className="mt-4 space-y-3">
                      {quotes.map((quote) => (
                        <article key={quote.id} className="rounded-2xl border border-hair bg-canvas p-4">
                          <blockquote className="font-display text-[.94rem] font-light leading-[1.9] text-ink">«{quote.quote}»</blockquote>
                          <p className="mt-2 text-[.7rem] leading-relaxed text-soft">{quote.title} · {new Date(quote.savedAt).toLocaleDateString('ar-KW')}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => goToQuote(quote)} className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft hover:border-accent hover:text-accent">الرجوع إلى موضعه</button>
                            <button type="button" onClick={async () => { await copyText(quote.quote); setCopiedId(quote.id); window.setTimeout(() => setCopiedId(''), 1200) }} className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft hover:border-accent hover:text-accent">{copiedId === quote.id ? 'نُسخ' : 'نسخ'}</button>
                            <button type="button" onClick={() => void shareSavedQuote(quote)} className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft hover:border-accent hover:text-accent">مشاركة</button>
                            <button type="button" onClick={() => removeQuote(quote.id)} className="ms-auto rounded-full px-3 py-1.5 text-[.7rem] text-soft hover:text-accent">حذف</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="font-display text-[1.05rem] font-semibold text-ink">دفترك هادئ حتى الآن.</p>
                      <p className="mt-2 text-[.78rem] leading-relaxed text-soft">حدّد جملة داخل أي مقال، ثم اختر «حفظ».</p>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[315] flex items-end justify-center bg-ink/24 backdrop-blur-[1.5px] sm:items-center sm:p-5" onClick={() => setXray(null)}>
            <motion.aside initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-[1.6rem] border border-hair bg-canvas px-5 pb-[calc(1.2rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_28px_80px_-40px_rgba(21,22,26,.75)] sm:rounded-[1.6rem] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[.7rem] font-semibold text-accent">توضيح داخل المقال</p><h2 className="mt-1 font-display text-[1.14rem] font-semibold text-ink">{xray.title}</h2></div>
                <button type="button" onClick={() => setXray(null)} aria-label="إغلاق" className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-soft">×</button>
              </div>
              <p className="mt-4 text-[.88rem] font-light leading-[1.95] text-ink/88">{xray.definition}</p>
              {xray.note && <p className="mt-3 border-r border-accent/35 ps-3 text-[.76rem] leading-[1.85] text-soft">{xray.note}</p>}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function usePopularQuotes(slug: string) {
  const [quotes, setQuotes] = useState<PopularQuote[]>([])
  const { preferences } = useReaderPreferences()

  useEffect(() => {
    let active = true
    void getDb().then(async (db) => {
      if (!db) return
      const { collection, getDocs, query, where } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, 'article_quote_counts'), where('slug', '==', slug)))
      if (!active) return
      const next = snapshot.docs
        .map((item) => item.data() as Partial<PopularQuote>)
        .filter((item): item is PopularQuote => item.slug === slug && typeof item.quote === 'string' && Number(item.count) >= POPULAR_THRESHOLD && Number.isInteger(Number(item.paragraph)))
        .map((item) => ({ ...item, paragraph: Number(item.paragraph), count: Number(item.count) }))
      setQuotes(next)
    }).catch(() => undefined)
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PopularQuote>).detail
      if (!detail || detail.slug !== slug || detail.count < POPULAR_THRESHOLD) return
      setQuotes((current) => {
        const found = current.some((quote) => quote.quoteHash === detail.quoteHash)
        return found ? current.map((quote) => quote.quoteHash === detail.quoteHash ? detail : quote) : [...current, detail]
      })
    }
    window.addEventListener('reader:popular-quote-updated', onUpdate)
    return () => window.removeEventListener('reader:popular-quote-updated', onUpdate)
  }, [slug])

  return preferences.showPopular ? quotes : []
}

function dispatchXray(term: XrayTerm) {
  window.dispatchEvent(new CustomEvent('reader:xray', { detail: term }))
}

export function ReaderParagraphText({ text, popularQuotes = [] }: { text: string; popularQuotes?: PopularQuote[] }) {
  const matches: { start: number; end: number; kind: 'popular' | 'term'; popular?: PopularQuote; term?: XrayTerm }[] = []

  for (const popular of popularQuotes.slice().sort((a, b) => b.count - a.count).slice(0, 3)) {
    const index = text.indexOf(popular.quote)
    if (index >= 0 && popular.quote.length >= 12) matches.push({ start: index, end: index + popular.quote.length, kind: 'popular', popular })
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
      nodes.push(<mark key={`popular-${matchIndex}`} className="reader-popular-mark" title={`احتفظ بهذه العبارة ${match.popular.count.toLocaleString('ar-KW')} قارئًا`}>{content}</mark>)
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

async function syncPopularQuote(article: ReaderArticle, quote: string, paragraph: number) {
  const normalized = quote.replace(/\s+/g, ' ').trim().slice(0, 600)
  const quoteHash = await stableHash(`${article.slug}\u0000${normalized}`)
  const localVoteKey = `reader:quote-vote:${quoteHash}`
  try {
    if (window.localStorage.getItem(localVoteKey)) return { quoteHash, count: 0 }
  } catch { /* noop */ }
  const db = await getDb()
  if (!db) return { quoteHash, count: 0 }
  const deviceHash = await stableHash(getAnonymousDeviceId())
  const voteId = await stableHash(`${quoteHash}\u0000${deviceHash}`)
  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  const countRef = doc(db, 'article_quote_counts', quoteHash)
  const voteRef = doc(db, 'article_quote_votes', voteId)
  const count = await runTransaction(db, async (transaction) => {
    const voteSnapshot = await transaction.get(voteRef)
    const countSnapshot = await transaction.get(countRef)
    const previous = countSnapshot.exists() ? Number(countSnapshot.data().count || 0) : 0
    if (voteSnapshot.exists()) return previous
    transaction.set(voteRef, { slug: article.slug, quoteHash, deviceHash, createdAt: serverTimestamp() })
    transaction.set(countRef, {
      slug: article.slug,
      quoteHash,
      quote: normalized,
      paragraph,
      count: previous + 1,
      lastVote: voteId,
      updatedAt: serverTimestamp(),
    })
    return previous + 1
  })
  try { window.localStorage.setItem(localVoteKey, '1') } catch { /* noop */ }
  if (count >= POPULAR_THRESHOLD) {
    const detail: PopularQuote = { slug: article.slug, quoteHash, quote: normalized, paragraph, count }
    window.dispatchEvent(new CustomEvent('reader:popular-quote-updated', { detail }))
  }
  return { quoteHash, count }
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

  const downloadCard = () => {
    if (!cardUrl) return
    const anchor = document.createElement('a')
    anchor.href = cardUrl
    anchor.download = `اقتباس-${current.slug}.png`
    anchor.click()
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
              className="flex items-center gap-1.5 px-4 py-2 text-[.78rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-canvas"
            >
              🧬 عبر السنوات
            </button>
            <span className="my-1.5 w-px bg-hair" aria-hidden="true" />
            <button
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={openCard}
              className="flex items-center gap-1.5 px-4 py-2 text-[.78rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-canvas"
            >
              🖼 بطاقة اقتباس
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && currentSelection && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[320] flex items-end justify-center bg-ink/38 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={closeSheet}>
            <motion.section initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[1.75rem] border border-hair bg-canvas px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_38px_90px_-42px_rgba(21,22,26,.8)] sm:rounded-[1.75rem] sm:p-7" dir="rtl">
              <header className="flex items-start justify-between gap-4">
                <div><p className="text-[.7rem] font-semibold text-accent">{sheet === 'thread' ? 'الفكرة عبر السنوات' : sheet === 'card' ? 'بطاقة الاقتباس' : 'مشاركة الاقتباس'}</p><h2 className="mt-1 font-display text-[1.16rem] font-semibold text-ink">{current.title}</h2></div>
                <button type="button" onClick={closeSheet} aria-label="إغلاق" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-soft">×</button>
              </header>
              <blockquote className="mt-5 rounded-2xl border border-hair bg-wash/45 px-4 py-4 font-display text-[.9rem] font-light leading-[1.9] text-ink">«{currentSelection.text}»</blockquote>

              {sheet === 'card' ? (
                <div className="mt-5">
                  {!cardUrl && <div className="flex aspect-[4/5] items-center justify-center rounded-2xl border border-hair bg-wash text-[.78rem] text-soft">{cardBusy ? 'أصنع البطاقة…' : 'لحظة…'}</div>}
                  {cardUrl && (
                    <>
                      <img src={cardUrl} alt="بطاقة اقتباس" className="mx-auto w-full max-w-[360px] rounded-2xl border border-hair shadow-[0_26px_60px_-36px_rgba(21,22,26,.7)]" />
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={() => void shareCard()} className="rounded-full bg-accent px-5 py-2.5 text-[.76rem] font-semibold text-white">مشاركة البطاقة</button>
                        <button type="button" onClick={downloadCard} className="rounded-full border border-hair px-5 py-2.5 text-[.76rem] font-semibold text-soft hover:border-accent hover:text-accent">حفظ الصورة</button>
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
                        <button type="button" onClick={() => void shareCard()} className="rounded-full bg-accent px-5 py-2.5 text-[.76rem] font-semibold text-white">مشاركة البطاقة</button>
                        <button type="button" onClick={downloadCard} className="rounded-full border border-hair px-5 py-2.5 text-[.76rem] font-semibold text-soft hover:border-accent hover:text-accent">حفظ الصورة</button>
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
                          <span className="mt-1 block text-[.7rem] text-soft">{article.cat}{overlap ? ` · ${overlap.toLocaleString('ar-KW')} صلة مشتركة` : ''}</span>
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
