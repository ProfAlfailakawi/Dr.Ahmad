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
assert.match(source, /type StudioVisualMode = 'generate' \| 'library' \| 'ready'/)
assert.match(source, /selectedLibraryImageId/)
assert.match(source, /resolveLibraryImagePassport/)
assert.match(source, /maxAttempts = 2/)
assert.doesNotMatch(zeroDecision, /buildLocalReserveImage/)
assert.doesNotMatch(manualGenerator, /buildLocalReserveImage/)
assert.match(zeroDecision, /requestGeneratedStudioImageWithBackoff/)
assert.match(zeroDecision, /requestedMode === 'library'/)

console.log('Studio UI contract: buffered typing, real library, and quality-gated AI generation passed')
