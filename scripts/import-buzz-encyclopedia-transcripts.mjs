#!/usr/bin/env node
import { resolve } from 'node:path'
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
console.log(formatTranscriptReport(buildTranscriptReport({ index: result.index, importReport: result.report })))
if (result.report.failed.length) process.exitCode = 1
