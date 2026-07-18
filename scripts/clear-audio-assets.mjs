#!/usr/bin/env node
import { existsSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || ''
const slug = arg('slug').trim()
const mode = arg('mode').trim()
if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('slug غير صالح')
if (!['reading', 'dialogue'].includes(mode)) throw new Error('mode يجب أن يكون reading أو dialogue')

const ROOT = process.cwd()
const atomicJson = (path, value) => {
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporary, path)
}
const loadJson = (path, fallback) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
const removeFile = (path) => { if (existsSync(path)) unlinkSync(path) }

const manifestPath = resolve(ROOT, 'src/data/audio.json')
const metaPath = resolve(ROOT, 'src/data/audio-meta.json')
const manifest = loadJson(manifestPath, {})
const meta = loadJson(metaPath, {})
const names = mode === 'reading'
  ? [`${slug}.mp3`, `${slug}.noura.mp3`]
  : [`${slug}.dialogue.mp3`, `${slug}.dialogue.json`]

if (mode === 'reading') {
  const entry = manifest[slug]
  if (entry && typeof entry === 'object') {
    delete entry.fahed
    delete entry.noura
    if (!Object.keys(entry).length) delete manifest[slug]
  } else {
    delete manifest[slug]
  }
} else if (manifest[slug] && typeof manifest[slug] === 'object') {
  delete manifest[slug].dialogue
  if (!Object.keys(manifest[slug]).length) delete manifest[slug]
}
for (const name of names) delete meta[name]
atomicJson(manifestPath, Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))))
atomicJson(metaPath, Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))))

for (const name of names) {
  removeFile(resolve(ROOT, 'audio', name))
  removeFile(resolve(ROOT, 'public/audio', name))
}
if (mode === 'reading') {
  removeFile(resolve(ROOT, 'audio-audits', `${slug}.fahed.json`))
  removeFile(resolve(ROOT, 'audio-audits', `${slug}.noura.json`))
  rmSync(resolve(ROOT, '.audio-last-known-good', slug), { recursive: true, force: true })
} else {
  const statePath = resolve(ROOT, '.podcast-state.json')
  if (existsSync(statePath)) {
    const state = loadJson(statePath, { done: {} })
    if (state.done && typeof state.done === 'object') {
      delete state.done[`${slug}:ar`]
      delete state.done[`${slug}:en`]
    }
    atomicJson(statePath, state)
  }
  const adminPath = resolve(ROOT, 'src/data/podcast-admin.json')
  const admin = loadJson(adminPath, { generatedAt: null, episodes: [], playlists: [] })
  if (Array.isArray(admin.episodes)) admin.episodes = admin.episodes.filter((item) => item?.slug !== slug)
  atomicJson(adminPath, admin)
  removeFile(resolve(ROOT, 'podcast-audits', `${slug}.json`))
}

console.log(`✓ أزيلت آثار ${mode === 'reading' ? 'القراءة العادية' : 'الحوار'} للمقال ${slug} من الفهارس المحلية.`)
