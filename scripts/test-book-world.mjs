import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const out = mkdtempSync(join(tmpdir(), 'book-world-'))
/* «tsc» العالمي غير مضمون على كل جهاز (كان يعيد status=null فيحمرّ
   الاختبار قبل أن يبدأ) — نسخة المشروع المحلية هي المرجع دائماً. */
const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
const compile = spawnSync(localTsc, [
  'src/lib/book-world-timeline.ts',
  '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler',
  '--skipLibCheck', '--noEmitOnError', '--outDir', out,
], { cwd: root, encoding: 'utf8' })
assert.equal(compile.status, 0, compile.stderr || compile.stdout)
const timeline = await import(pathToFileURL(join(out, 'book-world-timeline.js')).href)

const rows = [
  ['2017-04-30', 'قديم 2017', 4],
  ['2017-12-18', 'الأقوى 2017', 8],
  ['2018-02-01', '2018', 5],
  ['2019-02-01', '2019', 5],
  ['2020-03-03', '2020', 5],
  ['2021-02-01', '2021', 5],
  ['2022-02-01', '2022', 5],
  ['2023-02-01', '2023', 5],
  ['2024-02-01', '2024', 5],
  ['2025-02-01', '2025', 5],
  ['2026-01-01', '2026 أ', 20],
  ['2026-07-01', '2026 ب', 21],
].map(([iso, title, score], index) => ({ item: { slug: `a-${index}`, title, iso }, score }))

const result = timeline.buildBookWorldTimeline(rows, 6)
assert.equal(result.length, 6)
assert.equal(result[0].year, '2017')
assert.equal(result.at(-1).year, '2026')
assert.equal(new Set(result.map((row) => row.year)).size, result.length, 'only one representative per year')
assert.equal(result.find((row) => row.year === '2017')?.item.title, 'الأقوى 2017')
assert.equal(result.find((row) => row.year === '2026')?.item.title, '2026 ب')
assert.ok(result.some((row) => row.year !== '2026'), 'timeline must span archive history instead of slicing newest rows')

const worldSource = readFileSync(join(root, 'src/components/BookWorld.tsx'), 'utf8')
const detailSource = readFileSync(join(root, 'src/pages/BookDetail.tsx'), 'utf8')
assert.doesNotMatch(worldSource, /\.slice\(-6\)/, 'the old newest-six timeline bug must stay removed')
assert.doesNotMatch(worldSource, /أصداء موثقة/, 'redundant echo card was intentionally removed')
assert.match(worldSource, /className="group [^"]*rounded-2xl border border-hair bg-canvas"/, 'Book World disclosures may add mobile containment classes without becoming visual cards')
assert.doesNotMatch(worldSource, /<details[^>]*\sopen(?:=|\s|>)/, 'Book World disclosures must be collapsed by default')
assert.doesNotMatch(worldSource, /while \(ideas\.length < 7\)/, 'empty/fabricated paths must never be padded into the UI')
assert.doesNotMatch(worldSource, /\.filter\(\(row\)[\s\S]{0,220}\.slice\(0,\s*7\)/, 'all verified book concepts must remain addressable from search and archive deep links')
assert.match(worldSource, /verifiedConcepts\.length \? verifiedConcepts : fallbackIdeas/, 'generic ideas must not pollute a verified full-book concept map')
assert.doesNotMatch(worldSource, /السؤال المركزي.*التطبيق.*الإنسان.*التعليم.*المستقبل.*القرار.*الأثر/s, 'generic fallback paths must stay removed')
assert.match(worldSource, /if \(!pathArticles\.length && !pathPapers\.length && !isBookConcept\) return null/, 'only a verified book concept may remain when no related archive material exists')
assert.match(worldSource, /const knowledge = getBookKnowledge\(book\.slug\)/, 'Book World must use the full-body-derived concept map')
assert.match(worldSource, /if \(!model\.paths\.length\) return null/, 'Book World itself must disappear when there are no real paths')
assert.match(worldSource, /lockOpen=\{Boolean\(activeIdea\)\}/, 'an explicitly selected path must pin its disclosure open')
assert.match(worldSource, /if \(lockOpen && !event\.currentTarget\.open\) event\.currentTarget\.open = true/, 'pinned path disclosure must resist accidental closing while other cards are opened')
assert.match(worldSource, /data-allow-multiple=\{lockOpen \? 'true' : undefined\}/, 'the pinned path disclosure must opt out of the global exclusive-details guard so another Book World card can open beside it')
assert.match(readFileSync(join(root, 'src/App.tsx'), 'utf8'), /item\.hasAttribute\('data-allow-multiple'\)/, 'the global details guard must honor the pinned Book World exception')
assert.match(worldSource, /articles: activePath\?\.articles\.slice\(0, 3\)/, 'downstream material cards must follow the selected path')
assert.match(worldSource, /timeline: activePath \? buildBookWorldTimeline\(activePath\.articles, 6\) : \[\]/, 'archive timeline must follow the selected path')
assert.doesNotMatch(worldSource, /لا توجد وصلة أرشيفية قوية لهذا المسار بعد/, 'an empty path must be hidden rather than rendered with an empty-state message')
assert.doesNotMatch(detailSource, /book-detail-guides/, 'the repetitive generic book-guide disclosures were intentionally removed')
assert.doesNotMatch(detailSource, /لماذا كُتب الكتاب\?|الفئة المستهدفة|طريقة الدخول/, 'the removed guide copy must not return')

rmSync(out, { recursive: true, force: true })
console.log('Book World timeline and low-clutter UI: passed')
