/*
 * أثر «العقل الحي» داخل «مساحتي».
 * لا حساب ولا قاعدة بيانات منفصلة: الجلسة تُحفظ في التخزين المحلي نفسه الذي
 * تزامنه «مساحتي» مشفّراً عند تفعيل رمز المزامنة.
 */

export const ASK_LIBRARY_MEMORY_KEY = 'living-mind:sessions:v1'
export const ASK_LIBRARY_MEMORY_EVENT = 'living-mind:sessions-changed'

export type AskLibraryMemoryBranch = {
  id: string
  kind: string
  title: string
  why: string
  to: string
}

export type AskLibraryMemoryItem = {
  id: string
  question: string
  summary: string
  branches: AskLibraryMemoryBranch[]
  updatedAt: number
}

const MAX_SESSIONS = 24
let cloudTimer: number | null = null

const hasWindow = () => typeof window !== 'undefined'

const normalizeQuestion = (value: string) => String(value || '')
  .trim()
  .toLocaleLowerCase('ar')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stableId = (question: string) => {
  const normalized = normalizeQuestion(question)
  let hash = 2166136261
  for (let index = 0; index < normalized.length; index++) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `ask-${(hash >>> 0).toString(36)}`
}

function notify(id: string) {
  if (!hasWindow()) return
  try { window.dispatchEvent(new CustomEvent(ASK_LIBRARY_MEMORY_EVENT, { detail: { id } })) } catch { /* noop */ }
}

function queueCloudSync() {
  if (!hasWindow()) return
  if (cloudTimer != null) window.clearTimeout(cloudTimer)
  cloudTimer = window.setTimeout(() => {
    cloudTimer = null
    void import('./myspace-sync').then((module) => {
      const code = module.getSyncCode()
      if (code) void module.syncNow(code, true)
    }).catch(() => {})
  }, 650)
}

export function askLibraryMemories(): AskLibraryMemoryItem[] {
  if (!hasWindow()) return []
  try {
    const raw = JSON.parse(window.localStorage.getItem(ASK_LIBRARY_MEMORY_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((item): item is AskLibraryMemoryItem => Boolean(
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.question === 'string' &&
        typeof item.summary === 'string' &&
        Array.isArray(item.branches) &&
        Number.isFinite(Number(item.updatedAt)),
      ))
      .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
      .slice(0, MAX_SESSIONS)
  } catch {
    return []
  }
}

export function saveAskLibraryMemory(input: {
  question: string
  summary: string
  branches?: AskLibraryMemoryBranch[]
}) {
  if (!hasWindow()) return
  const question = String(input.question || '').trim()
  const summary = String(input.summary || '').trim()
  if (question.length < 4 || !summary) return

  const id = stableId(question)
  const current = askLibraryMemories()
  const previous = current.find((item) => item.id === id)
  const branches = Array.isArray(input.branches) && input.branches.length
    ? input.branches.slice(0, 4).map((branch) => ({
        id: String(branch.id || ''),
        kind: String(branch.kind || ''),
        title: String(branch.title || ''),
        why: String(branch.why || ''),
        to: String(branch.to || ''),
      }))
    : previous?.branches || []

  const next: AskLibraryMemoryItem = {
    id,
    question,
    summary,
    branches,
    updatedAt: Date.now(),
  }

  const merged = [next, ...current.filter((item) => item.id !== id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS)

  try {
    window.localStorage.setItem(ASK_LIBRARY_MEMORY_KEY, JSON.stringify(merged))
    notify(id)
    queueCloudSync()
  } catch { /* التخزين قد يكون محجوباً */ }
}
