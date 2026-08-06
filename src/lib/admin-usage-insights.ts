/**
 * تحليل أحداث لوحة التحكم — منطقٌ خالصٌ قابل للاختبار، بلا React ولا شبكة.
 *
 * اللوحة يستخدمها شخصٌ واحد: مالك الموقع. فالسؤال ليس «من يعمل أكثر» بل:
 * أيّ أداةٍ تنتج قراراً، وأيّها تُفتح ثم تُترك، وأين ينقطع العمل.
 *
 * قاعدتان تحكمان كل دالة هنا:
 * 1. لا تُختلق أرقام: ما لا عيّنة له يعود `null` لا صفراً.
 * 2. لا قرار تلقائي: الدوال تُصنّف وتقترح، ولا تحذف ولا تُخفي ولا تدمج.
 */

export type AdminUsageName =
  | 'admin_tool_opened' | 'admin_task_started' | 'admin_result_generated' | 'admin_result_accepted'
  | 'admin_result_rejected' | 'admin_result_edited' | 'admin_result_converted' | 'admin_task_abandoned'
  | 'admin_recommendation_ignored' | 'admin_recommendation_used'

export type AdminUsageRow = {
  id: string
  name: AdminUsageName | string
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
  /** وقت الحدث بالميلي ثانية. الأحداث بلا وقت تُستبعد من كل حساب زمني. */
  at: number
}

export type ToolUsage = {
  tool: string
  opened: number
  started: number
  generated: number
  accepted: number
  rejected: number
  edited: number
  converted: number
  abandoned: number
  /** متوسط مدة الجلسة على الأداة بالميلي ثانية — `null` بلا عيّنة. */
  averageDurationMs: number | null
  durationSamples: number
  lastUsedAt: number | null
  daysSinceLastUse: number | null
  /** فتح ← نتيجة. `null` إن لم تُفتح الأداة أصلاً. */
  openToResult: number | null
  /** نتيجة ← قرار أو محتوى حقيقي. `null` إن لم تُنتج نتيجة. */
  resultToAction: number | null
  events: number
}

export const DAY = 86_400_000

const asNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const ratio = (part: number, total: number) => (total > 0 ? part / total : null)

/** يُطبّع سجلاً من Firestore إلى صفٍّ صالحٍ للحساب، أو `null` إن كان بلا وقت. */
export function normalizeUsageRow(input: Record<string, unknown> & { id?: string }): AdminUsageRow | null {
  const seconds = (input.createdAt as { seconds?: number } | undefined)?.seconds
  const at = seconds ? seconds * 1000 : Date.parse(String(input.createdAt ?? ''))
  if (!Number.isFinite(at) || at <= 0) return null
  return {
    id: String(input.id ?? ''),
    name: String(input.name ?? ''),
    tool: String(input.tool ?? '').trim() || 'غير محدّد',
    taskId: String(input.taskId ?? ''),
    taskType: String(input.taskType ?? ''),
    result: String(input.result ?? ''),
    finalAction: String(input.finalAction ?? ''),
    from: String(input.from ?? ''),
    to: String(input.to ?? ''),
    producedItemId: String(input.producedItemId ?? ''),
    durationMs: asNumber(input.durationMs),
    testSession: Boolean(input.testSession),
    at,
  }
}

/** جلسات الاختبار مستبعدة دائماً حتى لا تلوّث الحكم على الأدوات. */
export const excludeTestSessions = (rows: AdminUsageRow[]) => rows.filter((row) => !row.testSession)

export function withinWindow(rows: AdminUsageRow[], from: number, to: number) {
  return rows.filter((row) => row.at >= from && row.at < to)
}

/* ── استخدام الأدوات ─────────────────────────────────────────────── */

export function summarizeTools(rows: AdminUsageRow[], now = Date.now()): ToolUsage[] {
  const byTool = new Map<string, ToolUsage & { durations: number[] }>()
  for (const row of rows) {
    const current = byTool.get(row.tool) || {
      tool: row.tool, opened: 0, started: 0, generated: 0, accepted: 0, rejected: 0,
      edited: 0, converted: 0, abandoned: 0, averageDurationMs: null, durationSamples: 0,
      lastUsedAt: null, daysSinceLastUse: null, openToResult: null, resultToAction: null,
      events: 0, durations: [] as number[],
    }
    current.events += 1
    if (row.name === 'admin_tool_opened') current.opened += 1
    if (row.name === 'admin_task_started') current.started += 1
    if (row.name === 'admin_result_generated') current.generated += 1
    if (row.name === 'admin_result_accepted') current.accepted += 1
    if (row.name === 'admin_result_rejected') current.rejected += 1
    if (row.name === 'admin_result_edited') current.edited += 1
    if (row.name === 'admin_result_converted') current.converted += 1
    if (row.name === 'admin_task_abandoned') current.abandoned += 1
    if ((row.durationMs || 0) > 0) current.durations.push(row.durationMs || 0)
    current.lastUsedAt = Math.max(current.lastUsedAt || 0, row.at) || null
    byTool.set(row.tool, current)
  }
  return [...byTool.values()]
    .map(({ durations, ...tool }) => {
      /* القرار العملي = اعتماد أو تحويل. الظهور على الشاشة وحده ليس نتيجة. */
      const decisions = tool.accepted + tool.converted
      return {
        ...tool,
        averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        durationSamples: durations.length,
        daysSinceLastUse: tool.lastUsedAt ? Math.floor((now - tool.lastUsedAt) / DAY) : null,
        openToResult: ratio(tool.generated, tool.opened),
        resultToAction: ratio(decisions, tool.generated),
      }
    })
    .sort((a, b) => b.opened - a.opened || b.events - a.events)
}

export type DormancyBucket = 'idle30' | 'idle60' | 'idle90' | 'openedWithoutResult' | 'mostlyRejected'

export type DormancyFinding = { tool: string; bucket: DormancyBucket; samples: number; note: string }

/**
 * يُصنّف الأدوات الخاملة دون حذفٍ ولا إخفاء — العرضُ توصيةٌ والقرار للأدمن.
 * `minSamples` يمنع الحكم من عيّنةٍ صغيرة (ثلاث محاولات ليست نمطاً).
 */
export function classifyDormancy(tools: ToolUsage[], { minSamples = 3 } = {}): DormancyFinding[] {
  const findings: DormancyFinding[] = []
  for (const tool of tools) {
    const days = tool.daysSinceLastUse
    if (days !== null && days >= 90) findings.push({ tool: tool.tool, bucket: 'idle90', samples: tool.events, note: `لم تُستخدم منذ ${days} يوماً` })
    else if (days !== null && days >= 60) findings.push({ tool: tool.tool, bucket: 'idle60', samples: tool.events, note: `لم تُستخدم منذ ${days} يوماً` })
    else if (days !== null && days >= 30) findings.push({ tool: tool.tool, bucket: 'idle30', samples: tool.events, note: `لم تُستخدم منذ ${days} يوماً` })
    if (tool.opened >= minSamples && tool.generated === 0) {
      findings.push({ tool: tool.tool, bucket: 'openedWithoutResult', samples: tool.opened, note: `فُتحت ${tool.opened} مرة ولم تنتج نتيجة` })
    }
    const judged = tool.accepted + tool.rejected
    if (judged >= minSamples && tool.rejected / judged >= 0.6) {
      findings.push({ tool: tool.tool, bucket: 'mostlyRejected', samples: judged, note: `${tool.rejected} من ${judged} نتيجة مرفوضة` })
    }
  }
  return findings
}

/* ── التوصيات ────────────────────────────────────────────────────── */

export type RecommendationRow = {
  type: string
  shown: number
  used: number
  ignored: number
  /** `null` حين تقلّ العيّنة عن الحدّ — لا حكم من عيّنةٍ صغيرة. */
  acceptanceRate: number | null
  tools: string[]
  /** أدوات أخرى تقدّم النوع نفسه من التوصية. */
  overlappingTools: string[]
}

export function summarizeRecommendations(rows: AdminUsageRow[], { minSamples = 5 } = {}): RecommendationRow[] {
  const byType = new Map<string, { used: number; ignored: number; tools: Set<string> }>()
  for (const row of rows) {
    if (row.name !== 'admin_recommendation_used' && row.name !== 'admin_recommendation_ignored') continue
    const type = row.taskType?.trim() || row.result?.trim() || 'توصية بلا نوع'
    const current = byType.get(type) || { used: 0, ignored: 0, tools: new Set<string>() }
    if (row.name === 'admin_recommendation_used') current.used += 1
    else current.ignored += 1
    current.tools.add(row.tool)
    byType.set(type, current)
  }
  return [...byType.entries()]
    .map(([type, value]) => {
      const shown = value.used + value.ignored
      return {
        type,
        shown,
        used: value.used,
        ignored: value.ignored,
        acceptanceRate: shown >= minSamples ? value.used / shown : null,
        tools: [...value.tools],
        overlappingTools: value.tools.size > 1 ? [...value.tools] : [],
      }
    })
    .sort((a, b) => b.ignored - a.ignored || b.shown - a.shown)
}

/* ── مسارات العمل ────────────────────────────────────────────────── */

export type WorkflowInsight = {
  starts: { tool: string; count: number }[]
  ends: { tool: string; count: number }[]
  transitions: { from: string; to: string; count: number }[]
  /** مسارات انتهت بقرارٍ حقيقي، وأخرى انقطعت قبله. */
  successfulPaths: { path: string[]; count: number }[]
  breakpoints: { tool: string; count: number; note: string }[]
  sessions: number
}

const SESSION_GAP = 30 * 60_000

/** يقسّم الأحداث إلى جلسات عمل بفجوة نصف ساعة، ثم يستخرج شكل المسار. */
export function extractWorkflows(rows: AdminUsageRow[], { topN = 6 } = {}): WorkflowInsight {
  const ordered = [...rows].sort((a, b) => a.at - b.at)
  const sessions: AdminUsageRow[][] = []
  for (const row of ordered) {
    const current = sessions.at(-1)
    if (current && row.at - (current.at(-1)?.at ?? 0) <= SESSION_GAP) current.push(row)
    else sessions.push([row])
  }

  const starts = new Map<string, number>()
  const ends = new Map<string, number>()
  const transitions = new Map<string, number>()
  const paths = new Map<string, number>()
  const breakpoints = new Map<string, number>()
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) || 0) + 1)
  /* فاصلٌ لا يرد في أسماء الأدوات — الفراغ وحده يكسر أسماءً مركبة. */
  const SEP = String.fromCharCode(31)

  for (const session of sessions) {
    const trail: string[] = []
    for (const row of session) if (trail.at(-1) !== row.tool) trail.push(row.tool)
    if (!trail.length) continue
    bump(starts, trail[0])
    bump(ends, trail.at(-1) as string)
    for (let index = 1; index < trail.length; index += 1) bump(transitions, `${trail[index - 1]}${SEP}${trail[index]}`)

    const decided = session.some((row) => row.name === 'admin_result_accepted' || row.name === 'admin_result_converted')
    if (decided) bump(paths, trail.join(SEP))
    else {
      /* الانقطاع: أداةٌ بدأت مهمةً ثم غادرها العمل بلا قرار. */
      for (const row of session) {
        if (row.name === 'admin_task_abandoned') bump(breakpoints, row.tool)
      }
      const opener = session.find((row) => row.name === 'admin_task_started')
      if (opener && !session.some((row) => row.name === 'admin_task_abandoned')) bump(breakpoints, opener.tool)
    }
  }

  const top = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN)
  return {
    starts: top(starts).map(([tool, count]) => ({ tool, count })),
    ends: top(ends).map(([tool, count]) => ({ tool, count })),
    transitions: top(transitions).map(([key, count]) => { const [from, to] = key.split(SEP); return { from, to, count } }),
    successfulPaths: top(paths).map(([key, count]) => ({ path: key.split(SEP), count })),
    breakpoints: top(breakpoints).map(([tool, count]) => ({ tool, count, note: 'بدأت مهمة ولم تنتهِ بقرار في الجلسة نفسها' })),
    sessions: sessions.length,
  }
}

/* ── المقارنة بالفترة السابقة ────────────────────────────────────── */

export type Delta = { current: number; previous: number; change: number | null; direction: 'up' | 'down' | 'flat' | 'unknown' }

/** فرقٌ صادق: بلا أساسٍ سابق لا نسبة — `null` لا صفر ولا «+∞». */
export function compareValue(current: number, previous: number): Delta {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return { current, previous, change: null, direction: 'unknown' }
  if (previous === 0) return { current, previous, change: null, direction: current > 0 ? 'up' : 'flat' }
  const change = (current - previous) / previous
  return { current, previous, change, direction: change > 0.001 ? 'up' : change < -0.001 ? 'down' : 'flat' }
}

/** توزيع الأحداث على أسابيع أو أشهر لعرض النبض لا لحكمٍ نهائي. */
export function bucketByPeriod(rows: AdminUsageRow[], granularity: 'week' | 'month', now = Date.now()) {
  const size = granularity === 'week' ? 7 * DAY : 30 * DAY
  const buckets = new Map<number, number>()
  for (const row of rows) {
    const index = Math.floor((now - row.at) / size)
    buckets.set(index, (buckets.get(index) || 0) + 1)
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([index, count]) => ({ index, count }))
}

/* ── صياغة عربية ─────────────────────────────────────────────────── */

export const formatPercent = (value: number | null) =>
  value === null || !Number.isFinite(value) ? 'لا عيّنة' : `${Math.round(value * 100)}٪`

export function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return 'لا عيّنة'
  const seconds = Math.round(ms / 1000)
  if (seconds < 90) return `${seconds} ثانية`
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} دقيقة`
  return `${(minutes / 60).toFixed(1)} ساعة`
}

export function formatDelta(delta: Delta) {
  if (delta.change === null) return delta.previous === 0 && delta.current > 0 ? 'جديد في هذه الفترة' : 'لا أساس للمقارنة'
  const percent = Math.round(Math.abs(delta.change) * 100)
  if (delta.direction === 'flat' || percent === 0) return 'كما الفترة السابقة'
  return `${delta.direction === 'up' ? '▲' : '▼'} ${percent}٪ عن الفترة السابقة`
}
