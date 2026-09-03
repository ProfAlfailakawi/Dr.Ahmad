import { getDb } from './firebase'

/**
 * قياس استخدام لوحة التحكم — لمالك الموقع وحده.
 *
 * ليست مراقبةَ موظفين ولا مقارنةَ مستخدمين: لا فِرق، ولا أسماء، ولا بريد.
 * والسؤال الوحيد: أيّ أداةٍ تُنتج قراراً وأيّها تُفتح ثم تُترك.
 *
 * حدود صارمة:
 * - لا يُسجَّل نصّ مقالٍ ولا فكرةٍ ولا حوار — معرّفات العناصر فقط.
 * - جلسات الاختبار مُعلَّمة وتُستبعد من كل حكم.
 * - القياس يُعطَّل بزرٍّ واحد، ولا يُعطّل عمل اللوحة أبداً إن فشل.
 */

export type AdminUsageEvent =
  | 'admin_tool_opened' | 'admin_task_started' | 'admin_result_generated' | 'admin_result_accepted'
  | 'admin_result_rejected' | 'admin_result_edited' | 'admin_result_converted' | 'admin_task_abandoned'
  | 'admin_recommendation_ignored' | 'admin_recommendation_used'

/** مدّة الاحتفاظ: ستة أشهر تكفي لمقارنة فصلٍ بفصل، ثم تُمحى. */
export const ADMIN_USAGE_RETENTION_DAYS = 180

const DISABLED_KEY = 'admin:usage-tracking-disabled'
const TEST_SESSION_KEY = 'admin:test-session'

type AdminUsagePayload = {
  /** اسم الأداة كما يعرفها الأدمن في القائمة. */
  tool: string
  /** معرّف المهمة — يربط البداية بالنتيجة بالقرار. لا نصّ فيه. */
  taskId?: string
  taskType?: string
  result?: string
  finalAction?: string
  from?: string
  to?: string
  /** معرّف العنصر الناتج (slug/id) — لا عنوانه ولا متنه. */
  producedItemId?: string
  /** إلى أي مرحلة تحوّلت النتيجة: مقال، تصميم، صوت، قرار… */
  convertedTo?: string
  durationMs?: number
  testSession?: boolean
}

const safe = (value: unknown, max: number) => String(value ?? '').slice(0, max)

export async function trackAdminUsage(name: AdminUsageEvent, payload: AdminUsagePayload) {
  try {
    if (!isAdminUsageTrackingEnabled()) return
    const db = await getDb()
    if (!db) return
    const { addDoc, collection, serverTimestamp, Timestamp } = await import('firebase/firestore')
    await addDoc(collection(db, 'admin_tool_events'), {
      name,
      tool: safe(payload.tool, 80),
      taskId: safe(payload.taskId, 120),
      taskType: safe(payload.taskType, 80),
      result: safe(payload.result, 80),
      finalAction: safe(payload.finalAction, 80),
      from: safe(payload.from, 240),
      to: safe(payload.to, 240),
      producedItemId: safe(payload.producedItemId, 160),
      convertedTo: safe(payload.convertedTo, 80),
      durationMs: Math.max(0, Math.round(payload.durationMs || 0)),
      testSession: Boolean(payload.testSession || isTestSession()),
      createdAt: serverTimestamp(),
      /* حقل الانتهاء: عليه تُبنى سياسة TTL في Firestore، وعليه يعمل التنظيف اليدوي. */
      expiresAt: Timestamp.fromDate(new Date(Date.now() + ADMIN_USAGE_RETENTION_DAYS * 86_400_000)),
    })
  } catch { /* القياس لا يعطّل عمل اللوحة أبداً */ }
}

/**
 * دورة أداةٍ كاملة بمعرّف مهمةٍ واحد: بدأت → أنتجت → قُبلت/رُفضت/عُدّلت/تحوّلت.
 * تُستعمل داخل الأدوات حتى تُقاس النتيجة العملية لا مجرد ظهور المخرجات.
 */
export function beginAdminToolTask(tool: string, taskType: string) {
  const taskId = `${tool}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = Date.now()
  let closed = false
  const emit = (name: AdminUsageEvent, extra: Partial<AdminUsagePayload> = {}) =>
    trackAdminUsage(name, { tool, taskId, taskType, durationMs: Date.now() - startedAt, ...extra })

  void emit('admin_task_started')
  return {
    taskId,
    generated: (result?: string) => emit('admin_result_generated', { result }),
    accepted: (producedItemId?: string) => { closed = true; return emit('admin_result_accepted', { producedItemId, finalAction: 'accepted' }) },
    rejected: (reason?: string) => { closed = true; return emit('admin_result_rejected', { result: reason, finalAction: 'rejected' }) },
    edited: () => emit('admin_result_edited', { finalAction: 'edited' }),
    /** النتيجة صارت عملاً حقيقياً: مسودّة، تصميم منزّل، حلقة، قرار محفوظ. */
    converted: (convertedTo: string, producedItemId?: string) => { closed = true; return emit('admin_result_converted', { convertedTo, producedItemId, finalAction: 'converted' }) },
    abandoned: () => { if (closed) return Promise.resolve(); closed = true; return emit('admin_task_abandoned', { finalAction: 'abandoned' }) },
  }
}

/** توصيةٌ عُرضت ثم قُبلت أو أُهملت — بلا نصّ التوصية نفسها. */
export const trackRecommendation = (tool: string, type: string, used: boolean) =>
  trackAdminUsage(used ? 'admin_recommendation_used' : 'admin_recommendation_ignored', { tool, taskType: type })

/* ── التحكّم والخصوصية ───────────────────────────────────────────── */

export function setAdminUsageTracking(enabled: boolean) {
  if (typeof localStorage === 'undefined') return
  if (enabled) localStorage.removeItem(DISABLED_KEY)
  else localStorage.setItem(DISABLED_KEY, '1')
}

export function isAdminUsageTrackingEnabled() {
  return typeof localStorage === 'undefined' || localStorage.getItem(DISABLED_KEY) !== '1'
}

/** جلسة اختبار: تُقاس وتُعلَّم، ولا تدخل في أي حكمٍ على أداة. */
export function setAdminTestSession(enabled: boolean) {
  if (typeof sessionStorage === 'undefined') return
  if (enabled) sessionStorage.setItem(TEST_SESSION_KEY, '1')
  else sessionStorage.removeItem(TEST_SESSION_KEY)
}

export function isTestSession() {
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TEST_SESSION_KEY) === '1'
}

/** تنظيفٌ يدويّ لما تجاوز مدّة الاحتفاظ — احتياطٌ لو لم تُفعَّل سياسة TTL. */
export async function purgeExpiredAdminUsage() {
  try {
    const db = await getDb()
    if (!db) return 0
    const { collection, deleteDoc, getDocs, limit, query, Timestamp, where } = await import('firebase/firestore')
    const cutoff = Timestamp.fromDate(new Date(Date.now() - ADMIN_USAGE_RETENTION_DAYS * 86_400_000))
    const snapshot = await getDocs(query(collection(db, 'admin_tool_events'), where('createdAt', '<', cutoff), limit(400)))
    await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)))
    return snapshot.size
  } catch { return 0 }
}
