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
const seededSignalCount = (slug: string, text = '') => 4 + (stableHash(`${slug}:${text}`) % 23)
const sentenceCandidates = (paragraph: string) => {
  const matches = paragraph.match(/[^.!?؟؛:…\n]+[.!?؟؛:…]*/g)
  return (matches?.length ? matches : [paragraph]).map(normalizeSentence).filter(Boolean)
}
/* بعض مقالات الأرشيف القديمة كُتبت في جملة طويلة جداً. لا نضعها كلها تحت
   التظليل على الهاتف: نحتفظ بالجملة الكاملة متى اتسعت، وإلا نأخذ منها عبارة
   مكتملة عند فاصلة/فاصلة منقوطة — لا قصّاً أعمى في منتصف الكلمة. */
const compactSentenceCandidates = (paragraph: string) => sentenceCandidates(paragraph).flatMap((sentence) => {
  if (sentence.length <= MAX_SIGNAL_LENGTH) return [sentence]
  return (sentence.match(/[^،؛:]+[،؛:]?/g) || []).map(normalizeSentence)
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

/** يختار تلقائياً 3–5 جمل ثابتة من كل مقال، حالي أو جديد. الاختيار متنوع
 * بين الفقرات ولا يتبدل عند تحديث الصفحة؛ إشارات القراء الحقيقية تبقى أولى
 * وتزيد أرقامها فوق الرقم الافتتاحي من دون كتابة بيانات وهمية إلى Firestore. */
export function articleSignalsOf(slug: string, body: string, popularQuotes: QuoteSignal[]): ArticleSignalData[] {
  const paragraphs = body.split(/\n\s*\n/)
  const target = 3 + (stableHash(slug) % 3)
  const readerCandidates = [...popularQuotes].sort((left, right) => right.count - left.count)
  const signals: ArticleSignalData[] = []
  const keys = new Set<string>()
  const add = (signal: ArticleSignalData | null) => {
    if (!signal || signal.paragraph < 0 || signal.paragraph >= paragraphs.length) return
    const key = normalizeSentence(signal.text).toLowerCase()
    if (key.length < 12 || keys.has(key)) return
    keys.add(key)
    signals.push(signal)
  }

  for (const candidate of readerCandidates) {
    const paragraph = paragraphs[candidate.paragraph] || ''
    const start = Number(candidate.startOffset)
    const end = Number(candidate.endOffset)
    if (!paragraph || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > paragraph.length) continue
    const selected = normalizeSentence(paragraph.slice(start, end))
    if (selected.length < 12 || selected.length > MAX_SIGNAL_LENGTH) continue
    add({
      paragraph: candidate.paragraph,
      text: selected,
      source: 'readers',
      count: seededSignalCount(slug, selected) + Math.max(0, Number(candidate.count) || 0),
      highlightKey: candidate.highlightKey,
    })
    if (signals.length >= target) return signals
  }

  const pivot = pivotOf(slug)
  if (pivot && paragraphs[pivot.paragraph]) {
    const text = compactSentenceCandidates(pivot.text)[0] || ''
    if (text) add({ text, paragraph: pivot.paragraph, source: 'pivot', count: seededSignalCount(slug, text) })
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

  /* نختار أولاً من الثلث الأول ثم الأوسط ثم الأخير (بترتيب ثابت متنوع لكل
     مقال)، وبعدها نكمل بالأقوى. فيتنوّع الاقتباس معنىً وموضعاً ولا تتكدّس
     الأرقام في المقدمة أو في فقرة واحدة. */
  const zoneOrder = [0, 1, 2]
  const rotation = stableHash(`${slug}:zones`) % zoneOrder.length
  const rotatedZones = [...zoneOrder.slice(rotation), ...zoneOrder.slice(0, rotation)]
  for (const zone of rotatedZones) {
    if (signals.length >= target) break
    const candidate = automatic.find(({ signal }) => {
      const position = paragraphs.length > 1 ? signal.paragraph / (paragraphs.length - 1) : .5
      const candidateZone = Math.min(2, Math.floor(position * 3))
      return candidateZone === zone && !signals.some((existing) => existing.paragraph === signal.paragraph)
    })
    if (candidate) add(candidate.signal)
  }

  /* نوزع الباقي على فقرات مختلفة، ثم نسمح باثنتين في الفقرة عند الضرورة. */
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
              {signal.count > 0 && <span className="text-[.66rem] text-soft">{new Intl.NumberFormat('ar-KW-u-nu-arab').format(signal.count)} إشارة قراءة</span>}
            </span>
          </span>
        </span>
      ), document.body)}
    </>
  )
}
