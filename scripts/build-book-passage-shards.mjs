#!/usr/bin/env node
/**
 * شرائح متون الكتب — كتابٌ واحد لكل قارئ.
 *
 * العطب الذي عالجته هذه الشريحة: `src/data/book-passages.json` ملفٌ واحد فيه
 * الكتب التسعة (١٣٣٤ ك.ب). فكان زائرُ «التلعيب» — وحاجته ٣٨ ك.ب — يحمّل
 * المتون التسعة كاملة؛ وزائرُ الموسوعة يحمّل ٥٠٧ ك.ب من كتبٍ لا يقرؤها.
 * وأسوأ من الحجم: تحليل ١٣٣٤ ك.ب من JSON يجمّد الخيط الرئيسي (قِيس ٢٣٨
 * مِلّي على حاسوبٍ سريع، وهو على الهاتف ثوانٍ).
 *
 * والنمط هنا هو نمط البيت نفسه: شرائح متون المقالات في
 * `public/archive/bodies/v1` (انظر src/lib/article-bodies.ts) — مُولَّدة وقت
 * البناء، خارج git، تُجلب بـfetch ومفتاحها `revision` فتُخزَّن أبداً.
 *
 * ويُسقط المولّد حقلين لا تقرؤهما الواجهة قط: `fingerprint` (٢١٤ ك.ب)
 * و`voice` (١٧ ك.ب) — كلاهما لأدوات البناء وحدها. ١٧٪ تُوفَّر بلا خسارة.
 *
 * الملف الأصل يبقى مكانه في src/data — حارس الكتب الخاصة يفحصه، ولا نمسّه.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'src', 'data', 'book-passages.json')
const OUTPUT_ROOT = join(ROOT, 'public', 'books', 'passages', 'v1')

/* الحقول التي تقرؤها الواجهة فعلاً. ما عداها لا يُشحن.
   (تحقّقتُ: لا مطابقة لـpassage.fingerprint ولا passage.voice في src كلها.) */
const CLIENT_FIELDS = ['id', 'text', 'page', 'section', 'conceptId', 'conceptTitle']

if (!existsSync(SOURCE)) {
  console.error('✘ شرائح المتون: المصدر مفقود src/data/book-passages.json — شغّل npm run books:quotes')
  process.exit(1)
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const books = Array.isArray(source?.books) ? source.books : []
if (!books.length) {
  console.error('✘ شرائح المتون: لا كتب في المصدر')
  process.exit(1)
}

const slimPassage = (passage) => {
  const slim = {}
  for (const field of CLIENT_FIELDS) {
    if (passage[field] !== undefined && passage[field] !== null && passage[field] !== '') slim[field] = passage[field]
  }
  return slim
}

/* المراجعة تُشتقّ من المحتوى المشحون نفسه: تغيّر حرفٌ ⇒ تغيّر المسار ⇒
   لا شريحةً قديمة تعيش في ذاكرة متصفّح. */
const shards = books.map((book) => ({
  slug: String(book.slug || ''),
  title: String(book.title || ''),
  year: String(book.year || ''),
  passages: (Array.isArray(book.passages) ? book.passages : []).map(slimPassage),
})).filter((book) => book.slug && book.passages.length)

const revision = createHash('sha256')
  .update('book-passage-shard-v1:')
  .update(JSON.stringify(shards))
  .digest('hex')
  .slice(0, 16)

rmSync(OUTPUT_ROOT, { recursive: true, force: true })
const shardDir = join(OUTPUT_ROOT, revision)
mkdirSync(shardDir, { recursive: true })

let totalBytes = 0
const index = []
for (const book of shards) {
  const payload = `${JSON.stringify(book)}\n`
  writeFileSync(join(shardDir, `${book.slug}.json`), payload)
  const bytes = Buffer.byteLength(payload)
  totalBytes += bytes
  index.push({ slug: book.slug, title: book.title, year: book.year, passages: book.passages.length, bytes })
}

const meta = {
  version: 1,
  revision,
  books: index.sort((left, right) => right.bytes - left.bytes),
  coverage: {
    books: shards.length,
    passages: shards.reduce((total, book) => total + book.passages.length, 0),
  },
}
writeFileSync(join(OUTPUT_ROOT, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)

const monolith = Buffer.byteLength(readFileSync(SOURCE, 'utf8'))
const heaviest = meta.books[0]
console.log(
  `✔ شرائح المتون: ${shards.length} كتاباً · ${meta.coverage.passages} مقطعاً · `
  + `الأثقل «${heaviest.slug}» ${Math.round(heaviest.bytes / 1024)}KB بدل ${Math.round(monolith / 1024)}KB `
  + `(${Math.round((1 - heaviest.bytes / monolith) * 100)}٪ أقلّ) · مراجعة ${revision}`,
)
