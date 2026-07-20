#!/usr/bin/env node
/**
 * ماحي المحذوف — «أيّ شيء أحذفه يُحذف من كل مكان».
 *
 * إخفاءُ المحذوف عند البناء لا يكفي: يبقى نصُّه في المستودع، وصفحتُه القديمة
 * على القرص، وبطاقتُه الاجتماعية — فيعود مع أوّل لقطةٍ أو دفعةٍ قديمة تُرجع
 * الملف الأساسي، كما عادت ورقةُ السبورة التفاعلية بعد أن حُذفت. المحوُ من
 * الأصل يجعل الحذف نهائياً مهما جرى بعده.
 *
 * مصدر الحقيقة قرارُ الدكتور في اللوحة (`content_overrides` بـ`deleted` أو
 * `hidden`)، لا قائمةٌ يدوية — فما يحذفه اليوم يُمحى في أوّل تشغيلة.
 *
 * ولا يلمس شيئاً لم يأمر بحذفه: يقرأ القرار، ويمحو ما يطابقه، ويطبع كل ما
 * فعله باسمه. ويرفض الكتابة إن انكسر ملفٌ تحت يده.
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const APPLY = process.argv.includes('--apply')

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * حذف كتلة المدخل كاملةً من ملف بيانات TypeScript.
 *
 * القصُّ بالسطر لا يصلح: ١٧٣ مدخلاً في `src/data.ts` يمتدّ على أسطرٍ عدّة،
 * فحذفُ سطر الـslug وحده يترك ذيلاً بلا رأس ويكسر الملفَّ كلَّه (جرّبناه فسقط
 * على `TS1005: ',' expected`). فنبدأ من سطر الـslug، نرجع إلى أوّل `{` فتحت
 * الكتلة، ثم نمضي بموازنة الأقواس حتى تُغلق — فلا نقصّ إلا مدخلاً تامّاً.
 *
 * ويمحو من **كل** مصفوفةٍ يظهر فيها الـslug لا من مصفوفة المقالات وحدها:
 * المقال المحذوف قد يكون له اقتباسٌ في `essays` يبقى معروضاً بعد ذهابه.
 */
export function dropEntryBlocks(source, slugs) {
  let lines = source.split('\n')
  const removed = []
  for (const slug of slugs) {
    const pattern = new RegExp(`slug:\\s*'${escape(slug)}'`)
    /* حلقة: المدخل نفسه قد يتكرّر في أكثر من مصفوفة */
    for (;;) {
      const at = lines.findIndex((line) => pattern.test(line))
      if (at === -1) break
      let start = at
      while (start >= 0 && !lines[start].includes('{')) start -= 1
      if (start < 0) break
      let depth = 0
      let end = start
      let closed = false
      for (; end < lines.length; end += 1) {
        for (const ch of lines[end]) {
          if (ch === '{') depth += 1
          else if (ch === '}') depth -= 1
        }
        if (depth <= 0) { closed = true; break }
      }
      if (!closed) break
      lines = [...lines.slice(0, start), ...lines.slice(end + 1)]
      removed.push(slug)
    }
  }
  return { text: lines.join('\n'), removed }
}

/** توازن الأقواس في الملف — شرطُ سلامةٍ نرفض الكتابة بدونه */
export function braceBalance(source) {
  let depth = 0
  for (const ch of source) {
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
  }
  return depth
}


/**
 * حذف مفتاحٍ من خريطة `'مفتاح': 'قيمة'` — كما في `src/data-en.ts`.
 * القيمة قد تنزل سطراً ثانياً، فنمضي حتى ينتهي المدخل بفاصلة.
 */
export function dropMapKeys(source, keys) {
  let lines = source.split('\n')
  const removed = []
  for (const key of keys) {
    const at = lines.findIndex((line) => new RegExp(`^\\s*'${escape(key)}'\\s*:`).test(line))
    if (at === -1) continue
    let end = at
    while (end < lines.length && !/,\s*$/.test(lines[end])) end += 1
    lines = [...lines.slice(0, at), ...lines.slice(end + 1)]
    removed.push(key)
  }
  return { text: lines.join('\n'), removed }
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }
  let pass = 0
  const t = (m, c) => { assert(c, m); pass++ }

  const data = [
    'export const essays = [',
    "  { slug: 'dead-one', tag: 'x', quote: 'اقتباسٌ يجب أن يذهب معه' },",
    ']',
    'export const articles = [',
    "  { slug: 'alive-one', title: 'باقٍ' },",
    "  { slug: 'dead-one', title: 'محذوف', excerpt:",
    "      'نصٌّ طويلٌ على سطرٍ ثانٍ' },",
    "  { slug: 'alive-two', title: 'باقٍ', meta: { year: 2020 } },",
    ']',
  ].join('\n')
  const a = dropEntryBlocks(data, ['dead-one'])
  t('★ المدخل الممتدّ على أسطر يُقصّ كاملاً — القصُّ بالسطر كسر الملف فعلاً', a.text.includes('alive-two'))
  t('★ ويُمحى من كل مصفوفة — لا اقتباسَ يبقى لمقالٍ ذهب', a.removed.length === 2)
  t('ولا أثرَ له', !a.text.includes('dead-one'))
  t('★ والأقواس تبقى متوازنة', braceBalance(a.text) === braceBalance(data))
  t('ويبقى الأحياء بكامل حقولهم', a.text.includes('year: 2020') && a.text.includes('alive-one'))
  t('★ ما لم يُطلب حذفه لا يُمَسّ', dropEntryBlocks(data, ['ghost']).text === data)

  const papers = [
    'export const researchPapers = [',
    '  {',
    "    slug: 'keep-me',",
    '    meta: { year: 2020 },',
    '  },',
    '  {',
    "    slug: 'drop-me',",
    '    meta: { year: 2021 },',
    '  },',
    ']',
  ].join('\n')
  const p = dropEntryBlocks(papers, ['drop-me'])
  t('★ الكتلة متعددة الأسطر تُقصّ كاملةً', !p.text.includes('drop-me') && p.text.includes('keep-me'))
  t('★ والأقواس الداخلية لا تخدع الموازنة', p.text.includes('year: 2020') && braceBalance(p.text) === 0)
  t('ويبقى الملف مغلقاً', p.text.trim().endsWith(']'))

  const map = [
    'export const titlesEn = {',
    "  'keep': 'Kept Title',",
    "  'drop':",
    "    'A long English title that wrapped to a second line',",
    "  'keep2': 'Also kept',",
    '}',
  ].join('\n')
  const mp = dropMapKeys(map, ['drop'])
  t('★ مفتاح الخريطة يُحذف بقيمته الملتفّة على سطرين', !mp.text.includes('drop') && !mp.text.includes('wrapped'))
  t('ويبقى جاراه', mp.text.includes('keep') && mp.text.includes('Also kept'))
  t('والخريطة تبقى مغلقة', braceBalance(mp.text) === 0)

  console.log(`✓ اختبارات ماحي المحذوف: ${pass}/${pass}`)
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) {
  console.log('⚠ لا sa.json — لا يمكن قراءة قرارات اللوحة. تخطّي.')
  process.exit(0)
}

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const snapshot = await getFirestore(app).collection('content_overrides').get()

const articleSlugs = []
const paperSlugs = []
snapshot.forEach((document) => {
  const data = document.data()
  if (data?.deleted !== true && data?.hidden !== true) return
  const [kind, ...rest] = document.id.split(':')
  const slug = rest.join(':')
  if (kind === 'article') articleSlugs.push(slug)
  else if (kind === 'paper') paperSlugs.push(slug)
})

console.log(`═══ ماحي المحذوف · ${articleSlugs.length} مقالاً و${paperSlugs.length} ورقة ═══\n`)

const actions = []
const writes = []

/* ١) قائمة المقالات */
const dataPath = resolve(ROOT, 'src/data.ts')
const dataOut = dropEntryBlocks(readFileSync(dataPath, 'utf8'), articleSlugs)
if (dataOut.removed.length) {
  actions.push(['src/data.ts', dataOut.removed.length])
  writes.push([dataPath, dataOut.text])
}

/* ٢) الأبحاث */
const papersPath = resolve(ROOT, 'src/data/research-papers.ts')
const papersSource = readFileSync(papersPath, 'utf8')
const papersOut = dropEntryBlocks(papersSource, paperSlugs)
if (papersOut.removed.length) {
  actions.push(['src/data/research-papers.ts', papersOut.removed.length])
  writes.push([papersPath, papersOut.text])
}

/* ٣) المرآة الإنجليزية — عناوينُ ما حُذف تبقى معروضةً في /en/research */
const enPath = resolve(ROOT, 'src/data-en.ts')
if (existsSync(enPath)) {
  const enSource = readFileSync(enPath, 'utf8')
  const enOut = dropMapKeys(enSource, [...articleSlugs, ...paperSlugs])
  if (enOut.removed.length) {
    actions.push(['src/data-en.ts', enOut.removed.length])
    writes.push([enPath, enOut.text])
  }
}

/* ٣) المتون — المنشورة والمُشكَّلة */
for (const file of ['src/data/bodies.json', 'src/data/bodies-vocalized.json']) {
  const path = resolve(ROOT, file)
  if (!existsSync(path)) continue
  const map = JSON.parse(readFileSync(path, 'utf8'))
  const gone = articleSlugs.filter((slug) => slug in map)
  if (!gone.length) continue
  for (const slug of gone) delete map[slug]
  actions.push([file, gone.length])
  writes.push([path, `${JSON.stringify(map, null, 2)}\n`])
}

/* ٤) صفحاتٌ وبطاقاتٌ بقيت على القرص من بناءٍ قديم */
const stale = []
for (const slug of articleSlugs) {
  for (const rel of [`articles/${slug}.html`, `articles/${slug}/index.html`, `og/articles/${slug}.svg`]) {
    if (existsSync(resolve(ROOT, rel))) stale.push(rel)
  }
}
if (stale.length) actions.push(['ملفات على القرص', stale.length])

for (const [label, count] of actions) console.log(`  · ${String(label).padEnd(34)} ${count}`)
if (!actions.length) console.log('  ✓ لا أثرَ للمحذوف في أيّ مصدر — نظيف.')

if (!APPLY) {
  console.log('\nⓘ تشغيلةٌ جافّة. أضف --apply للمحو.')
  process.exit(0)
}

/* التحقّق قبل الكتابة: ملفّا TypeScript يجب أن يبقيا سليمَي التركيب. القصُّ
   بالسطر كسر `data.ts` فعلاً في تجربةٍ سابقة، ولو مضى لسقط الموقع كلُّه. فلا
   نكتب حرفاً حتى يتوازن القوسان ويَنقص عدُّ المدخلات بالقدر المقصود تماماً. */
for (const [label, source, out] of [
  ['src/data.ts', readFileSync(dataPath, 'utf8'), dataOut],
  ['src/data/research-papers.ts', papersSource, papersOut],
]) {
  if (!out.removed.length) continue
  const before = (source.match(/\bslug:\s*'/g) || []).length
  const after = (out.text.match(/\bslug:\s*'/g) || []).length
  if (braceBalance(out.text) !== braceBalance(source) || after !== before - out.removed.length) {
    console.error(`\n✘ ${label} انكسر تحت المحو — لم يُكتب شيء.`)
    console.error(`  الأقواس: ${braceBalance(source)} ← ${braceBalance(out.text)} · المدخلات: ${before} ← ${after} (المتوقَّع ${before - out.removed.length})`)
    process.exit(1)
  }
}

for (const [path, text] of writes) writeFileSync(path, text)
for (const rel of stale) rmSync(resolve(ROOT, rel), { force: true, recursive: true })
for (const slug of articleSlugs) {
  const dir = resolve(ROOT, `articles/${slug}`)
  if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true })
}

console.log(`\n✔ مُحي من ${writes.length} ملفَ بيانات و${stale.length} ملفاً على القرص. الحذف نهائيّ الآن.`)
