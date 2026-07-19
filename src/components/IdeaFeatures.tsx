/* أداة تحديدٍ واحدة أنيقة (أحادية اللون، بلا تلوث بصري): تظهر عند تظليل أي جملةٍ في المقال،
   وتقدّم فعلين متباعدين في شريطٍ واحد لا يتداخلان:
   ١) تتبّع الجملة: كل المقالات التي لامست الفكرة نفسها عبر السنوات.
   ٢) 🖼 بطاقة اقتباس: صورة أنيقة بجملةٍ منتقاة + توقيع الدكتور، للمشاركة الراقية. */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

type Art = { slug: string; title: string; iso: string; cat: string; excerpt?: string; body?: string }

type SavedReaderQuote = {
  id: string
  quote: string
  slug: string
  title: string
  paragraph: number
  savedAt: number
  url: string
  articleVersion?: string
  startOffset?: number
  endOffset?: number
  highlightKey?: string
}

type SelectionOffsets = { startOffset: number; endOffset: number }

const READER_QUOTES_KEY = 'reader:quotes:v2'

function normalizeReaderQuote(quote: string) {
  return quote.replace(/\s+/g, ' ').trim()
}

function readerQuoteId(article: Art, quote: string, paragraph: number) {
  return `${article.slug}:${paragraph}:${normalizeReaderQuote(quote).slice(0, 80)}`
}

function readReaderQuotes(): SavedReaderQuote[] {
  try {
    const raw = window.localStorage.getItem(READER_QUOTES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((entry): entry is SavedReaderQuote => Boolean(entry?.id && entry?.quote)) : []
  } catch {
    return []
  }
}

function writeReaderQuotes(quotes: SavedReaderQuote[]) {
  try {
    window.localStorage.setItem(READER_QUOTES_KEY, JSON.stringify(quotes.slice(0, 300)))
    window.dispatchEvent(new CustomEvent('reader:quotes-changed'))
    return true
  } catch {
    return false
  }
}

function articleContentVersion(body = '') {
  let hash = 2166136261
  for (let index = 0; index < body.length; index++) {
    hash ^= body.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function saveReaderQuote(article: Art, quote: string, paragraph: number, offsets: SelectionOffsets, body: string) {
  const normalized = normalizeReaderQuote(quote)
  if (!normalized) return null
  const existing = readReaderQuotes()
  const id = readerQuoteId(article, normalized, paragraph)
  const item: SavedReaderQuote = {
    id,
    quote: normalized,
    slug: article.slug,
    title: article.title,
    paragraph,
    savedAt: Date.now(),
    url: `${window.location.origin}/articles/${article.slug}`,
    articleVersion: articleContentVersion(body),
    startOffset: offsets.startOffset,
    endOffset: offsets.endOffset,
  }
  return writeReaderQuotes([item, ...existing.filter((entry) => entry?.id !== id)]) ? item : null
}

function removeReaderQuote(article: Art, quote: string, paragraph: number) {
  const id = readerQuoteId(article, quote, paragraph)
  const existing = readReaderQuotes()
  const removed = existing.find((entry) => entry.id === id) || null
  if (!removed) return null
  return writeReaderQuotes(existing.filter((entry) => entry.id !== id)) ? removed : null
}

function isReaderQuoteSaved(article: Art, quote: string, paragraph: number) {
  const id = readerQuoteId(article, quote, paragraph)
  return readReaderQuotes().some((entry) => entry.id === id)
}

/* ── تطبيع عربي بسيط + كلمات دالة تُستبعد ── */
const AR_STOP = new Set(['من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'ما', 'لا', 'هذا', 'هذه', 'التي', 'الذي', 'مع', 'أو', 'ثم', 'قد', 'كل', 'بين', 'هو', 'هي', 'كان', 'كانت', 'لكن', 'حتى', 'إذا', 'عند', 'بعد', 'قبل', 'كما', 'لأن', 'حين', 'كيف', 'لماذا', 'أم', 'بل', 'نحن', 'هم', 'أنت', 'أنا', 'به', 'له', 'لها', 'فيه', 'فيها', 'ذلك', 'تلك', 'أي', 'كذلك', 'أيضا', 'دون', 'غير', 'عبر', 'خلال', 'حول', 'نحو'])
const norm = (s: string) => s.replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
const tokens = (s: string) => norm(s).replace(/[^ء-ي\s]/g, ' ').split(/\s+/)
  .map((w) => w.replace(/^(وال|فال|بال|كال|ال|و|ف|ب|ل|ك)/, '')).filter((w) => w.length >= 4 && !AR_STOP.has(w))

const ar = (n: number) => String(n)

/* ═══════════ استوديو بطاقات الاقتباس — ٦ قوالب × ٣ مقاسات ═══════════
   كل قالب شخصية بصرية كاملة ضمن هوية الموقع (أحادية + اللون المعتمد):
   المداد · الليل · الجريدة · الشريط · اللوح · التوقيع */
export type CardFormatKey = 'square' | 'portrait' | 'story'
export const CARD_FORMATS: { key: CardFormatKey; label: string; w: number; h: number; hint: string }[] = [
  { key: 'square', label: 'مربع', w: 1080, h: 1080, hint: 'X · إنستغرام' },
  { key: 'portrait', label: 'طولي', w: 1080, h: 1350, hint: 'منشور إنستغرام' },
  { key: 'story', label: 'ستوري', w: 1080, h: 1920, hint: 'ستوري · واتساب' },
]

const PALETTE = {
  paper: '#FBFAF7', cream: '#F7F4EC', ink: '#15161A', night: '#0E1013',
  accent: '#3E5C78', accentSoft: '#8AADCC', soft: '#7C818B', line: '#D9D6CE',
}
const SIGNATURE = 'د. أحمد حسين الفيلكاوي'
const DOMAIN = 'dr-alfailakawi.com'

type Ctx = CanvasRenderingContext2D
const wrapLines = (g: Ctx, text: string, maxW: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && g.measureText(candidate).width > maxW) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}
const fitQuote = (g: Ctx, quote: string, maxW: number, maxH: number, base: number) => {
  // لا نقصّ آخر الجملة أبداً؛ نصغّر الخط تدريجياً حتى تظهر كاملة داخل البطاقة.
  for (let size = base; size >= 18; size -= 2) {
    g.font = `300 ${size}px "El Messiri", serif`
    const lines = wrapLines(g, quote, maxW)
    const lh = size * 1.62
    if (lines.length * lh <= maxH) return { size, lines, lh }
  }
  g.font = '300 18px "El Messiri", serif'
  return { size: 18, lines: wrapLines(g, quote, maxW), lh: 29 }
}
const rtl = (g: Ctx) => { g.textAlign = 'right'; g.direction = 'rtl' }
const drawSignature = (g: Ctx, x: number, y: number, ink: string, soft: string, accent: string, center = false) => {
  g.textAlign = center ? 'center' : 'right'
  g.strokeStyle = accent; g.lineWidth = 3; g.beginPath()
  if (center) { g.moveTo(x - 50, y - 58); g.lineTo(x + 50, y - 58) } else { g.moveTo(x, y - 58); g.lineTo(x - 100, y - 58) }
  g.stroke()
  g.font = '700 34px "Tajawal", sans-serif'; g.fillStyle = ink; g.fillText(SIGNATURE, x, y)
  g.font = '400 25px "Tajawal", sans-serif'; g.fillStyle = soft; g.fillText(DOMAIN, x, y + 44)
}
const dotsTexture = (g: Ctx, W: number, H: number, color: string, alpha: number) => {
  g.save(); g.globalAlpha = alpha; g.fillStyle = color
  for (let y = 90; y < H - 60; y += 66) for (let x = 80 + ((y / 66) % 2) * 33; x < W - 60; x += 66) {
    g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill()
  }
  g.restore()
}

export type CardTemplateKey = 'midad' | 'layl' | 'jarida' | 'sharit' | 'lawh' | 'tawqee'
export const CARD_TEMPLATES: { key: CardTemplateKey; label: string; hint: string }[] = [
  { key: 'midad', label: 'المداد', hint: 'الكلاسيكية الأنيقة' },
  { key: 'layl', label: 'الليل', hint: 'فخامة داكنة' },
  { key: 'jarida', label: 'الجريدة', hint: 'روح الصحافة' },
  { key: 'sharit', label: 'الشريط', hint: 'جرأة هادئة' },
  { key: 'lawh', label: 'اللوح', hint: 'بيان قوي' },
  { key: 'tawqee', label: 'التوقيع', hint: 'أقصى البساطة' },
]

export function drawQuoteCard(template: CardTemplateKey, format: CardFormatKey, quote: string, articleTitle = ''): string {
  const fmt = CARD_FORMATS.find((f) => f.key === format) || CARD_FORMATS[0]
  const { w: W, h: H } = fmt
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const P = PALETTE
  const story = format === 'story'
  const pad = story ? 130 : 110

  if (template === 'midad') {
    g.fillStyle = P.paper; g.fillRect(0, 0, W, H)
    const grad = g.createRadialGradient(W * 0.82, H * 0.16, 40, W * 0.82, H * 0.16, W * 0.62)
    grad.addColorStop(0, P.accent + '20'); grad.addColorStop(1, P.accent + '00')
    g.fillStyle = grad; g.fillRect(0, 0, W, H)
    g.strokeStyle = P.accent + '2E'; g.lineWidth = 2; g.strokeRect(56, 56, W - 112, H - 112)
    g.fillStyle = P.accent + '2A'; g.font = '700 210px "El Messiri", serif'; rtl(g)
    g.fillText('\u201D', W - 96, 262)
    const area = fitQuote(g, quote, W - 2 * pad, H * (story ? 0.5 : 0.52), story ? 64 : 62)
    g.font = `300 ${area.size}px "El Messiri", serif`; g.fillStyle = P.ink; rtl(g)
    let y = H / 2 - ((area.lines.length - 1) * area.lh) / 2 - (story ? 60 : 20)
    for (const l of area.lines) { g.fillText(l, W - pad, y); y += area.lh }
    drawSignature(g, W - pad, H - (story ? 220 : 150), P.ink, P.soft, P.accent)
  }

  if (template === 'layl') {
    g.fillStyle = P.night; g.fillRect(0, 0, W, H)
    const grad = g.createRadialGradient(W * 0.2, H * 0.12, 30, W * 0.2, H * 0.12, W * 0.75)
    grad.addColorStop(0, P.accentSoft + '26'); grad.addColorStop(1, P.accentSoft + '00')
    g.fillStyle = grad; g.fillRect(0, 0, W, H)
    dotsTexture(g, W, H, P.accentSoft, 0.10)
    g.strokeStyle = P.accentSoft + '30'; g.lineWidth = 1.5; g.strokeRect(48, 48, W - 96, H - 96)
    g.fillStyle = P.accentSoft + '3D'; g.font = '700 230px "El Messiri", serif'; rtl(g)
    g.fillText('\u201D', W - 92, 276)
    const area = fitQuote(g, quote, W - 2 * pad, H * (story ? 0.5 : 0.5), story ? 66 : 60)
    g.font = `300 ${area.size}px "El Messiri", serif`; g.fillStyle = '#EDEDEA'; rtl(g)
    g.shadowColor = P.accentSoft + '55'; g.shadowBlur = 26
    let y = H / 2 - ((area.lines.length - 1) * area.lh) / 2 - (story ? 60 : 16)
    for (const l of area.lines) { g.fillText(l, W - pad, y); y += area.lh }
    g.shadowBlur = 0
    drawSignature(g, W - pad, H - (story ? 220 : 150), '#EDEDEA', '#9BA1AB', P.accentSoft)
  }

  if (template === 'jarida') {
    g.fillStyle = P.cream; g.fillRect(0, 0, W, H)
    g.strokeStyle = P.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(pad, 118); g.lineTo(W - pad, 118); g.stroke()
    g.lineWidth = 1.4; g.beginPath(); g.moveTo(pad, 132); g.lineTo(W - pad, 132); g.stroke()
    rtl(g); g.font = '700 30px "Tajawal", sans-serif'; g.fillStyle = P.accent
    g.fillText('من مقالات الدكتور أحمد الفيلكاوي', W - pad, 96)
    g.textAlign = 'left'; g.font = '400 26px "Tajawal", sans-serif'; g.fillStyle = P.soft
    g.fillText(new Date().toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' }), pad, 96)
    const area = fitQuote(g, quote, W - 2 * pad - 40, H * (story ? 0.48 : 0.5), story ? 60 : 56)
    g.font = `400 ${area.size}px "El Messiri", serif`; g.fillStyle = P.ink; rtl(g)
    let y = H / 2 - ((area.lines.length - 1) * area.lh) / 2 - (story ? 40 : 0)
    g.fillStyle = P.accent; g.fillRect(W - pad + 26, y - area.size + 12, 4, area.lines.length * area.lh - area.lh + area.size)
    g.fillStyle = P.ink
    for (const l of area.lines) { g.fillText(l, W - pad - 14, y); y += area.lh }
    if (articleTitle) {
      g.font = '500 27px "Tajawal", sans-serif'; g.fillStyle = P.soft
      g.fillText(`— من مقال «${articleTitle.slice(0, 42)}${articleTitle.length > 42 ? '…' : ''}»`, W - pad - 14, y + 16)
    }
    g.strokeStyle = P.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(pad, H - 168); g.lineTo(W - pad, H - 168); g.stroke()
    drawSignature(g, W - pad, H - (story ? 190 : 104), P.ink, P.soft, P.accent)
  }

  if (template === 'sharit') {
    g.fillStyle = P.paper; g.fillRect(0, 0, W, H)
    const band = story ? 120 : 104
    const bg = g.createLinearGradient(W - band, 0, W, 0)
    bg.addColorStop(0, P.accent); bg.addColorStop(1, '#31485E')
    g.fillStyle = bg; g.fillRect(W - band, 0, band, H)
    g.save(); g.translate(W - band / 2 + 12, story ? 210 : 180); g.rotate(Math.PI / 2)
    g.font = '600 30px "Tajawal", sans-serif'; g.fillStyle = '#FFFFFFCC'; g.textAlign = 'left'; g.direction = 'ltr'
    g.fillText(DOMAIN, 0, 0); g.restore()
    g.fillStyle = P.accent + '22'; g.font = '700 300px "El Messiri", serif'; g.textAlign = 'left'
    g.fillText('\u201C', 60, H - 90)
    const qPad = band + 90
    const area = fitQuote(g, quote, W - qPad - pad, H * (story ? 0.52 : 0.55), story ? 64 : 60)
    g.font = `300 ${area.size}px "El Messiri", serif`; g.fillStyle = P.ink; rtl(g)
    let y = H / 2 - ((area.lines.length - 1) * area.lh) / 2 - (story ? 50 : 10)
    for (const l of area.lines) { g.fillText(l, W - qPad, y); y += area.lh }
    drawSignature(g, W - qPad, H - (story ? 210 : 140), P.ink, P.soft, P.accent)
  }

  if (template === 'lawh') {
    const bg = g.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#3E5C78'); bg.addColorStop(1, '#2C4257')
    g.fillStyle = bg; g.fillRect(0, 0, W, H)
    dotsTexture(g, W, H, '#FFFFFF', 0.07)
    g.strokeStyle = '#FFFFFF3A'; g.lineWidth = 2; g.strokeRect(52, 52, W - 104, H - 104)
    g.fillStyle = '#FFFFFF30'; g.font = '700 240px "El Messiri", serif'; rtl(g)
    g.fillText('\u201D', W - 92, 284)
    const area = fitQuote(g, quote, W - 2 * pad, H * (story ? 0.5 : 0.52), story ? 68 : 62)
    g.font = `400 ${area.size}px "El Messiri", serif`; g.fillStyle = '#FDFDFB'; rtl(g)
    let y = H / 2 - ((area.lines.length - 1) * area.lh) / 2 - (story ? 56 : 14)
    for (const l of area.lines) { g.fillText(l, W - pad, y); y += area.lh }
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 3; g.beginPath()
    g.moveTo(W - pad, H - (story ? 278 : 208)); g.lineTo(W - pad - 100, H - (story ? 278 : 208)); g.stroke()
    g.font = '700 34px "Tajawal", sans-serif'; g.fillStyle = '#FFFFFF'; g.fillText(SIGNATURE, W - pad, H - (story ? 220 : 150))
    g.font = '400 25px "Tajawal", sans-serif'; g.fillStyle = '#D7DEE6'; g.fillText(DOMAIN, W - pad, H - (story ? 176 : 106))
  }

  if (template === 'tawqee') {
    g.fillStyle = P.paper; g.fillRect(0, 0, W, H)
    g.fillStyle = P.accent; g.beginPath(); g.arc(W / 2, story ? 300 : 230, 7, 0, 7); g.fill()
    const area = fitQuote(g, quote, W - 2 * (pad + 40), H * 0.42, story ? 58 : 52)
    g.font = `300 ${area.size}px "El Messiri", serif`; g.fillStyle = P.ink
    g.textAlign = 'center'; g.direction = 'rtl'
    let y = H / 2 - ((area.lines.length - 1) * area.lh) / 2 - (story ? 40 : 0)
    for (const l of area.lines) { g.fillText(l, W / 2, y); y += area.lh }
    drawSignature(g, W / 2, H - (story ? 260 : 180), P.ink, P.soft, P.accent, true)
  }

  return c.toDataURL('image/png')
}

function firstStrongSentence(body?: string, excerpt?: string) {
  const src = (body || excerpt || '').replace(/\s+/g, ' ').trim()
  const parts = src.split(/(?<=[.!؟])\s/).filter((s) => s.split(/\s+/).length >= 6)
  return (parts[0] || excerpt || '').slice(0, 220)
}

/* ═══════════ أداة التحديد الموحّدة ═══════════ */
export function SelectionTools({ current, articles, body, excerpt }: { current: Art; articles: Art[]; body?: string; excerpt?: string }) {
  const [sel, setSel] = useState('')
  const [paragraph, setParagraph] = useState(0)
  const [offsets, setOffsets] = useState<SelectionOffsets>({ startOffset: 0, endOffset: 0 })
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarX, setToolbarX] = useState<number | null>(null)
  /* في اللمس تفتح المنظومة قائمتها (نسخ · ترجمة) فوق النص المحدَّد، وهو المكان
     نفسه الذي كان شريطنا يقف فيه — فيُحجب. لا تملك CSS إخفاء تلك القائمة ما دام
     النص قابلاً للتحديد، فالحلّ أن ننزل نحن إلى أسفل الشاشة حيث لا تصلنا. */
  const [toolbarY, setToolbarY] = useState<number | null>(null)
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarse(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  const [view, setView] = useState<null | 'thread' | 'card'>(null)
  const [img, setImg] = useState<string | null>(null)
  const [cardQuote, setCardQuote] = useState('')
  const [template, setTemplate] = useState<CardTemplateKey>('midad')
  const [format, setFormat] = useState<CardFormatKey>('square')
  const [quoteSaved, setQuoteSaved] = useState(false)
  const [downloadFeedback, setDownloadFeedback] = useState('')

  useEffect(() => {
    let timer = 0
    const inspectSelection = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (view) return
        const selection = window.getSelection()
        const text = selection?.toString().replace(/\s+/g, ' ').trim() || ''
        if (!selection || !selection.rangeCount || text.length < 12 || text.length > 800) {
          setPos(null)
          return
        }
        const range = selection.getRangeAt(0)
        const ancestor = range.commonAncestorContainer
        const element = ancestor.nodeType === Node.ELEMENT_NODE
          ? ancestor as Element
          : ancestor.parentElement
        if (!element?.closest('.article-body')) {
          setPos(null)
          return
        }
        const paragraphElement = element.closest<HTMLElement>('[data-reader-paragraph]')
        const paragraphIndex = Number(paragraphElement?.dataset.readerParagraph || 0)
        const paragraphText = paragraphElement?.textContent || ''
        const exactStart = range.startContainer.parentElement?.closest('[data-reader-paragraph]') === paragraphElement && range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startOffset
          : paragraphText.indexOf(text)
        const startOffset = exactStart >= 0 ? exactStart : Math.max(0, paragraphText.indexOf(text))
        const endOffset = range.endContainer.parentElement?.closest('[data-reader-paragraph]') === paragraphElement && range.endContainer.nodeType === Node.TEXT_NODE
          ? Math.max(startOffset, range.endOffset)
          : Math.min(paragraphText.length, startOffset + text.length)
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
        const rect = rects[0] || range.getBoundingClientRect()
        if (!rect || (!rect.width && !rect.height)) return
        const viewport = window.visualViewport
        const viewportLeft = viewport?.offsetLeft || 0
        const viewportWidth = viewport?.width || window.innerWidth
        const rawX = rect.left + rect.width / 2
        const x = Math.min(viewportLeft + viewportWidth - 12, Math.max(viewportLeft + 12, rawX))
        const viewportTop = window.visualViewport?.offsetTop || 0
        const y = Math.max(viewportTop + 74, rect.top - 10)
        setSel(text)
        setParagraph(Number.isInteger(paragraphIndex) ? paragraphIndex : 0)
        setOffsets({ startOffset, endOffset })
        setPos({ x, y })
      }, 90)
    }
    document.addEventListener('selectionchange', inspectSelection)
    document.addEventListener('pointerup', inspectSelection)
    document.addEventListener('touchend', inspectSelection, { passive: true })
    window.addEventListener('scroll', inspectSelection, { passive: true })
    window.addEventListener('resize', inspectSelection)
    window.visualViewport?.addEventListener('scroll', inspectSelection)
    window.visualViewport?.addEventListener('resize', inspectSelection)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('selectionchange', inspectSelection)
      document.removeEventListener('pointerup', inspectSelection)
      document.removeEventListener('touchend', inspectSelection)
      window.removeEventListener('scroll', inspectSelection)
      window.removeEventListener('resize', inspectSelection)
      window.visualViewport?.removeEventListener('scroll', inspectSelection)
      window.visualViewport?.removeEventListener('resize', inspectSelection)
    }
  }, [view])

  // في Safari وPWA قد يكون موضع التحديد عند حافة الشاشة، لذلك نقيس الشريط الحقيقي
  // بعد رسمه ونحصر مركزه داخل الـ visual viewport، بدلاً من تخمين نصف عرضه.
  useLayoutEffect(() => {
    if (!pos || !toolbarRef.current || view) {
      setToolbarX(null)
      setToolbarY(null)
      return
    }
    const fitInsideViewport = () => {
      const toolbar = toolbarRef.current
      if (!toolbar) return
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft || 0
      const viewportWidth = viewport?.width || window.innerWidth
      const measuredWidth = Math.min(toolbar.getBoundingClientRect().width, Math.max(0, viewportWidth - 16))
      const half = measuredWidth / 2
      const minimum = viewportLeft + 8 + half
      const maximum = viewportLeft + viewportWidth - 8 - half
      setToolbarX(maximum >= minimum
        ? Math.min(maximum, Math.max(minimum, pos.x))
        : viewportLeft + viewportWidth / 2)
      if (!coarse) { setToolbarY(null); return }
      /* أسفل الشاشة الحقيقية (لا شاشة الجهاز): تتبع لوحة المفاتيح والتكبير معاً */
      const viewportTop = viewport?.offsetTop || 0
      const viewportHeight = viewport?.height || window.innerHeight
      setToolbarY(viewportTop + viewportHeight - 18)
    }
    fitInsideViewport()
    const frame = window.requestAnimationFrame(fitInsideViewport)
    window.addEventListener('resize', fitInsideViewport)
    window.visualViewport?.addEventListener('resize', fitInsideViewport)
    window.visualViewport?.addEventListener('scroll', fitInsideViewport)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', fitInsideViewport)
      window.visualViewport?.removeEventListener('resize', fitInsideViewport)
      window.visualViewport?.removeEventListener('scroll', fitInsideViewport)
    }
  }, [pos, sel, view, coarse])

  // مطابقة الفكرة المحددة: تبحث في العنوان والمقتطف والنص الكامل، ثم تضمن
  // بديلاً زمنياً من التصنيف نفسه كي لا تتحول الأداة الجميلة إلى لوحة فارغة.
  const seed = new Set(tokens(sel))
  const currentYear = current.iso.slice(0, 4)
  const scored = articles
    .filter((a) => a.slug !== current.slug && a.iso.slice(0, 4) !== currentYear)
    .map((a) => {
      const bag = new Set(tokens(`${a.title} ${a.excerpt || ''} ${(a.body || '').slice(0, 5000)}`))
      let overlap = 0
      for (const t of seed) if (bag.has(t)) overlap++
      const categoryBoost = a.cat === current.cat ? 0.75 : 0
      return { a, overlap, score: overlap + categoryBoost }
    })
  const semantic = scored
    .filter((item) => item.overlap >= 1)
    .sort((x, y) => y.score - x.score || y.a.iso.localeCompare(x.a.iso))
    .slice(0, 6)
  const fallback = scored
    .filter((item) => item.a.cat === current.cat)
    .sort((x, y) => Math.abs(Number(x.a.iso.slice(0, 4)) - Number(currentYear)) - Math.abs(Number(y.a.iso.slice(0, 4)) - Number(currentYear)))
    .slice(0, 6)
  const matches = (semantic.length ? semantic : fallback)
    .sort((x, y) => x.a.iso.localeCompare(y.a.iso))

  const renderCard = async (quote: string, tpl: CardTemplateKey, fmt: CardFormatKey) => {
    try {
      const fonts = (document as unknown as { fonts?: { load?: (f: string) => Promise<unknown>; ready?: Promise<unknown> } }).fonts
      await Promise.all([
        fonts?.load?.('300 60px "El Messiri"'), fonts?.load?.('700 60px "El Messiri"'),
        fonts?.load?.('400 30px "Tajawal"'), fonts?.load?.('700 30px "Tajawal"'),
        fonts?.ready,
      ])
    } catch { /* الخطوط الاحتياطية تفي */ }
    setImg(drawQuoteCard(tpl, fmt, quote, current.title))
  }
  const openCard = async () => {
    const quote = (sel.split(/\s+/).length >= 5 ? sel : firstStrongSentence(body, excerpt)).replace(/\s+/g, ' ').trim()
    setCardQuote(quote)
    setQuoteSaved(isReaderQuoteSaved(current, quote, paragraph))
    setDownloadFeedback('')
    setView('card'); setPos(null)
    /* اقتباس القارئ يُحتسب بمجرّد صنع البطاقة، لا بحفظها في الدفتر وحده: من ظلّل
       جملةً وصنع منها بطاقة فقد اقتبسها فعلاً. عضوية القارئ الواحدة في المعاملة
       تمنع العدّ المكرر، فحفظه لاحقاً في الدفتر لا يزيد الرقم مرة ثانية. */
    if (sel.split(/\s+/).filter(Boolean).length >= 4) {
      window.dispatchEvent(new CustomEvent('reader:quote-saved', {
        detail: {
          slug: current.slug,
          body: body || current.body || '',
          quote,
          paragraph,
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
        },
      }))
    }
    await renderCard(quote, template, format)
  }
  const chooseTemplate = (tpl: CardTemplateKey) => { setTemplate(tpl); void renderCard(cardQuote, tpl, format) }
  const chooseFormat = (fmt: CardFormatKey) => { setFormat(fmt); void renderCard(cardQuote, template, fmt) }
  const close = () => { setView(null); setImg(null); setSel(''); setQuoteSaved(false); setDownloadFeedback(''); setOffsets({ startOffset: 0, endOffset: 0 }) }

  const saveQuote = () => {
    const quote = normalizeReaderQuote(cardQuote || sel)
    if (!quote) return
    if (isReaderQuoteSaved(current, quote, paragraph)) {
      const removed = removeReaderQuote(current, quote, paragraph)
      if (!removed) return
      setQuoteSaved(false)
      window.dispatchEvent(new CustomEvent('reader:quote-removed', {
        detail: {
          slug: current.slug,
          body: body || current.body || '',
          quote,
          paragraph,
          startOffset: removed.startOffset ?? offsets.startOffset,
          endOffset: removed.endOffset ?? offsets.endOffset,
          articleVersion: removed.articleVersion,
          highlightKey: removed.highlightKey,
        },
      }))
      return
    }

    const saved = saveReaderQuote(current, quote, paragraph, offsets, body || current.body || '')
    setQuoteSaved(Boolean(saved))
    if (saved) {
      window.dispatchEvent(new CustomEvent('reader:quote-saved', {
        detail: {
          slug: current.slug,
          body: body || current.body || '',
          quote,
          paragraph,
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
          localQuoteId: saved.id,
          articleVersion: saved.articleVersion,
        },
      }))
    }
  }

  const openReadingNotebook = () => {
    close()
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('reader:open-notebook')), 30)
  }

  // تنفيذ اللمسة عند pointerdown يمنع iOS/PWA من استهلاك أول ضغطة لإزالة تحديد النص.
  // onClick يبقى لتفعيل لوحة المفاتيح وقارئات الشاشة فقط، فلا يتكرر الفعل مرتين.
  const firstPress = (event: ReactPointerEvent<HTMLElement>, action: () => void) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    action()
  }
  const dataUrlToBlob = (value: string) => {
    const [header, encoded = ''] = value.split(',', 2)
    const mime = /^data:([^;]+)/.exec(header)?.[1] || 'image/png'
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: mime })
  }

  const downloadCard = async () => {
    if (!img) return
    const fileName = `اقتباس-${CARD_TEMPLATES.find((item) => item.key === template)?.label}-${CARD_FORMATS.find((item) => item.key === format)?.label}.png`
    const blob = dataUrlToBlob(img)
    const file = new File([blob], fileName, { type: 'image/png' })
    const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
    const isIos = /iP(?:hone|ad|od)/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    try {
      if ((isIos || isStandalone) && navigator.share && shareNavigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'بطاقة اقتباس' })
        setDownloadFeedback('اختر «حفظ الصورة» من نافذة المشاركة.')
        return
      }

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      link.rel = 'noopener'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
      setDownloadFeedback('بدأ تنزيل الصورة.')
    } catch (reason) {
      if ((reason as DOMException)?.name === 'AbortError') return
      const objectUrl = URL.createObjectURL(blob)
      const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
      if (!opened) URL.revokeObjectURL(objectUrl)
      else window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      setDownloadFeedback(opened ? 'فُتحت الصورة؛ احفظها من قائمة المتصفح.' : 'تعذّر فتح الصورة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.')
    }
  }

  return (
    <>
      {/* شريط واحد فوق التحديد — فعلان متباعدان بينهما فاصل، لا تداخل */}
      {/* بوابة إلى <body>: لأحد آباء المقال تحويلٌ (transform)، وأيّ أبٍ محوَّل يجعل
          position:fixed يُقاس منه لا من الشاشة — فينزاح الشريط مئتي بكسل عن مكانه.
          الخروج إلى الجسد يُعيد القياس إلى الشاشة الحقيقية في الجوال والكمبيوتر معاً. */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {pos && !view && sel && (
          <div
            ref={toolbarRef}
            style={{ left: toolbarX ?? pos.x, top: toolbarY ?? pos.y, transform: 'translate3d(-50%,-100%,0)' }}
            className="reader-selection-toolbar fixed z-[260]"
          >
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.94 }}
              transition={{ duration: 0.18 }}
              className="flex items-stretch overflow-hidden rounded-full border border-hair bg-canvas shadow-[0_16px_38px_-16px_rgba(0,0,0,.5)]"
            >
              <button
                type="button"
                onPointerDown={(event) => firstPress(event, () => setView('thread'))}
                onClick={(event) => { if (event.detail === 0) setView('thread') }}
                className="flex items-center gap-1.5 px-4 py-2 text-[.78rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-canvas"
              >
                🧬 عبر السنوات
              </button>
              <span className="my-1.5 w-px bg-hair" />
              <button
                type="button"
                onPointerDown={(event) => firstPress(event, () => { void openCard() })}
                onClick={(event) => { if (event.detail === 0) void openCard() }}
                className="flex items-center gap-1.5 px-4 py-2 text-[.78rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-canvas"
              >
                🖼 بطاقة اقتباس
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body)}

      {/* لوحة تتبّع الجملة */}
      <AnimatePresence>
        {view === 'thread' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="reader-modal-overlay fixed inset-0 z-[300] flex items-end justify-center overflow-y-auto bg-ink/40 px-0 pt-[max(4rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-5" onClick={close}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.28 }} onClick={(e) => e.stopPropagation()}
              className="my-auto max-h-[calc(100dvh-5rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl border border-hair bg-canvas p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl md:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[.74rem] font-semibold uppercase tracking-wide text-accent">تتبّع الجملة</p>
                  <p className="mt-2 break-words border-r-2 border-accent pe-0 ps-4 text-[.95rem] font-light leading-[1.9] text-ink/80">«{sel}»</p>
                </div>
                <button type="button" onClick={close} aria-label="إغلاق" className="shrink-0 text-soft transition-colors hover:text-accent">✕</button>
              </div>
              <div className="mt-6 border-t border-hair pt-6">
                {matches.length ? (
                  <ol className="relative space-y-5 before:absolute before:bottom-2 before:right-[6px] before:top-2 before:w-px before:bg-hair">
                    {matches.map(({ a, overlap }) => (
                      <li key={a.slug} className="relative pe-0 ps-6">
                        <span className="absolute right-0 top-[.4em] h-3 w-3 rounded-full border-2 border-accent bg-canvas" />
                        <span className="text-[.72rem] font-semibold text-accent">{ar(Number(a.iso.slice(0, 4)))}</span>
                        <Link to={`/articles/${a.slug}`} onClick={close} className="mt-0.5 block font-display text-[1.02rem] font-medium leading-[1.6] text-ink transition-colors hover:text-accent">
                          {a.title}
                        </Link>
                        <span className="mt-1 block text-[.72rem] text-soft">{a.cat} · {overlap > 0 ? `${ar(overlap)} ${overlap === 1 ? 'صلة' : 'صلات'} مشتركة` : 'امتداد من المرحلة نفسها'}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[.9rem] font-light leading-relaxed text-soft">لم أعثر على امتداد زمني واضح لهذه الفكرة بعد — وستظهر الصلة هنا تلقائياً كلما اتسع الأرشيف.</p>
                )}
              </div>
              <p className="mt-6 text-[.72rem] leading-relaxed text-soft/80">حدّد أي جملة في المقال لتتبّع فكرتها عبر سنوات الكتابة.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* لوحة بطاقة الاقتباس */}
      <AnimatePresence>
        {view === 'card' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="reader-modal-overlay quote-card-overlay fixed inset-0 z-[300] bg-ink/60 backdrop-blur-sm" onClick={close}
          >
            {/* تمريرٌ واحد داخل البطاقة فقط: تمرير الغلاف كان يدفع الشريط اللاصق خارج أعلى الشاشة */}
            <motion.div
              initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.32 }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} className="quote-card-dialog pb-2"
            >
              <div className="quote-card-controls sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-ink/90 p-2 shadow-lg backdrop-blur">
                {CARD_TEMPLATES.map((t) => (
                  <button key={t.key} type="button" onPointerDown={(event) => firstPress(event, () => chooseTemplate(t.key))} onClick={(event) => { if (event.detail === 0) chooseTemplate(t.key) }} title={t.hint}
                    className={`rounded-full px-3.5 py-1.5 text-[.74rem] font-semibold transition-colors ${template === t.key ? 'bg-canvas text-ink' : 'border border-canvas/35 text-canvas/85 hover:border-canvas'}`}>
                    {t.label}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-canvas/30" />
                {CARD_FORMATS.map((f) => (
                  <button key={f.key} type="button" onPointerDown={(event) => firstPress(event, () => chooseFormat(f.key))} onClick={(event) => { if (event.detail === 0) chooseFormat(f.key) }} title={f.hint}
                    className={`rounded-full px-3 py-1.5 text-[.72rem] font-semibold transition-colors ${format === f.key ? 'bg-canvas text-ink' : 'border border-canvas/35 text-canvas/85 hover:border-canvas'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {img ? (
                <img src={img} alt="بطاقة اقتباس" className={`mx-auto max-w-full rounded-2xl object-contain shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)] ${format === 'story' ? 'max-h-[46dvh] w-auto sm:max-h-[62vh]' : 'max-h-[50dvh] w-auto sm:max-h-[66vh]'}`} />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-2xl border border-hair bg-canvas text-soft">…</div>
              )}
              <div className="mt-4 flex items-center justify-center gap-3">
                {img && (
                  <button
                    type="button"
                    onPointerDown={(event) => firstPress(event, () => { void downloadCard() })}
                    onClick={(event) => { if (event.detail === 0) void downloadCard() }}
                    aria-label="تحميل الصورة"
                    title="تحميل الصورة"
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-canvas transition-colors hover:bg-accent-deep"
                  >
                    <svg aria-hidden width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                  </button>
                )}
                {img && (
                  <button
                    type="button"
                    onPointerDown={(event) => firstPress(event, saveQuote)}
                    onClick={(event) => { if (event.detail === 0) saveQuote() }}
                    aria-label={quoteSaved ? 'إزالة من دفتر القراءة' : 'حفظ في دفتر القراءة'}
                    title={quoteSaved ? 'إزالة من دفتر القراءة' : 'حفظ في دفتر القراءة'}
                    aria-pressed={quoteSaved}
                    className={`flex h-[52px] w-[52px] items-center justify-center rounded-full border transition-colors ${quoteSaved ? 'border-canvas bg-canvas text-ink' : 'border-canvas/60 bg-canvas/10 text-canvas hover:bg-canvas hover:text-ink'}`}
                  >
                    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill={quoteSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.6L6 21Z"/></svg>
                  </button>
                )}
                <button type="button" onPointerDown={(event) => firstPress(event, close)} onClick={(event) => { if (event.detail === 0) close() }} aria-label="إغلاق" title="إغلاق" className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-canvas/50 text-canvas transition-colors hover:border-canvas">
                  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12"/><path d="M18 6 6 18"/></svg>
                </button>
              </div>
              {quoteSaved && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[.72rem] font-semibold text-canvas/80">
                  <span>حُفظت.</span>
                  <button type="button" onPointerDown={(event) => firstPress(event, openReadingNotebook)} onClick={(event) => { if (event.detail === 0) openReadingNotebook() }} className="border-b border-canvas/45 pb-px text-canvas transition-colors hover:border-canvas">فتح دفتر القراءة</button>
                </div>
              )}
              {downloadFeedback && <p className="mt-2 text-center text-[.7rem] font-medium text-canvas/80">{downloadFeedback}</p>}
              <p className="mt-4 text-center text-[.82rem] text-canvas/70">
                {(() => { const f = CARD_FORMATS.find((x) => x.key === format)!; return `${f.w}×${f.h} — ${f.hint}` })()}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
