#!/usr/bin/env node
/**
 * حزام أمان الكتب الخاصة (مقترح معتمد — البند 18)
 *
 * العقد الحالي: يجوز استخدام معرفة المتون كاملة، لكن لا يُنشر PDF الكامل ولا
 * يتحول الموقع إلى قارئٍ للمتن. هذا الحارس يفصل خريطة المفاهيم العامة عن
 * أدلة الخادم النصية، ويمنع وصول الأخيرة إلى dist.
 *   ١) الملف المشتق الآمن نفسه (src/data/private-book-links.json):
 *      ممنوع فيه أي مفتاح من عائلة المسارات أو الصفحات أو أي نص طويل يشبه المتن.
 *   ٢) مخرجات البناء العامة (dist): عناوين الكتب الخاصة لا تظهر إلا في حزمة
 *      لوحة التحكم (Admin-*.js) — لا في حزمة الزوار ولا في أي HTML مُصيَّر.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, join, basename } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/* كل ملف عام مشتق من منظومة الكتب يخضع للفحص نفسه — بابا التسريب المعروفان */
const SAFE_JSON_FILES = ['src/data/private-book-links.json', 'src/data/book-toc-links.json']
const PUBLIC_KNOWLEDGE = resolve(ROOT, 'src/data/book-knowledge.json')
const SERVER_EVIDENCE = resolve(ROOT, 'src/data/book-evidence.json')
const PUBLIC_QUOTES = resolve(ROOT, 'src/data/book-quotes.json')
const PUBLIC_PASSAGES = resolve(ROOT, 'src/data/book-passages.json')
const DIST = resolve(ROOT, 'dist')

const failures = []

/* ═══ الطبقة الأولى: نقاء الملفات الآمنة ═══ */
const FORBIDDEN_KEYS = new Set(['path', 'localPath', 'filePath', 'fileName', 'file', 'pdf', 'pdfPath', 'pages', 'sampledPages', 'page', 'pageStart', 'pageEnd', 'totalPages', 'sha256', 'bytes', 'text', 'snippets', 'pdfText'])
const MAX_STRING = 220

let safe = null
for (const relative of SAFE_JSON_FILES) {
  const fullPath = resolve(ROOT, relative)
  if (!existsSync(fullPath)) continue
  const parsed = JSON.parse(readFileSync(fullPath, 'utf8'))
  if (relative.includes('private-book-links')) safe = parsed
  const walk = (node, trail = '$') => {
    if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${trail}[${index}]`))
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (FORBIDDEN_KEYS.has(key)) failures.push(`مفتاح ممنوع «${key}» في ${trail} داخل ${relative}`)
        if (typeof value === 'string' && value.length > MAX_STRING && key !== 'warning') {
          failures.push(`نص طويل مريب (${value.length} حرفاً) في ${trail}.${key} داخل ${relative} — قد يكون متناً مسرباً`)
        }
        walk(value, `${trail}.${key}`)
      }
    }
  }
  walk(parsed)
}

/* ═══ الطبقة الثانية: بصمات منظومة الكتب الخاصة لا تغادر حزمة الإدارة ═══
   العناوين نفسها عامة (هي كتب الدكتور المنشورة)؛ الخطر هو أثر المنظومة
   الخاصة: مسارات الذاكرة، حقلها السري، ملف المتون الكامل. */
const PRIVATE_MARKERS = ['books-memory', 'private-books/', 'privateUse', 'مادة خام سرية', 'localPath']

/* خريطة المفاهيم العامة تسمح بأرقام الصفحات والعناوين المشتقة فقط. */
if (!existsSync(PUBLIC_KNOWLEDGE)) failures.push('خريطة معرفة الكتب مفقودة')
else {
  const publicKnowledgeText = readFileSync(PUBLIC_KNOWLEDGE, 'utf8')
  const publicKnowledge = JSON.parse(publicKnowledgeText)
  if (publicKnowledge?.coverage?.books !== 9 || publicKnowledge?.coverage?.pages !== 1596 || publicKnowledge?.coverage?.complete !== true) {
    failures.push('تغطية خريطة الكتب العامة ناقصة؛ المتوقع ٩ كتب و١٥٩٦ صفحة')
  }
  for (const marker of ['.pdf', '/Users/', 'PrivateBooks', 'localPath', 'sourceFingerprint', '"text":']) {
    if (publicKnowledgeText.includes(marker)) failures.push(`الخريطة العامة تحمل أثراً ممنوعاً: ${marker}`)
  }
}

/* ═══ المتن الكامل لا يسكن المستودع ═══
   المستودع عام (وهو عامٌ عمداً: تشغيلات Actions مجانية بلا سقف). فالمتن
   الكامل يبقى على جهاز الدكتور، ويُبنى منه المشتقّان: خريطة المفاهيم
   العامة، والاقتباسات المقيسة. وجودُه محلياً مسموح؛ تتبّعه في git ممنوع. */
if (existsSync(SERVER_EVIDENCE)) {
  const serverEvidenceText = readFileSync(SERVER_EVIDENCE, 'utf8')
  for (const marker of ['/Users/', 'PrivateBooks', 'localPath', 'fileName']) {
    if (serverEvidenceText.includes(marker)) failures.push(`فهرس المتن المحلي يحمل مساراً ممنوعاً: ${marker}`)
  }
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'src/data/book-evidence.json'], { cwd: ROOT, encoding: 'utf8' })
  if (tracked.status === 0) {
    failures.push('متن الكتب الكامل متتبَّع في git — والمستودع عام. أخرجه: git rm --cached src/data/book-evidence.json')
  }
}

/* ═══ الاقتباسات المنشورة — بإذن الدكتور، وبسقفٍ لا يُوسَّع صامتاً ═══
   أُذِن بنشر «بعض الكلام من المتن». هذا الحارس يترجم «بعض» إلى رقم:
   جملة أو جملتان لكل موضع، بسقف حرفي، وبعددٍ محدود لكل كتاب ومحور —
   فلا يتحول الموقع إلى قارئٍ للكتاب من حيث لا ننتبه. */
const QUOTE_HARD_LIMITS = {
  maxChars: 240,
  /* الضمانة الأولى: التباعد. اقتباسان بينهما أقل من ثلاث صفحات يعنيان أننا
     نقترب من إعادة تركيب فقرةٍ متصلة — وهو الخط الذي لا يُعبر. */
  minPageGap: 3,
  /* الضمانة الثانية: النسبة. لا يتجاوز المقتبَس من أي كتاب ٣٪ من متنه
     (الصفحة ≈ ١٦٠٠ حرف)، فيبقى دليلاً على الكتاب لا بديلاً عنه. */
  maxShareOfBook: 0.03,
  charsPerPage: 1600,
}

if (!existsSync(PUBLIC_QUOTES)) failures.push('ملف الاقتباسات المنشورة مفقود — شغّل npm run books:quotes')
else {
  const quotesText = readFileSync(PUBLIC_QUOTES, 'utf8')
  const quotesFile = JSON.parse(quotesText)
  const knowledgeBooks = existsSync(PUBLIC_KNOWLEDGE)
    ? (JSON.parse(readFileSync(PUBLIC_KNOWLEDGE, 'utf8')).books || [])
    : []

  for (const book of quotesFile?.books || []) {
    const quotes = book?.quotes || []
    const pageCount = Number(knowledgeBooks.find((item) => item.slug === book.slug)?.pageCount || 0)

    const pages = []
    let chars = 0
    for (const quote of quotes) {
      const text = String(quote?.text || '')
      chars += text.length
      if (text.length > QUOTE_HARD_LIMITS.maxChars) {
        failures.push(`اقتباس ${quote.id} طوله ${text.length} حرفاً — والسقف ${QUOTE_HARD_LIMITS.maxChars}`)
      }
      const tooClose = pages.find((page) => Math.abs(page - quote.page) < QUOTE_HARD_LIMITS.minPageGap)
      if (tooClose !== undefined) {
        failures.push(`اقتباسان متلاصقان في «${book.title}» (ص ${tooClose} و${quote.page}) — الحدّ ${QUOTE_HARD_LIMITS.minPageGap} صفحات`)
      }
      pages.push(quote.page)
    }

    if (pageCount) {
      const share = chars / (pageCount * QUOTE_HARD_LIMITS.charsPerPage)
      if (share > QUOTE_HARD_LIMITS.maxShareOfBook) {
        failures.push(`المقتبَس من «${book.title}» ${(share * 100).toFixed(1)}٪ من الكتاب — والسقف ${QUOTE_HARD_LIMITS.maxShareOfBook * 100}٪`)
      }
    }
  }

  for (const marker of ['/Users/', 'PrivateBooks', '.pdf', 'localPath']) {
    if (quotesText.includes(marker)) failures.push(`ملف الاقتباسات يحمل أثراً ممنوعاً: ${marker}`)
  }
}

/* فهرس المتون الكامل منشورٌ بأمر الدكتور («استخدم الكتب كاملة»)، لكنه يظل
   فهرساً للبحث: مقاطع منسوبة إلى صفحاتها، بلا مسارٍ ولا ملفٍ ولا بصمة مصدر. */
if (!existsSync(PUBLIC_PASSAGES)) failures.push('فهرس متون الكتب مفقود — شغّل npm run books:quotes')
else {
  const passagesText = readFileSync(PUBLIC_PASSAGES, 'utf8')
  const passagesFile = JSON.parse(passagesText)
  if ((passagesFile?.coverage?.books || 0) !== 9) failures.push('فهرس المتون لا يغطي الكتب التسعة')
  for (const marker of ['/Users/', 'PrivateBooks', '.pdf', 'localPath', 'sourceFingerprint']) {
    if (passagesText.includes(marker)) failures.push(`فهرس المتون يحمل أثراً ممنوعاً: ${marker}`)
  }
}

/* ═══ قفل الـPDF — لا يظهر إلا المتفق عليه ═══
   شرط الدكتور الثابت: لا يظهر PDF الكتاب إلا ما اتُّفق على ظهوره. نترجمه إلى
   حقلٍ صريح في البيانات (pdfPolicy) وفحصٍ للملف نفسه، فلا تكفي النيّة:
   الملف الذي يتجاوز حجم العيّنة يُفشل النشر ولو حمل الاسم الصحيح. */
const SAMPLE_MAX_PAGES = 25
const SAMPLE_MAX_RATIO = 0.15

{
  const dataText = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
  const booksStart = dataText.indexOf('export const books = [')
  const booksBlock = booksStart >= 0 ? dataText.slice(booksStart, dataText.indexOf('\n]', booksStart)) : ''
  const entries = [...booksBlock.matchAll(/\{\s*slug:\s*'([^']+)'[\s\S]*?(?=\n  \{\s*slug:|$)/g)]

  if (entries.length !== 9) failures.push(`قائمة الكتب المتوقعة ٩، والموجود ${entries.length}`)

  for (const [entry, slug] of entries.map((match) => [match[0], match[1]])) {
    const pdf = entry.match(/pdf:\s*'([^']+)'/)?.[1] || ''
    const policy = entry.match(/pdfPolicy:\s*'([^']+)'/)?.[1] || ''
    const pageCount = Number(entry.match(/pageCount:\s*'?(\d+)/)?.[1] || 0)

    if (pdf && !policy) { failures.push(`الكتاب «${slug}» ينشر PDF بلا سياسة معلنة (pdfPolicy)`); continue }
    if (!policy) continue
    if (!['sample', 'full', 'none'].includes(policy)) { failures.push(`سياسة PDF غير معروفة للكتاب «${slug}»: ${policy}`); continue }
    if (policy === 'none' && pdf) { failures.push(`الكتاب «${slug}» سياسته «لا نشر» ومع ذلك يعرض ملفاً`); continue }
    if (!pdf) continue

    const file = resolve(ROOT, pdf.replace(/^\//, ''))
    if (!existsSync(file)) { failures.push(`ملف PDF مفقود للكتاب «${slug}»: ${pdf}`); continue }

    /* عدّ الصفحات من بنية الملف نفسه — لا من اسمه ولا من ثقتنا بمن رفعه. */
    const pdfPages = (readFileSync(file, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    if (policy === 'sample') {
      if (pdfPages > SAMPLE_MAX_PAGES) {
        failures.push(`عيّنة «${slug}» ${pdfPages} صفحة — والسقف ${SAMPLE_MAX_PAGES}. إن كان النشر الكامل مقصوداً فغيّر pdfPolicy صراحةً.`)
      }
      if (pageCount && pdfPages > Math.ceil(pageCount * SAMPLE_MAX_RATIO)) {
        failures.push(`عيّنة «${slug}» تغطي ${pdfPages} من ${pageCount} صفحة — أكثر من ${Math.round(SAMPLE_MAX_RATIO * 100)}٪ من الكتاب`)
      }
    }
  }
}

if (existsSync(DIST)) {
  const assetsDir = join(DIST, 'assets')
  const allChunks = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
    : []
  // بعد تقسيم الإدارة ديناميكياً لم تعد كل أدواتها داخل Admin-*.js. تُعزل
  // ذاكرة الكتب نفسها في chunk صريح، ثم نثبت أدناه أن استوديو الإدارة وحده
  // يستورده وأن أي صفحة عامة لا تشير إليه.
  const privateMemoryChunks = allChunks.filter((name) => /^admin-private-memory-/.test(name))
  const publicChunks = allChunks.filter((name) => !/^Admin-/.test(name) && !/^admin-private-memory-/.test(name))
  for (const chunk of publicChunks) {
    const content = readFileSync(join(assetsDir, chunk), 'utf8')
    if (content.includes('SERVER ONLY — أدلة الكتب')) failures.push(`متن الكتب الخادمي ظهر في حزمة عامة: ${chunk}`)
    for (const marker of PRIVATE_MARKERS) {
      if (content.includes(marker)) failures.push(`بصمة المنظومة الخاصة «${marker}» ظهرت في حزمة عامة: ${chunk}`)
    }
  }
  if (privateMemoryChunks.length !== 1) failures.push(`حزمة ذاكرة الكتب الإدارية المتوقعة واحدة، والموجود ${privateMemoryChunks.length}`)
  for (const privateChunk of privateMemoryChunks) {
    const importers = allChunks.filter((chunk) => chunk !== privateChunk && readFileSync(join(assetsDir, chunk), 'utf8').includes(privateChunk))
    for (const importer of importers) {
      if (!/^(?:Admin|PublishingStudio)-/.test(importer)) failures.push(`حزمة عامة تستورد ذاكرة الكتب الخاصة: ${importer}`)
    }
    if (!importers.some((name) => /^PublishingStudio-/.test(name))) failures.push('استوديو النشر الإداري لا يستورد حزمة ذاكرة الكتب المعزولة كما هو متوقع')
  }
  const htmlFiles = []
  const collectHtml = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) collectHtml(full)
      else if (entry.name.endsWith('.html')) htmlFiles.push(full)
    }
  }
  collectHtml(DIST)
  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8')
    for (const privateChunk of privateMemoryChunks) {
      if (content.includes(privateChunk)) failures.push(`صفحة عامة تشير مباشرةً إلى حزمة ذاكرة الكتب الخاصة: ${basename(file)}`)
    }
    for (const marker of PRIVATE_MARKERS) {
      if (content.includes(marker)) failures.push(`بصمة المنظومة الخاصة «${marker}» ظهرت في صفحة مُصيَّرة: ${basename(file)}`)
    }
  }
}

if (failures.length) {
  console.error('✘ حزام الكتب الخاصة اعترض النشر:')
  for (const failure of failures.slice(0, 12)) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`✔ حزام الكتب: ٩ كتب مفهرسة؛ PDF الكامل غير منشور، ودليل المتن محصور في الخادم`)
