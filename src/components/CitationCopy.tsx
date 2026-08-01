import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { site } from '../data'

type CitationStyle = 'apa' | 'mla'

type CitationCopyProps = {
  title: string
  path: string
  iso?: string
  date?: string
  source?: string
  url?: string
}

const AUTHOR = 'الفيلكاوي، أحمد حسين'
const OFFICIAL_SITE = 'الموقع الرسمي لد. أحمد حسين الفيلكاوي'

const publisherByHost: Record<string, string> = {
  'aljarida.com': 'جريدة الجريدة',
  'www.aljarida.com': 'جريدة الجريدة',
  'alqabas.com': 'جريدة القبس',
  'www.alqabas.com': 'جريدة القبس',
  'ideas.repec.org': 'RePEc',
  'dr-alfailakawi.com': OFFICIAL_SITE,
  'www.dr-alfailakawi.com': OFFICIAL_SITE,
}

function sourceName(value?: string) {
  if (!value?.trim()) return OFFICIAL_SITE
  try {
    const host = new URL(value).hostname.toLowerCase()
    return publisherByHost[host] || host.replace(/^www\./, '')
  } catch {
    return value.trim()
  }
}

function citationYear(iso?: string, date?: string, source?: string) {
  const match = [iso, date, source]
    .filter(Boolean)
    .join(' ')
    .match(/(?:19|20)\d{2}/)
  return match?.[0] || 'د.ت.'
}

function writeWithFallback(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('copy failed')
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // بعض المتصفحات تعرّف Clipboard API ثم تمنعها؛ ننتقل للنسخ التقليدي.
    }
  }
  writeWithFallback(value)
}

/** استشهاد عربي جاهز بنمطَي APA وMLA، مع إبقاء الأداة صغيرة حتى يطلبها القارئ. */
export function CitationCopy({ title, path, iso, date, source, url }: CitationCopyProps) {
  const panelId = useId()
  const timer = useRef<number | undefined>(undefined)
  const [status, setStatus] = useState<CitationStyle | 'error' | null>(null)
  const canonicalUrl = url?.trim() || `${site.url}${path}`
  const publication = sourceName(source)
  const year = citationYear(iso, date, source)

  const citations = useMemo<Record<CitationStyle, string>>(() => ({
    apa: `${AUTHOR}. (${year}). ${title}. ${publication}. ${canonicalUrl}`,
    mla: `${AUTHOR}. «${title}». ${publication}، ${date?.trim() || year}، ${canonicalUrl}.`,
  }), [canonicalUrl, date, publication, title, year])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const copy = async (style: CitationStyle) => {
    try {
      await copyText(citations[style])
      setStatus(style)
    } catch {
      setStatus('error')
    }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus(null), 2400)
  }

  return (
    <details className="group mt-8 border-y border-hair py-1">
      <summary
        aria-controls={panelId}
        className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[.84rem] font-semibold text-ink marker:hidden transition-colors hover:text-accent [&::-webkit-details-marker]:hidden"
      >
        <span>انسخ الاستشهاد</span>
        <span aria-hidden="true" className="text-accent transition-transform duration-300 group-open:rotate-45">＋</span>
      </summary>

      <div id={panelId} className="border-t border-hair pb-4 pt-4">
        <p className="text-[.78rem] font-light leading-[1.8] text-soft">
          اختر الصيغة، وسيُنسخ الاستشهاد كاملاً مع المصدر والرابط.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['apa', 'mla'] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => copy(style)}
              className="rounded-full border border-hair px-4 py-2 text-[.76rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {status === style ? 'تم النسخ ✓' : `نسخ ${style.toUpperCase()}`}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="mt-2 min-h-5 text-[.74rem] text-soft">
          {status === 'error' ? 'تعذّر النسخ تلقائياً؛ جرّب مرة أخرى.' : status ? 'الاستشهاد جاهز للصق.' : ''}
        </p>
      </div>
    </details>
  )
}
