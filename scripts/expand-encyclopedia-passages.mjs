#!/usr/bin/env node
/**
 * إعادة بناء فهرس متن موسوعة تكنولوجيا التعليم وحده، مع تقرير مفصّل.
 *
 * الفهرس الكامل (الكتب التسعة) يُبنى بـ: node scripts/build-book-quotes.mjs
 * وهذه الأداة للموسوعة خاصةً: تعرض التغطية وأسباب ما لم يُفهرس، وتكتب
 * النتيجة في src/data/book-passages.json بلا مساسٍ ببقية الكتب.
 *
 * يلزمها ملف الكتاب في PrivateBooks و: pip3 install pypdf pymupdf
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEncyclopediaBodyIndex, loadEncyclopediaBook } from './encyclopedia-passage-expansion.mjs'
import { voiceScore } from './book-voice.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'src/data/book-passages.json')
const BLOCKLIST = resolve(ROOT, 'src/data/book-passage-blocklist.json')

const payload = JSON.parse(readFileSync(FILE, 'utf8'))
const encyclopedia = payload.books.find((book) => book.slug === 'encyclopedia')
if (!encyclopedia) throw new Error('لم أجد سجل موسوعة تكنولوجيا التعليم في book-passages.json')

const knowledge = JSON.parse(readFileSync(resolve(ROOT, 'src/data/book-knowledge.json'), 'utf8'))
const concepts = knowledge.books.find((book) => book.slug === 'encyclopedia')?.concepts || []
let blocked = new Set()
try {
  blocked = new Set((JSON.parse(readFileSync(BLOCKLIST, 'utf8')).blocked || []).map((item) => String(item.fingerprint || '')))
} catch { /* لا قائمة حجب بعد */ }

const before = encyclopedia.passages.length
const { pages } = loadEncyclopediaBook()
const { passages, report } = buildEncyclopediaBodyIndex({
  pages,
  concepts,
  blockedFingerprints: blocked,
  voiceOf: (text) => voiceScore(text).score,
})

encyclopedia.passages = passages
payload.coverage.passages = payload.books.reduce((sum, book) => sum + book.passages.length, 0)
payload.coverage.encyclopediaPassages = passages.length
payload.coverage.encyclopediaPagesIndexed = report.coveredPageCount
payload.coverage.encyclopediaBodyPages = report.bodyPageCount
writeFileSync(FILE, `${JSON.stringify(payload)}\n`, 'utf8')

const percent = Math.round((report.coveredPageCount / report.bodyPageCount) * 100)
console.log(`✔ موسوعة تكنولوجيا التعليم: ${before} ← ${passages.length} مقطعاً`)
console.log(`✔ التغطية: ${report.coveredPageCount} صفحة من ${report.bodyPageCount} صفحة متن (${percent}٪) · ${report.totalChars.toLocaleString('ar-EG')} حرفاً`)
console.log(`✔ جدول لقاءات الخط: ${report.ligatures.learned} لقاءً من ${report.ligatures.explainedWords.toLocaleString('ar-EG')} كلمة موثّقة (${report.ligatures.stubbornWords} عصيّة)`)

if (process.argv.includes('--report')) {
  console.log('\nأسباب إسقاط الجمل:')
  for (const [reason, count] of Object.entries(report.stats.dropped).sort((left, right) => right[1] - left[1])) {
    console.log(`   ${String(count).padStart(5)} — ${reason}`)
  }
  console.log('\nأسباب رفض المقاطع المجمَّعة:')
  for (const [reason, count] of Object.entries(report.stats.rejected).sort((left, right) => right[1] - left[1])) {
    console.log(`   ${String(count).padStart(5)} — ${reason}`)
  }
  const grouped = new Map()
  for (const item of report.uncovered) grouped.set(item.reason, (grouped.get(item.reason) || 0) + 1)
  console.log('\nالصفحات غير المفهرسة:')
  for (const [reason, count] of [...grouped].sort((left, right) => right[1] - left[1])) {
    console.log(`   ${String(count).padStart(5)} — ${reason}`)
  }
}
