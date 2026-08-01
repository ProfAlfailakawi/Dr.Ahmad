#!/usr/bin/env node
/**
 * حارس ثلاث علل شكا منها الدكتور في ١ أغسطس ٢٠٢٦:
 *
 *  ١ ــ «ولا الخطوط تعدلت» — أنماط الطباعة التسعة كانت تكتب وجه خطٍّ واحداً،
 *       والمنشور المستقل يثبّت مساراته كلها على نمطٍ واحد.
 *  ٢ ــ «مكرر نفس التصاميم لكل العناوين» — بصمة الفكرة كانت تحتكر الحوض
 *       فتخرج عناوينُ مختلفة بالقرارات البصرية نفسها حرفياً.
 *  ٣ ــ «الصورة ما لها علاقة بالكلام» — كلمةٌ عامة مكرّرة في تسع عبارات
 *       تمنح ٢٥ نقطة فتعبر الصورةُ غيرُ الصلة بوابةَ الترشيح.
 *
 * ويضيف عقد «مِسبَك التغريدات»: لا يُنسب إلى الدكتور ما ليس في متنه.
 *
 * التشغيل: node scripts/test-tweet-and-design-variety.mjs
 */
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const compile = async (path, replacements = {}) => {
  const source = await readFile(resolve(path), 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, strict: true },
    reportDiagnostics: true,
    fileName: resolve(path),
  })
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `${path} يجب أن يترجم بلا أخطاء`)
  let output = result.outputText
  for (const [specifier, url] of Object.entries(replacements)) output = output.replace(specifier, url)
  return `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
}

const glossaryJson = await readFile(resolve('src/data/dr-ahmad-domain-glossary.json'), 'utf8')
const glossarySource = (await readFile(resolve('src/lib/dr-ahmad-domain-glossary.ts'), 'utf8'))
  .replace("import glossaryData from '../data/dr-ahmad-domain-glossary.json'", `const glossaryData = ${glossaryJson}`)
const glossaryCompiled = ts.transpileModule(glossarySource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, strict: true },
  fileName: resolve('src/lib/dr-ahmad-domain-glossary.ts'),
})
const glossaryUrl = `data:text/javascript;base64,${Buffer.from(glossaryCompiled.outputText).toString('base64')}`
const ideaDnaUrl = await compile('src/lib/idea-dna.ts', { './dr-ahmad-domain-glossary': glossaryUrl })
const engineUrl = await compile('src/lib/social-design-engine.ts', { './dr-ahmad-domain-glossary': glossaryUrl, './idea-dna': ideaDnaUrl })
const engine = await import(engineUrl)
const rendererUrl = await compile('src/lib/social-design-renderer.ts', { './social-design-engine': engineUrl, './seasons': await compile('src/lib/seasons.ts') })
const renderer = await import(rendererUrl)
const echoesUrl = await compile('src/lib/voice-echoes.ts')
const forge = await import(await compile('src/lib/tweet-forge.ts', { './voice-echoes': echoesUrl }))

const guards = []
const guard = (name) => guards.push(name)

/* ═══ ١ ــ عقد الخطوط ═══════════════════════════════════════════════ */

const shippedFonts = new Set(['Tajawal', 'El Messiri'])
const fontFiles = await readdir(resolve('public/fonts'))
assert.ok(fontFiles.some((file) => /^tajawal-/.test(file)), 'Tajawal يجب أن يبقى في public/fonts')
assert.ok(fontFiles.some((file) => /^elmessiri-/.test(file)), 'El Messiri يجب أن يبقى في public/fonts')
const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'))
assert.ok(
  packageJson.dependencies?.['@fontsource-variable/alexandria'],
  'Alexandria Variable يجب أن يبقى في الاعتماديات وإلا سقط كل عنوانٍ إلى خط النظام',
)
shippedFonts.add('Alexandria Variable')

const families = Object.values(engine.TYPOGRAPHY_MODES)
for (const mode of families) {
  assert.ok(shippedFonts.has(mode.displayFamily), `نمط «${mode.label}» يطلب خطاً لا يملك المشروع ملفه: ${mode.displayFamily}`)
  assert.ok(shippedFonts.has(mode.bodyFamily), `متن نمط «${mode.label}» يطلب خطاً غير موجود: ${mode.bodyFamily}`)
  const maximum = engine.FONT_MAX_WEIGHT[mode.displayFamily] ?? 900
  assert.ok(mode.titleWeight <= maximum, `نمط «${mode.label}» يطلب وزناً ${mode.titleWeight} وأقصى المتاح ${maximum}`)
}
const distinctFaces = new Set(families.map((mode) => mode.displayFamily))
assert.ok(distinctFaces.size >= 3, `أنماط الطباعة يجب أن تحمل ثلاثة وجوهٍ مختلفة على الأقل، وجدنا ${distinctFaces.size} — هذه هي علّة «ولا الخطوط تعدلت»`)
guard('typography-uses-three-real-faces')

for (const family of shippedFonts) {
  const stack = engine.fontStack(family)
  assert.ok(stack.includes(','), `سلسلة ${family} يجب أن تحمل بديلاً واحداً على الأقل`)
  assert.ok(/sans-serif|serif/.test(stack), `سلسلة ${family} يجب أن تنتهي بعائلةٍ عامة`)
}
guard('font-stack-never-bare')

/* ═══ ٢ ــ تنوّع التصاميم بين العناوين ══════════════════════════════ */

const TITLES = [
  'التلعيب في التعليم',
  'الأسرة أول فصل دراسي',
  'ماذا يبقى من التعليم بعد الامتحان؟',
  'التقويم البديل في المدرسة الحديثة',
  'القراءة عادة تُبنى لا تُورث',
  'المعلم بين المهنة والرسالة',
]
const signatures = TITLES.map((title) => {
  const result = engine.generateSocialDesigns({ text: title, author: 'د. أحمد حسين الفيلكاوي', platform: 'instagram', count: 8 })
  return { title, plans: result.plans, key: result.plans.map((plan) => `${plan.layout}/${plan.palette}/${plan.typography}`).join('|') }
})
assert.equal(new Set(signatures.map((item) => item.key)).size, TITLES.length, 'عنوانان مختلفان لا يجوز أن يخرجا بالقرارات البصرية نفسها حرفياً')
const palettesSeen = new Set(signatures.flatMap((item) => item.plans.map((plan) => plan.palette)))
assert.ok(palettesSeen.size >= 8, `ستة عناوين يجب أن تُظهر ثماني لوحات لونٍ على الأقل، وجدنا ${palettesSeen.size}`)
const facesSeen = new Set(signatures.flatMap((item) => item.plans.map((plan) => engine.TYPOGRAPHY_MODES[plan.typography].displayFamily)))
assert.ok(facesSeen.size >= 2, 'يجب أن يظهر أكثر من وجه خطٍّ واحد عبر العناوين')
guard('titles-do-not-share-one-design')

/* المنشور المستقل: المسار الأول مثبّتٌ على الوجه النظيف، والثاني حرّ. */
const publishing = await readFile(resolve('src/components/admin/PublishingStudio.tsx'), 'utf8')
assert.match(publishing, /preferTypography: 'studio-clean'/, 'المسار الموجَّه يبقى على الوجه النظيف الذي اختاره الدكتور')
assert.match(publishing, /preferTypography: undefined/, 'المسار الاستكشافي يجب أن يبقى حراً في وجه الخط وإلا عادت الرؤى الثلاث بخطٍّ واحد')
guard('standalone-second-pass-free-typography')

/* الإنفوجرافيك لا يُقطّع عنواناً إلى «نقاط» من كلمةٍ واحدة. */
const fakePoints = engine.extractInfographicPoints('الأسرة أول فصل دراسي', 'الأسرة أول فصل دراسي', ['دراسي', 'أول', 'فصل'], 5)
assert.equal(fakePoints.length, 0, 'عنوانٌ من أربع كلمات لا يصلح قائمةَ إنفوجرافيك؛ الفراغ أصدق من قائمةٍ مصنوعة')
const realPoints = engine.extractInfographicPoints('أولاً: الوقت المدرسي مورد نادر\nثانياً: التغذية الراجعة تصنع الفرق\nثالثاً: الخطأ الآمن يصنع الجرأة', 'ثلاث ملاحظات', [], 5)
assert.ok(realPoints.length >= 3, 'البنود المرقّمة الحقيقية يجب أن تُستخرج كما هي')
guard('infographic-points-are-real')

/* اللوحات تُرسم فعلاً بسلسلة بدائل لا بعائلةٍ عارية. */
const svg = renderer.renderCompositionSvg(signatures[0].plans[0])
assert.ok(svg.includes('<text'), 'اللوحة يجب أن تحمل نصاً')
assert.doesNotMatch(svg, /font-family="(Alexandria Variable|El Messiri|Tajawal)"/, 'العائلة العارية سقوطٌ صامت إلى خط النظام؛ يجب أن تخرج بسلسلة بدائل')
guard('renderer-emits-font-stack')

/* ═══ ٣ ــ صلة الصورة الجاهزة بالنص ═════════════════════════════════ */

const visualSource = await readFile(resolve('src/lib/external-visual-sources.ts'), 'utf8')
assert.match(visualSource, /GENERIC_MATCH_TOKENS/, 'قائمة الكلمات العامة هي ما يمنع صورةً عامّة من اجتياز البوابة')
assert.match(visualSource, /Math\.min\(20,\s*qTerms\.reduce/, 'مكافأة المطابقة يجب أن تبقى مسقوفة وإلا عادت الكلمة المكرّرة ترفع الدرجة بلا حد')
assert.match(visualSource, /score = Math\.min\(score - 38, 58\)/, 'غياب المفهوم الأساسي يجب أن يسقّف الدرجة تحت عتبة القبول لا أن يُخصم منها فحسب')
assert.match(visualSource, /new Set\(\s*\n?\s*unique\(\[\.\.\.plan\.queries/, 'كلمات الاستعلام يجب أن تُفرَّد على مستوى الكلمة لا العبارة')
guard('ready-image-requires-real-concept')

/* ═══ ٤ ــ عقد مِسبَك التغريدات ═════════════════════════════════════ */

const BODY = 'التلعيب في التعليم ليس ترفيهاً يُضاف إلى الحصة بعد أن تنتهي. هو إعادةُ تصميمٍ لعلاقة الطالب بالمعرفة نفسها. يظن كثيرون أن اللعبة تُغري الطالب فيتعلم، والحقيقة أن اللعبة تصنع سياقاً يصير فيه الخطأ آمناً فيجرؤ الطالب على المحاولة. في أربعة صفوف جربنا هذا النموذج، وارتفع معدل المشاركة الصفية إلى 78% خلال فصل واحد. لكن الرقم وحده لا يكفي حجةً. ما تغيّر فعلاً أن الطالب صار يسأل قبل أن يُسأل. المدرسة التي تخاف من الخطأ تُنتج طالباً يخاف من السؤال. ولا يصنع الدافعية شعارٌ يُعلَّق على الجدار، بل تجربةٌ يعيشها الطالب في مقعده كل يوم.'
const source = { kind: 'article', id: 'gamification', title: 'التلعيب في التعليم', text: BODY, url: 'https://dr-alfailakawi.com/articles/gamification' }
const drafts = forge.buildTweets(source, { count: 10 })

assert.ok(drafts.length >= 5, `يجب أن تخرج خمس زوايا على الأقل من متنٍ كهذا، خرجت ${drafts.length}`)
assert.equal(new Set(drafts.map((draft) => draft.angle)).size, drafts.length, 'كل تغريدة من زاويةٍ مختلفة')
for (const draft of drafts) {
  assert.ok(draft.chars <= forge.TWEET_LIMIT, `تغريدة «${draft.angleLabel}» تجاوزت ${forge.TWEET_LIMIT} حرفاً`)
  if (draft.quoteVerified) assert.ok(BODY.includes(draft.quote), 'الجملة الموثّقة يجب أن تكون في المتن حرفاً بحرف')
}
guard('tweet-angles-are-distinct-and-within-limit')

/* البوّابة: لا يُنسب إليه ما ليس في متنه. */
const emptySource = { kind: 'free', id: 'empty', title: 'فكرة', text: '' }
for (const draft of forge.buildTweets(emptySource, { count: 6 })) {
  assert.equal(draft.quoteVerified, false, 'بلا متنٍ لا توجد جملةٌ موثّقة')
  assert.equal(draft.quote, '', 'بلا متنٍ لا يخرج اقتباس')
}
guard('no-quote-without-body')

/* لا سيرةً مخترعة: الإطار لا يدّعي واقعةً في حياة الدكتور. */
const FABRICATED = /(?:غيّرتُ رأيي|استغرقت سنوات|أعترف أنني|جرّبتُ بنفسي|حين كنت طالباً)/
for (const draft of drafts) {
  assert.doesNotMatch(draft.text, FABRICATED, `إطار «${draft.angleLabel}» يدّعي واقعةً في سيرة الدكتور لم يكتبها`)
}
guard('no-fabricated-biography')

/* لا اسمَ ذاتٍ يُعامَل معاملة المفهوم («أن نمارس الطالب»). */
for (const draft of drafts) {
  assert.doesNotMatch(draft.text, /(?:نمارس|ليس ما يبدو عليه)\s*(?:ه)?\b.*(?:الطالب|المعلم|الطفل)/, 'اسم الذات لا يُعامَل معاملة المفهوم')
}
guard('concept-hero-not-a-person')

/* التنويع: جولةٌ جديدة تعطي نصاً جديداً. */
const second = forge.buildTweets(source, { count: 10, variation: 1 })
assert.notEqual(drafts.map((draft) => draft.text).join('|'), second.map((draft) => draft.text).join('|'), '«تنويع جديد» يجب أن يغيّر النص فعلاً')
guard('variation-changes-output')

/* الخيط + التسليم إلى منشور مستقل. */
const thread = forge.buildThread(source)
assert.ok(thread && thread.tweets.length >= 4, 'الخيط يجب أن يخرج بأربع تغريداتٍ فأكثر من متنٍ كهذا')
for (const tweet of thread.tweets) assert.ok([...tweet].length <= forge.TWEET_LIMIT, 'كل تغريدةٍ في الخيط داخل الحد')
for (const draft of drafts) {
  assert.doesNotMatch(draft.standalonePost, /https?:\/\//, 'نص المنشور المستقل يخرج بلا روابط — التصميم لا يقرأ الروابط')
  assert.doesNotMatch(draft.standalonePost, /#\S/, 'نص المنشور المستقل يخرج بلا وسوم')
  assert.ok(draft.standalonePost.trim().length > 20, 'نص المنشور المستقل يجب ألا يكون فارغاً')
}
guard('standalone-handoff-is-clean')

/* الجسر بين الاستوديوين: حدثٌ يرسله استوديو التغريدات ويستقبله استوديو النشر. */
const tweetStudio = await readFile(resolve('src/components/admin/TweetStudio.tsx'), 'utf8')
assert.match(tweetStudio, /studio:standalone-seed/, 'استوديو التغريدات يرسل البذرة')
assert.match(publishing, /studio:standalone-seed/, 'استوديو النشر يستقبل البذرة وإلا ضاع زر «صمّمها في منشور مستقل»')
const navigation = await readFile(resolve('src/components/admin/admin-navigation.ts'), 'utf8')
assert.match(navigation, /tab: 'tweets'/, 'تبويب استوديو التغريدات يجب أن يبقى في سجل التنقل')
const admin = await readFile(resolve('src/pages/Admin.tsx'), 'utf8')
assert.match(admin, /tweets: <TweetStudio \/>/, 'التبويب يجب أن يملك شاشةً فعلية')
guard('tweet-studio-wired')

/* الكلمة الممنوعة في نصوص الواجهة (غير لائقة في الكويت). */
for (const file of [tweetStudio, await readFile(resolve('src/lib/tweet-forge.ts'), 'utf8')]) {
  assert.doesNotMatch(file, /صيدة|الصيد\b/, 'كلمة ممنوعة في نصوص الواجهة')
}
guard('banned-word-absent')

console.log(JSON.stringify({
  ok: true,
  forgeVersion: forge.TWEET_FORGE_VERSION,
  engineVersion: engine.SOCIAL_DESIGN_ENGINE_VERSION,
  distinctTypefaces: distinctFaces.size,
  palettesAcrossTitles: palettesSeen.size,
  tweetsBuilt: drafts.length,
  guards,
}, null, 2))
