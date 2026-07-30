import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const out = mkdtempSync(join(tmpdir(), 'book-world-'))
const compile = spawnSync('tsc', [
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
assert.match(worldSource, /<details className="group rounded-2xl/)
assert.doesNotMatch(worldSource, /<details[^>]*\sopen(?:=|\s|>)/, 'Book World disclosures must be collapsed by default')
assert.ok((detailSource.match(/<details key=\{title\}/g) || []).length === 1)
assert.doesNotMatch(detailSource, /<details[^>]*\sopen(?:=|\s|>)/, 'book guide cards must be collapsed by default')

rmSync(out, { recursive: true, force: true })
console.log('Book World timeline and low-clutter UI: passed')
