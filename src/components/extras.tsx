import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useScroll } from 'framer-motion'
import { EASE } from './motion'
import { ALLOW_BROWSER_TTS, NEWSLETTER_ENDPOINT, links } from '../data'
import audioManifest from '../data/audio.json'
import { AudioPlayer } from './AudioPlayer'
import { firebaseEnabled, getDb } from '../lib/firebase'

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
    <div className={compact ? '' : 'rounded-2xl border border-hair bg-wash p-8 md:p-10'}>
      {!compact && (
        <>
          <span className="text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">النشرة البريدية</span>
          <h3 className="mt-3 font-display text-[1.5rem] font-semibold text-ink">جديدي يصلك أولاً.</h3>
          <p className="mt-2 text-[.95rem] font-light text-soft">مقال كل أسبوع، ومختارات لا تجدها في مكان آخر.</p>
        </>
      )}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setState('idle') }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="your@email.com"
          aria-label="البريد الإلكتروني"
          className="flex-1 rounded-full border border-hair bg-canvas px-5 py-3 text-[.95rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
        />
        <button
          onClick={submit}
          disabled={state === 'sending'}
          className="rounded-full bg-accent px-7 py-3 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep disabled:opacity-60"
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

/* ---------- أزرار عائمة: أعلى + السيرة ---------- */
export function FloatingActions() {
  const [show, setShow] = useState(false)
  const { scrollY } = useScroll()
  useEffect(() => scrollY.on('change', (v) => setShow(v > 700)), [scrollY])

  return (
    <div className="reader-hide-focus fixed bottom-6 left-6 z-[210] flex flex-col gap-3">
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
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hair bg-canvas/90 text-ink shadow-[0_10px_28px_-14px_rgba(21,22,26,.5)] backdrop-blur transition-colors hover:border-accent hover:text-accent"
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>

      {/* في الجوال: يختفي عند التعمق في القراءة كي لا يغطي النص */}
      <a
        href={links.cv}
        target="_blank"
        rel="noreferrer"
        aria-label="السيرة الذاتية PDF"
        className={`${show ? 'hidden sm:flex' : 'flex'} h-11 items-center gap-2 rounded-full bg-accent px-4 text-[.82rem] font-semibold text-white shadow-[0_10px_28px_-12px_rgba(62,92,120,.8)] transition-colors hover:bg-accent-deep`}
      >
        <span>السيرة</span>
        <span className="text-[.7rem] opacity-75">PDF</span>
      </a>
    </div>
  )
}

/* ---------- مشاركة المقال ---------- */
export function Share({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.origin + path : path
  const t = encodeURIComponent(title)
  const u = encodeURIComponent(url)

  const items = [
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: 'واتساب', href: `https://wa.me/?text=${t}%20${u}` },
    { label: 'لينكدإن', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ]

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* noop */ }
  }

  return (
    <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-hair pt-7">
      <span className="text-[.82rem] text-soft">شارك المقال</span>
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-hair px-4 py-1.5 text-[.84rem] text-ink transition-colors hover:border-accent hover:text-accent"
        >
          {i.label}
        </a>
      ))}
      <button
        onClick={copy}
        className="rounded-full border border-hair px-4 py-1.5 text-[.84rem] text-ink transition-colors hover:border-accent hover:text-accent"
      >
        {copied ? 'نُسخ ✓' : 'نسخ الرابط'}
      </button>
    </div>
  )
}

/* ---------- مبدّل الوضع الليلي ---------- */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem('theme') } catch { return null } })()
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches
    const on = saved ? saved === 'dark' : prefers
    setDark(on)
    document.documentElement.classList.toggle('dark', on)
  }, [])

  const toggle = () => {
    const on = !dark
    setDark(on)
    document.documentElement.classList.toggle('dark', on)
    try { localStorage.setItem('theme', on ? 'dark' : 'light') } catch { /* noop */ }
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
export function Listen({ slug, title, text, audio }: { slug: string; title: string; text: string; audio?: { fahed?: boolean; noura?: boolean } }) {
  // الفهرس: { slug: { fahed: true, noura: true } } — أو true بالصيغة القديمة (= فهد فقط)
  // مقالات لوحة التحكم تمرر audio من وثيقتها (يولّده سكربت الصوت الليلي)
  const entry = (audioManifest as Record<string, boolean | { fahed?: boolean; noura?: boolean }>)[slug]
  const voices = audio ?? (entry === true ? { fahed: true } : entry || {})
  const sources = [
    ...(voices.fahed ? [{ key: 'fahed', label: 'فهد', src: `/audio/${slug}.mp3` }] : []),
    ...(voices.noura ? [{ key: 'noura', label: 'نورة', src: `/audio/${slug}.noura.mp3` }] : []),
  ]
  const [ttsOn, setTtsOn] = useState(false)

  if (sources.length) return <AudioPlayer sources={sources} title={title} />
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
