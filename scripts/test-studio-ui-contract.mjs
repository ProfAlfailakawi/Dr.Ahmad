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
assert.match(source, /directorScore >= 74/)
assert.match(source, /directorScore >= 64/)
assert.match(source, /while \(attempts < 3 && !winner\)/)
assert.match(source, /preferPalette: effectivePalette/)
assert.match(publishingSource, /data-standalone-phrase-understanding="true"/)
assert.match(publishingSource, /data-professional-standalone-directions="true"/)
assert.match(publishingSource, /independent-art-direction/)
/* لا نربط العقد بعتبة التشابه القديمة: الاختيار الحالي يعظّم أقل مسافة
   إدراكية بين الخطط ويضم القالب والاتجاه والإطار واللون والوزن البصري. */
assert.match(publishingSource, /function perceptualDesignDistance/)
assert.match(publishingSource, /1 - designSimilarity\(left, right\)/)
assert.match(publishingSource, /Math\.min\(\.\.\.selected\.map\(\(chosen\) => perceptualDesignDistance\(item\.plan, chosen\.plan\)\)\)/)
assert.match(publishingSource, /return selected\.slice\(0, 3\)/)
assert.match(source, /const id = 'latest-approved'/)
assert.match(source, /admin-generated-designs\/latest-approved\.json/)
assert.match(source, /maxAttempts = 4/)
assert.match(source, /browser-original-editorial/)
assert.match(source, /repairRound < 2/)
assert.match(zeroDecision, /buildLocalReserveImage/)
assert.match(manualGenerator, /buildLocalReserveImage/)
assert.match(zeroDecision, /requestGeneratedStudioImageWithBackoff/)
assert.doesNotMatch(zeroDecision, /requestedMode === 'library'/)
assert.match(manualGenerator, /buildImageLedPlan/)
assert.match(manualGenerator, /runAutopilot/)

console.log('Studio UI contract: two visual routes, perceptual diversity, premium ready-image curation, automatic recovery, professional release gate, and latest-approved storage passed')
