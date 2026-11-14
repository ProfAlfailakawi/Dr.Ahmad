#!/usr/bin/env node
/**
 * iPhone Duo — حارس تعريف «الكتاب المفتوح» (جولة ٢).
 *
 * · الكتاب (صفحتان وكعب) = عرضي فقط: ‎721–1000 × 520–960. الطولي 669×867 عمود واحد.
 * · لا فرع طولي 640–720 ولا نسبة 7/5 ولا horizontal-viewport-segments وحده.
 * · الأجهزة العادية لا تتغيّر: آيفون عرضياً (ارتفاع < 520)، آيباد طولياً (≥ 744)
 *   وعرضياً (≥ 1024)، الحاسوب.
 * · مفاتيح ودجت النظام معرّفة مرة واحدة داخل شرط الشاشة الداخلية، في المتصفح والتطبيق المثبّت معاً (بلا display-mode).
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

/* ودجت النظام: تعريف واحد فقط، داخل شرط الشاشة الداخلية (بلا display-mode). */
const defs = [...read('src/index.css').matchAll(/--duo-cutout-w:\s*116px/g)]
check(defs.length === 1, `--duo-cutout-w يجب أن يُعرَّف مرة واحدة (وُجد ${defs.length})`)
check(/--duo-cutout-h:\s*116px/.test(read('src/index.css')), '--duo-cutout-h غير معرّف')
check([...read('src/index.css').matchAll(/--duo-cutout-reach:\s*268px/g)].length === 1, '--duo-cutout-reach (المدى الرأسي للودجت 268px) يجب أن يُعرَّف مرة واحدة')
const cutBlock = index.slice(0, index.indexOf('--duo-cutout-w:116px'))
const lastMedia = cutBlock.lastIndexOf('@media')
const head = cutBlock.slice(lastMedia)
check(head.includes('orientation:landscape') && head.includes('orientation:portrait'), 'مفاتيح الودجت خارج شرط الشاشة الداخلية')

/* حارس الحجز: يقرأ الاستعلامات الفعلية من الملفات ويقيّمها على المقاسات. */
const evalQuery = (q, w, h) => {
  if (!/^screen\b/.test(q)) return false
  return [...q.matchAll(/\(\s*([a-z-]+)\s*:\s*([a-z0-9]+?)(px)?\s*\)/g)].every(([, k, v]) => {
    if (k === 'min-width') return w >= +v
    if (k === 'max-width') return w <= +v
    if (k === 'min-height') return h >= +v
    if (k === 'max-height') return h <= +v
    if (k === 'orientation') return v === (h >= w ? 'portrait' : 'landscape')
    return false /* أي ميزة أخرى (display-mode…) لا يجوز أن تُقيّد الحجز */
  })
}
const cutoutQueries = (css) => {
  const out = []
  const re = /@media([^{]+)\{/g
  let m
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex
    while (i < css.length && depth) { depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0; i++ }
    const body = css.slice(re.lastIndex, i)
    if (!body.includes('--duo-cutout')) continue
    for (const q of m[1].split(',')) out.push({ q: q.trim(), defines: /--duo-cutout-w\s*:/.test(body) })
  }
  return out
}
const cutQs = ['src/index.css', 'src/pages/mihwar.css'].flatMap((f) => cutoutQueries(read(f)))
check(!cutQs.some((x) => /display-mode/.test(x.q)), 'قاعدة حجز الركن ما زالت مشروطة بـ display-mode')
const defQs = cutQs.filter((x) => x.defines)
const reachDefs = ['src/index.css', 'src/pages/mihwar.css'].flatMap((f) => { const css = read(f); const out = []; const re = /@media([^{]+)\{/g; let m; while ((m = re.exec(css))) { let d = 1, i = re.lastIndex; while (i < css.length && d) { d += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0; i++ } if (/--duo-cutout-reach\s*:/.test(css.slice(re.lastIndex, i))) out.push(m[1].split(',').map((q) => q.trim())) } return out })
check(reachDefs.length === 1 && reachDefs[0].length === 2 && reachDefs[0].every((q) => defQs.some((x) => x.q === q)), '--duo-cutout-reach يجب أن يُعرَّف داخل استعلامَي الشاشة الداخلية نفسيهما')
check(!/(^|[^-])--duo-cutout-(w|h|reach)\s*:/.test(read('src/index.css').replace(/:root \{ --duo-cutout-w: 116px; --duo-cutout-h: 116px; --duo-cutout-reach: 268px; \}/, '')), 'متغيرات الحجز معرَّفة خارج استعلامَي الشاشة الداخلية')
check(defQs.length >= 2, 'لم تُوجد استعلامات تعريف الحجز')
const WANT = norm('screen and (min-width:721px) and (max-width:1000px) and (min-height:520px) and (max-height:960px) and (orientation:landscape)')
const WANT_P = norm('screen and (min-width:640px) and (max-width:720px) and (min-height:520px) and (max-height:960px) and (orientation:portrait)')
check(defQs.some((x) => norm(x.q) === WANT) && defQs.some((x) => norm(x.q) === WANT_P), 'استعلامات الحجز لا تطابق الاستعلامين المعتمدين حرفياً')
const cutApplies = (w, h) => defQs.some((x) => evalQuery(x.q, w, h))
for (const [w, h] of [[951, 669], [951, 585], [669, 867], [720, 900]]) check(cutApplies(w, h), `الحجز يجب أن ينطبق عند ${w}x${h}`)
for (const [w, h] of [[390, 844], [844, 390], [932, 430], [744, 1024], [820, 1180], [1024, 768], [1180, 820], [1280, 800], [1440, 900], [367, 740], [951, 350]]) check(!cutApplies(w, h), `الحجز يجب ألا ينطبق عند ${w}x${h}`)

/* شرط الكتاب في JS يطابق CSS. */
const flow = read('src/lib/book-flow.ts')
check(norm(flow).includes("'" + BOOK_NORM.replace('screen', 'screen') + "'") || norm(flow).includes(BOOK_NORM), 'book-flow.ts: BOOK_QUERY لا يطابق CSS')
check(!/\(max-width:\s*720px\)/.test(flow), 'book-flow.ts: فرع طولي قديم')

if (failures.length) {
  console.error('duo-book: فشل\n - ' + failures.join('\n - '))
  process.exit(1)
}
console.log(`duo-book: ${cases.length} مقاساً وقواعد الكتاب والودجت سليمة`)
