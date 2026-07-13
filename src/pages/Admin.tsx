/**
 * لوحة التحكم — إدارة محتوى الموقع بدون أي برمجة.
 *
 *   /admin
 *
 * ١) إن لم يُفعَّل Firebase: تعرض دليل الإعداد خطوة بخطوة.
 * ٢) بعد التفعيل: دخول بالبريد وكلمة المرور (حساب المشرف وحده).
 * ٣) ثلاث بطاقات: مقال جديد · سؤال الأسبوع · لقاء قادم.
 *    كل ما يُنشر هنا يظهر في الموقع فوراً — بلا رفع ملفات.
 */
import { useEffect, useMemo, useState } from 'react'
import { Page } from '../components/ui'
import { firebaseEnabled, getDb, getFirebaseApp } from '../lib/firebase'
import { articleCats } from '../data'
import { getBaseRecord, type ArticleRecord } from '../lib/cms'
import { useCmsContent } from '../lib/content'
import { ContentManager, type ManagedKind, type ManagedRecord } from '../components/admin/ContentManager'
import { Indicators } from '../components/admin/Indicators'
import { IntelligenceLab } from '../components/admin/IntelligenceLab'
import { PublishingStudio } from '../components/admin/PublishingStudio'
import { VoiceBakeoffCard } from '../components/admin/VoiceBakeoff'
import { LaunchModeCard, QuietCommandCenter } from '../components/admin/AdminDashboard'
import { UploadField } from '../components/admin/ContentManager'
import { useSeo } from '../components/seo'
import type { User } from 'firebase/auth'

const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.95rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const btn = 'rounded-full bg-accent px-7 py-2.5 font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const card = 'rounded-2xl border border-hair bg-wash p-6 md:p-7'

/* التاريخ العربي من اليوم — مثل بقية الموقع */
const today = () => {
  const d = new Date()
  return {
    iso: d.toISOString().slice(0, 10),
    ar: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(d),
  }
}

export default function Admin() {
  useSeo({ title: 'لوحة التحكم', path: '/admin', robots: 'noindex, nofollow' })
  const [user, setUser] = useState<User | null>(null)
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(firebaseEnabled)

  useEffect(() => {
    if (!firebaseEnabled) return
    let unsub = () => {}
    ;(async () => {
      const app = await getFirebaseApp()
      const { getAuth, getIdTokenResult, onAuthStateChanged } = await import('firebase/auth')
      unsub = onAuthStateChanged(getAuth(app!), async (u) => {
        setUser(u)
        if (!u) {
          setAllowed(false)
          setChecking(false)
          return
        }
        try {
          const token = await getIdTokenResult(u, true)
          setAllowed(token.claims.admin === true)
        } catch {
          setAllowed(false)
        }
        setChecking(false)
      })
    })()
    return () => unsub()
  }, [])

  if (!firebaseEnabled) return <SetupGuide />
  if (checking) return <Page><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!user) return <Login />
  if (!allowed) return <AccessDenied email={user.email || ''} />
  return <Panel email={user.email || ''} />
}

/* ---------- ١) دليل الإعداد — يظهر قبل تفعيل Firebase ---------- */
function SetupGuide() {
  return (
    <Page>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-40 md:pt-44">
        <p className="mb-3 text-[.82rem] font-semibold uppercase text-accent">لوحة التحكم</p>
        <h1 className="mb-6 font-display text-3xl font-bold text-ink">خطوة واحدة تفصلك عنها.</h1>
        <p className="mb-10 leading-loose text-soft">
          لوحة التحكم جاهزة بالكامل — تحتاج فقط تفعيل Firebase (مجاني، مثل ما فعّلنا Azure).
          بعدها تضيف مقالاتك وأسئلتك ولقاءاتك من جوّالك، بلا أي ملفات.
        </p>
        <ol className="grid gap-5">
          {[
            ['أنشئ مشروعاً', 'ادخل console.firebase.google.com بحساب غوغل ← Add project ← أي اسم (مثل alfailakawi).'],
            ['فعّل قاعدة البيانات', 'من القائمة: Firestore Database ← Create database ← Production mode ← المنطقة الافتراضية.'],
            ['فعّل الدخول', 'Authentication ← Get started ← Email/Password ← Enable. ثم Users ← Add user: بريدك وكلمة مرور قوية.'],
            ['امنح صلاحية المشرف', 'بعد إنشاء المستخدم، أضف له custom claim باسم admin وقيمته true. دون هذا لن تفتح اللوحة حتى لو كان الحساب مسجلاً.'],
            ['انسخ المفاتيح', 'Project settings (⚙) ← Your apps ← أيقونة الويب </> ← سجّل التطبيق ← انسخ القيم الست، ويمكن إضافة App Check لاحقاً.'],
          ].map(([t, d], i) => (
            <li key={t} className={card}>
              <p className="mb-1 font-semibold text-ink"><span className="text-accent">{['1', '2', '3', '4', '5'][i]}.</span> {t}</p>
              <p className="text-[.92rem] leading-relaxed text-soft">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </Page>
  )
}

/* ---------- ٢) الدخول ---------- */
function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true); setErr('')
    try {
      const app = await getFirebaseApp()
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
      await signInWithEmailAndPassword(getAuth(app!), email, pass)
    } catch {
      setErr('تعذّر الدخول — تحقق من البريد وكلمة المرور.')
    }
    setBusy(false)
  }

  return (
    <Page>
      <div className="mx-auto max-w-md px-6 pb-24 pt-40 md:pt-44">
        <h1 className="mb-8 font-display text-3xl font-bold text-ink">لوحة التحكم</h1>
        <div className="grid gap-4">
          <input className={input} dir="ltr" type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} dir="ltr" type="password" placeholder="كلمة المرور" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
          <button className={btn} onClick={go} disabled={busy || !email || !pass}>{busy ? '…' : 'دخول'}</button>
          {err && <p className="text-[.85rem] text-soft">{err}</p>}
        </div>
      </div>
    </Page>
  )
}

function AccessDenied({ email }: { email: string }) {
  return (
    <Page>
      <div className="mx-auto max-w-xl px-6 pb-24 pt-40 md:pt-44">
        <p className="mb-3 text-[.82rem] font-semibold uppercase text-accent">حماية الإنتاج</p>
        <h1 className="font-display text-3xl font-bold text-ink">الحساب ليس مشرفاً بعد.</h1>
        <p className="mt-5 leading-loose text-soft">
          تم تسجيل الدخول باسم {email}، لكن قواعد الإنتاج تحتاج custom claim باسم
          <code className="mx-1 rounded bg-wash px-2 py-0.5 text-accent">admin: true</code>.
          هذا يمنع أي حساب عادي من قراءة الرسائل أو تعديل محتوى الموقع.
        </p>
      </div>
    </Page>
  )
}

/* ---------- ٣) اللوحة ---------- */
// السؤال الأسبوعي والمختارة اليومية يتولّدان تلقائياً (بنك دوّار) فلا لزوم لهما في اللوحة
type Tab = 'dashboard' | 'studio' | 'launch' | 'lab' | 'articles' | 'books' | 'papers' | 'media' | 'inbox' | 'event' | 'analytics' | 'system'
type AdminArea = 'today' | 'publish' | 'library' | 'audience' | 'system'

const ADMIN_AREAS: { key: AdminArea; label: string; note: string; tabs: { key: Tab; label: string }[] }[] = [
  { key: 'today', label: 'اليوم', note: 'ما يحتاج قرارك الآن', tabs: [{ key: 'dashboard', label: 'نظرة اليوم' }] },
  { key: 'publish', label: 'النشر', note: 'من الفكرة إلى الإطلاق', tabs: [{ key: 'studio', label: 'استوديو النشر' }, { key: 'launch', label: 'وضع الإطلاق' }, { key: 'event', label: 'اللقاءات' }] },
  { key: 'library', label: 'المكتبة', note: 'إدارة كل المحتوى', tabs: [{ key: 'articles', label: 'المقالات' }, { key: 'books', label: 'الكتب' }, { key: 'papers', label: 'الأبحاث' }, { key: 'media', label: 'الإعلام' }] },
  { key: 'audience', label: 'الجمهور', note: 'الرسائل والسلوك', tabs: [{ key: 'inbox', label: 'الرسائل' }, { key: 'analytics', label: 'التحليلات' }] },
  { key: 'system', label: 'النظام', note: 'الأدوات المتقدمة والإعدادات', tabs: [{ key: 'lab', label: 'المختبر المتقدم' }, { key: 'system', label: 'الصوت والسيرة' }] },
]

const TAB_AREA = Object.fromEntries(ADMIN_AREAS.flatMap((area) => area.tabs.map((tab) => [tab.key, area.key]))) as Record<Tab, AdminArea>


/* رفع السيرة الذاتية PDF (عربي + إنجليزي) — يحفظ الرابط في site_settings/cv
   فيتحدث زر التحميل في الموقع فوراً، بلا أي بناء أو رفع ملفات يدوي. */
function CvPdfCard() {
  const [links, setLinks] = useState<{ url?: string; urlEn?: string }>({})
  const [saved, setSaved] = useState('')
  useEffect(() => {
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'site_settings', 'cv'))
        if (snap.exists()) setLinks(snap.data() as { url?: string; urlEn?: string })
      } catch { /* noop */ }
    })()
  }, [])
  const save = async (patch: { url?: string; urlEn?: string }) => {
    try {
      const db = await getDb()
      if (!db) return
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      await setDoc(doc(db, 'site_settings', 'cv'), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
      setLinks((prev) => ({ ...prev, ...patch }))
      setSaved('حُدّث رابط السيرة في الموقع فوراً ✓')
      setTimeout(() => setSaved(''), 3000)
    } catch { setSaved('تعذّر الحفظ') }
  }
  return (
    <div className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">سيرتي الذاتية PDF</p>
      <p className="mt-1 text-[.85rem] font-light text-soft">ارفع الملف الجديد وسيتبدل زر التحميل في الموقع فوراً — عربي وإنجليزي.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <UploadField label="السيرة (عربي)" value={links.url || ''} accept="application/pdf" folder="files" slug="cv" maxMb={30} onChange={(url) => void save({ url })} />
        <UploadField label="English CV" value={links.urlEn || ''} accept="application/pdf" folder="files" slug="cv-en" maxMb={30} onChange={(urlEn) => void save({ urlEn })} />
      </div>
      {saved && <p className="mt-3 text-[.8rem] font-medium text-accent">{saved}</p>}
    </div>
  )
}

function AdminCommandPalette({ open, close, setTab }: { open: boolean; close: () => void; setTab: (tab: Tab) => void }) {
  const [query, setQuery] = useState('')
  const commands = useMemo(() => ADMIN_AREAS.flatMap((area) => area.tabs.map((tab) => ({ ...tab, area: area.label, search: `${area.label} ${area.note} ${tab.label}` }))), [])
  const results = commands.filter((command) => !query.trim() || command.search.includes(query.trim()))
  useEffect(() => {
    if (!open) { setQuery(''); return }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center bg-ink/35 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={close}>
      <div role="dialog" aria-modal="true" aria-label="لوحة أوامر الإدارة" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-2xl overflow-hidden rounded-3xl border border-hair bg-canvas shadow-2xl">
        <div className="border-b border-hair p-4"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className={`${input} border-0 bg-wash text-[1rem]`} placeholder="اكتب: مقال، إطلاق، رسائل، صوت…" /></div>
        <div className="max-h-[58vh] overflow-y-auto p-2">
          {results.map((command) => <button key={command.key} onClick={() => { setTab(command.key); close() }} className="group flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-right transition-colors hover:bg-wash"><span><span className="block font-semibold text-ink group-hover:text-accent">{command.label}</span><span className="mt-1 block text-[.74rem] text-soft">{command.area}</span></span><span className="text-accent">←</span></button>)}
          {!results.length && <p className="px-5 py-10 text-center text-soft">لا توجد نتيجة واضحة.</p>}
        </div>
        <div className="border-t border-hair px-5 py-3 text-[.72rem] text-soft">⌘K أو Ctrl+K لفتحها من أي مكان داخل اللوحة.</div>
      </div>
    </div>
  )
}

function Panel({ email }: { email: string }) {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const initialTab = (params.get('tab') as Tab) || 'dashboard'
  const editSlug = params.get('edit') || undefined
  const allTabs = ADMIN_AREAS.flatMap((area) => area.tabs.map((item) => item.key))
  const [tab, setTab] = useState<Tab>(allTabs.includes(initialTab) ? initialTab : 'dashboard')
  const [mobileMore, setMobileMore] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const cms = useCmsContent({ includeHidden: true })
  const area = TAB_AREA[tab] || 'today'
  const areaInfo = ADMIN_AREAS.find((item) => item.key === area) || ADMIN_AREAS[0]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCommandOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const navigate = (next: string) => {
    if (allTabs.includes(next as Tab)) setTab(next as Tab)
    setMobileMore(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const signOut = async () => {
    const app = await getFirebaseApp()
    const { getAuth, signOut: so } = await import('firebase/auth')
    await so(getAuth(app!))
  }

  return (
    <Page>
      <AdminCommandPalette open={commandOpen} close={() => setCommandOpen(false)} setTab={setTab} />
      <div className="admin-shell mx-auto box-border w-full max-w-[1440px] overflow-x-hidden px-4 pb-32 pt-28 sm:px-6 md:px-8 md:pt-32 lg:grid lg:grid-cols-[235px_minmax(0,1fr)] lg:gap-8 lg:pb-24">
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-3xl border border-hair bg-wash p-4">
            <div className="border-b border-hair px-2 pb-5">
              <p className="text-[.75rem] font-semibold uppercase text-accent">لوحة التحكم</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-ink">أهلاً دكتور.</h1>
              <button onClick={() => setCommandOpen(true)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-hair bg-canvas px-3 py-2 text-[.76rem] text-soft transition-colors hover:border-accent hover:text-accent"><span>الأوامر السريعة</span><span dir="ltr">⌘K</span></button>
            </div>
            <nav className="mt-4 grid gap-2" aria-label="أقسام لوحة التحكم">
              {ADMIN_AREAS.map((group) => <div key={group.key} className={`rounded-2xl border p-2 transition-colors ${area === group.key ? 'border-accent/30 bg-canvas' : 'border-transparent'}`}>
                <button onClick={() => navigate(group.tabs[0].key)} className="w-full px-2 py-1.5 text-right"><span className={`block font-display text-[1rem] font-semibold ${area === group.key ? 'text-accent' : 'text-ink'}`}>{group.label}</span><span className="mt-0.5 block text-[.7rem] leading-relaxed text-soft">{group.note}</span></button>
                {area === group.key && group.tabs.length > 1 && <div className="mt-2 grid gap-1 border-r border-hair pr-3">{group.tabs.map((item) => <button key={item.key} onClick={() => navigate(item.key)} className={`rounded-lg px-2 py-1.5 text-right text-[.78rem] transition-colors ${tab === item.key ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>{item.label}</button>)}</div>}
              </div>)}
            </nav>
            <button onClick={signOut} className="mt-5 w-full rounded-full border border-hair px-3 py-2 text-[.72rem] text-soft hover:border-accent hover:text-accent">خروج ({email})</button>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-hair pb-6">
            <div><p className="text-[.76rem] font-semibold uppercase text-accent">{areaInfo.label}</p><h2 className="mt-1 font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold text-ink">{areaInfo.tabs.find((item) => item.key === tab)?.label}</h2><p className="mt-1 text-[.82rem] text-soft">{areaInfo.note}</p></div>
            <div className="flex items-center gap-2 lg:hidden"><button onClick={() => setCommandOpen(true)} className="rounded-full border border-hair px-4 py-2 text-[.78rem] text-soft">الأوامر</button><button onClick={signOut} className="rounded-full border border-hair px-4 py-2 text-[.78rem] text-soft">خروج</button></div>
          </header>

          {areaInfo.tabs.length > 1 && <div className="rail mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">{areaInfo.tabs.map((item) => <button key={item.key} onClick={() => navigate(item.key)} className={`shrink-0 rounded-full px-4 py-2 text-[.8rem] font-semibold ${tab === item.key ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>{item.label}</button>)}</div>}

          {cms.error && <p className="mb-5 rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.85rem] text-soft">تعذّر تحديث المحتوى الحي: {cms.error}</p>}
          {cms.loading && <p className="mb-5 text-[.84rem] text-soft">أحمّل آخر تعديلات المحتوى…</p>}

          {tab === 'dashboard' && <QuietCommandCenter articles={cms.articles} onNavigate={navigate} />}
          {tab === 'studio' && <PublishingStudio articles={cms.articles} />}
          {tab === 'launch' && <LaunchModeCard articles={cms.articles} books={cms.books} papers={cms.papers} media={cms.media} />}
          {tab === 'lab' && <IntelligenceLab articles={cms.articles} />}
          {tab === 'analytics' && <Indicators articles={cms.articles} />}
          {tab === 'system' && <div className="grid gap-5"><CvPdfCard /><VoiceBakeoffCard /></div>}
          {tab === 'articles' && <ContentManager openSlug={editSlug} kind="article" items={cms.articles as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
          {tab === 'books' && <ContentManager openSlug={editSlug} kind="book" items={cms.books as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
          {tab === 'papers' && <ContentManager openSlug={editSlug} kind="paper" items={cms.papers as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
          {tab === 'media' && <ContentManager openSlug={editSlug} kind="media" items={cms.media as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
          {tab === 'inbox' && <InboxPanel />}
          {tab === 'event' && <EventForm />}
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[250] grid grid-cols-4 rounded-2xl border border-hair bg-canvas/95 p-1.5 shadow-[0_20px_55px_-28px_rgba(21,22,26,.6)] backdrop-blur-lg lg:hidden" aria-label="التنقل السريع في لوحة التحكم">
        {[{ key: 'today', label: 'اليوم', tab: 'dashboard' }, { key: 'publish', label: 'نشر', tab: 'studio' }, { key: 'library', label: 'المكتبة', tab: 'articles' }].map((item) => <button key={item.key} onClick={() => navigate(item.tab)} className={`rounded-xl px-2 py-2.5 text-[.76rem] font-semibold ${area === item.key ? 'bg-accent text-white' : 'text-soft'}`}>{item.label}</button>)}
        <button onClick={() => setMobileMore(!mobileMore)} className={`rounded-xl px-2 py-2.5 text-[.76rem] font-semibold ${area === 'audience' || area === 'system' ? 'bg-accent text-white' : 'text-soft'}`}>المزيد</button>
      </nav>
      {mobileMore && <div className="fixed inset-0 z-[245] bg-ink/25 lg:hidden" onClick={() => setMobileMore(false)}><div onClick={(event) => event.stopPropagation()} className="absolute inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] rounded-3xl border border-hair bg-canvas p-4 shadow-2xl"><p className="px-2 pb-3 text-[.72rem] font-semibold text-accent">المزيد</p><div className="grid grid-cols-2 gap-2">{ADMIN_AREAS.filter((item) => item.key === 'audience' || item.key === 'system').flatMap((group) => group.tabs.map((item) => <button key={item.key} onClick={() => navigate(item.key)} className="rounded-xl border border-hair bg-wash px-3 py-3 text-right"><span className="block text-[.8rem] font-semibold text-ink">{item.label}</span><span className="mt-1 block text-[.68rem] text-soft">{group.label}</span></button>))}</div></div></div>}
    </Page>
  )
}

/* ── صندوق الرسائل الواردة — استشاراتك وطلبات التعاون ── */
type Message = { id: string; name?: string; email?: string; topic?: string; intent?: string; quality?: string; message?: string; createdAt?: { seconds: number } }

function InboxPanel() {
  const [items, setItems] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const db = await getDb()
    if (!db) { setLoading(false); return }
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore')
    const snap = await getDocs(query(collection(db, 'messages'), orderBy('createdAt', 'desc')))
    setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    const db = await getDb()
    if (!db) return
    const { doc, deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'messages', id))
    load()
  }

  const when = (m: Message) => {
    if (!m.createdAt?.seconds) return ''
    try { return new Date(m.createdAt.seconds * 1000).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' }
  }

  if (loading) return <div className={card}>لحظة… أجلب رسائلك.</div>
  if (!items.length) return (
    <div className={`${card} text-center`}>
      <p className="text-[1.05rem] text-ink">صندوقك فارغ حالياً.</p>
      <p className="mt-2 text-[.88rem] text-soft">أي استشارة أو طلب تعاون يُرسل من صفحة «التواصل» يظهر هنا فوراً.</p>
    </div>
  )

  return (
    <div className="grid gap-4">
      <p className="text-[.85rem] text-soft">{String(items.length).replace(/[0-9]/g, (d) => '0123456789'[+d])} رسالة — الأحدث أولاً</p>
      {items.map((m) => (
        <div key={m.id} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-[.75rem] font-semibold text-accent">{m.topic || 'أخرى'}</span>
              {m.intent && <span className="rounded-full border border-hair px-3 py-1 text-[.72rem] text-soft">{m.intent}</span>}
              {m.quality && <span className="rounded-full border border-hair px-3 py-1 text-[.72rem] text-soft">{m.quality}</span>}
              <span className="font-semibold text-ink">{m.name}</span>
              <span className="text-[.85rem] text-soft" dir="ltr">{m.email}</span>
            </div>
            <span className="text-[.78rem] text-soft">{when(m)}</span>
          </div>
          <p className="mt-4 whitespace-pre-wrap leading-relaxed text-ink">{m.message}</p>
          <div className="mt-4 flex items-center gap-4 border-t border-hair pt-3 text-[.82rem]">
            <a href={`mailto:${m.email}?subject=${encodeURIComponent('رد على رسالتك — د. أحمد حسين الفيلكاوي')}`} className="font-semibold text-accent transition-colors hover:text-accent-deep">الردّ بالبريد ←</a>
            <button onClick={() => { if (confirm('حذف الرسالة نهائياً؟')) remove(m.id) }} className="text-soft transition-colors hover:text-red-500">حذف</button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* حفظ مستند + قائمة الموجود مع حذف */
function useCollection(name: string) {
  const [items, setItems] = useState<{ id: string; title?: string; ar?: string }[]>([])
  const [msg, setMsg] = useState('')

  const load = async () => {
    const db = await getDb()
    if (!db) return
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore')
    const snap = await getDocs(query(collection(db, name), orderBy('createdAt', 'desc')))
    setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })))
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (data: Record<string, unknown>) => {
    const db = await getDb()
    if (!db) return false
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
    await addDoc(collection(db, name), { ...data, createdAt: serverTimestamp() })
    setMsg('✓ نُشر — سيظهر في الموقع فوراً.')
    setTimeout(() => setMsg(''), 4000)
    load()
    return true
  }

  const remove = async (id: string) => {
    const db = await getDb()
    if (!db) return
    const { doc, deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, name, id))
    load()
  }

  return { items, save, remove, msg }
}

function Existing({ items, remove, label }: { items: { id: string; title?: string; ar?: string }[]; remove: (id: string) => void; label: string }) {
  if (!items.length) return null
  return (
    <div className="mt-8">
      <p className="mb-3 text-[.8rem] font-semibold text-soft">{label} المنشورة من اللوحة ({String(items.length).replace(/[0-9]/g, (d) => '0123456789'[+d])})</p>
      <ul className="grid gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-hair px-4 py-2.5">
            <span className="truncate text-[.9rem] text-ink">{it.title || it.ar}</span>
            <button onClick={() => { if (confirm('حذف نهائي؟')) remove(it.id) }} className="shrink-0 text-[.78rem] text-soft transition-colors hover:text-red-500">حذف</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ArticleForm() {
  const { items, save, remove, msg } = useCollection('site_articles')
  const [f, setF] = useState({ title: '', cat: 'التعليم', excerpt: '', body: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const publish = async () => {
    setBusy(true)
    const t = today()
    const slug = `d-${t.iso.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6)}`
    await save({ slug, title: f.title.trim(), cat: f.cat, date: t.ar, iso: t.iso, excerpt: f.excerpt.trim() || f.body.trim().slice(0, 140), body: f.body.trim() })
    setF({ title: '', cat: 'التعليم', excerpt: '', body: '' })
    setBusy(false)
  }

  return (
    <div className={card}>
      <div className="grid gap-4">
        <input className={input} placeholder="عنوان المقال" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <select className={input} value={f.cat} onChange={(e) => set('cat', e.target.value)}>
          {articleCats.filter((c) => c !== 'الكل').map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className={input} placeholder="مقتطف قصير (اختياري — يُؤخذ من أول النص تلقائياً)" value={f.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
        <textarea className={`${input} min-h-[300px] leading-loose`} placeholder={'نص المقال…\n\nافصل بين الفقرات بسطر فارغ.'} value={f.body} onChange={(e) => set('body', e.target.value)} />
        <div className="flex items-center gap-4">
          <button className={btn} onClick={publish} disabled={busy || f.title.trim().length < 3 || f.body.trim().length < 50}>نشر المقال</button>
          {msg && <span className="text-[.85rem] text-accent">{msg}</span>}
        </div>
        <p className="text-[.78rem] leading-relaxed text-soft">ملاحظة: الصوت (فهد/نورة) يُولَّد للمقالات الجديدة في دورة التحديث التالية.</p>
      </div>
      <Existing items={items} remove={remove} label="المقالات" />
    </div>
  )
}

function QuestionForm() {
  const { items, save, remove, msg } = useCollection('site_questions')
  const [f, setF] = useState({ ar: '', en: '', take: '', takeEn: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const publish = async () => {
    setBusy(true)
    await save({ ar: f.ar.trim(), en: f.en.trim(), take: f.take.trim(), takeEn: f.takeEn.trim() })
    setF({ ar: '', en: '', take: '', takeEn: '' })
    setBusy(false)
  }

  return (
    <div className={card}>
      <p className="mb-5 text-[.85rem] leading-relaxed text-soft">يُضاف لمخزون «سؤال يُقلق التعليم» ويظهر تلقائياً في أسبوعه بعد انتهاء المجدول.</p>
      <div className="grid gap-4">
        <input className={input} placeholder="السؤال بالعربية" value={f.ar} onChange={(e) => set('ar', e.target.value)} />
        <input className={input} dir="ltr" placeholder="The question in English" value={f.en} onChange={(e) => set('en', e.target.value)} />
        <textarea className={`${input} min-h-[100px]`} placeholder="رأيك في سطرين (بالعربية)" value={f.take} onChange={(e) => set('take', e.target.value)} />
        <textarea className={`${input} min-h-[100px]`} dir="ltr" placeholder="Your take in two lines (English)" value={f.takeEn} onChange={(e) => set('takeEn', e.target.value)} />
        <div className="flex items-center gap-4">
          <button className={btn} onClick={publish} disabled={busy || f.ar.trim().length < 5}>إضافة للمخزون</button>
          {msg && <span className="text-[.85rem] text-accent">{msg}</span>}
        </div>
      </div>
      <Existing items={items} remove={remove} label="الأسئلة" />
    </div>
  )
}

function PickForm() {
  const { items, save, remove, msg } = useCollection('site_picks')
  const KINDS = ['اقتباس وتأمل', 'الرف المنسي', 'أداة تستحق', 'مفهوم ناشئ', 'رؤية عميقة']
  const [f, setF] = useState({ kind: KINDS[0], ar: '', arNote: '', en: '', enNote: '', source: '', url: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const publish = async () => {
    setBusy(true)
    await save({ kind: f.kind, ar: f.ar.trim(), arNote: f.arNote.trim(), en: f.en.trim(), enNote: f.enNote.trim(), source: f.source.trim(), url: f.url.trim() })
    setF({ kind: KINDS[0], ar: '', arNote: '', en: '', enNote: '', source: '', url: '' })
    setBusy(false)
  }

  return (
    <div className={card}>
      <p className="mb-5 text-[.85rem] leading-relaxed text-soft">
        تنضم لمخزون «من اختياراتي» فوراً، وتدخل دورة «جديد اليوم» تلقائياً.
        <span className="text-accent"> الشرط الوحيد: مصدر موثوق مُسمّى.</span>
      </p>
      <div className="grid gap-4">
        <select className={input} value={f.kind} onChange={(e) => set('kind', e.target.value)}>
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <input className={input} placeholder="العنوان أو النص بالعربية" value={f.ar} onChange={(e) => set('ar', e.target.value)} />
        <input className={input} placeholder="سطر توضيحي بالعربية (اختياري)" value={f.arNote} onChange={(e) => set('arNote', e.target.value)} />
        <input className={input} dir="ltr" placeholder="Title or text in English" value={f.en} onChange={(e) => set('en', e.target.value)} />
        <input className={input} dir="ltr" placeholder="One-liner in English (optional)" value={f.enNote} onChange={(e) => set('enNote', e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <input className={input} placeholder="المصدر (إلزامي — مثل: اليونسكو)" value={f.source} onChange={(e) => set('source', e.target.value)} />
          <input className={input} dir="ltr" placeholder="رابط المصدر (اختياري)" value={f.url} onChange={(e) => set('url', e.target.value)} />
        </div>
        <div className="flex items-center gap-4">
          <button className={btn} onClick={publish} disabled={busy || f.ar.trim().length < 3 || !f.en.trim() || !f.source.trim()}>نشر المختارة</button>
          {msg && <span className="text-[.85rem] text-accent">{msg}</span>}
        </div>
      </div>
      <Existing items={items} remove={remove} label="المختارات" />
    </div>
  )
}

function EventForm() {
  const { items, save, remove, msg } = useCollection('site_upcoming')
  const [f, setF] = useState({ title: '', org: '', place: '', iso: '', time: '', url: '', kind: 'محاضرة' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const publish = async () => {
    setBusy(true)
    const ar = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(f.iso))
    await save({ title: f.title.trim(), org: f.org.trim(), place: f.place.trim(), date: ar, iso: f.iso, time: f.time.trim(), url: f.url.trim(), kind: f.kind })
    setF({ title: '', org: '', place: '', iso: '', time: '', url: '', kind: 'محاضرة' })
    setBusy(false)
  }

  return (
    <div className={card}>
      <p className="mb-5 text-[.85rem] leading-relaxed text-soft">يظهر في «اللقاءات القادمة» فوراً، ويختفي تلقائياً بعد انقضاء تاريخه.</p>
      <div className="grid gap-4">
        <input className={input} placeholder="عنوان اللقاء (مثال: ورشة الذكاء الاصطناعي في التقييم)" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <input className={input} placeholder="الجهة المنظمة" value={f.org} onChange={(e) => set('org', e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <input className={input} placeholder="المكان" value={f.place} onChange={(e) => set('place', e.target.value)} />
          <input className={input} placeholder="الوقت (مثال: 6:00 م)" value={f.time} onChange={(e) => set('time', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input className={input} dir="ltr" type="date" value={f.iso} onChange={(e) => set('iso', e.target.value)} />
          <select className={input} value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            {['محاضرة', 'ورشة', 'مؤتمر', 'لقاء'].map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <input className={input} dir="ltr" placeholder="رابط التسجيل (اختياري)" value={f.url} onChange={(e) => set('url', e.target.value)} />
        <div className="flex items-center gap-4">
          <button className={btn} onClick={publish} disabled={busy || !f.title.trim() || !f.iso}>نشر اللقاء</button>
          {msg && <span className="text-[.85rem] text-accent">{msg}</span>}
        </div>
      </div>
      <Existing items={items} remove={remove} label="اللقاءات" />
    </div>
  )
}
