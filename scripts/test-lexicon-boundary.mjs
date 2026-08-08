#!/usr/bin/env node
/**
 * فاحص حارس حدود الكلمة في قاموس النطق.
 *
 * العطب الذي يحرسه: القاموس كان يُستبدل بالمطابقة الجزئية العمياء، فمدخلٌ قصير
 * يلتصق بما حوله ويمسخه — «Rosenthal» تصير «Rosenthآل»، و«12000» تصير
 * «واحدألفين». وكان في متون المقالات ٤٨ إصابةً حقيقية، تُنطق ممسوخةً في القراءات.
 *
 * والفاحص ذو وجهين، ولا بدّ منهما معاً: يبرهن أن المسخ توقّف، **وأن الضبط
 * الصحيح لم يسقط معه**. فحارسٌ يمنع المسخ بمنع الضبط كلّه ليس حارساً.
 *
 *   node scripts/test-lexicon-boundary.mjs
 */
import { buildPronunciationText, substitutionAllowed } from './lib/arabic-audio-engine.mjs'

let failures = 0
const check = (label, actual, expected) => {
  const ok = actual === expected
  if (!ok) { failures += 1; console.error(`  ✘ ${label}\n      المنتظر: ${expected}\n      الواقع : ${actual}`) }
  return ok
}

/* ═══ ١ · المسخ توقّف ═══ */
console.log('١ · ما كان يُمسخ:')
const corruptions = [
  ['personal development', 'personal development'],      // al داخل personal
  ['Rosenthal وJacobson', 'Rosenthal وJacobson'],          // al داخل اسم عَلَم
  ['Yusefzadeh', 'Yusefzadeh'],                            // de داخل اسم عَلَم
  ['Psychological Bulletin', 'Psychological Bulletin'],    // in و et داخل كلمتين
  ['ما تجرح', 'ما تجرح'],                                   // جرح داخل فعل
  ['الجرحى يُسعفون', 'الجرحى يُسعفون'],                       // جرح داخل جمع
  ['الطرق الدبلوماسية', 'الطرق الدبلوماسية'],                 // بلوم داخل «الدبلوماسية»
  ['البشرميديا', 'البشرميديا'],                              // ميديا داخل نحتٍ للدكتور
]
for (const [input, expected] of corruptions) {
  if (check(input, buildPronunciationText(input).pronunciationText, expected)) console.log(`  ✓ ${input}`)
}
/* الرقم الملتصق: «12000» كانت تصير «واحدألفين» بمدخل السنة 2000 */
const long = buildPronunciationText('في 12000 طالب').pronunciationText
if (/ألفين/.test(long) && /واحدألفين/.test(long)) { failures += 1; console.error('  ✘ الرقم الطويل ما زال ملتصقاً بمدخل السنة') }
else console.log('  ✓ 12000 لا يبتلعها مدخل السنة 2000')

/* ═══ ٢ · الضبط الصحيح لم يسقط ═══ */
console.log('\n٢ · ما يجب أن يبقى مضبوطاً:')
const preserved = [
  ['الكويت', 'الكُوَيْت'],
  ['بالكويت', 'بالكُوَيْت'],          // السابقة المتّصلة تمرّ
  ['والكويت', 'والكُوَيْت'],
  ['فالكويت', 'فالكُوَيْت'],
  ['جامعة الكويت', 'جامعة الكُوَيْت'],
  ['الكويتية', 'الكُوَيْتِيَّة'],
  ['كويتي', 'كُوَيْتِيّ'],
  ['للكويت', 'لِلْكُوَيْت'],           // الصيغ الأربع المضافة
  ['كويتنا', 'كُوَيْتِنا'],
  ['لكويتنا', 'لِكُوَيْتِنا'],
  ['الكويتيين', 'الكُوَيْتِيِّين'],
]
for (const [input, expected] of preserved) {
  if (check(input, buildPronunciationText(input).pronunciationText, expected)) console.log(`  ✓ ${input} → ${expected}`)
}
/* اللواحق: صيغٌ كان الحارس يُسقطها في أول صياغةٍ له، فأُضيفت لها لواحقها */
for (const [input, must] of [['بالتكنولوجيا', 'تِ'], ['التكنولوجيات', 'تِ'], ['الفيديوهات', 'فِ']]) {
  const out = buildPronunciationText(input).pronunciationText
  if (!out.includes(must)) { failures += 1; console.error(`  ✘ ${input} → ${out}`) } else console.log(`  ✓ ${input} → ${out}`)
}
/* ChatGPT له مدخله الكامل، فيُنطق كلّه — لا يُقصّ عند GPT وحدها */
check('ChatGPT', buildPronunciationText('ChatGPT').pronunciationText, 'تشات جي بي تي')
  && console.log('  ✓ ChatGPT → تشات جي بي تي')

/* ═══ ٣ · الحكم على الموضع مباشرةً ═══ */
console.log('\n٣ · حكم الحارس على الموضع:')
const verdicts = [
  ['Rosenthal', 'al', 7, false],
  ['et al. (2019)', 'al', 3, true],
  ['بالكويت', 'الكويت', 1, true],
  ['كتابالكويت', 'الكويت', 4, false],   // «ب» هنا آخر كلمةٍ لا سابقة
]
for (const [text, key, index, expected] of verdicts) {
  const actual = substitutionAllowed(text, key, index)
  if (actual !== expected) { failures += 1; console.error(`  ✘ ${text} · ${key}@${index} → ${actual}`) }
  else console.log(`  ✓ ${text} · ${key}@${index} → ${actual ? 'يُستبدل' : 'يُترك'}`)
}

if (failures) { console.error(`\n✘ ${failures} فحصاً سقط.`); process.exit(1) }
console.log('\n✓ حارس حدود الكلمة سليم: المسخ توقّف والضبط باقٍ.')
