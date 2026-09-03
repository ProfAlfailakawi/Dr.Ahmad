#!/usr/bin/env node
/**
 * مراجعة مقاطع الكتب بعين الدكتور.
 *
 * البوابات الآلية العشرون لا تساوي عيناً بشرية. هذه الأداة تعرض المقاطع
 * دفعةً دفعة — تبدأ بالأضعف صوتاً لأنه الأقرب إلى أن يكون رديئاً — وتتيح
 * حجب ما لا يرضى عنه.
 *
 * القاعدة: **الحجب ببصمة النص لا برقم المقطع.** الأرقام تتغيّر مع كل إعادة
 * توليد؛ البصمة تبقى. فما حُجب مرة لا يعود أبداً.
 *
 *   node scripts/review-book-passages.mjs                    أضعف ٢٠ مقطعاً
 *   node scripts/review-book-passages.mjs --book kids-tech   كتاب بعينه
 *   node scripts/review-book-passages.mjs --page 2 --limit 30
 *   node scripts/review-book-passages.mjs --best             أقرب المقاطع إلى قلمه
 *   node scripts/review-book-passages.mjs --block kids-tech-p012 [--block …]
 *   node scripts/review-book-passages.mjs --blocked          ما حُجب حتى الآن
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { voiceBand } from './book-voice.mjs'
import { looksMisread } from './encyclopedia-passage-expansion.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PASSAGES = resolve(ROOT, 'src/data/book-passages.json')
const BLOCKLIST = resolve(ROOT, 'src/data/book-passage-blocklist.json')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name, fallback) => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback
}
const values = (name) => argv.reduce((list, item, index) => (
  item === `--${name}` && argv[index + 1] ? [...list, argv[index + 1]] : list
), [])

if (!existsSync(PASSAGES)) {
  console.error('✘ لا يوجد src/data/book-passages.json — شغّل npm run books:quotes أولاً.')
  process.exit(1)
}

const file = JSON.parse(readFileSync(PASSAGES, 'utf8'))
const blocklist = existsSync(BLOCKLIST)
  ? JSON.parse(readFileSync(BLOCKLIST, 'utf8'))
  : { policy: 'مقاطع استبعدها الدكتور بعينه.', blocked: [] }

const rows = file.books.flatMap((book) => book.passages.map((passage) => ({ ...passage, bookSlug: book.slug, bookTitle: book.title })))

/* ═══ الحجب ═══ */
const toBlock = values('block')
if (toBlock.length) {
  let added = 0
  for (const id of toBlock) {
    const row = rows.find((item) => item.id === id)
    if (!row) { console.error(`  ✘ لا يوجد مقطع بهذا الرقم: ${id}`); continue }
    if (blocklist.blocked.some((item) => item.fingerprint === row.fingerprint)) {
      console.log(`  · محجوب أصلاً: ${id}`)
      continue
    }
    blocklist.blocked.push({
      fingerprint: row.fingerprint,
      book: row.bookSlug,
      page: row.page,
      /* نحفظ مطلع النص لتعرف لاحقاً ما الذي حجبته ولماذا يبدو مألوفاً. */
      preview: row.text.slice(0, 90),
    })
    added += 1
    console.log(`  ✔ حُجب: ${id} — ${row.text.slice(0, 70)}…`)
  }
  if (added) {
    writeFileSync(BLOCKLIST, `${JSON.stringify(blocklist, null, 2)}\n`, 'utf8')
    console.log(`\nأُضيف ${added} إلى قائمة الحجب. أعد التوليد ليختفي:\n  node scripts/build-book-quotes.mjs`)
  }
  process.exit(0)
}

if (flag('blocked')) {
  if (!blocklist.blocked.length) { console.log('لا مقطع محجوباً حتى الآن.'); process.exit(0) }
  console.log(`المحجوب: ${blocklist.blocked.length} مقطعاً\n`)
  for (const item of blocklist.blocked) console.log(`  ${item.book} ص${item.page} — ${item.preview}…`)
  process.exit(0)
}

/* ═══ عدسة الرقط المقلوب ═══
   التعرّف الضوئي يخلط ب ت ث ن ي، فتخرج «بلعبون» و«نعليم» و«بمكن». وقلبُ
   النقطة يولّد كلمةً صحيحةً أخرى غالباً، فلا تصلح بوابةً — لكنها تختصر
   البحث عن أخطاء التعرّف من ألفٍ وتسعمئة مقطع إلى بضع عشرات تُقرأ بالعين. */
if (flag('misread')) {
  const RUN = /[؀-ۿ]+/gu
  const skeleton = (word) => word.replace(/[ً-ْٰـ]/g, '')
  const frequency = new Map()
  for (const row of rows) for (const match of row.text.match(RUN) || []) {
    const word = skeleton(match)
    frequency.set(word, (frequency.get(word) || 0) + 1)
  }
  const only = value('book', '')
  const pool = only ? rows.filter((row) => row.bookSlug === only) : rows
  let found = 0
  for (const row of pool) {
    for (const match of row.text.match(RUN) || []) {
      const fix = looksMisread(match, frequency)
      if (!fix) continue
      found += 1
      const word = skeleton(match)
      const at = row.text.indexOf(match)
      console.log(`─ ${row.id}  ·  ${row.bookTitle} ص${row.page}`)
      console.log(`  «${word}» ربما «${fix}»`)
      console.log(`  …${row.text.slice(Math.max(0, at - 60), at + match.length + 55)}…\n`)
      break
    }
  }
  console.log(`${found} مرشحاً للنظر. ما ثبت خطؤه:  node scripts/review-book-passages.mjs --block <id>`)
  process.exit(0)
}

/* ═══ العرض ═══ */
const book = value('book', '')
const limit = Number(value('limit', 20)) || 20
const page = Math.max(1, Number(value('page', 1)) || 1)

let pool = book ? rows.filter((row) => row.bookSlug === book) : rows
if (!pool.length) {
  console.error(`✘ لا مقاطع للكتاب «${book}». الكتب: ${file.books.map((item) => item.slug).join(' · ')}`)
  process.exit(1)
}

/* الافتراضي: الأضعف صوتاً أولاً — لأن الرديء يسكن هناك عادةً. */
pool = pool.slice().sort((left, right) => (flag('best') ? right.voice - left.voice : left.voice - right.voice))

const start = (page - 1) * limit
const slice = pool.slice(start, start + limit)
const pages = Math.ceil(pool.length / limit)

console.log(`مراجعة ${pool.length} مقطعاً${book ? ` من «${book}»` : ' من الكتب التسعة'} — صفحة ${page}/${pages}`)
console.log(flag('best') ? 'مرتّبة من الأقرب إلى قلمه.\n' : 'مرتّبة من الأبعد عن قلمه — ابدأ من هنا.\n')

for (const row of slice) {
  console.log(`─ ${row.id}  ·  ${row.bookTitle} ص${row.page}  ·  صوت ${row.voice} (${voiceBand(row.voice)})`)
  console.log(`  ${row.text}\n`)
}

if (page < pages) console.log(`التالي:  node scripts/review-book-passages.mjs${book ? ` --book ${book}` : ''} --page ${page + 1} --limit ${limit}`)
console.log(`للحجب:  node scripts/review-book-passages.mjs --block <id>`)
