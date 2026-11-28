import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  buildOpportunityRadar,
  buildPublicationPassportDraft,
  buildTransformingCampaign,
  sealPublicationPassportDraft,
  stableCanonicalJson,
} from '../src/lib/sovereign-publishing.mjs'

const longBody = Array.from({ length: 380 }, (_, index) => `كلمة${index}`).join(' ')
const audioProofRow = `signed-article.fahed.mp3|sha256:${'a'.repeat(64)}|source:${'b'.repeat(64)}|bytes:4096|seconds:180`
const semanticCourtInput = {
  article: { slug: 'signed-article', title: 'كلمة1 كلمة2 كلمة3', excerpt: 'كلمة1 كلمة2 كلمة3', body: longBody },
  fingerprint: { hash: 'meaning-1', thesis: 'كلمة1 كلمة2 كلمة3', protectedPoints: ['كلمة1 كلمة2 كلمة3'], caveats: [] },
  media: {
    audio: [audioProofRow],
    social: [{ id: 'x-1', channel: 'X', text: 'كلمة1 كلمة2 كلمة3' }],
    designs: [{ id: 'design-1', channel: 'تصميم', text: 'كلمة1 كلمة2 كلمة3' }],
  },
  evidence: { sourceIds: ['paper:one'], proofs: ['paper:one|doi:10.1000/example|status:active'], alerts: [], claims: [] },
}
const readyDraft = buildPublicationPassportDraft({
  article: { slug: 'signed-article', title: 'كلمة1 كلمة2 كلمة3', excerpt: 'كلمة1 كلمة2 كلمة3', body: longBody, meaningFingerprint: 'meaning-1' },
  audio: { assets: [audioProofRow] },
  design: { assetCount: 4, qualityScore: 91, fingerprints: ['visual-1'] },
  social: { tweetCount: 3, platformCount: 5, campaignId: 'signed-article-7d', content: 'نصوص الحملة' },
  evidence: { sourceIds: ['paper:one'], proofs: ['paper:one|doi:10.1000/example|status:active'], alerts: [] },
  semanticCourtInput,
  releaseDecision: { targetStatus: 'published', manualOverride: false, overrideReason: '' },
})
assert.equal(readyDraft.releaseReady, true, 'all passport layers and the semantic court should be required and sufficient')
assert.deepEqual(readyDraft.blocking, [])

const correctionBlocked = buildPublicationPassportDraft({
  article: { slug: 'signed-article', title: 'كلمة1 كلمة2 كلمة3', excerpt: 'كلمة1 كلمة2 كلمة3', body: longBody, meaningFingerprint: 'meaning-1' },
  audio: { assets: [audioProofRow] },
  design: { assetCount: 4, qualityScore: 91, fingerprints: ['visual-1'] },
  social: { tweetCount: 3, platformCount: 5, campaignId: 'signed-article-7d', content: 'نصوص الحملة' },
  evidence: { sourceIds: ['paper:one'], proofs: ['paper:one|doi:10.1000/example|status:active'], alerts: [] },
  semanticCourtInput,
  correction: { caseId: 'case-1', status: 'remediating', sourceStatus: 'corrected', replacesPassportId: 'signed-article:old-passport', readyForPassport: false },
})
assert.equal(correctionBlocked.releaseReady, false)
assert.ok(correctionBlocked.blocking.includes('سلسلة التصحيح'))
const correctionReady = buildPublicationPassportDraft({ ...correctionBlocked, correction: { ...correctionBlocked.correction, readyForPassport: true, status: 'ready_for_passport' }, semanticCourtInput })
assert.ok(!correctionReady.blocking.includes('سلسلة التصحيح'))

const incompleteDraft = buildPublicationPassportDraft({ article: { slug: 'draft', title: 'مسودة', body: longBody } })
assert.equal(incompleteDraft.releaseReady, false)
assert.deepEqual(incompleteDraft.blocking, ['الصوت', 'التصميم', 'التغريدات', 'المصادر', 'محكمة المعنى'])

const digest = async (value) => createHash('sha256').update(value).digest('hex')
const sealed = await sealPublicationPassportDraft(readyDraft, digest)
assert.equal('body' in sealed.components.text, false, 'signed manifest must not duplicate the article body')
assert.equal('content' in sealed.components.social, false, 'signed manifest must not duplicate campaign copy')
assert.match(sealed.components.text.bodyHash, /^[a-f0-9]{64}$/)
const firstCanonical = stableCanonicalJson({ z: 1, a: { y: 2, x: 3 } })
const secondCanonical = stableCanonicalJson({ a: { x: 3, y: 2 }, z: 1 })
assert.equal(firstCanonical, secondCanonical, 'canonical payload must not depend on property insertion order')
assert.notEqual(await digest(firstCanonical), await digest(stableCanonicalJson({ a: { x: 4, y: 2 }, z: 1 })), 'tampering must change the fingerprint')

const campaign = buildTransformingCampaign({
  bundle: { slug: 'one-idea', title: 'فكرة واحدة', excerpt: 'الأثر الإنساني قبل الأداة' },
  pack: { linkedin: ['افتتاح الحملة', 'حجة اليوم الرابع'], x: ['عبارة مكثفة'], question: 'ما قرارك؟', quote: 'الإنسان قبل الأداة' },
})
assert.equal(campaign.stages.length, 7)
assert.equal(campaign.continuityScore, 100)
assert.equal(new Set(campaign.stages.map((stage) => stage.role)).size, 7, 'every day should perform a distinct narrative job')
for (const [index, stage] of campaign.stages.entries()) {
  assert.equal(stage.day, index + 1)
  assert.ok(stage.handoff.length > 12, `day ${stage.day} must hand the narrative to the next decision`)
  if (index > 0) assert.ok(stage.carriesFrom.length > 12, `day ${stage.day} must inherit from its predecessor`)
}

const now = Date.parse('2026-08-01T12:00:00Z')
const events = [{
  id: 'event-1',
  title: 'الذكاء الاصطناعي وتدريب المعلمين في الكويت',
  summary: 'برنامج جديد يركز على تدريب المعلمين واستخدام الذكاء الاصطناعي في التعليم',
  source: 'مصدر رسمي',
  url: 'https://example.org/current-event',
  publishedAt: '2026-08-01T02:00:00Z',
  relevance: 4,
}]
const archive = [{
  slug: 'teacher-ai-training',
  title: 'تدريب المعلمين على الذكاء الاصطناعي',
  excerpt: 'كيف يخدم الذكاء الاصطناعي تدريب المعلمين داخل التعليم في الكويت؟',
  body: 'المعلم والتدريب والذكاء الاصطناعي والتعليم والممارسة المهنية.',
  iso: '2024-04-01',
}]
const opportunities = buildOpportunityRadar(events, archive, { now, threshold: 78 })
assert.equal(opportunities.length, 1, 'a fresh evidenced archive intersection should pass')
assert.ok(opportunities[0].confidence >= 78)
assert.equal(opportunities[0].breakdown.evidence, 100)
assert.match(opportunities[0].whyNow, /عمر الإشارة/)
assert.equal(buildOpportunityRadar([{ ...events[0], url: '' }], archive, { now }).length, 0, 'missing evidence URL must fail closed')
assert.equal(buildOpportunityRadar([{ ...events[0], publishedAt: '2026-07-01T00:00:00Z' }], archive, { now }).length, 0, 'stale events must not wake the archive')
assert.equal(buildOpportunityRadar(events, [{ ...archive[0], title: 'رحلة في الأدب', excerpt: 'قراءة في الشعر', body: 'قصيدة وكتاب ولغة' }], { now }).length, 0, 'weak semantic overlap must remain silent')

const publishingStudio = readFileSync(new URL('../src/components/admin/PublishingStudio.tsx', import.meta.url), 'utf8')
const contentManager = readFileSync(new URL('../src/components/admin/ContentManager.tsx', import.meta.url), 'utf8')
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8')
const audioProof = readFileSync(new URL('../src/lib/audio-proof.ts', import.meta.url), 'utf8')
assert.match(publishingStudio, /transformingCampaign: sevenDayCampaign/)
assert.match(publishingStudio, /opportunities=\{opportunityRadar\}/)
const publicArticleWrite = publishingStudio.match(/await setDoc\(doc\(db, 'site_articles'[\s\S]*?\n      \}\)\n      await setDoc\(doc\(db, 'admin_content_intelligence'/)?.[0] || ''
assert.doesNotMatch(publicArticleWrite, /privateBookMemory|styleProfile|editorialBoardTrace/, 'private editorial memory must never be copied into a publicly readable article document')
assert.match(publishingStudio, /privatePublishingStudio:/, 'private studio trace must move to the admin-only intelligence document')
assert.match(contentManager, /requestPublicationPassportSignature/)
assert.match(server, /admin_publication_passports/)
assert.match(server, /signPayload\('RSA-SHA256'/)
assert.match(server, /selfVerified = verifySignature\('RSA-SHA256'/)
assert.match(server, /buildMultimodalMeaningCourt\(semanticCourtInput\)/, 'the server must recompute the semantic court instead of trusting the browser verdict')
assert.match(server, /adversarialSimulation:[\s\S]*?scenarioHashes:/, 'the signed server manifest must include hashes of the recomputed adversarial simulation')
assert.match(server, /proofHashes: sourceProofs\.map\(proofHash\)/, 'private source details must be hashed before the passport reaches a public article document')
assert.match(server, /overrideReasonHash: overrideReason \? proofHash\(overrideReason\)/, 'a manual release decision must be covered by the signed manifest without exposing its private reason')
assert.doesNotMatch(server.match(/const envelope = \{[\s\S]*?\n  \}/)?.[0] || '', /signedBy:/, 'the public passport envelope must not expose the admin uid')
assert.match(audioProof, /sha256:\$\{row\.sha256\}/, 'audio passport must carry the verified R2 binary hash')

console.log('✓ sovereign publication passport, transforming campaign, and opportunity radar self-test passed')
