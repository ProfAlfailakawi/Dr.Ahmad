import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { EASE } from './ui'
import { firebaseEnabled, getDb } from '../lib/firebase'

const TOPICS = [
  { key: 'استشارة', ar: 'استشارة', en: 'Consultation', dAr: 'رأي خبير في مشروع أو تحدٍّ تعليمي/تكنولوجي', dEn: 'Expert input on an educational or technology challenge', hintAr: 'صف التحدي أو المشروع باختصار: المجال، والجهة إن وُجدت، وما تطمح إليه.', hintEn: 'Briefly describe the challenge, organisation, context, and the outcome you are seeking.' },
  { key: 'محاضرة أو ورشة', ar: 'محاضرة أو ورشة', en: 'Keynote or workshop', dAr: 'حضورياً أو عن بُعد — للجهات والمؤتمرات', dEn: 'In person or online — for institutions and conferences', hintAr: 'الجهة، الموضوع المقترح، التاريخ التقريبي، والمكان (أو عن بُعد).', hintEn: 'Share the organisation, proposed topic, approximate date, location, and preferred format.' },
  { key: 'لقاء إعلامي', ar: 'لقاء إعلامي', en: 'Media interview', dAr: 'تلفزيون، إذاعة، بودكاست، صحافة', dEn: 'Television, radio, podcast, or press', hintAr: 'اسم البرنامج أو الوسيلة، محور الحلقة، وموعد التسجيل أو البث.', hintEn: 'Include the programme or outlet, topic, and proposed recording or broadcast date.' },
  { key: 'أخرى', ar: 'أخرى', en: 'Other', dAr: 'تعاون بحثي، فكرة، أو أي شيء آخر', dEn: 'Research collaboration, an idea, or another request', hintAr: 'اكتب ما يدور في بالك بحرية…', hintEn: 'Tell me what you have in mind.' },
] as const

type TopicKey = (typeof TOPICS)[number]['key']
type Locale = 'ar' | 'en'

const copy = {
  ar: {
    eyebrow: 'راسلني مباشرة', title: 'كيف يمكن أن أساعدك؟', change: 'غيّر نوع الطلب', name: 'الاسم', email: 'البريد الإلكتروني', message: 'الرسالة', send: 'إرسال', sending: 'جارٍ الإرسال…', secure: 'جارٍ إرسال رسالتك بأمان…', success: 'وصلتني رسالتك.', successNote: 'احتفظ بالرقم المرجعي أعلاه إن أحببت المتابعة. الرد عادةً خلال يومين إلى ثلاثة أيام عمل، وبريدك يُستخدم للرد فقط ولا يُشارك مع أحد.', recent: 'تم الإرسال قبل قليل. انتظر دقيقة ثم حاول مرة أخرى.', invalid: 'أكمل الحقول: الاسم، بريد صحيح، ورسالة لا تقلّ عن 10 أحرف.', disabled: 'النموذج غير مفعّل بعد. استخدم روابط التواصل أدناه.', failed: 'تعذّر الإرسال. حاول لاحقاً أو راسلني عبر الحسابات.', trainingLead: 'للاطلاع قبل إرسال الطلب:', trainingFile: 'ملف الاستشارات والبرامج التدريبية PDF ↗', mediaLead: 'للصحافة والبرامج:', mediaFile: 'الملف الإعلامي المعتمد PDF ↗', dir: 'rtl' as const,
  },
  en: {
    eyebrow: 'Direct enquiry', title: 'How can I help?', change: 'Change request type', name: 'Name', email: 'Email address', message: 'Message', send: 'Send enquiry', sending: 'Sending…', secure: 'Sending your message securely…', success: 'Your message has arrived.', successNote: 'Keep the reference number above if you need to follow up. Replies usually take two to three working days, and your email is used only to respond.', recent: 'A message was sent recently. Please wait one minute and try again.', invalid: 'Complete your name, a valid email address, and a message of at least 10 characters.', disabled: 'The form is not available right now. Please use the contact links below.', failed: 'The message could not be sent. Please try again later or contact me through the listed profiles.', trainingLead: 'Before sending your request:', trainingFile: 'Consulting and training profile PDF ↗', mediaLead: 'For press and programmes:', mediaFile: 'Official media kit PDF ↗', dir: 'ltr' as const,
  },
}

function contactInsight(topic: TopicKey | null, message: string) {
  const text = message.toLowerCase()
  const hasDate = /\d{4}|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|january|february|march|april|may|june|july|august|september|october|november|december/.test(text)
  const hasOrg = /جامعة|مدرسة|وزارة|هيئة|مؤتمر|ملتقى|شركة|كلية|مركز|university|school|ministry|authority|conference|company|college|centre|center/.test(text)
  const kind = topic === 'محاضرة أو ورشة' ? 'طلب فعالية' : topic === 'لقاء إعلامي' ? 'طلب إعلامي' : topic === 'استشارة' ? 'استشارة' : /بحث|دراسة|ورقة|research|study|paper/.test(text) ? 'تعاون أكاديمي' : 'طلب عام'
  const clarity = [hasDate, hasOrg, message.length > 160].filter(Boolean).length
  return { intent: kind, quality: clarity >= 2 ? 'جاد وواضح' : clarity === 1 ? 'يحتاج تفصيل بسيط' : 'يحتاج توضيح' }
}

export function ContactForm({ locale = 'ar' }: { locale?: Locale }) {
  const ui = copy[locale]
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState<TopicKey | null>(null)
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [reference, setReference] = useState('')
  const active = TOPICS.find((item) => item.key === topic)
  const draftKey = `contact:draft:v2:${locale}`

  useEffect(() => {
    try {
      /* بأمر الدكتور: الدخول إلى النموذج يبدأ دائماً بصفحة اختيار نوع الطلب
         (استشارة/إعلامي/محاضرة…)؛ نستعيد الاسم والبريد والرسالة من المسودة
         ولا نستعيد النوع كي لا يقفز الزائر فوق صفحة الاختيار. */
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (draft && typeof draft === 'object') draft.topic = null
      if (draft && typeof draft === 'object') {
        if (draft.name) setName(String(draft.name))
        if (draft.email) setEmail(String(draft.email))
        if (draft.message) setMessage(String(draft.message))
        if (draft.topic && TOPICS.some((item) => item.key === draft.topic)) setTopic(draft.topic)
      }
    } catch { /* private mode */ }
  }, [draftKey])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { if (name || email || message || topic) localStorage.setItem(draftKey, JSON.stringify({ name, email, message, topic })) } catch { /* private mode */ }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [draftKey, email, message, name, topic])

  const valid = name.trim().length > 1 && /^\S+@\S+\.\S+$/.test(email) && message.trim().length > 10

  const submit = async () => {
    if (website.trim()) return
    const last = Number(localStorage.getItem('contact:last-submit') || 0)
    if (Date.now() - last < 60_000) { setErr(ui.recent); setState('error'); return }
    if (!valid) { setErr(ui.invalid); setState('error'); return }
    if (!firebaseEnabled) { setErr(ui.disabled); setState('error'); return }
    setState('sending')
    try {
      const insight = contactInsight(topic, message)
      const referenceNumber = `AH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(Math.floor(1000 + Math.random() * 9000))}`
      const apiResponse = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), topic: topic || 'أخرى', message: message.trim(), intent: insight.intent, quality: insight.quality, reference: referenceNumber }),
      }).catch(() => null)
      if (!apiResponse?.ok) {
        // رجوع آمن للكتابة المباشرة حتى لا تضيع رسالة الزائر إذا تعطل dr-api مؤقتاً.
        const db = await getDb()
        if (!db) throw new Error('no-db')
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
        await addDoc(collection(db, 'messages'), { name: name.trim(), email: email.trim(), topic: topic || 'أخرى', message: message.trim(), intent: insight.intent, quality: insight.quality, reference: referenceNumber, createdAt: serverTimestamp() })
      }
      try { localStorage.setItem('contact:last-submit', String(Date.now())); localStorage.removeItem(draftKey) } catch { /* private mode */ }
      setReference(referenceNumber); setState('done'); setName(''); setEmail(''); setMessage('')
    } catch { setErr(ui.failed); setState('error') }
  }

  if (state === 'done') return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease: EASE }} className="rounded-2xl border border-hair bg-wash p-10 text-center" role="status" aria-live="polite" dir={ui.dir}>
      <span className="font-display text-[1.6rem] font-semibold text-accent">{ui.success}</span>
      {reference && <p className="mt-4 inline-block rounded-full border border-accent/30 bg-canvas px-5 py-2 text-[.85rem] font-semibold text-accent" dir="ltr">{reference}</p>}
      <p className="mt-3 text-[.98rem] font-light leading-relaxed text-soft">{ui.successNote}</p>
    </motion.div>
  )

  const field = 'w-full rounded-xl border border-hair bg-canvas px-5 py-3.5 text-[.98rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent'
  return (
    <div className={`rounded-2xl border border-hair bg-wash p-8 md:p-10 ${locale === 'ar' ? 'text-right' : 'text-left'}`} dir={ui.dir}>
      <span className="text-[.76rem] font-semibold uppercase text-accent">{ui.eyebrow}</span>
      <h3 className="mt-3 font-display text-[1.5rem] font-semibold text-ink">{ui.title}</h3>
      {!active ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {TOPICS.map((item) => (
            <button key={item.key} type="button" onClick={() => setTopic(item.key)} className={`group rounded-xl border border-hair bg-canvas p-5 transition-colors hover:border-accent ${locale === 'ar' ? 'text-right' : 'text-left'}`}>
              <span className="block font-display text-[1.05rem] font-semibold text-ink transition-colors group-hover:text-accent">{locale === 'ar' ? item.ar : item.en}</span>
              <span className="mt-1 block text-[.84rem] font-light text-soft">{locale === 'ar' ? item.dAr : item.dEn}</span>
            </button>
          ))}
        </div>
      ) : (
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, ease: EASE }} onSubmit={(event) => { event.preventDefault(); void submit() }} noValidate>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-accent px-4 py-1.5 text-[.84rem] font-medium text-canvas">{locale === 'ar' ? active.ar : active.en}</span>
            <button type="button" onClick={() => { setTopic(null); setState('idle') }} className="text-[.8rem] text-soft transition-colors hover:text-accent">{ui.change}</button>
          </div>
          {(active.key === 'استشارة' || active.key === 'محاضرة أو ورشة') && <p className="mt-3 text-[.76rem] leading-relaxed text-soft">{ui.trainingLead} <a href="/files/Dr-Ahmad-Training-Profile.pdf" target="_blank" rel="noreferrer" className="font-medium text-accent hover:text-accent-deep">{ui.trainingFile}</a></p>}
          {active.key === 'لقاء إعلامي' && <p className="mt-3 text-[.76rem] leading-relaxed text-soft">{ui.mediaLead} <a href="/files/Dr-Ahmad-Media-Kit.pdf" target="_blank" rel="noreferrer" className="font-medium text-accent hover:text-accent-deep">{ui.mediaFile}</a></p>}
          <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
            <label className="sr-only" htmlFor={`contact-name-${locale}`}>{ui.name}</label>
            <input id={`contact-name-${locale}`} name="name" autoComplete="name" maxLength={80} value={name} onChange={(event) => { setName(event.target.value); setState('idle') }} placeholder={ui.name} aria-label={ui.name} className={field} />
            <label className="sr-only" htmlFor={`contact-email-${locale}`}>{ui.email}</label>
            <input id={`contact-email-${locale}`} name="email" type="email" inputMode="email" autoComplete="email" maxLength={200} value={email} onChange={(event) => { setEmail(event.target.value); setState('idle') }} placeholder={ui.email} aria-label={ui.email} dir="ltr" className={field} />
          </div>
          <label className="sr-only" htmlFor={`contact-website-${locale}`}>Website</label>
          <input id={`contact-website-${locale}`} name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" placeholder="Website" />
          <label className="sr-only" htmlFor={`contact-message-${locale}`}>{ui.message}</label>
          <textarea id={`contact-message-${locale}`} name="message" maxLength={3000} value={message} onChange={(event) => { setMessage(event.target.value); setState('idle') }} placeholder={locale === 'ar' ? active.hintAr : active.hintEn} aria-label={ui.message} rows={5} className={`${field} mt-3.5 resize-none leading-[1.9]`} />
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="submit" disabled={state === 'sending'} className="rounded-full bg-accent px-8 py-3.5 font-semibold text-canvas transition-colors hover:bg-accent-deep disabled:opacity-60">{state === 'sending' ? ui.sending : ui.send}</button>
            <span className="text-[.86rem] text-soft" role="status" aria-live="polite" aria-atomic="true">{state === 'error' ? err : state === 'sending' ? ui.secure : ''}</span>
          </div>
        </motion.form>
      )}
    </div>
  )
}
