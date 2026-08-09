#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findBookEvidence } from '../server.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8')
const manifest = JSON.parse(read('src/data/book-knowledge.json'))
const evidence = JSON.parse(read('src/data/book-evidence.json'))
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(manifest.coverage?.books === 9, 'الخريطة لا تحتوي الكتب التسعة')
expect(manifest.coverage?.pages === 1596, 'عدد الصفحات المفهرسة ليس ١٥٩٦')
expect(manifest.coverage?.complete === true, 'تغطية الخريطة غير مكتملة')
expect(evidence.coverage?.books === 9 && evidence.coverage?.pages === 1596, 'فهرس الخادم لا يطابق تغطية الخريطة')

const encyclopedia = manifest.books.find((book) => book.slug === 'encyclopedia')
expect(encyclopedia?.pageCount === 696, 'الموسوعة لا تغطي ٦٩٦ صفحة')
expect((encyclopedia?.concepts || []).length >= 24, 'الموسوعة لا تحمل خريطة أبواب وفصول كافية')
expect(/الجذر المرجعي/.test(encyclopedia?.role || ''), 'الموسوعة لا تتميز بوصفها الجذر المرجعي')

for (const book of manifest.books) {
  const serverBook = evidence.books.find((item) => item.slug === book.slug)
  expect(book.concepts.length >= 8, `${book.slug}: مفاهيم قليلة`)
  expect(book.questions.length >= 6, `${book.slug}: أسئلة الكتاب قليلة`)
  expect(serverBook?.chunks?.length >= 70, `${book.slug}: شواهد الخادم ناقصة`)
  expect(serverBook?.chunks?.every((chunk) => chunk.page >= 1 && chunk.page <= book.pageCount), `${book.slug}: رقم صفحة خارج النطاق`)
}

const forbidden = ['.pdf', '/Users/', 'PrivateBooks', 'localPath', 'fileName']
const manifestText = JSON.stringify(manifest)
const evidenceText = JSON.stringify(evidence)
for (const marker of forbidden) {
  expect(!manifestText.includes(marker), `الخريطة العامة تحمل الأثر الممنوع ${marker}`)
  expect(!evidenceText.includes(marker), `فهرس الخادم يحمل الأثر الممنوع ${marker}`)
}
expect(!manifestText.includes('"text"'), 'المتن دخل خريطة المتصفح العامة')

const queryCases = [
  ['حوكمة البيانات والخصوصية في الذكاء الاصطناعي', ['mega-data', 'encyclopedia']],
  ['أثر مشاهدة التلفاز على الطفل', ['kids-tech']],
  ['الواقع المعزز في التعليم', ['virtual-world', 'encyclopedia']],
  ['التكنولوجيا المساعدة لذوي الإعاقة', ['handy-tech']],
]
for (const [query, expectedSlugs] of queryCases) {
  const hits = findBookEvidence(query, 4)
  expect(hits.length > 0, `لا شاهد للسؤال: ${query}`)
  expect(hits.some((hit) => expectedSlugs.includes(hit.slug)), `المصدر غير مناسب للسؤال: ${query}`)
  expect(hits.every((hit) => hit.quote.length <= 700 && !hit.url.includes('.pdf')), `شاهد أو رابط غير آمن للسؤال: ${query}`)
}

const sourceChecks = [
  ['src/pages/Search.tsx', 'bestBookConcept'],
  ['src/pages/AskLibrary.tsx', 'bookKnowledgeText'],
  ['src/pages/ArticleDetail.tsx', 'bookKnowledgeAnchor'],
  ['src/pages/PaperDetail.tsx', 'الجذر النظري والامتداد في المؤلفات'],
  ['src/pages/MediaDetail.tsx', 'امتداد اللقاء'],
  ['src/components/BookWorld.tsx', 'خريطة مبنيّة من الكتاب'],
  ['src/pages/ThoughtPaths.tsx', 'bookKnowledgeText'],
  ['server.mjs', 'findBookEvidence'],
  /* الإنتاج يحمل الاقتباسات المقيسة المنشورة فقط؛ فهرس المتن الكامل محلي
     ومهمل من Git عمداً، فلا نعيد إدخاله إلى صورة Cloud Run عبر اختبار قديم. */
  ['Dockerfile', 'book-quotes.json'],
  ['.gcloudignore', '!src/data/book-quotes.json'],
]
for (const [file, marker] of sourceChecks) expect(read(file).includes(marker), `${file}: الربط المطلوب مفقود`)

const samplePdfMatches = [...read('src/data.ts').matchAll(/pdf:\s*'\/files\/[^']+\.pdf'/g)]
expect(samplePdfMatches.length >= 9, 'عينات الكتب المتفق عليها حُذفت أو نُقصت')

const collectSource = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name)
  return entry.isDirectory() ? collectSource(full) : /\.(?:ts|tsx)$/.test(entry.name) ? [full] : []
})
const publicImports = collectSource(resolve(ROOT, 'src')).filter((file) => readFileSync(file, 'utf8').includes('book-evidence.json'))
expect(publicImports.length === 0, `فهرس الخادم مستورد في React: ${publicImports.join(', ')}`)
expect(existsSync(resolve(ROOT, 'src/data/book-evidence.json')), 'فهرس أدلة الخادم غير موجود')

if (failures.length) {
  console.error('✘ اختبار تكامل معرفة الكتب:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('✔ معرفة الكتب: ٩ كتب · ١٥٩٦ صفحة · الموسوعة جذر مرجعي · بحث وعقل حي ومقال وبحث ولقاء ومسار مترابطة')
console.log('✔ لا PDF كامل ولا مسار محلي ولا متن داخل حزمة React؛ الشواهد النصية خادمية فقط')
