import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useScroll } from 'framer-motion'
import { EASE } from './motion'
import { SocialIcon } from './icons'
import { ALLOW_BROWSER_TTS, NEWSLETTER_ENDPOINT, site } from '../data'
import audioManifest from '../data/audio.json'
import audioMeta from '../data/audio-meta.json'
import { AudioPlayer } from './AudioPlayer'
import { firebaseEnabled, getDb } from '../lib/firebase'
import { trackShare } from '../lib/views'
import { useAdminAuth } from '../lib/admin-auth'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { MySpace } from './MySpace'

/* ---------- النشرة البريدية ---------- */
export function Newsletter({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setState('error')
    setState('sending')
    try {
      // ١) Firestore إن كان مفعّلاً
      if (firebaseEnabled) {
        const db = await getDb()
        if (db) {
          const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
          await setDoc(doc(db, 'subscribers', email.toLowerCase()), { email: email.toLowerCase(), createdAt: serverTimestamp() })
          setEmail(''); setState('done'); return
        }
      }
      // ٢) مزوّد خارجي
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
                ↑
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
    <div className={compact ? 'flex flex-wrap items-center gap-2.5' : 'mt-12 flex flex-wrap items-center gap-2.5 border-t border-hair pt-6'}>
      <span className="me-1 text-[.8rem] text-soft">شارك المقال</span>
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
      ✎
    </RouterLink>
  )
}

/* ---------- «انسخ الاستشهاد» — APA وMLA بنقرة، باسم الدكتور ---------- */
export function CiteButton({ title, year, container, url, compact = false }: { title: string; year: string; container: string; url: string; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // صيغة واحدة أنيقة معتمدة (على نمط MLA بعلامتَي التنصيص «»)
  const citation = `الفيلكاوي، أحمد حسين. «${title}». ${container}، ${year}، ${url}.`
  const copy = async () => {
    try { await navigator.clipboard.writeText(citation); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* noop */ }
  }
  if (compact) return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-11 border-b border-hair px-1 text-[.8rem] font-medium text-soft transition-colors hover:border-accent hover:text-accent">
        الاستشهاد المرجعي
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+.6rem)] left-0 z-20 w-[min(88vw,430px)] rounded-xl border border-hair bg-canvas p-4 shadow-[0_18px_50px_-34px_rgba(21,22,26,.55)]">
          <p className="text-[.8rem] font-light leading-[1.9] text-soft">{citation}</p>
          <button onClick={copy} className="mt-3 min-h-11 border-b border-hair px-1 text-[.74rem] font-semibold text-accent">{copied ? '✓ نُسخ' : 'نسخ الاستشهاد'}</button>
        </div>
      )}
    </div>
  )
  return (
    <div className="mt-8 rounded-xl border border-hair">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3 text-[.88rem] font-medium text-soft transition-colors hover:text-accent">
        <span>✍ انسخ الاستشهاد الأكاديمي</span>
        <span className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="border-t border-hair p-5">
          <div className="flex items-start gap-3">
            <button onClick={copy}
              className={`shrink-0 rounded-full border px-3.5 py-1 text-[.72rem] font-semibold transition-colors ${copied ? 'border-accent text-accent' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>
              {copied ? '✓ نُسخ' : 'نسخ'}
            </button>
            <p className="text-[.82rem] font-light leading-[1.9] text-soft">{citation}</p>
          </div>
        </div>
      )}
    </div>
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
   ١) إن وُجد ملف MP3 مولّد مسبقاً (npm run audio) → مشغّل حقيقي بصوت طبيعي.
   ٢) وإلا → لا شيء. صوت المتصفّح الآلي رديء للعربية، ولا نعرضه إلا بطلب صريح
      عبر ALLOW_BROWSER_TTS في data.ts. */
type ArticleAudio = { fahed?: boolean | string; noura?: boolean | string; dialogue?: boolean | string }
type ArticleAudioControl = { readingDisabled?: boolean; fahedDisabled?: boolean; nouraDisabled?: boolean; dialogueDisabled?: boolean }
type DialogueTranscript = { title: string; utterances: { speaker: string; text: string }[] }
const audioBase = (import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const audioUrl = (path: string) => audioBase ? `${audioBase}/${path.replace(/^\/?audio\//, '')}` : path
const audioMetaMap = audioMeta as Record<string, { sha256?: string }>
const versionedAudioUrl = (path: string) => {
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
  // الفهرس: { slug: { fahed: true, noura: true } } — أو true بالصيغة القديمة (= فهد فقط)
  // مقالات لوحة التحكم تمرر audio من وثيقتها (يولّده سكربت الصوت الليلي)
  const entry = (audioManifest as Record<string, boolean | ArticleAudio>)[slug]
  const resolvedVoices: ArticleAudio = { ...(audio ?? (entry === true ? { fahed: true } : entry || {})) }
  if (audioControl?.fahedDisabled ?? audioControl?.readingDisabled ?? false) delete resolvedVoices.fahed
  if (audioControl?.nouraDisabled ?? audioControl?.readingDisabled ?? false) delete resolvedVoices.noura
  if (audioControl?.dialogueDisabled) delete resolvedVoices.dialogue
  const voices = resolvedVoices
  // الحلقة الحوارية (فهد ونورة يتحاوران) تنضم كخيار ثالث فور توفر ملفها —
  // القراءة الأمينة تبقى الأصل، والحوار إضاءة تفسيرية بجانبها لا بديلاً عنها.
  const dialogueListed = !audioControl?.dialogueDisabled && Boolean(voices.dialogue)
  const [dialogueOk, setDialogueOk] = useState(dialogueListed)
  const [transcript, setTranscript] = useState<DialogueTranscript | null>(null)
  useEffect(() => {
    let on = true
    setDialogueOk(dialogueListed)
    if (!dialogueListed && !audioControl?.dialogueDisabled) hasDialogueAudio(slug).then((ok) => { if (on) setDialogueOk(ok) })
    if (audioControl?.dialogueDisabled) { setTranscript(null); return () => { on = false } }
    fetch(versionedAudioUrl(`/audio/${slug}.dialogue.json`))
      .then((response) => response.ok ? response.json() : null)
      .then((value) => { if (on && value?.utterances?.length) setTranscript(value) })
      .catch(() => { /* لا Transcript للحلقات القديمة */ })
    return () => { on = false }
  }, [audioControl?.dialogueDisabled, dialogueListed, slug])

  const sources = [
    ...(voices.fahed ? [{ key: 'fahed', label: 'قراءة المقال', avatar: 'man' as const, src: versionedAudioUrl(typeof voices.fahed === 'string' ? voices.fahed : `/audio/${slug}.mp3`) }] : []),
    ...(voices.noura ? [{ key: 'noura', label: 'قراءة المقال', avatar: 'woman' as const, src: versionedAudioUrl(typeof voices.noura === 'string' ? voices.noura : `/audio/${slug}.noura.mp3`) }] : []),
    ...(dialogueOk ? [{ key: 'dialogue', label: 'الحلقة الحوارية', avatar: 'dialogue' as const, src: versionedAudioUrl(typeof voices.dialogue === 'string' ? voices.dialogue : `/audio/${slug}.dialogue.mp3`) }] : []),
  ]
  const [ttsOn, setTtsOn] = useState(false)

  if (sources.length) return (
    <div className={compact ? 'min-w-0 flex-1' : ''}>
      <AudioPlayer sources={sources} title={title} compact={compact} controlId={`article-audio-${slug}`} />
      {dialogueOk && (
        <details className="mt-3 rounded-xl border border-hair bg-canvas px-5 py-4">
          <summary className="cursor-pointer text-[.86rem] font-semibold text-accent">نص الحلقة الحوارية</summary>
          {transcript ? (
            <div className="mt-5 space-y-4 border-t border-hair pt-5">
              {transcript.utterances.map((utterance, index) => (
                <p key={`${utterance.speaker}-${index}`} className="text-[.96rem] leading-[1.9] text-ink/85">
                  <strong className="me-2 font-semibold text-accent">{utterance.speaker}:</strong>
                  {utterance.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-4 border-t border-hair pt-4 text-[.86rem] leading-relaxed text-soft">
              الحلقة الحوارية متاحة للاستماع. نص الحوار سيظهر هنا فور اعتماد ملف الـTranscript لهذه الحلقة.
            </p>
          )}
        </details>
      )}
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
