import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import rawPivots from '../data/article-pivots.json' with { type: 'json' }
import { copyText } from '../lib/clipboard'
import { QuoteImage } from './QuoteImage'
import { SocialIcon } from './icons'

/**
 * لحظة الانعطاف — علامةٌ في الهامش، لا سطرٌ جديد ولا كرتٌ ظاهر.
 *
 * الشرط الجمالي الذي وضعه الدكتور: **لا كرت إضافي ولا سطر إضافي**. جرّبتُ
 * العلامة داخل تدفّق النصّ فأزاحت الفقرة ٣٤ بكسل، فنُقلت إلى هامش الفقرة
 * بموضعٍ مطلق: خارج التدفّق تماماً — صفر إزاحة، مقيسة. من لا يريدها لا
 * يكاد يراها؛ ومن نقر عليها فُتح له الكرت.
 *
 * والجملة المعروضة **جملته حرفياً** — تُستخرج آلياً ولا تُصاغ.
 */

type Pivot = { text: string; paragraph: number; marks?: string[] }
const PIVOTS = (rawPivots as { pivots?: Record<string, Pivot> }).pivots || {}

export const pivotOf = (slug: string): Pivot | null => PIVOTS[slug] || null

export function ArticlePivot({ slug, title }: { slug: string; title: string }) {
  const pivot = pivotOf(slug)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!pivot) return null

  const copy = async () => {
    try {
      await copyText(`«${pivot.text}»\n— د. أحمد حسين الفيلكاوي`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch { /* الحافظة ممنوعة أحياناً؛ لا نزعج القارئ برسالة خطأ. */ }
  }

  return (
    <>
      {/* العلامة: ٩ بكسل في هامش الفقرة، شفافةٌ حتى يقترب المؤشر منها. */}
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); setOpen(true) }}
        aria-label="لحظة الانعطاف في هذا المقال"
        title="لحظة الانعطاف"
        className="pivot-mark"
      >
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 2v5a2 2 0 0 0 2 2h6" />
          <path d="M7.5 6.5 10 9l-2.5 2.5" />
        </svg>
      </button>

      {/* الكرت يُرسم في جذر الصفحة لا داخل الفقرة: أيُّ أبٍ ذي transform أو
          filter يصنع سياق تكديسٍ يحبس الطبقة مهما رفعناها — وهذا ما جعل
          أزرار الموقع العائمة (٢١٠) تعلو كرتاً طبقته ٥٦٠. */}
      {open && createPortal((
        <span
          role="presentation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[560] flex items-end justify-center bg-ink/25 px-5 pb-6 backdrop-blur-[2px] sm:items-center sm:pb-0"
        >
          <span
            role="dialog"
            aria-modal="true"
            aria-label="لحظة الانعطاف"
            onClick={(event) => event.stopPropagation()}
            className="block w-full max-w-xl rounded-2xl border border-hair bg-canvas p-6 shadow-[0_18px_50px_rgba(20,31,45,.14)] md:p-7"
          >
            <span className="flex items-start justify-between gap-4">
              <span className="text-[.68rem] font-semibold text-accent">لحظة الانعطاف</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" title="إغلاق" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:text-accent"><SocialIcon name="Close" size={13} /></button>
            </span>

            <blockquote className="mt-3 border-r-2 border-accent/40 pr-4 font-display text-[1.05rem] font-light leading-[1.95] text-ink md:text-[1.15rem]">
              {pivot.text}
            </blockquote>

            <span className="mt-4 block border-t border-hair pt-4">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[.7rem]">
                <button
                  type="button"
                  onClick={copy}
                  aria-label={copied ? 'نُسخ الاقتباس' : 'نسخ الاقتباس'}
                  title={copied ? 'نُسخ الاقتباس' : 'نسخ الاقتباس'}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${copied ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
                >
                  <SocialIcon name={copied ? 'Check' : 'Copy'} size={15} />
                </button>
                <QuoteImage text={pivot.text} attribution={title} />
              </span>
            </span>
          </span>
        </span>
      ), document.body)}
    </>
  )
}
