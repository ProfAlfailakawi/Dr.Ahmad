import assert from 'node:assert/strict'
import {
  buildAtlas, visualPotential, familyHintFor, estimateFor, stableHash,
  entryFromArticle, entryFromPaper, entryFromBook, ATLAS_KIND_LABEL,
  materialReadiness, ideaStrength, verbalSignals, boardStateOf,
} from '../src/lib/storyboard-atlas.ts'

let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

// 1) البصمة حتمية
check(stableHash('نفس النص') === stableHash('نفس النص'), 'stableHash ثابت لنفس المدخل')
check(stableHash('أ') !== stableHash('ب'), 'stableHash يميّز مدخلين')

// 2) الحساب: مادة غنية بقصّة وسؤال وصورة تتفوّق على مادة نحيلة
const rich = visualPotential({ kind: 'article', title: 'حين يصير السؤال باباً', excerpt: 'قصة تجربة', body: 'قصة '.repeat(200) + 'لماذا يصمت الطلاب؟ في المقابل نافذة تُفتح على الضوء' })
const thin = visualPotential({ kind: 'article', title: 'ملاحظة', excerpt: '', body: 'سطر واحد قصير' })
check(rich.potential > thin.potential, 'المادة الغنية أعلى إمكانية من النحيلة')
check(rich.potential <= 100 && thin.potential >= 0, 'الدرجة داخل [0,100]')
check(rich.reasons.length >= 3, 'المادة الغنية تُرفق أسباباً متعددة')

// 3) التظليل أقوى إشارة: رفع الدرجة
const noRes = visualPotential({ kind: 'article', title: 'ت', body: 'قصة '.repeat(120) })
const withRes = visualPotential({ kind: 'article', title: 'ت', body: 'قصة '.repeat(120), resonanceCount: 5 })
check(withRes.potential > noRes.potential, 'التظليل يرفع الإمكانية')

// 4) خريطة العوالم حتمية وصحيحة
check(familyHintFor({ title: 'الديوانية الكويتية' }) === 'kuwait-gulf', 'كويت → kuwait-gulf')
check(familyHintFor({ cat: 'تقنية', title: 'الذكاء والبيانات' }) === 'technology-data', 'تقنية → technology-data')
check(familyHintFor({ cat: 'بحث علمي', title: 'منهج ونظرية' }) === 'academic-knowledge', 'بحث → academic-knowledge')
check(familyHintFor({ title: 'صباح عادي' }) === 'editorial', 'الافتراضي editorial')

// 5) التقدير ضمن القيم المسموحة
for (const s of [estimateFor({ body: 'كلمة '.repeat(50) }), estimateFor({ body: 'دراسة نتيجة مقارنة أولاً ' + 'كلمة '.repeat(700) })]) {
  check([24, 48, 64].includes(s.seconds), 'ثوانٍ صحيحة')
  check(s.shots >= 1 && s.layers >= 1, 'لقطات وطبقات موجبة')
}

// 6) المُحوِّلات تنتج بذرة صالحة للمخرج الحي (النوع + متنٌ غير فارغ)
const artEntry = entryFromArticle({ slug: 'q-becomes-door', title: 'حين يصير السؤال باباً', excerpt: 'قصة', body: 'قصة '.repeat(200), cat: 'التفكير', year: '2024' })
const paperEntry = entryFromPaper({ slug: 'formative', title: 'أثر التقويم البنائي', abstractAr: 'ملخص طويل عن التقويم البنائي والتفكير الناقد', keyFinding: 'أثر إيجابي دال', researchQuestion: 'هل يؤثر التقويم البنائي؟', journal: 'مجلة محكّمة', year: '2021' })
const bookEntry = entryFromBook({ slug: 'skin-to-skin', title: 'من الجلدة إلى الجلدة', desc: 'في تشكيل العقل', longDescription: 'وصف مطوّل عن الكتاب وفكرته', whyWritten: 'كُتب ليجيب عن سؤال', toc: 'الفصل الأول؛ الفصل الثاني', year: '2019' })

for (const [name, e] of [['article', artEntry], ['paper', paperEntry], ['book', bookEntry]]) {
  check(e.seed.type === 'article_video', `${name}: نوع البذرة article_video`)
  check(e.seed.article.body.trim().length > 0, `${name}: متن البذرة غير فارغ`)
  check(e.seed.article.title.trim().length > 0, `${name}: عنوان البذرة موجود`)
  check(e.seed.article.slug === e.slug, `${name}: slug متطابق`)
  check(typeof ATLAS_KIND_LABEL[e.kind] === 'string', `${name}: لصيقة النوع بالعربية`)
}
check(paperEntry.seed.article.body.includes('التقويم البنائي'), 'بحث: المتن يجمع السؤال والنتيجة والملخّص')
check(bookEntry.seed.article.body.includes('كُتب') && bookEntry.seed.article.body.includes('الفصل'), 'كتاب: المتن يجمع سبب الكتابة والفهرس')

// 7) البناء يرتّب تنازلياً وحتمياً
const atlas = buildAtlas({
  articles: [
    { slug: 'thin', title: 'نحيل', excerpt: '', body: 'سطر', cat: 'عام', year: '2020' },
    { slug: 'rich', title: 'غني بقصة', excerpt: 'قصة', body: 'قصة '.repeat(200) + 'لماذا؟ نافذة', cat: 'التفكير', year: '2024' },
  ],
  papers: [{ slug: 'p1', title: 'بحث', abstractAr: 'ملخص كافٍ '.repeat(20), keyFinding: 'نتيجة', researchQuestion: 'سؤال', year: '2021' }],
  books: [{ slug: 'b1', title: 'كتاب', desc: 'وصف', longDescription: 'وصف مطوّل '.repeat(20), whyWritten: 'سبب', toc: 'فهرس', year: '2019' }],
})
check(atlas.length === 4, 'الأطلس يجمع كل الأنواع')
for (let i = 1; i < atlas.length; i += 1) check(atlas[i - 1].potential >= atlas[i].potential, 'مرتّب تنازلياً')
check(buildAtlas({ articles: [{ slug: 'rich', title: 'غني بقصة', excerpt: 'قصة', body: 'قصة '.repeat(200) + 'لماذا؟ نافذة', cat: 'التفكير', year: '2024' }] })[0].slug === 'rich', 'ثبات الترتيب عبر التشغيلات')

// 8) اكتمال المادة منفصل عن قوة الفكرة (العيب: «جاهزة للوحة» كانت تعني درجة أساس النوع + بضع كلمات)
const plainWords = (n) => Array.from({ length: n }, (_, i) => `كلمة${i}`).join(' ')
// مقال عادي بلا أي مؤشر لفظي: المادة كافية والفكرة ضعيفة → لا يُسمّى جاهزاً
const flat = visualPotential({ kind: 'article', title: 'ملاحظات إدارية', excerpt: '', body: plainWords(260) })
check(flat.material >= 80, `مادة طويلة → اكتمال مرتفع (${flat.material})`)
check(flat.idea === 20 && flat.board === 'needs-idea', `بلا مؤشرات فكرة → needs-idea لا ready (idea=${flat.idea}, board=${flat.board})`)
check(flat.ideaReasons.some((r) => r.includes('لا مؤشرات')), 'السبب يقول إنه لا مؤشرات لفظية')
// مادة نحيلة لكن فيها كل المؤشرات: فكرة قوية، مادة ناقصة → needs-material
const spark = visualPotential({ kind: 'article', title: 'لماذا يصمت الباب؟', excerpt: '', body: 'قصة قصيرة عن نافذة وضوء' })
check(spark.idea >= 65 && spark.material < 50 && spark.board === 'needs-material', `فكرة قوية ومادة ناقصة → needs-material (m=${spark.material}, i=${spark.idea})`)
// الاثنان معاً → ready
const both = visualPotential({ kind: 'article', title: 'لماذا يصمت الباب؟', excerpt: 'قصة', body: plainWords(240) + ' قصة نافذة وضوء؟' })
check(both.board === 'ready' && both.material >= 80 && both.idea >= 65, 'مادة كافية + فكرة بمؤشرات → ready')
// نوع العمل لم يعد يرفع الدرجة: بحثٌ وكتابٌ ومقالٌ بالنص نفسه → المادة والفكرة نفسهما
const same = ['article', 'paper', 'book'].map((kind) => visualPotential({ kind, title: 'ت', body: plainWords(130) }))
check(same.every((r) => r.material === same[0].material && r.idea === same[0].idea), 'درجة أساس النوع أُلغيت')
// حدّ الكلمات يمنع الجاهزية مهما بلغت الفكرة
check(boardStateOf(95, 100, 40) === 'needs-material', 'أقل من ٦٠ كلمة لا تكون جاهزة')
check(materialReadiness({ title: '', body: plainWords(130) }).material === 45, 'غياب العنوان يخصم ٢٠ (٦٥ − ٢٠)')

// 9) الإشارات اللفظية بمطابقة كلمة كاملة — لا جزء كلمة
check(!verbalSignals('أسباب هذه الطريقة في التعليم مختلفة').imagery, '«أسباب» لا تحوي «باب» و«طريقة» ليست «طريق»')
check(!verbalSignals('تحدّث عن الحديث والتحديث').narrative, '«حدث» داخل «تحدّث/الحديث» ليست حكاية')
check(!verbalSignals('حين نكتب نفكر').provoke, '«حين» وحدها ليست سؤالاً')
check(!verbalSignals('الكيفية المناسبة').provoke, '«الكيفية» ليست «كيف»')
check(verbalSignals('نظرتُ من النافذة إلى الضوء').imagery, 'نافذة وضوء بسابقة «ال»: ألفاظ حسية')
check(verbalSignals('وللباب مفتاح').imagery, 'سابقة «وللـ» تُجرَّد')
check(verbalSignals('وقفت أمام نوافذهم').imagery, 'جمع + ضمير يُجرَّدان')
check(verbalSignals('في المقابل تغيّر الأمر').narrative && verbalSignals('تجربتي مع الطلاب').narrative, 'عبارات وكلمات سردية')
check(verbalSignals('هل يتعلم الطالب؟').provoke && verbalSignals('كيف نبدأ').provoke && verbalSignals('ماذا لو غابت المدرسة').provoke, 'صيغ السؤال')
// مقالٌ واقعي كثير الكلمات الملتبسة لا يحصل على نقاط مجانية
const eduProse = 'أسباب ضعف التحصيل كثيرة، وهناك طريقة منهجية لمعالجتها. تحدثنا في الحديث السابق عن التحديث والتطوير في جداول المدارس ' + plainWords(150)
const eduScore = visualPotential({ kind: 'article', title: 'التحصيل الدراسي', body: eduProse })
check(eduScore.idea === 20, `نثر تعليمي ملتبس الكلمات لا ينال مؤشرات زائفة (idea=${eduScore.idea})`)
// الإدخالات تحمل الحقول الجديدة
for (const e of [artEntry, paperEntry, bookEntry]) {
  check(typeof e.material === 'number' && typeof e.idea === 'number' && ['ready', 'needs-idea', 'needs-material'].includes(e.board), 'كل إدخال يحمل material وidea وboard')
  check(e.materialReasons.length >= 1 && e.ideaReasons.length >= 1, 'وأسباب كل منهما')
}

console.log(`✓ اجتاز أطلس القصص البصرية ${checks} فحصاً`)
