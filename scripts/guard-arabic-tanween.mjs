#!/usr/bin/env node
/**
 * سياسة التنوين الدائمة للموقع:
 *   «مشروعاً» — تنوين الفتح على الألف.
 *   «ممدوحٌ»   — تنوين الضم ملاصق للحرف.
 *   «كتابٍ»    — تنوين الكسر ملاصق للحرف.
 *
 * الحارس لا يقرر الإعراب؛ مهمته منع الأخطاء الطباعية التي نستطيع إثباتها:
 *  1) ً قبل ألف النصب (الصيغة غير المعتمدة في الموقع).
 *  2) فصل أي تنوين عن الحرف بمسافة/tab.
 *  3) تكرار علامة التنوين نفسها مرتين.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = resolve('.')
const FATHATAN = '\u064B'
const DAMMATAN = '\u064C'
const KASRATAN = '\u064D'
const BAD_FATH_BEFORE_ALIF = `${FATHATAN}ا`
const GOOD_FATH_ON_ALIF = `ا${FATHATAN}`
const DETACHED_TANWEEN = /[\u0621-\u064A\u0671-\u06D3][ \t]+[\u064B-\u064D]/u
const DUPLICATED_TANWEEN = /([\u064B-\u064D])\1/u
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.md', '.yml', '.yaml', '.css', '.txt'])
const ROOT_FILES = ['index.html', 'server.mjs', 'data.ts', 'ui.tsx', 'Admin.tsx', 'ArticleDetail.tsx', 'build-static.mjs', 'instructions.md']
const ROOT_DIRS = ['src', 'scripts', 'public', '.github', 'whatsapp-agent', 'whatsapp-web-bridge']
const IGNORE = new Set(['node_modules', 'dist', '.git', '.audio-human-work', 'audio-audits', 'podcast-audits', '.codex-backups'])

function normalizeTanween(value = '') {
  return String(value)
    .normalize('NFC')
    .replaceAll(BAD_FATH_BEFORE_ALIF, GOOD_FATH_ON_ALIF)
    .replace(/([\u0621-\u064A\u0671-\u06D3])[ \t]+([\u064B-\u064D])/g, '$1$2')
    .replace(/([\u064B-\u064D])\1+/g, '$1')
}

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
  const preferred = ['مشروعاً', 'ممدوحٌ', 'كتابٍ']
  const bad = [`مشروع${BAD_FATH_BEFORE_ALIF}`, `ممدوح \u064C`, `كتاب \u064D`, `كتاب\u064D\u064D`]
  if (preferred.some((sample) => normalizeTanween(sample) !== sample)) throw new Error('preferred tanween samples changed')
  if (normalizeTanween(bad[0]) !== preferred[0]) throw new Error('fathatan-on-alif normalization failed')
  if (normalizeTanween(bad[1]) !== preferred[1]) throw new Error('dammatan attachment normalization failed')
  if (normalizeTanween(bad[2]) !== preferred[2]) throw new Error('kasratan attachment normalization failed')
  if (normalizeTanween(bad[3]) !== preferred[2]) throw new Error('duplicate tanween normalization failed')
  console.log('✓ سياسة التنوين الثلاثية: مشروعاً · ممدوحٌ · كتابٍ')
  process.exit(0)
}

const hits = []
for (const file of files) {
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { continue }
  text.split(/\r?\n/).forEach((line, index) => {
    const reasons = []
    if (line.includes(BAD_FATH_BEFORE_ALIF)) reasons.push('تنوين الفتح قبل الألف')
    if (DETACHED_TANWEEN.test(line)) reasons.push('تنوين مفصول عن الحرف')
    if (DUPLICATED_TANWEEN.test(line)) reasons.push('تنوين مكرر')
    if (reasons.length) hits.push(`${relative(ROOT, file)}:${index + 1} — ${reasons.join('، ')}`)
  })
}
if (hits.length) {
  console.error('✗ سياسة التنوين: اعتمد «مشروعاً»، «ممدوحٌ»، «كتابٍ» من دون فصل أو تكرار للعلامة.')
  console.error(hits.slice(0, 100).join('\n'))
  if (hits.length > 100) console.error(`… و${hits.length - 100} موضعاً آخر`)
  process.exit(1)
}
console.log('✓ سياسة التنوين الثلاثية سليمة في ملفات الموقع.')
