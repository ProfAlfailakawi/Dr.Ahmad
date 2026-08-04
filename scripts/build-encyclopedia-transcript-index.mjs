import assert from 'node:assert/strict'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fallbackCatalog from '../src/data/encyclopedia-videos-fallback.json' with { type: 'json' }
import {
  getEncyclopediaTranscriptSnapshot,
  loadEncyclopediaVideoTranscript,
  parseYouTubeCaptionJson,
  resetEncyclopediaTranscriptCache,
} from '../src/server/encyclopedia-videos.mjs'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const OUTPUT = resolve(ROOT, 'src/data/encyclopedia-video-transcripts.json')
const args = new Set(process.argv.slice(2))
const force = args.has('--force')
const selfTest = args.has('--self-test')
const concurrency = Math.max(1, Math.min(4, Number(process.env.ENCYCLOPEDIA_TRANSCRIPT_CONCURRENCY) || 2))
const transcribeEndpoint = String(process.env.ENCYCLOPEDIA_TRANSCRIBE_ENDPOINT || '').trim()
const transcribeToken = String(process.env.ENCYCLOPEDIA_TRANSCRIBE_TOKEN || '').trim()

function loadExisting() {
  try {
    const value = JSON.parse(readFileSync(OUTPUT, 'utf8'))
    return value && typeof value === 'object' ? value : { videos: {} }
  } catch {
    return { videos: {} }
  }
}

function normalizeExternalSegments(payload) {
  if (Array.isArray(payload?.events)) return parseYouTubeCaptionJson(payload)
  return (Array.isArray(payload?.segments) ? payload.segments : [])
    .map((segment) => ({
      start: Math.max(0, Math.floor(Number(segment?.start ?? segment?.startSeconds) || 0)),
      end: Math.max(1, Math.ceil(Number(segment?.end ?? segment?.endSeconds) || Number(segment?.start ?? segment?.startSeconds) + 1 || 1)),
      text: String(segment?.text || '').replace(/\s+/g, ' ').trim().slice(0, 1_000),
    }))
    .filter((segment) => segment.text && segment.end > segment.start)
}

async function transcribeMissing(video) {
  if (!transcribeEndpoint) return null
  const response = await fetch(transcribeEndpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(transcribeToken ? { authorization: `Bearer ${transcribeToken}` } : {}),
    },
    body: JSON.stringify({
      videoId: video.id,
      url: video.url,
      title: video.title,
      language: 'ar',
      format: 'segments',
    }),
  })
  if (!response.ok) throw new Error(`transcription endpoint HTTP ${response.status}`)
  const payload = await response.json()
  const segments = normalizeExternalSegments(payload)
  if (!segments.length) return null
  return {
    videoId: video.id,
    available: true,
    checked: true,
    status: 'transcribed',
    language: String(payload.language || 'ar').slice(0, 40),
    source: 'transcribed',
    title: String(payload.title || video.title).slice(0, 500),
    description: String(payload.description || video.description || '').slice(0, 2_000),
    segments,
    text: segments.map((segment) => segment.text).join(' ').slice(0, 120_000),
    indexedAt: new Date().toISOString(),
  }
}

function atomicWrite(payload) {
  const temp = `${OUTPUT}.tmp`
  writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`)
  renameSync(temp, OUTPUT)
}

function mergedSnapshot(videos, records) {
  const snapshot = getEncyclopediaTranscriptSnapshot(videos)
  snapshot.videos = Object.fromEntries(videos.map((video) => {
    const record = records[video.id] || snapshot.videos[video.id]
    return [video.id, {
      ...record,
      videoId: video.id,
      title: record?.title || video.title,
      description: record?.description || video.description || '',
    }]
  }))
  const values = Object.values(snapshot.videos)
  snapshot.progress = {
    running: false,
    total: videos.length,
    completed: values.filter((record) => record?.checked).length,
    available: values.filter((record) => record?.available).length,
    catalogued: videos.length,
  }
  return snapshot
}

async function runSelfTest() {
  const segments = normalizeExternalSegments({ segments: [{ start: 3.4, end: 8.2, text: ' التعليم المبرمج ' }] })
  assert.deepEqual(segments, [{ start: 3, end: 9, text: 'التعليم المبرمج' }])
  const snapshot = mergedSnapshot(fallbackCatalog.videos.slice(0, 2), {})
  assert.equal(snapshot.catalogCount, 2)
  assert.equal(Object.keys(snapshot.videos).length, 2)
  console.log('✓ منشئ الفهرس المنطوق يحفظ سجلات قابلة للاستئناف ويقبل تفريغاً زمنياً خارجياً')
}

async function main() {
  if (selfTest) return runSelfTest()
  const videos = Array.isArray(fallbackCatalog.videos) ? fallbackCatalog.videos : []
  if (videos.length < 160) throw new Error(`الفهرس لا يغطي القناة كاملة: ${videos.length} فيديو فقط`)

  const existing = loadExisting()
  const records = { ...(existing.videos || {}) }
  let completed = 0
  let exact = 0
  let failed = 0

  for (let index = 0; index < videos.length; index += concurrency) {
    const batch = videos.slice(index, index + concurrency)
    const updates = await Promise.all(batch.map(async (video) => {
      const previous = records[video.id]
      if (!force && previous?.checked) return { video, record: previous, skipped: true }
      try {
        let record = await loadEncyclopediaVideoTranscript(video)
        if (!record.available && record.checked && transcribeEndpoint) {
          record = await transcribeMissing(video) || record
        }
        return { video, record, skipped: false }
      } catch (error) {
        return { video, record: previous || null, skipped: false, error }
      }
    }))

    for (const update of updates) {
      if (update.record) records[update.video.id] = update.record
      if (update.record?.checked) completed += 1
      if (update.record?.available) exact += 1
      if (update.error || (!update.record?.checked && !update.skipped)) failed += 1
    }

    atomicWrite(mergedSnapshot(videos, records))
    console.log(`الفهرسة المنطوقة: ${Math.min(index + batch.length, videos.length)}/${videos.length} · دقيق ${exact} · مفحوص ${completed} · مؤجل ${failed}`)
  }

  const finalSnapshot = mergedSnapshot(videos, records)
  atomicWrite(finalSnapshot)
  console.log(`✓ اكتملت فهرسة ${finalSnapshot.catalogCount} فيديو. توقيت منطوق متاح لـ${finalSnapshot.progress.available} فيديو.`)
  if (!transcribeEndpoint && finalSnapshot.progress.available < finalSnapshot.catalogCount) {
    console.log('ملاحظة: المقاطع التي لا تملك Captions بقيت بلا توقيت مزعوم. يمكن تمرير ENCYCLOPEDIA_TRANSCRIBE_ENDPOINT لتفريغها صوتياً مرة واحدة.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
