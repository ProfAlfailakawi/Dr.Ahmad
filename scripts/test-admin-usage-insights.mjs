#!/usr/bin/env node
/**
 * اختبارات محرك «استخدام أدواتي».
 *
 * الحكم الذي تحرسه هذه الاختبارات: لا رقمَ يُختلق عند غياب البيانات،
 * ولا حكمَ من عيّنةٍ صغيرة، ولا قرارَ تلقائي بحذفٍ أو إخفاء.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const insights = await import(new URL('../src/lib/admin-usage-insights.ts', import.meta.url).href)
const {
  DAY, normalizeUsageRow, excludeTestSessions, withinWindow, summarizeTools,
  classifyDormancy, summarizeRecommendations, extractWorkflows, compareValue,
  bucketByPeriod, formatPercent, formatDuration, formatDelta,
} = insights

let passed = 0
const test = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`) }
const NOW = Date.UTC(2026, 7, 6, 12, 0, 0)
let sequence = 0
const event = (name, tool, options = {}) => ({
  id: `e${sequence += 1}`, name, tool,
  createdAt: { seconds: Math.round((options.at ?? NOW - 60_000) / 1000) },
  ...options,
})

console.log('اختبارات محرك استخدام الأدوات:')

test('التطبيع يستبعد الأحداث بلا وقت ولا يخترع صفراً', () => {
  assert.equal(normalizeUsageRow({ id: 'x', name: 'admin_tool_opened', tool: 'radar' }), null)
  const row = normalizeUsageRow(event('admin_tool_opened', 'radar'))
  assert.equal(row.tool, 'radar')
  assert.equal(row.at, Math.round((NOW - 60_000) / 1000) * 1000)
  assert.equal(normalizeUsageRow({ ...event('admin_tool_opened', '  '), tool: '  ' }).tool, 'غير محدّد')
})

test('جلسات الاختبار مستبعدة والنافذة تحترم حدّيها', () => {
  const rows = [
    normalizeUsageRow(event('admin_tool_opened', 'radar')),
    normalizeUsageRow(event('admin_tool_opened', 'radar', { testSession: true })),
  ]
  assert.equal(excludeTestSessions(rows).length, 1)
  assert.equal(withinWindow(rows, NOW - DAY, NOW).length, 2)
  assert.equal(withinWindow(rows, NOW - 10 * DAY, NOW - 5 * DAY).length, 0)
})

test('ملخّص الأداة: فتح ونتيجة وقرار ومتوسط مدة وآخر استخدام', () => {
  const rows = [
    event('admin_tool_opened', 'studio', { durationMs: 60_000 }),
    event('admin_tool_opened', 'studio', { durationMs: 120_000 }),
    event('admin_task_started', 'studio'),
    event('admin_result_generated', 'studio'),
    event('admin_result_accepted', 'studio'),
    event('admin_result_edited', 'studio'),
    event('admin_task_abandoned', 'studio'),
  ].map(normalizeUsageRow)
  const [tool] = summarizeTools(rows, NOW)
  assert.equal(tool.opened, 2)
  assert.equal(tool.generated, 1)
  assert.equal(tool.accepted, 1)
  assert.equal(tool.edited, 1)
  assert.equal(tool.abandoned, 1)
  assert.equal(tool.averageDurationMs, 90_000)
  assert.equal(tool.durationSamples, 2)
  assert.equal(tool.daysSinceLastUse, 0)
  assert.equal(tool.openToResult, 0.5)
  assert.equal(tool.resultToAction, 1)
})

test('بلا عيّنة لا نسبة: null لا صفر', () => {
  const [tool] = summarizeTools([normalizeUsageRow(event('admin_task_started', 'lonely'))], NOW)
  assert.equal(tool.openToResult, null, 'لم تُفتح الأداة فلا معدّل تحويل')
  assert.equal(tool.resultToAction, null, 'لا نتيجة فلا معدّل قرار')
  assert.equal(tool.averageDurationMs, null)
  assert.equal(formatPercent(null), 'لا عيّنة')
  assert.equal(formatDuration(null), 'لا عيّنة')
  assert.equal(formatDuration(0), 'لا عيّنة')
})

test('تصنيف الخمول: 30 و60 و90 وفتحٌ بلا نتيجة ورفضٌ غالب', () => {
  const rows = [
    event('admin_tool_opened', 'old30', { at: NOW - 31 * DAY }),
    event('admin_tool_opened', 'old60', { at: NOW - 61 * DAY }),
    event('admin_tool_opened', 'old90', { at: NOW - 120 * DAY }),
    ...[0, 1, 2].map(() => event('admin_tool_opened', 'noResult')),
    ...[0, 1, 2].map(() => event('admin_result_rejected', 'rejected')),
    event('admin_result_accepted', 'rejected'),
    event('admin_result_generated', 'rejected'),
    event('admin_tool_opened', 'rejected'),
  ].map(normalizeUsageRow)
  const findings = classifyDormancy(summarizeTools(rows, NOW))
  const bucketOf = (tool) => findings.filter((item) => item.tool === tool).map((item) => item.bucket)
  assert.deepEqual(bucketOf('old30'), ['idle30'], 'فتحةٌ واحدة لا تكفي لحكم «بلا نتيجة»')
  assert.ok(bucketOf('old60').includes('idle60'))
  assert.ok(bucketOf('old90').includes('idle90'))
  assert.ok(bucketOf('noResult').includes('openedWithoutResult'))
  assert.ok(bucketOf('rejected').includes('mostlyRejected'))
  assert.ok(findings.every((item) => item.samples > 0), 'كل تصنيف يذكر عيّنته')
})

test('لا حكم من عيّنة صغيرة', () => {
  const rows = [event('admin_tool_opened', 'tiny'), event('admin_result_rejected', 'tiny')].map(normalizeUsageRow)
  const findings = classifyDormancy(summarizeTools(rows, NOW))
  assert.ok(!findings.some((item) => item.bucket === 'openedWithoutResult'), 'فتحة واحدة ليست نمطاً')
  assert.ok(!findings.some((item) => item.bucket === 'mostlyRejected'), 'رفضة واحدة ليست نمطاً')
  const [recommendation] = summarizeRecommendations([
    normalizeUsageRow(event('admin_recommendation_ignored', 'radar', { taskType: 'اقتراح موضوع' })),
  ])
  assert.equal(recommendation.acceptanceRate, null, 'عيّنة واحدة لا تُنتج معدّلاً')
  assert.equal(recommendation.shown, 1)
})

test('التوصيات: نوعها وظهورها وقبولها وتجاهلها والأدوات المتشابهة', () => {
  const rows = [
    ...Array.from({ length: 4 }, () => event('admin_recommendation_ignored', 'radar', { taskType: 'اقتراح موضوع' })),
    ...Array.from({ length: 2 }, () => event('admin_recommendation_used', 'foresight', { taskType: 'اقتراح موضوع' })),
    event('admin_recommendation_used', 'studio', { taskType: 'اقتراح تصميم' }),
  ].map(normalizeUsageRow)
  const [topic] = summarizeRecommendations(rows)
  assert.equal(topic.type, 'اقتراح موضوع')
  assert.equal(topic.shown, 6)
  assert.equal(topic.ignored, 4)
  assert.equal(topic.used, 2)
  assert.ok(Math.abs(topic.acceptanceRate - 1 / 3) < 1e-9)
  assert.deepEqual(topic.overlappingTools.sort(), ['foresight', 'radar'])
})

test('مسارات العمل: البداية والنهاية والتنقلات والمسار الناجح ونقطة الانقطاع', () => {
  const start = NOW - 3 * DAY
  const rows = [
    event('admin_tool_opened', 'مجلس التحرير', { at: start }),
    event('admin_task_started', 'مجلس التحرير', { at: start + 60_000 }),
    event('admin_tool_opened', 'المحرر', { at: start + 120_000 }),
    event('admin_result_generated', 'المحرر', { at: start + 180_000 }),
    event('admin_result_converted', 'النشر', { at: start + 240_000 }),
    /* جلسة ثانية بعد فجوة: فكرة ← رادار ← إغلاق دون قرار */
    event('admin_tool_opened', 'الأفكار', { at: start + 5 * 3_600_000 }),
    event('admin_task_started', 'الأفكار', { at: start + 5 * 3_600_000 + 30_000 }),
    event('admin_tool_opened', 'الرادار', { at: start + 5 * 3_600_000 + 90_000 }),
    event('admin_task_abandoned', 'الرادار', { at: start + 5 * 3_600_000 + 150_000 }),
  ].map(normalizeUsageRow)
  const flow = extractWorkflows(rows)
  assert.equal(flow.sessions, 2)
  assert.deepEqual(flow.starts.map((item) => item.tool), ['مجلس التحرير', 'الأفكار'])
  assert.deepEqual(flow.ends.map((item) => item.tool), ['النشر', 'الرادار'])
  assert.deepEqual(flow.successfulPaths[0].path, ['مجلس التحرير', 'المحرر', 'النشر'])
  assert.ok(flow.transitions.some((item) => item.from === 'مجلس التحرير' && item.to === 'المحرر'))
  assert.ok(flow.transitions.every((item) => item.from && item.to), 'الأسماء المركبة لا تنكسر عند الفراغ')
  assert.equal(flow.breakpoints[0].tool, 'الرادار')
})

test('المقارنة بالفترة السابقة صادقة عند غياب الأساس', () => {
  assert.equal(compareValue(10, 5).direction, 'up')
  assert.equal(compareValue(10, 5).change, 1)
  assert.equal(compareValue(4, 8).direction, 'down')
  assert.equal(compareValue(5, 5).direction, 'flat')
  assert.equal(compareValue(7, 0).change, null, 'لا نسبة بلا أساس')
  assert.equal(formatDelta(compareValue(7, 0)), 'جديد في هذه الفترة')
  assert.equal(formatDelta(compareValue(0, 0)), 'لا أساس للمقارنة')
  assert.equal(formatDelta(compareValue(10, 5)), '▲ 100٪ عن الفترة السابقة')
  assert.equal(formatDelta(compareValue(5, 5)), 'كما الفترة السابقة')
})

test('التوزيع الأسبوعي والشهري', () => {
  const rows = [
    event('admin_tool_opened', 'a', { at: NOW - 1 * DAY }),
    event('admin_tool_opened', 'a', { at: NOW - 2 * DAY }),
    event('admin_tool_opened', 'a', { at: NOW - 10 * DAY }),
  ].map(normalizeUsageRow)
  assert.deepEqual(bucketByPeriod(rows, 'week', NOW), [{ index: 0, count: 2 }, { index: 1, count: 1 }])
  assert.deepEqual(bucketByPeriod(rows, 'month', NOW), [{ index: 0, count: 3 }])
})

test('اللوحة لا تحذف ولا تُخفي ولا تدمج تلقائياً', () => {
  const panel = readFileSync(resolve(ROOT, 'src/components/admin/UsageAnalytics.tsx'), 'utf8')
  assert.ok(!/deleteDoc|removeTool|hideTool|autoMerge/.test(panel), 'لا إجراء تلقائي على الأدوات')
  assert.match(panel, /القرار النهائي لك/u, 'تصريحٌ بأن القرار للأدمن')
  assert.match(panel, /مخصّصة|مخصص/u, 'خيار الفترة المخصّصة موجود')
  assert.match(panel, /الفترة السابقة/u, 'المقارنة معروضة')
  const tracker = readFileSync(resolve(ROOT, 'src/lib/admin-usage.ts'), 'utf8')
  assert.ok(!/body|content|text:/.test(tracker.split('addDoc')[1] || ''), 'لا يُسجَّل نص المحتوى')
  assert.match(tracker, /admin:usage-tracking-disabled/, 'زر تعطيل القياس')
  assert.match(tracker, /RETENTION|retention/i, 'سياسة احتفاظ معلنة')
})

console.log(`✓ استخدام الأدوات: ${passed}/11 حالة`)
