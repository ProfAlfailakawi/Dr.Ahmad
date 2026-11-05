import { getDb } from './firebase'
import { planMonteurSave, type AiDraft, type MonteurStatus, type SaveIntent } from './monteur-drafts'

export type MonteurScene = {
  t: string; src: string; prop?: string; l1: string[]; l2: string[]; em: number; ann: string
  photo?: string; photoOff?: boolean; focus?: string; photoVariant?: string; iconVariant?: string; surfaceVariant?: string; locked?: boolean; value?: number; items?: string[]; steps?: string[]
  visualMode?: string; transition?: string; signatureMoment?: string; shotScale?: string
  morphFrom?: string; morphTo?: string; surprise?: string; tension?: number
}
export type MonteurPlan = {
  theme: string; trio: string[]; quote: string; scenes: MonteurScene[]
  opening?: string; narrative?: string; generated?: boolean; visualRevision?: number; hero?: string; coverPhoto?: string; coverFocus?: string
  visualHistory?: string[]; qualityScore?: number; visualDNA?: string
}
export type MonteurProject = {
  plan: MonteurPlan; title: string; body: string; category: string; source: 'ai' | 'curated'
  sourceHash: string; revision: number; history: { plan: MonteurPlan; savedAt: string; body?: string; title?: string }[]
  /** غياب الحقل = «معتمد» (بيانات سابقة). المسودة لا تُعتمد إلا بنقرة صريحة. */
  status?: MonteurStatus
  approvedAt?: string
  /** ناتج «لوحة بالذكاء» بانتظار المراجعة فوق نسخة معتمدة؛ لا يمسّ الخطة المعتمدة. */
  aiDraft?: Omit<AiDraft, 'plan'> & { plan: MonteurPlan }
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

/**
 * يحفظ بمعاملة ذرية. القرار (ماذا يُكتب) في planMonteurSave النقية والمُختبَرة:
 *  - 'working-save': حفظ تعديلات المستخدم؛ يحفظ السابق في التاريخ ولا يغيّر الحالة.
 *  - 'approve': اعتماد صريح (نسخة مرشّحة أو مسودة).
 *  - 'ai-generated': ناتج النموذج؛ فوق نسخة معتمدة يُكتب في aiDraft فقط.
 */
export async function saveMonteurProject(slug: string, project: Omit<MonteurProject, 'revision' | 'history' | 'status' | 'aiDraft' | 'approvedAt'>, expectedRevision?: number, intent: SaveIntent = 'working-save') {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(slug)) throw new Error('معرّف المشروع غير صالح.')
  const db = await getDb()
  if (!db) throw new Error('لم تُحفظ اللوحة؛ اتصال Firebase غير متاح.')
  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'monteur_plans', slug)
    const previous = await transaction.get(ref)
    const old = previous.data() as (MonteurProject & { createdAt?: unknown }) | undefined
    const outcome = planMonteurSave(old as never, JSON.parse(JSON.stringify(project)), intent, new Date().toISOString(), expectedRevision)
    if (outcome.kind === 'conflict') throw new Error(outcome.message)
    if (outcome.kind === 'ai-draft-only') {
      transaction.update(ref, { ...outcome.patch, updatedAt: serverTimestamp() })
      return
    }
    transaction.set(ref, { ...outcome.doc, createdAt: old?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() })
  })
}

/** يمسح مسودة الذكاء المعلّقة (تجاهلها) دون المساس بالنسخة المعتمدة. */
export async function discardMonteurAiDraft(slug: string) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(slug)) throw new Error('معرّف المشروع غير صالح.')
  const db = await getDb()
  if (!db) throw new Error('اتصال Firebase غير متاح.')
  const { doc, updateDoc, deleteField } = await import('firebase/firestore')
  await updateDoc(doc(db, 'monteur_plans', slug), { aiDraft: deleteField() })
}
