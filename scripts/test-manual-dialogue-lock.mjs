#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dialogueHashes, normalizeManualDialogueTurns, validateCloudDialogueLock } from './lib/manual-dialogue-source.mjs'

const fixture = [
  { speaker: 'male', text: 'هذا هو النص المرفوع نفسه.', deliveryType: 'statement', pauseAfterMs: 560, overlapMs: 0, musicBridgeAfter: false },
  { speaker: 'female', text: 'وأي تغيير حرف واحد يجب أن يوقف التوليد.', deliveryType: 'statement', pauseAfterMs: 680, overlapMs: 60, musicBridgeAfter: true },
]
const first = dialogueHashes(fixture)
const second = dialogueHashes(JSON.parse(JSON.stringify(fixture)))
assert.equal(first.contentSha256, second.contentSha256)
assert.equal(first.revisionSha256, second.revisionSha256)
assert.equal(first.turnCount, 2)

const changedWord = structuredClone(fixture)
changedWord[1].text = 'وأي تغيير كلمة واحدة يجب أن يوقف التوليد.'
const wordHash = dialogueHashes(changedWord)
assert.notEqual(first.contentSha256, wordHash.contentSha256)
assert.notEqual(first.revisionSha256, wordHash.revisionSha256)

const changedMechanic = structuredClone(fixture)
changedMechanic[1].pauseAfterMs = 900
const mechanicHash = dialogueHashes(changedMechanic)
assert.equal(first.contentSha256, mechanicHash.contentSha256)
assert.notEqual(first.revisionSha256, mechanicHash.revisionSha256)

const dialogueDocument = {
  turns: first.turns,
  source: 'admin-upload', schemaVersion: 2,
  contentSha256: first.contentSha256, revisionSha256: first.revisionSha256,
  revisionId: first.revisionId, turnCount: first.turnCount,
}
const productionDocument = {
  status: 'queued', sourceCollection: 'podcast_dialogues',
  expectedDialogueContentSha256: first.contentSha256,
  expectedDialogueRevisionSha256: first.revisionSha256,
  expectedDialogueRevisionId: first.revisionId,
  expectedTurnCount: first.turnCount,
}
assert.equal(validateCloudDialogueLock({ slug: 'fixture', dialogue: dialogueDocument,
  production: productionDocument }).contentSha256, first.contentSha256)
assert.throws(() => validateCloudDialogueLock({ slug: 'fixture', dialogue: { ...dialogueDocument,
  turns: changedWord }, production: productionDocument }), /بصمة كلمات الحوار/)
assert.throws(() => validateCloudDialogueLock({ slug: 'fixture', dialogue: dialogueDocument,
  production: { ...productionDocument, expectedDialogueRevisionSha256: mechanicHash.revisionSha256 } }), /تغيّر بعد الضغط/)
assert.throws(() => validateCloudDialogueLock({ slug: 'fixture', dialogue: dialogueDocument,
  production: { ...productionDocument, status: 'draft' } }), /ليست queued/)

assert.throws(() => normalizeManualDialogueTurns([{ speaker: 'male', text: 'ناقص' }]), /مداخلتين/)
assert.throws(() => normalizeManualDialogueTurns([
  { speaker: 'male', text: 'الأولى' },
  { speaker: 'male', text: 'الثانية' },
]), /الرجل والمرأة/)

const fetchSource = readFileSync(resolve('scripts/fetch-manual-dialogues.mjs'), 'utf8')
assert.match(fetchSource, /requeueLocked/)
assert.match(fetchSource, /requireQueued: false/)
assert.match(fetchSource, /retryRequestedAt/)
const engineSource = readFileSync(resolve('scripts/podcast-dialogue.mjs'), 'utf8')
assert.match(engineSource, /sttQuotaExhausted && MANUAL_EXACT/)
assert.match(engineSource, /providerQuotaFallback/)

console.log('✓ manual dialogue source-lock self-test passed')
