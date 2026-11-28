import assert from 'node:assert/strict'
import { buildMultimodalMeaningCourt } from '../src/lib/semantic-court.mjs'

const thesis = 'الذكاء الاصطناعي يدعم قرار المعلم ولا يستبدل خبرته المهنية.'
const caveat = 'لكن استخدامه لا يكفي من دون مساءلة بشرية وتحقق من النتائج.'
const body = Array.from({ length: 16 }, () => `${thesis} ${caveat} المدرسة تحتاج إلى قرار تربوي يحفظ دور الإنسان.`).join(' ')
const proof = `article.fahed.mp3|sha256:${'a'.repeat(64)}|source:${'b'.repeat(64)}|bytes:4096|seconds:120`
const base = {
  article: { slug: 'teacher-ai', title: 'المعلم والآلة: شراكة لا إحلال', excerpt: thesis, body },
  fingerprint: { hash: 'meaning-test', thesis, protectedPoints: [thesis, caveat], caveats: [caveat] },
  media: {
    audio: [proof],
    social: [{ id: 'x-1', channel: 'X', text: `${thesis}\n${caveat}` }],
    designs: [{ id: 'd-1', channel: 'تصميم', text: 'الذكاء الاصطناعي يدعم قرار المعلم ولا يستبدل خبرته' }],
  },
  evidence: { sourceIds: ['paper:one'], proofs: ['paper:one|doi:10.1/example'], alerts: [], claims: [] },
}

const passed = buildMultimodalMeaningCourt(base)
assert.equal(passed.status, 'passed')
assert.equal(passed.releaseReady, true)
assert.equal(passed.chambers.audio.sourceLocked, true)
assert.equal(passed.safeguards.headlineGuard.status, 'passed')
assert.equal(passed.safeguards.claimLineage.status, 'passed')

const inverted = buildMultimodalMeaningCourt({ ...base, media: { ...base.media, social: [{ id: 'x-bad', channel: 'X', text: 'الذكاء الاصطناعي يستبدل خبرة المعلم المهنية.' }] } })
assert.equal(inverted.chambers.social.status, 'blocked')
assert.match(inverted.alerts.join(' '), /قلب نفي/)

const inventedNumber = buildMultimodalMeaningCourt({ ...base, media: { ...base.media, social: [{ id: 'x-number', channel: 'X', text: 'تثبت البيانات أن 93٪ من المعلمين استغنوا عن خبرتهم.' }] } })
assert.equal(inventedNumber.safeguards.claimLineage.status, 'blocked')
assert.match(inventedNumber.alerts.join(' '), /رقم بلا أصل/)

const sensational = buildMultimodalMeaningCourt({ ...base, media: { ...base.media, designs: [{ id: 'd-bad', channel: 'تصميم', text: 'نهاية المعلم: الذكاء الاصطناعي هو الحل الوحيد' }] } })
assert.equal(sensational.safeguards.headlineGuard.status, 'blocked')

const pending = buildMultimodalMeaningCourt({ article: base.article, fingerprint: base.fingerprint, media: {}, evidence: {} })
assert.equal(pending.status, 'pending')
assert.equal(pending.releaseReady, false)

console.log('✓ multimodal meaning court: inversion, exaggeration, caveat covenant, claim lineage, and source-locked audio')
