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
  ['هذي الورقة تقول شي ثاني', 'الشهاده', 'الورقة'],
  ['بالورقة اللي عندك', 'بالشهاده', 'بالورقة'],
  ['والورقة الثانية', 'والشهاده', 'والورقة'],
  ['وجذي صار الكلام', 'وچذي', null],
  ['الفيلكاوي قال', 'الفيلچاوي', 'الفيلكاوي'],
  ['جان عنده حق', 'چان', null],
  ['الجان ما له علاقة', 'الجان', 'الچان'],        // جذعٌ ممنوع من السابقة
  ['بيعرف الجواب', 'بيعرف', 'بايعرف'],           // «ب» أداة استقبال لا سابقة
  ['ويعرف الصح', 'وايعرف', null],
  ['وتعرف الفرق', 'واتعرف', null],
  /* مصفاة اللهجة (١٤ أغسطس ٢٠٢٦): الكلمات المسموعة إماراتيةً تُستبدل في الصوت
     وحده — سياقاً سياقاً: ورقة الحسية غير ورقة الشهادة. */
  ['ناجح في الورقة متردد', 'في الشهاده', 'الورقة'],
  ['يطلع وبيده ورقة تقييم', 'استمارة تقييم', 'شهاده'],
  ['في شهادات ثقلها مو على الورقة', 'على الحبر', 'الشهاده'],
  ['يشوفه الناس في ورقة النتيجة', 'في النتيجة', 'شهاده'],
  ['الغش يطلع عن ورقة وقلم', 'قلم ودفتر', 'شهاده'],
  ['نرجع للورقة والقلم', 'للقلم والدفتر', 'شهاده'],
  ['المهم تنجز الورقة مو تفهمها', 'تنجز المهمة', 'شهاده'],
  ['فيسلم عقله ويطب فيها', 'مخه', 'عقله'],
  ['واحد احترم عقله', 'احترم تفكيره', 'مخه'],
  ['هي إطلاق عقله عشان يعبر', 'إطلاق تفكيره', 'مخه'],
  ['جوانب وايد سبقت فيها التكنولوجيا', 'تعدت فيها', 'سبقت'],
  ['والأمم سبقتنا بأشواط', 'تعدتنا', 'سبقت'],
  ['وهني الورقة ما تبقى ورقة', 'الشهاده ما تبقى شهاده', 'الورقه'],
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
  /* مفردةٌ فقط: بدائل العبارات قد تحذف أولها عمداً فيتصدر «ال» شرعاً («ورقة النتيجة»→«النتيجة»). */
  if (from.includes(' ')) continue
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
