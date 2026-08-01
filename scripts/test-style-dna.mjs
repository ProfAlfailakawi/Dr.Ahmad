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
  BANNED_PHRASES, articleMetrics, countWords, judgeStyle, measureStyleDna,
  PROOFREAD_INSTRUCTION, acceptProofread, bareText, buildOrthographyIndex, deriveExcerpt,
  extractVoiceSignature, liftPauses, locateIssues, orthographySlips, polishTypography, refineToStyle,
  styleBrief, unsupportedClaims, verbatimOverlap, withVoiceMemory,
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
assert.ok(unstable <= 12, `الصقل شبه ثابت عبر تمريرين (${unstable} من ${archive.length}؛ كان ٣٧)`)
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
const { generatePerfectArticle } = await import(resolve(root, 'server.mjs'))

/* نصّان مصطنعان للاختبار: أحدهما بلغة النماذج، والآخر بإيقاعه. كُتبا هنا
   عمداً (لا مقتطفان من أرشيفه) كي يعبرا حارس النقل الحرفي. */
const weakBody = [
  'يعد الذكاء الاصطناعي من أهم التطورات التي يشهدها التعليم في هذه المرحلة الدقيقة من تاريخه الطويل، وهو ما يفرض على المؤسسات التعليمية أن تعيد النظر في أدواتها ومناهجها وسياساتها كافة، خصوصاً مع تسارع وتيرة التحول الرقمي في المنطقة العربية عموماً وفي دول الخليج خصوصاً.',
  'إن الاعتماد المتزايد على هذه الأدوات في إنجاز الواجبات المدرسية والبحوث الأكاديمية قد يؤدي إلى إضعاف مهارات التفكير المستقل لدى الطلاب، وهو ما يشكل تحدياً كبيراً أمام المؤسسات التي تسعى إلى بناء جيل قادر على الإبداع والابتكار ومواكبة متطلبات سوق العمل المتغيرة باستمرار.',
  'في الختام، إن الأمر يتوقف على طريقة الاستخدام وعلى وعي المعلم وولي الأمر بحدود الأداة وإمكاناتها، وعلى قدرة النظام التعليمي على وضع الضوابط الكفيلة بتحقيق التوازن المنشود بين الاستفادة من التقدم التقني والحفاظ على جوهر العملية التربوية.',
].join('\n\n')

const strongBody = [
  'دخل المعلّم الصفّ كعادته… لكن الأسئلة تغيّرت.',
  'قبل سنواتٍ كان الطالب يسأل: كيف أفهم هذا الدرس؟ اليوم يسأل سؤالاً آخر، أقصر وأخطر: من يجيب عني؟',
  'ليست المشكلة في الأداة… بل في الوعي الذي يقودها. الأداة لا تعرف الفرق بين طالبٍ يتعلّم وطالبٍ يهرب. نحن من نعرف.',
  'في ورقةٍ صحيحة تماماً، لا خطأ فيها ولا أثر ليدٍ مترددة، يغيب شيءٌ واحد: صاحبها. الورقة كاملة… والعقل غائب.',
  'نعم، أنجز الواجب. ونعم، حصل على الدرجة. لكن ما الذي بقي في رأسه بعد أن أُغلق الجهاز؟',
  'هنا يبدأ سؤالٌ لا تحلّه المناهج: ماذا نقيس حين نصحّح؟ نقيس المُخرَج أم نقيس الطريق إليه؟ الامتحان يقيس الأول… والتربية تعيش في الثاني.',
  'دعونا نصارح أنفسنا. نحن لم نُهزم أمام الآلة، ولم نُسبَق. نحن فقط اخترنا الأسهل حين صار متاحاً، ثم سمّيناه تطويراً.',
  'وأخطر ما في الأمر أنه هادئ. لا ضجيج، ولا احتجاج، ولا مشهد يستدعي القلق. طالبٌ راضٍ، ومعلّمٌ مطمئن، وأسرةٌ فخورة… وعقلٌ لم يُستعمل.',
  'ماذا لو غيّرنا السؤال؟ بدل «هل أنجز الواجب؟» نسأل: «ما الذي تغيّر فيه بعد أن أنجزه؟» سؤالٌ واحدٌ يعيد ترتيب الغرفة كلها.',
  'علينا أن نختار. ليس بيننا وبين التكنولوجيا عداوة… بل بيننا وبين الكسل الذي تسهّله حين نتركها بلا سؤال.',
  'ولن يحمينا في هذا كلّه منهجٌ جديد ولا نظامُ مراقبة. سيحمينا معلّمٌ يعرف طلابه واحداً واحداً، ويسمع في الجواب صوت صاحبه.',
  'وإن لم نفعل… فمن يبقى ليسأل؟',
].join('\n\n')

let cfCalls = 0
let sawCorrections = false
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
assert.match(studio, /bundle\.generatedBy \? \(liveStyleVerdict\?\.fatal \|\| \[\]\) : \[\]/, 'الحجب لما ولّده المحرك وحده')
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
assert.match(server, /clamp\(Math\.ceil\(targetWords \* 3\.2\), 1_200, 16_384\)/, 'سقف الرموز لم يعد يُلغي نفسه')
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

console.log(`حَكَم الأسلوب: خضراء ✓  ·  مقالاته وسيط ${median}٪ (متوسط ${average.toFixed(1)}٪، عبور ${(passRate * 100).toFixed(0)}٪)`)
console.log(`الفرز: نموذج عام ${genericVerdict.score}٪ · القالب القديم ${legacyVerdict.score}٪ · المسلَّم بعد التصحيح ${article.style.score}٪`)
