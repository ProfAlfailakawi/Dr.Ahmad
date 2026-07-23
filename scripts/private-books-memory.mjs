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

const siteArticlesSource = DATA.slice(DATA.indexOf('export const articles = ['), DATA.indexOf('export const articlesWithBody'))
const pick = (block, key) => block.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1] || ''
const siteArticles = [...siteArticlesSource.matchAll(/\{\s*slug:\s*'[^']+'[\s\S]*?\},/g)]
  .map((m) => {
    const block = m[0]
    return {
      slug: pick(block, 'slug'),
      title: pick(block, 'title'),
      excerpt: pick(block, 'excerpt'),
      cat: pick(block, 'cat'),
      date: pick(block, 'date'),
    }
  })
  .filter((article) => article.slug && article.title)

const reverseArabicWord = (word) => [...word].reverse().join('')

function decodeGlyphRun(value = '') {
  const decoded = value
    .replace(/\/uni([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .normalize('NFKC')
  return decoded.replace(/[\u0600-\u06FF]+/g, reverseArabicWord)
}

const cleanExtractedText = (value = '') => value
  .replace(/(?:\/uni[0-9A-Fa-f]{4})(?:[\s/]*uni[0-9A-Fa-f]{4})*/g, (run) => decodeGlyphRun(run.replace(/\s+(?=\/?uni)/g, '')))
  .normalize('NFKC')
  .replace(/ـ+/g, '')
  .replace(/Dr Ahmed Book Design[^\\n]*/gi, ' ')
  .replace(/[A-Za-z0-9_-]+\\.indd[^\\n]*/g, ' ')
  .replace(/\buni[0-9A-Fa-f]{4}\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalize = (value = '') => value
  .replace(/\/uni[0-9A-Fa-f]{4}/g, ' ')
  .normalize('NFKC')
  .replace(/ـ+/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stop = new Set('في من على إلى عن أن إن كان كانت هذا هذه ذلك تلك وهو وهي مع كما أو ثم لقد دون عند بين بعد قبل كل غير أكثر أقل حيث وقد حتى التي الذي الذين حيث خلال بشكل يمكن يوجد تكون يكون أيضًا ايضا وهناك لدى عبر ضمن أجل ndd indd the and for with from into inside digital education ahmed book'.split(/\s+/))
const tokenize = (value = '') => normalize(value).split(/\s+/).filter((word) => word.length > 2 && !stop.has(word))

function pageLimitFor(file, overrideLimit = null) {
  if (overrideLimit !== null) return overrideLimit
  const manual = Number(process.env.PRIVATE_BOOKS_MAX_PAGES || 0)
  if (manual > 0) return manual
  const name = basename(file)
  if (/موسوعة|encyclopedia/i.test(name)) return 0
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
  const result = spawnSync('python3', ['-c', py, file, String(limit)], { encoding: 'utf8', maxBuffer: 160 * 1024 * 1024, timeout: 360_000 })
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

function bestArticles(terms) {
  const needle = new Set(terms.slice(0, 20))
  return siteArticles
    .map((article) => {
      const hay = new Set(tokenize(`${article.title} ${article.excerpt} ${article.cat}`))
      const score = [...needle].reduce((sum, word) => sum + Number(hay.has(word)), 0)
      return { slug: article.slug, title: article.title, date: article.date, category: article.cat, score }
    })
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
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

function sectionHints(bookSnippets, importantTerms) {
  const fallbackTerms = importantTerms.slice(0, 8).map((item) => item.term)
  return bookSnippets.slice(0, 6).map((snippet, index) => {
    const textTerms = tokenize(snippet.text)
      .filter((term, position, arr) => arr.indexOf(term) === position)
      .filter((term) => fallbackTerms.includes(term))
      .slice(0, 5)
    return {
      label: `محور خاص ${index + 1}`,
      page: snippet.page,
      keywords: textTerms.length ? textTerms : fallbackTerms.slice(index, index + 4),
      note: 'إشارة مشتقة آمنة من الكتاب الخاص؛ لا تحتوي نصًا من PDF ولا تظهر للزوار.',
    }
  })
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
  const pages = extracted.pages.map((page) => ({ ...page, text: cleanExtractedText(page.text) }))
  const text = pages.map((page) => page.text).join('\n\n')
  const terms = topTerms(text)
  const title = basename(file, extname(file)).replace(/^\d+[-\s]*/, '').replace(/[-_]?inside$/i, '').trim()
  const siteBook = bestSiteBook(title, terms.map((item) => item.term))
  const bytes = readFileSync(file)
  const articleLinks = bestArticles(terms.map((item) => item.term))
  const bookSnippets = snippets(pages, terms)
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
    snippets: bookSnippets,
    sectionHints: sectionHints(bookSnippets, terms),
    relatedPublicArticles: articleLinks,
    privateUses: [
      'اقتراح روابط داخلية دقيقة من المقالات إلى هذا الكتاب من دون كشف PDF.',
      'اقتراح مادة داعمة للمحاضرات والورش اعتمادًا على مفاهيم الكتاب.',
      'تقوية اسأل مكتبتي بإجابة موثقة من إنتاج الدكتور فقط، مع إظهار المصدر العام لا الملف الخاص.',
      'اقتراح حلقات بودكاست أو قوائم استماع مرتبطة بمحاور الكتاب.',
    ],
  })
}

const memory = {
  warning: 'PRIVATE DERIVED MEMORY — لا ترفع هذا الملف إلى GitHub ولا تضعه داخل public أو src.',
  sourceDir: PRIVATE_BOOKS_DIR,
  generatedAt: new Date().toISOString(),
  books,
}

const safeLinks = {
  warning: 'SAFE DERIVED LINKS ONLY — لا يحتوي نصوص الكتب أو مساراتها الخاصة.',
  generatedAt: memory.generatedAt,
  books: books.map((book) => ({
    title: book.title,
    pages: book.pages,
    sampledPages: book.sampledPages,
    linkedPublicBook: book.linkedPublicBook
      ? { slug: book.linkedPublicBook.slug, title: book.linkedPublicBook.title, confidence: book.linkedPublicBook.confidence }
      : null,
    topTerms: book.topTerms.slice(0, 10).map((item) => item.term),
    sections: (book.sectionHints || []).slice(0, 6),
    relatedPublicArticles: book.relatedPublicArticles.slice(0, 8).map((article) => ({
      slug: article.slug,
      title: article.title,
      date: article.date,
      category: article.category,
      confidence: article.score,
    })),
    privateUse: 'هذا الكتاب مادة خام سرية لتغذية الربط الداخلي فقط؛ لا يظهر للزوار ولا يُنشر نصه.',
  })),
}

writeFileSync(resolve(OUT_DIR, 'books-memory.json'), `${JSON.stringify(memory, null, 2)}\n`, 'utf8')
writeFileSync(resolve(ROOT, 'src/data/private-book-links.json'), `${JSON.stringify(safeLinks, null, 2)}\n`, 'utf8')
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
    `- أقرب المقالات العامة: ${book.relatedPublicArticles.length ? book.relatedPublicArticles.slice(0, 3).map((article) => `${article.title} (${article.slug})`).join('؛ ') : 'لا يوجد ربط كافٍ من البيانات الخفيفة'}`,
    '',
  ].join('\n')),
].join('\n'), 'utf8')

console.log(`\n✔ بُنيت الذاكرة الخاصة في ${OUT_DIR}`)
console.log('  - books-memory.json')
console.log('  - books-memory.report.md')
console.log('  - src/data/private-book-links.json (مشتق آمن للوحة فقط)')
