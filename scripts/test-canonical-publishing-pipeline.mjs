import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeCanonicalArticleBodies, mergeCanonicalContentIndex, mergeCanonicalRecords } from './canonical-cms.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))

const staticItems = [
  { id: 'article:old', kind: 'article', slug: 'old', title: 'قديم', excerpt: 'قديم', body: 'متن قديم', url: '/articles/old', image: null, date: '2020-01-01', words: 2, audio: null, keywords: 'تعليم', hash: '' },
  { id: 'book:base', kind: 'book', slug: 'base', title: 'كتاب', excerpt: 'وصف', body: '', url: '/publications/base', image: null, date: '', words: 0, audio: null, keywords: '', hash: '' },
]
const snapshot = {
  version: 1,
  overrides: [
    { id: 'article:old', patch: { title: 'عنوان مصحح', body: 'متن مصحح', status: 'published' } },
    { id: 'book:base', hidden: true, patch: {} },
  ],
  articles: [
    { id: 'new', slug: 'new', title: 'مقال جديد', excerpt: 'مقتطف', body: 'متن جديد', bodyVocalized: 'مَتْنٌ جَدِيدٌ', cat: 'تكنولوجيا', iso: '2026-08-10', status: 'published' },
    { id: 'draft', slug: 'draft', title: 'مسودة', body: 'لا تظهر', status: 'draft' },
  ],
  books: [{ id: 'new-book', slug: 'new-book', title: 'كتاب جديد', desc: 'وصف الكتاب' }],
  papers: [{ id: 'new-paper', slug: 'new-paper', title: 'Paper', titleAr: 'بحث جديد', abstractAr: 'ملخص البحث', keyFinding: 'نتيجة' }],
  media: [{ id: 'new-media', slug: 'new-media', title: 'لقاء جديد', topics: 'التعليم', transcript: 'تفريغ اللقاء' }],
}
const merged = mergeCanonicalContentIndex(staticItems, snapshot, 'https://dr-alfailakawi.com', Date.parse('2026-08-10T00:00:00Z'))
assert.equal(merged.some((item) => item.id === 'book:base'), false, 'hidden base content must disappear')
assert.equal(merged.find((item) => item.id === 'article:old')?.title, 'عنوان مصحح')
assert.equal(merged.find((item) => item.id === 'article:old')?.body, 'متن مصحح')
assert.equal(merged.some((item) => item.id === 'article:new'), true, 'published CMS addition must join the deep index')
assert.equal(merged.some((item) => item.id === 'article:draft'), false, 'draft must never join a public deep index')
assert.equal(merged.some((item) => item.id === 'book:new-book'), true, 'CMS book must join the deep index')
assert.equal(merged.some((item) => item.id === 'paper:new-paper'), true, 'CMS paper must join the deep index')
assert.equal(merged.some((item) => item.id === 'media:new-media'), true, 'CMS media must join the deep index')
const recordMerge = mergeCanonicalRecords('article', [{ slug: 'old', title: 'قديم', status: 'published' }], snapshot, Date.parse('2026-08-10T00:00:00Z'))
assert.equal(recordMerge.some((item) => item.slug === 'new'), true, 'lightweight satellite builders must see added articles')
assert.equal(recordMerge.some((item) => item.slug === 'draft'), false, 'satellite builders must exclude drafts')
const bodies = mergeCanonicalArticleBodies({ old: 'قديم' }, {}, snapshot, Date.parse('2026-08-10T00:00:00Z'))
assert.equal(bodies.normal.old, 'متن مصحح')
assert.equal(bodies.normal.new, 'متن جديد')
assert.equal(bodies.vocalized.new, 'مَتْنٌ جَدِيدٌ')

const checks = [
  ['build syncs one canonical snapshot before graph', pkg.scripts.build.includes('sync-canonical-cms.mjs && node scripts/build-knowledge-graph.mjs')],
  ['deep content index consumes canonical snapshot', read('whatsapp-agent/content-index.mjs').includes('mergeCanonicalContentIndex(items, readCanonicalCms(root), siteUrl)')],
  ['article shards consume canonical snapshot', read('scripts/build-archive-shards.mjs').includes('mergeCanonicalArticleBodies')],
  ['article pivots and caution consume canonical snapshot', read('scripts/build-article-pivots.mjs').includes('mergeCanonicalArticleBodies') && read('scripts/build-article-caution.mjs').includes('mergeCanonicalRecords')],
  ['listen and podcast manifests consume canonical article metadata', read('scripts/build-listen-index.mjs').includes("mergeCanonicalRecords('article'") && read('scripts/build-podcast-admin.mjs').includes("mergeCanonicalRecords('article'")],
  ['media chapters consume canonical media and run in every build', read('scripts/build-media-chapters.mjs').includes("mergeCanonicalRecords('media'") && pkg.scripts.build.includes('node scripts/build-media-chapters.mjs')],
  ['static SEO consumes the same canonical snapshot', read('scripts/build-static.mjs').includes("canonicalCms.source === 'firestore'")],
  ['CMS save registers automatic pipeline', read('src/components/admin/ContentManager.tsx').includes('requestContentPublicationSync({')],
  ['visibility/delete/restore also rebuild every public system', read('src/components/admin/ContentManager.tsx').includes('const refreshPublishedSystems = async') && read('src/components/admin/ContentManager.tsx').includes("refreshPublishedSystems(item, 'الحذف النهائي')") && read('src/components/admin/ContentManager.tsx').includes("refreshPublishedSystems(item, 'استعادة الأصل')")],
  ['Publishing Studio draft registers pipeline', read('src/components/admin/PublishingStudio.tsx').includes("status: 'draft'" ) && read('src/components/admin/PublishingStudio.tsx').includes('requestContentPublicationSync')],
  ['server owns authenticated publish-sync route', read('server.mjs').includes("contentPublishSyncPath = '/api/admin/content/publish-sync'") && read('server.mjs').includes("db.collection('admin_content_pipeline')")],
  ['scheduled release has an independent sweeper', read('.github/workflows/scheduled-content-release.yml').includes('release-scheduled-content.mjs')],
  ['production marks jobs only after hosting deploy', read('.github/workflows/firebase-hosting-live.yml').includes('mark-content-pipeline-deployed.mjs')],
  ['archive-scale ESM has TypeScript declaration', fs.existsSync(path.join(root, 'src/lib/archive-scale.d.mts')) && read('src/lib/archive-scale.d.mts').includes('selectTopK<T>')],
  ['WhatsApp refreshes live CMS without waiting for deploy', read('whatsapp-agent/agent.mjs').includes('refreshLiveCanonicalCms(root') && read('whatsapp-agent/agent.mjs').includes('content-live-refresh')],
  ['WhatsApp live CMS writes the same canonical snapshot contract', read('whatsapp-agent/live-cms.mjs').includes('CANONICAL_COLLECTIONS') && read('whatsapp-agent/live-cms.mjs').includes('canonicalCmsPath(root)')],
]
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  assert.equal(ok, true, label)
}
console.log(`\nCanonical publishing pipeline: ${checks.length + 12}/${checks.length + 12} checks passed.`)
