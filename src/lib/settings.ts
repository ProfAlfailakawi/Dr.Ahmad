import { useEffect, useState } from 'react'
import { firebaseEnabled, getDb } from './firebase'
import { links } from '../data'

/* روابط السيرة PDF — يرفعها الدكتور من اللوحة (site_settings/cv)،
   ويسقط الموقع للملف المدمج إن لم تُرفع بعد. */
export type CvLinks = { ar: string; en?: string }
let cache: CvLinks | null = null

export function useCvLinks(): CvLinks {
  const [cv, setCv] = useState<CvLinks>(cache ?? { ar: links.cv, en: links.cvEn })
  useEffect(() => {
    if (cache || !firebaseEnabled) return
    let on = true
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'site_settings', 'cv'))
        const d = snap.data() as { url?: string; urlEn?: string } | undefined
        cache = { ar: d?.url || links.cv, en: d?.urlEn || links.cvEn }
        if (on) setCv(cache)
      } catch { /* noop */ }
    })()
    return () => { on = false }
  }, [])
  return cv
}

export type LaunchKind = 'article' | 'book' | 'paper' | 'media'
export type LaunchMode = {
  enabled: boolean
  kind: LaunchKind
  slug: string
  until?: string
  eyebrow?: string
  note?: string
}

const launchFallback: LaunchMode = { enabled: false, kind: 'article', slug: '' }

/**
 * وضع الإطلاق: إعداد واحد اختياري من لوحة التحكم.
 * لا يغيّر المحتوى ولا يحذفه؛ يغيّر غلاف الرئيسية مؤقتاً فقط ثم ينتهي تلقائياً.
 */
export function useLaunchMode(): LaunchMode {
  const [launch, setLaunch] = useState<LaunchMode>(launchFallback)
  useEffect(() => {
    if (!firebaseEnabled) return
    let unsubscribe = () => {}
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, onSnapshot } = await import('firebase/firestore')
        unsubscribe = onSnapshot(doc(db, 'site_settings', 'launch'), (snapshot) => {
          const value = snapshot.data() as Partial<LaunchMode> | undefined
          const until = value?.until ? new Date(value.until).getTime() : 0
          const expired = Boolean(until && until <= Date.now())
          setLaunch({
            enabled: Boolean(value?.enabled && !expired),
            kind: value?.kind || 'article',
            slug: value?.slug || '',
            until: value?.until,
            eyebrow: value?.eyebrow,
            note: value?.note,
          })
        }, () => setLaunch(launchFallback))
      } catch { setLaunch(launchFallback) }
    })()
    return () => unsubscribe()
  }, [])
  return launch
}
