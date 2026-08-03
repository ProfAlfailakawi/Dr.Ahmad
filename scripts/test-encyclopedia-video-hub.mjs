#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  extractYouTubeBootstrap,
  fetchEncyclopediaVideoCatalog,
  loadEncyclopediaVideoCatalog,
  parseYouTubeContinuations,
  parseYouTubeVideos,
  resetEncyclopediaVideoCache,
} from '../src/server/encyclopedia-videos.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (file) => readFileSync(resolve(root, file), 'utf8')

const renderer = (videoId, title, duration = '4:12') => ({
  videoRenderer: {
    videoId,
    title: { runs: [{ text: title }] },
    navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: `/watch?v=${videoId}` } } },
    thumbnail: { thumbnails: [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }] },
    lengthText: { simpleText: duration },
    publishedTimeText: { simpleText: 'قبل سنة' },
    shortViewCountText: { simpleText: '١٬٢٠٠ مشاهدة' },
    descriptionSnippet: { runs: [{ text: 'شرح من موسوعة تكنولوجيا التعليم' }] },
  },
})

const initialData = {
  contents: [
    renderer('videoAAA01', 'الباب الأول - الفصل الثاني - فيديو ٣'),
    { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'NEXT_PAGE' } } } },
  ],
}
const context = { client: { clientName: 'WEB', clientVersion: '2.20260803.00.00', visitorData: 'visitor-fixture' } }
const html = `<!doctype html><script>var ytInitialData = ${JSON.stringify(initialData)};</script><script>ytcfg.set(${JSON.stringify({ INNERTUBE_API_KEY: 'fixture-key', INNERTUBE_CONTEXT: context })});</script><script>window.meta={"INNERTUBE_API_KEY":"fixture-key","INNERTUBE_CONTEXT":${JSON.stringify(context)},"externalId":"UCfixture123456"};</script>`
const continuationPayload = {
  onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [
    renderer('videoBBB02', 'الباب الثاني - الفصل الأول - فيديو ١', '12:05'),
    renderer('videoAAA01', 'الباب الأول - الفصل الثاني - فيديو ٣'),
  ] } }],
}

const bootstrap = extractYouTubeBootstrap(html)
assert.equal(bootstrap.apiKey, 'fixture-key')
assert.equal(bootstrap.clientVersion, '2.20260803.00.00')
assert.equal(bootstrap.initialData.contents.length, 2)
assert.deepEqual(parseYouTubeContinuations(initialData), ['NEXT_PAGE'])
assert.equal(parseYouTubeVideos(initialData)[0].durationSeconds, 252)

let calls = 0
const fetchImpl = async (_url, options = {}) => {
  calls += 1
  if (calls === 1) return { ok: true, status: 200, text: async () => html }
  assert.equal(options.method, 'POST')
  assert.match(String(options.body), /NEXT_PAGE/)
  return { ok: true, status: 200, json: async () => continuationPayload }
}
const catalog = await fetchEncyclopediaVideoCatalog({ fetchImpl })
assert.equal(catalog.count, 2)
assert.deepEqual(catalog.videos.map((video) => video.id), ['videoAAA01', 'videoBBB02'])
assert.equal(catalog.videos[1].durationSeconds, 725)
assert.equal(calls, 2)

resetEncyclopediaVideoCache()
let cacheCalls = 0
const cacheFetch = async (url, options) => {
  cacheCalls += 1
  if (cacheCalls === 1) return { ok: true, status: 200, text: async () => html }
  return { ok: true, status: 200, json: async () => continuationPayload }
}
await loadEncyclopediaVideoCatalog({ fetchImpl: cacheFetch })
await loadEncyclopediaVideoCatalog({ fetchImpl: cacheFetch })
assert.equal(cacheCalls, 2, 'the second catalog read must use the six-hour memory cache')

const portal = read('src/components/EncyclopediaPortal.tsx')
const indexer = read('src/lib/encyclopedia-video-index.ts')
const client = read('src/lib/encyclopedia-videos.ts')
const server = read('server.mjs')
assert.match(portal, /getEncyclopediaVideoCatalog/)
assert.match(portal, /indexEncyclopediaVideos/)
assert.match(portal, /searchResults\.videos/)
assert.match(portal, /اقرأ الموضوع في الكتاب/)
assert.match(portal, /teachingMaterial\.door\.presentation/)
assert.match(portal, /مواد التدريس/)
assert.match(portal, /خيط المادة/)
assert.match(portal, /onOpenTeaching/)
assert.match(portal, /getEncyclopediaTeachingTopic/)
assert.match(portal, /searchResults\.slides/)
assert.match(portal, /موضع الموضوع في العرض/)
assert.match(portal, /aria-label="ابحث في الموسوعة"/)
assert.doesNotMatch(portal, />\s*ابحث\s*<\/a>/, 'the encyclopedia search entrance must remain an icon without visible copy')
assert.match(portal, /aria-modal="true"/)
assert.doesNotMatch(portal, /bg-ink\/45|text-soft\/55/, 'visual opacity tokens must use arbitrary Tailwind values')
assert.match(portal, /يحمل مشغلاً واحداً|يحمّل مشغلاً واحداً/)
assert.doesNotMatch(portal, /<details[^>]*defaultOpen=/, 'native details does not support React defaultOpen')
assert.match(portal, /detailsRef\.current\.open = true/, 'the first door must still open only on initial mount')
assert.doesNotMatch(portal, /FEATURED_VIDEO_EMBED|channelSearch\(/)
assert.match(indexer, /extractEncyclopediaSequence/)
assert.match(indexer, /doorNumber/)
assert.match(indexer, /chapterNumber/)
assert.match(indexer, /resolveConcept/)
assert.match(client, /\/api\/encyclopedia\/videos/)
assert.match(server, /encyclopediaVideosPath/)
assert.match(server, /loadEncyclopediaVideoCatalog/)

console.log('✓ فهرس القناة يقرأ الصفحات المتتابعة ويزيل التكرار')
console.log('✓ المقاطع ترتبط بالباب والفصل والمفهوم والعرض والبحث الداخلي')
console.log('✓ الواجهة تستخدم مشغلاً واحداً فقط ولا تعتمد فيديو ثابتاً أو بحث القناة الخارجي')
