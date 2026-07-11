import { useEffect, useState } from 'react'
import { firebaseEnabled, getDb } from './firebase'
import { links } from '../data'

/* روابط السيرة PDF — يرفعها الدكتور من اللوحة (site_settings/cv)،
   ويسقط الموقع للملف المدمج إن لم تُرفع بعد. */
export type CvLinks = { ar: string; en?: string }
let cache: CvLinks | null = null

export function useCvLinks(): CvLinks {
  const [cv, setCv] = useState<CvLinks>(cache ?? { ar: links.cv })
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
        cache = { ar: d?.url || links.cv, en: d?.urlEn }
        if (on) setCv(cache)
      } catch { /* noop */ }
    })()
    return () => { on = false }
  }, [])
  return cv
}
