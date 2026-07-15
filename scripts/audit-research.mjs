import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SOURCE = path.join(ROOT, 'src/data/research-papers.ts')
const OUT = path.join(ROOT, 'reports/research-audit-report-ar.md')

function loadPapers() {
  const source = fs.readFileSync(SOURCE, 'utf8')
  const js = ts.transpile(source, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  })
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`).then((m) => m.researchPapers)
}

const papers = await loadPapers()
const errors = []
const warnings = []
const genericResearchGate = /researchgate\.net\/(?:profile|search|institution)(?:\/|$)/i
const genericScholar = /scholar\.google\.com\/(?:citations|scholar\?q=$)/i
const hasArabic = (value = '') => /[\u0600-\u06FF]/.test(value)
const isHttp = (value = '') => /^https?:\/\//i.test(value)

if (papers.length !== 19) errors.push(`عدد الأبحاث ${papers.length} وليس 19.`)
const slugs = new Set()
for (const [index, paper] of papers.entries()) {
  const n = index + 1
  if (!paper.slug || slugs.has(paper.slug)) errors.push(`البحث ${n}: slug مفقود أو مكرر.`)
  slugs.add(paper.slug)
  if (!paper.title?.trim()) errors.push(`البحث ${n}: العنوان مفقود.`)
  if (!paper.abstractAr?.trim() || !hasArabic(paper.abstractAr)) errors.push(`البحث ${n}: الملخص العربي مفقود.`)
  if (!paper.scholar || genericScholar.test(paper.scholar)) errors.push(`البحث ${n}: رابط Google Scholar ليس بحثاً محدداً.`)
  if (paper.researchgate && genericResearchGate.test(paper.researchgate)) errors.push(`البحث ${n}: رابط ResearchGate عام.`)
  if (paper.source && !isHttp(paper.source)) errors.push(`البحث ${n}: رابط الناشر غير صالح.`)
  if (paper.pdf && !(isHttp(paper.pdf) || paper.pdf.startsWith('/'))) errors.push(`البحث ${n}: رابط PDF غير صالح.`)
  if (paper.verification === 'needs-manual-review') warnings.push(`البحث ${n}: يحتاج مراجعة يدوية نهائية.`)
}

const pdfCount = papers.filter((p) => p.pdf).length
const sourceCount = papers.filter((p) => p.source).length
const rgCount = papers.filter((p) => p.researchgate).length
const manual = papers.filter((p) => p.verification === 'needs-manual-review')
const cvOnly = 'The Impact of the Use of the Internet on the Social Relations of Students at the Faculty of the Public Authority for Applied Education and Training in Kuwait'
const missingFromCv = [
  "University Students' Perceptions at the College of Basic Education Regarding the Use of Interactive Blackboard Technology in Education in Kuwait for the Academic Year 2020/2021",
  "Ms Teams’ Development Application Trends as a Quality Education in Light of The Epidemiological Challenges (Covid-19) In Kuwait",
]

const rows = papers.map((p, index) => {
  const authors = p.coAuthors ? `د. أحمد حسين الفيلكاوي؛ ${p.coAuthors}` : 'د. أحمد حسين الفيلكاوي'
  const pdf = p.pdf ? (p.pdf.startsWith('/') ? 'نسخة محلية داخل الموقع' : 'رابط PDF مباشر') : 'غير متاح كرابط مباشر'
  const status = p.verification === 'needs-manual-review' ? 'مراجعة يدوية' : 'متحقق'
  return `| ${index + 1} | ${p.title.replaceAll('|', '—')} | ${hasArabic(p.title) ? 'عربي' : 'إنجليزي'} | ${authors} | ${p.source ? 'نعم' : 'لا'} | ${pdf} | ${p.researchgate ? 'بحث محدد' : 'غير متاح'} | ${status} |`
}).join('\n')

const report = `# تقرير التدقيق الشامل للإنتاج العلمي

تاريخ التدقيق: 15 يوليو 2026

## الخلاصة التنفيذية

- جرى توحيد القائمة المعتمدة على **19 بحثاً** كما وردت في مستند الإنتاج العلمي المرفق.
- حُفظت العناوين العربية بالعربية، والعناوين الإنجليزية بالإنجليزية من دون ترجمة أو تعريب للعنوان.
- أضيف ملخص عربي أكاديمي لكل بحث.
- روابط Google Scholar هي روابط بحث بالعنوان نفسه، وليست رابط الملف العام.
- روابط ResearchGate الموجودة تقود إلى صفحة البحث نفسه، ولا توجد روابط ملف شخصي داخل سجلات الأبحاث.
- روابط الناشر المتاحة: **${sourceCount} من 19**.
- روابط PDF المباشرة أو المحلية المتاحة: **${pdfCount} من 19**.
- صفحات ResearchGate المحددة المتاحة: **${rgCount} من 19**.

> ملاحظة تقنية: النسخ المتاحة قانونياً داخل المشروع تبقى محلية، أما بقية ملفات PDF فترتبط مباشرة بملف الناشر المفتوح بدلاً من نسخها إلى الخادم بلا ترخيص واضح.

## الجرد التفصيلي

| # | العنوان الأصلي | لغة العنوان | الباحثون | الناشر | PDF | ResearchGate | الحالة |
|---:|---|---|---|---|---|---|---|
${rows}

## ما يحتاج استكمالاً يدوياً

1. **${manual[0]?.title || 'البحث رقم 18'}**
   - لم يظهر له رابط ناشر موثوق أو DOI أو ملف PDF مباشر في المصادر المتاحة.
   - بيانات المجلد والعدد والصفحات والملخص الأصلي وأسماء المشاركين تحتاج مطابقة مع نسخة النشر.

2. **بحثان موجودان في قائمة الإنتاج العلمي المرفقة ولم يظهر عنوانهما في نص السيرة الذاتية الإنجليزية الحالية:**
${missingFromCv.map((title) => `   - ${title}`).join('\n')}

3. **بحث ظاهر في السيرة الذاتية وغير موجود في قائمة الإنتاج العلمي المرفقة:**
   - ${cvOnly}
   - يلزم تحديد هل هو بحث منشور مستقل، أم عنوان قديم/بديل لبحث آخر، ثم تزويد المجلة والسنة والرابط.

4. بعض دور النشر تعرض زر PDF داخل صفحة المقال من دون رابط ثابت يمكن التحقق منه خارج الجلسة. في هذه الحالات أبقينا رابط صفحة الناشر، ولم ننشئ رابطاً متوهماً.

## نتيجة الفحص الآلي

- الأخطاء الحرجة: **${errors.length}**
- التنبيهات: **${warnings.length}**
${errors.length ? `\n### الأخطاء\n${errors.map((e) => `- ${e}`).join('\n')}` : '\nلم يُكتشف أي خطأ بنيوي حرج.'}
${warnings.length ? `\n### التنبيهات\n${warnings.map((w) => `- ${w}`).join('\n')}` : ''}
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, report, 'utf8')
console.log(`Research audit: ${papers.length} papers, ${pdfCount} PDF links, ${errors.length} errors, ${warnings.length} warnings.`)
if (errors.length) process.exitCode = 1
