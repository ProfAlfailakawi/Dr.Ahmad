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
import { useEffect, useState } from 'react'
import { Page } from '../components/ui'
import { firebaseEnabled, getDb, getFirebaseApp } from '../lib/firebase'
import { articleCats } from '../data'
import { getBaseRecord, type ArticleRecord } from '../lib/cms'
import { useCmsContent } from '../lib/content'
import { ContentManager, type ManagedKind, type ManagedRecord } from '../components/admin/ContentManager'
import { Indicators } from '../components/admin/Indicators'
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
type Tab = 'dashboard' | 'articles' | 'books' | 'papers' | 'media' | 'inbox' | 'event'


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

function Panel({ email }: { email: string }) {
  // تحرير موضعي: /admin?tab=articles&edit=slug يفتح التبويب والنموذج مباشرة
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const initialTab = (params.get('tab') as Tab) || 'dashboard'
  const editSlug = params.get('edit') || undefined
  const [tab, setTab] = useState<Tab>(['dashboard','articles','books','papers','media','inbox','event'].includes(initialTab) ? initialTab : 'dashboard')
  const cms = useCmsContent({ includeHidden: true })

  const signOut = async () => {
    const app = await getFirebaseApp()
    const { getAuth, signOut: so } = await import('firebase/auth')
    await so(getAuth(app!))
  }

  return (
    <Page>
      <div className="mx-auto max-w-[1480px] px-4 pb-24 pt-36 sm:px-6 md:px-10 md:pt-40">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[.82rem] font-semibold uppercase text-accent">لوحة التحكم</p>
            <h1 className="font-display text-3xl font-bold text-ink">أهلاً دكتور.</h1>
          </div>
          <button onClick={signOut} className="rounded-full border border-hair px-4 py-1.5 text-[.8rem] text-soft transition-colors hover:border-accent hover:text-accent">
            خروج ({email})
          </button>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {([['dashboard', 'المؤشرات'], ['articles', 'المقالات'], ['books', 'الكتب'], ['papers', 'الأبحاث'], ['media', 'الإعلام'], ['inbox', 'الرسائل'], ['event', 'اللقاءات']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full px-5 py-2 text-[.88rem] transition-colors ${tab === k ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>
              {label}
            </button>
          ))}
        </div>

        {cms.error && <p className="mb-5 rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.85rem] text-soft">تعذّر تحديث المحتوى الحي: {cms.error}</p>}
        {cms.loading && <p className="mb-5 text-[.84rem] text-soft">أحمّل آخر تعديلات المحتوى…</p>}
        {tab === 'dashboard' && <><CvPdfCard /><div className="mt-5"><Indicators articles={cms.articles} /></div></>}
        {tab === 'articles' && <ContentManager openSlug={editSlug} kind="article" items={cms.articles as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
        {tab === 'books' && <ContentManager openSlug={editSlug} kind="book" items={cms.books as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
        {tab === 'papers' && <ContentManager openSlug={editSlug} kind="paper" items={cms.papers as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
        {tab === 'media' && <ContentManager openSlug={editSlug} kind="media" items={cms.media as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />}
        {tab === 'inbox' && <InboxPanel />}
        {tab === 'event' && <EventForm />}
      </div>
    </Page>
  )
}

/* ── صندوق الرسائل الواردة — استشاراتك وطلبات التعاون ── */
type Message = { id: string; name?: string; email?: string; topic?: string; message?: string; createdAt?: { seconds: number } }

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
