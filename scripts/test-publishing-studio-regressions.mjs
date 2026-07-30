import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const studio = readFileSync(resolve(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
const contentManager = readFileSync(resolve(root, 'src/components/admin/ContentManager.tsx'), 'utf8')
const cms = readFileSync(resolve(root, 'src/lib/cms.ts'), 'utf8')
const calibrationWorkflow = readFileSync(resolve(root, '.github/workflows/editorial-board-calibration.yml'), 'utf8')

assert.doesNotMatch(studio, /setEditorialProgress\(\s*\[\s*\]\s*\)/, 'EditorialProgress is a state union, never an array')
assert.match(studio, /setEditorialProgress\('idle'\)/, 'reset must return EditorialProgress to idle')

const paperMapping = studio.match(/const item = papers\.find\([\s\S]*?return item \? \[\{[\s\S]*?\}\] : \[\]/)?.[0] || ''
assert.ok(paperMapping, 'research paper mapping must exist')
assert.match(paperMapping, /date: item\.year \|\| ''/, 'ResearchPaper exposes year, not date/iso')
assert.doesNotMatch(paperMapping, /item\.(?:date|iso)/, 'do not read undeclared ResearchPaper.date/iso fields')

assert.match(studio, /useState<EditorialProgress>\('idle'\)/)
assert.match(studio, /type EditorialProgress = 'idle' \| 'archive' \| 'graph' \| 'current' \| 'audience' \| 'decision' \| 'done'/)
assert.match(studio, /dir="rtl"/)
assert.match(cms, /publishedAt\?: string/,'ArticleRecord must preserve the real publication timestamp')
assert.match(contentManager, /firstPublication[\s\S]*?publishedAt: serverTimestamp\(\)/, 'manual publish must stamp first real publication')
assert.match(calibrationWorkflow, /cron: '10 5 \* \* \*'/, '7/30 calibration must run automatically every day')
assert.match(calibrationWorkflow, /editorial-board-calibration\.mjs --self-test/, 'scheduled calibration must self-test before touching Firestore')

console.log('PublishingStudio TypeScript regression guard: passed')
