import assert from 'node:assert/strict'
import {
  extractServerVideoSequence,
  extractYouTubePlayerResponse,
  findEncyclopediaTranscriptMoment,
  parseYouTubeCaptionJson,
  getEncyclopediaTranscriptProgress,
  getEncyclopediaVideoTopicIndex,
  loadEncyclopediaVideoMoment,
  searchEncyclopediaVideoMoments,
  scheduleEncyclopediaTranscriptWarmup,
} from '../src/server/encyclopedia-videos.mjs'

let checks = 0
const check = (label, fn) => { fn(); checks += 1; console.log(`✓ ${label}`) }

check('يقرأ تسلسل الباب والفصل والمقطع من العنوان العربي', () => {
  assert.deepEqual(extractServerVideoSequence('الباب الثالث - الفصل الأول - الفيديو ٢'), { doorNumber: 3, chapterNumber: 1, videoNumber: 2 })
})

check('فهرس الفيديو الخادمي يعتمد أبواب PDF الخمسة لا عروض PowerPoint الأربعة', () => {
  const topics = getEncyclopediaVideoTopicIndex()
  assert.deepEqual([...new Set(topics.map((topic) => topic.doorNumber))].sort((a, b) => a - b), [1, 2, 3, 4, 5])
  assert.ok(topics.some((topic) => topic.doorNumber === 5 && topic.chapterNumbers.includes(7) && /نظم إدارة التعلم/u.test(topic.title)))
  assert.ok(topics.filter((topic) => topic.source.startsWith('pdf')).length >= 32)
})

const player = { videoDetails: { videoId: 'fixture12345', title: 'الفصول المقلوبة' } }
const playerHtml = `<!doctype html><script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`
check('يستخرج استجابة المشغل من صفحة مؤرشفة من دون تنفيذ النص', () => {
  assert.equal(extractYouTubePlayerResponse(playerHtml)?.videoDetails?.videoId, 'fixture12345')
})

const segments = parseYouTubeCaptionJson({ events: [
  { tStartMs: 0, dDurationMs: 7000, segs: [{ utf8: 'مقدمة عن نماذج التعليم الإلكتروني' }] },
  { tStartMs: 63000, dDurationMs: 9000, segs: [{ utf8: 'الفصول المقلوبة أو المعكوسة تستخدم الفيديو قبل وقت الحصة' }] },
  { tStartMs: 72000, dDurationMs: 8000, segs: [{ utf8: 'ويخصص وقت الصف للتفاعل والتطبيق' }] },
] })
check('قارئ التوافق يفك المقاطع الزمنية من JSON مؤرشف بلا طلب شبكة', () => {
  assert.equal(segments.length, 3)
  assert.equal(segments[1].start, 63)
})

check('يجد الموضع المنطوق من المقطع الفعلي ولا يخمّن الثانية', () => {
  const moment = findEncyclopediaTranscriptMoment(segments, 'الفصول المقلوبة', ['الفصول المعكوسة'])
  assert.ok(moment)
  assert.equal(moment.startSeconds, 63)
  assert.match(moment.excerpt, /الفصول المقلوبة/u)
})

const fallback = await loadEncyclopediaVideoMoment({ topic: 'التعليم المبرمج', doorNumber: 2 })
check('عند غياب تفريغ فعلي يعيد فيديو قريباً من البداية بلا توقيت وهمي', () => {
  assert.ok(fallback?.videoId)
  assert.equal(fallback?.source, 'sequence')
  assert.equal(fallback?.hasExactTiming, false)
  assert.equal(fallback?.startSeconds, 0)
  assert.doesNotMatch(fallback?.embedUrl || '', /[?&]start=/u)
})

const search = await searchEncyclopediaVideoMoments({ query: 'التعليم المبرمج', limit: 3 })
check('البحث العام لا ينسب لحظة دقيقة إلى metadata فقط', () => {
  assert.ok(search.moments.length > 0)
  assert.ok(search.moments.every((moment) => !moment.hasExactTiming && moment.startSeconds === 0 && moment.excerpt === ''))
  assert.equal(search.progress.total, 169)
  assert.equal(search.progress.available, 0)
})

let networkCalls = 0
const warmupVideos = [
  { id: 'warmup12345', title: 'الباب الأول الفصل الأول الفيديو 1' },
  { id: 'warmup67890', title: 'الباب الأول الفصل الأول الفيديو 2' },
]
await scheduleEncyclopediaTranscriptWarmup(warmupVideos, { fetchImpl: async () => { networkCalls += 1 } })
check('الـ warm-up ثابت ولا يطلب YouTube أو أي خدمة تفريغ', () => {
  assert.equal(networkCalls, 0)
  assert.deepEqual(getEncyclopediaTranscriptProgress(warmupVideos), {
    running: false,
    total: 2,
    catalogued: 2,
    completed: 0,
    available: 0,
    transcribed: 0,
    needsReview: 2,
    missing: 2,
    sources: { buzz: 0, 'youtube-captions': 0, 'manual-reviewed': 0 },
  })
})

console.log(`\nالنتيجة: ${checks} تحققاً ناجحاً، 0 إخفاق.`)
