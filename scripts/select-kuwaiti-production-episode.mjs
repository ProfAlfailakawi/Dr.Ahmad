#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectKuwaitiProductionSlug } from './lib/kuwaiti-production-progress.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'))
const v3 = readJson('src/data/kuwaiti-diwania-v3.json')
const audioMeta = readJson('src/data/audio-meta.json')
const qualityHolds = readJson('scripts/data/kuwaiti-production-quality-holds-v1.json')
const gold = new Set(readJson('scripts/data/kuwaiti-professional-gold-v13.json').episodes.map((episode) => episode.slug))
const site = new Set(Object.keys(readJson('src/data/bodies.json')))
const all = Object.keys(v3.episodes || {}).filter((slug) => site.has(slug))
assert.equal(all.length, 143, `عقد الإنتاج يقول 143 مقالا؛ الموجود ${all.length}`)

const explicit = String(process.env.REQUESTED_SLUGS || '').split(',').map((item) => item.trim()).filter(Boolean)
assert.ok(explicit.length <= 1, 'اختر slug واحدة فقط؛ ممنوع جمع حلقات في تشغيلة إنتاج واحدة')
const size = Number(process.env.REQUESTED_SIZE || 1)
assert.equal(size, 1, 'batch_size مقفول على 1: كل حلقة لازم تكون تشغيلة مستقلة')
const batch = Number(process.env.REQUESTED_BATCH || 1)
const includeQualityHolds = /^(1|true|yes)$/iu.test(String(process.env.REQUESTED_INCLUDE_QUALITY_HOLDS || ''))
const selectedSlug = selectKuwaitiProductionSlug({
  slugs: all,
  audioMeta,
  qualityHolds,
  explicitSlug: explicit[0] || '',
  includeQualityHolds,
  batch,
})
assert.ok(selectedSlug, 'لا توجد حلقة متاحة الآن؛ راجع قائمة الجودة المؤجلة أو اكتمال الإنتاج')
assert.ok(!gold.has(selectedSlug), `${selectedSlug}: هذه من الخمس الذهبية؛ ولدها من مختبر المرجع الاحترافي ببذرتها المقفولة`)

const turns = Object.values(v3.episodes[selectedSlug] || {})
assert.ok(turns.length >= 15 && turns.filter((turn) => turn.musicBridgeAfter).length === 2,
  `${selectedSlug}: مصدر قصير غير صالح`)
const body = `${JSON.stringify(turns, null, 2)}\n`
const hash = createHash('sha256').update(body).digest('hex')
mkdirSync(resolve(ROOT, 'manual-dialogues-kuwaiti'), { recursive: true })
mkdirSync(resolve(ROOT, 'podcast-audits/source-locks-kuwaiti'), { recursive: true })
writeFileSync(resolve(ROOT, `manual-dialogues-kuwaiti/${selectedSlug}.json`), body)
writeFileSync(resolve(ROOT, `podcast-audits/source-locks-kuwaiti/${selectedSlug}.json`), `${JSON.stringify({
  slug: selectedSlug,
  revisionId: `diwania-v3-${hash.slice(0, 24)}`,
  sourceVariant: 'human-diwania-dna-v3-ear-corrected',
  turnCount: turns.length,
  bridgeCount: 2,
  shortContentSha256: hash,
}, null, 2)}\n`)
writeFileSync(resolve(ROOT, 'kuwaiti-production-slugs.txt'), `${selectedSlug}\n`)
writeFileSync(resolve(ROOT, 'kuwaiti-production-seed-slots.json'), `${JSON.stringify({ [selectedSlug]: 1 }, null, 2)}\n`)

const identity = createHash('sha256').update(selectedSlug).digest('hex').slice(0, 10)
const packageName = `kuwaiti-production-${explicit.length ? 'manual' : `batch-${batch}`}-${identity}`
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `PACKAGE_NAME=${packageName}\n`)
console.log(`✓ حلقة واحدة من 143: ${selectedSlug}${includeQualityHolds ? ' · مراجعة مؤجل صريحة' : ''}`)
