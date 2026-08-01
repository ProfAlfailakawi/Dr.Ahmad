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
  polishTypography, refineToStyle, styleBrief, verbatimOverlap,
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

const filler = (count) => Array.from({ length: count }, (_, index) => ['التعليم', 'يتنفس', 'حين', 'يقود', 'المعلم', 'وعياً', 'راشداً', 'اليوم'][index % 8]).join(' ')
const weakBody = [
  `يعد الذكاء الاصطناعي من أهم التطورات التي يشهدها التعليم في هذه المرحلة الدقيقة من تاريخه الطويل، وهو ما يفرض على المؤسسات التعليمية أن تعيد النظر في أدواتها ومناهجها وسياساتها. ${filler(60)}`,
  `${filler(120)}`,
  `في الختام، إن الأمر يتوقف على طريقة الاستخدام. ${filler(120)}`,
].join('\n\n')
const strongBody = [
  'دخل المعلّم الصفّ كعادته…لكن الأسئلة تغيّرت.',
  'الطالب لا يسأل «كيف أفهم؟»…بل «من يجيب عني؟»',
  'ليست المشكلة في الأداة…بل في الوعي الذي يقودها.',
  `نحن أمام امتحانٍ جديد. هل نربّي عقلاً…أم نشتري إجابة؟ دعونا نصارح أنفسنا. ${filler(90)}`,
  `علينا أن نختار. ليس بيننا وبين التكنولوجيا عداوة…بل بيننا وبين الكسل. ${filler(80)}`,
  'وإن لم نفعل…فمن يبقى ليسأل؟',
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

/* ─── ٥) مصادر الاستوديو نظيفة من الحشو والقوالب ─── */
const studio = readFileSync(resolve(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
assert.doesNotMatch(studio, /والفكرة هنا ليست في مقاومة الجديد/, 'الحشو المُعلَّب حُذف من الاستوديو')
assert.doesNotMatch(studio, /وقد كتبت من قبل في/, 'قالب الاقتباس من عناوينه حُذف')
assert.doesNotMatch(studio, /function buildExactLocalArticle/, 'مُلفِّق المقال المحلي حُذف')
assert.doesNotMatch(studio, /function buildArticleDraft/, 'قالب الفراغات حُذف')
assert.match(studio, /styleDna/, 'البصمة تُرسل إلى المحرك')
assert.match(studio, /refineToStyle/, 'الصقل الحتمي مطبَّق على المسلَّم')
assert.match(studio, /data-style-fidelity="true"/, 'مقياس المطابقة معروضٌ للدكتور')

const server = readFileSync(resolve(root, 'server.mjs'), 'utf8')
assert.match(server, /style-dna\.mjs/, 'الخادم يقيس بالمسطرة نفسها')
assert.match(server, /ARTICLE_FAMILIES/, 'مستودع البُنى حاضر في الخادم')
const gcloudignore = readFileSync(resolve(root, '.gcloudignore'), 'utf8')
assert.match(gcloudignore, /!src\/lib\/style-dna\.mjs/, 'الوحدة مشمولة في حزمة النشر — وإلا انهار dr-api عند الإقلاع')

console.log(`حَكَم الأسلوب: خضراء ✓  ·  مقالاته وسيط ${median}٪ (متوسط ${average.toFixed(1)}٪، عبور ${(passRate * 100).toFixed(0)}٪)`)
console.log(`الفرز: نموذج عام ${genericVerdict.score}٪ · القالب القديم ${legacyVerdict.score}٪ · المسلَّم بعد التصحيح ${article.style.score}٪`)
