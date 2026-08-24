#!/usr/bin/env node
/** يثبت طبقة النص المنطوق على أي مصدرٍ جُهّز خارج مسار select الرئيسي. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimizeNativeSpokenEpisode } from './lib/kuwaiti-native-spoken.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback = '') => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback
const dir = resolve(ROOT, arg('dir', 'manual-dialogues-kuwaiti'))
const lockDir = resolve(ROOT, arg('lock-dir', 'podcast-audits/source-locks-kuwaiti'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

assert.ok(existsSync(dir), `مجلد النص المنطوق مفقود: ${dir}`)
const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort()
assert.ok(files.length, 'لا مصادر لتطبيق طبقة النص المنطوق')

let rewrites = 0
for (const file of files) {
  const slug = file.replace(/\.json$/, '')
  const sourceFile = resolve(dir, file)
  const source = JSON.parse(readFileSync(sourceFile, 'utf8'))
  const turns = Array.isArray(source) ? source : Object.values(source.turns || source)
  const prepared = optimizeNativeSpokenEpisode(turns, { slug })
  assert.equal(prepared.audit.hard.length, 0,
    `${slug}: بقيت صياغات مانعة: ${prepared.audit.hard.map((finding) => `${finding.index + 1}:${finding.label}`).join(' · ')}`)
  const serialized = JSON.stringify(prepared.turns, null, 2) + '\n'
  writeFileSync(sourceFile, serialized)
  const lockFile = resolve(lockDir, file)
  if (existsSync(lockFile)) {
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'))
    writeFileSync(lockFile, JSON.stringify({
      ...lock,
      shortContentSha256: sha256(serialized),
      nativeSpokenVersion: prepared.version,
      nativeSpokenRewriteCount: prepared.changes.length,
      nativeSpokenChangesSha256: sha256(JSON.stringify(prepared.changes)),
      nativeSpokenQafRiskCount: prepared.audit.qafRiskCount,
      nativeSpokenSoftWarnings: prepared.audit.soft.length,
      dialogueVarietyVersion: prepared.conversationPlan.version,
      dialogueVarietyFamily: prepared.conversationPlan.family,
      dialogueVarietyCastSwapped: prepared.conversationPlan.castSwapped,
    }, null, 2) + '\n')
  }
  rewrites += prepared.changes.length
  console.log(`✓ ${slug}: ${prepared.turns.length} مداخلة · ${prepared.changes.length} خانة مصقولة · ${prepared.conversationPlan.family} · البداية ${prepared.conversationPlan.firstSpeaker === 'female' ? 'نورة' : 'فهد'}`)
}

console.log(`✓ طبقة النص الكويتي الطبيعي: ${files.length} ملفاً · ${rewrites} خانة مصقولة`)
