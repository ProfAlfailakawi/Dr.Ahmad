import assert from 'node:assert/strict'
import {
  extractServerVideoSequence,
  extractYouTubePlayerResponse,
  findEncyclopediaTranscriptMoment,
  loadEncyclopediaVideoMoment,
  parseYouTubeCaptionJson,
  getEncyclopediaTranscriptProgress,
  getEncyclopediaVideoTopicIndex,
  resetEncyclopediaTranscriptCache,
  resetEncyclopediaVideoCache,
  searchEncyclopediaVideoMoments,
  scheduleEncyclopediaTranscriptWarmup,
} from '../src/server/encyclopedia-videos.mjs'

const checks = []
const check = (label, fn) => {
  try { fn(); checks.push({ label, ok: true }); console.log(`✓ ${label}`) }
  catch (error) { checks.push({ label, ok: false }); console.error(`✗ ${label}`); throw error }
}

const videoRenderer = (id, title) => ({
  videoRenderer: {
    videoId: id,
    title: { runs: [{ text: title }] },
    navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: `/watch?v=${id}` } } },
    thumbnail: { thumbnails: [{ url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }] },
    lengthText: { simpleText: '4:20' },
    descriptionSnippet: { runs: [{ text: 'شرح من موسوعة تكنولوجيا التعليم' }] },
  },
})

const initialData = {
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [{ tabRenderer: { content: { richGridRenderer: { contents: [
        { richItemRenderer: { content: videoRenderer('flip1234567', 'الباب الثالث الفصل الأول الفيديو 2') } },
        { richItemRenderer: { content: videoRenderer('cloud123456', 'الباب الثالث الفصل الأول الفيديو 1') } },
      ] } } } }],
    },
  },
}

const channelHtml = `<!doctype html><script>var ytInitialData = ${JSON.stringify(initialData)};</script><script>var ytcfg={"INNERTUBE_API_KEY":"key","INNERTUBE_CLIENT_VERSION":"1.0","externalId":"UCtest123"}</script>`
const player = (id, captions = true) => ({
  videoDetails: { videoId: id, title: id === 'flip1234567' ? 'الفصول المقلوبة' : 'الحوسبة السحابية', shortDescription: 'شرح تفصيلي' },
  ...(captions ? { captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'ar', name: { simpleText: 'العربية' }, baseUrl: `https://captions.test/${id}` }] } } } : {}),
})
const playerHtml = (id, captions = true) => `<!doctype html><script>var ytInitialPlayerResponse = ${JSON.stringify(player(id, captions))};</script>`
const captionPayload = {
  events: [
    { tStartMs: 0, dDurationMs: 7000, segs: [{ utf8: 'مقدمة عن نماذج التعليم الإلكتروني' }] },
    { tStartMs: 63000, dDurationMs: 9000, segs: [{ utf8: 'الفصول المقلوبة أو المعكوسة تستخدم الفيديو قبل وقت الحصة' }] },
    { tStartMs: 72000, dDurationMs: 8000, segs: [{ utf8: 'ويخصص وقت الصف للتفاعل والتطبيق' }] },
  ],
}

const fetchMock = async (url) => {
  const href = String(url)
  if (href.includes('@') && href.endsWith('/videos')) return new Response(channelHtml, { status: 200 })
  if (href.includes('watch?v=flip1234567')) return new Response(playerHtml('flip1234567'), { status: 200 })
  if (href.includes('watch?v=cloud123456')) return new Response(playerHtml('cloud123456', false), { status: 200 })
  if (href.startsWith('https://captions.test/flip1234567')) return new Response(JSON.stringify(captionPayload), { status: 200, headers: { 'content-type': 'application/json' } })
  throw new Error(`Unexpected fetch: ${href}`)
}

check('يقرأ تسلسل الباب والفصل والمقطع من العنوان العربي', () => {
  assert.deepEqual(extractServerVideoSequence('الباب الثالث - الفصل الأول - الفيديو ٢'), { doorNumber: 3, chapterNumber: 1, videoNumber: 2 })
})

check('فهرس الفيديو الخادمي يعتمد أبواب PDF الخمسة لا عروض PowerPoint الأربعة', () => {
  const topics = getEncyclopediaVideoTopicIndex()
  assert.deepEqual([...new Set(topics.map((topic) => topic.doorNumber))].sort((a, b) => a - b), [1, 2, 3, 4, 5])
  assert.ok(topics.some((topic) => topic.doorNumber === 5 && topic.chapterNumbers.includes(7) && /نظم إدارة التعلم/u.test(topic.title)))
  assert.ok(topics.filter((topic) => topic.source.startsWith('pdf')).length >= 32)
})

check('يستخرج استجابة المشغل من صفحة YouTube من دون تنفيذ النص', () => {
  assert.equal(extractYouTubePlayerResponse(playerHtml('flip1234567'))?.videoDetails?.videoId, 'flip1234567')
})

const segments = parseYouTubeCaptionJson(captionPayload)
check('يفك ترجمة YouTube إلى مقاطع زمنية عربية', () => {
  assert.equal(segments.length, 2)
  assert.equal(segments[1].start, 63)
  assert.match(segments[1].text, /وقت الصف للتفاعل/u)
})

check('يجد الموضع المنطوق ويبدأ قبله بهامش صادق', () => {
  const moment = findEncyclopediaTranscriptMoment(segments, 'الفصول المقلوبة', ['الفصول المعكوسة'])
  assert.ok(moment)
  assert.equal(moment.source, 'captions')
  assert.equal(moment.startSeconds, 60)
  assert.match(moment.excerpt, /الفصول المقلوبة/u)
})

resetEncyclopediaVideoCache()
resetEncyclopediaTranscriptCache()
const exact = await loadEncyclopediaVideoMoment({ topic: 'الفصول المقلوبة', doorNumber: 3, fetchImpl: fetchMock })
check('يربط الموضوع بالفيديو الصحيح واللحظة الدقيقة من الكلام المنطوق', () => {
  assert.equal(exact?.videoId, 'flip1234567')
  assert.equal(exact?.source, 'captions')
  assert.equal(exact?.startSeconds, 60)
  assert.match(exact?.embedUrl || '', /start=60/u)
})

const search = await searchEncyclopediaVideoMoments({ query: 'الفصول المقلوبة', doorNumber: 3, limit: 3, fetchImpl: fetchMock })
check('يبحث داخل الكلام المنطوق ويعيد توقيتاً قابلاً للتشغيل', () => {
  assert.equal(search.moments[0]?.videoId, 'flip1234567')
  assert.equal(search.moments[0]?.startSeconds, 60)
})

resetEncyclopediaVideoCache()
resetEncyclopediaTranscriptCache()
const fallback = await loadEncyclopediaVideoMoment({ topic: 'الحوسبة السحابية', doorNumber: 3, videoId: 'cloud123456', fetchImpl: fetchMock })
check('لا يدّعي دقيقة دقيقة عندما لا تتوافر ترجمة', () => {
  assert.equal(fallback?.videoId, 'cloud123456')
  assert.equal(fallback?.source, 'sequence')
  assert.equal(fallback?.startSeconds, 0)
})


resetEncyclopediaTranscriptCache()
let warmupWatchRequests = 0
const warmupVideos = [
  { id: 'warmup12345', title: 'الباب الأول الفصل الأول الفيديو 1', url: '', embedUrl: '', thumbnail: '', durationText: '', durationSeconds: 0, publishedText: '', viewCountText: '', description: '', position: 1 },
  { id: 'warmup67890', title: 'الباب الأول الفصل الأول الفيديو 2', url: '', embedUrl: '', thumbnail: '', durationText: '', durationSeconds: 0, publishedText: '', viewCountText: '', description: '', position: 2 },
]
const warmupFetch = async (url) => {
  const href = String(url)
  if (href.includes('watch?v=')) { warmupWatchRequests += 1; return new Response(playerHtml(href.includes('warmup12345') ? 'warmup12345' : 'warmup67890', false), { status: 200 }) }
  throw new Error(`Unexpected warmup fetch: ${href}`)
}
await scheduleEncyclopediaTranscriptWarmup(warmupVideos, { fetchImpl: warmupFetch, batchSize: 1 })
check('يفهرس الكلام المنطوق على دفعات صغيرة ولا يطلق القناة كلها دفعة واحدة', () => {
  assert.equal(warmupWatchRequests, 1)
  assert.deepEqual(getEncyclopediaTranscriptProgress(warmupVideos), { running: false, total: 2, completed: 1, available: 0 })
})
await scheduleEncyclopediaTranscriptWarmup(warmupVideos, { fetchImpl: warmupFetch, batchSize: 1 })
check('يكمل الدفعة التالية من حيث توقف من دون إعادة طلب الفيديو المفهرس', () => {
  assert.equal(warmupWatchRequests, 2)
  assert.deepEqual(getEncyclopediaTranscriptProgress(warmupVideos), { running: false, total: 2, completed: 2, available: 0 })
})

console.log(`\nالنتيجة: ${checks.filter((item) => item.ok).length} تحققاً ناجحاً، 0 إخفاق.`)
