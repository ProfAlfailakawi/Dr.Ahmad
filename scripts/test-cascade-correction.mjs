#!/usr/bin/env node
import assert from 'node:assert/strict'
import { advanceCascadeCorrection, buildCascadeCorrectionCase, cascadeCorrectionId, cascadeCorrectionSummary, correctionBlocksRelease, correctionReadyForPassport } from '../src/lib/cascade-correction.mjs'

const previousPassport = { passportId: 'article-one:old-passport' }
let correction = buildCascadeCorrectionCase({
  now: '2026-08-01T10:00:00.000Z',
  source: { id: 'source-1', title: 'دراسة أصلية', status: 'corrected', provider: 'Crossref', signals: ['تصحيح صريح'] },
  dependency: { slug: 'article-one', title: 'المقال الأول', sourceIds: ['personal:source-1'], evidenceChain: { claims: [{ id: 'claim-1', text: 'ادعاء مرتبط', sourceIds: ['personal:source-1'] }] } },
  article: { slug: 'article-one', title: 'المقال الأول', publicationPassport: previousPassport },
})

assert.equal(correction.id, cascadeCorrectionId('source-1', 'article-one'))
assert.equal(cascadeCorrectionId('source-1', 'article-one'), cascadeCorrectionId('source-2', 'article-one'), 'one article must have one aggregate correction chain')
assert.equal(correction.status, 'detected')
assert.equal(correction.affectedClaims.length, 1)
assert.equal(correction.holds.socialReuse, true)
assert.equal(correctionBlocksRelease(correction), true)
assert.equal(correctionReadyForPassport(correction), false)

for (const event of ['start', 'text_reviewed', 'audio_replaced', 'design_rebuilt', 'social_rebuilt', 'campaign_rebuilt']) {
  correction = advanceCascadeCorrection(correction, event, { at: '2026-08-01T11:00:00.000Z' })
}
assert.equal(correction.status, 'ready_for_passport')
assert.equal(correctionReadyForPassport(correction), true)
assert.throws(() => advanceCascadeCorrection(buildCascadeCorrectionCase({ source: { id: 's', status: 'retracted' }, dependency: { slug: 'x' }, article: { slug: 'x' } }), 'passport_signed', { passportId: 'x:new' }), /إكمال/)

correction = advanceCascadeCorrection(correction, 'passport_signed', { passportId: 'article-one:new-passport' })
assert.equal(correction.status, 'resolved')
assert.equal(correctionBlocksRelease(correction), false)
assert.equal(cascadeCorrectionSummary(correction).nextPassportId, 'article-one:new-passport')
assert.equal(correction.affectedLayers.passport.previousPassportId, previousPassport.passportId)

correction = advanceCascadeCorrection(correction, 'landing_observed', { landed: true, observation: 'وصل المعنى المصحح كما قصد الكاتب.' })
assert.equal(correction.impact.correctedMeaningLanded, true)
assert.equal(correction.status, 'resolved')

const reopened = buildCascadeCorrectionCase({
  existingCase: correction,
  source: { id: 'source-2', title: 'مصدر ثان', status: 'retracted' },
  dependency: { slug: 'article-one', publicationPassportId: 'article-one:new-passport' },
  article: { slug: 'article-one', publicationPassport: { passportId: 'article-one:new-passport' } },
})
assert.equal(reopened.status, 'detected')
assert.equal(reopened.triggers.length, 2)
assert.equal(reopened.previousPassportId, 'article-one:new-passport')

console.log('cascade correction protocol: passed')
