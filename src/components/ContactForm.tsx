import { useState } from 'react'
import { motion } from 'framer-motion'
import { EASE } from './ui'
import { firebaseEnabled, getDb } from '../lib/firebase'

const TOPICS = ['استشارة', 'محاضرة أو ورشة', 'لقاء إعلامي', 'أخرى'] as const

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('استشارة')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')

  const valid =
    name.trim().length > 1 &&
    /^\S+@\S+\.\S+$/.test(email) &&
    message.trim().length > 10

  const submit = async () => {
    if (website.trim()) return
    const last = Number(localStorage.getItem('contact:last-submit') || 0)
    if (Date.now() - last < 60_000) { setErr('تم الإرسال قبل قليل. انتظر دقيقة ثم حاول مرة أخرى.'); setState('error'); return }
    if (!valid) { setErr('أكمل الحقول: الاسم، بريد صحيح، ورسالة لا تقلّ عن 10 أحرف.'); setState('error'); return }
    if (!firebaseEnabled) { setErr('النموذج غير مفعّل بعد. استخدم روابط التواصل أدناه.'); setState('error'); return }

    setState('sending')
    try {
      const db = await getDb()
      if (!db) throw new Error('no-db')
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
      await addDoc(collection(db, 'messages'), {
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
        createdAt: serverTimestamp(),
      })
      try { localStorage.setItem('contact:last-submit', String(Date.now())) } catch { /* noop */ }
      setState('done')
      setName(''); setEmail(''); setMessage('')
    } catch {
      setErr('تعذّر الإرسال. حاول لاحقاً أو راسلني عبر الحسابات.')
      setState('error')
    }
  }

  if (state === 'done')
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="rounded-2xl border border-hair bg-wash p-10 text-center"
      >
        <span className="font-display text-[1.6rem] font-semibold text-accent">وصلتني رسالتك.</span>
        <p className="mt-3 text-[.98rem] font-light text-soft">سأعود إليك في أقرب فرصة. شكراً لك.</p>
      </motion.div>
    )

  const field =
    'w-full rounded-xl border border-hair bg-canvas px-5 py-3.5 text-[.98rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent'

  return (
    <div className="rounded-2xl border border-hair bg-wash p-8 text-right md:p-10">
      <span className="text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">راسلني مباشرة</span>
      <h3 className="mt-3 font-display text-[1.5rem] font-semibold text-ink">كيف أخدمك؟</h3>

      {/* الموضوع */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`rounded-full border px-4 py-1.5 text-[.84rem] font-medium transition-colors duration-300 ${
              topic === t ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <input value={name} onChange={(e) => { setName(e.target.value); setState('idle') }} placeholder="الاسم" aria-label="الاسم" className={field} />
        <input value={email} onChange={(e) => { setEmail(e.target.value); setState('idle') }} placeholder="البريد الإلكتروني" aria-label="البريد" dir="ltr" className={`${field} text-right`} />
      </div>
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        placeholder="Website"
      />

      <textarea
        value={message}
        onChange={(e) => { setMessage(e.target.value); setState('idle') }}
        placeholder="رسالتك…"
        aria-label="الرسالة"
        rows={5}
        className={`${field} mt-3.5 resize-none leading-[1.9]`}
      />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          onClick={submit}
          disabled={state === 'sending'}
          className="rounded-full bg-accent px-8 py-3.5 font-semibold text-canvas transition-colors duration-300 hover:bg-accent-deep disabled:opacity-60"
        >
          {state === 'sending' ? 'جارٍ الإرسال…' : 'إرسال'}
        </button>
        {state === 'error' && <span className="text-[.86rem] text-soft">{err}</span>}
      </div>
    </div>
  )
}
