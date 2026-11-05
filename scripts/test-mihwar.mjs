#!/usr/bin/env node
// اختبارات منطق «مِحور»: الصلة، الدمج عند التعارض، الترحيل، الموجز، الخطة، النسخ الاحتياطي.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildLexicon } from './build-mihwar-lexicon.mjs'
import { DEFAULT_INTERESTS, scoreItem, reasonText, expandPhrase, safeUrl, canonicalUrl, validPastDate, deadlineStatus, sanitizeItem, dedupe } from '../src/pages/mihwar-core.mjs'
import { blankState, migrate, mergeStates, validateBackup, buildDigest, fiveMinutePlan, rankFeed, buildIcs, toCsvRows } from '../src/pages/mihwar-state.mjs'

let passed = 0
const t = (name, fn) => { try { fn(); passed++; console.log('✓', name) } catch (e) { console.error('✗', name, '\n  ', e.message); process.exitCode = 1 } }
const rel = (title, description = '') => scoreItem({ title, description }, DEFAULT_INTERESTS).relevant
const NOW = Date.parse('2026-11-05T09:00:00Z')

t('كلمة learning وحدها لا تكفي', () => { assert.equal(rel('Deep learning for protein folding'), false); assert.equal(rel('Learning from failure in surgery'), false); assert.equal(rel('Reinforcement learning in robotics', 'machine learning model'), false) })
t('عبارة قوية تكفي', () => { assert.equal(rel('Generative AI in higher education'), true); assert.equal(rel('Blended learning outcomes'), true); assert.equal(rel('أثر الذكاء الاصطناعي على الطلاب'), true) })
t('الاستبعاد والخلط', () => { assert.equal(rel('AI in the stock market and cryptocurrency'), false); assert.equal(rel('Education in Kuwait: digital divide'), true) })
t('سبب الظهور موجود', () => { const r = scoreItem({ title: 'Gamification of statistics courses' }, DEFAULT_INTERESTS); assert.ok(r.reasons[0].phrase && r.reasons[0].interest) })
t('روابط خطرة تُرفض', () => { for (const u of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'http://localhost/x', 'https://user:p@x.com', '']) assert.equal(safeUrl(u), '') ; assert.ok(safeUrl('https://a.org/x')) })
t('تنظيف الروابط وإزالة التكرار', () => { assert.equal(canonicalUrl('http://www.a.org/x/?utm_source=1#h'), 'https://a.org/x'); assert.equal(canonicalUrl('https://dx.doi.org/10.1/ABC'), 'https://doi.org/10.1/abc') })
t('تواريخ مستقبلية وغير صالحة', () => { assert.equal(validPastDate('2031-01-01', NOW), null); assert.equal(validPastDate('garbage', NOW), null); assert.ok(validPastDate('2026-11-04', NOW)) })
t('sanitizeItem يسقط العناوين والروابط الفاسدة', () => { assert.equal(sanitizeItem({ title: 'ok title long', url: 'javascript:x' }), null); const i = sanitizeItem({ title: '<b>Gamification</b> in school', url: 'https://x.org/a', description: '<script>alert(1)</script>hi' }); assert.equal(i.title, 'Gamification in school'); assert.ok(!i.description.includes('<')) })
t('dedupe عبر المصادر', () => { const a = sanitizeItem({ title: 'Generative AI in higher education: a long title', url: 'https://a.org/1', source: 'A' }); const b = sanitizeItem({ title: 'Generative AI in higher education: a long title', url: 'https://b.org/2', source: 'B' }); assert.equal(dedupe([a, b]).length, 1) })
t('حالة المواعيد', () => { assert.equal(deadlineStatus({ deadline: '2026-11-07' }, NOW).code, 'urgent'); assert.equal(deadlineStatus({ deadline: '2026-11-25' }, NOW).code, 'soon'); assert.equal(deadlineStatus({ deadline: '2026-10-01' }, NOW).code, 'expired'); assert.equal(deadlineStatus({}, NOW).code, 'unknown') })

t('ترحيل v1 يحفظ المحفوظات والملاحظات ويعطّل الاهتمامات القديمة المفردة', () => {
  const v1 = { version: 1, items: [{ id: 'a', title: 'Saved paper', url: 'https://x.org/a', type: 'بحث' }, { id: 'b', title: 'Other', url: 'https://x.org/b' }], saved: { a: true }, notes: {}, projects: [{ id: 'p', title: 'P' }], tasks: [{ title: 'T' }], interests: [{ name: 'قديم', terms: ['learning'] }] }
  const m = migrate(v1)
  assert.equal(m.version, 2); assert.ok(m.pinned.a); assert.ok(!m.pinned.b); assert.equal(m.items, undefined)
  assert.equal(m.tasks[0].title, 'T'); assert.ok(m.tasks[0].id)
  const old = m.interests.find((i) => i.name === 'قديم'); assert.equal(old.active, false)
  assert.ok(DEFAULT_INTERESTS.every((d) => m.interests.some((i) => i.id === d.id)))
})
t('الدمج: لا فقد، والأحدث يفوز، والحذف يُحترم', () => {
  const a = blankState(); const b = blankState()
  a.tasks = [{ id: '1', title: 'محلي', updated: '2026-11-05T10:00:00Z' }, { id: '2', title: 'مشترك قديم', updated: '2026-11-01T00:00:00Z' }]
  b.tasks = [{ id: '2', title: 'مشترك جديد', updated: '2026-11-04T00:00:00Z' }, { id: '3', title: 'بعيد', updated: '2026-11-03T00:00:00Z' }, { id: '4', title: 'سيُحذف', updated: '2026-11-01T00:00:00Z' }]
  a.tombstones = { 4: '2026-11-05T00:00:00Z' }
  a.saved = { x: true }; b.saved = { y: true }; a.lastVisit = '2026-11-05T01:00:00Z'; b.lastVisit = '2026-11-02T00:00:00Z'
  const m = mergeStates(a, b)
  assert.deepEqual(m.tasks.map((x) => x.id).sort(), ['1', '2', '3']); assert.equal(m.tasks.find((x) => x.id === '2').title, 'مشترك جديد')
  assert.ok(m.saved.x && m.saved.y); assert.equal(m.lastVisit, '2026-11-05T01:00:00Z')
})
t('استعادة عنصر محذوف بعد الحذف تعمل (تحديث أحدث من الشاهد)', () => {
  const a = blankState(); a.tombstones = { 9: '2026-11-05T00:00:00Z' }; a.tasks = [{ id: '9', title: 'عاد', updated: '2026-11-05T01:00:00Z' }]
  assert.equal(mergeStates(a, blankState()).tasks.length, 1)
})
t('validateBackup يرفض الفاسد وينقّي الروابط', () => {
  assert.equal(validateBackup(null).ok, false); assert.equal(validateBackup({ version: 9 }).ok, false); assert.equal(validateBackup({ version: 2, tasks: 'x' }).ok, false)
  const v = validateBackup({ version: 2, research: [{ id: 'r', title: 'R', url: 'javascript:alert(1)' }], pinned: { z: { id: 'z', title: 'Z', url: 'javascript:1' } } })
  assert.ok(v.ok); assert.equal(v.state.research[0].url, ''); assert.ok(!v.state.pinned.z)
})

const feed = [
  { id: 'n1', title: 'Generative AI in higher education: survey', url: 'https://a.org/1', source: 'A', sourceId: 'a', type: 'بحث', published: '2026-11-04T00:00:00Z', fetched: '2026-11-04T20:00:00Z', description: '' },
  { id: 'n2', title: 'Deep learning for protein folding', url: 'https://a.org/2', source: 'B', sourceId: 'b', type: 'بحث', published: '2026-11-04T00:00:00Z', fetched: '2026-11-04T20:00:00Z' },
  { id: 'c1', title: 'ICAIE 2027 International Conference on Artificial Intelligence and Education', url: 'https://w.org/c1', source: 'WikiCFP', sourceId: 'wikicfp', type: 'مؤتمر', deadline: '2026-11-09', fetched: '2026-11-04T20:00:00Z' },
  { id: 'c2', title: 'Old Conference on Gamification in education', url: 'https://w.org/c2', source: 'WikiCFP', sourceId: 'wikicfp', type: 'مؤتمر', deadline: '2026-09-01', fetched: '2026-11-04T20:00:00Z' },
  { id: 'o1', title: 'Gamification in online learning: a study', url: 'https://a.org/3', source: 'C', sourceId: 'c', type: 'مقال', published: '2026-10-01T00:00:00Z', fetched: '2026-10-02T00:00:00Z' },
]
t('الترتيب يستبعد البعيد عن الاهتمامات', () => { const ids = rankFeed(feed, blankState(), NOW).map((r) => r.item.id); assert.ok(!ids.includes('n2')); assert.ok(ids.includes('n1')) })
t('إخفاء مصدر', () => { const s = blankState(); s.sourcesOff.a = true; assert.ok(!rankFeed(feed, s, NOW).some((r) => r.item.sourceId === 'a')) })
t('شنو فاتني: الجديد منذ آخر زيارة + مواعيد + مهام', () => {
  const s = blankState(); s.tasks = [{ id: 't1', title: 'متأخرة', deadline: '2026-11-01' }, { id: 't2', title: 'قريبة', deadline: '2026-11-07' }, { id: 't3', title: 'بعيدة', deadline: '2027-01-01' }]
  s.conferences = [{ id: 'k', title: 'مؤتمر متابع', deadline: '2026-11-12', status: 'قيد الإعداد' }]
  const d = buildDigest(s, feed, '2026-11-04T12:00:00Z', NOW)
  assert.ok(d.fresh.some((r) => r.item.id === 'n1')); assert.ok(!d.fresh.some((r) => r.item.id === 'o1')); assert.equal(d.tasksOverdue.length, 1); assert.equal(d.tasksSoon.length, 1); assert.equal(d.trackedDeadlines.length, 1)
  assert.ok(d.urgentOpps.some((x) => x.i.id === 'c1')); assert.ok(!d.urgentOpps.some((x) => x.i.id === 'c2'))
  s.read.n1 = '2026-11-05T00:00:00Z'; assert.ok(!buildDigest(s, feed, '2026-11-04T12:00:00Z', NOW).fresh.some((r) => r.item.id === 'n1'))
})
t('خمس دقائق: ≤ 5 دقائق، الأعجل أولاً، تنوع المصادر', () => {
  const s = blankState(); s.tasks = [{ id: 't1', title: 'متأخرة', deadline: '2026-11-01' }]
  const p = fiveMinutePlan(s, feed, NOW)
  assert.ok(p.minutes <= 5); assert.equal(p.steps[0].kind, 'tasks'); const srcs = p.steps.filter((x) => x.kind === 'item').map((x) => x.item.sourceId); assert.equal(new Set(srcs).size, srcs.length)
  assert.deepEqual(fiveMinutePlan(blankState(), [], NOW).steps, [])
})
t('ICS مع تذكيرين وبلا حقن', () => { const ics = buildIcs({ id: 'x', title: 'a\r\nEND:VEVENT', date: '2026-12-01', url: 'javascript:x' }); assert.equal((ics.match(/VALARM/g) || []).length, 4); assert.ok(!ics.includes('javascript:')); assert.equal((ics.match(/^END:VEVENT/gm) || []).length, 1) })
t('CSV يتضمن كل المجموعات', () => { const s = blankState(); s.tasks = [{ id: '1', title: 'T' }]; s.ideas = [{ id: '2', title: 'I' }]; assert.equal(toCsvRows(s, { tasks: 'مهمة', ideas: 'فكرة', research: '', conferences: '', projects: '', achievements: '', appointments: '' }).length, 3) })

// ---- قاموس الموقع ----
t('القاموس المولَّد غير قديم (شغّل node scripts/build-mihwar-lexicon.mjs)', () => { const disk = JSON.parse(fs.readFileSync(new URL('../src/pages/mihwar-lexicon.json', import.meta.url), 'utf8')); assert.deepEqual(disk, buildLexicon()) })
t('المرادفات توسّع العبارة وتظهر في السبب', () => {
  assert.ok(expandPhrase('educational technology').includes('instructional technology'))
  assert.ok(expandPhrase('!التلعيب').some((x) => /gameful/i.test(x)))
  const r = scoreItem({ title: 'Gameful learning in secondary schools' }, DEFAULT_INTERESTS)
  assert.equal(r.relevant, true); assert.ok(reasonText(r.reasons).includes('مرادف'))
})
t('المرادف القصير الملتبس لا يوسّع ولا يكفي كلمة عامة', () => {
  assert.deepEqual(expandPhrase('AI'), []); assert.deepEqual(expandPhrase('a + b'), [])
  assert.equal(scoreItem({ title: 'Learning rate schedules for deep nets' }, DEFAULT_INTERESTS).relevant, false)
})
console.log(`\n${passed} اختبارات نجحت`)
