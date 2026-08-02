#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const sourcePath = resolve('src/lib/social-design-engine.ts')
const source = await readFile(sourcePath, 'utf8')
const studioSource = await readFile(resolve('src/components/admin/SocialDesignStudio.tsx'), 'utf8')
const rendererSource = await readFile(resolve('src/lib/social-design-renderer.ts'), 'utf8')
const publishingSource = await readFile(resolve('src/components/admin/PublishingStudio.tsx'), 'utf8')
const visualDnaSource = await readFile(resolve('src/lib/visual-dna.ts'), 'utf8')
const glossaryPath = resolve('src/lib/dr-ahmad-domain-glossary.ts')
const glossaryJson = await readFile(resolve('src/data/dr-ahmad-domain-glossary.json'), 'utf8')
const glossarySource = (await readFile(glossaryPath, 'utf8'))
  .replace(/^import\s+glossaryData\s+from\s+['\"]\.\.\/data\/dr-ahmad-domain-glossary\.json['\"][^\n]*$/m, `const glossaryData = ${glossaryJson}`)
const glossaryCompiled = ts.transpileModule(glossarySource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, strict: true },
  reportDiagnostics: true,
  fileName: glossaryPath,
})
assert.equal((glossaryCompiled.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0, 'قاموس التخصص يجب أن يترجم بلا أخطاء')
const glossaryDataUrl = `data:text/javascript;base64,${Buffer.from(glossaryCompiled.outputText).toString('base64')}`
const ideaDnaPath = resolve('src/lib/idea-dna.ts')
const ideaDnaSource = await readFile(ideaDnaPath, 'utf8')
const ideaDnaCompiled = ts.transpileModule(ideaDnaSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, strict: true },
  reportDiagnostics: true,
  fileName: ideaDnaPath,
})
assert.equal((ideaDnaCompiled.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0, 'بصمة الفكرة يجب أن تترجم بلا أخطاء')
const ideaDnaOutput = ideaDnaCompiled.outputText.replace('./dr-ahmad-domain-glossary', glossaryDataUrl)
const ideaDnaDataUrl = `data:text/javascript;base64,${Buffer.from(ideaDnaOutput).toString('base64')}`
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
const engineOutput = compiled.outputText
  .replace('./dr-ahmad-domain-glossary', glossaryDataUrl)
  .replace('./idea-dna', ideaDnaDataUrl)
const engine = await import(`data:text/javascript;base64,${Buffer.from(engineOutput).toString('base64')}`)

const virtualReality = engine.analyzeSocialContent('الواقع الافتراضي')
assert.notEqual(virtualReality.topic, 'general', 'المصطلح التخصصي المعروف في القاموس المركزي لا يسقط إلى «عام»')

const question = engine.analyzeSocialContent('كيف نقيس التعلم دون أن نحول الطالب إلى رقم؟')
assert.equal(question.primaryKind, 'provocative-question')
assert.equal(question.topic, 'education')
assert.ok(question.structure.heroWord)

const questionWithExplanation = engine.analyzeSocialContent('هل أحتاجه فعلاً؟ ليست كل رغبة حاجة، ولا كل قدرة على الشراء سبباً للشراء.')
assert.equal(questionWithExplanation.structure.title, 'هل أحتاجه فعلاً؟')
assert.match(questionWithExplanation.structure.subtitle, /ليست كل رغبة/)

const lecture = engine.analyzeSocialContent('محاضرة: الذكاء الاصطناعي في التعليم بين الفرص والمخاطر. الأربعاء الساعة 7 مساءً. سجّل الآن.')
assert.equal(lecture.primaryKind, 'lecture')
assert.ok(lecture.recommendedFormats.some((item) => item.format === 'story'))
assert.ok(lecture.structure.cta)

const parsedBrief = engine.parseStudioCommand('أبي منشور مجلاتي باللون أحمر للجمهور المعلمين عن مستقبل التعلم الساعة ٣ بتوقيت الكويت')
assert.equal(parsedBrief.styleRoute, 'editorial')
assert.equal(parsedBrief.preferLayout, 'editorial-axis')
assert.equal(parsedBrief.preferPalette, 'museum-red')
assert.equal(parsedBrief.audienceHint, 'المعلمين')
assert.equal(parsedBrief.timeZone, 'Asia/Kuwait')
assert.match(parsedBrief.content, /مستقبل التعلم/)
assert.doesNotMatch(parsedBrief.content, /للجمهور|بتوقيت الكويت|باللون/)
assert.ok(parsedBrief.confidence >= .9, 'فهم العبارة المركبة يجب أن يعلن ثقة عالية')

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
assert.equal(first.plans.length, 4)
assert.equal(first.generation.requestedCount, 8)
assert.equal(new Set(first.plans.map((plan) => plan.layout)).size, 4, 'أقوى أربعة يجب أن تبقى مختلفة في منطق التكوين')
assert.equal(new Set(first.plans.map((plan) => plan.fingerprint)).size, 4)
assert.ok(first.plans.every((plan) => engine.validateCompositionPlan(plan).every((issue) => issue.severity !== 'error')))

const paletteDirected = engine.generateSocialDesigns({
  ...request,
  seed: 'explicit-palette-brief',
  preferPalette: 'electric-cobalt',
})
assert.ok(paletteDirected.plans.every((plan) => plan.palette === 'electric-cobalt'), 'أمر اللون الصريح يجب أن يحكم كل الاتجاهات')
const shortBriefDirections = engine.generateSocialDesigns({ text: 'فكرة قصيرة تستحق أن تُقال الآن', seed: 'short-brief-directions' })
assert.ok(shortBriefDirections.plans.length >= 3, 'حتى العبارة القصيرة يجب أن تمنح المخرج ثلاث رؤى قابلة للمقارنة')

assert.equal(engine.TYPOGRAPHY_MODES['studio-clean']?.displayFamily, 'Alexandria Variable', 'المنشور المستقل يملك وجهاً عربياً معاصراً مستقلاً عن El Messiri مع Alexandria Variable')
const standaloneTypography = engine.generateSocialDesigns({ ...request, seed: 'standalone-clean-type', preferTypography: 'studio-clean' })
assert.ok(standaloneTypography.plans.every((plan) => plan.typography === 'studio-clean'), 'المخرج المستقل يفرض الخط العربي النظيف على كل الرؤى')
assert.ok(publishingSource.includes("preferTypography: 'studio-clean'"), 'مسار المنشور المستقل نفسه يطلب الخط الجديد صراحةً')

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
assert.equal(audit.uniqueLayouts, 4)
assert.equal(audit.uniqueFingerprints, 4)
assert.ok(first.plans.every((plan) => plan.quality?.score >= 68), 'الناقد البصري لا يعرض اتجاهاً ضعيفاً')
assert.ok(first.plans.every((plan) => (plan.quality?.lineFit || 0) >= 76), 'الناقد يفحص عدد الأسطر الفعلي لا عدد الكلمات فقط')
assert.ok(first.generation.candidateCount >= 32)
assert.ok(first.generation.averageQuality >= 70)

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
const professionalBase = engine.professionalReleaseGate(base)
const professionalOverloaded = engine.professionalReleaseGate(overloaded)
assert.ok(professionalBase.score >= 70)
assert.equal(professionalOverloaded.ready, false, 'عين المصمم تمنع تسليم التكوين المزدحم')
assert.ok(professionalOverloaded.score < professionalBase.score)
assert.ok(['masterpiece', 'professional', 'publishable', 'rejected'].includes(professionalBase.tier))

const campaign = engine.generateSocialCampaign({ ...request, basePlan: base, tasteProfile: reinforcedTaste, seed: 'campaign-test' })
assert.equal(campaign.assets.length, 8)
assert.ok(new Set(campaign.assets.map((asset) => asset.role)).size === 8)
assert.ok(campaign.assets.some((asset) => asset.role === 'closing'))
assert.ok(new Set(campaign.assets.map((asset) => asset.plan.format.id)).size >= 5)
assert.ok(new Set(campaign.assets.map((asset) => asset.plan.layout)).size >= 6, 'الحملة لا تعيد القالب نفسه')
assert.equal(new Set(campaign.assets.map((asset) => asset.plan.palette)).size, 1, 'الحملة متماسكة لونياً')
assert.ok(campaign.qualityScore >= 75)
assert.ok(campaign.coherenceScore >= 80)
assert.equal(campaign.ready, true, 'لا تُصدّر الحملة قبل اجتياز جميع القطع لجنة الجودة')
assert.deepEqual(campaign.warnings, [])
assert.ok(studioSource.includes('TASTE_LEDGER_KEY'), 'ذاكرة الذوق تمنع تكرار التنزيل من تضخيم نفس الاختيار')
assert.ok(studioSource.includes('previousSignal === signal'), 'الإشارة المكررة لا تضاعف وزن التصميم')
assert.ok(studioSource.includes('اسم المؤلف / التوقيع') && studioSource.includes('المصدر / النطاق') && studioSource.includes('إخفاء المصدر'), 'المحرر المباشر يتيح تعديل أو إخفاء النصوص الثانوية والهوية')
assert.ok(rendererSource.includes('sourceHidden') && rendererSource.includes('authorHidden') && rendererSource.includes('s.source ? textBlock'), 'الرسم النهائي يحترم إخفاء التوقيع والمصدر ولا يعيد نصاً ثابتاً')
assert.ok(visualDnaSource.includes('contrast(candidate, background) < 4.5'), 'البصمة البصرية تفرض تبايناً عملياً أقوى مع الخلفية')

console.log(JSON.stringify({
  ok: true,
  engineVersion: engine.SOCIAL_DESIGN_ENGINE_VERSION,
  cases: 42,
  generatedDirections: first.plans.length,
  uniqueLayouts: audit.uniqueLayouts,
  carouselSlides: long.structure.slides.length,
  guards: ['domain-glossary-bridge', 'arabic-analysis', 'compound-phrase-brief', 'explicit-palette-sovereignty', 'kuwait-timezone', 'deterministic-output', 'real-layout-diversity', 'history-novelty', 'lock-semantics', 'format-transform', 'contrast-and-overflow-audit', 'visual-critic', 'professional-release-gate', 'rendered-line-fit', 'taste-memory', 'taste-deduplication', 'campaign-release-gate', 'campaign-coherence', 'campaign-diversity', 'standalone-clean-typography', 'editable-secondary-text', 'image-derived-contrast'],
}, null, 2))
