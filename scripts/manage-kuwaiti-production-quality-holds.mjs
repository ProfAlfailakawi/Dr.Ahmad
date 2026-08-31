#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deferKuwaitiQualityHold,
  releaseKuwaitiQualityHold,
  validateKuwaitiQualityHolds,
} from './lib/kuwaiti-production-progress.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'scripts/data/kuwaiti-production-quality-holds-v1.json')
const argv = process.argv.slice(2)
const action = argv[0] || 'status'
const value = (name) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || ''
const read = () => JSON.parse(readFileSync(FILE, 'utf8'))
const write = (document) => writeFileSync(FILE, `${JSON.stringify(document, null, 2)}\n`)

if (action === '--self-test') {
  const base = { schemaVersion: 1, policy: {}, episodes: [] }
  const held = deferKuwaitiQualityHold(base, {
    slug: 'episode', failedRunId: 9, failedRunAttempt: 3, failedRounds: 3,
    failedTakes: 18, reason: 'test', deferredAt: '2026-01-01T00:00:00.000Z',
  })
  validateKuwaitiQualityHolds(held, ['episode'])
  assert.equal(held.episodes.length, 1)
  assert.equal(releaseKuwaitiQualityHold(held, 'episode').episodes.length, 0)
  console.log('✓ سجل التأجيل يضيف الحلقة ويحررها من دون المساس بمعيار الجودة')
  process.exit(0)
}

if (action === 'status') {
  const document = read()
  validateKuwaitiQualityHolds(document)
  console.log(JSON.stringify(document, null, 2))
  process.exit(0)
}

const slug = value('--slug')
assert.ok(slug, '--slug مطلوب')
if (action === 'defer') {
  const next = deferKuwaitiQualityHold(read(), {
    slug,
    failedRunId: Number(value('--run-id')),
    failedRunAttempt: Number(value('--run-attempt')),
    failedRounds: Number(value('--failed-rounds') || 3),
    failedTakes: Number(value('--failed-takes')),
    reason: value('--reason'),
    deferredAt: value('--deferred-at') || new Date().toISOString(),
  })
  validateKuwaitiQualityHolds(next)
  write(next)
  console.log(`✓ أجلت ${slug} بعد استنفاد الجودة؛ لا نشر ولا ترقيع`)
} else if (action === 'release') {
  const next = releaseKuwaitiQualityHold(read(), slug)
  validateKuwaitiQualityHolds(next)
  write(next)
  console.log(`✓ حررت ${slug} من التأجيل بعد نجاح النسخة الموثقة`)
} else {
  throw new Error(`إجراء غير معروف: ${action}`)
}
