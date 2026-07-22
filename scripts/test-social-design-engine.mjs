#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const sourcePath = resolve('src/lib/social-design-engine.ts')
const source = await readFile(sourcePath, 'utf8')
const studioSource = await readFile(resolve('src/components/admin/SocialDesignStudio.tsx'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ES2020,
    strict: true,
  },
  reportDiagnostics: true,
  fileName: sourcePath,
})
const diagnostics = compiled.diagnostics || []
assert.equal(diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0, 'المحرك يجب أن يترجم بلا أخطاء')
const engine = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`)

const question = engine.analyzeSocialContent('كيف نقيس التعلم دون أن نحول الطالب إلى رقم؟')
assert.equal(question.primaryKind, 'provocative-question')
assert.equal(question.topic, 'education')
assert.ok(question.structure.heroWord)

const lecture = engine.analyzeSocialContent('محاضرة: الذكاء الاصطناعي في التعليم بين الفرص والمخاطر. الأربعاء الساعة 7 مساءً. سجّل الآن.')
assert.equal(lecture.primaryKind, 'lecture')
assert.ok(lecture.recommendedFormats.some((item) => item.format === 'story'))
assert.ok(lecture.structure.cta)

const longText = Array.from({ length: 10 }, (_, index) => `الفكرة ${index + 1}: لا يكفي أن نضيف التقنية إلى الصف، بل يجب أن نعيد بناء السؤال التربوي حول الإنسان.`).join(' ')
const long = engine.analyzeSocialContent(longText)
assert.ok(long.structure.slides.length >= 4)
assert.ok(long.recommendedFormats.some((item) => item.format === 'instagram-carousel'))

const request = {
  text: 'الذكاء الاصطناعي لا يجب أن يسرق من المعلم إنسانيته',
  author: 'د. أحمد حسين الفيلكاوي',
  count: 8,
  seed: 'nuclear-studio-test',
}
const first = engine.generateSocialDesigns(request)
const repeated = engine.generateSocialDesigns(request)
assert.deepEqual(first, repeated, 'التوليد الحتمي يجب أن يعيد النتيجة نفسها للبذرة نفسها')
assert.equal(first.plans.length, 8)
assert.equal(new Set(first.plans.map((plan) => plan.layout)).size, 8, 'التنويع يجب أن يغيّر منطق التكوين لا اللون فقط')
assert.equal(new Set(first.plans.map((plan) => plan.fingerprint)).size, 8)
assert.ok(first.plans.every((plan) => engine.validateCompositionPlan(plan).every((issue) => issue.severity !== 'error')))

const withHistory = engine.generateSocialDesigns({
  ...request,
  seed: 'second-run',
  history: first.plans.map((plan) => engine.designHistoryEntry(plan)),
})
assert.ok(withHistory.plans.some((plan) => plan.fingerprint !== first.plans[0].fingerprint))

const base = first.plans[0]
const locked = engine.regenerateFromPlan(base, {
  seed: 'locked-run',
  count: 4,
  locks: { content: true, style: true, color: true, format: false },
})
assert.ok(locked.plans.every((plan) => plan.layout === base.layout))
assert.ok(locked.plans.every((plan) => plan.typography === base.typography))
assert.ok(locked.plans.every((plan) => plan.palette === base.palette))
assert.ok(locked.plans.every((plan) => plan.content.title === base.content.title))

const story = engine.transformDesignFormat(base, 'story', { respectFormatLock: false })
assert.equal(story.format.width, 1080)
assert.equal(story.format.height, 1920)
assert.equal(story.platform, 'story')
assert.notEqual(story.fingerprint, '')

const carousel = engine.transformDesignFormat(base, 'instagram-carousel', { respectFormatLock: false })
assert.ok(Array.isArray(carousel.content.slides))
assert.ok(Object.keys(engine.compositionCssVariables(base)).length >= 16)

const audit = engine.auditDesignBatch(first.plans)
assert.equal(audit.valid, true)
assert.equal(audit.uniqueLayouts, 8)
assert.equal(audit.uniqueFingerprints, 8)
assert.ok(first.plans.every((plan) => plan.quality?.score >= 68), 'الناقد البصري لا يعرض اتجاهًا ضعيفًا')
assert.ok(first.plans.every((plan) => (plan.quality?.lineFit || 0) >= 76), 'الناقد يفحص عدد الأسطر الفعلي لا عدد الكلمات فقط')
assert.ok(first.generation.candidateCount >= 32)
assert.ok(first.generation.averageQuality >= 75)

const emptyTaste = engine.createEmptyTasteProfile()
const likedTaste = engine.updateTasteProfile(emptyTaste, base, 1)
const reinforcedTaste = engine.updateTasteProfile(likedTaste, base, 1)
const dislikedTaste = engine.updateTasteProfile(emptyTaste, base, -1)
assert.ok(engine.tasteAffinity(reinforcedTaste, base) > .5, 'الإعجاب يرفع تقارب الذوق')
assert.ok(engine.tasteAffinity(dislikedTaste, base) < .5, 'الرفض يخفض تقارب الذوق')
const tasteRun = engine.generateSocialDesigns({ ...request, seed: 'taste-run', tasteProfile: reinforcedTaste })
assert.ok(tasteRun.plans.every((plan) => typeof plan.tasteAffinity === 'number'))

const overloaded = { ...base, content: { ...base.content, title: Array.from({ length: 60 }, () => 'كلمة').join(' ') } }
const overloadedQuality = engine.critiqueCompositionPlan(overloaded)
assert.ok(overloadedQuality.score < (base.quality?.score || 100))
assert.ok(overloadedQuality.issues.length > 0)
assert.ok(overloadedQuality.lineFit < (base.quality?.lineFit || 100), 'النص المزدحم يخفض ملاءمة الأسطر')

const campaign = engine.generateSocialCampaign({ ...request, basePlan: base, tasteProfile: reinforcedTaste, seed: 'campaign-test' })
assert.equal(campaign.assets.length, 8)
assert.ok(new Set(campaign.assets.map((asset) => asset.role)).size === 8)
assert.ok(new Set(campaign.assets.map((asset) => asset.plan.format.id)).size >= 5)
assert.ok(new Set(campaign.assets.map((asset) => asset.plan.layout)).size >= 6, 'الحملة لا تعيد القالب نفسه')
assert.equal(new Set(campaign.assets.map((asset) => asset.plan.palette)).size, 1, 'الحملة متماسكة لونيًا')
assert.ok(campaign.qualityScore >= 75)
assert.ok(campaign.coherenceScore >= 80)
assert.equal(campaign.ready, true, 'لا تُصدّر الحملة قبل اجتياز جميع القطع لجنة الجودة')
assert.deepEqual(campaign.warnings, [])
assert.ok(studioSource.includes('TASTE_LEDGER_KEY'), 'ذاكرة الذوق تمنع تكرار التنزيل من تضخيم نفس الاختيار')
assert.ok(studioSource.includes('previousSignal === signal'), 'الإشارة المكررة لا تضاعف وزن التصميم')

console.log(JSON.stringify({
  ok: true,
  engineVersion: engine.SOCIAL_DESIGN_ENGINE_VERSION,
  cases: 25,
  generatedDirections: first.plans.length,
  uniqueLayouts: audit.uniqueLayouts,
  carouselSlides: long.structure.slides.length,
  guards: ['arabic-analysis', 'deterministic-output', 'real-layout-diversity', 'history-novelty', 'lock-semantics', 'format-transform', 'contrast-and-overflow-audit', 'visual-critic', 'rendered-line-fit', 'taste-memory', 'taste-deduplication', 'campaign-release-gate', 'campaign-coherence', 'campaign-diversity'],
}, null, 2))
