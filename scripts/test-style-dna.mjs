#!/usr/bin/env node
/**
 * حَكَمُ الأسلوب — الاختبار الذي يُثبت أن المقال يُكتب بأسلوبه لا بأسلوب نموذج.
 *
 * البرهان في خمس طبقات:
 *   ١) المسطرة صادقة: مقالاته الـ١٤٣ نفسها تعبر بوسيطٍ عالٍ — بلا هذا الشرط
 *      يكون الحَكَم ذوقاً يرفض صاحب الأسلوب.
 *   ٢) المسطرة تفرز: القالبُ الذي كان يُسلَّم للدكتور ومقالُ نموذجٍ عام يسقطان
 *      بفارقٍ واسع، والقالب يُضبط متلبّساً بالنقل الحرفي من أرشيفه.
 *   ٣) الصقل الحتمي لا يخترع: لا كلمة تُضاف ولا تُحذف؛ ترقيمٌ وفواصل فقط.
 *   ٤) المحرك يتعلّم من الحَكَم: نموذجٌ وهميّ يبدأ ركيكاً ثم يتحسّن حين تصله
 *      أرقام النقص، فيرتفع المسلَّم فعلاً لا بإعادة محاولةٍ عمياء.
 *   ٥) المصادر نظيفة: لا حشوٌ مُعلَّب ولا قالبُ فراغاتٍ باقٍ في الاستوديو.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const {
  BANNED_PHRASES, arabicCountPhrase, articleMetrics, calibrateStyle, countWords, judgeNaturalness, judgeStyle, measureStyleDna, percentileRank,
  PROOFREAD_INSTRUCTION, acceptProofread, bareText, buildOrthographyIndex, deriveExcerpt,
  extractVoiceSignature, liftPauses, locateIssues, orthographySlips, polishTypography, refineToStyle,
  sentencesOf, styleBrief, unsupportedClaims, verbatimOverlap, withVoiceMemory, openingMove, OPENING_MOVES,
} = await import(resolve(root, 'src/lib/style-dna.mjs'))

const bodies = JSON.parse(readFileSync(resolve(root, 'src/data/bodies.json'), 'utf8'))
const archive = Object.entries(bodies)
  .filter(([, body]) => typeof body === 'string' && body.trim().length > 200)
  .map(([slug, body]) => ({ slug, body }))

assert.ok(archive.length >= 100, `أرشيف المتون حاضر (${archive.length} مقالاً)`)
const dna = measureStyleDna(archive)
assert.ok(dna && dna.perArticle && dna.perArticle.ellipsisPer100, 'البصمة تُقاس ومعها مسطرة التوزيعات')

/* ─── ١) المسطرة صادقة على صاحبها ─── */
const ownScores = archive.map((item) => judgeStyle(item.body, dna).score).sort((left, right) => left - right)
const median = ownScores[Math.floor(ownScores.length / 2)]
const average = ownScores.reduce((sum, value) => sum + value, 0) / ownScores.length
const passRate = archive.filter((item) => judgeStyle(item.body, dna).ready).length / archive.length
assert.ok(median >= 85, `وسيط مقالاته ${median}٪ — المسطرة لا ترفض صاحبها`)
assert.ok(average >= 82, `متوسط مقالاته ${average.toFixed(1)}٪`)
assert.ok(passRate >= .6, `نسبة عبور مقالاته ${(passRate * 100).toFixed(0)}٪`)

/* ─── ٢) المسطرة تفرز ما ليس منه ─── */
const generic = `يعد الذكاء الاصطناعي من أهم التطورات التكنولوجية التي شهدها العالم في العقود الأخيرة، وقد أحدث ثورة حقيقية في مختلف المجالات، ولا سيما في مجال التعليم. وفي ظل التطور المتسارع لهذه التكنولوجيا، أصبح من الضروري أن نتساءل عن أثرها الحقيقي على استقلالية الطالب وقدرته على التفكير النقدي.

إن الاعتماد المتزايد على أدوات الذكاء الاصطناعي في إنجاز الواجبات المدرسية والبحوث الأكاديمية قد يؤدي إلى إضعاف مهارات التفكير المستقل لدى الطلاب، وهو ما يشكل تحدياً كبيراً أمام المؤسسات التعليمية التي تسعى إلى بناء جيل قادر على الإبداع والابتكار. بالإضافة إلى ذلك، فإن سهولة الحصول على المعلومات الجاهزة تقلل من دافعية الطالب نحو البحث والاستقصاء.

من ناحية أخرى، يمكن القول إن الذكاء الاصطناعي يوفر فرصاً هائلة لتخصيص التعليم وتلبية الاحتياجات الفردية لكل طالب، الأمر الذي يجعل العملية التعليمية أكثر فعالية وكفاءة.

في الختام، يمكن القول إن الذكاء الاصطناعي سلاح ذو حدين، وأن الأمر يتوقف على كيفية استخدامه وتوظيفه في خدمة الأهداف التعليمية النبيلة.`
const genericVerdict = judgeStyle(generic, dna, { archive })
assert.ok(genericVerdict.score <= 55, `مقال النموذج العام ${genericVerdict.score}٪ — دون مقالاته بفارقٍ واسع`)
assert.ok(genericVerdict.fatal.some((line) => line.includes('نموذجٍ آليّ')), 'عبارات النماذج تُرصد قاطعةً')
assert.ok(median - genericVerdict.score >= 30, `الفارق بينه وبين النموذج ${median - genericVerdict.score} نقطة`)

/* القالب الذي كان يُسلَّم فعلاً: يقتبس عناوين مقالاته حرفياً */
const legacyTemplate = `ليست قيمة الذكاء الاصطناعي في أنه موضوع جديد يملأ العناوين، بل في أنه يكشف طريقة نظرنا إلى الإنسان داخل التعليم. كل أداة أو فكرة تبدأ جذابة حين نراها من بعيد، لكنها تصبح أكثر تعقيداً عندما تقترب من الطالب والمعلم والأسرة والقرار اليومي داخل الصف.

وقد كتبت من قبل في «${archive[0].slug}» ما يقترب من هذا المعنى؛ فهناك خيط واضح بين السؤال القديم والسؤال الحالي.

${archive[0].body.split(/\s+/).slice(20, 40).join(' ')}

لهذا أرى أن السؤال العملي ليس: هل نقبل التكنولوجيا أو نرفضها؟ السؤال الأقرب إلى التعليم هو: كيف نجعلها أداة تخدم الإنسان ولا تختصره؟`
const legacyVerdict = judgeStyle(legacyTemplate, dna, { archive })
assert.ok(legacyVerdict.score <= 60, `القالب القديم ${legacyVerdict.score}٪`)
assert.ok(legacyVerdict.fatal.some((line) => line.includes('نقلٌ حرفي')), 'النقل الحرفي من الأرشيف يُضبط')
assert.ok(legacyVerdict.fatal.some((line) => line.includes('صوتٌ ليس صوته')), 'إحالة «وقد كتبت من قبل» تُرفض')

/* حدود الكلمة: «صيد» داخل «رصيد» و«قصيدة» ليست الكلمة الممنوعة */
assert.ok(BANNED_PHRASES.includes('صيد'), 'الكلمة المحظورة مُدرجة')
const innocent = judgeStyle('نحن نملك رصيداً من القصيدة والمعنى…بل من الأمل. هل نضيّعه؟ لا نريد ذلك. علينا أن نحفظه. نحتاج وعياً…لا شعارات. دعونا نبدأ اليوم.', dna)
assert.ok(!innocent.fatal.some((line) => line.includes('نموذجٍ آليّ')), '«رصيد» و«قصيدة» لا تُعدّان الكلمة الممنوعة')

/* ─── ٣) الصقل الحتمي لا يخترع كلمة ─── */
const raw = `## عنوان فرعي\nالتعليم ليس أداة، بل معنى... ونحن نحتاج وعياً — لا شعارات.\n\n* نقطة أولى\n* نقطة ثانية`
const refined = refineToStyle(raw, dna)
assert.doesNotMatch(refined, /—/, 'الشرطة الاعتراضية تُزال')
assert.doesNotMatch(refined, /^\s*#/m, 'عناوين ماركداون تُزال')
assert.doesNotMatch(refined, /^\s*\*/m, 'التعداد النقطي يُزال')
assert.match(refined, /…/, 'النقاط الثلاث تصير وقفةً واحدة')

/* البرهان الحاسم: الحروف نفسها بالترتيب نفسه. الصقل ترقيمٌ وفواصل فقط، ولا
   يضيف حرفاً ولا يحذفه — عدّ الكلمات وحده لا يكفي لأن «المعنى…بل» يدمج
   كلمتين في رمزٍ واحد وهو عين عادته. */
const lettersOnly = (value) => value.replace(/[^\p{L}\p{N}]+/gu, '')
for (const item of archive.slice(0, 25)) {
  assert.equal(lettersOnly(refineToStyle(item.body, dna)), lettersOnly(item.body), 'الصقل لا يمسّ حرفاً واحداً من النص')
}

/* الصقل مطبَّقاً على مقالاته هو: يرفع درجتها ولا يخفضها — وهذا أصدق برهانٍ
   على أنه يقلّد يده لا يفرض ذوقاً غريباً عليها. */
let lifted = 0
let lowered = 0
for (const item of archive) {
  const before = judgeStyle(item.body, dna).score
  const after = judgeStyle(refineToStyle(item.body, dna), dna).score
  if (after > before) lifted += 1
  if (after < before - 5) lowered += 1
}
assert.ok(lifted >= 60, `الصقل يرفع درجة مقالاته نفسها (${lifted} مقالاً)`)
assert.equal(lowered, 0, 'الصقل لا يخفض درجة أي مقالٍ من مقالاته بأكثر من خمس نقاط')

/* كسر الجملة المتضخّمة يقع عند مفصلٍ يبدأ به جمله، لا في أي مكان */
const bloated = 'التعليم في هذه المرحلة يحتاج إلى مراجعة عميقة لأدواته ومناهجه وسياساته كلها، لكن المراجعة وحدها لا تكفي ما لم يتغير وعي القائمين عليها أولاً.'
const broken = refineToStyle(bloated, dna)
assert.match(broken, /…\s?لكن/, 'الكسر يقع قبل «لكن» — وهي أول ٦٥ جملة من جمله')
assert.equal(broken.replace(/[^\p{L}\p{N}]+/gu, ''), bloated.replace(/[^\p{L}\p{N}]+/gu, ''), 'الكسر لا يمسّ حرفاً')

const longParagraph = Array.from({ length: 14 }, (_, index) => `هذه جملة رقم ${index + 1} في فقرة واحدة طويلة عن التعليم والإنسان والمعنى.`).join(' ')
assert.ok(refineToStyle(longParagraph, dna).split(/\n\s*\n/).length >= 3, 'الفقرة المتضخّمة تُقطَّع بإيقاعه')
assert.ok(polishTypography('كلمة  مزدوجة   المسافات').includes('كلمة مزدوجة'), 'المسافات المكرّرة تُضبط')

/* ─── بوابة الإسناد: أخطر ما كشفه التشغيل الحيّ ─── */
const fabricated = 'في الصف اليوم مشهدٌ يتكرر. دراسة نشرت في «علم النفس التربوي» (2025) أظهرت أن الطلاب الذين اعتمدوا على الذكاء الاصطناعي سجلوا تراجعاً بنسبة 38% في فهم المواد بعد شهر. لا لأنه لا يقرأ… بل لأن عقله لم يُجبر على التفاعل. فهل نمنحهم أدوات التعلّم… أم أدوات التحايل؟'
const orphan = unsupportedClaims(fabricated, archive)
assert.ok(orphan.length >= 1, `الرقم المخترع يُضبط (${orphan.length})`)
assert.ok(judgeStyle(fabricated, dna, { sources: archive }).fatal.some((line) => line.includes('بلا سند')), 'الاختلاق تحفّظٌ قاطع')
/* واستشهادُه الحقيقي يعبر: ٤٣ من مقالاته تستشهد بدراساتٍ بأسمائها */
const citing = archive.filter((item) => /(?<!\p{L})دراسة(?!\p{L})/u.test(item.body))
assert.ok(citing.length >= 20, `الاستشهاد من أسلوبه (${citing.length} مقالاً)`)
const falseAlarms = citing.filter((item) => unsupportedClaims(item.body, archive).length).length
assert.ok(falseAlarms === 0, `لا إنذار كاذب على استشهاداته الحقيقية (${falseAlarms})`)

/* ─── أعطابٌ رصدها تدقيقٌ عدائي ─── */
assert.equal(polishTypography('قال "أ" ثم "ب" وانتهى.'), 'قال «أ» ثم «ب» وانتهى.', 'الاقتباس يقترن بالتناوب لا بعرضٍ ثابت')
assert.equal(polishTypography(polishTypography('قال "أ" ثم "ب" وانتهى.')), polishTypography('قال "أ" ثم "ب" وانتهى.'), 'الطباعة ثابتة عبر التمريرات')
assert.equal(liftPauses('الوعي ليس شعاراً، ثمَّة فرقٌ بين الأداة والغاية.', dna), 'الوعي ليس شعاراً، ثمَّة فرقٌ بين الأداة والغاية.', 'التشكيل لا يجعل «ثمَّة» تُقرأ «ثم»')
const unstable = archive.filter((item) => {
  const once = refineToStyle(item.body, dna)
  return refineToStyle(once, dna) !== once
}).length
/* كان الشرط «شبه ثابت» ويتسامح مع اثني عشر. وقد زال سببا التذبذب: حصّة
   الوقفات كانت تُحسب على ما تراه التمريرة لا على كل مفاصل النص، ورأسُ الجملة
   المكسورة كان يُترك بلا إعادة فحص. الآن صفر، والشرط صفر. */
assert.equal(unstable, 0, `الصقل ثابتٌ تماماً عبر تمريرين (${unstable} من ${archive.length}؛ كان ٣٧ ثم ١٢)`)
const spamSource = archive[7].body
const spammed = spamSource.split(/\s+/).map((word, index) => index % 6 === 5 ? `${word}…` : word).join(' ')
assert.ok(judgeStyle(spammed, dna).score < judgeStyle(spamSource, dna).score, 'حشو الوقفات يخفض الدرجة ولا يرفعها')
assert.ok(judgeStyle('نص تجريبي طويل بما يكفي للقياس والحكم عليه. '.repeat(20), { sampleSize: 5 }).score >= 0, 'بصمة مبتورة لا تُسقط الحَكَم')

/* الوصفة التي تُملى على المحرك أرقامٌ لا صفات */
const brief = styleBrief(dna, 400)
for (const needle of ['وسيطها', 'نقاط الحذف', '…بل', 'صيدة', 'ممنوع']) {
  assert.ok(brief.includes(needle), `الوصفة تذكر «${needle}»`)
}

/* ─── ٤) المحرك يتعلّم من أرقام الحَكَم ─── */
delete process.env.GEMINI_API_KEY
delete process.env.GOOGLE_API_KEY
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account'
process.env.CLOUDFLARE_API_TOKEN = 'test-token'
const { citationsOf, domainKnowledge, generatePerfectArticle, chooseFamilies } = await import(resolve(root, 'server.mjs'))
/* بنك المراجع: يلتقط استشهاداته كما كتبها، وبزمنٍ خطّي (CodeQL: النمط المتداخل كان يتراجع أُسّياً). */
assert.deepEqual(citationsOf('وإذا أضفنا منظور Ryan وDeci (2000) في نظرية الدافعية الذاتية، تتضح الصورة.').map((item) => item.key), ['Ryan وDeci (2000)'])
assert.deepEqual(citationsOf('هذا ما أشارت إليه أعمال حديثة مثل Lawrence et al. (2021) وFairlamb et al. (2022).').map((item) => item.key), ['Lawrence et al. (2021)'])
assert.deepEqual(citationsOf('ويؤكد ذلك تحليلٌ حديث (Tang et al., 2023؛ Zheng, 2024) عن أثر الشاشات في الانتباه لدى الأطفال في المدرسة.').map((item) => item.key), ['Tang et al. (2023)'], 'والصيغة الأخرى بين قوسين بفاصلة')
/* الحارس الحرفي: اسم الباحث وسنته ليسا نقلاً، لكن الرقم المنقول مع جملته نقل. */
assert.deepEqual(verbatimOverlap('نعود إلى Ryan وDeci (2000) في نظرية الدافعية الذاتية لنفهم الطالب', ['وإذا أضفنا منظور Ryan وDeci (2000) في نظرية الدافعية الذاتية، تتضح الصورة أكثر']), [], 'الاستشهاد بالمرجع نفسه ليس نقلاً')
assert.ok(verbatimOverlap('وجدت مراجعة شملت 128 دراسة أن المكافآت تضعف الدافعية الداخلية', ['المراجعة التي راجعت 128 دراسة أن المكافآت تضعف الدافعية الداخلية عند الطالب']).length > 0, 'والجملة المنقولة برقمها تُرصد')
const redosStarted = Date.now()
citationsOf(`A'&A${"'andA".repeat(5000)}x (2019)`)
assert.ok(Date.now() - redosStarted < 250, `استخراج المراجع خطّيّ (${Date.now() - redosStarted} ms)`)
/* الزاوية ترجّح ولا تُقصي: فكرةٌ بكلمةٍ واحدة مميّزة تجد متونها مهما كانت الزاوية. */
const gamified = domainKnowledge('التلعيب', { angle: 'القيادة لا الاستبدال' })
assert.ok(gamified.من_كتبك.some((item) => item.مصدر.includes('التلعيب')), 'مقاطع كتاب التلعيب تصل رغم زاويةٍ لا تذكره')

/* نصّان مصطنعان للاختبار: أحدهما بلغة النماذج، والآخر بإيقاعه. كُتبا هنا
   عمداً (لا مقتطفان من أرشيفه) كي يعبرا حارس النقل الحرفي. */
const weakBody = [
  'يعد الذكاء الاصطناعي من أهم التطورات التي يشهدها التعليم في هذه المرحلة الدقيقة من تاريخه الطويل، وهو ما يفرض على المؤسسات التعليمية أن تعيد النظر في أدواتها ومناهجها وسياساتها كافة، خصوصاً مع تسارع وتيرة التحول الرقمي في المنطقة العربية عموماً وفي دول الخليج خصوصاً.',
  'إن الاعتماد المتزايد على هذه الأدوات في إنجاز الواجبات المدرسية والبحوث الأكاديمية قد يؤدي إلى إضعاف مهارات التفكير المستقل لدى الطلاب، وهو ما يشكل تحدياً كبيراً أمام المؤسسات التي تسعى إلى بناء جيل قادر على الإبداع والابتكار ومواكبة متطلبات سوق العمل المتغيرة باستمرار.',
  'في الختام، إن الأمر يتوقف على طريقة الاستخدام وعلى وعي المعلم وولي الأمر بحدود الأداة وإمكاناتها، وعلى قدرة النظام التعليمي على وضع الضوابط الكفيلة بتحقيق التوازن المنشود بين الاستفادة من التقدم التقني والحفاظ على جوهر العملية التربوية.',
].join('\n\n')

const strongBody = [
  'دخل المعلّم الصفّ كعادته، وألقى التحية التي يلقيها منذ عشرين سنة… لكن الأسئلة تغيّرت. قبل سنواتٍ كان الطالب يسأل كيف يفهم الدرس، واليوم يسأل سؤالاً أقصر وأخطر: من يجيب عني؟',
  'ليست المشكلة في الأداة… بل في الوعي الذي يقودها. والأداة لا تعرف الفرق بين طالبٍ يتعلّم وطالبٍ يهرب، ولا يعنيها أن تعرف. نحن من نعرف، ونحن من نختار أن نسأل أو نسكت…',
  'في ورقةٍ صحيحة تماماً، لا خطأ فيها ولا أثر ليدٍ مترددة، يغيب شيءٌ واحد هو صاحبها. أنجز الواجب، وحصل على الدرجة، وخرج راضياً. وما الذي بقي في رأسه بعد أن أُغلق الجهاز…',
  'هنا يبدأ سؤالٌ لا تحلّه المناهج وحدها: ماذا نقيس حين نصحّح؟ الامتحان يقيس المُخرَج، والتربية تعيش في الطريق إليه. وحين نكتفي بالمُخرَج نكافئ من وصل، ولا نسأل كيف وصل…',
  'دعونا نصارح أنفسنا. لم نُهزم أمام الآلة ولم نُسبَق، وإنما اخترنا الأسهل حين صار متاحاً، ثم سمّيناه تطويراً ورفعنا له الشعارات في المؤتمرات…',
  'وأخطر ما في الأمر أنه هادئ.',
  'لا ضجيج ولا احتجاج ولا مشهد يستدعي القلق. طالبٌ راضٍ، ومعلّمٌ مطمئن، وأسرةٌ فخورة بالدرجة المعلّقة على الثلاجة… وعقلٌ لم يُستعمل منذ بداية الفصل.',
  'ولو غيّرنا السؤال قليلاً لتغيّر المشهد كله. بدل أن نسأل هل أنجز الواجب، نسأل ما الذي تغيّر فيه بعد أن أنجزه، وماذا صار يرى مما لم يكن يراه قبله… سؤالٌ واحدٌ يعيد ترتيب الغرفة كلها.',
  'علينا أن نختار. ليس بيننا وبين التكنولوجيا عداوة، بل بيننا وبين الكسل الذي تسهّله حين نتركها بلا سؤال. ولن يحمينا منهجٌ جديد ولا نظامُ مراقبة، سيحمينا معلّمٌ يعرف طلابه واحداً واحداً ويسمع في الجواب صوت صاحبه…',
  'وإن لم نفعل، فمن يبقى ليسأل؟',
].join('\n\n')

let cfCalls = 0
let sawCorrections = false
let sawExemplar = 0
let sawKnowledge = false
const makeResponse = (body) => ({
  ok: true, status: 200,
  json: async () => ({ result: { response: JSON.stringify({
    title: 'حين يستأذن الذكاء الاصطناعي المعلم', cat: 'التقنية',
    excerpt: 'ليست المعركة بين المعلم والخوارزمية، بل بين وعيين: وعي يقود الأداة ووعي تقوده.',
    body, angle: 'القيادة لا الاستبدال', eventId: '', eventConnection: '', originalityNote: 'زاوية جديدة.',
  }) } }),
})
const learningFetch = async (url, init) => {
  if (!String(url).includes('api.cloudflare.com')) return { ok: false, status: 503, json: async () => ({}) }
  cfCalls += 1
  const instruction = JSON.parse(init.body).messages[0]?.content || ''
  const promptText = JSON.parse(init.body).messages.map((message) => message.content || '').join('\n')
  /* نموذج الصوت: مقالٌ حقيقي يجري أكثر من مئتي كلمة، لا جملتان من مطلعه. */
  const exemplarMatch = promptText.match(/"نماذج_صوت":\[\{"عنوان":"[^"]*","نص":"([^"]+)"/)
  if (exemplarMatch) sawExemplar = Math.max(sawExemplar, exemplarMatch[1].split(/\s+/).length)
  /* رصيده المعرفي: اقتباسٌ من كتبه في الفكرة نفسها يصل الكاتب. */
  if (/"معرفتك":\{"من_كتبك":\[\{"مصدر":"[^"]*الذكاء الاصطناعي/.test(promptText) && /"من_مقالاتك":\[\{"نص":"[^"]*الذكاء الاصطناعي/.test(promptText)) sawKnowledge = true
  /* النموذج الوهميّ لا «يتحسّن» إلا حين تصله أرقام النقص فعلاً. */
  if (instruction.includes('جولة تصحيحٍ إلزامية')) {
    sawCorrections = true
    assert.ok(/وقفات «…»|الانقلاب|جملك أطول|احذف/.test(instruction), 'أوامر التصحيح أرقامٌ محدّدة لا عبارات عامة')
    return makeResponse(strongBody)
  }
  return makeResponse(weakBody)
}

const input = {
  idea: 'الذكاء الاصطناعي بين يدي المعلم',
  audience: 'المعلمون والقيادات التعليمية',
  angle: 'القيادة لا الاستبدال',
  targetWords: 350,
  skipOriginality: false,
  styleProfile: { articleCount: archive.length },
  styleSamples: archive.slice(0, 6).map((item, index) => ({
    title: `عينة ${index + 1}`, cat: 'التعليم', year: '2024',
    opening: item.body.slice(0, 300), middle: item.body.slice(300, 600), closing: item.body.slice(-300),
  })),
  existing: archive.slice(0, 40).map((item) => ({ slug: item.slug, title: item.slug, excerpt: '', body: item.body.slice(0, 1_800) })),
  selectedEventIds: [],
  styleDna: dna,
  variation: 0,
}

const weakVerdict = judgeStyle(refineToStyle(weakBody, dna), dna)
const article = await generatePerfectArticle(input, learningFetch)
assert.ok(sawCorrections, 'جولة التصحيح وقعت فعلاً')
assert.ok(sawExemplar >= 200, `النموذج يسمع مقالاً كاملاً من أرشيفه (${sawExemplar} كلمة) لا جملتين`)
assert.ok(sawKnowledge, 'الكاتب يرى من محتوى كتبه ومقالاته ما قاله في الفكرة نفسها')
assert.equal(typeof article.voiceTouches, 'number', 'لمسة الصوت الأخيرة تُعلن بعدد تعديلاتها')
assert.ok(cfCalls >= 3, `مرشحان ثم تصحيح (${cfCalls} نداءات)`)
assert.ok(article.style, 'المقال يعود ومعه بطاقة أسلوبه')
assert.ok(article.style.score > weakVerdict.score, `التصحيح رفع الدرجة ${weakVerdict.score} → ${article.style.score}`)
assert.ok(article.style.score >= 75, `المسلَّم داخل مدى أسلوبه (${article.style.score}٪)`)
assert.ok(article.style.structure, 'بنية المقال معلنة')
assert.ok(Array.isArray(article.style.lines) && article.style.lines.length, 'تقرير عربي مختصر يصاحب المقال')
assert.ok(article.body.includes('…'), 'الوقفات حاضرة في المسلَّم')
assert.doesNotMatch(article.body, /في الختام/, 'عبارات النماذج لا تصل الدكتور')

/* التكرار: العطب الحقيقي الذي كشفه تشغيلٌ حيّ على النموذج المجاني — نصٌّ يلفّ
   على نفسه كان ينال ٩٥٪ قبل هذا الحارس. */
const loopingText = Array.from({ length: 9 }, () => 'نحن بحاجة إلى إعادة التفكير في كيفية استخدامنا للتكنولوجيا في التعليم… بل لتعليمهم كيفية التفكير النقدي وحل المشكلات والتعلم مدى الحياة. هل نربي عقلاً؟').join(' ')
const loopingVerdict = judgeStyle(loopingText, dna)
assert.ok(loopingVerdict.score <= 60, `النص الذي يلفّ على نفسه يسقط (${loopingVerdict.score}٪)`)
assert.ok(loopingVerdict.fatal.some((line) => line.includes('يلفّ على نفسه')), 'التكرار تحفّظٌ قاطع')
assert.ok(loopingVerdict.corrections.some((line) => line.includes('يعيد نفسه')), 'أمر إصلاح التكرار يصل النموذج')
const ownRepetition = archive.map((item) => articleMetrics(item.body).duplicateSentenceRate)
assert.ok(ownRepetition.filter((rate) => rate > 0).length <= 4, 'الدكتور نفسه لا يكرّر — المسطرة صادقة هنا أيضاً')

/* بنيتان مختلفتان لكل جولة: لا يتكرّر شكل المقال */
const structures = new Set()
for (const variation of [0, 1, 2, 3]) {
  const run = await generatePerfectArticle({ ...input, variation }, async (url, init) => {
    if (!String(url).includes('api.cloudflare.com')) return { ok: false, status: 503, json: async () => ({}) }
    const instruction = JSON.parse(init.body).messages[0]?.content || ''
    const match = instruction.match(/بناء هذا المقال — ([^\n:]+)/)
    if (match) structures.add(match[1].trim())
    return makeResponse(strongBody)
  })
  assert.ok(run.body, 'كل جولة تُنتج نصاً')
}
assert.ok(structures.size >= 3, `دوران البُنى فعليّ (${structures.size} بنيات مختلفة)`)

/* عند سقوط المحرك: عجزٌ صريح لا نصٌّ مُلفَّق */
await assert.rejects(
  () => generatePerfectArticle(input, async () => ({ ok: false, status: 502, json: async () => ({}) })),
  (error) => error instanceof Error,
  'انهيار المحرك يرفع خطأً ولا يسلّم قالباً',
)

/* ─── بوابة المصحّح اللغوي: تقبل التصحيح وترفض إعادة الكتابة ─── */
const server = readFileSync(resolve(root, 'server.mjs'), 'utf8')
const beforeProof = [
  'دخل المعلّم الصفّ كعادته… لكن الأسئلة تغيّرت.',
  'والأسوء أننا نترك الآلة تعلّمهم أن التعلّم غير ضروري. الواجب ليس مسؤوليةً على الأعاتب… بل فرصةً للنمو.',
  'نحن أمام امتحانٍ جديد. هل نربّي عقلاً… أم نشتري إجابة؟ دعونا نصارح أنفسنا.',
  'وإن لم نفعل… فمن يبقى ليسأل؟',
].join('\n\n')
const properProof = beforeProof.replace('والأسوء', 'والأسوأ').replace('الأعاتب', 'الأعتاب')
const proofVerdict = acceptProofread(beforeProof, properProof, dna)
assert.ok(proofVerdict.accepted, `تصحيح الإملاء يُقبل (${proofVerdict.reason})`)

const rewritten = [
  'في عالم اليوم، يواجه التعليم تحديات كبيرة بسبب التطور التكنولوجي المتسارع في جميع المجالات.',
  'إن المعلم مطالب بمواكبة هذه التغيرات، بالإضافة إلى ذلك يجب على الطالب أن يتحلى بالمسؤولية.',
  'في الختام، يمكن القول إن الأمر يتوقف على وعي الجميع بأهمية التعليم في بناء المستقبل.',
].join('\n\n')
assert.ok(!acceptProofread(beforeProof, rewritten, dna).accepted, 'إعادة الكتابة تُرفض كاملة')
assert.ok(!acceptProofread(beforeProof, beforeProof.replace(/…/g, '،'), dna).accepted, 'مسُّ الوقفات يُرفض')
assert.ok(!acceptProofread(beforeProof, '', dna).accepted, 'نصٌّ فارغ يُرفض')
assert.ok(PROOFREAD_INSTRUCTION.includes('طلاباً'), 'المدقّق مأمورٌ ألا يغيّر صورة التنوين — وهي أسلوبه')
assert.match(server, /ARTICLE_PROOFREAD !== 'off'/, 'التدقيق اللغوي موصولٌ وقابلٌ للتعطيل')

/* ─── ترجيح الحقبة: البصمة تقيس أحمد اليوم لا أحمد ٢٠١٧ ─── */
const dataSource = readFileSync(resolve(root, 'src/data.ts'), 'utf8')
const isoBySlug = new Map()
for (const match of dataSource.matchAll(/slug:\s*'([^']+)'[^}]*?iso:\s*'([0-9-]+)'/g)) isoBySlug.set(match[1], match[2])
const dated = archive.map((item) => ({ ...item, iso: isoBySlug.get(item.slug) || '' })).filter((item) => item.iso)
assert.ok(dated.length >= 100, `تواريخ المقالات متاحة (${dated.length})`)

const flatDna = measureStyleDna(dated.map((item) => ({ body: item.body })))
const eraDna = measureStyleDna(dated)
assert.ok(eraDna.era && eraDna.era.weightedSample > eraDna.sampleSize, 'الترجيح فعّالٌ لا اسمي')

const medianOf = (list, useDna) => {
  const scores = list.map((item) => judgeStyle(item.body, useDna).score).sort((left, right) => left - right)
  return scores[Math.floor(scores.length / 2)]
}
const recent = dated.filter((item) => item.iso >= '2025-01-01')
assert.ok(recent.length >= 20, `عيّنة حديثة كافية (${recent.length})`)
assert.ok(medianOf(recent, eraDna) > medianOf(recent, flatDna), `الترجيح ينصف مقالاته الحديثة (${medianOf(recent, flatDna)} ← ${medianOf(recent, eraDna)})`)

/* والأهم: ما يُملى على المحرك تغيّر فعلاً نحو صوته اليوم */
const flatBrief = styleBrief(flatDna, 400)
const eraBrief = styleBrief(eraDna, 400)
/* عاداته الخفية كما هي اليوم: الواو وتفاوت الجمل — لا «الفقرة المختومة بـ«…»» التي
   كانت عادته قبل ٢٠٢٢ (١٠٠٪) وصارت صفراً في ٢٠٢٦. */
assert.match(eraBrief, /عاداته الخفية[^\n]*تبدأ بالواو[^\n]*متفاوتة/, 'الوصفة تنقل عاداته الخفية مقيسةً')
assert.doesNotMatch(eraBrief, /يختم \d+٪ من فقراته بوقفة/, 'ولا تأمر بعادةٍ تركها')
/* «…» مدىً من صوته اليوم لا حدٌّ أدنى من صوت ٢٠١٧، وطباعتها كما يكتبها الآن. */
const pauseRange = eraBrief.match(/نقاط الحذف «…»: بين (\d+) و(\d+)/)
assert.ok(pauseRange && Number(pauseRange[2]) <= 10, `مدى الوقفات من صوته اليوم (${pauseRange?.[1]}–${pauseRange?.[2]})`)
assert.ok(eraDna.marks.ellipsisTightRate >= .9 && eraBrief.includes('عاجزون…بل'), 'الوقفة تلتصق بما بعدها كما في مقالاته الأحدث')
assert.equal(refineToStyle('يبتسم… لكن شيئاً لا يتحرّك.', eraDna), 'يبتسم…لكن شيئاً لا يتحرّك.', 'والصقل يتبع طباعته الحالية')
assert.equal(sentencesOf('يبتسم…لكن شيئاً لا يتحرّك. هل نستعدّ؟').length, 3, 'والوقفة الملتصقة فاصلُ جملة كالمنفصلة')
/* البصمة الاحتياطية (طلبٌ بلا بصمة) تُقاس بالطريقة نفسها: لا تُعيد صوت ٢٠١٧. */
const fallbackBrief = styleBrief(null, 400)
const fallbackRange = fallbackBrief.match(/نقاط الحذف «…»: بين (\d+) و(\d+)/)
const eraRange = eraBrief.match(/نقاط الحذف «…»: بين (\d+) و(\d+)/)
assert.ok(fallbackRange && Math.abs(Number(fallbackRange[2]) - Number(eraRange[2])) <= 2, `البصمة الاحتياطية بقياس اليوم (${fallbackRange?.[1]}–${fallbackRange?.[2]} مقابل ${eraRange?.[1]}–${eraRange?.[2]})`)
assert.equal(refineToStyle('يبتسم… لكن شيئاً لا يتحرّك.', null), 'يبتسم…لكن شيئاً لا يتحرّك.', 'وطباعتها طباعته اليوم')
const numberIn = (brief, needle) => Number((brief.split('\n').find((line) => line.includes(needle)) || '').match(/\d+/)?.[0] || 0)
assert.ok(numberIn(eraBrief, 'الأسئلة البلاغية') > numberIn(flatBrief, 'الأسئلة البلاغية'), 'الأسئلة ارتفعت — وهي علامته اليوم')
assert.ok(numberIn(eraBrief, 'نقاط الحذف') < numberIn(flatBrief, 'نقاط الحذف'), 'الوقفات انخفضت — وهي علامته القديمة')

/* ─── أشِر إلى الجملة لا إلى المقياس ─── */
const flawed = [
  'في الختام، يمكن القول إن التعليم يلعب دوراً هاماً في بناء المجتمعات.',
  'دراسة نشرت عام 2025 أظهرت تراجعاً بنسبة 38% في فهم المواد.',
  'وفى رأيي أن هذا مقلق للغاية.',
].join('\n\n')
const located = locateIssues(flawed, dna, { sources: archive, orthography: buildOrthographyIndex(archive) })
assert.ok(located.length >= 3, `يدلّ على الجمل لا على الأرقام (${located.length})`)
for (const issue of located) assert.ok(flawed.includes(issue.sentence), 'وكل ما يشير إليه جملةٌ من النص نفسه')
assert.ok(located.some((issue) => issue.kind === 'banned'), 'يضبط العبارة الآلية')
assert.ok(located.some((issue) => issue.kind === 'evidence'), 'ويضبط الرقم بلا سند')
assert.ok(located.some((issue) => issue.kind === 'orthography'), 'ويضبط الإملاء')
/* ولا يشوّش على نصّه هو */
/* على نصٍّ كتبه هو (strict:false) لا يُعرض إلا العيب الموضوعي */
const quiet = archive.slice(0, 30).filter((item) => locateIssues(item.body, dna, { strict: false }).length === 0).length
assert.ok(quiet >= 28, `صامتٌ على نصّه هو (${quiet} من ٣٠)`)

/* ─── أصلح فقرةً واحدة بدل شراء مقالٍ كامل ─── */
assert.match(server, /const articleParagraphPath = '\/api\/ai\/article-paragraph'/, 'مسار إصلاح الفقرة موجود')
assert.match(server, /export async function reviseArticleParagraph/, 'ودالته مبنيّة')
assert.match(server, /url\.pathname === articleParagraphPath/, 'وموصولٌ بالتوجيه')
assert.match(server, /articleParagraphPath, socialPackPath/, 'ومحميٌّ ببوابة المشرف')

/* ─── بوابة الإملاء: أرشيفه هو المرجع ─── */
const orthoIndex = buildOrthographyIndex(archive)
assert.ok(orthoIndex.size > 5_000, `معجم صوابه مبنيّ (${orthoIndex.size} صورة)`)

/* الثغرة التي كانت: حقنُ أخطاءٍ كلاسيكية لم يحرّك الدرجة نقطةً واحدة */
const cleanArticle = archive.find((item) => !orthographySlips(item.body, orthoIndex).length)
assert.ok(cleanArticle, 'يوجد مقالٌ سليم إملائياً للاختبار')
const dirtied = cleanArticle.body
  .replace(/(?<![\p{L}])في(?![\p{L}])/gu, 'فى')
  .replace(/(?<![\p{L}])التي(?![\p{L}])/gu, 'التى')
assert.ok(orthographySlips(dirtied, orthoIndex).length >= 1, 'الأخطاء المحقونة تُضبط')
assert.ok(
  judgeStyle(dirtied, dna, { orthography: orthoIndex }).score < judgeStyle(cleanArticle.body, dna, { orthography: orthoIndex }).score,
  'والإملاء صار يخفض الدرجة بعد أن كان لا يحرّكها',
)

/* والأهم: لا إنذار على كلماتٍ صحيحة تحتمل معنيين */
for (const pair of ['وإن نظرنا إلى الأمر', 'كأن شيئاً لم يكن', 'إما أن نبدأ أو نصمت', 'ألا نستحق إجابة']) {
  assert.equal(orthographySlips(pair, orthoIndex).length, 0, `«${pair}» كلامٌ صحيح لا خطأ`)
}

/* ─── مسطرة المقتطف: طولُه لا اشتقاقُه ─── */
/* تدقيقٌ آليّ زعم أن ٨١٪ من مقتطفاته مطلع متنه؛ القياس يقول ١٨٪ — فالاشتقاق
   الدائم انحدار. هذا الفحص يمنع إعادة ذلك الزعم إلى الكود. */
const goodExcerpt = 'ليست المشكلة في أن الطالب لا يعرف… بل في أنه لم يُسأل يوماً لماذا يتعلّم.'
assert.equal(deriveExcerpt(strongBody, goodExcerpt), goodExcerpt, 'مقتطفه يُحترم كما كتبه')
assert.ok(deriveExcerpt(strongBody, '').length >= 40, 'ويُشتقّ من الجسم حين يغيب')
assert.ok(Array.from(deriveExcerpt(strongBody, 'كلمة '.repeat(60))).length <= 150, 'والمتضخّم يُقصّ إلى مداه')
assert.ok(!deriveExcerpt(strongBody, '').includes('undefined'), 'ولا يخترع شيئاً')

/* ─── ذاكرة الصوت: يتعلّم من حكمه هو لا من أرشيفه فقط ─── */
const studio = readFileSync(resolve(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
assert.match(studio, /data-issue-map="true"/, 'لوحة «أين بالضبط» معروضة')
assert.match(studio, /strict: Boolean\(bundle\.generatedBy\)/, 'وقواعد النموذج لا تُملى على الكاتب')
assert.match(studio, /'\/api\/ai\/article-paragraph'/, 'وزرّ إصلاح الفقرة موصول')

/* ─── يُحاكَم المحرك ولا يُحاكَم الكاتب ─── */
/* عتبةٌ حاجبة على الأسلوب كانت ترسّب ٢١٪ من مقالاته المنشورة، ثم اتضح أن
   قوائم المنع كلها تحجب ٢٨٪ منها. هذا الفحص يمنع عودة أي حجبٍ على نصّه. */
assert.match(studio, /bundle\.generatedBy\s*\?\s*\[\s*\.\.\.\(liveStyleVerdict\?\.fatal \|\| \[\]\),[\s\S]{0,260}?MACHINE_TRACE\.threshold[\s\S]{0,160}?\]\s*:\s*\[\]/, 'الحجب لما ولّده المحرك وحده — وأثر الآلة فوق عتبته يحجبه')
assert.match(studio, /key: 'style-ai'[^\n]*ok: true/, 'درجة المطابقة تُخبر ولا تحجب')
assert.doesNotMatch(studio, /styleScore >= 72/, 'ولا عتبة حاجبة على الأسلوب')

/* ولا يُقارَن المقال بنفسه حين يُفتح للتحرير. والتقاطع بينه وبين مقالٍ آخر
   له أمرٌ طبيعي — كاتبٌ يعيد صياغة نفسه — ولذلك لا يحجب إلا مخرَج المحرك. */
const own = archive[11]
assert.equal(verbatimOverlap(own.body, [own]).length, 0, 'المقال لا يُتّهم بالنقل عن نفسه')
assert.equal(verbatimOverlap(own.body, [{ body: `مقدمة قصيرة. ${own.body}` }]).length, 0, 'ولا عن نسخةٍ تحتويه')
assert.match(studio, /article\.slug !== bundle\.slug/, 'وأرشيف المقارنة يستثني المقال المفتوح')

const rejectedParagraph = 'إن الاعتماد المتزايد على أدوات الذكاء الاصطناعي يشكل تحدياً كبيراً أمام المؤسسات التعليمية التي تسعى إلى بناء جيل قادر على الإبداع.'
const signature = extractVoiceSignature(rejectedParagraph, archive)
assert.ok(signature.length >= 2, `يستخرج بصمة النموذج من فقرةٍ مرفوضة (${signature.length})`)
for (const phrase of signature) {
  assert.ok(!bareText(archive.map((item) => item.body).join(' ')).includes(phrase), `«${phrase}» غائبةٌ فعلاً عن أرشيفه`)
}
/* الاختبار الحاسم: فقراتُه هو لا تُنتج بصمةً غريبة */
let selfSignals = 0
for (const item of archive.slice(0, 40)) {
  const paragraph = item.body.split(/\n\s*\n/).find((part) => countWords(part) > 25) || ''
  if (paragraph && extractVoiceSignature(paragraph, archive).length) selfSignals += 1
}
assert.equal(selfSignals, 0, 'لا يستخرج شيئاً من فقراتٍ كتبها هو — وإلا تعلّم منع نفسه')

const taught = withVoiceMemory(dna, ['يشكل تحديا كبيرا'])
assert.ok(taught.bannedVoice.includes('يشكل تحديا كبيرا'), 'ما تعلّمه يدخل قائمة المنع')
assert.ok(styleBrief(taught, 400).includes('هذه ليست أنا'), 'ما تعلّمه يُملى على المحرك أيضاً')
const long = `${rejectedParagraph}\n\n${strongBody}`
assert.ok(judgeStyle(long, taught).fatal.some((line) => line.includes('صوتٌ ليس صوته')), 'الحَكَم يرفض ما رفضه الدكتور')
assert.ok(!judgeStyle(long, dna).fatal.some((line) => line.includes('يشكل تحديا')), 'وقبل أن يعلّمه لم يكن يعرفه')

/* ─── غرفة المرشحَين: المرشح الثاني يعود بدل أن يُرمى ─── */
assert.match(server, /const roster = \[\]/, 'كل المرشحين يُحفظون لا الفائز وحده')
assert.match(server, /alternates: roster/, 'النسخة الثانية تعود مع المقال')
assert.match(studio, /data-candidate-room="true"/, 'غرفة المرشحَين معروضة')
assert.match(studio, /data-generation-progress="true"/, 'الانتظار لم يعد صامتاً')
assert.match(studio, /verdict\.corrections\.length > 0/, '«لماذا» تُعرض للدكتور بعربيته')
assert.match(studio, /buildOrthographyIndex\(archiveTexts\)/, 'معجم صوابه موصولٌ بالقياس الحيّ')
assert.match(studio, /setSettledBody\(bundle\.body\), 500/, 'القياس مهدَّأ لا في كل ضغطة مفتاح')
assert.match(server, /cfModel: process\.env\.EDITORIAL_CF_MODEL \|\| ARTICLE_MODEL_PRIMARY,/, 'جولات التصحيح على النموذج الأسرع')
/* الأرضية ١٢٠٠ كانت الطرف الآخر من العطب: الكلمة العربية نحو ثلاثة رموز،
   فأربعمئة كلمة تُبتر عند مئةٍ وسبع. المعامل خمسةٌ وأرضيةٌ ٢٥٠٠. */
assert.match(server, /clamp\(Math\.ceil\(targetWords \* 5\), 2_500, 16_384\)/, 'سقف الرموز يتّسع للعربية')
assert.match(server, /ARTICLE_STYLE_DEADLINE_MS', 46_000/, 'الميزانية تحت باب Firebase Hosting الستين')
assert.match(server, /const needsSecond = !alwaysTwo/, 'المرشح الثاني يُشترى عند الحاجة لا مقدماً')
/* كان الشرط مكتوباً على اسمٍ قديم (`archiveBodies()`) بعد أن قُسّم القارئ إلى
   شرائح واحتياط، فصار الفاحص كله يسقط على السطر نفسه قبل أن يبلغ فحصاً واحداً
   من فحوص الأسلوب — ولم يكن موصولاً بالبناء فلم ينتبه أحد. */
assert.match(server, /archiveBodyFromShard\(slug\) \|\| archiveBodiesFallback\(\)/, 'الخادم يقرأ الأرشيف من قرصه')
assert.match(server, /maxArticleRequestBytes = 384 \* 1024/, 'وحدّ الطلب يتّسع للفهرس')
assert.match(server, /buildOrthographyIndex\(input\.existing\)/, 'بوابة الإملاء موصولةٌ بالمحرك')
assert.match(server, /deriveExcerpt\(article\.body, article\.excerpt\)/, 'مسطرة المقتطف موصولة')
assert.match(studio, /data-voice-teacher="true"/, 'لوحة «علّمه صوتك» معروضة')
assert.match(studio, /admin_style_memory/, 'ذاكرة الصوت تُزامَن بين أجهزته')
const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8')
assert.match(rules, /match \/admin_style_memory\/\{id\}/, 'قاعدة ذاكرة الصوت موجودة — وإلا صمتت المزامنة')

/* ─── ٥) مصادر الاستوديو نظيفة من الحشو والقوالب ─── */
assert.doesNotMatch(studio, /والفكرة هنا ليست في مقاومة الجديد/, 'الحشو المُعلَّب حُذف من الاستوديو')
assert.doesNotMatch(studio, /وقد كتبت من قبل في/, 'قالب الاقتباس من عناوينه حُذف')
assert.doesNotMatch(studio, /function buildExactLocalArticle/, 'مُلفِّق المقال المحلي حُذف')
assert.doesNotMatch(studio, /function buildArticleDraft/, 'قالب الفراغات حُذف')
assert.match(studio, /styleDna/, 'البصمة تُرسل إلى المحرك')
assert.match(studio, /refineToStyle/, 'الصقل الحتمي مطبَّق على المسلَّم')
assert.match(studio, /data-style-fidelity="true"/, 'مقياس المطابقة معروضٌ للدكتور')

assert.match(server, /style-dna\.mjs/, 'الخادم يقيس بالمسطرة نفسها')
assert.match(server, /ARTICLE_FAMILIES/, 'مستودع البُنى حاضر في الخادم')
assert.match(server, /ARTICLE_MODEL_PRIMARY = '@cf\/qwen\/qwen3-30b-a3b-fp8'/, 'النموذج الافتراضي هو الفائز في المفاضلة الحية')
assert.match(server, /if \(!revision\?\.body\) continue/, 'تعثّر جولةٍ لا يُلغي الجولات الباقية')
assert.match(server, /Number\.isFinite\(requestedWords\)/, 'عدد كلماتٍ غير صالح لا يصير NaN')
assert.match(studio, /wordCount\(bundle\.body\) < MIN_ARTICLE_WORDS\) return/, 'لا حزمة توزيع من محرّرٍ فارغ')
const gcloudignore = readFileSync(resolve(root, '.gcloudignore'), 'utf8')
assert.match(gcloudignore, /!src\/lib\/style-dna\.mjs/, 'الوحدة مشمولة في حزمة النشر — وإلا انهار dr-api عند الإقلاع')

/* ─── ٦) محاكاة الصوت: لا تمسخ، ولا تحقن، ولا تُنقِص ─── */
const {
  MIMIC_CANDIDATES, OWN_FLOOR, buildMimicLexicon, composeReviewed, contextSource, diffHunks, flexPattern, gateEdit, mimicVoice, wellFormedness,
} = await import(resolve(root, 'src/lib/style-mimic.mjs'))

/* السبب الجذري موثَّقاً كاختبارِ انحدار: `\b` في جافاسكربت لا ترى الحرف
   العربي، فكل طبقةٍ بُنيت عليها كانت ميتةً بصمت. */
assert.equal('الأمر مهم، بل هو حاسم'.replace(/،\s+(?=بل\b)/gu, '… '), 'الأمر مهم، بل هو حاسم', '`\\b` لا تطابق العربية — وهذا سبب «لا يتغيّر شيء»')
assert.notEqual('الأمر مهم، بل هو حاسم'.replace(new RegExp('،\\s+(?=بل(?![\\p{L}\\p{M}]))', 'gu'), '… '), 'الأمر مهم، بل هو حاسم', 'والحدّ العربي الصحيح يطابق')

const mimicOrtho = buildOrthographyIndex(archive)
const lexicon = buildMimicLexicon(archive)
assert.ok(lexicon.measured, 'المعجم لا يعمل إلا على أرشيفٍ مقيس')
assert.ok(lexicon.rules.length >= 30, `قواعد مأذونة (${lexicon.rules.length})`)

/* ★ لا يُمنع ما يكتبه هو: كل مرشحٍ بلغ ثلاثاً في سياقه محميّ. */
const corpusText = bareText(archive.map((item) => item.body).join('\n\n'))
for (const rule of lexicon.rules) {
  const own = (corpusText.match(new RegExp(contextSource(rule), 'gu')) || []).length
  assert.ok(own < OWN_FLOOR, `«${rule.phrase}» لا تُمسّ إلا وهي دون عتبته (${own})`)
}
for (const guard of lexicon.guarded) {
  assert.ok(guard.own >= OWN_FLOOR, `«${guard.phrase}» محميّة لأنه يكتبها (${guard.own})`)
}
assert.ok(lexicon.guarded.length > 0, 'وبعض المرشحين عادةٌ له فعلاً — وإلا فالقياس معطَّل')

/* ★ لا يُحقن ما لم يكتبه: كل بديلٍ مأذونٍ به مقيسٌ في متنه. */
for (const rule of lexicon.rules.filter((item) => item.swap)) {
  const swapCount = (corpusText.match(new RegExp(flexPattern(rule.swap), 'gu')) || []).length
  assert.ok(swapCount >= OWN_FLOOR, `البديل «${rule.swap}» من متنه (${swapCount} مرة)`)
}
/* والعبارات التي كانت المحاكاة القديمة تحقنها باسمه: صفرٌ في ٥٣ ألف كلمة. */
for (const ghost of ['الواقع أن', 'الظاهر أن', 'من هنا', 'يؤثر جوهرياً', 'أثراً عميقاً']) {
  const count = (corpusText.match(new RegExp(flexPattern(ghost), 'gu')) || []).length
  assert.ok(count < OWN_FLOOR, `«${ghost}» ليست من متنه (${count}) فلا تدخله`)
  assert.ok(!MIMIC_CANDIDATES.some((item) => item.swap === ghost), `«${ghost}» ليست بديلاً مأذوناً`)
}

/* ★ على نصّه هو: لا تنقص درجته، ولا تكسر تركيبه، ولا تتغيّر بتمريرةٍ ثانية. */
let mimicDrop = 0
let mimicBreak = 0
let mimicUnstable = 0
let mimicIntruder = 0
const contentSet = (value) => new Set(bareText(value).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(Boolean)
  .map((token) => (/^[وف][\p{L}]{2,}$/u.test(token) ? token.slice(1) : token)))
for (const item of archive) {
  const result = mimicVoice(item.body, dna, { orthography: mimicOrtho, lexicon })
  if (result.after.score < result.before.score) mimicDrop += 1
  const shapeBefore = wellFormedness(item.body)
  const shapeAfter = wellFormedness(result.text)
  for (const key of ['doubled', 'doubledPreposition', 'orphans', 'stackedConnectives']) {
    if (shapeAfter[key] > shapeBefore[key]) { mimicBreak += 1; break }
  }
  if (mimicVoice(result.text, dna, { orthography: mimicOrtho, lexicon }).text !== result.text) mimicUnstable += 1
  const allowed = contentSet(`${item.body} ${lexicon.rules.map((rule) => rule.swap || '').join(' ')}`)
  for (const token of contentSet(result.text)) {
    if (!allowed.has(token)) { mimicIntruder += 1; break }
  }
}
assert.equal(mimicDrop, 0, 'المحاكاة لا تنقص درجة أيٍّ من مقالاته')
assert.equal(mimicBreak, 0, 'ولا تكسر تركيب أيٍّ منها')
assert.equal(mimicUnstable, 0, 'ونتيجتها ثابتة: تمريرةٌ ثانية لا تغيّر حرفاً')
assert.equal(mimicIntruder, 0, 'ولا تُدخل كلمةً واحدة ليست في نصه أو في متنه')

/* ★ على مسودة نموذج: تُصلح فعلاً، وتشرح، وتمتنع عمّا لا تُحسنه. */
const mimicked = mimicVoice(generic, dna, { orthography: mimicOrtho, lexicon, archive })
assert.ok(mimicked.changes.length >= 4, `المحاكاة تُحدث أثراً على مسودة نموذج (${mimicked.changes.length} تعديلاً)`)
assert.ok(mimicked.after.raw - mimicked.before.raw >= 10, `والمطابقة ترتفع فعلاً (${mimicked.before.raw}٪ ← ${mimicked.after.raw}٪)`)
assert.ok(mimicked.changes.every((change) => change.reason && change.paragraph >= 1), 'ولكل تعديلٍ سببٌ وموضع')
assert.ok(mimicked.pending.length > 0, 'وما لا حذف آمن له يُرفع للدكتور لا يُمسخ')
assert.equal(wellFormedness(mimicked.text).doubledPreposition, 0, 'ولا حرف جرٍّ مكرر في المخرَج')
assert.equal(wellFormedness(mimicked.text).stackedConnectives, 0, 'ولا رابطين مرصوصين')
assert.equal((mimicked.text.match(/\d+/g) || []).join('|'), (generic.match(/\d+/g) || []).join('|'), 'ولا رقم يتغيّر')

/* ★ البوابة ترفض التمسيخ الذي كان يمرّ: هذه عيّناتٌ حرفية من مخرَج المحاكاة القديمة. */
assert.equal(gateEdit('أحدث تحولاً في التعليم', 'أحدث تحولاً في في التعليم').ok, false, 'البوابة ترفض تكرار حرف الجر')
assert.equal(gateEdit('نحتاج أن نتعامل معه', 'نحتاج اليوم أن أن نتعامل معه').ok, false, 'وتكرار الكلمة')
assert.equal(gateEdit('يشهدها العالم', 'يشهدها العالم كمجرد ا لتحولات').ok, false, 'وإدخال كلماتٍ ليست في النص')
assert.equal(gateEdit('نسبة 42% من الطلاب', 'نسبة 38% من الطلاب').ok, false, 'ومسّ الأرقام')

/* ★ والحَكَم نفسه لم يعد يمدح نصاً مكسوراً: هذا مخرَج المحاكاة القديمة حرفياً. */
const mutilated = `التعليم الرقمي في في تشكيل مستقبل الأجيال، وهو وهذا ما يضعنا أمام من الضروري إعادة النظر… ثم فإن هذه المنصات توفر تقارير دقيقة تساعد المعلم على متابعة كل طالب.

ونحتاج اليوم أن أن نتعامل معه بوعي… بل هو أداة مساندة تحتاج إلى بيئة داعمة كي تؤتي ثمارها، ونجاح التجربة يتوقف على تكامل الأدوار بين المدرسة والبيت.

وهذا التحول قد أحدث تحولاً في طرق التدريس والتعلم، وهو ما يفرض على المؤسسات مواكبة هذه التغيرات والاستفادة منها.`
const mutilatedVerdict = judgeStyle(mutilated, dna)
assert.ok(mutilatedVerdict.fatal.some((line) => line.includes('تركيبٌ مكسور')), 'التركيب المكسور تحفّظٌ قاطع')
assert.ok(mutilatedVerdict.score <= 55, `والنصّ الممسوخ لا يتجاوز السقف (${mutilatedVerdict.score}٪ — وكان ٨٧٪)`)

/* ★ ومع ذلك لا يرسب صاحب الأسلوب في هذا الفحص الجديد ولا مرة. */
const shapeFailures = archive.filter((item) => (judgeStyle(item.body, dna).checks.find((check) => check.key === 'wellFormed')?.grade ?? 1) < 1).length
assert.equal(shapeFailures, 0, 'ولا يسقط في «سلامة التركيب» أيٌّ من مقالاته الـ143')

/* ★ والمسخ القديم لم يبقَ له أثرٌ في فاحص الأسلوب. */
const checker = readFileSync(resolve(root, 'src/components/admin/StyleChecker.tsx'), 'utf8')
assert.doesNotMatch(checker, /function mimicAuthorVoice/, 'محرك المسخ القديم حُذف من الفاحص')
assert.doesNotMatch(checker, /فكيف نوظف هذا الوعي قبل أن يفوت الأوان/, 'وسؤال الخاتمة المعلَّب حُذف — لا جملة تُكتب باسمه لم يكتبها')
assert.doesNotMatch(checker, /'الواقع أن '/, 'ولا تُحقن عبارةٌ ليست من متنه')
assert.doesNotMatch(checker, /text\.replace\([^)]*\\b/, 'ولا تحويلَ نصٍّ مبنيّاً على حدّ الكلمة اللاتيني')
assert.match(checker, /data-mimic-log="true"/, 'وسجل المحاكاة معروضٌ للدكتور')
assert.match(checker, /undoMimic/, 'والتراجع بضغطة')
assert.match(checker, /style-mimic\.mjs/, 'والفاحص يستورد المحرك المقيس')

/* ★ الصوت الجمعي يُقاس صرفاً من متنه لا بقائمةٍ مكتوبة باليد. */
assert.ok(dna.collectiveVerbs.length >= 150, `أفعال الصوت الجمعي مشتقّة من متنه (${dna.collectiveVerbs.length})`)
for (const verb of ['نتعامل', 'نعمل', 'نتساءل', 'نريد']) {
  assert.ok(dna.collectiveVerbs.includes(verb), `«${verb}» صوتٌ جمعيّ ولم تكن القائمة القديمة تراه`)
}
assert.ok(!dna.collectiveVerbs.includes('نظام'), 'و«نظام» ليست فعلاً')
assert.ok(dna.hinges.length >= 10 && dna.hinges.includes('بل'), 'ومفاصل الكسر مقيسةٌ من مواضع فاصلته')

/* ─── ٦) المعايرة على أرشيفه: العتبة وحدود الطبيعية تُشتقّ من مقالاته ─── */
const calibration = calibrateStyle(archive, dna, { orthography: mimicOrtho })
assert.ok(calibration.measured && calibration.sampleSize === archive.length, `المعايرة على أرشيفه كله (${calibration.sampleSize})`)
assert.ok(calibration.threshold >= 70 && calibration.threshold <= 85, `العتبة المعايَرة ${calibration.threshold}٪ داخل حدّيها`)
/* تُقاس المقالات بالشروط نفسها التي عويِرت بها العتبة (معجم الإملاء حاضر)؛ القياس بشرطين مختلفين كان يحرّك النسبة مع كل وزنٍ جديد. */
const styleFit = archive.filter((item) => judgeStyle(item.body, dna, { orthography: mimicOrtho }).raw >= calibration.threshold).length / archive.length
assert.ok(styleFit >= .88, `تسعة أعشار مقالاته تعبر العتبة أسلوباً (${(styleFit * 100).toFixed(0)}٪) — وما دونها يسقط بالبوابات القاطعة لا بالمسطرة`)
const genericRank = percentileRank(calibration.raw, genericVerdict.raw)
assert.ok(genericRank <= 5, `مقال النموذج العام أدنى من ٩٥٪ من مقالاته (رتبته ${genericRank})`)
assert.equal(percentileRank([], 50), null, 'ولا رتبة بلا توزيع')
assert.equal(percentileRank([10, 20, 30, 40], 25), 50, 'والرتبة نسبةُ ما دونها')
const genericNatural = judgeNaturalness(judgeStyle(generic, dna, { orthography: mimicOrtho }), calibration)
assert.equal(genericNatural.level, 'machine', `طبيعية النموذج العام ${genericNatural.score}٪ تُصنَّف آثار صياغة آلية (العتبتان كانتا تسمّيانها «لمسة بشرية»)`)
const ownNatural = archive.filter((item) => judgeNaturalness(judgeStyle(item.body, dna, { orthography: mimicOrtho }), calibration).level === 'natural').length / archive.length
assert.ok(ownNatural >= .88, `ومقالاته طبيعيةٌ بمسطرتها (${(ownNatural * 100).toFixed(0)}٪)`)
assert.ok(calibrateStyle(archive.slice(0, 5), dna).threshold === 80, 'وأرشيفٌ أصغر من أن يُعايَر يعود إلى العتبة المعروفة')

/* ─── ٧) فاءُ الجواب لا تبقى معلّقة بعد حذف رابطها ─── */
assert.doesNotMatch(mimicked.text, /(?:^|[.؟!…]\s+)فإن(?![\p{L}\p{M}])/mu, '«بالإضافة إلى ذلك، فإن…» لا تصير «فإن…» معلّقة')
assert.match(mimicked.text, /(?:^|[.؟!…]\s+)إن سهولة/mu, 'بل «إن سهولة…» سليمة')

/* ─── ٨) المراجعة المقطعية: كل تعديلٍ يُقبل أو يُردّ وحده ─── */
const reviewHunks = diffHunks(generic, mimicked.text)
assert.ok(reviewHunks.length >= mimicked.changes.length - 2, `المقاطع تغطي التعديلات (${reviewHunks.length})`)
assert.equal(composeReviewed(generic, mimicked.text, reviewHunks, []), mimicked.text, 'قبول الكل = المحاكاة')
assert.equal(composeReviewed(generic, mimicked.text, reviewHunks, reviewHunks.map((hunk) => hunk.id)), generic, 'ردّ الكل = الأصل حرفاً')
const oneBack = composeReviewed(generic, mimicked.text, reviewHunks, [reviewHunks[0].id])
assert.ok(oneBack.includes(reviewHunks[0].from.trim()) && oneBack !== mimicked.text, 'ردّ مقطعٍ واحد يعيده وحده')
assert.deepEqual(diffHunks('نص واحد', 'نص واحد'), [], 'ولا مقاطع بلا فرق')
for (const item of archive.slice(0, 40)) {
  const result = mimicVoice(item.body, dna, { orthography: mimicOrtho, lexicon })
  const pieces = diffHunks(item.body, result.text)
  assert.equal(composeReviewed(item.body, result.text, pieces, pieces.map((hunk) => hunk.id)), item.body, 'الردّ الكامل يعيد مقاله حرفاً')
}
assert.match(checker, /data-mimic-review="true"/, 'والمراجعة المقطعية معروضة')
assert.match(checker, /calibrateStyle/, 'والفاحص يعايِر عتبته من أرشيفه')
assert.doesNotMatch(checker, /143/, 'ولا عددَ مقالاتٍ مكتوباً باليد في الفاحص')

/* ─── ٢٥ سبتمبر ٢٠٢٦: مطالعه بنسبه، ولا حوار مصنوع ولا عامية بين «…» ─── */
/* حَكَمٌ أعمى فرّق مقالاته من المحاكاة بمطالع «ليست المشكلة…» وبألفاظ الخطط نفسها
   («المفارقة»، «المعيار»، «البديل») وبحوارٍ مصنوع وعاميةٍ مصطنعة. */
assert.equal(openingMove('ليس كلُّ ما نقيسه في المدرسة يستحق أن يُقاس.'), 'negation')
assert.equal(openingMove('نحن نربّي أبناءنا على الخوف من الخطأ… ثم نطلب منهم الإبداع.'), 'we')
assert.equal(openingMove('تظهر الدرجات على الشاشة، ويصمت البيت.'), 'scene')
assert.equal(openingMove('هل نعلّم أبناءنا أن يفكروا؟ أم أن يجيبوا؟'), 'question')
assert.equal(openingMove('نقول: «عادي»… ونمضي.'), 'quote')
assert.equal(openingMove('الامتحان الذي يخيف الطالب لا يقيس ما يعرفه… بل ما يخافه.'), 'thesis')
const openingShares = eraDna.recent.openingShares
assert.ok(Math.abs(OPENING_MOVES.reduce((sum, move) => sum + (openingShares[move] || 0), 0) - 1) < .03, `نسب المطالع تامّة (${JSON.stringify(openingShares)})`)
assert.ok(openingShares.thesis + openingShares.scene >= .4 && openingShares.negation <= .25, `مطالعه أطروحةٌ ومشهد قبل النفي (${JSON.stringify(openingShares)})`)
const firstPicks = {}
for (let index = 0; index < 600; index += 1) {
  const [first, second] = chooseFamilies(`فكرة رقم ${index} عن التعليم`, index % 7, openingShares)
  assert.notEqual(first.id, second.id, 'خياران مختلفان لا نسختان')
  firstPicks[first.move] = (firstPicks[first.move] || 0) + 1
}
for (const move of OPENING_MOVES) {
  const got = (firstPicks[move] || 0) / 600
  assert.ok(Math.abs(got - (openingShares[move] || 0)) <= .07, `المطلع «${move}» بنسبه (${got.toFixed(2)} مقابل ${openingShares[move]})`)
}
const familiesBlock = server.slice(server.indexOf('const ARTICLE_FAMILIES = ['), server.indexOf('const FALLBACK_OPENING_SHARES'))
for (const word of ['المعيار', 'المفارقة', 'البديل', 'كويتيةً']) assert.ok(!familiesBlock.includes(word), `خطط البناء لا تسلّم الكاتب لفظ «${word}»`)
assert.match(familiesBlock, /لا تستعمل الصيغة الجاهزة «ليست المشكلة/, 'والنفي يُصاغ من الفكرة لا من القالب')
assert.doesNotMatch(server, /ثم معيار، ثم دليل/, 'ولا «ثم معيار» في قواعد المضمون')
assert.doesNotMatch(server, /وقد تمرّ عبارةٌ كويتية/, 'ولا دعوة إلى العامية بين «…»')
assert.doesNotMatch(server, /تظهر النتيجة، يتغيّر شكل البيت/, 'ولا مطلعٌ من مقالاته مثالاً يُستنسخ')

const invented = [
  'تُعلَّق الشهادة على الثلاجة، ويصمت البيت كله…لكن الصمت لا يعني الرضا.',
  'يسأل الأب ابنه: «وين وصلت؟» فيجيب: «ما أدري…خلصت».',
  'نحن نربّي أبناءنا على السباق؛ ثم نسأل لماذا تعبوا.',
  'والمدرسة لا تصنع هذا وحدها. نحن نصنعه كل مساء حين نسأل عن الدرجة قبل أن نسأل عن اليوم، وحين نقيس التعب بعدد الساعات لا بما بقي في القلب…',
  'وربما يبدأ التعلّم الحقيقي يوم نكفّ عن العدّ.',
].join('\n\n')
const inventedVerdict = judgeStyle(invented, eraDna, { generated: true })
assert.ok(inventedVerdict.checks.find((check) => check.key === 'currentVoice')?.grade < 1, 'الحوار المصنوع والعامية بين «…» يُنقصان المسودة المولَّدة')
assert.ok(inventedVerdict.corrections.some((line) => line.includes('احذف الحوار المختلق')), 'ومع الحوار أمر إصلاحٍ محدد')
assert.ok(inventedVerdict.corrections.some((line) => line.includes('الجملة العامية')), 'والعامية تُردّ إلى الفصحى')
assert.ok(!judgeStyle(invented, eraDna).corrections.some((line) => line.includes('الحوار المختلق') || line.includes('الجملة العامية')), 'وما يكتبه هو بيده لا يُحاسَب')
const fromHim = judgeStyle(invented, eraDna, { generated: true, authorMaterial: 'سألت ابني بعد الامتحان: «وين وصلت؟» فقال: «ما أدري…خلصت».' })
assert.ok(!fromHim.corrections.some((line) => line.includes('الحوار المختلق') || line.includes('الجملة العامية')), 'وما جاء من مادته هو لا يُحاسَب')
const inventedStory = 'حدثتني معلمةٌ عن طالبٍ لا يسأل…والسؤال عنده خوف.\n\nنحن نربّي أبناءنا على الإجابة؛ لا على السؤال. والمدرسة لا تصنع هذا وحدها: نحن نصنعه كل مساء حين نسأل عن الدرجة قبل أن نسأل عن اليوم، وحين نقيس التعب بعدد الساعات لا بما بقي في القلب…\n\nوربما يبدأ التعلّم الحقيقي يوم نكفّ عن العدّ.'
assert.ok(judgeStyle(inventedStory, eraDna, { generated: true, authorMaterial: 'دراسة Lally et al. (2010): نحو 66 يوماً لتكوين العادة.' }).corrections.some((line) => line.includes('الحكاية الشخصية المختلقة')), 'ومادةٌ بلا حكاية لا تجيز حكايةً مختلقة')
const hisDialect = dated.filter((item) => judgeStyle(item.body, eraDna, { generated: true }).corrections.some((line) => line.includes('الجملة العامية'))).length
assert.equal(hisDialect, 0, 'ولا جملة عامية بين «…» في مقالاته كلها: الكاشف لا يتّهمه')
assert.ok(unsupportedClaims('في محاضرة الأحد رفع ٤٢٪ من الطلاب أيديهم.', ['رفع ٤٢٪ من طلابي أيديهم في محاضرة الأحد']).length === 0, 'ورقمه من مادته مُسنَد')

let sawMaterial = false
await generatePerfectArticle({ ...input, material: 'في محاضرة الأحد سألت طلابي: لماذا تتعلّمون؟ فقال أحدهم: «من أجل الشهادة».' }, async (url, init) => {
  if (!String(url).includes('api.cloudflare.com')) return { ok: false, status: 503, json: async () => ({}) }
  const text = JSON.parse(init.body).messages.map((message) => message.content || '').join('\n')
  if (text.includes('"من_عندك":"في محاضرة الأحد') && text.includes('«من_عندك» إن وصل')) sawMaterial = true
  return makeResponse(strongBody)
})
assert.ok(sawMaterial, 'مادته تصل الكاتب ومعها قاعدتها')
assert.match(studio, /material: material\.trim\(\)/, 'حقل مادته موصولٌ بطلب الكتابة')
assert.match(studio, /authorMaterial: bundle\.authorMaterial \|\| ''/, 'وحَكَم الاستوديو يعرف ما جاء منه')

const CHANGE_COUNT_FORMS = { one: 'تعديل واحد', two: 'تعديلين', few: 'تعديلات', many: 'تعديلاً' }
const PLACE_COUNT_FORMS = { one: 'موضع واحد', two: 'موضعين', few: 'مواضع', many: 'موضعاً' }
console.log(`حَكَم الأسلوب: خضراء ✓  ·  مقالاته وسيط ${median}٪ (متوسط ${average.toFixed(1)}٪، عبور ${(passRate * 100).toFixed(0)}٪ بالبوابات، ${(styleFit * 100).toFixed(0)}٪ أسلوباً)`)
console.log(`المعايرة: العتبة ${calibration.threshold}٪ · الطبيعية ≥ ${calibration.naturalFloor}٪ (آلية دون ${calibration.machineFloor}٪) · النموذج العام في الرتبة ${genericRank} وطبيعيته ${genericNatural.score}٪`)
console.log(`الفرز: نموذج عام ${genericVerdict.score}٪ · القالب القديم ${legacyVerdict.score}٪ · المسلَّم بعد التصحيح ${article.style.score}٪`)
console.log(`المحاكاة: ${lexicon.rules.length} قاعدة مأذونة و${lexicon.guarded.length} محميّة · على مسودة نموذج ${mimicked.before.raw}٪ ← ${mimicked.after.raw}٪ بـ${arabicCountPhrase(mimicked.changes.length, CHANGE_COUNT_FORMS)} و${arabicCountPhrase(mimicked.pending.length, PLACE_COUNT_FORMS)} رُفعت للدكتور · ${arabicCountPhrase(reviewHunks.length, { one: 'مقطع', two: 'مقطعان', few: 'مقاطع', many: 'مقطعاً' })} للمراجعة · وعلى مقالاته: صفر انخفاض وصفر كسر وصفر تذبذب`)
