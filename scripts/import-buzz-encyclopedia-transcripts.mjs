#!/usr/bin/env node
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { importBuzzDirectory, buildTranscriptReport, formatTranscriptReport } from './lib/encyclopedia-buzz-transcripts.mjs'

const root = resolve(import.meta.dirname, '..')
const force = process.argv.includes('--force')
const result = await importBuzzDirectory({
  inputDir: resolve(root, 'local-data/encyclopedia-buzz-transcripts'),
  outputFile: resolve(root, 'src/data/encyclopedia-video-transcripts.json'),
  catalogFile: resolve(root, 'src/data/encyclopedia-videos-fallback.json'),
  structureFile: resolve(root, 'src/data/encyclopedia-structure.json'),
  force,
})
const polish = spawnSync(process.execPath, ['scripts/polish-encyclopedia-transcripts.mjs'], { cwd: root, stdio: 'inherit' })
if (polish.status !== 0) {
  console.error('فشل Gold Pass بعد الاستيراد؛ بقي التفريغ الخام محفوظاً ولم يُحذف.')
  process.exitCode = 1
} else {
  const polishedIndex = JSON.parse(readFileSync(resolve(root, 'src/data/encyclopedia-video-transcripts.json'), 'utf8'))
  console.log(formatTranscriptReport(buildTranscriptReport({ index: polishedIndex, importReport: result.report })))
}
if (result.report.failed.length) process.exitCode = 1
