import { useEffect, useMemo, useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth'
import { arabicCountPhrase, SUBSCRIBER_AFTER_PREPOSITION_FORMS, SUBSCRIBER_FORMS } from '../../lib/arabic-count.ts'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.9rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'

type Draft = { id: string; title: string; text: string; source?: string; createdAt?: { seconds: number } }
type SendRow = { id: string; subject?: string; kind?: string; recipientCount?: number; acceptedCount?: number; failedCount?: number; status?: string; createdAt?: { seconds?: number; _seconds?: number } | string }
type Delivery = { id: string; sendId?: string; email?: string; state?: string }
type State = { configured: boolean; provider: string; from: string; recipientCount: number; testEmail: string; missing: string[]; sends: SendRow[]; deliveries: Delivery[] }

function dateLabel(value: SendRow['createdAt']) {
  if (!value) return ''
  const seconds = typeof value === 'string' ? 0 : Number(value.seconds || value._seconds || 0)
  const date = typeof value === 'string' ? new Date(value) : seconds ? new Date(seconds * 1000) : null
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('ar-KW-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

export function NewsletterCenter({ draft }: { draft: Draft | null }) {
  const { user } = useAdminAuth()
  const [subject, setSubject] = useState(draft?.title || '')
  const [text, setText] = useState(draft?.text || '')
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    if (!draft) return
    setSubject(draft.title)
    setText(draft.text)
  }, [draft?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const authorized = async (path: string, init: RequestInit = {}) => {
    if (!user) throw new Error('انتهت جلسة المشرف.')
    const token = await user.getIdToken()
    const response = await fetch(path, {
      ...init,
      cache: 'no-store',
      headers: { accept: 'application/json', authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(payload?.error || 'تعذّر تنفيذ طلب النشرة.'))
    return payload
  }

  const refresh = async () => {
    if (!user) return
    try { setState(await authorized('/api/admin/newsletter') as State) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'تعذّر فحص النشرة.') }
  }
  useEffect(() => { void refresh() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (action: 'test' | 'send') => {
    if (!subject.trim() || text.trim().length < 20) { setNotice('اكتب عنواناً ونصاً كاملاً أولاً.'); return }
    if (action === 'send') {
      const count = Number(state?.recipientCount || 0)
      if (!count) { setNotice('لا يوجد مشتركون صالحون للإرسال.'); return }
      if (!window.confirm(`سيتم إرسال هذه النشرة إلى ${arabicCountPhrase(count, SUBSCRIBER_AFTER_PREPOSITION_FORMS)}. هل اعتمدت المعاينة والاختبار؟`)) return
    }
    setBusy(action)
    setNotice('')
    try {
      const result = await authorized('/api/admin/newsletter', {
        method: 'POST',
        body: JSON.stringify({ action, subject: subject.trim(), text: text.trim(), confirm: action === 'send' ? 'SEND_TO_ALL' : undefined }),
      })
      setNotice(action === 'test'
        ? `تم إرسال نسخة الاختبار إلى ${String(result.target || state?.testEmail || 'بريدك')}.`
        : `اكتمل الإرسال: ${Number(result.accepted || 0)} مقبول لدى مزوّد البريد${Number(result.failed || 0) ? `، و${Number(result.failed)} فشل.` : '.'}`)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذّر الإرسال.')
    } finally { setBusy('') }
  }

  const latest = useMemo(() => (state?.sends || []).slice(0, 6), [state?.sends])
  const deliveriesFor = (id: string) => (state?.deliveries || []).filter((row) => row.sendId === id)

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[.76rem] font-semibold text-accent">غرفة تحرير النشرة</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink">معاينة ← تعديل ← اختبار لنفسك ← إرسال</h2>
          <p className="mt-2 text-[.82rem] leading-relaxed text-soft">لا توجد أي عملية إرسال تلقائي. الإرسال الجماعي لا يبدأ إلا بعد تأكيدك الصريح.</p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-[.72rem] font-semibold ${state?.configured ? 'border-accent/25 bg-accent/[.06] text-accent' : 'border-hair bg-canvas text-soft'}`}>
          {state?.configured ? `${state.provider} جاهز · ${arabicCountPhrase(state.recipientCount, SUBSCRIBER_FORMS)}` : 'الإرسال الحقيقي ينتظر الإعداد'}
        </span>
      </div>

      {!state?.configured && state?.missing?.length ? (
        <div className="mt-4 rounded-xl border border-hair bg-canvas p-4 text-[.78rem] leading-relaxed text-soft">الواجهة جاهزة بالكامل، لكن الخادم يحتاج مرة واحدة: <span dir="ltr" className="font-mono text-ink">{state.missing.join(' + ')}</span>.</div>
      ) : null}

      <div className="mt-5 grid gap-3">
        <input className={input} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="عنوان البريد" maxLength={220} />
        <textarea className={`${input} min-h-[220px] leading-loose`} value={text} onChange={(event) => setText(event.target.value)} placeholder="نص النشرة…" maxLength={20_000} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowPreview((value) => !value)} className="rounded-full border border-hair bg-canvas px-4 py-2 text-[.78rem] font-semibold text-soft hover:border-accent hover:text-accent">{showPreview ? 'إخفاء المعاينة' : 'معاينة الرسالة'}</button>
        <button type="button" onClick={() => void send('test')} disabled={busy !== '' || !state?.configured} className="rounded-full border border-accent/30 bg-canvas px-4 py-2 text-[.78rem] font-semibold text-accent disabled:opacity-40">{busy === 'test' ? 'أرسل الاختبار…' : `اختبار لنفسي${state?.testEmail ? ` · ${state.testEmail}` : ''}`}</button>
        <button type="button" onClick={() => void send('send')} disabled={busy !== '' || !state?.configured || !state?.recipientCount} className="rounded-full bg-accent px-5 py-2 text-[.78rem] font-semibold text-white disabled:opacity-40">{busy === 'send' ? 'جارٍ الإرسال…' : `إرسال إلى ${arabicCountPhrase(state?.recipientCount || 0, SUBSCRIBER_AFTER_PREPOSITION_FORMS)}`}</button>
        {notice && <span className="text-[.76rem] text-soft">{notice}</span>}
      </div>

      {showPreview && (subject || text) && (
        <div className="mt-5 rounded-2xl border border-hair bg-canvas p-5">
          <p className="text-[.7rem] font-semibold text-soft">كما ستظهر للقارئ تقريباً</p>
          <h3 className="mt-3 font-display text-xl font-bold leading-relaxed text-ink">{subject || 'عنوان الرسالة'}</h3>
          <div className="mt-4 whitespace-pre-wrap text-[.88rem] leading-[2] text-ink">{text || 'نص الرسالة'}</div>
          <p className="mt-6 border-t border-hair pt-4 text-[.7rem] leading-relaxed text-soft">يضيف الخادم تلقائياً سبب استلام الرسالة ورابط إلغاء الاشتراك لكل مشترك في الإرسال الحقيقي.</p>
        </div>
      )}

      <div className="mt-6 border-t border-hair pt-5">
        <p className="font-semibold text-ink">سجل الإرسال</p>
        <p className="mt-1 text-[.74rem] text-soft">«مقبول» يعني أن مزوّد البريد قبل الرسالة للإرسال؛ لا ندّعي أنها فُتحت أو قُرئت.</p>
        {latest.length ? <div className="mt-3 grid gap-2">{latest.map((row) => {
          const deliveries = deliveriesFor(row.id)
          return <details key={row.id} className="rounded-xl border border-hair bg-canvas p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-semibold text-[.84rem] text-ink">{row.kind === 'test' ? 'اختبار · ' : ''}{row.subject || 'نشرة'}</span>
                <span className="text-[.7rem] text-soft">{dateLabel(row.createdAt)} · {row.acceptedCount ?? 0}/{row.recipientCount ?? 0} مقبول</span>
              </div>
            </summary>
            {deliveries.length ? <div className="mt-3 grid gap-1 border-t border-hair pt-3">{deliveries.slice(0, 100).map((delivery) => <div key={delivery.id} className="flex justify-between gap-3 text-[.72rem]"><span dir="ltr" className="truncate text-ink">{delivery.email}</span><span className={delivery.state === 'accepted' ? 'text-accent' : 'text-soft'}>{delivery.state === 'accepted' ? 'مقبول' : 'فشل'}</span></div>)}</div> : <p className="mt-3 text-[.72rem] text-soft">لا توجد تفاصيل مستلمة لهذه العملية في هذه الصفحة.</p>}
          </details>
        })}</div> : <p className="mt-3 text-[.8rem] text-soft">لم تُرسل أي نشرة من المركز حتى الآن.</p>}
      </div>
    </section>
  )
}
