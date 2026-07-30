import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const out = mkdtempSync(join(tmpdir(), 'editorial-board-'))
const compile = spawnSync('tsc', [
  'src/lib/editorial-board.ts',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'bundler',
  '--skipLibCheck',
  '--noEmitOnError',
  '--outDir', out,
], { cwd: root, encoding: 'utf8' })
assert.equal(compile.status, 0, compile.stderr || compile.stdout)
const board = await import(pathToFileURL(join(out, 'lib', 'editorial-board.js')).href)

const dna = ({ novelty = 82, depth = 78, evidence = 72, time = 'evergreen' } = {}) => ({
  version: 1,
  fingerprint: 'idea-test',
  topic: { label: 'تكنولوجيا التعليم', domain: 'education', confidence: 90 },
  depth: { score: depth, label: depth >= 70 ? 'عميقة' : 'ومضة' },
  tone: { id: 'academic', label: 'أكاديمية', score: 90 },
  novelty: { score: novelty, label: novelty >= 70 ? 'جديدة' : 'مألوفة' },
  audience: { primary: 'المهتمون بالتعليم', secondary: [] },
  evidence: { score: evidence, label: evidence >= 60 ? 'مبنية على دليل' : 'رأي/تأمل' },
  keywords: ['الذكاء الاصطناعي', 'الاستقلالية'],
  time: { mode: time, label: time === 'future' ? 'مستقبلية' : 'دائمة الصلاحية' },
  direction: {},
  reasons: [],
})

const article = (title = 'مقال سابق', score = 55) => ({ kind: 'article', slug: 'old', title, url: '/articles/old', score, date: '2023-04-01', excerpt: 'مادة سابقة عن التعليم والذكاء الاصطناعي.' })
const input = (patch = {}) => ({
  idea: 'هل الذكاء الاصطناعي يجعل الطالب أقل استقلالية؟',
  audience: 'المعلمون والباحثون',
  angle: 'تفويض القرار للآلة',
  sourceMode: 'received',
  sourcePerson: 'زميل',
  sourceType: 'colleague',
  sourceContext: 'نقاش أكاديمي',
  dna: dna(),
  similarity: { highest: .22, originality: 78, repeated: false, warning: false, matches: [] },
  graphMatches: [{ kind: 'article', slug: 'old', title: 'مقال سابق', score: 8, url: '/articles/old', year: '2023' }],
  archiveMaterials: [article()],
  currentEvents: [{ id: 'e1', title: 'تطور بحثي حديث', source: 'مصدر موثوق', url: 'https://example.com', relevance: 6, ageHours: 12 }],
  currentContextAvailable: true,
  audienceEvidence: { available: false, score: null, messageMatches: [], readingMatches: [], explanation: 'الوضع الشخصي لا يستخدم بيانات الجمهور.' },
  portfolioEvidence: {
    available: true, totalArticles: 100, focusCategory: 'تكنولوجيا التعليم', focusCategoryCount: 18, focusCategoryShare: 18,
    relatedArticleCount: 3, relatedBookCount: 1, relatedPaperCount: 1, saturationScore: 34, strategicNeedScore: 66,
    dominantCategories: [{ category: 'التعليم', count: 24, share: 24 }, { category: 'تكنولوجيا التعليم', count: 18, share: 18 }],
    explanation: 'المحفظة ليست متشبعة بهذا الاتجاه، وتوجد مساحة استراتيجية لإضافته.',
  },
  personalMode: true,
  suggestedTitle: 'الطالب حين يفوّض قراره للآلة',
  generatedAt: '2026-07-30T18:00:00.000Z',
  ...patch,
})

const studio = readFileSync(join(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8')
const tests = []
const test = (name, fn) => { fn(); tests.push(name) }

test('1) فكرة جديدة تماماً', () => {
  const result = board.buildEditorialBoardDecision(input())
  assert.equal(result.verdict, 'write_now')
  assert.ok(result.plan.primaryTitle)
  assert.ok(result.plan.alternatives.length <= 3)
})

test('2) فكرة مكررة من مقال قديم', () => {
  const result = board.buildEditorialBoardDecision(input({
    dna: dna({ novelty: 38 }),
    similarity: { highest: .84, originality: 16, repeated: true, warning: true, matches: [{ slug: 'old', title: 'مقال سابق', score: .84 }] },
    archiveMaterials: [article('مقال سابق', 84)],
  }))
  assert.ok(result.scores.repetitionRisk >= 80)
  assert.match(result.archiveCourt.summary, /مقال سابق/)
})

test('3) فكرة قريبة لكن الزاوية جديدة', () => {
  const result = board.buildEditorialBoardDecision(input({
    dna: dna({ novelty: 80 }),
    similarity: { highest: .56, originality: 44, repeated: true, warning: true, matches: [{ slug: 'old', title: 'مقال سابق', score: .56 }] },
  }))
  assert.equal(result.verdict, 'change_angle')
  assert.ok(result.editorialGap.gap.length > 0)
})

test('4) اقتراح Update Existing', () => {
  const result = board.buildEditorialBoardDecision(input({
    dna: dna({ novelty: 38 }),
    similarity: { highest: .84, originality: 16, repeated: true, warning: true, matches: [{ slug: 'old', title: 'مقال سابق', score: .84 }] },
    archiveMaterials: [article('مقال سابق', 84)],
  }))
  assert.equal(result.verdict, 'update_existing')
  assert.equal(result.plan.channel, 'تحديث مقال سابق')
  assert.equal(result.plan.primaryTitle, 'مقال سابق')
})

test('5) حكم Wait', () => {
  const result = board.buildEditorialBoardDecision(input({ dna: dna({ novelty: 82, time: 'future' }), currentEvents: [], currentContextAvailable: false, currentContextError: 'offline' }))
  assert.equal(result.verdict, 'wait')
  assert.ok(result.waitingRoom?.reviewAt)
})

test('6) حكم Reject', () => {
  const result = board.buildEditorialBoardDecision(input({
    idea: 'ذكاء تعليم',
    dna: dna({ novelty: 42, depth: 20, evidence: 20 }),
    similarity: { highest: .5, originality: 50, repeated: true, warning: true, matches: [{ slug: 'old', title: 'مقال سابق', score: .5 }] },
    graphMatches: [], archiveMaterials: [],
    audienceEvidence: { available: false, score: null, messageMatches: [], readingMatches: [], explanation: 'لا توجد بيانات جمهور كافية.' },
  }))
  assert.equal(result.verdict, 'reject')
  assert.equal(result.verdictLabel, 'لا تكتب')
})

test('7) current-context failure fallback', () => {
  const result = board.buildEditorialBoardDecision(input({ currentEvents: [], currentContextAvailable: false, currentContextError: 'offline' }))
  assert.equal(result.scores.timing, null)
  assert.match(result.timingRadar.explanation, /تعذّر فحص السياق الحالي/)
})

test('8) الوضع الشخصي لا يخترع صوت جمهور', () => {
  const result = board.buildEditorialBoardDecision(input({ audienceEvidence: { available: true, score: 99, messageMatches: [{ theme: 'يجب تجاهله', count: 99, strength: 'وهمي' }], readingMatches: [], explanation: 'يجب ألا يدخل القرار.' } }))
  assert.equal(result.scores.audienceInterest, null)
  assert.equal(result.audienceRadar.available, false)
  assert.equal(result.audienceRadar.messageMatches.length, 0)
  assert.match(result.dataNotes.join(' '), /الوضع الشخصي/)
})

test('9) Knowledge Graph unavailable fallback', () => {
  const result = board.buildEditorialBoardDecision(input({ graphMatches: [], archiveMaterials: [article()] }))
  assert.match(result.dataNotes.join(' '), /فحص التشابه والأرشيف المباشر/)
  assert.ok(result.archiveCourt.nearest.length > 0)
})

test('10) duplicate proposals', () => {
  const first = board.buildEditorialBoardDecision(input({ generatedAt: '2026-07-30T18:00:00.000Z' }))
  const second = board.buildEditorialBoardDecision(input({ generatedAt: '2026-07-31T18:00:00.000Z' }))
  assert.equal(first.fingerprint, second.fingerprint)
  assert.notEqual(first.id, second.id)
  assert.match(studio, /duplicateOf: previous\?\.id \|\| null/)
})

test('11) save and reload decision', () => {
  assert.match(studio, /setDoc\(doc\(db, 'admin_editorial_board', decision\.id\)/)
  assert.match(studio, /item\.data\(\) as Record<string, any>/)
  assert.match(studio, /setEditorialHistory\(/)
})

test('12) start article handoff', () => {
  assert.match(studio, /const launchEditorialArticle/)
  assert.match(studio, /const startEditorialArticle/)
  assert.match(studio, /void rebuild\(\{ title: decision\.plan\.primaryTitle, angle: handoffAngle \}\)/)
  assert.match(studio, /doNotRepeat/)
  assert.match(studio, /evidenceGate\.ready/)
})

test('13) RTL rendering', () => {
  assert.match(studio, /<div className="grid gap-5" dir="rtl">/)
  assert.match(studio, /data-editorial-board-entry="true"/)
})

test('14) admin-only access', () => {
  assert.match(rules, /match \/admin_editorial_board\/\{id\}[\s\S]*?allow read, create, update, delete: if isAdmin\(\)/)
})

test('15) no public exposure', () => {
  const block = rules.match(/match \/admin_editorial_board\/\{id\}[\s\S]*?\n    }/)?.[0] || ''
  assert.doesNotMatch(block, /if true/)
  assert.doesNotMatch(block, /allow read:\s*if\s*true/)
})

test('16) no auto publishing', () => {
  const start = studio.match(/const startEditorialArticle[\s\S]*?\n  }\n/)?.[0] || ''
  assert.doesNotMatch(start, /transferToArticles|status:\s*'published'|publish\(/i)
  const transfer = studio.match(/const transferToArticles[\s\S]*?\n  }\n/)?.[0] || ''
  assert.match(transfer, /status: 'draft'/)
})

test('17) no regression في استوديو النشر الحالي', () => {
  for (const contract of ['articleSimilarityReport', 'createIdeaDna', 'buildKnowledgeGraph', 'buildEditorialPortfolioEvidence', 'personalAudienceEvidence', '/api/ai/current-context', 'admin_editorial_board']) assert.match(studio, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(studio, /buildAudienceSignals|buildReaderRows/, 'المجلس الشخصي لا يستدعي ذكاء الجمهور')
  assert.match(studio, /اعرض الفكرة على مجلس التحرير/)
  assert.match(studio, /PublishingStudioNavigation/)
  const pick = studio.match(/const pickSuggestion[\s\S]*?\n  }\n/)?.[0] || ''
  assert.doesNotMatch(pick, /rebuild\(/, 'suggestion cards must not bypass the editorial decision')
})

test('18) بصمة الدليل قابلة للتدقيق ولا تحتوي درجة جمهور', () => {
  const result = board.buildEditorialBoardDecision(input())
  assert.equal(result.version, 2)
  assert.deepEqual(result.scoreEvidence.map((row) => row.key), ['strength', 'novelty', 'repetitionRisk', 'timing', 'identityFit', 'articlePotential'])
  assert.ok(result.scoreEvidence.every((row) => Array.isArray(row.signals)))
  assert.match(studio, /data-editorial-evidence-trace="true"/)
})

test('19) محاكاة القرار تقارن ثلاثة مسارات فقط من الإشارات الفعلية', () => {
  const result = board.buildEditorialBoardDecision(input())
  assert.equal(result.scenarios.items.length, 3)
  assert.deepEqual(result.scenarios.items.map((row) => row.id), ['publish_now', 'wait', 'update_existing'])
  assert.equal(result.scenarios.items.filter((row) => row.preferred).length, 1)
  assert.match(studio, /data-editorial-scenarios="true"/)
})

test('20) وعي المحفظة الفكرية يدخل القرار من الأرشيف لا من الجمهور', () => {
  const result = board.buildEditorialBoardDecision(input())
  assert.equal(result.portfolio.strategicNeedScore, 66)
  assert.match(result.why.join(' '), /المحفظة/)
  assert.match(studio, /data-editorial-portfolio="true"/)
  assert.match(studio, /حاجة المحفظة لهذا الاتجاه/)
})

test('21) بوابة الدليل صامتة عند الجاهزية وتظهر فقط عند نقص حقيقي', () => {
  const ready = board.buildEditorialBoardDecision(input({
    dna: dna({ evidence: 78 }),
    archiveMaterials: [article(), { kind: 'paper', slug: 'p1', title: 'بحث مرتبط', url: '/research/p1', score: 62, date: '2025' }],
  }))
  assert.equal(ready.evidenceGate.ready, true)
  const missing = board.buildEditorialBoardDecision(input({
    dna: dna({ evidence: 28, depth: 82, time: 'current' }),
    archiveMaterials: [], currentEvents: [], currentContextAvailable: false, currentContextError: 'offline',
  }))
  assert.equal(missing.evidenceGate.ready, false)
  assert.ok(missing.evidenceGate.missing.length >= 1)
  assert.match(studio, /data-editorial-evidence-gate="needs-evidence"/)
  assert.match(studio, /ابدأ المسودة مع تسجيل النقص/)
})

test('22) الأداة شخصية بالكامل ولا تقرأ messages أو views لقرار المجلس', () => {
  assert.match(studio, /personalMode: true/)
  assert.match(studio, /لا يعتمد على ردود جمهور/)
  const runBlock = studio.match(/const runEditorialBoard[\s\S]*?const launchEditorialArticle/)?.[0] || ''
  assert.ok(runBlock)
  assert.doesNotMatch(runBlock, /collection\([^\n]*['"](?:messages|views)['"]/, 'لا يجوز استدعاء بيانات جمهور في مجلس التحرير الشخصي')
})

// حلقة المعايرة: لا تؤثر قبل وجود عينة كافية، ثم تُحَدّ بثماني نقاط فقط.
const baseline = board.buildEditorialBoardDecision(input())
const calibrated = board.buildEditorialBoardDecision(input({ calibrationProfile: { sampleSize: 4, strengthBias: 8, articlePotentialBias: -8 } }))
assert.equal(calibrated.scores.strength, Math.min(100, baseline.scores.strength + 8))
assert.equal(calibrated.scores.articlePotential, Math.max(0, baseline.scores.articlePotential - 8))
assert.match(calibrated.dataNotes.join(' '), /معايرة أداء وليست Machine Learning/)

rmSync(out, { recursive: true, force: true })
console.log(`Editorial board decision intelligence: ${tests.length}/22 passed`)
