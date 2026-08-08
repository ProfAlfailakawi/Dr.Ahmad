import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import rawPivots from '../data/article-pivots.json' with { type: 'json' }
import { copyText } from '../lib/clipboard'
import { QuoteImage } from './QuoteImage'
import { SocialIcon } from './icons'
import { ClarifiedIconAction } from './ClarifiedIconAction'

/**
 * إشارة المقال — علامة واحدة موحّدة في الهامش.
 *
 * لا يوجد بعد الآن «نبض مقال» مستقل ولا علامتان متجاورتان. الإشارة تختار
 * أقوى جملة متاحة بهذا الترتيب: ما توقّف عنده القرّاء، ثم لحظة الانعطاف
 * المحرّرة، ثم جملة محورية مشتقة من متن المقال نفسه. وهكذا تظهر في كل مقال
 * كامل من دون بطاقة دائمة أو سطر إضافي أو صياغة خارج كلام الكاتب.
 */

type Pivot = { text: string; paragraph: number; marks?: string[] }
type QuoteSignal = { paragraph: number; startOffset: number; endOffset: number; count: number }
export type ArticleSignalSource = 'readers' | 'pivot' | 'text'
export type ArticleSignalData = {
  text: string
  paragraph: number
  source: ArticleSignalSource
  count: number
}

const PIVOTS = (rawPivots as { pivots?: Record<string, Pivot> }).pivots || {}
export const pivotOf = (slug: string): Pivot | null => PIVOTS[slug] || null

const normalizeSentence = (value = '') => value.replace(/\s+/g, ' ').trim()
const sentenceCandidates = (paragraph: string) => {
  const matches = paragraph.match(/[^.!?؟؛:\n]+[.!?؟؛:]*/g)
  return (matches?.length ? matches : [paragraph]).map(normalizeSentence).filter(Boolean)
}

function fallbackSignal(body: string): ArticleSignalData | null {
  const paragraphs = body.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean)
  if (!paragraphs.length) return null

  const markers = ['لكن', 'بل ', 'ليس', 'المشكلة', 'السؤال', 'لذلك', 'ومن هنا', 'حين', 'عندما', 'إن ', 'أن ', 'التعليم', 'الإنسان', 'المعلم', 'المتعلم', 'المجتمع', 'التكنولوجيا']
  let best: { text: string; paragraph: number; score: number } | null = null

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex]
    for (const text of sentenceCandidates(paragraph)) {
      if (text.length < 38 || text.length > 210 || /https?:\/\//i.test(text)) continue
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
    return { text: normalizeSentence(paragraphs[paragraph]).slice(0, 210), paragraph, source: 'text', count: 0 }
  }
  return { text: best.text, paragraph: best.paragraph, source: 'text', count: 0 }
}

export function articleSignalOf(slug: string, body: string, popularQuotes: QuoteSignal[]): ArticleSignalData | null {
  const paragraphs = body.split(/\n\s*\n/)
  const readerCandidates = [...popularQuotes].sort((left, right) => right.count - left.count)

  for (const candidate of readerCandidates) {
    const paragraph = paragraphs[candidate.paragraph] || ''
    const start = Number(candidate.startOffset)
    const end = Number(candidate.endOffset)
    if (!paragraph || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > paragraph.length) continue
    const selected = normalizeSentence(paragraph.slice(start, end))
    if (selected.length < 12) continue
    return {
      paragraph: candidate.paragraph,
      text: selected.length > 210 ? `${selected.slice(0, 207).trim()}…` : selected,
      source: 'readers',
      count: Math.max(0, Number(candidate.count) || 0),
    }
  }

  const pivot = pivotOf(slug)
  if (pivot && paragraphs[pivot.paragraph]) {
    return { text: normalizeSentence(pivot.text), paragraph: pivot.paragraph, source: 'pivot', count: 0 }
  }

  return fallbackSignal(body)
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
      <aside className={`article-pull-quote${signal.source === 'readers' ? ' is-readers' : ''}`} aria-label="اقتباس محوري من المقال">
        <blockquote>{signal.text}</blockquote>
        <ClarifiedIconAction id="article-signal" label="إشارة المقال: جملة محورية أو موضع لفت انتباه القرّاء">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setOpen(true) }}
            aria-label="خيارات الاقتباس"
            title="خيارات الاقتباس"
            className="article-pull-quote__action"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 2v5a2 2 0 0 0 2 2h6" />
              <path d="M7.5 6.5 10 9l-2.5 2.5" />
            </svg>
          </button>
        </ClarifiedIconAction>
      </aside>

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
              {signal.source === 'readers' && signal.count > 0 && <span className="text-[.66rem] text-soft">{new Intl.NumberFormat('ar-KW-u-nu-arab').format(signal.count)} إشارة قراءة</span>}
            </span>
          </span>
        </span>
      ), document.body)}
    </>
  )
}
