#!/usr/bin/env node
/**
 * قاعدة الموقع التحريرية: تنوين الفتح يُكتب على الألف: «مشروعاً» لا «مشروعاً».
 * الحارس يفشل البناء إذا عادت الصيغة القديمة إلى النصوص أو البيانات أو الواجهة.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = resolve('.')
const BAD = '\u064B\u0627' // اً
const GOOD = '\u0627\u064B' // اً
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.md', '.yml', '.yaml', '.css', '.txt'])
const ROOT_FILES = ['index.html', 'server.mjs', 'data.ts', 'ui.tsx', 'Admin.tsx', 'ArticleDetail.tsx', 'build-static.mjs', 'instructions.md']
const ROOT_DIRS = ['src', 'scripts', 'public', '.github', 'whatsapp-agent', 'whatsapp-web-bridge']
const IGNORE = new Set(['node_modules', 'dist', '.git', '.audio-human-work', 'audio-audits', 'podcast-audits', '.codex-backups'])

const files = []
function walk(dir) {
  if (!statSync(dir).isDirectory()) return
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue
    const file = join(dir, name)
    const stat = statSync(file)
    if (stat.isDirectory()) walk(file)
    else if (EXTENSIONS.has(extname(name))) files.push(file)
  }
}
for (const dir of ROOT_DIRS.map((name) => join(ROOT, name))) {
  try { walk(dir) } catch { /* optional directory */ }
}
for (const name of ROOT_FILES) {
  const file = join(ROOT, name)
  try { if (statSync(file).isFile() && !files.includes(file)) files.push(file) } catch { /* optional */ }
}

if (process.argv.includes('--self-test')) {
  const sample = `مشروع${BAD} جديد`
  const normalized = sample.replaceAll(BAD, GOOD)
  if (normalized !== `مشروع${GOOD} جديد`) throw new Error('tanween self-test failed')
  console.log('✓ Arabic tanween guard self-test passed')
  process.exit(0)
}

const hits = []
for (const file of files) {
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { continue }
  if (!text.includes(BAD)) continue
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.includes(BAD)) hits.push(`${relative(ROOT, file)}:${index + 1}`)
  })
}
if (hits.length) {
  console.error(`✗ قاعدة تنوين الفتح: استخدم «مشروع${GOOD}» لا «مشروع${BAD}».`)
  console.error(hits.slice(0, 80).join('\n'))
  if (hits.length > 80) console.error(`… و${hits.length - 80} موضعاً آخر`)
  process.exit(1)
}
console.log('✓ قاعدة تنوين الفتح سليمة في ملفات الموقع.')
