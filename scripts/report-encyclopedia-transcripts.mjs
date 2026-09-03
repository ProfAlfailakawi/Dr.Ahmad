#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildTranscriptReport, formatTranscriptReport, inspectBuzzDirectory } from './lib/encyclopedia-buzz-transcripts.mjs'
const root = resolve(import.meta.dirname, '..')
const index = JSON.parse(readFileSync(resolve(root, 'src/data/encyclopedia-video-transcripts.json'), 'utf8'))
const importReport = inspectBuzzDirectory({
  inputDir: resolve(root, 'local-data/encyclopedia-buzz-transcripts'),
  catalogFile: resolve(root, 'src/data/encyclopedia-videos-fallback.json'),
})
console.log(formatTranscriptReport(buildTranscriptReport({ index, importReport })))
