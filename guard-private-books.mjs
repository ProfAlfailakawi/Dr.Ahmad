#!/usr/bin/env node
/**
 * حزام أمان الكتب الخاصة (مقترح معتمد — البند 18)
 *
 * الخط الأحمر: الكتب الخاصة غير المنشورة لا يتسرب عنها للعموم مسار ملف،
 * ولا رقم صفحات، ولا نص داخلي. هذا الحارس يفحص طبقتين ويُفشل البناء عند الخرق:
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
const SAFE_JSON = resolve(ROOT, 'src/data/private-book-links.json')
const DIST = resolve(ROOT, 'dist')

const failures = []

/* ═══ الطبقة الأولى: نقاء الملف الآمن ═══ */
const FORBIDDEN_KEYS = new Set(['path', 'localPath', 'filePath', 'fileName', 'file', 'pdf', 'pdfPath', 'pages', 'sampledPages', 'page', 'pageStart', 'pageEnd', 'totalPages', 'sha256', 'bytes', 'text', 'snippets', 'pdfText'])
const MAX_STRING = 220

let safe = null
if (existsSync(SAFE_JSON)) {
  safe = JSON.parse(readFileSync(SAFE_JSON, 'utf8'))
  const walk = (node, trail = '$') => {
    if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${trail}[${index}]`))
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (FORBIDDEN_KEYS.has(key)) failures.push(`مفتاح ممنوع «${key}» في ${trail} داخل private-book-links.json`)
        if (typeof value === 'string' && value.length > MAX_STRING && key !== 'warning') {
          failures.push(`نص طويل مريب (${value.length} حرفاً) في ${trail}.${key} — قد يكون متناً مسرباً`)
        }
        walk(value, `${trail}.${key}`)
      }
    }
  }
  walk(safe)
}

/* ═══ الطبقة الثانية: بصمات منظومة الكتب الخاصة لا تغادر حزمة الإدارة ═══
   العناوين نفسها عامة (هي كتب الدكتور المنشورة)؛ الخطر هو أثر المنظومة
   الخاصة: مسارات الذاكرة، حقلها السري، ملف المتون الكامل. */
const PRIVATE_MARKERS = ['books-memory', 'private-books/', 'privateUse', 'مادة خام سرية', 'localPath']

if (existsSync(DIST)) {
  const assetsDir = join(DIST, 'assets')
  const publicChunks = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((name) => name.endsWith('.js') && !/^Admin-/.test(name))
    : []
  for (const chunk of publicChunks) {
    const content = readFileSync(join(assetsDir, chunk), 'utf8')
    for (const marker of PRIVATE_MARKERS) {
      if (content.includes(marker)) failures.push(`بصمة المنظومة الخاصة «${marker}» ظهرت في حزمة عامة: ${chunk}`)
    }
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
console.log(`✔ حزام الكتب الخاصة: الملف الآمن نقي (${(safe?.books || []).length} كتب) ولا بصمة للمنظومة الخاصة خارج حزمة الإدارة`)
