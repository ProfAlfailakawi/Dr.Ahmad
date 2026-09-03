import { useState } from 'react'
import { renderQuoteCard } from '../lib/quote-card'
import { SocialIcon } from './icons'
import { ClarifiedIconAction } from './ClarifiedIconAction'

/**
 * «بطاقة» — يحوّل مقطعاً من كتبه إلى صورة قابلة للنشر.
 *
 * أرخص توزيعٍ لكتاب: قارئٌ أعجبه سطر فنشره بهويّة الموقع ومنسوباً إلى
 * صفحته. الزر صامت حتى يُطلب — لا معاينة ولا وزن على الصفحة قبل النقر.
 */
export function QuoteImage({ text, attribution }: { text: string; attribution: string }) {
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  const make = async () => {
    setBusy(true)
    setFeedback('')
    try {
      setImage(await renderQuoteCard(text, { attribution }))
    } finally {
      setBusy(false)
    }
  }

  const dataUrlToBlob = (value: string) => {
    const [header, encoded = ''] = value.split(',', 2)
    const mime = /^data:([^;]+)/.exec(header)?.[1] || 'image/png'
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: mime })
  }

  const download = async () => {
    if (!image) return
    const fileName = 'اقتباس.png'
    const blob = dataUrlToBlob(image)
    const file = new File([blob], fileName, { type: 'image/png' })
    const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean; standalone?: boolean }
    const isIos = /iP(?:hone|ad|od)/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || Boolean(shareNavigator.standalone)

    try {
      if ((isIos || isStandalone) && navigator.share && shareNavigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'بطاقة اقتباس' })
        setFeedback('اختر «حفظ الصورة» من نافذة المشاركة.')
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
      setFeedback('بدأ تنزيل الصورة.')
    } catch (reason) {
      if ((reason as DOMException)?.name === 'AbortError') return
      const objectUrl = URL.createObjectURL(blob)
      const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
      if (!opened) URL.revokeObjectURL(objectUrl)
      else window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      setFeedback(opened ? 'فُتحت الصورة؛ احفظها من قائمة المتصفح.' : 'تعذّر فتح الصورة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.')
    }
  }

  if (!image) {
    return (
      <ClarifiedIconAction id="quote-image-card" label="حوّل الاقتباس إلى بطاقة مصوّرة جاهزة للنشر">
        <button
          type="button"
          onClick={make}
          disabled={busy}
          aria-label={busy ? 'جارٍ تجهيز بطاقة النشر' : 'بطاقة للنشر'}
          title={busy ? 'جارٍ تجهيز بطاقة النشر' : 'بطاقة للنشر'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          <SocialIcon name="Image" size={16} />
        </button>
      </ClarifiedIconAction>
    )
  }

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-2">
      <span className="inline-flex flex-wrap items-center gap-2">
        <img decoding="async" src={image} alt="بطاقة الاقتباس" className="h-16 w-16 rounded-xl border border-hair object-cover" />
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void download()}
            aria-label="تنزيل الصورة"
            title="تنزيل الصورة"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/[.35] text-[.82rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
          >
            <SocialIcon name="Download" size={16} />
          </button>
          <button
            type="button"
            onClick={() => { setImage(null); setFeedback('') }}
            aria-label="إغلاق الصورة"
            title="إغلاق الصورة"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hair text-[.88rem] text-soft transition-colors hover:border-accent hover:text-accent"
          >
            <SocialIcon name="Close" size={16} />
          </button>
        </span>
      </span>
      {feedback && <span className="text-[.62rem] leading-relaxed text-soft">{feedback}</span>}
    </span>
  )
}
