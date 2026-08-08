#!/usr/bin/env node
/**
 * يبني طبقتين من الكتب التسعة:
 *  1) خريطة مفاهيم عامة خفيفة، بلا متن ولا مسار محلي ولا PDF.
 *  2) فهرس أدلة نصية للخادم فقط؛ لا يدخل dist ولا حزمة المتصفح.
 *
 * الكتب المصوّرة تحتاج ناتج OCR محلياً داخل .private-memory/ocr. لا يخمّن
 * السكربت محتواها ولا يقبل تغطية ناقصة بصمت.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const PRIVATE_DIR = [
  process.env.PRIVATE_BOOKS_DIR,
  resolve(ROOT, '../PrivateBooks'),
  resolve(ROOT, '../../PrivateBooks'),
  '/Users/prof.ahmadalfailakawi/Downloads/Websites/PrivateBooks',
].filter(Boolean).find((candidate) => existsSync(candidate))

if (!PRIVATE_DIR) {
  console.error('✘ لم أجد مجلد PrivateBooks. عرّفه في PRIVATE_BOOKS_DIR ثم أعد البناء.')
  process.exit(1)
}

const BOOKS = [
  { slug: 'digital-education', file: /^01-.*digital/i, title: 'التعليم ومتطلبات العصر.. (التعلم الرقمي)', year: '2021' },
  { slug: 'gamification', file: /^02-.*gamification/i, title: 'التلعيب Gamification وعالم الألعاب', year: '2021' },
  { slug: 'handy-tech', file: /^03-.*handy/i, title: 'تكنولوجيا ذوي الاحتياجات الخاصة', year: '2021' },
  { slug: 'kids-tech', file: /^04-.*kids/i, title: 'الطفل والتكنولوجيا', year: '2021', ocr: 'kids' },
  { slug: 'mega-data', file: /^05-.*mega/i, title: 'حوكمة الذكاء الاصطناعي والبيانات الضخمة', year: '2021', ocr: 'mega' },
  { slug: 'smart-school', file: /^06-.*smart/i, title: 'المدارس الذكية', year: '2021' },
  { slug: 'teaching', file: /^07-.*teaching/i, title: 'مناهج وطرق التدريس (تكنولوجيا التعليم)', year: '2021' },
  { slug: 'virtual-world', file: /^08-.*vertual/i, title: 'العالم الافتراضي', year: '2021', ocr: 'virtual' },
  { slug: 'encyclopedia', file: /موسوعة.*تكنولوجيا.*التعليم/i, title: 'موسوعة تكنولوجيا التعليم', year: '2016', encyclopedia: true },
]

const normalize = (value = '') => String(value)
  .normalize('NFKC')
  .replace(/ـ+/g, '')
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const clean = (value = '') => String(value)
  .replace(/(?:https?|file):\/\/\S+/gi, ' ')
  .replace(/(?:[A-Za-z]:)?[\\/]Users[\\/]\S+/gi, ' ')
  .replace(/\b\S+\.pdf\b/gi, ' ')
  .replace(/(?:\/uni[0-9A-Fa-f]{4})(?:[\s/]*uni[0-9A-Fa-f]{4})*/g, ' ')
  .normalize('NFKC')
  .replace(/ـ+/g, '')
  .replace(/Dr Ahmed Book Design[^\n]*/gi, ' ')
  .replace(/[A-Za-z0-9_-]+\.indd[^\n]*/g, ' ')
  .replace(/\buni[0-9A-Fa-f]{4}\b/g, ' ')
  .replace(/\u064Bا/g, `ا\u064B`)
  .replace(/([\u0621-\u064A\u0671-\u06D3])[ \t]+([ًٌٍ])/g, '$1$2')
  .replace(/([ًٌٍ])\1+/g, '$1')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const STOP = new Set('في من على الى إلى عن ان أن إن كان كانت هذا هذه ذلك تلك وهو وهي مع كما او أو ثم لقد دون عند بين بعد قبل كل غير اكثر أقل حيث وقد حتى التي الذي الذين خلال بشكل يمكن يوجد تكون يكون ايضا أيضاً هناك لدى عبر ضمن اجل أجل مثل يجب يتم مما لكن كتاب الفصل الباب مقدمه مقدمة خاتمه خاتمة قائمه قائمة مراجع المرجع التعليم التعليمية التعلم تكنولوجيا استخدام بحث دراسه دراسة نتائج نتيجه دور اهميه أهمية مفهوم تطبيق تطبيقات and the for with from into education learning journal https http org doi'.split(/\s+/).map(normalize))
const ENGLISH_DOMAIN = new Set(['tpack', 'samr', 'gamification', 'moodle', 'lms', 'ai', 'ar', 'vr', 'mooc', 'moocs'])
const tokens = (value = '') => normalize(value).split(/\s+/).filter((word) => {
  if (word.length <= 2 || STOP.has(word)) return false
  return /[\u0621-\u064a]/u.test(word) || ENGLISH_DOMAIN.has(word)
})

/* OCR يحتاج طيّ الهمزات والتاء المربوطة كي يجمع العدّ بدقة، لكن هذا الشكل
   التحليلي لا يليق بوسمٍ ظاهر للقارئ. نعيد الإملاء للكلمات التي يسمح سياقها
   باستعادة يقينية، من دون لمس متن الكتاب أو تخمين همزة غير مؤكدة. */
const DISPLAY_ORTHOGRAPHY = new Map(Object.entries({
  الانترنت: 'الإنترنت', الاجهزه: 'الأجهزة', اجهزه: 'أجهزة', الالكتروني: 'الإلكتروني', الالكترونيه: 'الإلكترونية',
  التربيه: 'التربية', الطلبه: 'الطلبة', المعرفه: 'المعرفة', الالعاب: 'الألعاب', التقنيه: 'التقنية',
  المدرسه: 'المدرسة', ذكيه: 'ذكية', التعليميه: 'التعليمية', التكنولوجيه: 'التكنولوجية',
  الافتراضيه: 'الافتراضية', الرقميه: 'الرقمية', الاجتماعيه: 'الاجتماعية', الانظمه: 'الأنظمة',
  الادوات: 'الأدوات', الاداره: 'الإدارة', اداره: 'إدارة', الاطفال: 'الأطفال', الاعاقه: 'الإعاقة',
  الاخلاقيه: 'الأخلاقية', الاساسيه: 'الأساسية', الابتداييه: 'الابتدائية', الحياه: 'الحياة',
  الدراسه: 'الدراسة', الرساله: 'الرسالة', الشاشه: 'الشاشة', الشبكه: 'الشبكة', العمليه: 'العملية',
  الماده: 'المادة', المحاكاه: 'المحاكاة', المساعده: 'المساعدة', المعلومه: 'المعلومة',
  الموسسه: 'المؤسسة', الموسسات: 'المؤسسات', النتايج: 'النتائج', الوسايل: 'الوسائل', الوظايف: 'الوظائف',
}))
const displayTerm = (term) => DISPLAY_ORTHOGRAPHY.get(term) || term

function topTerms(value, limit = 12, minimum = 2) {
  const counts = new Map()
  for (const word of tokens(value)) counts.set(word, (counts.get(word) || 0) + 1)
  return [...counts.entries()]
    .filter(([, count]) => count >= minimum)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))
    .slice(0, limit)
    .map(([term]) => displayTerm(term))
}

function extractPdf(file) {
  const py = `
import json, sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
rows = []
for i, page in enumerate(reader.pages):
    try: text = page.extract_text() or ""
    except Exception: text = ""
    rows.append({"page": i + 1, "text": text})
print(json.dumps(rows, ensure_ascii=False))
`
  const result = spawnSync('python3', ['-c', py, file], { encoding: 'utf8', maxBuffer: 180 * 1024 * 1024, timeout: 420_000 })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'تعذّر استخراج الكتاب').trim())
  return JSON.parse(result.stdout).map((row) => ({ page: Number(row.page), text: clean(row.text) }))
}

function readOcr(name) {
  const file = resolve(ROOT, `.private-memory/ocr/${name}.jsonl`)
  if (!existsSync(file)) throw new Error(`ناتج OCR مفقود: ${file}`)
  return readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const row = JSON.parse(line)
    return { page: Number(row.page), text: clean(row.text) }
  })
}

function pagesFor(config, fullPath) {
  const cacheDir = resolve(ROOT, '.private-memory/extracted-pages')
  const cacheFile = resolve(cacheDir, `${config.slug}.json`)
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'))
  const pages = config.ocr ? readOcr(config.ocr) : extractPdf(fullPath)
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, `${JSON.stringify(pages)}\n`)
  return pages
}

function parseTocs() {
  const start = SOURCE.indexOf('const bookTocs:')
  const end = SOURCE.indexOf('export const books = [')
  const block = SOURCE.slice(start, end)
  const result = {}
  const pattern = /(?:^|\n)\s*(?:'([^']+)'|([A-Za-z][\w-]*)):\s*\[([\s\S]*?)\]\.join\('\\n'\),/g
  for (const match of block.matchAll(pattern)) {
    const key = match[1] || match[2]
    result[key] = [...match[3].matchAll(/'([^']+)'/g)].map((item) => item[1])
  }
  return result
}

function conceptsFromToc(slug, lines, pageCount, pages) {
  const starts = lines.flatMap((line) => {
    const match = line.match(/^(.*?)\s*[—–-]\s*ص\s*(\d+)\s*$/)
    if (!match) return []
    const title = match[1].trim()
    const pageStart = Number(match[2])
    if (!title || !pageStart || pageStart > pageCount) return []
    return [{ title, pageStart }]
  })
  return starts.map((entry, index) => {
    const next = starts[index + 1]
    const pageEnd = Math.max(entry.pageStart, Math.min(pageCount, next ? next.pageStart - 1 : pageCount))
    const sectionText = pages
      .filter((page) => page.page >= entry.pageStart && page.page <= pageEnd)
      .map((page) => page.text)
      .join(' ')
    const keywords = topTerms(`${entry.title} ${sectionText}`, slug === 'encyclopedia' ? 10 : 8, 1)
    const subject = entry.title.replace(/^(?:الفصل|الباب)\s+(?:الأول|الثاني|الثالث|الرابع|الخامس|السادس)\s*:\s*/u, '').trim()
    return {
      id: `c${String(index + 1).padStart(2, '0')}`,
      title: entry.title,
      pageStart: entry.pageStart,
      pageEnd,
      keywords,
      summary: `يعالج هذا المحور ${subject}${keywords.length ? `، ويتصل بمفاهيم ${keywords.slice(0, 4).join('، ')}` : ''}.`,
      question: `ماذا يوضح هذا المحور عن ${subject}، وكيف يتصل بالتطبيق أو الدليل؟`,
    }
  })
}

function splitChunks(text, maximum = 780) {
  const sentences = clean(text).split(/(?<=[.!؟؛:])\s+|\n+/u).map((item) => item.trim()).filter(Boolean)
  const chunks = []
  let current = ''
  const push = () => {
    const value = current.replace(/\s+/g, ' ').trim()
    if (value.length >= 80) chunks.push(value)
    current = ''
  }
  for (const sentence of sentences) {
    if (sentence.length > maximum) {
      push()
      for (let offset = 0; offset < sentence.length; offset += maximum) {
        const part = sentence.slice(offset, offset + maximum).trim()
        if (part.length >= 80) chunks.push(part)
      }
      continue
    }
    if (current && current.length + sentence.length + 1 > maximum) push()
    current = current ? `${current} ${sentence}` : sentence
  }
  push()
  return chunks
}

const tocMap = parseTocs()
const available = readdirSync(PRIVATE_DIR).filter((name) => extname(name).toLowerCase() === '.pdf')
const manifestBooks = []
const evidenceBooks = []

for (const config of BOOKS) {
  const fileName = available.find((name) => config.file.test(name))
  if (!fileName) throw new Error(`الكتاب مفقود: ${config.slug}`)
  const fullPath = resolve(PRIVATE_DIR, fileName)
  process.stdout.write(`• أفهرس ${config.title}... `)
  const pages = pagesFor(config, fullPath)
  const readablePages = pages.filter((page) => page.text.length >= 80)
  const coverage = readablePages.length / Math.max(1, pages.length)
  /* الغلاف والفهرس وصفحات الصور لا تحمل فقرة بطول ٨٠ حرفاً، لذلك تقاس
     التغطية مع حدّ نص كلي أيضاً؛ ٦٠٪ هنا لا تعني أن ٤٠٪ من المتن مفقود. */
  if (coverage < .6 || pages.reduce((sum, page) => sum + page.text.length, 0) < 20_000) {
    throw new Error(`تغطية النص منخفضة في ${config.slug}: ${Math.round(coverage * 100)}%`)
  }
  const concepts = conceptsFromToc(config.slug, tocMap[config.slug] || [], pages.length, pages)
  if (concepts.length < 8) throw new Error(`فهرس المفاهيم ناقص في ${config.slug}: ${concepts.length}`)

  const sectionFor = (pageNumber) => concepts.find((concept) => pageNumber >= concept.pageStart && pageNumber <= concept.pageEnd)
  const chunks = pages.flatMap((page) => {
    const section = sectionFor(page.page)
    const kind = section && /قائمة المراجع|المراجع/u.test(section.title) ? 'references' : 'body'
    return splitChunks(page.text).map((text, index) => ({
      id: `${config.slug}-p${page.page}-${index + 1}`,
      page: page.page,
      sectionId: section?.id || '',
      section: section?.title || 'متن الكتاب',
      kind,
      text,
    }))
  })

  const wholeText = pages.map((page) => page.text).join(' ')
  const top = topTerms(wholeText, config.encyclopedia ? 28 : 18)
  manifestBooks.push({
    slug: config.slug,
    title: config.title,
    year: config.year,
    pageCount: pages.length,
    indexedPages: readablePages.length,
    role: config.encyclopedia
      ? 'الجذر المرجعي للمشروع: تُستدعى مفاهيمه أولاً عند بناء خريطة المجال، ثم تُقارن بالتطبيق والبحث والمقال.'
      : 'مرجع متخصص داخل المشروع؛ يربط المفهوم بالتطبيق والبحث والمقال والحوار العام.',
    topTerms: top,
    concepts,
    questions: concepts
      .filter((concept) => !/قائمة المراجع|الخاتمة/u.test(concept.title))
      .slice(0, config.encyclopedia ? 14 : 9)
      .map((concept) => `ماذا يوضح الكتاب عن ${concept.title.replace(/^(?:الفصل|الباب)\s+[^:]+:\s*/u, '')}؟`),
  })
  evidenceBooks.push({
    slug: config.slug,
    title: config.title,
    year: config.year,
    sourceFingerprint: createHash('sha256').update(readFileSync(fullPath)).digest('hex'),
    pageCount: pages.length,
    chunks,
  })
  console.log(`${pages.length} صفحة · ${chunks.length} شاهد`)
}

const totalPages = manifestBooks.reduce((sum, book) => sum + book.pageCount, 0)
const totalIndexedPages = manifestBooks.reduce((sum, book) => sum + book.indexedPages, 0)
const publicManifest = {
  version: 2,
  policy: 'خريطة مفاهيم مشتقة من المتون كاملة. لا تحتوي ملف PDF كاملاً ولا متن الكتاب القابل للتصفح.',
  coverage: { books: manifestBooks.length, pages: totalPages, indexedPages: totalIndexedPages, complete: manifestBooks.length === 9 && totalPages === 1596 },
  books: manifestBooks,
}
const serverEvidence = {
  version: 2,
  policy: 'SERVER ONLY — أدلة الكتب للأسئلة الموثقة. ممنوع نسخ هذا الملف إلى dist أو استيراده في React.',
  coverage: publicManifest.coverage,
  books: evidenceBooks,
}

mkdirSync(resolve(ROOT, 'src/data'), { recursive: true })
writeFileSync(resolve(ROOT, 'src/data/book-knowledge.json'), `${JSON.stringify(publicManifest, null, 2)}\n`)
writeFileSync(resolve(ROOT, 'src/data/book-evidence.json'), `${JSON.stringify(serverEvidence)}\n`)
console.log(`✔ اكتملت طبقة الكتب: ${manifestBooks.length} كتب · ${totalPages} صفحة · ${evidenceBooks.reduce((sum, book) => sum + book.chunks.length, 0)} شاهد خادمي`)
