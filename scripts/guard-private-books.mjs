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
import { resolve, join, basename } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/* كل ملف عام مشتق من منظومة الكتب يخضع للفحص نفسه — بابا التسريب المعروفان */
const SAFE_JSON_FILES = ['src/data/private-book-links.json', 'src/data/book-toc-links.json']
const PUBLIC_KNOWLEDGE = resolve(ROOT, 'src/data/book-knowledge.json')
const SERVER_EVIDENCE = resolve(ROOT, 'src/data/book-evidence.json')
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

/* المتن المفهرس مسموح في الخادم فقط، ومنزوع منه اسم الملف والمسار وPDF. */
if (!existsSync(SERVER_EVIDENCE)) failures.push('فهرس أدلة الكتب الخادمي مفقود')
else {
  const serverEvidenceText = readFileSync(SERVER_EVIDENCE, 'utf8')
  const serverEvidence = JSON.parse(serverEvidenceText)
  if (serverEvidence?.coverage?.books !== 9 || serverEvidence?.coverage?.pages !== 1596) failures.push('تغطية أدلة الكتب الخادمية ناقصة')
  for (const marker of ['.pdf', '/Users/', 'PrivateBooks', 'localPath', 'fileName']) {
    if (serverEvidenceText.includes(marker)) failures.push(`فهرس الخادم يحمل مساراً أو ملفاً ممنوعاً: ${marker}`)
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
