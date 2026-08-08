import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import rawPivots from '../data/article-pivots.json' with { type: 'json' }
import { copyText } from '../lib/clipboard'
import { QuoteImage } from './QuoteImage'
import { SocialIcon } from './icons'

/**
 * إشارة المقال — علامة واحدة موحّدة في الهامش.
 *
 * لا يوجد بعد الآن «نبض مقال» مستقل ولا علامتان متجاورتان. الإشارة تختار
 * أقوى جملة متاحة بهذا الترتيب: ما توقّف عنده القرّاء، ثم لحظة الانعطاف
 * المحرّرة، ثم جملة محورية مشتقة من متن المقال نفسه. وهكذا تظهر في كل مقال
 * كامل من دون بطاقة دائمة أو سطر إضافي أو صياغة خارج كلام الكاتب.
 */

type Pivot = { text: string; paragraph: number; marks?: string[] }
type QuoteSignal = { paragraph: number; startOffset: number; endOffset: number; count: number; highlightKey?: string }
export type ArticleSignalSource = 'readers' | 'pivot' | 'text'
export type ArticleSignalData = {
  text: string
  paragraph: number
  source: ArticleSignalSource
  count: number
  highlightKey?: string
}

const PIVOTS = (rawPivots as { pivots?: Record<string, Pivot> }).pivots || {}
export const pivotOf = (slug: string): Pivot | null => PIVOTS[slug] || null

const normalizeSentence = (value = '') => value.replace(/\s+/g, ' ').trim()
const MIN_SIGNAL_LENGTH = 34
const MAX_SIGNAL_LENGTH = 145
const MIN_SEEDED_SIGNAL_COUNT = 7
const SEEDED_SIGNAL_SPAN = 32
/* رقم افتتاحي ثابت لكل مقالة: يبدو متنوعاً بين المقالات لكنه لا يتبدّل مع كل
   إعادة تحميل. وعندما تصل إشارات القراء الحية يحل عدّاد Firestore الحقيقي
   مكانه فوراً. */
const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
const seededSignalCount = (slug: string, text = '') => MIN_SEEDED_SIGNAL_COUNT + (stableHash(`${slug}:${text}`) % SEEDED_SIGNAL_SPAN)
const zoneForSignal = (signal: Pick<ArticleSignalData, 'paragraph' | 'text'>, paragraphs: string[]) => {
  const lengths = paragraphs.map((paragraph) => normalizeSentence(paragraph).length + 2)
  const totalLength = lengths.reduce((sum, length) => sum + length, 0)
  if (totalLength <= 1) return 1
  const paragraphText = normalizeSentence(paragraphs[signal.paragraph] || '')
  const selectedText = normalizeSentence(signal.text)
  const exactOffset = paragraphText.indexOf(selectedText)
  const localOffset = exactOffset >= 0 ? exactOffset : Math.max(0, (paragraphText.length - selectedText.length) / 2)
  const articleOffset = lengths.slice(0, signal.paragraph).reduce((sum, length) => sum + length, 0) + localOffset
  return Math.min(2, Math.floor((articleOffset / Math.max(1, totalLength - 1)) * 3))
}
const sentenceCandidates = (paragraph: string) => {
  const matches = paragraph.match(/[^.!?؟؛:…\n]+[.!?؟؛:…]*/g)
  return (matches?.length ? matches : [paragraph]).map(normalizeSentence).filter(Boolean)
}
/* بعض مقالات الأرشيف القديمة كُتبت في جملة طويلة جداً. لا نضعها كلها تحت
   التظليل على الهاتف: نحتفظ بالجملة الكاملة متى اتسعت، وإلا نأخذ منها عبارة
   مكتملة عند فاصلة/فاصلة منقوطة — لا قصّاً أعمى في منتصف الكلمة. */
const compactSentenceCandidates = (paragraph: string) => sentenceCandidates(paragraph).flatMap((sentence) => {
  if (sentence.length <= MAX_SIGNAL_LENGTH) return [sentence]
  const clauses = (sentence.match(/[^،؛:]+[،؛:]?/g) || []).map(normalizeSentence).filter(Boolean)
  const compact: string[] = []
  /* الجملة العربية الطويلة قد تتكون من مقاطع قصيرة يفشل كلٌّ منها وحده في
     الحد الأدنى. نضم مقطعين أو أكثر حتى نحصل على عبارة مكتملة قصيرة، بدل
     إسقاط الفقرة كلها والاعتماد مؤقتاً على إشارات Firestore وحدها. */
  for (let start = 0; start < clauses.length; start += 1) {
    let combined = ''
    for (let end = start; end < clauses.length; end += 1) {
      const next = normalizeSentence([combined, clauses[end]].filter(Boolean).join(' '))
      if (next.length > MAX_SIGNAL_LENGTH) break
      combined = next
      if (combined.length >= MIN_SIGNAL_LENGTH) { compact.push(combined); break }
    }
  }
  if (compact.length) return compact
  const words = sentence.split(/\s+/).filter(Boolean)
  for (let start = 0; start < words.length; start += 16) {
    const part = normalizeSentence(words.slice(start, start + 24).join(' '))
    if (part.length >= MIN_SIGNAL_LENGTH) compact.push(part.slice(0, MAX_SIGNAL_LENGTH).trim())
    if (start + 24 >= words.length) break
  }
  return compact
}).filter((sentence) => sentence.length >= MIN_SIGNAL_LENGTH && sentence.length <= MAX_SIGNAL_LENGTH)

function fallbackSignal(body: string, count: number): ArticleSignalData | null {
  const paragraphs = body.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean)
  if (!paragraphs.length) return null

  const markers = ['لكن', 'بل ', 'ليس', 'المشكلة', 'السؤال', 'لذلك', 'ومن هنا', 'حين', 'عندما', 'إن ', 'أن ', 'التعليم', 'الإنسان', 'المعلم', 'المتعلم', 'المجتمع', 'التكنولوجيا']
  let best: { text: string; paragraph: number; score: number } | null = null

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex]
    for (const text of compactSentenceCandidates(paragraph)) {
      if (text.length < 38 || /https?:\/\//i.test(text)) continue
      const position = paragraphs.length > 1 ? paragraphIndex / (paragraphs.length - 1) : 0.5
      const middleWeight = position >= 0.16 && position <= 0.82 ? 5 : 0
      const markerWeight = markers.reduce((score, marker) => score + (text.includes(marker) ? 2 : 0), 0)
      const punctuationWeight = /[؟؛:]/.test(text) ? 1 : 0
      const lengthWeight = text.length >= 65 && text.length <= 165 ? 4 : 1
      const numericPenalty = (text.match(/\d/g)?.length || 0) > 5 ? 4 : 0
      const score = middleWeight + markerWeight + punctuationWeight + lengthWeight - numericPenalty
      if (!best || score > best.score) best = { text, paragraph: paragraphIndex, score }
    }
  }

  if (!best) {
    const paragraph = paragraphs.findIndex((text) => text.length >= 30)
    if (paragraph < 0) return null
    const compact = compactSentenceCandidates(paragraphs[paragraph])[0]
    if (!compact) return null
    return { text: compact, paragraph, source: 'text', count }
  }
  return { text: best.text, paragraph: best.paragraph, source: 'text', count }
}

export function articleSignalOf(slug: string, body: string, popularQuotes: QuoteSignal[]): ArticleSignalData | null {
  return articleSignalsOf(slug, body, popularQuotes)[0] || null
}

/** يختار تلقائياً 3 جمل ثابتة من المقال العادي، و3–4 في الطويل فقط. الاختيار متنوع
 * بين الفقرات ولا يتبدل عند تحديث الصفحة؛ إشارات القراء الحقيقية تبقى أولى
 * وتزيد أرقامها فوق الرقم الافتتاحي من دون كتابة بيانات وهمية إلى Firestore. */
export function articleSignalsOf(slug: string, body: string, popularQuotes: QuoteSignal[]): ArticleSignalData[] {
  const paragraphs = body.split(/\n\s*\n/)
  const meaningfulParagraphs = paragraphs.filter((paragraph) => normalizeSentence(paragraph).length >= MIN_SIGNAL_LENGTH).length
  const target = 3 + (meaningfulParagraphs >= 12 ? stableHash(`${slug}:density`) % 2 : 0)
  /* إشارتان حيّتان كحد أقصى، ثم جملة تحريرية ذكية على الأقل. هذا يحفظ أثر
     القرّاء من دون أن تتحول المقالة إلى خريطة تظليل مزدحمة أو تختفي الخطة
     خلف ثلاث تحديدات قديمة متقاربة. */
  const readerCandidates = [...popularQuotes].sort((left, right) => right.count - left.count).slice(0, 2)
  const signals: ArticleSignalData[] = []
  const keys = new Set<string>()
  const usedCounts = new Set<number>()
  const occupiedZones = new Set<number>()
  const add = (signal: ArticleSignalData | null) => {
    if (!signal || signal.paragraph < 0 || signal.paragraph >= paragraphs.length) return false
    const key = normalizeSentence(signal.text).toLowerCase()
    if (key.length < 12 || keys.has(key)) return false
    const paragraphText = normalizeSentence(paragraphs[signal.paragraph]).toLowerCase()
    const localStart = paragraphText.indexOf(key)
    if (localStart < 0) return false
    const localEnd = localStart + key.length
    /* لا نختار عبارتين متداخلتين من الفقرة نفسها. كان هذا يحدث أحياناً
       عندما تصل اقتباسات Firestore الحية: الخطة تحسب ثلاث إشارات لكن طبقة
       العرض تدمج المتداخلتين، فيبقى رقمان فقط. */
    const overlapsExisting = signals.some((existing) => {
      if (existing.paragraph !== signal.paragraph) return false
      const existingKey = normalizeSentence(existing.text).toLowerCase()
      const existingStart = paragraphText.indexOf(existingKey)
      if (existingStart < 0) return false
      const existingEnd = existingStart + existingKey.length
      return Math.max(localStart, existingStart) < Math.min(localEnd, existingEnd)
    })
    if (overlapsExisting) return false
    let uniqueCount = Math.max(1, Math.round(Number(signal.count) || 1))
    while (usedCounts.has(uniqueCount)) uniqueCount += 1
    keys.add(key)
    usedCounts.add(uniqueCount)
    signals.push(uniqueCount === signal.count ? signal : { ...signal, count: uniqueCount })
    occupiedZones.add(zoneForSignal(signal, paragraphs))
    return true
  }

  const readerSignals: ArticleSignalData[] = []
  for (const candidate of readerCandidates) {
    const paragraph = paragraphs[candidate.paragraph] || ''
    const start = Number(candidate.startOffset)
    const end = Number(candidate.endOffset)
    if (!paragraph || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > paragraph.length) continue
    const selected = normalizeSentence(paragraph.slice(start, end))
    if (selected.length < 12 || selected.length > MAX_SIGNAL_LENGTH) continue
    readerSignals.push({
      paragraph: candidate.paragraph,
      text: selected,
      source: 'readers',
      count: seededSignalCount(slug, selected) + Math.max(0, Number(candidate.count) || 0),
      highlightKey: candidate.highlightKey,
    })
  }

  const pivot = pivotOf(slug)
  let pivotSignal: ArticleSignalData | null = null
  if (pivot && paragraphs[pivot.paragraph]) {
    const text = compactSentenceCandidates(pivot.text)[0] || ''
    if (text) pivotSignal = { text, paragraph: pivot.paragraph, source: 'pivot', count: seededSignalCount(slug, text) }
  }

  const automatic: { signal: ArticleSignalData; score: number }[] = []
  for (let paragraph = 0; paragraph < paragraphs.length; paragraph += 1) {
    const position = paragraphs.length > 1 ? paragraph / (paragraphs.length - 1) : .5
    for (const text of compactSentenceCandidates(paragraphs[paragraph])) {
      if (/https?:\/\//i.test(text)) continue
      const markerWeight = ['لكن', 'بل ', 'ليس', 'المشكلة', 'السؤال', 'لذلك', 'ومن هنا', 'حين', 'عندما', 'الإنسان', 'التعليم']
        .reduce((score, marker) => score + (text.includes(marker) ? 2 : 0), 0)
      const middleWeight = position >= .12 && position <= .88 ? 5 : 0
      const lengthWeight = text.length >= 58 && text.length <= 170 ? 4 : 1
      const variety = stableHash(`${slug}:${paragraph}:${text}`) % 7
      automatic.push({
        signal: { text, paragraph, source: 'text', count: seededSignalCount(slug, text) },
        score: markerWeight + middleWeight + lengthWeight + variety,
      })
    }
  }
  automatic.sort((left, right) => right.score - left.score || left.signal.paragraph - right.signal.paragraph)

  /* نغطي أولاً الثلث الأول والأوسط والأخير بترتيب ثابت مختلف لكل مقال.
     داخل كل ثلث نقدّم اختيار القراء الحقيقي، ثم الانعطافة المحررة، ثم أقوى
     جملة آلية. هكذا يصبح التنوع مضموناً لا احتمالياً، ولا تبدأ العلامة دائماً
     من أعلى المقال. */
  const zoneOrder = [0, 1, 2]
  const rotation = stableHash(`${slug}:zones`) % zoneOrder.length
  const rotatedZones = [...zoneOrder.slice(rotation), ...zoneOrder.slice(0, rotation)]
  for (const zone of rotatedZones) {
    if (signals.length >= target) break
    if (occupiedZones.has(zone)) continue
    const zoneCandidates = [
      ...readerSignals.filter((signal) => zoneForSignal(signal, paragraphs) === zone),
      ...(pivotSignal && zoneForSignal(pivotSignal, paragraphs) === zone ? [pivotSignal] : []),
      ...automatic
        .filter(({ signal }) => zoneForSignal(signal, paragraphs) === zone)
        .map(({ signal }) => signal),
    ]
    for (const candidate of zoneCandidates) {
      if (add(candidate)) break
    }
  }

  /* بعد ضمان التوزيع المكاني، نحفظ أولوية تفاعل القراء والانعطافة المحررة،
     ثم نكمل بالأقوى على فقرات مختلفة قبل السماح بالتكرار عند الضرورة. */
  for (const candidate of readerSignals) {
    if (signals.length >= target) break
    add(candidate)
  }
  if (signals.length < target) add(pivotSignal)
  for (const distinctPass of [true, false]) {
    for (const candidate of automatic) {
      if (signals.length >= target) break
      if (distinctPass && signals.some((signal) => signal.paragraph === candidate.signal.paragraph)) continue
      add(candidate.signal)
    }
  }

  if (!signals.length) add(fallbackSignal(body, seededSignalCount(slug, body.slice(0, 120))))
  return signals
}

const sourceNote: Record<ArticleSignalSource, string> = {
  readers: 'جملة توقّف عندها قرّاء المقال أكثر من غيرها.',
  pivot: 'الجملة التي ينعطف عندها مسار الفكرة.',
  text: 'مفتاح هادئ يساعد على قراءة الفكرة المركزية.',
}

export function ArticleSignal({ signal, title }: { signal: ArticleSignalData; title: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const copy = async () => {
    try {
      await copyText(`«${signal.text}»\n— د. أحمد حسين الفيلكاوي`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch { /* الحافظة قد تكون محجوبة؛ لا نزعج القارئ. */ }
  }

  return (
    <>
      <span className="article-pull-quote article-pull-quote--marker-only" aria-label="إشارة المقال">
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); setOpen(true) }}
          aria-label="فتح إشارة المقال"
          title="إشارة المقال"
          className="article-signal-mark article-pull-quote__action"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 2v5a2 2 0 0 0 2 2h6" />
            <path d="M7.5 6.5 10 9l-2.5 2.5" />
          </svg>
        </button>
      </span>

      {open && createPortal((
        <span role="presentation" onClick={() => setOpen(false)} className="fixed inset-0 z-[560] flex items-end justify-center bg-ink/25 px-5 pb-6 backdrop-blur-[2px] sm:items-center sm:pb-0">
          <span role="dialog" aria-modal="true" aria-label="إشارة المقال" onClick={(event) => event.stopPropagation()} className="block w-full max-w-xl rounded-2xl border border-hair bg-canvas p-6 shadow-[0_18px_50px_rgba(20,31,45,.14)] md:p-7">
            <span className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-[.68rem] font-semibold text-accent">إشارة المقال</span>
                <span className="mt-1 block text-[.66rem] leading-relaxed text-soft">{sourceNote[signal.source]}</span>
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" title="إغلاق" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:text-accent"><SocialIcon name="Close" size={13} /></button>
            </span>

            <blockquote className="mt-4 border-r-2 border-accent/40 pr-4 font-display text-[1.05rem] font-light leading-[1.95] text-ink md:text-[1.15rem]">{signal.text}</blockquote>

            <span className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4">
              <span className="flex items-center gap-3">
                <button type="button" onClick={copy} aria-label={copied ? 'نُسخ الاقتباس' : 'نسخ الاقتباس'} title={copied ? 'نُسخ الاقتباس' : 'نسخ الاقتباس'} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${copied ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}><SocialIcon name={copied ? 'Check' : 'Copy'} size={15} /></button>
                <QuoteImage text={signal.text} attribution={title} />
              </span>
              {signal.count > 0 && <span className="text-[.66rem] text-soft">{new Intl.NumberFormat('ar-KW-u-nu-latn').format(signal.count)} إشارة قراءة</span>}
            </span>
          </span>
        </span>
      ), document.body)}
    </>
  )
}
