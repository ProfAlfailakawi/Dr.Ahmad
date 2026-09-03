import { performance } from 'node:perf_hooks'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSearchPostings, buildSimilarityGraph, createArchiveIndex, queryArchiveIndex, sampleVisualArchive, searchPostingCandidates, selectTopK } from '../src/lib/archive-scale.mjs'
import { buildSitemapDocuments, sitemapLocsFromDist } from './archive-sitemap.mjs'

const COUNT = Number(process.env.ARCHIVE_SCALE_COUNT || 100_000)
const heapStart = process.memoryUsage().heapUsed
const categories = Array.from({ length: 24 }, (_, i) => `محور ${i + 1}`)
const concepts = Array.from({ length: 5000 }, (_, i) => `مفهوم${i}`)
const methods = ['تعليم', 'تقنية', 'هوية', 'مجتمع', 'بحث', 'تعلم', 'انسان', 'معرفة']

const rows = Array.from({ length: COUNT }, (_, index) => {
  const concept = concepts[index % concepts.length]
  const secondary = concepts[(index * 17 + 43) % concepts.length]
  const year = String(2005 + (index % 22))
  const cat = categories[index % categories.length]
  return {
    id: index,
    slug: `item-${index}`,
    title: `${concept} ${methods[index % methods.length]} ${index}`,
    excerpt: `${secondary} ${cat} ${methods[(index + 3) % methods.length]} أرشيف قابل للتوسع والاسترجاع`,
    year,
    iso: `${year}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    cat,
    kind: index % 12 === 0 ? 'paper' : index % 9 === 0 ? 'media' : 'article',
  }
})

const indexStart = performance.now()
const archive = createArchiveIndex(rows, {
  getText: (item) => `${item.title} ${item.excerpt}`,
  getYear: (item) => item.year,
  getCategory: (item) => item.cat,
  getSortKey: (item) => item.iso,
  maxTokensPerItem: 32,
})
const indexMs = performance.now() - indexStart
assert.equal(archive.items.length, COUNT)
assert.equal(archive.years.length, 22)
assert.equal(archive.categories.length, categories.length)

const queryStart = performance.now()
let checksum = 0
for (let iteration = 0; iteration < 40; iteration += 1) {
  const result = queryArchiveIndex(archive, {
    query: concepts[(iteration * 113) % concepts.length],
    year: String(2005 + (iteration % 22)),
    category: categories[iteration % categories.length],
    page: 1 + (iteration % 3),
    pageSize: 18,
  })
  checksum += result.total + result.items.length
}
const queryMs = performance.now() - queryStart
assert.ok(checksum >= 0)

const searchStart = performance.now()
const postings = buildSearchPostings(rows, { getText: (item) => `${item.title} ${item.excerpt}`, maxTokensPerItem: 28 })
for (let iteration = 0; iteration < 50; iteration += 1) {
  const candidates = searchPostingCandidates(postings, `${concepts[(iteration * 97) % concepts.length]} تعليم`, 700)
  assert.ok(candidates.length <= 700)
}
const searchMs = performance.now() - searchStart

const topKStart = performance.now()
const topK = selectTopK(rows, 12, (item) => (item.id * 37) % 1009, (item) => item.slug)
const topKMs = performance.now() - topKStart
assert.equal(topK.length, 12)

const visualStart = performance.now()
const pinnedSlugs = ['item-3', 'item-55555', 'item-99999']
const visualSample = sampleVisualArchive(rows, 2400, {
  keyOf: (item) => item.slug,
  groupOf: (item) => `${item.cat}|${item.year}`,
  pinKeys: pinnedSlugs,
})
const visualMs = performance.now() - visualStart
assert.equal(visualSample.length, 2400, 'visual LOD must obey the DOM budget')
for (const slug of pinnedSlugs) assert.ok(visualSample.some((item) => item.slug === slug), `pinned visual record missing: ${slug}`)
assert.ok(new Set(visualSample.map((item) => item.cat)).size >= 20, 'visual LOD lost archive category breadth')

const graphNodes = rows
const graphStart = performance.now()
const edges = buildSimilarityGraph(graphNodes, {
  getText: (item) => `${item.title} ${item.excerpt}`,
  getTitle: (item) => item.title,
  getKind: (item) => item.kind,
  maxNeighbors: 3,
  maxCandidates: 96,
  maxCandidateTokens: 5,
  maxPostingRatio: .012,
  maxPostingAbsolute: 900,
  minScore: 5,
  conceptKind: '__none__',
})
const graphMs = performance.now() - graphStart
assert.ok(edges.length <= COUNT * 3, `edge cap broken: ${edges.length}`)

const sitemapStart = performance.now()
const sitemapDocuments = buildSitemapDocuments(rows.map((item) => ({
  loc: `https://dr-alfailakawi.com/archive/${item.slug}`,
  lastmod: item.iso,
  priority: '0.6',
})), 'https://dr-alfailakawi.com')
const sitemapMs = performance.now() - sitemapStart
const sitemapIndex = sitemapDocuments.get('sitemap.xml') || ''
assert.ok(sitemapIndex.includes('<sitemapindex'), '100k routes must produce a sitemap index')
assert.equal([...sitemapDocuments.keys()].filter((name) => /^sitemap-\d+\.xml$/.test(name)).length, Math.ceil(COUNT / 45_000))
for (const [name, body] of sitemapDocuments) {
  if (name === 'sitemap.xml') continue
  const urls = [...body.matchAll(/<url>/g)].length
  assert.ok(urls <= 45_000, `${name} exceeds sitemap URL budget: ${urls}`)
}

const sitemapTemp = mkdtempSync(join(tmpdir(), 'archive-2036-sitemap-'))
try {
  for (const [name, body] of sitemapDocuments) writeFileSync(join(sitemapTemp, name), body)
  const recovered = sitemapLocsFromDist(sitemapTemp)
  assert.equal(recovered.length, COUNT, 'sitemap index must recover every content URL')
  assert.equal(new Set(recovered).size, COUNT, 'sitemap index must not duplicate content URLs')
} finally {
  rmSync(sitemapTemp, { recursive: true, force: true })
}

// Stable-hash body sharding: 100k articles remain ~49 slugs per 2,048-bucket shard.
const buckets = new Uint32Array(2048)
const hash = (value) => {
  let out = 2166136261
  for (let i = 0; i < value.length; i += 1) { out ^= value.charCodeAt(i); out = Math.imul(out, 16777619) }
  return out >>> 0
}
for (let i = 0; i < COUNT; i += 1) buckets[hash(`item-${i}`) % buckets.length] += 1
const maxBucket = Math.max(...buckets)
const minBucket = Math.min(...buckets)
assert.ok(maxBucket < Math.ceil(COUNT / buckets.length) * 1.8, `shard skew too high: ${maxBucket}`)

const heapMb = (process.memoryUsage().heapUsed - heapStart) / 1024 / 1024
const totalMs = indexMs + queryMs + searchMs + topKMs + visualMs + graphMs + sitemapMs
const limits = {
  indexMs: 8_000,
  queryMs: 4_000,
  searchMs: 10_000,
  topKMs: 2_000,
  visualMs: 1_000,
  graphMs: 60_000,
  sitemapMs: 4_000,
  heapMb: 700,
}
assert.ok(indexMs < limits.indexMs, `archive index too slow: ${indexMs.toFixed(1)}ms`)
assert.ok(queryMs < limits.queryMs, `archive queries too slow: ${queryMs.toFixed(1)}ms`)
assert.ok(searchMs < limits.searchMs, `search postings too slow: ${searchMs.toFixed(1)}ms`)
assert.ok(topKMs < limits.topKMs, `top-k selection too slow: ${topKMs.toFixed(1)}ms`)
assert.ok(visualMs < limits.visualMs, `visual archive sampling too slow: ${visualMs.toFixed(1)}ms`)
assert.ok(graphMs < limits.graphMs, `similarity graph too slow: ${graphMs.toFixed(1)}ms`)
assert.ok(sitemapMs < limits.sitemapMs, `sitemap sharding too slow: ${sitemapMs.toFixed(1)}ms`)
assert.ok(heapMb < limits.heapMb, `heap growth too high: ${heapMb.toFixed(1)}MB`)

console.log(JSON.stringify({
  ok: true,
  items: COUNT,
  edges: edges.length,
  bodyBuckets: { min: minBucket, max: maxBucket, average: Number((COUNT / buckets.length).toFixed(1)) },
  timingsMs: {
    archiveIndex: Number(indexMs.toFixed(1)),
    fortyFacetQueries: Number(queryMs.toFixed(1)),
    searchIndexPlusFiftyQueries: Number(searchMs.toFixed(1)),
    editorialTopK100k: Number(topKMs.toFixed(1)),
    visualLod100k: Number(visualMs.toFixed(1)),
    boundedSimilarityGraph: Number(graphMs.toFixed(1)),
    sitemap100k: Number(sitemapMs.toFixed(1)),
    totalMeasured: Number(totalMs.toFixed(1)),
  },
  heapGrowthMb: Number(heapMb.toFixed(1)),
}, null, 2))
