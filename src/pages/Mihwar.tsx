import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getDb, getFirebaseApp } from '../lib/firebase'
import { useAdminAuth } from '../lib/admin-auth'
import { markup } from './mihwar-markup'
import { initMihwar } from './mihwar-app'
import './mihwar-gate.css'

type Remote = { state: Record<string, unknown>; rev: number }
type SaveResult = { rev: number }
export type FeedBundle = { meta: Record<string, unknown> | null; items: Array<Record<string, unknown>>; error?: string }

const parse = (payload: unknown) => { try { return JSON.parse(String(payload || '{}')) as Record<string, unknown> } catch { return {} } }
const isOfflineError = (error: unknown) => {
  const code = String((error as { code?: string })?.code || '')
  return !navigator.onLine || ['unavailable', 'deadline-exceeded', 'cancelled'].includes(code) || /offline|network|Failed to get document/i.test(String((error as Error)?.message || ''))
}

function createBridge(uid: string) {
  const ref = async () => {
    const db = await getDb()
    if (!db) throw Object.assign(new Error('Firestore unavailable'), { code: 'unavailable' })
    const fs = await import('firebase/firestore')
    return { db, fs, doc: fs.doc(db, 'admin_mihwar', uid) }
  }
  let queue: Promise<unknown> = Promise.resolve()
  return {
    async load(): Promise<Remote> {
      const { fs, doc } = await ref()
      const snap = await fs.getDoc(doc)
      return snap.exists() ? { state: parse(snap.data().payload), rev: Number(snap.data().rev) || 0 } : { state: {}, rev: 0 }
    },
    // حفظ مشروط برقم النسخة: إن غيّر جهاز آخر المستند يُرفض الحفظ بكود conflict ولا يُكتب فوقه.
    save(state: Record<string, unknown>, baseRev: number): Promise<SaveResult> {
      const run = async () => {
        const payload = JSON.stringify(state)
        if (new TextEncoder().encode(payload).length > 850_000) throw Object.assign(new Error('too large'), { code: 'too-large' })
        const { db, fs, doc } = await ref()
        try {
          return await fs.runTransaction(db, async (tx) => {
            const snap = await tx.get(doc)
            const remoteRev = snap.exists() ? Number(snap.data().rev) || 0 : 0
            if (remoteRev !== baseRev) throw Object.assign(new Error('conflict'), { code: 'conflict', remote: { state: parse(snap.data()?.payload), rev: remoteRev } })
            tx.set(doc, { payload, rev: baseRev + 1, updatedAt: fs.serverTimestamp() })
            return { rev: baseRev + 1 }
          })
        } catch (error) {
          if ((error as { code?: string }).code === 'conflict') throw error
          if (isOfflineError(error)) throw Object.assign(new Error('offline'), { code: 'offline' })
          throw error
        }
      }
      const next = queue.catch(() => undefined).then(run)
      queue = next
      return next as Promise<SaveResult>
    },
    async subscribe(onRemote: (remote: Remote) => void) {
      const { fs, doc } = await ref()
      return fs.onSnapshot(doc, (snap) => { if (snap.exists() && !snap.metadata.hasPendingWrites) onRemote({ state: parse(snap.data().payload), rev: Number(snap.data().rev) || 0 }) }, () => undefined)
    },
    async feed(): Promise<FeedBundle> {
      try {
        const { db, fs } = await ref()
        const metaSnap = await fs.getDoc(fs.doc(db, 'mihwar_feed', 'meta'))
        if (!metaSnap.exists()) return { meta: null, items: [] }
        const meta = parse(metaSnap.data().payload)
        const items: Array<Record<string, unknown>> = []
        for (let n = 0; n < Number(metaSnap.data().chunks || 0); n++) {
          const chunk = await fs.getDoc(fs.doc(db, 'mihwar_feed', 'items-' + n))
          if (chunk.exists()) items.push(...(JSON.parse(String(chunk.data().payload || '[]')) as Array<Record<string, unknown>>))
        }
        return { meta, items }
      } catch (error) { return { meta: null, items: [], error: isOfflineError(error) ? 'offline' : 'failed' } }
    },
    async createBackup(state: Record<string, unknown>, reason: string) {
      const { db, fs } = await ref()
      const id = uid + '__' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '_' + Math.random().toString(36).slice(2, 6)
      await fs.setDoc(fs.doc(db, 'admin_mihwar_backups', id), { payload: JSON.stringify(state), createdAt: new Date().toISOString(), uid, reason })
      const all = await this.listBackups()
      for (const old of all.slice(12)) await fs.deleteDoc(fs.doc(db, 'admin_mihwar_backups', old.id))
      return id
    },
    async listBackups() {
      const { db, fs } = await ref()
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'admin_mihwar_backups'), fs.where('uid', '==', uid)))
      return snap.docs.map((d) => ({ id: d.id, createdAt: String(d.data().createdAt || ''), reason: String(d.data().reason || ''), size: String(d.data().payload || '').length })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async readBackup(id: string) {
      const { db, fs } = await ref()
      const snap = await fs.getDoc(fs.doc(db, 'admin_mihwar_backups', id))
      return snap.exists() ? parse(snap.data().payload) : null
    },
    // نسخة غير مرسلة محفوظة على هذا الجهاز فقط ريثما يعود الاتصال.
    pending: {
      key: 'mihwar:pending:' + uid,
      read() { try { return JSON.parse(localStorage.getItem(this.key) || 'null') } catch { return null } },
      write(value: unknown) { try { localStorage.setItem(this.key, JSON.stringify(value)) } catch { /* التخزين المحلي اختياري */ } },
      clear() { try { localStorage.removeItem(this.key) } catch { /* ignore */ } },
    },
  }
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
    const dispose = initMihwar(shadow, createBridge(uid))
    return () => dispose?.()
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
