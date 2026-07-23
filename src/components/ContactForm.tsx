import { useState } from 'react'
import { motion } from 'framer-motion'
import { EASE } from './ui'
import { firebaseEnabled, getDb } from '../lib/firebase'

/* «مساعد اختيار» لا نموذج طويل (فكرة نووية ٩ للصديق):
   يبدأ بسؤال واحد، وبعد الاختيار تظهر الحقول الضرورية فقط بإرشادٍ يناسب نوع الطلب.
   حقول فايرستور نفسها (name/email/topic/message) — القواعد الأمنية بلا تغيير. */
const TOPICS = [
  { key: 'استشارة', d: 'رأي خبير في مشروع أو تحدٍّ تعليمي/تقني', hint: 'صف التحدي أو المشروع باختصار: المجال، والجهة إن وُجدت، وما تطمح إليه.' },
  { key: 'محاضرة أو ورشة', d: 'حضورياً أو عن بُعد — للجهات والمؤتمرات', hint: 'الجهة، الموضوع المقترح، التاريخ التقريبي، والمكان (أو عن بُعد).' },
  { key: 'لقاء إعلامي', d: 'تلفزيون، إذاعة، بودكاست، صحافة', hint: 'اسم البرنامج أو الوسيلة، محور الحلقة، وموعد التسجيل أو البث.' },
  { key: 'أخرى', d: 'تعاون بحثي، فكرة، أو أي شيء آخر', hint: 'اكتب ما يدور في بالك بحرية…' },
] as const
type TopicKey = (typeof TOPICS)[number]['key']

function contactInsight(topic: TopicKey | null, message: string) {
  const text = message.toLowerCase()
  const hasDate = /\d{4}|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر/.test(text)
  const hasOrg = /جامعة|مدرسة|وزارة|هيئة|مؤتمر|ملتقى|شركة|كلية|مركز/.test(text)
  const kind = topic === 'محاضرة أو ورشة'
    ? 'طلب فعالية'
    : topic === 'لقاء إعلامي'
      ? 'طلب إعلامي'
      : topic === 'استشارة'
        ? 'استشارة'
        : /بحث|دراسة|ورقة/.test(text)
          ? 'تعاون أكاديمي'
          : 'طلب عام'
  const clarity = [hasDate, hasOrg, message.length > 160].filter(Boolean).length
  return {
    intent: kind,
    quality: clarity >= 2 ? 'جاد وواضح' : clarity === 1 ? 'يحتاج تفصيل بسيط' : 'يحتاج توضيح',
  }
}

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState<TopicKey | null>(null)
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')

  const active = TOPICS.find((t) => t.key === topic)

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
      const insight = contactInsight(topic, message)
      await addDoc(collection(db, 'messages'), {
        name: name.trim(),
        email: email.trim(),
        topic: topic || 'أخرى',
        message: message.trim(),
        intent: insight.intent,
        quality: insight.quality,
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
      <span className="text-[.76rem] font-semibold uppercase text-accent">راسلني مباشرة</span>
      <h3 className="mt-3 font-display text-[1.5rem] font-semibold text-ink">كيف يمكن أن أساعدك؟</h3>

      {!active ? (
        /* ── الخطوة الأولى: الاختيار وحده — لا حقول تُربك ── */
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTopic(t.key)}
              className="group rounded-xl border border-hair bg-canvas p-5 text-right transition-colors duration-300 hover:border-accent"
            >
              <span className="block font-display text-[1.05rem] font-semibold text-ink transition-colors group-hover:text-accent">{t.key}</span>
              <span className="mt-1 block text-[.84rem] font-light text-soft">{t.d}</span>
            </button>
          ))}
        </div>
      ) : (
        /* ── الخطوة الثانية: الحقول الضرورية فقط، بإرشاد يناسب الطلب ── */
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-accent px-4 py-1.5 text-[.84rem] font-medium text-canvas">{active.key}</span>
            <button onClick={() => { setTopic(null); setState('idle') }} className="text-[.8rem] text-soft transition-colors hover:text-accent">
              غيّر نوع الطلب
            </button>
          </div>
          {(active.key === 'استشارة' || active.key === 'محاضرة أو ورشة') && (
            <p className="mt-3 text-[.76rem] leading-relaxed text-soft">
              للاطلاع قبل إرسال الطلب: <a href="/files/Dr-Ahmad-Training-Profile.pdf" target="_blank" rel="noreferrer" className="font-medium text-accent transition-colors hover:text-accent-deep">ملف الاستشارات والبرامج التدريبية PDF ↗</a>
            </p>
          )}
          {active.key === 'لقاء إعلامي' && (
            <p className="mt-3 text-[.76rem] leading-relaxed text-soft">
              للصحافة والبرامج: <a href="/files/Dr-Ahmad-Media-Kit.pdf" target="_blank" rel="noreferrer" className="font-medium text-accent transition-colors hover:text-accent-deep">الملف الإعلامي المعتمد PDF ↗</a>
            </p>
          )}

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
            placeholder={active.hint}
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
        </motion.div>
      )}
    </div>
  )
}
