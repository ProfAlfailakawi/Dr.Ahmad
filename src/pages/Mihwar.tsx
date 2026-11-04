import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getDb, getFirebaseApp } from '../lib/firebase'
import { useAdminAuth } from '../lib/admin-auth'
import { markup } from './mihwar-markup'
import { initMihwar } from './mihwar-app'
import './mihwar-gate.css'

type MihwarState = Record<string, unknown>
type Interest = { active?: boolean; terms?: string[] }
type FeedItem = { id: string; title: string; source: string; url: string; published: string | null; fetched: string; language: string; type: string; description: string; keywords: string; demo: false }

async function fetchResearch(interests: Interest[]) {
  const terms = interests.filter(i => i.active !== false).map(i => i.terms?.find(t => /[a-z]/i.test(t)) || i.terms?.[0]).filter((t): t is string => Boolean(t)).slice(0, 6)
  const items: FeedItem[] = []
  const errors: Record<string, string> = {}
  for (const term of terms) {
    try {
      const url = new URL('https://api.crossref.org/works')
      url.searchParams.set('query.title', term)
      url.searchParams.set('rows', '5')
      url.searchParams.set('sort', 'published')
      url.searchParams.set('order', 'desc')
      url.searchParams.set('filter', 'from-pub-date:2024-01-01')
      const response = await fetch(url)
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json() as { message?: { items?: Array<Record<string, unknown>> } }
      for (const work of data.message?.items || []) {
        const title = Array.isArray(work.title) ? String(work.title[0] || '') : ''
        const doi = String(work.DOI || '')
        if (!title || !doi) continue
        const parts = (work.published as { 'date-parts'?: number[][] } | undefined)?.['date-parts']?.[0]
        const published = parts && parts.length >= 3 ? parts.slice(0, 3).map((v, i) => i ? String(v).padStart(2, '0') : String(v)).join('-') : null
        items.push({ id: 'doi:' + doi.toLowerCase(), title, source: 'Crossref · ' + String(work.publisher || 'ناشر غير محدد'), url: 'https://doi.org/' + encodeURIComponent(doi), published, fetched: new Date().toISOString(), language: String(work.language || 'en'), type: 'بحث', description: Array.isArray(work['container-title']) ? String(work['container-title'][0] || '') : '', keywords: Array.isArray(work.subject) ? work.subject.map(String).join('، ') : '', demo: false })
      }
    } catch { errors[term] = 'تعذر الجلب' }
    await new Promise(resolve => setTimeout(resolve, 1100))
  }
  return { items: [...new Map(items.map(item => [item.id, item])).values()], errors }
}

function MihwarApp({ uid }: { uid: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const shadow = host.current?.shadowRoot || host.current?.attachShadow({ mode: 'open' })
    if (!shadow) return
    shadow.replaceChildren()
    const style = document.createElement('style')
    style.textContent = MIHWAR_CSS
    shadow.append(style)
    const content = document.createElement('div')
    content.innerHTML = markup
    shadow.append(content)
    let saveQueue: Promise<void> = Promise.resolve()
    const bridge = {
      async load(): Promise<MihwarState> {
        const db = await getDb()
        if (!db) throw new Error('Firestore unavailable')
        const { doc, getDoc } = await import('firebase/firestore')
        const snapshot = await getDoc(doc(db, 'admin_mihwar', uid))
        return snapshot.exists() ? JSON.parse(String(snapshot.data().payload || '{}')) as MihwarState : { version: 1 }
      },
      async save(value: MihwarState) {
        const payload = JSON.stringify(value)
        if (new TextEncoder().encode(payload).length > 700_000) throw new Error('Backup required')
        const db = await getDb()
        if (!db) throw new Error('Firestore unavailable')
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
        saveQueue = saveQueue.catch(() => undefined).then(() => setDoc(doc(db, 'admin_mihwar', uid), { payload, updatedAt: serverTimestamp() }))
        await saveQueue
      },
      feed: fetchResearch,
    }
    return initMihwar(shadow, bridge)
  }, [uid])
  return <div ref={host} className="mihwar-frame" />
}

// Vite loads the CSS text for the isolated Shadow DOM so existing site styles stay untouched.
import MIHWAR_CSS from './mihwar.css?inline'

export default function Mihwar() {
  const { user, isAdmin, loading, error } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { document.title = 'مِحور — مساحة خاصة' }, [])
  async function signIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setLoginError('')
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('إعداد الدخول غير متاح')
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
      await signInWithEmailAndPassword(getAuth(app), email.trim(), password)
      setPassword('')
    } catch { setLoginError('تعذر تسجيل الدخول. تحقّق من البيانات وحاول مجدداً.') }
    finally { setBusy(false) }
  }
  if (loading) return <div className="mihwar-gate" dir="rtl">جارٍ التحقق من الدخول…</div>
  if (!user || !isAdmin) return <main className="mihwar-gate" dir="rtl"><div className="mihwar-login"><span className="mihwar-kicker">مِحور</span><h1>مساحتك الخاصة</h1><p>الدخول مخصص لصاحب الموقع فقط.</p>{user && !isAdmin ? <p role="alert">هذا الحساب لا يملك صلاحية المشرف.</p> : <form onSubmit={signIn}><label>البريد الإلكتروني<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label><label>كلمة المرور<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label><button disabled={busy}>دخول</button></form>}{(loginError || error) && <p role="alert">{loginError || error}</p>}</div></main>
  return <MihwarApp uid={user.uid} />
}
