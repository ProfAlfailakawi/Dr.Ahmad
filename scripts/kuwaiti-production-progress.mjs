#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getKuwaitiProductionProgress } from './lib/kuwaiti-production-progress.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const value = (name) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || ''
const gitRef = value('--git-ref')

function read(path) {
  if (gitRef) return execFileSync('git', ['show', `${gitRef}:${path}`], { cwd: ROOT, encoding: 'utf8' })
  return readFileSync(resolve(ROOT, path), 'utf8')
}

function buildProgress() {
  const v3 = JSON.parse(read('src/data/kuwaiti-diwania-v3.json'))
  const audioMeta = JSON.parse(read('src/data/audio-meta.json'))
  const site = new Set(Object.keys(JSON.parse(read('src/data/bodies.json'))))
  const qualityHolds = JSON.parse(read('scripts/data/kuwaiti-production-quality-holds-v1.json'))
  const slugs = Object.keys(v3.episodes || {}).filter((slug) => site.has(slug))
  assert.equal(slugs.length, 143, `عقد الإنتاج يقول 143 مقالا؛ الموجود ${slugs.length}`)
  return getKuwaitiProductionProgress({ slugs, audioMeta, qualityHolds })
}

if (argv.includes('--self-test')) {
  const progress = getKuwaitiProductionProgress({
    slugs: ['held', 'next', 'done'],
    audioMeta: { 'done.dialogue-kw.mp3': { validationStatus: 'verified-r2' } },
    qualityHolds: {
      schemaVersion: 1,
      episodes: [{
        slug: 'held', status: 'quality-hold', failedRunId: 1, failedRunAttempt: 3,
        failedRounds: 3, failedTakes: 18, reason: 'test', deferredAt: '2026-01-01T00:00:00.000Z',
      }],
    },
  })
  assert.equal(progress.nextSlug, 'next')
  assert.equal(progress.heldMissing, 1)
  assert.equal(progress.complete, false)
  console.log('✓ تأجيل حلقة لا يحبس التالية ولا يحسب الإنتاج مكتملا')
  process.exit(0)
}

const progress = buildProgress()
if (argv.includes('--next')) {
  process.stdout.write(progress.nextSlug)
} else {
  console.log(JSON.stringify(progress, null, 2))
}
