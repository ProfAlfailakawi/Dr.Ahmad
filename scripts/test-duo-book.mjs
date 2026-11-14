#!/usr/bin/env node
/**
 * iPhone Duo — حارس تعريف «الكتاب المفتوح» (جولة ٢).
 *
 * · الكتاب (صفحتان وكعب) = عرضي فقط: ‎721–1000 × 520–960. الطولي 669×867 عمود واحد.
 * · لا فرع طولي 640–720 ولا نسبة 7/5 ولا horizontal-viewport-segments وحده.
 * · الأجهزة العادية لا تتغيّر: آيفون عرضياً (ارتفاع < 520)، آيباد طولياً (≥ 744)
 *   وعرضياً (≥ 1024)، الحاسوب.
 * · مفاتيح ودجت النظام معرّفة مرة واحدة داخل شرط الشاشة الداخلية + standalone.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')
const failures = []
const check = (ok, msg) => { if (!ok) failures.push(msg) }

const BOOK = (w, h) => w >= 721 && w <= 1000 && h >= 520 && h <= 960 && w > h
const INNER_PORTRAIT = (w, h) => w >= 640 && w <= 720 && h >= 520 && h <= 960 && h >= w

const cases = [
  [951, 585, true], [951, 669, true], [800, 600, true], [721, 520, true],
  [669, 867, false], [720, 900, false], [640, 700, false], [382, 580, false], [367, 740, false],
  [390, 844, false], [844, 390, false], [852, 393, false], [744, 1024, false], [768, 1024, false],
  [1024, 768, false], [1280, 800, false], [1440, 900, false], [951, 350, false], [951, 500, false],
]
for (const [w, h, expect] of cases) check(BOOK(w, h) === expect, `BOOK(${w}x${h}) يجب أن يكون ${expect}`)
check(INNER_PORTRAIT(669, 867) && !INNER_PORTRAIT(390, 844) && !INNER_PORTRAIT(744, 1024), 'الطولي الداخلي (للودجت فقط) 640–720')

const norm = (s) => s.replace(/\s+/g, '').toLowerCase()
const BOOK_NORM = norm('screen and (min-width: 721px) and (max-width: 1000px) and (min-height: 520px) and (max-height: 960px) and (orientation: landscape)')

for (const file of ['src/index.css', 'src/pages/radio.css', 'src/pages/mihwar.css', 'src/beauty.css', 'src/polish.css']) {
  let css = ''
  try { css = read(file) } catch { continue }
  const n = norm(css)
  check(!/min-width:640px\)and\(max-width:720px\)and\(min-height:520px\)(?!and\(max-height:960px\)and\(orientation:portrait)/.test(n), `${file}: فرع الكتاب الطولي 640–720 ما زال موجوداً`)
  check(!n.includes('min-aspect-ratio:7/5'), `${file}: شرط النسبة 7/5 القديم ما زال موجوداً`)
  for (const m of n.matchAll(/@media[^{]*horizontal-viewport-segments:2[^{]*\{/g)) {
    check(m[0].includes('orientation:landscape') && m[0].includes('min-width:721px'), `${file}: horizontal-viewport-segments خارج شرط الكتاب`)
  }
}
const index = norm(read('src/index.css'))
check(index.includes(BOOK_NORM + '{--duo-spine') || index.includes('@media' + BOOK_NORM + '{:root{--duo-spine'), 'index.css: كتلة الكتاب لا تبدأ بشرط BOOK المعتمد')
check(norm(read('src/pages/radio.css')).includes('@media' + BOOK_NORM), 'radio.css: لا يستعمل شرط BOOK المعتمد')
check(norm(read('src/pages/mihwar.css')).includes('@media' + BOOK_NORM), 'mihwar.css: لا يستعمل شرط BOOK المعتمد')
check(!norm(read('src/pages/mihwar.css')).includes('min-width:640px)and(max-width:680px)'), 'mihwar.css: شريط الكتاب الطولي ما زال موجوداً')

/* ودجت النظام: تعريف واحد فقط، داخل standalone وشاشة داخلية. */
const defs = [...read('src/index.css').matchAll(/--duo-cutout-w:\s*116px/g)]
check(defs.length === 1, `--duo-cutout-w يجب أن يُعرَّف مرة واحدة (وُجد ${defs.length})`)
check(/--duo-cutout-h:\s*116px/.test(read('src/index.css')), '--duo-cutout-h غير معرّف')
const cutBlock = index.slice(0, index.indexOf('--duo-cutout-w:116px'))
const lastMedia = cutBlock.lastIndexOf('@media')
const head = cutBlock.slice(lastMedia)
check(head.includes('(display-mode:standalone)') && head.includes('orientation:landscape') && head.includes('orientation:portrait'), 'مفاتيح الودجت خارج شرط standalone + الشاشة الداخلية')

/* شرط الكتاب في JS يطابق CSS. */
const flow = read('src/lib/book-flow.ts')
check(norm(flow).includes("'" + BOOK_NORM.replace('screen', 'screen') + "'") || norm(flow).includes(BOOK_NORM), 'book-flow.ts: BOOK_QUERY لا يطابق CSS')
check(!/\(max-width:\s*720px\)/.test(flow), 'book-flow.ts: فرع طولي قديم')

if (failures.length) {
  console.error('duo-book: فشل\n - ' + failures.join('\n - '))
  process.exit(1)
}
console.log(`duo-book: ${cases.length} مقاساً وقواعد الكتاب والودجت سليمة`)
