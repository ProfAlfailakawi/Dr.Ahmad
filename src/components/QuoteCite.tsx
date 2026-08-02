import { useEffect, useRef, useState } from 'react'
import type { BookRecord } from '../lib/cms'
import { copyText } from '../lib/clipboard'
import { site } from '../data'

/**
 * بطاقة الاستشهاد الأكاديمي لمقطعٍ من كتاب.
 *
 * الفكرة العملية: طالب الماجستير الذي يجد اقتباساً **جاهز الاستشهاد** يضعه
 * في رسالته. أما الذي عليه أن يبحث عن الناشر والطبعة وسنة النشر فيتركه
 * ويقتبس من غيره. فالزر هنا ليس زينة — هو الباب الذي تدخل منه كتب الدكتور
 * إلى المراجع العربية.
 *
 * الصيغتان مبنيتان من بيانات الكتاب الحقيقية (السنة، الطبعة، الناشر، ردمك)،
 * ولا يُخترع منها شيء: ما ينقص يُحذف من الصيغة بدل أن يُملأ بالتخمين.
 */

const AUTHOR_APA = 'الفيلكاوي، أحمد حسين'
const AUTHOR_MLA = 'الفيلكاوي، أحمد حسين'

/** «د. عبدالعزيز دخيل العنزي» ← «العنزي، عبدالعزيز دخيل» */
function flipName(value: string) {
  const clean = value.replace(/^(?:د\.|أ\.د\.|الدكتور)\s*/u, '').trim()
  const parts = clean.split(/\s+/)
  if (parts.length < 2) return clean
  const family = parts[parts.length - 1]
  return `${family}، ${parts.slice(0, -1).join(' ')}`
}

function authorsOf(book: BookRecord, style: 'apa' | 'mla') {
  const base = style === 'apa' ? AUTHOR_APA : AUTHOR_MLA
  const co = (book as { coAuthors?: string }).coAuthors?.trim()
  if (!co) return base
  const others = co.split(/[،,]|\sو\s/u).map((item) => item.trim()).filter(Boolean).map(flipName)
  return others.length ? `${base}، و${others.join('، و')}` : base
}

export function QuoteCite({ book, page, compact = true }: { book: BookRecord; page: number; compact?: boolean }) {
  const [status, setStatus] = useState<'apa' | 'mla' | 'error' | null>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const meta = book as BookRecord & { year?: string; edition?: string; publisher?: string }
  const year = meta.year?.trim() || 'د.ت.'
  const url = `${site.url}/publications/${book.slug}`

  /* ما لا نعرفه لا نكتبه: الطبعة والناشر والردمك تُحذف إن غابت. */
  const apaTail = [meta.edition?.trim(), meta.publisher?.trim()].filter(Boolean).join('. ')
  const citations = {
    apa: `${authorsOf(book, 'apa')}. (${year}). ${book.title}${apaTail ? ` (${apaTail})` : ''}. ص ${page}. ${url}`,
    mla: `${authorsOf(book, 'mla')}. ${book.title}${meta.publisher?.trim() ? `. ${meta.publisher.trim()}` : ''}، ${year}، ص ${page}.${book.isbn ? ` ردمك ${book.isbn}.` : ''}`,
  }

  const copy = async (style: 'apa' | 'mla') => {
    try {
      await copyText(citations[style])
      setStatus(style)
    } catch {
      setStatus('error')
    }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus(null), 2400)
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[.66rem] text-soft underline decoration-hair underline-offset-4 transition-colors hover:text-accent"
      >
        استشهد بهذا
      </button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {(['apa', 'mla'] as const).map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => copy(style)}
          className="rounded-full border border-hair px-3 py-1 text-[.64rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          {status === style ? 'نُسخ ✓' : style.toUpperCase()}
        </button>
      ))}
      <span aria-live="polite" className="text-[.62rem] text-soft">
        {status === 'error' ? 'تعذّر النسخ؛ أعد المحاولة.' : status ? 'جاهز للّصق في بحثك.' : 'صيغة الاستشهاد'}
      </span>
    </span>
  )
}
