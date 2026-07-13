import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { getDb } from '../../lib/firebase'
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from '../../lib/cms'
import { EASE } from '../motion'

export type AdminTab =
  | 'dashboard'
  | 'analytics'
  | 'studio'
  | 'launch'
  | 'event'
  | 'articles'
  | 'books'
  | 'papers'
  | 'media'
  | 'inbox'
  | 'lab'
  | 'voice'
  | 'cv'

export type AdminArea = 'today' | 'publishing' | 'library' | 'audience' | 'system'

type NavItem = { tab: AdminTab; label: string; note: string }
type NavGroup = { area: AdminArea; label: string; icon: string; items: NavItem[] }

export const ADMIN_GROUPS: NavGroup[] = [
  {
    area: 'today', label: 'اليوم', icon: '◉', items: [
      { tab: 'dashboard', label: 'غرفة القيادة', note: 'ما يحتاج قرارك الآن' },
    ],
  },
  {
    area: 'publishing', label: 'النشر', icon: '↗', items: [
      { tab: 'studio', label: 'استوديو النشر', note: 'من الفكرة إلى الحزمة' },
      { tab: 'launch', label: 'وضع الإطلاق', note: 'ضع عملاً في الواجهة' },
      { tab: 'event', label: 'اللقاءات', note: 'إضافة موعد قادم' },
    ],
  },
  {
    area: 'library', label: 'المكتبة', icon: '▦', items: [
      { tab: 'articles', label: 'المقالات', note: 'إنشاء وتحرير وجدولة' },
      { tab: 'books', label: 'الكتب', note: 'المؤلفات والملفات' },
      { tab: 'papers', label: 'الأبحاث', note: 'المساهمات العلمية' },
      { tab: 'media', label: 'الإعلام', note: 'الظهور واللقاءات' },
    ],
  },
  {
    area: 'audience', label: 'الجمهور', icon: '◎', items: [
      { tab: 'inbox', label: 'الرسائل', note: 'طلبات التواصل والتعاون' },
      { tab: 'analytics', label: 'التحليلات', note: 'المشاهدات ورحلة الزائر' },
    ],
  },
  {
    area: 'system', label: 'النظام', icon: '⚙', items: [
      { tab: 'lab', label: 'المختبر المتقدم', note: 'الفحص والذاكرة والأتمتة' },
      { tab: 'voice', label: 'الصوت والبودكاست', note: 'اختبار الأصوات والجودة' },
      { tab: 'cv', label: 'السيرة والهوية', note: 'ملفات السيرة العامة' },
    ],
  },
]

export const areaOfTab = (tab: AdminTab): AdminArea =>
  ADMIN_GROUPS.find((group) => group.items.some((item) => item.tab === tab))?.area || 'today'

export const defaultTabForArea = (area: AdminArea): AdminTab =>
  ADMIN_GROUPS.find((group) => group.area === area)?.items[0].tab || 'dashboard'

export function AdminAreaTabs({ tab, onSelect }: { tab: AdminTab; onSelect: (tab: AdminTab) => void }) {
  const activeArea = areaOfTab(tab)
  return (
    <div className="rail mb-3 hidden gap-2 overflow-x-auto pb-1 md:flex">
      {ADMIN_GROUPS.map((group) => {
        const active = activeArea === group.area
        return (
          <button
            key={group.area}
            type="button"
            onClick={() => onSelect(defaultTabForArea(group.area))}
            className={`shrink-0 rounded-full px-4 py-2 text-[.82rem] font-semibold transition-colors ${active ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
          >
            {group.label}
          </button>
        )
      })}
    </div>
  )
}

export function AdminSectionTabs({ tab, onSelect }: { tab: AdminTab; onSelect: (tab: AdminTab) => void }) {
  const area = areaOfTab(tab)
  const group = ADMIN_GROUPS.find((item) => item.area === area)
  if (!group) return null
  return (
    <div className="rail mb-6 flex gap-2 overflow-x-auto pb-1">
      {group.items.map((item) => (
        <button key={item.tab} type="button" onClick={() => onSelect(item.tab)} className={`shrink-0 rounded-full px-4 py-2 text-[.8rem] font-semibold transition-colors ${tab === item.tab ? 'bg-ink text-white' : 'border border-hair bg-wash text-soft hover:border-accent hover:text-accent'}`}>
          {item.label}
        </button>
      ))}
    </div>
  )
}


export function AdminSidebar({ tab, onSelect }: { tab: AdminTab; onSelect: (tab: AdminTab) => void }) {
  return (
    <aside className="hidden md:block">
      <div className="sticky top-24 rounded-3xl border border-hair bg-wash p-3">
        {ADMIN_GROUPS.map((group, groupIndex) => (
          <div key={group.area} className={groupIndex ? 'mt-3 border-t border-hair pt-3' : ''}>
            <p className="flex items-center gap-2 px-3 pb-1 text-[.72rem] font-semibold text-accent">
              <span aria-hidden className="w-4 text-center">{group.icon}</span>
              {group.label}
            </p>
            <div className="grid gap-1">
              {group.items.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => onSelect(item.tab)}
                  className={`rounded-2xl px-3 py-2.5 text-right transition-colors ${tab === item.tab ? 'bg-accent text-white' : 'text-ink hover:bg-canvas hover:text-accent'}`}
                >
                  <span className="block text-[.88rem] font-semibold">{item.label}</span>
                  <span className={`mt-0.5 block text-[.68rem] font-light ${tab === item.tab ? 'text-white/70' : 'text-soft'}`}>{item.note}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export function AdminMobileSubnav({ tab, onSelect }: { tab: AdminTab; onSelect: (tab: AdminTab) => void }) {
  const area = areaOfTab(tab)
  const group = ADMIN_GROUPS.find((item) => item.area === area)
  if (!group || group.items.length < 2) return null
  return (
    <div className="rail -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
      {group.items.map((item) => (
        <button key={item.tab} type="button" onClick={() => onSelect(item.tab)} className={`shrink-0 rounded-full px-4 py-2 text-[.8rem] font-semibold ${tab === item.tab ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft'}`}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function AdminMobileNav({ tab, onSelect }: { tab: AdminTab; onSelect: (tab: AdminTab) => void }) {
  const area = areaOfTab(tab)
  return (
    <nav aria-label="تنقل لوحة التحكم" className="fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-[280] rounded-2xl border border-hair bg-canvas/95 p-2 shadow-[0_24px_70px_-34px_rgba(21,22,26,.65)] backdrop-blur md:hidden">
      <div className="rail flex gap-2 overflow-x-auto pb-0.5">
        {ADMIN_GROUPS.map((group) => {
          const active = area === group.area
          return <button key={group.area} type="button" onClick={() => onSelect(defaultTabForArea(group.area))} className={`shrink-0 rounded-full px-4 py-2 text-[.74rem] font-semibold transition-colors ${active ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft'}`}>{group.label}</button>
        })}
      </div>
    </nav>
  )
}

const card = 'rounded-2xl border border-hair bg-wash p-5 md:p-6'
const button = 'rounded-full border border-hair px-4 py-2 text-[.82rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent'

const kuwaitDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export function TodayDashboard({ articles, onOpen }: { articles: ArticleRecord[]; onOpen: (tab: AdminTab) => void }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ todayViews: 0, topTitle: 'لا بيانات بعد', topCount: 0, recentMessages: 0, healthStatus: 'غير مفحوص', issues: 0, launchActive: false })

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const db = await getDb()
      if (!db) return
      const { collection, doc, getDoc, getDocs } = await import('firebase/firestore')
      const [views, messages, health, launch] = await Promise.all([
        getDocs(collection(db, 'views')).catch(() => null),
        getDocs(collection(db, 'messages')).catch(() => null),
        getDocs(collection(db, 'site_health')).catch(() => null),
        getDoc(doc(db, 'site_settings', 'launch')).catch(() => null),
      ])
      const today = kuwaitDate()
      let todayViews = 0
      let topPath = ''
      let topCount = 0
      for (const item of views?.docs || []) {
        const count = Number((item.data() as { count?: number }).count || 0)
        if (item.id.startsWith(`day:${today}:`)) todayViews += count
        if (item.id.startsWith('total:/articles/') && count > topCount) {
          topCount = count
          try { topPath = decodeURIComponent(item.id.slice('total:'.length)) } catch { topPath = item.id.slice('total:'.length) }
        }
      }
      const topSlug = topPath.split('/').filter(Boolean).pop()
      const topTitle = articles.find((item) => item.slug === topSlug)?.title || (topCount ? topPath : 'لا بيانات بعد')
      const weekAgo = Date.now() - 7 * 86_400_000
      const recentMessages = (messages?.docs || []).filter((item) => Number((item.data() as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0) * 1000 >= weekAgo).length
      const latestHealth = (health?.docs || []).map((item) => item.data() as { date?: string; status?: string; issueCount?: number }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
      const launchData = launch?.exists() ? launch.data() as { active?: boolean; endsAt?: { seconds?: number } } : null
      const launchActive = Boolean(launchData?.active && (!launchData.endsAt?.seconds || launchData.endsAt.seconds * 1000 > Date.now()))
      setData({ todayViews, topTitle, topCount, recentMessages, healthStatus: latestHealth?.status || 'غير مفحوص', issues: Number(latestHealth?.issueCount || 0), launchActive })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(false)
    }, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load(false) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(refresh); document.removeEventListener('visibilitychange', onVisible) }
  }, [articles.length])

  const drafts = articles.filter((article) => article.status === 'draft').length
  const scheduled = articles.filter((article) => article.status === 'scheduled' && Date.parse(article.scheduledAt || '') > Date.now()).length
  const tasks = [
    drafts ? { label: `${drafts} مسودة تحتاج قراراً`, tab: 'articles' as AdminTab } : null,
    scheduled ? { label: `${scheduled} مقال مجدول يستحق مراجعة أخيرة`, tab: 'articles' as AdminTab } : null,
    data.recentMessages ? { label: `${data.recentMessages} رسالة وصلت خلال آخر 7 أيام`, tab: 'inbox' as AdminTab } : null,
    data.issues ? { label: `${data.issues} ملاحظة في حارس الجودة`, tab: 'lab' as AdminTab } : null,
  ].filter(Boolean) as { label: string; tab: AdminTab }[]

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-3xl border border-hair bg-ink p-7 text-white md:p-10">
        <div className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white/[.06] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[.76rem] font-semibold text-white/60">غرفة القيادة الصامتة</p>
            <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.35]">{tasks.length ? `اليوم لديك ${tasks.length} قرارات فقط.` : 'كل شيء تحت السيطرة.'}</h2>
            <p className="mt-3 max-w-2xl text-[.9rem] font-light leading-[1.9] text-white/65">لا تعرض هذه الصفحة كل ما يستطيع النظام فعله؛ تعرض فقط ما يحتاج انتباهك الآن.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[.72rem] text-white/65"><span className="pulse relative h-1.5 w-1.5 rounded-full bg-white/70" />{loading ? 'يتصل بالنظام…' : 'يتحدّث تلقائياً'}</span>
        </div>
        {tasks.length ? <ol className="relative mt-8 grid gap-2.5 md:grid-cols-2">{tasks.map((task, index) => <li key={task.label}><button onClick={() => onOpen(task.tab)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3 text-right transition-colors hover:bg-white/[.1]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[.75rem]">{index + 1}</span><span className="text-[.86rem] font-medium">{task.label}</span><span className="ms-auto">←</span></button></li>)}</ol> : <p className="relative mt-7 text-[.88rem] text-white/70">يمكنك الآن الكتابة أو المغادرة… النظام هادئ وسليم.</p>}
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <button onClick={() => onOpen('analytics')} className={`${card} p-3.5 text-right transition-colors hover:border-accent sm:p-5 md:p-6`}><span className="text-[.72rem] font-semibold text-accent">مشاهدات اليوم</span><strong className="mt-2 block font-display text-2xl text-ink sm:text-3xl">{data.todayViews}</strong><span className="mt-2 block text-[.72rem] text-soft">افتح التحليلات ←</span></button>
        <button onClick={() => onOpen('analytics')} className={`${card} p-3.5 text-right transition-colors hover:border-accent sm:p-5 md:p-6`}><span className="text-[.72rem] font-semibold text-accent">الأكثر قراءة</span><strong className="mt-2 line-clamp-2 block font-display text-[.9rem] leading-[1.55] text-ink sm:text-[1.05rem]">{data.topTitle}</strong><span className="mt-2 block text-[.72rem] text-soft">{data.topCount} مشاهدة</span></button>
        <button onClick={() => onOpen('inbox')} className={`${card} p-3.5 text-right transition-colors hover:border-accent sm:p-5 md:p-6`}><span className="text-[.72rem] font-semibold text-accent">رسائل حديثة</span><strong className="mt-2 block font-display text-2xl text-ink sm:text-3xl">{data.recentMessages}</strong><span className="mt-2 block text-[.72rem] text-soft">آخر 7 أيام ←</span></button>
        <button onClick={() => onOpen(data.issues ? 'lab' : 'launch')} className={`${card} p-3.5 text-right transition-colors hover:border-accent sm:p-5 md:p-6`}><span className="text-[.72rem] font-semibold text-accent">حالة النظام</span><strong className="mt-2 block font-display text-[1rem] text-ink sm:text-[1.25rem]">{data.issues ? 'يحتاج انتباه' : data.healthStatus}</strong><span className="mt-2 block text-[.72rem] text-soft">{data.launchActive ? 'وضع الإطلاق نشط' : 'لا إطلاق نشط'}</span></button>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[.74rem] font-semibold text-accent">الخطوة التالية</p><h2 className="mt-1 font-display text-xl font-semibold text-ink">ابدأ من المهمة، لا من القائمة.</h2></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => onOpen('studio')} className={button}>مقال جديد</button><button onClick={() => onOpen('launch')} className={button}>وضع الإطلاق</button><button onClick={() => onOpen('inbox')} className={button}>الرسائل</button></div>
        </div>
      </section>
    </div>
  )
}

type LaunchForm = { active: boolean; kind: 'article' | 'book' | 'paper' | 'media'; slug: string; eyebrow: string; note: string; duration: '1' | '3' | '7' | 'until' | 'forever'; until: string }

export function LaunchModeCard({ articles, books, papers, media }: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const [form, setForm] = useState<LaunchForm>({ active: false, kind: 'article', slug: articles[0]?.slug || '', eyebrow: 'إطلاق خاص', note: '', duration: '3', until: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const options = form.kind === 'article' ? articles : form.kind === 'book' ? books : form.kind === 'paper' ? papers : media

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const db = await getDb(); if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'site_settings', 'launch'))
        if (!active || !snap.exists()) return
        const value = snap.data() as { active?: boolean; kind?: LaunchForm['kind']; slug?: string; eyebrow?: string; note?: string; endsAt?: { seconds?: number } | null }
        const until = value.endsAt?.seconds ? new Date(value.endsAt.seconds * 1000).toISOString().slice(0, 16) : ''
        setForm((current) => ({ ...current, active: Boolean(value.active), kind: value.kind || 'article', slug: value.slug || '', eyebrow: value.eyebrow || 'إطلاق خاص', note: value.note || '', duration: until ? 'until' : 'forever', until }))
      } catch { /* noop */ }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!options.some((item) => item.slug === form.slug)) setForm((current) => ({ ...current, slug: options[0]?.slug || '' }))
  }, [form.kind, options.length])

  const save = async (active: boolean) => {
    if (active && !form.slug) { setMessage('اختر عملاً أولاً.'); return }
    setBusy(true); setMessage('')
    try {
      const db = await getDb(); if (!db) throw new Error('Firebase غير متاح')
      const { Timestamp, doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      let endsAt = null
      if (active && form.duration === 'until') {
        const date = new Date(form.until)
        if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error('اختر تاريخاً مستقبلياً صحيحاً.')
        endsAt = Timestamp.fromDate(date)
      } else if (active && form.duration !== 'forever') {
        endsAt = Timestamp.fromDate(new Date(Date.now() + Number(form.duration) * 86_400_000))
      }
      await setDoc(doc(db, 'site_settings', 'launch'), { active, kind: form.kind, slug: form.slug, eyebrow: form.eyebrow.trim(), note: form.note.trim(), endsAt, updatedAt: serverTimestamp() }, { merge: true })
      setForm((current) => ({ ...current, active }))
      setMessage(active ? 'وضع الإطلاق يعمل الآن على الرئيسية ✓' : 'أُعيدت الرئيسية إلى وضعها الهادئ ✓')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'تعذّر الحفظ.')
    } finally { setBusy(false) }
  }

  const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.9rem] text-ink outline-none focus:border-accent'
  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-hair bg-ink p-7 text-white md:p-9">
        <p className="text-[.75rem] font-semibold text-white/60">وضع الإطلاق</p>
        <h1 className="mt-2 font-display text-3xl font-bold">اجعل عملاً واحداً يملأ المشهد… مؤقتاً.</h1>
        <p className="mt-3 max-w-2xl text-[.9rem] font-light leading-[1.9] text-white/65">لا يحذف شيئاً من الرئيسية ولا يغيّر بنيتها. يضيف غلاف إطلاق سينمائياً قبلها، ثم يختفي تلقائياً في الموعد الذي تختاره.</p>
      </section>
      <section className={card}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="text-[.74rem] font-semibold text-accent">نوع العمل</span><select className={input} value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as LaunchForm['kind'] }))}><option value="article">مقال</option><option value="book">كتاب</option><option value="paper">بحث</option><option value="media">ظهور إعلامي</option></select></label>
          <label className="grid gap-2"><span className="text-[.74rem] font-semibold text-accent">العمل</span><select className={input} value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}>{options.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select></label>
          <label className="grid gap-2"><span className="text-[.74rem] font-semibold text-accent">عنوان صغير فوق الإطلاق</span><input className={input} value={form.eyebrow} onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))} placeholder="إطلاق خاص" /></label>
          <label className="grid gap-2"><span className="text-[.74rem] font-semibold text-accent">المدة</span><select className={input} value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value as LaunchForm['duration'] }))}><option value="1">24 ساعة</option><option value="3">3 أيام</option><option value="7">7 أيام</option><option value="until">حتى تاريخ محدد</option><option value="forever">حتى أوقفه يدوياً</option></select></label>
          {form.duration === 'until' && <label className="grid gap-2 md:col-span-2"><span className="text-[.74rem] font-semibold text-accent">ينتهي في</span><input type="datetime-local" dir="ltr" className={input} value={form.until} onChange={(event) => setForm((current) => ({ ...current, until: event.target.value }))} /></label>}
          <label className="grid gap-2 md:col-span-2"><span className="text-[.74rem] font-semibold text-accent">ملاحظة الغلاف (اختيارية)</span><textarea className={`${input} min-h-28 resize-y`} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="جملة قصيرة تشرح لماذا يتصدر هذا العمل الآن." /></label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={busy} onClick={() => void save(true)} className="rounded-full bg-accent px-7 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'أحفظ…' : form.active ? 'تحديث الإطلاق' : 'ضعه في الواجهة'}</button>{form.active && <button disabled={busy} onClick={() => void save(false)} className={button}>إيقاف الإطلاق</button>} {message && <span className="text-[.82rem] text-accent">{message}</span>}</div>
      </section>
    </div>
  )
}

type Command = { tab: AdminTab; label: string; hint: string; keys: string }
const COMMANDS: Command[] = ADMIN_GROUPS.flatMap((group) => group.items.map((item) => ({ tab: item.tab, label: item.label, hint: `${group.label} · ${item.note}`, keys: `${item.label} ${group.label} ${item.note}` })))

export function AdminCommandPalette({ open, close, onSelect }: { open: boolean; close: () => void; onSelect: (tab: AdminTab) => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    setQuery('')
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', key) }
  }, [open, close])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? COMMANDS.filter((command) => command.keys.toLowerCase().includes(q)).slice(0, 9) : COMMANDS.slice(0, 9)
  }, [query])
  if (!open) return null
  const choose = (tab: AdminTab) => { onSelect(tab); close() }
  return (
    <motion.div role="dialog" aria-modal="true" aria-label="لوحة أوامر الإدارة" className="fixed inset-0 z-[310] bg-ink/30 px-4 pt-[calc(5.5rem+env(safe-area-inset-top))] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <motion.div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-hair bg-canvas shadow-2xl" initial={reduce ? false : { y: -12, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={reduce ? undefined : { y: -8, scale: .98 }} transition={{ duration: .25, ease: EASE }}>
        <div className="flex items-center gap-3 border-b border-hair px-5 py-4"><span className="text-accent">⌘</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && results[0] && choose(results[0].tab)} placeholder="اكتب: مقال جديد، الرسائل، اختبار الصوت…" className="min-w-0 flex-1 bg-transparent text-[.95rem] text-ink outline-none placeholder:text-soft/70" /><button onClick={close} className="rounded-full border border-hair px-3 py-1 text-[.72rem] text-soft">Esc</button></div>
        <div className="max-h-[65vh] overflow-y-auto p-2">{results.length ? results.map((command) => <button key={command.tab} onClick={() => choose(command.tab)} className="group block w-full rounded-2xl px-4 py-3 text-right transition-colors hover:bg-wash"><span className="block font-display text-[1rem] font-semibold text-ink group-hover:text-accent">{command.label}</span><span className="mt-1 block text-[.72rem] text-soft">{command.hint}</span></button>) : <p className="px-5 py-10 text-center text-soft">لا يوجد أمر مطابق.</p>}</div>
      </motion.div>
    </motion.div>
  )
}
