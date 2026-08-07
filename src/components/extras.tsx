import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useScroll } from 'framer-motion'
import { createPortal } from 'react-dom'
import { EASE } from './motion'
import { SocialIcon } from './icons'
import { ClarifiedIconAction } from './ClarifiedIconAction'
import { ALLOW_BROWSER_TTS, NEWSLETTER_ENDPOINT, site } from '../data'
import audioManifest from '../data/audio.json'
import { AudioPlayer, openAudioPlayer } from './AudioPlayer'
import { firebaseEnabled, getDb } from '../lib/firebase'
import { trackShare } from '../lib/views'
import { useAdminAuth } from '../lib/admin-auth'
import { Link as RouterLink, useLocation } from 'react-router'
import { MySpace } from './MySpace'
import { safeLink } from '../lib/dead-links'
import { buildBibTeX, downloadCitationFile, inferBibTeXType, safeCitationFilename } from '../lib/bibtex'

/* ---------- النشرة البريدية ---------- */
export function Newsletter({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setState('error')
    setState('sending')
    try {
      // 1) API الموقع: يحفظ الاشتراك ويرسل Push حقيقياً للمشرف إن كان مفعّلاً.
      if (firebaseEnabled) {
        const response = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase() }),
        }).catch(() => null)
        if (response?.ok) { setEmail(''); setState('done'); return }

        // رجوع آمن: الاشتراك نفسه لا يضيع إذا تعطل dr-api، لكن التنبيه الفوري قد ينتظر رجوعه.
        const db = await getDb()
        if (db) {
          const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
          await setDoc(doc(db, 'subscribers', email.toLowerCase()), { email: email.toLowerCase(), createdAt: serverTimestamp() })
          setEmail(''); setState('done'); return
        }
      }
      // 2) مزوّد خارجي
      if (NEWSLETTER_ENDPOINT) {
        const r = await fetch(NEWSLETTER_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (r.ok) { setEmail(''); setState('done'); return }
      }
      setState('error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done')
    return (
      <p className="text-[.95rem] font-medium text-accent">تمّ الاشتراك. شكراً لك.</p>
    )

  return (
    // نحيفة وهادئة — سطر واحد لا بطاقة كبيرة
    <div className={compact ? 'w-full' : 'rounded-xl border border-hair p-5'}>
      {!compact && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-[1rem] font-semibold text-ink">النشرة البريدية — جديدي يصلك أولاً.</h3>
          <p className="text-[.8rem] font-light text-soft">مقال كل أسبوع، ومختارات منتقاة.</p>
        </div>
      )}
      <div className={compact ? 'flex items-center gap-2' : 'mt-3 flex flex-col gap-2 sm:flex-row'}>
        <input
          id="newsletter-inline-email"
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setState('idle') }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="your@email.com"
          aria-label="البريد الإلكتروني"
          className={`min-w-0 flex-1 rounded-full border border-hair bg-canvas text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent ${compact ? 'px-3 py-2 text-[.78rem]' : 'px-4 py-2.5 text-[.9rem]'}`}
        />
        <button
          onClick={submit}
          disabled={state === 'sending'}
          className={`shrink-0 rounded-full bg-accent font-semibold text-white transition-colors duration-300 hover:bg-accent-deep disabled:opacity-60 ${compact ? 'px-4 py-2 text-[.78rem]' : 'px-5 py-2.5 text-[.9rem]'}`}
        >
          {state === 'sending' ? '…' : 'اشتراك'}
        </button>
      </div>
      {state === 'error' && (
        <p className="mt-3 text-[.85rem] text-soft">
          {firebaseEnabled || NEWSLETTER_ENDPOINT ? 'تعذّر الاشتراك — تحقّق من بريدك.' : 'النشرة قيد الإعداد — تابعني عبر القنوات الرسمية.'}
        </p>
      )}
    </div>
  )
}

/* ---------- زر العودة للأعلى ---------- */
export function FloatingActions() {
  const location = useLocation()
  const [show, setShow] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const [nearPageEnd, setNearPageEnd] = useState(false)
  const { scrollY } = useScroll()

  useEffect(() => scrollY.on('change', (value) => {
    setShow(value > 700)
    const remaining = document.documentElement.scrollHeight - (value + window.innerHeight)
    setNearPageEnd(remaining < Math.max(360, window.innerHeight * .34))
  }), [scrollY])

  useEffect(() => {
    const update = () => {
      const value = window.scrollY
      const remaining = document.documentElement.scrollHeight - (value + window.innerHeight)
      setShow(value > 700)
      setNearPageEnd(remaining < Math.max(360, window.innerHeight * .34))
    }
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [location.pathname])

  useEffect(() => {
    setFooterVisible(false)
    const footer = document.querySelector('.site-footer')
    if (!footer || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: '0px 0px 24px 0px', threshold: 0.02 },
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [location.pathname])

  if (location.pathname.startsWith('/admin') || location.pathname === '/launch') return null

  return (
    <AnimatePresence>
      {!footerVisible && !nearPageEnd && (
        <motion.div
          key="floating-actions"
          className="floating-actions reader-hide-focus fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[210] flex flex-col items-center gap-2 transition-[bottom] duration-300 md:right-6"
          initial={{ opacity: 0, scale: .94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: .92, y: 10 }}
          transition={{ duration: .22, ease: EASE }}
        >
          <MySpace />
          <AnimatePresence>
            {show && (
              <motion.button
                key="top"
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ duration: 0.3, ease: EASE }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="العودة للأعلى"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-canvas/90 text-ink shadow-[0_10px_28px_-14px_rgba(21,22,26,.5)] backdrop-blur transition-colors hover:border-accent hover:text-accent"
              >
                <SocialIcon name="ArrowUp" size={17} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- مشاركة المقال ---------- */
export function Share({ title, path, compact = false }: { title: string; path: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const url = `${site.url}${path}`
  const t = encodeURIComponent(title)
  const u = encodeURIComponent(url)

  const items = [
    { label: 'X', icon: 'X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: 'واتساب', icon: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { label: 'لينكدإن', icon: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ]

  const copy = async () => {
    trackShare(path, title)
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* noop */ }
  }

  // أيقونات فقط — صغيرة نحيفة بلا كلام
  const btn = `flex items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent ${compact ? 'h-11 w-11' : 'h-8 w-8'}`
  return (
    <div className={compact ? 'flex shrink-0 flex-nowrap items-center gap-2.5' : 'mt-12 flex flex-wrap items-center gap-2.5 border-t border-hair pt-6'}>
      {!compact && <span className="me-1 text-[.8rem] text-soft">شارك المقال</span>}
      {items.map((i) => (
        <a key={i.label} href={i.href} target="_blank" rel="noreferrer" aria-label={i.label} title={i.label} className={btn} onClick={() => trackShare(path, title)}>
          <SocialIcon name={i.icon} size={15} />
        </a>
      ))}
      <button onClick={copy} aria-label="نسخ الرابط" title={copied ? 'نُسخ ✓' : 'نسخ الرابط'} className={`${btn} ${copied ? 'border-accent text-accent' : ''}`}>
        <SocialIcon name={copied ? 'Check' : 'Link'} size={15} />
      </button>
    </div>
  )
}



/* ---------- ✎ تحرير موضعي — يظهر للمشرف وحده على صفحات العرض ---------- */
export function OwnerEdit({ tab, slug, className = '' }: { tab: 'articles' | 'books' | 'papers' | 'media'; slug: string; className?: string }) {
  const { isAdmin } = useAdminAuth()
  if (!isAdmin) return null
  return (
    <RouterLink
      to={`/admin?tab=${tab}&edit=${encodeURIComponent(slug)}`}
      title="تحرير (يظهر لك وحدك)"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-hair align-middle text-[.9rem] text-soft transition-colors hover:border-accent hover:text-accent ${className}`}
    >
      <SocialIcon name="Edit" size={15} />
    </RouterLink>
  )
}

/* ---------- استشهاد أكاديمي ذكي واحد — APA / MLA / Chicago ---------- */
type CitationStyle = 'apa' | 'mla' | 'chicago' | 'bibtex'

export function CiteButton({
  title,
  year,
  container,
  url,
  contextUrl,
  authors = 'الفيلكاوي، أحمد حسين',
  compact = false,
  contextLabel = 'فتح المصدر الأصلي',
  compactLabel,
}: {
  title: string
  year: string
  container: string
  url: string
  contextUrl?: string
  authors?: string
  compact?: boolean
  contextLabel?: string
  compactLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [style, setStyle] = useState<CitationStyle>('apa')
  const [exportState, setExportState] = useState<'idle' | 'done' | 'error'>('idle')
  const citationUrl = safeLink(url)
  const contextSourceUrl = contextUrl === undefined ? citationUrl : safeLink(contextUrl)
  const sourceSuffix = citationUrl ? ` ${citationUrl}` : ''
  const citations: Record<CitationStyle, string> = {
    apa: `${authors}. (${year}). ${title}. ${container}.${sourceSuffix}`,
    mla: `${authors}. «${title}». ${container}، ${year}.${sourceSuffix}`,
    chicago: `${authors}. «${title}». ${container} (${year}).${sourceSuffix}`,
    /* النوع يُستنتج من الوعاء الحقيقي (مجلة/كتاب/مؤتمر/أطروحة)، ولا يُختار نوعٌ
       لمجرد أنه «يستوعب حقولاً أكثر»؛ وما لا نعرفه لا يُكتب. */
    bibtex: ((type = inferBibTeXType({ container })) => buildBibTeX({
      type,
      id: `${title}-${year}`,
      authors,
      title,
      year,
      journal: type === 'article' ? container : undefined,
      booktitle: type === 'incollection' || type === 'inproceedings' ? container : undefined,
      publisher: type === 'book' || type === 'phdthesis' || type === 'mastersthesis' ? container : undefined,
      doi: String(citationUrl || url || '').match(/10\.\d{4,9}\/[^\s?#]+/i)?.[0]?.replace(/[.,;]+$/, ''),
      url: citationUrl || undefined,
      language: /[\u0600-\u06ff]/u.test(title) ? 'ar' : undefined,
    }))(),
  }
  const citation = citations[style]
  const styles: { id: CitationStyle; label: string }[] = [
    { id: 'apa', label: 'APA 7' },
    { id: 'mla', label: 'MLA 9' },
    { id: 'chicago', label: 'Chicago' },
    { id: 'bibtex', label: 'BibTeX' },
  ]

  const copy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(citation)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = citation
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = citation
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      } catch { /* noop */ }
    }
  }

  /* تصدير أكاديمي حقيقي: ملف RIS بترميز UTF-8، مع تأخير تحرير الرابط
     حتى لا تلغيه Safari على الهاتف قبل بدء التنزيل. */
  const exportRis = () => {
    setExportState('idle')
    const normalizedYear = String(year || '').match(/\d{4}/)?.[0] || ''
    const doi = String(citationUrl || url || '').match(/10\.\d{4,9}\/[^\s?#]+/i)?.[0]?.replace(/[.,;]+$/, '')
    const lines = [
      'TY  - JOUR',
      `TI  - ${title}`,
      authors ? `AU  - ${authors}` : '',
      normalizedYear ? `PY  - ${normalizedYear}` : '',
      container ? `JO  - ${container}` : '',
      doi ? `DO  - ${doi}` : '',
      citationUrl ? `UR  - ${citationUrl}` : '',
      'LA  - ar',
      'ER  - ',
    ].filter(Boolean)
    try {
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}\r\n`], { type: 'application/x-research-info-systems;charset=utf-8' })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${String(title).slice(0, 56).replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'citation'}.ris`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1800)
      setExportState('done')
      window.setTimeout(() => setExportState('idle'), 2200)
    } catch {
      setExportState('error')
    }
  }
  const exportBib = () => {
    try {
      downloadCitationFile(citations.bibtex, safeCitationFilename(title, 'bib'), 'application/x-bibtex')
      setExportState('done')
      window.setTimeout(() => setExportState('idle'), 2200)
    } catch { setExportState('error') }
  }
  const isExport = /تصدير|export|ris/i.test(contextLabel)

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', close)
      document.body.style.overflow = previous
    }
  }, [open])

  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="citation-portal-v2"
          role="dialog"
          aria-modal="true"
          aria-labelledby="citation-dialog-title"
          style={{ position: 'fixed', inset: 0, zIndex: 2147483000, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100dvh', writingMode: 'horizontal-tb', direction: 'rtl' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}
        >
          <motion.section
            className="citation-card-v2"
            dir="rtl"
            style={{ writingMode: 'horizontal-tb', direction: 'rtl', width: '100%', maxWidth: '540px', minWidth: '280px', boxSizing: 'border-box' }}
            initial={{ opacity: 0, y: 24, scale: .99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: .995 }}
            transition={{ duration: .22, ease: EASE }}
          >
            <header className="citation-header-v2">
              <div className="citation-heading-v2">
                <p className="citation-kicker-v2">استشهاد أكاديمي ذكي</p>
                <h3 id="citation-dialog-title" className="citation-title-v2">صيغة واحدة، بأربعة أنماط معتمدة</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="citation-close-v2" aria-label="إغلاق النافذة" title="إغلاق"><SocialIcon name="Close" size={15} /></button>
            </header>
            <div className="citation-style-switch" role="tablist" aria-label="نمط الاستشهاد">
              {styles.map((item) => (
                <button key={item.id} type="button" role="tab" aria-selected={style === item.id} onClick={() => { setStyle(item.id); setCopied(false); setExportState('idle') }} className={style === item.id ? 'is-active' : ''}>{item.label}</button>
              ))}
            </div>
            <p className="citation-body-v2" dir="auto">{citation}</p>
            <footer className="citation-footer-v2">
              {style === 'bibtex' ? (
                <button type="button" onClick={exportBib} className="citation-export-v2" aria-live="polite">
                  {exportState === 'done' ? '✓ نُزّل ملف BibTeX' : exportState === 'error' ? 'تعذّر التنزيل — جرّب النسخ' : 'تنزيل ملف .bib ↓'}
                </button>
              ) : isExport ? (
                <button type="button" onClick={exportRis} className="citation-export-v2" aria-live="polite">
                  {exportState === 'done' ? '✓ نُزّل ملف RIS' : exportState === 'error' ? 'تعذّر التنزيل — جرّب النسخ' : 'تصدير RIS لبرامج المراجع ↓'}
                </button>
              ) : contextSourceUrl ? (
                <a href={contextSourceUrl} target="_blank" rel="noreferrer" className="citation-source-v2">{contextLabel} ↗</a>
              ) : <span />}
              <button type="button" onClick={copy} className="citation-copy-v2">{copied ? '✓ نُسخ الاستشهاد' : `نسخ ${styles.find((item) => item.id === style)?.label}`}</button>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const portalElement = typeof document !== 'undefined' ? createPortal(dialog, document.body) : null

  if (compact) {
    return (
      <>
        {compactLabel ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="عرض الاستشهاد المرجعي"
            title="الاستشهاد المرجعي"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hair bg-canvas px-4 text-[.78rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v10.5H6.5A2.5 2.5 0 0 1 4 16V8a2.5 2.5 0 0 1 2.5-2.5Z" />
              <path d="M8 10.2h3.4M8 13.8h5.8" /><path d="M15.4 9.2c1.25.1 2.1.85 2.1 2.05 0 1.35-.9 2.2-2.35 2.55" />
            </svg>
            <span>{compactLabel}</span>
          </button>
        ) : (
          <ClarifiedIconAction id="academic-citation" label="أنشئ الاستشهاد الأكاديمي بصيغ APA وMLA وChicago وBibTeX">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label="عرض الاستشهاد المرجعي"
              title="الاستشهاد المرجعي"
              className="article-tool-icon"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v10.5H6.5A2.5 2.5 0 0 1 4 16V8a2.5 2.5 0 0 1 2.5-2.5Z" />
                <path d="M8 10.2h3.4M8 13.8h5.8" /><path d="M15.4 9.2c1.25.1 2.1.85 2.1 2.05 0 1.35-.9 2.2-2.35 2.55" />
              </svg>
            </button>
          </ClarifiedIconAction>
        )}
        {portalElement}
      </>
    )
  }

  return (
    <>
      <div className="mt-8 rounded-xl border border-hair">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog" className="flex w-full items-center justify-between px-5 py-3 text-[.88rem] font-medium text-soft transition-colors hover:text-accent">
          <span>✍ الاستشهاد الأكاديمي</span>
          <span className="text-[.82rem] font-semibold text-accent">APA · MLA · Chicago · BibTeX ↗</span>
        </button>
      </div>
      {portalElement}
    </>
  )
}

/* ---------- مبدّل الوضع الليلي ---------- */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    // الوضع النهاري هو الأصل دائماً — لا يتحوّل للّيلي إلا إذا اختاره الزائر بنفسه (يُحفظ اختياره)
    const saved = (() => { try { return localStorage.getItem('theme') } catch { return null } })()
    const on = saved === 'dark'
    setDark(on)
    document.documentElement.classList.toggle('dark', on)
    const syncFromReader = (event: Event) => setDark(Boolean((event as CustomEvent<{ dark?: boolean }>).detail?.dark))
    window.addEventListener('reader:theme-changed', syncFromReader)
    return () => window.removeEventListener('reader:theme-changed', syncFromReader)
  }, [])

  const toggle = () => {
    const on = !dark
    setDark(on)
    document.documentElement.classList.toggle('dark', on)
    document.documentElement.classList.remove('reader-paper')
    try { localStorage.setItem('theme', on ? 'dark' : 'light') } catch { /* noop */ }
    try {
      const raw = localStorage.getItem('reader:preferences:v2')
      if (raw) localStorage.setItem('reader:preferences:v2', JSON.stringify({ ...JSON.parse(raw), theme: on ? 'dark' : 'light' }))
    } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent('reader:preferences-changed'))
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
      title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-hair text-ink transition-colors duration-300 hover:border-accent hover:text-accent ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? 'sun' : 'moon'}
          initial={{ opacity: 0, rotate: -35, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 35, scale: 0.7 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="text-[.95rem] leading-none"
        >
          {dark ? '☀' : '☾'}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

/* ---------- الاستماع للمقال ----------
   1) إن وُجد ملف MP3 مولّد مسبقاً (npm run audio) → مشغّل حقيقي بصوت طبيعي.
   2) وإلا → لا شيء. صوت المتصفّح الآلي رديء للعربية، ولا نعرضه إلا بطلب صريح
      عبر ALLOW_BROWSER_TTS في data.ts. */
type ArticleAudio = { fahed?: boolean | string; noura?: boolean | string; dialogue?: boolean | string }
type ArticleAudioControl = { readingDisabled?: boolean; fahedDisabled?: boolean; nouraDisabled?: boolean; dialogueDisabled?: boolean }
const audioBase = (import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const audioUrl = (path: string) => audioBase ? `${audioBase}/${path.replace(/^\/?audio\//, '')}` : path
/* بيانات الصوت ٢٠٦ك.ب، ولا يُؤخذ منها إلا بصمةٌ من ١٦ حرفاً تكسر التخزين
   المؤقت. واستيرادها ثابتاً كان يُركِبها حزمةَ الدخول كاملةً فتتجاوز السقف.
   تُجلب الآن كسولاً: الرابط الأول قد يخرج بلا بصمة — والملف يعمل كما هو —
   ثم تكتمل. ولا يرى الزائر فرقاً. */
let audioMetaMap: Record<string, { sha256?: string }> = {}
void import('../data/audio-meta.json').then((loaded) => {
  audioMetaMap = ((loaded as { default?: unknown }).default ?? loaded) as Record<string, { sha256?: string }>
})
/* مُصدَّرة كي يستعملها «مجلس الفكرة» بالقانون نفسه: عنوانٌ واحد للصوت في
   الموقع كله، وبصمةٌ واحدة تكسر التخزين المؤقت عند تغيّر الملف. */
export const versionedAudioUrl = (path: string) => {
  const raw = /^https?:\/\//i.test(path) ? path : audioUrl(path)
  const name = decodeURIComponent((raw.split('?', 1)[0].split('/').pop() || '').trim())
  const version = audioMetaMap[name]?.sha256?.slice(0, 16)
  if (!version || new URLSearchParams(raw.split('?', 2)[1] || '').has('v')) return raw
  return `${raw}${raw.includes('?') ? '&' : '?'}v=${version}`
}

async function hasDialogueAudio(slug: string, disabled = false) {
  if (disabled) return false
  const path = versionedAudioUrl(`/audio/${slug}.dialogue.mp3`)
  try {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-store' })
    const type = (response.headers.get('content-type') || '').toLowerCase()
    if (response.ok && !type.includes('text/html')) return true
  } catch { /* جرّب Range أدناه */ }
  try {
    const response = await fetch(path, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
    const type = (response.headers.get('content-type') || '').toLowerCase()
    return response.ok && !type.includes('text/html')
  } catch {
    return false
  }
}

export function Listen({ slug, title, text, audio, audioControl, compact = false }: { slug: string; title: string; text: string; audio?: ArticleAudio; audioControl?: ArticleAudioControl; compact?: boolean }) {
  // للزائر مسار واحد فقط باسم «قراءة المقال». قد يكون الملف حديثاً أو موروثاً،
  // لكن أسماء الإنتاج الداخلية لا تظهر ولا تغيّر تجربة الاستماع.
  // مقالات لوحة التحكم تمرر audio من وثيقتها (يولّده سكربت الصوت الليلي)
  const entry = (audioManifest as Record<string, boolean | ArticleAudio>)[slug]
  const resolvedVoices: ArticleAudio = { ...(audio ?? (entry === true ? { fahed: true } : entry || {})) }
  const readingDisabled = audioControl?.readingDisabled ?? false
  if (readingDisabled) {
    delete resolvedVoices.fahed
    delete resolvedVoices.noura
  } else {
    if (audioControl?.fahedDisabled) delete resolvedVoices.fahed
    if (audioControl?.nouraDisabled) delete resolvedVoices.noura
  }
  if (audioControl?.dialogueDisabled) delete resolvedVoices.dialogue
  const voices = resolvedVoices
  // الحلقة الحوارية تنضم كمسار ثانٍ فور توفرها؛ القراءة الأمينة تبقى الأصل،
  // والحوار إضاءة تفسيرية بجانبها لا بديلاً عنها.
  const dialogueListed = !audioControl?.dialogueDisabled && Boolean(voices.dialogue)
  const [dialogueOk, setDialogueOk] = useState(dialogueListed)
  useEffect(() => {
    let on = true
    setDialogueOk(dialogueListed)
    if (!dialogueListed && !audioControl?.dialogueDisabled) hasDialogueAudio(slug).then((ok) => { if (on) setDialogueOk(ok) })
    return () => { on = false }
  }, [audioControl?.dialogueDisabled, dialogueListed, slug])

  // داخل المقال نخفي أسماء محركات القراءة عن الزائر، لكننا لا ندمج الصوتين:
  // إذا كان صوتا نورة وفهد موجودين تظهر أيقونتا امرأة ورجل كما في الواجهة الأصلية،
  // وكل زر يحمل تسمية عامة «قراءة المقال». إذا توفر صوت واحد فقط يظهر زر واحد بلا اسم.
  const readingSources = [
    ...(voices.fahed ? [{ key: 'reading-man', label: 'قراءة المقال', avatar: 'man' as const, src: versionedAudioUrl(typeof voices.fahed === 'string' ? voices.fahed : `/audio/${slug}.mp3`) }] : []),
    ...(voices.noura ? [{ key: 'reading-woman', label: 'قراءة المقال', avatar: 'woman' as const, src: versionedAudioUrl(typeof voices.noura === 'string' ? voices.noura : `/audio/${slug}.noura.mp3`) }] : []),
  ]
  const audioControlId = `article-audio-${slug}`
  /* رابط اللحظة ‎?t=ثانية‎ يفتح الحلقة عند الجملة المقصودة — يرسله البوت في
     الواتساب، ويصلح للمشاركة عموماً. وبلا الوسم يبقى كل شيء كما كان. */
  const momentSeconds = (() => {
    if (typeof window === 'undefined') return 0
    const raw = Number(new URLSearchParams(window.location.search).get('t') || 0)
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  })()
  const sources = [
    ...readingSources,
    // نصّ الحلقة يسير مع صوتها: منه المحاور القابلة للنقر والسطر المتوهّج.
    ...(dialogueOk ? [{ key: 'dialogue', label: 'استمع', avatar: 'dialogue' as const, src: versionedAudioUrl(typeof voices.dialogue === 'string' ? voices.dialogue : `/audio/${slug}.dialogue.mp3`), transcript: versionedAudioUrl(`/audio/${slug}.dialogue.json`), startAt: momentSeconds || undefined }] : []),
  ]
  const [ttsOn, setTtsOn] = useState(false)

  /* من فتح رابط لحظة يجد المشغّل مفتوحاً على الحوار عند ثانيتها — بلا بحثٍ عن
     زرّ ولا نقرتين. ولا يحدث شيء لمن دخل الصفحة كالعادة. */
  useEffect(() => {
    if (!momentSeconds || !dialogueOk) return
    const frame = window.requestAnimationFrame(() => openAudioPlayer(audioControlId, 'dialogue'))
    return () => window.cancelAnimationFrame(frame)
  }, [audioControlId, dialogueOk, momentSeconds])

  if (sources.length) return (
    <div className={compact ? 'min-w-0 flex-1' : ''}>
      <AudioPlayer
        sources={sources}
        title={title}
        compact={compact}
        controlId={audioControlId}
      />
    </div>
  )
  if (!ALLOW_BROWSER_TTS) return null
  return <BrowserTts text={text} active={ttsOn} setActive={setTtsOn} />
}

/* البديل الآلي — يُستخدم فقط إذا فُعّل صراحةً */
function BrowserTts({ text, active, setActive }: { text: string; active: boolean; setActive: (b: boolean) => void }) {
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const has = typeof window !== 'undefined' && 'speechSynthesis' in window
    setOk(has)
    if (has) window.speechSynthesis.getVoices()
    return () => { try { window.speechSynthesis.cancel() } catch { /* noop */ } }
  }, [])

  const play = () => {
    const synth = window.speechSynthesis
    if (active) { synth.cancel(); setActive(false); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text.slice(0, 12000))
    u.lang = 'ar-SA'
    u.rate = 0.95
    const v = synth.getVoices()
    const arVoice = v.find((x) => x.lang.startsWith('ar-KW')) || v.find((x) => x.lang.startsWith('ar-SA')) || v.find((x) => x.lang.startsWith('ar'))
    if (arVoice) u.voice = arVoice
    u.onend = () => setActive(false)
    synth.speak(u)
    setActive(true)
  }

  if (!ok) return null
  return (
    <div className="mt-8">
      <button onClick={play} className="flex items-center gap-2.5 rounded-full border border-hair px-5 py-2 text-[.85rem] text-ink transition-colors hover:border-accent hover:text-accent">
        <span className="text-[.75rem] text-accent">{active ? '❚❚' : '▶'}</span>
        {active ? 'إيقاف' : 'قراءة آلية'}
      </button>
      <p className="mt-2 text-[.76rem] text-soft">صوت آلي من متصفّحك — جودته محدودة.</p>
    </div>
  )
}
