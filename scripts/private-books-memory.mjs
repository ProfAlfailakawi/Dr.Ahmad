#!/usr/bin/env node
/**
 * يبني «ذاكرة معرفية مشتقة» من كتب PDF الخاصة — محلياً فقط.
 *
 * لا ينسخ ملفات PDF إلى الموقع، ولا يضع النص الكامل داخل src/ أو dist/.
 * الناتج يذهب إلى .private-memory/ وهي مستثناة من GitHub.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, extname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(ROOT, '.private-memory')
const DATA = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')

const candidates = [
  process.env.PRIVATE_BOOKS_DIR,
  resolve(ROOT, '../PrivateBooks'),
  resolve(ROOT, '../../PrivateBooks'),
  '/Users/prof.ahmadalfailakawi/Downloads/Websites/PrivateBooks',
].filter(Boolean)

const PRIVATE_BOOKS_DIR = candidates.find((dir) => existsSync(dir))
if (!PRIVATE_BOOKS_DIR) {
  console.error('✘ لم أجد مجلد PrivateBooks. عرّفه هكذا: PRIVATE_BOOKS_DIR=/path/to/PrivateBooks npm run private-books:memory')
  process.exit(1)
}

const siteBooks = [...DATA.matchAll(/\{\s*slug:\s*'([^']+)'.*?title:\s*'([^']+)'.*?desc:\s*'([^']*)'/gs)]
  .map((m) => ({ slug: m[1], title: m[2], desc: m[3] }))

const normalize = (value = '') => value
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stop = new Set('في من على إلى عن أن إن كان كانت هذا هذه ذلك تلك وهو وهي مع كما أو ثم لقد دون عند بين بعد قبل كل غير أكثر أقل حيث وقد حتى التي الذي الذين وهو وهي the and for with from into inside digital education'.split(/\s+/))
const tokenize = (value = '') => normalize(value).split(/\s+/).filter((word) => word.length > 2 && !stop.has(word))

function pageLimitFor(file, overrideLimit = null) {
  if (overrideLimit !== null) return overrideLimit
  const manual = Number(process.env.PRIVATE_BOOKS_MAX_PAGES || 0)
  if (manual > 0) return manual
  const name = basename(file)
  if (/موسوعة|encyclopedia/i.test(name)) return 120
  return 0
}

function extractPdf(file, overrideLimit = null) {
  const limit = pageLimitFor(file, overrideLimit)
  const py = `
import json, sys
from pypdf import PdfReader
path = sys.argv[1]
limit = int(sys.argv[2])
reader = PdfReader(path)
pages = []
total = len(reader.pages)
for i, page in enumerate(reader.pages):
    if limit and i >= limit:
        break
    try:
        text = page.extract_text() or ""
    except Exception:
        text = ""
    pages.append({"page": i + 1, "text": text})
print(json.dumps({"pages": pages, "totalPages": total, "limit": limit}, ensure_ascii=False))
`
  const result = spawnSync('python3', ['-c', py, file, String(limit)], { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024, timeout: 120_000 })
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') throw new Error('انتهى وقت استخراج PDF')
    throw result.error
  }
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || 'تعذر استخراج PDF'
    if (/No module named 'pypdf'/.test(message)) {
      throw new Error('pypdf غير مثبت. شغّل: python3 -m pip install --user pypdf')
    }
    throw new Error(message.trim())
  }
  return JSON.parse(result.stdout)
}

function bestSiteBook(fileTitle, terms) {
  const needle = new Set(tokenize(`${fileTitle} ${terms.slice(0, 12).join(' ')}`))
  return siteBooks
    .map((book) => {
      const hay = new Set(tokenize(`${book.slug} ${book.title} ${book.desc}`))
      const score = [...needle].reduce((sum, word) => sum + Number(hay.has(word)), 0)
      return { ...book, score }
    })
    .sort((a, b) => b.score - a.score)[0]
}

function topTerms(text) {
  const counts = new Map()
  for (const word of tokenize(text)) counts.set(word, (counts.get(word) || 0) + 1)
  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 28)
    .map(([term, count]) => ({ term, count }))
}

function snippets(pages, importantTerms) {
  const terms = importantTerms.slice(0, 14).map((item) => item.term)
  const out = []
  for (const page of pages) {
    const parts = String(page.text || '').replace(/\s+/g, ' ').split(/(?<=[.!؟؛])\s+/)
    for (const sentence of parts) {
      const clean = sentence.trim()
      if (clean.length < 80 || clean.length > 340) continue
      const score = terms.reduce((sum, term) => sum + Number(normalize(clean).includes(term)), 0)
      if (score >= 1) out.push({ page: page.page, text: clean.slice(0, 320), score })
      if (out.length >= 24) return out.sort((a, b) => b.score - a.score).slice(0, 12)
    }
  }
  return out.slice(0, 12)
}

const files = readdirSync(PRIVATE_BOOKS_DIR)
  .filter((name) => /\.pdf$/i.test(name))
  .map((name) => resolve(PRIVATE_BOOKS_DIR, name))
  .sort()

mkdirSync(OUT_DIR, { recursive: true })

const books = []
for (const file of files) {
  console.log(`• أقرأ ${basename(file)}`)
  const visualPriority = /موسوعة|encyclopedia/i.test(basename(file))
  let extractionNote = ''
  let extracted
  try {
    extracted = extractPdf(file)
  } catch (error) {
    if (!visualPriority) throw error
    console.log('  ↳ كتاب بصري ثقيل؛ أرجع لعينة نصية آمنة من 120 صفحة وأكمل.')
    extractionNote = error instanceof Error ? error.message : 'تعذّر الاستخراج الكامل'
    extracted = extractPdf(file, 120)
  }
  const text = extracted.pages.map((page) => page.text).join('\n\n')
  const terms = topTerms(text)
  const title = basename(file, extname(file)).replace(/^\d+[-\s]*/, '').replace(/[-_]?inside$/i, '').trim()
  const siteBook = bestSiteBook(title, terms.map((item) => item.term))
  const bytes = readFileSync(file)
  books.push({
    fileName: basename(file),
    localPath: file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: statSync(file).size,
    extractedAt: new Date().toISOString(),
    title,
    pages: extracted.totalPages || extracted.pages.length,
    sampledPages: extracted.pages.length,
    partial: Boolean(extracted.limit && extracted.pages.length < extracted.totalPages),
    visualPriority,
    extractionNote,
    textLength: text.length,
    linkedPublicBook: siteBook?.score > 0 ? { slug: siteBook.slug, title: siteBook.title, confidence: siteBook.score } : null,
    topTerms: terms,
    snippets: snippets(extracted.pages, terms),
  })
}

const memory = {
  warning: 'PRIVATE DERIVED MEMORY — لا ترفع هذا الملف إلى GitHub ولا تضعه داخل public أو src.',
  sourceDir: PRIVATE_BOOKS_DIR,
  generatedAt: new Date().toISOString(),
  books,
}

writeFileSync(resolve(OUT_DIR, 'books-memory.json'), `${JSON.stringify(memory, null, 2)}\n`, 'utf8')
writeFileSync(resolve(OUT_DIR, 'books-memory.report.md'), [
  '# ذاكرة الكتب الخاصة',
  '',
  `المجلد: ${PRIVATE_BOOKS_DIR}`,
  `عدد الكتب: ${books.length}`,
  '',
  ...books.map((book) => [
    `## ${book.title}`,
    '',
    `- الملف: ${book.fileName}`,
    `- الصفحات: ${book.pages}${book.partial ? ` (عينة نصية: ${book.sampledPages} صفحة)` : ''}`,
    `- أولوية بصرية/OCR: ${book.visualPriority ? 'نعم — كتاب غني بالصور والتصميم' : 'لا'}`,
    `- الربط العام: ${book.linkedPublicBook ? `${book.linkedPublicBook.title} (${book.linkedPublicBook.slug})` : 'لا يوجد ربط واثق'}`,
    `- أهم المفاهيم: ${book.topTerms.slice(0, 12).map((item) => item.term).join('، ')}`,
    '',
  ].join('\n')),
].join('\n'), 'utf8')

console.log(`\n✔ بُنيت الذاكرة الخاصة في ${OUT_DIR}`)
console.log('  - books-memory.json')
console.log('  - books-memory.report.md')
