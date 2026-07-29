#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/components/admin/SocialDesignStudio.tsx'), 'utf8')
const publishingSource = readFileSync(resolve('src/components/admin/PublishingStudio.tsx'), 'utf8')
const zeroDecision = source.slice(
  source.indexOf('const runZeroDecisionMode'),
  source.indexOf('const runAutopilot'),
)
const manualGenerator = source.slice(
  source.indexOf('const runGenerator'),
  source.indexOf('const undoEdit'),
)

assert.match(source, /function BufferedIdeaTextarea/)
assert.match(source, /type StudioVisualMode = 'generate' \| 'ready'/)
assert.doesNotMatch(source, /setVisualMode\('library'\)/)
assert.match(source, /professionalReleaseGate/)
assert.match(source, /data-professional-visual-gate="true"/)
assert.match(source, /premiumReadyQueries/)
assert.match(source, /cheapStockPenalty/)
assert.match(source, /directorScore >= 70/)
assert.match(source, /while \(attempts < 3 && !winner\)/)
assert.match(source, /preferPalette: effectivePalette/)
assert.match(publishingSource, /data-standalone-phrase-understanding="true"/)
assert.match(publishingSource, /data-professional-standalone-directions="true"/)
assert.match(publishingSource, /independent-art-direction/)
assert.match(publishingSource, /designSimilarity\(item\.plan, candidate\.plan\) < \.74/)
assert.match(publishingSource, /return selected\.slice\(0, 3\)/)
assert.match(source, /const id = 'latest-approved'/)
assert.match(source, /admin-generated-designs\/latest-approved\.json/)
assert.match(source, /maxAttempts = 2/)
assert.doesNotMatch(zeroDecision, /buildLocalReserveImage/)
assert.doesNotMatch(manualGenerator, /buildLocalReserveImage/)
assert.match(zeroDecision, /requestGeneratedStudioImageWithBackoff/)
assert.doesNotMatch(zeroDecision, /requestedMode === 'library'/)
assert.match(manualGenerator, /buildImageLedPlan/)
assert.match(manualGenerator, /runAutopilot/)

console.log('Studio UI contract: two visual routes, premium ready-image curation, professional release gate, and latest-approved storage passed')
