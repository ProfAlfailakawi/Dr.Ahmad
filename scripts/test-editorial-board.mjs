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
  audienceEvidence: { available: true, score: 72, messageMatches: [{ theme: 'الذكاء الاصطناعي', count: 4, strength: 'يتكرر' }], readingMatches: [], explanation: 'ظهرت إشارات جمهور حقيقية.' },
  suggestedTitle: 'الطالب حين يفوّض قراره للآلة',
  generatedAt: '2026-07-30T18:00:00.000Z',
  ...patch,
})

const write = board.buildEditorialBoardDecision(input())
assert.equal(write.verdict, 'write_now')
assert.equal(write.verdictLabel, 'اكتب الآن')
assert.ok(write.plan.primaryTitle)
assert.ok(write.plan.alternatives.length <= 3)
assert.equal(write.scores.audienceInterest, 72)
assert.equal(write.waitingRoom, null)

const update = board.buildEditorialBoardDecision(input({
  dna: dna({ novelty: 38 }),
  similarity: { highest: .84, originality: 16, repeated: true, warning: true, matches: [{ slug: 'old', title: 'مقال سابق', score: .84 }] },
  archiveMaterials: [article('مقال سابق', 84)],
}))
assert.equal(update.verdict, 'update_existing')
assert.equal(update.plan.channel, 'تحديث مقال سابق')
assert.equal(update.plan.primaryTitle, 'مقال سابق')

const changed = board.buildEditorialBoardDecision(input({
  dna: dna({ novelty: 80 }),
  similarity: { highest: .56, originality: 44, repeated: true, warning: true, matches: [{ slug: 'old', title: 'مقال سابق', score: .56 }] },
}))
assert.equal(changed.verdict, 'change_angle')

const waiting = board.buildEditorialBoardDecision(input({
  dna: dna({ novelty: 82, time: 'future' }),
  currentEvents: [],
  currentContextAvailable: false,
  currentContextError: 'offline',
}))
assert.equal(waiting.verdict, 'wait')
assert.ok(waiting.waitingRoom?.reviewAt)
assert.equal(waiting.scores.timing, null)

const rejected = board.buildEditorialBoardDecision(input({
  idea: 'ذكاء تعليم',
  dna: dna({ novelty: 42, depth: 20, evidence: 20 }),
  similarity: { highest: .5, originality: 50, repeated: true, warning: true, matches: [{ slug: 'old', title: 'مقال سابق', score: .5 }] },
  graphMatches: [],
  archiveMaterials: [],
  audienceEvidence: { available: false, score: null, messageMatches: [], readingMatches: [], explanation: 'لا توجد بيانات جمهور كافية.' },
}))
assert.equal(rejected.verdict, 'reject')
assert.equal(rejected.verdictLabel, 'لا تكتب')

const missing = board.buildEditorialBoardDecision(input({
  graphMatches: [],
  archiveMaterials: [],
  currentEvents: [],
  currentContextAvailable: false,
  audienceEvidence: { available: false, score: null, messageMatches: [], readingMatches: [], explanation: 'لا توجد بيانات جمهور كافية.' },
}))
assert.equal(missing.scores.identityFit, null)
assert.equal(missing.scores.audienceInterest, null)
assert.equal(missing.scores.timing, null)
assert.equal(board.editorialScoreLabel(null), 'لا توجد بيانات كافية')

const studio = readFileSync(join(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
for (const contract of ['articleSimilarityReport', 'createIdeaDna', 'buildKnowledgeGraph', 'buildAudienceSignals', 'buildReaderRows', '/api/ai/current-context', 'admin_editorial_board']) {
  assert.match(studio, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing reuse contract: ${contract}`)
}
assert.match(studio, /اعرض الفكرة على مجلس التحرير/)
assert.match(studio, /startEditorialArticle/)
assert.match(studio, /void rebuild\(\{ title: decision\.plan\.primaryTitle/)
assert.doesNotMatch(studio.match(/const pickSuggestion[\s\S]*?\n  }\n/)?.[0] || '', /rebuild\(/, 'suggestion cards must not bypass the editorial decision')
assert.doesNotMatch(studio.match(/const startEditorialArticle[\s\S]*?\n  }\n/)?.[0] || '', /transferToArticles|publish/i, 'council approval must never auto-publish')

const rules = readFileSync(join(root, 'firestore.rules'), 'utf8')
assert.match(rules, /match \/admin_editorial_board\/\{id\}[\s\S]*?if isAdmin\(\)/)

rmSync(out, { recursive: true, force: true })
console.log('Editorial board decision intelligence: passed')
