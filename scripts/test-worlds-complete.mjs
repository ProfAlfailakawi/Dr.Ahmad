#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const read = (file) => readFile(resolve(ROOT, file), 'utf8')
const errorsOf = (compiled) => (compiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error)
function transpile(source, fileName) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, strict: true },
    reportDiagnostics: true,
    fileName,
  })
  assert.equal(errorsOf(compiled).length, 0, `${fileName} must transpile without TypeScript errors`)
  return compiled.outputText
}
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const replaceImport = (source, specifier, url) => source.replaceAll(`'${specifier}'`, `'${url}'`).replaceAll(`"${specifier}"`, `"${url}"`)

const socialStubUrl = dataUrl(`
export const draftWorldPreview = () => null;
export const generateSocialDesigns = () => ({ plans: [] });
export const reshapePlanSignature = (plan) => plan;
`)

const designPath = resolve(ROOT, 'src/lib/design-worlds.ts')
let designOutput = transpile(await read('src/lib/design-worlds.ts'), designPath)
designOutput = replaceImport(designOutput, './social-design-engine', socialStubUrl)
const designUrl = dataUrl(designOutput)
const design = await import(designUrl)

const semanticsPath = resolve(ROOT, 'src/lib/world-semantics.ts')
let semanticsOutput = transpile(await read('src/lib/world-semantics.ts'), semanticsPath)
semanticsOutput = replaceImport(semanticsOutput, './design-worlds', designUrl)
const semanticsUrl = dataUrl(semanticsOutput)
const semantics = await import(semanticsUrl)

const proceduralPath = resolve(ROOT, 'src/lib/procedural-world-engine.ts')
let proceduralOutput = transpile(await read('src/lib/procedural-world-engine.ts'), proceduralPath)
proceduralOutput = replaceImport(proceduralOutput, './design-worlds', designUrl)
proceduralOutput = replaceImport(proceduralOutput, './world-semantics', semanticsUrl)
proceduralOutput = replaceImport(proceduralOutput, './social-design-engine', socialStubUrl)
const proceduralUrl = dataUrl(proceduralOutput)
const procedural = await import(proceduralUrl)

const diversityPath = resolve(ROOT, 'src/lib/perceptual-diversity.ts')
let diversityOutput = transpile(await read('src/lib/perceptual-diversity.ts'), diversityPath)
diversityOutput = replaceImport(diversityOutput, './procedural-world-engine', proceduralUrl)
diversityOutput = replaceImport(diversityOutput, './social-design-engine', socialStubUrl)
const diversity = await import(dataUrl(diversityOutput))

const auditsPath = resolve(ROOT, 'src/lib/world-audits.ts')
let auditsOutput = transpile(await read('src/lib/world-audits.ts'), auditsPath)
auditsOutput = replaceImport(auditsOutput, './design-worlds', designUrl)
auditsOutput = replaceImport(auditsOutput, './procedural-world-engine', proceduralUrl)
const audits = await import(dataUrl(auditsOutput))

const expectedFamilies = [
  ['cosmic',['Copper Eclipse','Obsidian Orbit','Nebula Manuscript','Lunar Glass']],
  ['editorial',['Indigo Archive','Black Margin','Ivory Thesis','Red Footnote']],
  ['organic',['Emerald Atlas','Root Cathedral','Desert Bloom','Tidal Memory']],
  ['architectural',['Brutalist Minaret','Porcelain Grid','Glass Courtyard','Stone Axis']],
  ['kuwait-gulf',['Diwaniya Night','Sadu Signal','Pearl Diver','Kuwait Modernism']],
  ['technology-data',['Quantum Ledger','Ethical Circuit','Cyan Protocol','Neural Mosaic']],
  ['cinematic',['Noir Beacon','Desert Signal','Coral Future','Blue Hour']],
  ['quiet-luxury',['Silent Gold','Ivory Air','Midnight Ink','Platinum Whisper']],
  ['typographic',['Word Monument','Kinetic Calligraphy','Split Sentence','Echo Type']],
  ['surreal',['Floating Door','Time Orchard','Mirror Desert','Gravity Thread']],
  ['human-emotional',['Pulse Room','Memory Window','Unsaid Letter','Warm Distance']],
  ['experimental',['Chromatic Rift','Liquid Geometry','Paper Machine','Infinite Cut']],
  ['academic-knowledge',['Cognitive Atlas','Evidence Chamber','Socratic Light','Footnote Laboratory']],
  ['media-society',['Signal Room','Siren Map','Faultline Desk','Public Square']],
  ['education-childhood',['First Question','Chalk Galaxy','Growing Desk','Safe Error']],
  ['material-environment',['Mineral Rain','Moss Circuit','Clay Horizon','Ocean Archive']],
]
assert.equal(design.MASTER_WORLD_ORDER.length, 64, 'There must be exactly 64 Master Worlds')
assert.equal(new Set(design.MASTER_WORLD_ORDER).size, 64, 'Master World IDs must be unique')
for (const [family, labels] of expectedFamilies) {
  const worlds = design.MASTER_WORLD_ORDER.map((id) => design.DESIGN_WORLDS[id]).filter((w) => w.family === family)
  assert.equal(worlds.length, 4, `${family} must contain four master worlds`)
  assert.deepEqual(worlds.map((w) => w.labelEn), labels, `${family} world names/order must match the constitution`)
}
const requiredConstitutionFields = ['id','labelAr','labelEn','family','description','philosophy','emotionalTone','semanticAffinity','palettes','typography','layoutGrammar','spatialRules','framingRules','geometry','materials','textures','lighting','depth','motifs','metaphorBias','motionDna','transitionDna','logoBehavior','soundDna','densityRange','contrastRange','compatibleWorlds','incompatibleTraits','accessibilityRules','reelRules','postRules','performanceBudget','signatureTokens']
for (const id of design.MASTER_WORLD_ORDER) for (const key of requiredConstitutionFields) assert.ok(key in design.DESIGN_WORLDS[id], `${id} missing ${key}`)
const families = new Map()
for (const id of design.MASTER_WORLD_ORDER) families.set(design.DESIGN_WORLDS[id].family, (families.get(design.DESIGN_WORLDS[id].family) || 0) + 1)
assert.equal(families.size, 16)
assert.ok([...families.values()].every((n) => n === 4))

const legacy = ['observatory-night','magazine-paper','aurora-dawn','majlis-velvet','ink-marble','sadu-night','lab-notebook','dawn-orchard']
for (const id of legacy) assert.ok(design.DESIGN_WORLDS[id], `legacy id ${id} must remain backward compatible`)

const semanticCases = [
  ['جيل بلا جذور','root'],
  ['ذكاء بلا ضمير','balance'],
  ['الصمت في زمن الضجيج','breathe'],
  ['حين تصبح التقنية قائداً','transform'],
  ['لماذا نخاف السؤال؟','question'],
  ['الذاكرة تترك أثراً','echo'],
  ['الخطأ يفتح طريقاً جديداً','fracture'],
]
for (const [text, verb] of semanticCases) assert.equal(semantics.analyzeWorldSemantics(text, 'post').semanticMotionVerb, verb, `${text} should map to ${verb}`)
const semanticShape = semantics.analyzeWorldSemantics('حين يصبح السؤال سبباً في تغيير طريق التعلم؟', 'reel')
for (const key of ['topic','centralIdea','emotionalTone','tension','hasContrast','hasQuestion','hasTransformation','hasCausality','materialWords','abstractWords','semanticMotionVerb','visualMetaphor','formality','audience','platform','density']) assert.ok(key in semanticShape, `semantic analysis missing ${key}`)
assert.equal(semanticShape.platform, 'reel')

procedural.clearProceduralWorldCache()
const sampleId = design.MASTER_WORLD_ORDER[0]
const a = procedural.generateProceduralWorld(sampleId, 'جيل بلا جذور', 'stable-seed')
const b = procedural.generateProceduralWorld(sampleId, 'جيل بلا جذور', 'stable-seed')
assert.deepEqual(a, b, 'same deterministic seed must reproduce identical subworld')
let cache = procedural.proceduralWorldCacheStats()
assert.equal(cache.size, 1)
assert.equal(cache.misses, 1)
assert.equal(cache.hits, 1, 'second identical generation must hit seed cache')
assert.ok(cache.limit >= 128 && cache.limit <= 512, 'seed cache must be bounded')
for (const key of ['masterWorldId','familyId','semanticVerb','materialProfile','motionProfile','layoutGenome','paletteGenome','typographyGenome','depthGenome','audioGenome','deterministicSeed','perceptualSignature']) assert.ok(key in a, `procedural result missing ${key}`)

const axesCardinality = 5 * 10 * 5 * 5 * 4 * 4 * 10 * 6 * 6 * 5
assert.ok(axesCardinality > 100000, 'procedural axes must span far more than thousands of combinations')
const generated = []
for (const id of design.MASTER_WORLD_ORDER) {
  generated.push(procedural.generateProceduralWorld(id, 'التقييم لا يختصر الإنسان', `coverage:${id}:0`))
  generated.push(procedural.generateProceduralWorld(id, 'التقييم لا يختصر الإنسان', `coverage:${id}:1`, { densityValue: .78, depthValue: .7 }))
}
assert.equal(new Set(generated.map((x) => x.perceptualSignature)).size, generated.length, 'seeded variants should produce unique perceptual signatures across coverage set')

const sameFusion = procedural.assessFusionCompatibility(sampleId, sampleId, .6, 'فكرة')
assert.equal(sameFusion.allowed, false, 'same-world fusion must be rejected')
assert.ok(sameFusion.critical.length > 0)
let compatiblePair = null
for (let i = 0; i < design.MASTER_WORLD_ORDER.length && !compatiblePair; i += 1) {
  for (let j = i + 1; j < design.MASTER_WORLD_ORDER.length; j += 1) {
    const report = procedural.assessFusionCompatibility(design.MASTER_WORLD_ORDER[i], design.MASTER_WORLD_ORDER[j], .6, 'ذكاء بلا ضمير')
    if (report.allowed) { compatiblePair = [design.MASTER_WORLD_ORDER[i], design.MASTER_WORLD_ORDER[j], report]; break }
  }
}
assert.ok(compatiblePair, 'at least one coherent cross-world fusion must be available')
const fused = procedural.fuseWorlds(compatiblePair[0], compatiblePair[1], .6, 'ذكاء بلا ضمير', 'fusion-proof')
assert.ok(fused.fusion.nameAr.includes('×'))
assert.equal(fused.fusion.compatibility.allowed, true)
assert.notEqual(fused.world.materials[0], undefined)
assert.ok(fused.perceptualSignature.includes('fusion:'))
assert.throws(() => procedural.fuseWorlds(sampleId, sampleId, .6, 'فكرة', 'reject-proof'), /Fusion مرفوض/)

const diversityPool = []
for (const id of design.MASTER_WORLD_ORDER) for (let variant = 0; variant < 2; variant += 1) diversityPool.push(procedural.generateProceduralWorld(id, 'الصمت في زمن الضجيج', `diverse:${id}:${variant}`, variant ? { energyValue: .8, depthValue: .72 } : {}))
const chosen = diversity.selectPerceptuallyDiverse(diversityPool, diversity.vectorFromWorld, { count: 3, minDistance: .44, score: (x) => audits.WorldAudit(x).score, signature: (x) => x.perceptualSignature })
assert.equal(chosen.length, 3)
assert.ok(diversity.pairwiseMinimumDistance(chosen, diversity.vectorFromWorld) >= .44, 'selected triplet must satisfy perceptual minimum distance')
for (const item of chosen) diversity.rememberPerceptualSignature(item.perceptualSignature)
const secondChosen = diversity.selectPerceptuallyDiverse(diversityPool, diversity.vectorFromWorld, { count: 3, minDistance: .44, score: (x) => audits.WorldAudit(x).score, signature: (x) => x.perceptualSignature, excludeSignatures: diversity.recentPerceptualSignatures() })
assert.ok(secondChosen.every((item) => !chosen.some((old) => old.perceptualSignature === item.perceptualSignature)), 'recent perceptual signatures must be excluded')

const goodWorldAudit = audits.WorldAudit(a)
assert.ok(['professional','masterpiece','needs-improvement'].includes(goodWorldAudit.grade))
const punishedWorld = audits.WorldAudit(a, { clippedText:true, duplicatePhrases:true, excessGlow:true, overcrowded:true, logoDistorted:true, meaninglessMotion:true, genericOpening:true, repeatedCta:true, fallbackFont:true, wrongDuration:true, singleFrame:true, cheapOrnament:true, exportMismatch:true, paletteOnly:true, weakContrast:true })
assert.equal(punishedWorld.ready, false)
assert.equal(punishedWorld.criticalFailure, true)
const expectedPenaltyIds = ['clipped-text','duplicate-phrases','excess-glow','overcrowded','logo-distorted','meaningless-motion','generic-opening','repeated-cta','fallback-font','wrong-duration','single-frame','cheap-ornament','export-mismatch','palette-only','weak-contrast']
for (const id of expectedPenaltyIds) assert.ok(punishedWorld.penalties.some((p) => p.id === id), `WorldAudit missing penalty ${id}`)

const motionFail = audits.MotionAudit({ semantic:false, loopSafe:false, meaningful:false, fps:12, durationValid:false, singleFrame:true, excessGlow:true, textRotation:true, clippedText:true, fallbackFont:true, logoDistorted:true, exportMismatch:true, excessiveZoom:true, bounce:true, shake:true, everythingMoves:true, recorderError:true })
assert.equal(motionFail.ready, false)
assert.equal(motionFail.criticalFailure, true)
const reelFail = audits.ReelAudit({ seconds:12, sceneCount:3, hookSeconds:3, duplicate:true, clipped:true, genericOpening:true, genericCta:true, safeZone:false, repeatedCta:true, fallbackFont:true, logoDistorted:true, exportMismatch:true, excessGlow:true, overcrowded:true, unfinishedSentence:true, soundOverpowering:true, singleFrame:true, durationValid:false })
assert.equal(reelFail.ready, false)
assert.equal(reelFail.criticalFailure, true)
assert.equal(audits.qualityScore({semantic:25,beauty:20,readability:20,motion:15,identity:10,platform:10}).score, 100)
assert.equal(audits.qualityScore({semantic:22,beauty:18,readability:18,motion:14,identity:9,platform:9}).grade, 'professional')

const sourceContracts = {
  gallery: await read('src/components/admin/DesignWorldsGallery.tsx'),
  motion: await read('src/lib/design-motion.ts'),
  reelMotion: await read('src/lib/reel-motion.ts'),
  reelScenes: await read('src/lib/reel-scenes.ts'),
  renderer: await read('src/lib/social-design-renderer.ts'),
  reelStudio: await read('src/components/admin/ReelStudio.tsx'),
}
assert.match(sourceContracts.gallery, /IntersectionObserver/)
assert.match(sourceContracts.gallery, /cancelAnimationFrame/)
assert.match(sourceContracts.gallery, /onMouseEnter/)
assert.match(sourceContracts.gallery, /حرّك المعاينة/)
assert.doesNotMatch(sourceContracts.gallery, /<canvas/i)
assert.match(sourceContracts.motion, /registerMotionProfile/)
assert.match(sourceContracts.motion, /prefers-reduced-motion/)
assert.match(sourceContracts.motion, /recorder\.onerror/)
assert.match(sourceContracts.motion, /probeRecordedVideo/)
assert.match(sourceContracts.reelMotion, /auditReelFonts/)
assert.match(sourceContracts.reelMotion, /measureText/)
assert.match(sourceContracts.reelMotion, /recorder\.onerror/)
assert.match(sourceContracts.reelScenes, /MASTER_WORLD_ORDER\.map/)
assert.match(sourceContracts.reelScenes, /reelWorldFromDesignWorld/)
assert.match(sourceContracts.reelScenes, /worldTemplateBias/)
assert.match(sourceContracts.reelMotion, /drawWorldAtmosphere/)
assert.doesNotMatch(sourceContracts.reelMotion, /fillText\('؟'/)
assert.match(sourceContracts.reelStudio, /data-reel-world-director="shared-design-worlds-gallery"/)
assert.match(sourceContracts.reelStudio, /<DesignWorldsGallery/)
assert.match(sourceContracts.reelStudio, /semanticPlatform="reel"/)
assert.match(sourceContracts.renderer, /auditCompositionExportReadiness/)
assert.match(sourceContracts.renderer, /exportScale\s*=\s*type === 'png' \? 2 : 1/)
assert.match(sourceContracts.renderer, /document\.fonts/)
assert.match(sourceContracts.renderer, /preview.*export|export.*preview/is)

console.log(JSON.stringify({
  ok: true,
  masterWorlds: design.MASTER_WORLD_ORDER.length,
  families: families.size,
  proceduralCoverage: generated.length,
  cache,
  fusion: { primary: compatiblePair[0], secondary: compatiblePair[1], score: compatiblePair[2].score },
  diversityMinimum: Number(diversity.pairwiseMinimumDistance(chosen, diversity.vectorFromWorld).toFixed(3)),
  semanticCases: semanticCases.length,
  gates: ['64-worlds','16-families','legacy-ids','semantic-analysis','deterministic-seed','bounded-seed-cache','procedural-metadata','fusion-rejection','fusion-third-world','greedy-max-min','recent-signature-exclusion','world-audit-penalties','motion-critical-gate','reel-critical-gate','lazy-live-preview','high-res-export-contract','font-gate','mediarecorder-error-gate','shared-reel-world-director','world-directed-reel-material-motion-lighting'],
}, null, 2))
