#!/usr/bin/env node
/** تعبئةٌ واحدة لموجات الحلقات المنشورة. قراءة عامة فقط؛ لا كتابة إلى R2. */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractAudioPeaks } from './lib/audio-peaks.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const META = resolve(ROOT, 'src/data/audio-meta.json')
const OUT = resolve(ROOT, 'src/data/audio-peaks.json')
const BASE = String(process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || 'https://pub-e2ce7a54469544ecab38d55cd80787aa.r2.dev').replace(/\/+$/, '')
const all = JSON.parse(readFileSync(META, 'utf8'))
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { version: 1, peaks: {} }
const names = Object.keys(all).filter((name) => name.endsWith('.dialogue.mp3') && all[name]?.validationStatus === 'verified-r2' && !existing.peaks?.[name])
const queue = [...names]
const peaks = { ...(existing.peaks || {}) }
let completed = 0

const save = () => {
  const temporary = `${OUT}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify({ version: 1, samples: 180, peaks })}\n`, 'utf8')
  renameSync(temporary, OUT)
}
const worker = async () => {
  for (;;) {
    const name = queue.shift()
    if (!name) return
    try {
      const values = await extractAudioPeaks(`${BASE}/${encodeURIComponent(name)}`)
      if (values.length) peaks[name] = values
      completed += 1
      if (completed % 12 === 0) { save(); console.log(`موجات الصوت: ${completed}/${names.length}`) }
    } catch (error) { console.warn(`تخطّي ${name}: ${error.message}`) }
  }
}
await Promise.all(Array.from({ length: Math.min(6, Math.max(1, names.length)) }, worker))
save()
console.log(`✔ audio-peaks.json: ${Object.keys(peaks).length} حلقة`)
