import assert from 'node:assert/strict'
import {
  buildAtlas, visualPotential, familyHintFor, estimateFor, stableHash,
  entryFromArticle, entryFromPaper, entryFromBook, ATLAS_KIND_LABEL,
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

console.log(`✓ اجتاز أطلس القصص البصرية ${checks} فحصاً`)
