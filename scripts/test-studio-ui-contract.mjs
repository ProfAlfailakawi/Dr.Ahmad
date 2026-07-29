#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/components/admin/SocialDesignStudio.tsx'), 'utf8')
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
assert.match(source, /const id = 'latest-approved'/)
assert.match(source, /admin-generated-designs\/latest-approved\.json/)
assert.match(source, /maxAttempts = 2/)
assert.doesNotMatch(zeroDecision, /buildLocalReserveImage/)
assert.doesNotMatch(manualGenerator, /buildLocalReserveImage/)
assert.match(zeroDecision, /requestGeneratedStudioImageWithBackoff/)
assert.doesNotMatch(zeroDecision, /requestedMode === 'library'/)
assert.match(manualGenerator, /buildImageLedPlan/)
assert.match(manualGenerator, /runAutopilot/)

console.log('Studio UI contract: buffered typing, curated visuals, creative composition, and latest-approved storage passed')
