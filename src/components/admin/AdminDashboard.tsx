import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../lib/firebase'
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from '../../lib/cms'
import type { LaunchKind, LaunchMode } from '../../lib/settings'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const softButton = 'rounded-full border border-hair px-4 py-2 text-[.82rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent'
const primaryButton = 'rounded-full bg-accent px-5 py-2.5 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.9rem] text-ink outline-none transition-colors focus:border-accent'

const kuwaitDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

type DashboardData = {
  messages: number
  todayViews: number
  topTitle: string
  topCount: number
  health: 'سليم' | 'تنبيه' | 'غير متاح'
  healthIssues: number
}

export function QuietCommandCenter({ articles, onNavigate }: { articles: ArticleRecord[]; onNavigate: (tab: string) => void }) {
  const [data, setData] = useState<DashboardData>({ messages: 0, todayViews: 0, topTitle: '—', topCount: 0, health: 'غير متاح', healthIssues: 0 })
  const [loading, setLoading] = useState(true)
  const missingAudio = articles.filter((article) => !article.hasAudio && !article._cms.hidden).length
  const scheduled = articles.filter((article) => article.status === 'scheduled').length
  const drafts = articles.filter((article) => article.status === 'draft' || article._cms.hidden).length

  const load = async () => {
    setLoading(true)
    try {
      const db = await getDb()
      if (!db) return
      const { collection, getDocs } = await import('firebase/firestore')
      const safe = async (name: string) => { try { return await getDocs(collection(db, name)) } catch { return null } }
      const [messages, views, health] = await Promise.all([safe('messages'), safe('views'), safe('site_health')])
      const today = kuwaitDate()
      const viewRows = (views?.docs || []).map((item) => ({ id: item.id, ...(item.data() as { count?: number; title?: string }) }))
      const todayViews = viewRows.filter((row) => row.id.startsWith(`day:${today}:`)).reduce((sum, row) => sum + Number(row.count || 0), 0)
      const totals = viewRows.filter((row) => row.id.startsWith('total:')).sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      const latestHealth = (health?.docs || []).map((item) => item.data() as { date?: string; status?: string; issueCount?: number }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
      setData({
        messages: messages?.size || 0,
        todayViews,
        topTitle: totals[0]?.title || 'لا توجد مشاهدة بعد',
        topCount: Number(totals[0]?.count || 0),
        health: latestHealth ? (latestHealth.status === 'سليم' ? 'سليم' : 'تنبيه') : 'غير متاح',
        healthIssues: Number(latestHealth?.issueCount || 0),
      })
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const decisions = useMemo(() => {
    const items: { label: string; note: string; tab: string; count: number }[] = []
    if (data.messages) items.push({ label: 'راجع الرسائل الجديدة', note: 'طلبات التعاون والاستشارات تنتظر قرارك.', tab: 'inbox', count: data.messages })
    if (scheduled) items.push({ label: 'راجع المحتوى المجدول', note: 'تأكد من المواعيد قبل النشر التلقائي.', tab: 'articles', count: scheduled })
    if (missingAudio) items.push({ label: 'أكمل التغطية الصوتية', note: 'مقالات منشورة بلا قراءة أو حوار بعد.', tab: 'lab', count: missingAudio })
    if (drafts) items.push({ label: 'راجع المسودات والمخفي', note: 'محتوى محفوظ لا يظهر للزوار.', tab: 'articles', count: drafts })
    if (data.health === 'تنبيه') items.push({ label: 'راجع صحة المحتوى', note: 'هناك مصادر أو مواد تحتاج قراراً.', tab: 'content-health', count: data.healthIssues })
    return items
  }, [data.health, data.healthIssues, data.messages, drafts, missingAudio, scheduled])

  return (
    <div className="admin-dashboard grid gap-5">
      <section className={`${card} overflow-hidden border-accent/25 bg-accent/[.035]`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[.76rem] font-semibold uppercase text-accent">غرفة القيادة الصامتة</p>
            <h2 className="mt-2 font-display text-[clamp(1.55rem,3vw,2.25rem)] font-semibold leading-[1.4] text-ink">
              {loading ? 'أرتّب أولويات اليوم…' : decisions.length ? `اليوم لديك ${decisions.length} ${decisions.length === 1 ? 'قرار' : 'قرارات'} فقط.` : 'كل شيء تحت السيطرة.'}
            </h2>
            <p className="mt-2 max-w-2xl text-[.88rem] leading-relaxed text-soft">لا تعرض هذه الصفحة كل ما يستطيع النظام فعله؛ تعرض فقط ما يحتاج انتباهك الآن.</p>
          </div>
          <button type="button" onClick={() => void load()} className={softButton}>تحديث اللحظة</button>
        </div>
        {decisions.length > 0 ? <ol className="mt-7 grid gap-3">
          {decisions.map((item, index) => <li key={item.label}><button onClick={() => onNavigate(item.tab)} className="group flex w-full items-center gap-4 rounded-2xl border border-hair bg-canvas p-4 text-right transition-colors hover:border-accent"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 font-display font-bold text-accent">{index + 1}</span><span className="min-w-0 flex-1"><span className="block font-semibold text-ink group-hover:text-accent">{item.label}</span><span className="mt-1 block text-[.78rem] leading-relaxed text-soft">{item.note}</span></span><span className="rounded-full border border-hair px-3 py-1 text-[.74rem] font-semibold text-accent">{item.count}</span></button></li>)}
        </ol> : !loading && <div className="mt-7 rounded-2xl border border-hair bg-canvas p-6 text-center"><p className="font-display text-xl font-semibold text-ink">لا شيء عالق.</p><p className="mt-2 text-[.84rem] text-soft">النشر مستقر، والرسائل هادئة، والنظام لا يطلب تدخلك.</p></div>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="مؤشرات اليوم المختصرة">
        {[
          ['مشاهدات اليوم', data.todayViews, 'analytics'],
          ['الرسائل', data.messages, 'inbox'],
          ['المحتوى المجدول', scheduled, 'articles'],
          ['حالة المحتوى', data.health === 'سليم' ? 'سليم' : data.health === 'تنبيه' ? `${data.healthIssues} تنبيه` : '—', 'content-health'],
        ].map(([label, value, tab]) => <button key={String(label)} onClick={() => onNavigate(String(tab))} className={`${card} text-right transition-colors hover:border-accent`}><span className="text-[.74rem] font-semibold text-soft">{label}</span><span className="mt-2 block font-display text-2xl font-bold text-ink">{value}</span></button>)}
      </section>

      <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div><p className="text-[.75rem] font-semibold text-accent">الأكثر حضوراً</p><p className="mt-1 font-display text-lg font-semibold text-ink">{data.topTitle}</p><p className="mt-1 text-[.78rem] text-soft">{data.topCount ? `${data.topCount} مشاهدة تراكمية` : 'سيظهر هنا بعد بدء التفاعل.'}</p></div>
        <button onClick={() => onNavigate('analytics')} className={softButton}>افتح التحليلات التفصيلية ←</button>
      </section>
    </div>
  )
}

const KIND_LABEL: Record<LaunchKind, string> = { article: 'مقال', book: 'كتاب', paper: 'بحث', media: 'ظهور إعلامي' }

export function LaunchModeCard({ articles, books, papers, media }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const [form, setForm] = useState<LaunchMode>({ enabled: false, kind: 'article', slug: '', until: '', eyebrow: '', note: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const lists = { article: articles, book: books, paper: papers, media }
  const currentItems = lists[form.kind]

  useEffect(() => {
    ;(async () => {
      try {
        const db = await getDb(); if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snapshot = await getDoc(doc(db, 'site_settings', 'launch'))
        if (snapshot.exists()) setForm((previous) => ({ ...previous, ...(snapshot.data() as LaunchMode) }))
      } catch { /* noop */ }
    })()
  }, [])

  useEffect(() => {
    if (!currentItems.some((item) => item.slug === form.slug)) setForm((previous) => ({ ...previous, slug: currentItems[0]?.slug || '' }))
  }, [currentItems, form.slug])


  const toLocalInput = (iso?: string) => {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
  }

  const setDuration = (days: number) => {
    const date = new Date(Date.now() + days * 864e5)
    setForm((previous) => ({ ...previous, enabled: true, until: date.toISOString() }))
  }
  const save = async (enabled = form.enabled) => {
    setBusy(true); setMessage('')
    try {
      const db = await getDb(); if (!db) throw new Error('Firebase غير متاح')
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      await setDoc(doc(db, 'site_settings', 'launch'), { ...form, enabled, updatedAt: serverTimestamp() }, { merge: true })
      setForm((previous) => ({ ...previous, enabled }))
      setMessage(enabled ? '✓ وضع الإطلاق يعمل الآن على الرئيسية.' : '✓ عادت الرئيسية إلى غلافها الأساسي.')
    } catch { setMessage('تعذّر حفظ وضع الإطلاق.') }
    setBusy(false)
  }

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[.76rem] font-semibold uppercase text-accent">وضع الإطلاق</p><h2 className="mt-1 font-display text-xl font-semibold text-ink">حوّل الشاشة الأولى إلى غلاف حدث مؤقت.</h2><p className="mt-2 max-w-2xl text-[.84rem] leading-relaxed text-soft">لا يغيّر المحتوى ولا يحذف شيئاً. يضع عملاً واحداً في الواجهة حتى الموعد الذي تحدده، ثم تعود الهوية الأصلية تلقائياً.</p></div>
        <span className={`rounded-full border px-3 py-1 text-[.75rem] font-semibold ${form.enabled ? 'border-accent bg-accent text-white' : 'border-hair text-soft'}`}>{form.enabled ? 'مفعّل' : 'متوقف'}</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-[.78rem] font-semibold text-soft">نوع الإطلاق<select className={input} value={form.kind} onChange={(event) => setForm((previous) => ({ ...previous, kind: event.target.value as LaunchKind, slug: '' }))}>{(Object.keys(KIND_LABEL) as LaunchKind[]).map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}</select></label>
        <label className="grid gap-2 text-[.78rem] font-semibold text-soft">العمل المختار<select className={input} value={form.slug} onChange={(event) => setForm((previous) => ({ ...previous, slug: event.target.value }))}>{currentItems.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select></label>
        <label className="grid gap-2 text-[.78rem] font-semibold text-soft">عبارة صغيرة فوق العنوان<input className={input} value={form.eyebrow || ''} onChange={(event) => setForm((previous) => ({ ...previous, eyebrow: event.target.value }))} placeholder={`مثال: ${KIND_LABEL[form.kind]} جديد`} /></label>
        <label className="grid gap-2 text-[.78rem] font-semibold text-soft">ملاحظة قصيرة<input className={input} value={form.note || ''} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="اختياري — يظهر تحت العنوان" /></label>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_minmax(250px,.75fr)] lg:items-end">
        <div className="flex flex-wrap items-center gap-2"><span className="text-[.78rem] text-soft">مدة سريعة:</span>{[[1, '24 ساعة'], [3, '3 أيام'], [7, 'أسبوع']].map(([days, label]) => <button key={String(days)} onClick={() => setDuration(Number(days))} className={softButton}>{label}</button>)}</div>
        <label className="grid gap-2 text-[.78rem] font-semibold text-soft">أو حدّد موعد النهاية بدقة<input type="datetime-local" className={input} value={toLocalInput(form.until)} onChange={(event) => setForm((previous) => ({ ...previous, enabled: true, until: event.target.value ? new Date(event.target.value).toISOString() : '' }))} /></label>
      </div>
      {form.until && <p className="mt-3 text-[.78rem] text-soft">ينتهي تلقائياً: {new Date(form.until).toLocaleString('ar-KW-u-nu-latn', { dateStyle: 'long', timeStyle: 'short' })}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3"><button disabled={busy || !form.slug} onClick={() => void save(true)} className={primaryButton}>{busy ? 'أحفظ…' : form.enabled ? 'تحديث الإطلاق' : 'ضعه في الواجهة'}</button>{form.enabled && <button disabled={busy} onClick={() => void save(false)} className={softButton}>إنهاء الآن</button>}{message && <span className="text-[.8rem] font-semibold text-accent">{message}</span>}</div>
    </section>
  )
}
