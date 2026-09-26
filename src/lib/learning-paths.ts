import { useCallback, useEffect, useState } from 'react'
import { learningPaths, type LearningPath, type LearningStep, type LearningStepKind } from '../data/learning-paths'

export { learningPaths }
export type { LearningPath, LearningStep, LearningStepKind }

export const STEP_KIND_LABEL: Record<LearningStepKind, string> = {
  article: 'مقال',
  podcast: 'حلقة من مجلس الفكرة',
  encyclopedia: 'مدخل في الموسوعة',
  book: 'فصل من كتاب',
}

export const STEP_KIND_ACTION: Record<LearningStepKind, string> = {
  article: 'اقرأ المقال',
  podcast: 'استمع إلى الحلقة',
  encyclopedia: 'افتح المدخل',
  book: 'افتح الفصل',
}

export const stepKey = (step: Pick<LearningStep, 'kind' | 'ref'>) => `${step.kind}:${step.ref}`

/** رابط المادة داخل الموقع — الصيغة نفسها يستعملها مولّد الصفحات الساكنة. */
export function stepHref(step: Pick<LearningStep, 'kind' | 'ref' | 'title'>) {
  if (step.kind === 'article') return `/articles/${step.ref}`
  if (step.kind === 'podcast') return `/articles/${step.ref}`
  if (step.kind === 'encyclopedia') return `/publications/encyclopedia?q=${encodeURIComponent(step.title)}`
  const [slug, chapter] = step.ref.split('#')
  return `/publications/${slug}#book-knowledge-${chapter}`
}

export const pathMinutes = (path: LearningPath) => path.steps.reduce((sum, step) => sum + step.minutes, 0)
export const findLearningPath = (id: string | undefined) => learningPaths.find((path) => path.id === id)

/* ── التقدّم: محفوظٌ في متصفح الزائر وحده، ولا يُرسل إلى أي مكان ── */

const STORAGE_KEY = 'learning-paths:progress:v1'
const CHANGE_EVENT = 'learning-paths:changed'

type ProgressEntry = { done: string[]; at: number }
type ProgressMap = Record<string, ProgressEntry>

function readProgress(): ProgressMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ProgressMap : {}
  } catch {
    return {}
  }
}

function writeProgress(next: ProgressMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* التخزين اختياري: التصفح الخاص أو امتلاء المساحة لا يعطّل الصفحة. */
  }
  try { window.dispatchEvent(new Event(CHANGE_EVENT)) } catch { /* noop */ }
}

/** خطوات المسار المكتملة، مقيّدةً بخطواته الحالية (ما حُذف من المسار لا يُحتسب). */
export function completedSteps(path: LearningPath, progress: ProgressMap) {
  const valid = new Set(path.steps.map(stepKey))
  return new Set((progress[path.id]?.done || []).filter((key) => valid.has(key)))
}

/** أول خطوة لم تكتمل بعد — «الخطوة التالية». */
export function nextStepIndex(path: LearningPath, done: Set<string>) {
  const index = path.steps.findIndex((step) => !done.has(stepKey(step)))
  return index < 0 ? null : index
}

export function useLearningProgress() {
  const [progress, setProgress] = useState<ProgressMap>({})

  useEffect(() => {
    const sync = () => setProgress(readProgress())
    sync()
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) sync() }
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setStepDone = useCallback((pathId: string, key: string, done: boolean) => {
    const current = readProgress()
    const entry = current[pathId] || { done: [], at: 0 }
    const set = new Set(entry.done)
    if (done) set.add(key)
    else set.delete(key)
    writeProgress({ ...current, [pathId]: { done: [...set], at: Date.now() } })
  }, [])

  const resetPath = useCallback((pathId: string) => {
    const current = readProgress()
    delete current[pathId]
    writeProgress(current)
  }, [])

  return { progress, setStepDone, resetPath }
}
