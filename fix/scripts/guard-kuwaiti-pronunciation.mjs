#!/usr/bin/env node
/**
 * حارس طبقة النطق الكويتي.
 *
 * يمنع عودة ثلاث علل سُمعت بالأذن:
 *  ١ ــ السابقة المتّصلة تكسر المطابقة، فتمرّ «الورقة» بإملائها إلى المحرّك فيخمّنها إماراتية.
 *  ٢ ــ بديلٌ في المعجم يُقحم أداة التعريف على نكرة («ورقة» → «الورقه»).
 *  ٣ ــ سابقةٌ تُفتح على جذعٍ لا تحتمله فتمسخه («الجان» → «الچان»، «بيعرف» → «بايعرف»).
 *
 * يخرج بالرمز ١ عند أي إخفاق — ليقف النشر.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildPronunciationMap, toSpokenKuwaiti } from './lib/kuwaiti-pronunciation.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'))

const source = read('src/data/kuwaiti-pronunciation.json')
const entries = buildPronunciationMap(source)
const spoken = (text) => toSpokenKuwaiti(text, entries)

/* حالاتٌ كلٌّ منها علّةٌ سُمعت أو مسخٌ محتمل. الشكل: [المدخل، ما يجب أن يحويه الناتج، ما يجب ألّا يحويه] */
const CASES = [
  ['هذي الورقة تقول شي ثاني', 'الورقه', 'الورقة'],
  ['بالورقة اللي عندك', 'بالورقه', 'بالورقة'],
  ['والورقة الثانية', 'والورقه', 'والورقة'],
  ['يطلع وبيده ورقة تقييم', 'ورقه', 'الورقه'],   // نكرة تبقى نكرة
  ['وجذي صار الكلام', 'وچذي', null],
  ['الفيلكاوي قال', 'الفيلچاوي', 'الفيلكاوي'],
  ['جان عنده حق', 'چان', null],
  ['الجان ما له علاقة', 'الجان', 'الچان'],        // جذعٌ ممنوع من السابقة
  ['بيعرف الجواب', 'بيعرف', 'بايعرف'],           // «ب» أداة استقبال لا سابقة
  ['ويعرف الصح', 'وايعرف', null],
  ['وتعرف الفرق', 'واتعرف', null],
]

let failed = 0
for (const [input, must, mustNot] of CASES) {
  const got = spoken(input)
  const okHas = got.includes(must)
  const okNot = mustNot === null || !got.includes(mustNot)
  if (okHas && okNot) { console.log(`✅ ${input} → ${got}`); continue }
  failed++
  console.error(`❌ ${input} → ${got}`)
  if (!okHas) console.error(`   المتوقع أن يحوي: ${must}`)
  if (!okNot) console.error(`   ممنوع أن يحوي: ${mustNot}`)
}

/* لا بديلَ في المعجم يُقحم أداة التعريف على جذعٍ لا يحملها. */
for (const [from, to] of Object.entries(source.words || {})) {
  if (!from.startsWith('ال') && String(to).startsWith('ال')) {
    failed++
    console.error(`❌ المعجم يُقحم أداة التعريف: «${from}» → «${to}»`)
  }
}

if (failed) {
  console.error(`\n${failed} إخفاق — النشر موقوف.`)
  process.exit(1)
}
console.log(`\n✅ ${CASES.length}/${CASES.length} — طبقة النطق سليمة.`)
