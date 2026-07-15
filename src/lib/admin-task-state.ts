export type AdminTaskStatus = 'idle' | 'working' | 'needs-input' | 'completed' | 'error'

export type AdminTaskDetail = {
  status: AdminTaskStatus
  label?: string
  changedAt: number
}

const EVENT_NAME = 'admin-task-state'
let current: AdminTaskDetail = { status: 'idle', changedAt: Date.now() }
let resetTimer: number | null = null

const clearReset = () => {
  if (typeof window === 'undefined' || resetTimer === null) return
  window.clearTimeout(resetTimer)
  resetTimer = null
}

export const getAdminTaskState = () => current

export function setAdminTaskState(status: AdminTaskStatus, label = '') {
  current = { status, label, changedAt: Date.now() }
  if (typeof window === 'undefined') return
  clearReset()
  window.dispatchEvent(new CustomEvent<AdminTaskDetail>(EVENT_NAME, { detail: current }))

  const delay = status === 'completed' ? 6000 : status === 'error' ? 6500 : 0
  if (delay) {
    resetTimer = window.setTimeout(() => setAdminTaskState('idle'), delay)
  }
}

export function subscribeAdminTaskState(listener: (detail: AdminTaskDetail) => void) {
  if (typeof window === 'undefined') return () => undefined
  const handler = (event: Event) => listener((event as CustomEvent<AdminTaskDetail>).detail)
  window.addEventListener(EVENT_NAME, handler)
  listener(current)
  return () => window.removeEventListener(EVENT_NAME, handler)
}

export function beginAdminTask(label = '') {
  let settled = false
  setAdminTaskState('working', label)
  return {
    complete(message = label) {
      if (settled) return
      settled = true
      setAdminTaskState('completed', message)
    },
    needsInput(message = label) {
      if (settled) return
      settled = true
      setAdminTaskState('needs-input', message)
    },
    fail(reason: unknown, fallback = 'تعذّر تنفيذ المهمة') {
      if (settled) return
      settled = true
      const message = reason instanceof Error ? reason.message : fallback
      const expectedInput = /اكتب|اختر|عدّل|راجع|قرار|الحد الأدنى|بوابة الجودة|مستخدم سابق|تحتاج تحديث|سجّل خروجك/i.test(message)
      setAdminTaskState(expectedInput ? 'needs-input' : 'error', message)
    },
  }
}
