#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  buildQueue,
  cleanupAudio,
  createInitialState,
  downloadAudio,
  ensureTools,
  findTranscriptFile,
  parseArgs,
  readJson,
  transcribeWithBuzz,
  updateState,
} from './lib/encyclopedia-auto-transcribe.mjs'

const root = resolve(import.meta.dirname, '..')
const options = parseArgs(process.argv.slice(2))
const catalogFile = resolve(root, 'src/data/encyclopedia-videos-fallback.json')
const transcriptIndexFile = resolve(root, 'src/data/encyclopedia-video-transcripts.json')
const transcriptDir = resolve(root, 'local-data/encyclopedia-buzz-transcripts')
const audioDir = resolve(root, 'local-data/encyclopedia-audio-temp')
const stateFile = resolve(root, 'local-data/encyclopedia-auto-transcribe-state.json')
const catalog = readJson(catalogFile, { videos: [] })
const index = readJson(transcriptIndexFile, { records: {} })
const queue = buildQueue(catalog, index, options)
const state = readJson(stateFile, createInitialState(queue.length))
state.total = queue.length
mkdirSync(transcriptDir, { recursive: true })
mkdirSync(audioDir, { recursive: true })

console.log(`\nمنظومة تفريغ موسوعة تكنولوجيا التعليم`)
console.log(`إجمالي الفهرس: ${catalog.videos?.length || 0}`)
console.log(`المطلوب في هذه الجولة: ${queue.length}`)
console.log(`النموذج: ${options.modelType}/${options.modelSize} — اللغة: ${options.language}\n`)

if (!queue.length) {
  console.log('لا توجد فيديوهات متبقية ضمن الاختيار الحالي.')
  process.exit(0)
}

const tools = options.dryRun ? { buzz: { command: 'buzz', prefix: [] }, ytDlp: { command: 'yt-dlp', prefix: [] } } : ensureTools(options)
let completed = 0
let failed = 0

for (let indexNumber = 0; indexNumber < queue.length; indexNumber += 1) {
  const video = queue[indexNumber]
  const label = `[${indexNumber + 1}/${queue.length}] ${video.id}`
  console.log(`\n${label} — بدء المعالجة`)
  try {
    let transcriptFile = !options.force ? findTranscriptFile(transcriptDir, video.id) : null
    let audioFile = null
    if (!transcriptFile) {
      if (options.skipDownload) {
        const candidates = ['.m4a', '.mp3', '.wav', '.webm', '.opus', '.mp4']
          .map((extension) => resolve(audioDir, `${video.id}${extension}`))
        audioFile = candidates.find(existsSync)
        if (!audioFile) throw new Error(`لم يوجد ملف صوت محلي باسم ${video.id}`)
      } else {
        audioFile = downloadAudio({ ytDlp: tools.ytDlp, video, audioDir, dryRun: options.dryRun })
      }
      let lastError = null
      for (let attempt = 0; attempt <= options.retries; attempt += 1) {
        try {
          transcriptFile = transcribeWithBuzz({
            buzz: tools.buzz,
            audioFile,
            transcriptDir,
            videoId: video.id,
            modelType: options.modelType,
            modelSize: options.modelSize,
            language: options.language,
            dryRun: options.dryRun,
          })
          lastError = null
          break
        } catch (error) {
          lastError = error
          console.error(`${label} — محاولة ${attempt + 1} فشلت: ${error.message}`)
        }
      }
      if (lastError) throw lastError
    }

    if (!options.dryRun) {
      const importResult = spawnSync(process.execPath, ['scripts/import-buzz-encyclopedia-transcripts.mjs'], { cwd: root, stdio: 'inherit' })
      if (importResult.status !== 0) throw new Error('فشل استيراد التفريغ إلى الفهرس النهائي')
      const freshIndex = JSON.parse(readFileSync(transcriptIndexFile, 'utf8'))
      const record = freshIndex.records?.[video.id]
      if (!record?.available || !Array.isArray(record.segments) || !record.segments.length) {
        throw new Error('لم ينجح التحقق النهائي من المقاطع الزمنية')
      }
      if (!options.keepAudio) cleanupAudio(audioFile)
    }

    completed += 1
    if (!options.dryRun) {
      state.completed[video.id] = { at: new Date().toISOString(), transcriptFile }
      delete state.failed[video.id]
      updateState(stateFile, state)
    }
    console.log(`${label} — اكتمل وتحقق منه بنجاح`)
  } catch (error) {
    failed += 1
    if (!options.dryRun) {
      state.failed[video.id] = { at: new Date().toISOString(), error: String(error?.message || error) }
      updateState(stateFile, state)
    }
    console.error(`${label} — فشل: ${error.message}`)
  }
}

console.log(`\nاكتملت الجولة: ${completed} ناجح، ${failed} فاشل.`)
if (!options.dryRun) {
  spawnSync(process.execPath, ['scripts/report-encyclopedia-transcripts.mjs'], { cwd: root, stdio: 'inherit' })
  spawnSync(process.execPath, ['scripts/test-buzz-transcript-import.mjs'], { cwd: root, stdio: 'inherit' })
}
if (failed) process.exitCode = 1
