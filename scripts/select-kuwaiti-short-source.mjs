#!/usr/bin/env node
/**
 * يستبدل متن Firestore الكامل بالمكثف المقفول قبل التوليد، بعد أن يبرهن
 * أن كل دور قصير موجود في المتن المقفول نفسه وبالترتيب وللمتحدث نفسه.
 * يبقى revisionId الأصلي كما هو: النسخة القصيرة مشتقة حتمياً منه، وتُضاف
 * بصمتها وعدد أدوارها إلى القفل كي لا تختلط بالمصدر الكامل في التدقيق.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name) => process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3) || ''
const slugs = arg('slugs').split(',').map((s) => s.trim()).filter(Boolean)
assert.ok(slugs.length, 'مرّر --slugs=slug[,slug]')

const shortLib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues-short.json'), 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const turnsOf = (value) => Array.isArray(value) ? value : Object.values(value || {})
const sameText = (full, short) => full === short || full === `و${short}`

for (const slug of slugs) {
  assert.match(slug, /^[a-z0-9-]+$/, `slug غير صالح: ${slug}`)
  const sourceFile = resolve(ROOT, 'manual-dialogues-kuwaiti', `${slug}.json`)
  const lockFile = resolve(ROOT, 'podcast-audits', 'source-locks-kuwaiti', `${slug}.json`)
  const full = turnsOf(JSON.parse(readFileSync(sourceFile, 'utf8')))
  const selected = turnsOf(shortLib.episodes?.[slug])
  const lock = JSON.parse(readFileSync(lockFile, 'utf8'))
  assert.ok(full.length > selected.length && selected.length >= 15, `${slug}: المصدر القصير غير منطقي (${full.length}→${selected.length})`)
  assert.equal(selected.filter((t) => t.musicBridgeAfter).length, 2, `${slug}: يلزم جسران في النسخة القصيرة`)

  let cursor = 0
  for (const [i, turn] of selected.entries()) {
    const found = full.findIndex((candidate, j) => j >= cursor && candidate.speaker === turn.speaker && sameText(String(candidate.text), String(turn.text)))
    assert.ok(found >= 0, `${slug}: الدور القصير ${i} ليس جزءاً مرتباً من متن Firestore المقفول: ${turn.text}`)
    cursor = found + 1
  }

  const serialized = JSON.stringify(selected, null, 2) + '\n'
  writeFileSync(sourceFile, serialized)
  writeFileSync(lockFile, JSON.stringify({
    ...lock,
    sourceVariant: 'condensed-2m30-v1',
    fullTurnCount: full.length,
    turnCount: selected.length,
    bridgeCount: 2,
    shortContentSha256: sha256(serialized),
  }, null, 2) + '\n')
  console.log(`✓ ${slug}: المصدر المقفول ${full.length}→${selected.length} دوراً · جسران · بصمة ${sha256(serialized).slice(0, 12)}`)
}
