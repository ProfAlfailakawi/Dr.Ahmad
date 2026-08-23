#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/components/admin/SocialDesignStudio.tsx'), 'utf8')
const publishingSource = readFileSync(resolve('src/components/admin/PublishingStudio.tsx'), 'utf8')

const gallerySource = readFileSync(resolve('src/components/admin/DesignWorldsGallery.tsx'), 'utf8')
const reelStudioSource = readFileSync(resolve('src/components/admin/ReelStudio.tsx'), 'utf8')
const reelScenesSource = readFileSync(resolve('src/lib/reel-scenes.ts'), 'utf8')
const worldsSource = readFileSync(resolve('src/lib/design-worlds.ts'), 'utf8')
const proceduralSource = readFileSync(resolve('src/lib/procedural-world-engine.ts'), 'utf8')
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

assert.match(gallerySource, /data-world-master-count="64"/)
assert.match(gallerySource, /IntersectionObserver/)
assert.match(gallerySource, /fuseWorlds/)
assert.match(gallerySource, /Controlled/)
assert.match(gallerySource, /compare/)
assert.match(gallerySource, /locks/)
assert.match(worldsSource, /WORLD_SPECS\.length !== 64/)
assert.match(proceduralSource, /deterministicSeed/)
assert.match(proceduralSource, /perceptualSignature/)

assert.match(reelStudioSource, /import DesignWorldsGallery from '\.\/DesignWorldsGallery'/)
assert.match(reelStudioSource, /data-reel-world-director="shared-design-worlds-gallery"/)
assert.match(reelStudioSource, /semanticPlatform="reel"/)
assert.match(reelStudioSource, /onDress=\{\(world\)=>directWithWorld\(world\)\}/)
assert.match(reelStudioSource, /onClear=\{\(\)=>directWithWorld\(null\)\}/)
assert.match(reelScenesSource, /ReelPlanOptions/)
assert.match(reelScenesSource, /reelWorldFromDesignWorld/)
assert.match(reelScenesSource, /اختيارك ثبّت/)

console.log('Studio UI contract: shared 64-world director is identical across post and cinematic reel studios, with deterministic diversity, fusion, locks, comparison, and quality gates passed')
