import { getDb } from './firebase'

export type MonteurScene = {
  t: string; src: string; prop?: string; l1: string[]; l2: string[]; em: number; ann: string
  photo?: string; photoOff?: boolean; focus?: string; photoVariant?: string; iconVariant?: string; surfaceVariant?: string; locked?: boolean; value?: number; items?: string[]; steps?: string[]
}
export type MonteurPlan = {
  theme: string; trio: string[]; quote: string; scenes: MonteurScene[]
  opening?: string; narrative?: string; generated?: boolean; visualRevision?: number; hero?: string; coverPhoto?: string; coverFocus?: string
}
export type MonteurProject = {
  plan: MonteurPlan; title: string; body: string; category: string; source: 'ai' | 'curated'
  sourceHash: string; revision: number; history: { plan: MonteurPlan; savedAt: string; body?: string; title?: string }[]
}

export async function monteurSourceHash(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim()))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Subscribe only after admin authentication; cancellation also covers lazy Firebase loading. */
export function watchMonteurProjects(
  receive: (projects: Record<string, MonteurProject>) => void,
  fail: (error: Error) => void,
) {
  let active = true
  let stop = () => {}
  void (async () => {
    const db = await getDb()
    if (!active) return
    if (!db) throw new Error('الحفظ السحابي غير متاح؛ تحقق من اتصال Firebase.')
    const { collection, onSnapshot } = await import('firebase/firestore')
    if (!active) return
    stop = onSnapshot(collection(db, 'monteur_plans'), (snapshot) => {
      if (!active) return
      const projects: Record<string, MonteurProject> = {}
      snapshot.forEach((doc) => {
        const value = doc.data() as MonteurProject
        if (value.plan && Array.isArray(value.plan.scenes)) projects[doc.id] = value
      })
      receive(projects)
    }, (error) => { if (active) fail(error) })
  })().catch((error) => { if (active) fail(error) })
  return () => { active = false; stop() }
}

/** Keep bounded previous plans atomically: concurrent saves never silently erase history. */
export async function saveMonteurProject(slug: string, project: Omit<MonteurProject, 'revision' | 'history'>, expectedRevision?: number) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(slug)) throw new Error('معرّف المشروع غير صالح.')
  const db = await getDb()
  if (!db) throw new Error('لم تُحفظ اللوحة؛ اتصال Firebase غير متاح.')
  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'monteur_plans', slug)
    const previous = await transaction.get(ref)
    const old = previous.data() as (MonteurProject & { createdAt?: unknown }) | undefined
    if (expectedRevision !== undefined && (old?.revision || 0) !== expectedRevision) {
      throw new Error('تغيّرت اللوحة في جلسة أخرى؛ افتح أحدث نسخة قبل الحفظ.')
    }
    const history = old?.plan ? [...(old.history || []), { plan: old.plan, body: old.body || "", title: old.title || "", savedAt: new Date().toISOString() }].slice(-8) : []
    transaction.set(ref, {
      ...JSON.parse(JSON.stringify(project)), history, revision: (old?.revision || 0) + 1,
      createdAt: old?.createdAt || serverTimestamp(), updatedAt: serverTimestamp(),
    })
  })
}
