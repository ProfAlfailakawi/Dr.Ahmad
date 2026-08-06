import { getDb } from './firebase'

export type AdminUsageEvent =
  | 'admin_tool_opened' | 'admin_task_started' | 'admin_result_generated' | 'admin_result_accepted'
  | 'admin_result_rejected' | 'admin_result_edited' | 'admin_result_converted' | 'admin_task_abandoned'
  | 'admin_recommendation_ignored' | 'admin_recommendation_used'

type AdminUsagePayload = {
  tool: string
  taskId?: string
  taskType?: string
  result?: string
  finalAction?: string
  from?: string
  to?: string
  producedItemId?: string
  durationMs?: number
  testSession?: boolean
}

export async function trackAdminUsage(name: AdminUsageEvent, payload: AdminUsagePayload) {
  try {
    if (localStorage.getItem('admin:usage-tracking-disabled') === '1') return
    const db = await getDb()
    if (!db) return
    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore')
    await addDoc(collection(db, 'admin_tool_events'), {
      name,
      tool: payload.tool.slice(0, 80),
      taskId: payload.taskId?.slice(0, 120) || '',
      taskType: payload.taskType?.slice(0, 80) || '',
      result: payload.result?.slice(0, 80) || '',
      finalAction: payload.finalAction?.slice(0, 80) || '',
      from: payload.from?.slice(0, 240) || '',
      to: payload.to?.slice(0, 240) || '',
      producedItemId: payload.producedItemId?.slice(0, 160) || '',
      durationMs: Math.max(0, Math.round(payload.durationMs || 0)),
      testSession: Boolean(payload.testSession || sessionStorage.getItem('admin:test-session') === '1'),
      createdAt: serverTimestamp(),
    })
  } catch { /* measurement never blocks admin work */ }
}

export function setAdminUsageTracking(enabled: boolean) {
  if (enabled) localStorage.removeItem('admin:usage-tracking-disabled')
  else localStorage.setItem('admin:usage-tracking-disabled', '1')
}

export function isAdminUsageTrackingEnabled() {
  return typeof localStorage === 'undefined' || localStorage.getItem('admin:usage-tracking-disabled') !== '1'
}
