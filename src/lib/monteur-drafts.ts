/**
 * حماية مشاريع المونتير — منطق نقيّ بلا Firebase (يُختبر تحت node مباشرة).
 *
 * ثلاثة عيوب كانت قائمة:
 *  1) الانتقال بين المشاريع أو «من النص أعلاه» كان يستدعي markDirty(false) فتُمحى التعديلات
 *     غير المحفوظة بصمت. الآن تُودَع في «مخزن مسودات» وتُستعاد عند العودة.
 *  2) «لوحة بالذكاء» كانت تحفظ ناتج النموذج فوق اللوحة الموجودة فوراً. الآن مسودة الذكاء لا
 *     تلمس النسخة المعتمدة: تُحفظ في حقل منفصل (aiDraft) أو تُحفظ وثيقة جديدة بحالة «مسودة»،
 *     ولا تُعتمد إلا بنقرة صريحة.
 *  3) استرجاع نسخة سابقة كان يفتحها مباشرةً كعمل جارٍ. الآن يمرّ بمراجعة تُظهر الفرق قبل الاعتماد.
 *
 * التوافق الخلفي: مستند بلا حقل status يُعدّ «معتمداً» — لا نغيّر معنى بياناتٍ قائمة.
 */

export type MonteurStatus = 'draft' | 'approved'

interface SceneLike { src?: string; l1?: string[]; l2?: string[]; t?: string; locked?: boolean; prop?: string }
export interface PlanLike { theme?: string; quote?: string; scenes: SceneLike[]; generated?: boolean }

export interface AiDraft { plan: PlanLike; title: string; body: string; createdAt: string }

export interface StoredProjectLike {
  plan: PlanLike
  title?: string
  body?: string
  revision?: number
  status?: MonteurStatus
  aiDraft?: AiDraft
  history?: Array<{ plan: PlanLike; savedAt: string; body?: string; title?: string }>
  createdAt?: unknown
  [key: string]: unknown
}

export interface IncomingProject {
  plan: PlanLike
  title: string
  body: string
  [key: string]: unknown
}

/** مستند قديم بلا status = معتمد. */
export function effectiveStatus(project: { status?: MonteurStatus } | undefined | null): MonteurStatus {
  return project?.status === 'draft' ? 'draft' : 'approved'
}

export type SaveIntent = 'working-save' | 'approve' | 'ai-generated'

export const MONTEUR_HISTORY_LIMIT = 8

export type SavePlan =
  | { kind: 'conflict'; message: string }
  | { kind: 'write'; doc: Record<string, unknown> }
  /** مسودة ذكاء فوق نسخة معتمدة: تُكتب في aiDraft فقط، بلا مساس بالخطة ولا بالنسخة ولا بالتاريخ. */
  | { kind: 'ai-draft-only'; patch: { aiDraft: AiDraft } }

/**
 * يقرر ماذا يُكتب في Firestore. دالة نقية: المعاملة نفسها (قراءة ثم كتابة) تبقى في monteur-library.
 */
export function planMonteurSave(
  old: StoredProjectLike | undefined,
  incoming: IncomingProject,
  intent: SaveIntent,
  nowIso: string,
  expectedRevision?: number,
): SavePlan {
  const oldRevision = old?.revision || 0
  if (intent === 'ai-generated' && old?.plan && effectiveStatus(old) === 'approved') {
    return { kind: 'ai-draft-only', patch: { aiDraft: { plan: incoming.plan, title: incoming.title, body: incoming.body, createdAt: nowIso } } }
  }
  if (expectedRevision !== undefined && oldRevision !== expectedRevision) {
    return { kind: 'conflict', message: 'تغيّرت اللوحة في جلسة أخرى؛ افتح أحدث نسخة قبل الحفظ.' }
  }
  const history = old?.plan
    ? [...(old.history || []), { plan: old.plan, body: old.body || '', title: old.title || '', savedAt: nowIso }].slice(-MONTEUR_HISTORY_LIMIT)
    : []
  let status: MonteurStatus
  if (intent === 'approve') status = 'approved'
  else if (intent === 'ai-generated') status = 'draft' // وثيقة جديدة أو مسودة سابقة: تبقى مسودة حتى الاعتماد
  else status = old ? effectiveStatus(old) : (incoming.plan.generated ? 'draft' : 'approved')
  const doc: Record<string, unknown> = { ...incoming, status, history, revision: oldRevision + 1 }
  /* اعتماد مسودة الذكاء المعلّقة أو مسحها قرار صريح؛ أي حفظ آخر لا يُسقطها بصمت. */
  if (old?.aiDraft && intent !== 'approve') doc.aiDraft = old.aiDraft
  if (intent === 'approve') doc.approvedAt = nowIso
  return { kind: 'write', doc }
}

/* ------------------------------ فرق النسخ قبل الاعتماد ------------------------------ */

export interface RevisionDiff {
  scenesBefore: number
  scenesAfter: number
  /** فهارس المشاهد (من 0) التي تغيّر نصها أو استعارتها بين النسختين. */
  changedScenes: number[]
  addedScenes: number
  removedScenes: number
  titleChanged: boolean
  bodyChanged: boolean
  themeChanged: boolean
  identical: boolean
}

const sceneKey = (scene: SceneLike | undefined) => scene ? JSON.stringify([scene.src || '', scene.l1 || [], scene.l2 || [], scene.t || '', scene.prop || '']) : ''

export function diffMonteurRevisions(
  current: { plan: PlanLike; title?: string; body?: string },
  candidate: { plan: PlanLike; title?: string; body?: string },
): RevisionDiff {
  const a = current.plan.scenes || []
  const b = candidate.plan.scenes || []
  const common = Math.min(a.length, b.length)
  const changedScenes: number[] = []
  for (let i = 0; i < common; i += 1) if (sceneKey(a[i]) !== sceneKey(b[i])) changedScenes.push(i)
  const diff: RevisionDiff = {
    scenesBefore: a.length, scenesAfter: b.length, changedScenes,
    addedScenes: Math.max(0, b.length - a.length), removedScenes: Math.max(0, a.length - b.length),
    titleChanged: (current.title || '') !== (candidate.title || ''),
    bodyChanged: (current.body || '').trim() !== (candidate.body || '').trim(),
    themeChanged: (current.plan.theme || '') !== (candidate.plan.theme || '') || (current.plan.quote || '') !== (candidate.plan.quote || ''),
    identical: false,
  }
  diff.identical = !changedScenes.length && !diff.addedScenes && !diff.removedScenes && !diff.titleChanged && !diff.bodyChanged && !diff.themeChanged
  return diff
}

import { arabicCountPhrase, REEL_SCENE_FORMS } from './arabic-count.ts'

/** سطر عربي يلخّص ما سيتغيّر لو اعتُمدت النسخة المرشّحة. */
export function describeRevisionDiff(diff: RevisionDiff): string {
  if (diff.identical) return 'النسخة مطابقة لما في المحرّر الآن؛ لا فرق يُذكر.'
  const parts: string[] = []
  if (diff.scenesBefore !== diff.scenesAfter) parts.push(`عدد المشاهد ${diff.scenesBefore} ← ${diff.scenesAfter}`)
  if (diff.changedScenes.length) parts.push(`تغيّر ${arabicCountPhrase(diff.changedScenes.length, REEL_SCENE_FORMS)} (${diff.changedScenes.slice(0, 6).map((i) => i + 1).join('، ')}${diff.changedScenes.length > 6 ? '…' : ''})`)
  if (diff.titleChanged) parts.push('العنوان مختلف')
  if (diff.bodyChanged) parts.push('نص المصدر مختلف')
  if (diff.themeChanged) parts.push('الثيمة أو الاقتباس مختلف')
  return parts.join(' · ')
}

/* -------------------------------- مخزن التعديلات غير المحفوظة -------------------------------- */

export interface StashedDraft { slug: string; title: string; body: string; plan: PlanLike }

/** يحفظ تعديلات كل مشروع عند الانتقال عنه، ويعيدها عند العودة بدل أن تُمحى. */
export function createDraftStash<T extends StashedDraft = StashedDraft>() {
  const map = new Map<string, T>()
  return {
    save(draft: T) { if (draft.slug) map.set(draft.slug, structuredCloneSafe(draft)) },
    take(slug: string): T | undefined { const value = map.get(slug); map.delete(slug); return value },
    peek(slug: string): T | undefined { return map.get(slug) },
    discard(slug: string) { map.delete(slug) },
    has(slug: string) { return map.has(slug) },
    slugs() { return [...map.keys()] },
    get size() { return map.size },
  }
}

function structuredCloneSafe<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }

export type LeaveDecision = 'proceed' | 'stash' | 'confirm'

/**
 * ماذا نفعل عند مغادرة المشروع الحالي؟
 *  - لا تعديلات: نمضي.
 *  - تعديلات على مشروع له معرّف: نودعها في المخزن ونمضي (لا فقد).
 *  - تعديلات على نصٍّ حرّ بلا معرّف: لا مكان آمن لها، فنسأل قبل التجاهل.
 */
export function decideLeave(dirty: boolean, currentSlug: string): LeaveDecision {
  if (!dirty) return 'proceed'
  return currentSlug ? 'stash' : 'confirm'
}
