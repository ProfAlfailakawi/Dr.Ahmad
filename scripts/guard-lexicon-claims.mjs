#!/usr/bin/env node
/**
 * حارس ادّعاءات المعجم.
 *
 * السبب: «معلقة ← مربوطة» كانت موصوفةً في layers.mualaqa وغائبةً من words —
 * حُذفت في كنسةٍ للمخترعات وبقي وصفها. فظلّ الدكتور يسمع «معلقة» ويشكو منها
 * ثلاث مرات، وأنا أقرأ الوصف فأحسبها مُصلَحة. الوصف كذبٌ صامت.
 *
 * كل ملاحظةٍ تدّعي استبدالاً يجب أن يكون لها أثرٌ حيٌّ في words.
 * الادّعاء يُعرف بفعله (بُدّلت · تُستبدل · صارت · أُعيدت · سهم)، لا بشكله —
 * لأن العطب الأصلي كان مكتوباً نثراً بلا سهم، فالحارس الذي يقرأ الأسهم وحدها
 * كان يمرّ عليه (جُرّب فسقط، ٢٠ أغسطس).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lex = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-pronunciation.json'), 'utf8'))
const words = lex.words || {}
const layers = lex.layers || {}
const foreign = lex.foreignNames || {}
/* الأثر الحيّ = كل ما يُغيِّر النطق فعلاً: مفاتيح المعجم وقيمه، وأسماءُ الأجانب. */
const live = [...Object.keys(words), ...Object.values(words), ...Object.keys(foreign), ...Object.values(foreign)]
  .map(String)

/* أفعال الادّعاء: وجودُ أحدها يعني أن الملاحظة تصف استبدالاً منفَّذاً. */
const CLAIMS = /بُدّلت|بدّلت|تُستبدل|يُستبدل|استُبدلت|صارت|أُعيدت|أضيفت|أُضيفت|[←→]/u
/* الإعفاء الصريح: ملاحظاتٌ تقول بنفسها إنها قاعدةٌ في المكتبة لا مدخلةٌ معجمية. */
const EXEMPT = /لا مدخلات معجمية|قاعدة شاملة في lib|حُذفت \d+|سقطت|فشلت|رفضها|لم تُجرَّب|مراجع:/u
/* المصطلحات المقتبسة داخل «» — هي المرشّحة لأن تكون مفاتيح أو قيماً. */
const QUOTED = /«([^»]{1,40})»/gu
/* المثال المضادّ: ما نطقه المحرّك خطأً («فلنتير»=Frontiers · نطقها «معلكة»).
   يُطرح من المرشّحين، وإلا رفع الحارس إنذاراً كاذباً على وصفِ العطب نفسه. */
const COUNTER_BEFORE = /(?:نطقها|نطقه|سمعها|سمعه|يقولها|تُقرأ|قرأها)\s*(?:المحرّك|الدكتور)?\s*$/u

const failures = []
let checked = 0

for (const [layer, note] of Object.entries(layers)) {
  if (typeof note !== 'string') continue
  if (!CLAIMS.test(note)) continue
  if (EXEMPT.test(note)) continue
  QUOTED.lastIndex = 0
  const quoted = [...note.matchAll(QUOTED)]
    .filter((m) => !COUNTER_BEFORE.test(note.slice(Math.max(0, m.index - 26), m.index)))
    .filter((m) => note[m.index + m[0].length] !== '=')
    .map((m) => m[1].trim())
    .filter((q) => q.length >= 2)          /* «ب» و«ك» حروفُ شرحٍ لا مدخلات */
  if (!quoted.length) continue
  checked += 1
  /* يكفي أن يكون أحد المقتبسات مفتاحاً حيّاً أو قيمةً حيّة — عندها للملاحظة أثر. */
  /* التطابق في الاتجاهين: «الورقة» تحيا بـ«ورقة النتيجة»، و«ويا» تحيا بـ«وياه». */
  const alive = quoted.some((q) => live.some((e) => e === q || e.includes(q) || q.includes(e)))
  if (!alive) failures.push({ layer, quoted })
}

if (failures.length) {
  console.error('✘ ملاحظاتٌ تدّعي استبدالاً بلا أثرٍ في المعجم:')
  for (const f of failures) {
    console.error(`   [${f.layer}]  تذكر: ${f.quoted.map((q) => `«${q}»`).join(' · ')}`)
    console.error('       ولا واحدةٌ منها لها أثرٌ في المعجم.')
  }
  console.error('\n  إمّا أن تُعاد المدخلة، أو تُحذف الملاحظة. الوصف بلا أثرٍ يخدعنا جميعاً.')
  process.exit(1)
}

console.log(`✅ حارس الادّعاءات: ${checked} ملاحظةً تدّعي استبدالاً، لكلٍّ منها أثرٌ حيٌّ في المعجم (${Object.keys(words).length} مدخلة).`)
