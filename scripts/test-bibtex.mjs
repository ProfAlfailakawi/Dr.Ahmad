#!/usr/bin/env node
/**
 * اختبارات مولّد BibTeX — الحالات الأربع عشرة المطلوبة.
 *
 * تُستورد `src/lib/bibtex.ts` مباشرةً لأن Node 24 يشغّل TypeScript بلا تصريف؛
 * ولا يجوز تعليق الاختبار على مسار typescript مثبّت في بيئة CI بعينها.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const {
  buildBibTeX, buildBibTeXFile, bibtexAuthors, bibtexAuthorName,
  createBibTeXKey, inferBibTeXType, safeCitationFilename,
} = await import(new URL('../src/lib/bibtex.ts', import.meta.url).href)

let passed = 0
const test = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`) }
const fieldOf = (entry, field) => entry.match(new RegExp(`^\\s*${field} = \\{([\\s\\S]*?)\\},$`, 'm'))?.[1] ?? null

console.log('اختبارات BibTeX:')

/* 1 — بحث إنجليزي كامل البيانات */
const english = buildBibTeX({
  type: 'article', id: 'ed-tech-2024', authors: ['Ahmad Hussain Alfailakawi', 'Jane Q. Doe'],
  title: 'Educational Technology and AI in Gulf Schools', journal: 'Journal of Learning Design',
  year: 2024, volume: 12, number: 3, pages: '45--67', doi: '10.1234/jld.2024.12',
  url: 'https://example.org/jld/12', issn: '1234-5678', language: 'en',
})
test('بحث إنجليزي كامل البيانات', () => {
  assert.match(english, /^@article\{/)
  for (const field of ['author', 'title', 'journal', 'year', 'volume', 'number', 'pages', 'doi', 'url', 'issn', 'language']) {
    assert.ok(fieldOf(english, field), `الحقل ${field} مفقود`)
  }
  assert.equal(fieldOf(english, 'pages'), '45--67')
})

/* 2 — بحث عربي: لا تشويه ولا تحويل إلى ASCII */
const arabic = buildBibTeX({
  type: 'article', id: 'tech-ar', authors: 'أحمد حسين الفيلكاوي',
  title: 'موسوعة تكنولوجيا التعليم: رؤية تطبيقية', journal: 'المجلة التربوية',
  year: '٢٠٢٦', language: 'ar',
})
test('بحث عربي بلا تشويه', () => {
  assert.ok(arabic.includes('موسوعة تكنولوجيا التعليم: رؤية تطبيقية'))
  assert.ok(arabic.includes('{أحمد حسين الفيلكاوي}'), 'الاسم العربي يُلفّ ولا يُقلب')
  assert.ok(!/[?]{2,}/.test(arabic))
  assert.match(arabic, /^@article\{Alfylkawy2026/u, 'المفتاح لاتيني ثابت والسنة العربية-الهندية مقروءة')
})

/* 3 — مؤلف واحد */
test('مؤلف واحد', () => {
  assert.equal(bibtexAuthors('Ahmad Alfailakawi'), 'Alfailakawi, Ahmad')
  assert.equal(bibtexAuthors(['أحمد الفيلكاوي']), '{أحمد الفيلكاوي}')
  assert.ok(!bibtexAuthors('Ahmad Alfailakawi').includes(' and '))
})

/* 4 — عدة مؤلفين بصيغ فصل مختلفة */
test('عدة مؤلفين موصولين بـ and', () => {
  assert.equal(bibtexAuthors('Ahmad Alfailakawi; Jane Doe'), 'Alfailakawi, Ahmad and Doe, Jane')
  assert.equal(bibtexAuthors('Ahmad Alfailakawi and Jane Doe'), 'Alfailakawi, Ahmad and Doe, Jane')
  assert.equal(bibtexAuthors('أحمد الفيلكاوي و سارة العنزي'), '{أحمد الفيلكاوي} and {سارة العنزي}')
  assert.equal(bibtexAuthorName('Ludwig van Beethoven'), 'van Beethoven, Ludwig')
  assert.equal(bibtexAuthorName('العنزي، عبدالعزيز دخيل'), '{العنزي, عبدالعزيز دخيل}')
  assert.equal(bibtexAuthorName('Plato'), 'Plato', 'الاسم المفرد لا يُقلب')
})

/* 5 — DOI موجود */
test('DOI موجود يظهر كما هو', () => {
  assert.equal(fieldOf(english, 'doi'), '10.1234/jld.2024.12')
})

/* 6 — DOI غير موجود: لا يُختلق ولا يُكتب فارغاً */
test('DOI غير موجود لا يُكتب', () => {
  assert.equal(fieldOf(arabic, 'doi'), null)
  assert.ok(!arabic.includes('doi ='))
  assert.ok(!arabic.includes('undefined') && !arabic.includes('null'))
})

/* 7 — مجلة ومجلد وعدد وصفحات */
test('مجلة ومجلد وعدد وصفحات', () => {
  assert.equal(fieldOf(english, 'journal'), 'Journal of Learning Design')
  assert.equal(fieldOf(english, 'volume'), '12')
  assert.equal(fieldOf(english, 'number'), '3')
})

/* 8 — كتاب */
const book = buildBibTeX({
  type: 'book', id: 'encyclopedia', authors: 'أحمد حسين الفيلكاوي',
  title: 'موسوعة تكنولوجيا التعليم', year: 2026, publisher: 'دار المعرفة',
  address: 'الكويت', isbn: '978-9921-0-0000-0', journal: 'لا ينتمي للكتاب',
})
test('كتاب: ناشر وردمك بلا حقل مجلة', () => {
  assert.match(book, /^@book\{/)
  assert.equal(fieldOf(book, 'publisher'), 'دار المعرفة')
  assert.equal(fieldOf(book, 'isbn'), '978-9921-0-0000-0')
  assert.equal(fieldOf(book, 'journal'), null, 'المجلة لا تُكتب في كتاب')
})

/* 9 — أطروحة */
const thesis = buildBibTeX({
  type: 'phdthesis', id: 'phd-2016', authors: 'Ahmad Alfailakawi',
  title: 'Instructional Design in ICT Environments', year: 2016, publisher: 'University of Kuwait',
})
const masters = buildBibTeX({ type: 'mastersthesis', authors: 'Sara Alenezi', title: 'Blended Learning', year: 2019, publisher: 'Kuwait University' })
test('أطروحة دكتوراه وماجستير بحقل school', () => {
  assert.match(thesis, /^@phdthesis\{/)
  assert.equal(fieldOf(thesis, 'school'), 'University of Kuwait')
  assert.equal(fieldOf(thesis, 'publisher'), null)
  assert.match(masters, /^@mastersthesis\{/)
  assert.equal(inferBibTeXType({ kind: 'رسالة دكتوراه' }), 'phdthesis')
  assert.equal(inferBibTeXType({ container: 'مؤتمر تكنولوجيا التعليم' }), 'inproceedings')
  assert.equal(inferBibTeXType({ container: 'مجلة تربوية' }), 'article')
  assert.equal(inferBibTeXType({}), 'misc', 'لا نوع بلا دليل')
})

/* 10 — عنوان فيه أقواس ورموز خاصة */
const symbols = buildBibTeX({
  type: 'misc', authors: 'Ahmad Alfailakawi',
  title: 'التعليم {الرقمي} 100% & «التقويم» _ #هاشتاق ~ $ ^ \\ "اقتباس"\nسطر ثانٍ',
  year: 2025,
})
test('عنوان بأقواس ورموز وأسطر جديدة', () => {
  const title = fieldOf(symbols, 'title')
  assert.ok(title.includes('\\{الرقمي\\}'), 'الأقواس مهرّبة')
  assert.ok(title.includes('100\\%') && title.includes('\\&') && title.includes('\\_') && title.includes('\\#'))
  assert.ok(title.includes('\\textbackslash{}') && title.includes('\\textasciitilde{}') && title.includes('\\textasciicircum{}'))
  assert.ok(!title.includes('\n'), 'الأسطر الجديدة تُطوى')
  assert.ok(title.includes('“التقويم”'))
  const balance = [...symbols].reduce((depth, char) => depth + (char === '{' ? 1 : char === '}' ? -1 : 0), 0)
  assert.equal(balance, 0, 'الأقواس متوازنة')
})

/* 11 — الاختصارات تحفظ حالة أحرفها + المفتاح ثابت وبلا فراغ */
test('المفتاح ثابت وقابل للتوقع ويعالج التكرار', () => {
  const record = { type: 'article', id: 'ed-tech-2024', authors: 'Ahmad Alfailakawi', title: 'Educational Technology Review', year: 2024 }
  assert.equal(createBibTeXKey(record), 'Alfailakawi2024EducationalTechnology')
  assert.equal(createBibTeXKey(record), createBibTeXKey(record), 'لا يتغيّر بين استدعاءين')
  assert.ok(!/[^A-Za-z0-9]/.test(createBibTeXKey(record)), 'بلا فراغ ولا رموز')
  const taken = new Set()
  assert.equal(createBibTeXKey(record, taken), 'Alfailakawi2024EducationalTechnology')
  assert.equal(createBibTeXKey(record, taken), 'Alfailakawi2024EducationalTechnologya')
  assert.equal(createBibTeXKey(record, taken), 'Alfailakawi2024EducationalTechnologyb')
  assert.ok(fieldOf(english, 'title').includes('{AI}'), 'الاختصار محفوظ الحالة')
  assert.ok(buildBibTeXFile([record, record]).split('@article').length === 3)
})

/* 12 — اسم ملف التنزيل واضح وآمن */
test('اسم ملف .bib آمن وواضح', () => {
  assert.equal(safeCitationFilename('موسوعة تكنولوجيا التعليم', 'bib'), 'موسوعة تكنولوجيا التعليم.bib')
  assert.equal(safeCitationFilename('a/b\\c:d*e?f"g<h>i|j', 'bib'), 'a b c d e f g h i j.bib')
  assert.equal(safeCitationFilename('   ', 'bib'), 'citation.bib')
  assert.equal(safeCitationFilename('...hidden', 'bib'), 'hidden.bib')
  assert.ok(safeCitationFilename('x'.repeat(400), 'ris').endsWith('.ris'))
  assert.ok(safeCitationFilename('x'.repeat(400), 'ris').length <= 76)
})

/* 13 — لا حقول فارغة في أي مخرج */
test('لا حقول فارغة في أي مخرج', () => {
  for (const entry of [english, arabic, book, thesis, masters, symbols]) {
    assert.ok(!/= \{\},/.test(entry), 'حقل فارغ')
    assert.ok(!/undefined|null|NaN/.test(entry))
    assert.ok(entry.trim().endsWith('}'))
    assert.ok(!/,\s*$/.test(entry.trim()))
  }
})

/* 14 — RIS وبقية الصيغ باقية دون تغيير */
test('RIS وAPA وMLA وChicago باقية كما هي', () => {
  const extras = readFileSync(resolve(ROOT, 'src/components/extras.tsx'), 'utf8')
  assert.match(extras, /TY {2}- JOUR/, 'رأس RIS باقٍ')
  assert.match(extras, /application\/x-research-info-systems/, 'نوع ملف RIS باقٍ')
  assert.match(extras, /'ER {2}- '/, 'خاتمة RIS باقية')
  for (const style of ['apa', 'mla', 'chicago', 'bibtex']) assert.ok(extras.includes(`${style}:`), `النمط ${style} مفقود`)
  const copyCard = readFileSync(resolve(ROOT, 'src/components/CitationCopy.tsx'), 'utf8')
  assert.match(copyCard, /application\/x-bibtex/)
  assert.match(copyCard, /'apa', 'mla', 'bibtex'/)
})

console.log(`✓ BibTeX: ${passed}/14 حالة`)
