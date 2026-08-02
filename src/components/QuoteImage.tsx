import { useState } from 'react'
import { renderQuoteCard } from '../lib/quote-card'

/**
 * «بطاقة» — يحوّل مقطعاً من كتبه إلى صورة قابلة للنشر.
 *
 * أرخص توزيعٍ لكتاب: قارئٌ أعجبه سطر فنشره بهويّة الموقع ومنسوباً إلى
 * صفحته. الزر صامت حتى يُطلب — لا معاينة ولا وزن على الصفحة قبل النقر.
 */
export function QuoteImage({ text, attribution }: { text: string; attribution: string }) {
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const make = async () => {
    setBusy(true)
    try {
      setImage(await renderQuoteCard(text, { attribution }))
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (!image) return
    const link = document.createElement('a')
    link.href = image
    link.download = 'اقتباس.png'
    link.click()
  }

  if (!image) {
    return (
      <button
        type="button"
        onClick={make}
        disabled={busy}
        className="text-[.66rem] text-soft underline decoration-hair underline-offset-4 transition-colors hover:text-accent disabled:opacity-60"
      >
        {busy ? 'تُرسم…' : 'بطاقة للنشر'}
      </button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <img src={image} alt="بطاقة الاقتباس" className="h-16 w-16 rounded-lg border border-hair object-cover" />
      <button
        type="button"
        onClick={download}
        className="rounded-full border border-accent/[.35] px-3 py-1 text-[.64rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        نزّل الصورة
      </button>
      <button
        type="button"
        onClick={() => setImage(null)}
        className="text-[.64rem] text-soft transition-colors hover:text-accent"
      >
        إغلاق
      </button>
    </span>
  )
}
