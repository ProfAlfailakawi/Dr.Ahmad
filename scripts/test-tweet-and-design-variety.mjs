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
const resonanceUrl = await compile('src/lib/resonance-quotes.ts')
const forge = await import(await compile('src/lib/tweet-forge.ts', { './dr-ahmad-domain-glossary': glossaryUrl, './voice-echoes': echoesUrl, './resonance-quotes': resonanceUrl }))

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

/* ═══ ٥ ــ دفتر «ما نُشر» وخطة الأسبوع ═════════════════════════════ */

const mem = await import(await compile('src/lib/tweet-memory.ts', { './tweet-forge': await compile('src/lib/tweet-forge.ts', { './dr-ahmad-domain-glossary': glossaryUrl, './voice-echoes': echoesUrl, './resonance-quotes': resonanceUrl }) }))

let ledger = mem.createEmptyTweetMemory()
const hook = () => ({
  isPublished: (text) => mem.isPublished(ledger, text),
  affinity: (draft) => mem.tweetTasteAffinity(ledger.taste, draft),
})

/* البصمة تكشف الإعادة ولو بوسمٍ مختلفٍ أو نقطةٍ زائدة. */
const base = 'المدرسة التي تخاف من الخطأ تُنتج طالباً يخاف من السؤال.'
assert.equal(mem.tweetFingerprint(base), mem.tweetFingerprint(`${base}\n\n#التعليم`), 'الوسم لا يصنع تغريدةً جديدة')
assert.equal(mem.tweetFingerprint(base), mem.tweetFingerprint(`${base} https://dr-alfailakawi.com/x`), 'الرابط لا يصنع تغريدةً جديدة')
assert.notEqual(mem.tweetFingerprint(base), mem.tweetFingerprint('المدرسة التي تحتفي بالخطأ تصنع طالباً يجرؤ.'), 'نصّان مختلفان بصمتان مختلفتان')
guard('fingerprint-ignores-links-and-hashtags')

/* ما نُشر لا يعود أبداً. */
const round1 = forge.buildTweets(source, { count: 10, memory: hook() })
assert.ok(round1.length >= 5, 'الجولة الأولى تعطي خمساً فأكثر')
for (let index = 0; index < 5; index += 1) {
  const pool = forge.buildTweets(source, { count: 10, memory: hook() })
  if (!pool.length) break
  ledger = mem.recordPublishedTweet(ledger, pool[0], new Date(2026, 7, 1 + index))
}
assert.equal(ledger.records.length, 5, 'خمسُ تغريداتٍ في الدفتر')
const round2 = forge.buildTweets(source, { count: 10, memory: hook() })
assert.ok(round2.every((draft) => !mem.isPublished(ledger, draft.text)), 'تغريدةٌ نُشرت لا تُعرض ثانيةً')
assert.ok(round2.length < round1.length, 'الحوض يتقلّص بما نُشر')
guard('published-tweets-never-return')

/* التراجع يعيدها ويخفض وزنها — الخطأ في النقر وارد. */
const firstId = ledger.records[0].id
const undone = mem.forgetPublishedTweet(ledger, firstId)
assert.equal(undone.records.length, 4, 'التراجع يحذف السجل')
assert.equal(undone.taste.samples, 4, 'التراجع يخفض العيّنات')
guard('undo-restores-tweet')

/* الذوق يتعلّم — ولا يحكم قبل خمس عيّنات. */
assert.equal(mem.tweetTasteAffinity(mem.createEmptyTweetMemory().taste, { angle: 'paradox', sourceKind: 'article', chars: 200 }), 0, 'دفترٌ فارغ لا رأي له')
assert.ok(ledger.taste.samples >= 5, 'بلغ الذوق عتبة التعلّم')
assert.ok(mem.tasteHighlights(ledger.taste, (angle) => forge.TWEET_ANGLES[angle].label).length >= 2, 'الذوق يُفصح عن نفسه للدكتور')
guard('taste-learns-after-five-samples')

/* الدمج بين جهازين عديم الأثر عند تكراره. */
const mergedOnce = mem.mergeTweetMemories(ledger, ledger)
const mergedTwice = mem.mergeTweetMemories(mergedOnce, ledger)
assert.equal(mergedOnce.records.length, ledger.records.length, 'الدمج لا يضاعف السجلات')
assert.equal(mergedTwice.taste.samples, mergedOnce.taste.samples, 'الدمج المتكرر لا يضاعف الذوق')
guard('memory-merge-is-idempotent')

/* خطة الأسبوع: سبعةُ أيامٍ بمصادر وزوايا مختلفة. */
const weekSources = Array.from({ length: 12 }, (_, index) => ({
  kind: index === 0 ? 'news' : 'article',
  id: `week-${index}`,
  title: `مادة ${index} في التعليم`,
  text: BODY.replace('التلعيب', `المحور ${index}`),
  url: `https://dr-alfailakawi.com/a/${index}`,
}))
const plan = forge.buildWeeklyTweetPlan(weekSources, { startDate: new Date(2026, 7, 1), memory: hook(), occasionOf: () => null })
assert.equal(plan.days.length, 7, 'الخطة سبعةُ أيام')
assert.equal(plan.filled, 7, `المادةُ وفيرة فلا يجوز أن يبقى يومٌ فارغاً — امتلأ ${plan.filled} فقط`)
const planSources = plan.days.filter((day) => day.draft).map((day) => day.draft.sourceId)
assert.equal(new Set(planSources).size, planSources.length, 'لا تتكرر مادةٌ في الأسبوع الواحد')
const planAngles = plan.days.filter((day) => day.draft).map((day) => day.draft.angle)
assert.ok(new Set(planAngles).size >= 5, `الأسبوع يحتاج خمس زوايا مختلفة على الأقل، وجدنا ${new Set(planAngles).size}`)
assert.ok(plan.days[0].draft?.sourceKind === 'news', 'الخبر الراهن يتصدّر — لأنه يفسد بالتأجيل')
assert.ok(plan.days.every((day) => day.reason.trim().length > 10), 'كل يومٍ يقول سببه — ولو كان فراغاً')
guard('weekly-plan-fills-seven-distinct-days')

/* التهدئة: مادةٌ نُشرت أمس لا تعود هذا الأسبوع. */
const cooled = forge.buildWeeklyTweetPlan(weekSources, {
  startDate: new Date(2026, 7, 1),
  memory: hook(),
  daysSinceSource: (id) => (id === 'week-3' ? 2 : null),
})
assert.ok(cooled.days.every((day) => day.draft?.sourceId !== 'week-3'), 'المادة المنشورة قبل يومين لا تعود')
assert.ok(cooled.skipped.some((line) => line.includes('مادة 3')), 'الاستبعاد يُعلَن للدكتور لا يُخفى')
guard('cooldown-is-announced-not-silent')

/* ═══ ٦ ــ رنين القرّاء ═════════════════════════════════════════════ */

const resonance = await import(resonanceUrl)

const RESONANT_LINE = 'المدرسة التي تخاف من الخطأ تُنتج طالباً يخاف من السؤال'
const articleBody = `فقرةٌ أولى لا يظلّلها أحد.\n\n${RESONANT_LINE}. وجملةٌ أخرى بعدها في الفقرة نفسها.`
const paragraphTwo = articleBody.split('\n\n')[1]
const rows = [
  { slug: 'gam', paragraph: 1, startOffset: 0, endOffset: RESONANT_LINE.length, count: 7 },
  { slug: 'gam', paragraph: 9, startOffset: 0, endOffset: 40, count: 99 },
  { slug: 'ghost', paragraph: 0, startOffset: 0, endOffset: 40, count: 50 },
  { slug: 'gam', paragraph: 1, startOffset: 0, endOffset: 4, count: 30 },
]
const quotes = resonance.resolveResonantQuotes(rows, [{ slug: 'gam', title: 'التلعيب في التعليم', body: articleBody }])
assert.equal(quotes.length, 1, `صفٌّ واحدٌ فقط صالح؛ خرج ${quotes.length}`)
assert.equal(quotes[0].text, RESONANT_LINE, 'الاقتباس يُقتطع من المتن بالإزاحات المسجّلة حرفاً بحرف')
assert.ok(paragraphTwo.includes(quotes[0].text), 'ولا يخرج حرفٌ ليس في المتن')
assert.equal(quotes[0].count, 7, 'العدد يُنقل كما هو')
guard('resonance-resolves-only-valid-rows')

/* المطابقة تتسامح مع الترقيم والتشكيل. */
assert.equal(resonance.resonanceCountOf(`${RESONANT_LINE}.`, [{ text: RESONANT_LINE, count: 7 }]), 7, 'النقطة الأخيرة لا تكسر المطابقة')
assert.equal(resonance.resonanceCountOf('جملةٌ لا صلة لها', [{ text: RESONANT_LINE, count: 7 }]), 0, 'ولا تطابق ما ليس منها')
guard('resonance-match-tolerates-punctuation')

/* الرنين يتصدّر ويُكافأ بالدرجة. */
const withEcho = forge.buildTweets({ ...source, resonantLines: [{ text: RESONANT_LINE, count: 7 }] }, { count: 10 })
const echoed = withEcho.filter((draft) => draft.resonanceCount)
assert.ok(echoed.length > 0, 'التغريدات المبنيّة على جملةٍ ظلّلها القرّاء تحمل عددها')
assert.equal(echoed[0].resonanceCount, 7, 'العدد يصل إلى التغريدة')
assert.ok(
  echoed[0].signals.some((signal) => signal.label.includes('ظلّله') && signal.weight >= 8),
  'إشارة الرنين يجب أن تظهر في أسباب الدرجة بوزنٍ يليق بدليلٍ من الواقع',
)
const plain = forge.buildTweets(source, { count: 10 })
const sameAngle = plain.find((draft) => draft.angle === echoed[0].angle)
if (sameAngle) assert.ok(echoed[0].score >= sameAngle.score, 'الزاوية نفسها تعلو حين تُبنى على جملةٍ ظلّلها القرّاء')
guard('resonant-lines-lead-and-score-higher')

/* غياب الرنين لا يكسر شيئاً — الأرشيف كله يبقى متاحاً. */
assert.ok(forge.buildTweets({ ...source, resonantLines: [] }, { count: 6 }).length >= 5, 'بلا رنينٍ يعمل المسبك كما كان')
guard('resonance-is-optional')

/* ═══ ٧ ــ المعجم يغذّي التغريدات ══════════════════════════════════ */

const glossaryDraft = forge.buildTweets(
  { kind: 'article', id: 'taqweem', title: 'التقويم البديل في المدرسة الحديثة', text: 'التقويم البديل ليس بديلاً عن الامتحان بل عن فلسفته. الامتحان يسأل: ماذا تحفظ؟ والتقويم البديل يسأل: ماذا تستطيع أن تفعل بما تعرف؟ في تجربتنا تحوّل الطالب من متلقٍّ إلى صانع.' },
  { count: 6, withHashtags: true },
)
const glossaryTags = [...new Set(glossaryDraft.flatMap((draft) => draft.hashtags))]
assert.ok(
  glossaryTags.some((tag) => tag.includes('التقويم')),
  `وسوم مادةٍ عن التقويم البديل يجب أن تحمل مصطلحه من معجمه، خرجت: ${glossaryTags.join(' ')}`,
)
assert.ok(
  glossaryDraft.some((draft) => draft.text.includes('التقويم البديل')),
  'المصطلح المعياري من المعجم يجب أن يظهر في الأطر لا الكلمة المبتورة',
)
guard('glossary-drives-hero-and-hashtags')

/* والعتبة تمنع المطابقة الجزئية من اختراع مفهومٍ لا وجود له في النص. */
const familyTagsGlossary = forge.buildTweets(
  { kind: 'free', id: 'fam2', title: 'الأسرة أول فصل دراسي', text: 'الأسرة أول فصل دراسي في حياة الطفل. البيت الذي يقرأ يصنع قارئاً. ولا تُبنى القيم بالمحاضرة بل بما يراه الطفل كل يوم في بيته.' },
  { count: 4, withHashtags: true },
).flatMap((draft) => draft.hashtags)
assert.ok(
  !familyTagsGlossary.some((tag) => tag.includes('رقمي') || tag.includes('الرقمية')),
  `نصٌّ أسريٌّ لا رقمَ فيه لا يجوز أن يحمل وسماً رقمياً (مطابقةٌ جزئية)، خرجت: ${[...new Set(familyTagsGlossary)].join(' ')}`,
)
guard('glossary-threshold-blocks-partial-match')

/* ═══ ٨ ــ حلقة الصدق: الدرجة تُعايَر بالواقع ══════════════════════ */

const outcomeRecord = (index, keys, likes) => ({
  id: `cal-${index}`,
  excerpt: `تغريدة ${index}`,
  angle: 'paradox',
  sourceId: `src-${index}`,
  sourceKind: 'article',
  sourceTitle: `مادة ${index}`,
  publishedAt: new Date(2026, 6, 1 + index).toISOString(),
  score: 80,
  chars: 200,
  hadHashtags: false,
  signalKeys: keys,
  outcome: { impressions: 1000, likes, reposts: 0, replies: 0, recordedAt: new Date(2026, 6, 20).toISOString() },
})

/* لا معايرة قبل العتبة — الصمت أصدق من رقمٍ بلا سند. */
const tooFew = Array.from({ length: 5 }, (_, index) => outcomeRecord(index, ['hook'], 90))
assert.equal(mem.buildSignalCalibration(tooFew).length, 0, `دون ${mem.MIN_OUTCOME_SAMPLES} تغريداتٍ بأرقام لا يجوز أن تُعايَر إشارة`)
guard('no-calibration-below-sample-floor')

/* ولا لإشارةٍ يقلّ أحد جانبيها عن ثلاث. */
const lopsided = [
  ...Array.from({ length: 9 }, (_, index) => outcomeRecord(index, ['turn'], 50)),
  outcomeRecord(20, ['hook', 'turn'], 90),
]
assert.ok(
  !mem.buildSignalCalibration(lopsided).some((item) => item.key === 'hook'),
  'إشارةٌ ظهرت مرةً واحدة لا تُعايَر مهما كثرت العيّنة الكلية',
)
guard('no-calibration-without-both-sides')

/* وحين تكفي العيّنة: الأثر يُكتشف باتجاهه الصحيح، ويُغيّر الدرجة فعلاً. */
const balanced = [
  ...Array.from({ length: 5 }, (_, index) => outcomeRecord(index, ['hook', 'turn'], 90)),
  ...Array.from({ length: 5 }, (_, index) => outcomeRecord(10 + index, ['no-hook', 'turn'], 30)),
]
const calibrations = mem.buildSignalCalibration(balanced)
const hookCalibration = calibrations.find((item) => item.key === 'hook')
assert.ok(hookCalibration, 'الإشارة ذات العيّنة الكافية يجب أن تُعايَر')
assert.ok(hookCalibration.lift > 2, `الخطّاف ضاعف التفاعل ثلاثاً فيجب أن يُكتشف، وجدنا ${hookCalibration.lift}`)
assert.ok(hookCalibration.multiplier <= 1.5 && hookCalibration.multiplier >= 0.6, 'المُضاعِف محصورٌ في [0.6, 1.5] — الواقع يعدّل تقديري ولا يلغيه')
const negative = calibrations.find((item) => item.key === 'no-hook')
assert.ok(negative && negative.multiplier < 1, 'والإشارة التي أضرّت يجب أن ينخفض مُضاعِفها')

const probeText = 'هل نصنع الدافعية أم نتوارثها؟\n\nلا يصنعها شعارٌ يُعلَّق على الجدار، بل تجربةٌ يعيشها الطالب.'
const plainScore = forge.scoreTweet(probeText)
const tunedScore = forge.scoreTweet(probeText, { calibration: mem.calibrationMap(calibrations) })
assert.ok(tunedScore.score > plainScore.score, `المعايرة يجب أن تحرّك الدرجة فعلاً (${plainScore.score} → ${tunedScore.score})`)
const tunedHook = tunedScore.signals.find((signal) => signal.key === 'hook')
assert.ok(tunedHook?.baseWeight != null && tunedHook.weight > tunedHook.baseWeight, 'والإشارة المعايَرة تُظهر وزنها الأصلي كي يرى الدكتور ما تغيّر')
guard('calibration-learns-and-shows-its-work')

/* لكل إشارةٍ مفتاحٌ ثابت — بلا ذلك تعذّرت المعايرة أصلاً. */
const keyedSignals = forge.scoreTweet(probeText, { resonance: 7 }).signals
assert.ok(keyedSignals.every((signal) => signal.key && !/\d/.test(signal.key)), 'كل إشارةٍ تحمل مفتاحاً ثابتاً لا رقم فيه')
assert.equal(new Set(keyedSignals.map((signal) => signal.key)).size, keyedSignals.length, 'ولا يتكرر مفتاحان في تغريدةٍ واحدة')
guard('signal-keys-are-stable')

/* الأرقام تُسجَّل وتُمحى بيد الدكتور. */
let outcomeLedger = mem.createEmptyTweetMemory()
outcomeLedger = mem.recordPublishedTweet(outcomeLedger, round1[0], new Date(2026, 7, 1))
const outcomeId = outcomeLedger.records[0].id
assert.ok((outcomeLedger.records[0].signalKeys || []).length > 0, 'مفاتيح الإشارات تُحفظ ساعة النشر وإلا تعذّرت المعايرة لاحقاً')
outcomeLedger = mem.recordTweetOutcome(outcomeLedger, outcomeId, { impressions: 900, likes: 30, reposts: 6 }, new Date(2026, 7, 3))
assert.equal(mem.outcomeCount(outcomeLedger), 1, 'الأرقام تُسجَّل')
assert.ok(mem.engagementOf(outcomeLedger.records[0]) > 0, 'ويُحسب منها تفاعل')
outcomeLedger = mem.recordTweetOutcome(outcomeLedger, outcomeId, null, new Date())
assert.equal(mem.outcomeCount(outcomeLedger), 0, 'وتُمحى بأمره')
guard('outcome-recorded-and-erasable')

/* إعادة النشر أثقل من الإعجاب — لأن الدكتور طلب ما يُعاد تغريده. */
const likeHeavy = { ...outcomeRecord(1, [], 0), outcome: { impressions: 1000, likes: 30, reposts: 0, replies: 0, recordedAt: '' } }
const repostHeavy = { ...outcomeRecord(2, [], 0), outcome: { impressions: 1000, likes: 10, reposts: 10, replies: 0, recordedAt: '' } }
assert.ok(mem.engagementOf(repostHeavy) > mem.engagementOf(likeHeavy), 'عشرُ إعاداتٍ أثقل من ثلاثين إعجاباً')
guard('reposts-weigh-more-than-likes')

/* استوديو التصاميم واستوديو التغريدات على محلّلٍ واحد. */
const designStudio = await readFile(resolve('src/components/admin/SocialDesignStudio.tsx'), 'utf8')
assert.match(designStudio, /resolveResonantQuotes/, 'استوديو التصاميم يجب أن يستعمل المحلّل المشترك لا نسخةً ثانية')
assert.doesNotMatch(designStudio, /paragraph\.slice\(Number\(row\.startOffset/, 'ولا تبقى فيه نسخةٌ يدويةٌ من الاقتطاع تتباعد عن الأصل')
guard('one-resonance-resolver-for-both-studios')

/* الكلمة المحورية تخرج بلا سابقةٍ ملتصقة: «بالمعرفة» كانت تصير «نتحدث عن بالمعرفة». */
for (const draft of drafts) {
  assert.doesNotMatch(draft.text, /(?:عن|في|إلى)\s+[بكل]ال\p{L}+/u, `إطار «${draft.angleLabel}» يحمل كلمةً محوريةً بسابقةٍ ملتصقة`)
}
guard('hero-word-has-no-clitic')

/* الوسوم مشتقّةٌ من الفكرة لا من حوضٍ ثابت. */
const tagged = forge.buildTweets(source, { count: 6, withHashtags: true })
const allTags = [...new Set(tagged.flatMap((draft) => draft.hashtags))]
assert.ok(allTags.length > 0, 'عند طلب الوسوم يجب أن تخرج وسوم')
assert.ok(allTags.every((tag) => tag.startsWith('#') && !/\s/.test(tag)), 'الوسم كلمةٌ واحدةٌ تبدأ بمربّع')
for (const draft of tagged) assert.ok(draft.hashtags.length <= 2, 'وسمان على الأكثر — الزيادة تخفض الوصول')
assert.ok(
  allTags.some((tag) => /التلعيب|الدافعية/.test(tag)),
  `وسوم فكرةٍ عن التلعيب يجب أن تلامس موضوعها، خرجت: ${allTags.join(' ')}`,
)
const familyTags = forge.buildTweets(
  { kind: 'free', id: 'family', title: 'الأسرة أول فصل دراسي', text: 'الأسرة أول فصل دراسي في حياة الطفل. البيت الذي يقرأ يصنع قارئاً، والبيت الذي يسأل يصنع سائلاً. لا تُبنى القيم بالمحاضرة بل بما يراه الطفل كل يوم.' },
  { count: 4, withHashtags: true },
).flatMap((draft) => draft.hashtags)
assert.ok(
  familyTags.some((tag) => /الأسرة|التربية|الطفولة/.test(tag)) && !familyTags.some((tag) => /التلعيب/.test(tag)),
  `وسوم فكرةٍ أسرية يجب أن تختلف عن وسوم التلعيب، خرجت: ${[...new Set(familyTags)].join(' ')}`,
)
guard('hashtags-derived-from-content')

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
assert.match(tweetStudio, /يفحص المسبك أربع عشرة زاويةً بلاغيةً ثم يعرض أقوى عشر/, 'الوعد الظاهر يطابق المحرك: يفحص 14 ويعرض أقوى 10')
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
