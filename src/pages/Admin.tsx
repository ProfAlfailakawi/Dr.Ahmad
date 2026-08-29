/**
 * لوحة التحكم — إدارة محتوى الموقع بدون أي برمجة.
 *
 *   /admin
 *
 * 1) إن لم يُفعَّل Firebase: تعرض دليل الإعداد خطوة بخطوة.
 * 2) بعد التفعيل: دخول بالبريد وكلمة المرور (حساب المشرف وحده).
 * 3) ثلاث بطاقات: مقال جديد · سؤال الأسبوع · لقاء قادم.
 *    كل ما يُنشر هنا يظهر في الموقع فوراً — بلا رفع ملفات.
 */
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { UsageAnalytics } from '../components/admin/UsageAnalytics'
import { Page } from '../components/ui'
import { Pagination, usePagedList } from '../components/Pagination'
import { firebaseEnabled, getDb, getFirebaseApp } from '../lib/firebase'
import { articleCats } from '../data'
import { getBaseRecord, type ArticleRecord } from '../lib/cms'
import { useCmsContent } from '../lib/content'
import { beginAdminTask } from '../lib/admin-task-state'
import { trackAdminUsage } from '../lib/admin-usage'
import { normalizeArabicTypography } from '../lib/arabic-typography'
import { useAdminAuth } from '../lib/admin-auth'
import { ContentManager, UploadField, type ManagedKind, type ManagedRecord } from '../components/admin/ContentManager'
import { AdminTaskFavicon, AdminTaskIndicator } from '../components/admin/AdminTaskFavicon'
import { NewsletterCenter } from '../components/admin/NewsletterCenter'
import { InboxIntelligence, InboxInsightBadges } from '../components/admin/InboxIntelligence'
import { registerAdminPush, sendAdminPushTest } from '../lib/admin-push'
import { useSeo } from '../components/seo'
import { arabicCountPhrase, MESSAGE_PLAIN_FORMS, SUBSCRIBER_FORMS } from '../lib/arabic-count.ts'
import {
  AdminCommandPalette,
  AdminMobileNav,
  AdminMobileSubnav,
  AdminSidebar,
  LaunchModeCard,
  TodayDashboard,
  type AdminTab,
} from '../components/admin/AdminArchitecture'
import { ADMIN_TABS } from '../components/admin/admin-navigation'

// كل استوديو يُحمّل عند فتح تبويبه فقط. بقيت شاشة الإدارة وبنية التنقل ثابتتين،
// بينما خرجت المحركات الثقيلة من الحزمة الأولى من دون تغيير واجهاتها أو وظائفها.
const Indicators = lazy(() => import('../components/admin/Indicators').then((module) => ({ default: module.Indicators })))
const IntelligenceLab = lazy(() => import('../components/admin/IntelligenceLab').then((module) => ({ default: module.IntelligenceLab })))
const NextBookCard = lazy(() => import('../components/admin/NextBookCard').then((module) => ({ default: module.NextBookCard })))
const PublishingStudio = lazy(() => import('../components/admin/PublishingStudio').then((module) => ({ default: module.PublishingStudio })))
const SocialDesignStudio = lazy(() => import('../components/admin/SocialDesignStudio').then((module) => ({ default: module.SocialDesignStudio })))
const TweetStudio = lazy(() => import('../components/admin/TweetStudio').then((module) => ({ default: module.TweetStudio })))
const StoryboardAtlas = lazy(() => import('../components/admin/StoryboardAtlas').then((module) => ({ default: module.StoryboardAtlas })))
const ImageLab = lazy(() => import('../components/admin/ImageLab').then((module) => ({ default: module.ImageLab })))
const VoiceBakeoffCard = lazy(() => import('../components/admin/VoiceBakeoff').then((module) => ({ default: module.VoiceBakeoffCard })))
const ManualDialogueEditor = lazy(() => import('../components/admin/ManualDialogueEditor').then((module) => ({ default: module.ManualDialogueEditor })))
const KuwaitiManualDialogueEditor = lazy(() => import('../components/admin/KuwaitiManualDialogueEditor').then((module) => ({ default: module.KuwaitiManualDialogueEditor })))
const AudioLibrary = lazy(() => import('../components/admin/AudioLibrary').then((module) => ({ default: module.AudioLibrary })))
const PronunciationLexicon = lazy(() => import('../components/admin/PronunciationLexicon').then((module) => ({ default: module.PronunciationLexicon })))
const ReaderPulse = lazy(() => import('../components/admin/ReaderPulse').then((module) => ({ default: module.ReaderPulse })))
const ProductionHealthCenter = lazy(() => import('../components/admin/ProductionHealthCenter').then((module) => ({ default: module.ProductionHealthCenter })))
const WhatsAppAgentPanel = lazy(() => import('../components/admin/WhatsAppAgentPanel').then((module) => ({ default: module.WhatsAppAgentPanel })))
const BotMessagesPanel = lazy(() => import('../components/admin/BotMessagesPanel').then((module) => ({ default: module.BotMessagesPanel })))
const ProductionMonitor = lazy(() => import('../components/admin/ProductionMonitor').then((module) => ({ default: module.ProductionMonitor })))
const VisitorJourneySuggestion = lazy(() => import('../components/admin/VisitorJourneySuggestion').then((module) => ({ default: module.VisitorJourneySuggestion })))
const SoundCaravanBoard = lazy(() => import('../components/admin/SoundCaravanBoard').then((module) => ({ default: module.SoundCaravanBoard })))
const AtlasEditorialSettings = lazy(() => import('../components/admin/AtlasEditorialSettings').then((module) => ({ default: module.AtlasEditorialSettings })))

const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.95rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const btn = 'rounded-full bg-accent px-7 py-2.5 font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-7'

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
  const { user, isAdmin: allowed, loading: checking } = useAdminAuth()
  const operationsPreview = import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('__ops_preview') === '1'
  const creativePreview = import.meta.env.DEV && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('__creative_preview')
    : ''

  if (operationsPreview) return <Page><div className="mx-auto w-full max-w-[1220px] px-4 pb-24 pt-28 sm:px-6 md:px-10 md:pt-32"><ProductionMonitor articles={[]} onOpen={() => undefined} /></div></Page>
  if (creativePreview === 'publishing') return <Page><div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-28 sm:px-6 md:px-10 md:pt-32"><PublishingStudio articles={[]} /></div></Page>
  if (creativePreview === 'design') return <Page><div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-28 sm:px-6 md:px-10 md:pt-32"><SocialDesignStudio /></div></Page>
  if (creativePreview === 'dashboard') return <Page><div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-28 sm:px-6 md:px-10 md:pt-32"><TodayDashboard articles={[]} books={[]} papers={[]} media={[]} onOpen={() => undefined} /></div></Page>
  if (!firebaseEnabled) return <SetupGuide />
  if (checking) return <Page><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!user) return <Login />
  if (!allowed) return <Login blockedEmail={user.email || ''} />
  return <Panel email={user.email || ''} />
}

/* ---------- 1) دليل الإعداد — يظهر قبل تفعيل Firebase ---------- */
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
            ['اعتمد حساب المشرف الوحيد', 'بعد إنشاء حسابك شغّل أداة set-admin مرة واحدة لمنحه custom claim باسم admin. لا توجد صلاحية احتياطية مبنية على البريد؛ الحساب الذي لا يحمل admin:true يُرفض حتى لو عرف عنوان البريد.'],
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

/* ---------- 2) الدخول ---------- */
function Login({ blockedEmail = '' }: { blockedEmail?: string }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const pwaEntry = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('source') || '').startsWith('pwa')

  const go = async () => {
    setBusy(true); setErr('')
    try {
      const app = await getFirebaseApp()
      const { getAuth, signInWithEmailAndPassword, signOut } = await import('firebase/auth')
      const auth = getAuth(app!)
      if (auth.currentUser) await signOut(auth)
      await signInWithEmailAndPassword(auth, email.trim(), pass)
    } catch {
      setErr('تعذّر الدخول — تحقق من البريد وكلمة المرور.')
    }
    setBusy(false)
  }

  return (
    <Page>
      <div className="mx-auto max-w-md px-6 pb-24 pt-40 md:pt-44">
        <h1 className="mb-8 font-display text-3xl font-bold text-ink">لوحة التحكم</h1>
        {pwaEntry && <p className="mb-5 rounded-2xl border border-accent/25 bg-accent/[.05] px-4 py-3 text-[.8rem] leading-relaxed text-soft"><strong className="text-accent">بوابة المالك.</strong> وصلت من نسخة PWA. في المرات القادمة اضغط مطولاً على شعار الموقع حتى يكتمل الخط الرفيع، أو استخدم اختصار «غرفة القيادة» من قائمة أيقونة التطبيق.</p>}
        {blockedEmail && (
          <div className="mb-5 rounded-2xl border border-hair bg-wash px-4 py-3 text-[.8rem] leading-relaxed text-soft">
            <strong className="text-ink">جلسة غير معتمدة.</strong> الحساب الحالي {blockedEmail} لا يملك صلاحية الإنتاج. سجّل أدناه بحساب المالك؛ سيُستبدل الحساب القديم تلقائياً.
          </div>
        )}
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

/* ---------- 3) اللوحة ---------- */
// السؤال الأسبوعي والمختارة اليومية يتولّدان تلقائياً (بنك دوّار) فلا لزوم لهما في اللوحة

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
    const task = beginAdminTask('تحديث ملف السيرة')
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      await setDoc(doc(db, 'site_settings', 'cv'), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
      setLinks((prev) => ({ ...prev, ...patch }))
      setSaved('حُدّث رابط السيرة في الموقع فوراً ✓')
      setTimeout(() => setSaved(''), 3000)
      task.complete('تم تحديث ملف السيرة')
    } catch (reason) {
      setSaved('تعذّر الحفظ')
      task.fail(reason, 'تعذّر تحديث ملف السيرة')
    }
  }
  return (
    <div className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">سيرتي الذاتية PDF</p>
      <p className="mt-1 text-[.85rem] font-light text-soft">ارفع الملف الجديد وسيتبدل زر التحميل في الموقع فوراً — عربي وإنجليزي.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <UploadField label="السيرة (عربي)" value={links.url || ''} accept="application/pdf" folder="files" slug="cv" maxMb={30} helper="اسم الملف لا يهم؛ أي PDF صحيح يُحفظ تلقائياً باسم cv.pdf ويستبدل النسخة السابقة." onChange={(url) => void save({ url })} />
        <UploadField label="English CV" value={links.urlEn || ''} accept="application/pdf" folder="files" slug="cv-en" maxMb={30} helper="The original filename does not matter; it is stored safely as cv-en.pdf." onChange={(urlEn) => void save({ urlEn })} />
      </div>
      {saved && <p className="mt-3 text-[.8rem] font-medium text-accent">{saved}</p>}
    </div>
  )
}

/* بوابة الإشعارات: زرّ التفعيل كان مدفوناً داخل تبويب الوارد، فبقي الدكتور
   بلا إشعارٍ وهو يظن القناة معطلة (31 يوليو). الشريط هنا في رأس اللوحة — لا
   يُرى إلا حين تكون القناة مغلقة فعلاً، ويختفي فور ربط الجهاز. ومعه اختبارٌ
   فوري: لا ينتظر رسالة قارئ ليتأكد أن الإشعار يصل جهازه. */
function PushGateBanner() {
  const { user } = useAdminAuth()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ))
  const [registered, setRegistered] = useState(() => typeof window !== 'undefined' && localStorage.getItem('admin:push-registered') === '1')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  if (permission === 'unsupported') return null
  if (registered && permission === 'granted' && !notice) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hair bg-canvas px-4 py-2.5" data-push-gate="ready">
        <span className="text-[.74rem] text-soft">الإشعارات الفورية مربوطة بهذا الجهاز — رسائل القراء تصلك فور وصولها.</span>
        <button type="button" disabled={Boolean(busy)} onClick={() => {
          if (!user) return
          setBusy('test')
          void sendAdminPushTest(user)
            .then((result) => setNotice(result?.sent ? 'أُرسل إشعار تجريبي الآن — تحقق من جهازك.' : 'لم يصل الإشعار لأي جهاز مسجّل؛ أعد الربط من هذا الشريط.'))
            .catch(() => setNotice('تعذّر إرسال الإشعار التجريبي في هذه الجلسة.'))
            .finally(() => setBusy(''))
        }} className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-45">
          {busy === 'test' ? 'يُرسل…' : 'جرّب الإشعار الآن'}
        </button>
      </div>
    )
  }

  return (
    <div className="mb-5 rounded-2xl border border-accent/[.35] bg-accent/[.05] px-4 py-3" data-push-gate="needs-enable">
      <p className="text-[.82rem] font-semibold text-ink">الإشعارات الفورية غير مفعّلة على هذا الجهاز</p>
      <p className="mt-1 text-[.76rem] leading-relaxed text-soft">
        رسائل القراء واشتراكات النشرة تصل صندوقك، لكنها لن توقظ هاتفك حتى تربط هذا الجهاز مرة واحدة. اضغط الزر ثم اسمح للمتصفح.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={Boolean(busy) || !user} onClick={() => {
          if (!user) return
          setBusy('enable')
          setNotice('أربط هذا الجهاز…')
          void registerAdminPush(user).then((result) => {
            setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
            setNotice(result.message)
            if (result.ok) { localStorage.setItem('admin:push-registered', '1'); setRegistered(true) }
          }).catch((error) => setNotice(error instanceof Error ? error.message : 'تعذّر الربط على هذا الجهاز.'))
            .finally(() => setBusy(''))
        }} className="rounded-full bg-accent px-4 py-2 text-[.78rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45">
          {busy === 'enable' ? 'يربط…' : 'فعّل الإشعارات على هذا الجهاز'}
        </button>
        {registered && (
          <button type="button" disabled={Boolean(busy)} onClick={() => {
            if (!user) return
            setBusy('test')
            void sendAdminPushTest(user)
              .then((result) => setNotice(result?.sent ? 'أُرسل إشعار تجريبي الآن — تحقق من جهازك.' : 'لا جهاز مسجّل بعد.'))
              .catch(() => setNotice('تعذّر إرسال الإشعار التجريبي.'))
              .finally(() => setBusy(''))
          }} className="rounded-full border border-hair px-4 py-2 text-[.76rem] font-semibold text-soft hover:border-accent hover:text-accent disabled:opacity-45">جرّب الإشعار</button>
        )}
      </div>
      {notice && <p className="mt-2 rounded-lg border border-hair bg-canvas px-3 py-2 text-[.74rem] leading-relaxed text-soft">{notice}</p>}
    </div>
  )
}

function Panel({ email }: { email: string }) {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const requestedTab = params.get('tab') as AdminTab | null
  const initialTab = requestedTab && ADMIN_TABS.includes(requestedTab) ? requestedTab : 'dashboard'
  const editSlug = params.get('edit') || undefined
  const [tab, setTab] = useState<AdminTab>(initialTab)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const openedTabAt = useRef(Date.now())
  const previousTab = useRef<AdminTab>(initialTab)
  const cms = useCmsContent({ includeHidden: true })
  useAdminInboxNotifications()
  useEffect(() => {
    void trackAdminUsage('admin_tool_opened', { tool: initialTab, from: 'admin-entry' })
    // فتح الشاشة وحده لا يعني بدء مهمة أو تركها؛ أحداث الدورة تُسجّل عند الإجراءات الدلالية فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandsOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const chooseTab = (next: AdminTab) => {
    const previous = previousTab.current
    if (previous !== next) {
      void trackAdminUsage('admin_tool_opened', { tool: next, from: previous, durationMs: Date.now() - openedTabAt.current })
      previousTab.current = next
      openedTabAt.current = Date.now()
    }
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    if (next !== 'articles' && next !== 'books' && next !== 'papers' && next !== 'media') url.searchParams.delete('edit')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // «حملة من مقال بنقرة»: زر المقالات يطلق هذا الحدث فتقفز اللوحة إلى
  // استوديو التصاميم مباشرة (تبويبه المستقل الجديد — يستهلك البذرة بنفسه).
  useEffect(() => {
    const toDesign = () => chooseTab('design')
    const toLiveDirector = () => chooseTab('studio')
    window.addEventListener('studio:campaign-seed', toDesign)
    // البصمة البصرية القادمة من مختبر الصور تقفز باللوحة إلى الاستوديو ليلتقطها
    window.addEventListener('studio:dna-palette', toDesign)
    window.addEventListener('studio:live-director-seed', toLiveDirector)
    return () => { window.removeEventListener('studio:campaign-seed', toDesign); window.removeEventListener('studio:dna-palette', toDesign); window.removeEventListener('studio:live-director-seed', toLiveDirector) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openTransferredArticle = async (slug: string) => {
    await cms.reload()
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'articles')
    url.searchParams.set('edit', slug)
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    setTab('articles')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const signOut = async () => {
    const app = await getFirebaseApp()
    const { getAuth, signOut: so } = await import('firebase/auth')
    await so(getAuth(app!))
  }

  /* سجل الـrender مطابق لسجل التنقل: إضافة أي تبويب جديد تصبح خطأ TypeScript
     ما لم يحصل على شاشة فعلية، فلا تتكرر مشكلة رابط موجود بلا محتوى أو العكس. */
  const tabContent: Record<AdminTab, ReactNode> = {
    dashboard: <TodayDashboard articles={cms.articles} books={cms.books} papers={cms.papers} media={cms.media} onOpen={chooseTab} />,
    monitor: <ProductionMonitor articles={cms.articles} onOpen={chooseTab} />,
    'content-health': <ProductionHealthCenter view="health" articles={cms.articles} books={cms.books} papers={cms.papers} onOpen={chooseTab} />,
    production: <ProductionHealthCenter view="production" articles={cms.articles} books={cms.books} papers={cms.papers} onOpen={chooseTab} />,
    analytics: <div className="grid gap-4"><UsageAnalytics /><ReaderPulse /><VisitorJourneySuggestion articles={cms.articles} /><Indicators articles={cms.articles} /></div>,
    studio: <div className="grid gap-5"><PublishingStudio articles={cms.articles} onTransferToArticles={openTransferredArticle} /><AtlasEditorialSettings articles={cms.articles} /></div>,
    'social-posts': <PublishingStudio articles={cms.articles} onTransferToArticles={openTransferredArticle} initialView="pulse" />,
    design: <SocialDesignStudio />,
    tweets: <TweetStudio />,
    'storyboard-atlas': <StoryboardAtlas articles={cms.articles} papers={cms.papers} books={cms.books} />,
    'image-lab': <ImageLab />,
    launch: <LaunchModeCard articles={cms.articles} books={cms.books} papers={cms.papers} media={cms.media} />,
    lab: (
      <div className="grid gap-5">
        {/* الكتاب العاشر أولاً: هو الخلاصة، وما تحته أدواتُ التحليل. */}
        <NextBookCard />
        <IntelligenceLab articles={cms.articles} onOpen={chooseTab} />
      </div>
    ),
    whatsapp: <WhatsAppAgentPanel />,
    'bot-messages': <BotMessagesPanel />,
    voice: <VoiceBakeoffCard />,
    'manual-dialogue': <ManualDialogueEditor articles={cms.articles} onQueued={() => chooseTab('production')} />,
    'manual-dialogue-kuwaiti': <KuwaitiManualDialogueEditor articles={cms.articles} />,
    'audio-library': <AudioLibrary articles={cms.articles} onChanged={cms.reload} />,
    'sound-caravan': <SoundCaravanBoard articles={cms.articles} />,
    pronunciation: <PronunciationLexicon />,
    cv: <CvPdfCard />,
    articles: <ContentManager openSlug={editSlug} kind="article" items={cms.articles as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />,
    books: <ContentManager openSlug={editSlug} kind="book" items={cms.books as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />,
    papers: <ContentManager openSlug={editSlug} kind="paper" items={cms.papers as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />,
    media: <ContentManager openSlug={editSlug} kind="media" items={cms.media as unknown as ManagedRecord[]} getBaseRecord={getBaseRecord as (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined} onChanged={cms.reload} />,
    inbox: <InboxPanel />,
    event: <EventForm />,
  }

  return (
    <Page>
      <AdminTaskFavicon />
      <div className="admin-shell mx-auto box-border w-full max-w-[1440px] overflow-x-clip px-4 pb-32 pt-28 sm:px-6 md:px-10 md:pb-24 md:pt-32">
        <PushGateBanner />
        <div className="mb-7 grid min-w-0 gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between md:mb-9">
          <div className="min-w-0">
            <p className="mb-1 text-[.78rem] font-semibold uppercase text-accent">لوحة التحكم</p>
            <h1 className="font-display text-3xl font-bold text-ink">أهلاً دكتور.</h1>
            <p className="mt-1 text-[.78rem] text-soft">كل الأدوات موجودة، لكن لا يظهر أمامك إلا ما تحتاجه الآن.</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <AdminTaskIndicator />
            <button
              type="button"
              onClick={() => setCommandsOpen(true)}
              aria-label="فتح لوحة الأوامر"
              title="لوحة الأوامر — ⌘K"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            >
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6V4a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v16a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V4"/>
              </svg>
            </button>
            <button onClick={signOut} className="min-w-0 max-w-full truncate rounded-full border border-hair px-3 py-2 text-[.72rem] text-soft transition-colors hover:border-accent hover:text-accent sm:px-4 sm:text-[.76rem]">
              خروج ({email})
            </button>
          </div>
        </div>

        {cms.error && <p className="mb-5 rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.85rem] text-soft">تعذّر تحديث المحتوى الحي: {cms.error}</p>}
        {cms.loading && <p className="mb-5 text-[.84rem] text-soft">أحمّل آخر تعديلات المحتوى…</p>}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[76px_minmax(0,1fr)] lg:items-start">
          <AdminSidebar tab={tab} onSelect={chooseTab} />
          <section className="min-w-0">
            <AdminMobileSubnav tab={tab} onSelect={chooseTab} />
            <Suspense fallback={<div className="rounded-2xl border border-hair bg-wash px-5 py-10 text-center text-[.82rem] text-soft">أفتح الأداة المطلوبة…</div>}>
              {tabContent[tab]}
            </Suspense>
          </section>
        </div>
      </div>
      <AdminMobileNav tab={tab} onSelect={chooseTab} />
      <AdminCommandPalette open={commandsOpen} close={() => setCommandsOpen(false)} onSelect={chooseTab} />
    </Page>
  )
}

/* ── صندوق الرسائل الواردة — استشاراتك وطلبات التعاون ── */
type Message = {
  id: string
  name?: string
  email?: string
  topic?: string
  intent?: string
  quality?: string
  message?: string
  approvedForTestimonial?: boolean
  testimonialHidden?: boolean
  testimonialQuote?: string
  createdAt?: { seconds: number }
}

const hidePrivateDetails = (value = '') => value
  .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '')
  .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, '')
  .replace(/\s+/g, ' ')
  .trim()

async function testimonialDocId(messageId: string) {
  const data = new TextEncoder().encode(messageId)
  const digest = await crypto.subtle.digest('SHA-1', data)
  const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `msg-${hex.slice(0, 14)}`
}

type Subscriber = {
  id: string
  email: string
  createdAt?: { seconds: number }
}

type NewsletterDraft = {
  id: string
  title: string
  text: string
  source: string
  createdAt?: { seconds: number }
}

function timestampLabel(value?: { seconds: number }) {
  if (!value?.seconds) return ''
  try {
    return new Date(value.seconds * 1000).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '' }
}

async function showAdminInboxNotification(title: string, body: string, tag: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const options: NotificationOptions = {
    body,
    tag,
    data: { url: '/admin?tab=inbox' },
  }
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, options)
      return
    }
  } catch { /* fallback below */ }
  try { new Notification(title, options) } catch { /* unsupported browser */ }
}

async function showIncomingMessageNotification(message: Message) {
  const body = [message.name, message.topic].filter(Boolean).join(' — ') || 'افتح لوحة التحكم لقراءتها.'
  await showAdminInboxNotification('رسالة جديدة وصلت إلى الموقع', body, `site-message-${message.id}`)
}

async function showNewSubscriberNotification(subscriber: Subscriber) {
  const body = subscriber.email ? `${subscriber.email} اشترك في النشرة البريدية.` : 'يوجد مشترك جديد في النشرة البريدية.'
  await showAdminInboxNotification('مشترك جديد في النشرة', body, `newsletter-subscriber-${subscriber.id}`)
}

function useAdminInboxNotifications() {
  const messagesPrimed = useRef(false)
  const subscribersPrimed = useRef(false)
  useEffect(() => {
    let active = true
    let unsubscribeMessages = () => {}
    let unsubscribeSubscribers = () => {}
    ;(async () => {
      const db = await getDb()
      if (!db || !active) return
      const { collection, limit, onSnapshot, orderBy, query } = await import('firebase/firestore')
      unsubscribeMessages = onSnapshot(
        query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(20)),
        (snapshot) => {
          if (!active) return
          if (messagesPrimed.current && localStorage.getItem('admin:push-registered') !== '1') {
            snapshot.docChanges()
              .filter((change) => change.type === 'added')
              .slice(0, 3)
              .forEach((change) => void showIncomingMessageNotification({ id: change.doc.id, ...(change.doc.data() as object) } as Message))
          } else {
            messagesPrimed.current = true
          }
        },
      )
      unsubscribeSubscribers = onSnapshot(
        query(collection(db, 'subscribers'), orderBy('createdAt', 'desc'), limit(20)),
        (snapshot) => {
          if (!active) return
          if (subscribersPrimed.current && localStorage.getItem('admin:push-registered') !== '1') {
            snapshot.docChanges()
              .filter((change) => change.type === 'added')
              .slice(0, 3)
              .forEach((change) => void showNewSubscriberNotification({ id: change.doc.id, ...(change.doc.data() as object) } as Subscriber))
          } else {
            subscribersPrimed.current = true
          }
        },
      )
    })()
    return () => {
      active = false
      unsubscribeMessages()
      unsubscribeSubscribers()
    }
  }, [])
}

function InboxPanel() {
  const { user } = useAdminAuth()
  const [items, setItems] = useState<Message[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [newsletterDraft, setNewsletterDraft] = useState<NewsletterDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ))
  const [pushNotice, setPushNotice] = useState('')
  const [pushRegistered, setPushRegistered] = useState(() => typeof window !== 'undefined' && localStorage.getItem('admin:push-registered') === '1')
  const paged = usePagedList(items, 10, String(items.length))
  const subscriberPaged = usePagedList(subscribers, 8, `subscribers|${subscribers.length}`)

  useEffect(() => {
    if (!user || !pushRegistered || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    let active = true
    void registerAdminPush(user).then((result) => {
      if (!active) return
      if (result.ok) return
      localStorage.removeItem('admin:push-registered')
      setPushRegistered(false)
      setPushNotice(result.message)
    }).catch(() => {
      if (!active) return
      localStorage.removeItem('admin:push-registered')
      setPushRegistered(false)
    })
    return () => { active = false }
  }, [user, pushRegistered])

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    ;(async () => {
      const db = await getDb()
      if (!db || !active) { setLoading(false); return }
      const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore')
      unsubscribe = onSnapshot(
        query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (!active) return
          const nextItems = snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as object) })) as Message[]
          setItems(nextItems)
          setLoading(false)
        },
        () => { if (active) setLoading(false) },
      )
    })()
    return () => { active = false; unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribeSubscribers = () => {}
    let unsubscribeQueue = () => {}
    ;(async () => {
      const db = await getDb()
      if (!db || !active) return
      const { collection, limit, onSnapshot, orderBy, query } = await import('firebase/firestore')
      unsubscribeSubscribers = onSnapshot(
        query(collection(db, 'subscribers'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (!active) return
          setSubscribers(snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as object) })) as Subscriber[])
        },
        () => { if (active) setSubscribers([]) },
      )
      unsubscribeQueue = onSnapshot(
        query(collection(db, 'social_queue'), orderBy('createdAt', 'desc'), limit(30)),
        (snapshot) => {
          if (!active) return
          const draft = snapshot.docs.map((document) => {
            const data = document.data() as {
              articleTitle?: string
              idea?: string
              source?: string
              posts?: { newsletter?: string }
              createdAt?: { seconds: number }
            }
            return {
              id: document.id,
              title: data.articleTitle || data.idea || 'نشرة بلا عنوان',
              text: String(data.posts?.newsletter || '').trim(),
              source: data.source || '',
              createdAt: data.createdAt,
            }
          }).find((item) => item.text)
          setNewsletterDraft(draft || null)
        },
        () => { if (active) setNewsletterDraft(null) },
      )
    })()
    return () => { active = false; unsubscribeSubscribers(); unsubscribeQueue() }
  }, [])

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') { setNotificationPermission('unsupported'); return }
    if (!user) { setPushNotice('تعذّر التحقق من جلسة المشرف.'); return }
    setPushNotice('جاري ربط هذا الجهاز بالإشعارات الفورية…')
    try {
      const result = await registerAdminPush(user)
      setNotificationPermission(Notification.permission)
      setPushNotice(result.message)
      if (result.ok) { localStorage.setItem('admin:push-registered', '1'); setPushRegistered(true) }
    } catch (error) {
      setNotificationPermission(Notification.permission)
      setPushNotice(error instanceof Error ? error.message : 'تعذّر ربط Push على هذا الجهاز.')
    }
  }

  const remove = async (id: string) => {
    const db = await getDb()
    if (!db) return
    const { doc, deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'messages', id))
  }

  const setTestimonial = async (m: Message, approved: boolean) => {
    const db = await getDb()
    if (!db) return
    const { doc, setDoc, updateDoc, serverTimestamp } = await import('firebase/firestore')
    const quote = hidePrivateDetails(m.testimonialQuote || m.message || '')
    const id = await testimonialDocId(m.id)
    if (approved) {
      if (quote.length < 35) {
        window.alert('النص قصير جداً ليظهر كشهادة عامة.')
        return
      }
      await updateDoc(doc(db, 'messages', m.id), {
        approvedForTestimonial: true,
        testimonialHidden: false,
        testimonialQuote: quote.slice(0, 420),
        updatedAt: serverTimestamp(),
      })
      await setDoc(doc(db, 'site_testimonials', id), {
        quote: quote.slice(0, 420),
        source: 'approved_message',
        sourceMessageId: m.id,
        status: 'published',
        published: true,
        anonymous: true,
        createdAt: m.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } else {
      await updateDoc(doc(db, 'messages', m.id), {
        approvedForTestimonial: false,
        testimonialHidden: true,
        updatedAt: serverTimestamp(),
      })
      await setDoc(doc(db, 'site_testimonials', id), {
        status: 'hidden',
        published: false,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }
  }

  const when = (m: Message) => timestampLabel(m.createdAt)

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[.78rem] font-semibold text-accent">مشتركو البريد</p>
              <h2 className="mt-1 font-display text-xl font-bold text-ink">{arabicCountPhrase(subscribers.length, SUBSCRIBER_FORMS)}</h2>
              <p className="mt-2 text-[.84rem] leading-relaxed text-soft">هذه هي العناوين المسجلة فعلياً في النشرة، والأحدث أولاً.</p>
            </div>
          </div>
          {subscribers.length ? (
            <>
              <div className="mt-5 grid gap-2">
                {subscriberPaged.pageItems.map((subscriber) => (
                  <div key={subscriber.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hair bg-canvas px-4 py-3">
                    <span dir="ltr" className="text-[.88rem] font-medium text-ink">{subscriber.email}</span>
                    <span className="text-[.75rem] text-soft">{timestampLabel(subscriber.createdAt)}</span>
                  </div>
                ))}
              </div>
              <Pagination page={subscriberPaged.page} pageCount={subscriberPaged.pageCount} onChange={subscriberPaged.setPage} totalItems={subscribers.length} firstItem={subscriberPaged.firstItem} lastItem={subscriberPaged.lastItem} label="صفحات مشتركي البريد" className="mt-4" />
            </>
          ) : <p className="mt-5 text-[.88rem] text-soft">لا يوجد مشتركون مسجلون حالياً.</p>}
        </section>

        <NewsletterCenter draft={newsletterDraft} />
      </div>

      <InboxIntelligence messages={items} />

      <div className="rounded-2xl border border-accent/25 bg-accent/[.045] p-4 text-[.84rem] leading-relaxed text-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p><strong className="text-ink">التحديث مباشر الآن.</strong> رسائل التواصل الخاصة تظهر هنا فوراً، من دون إعادة تحميل الصفحة.</p>
          {notificationPermission === 'unsupported' ? (
            <span className="text-[.78rem] text-soft">هذا المتصفح لا يدعم Push على الويب.</span>
          ) : pushRegistered && notificationPermission === 'granted' ? (
            <span className="rounded-full border border-accent/25 bg-canvas px-4 py-2 text-[.78rem] font-semibold text-accent">Push الحقيقي مربوط بهذا الجهاز</span>
          ) : (
            <button type="button" onClick={() => void enableNotifications()} className="rounded-full border border-accent/30 bg-canvas px-4 py-2 text-[.78rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">فعّل Push الحقيقي</button>
          )}
        </div>
        <p className="mt-2 text-[.76rem] text-soft">بعد ربط الجهاز، تصل إشعارات الرسائل والاشتراكات عبر Firebase Cloud Messaging حتى عندما لا تكون صفحة لوحة التحكم مفتوحة، بحسب دعم نظام التشغيل والمتصفح للإشعارات الخلفية. الضغط على التنبيه يفتح صندوق الوارد مباشرة.</p>
        {pushNotice && <p className="mt-2 rounded-lg border border-hair bg-canvas px-3 py-2 text-[.74rem] text-soft">{pushNotice}</p>}
      </div>

      {loading ? (
        <div className={card}>لحظة… أجلب رسائلك وأراقب الجديد لحظياً.</div>
      ) : !items.length ? (
        <div className={`${card} text-center`}>
          <p className="text-[1.05rem] text-ink">صندوقك فارغ حالياً.</p>
          <p className="mt-2 text-[.88rem] text-soft">أي استشارة أو طلب تعاون يُرسل من صفحة «التواصل» يظهر هنا فوراً.</p>
        </div>
      ) : (
        <>
          <p className="text-[.85rem] text-soft">{arabicCountPhrase(items.length, MESSAGE_PLAIN_FORMS)} — الأحدث أولاً</p>
          {paged.pageItems.map((m) => (
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
              <InboxInsightBadges message={m} />
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hair pt-3 text-[.82rem]">
                <a href={`mailto:${m.email}?subject=${encodeURIComponent('رد على رسالتك — د. أحمد حسين الفيلكاوي')}`} className="font-semibold text-accent transition-colors hover:text-accent-deep">الردّ بالبريد ←</a>
                {m.approvedForTestimonial && !m.testimonialHidden ? (
                  <button onClick={() => void setTestimonial(m, false)} className="text-soft transition-colors hover:text-accent">إخفاء من «ماذا قالوا»</button>
                ) : (
                  <button onClick={() => void setTestimonial(m, true)} className="text-soft transition-colors hover:text-accent">اعتماد كشهادة مجهولة</button>
                )}
                <button onClick={() => { if (confirm('حذف الرسالة نهائياً؟')) void remove(m.id) }} className="text-soft transition-colors hover:text-red-500">حذف</button>
              </div>
            </div>
          ))}
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={items.length} firstItem={paged.firstItem} lastItem={paged.lastItem} label="صفحات رسائل التواصل" className="mt-4" />
        </>
      )}
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
  const paged = usePagedList(items, 10, `${label}|${items.length}`)
  if (!items.length) return null
  return (
    <div className="mt-8">
      <p className="mb-3 text-[.8rem] font-semibold text-soft">{label} المنشورة من اللوحة ({String(items.length).replace(/[0-9]/g, (d) => '0123456789'[+d])})</p>
      <ul className="grid gap-2">
        {paged.pageItems.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-hair px-4 py-2.5">
            <span className="truncate text-[.9rem] text-ink">{it.title || it.ar}</span>
            <button onClick={() => { if (confirm('حذف نهائي؟')) remove(it.id) }} className="shrink-0 text-[.78rem] text-soft transition-colors hover:text-red-500">حذف</button>
          </li>
        ))}
      </ul>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={items.length} firstItem={paged.firstItem} lastItem={paged.lastItem} label={`صفحات ${label}`} className="mt-4" />
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
    await save({ slug, title: normalizeArabicTypography(f.title), cat: f.cat, date: t.ar, iso: t.iso, excerpt: normalizeArabicTypography(f.excerpt.trim() || f.body.trim().slice(0, 140)), body: normalizeArabicTypography(f.body) })
    setF({ title: '', cat: 'التعليم', excerpt: '', body: '' })
    setBusy(false)
  }

  return (
    <div className={card}>
      <div className="grid gap-4">
        <input className={input} placeholder="عنوان المقال" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <div>
          <input className={input} list="admin-article-categories" placeholder="التصنيف — ويمكن كتابة تصنيف جديد" value={f.cat} onChange={(e) => set('cat', e.target.value)} />
          <datalist id="admin-article-categories">{articleCats.filter((c) => c !== 'الكل').map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <input className={input} placeholder="مقتطف قصير (اختياري — يُؤخذ من أول النص تلقائياً)" value={f.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
        <textarea className={`${input} min-h-[300px] leading-loose`} placeholder={'نص المقال…\n\nافصل بين الفقرات بسطر فارغ.'} value={f.body} onChange={(e) => set('body', e.target.value)} />
        <div className="flex items-center gap-4">
          <button className={btn} onClick={publish} disabled={busy || f.title.trim().length < 3 || f.body.trim().length < 50}>نشر المقال</button>
          {msg && <span className="text-[.85rem] text-accent">{msg}</span>}
        </div>
        <p className="text-[.78rem] leading-relaxed text-soft">ملاحظة: قراءة المقال تُولَّد للمقالات الجديدة في دورة التحديث التالية، والحوار الصوتي يظهر فور اكتمال نشره واعتماده.</p>
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
        تنضم إلى «مختارات د. أحمد» فوراً، وتدخل دورة «جديد اليوم» تلقائياً.
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
        <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <input className={input} placeholder="المكان" value={f.place} onChange={(e) => set('place', e.target.value)} />
          <input className={input} placeholder="الوقت (مثال: 6:00 م)" value={f.time} onChange={(e) => set('time', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
