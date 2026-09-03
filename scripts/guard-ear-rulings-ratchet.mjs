#!/usr/bin/env node
/**
 * سقّافة أحكام الأذن — تمنع اختفاء حكمٍ سمعه الدكتور واعتمده.
 *
 * العلّة التي بُنيت لها (٢٩ أغسطس ٢٠٢٦): الإيداع a805db6 على main أعاد
 * المتن والمعجم إلى حالةٍ أقدم بيومٍ كامل — دفعةٌ من AI Studio كتبت فوق
 * GitHub بنسخةٍ متأخرة. فذهبت ستةَ عشرَ بديلاً لعائلتَي ركض/هرب، وأحكام
 * الحلقة الثانية الأربعة، و«شغل ← العمل»، و«هالتجربه»، و«النَبرة».
 * ولم يكشفها فاحصٌ واحد: كل الفواحص تسأل «هل الحالي سليم؟» ولا يسأل
 * أيٌّ منها «هل ضاع شيءٌ كان هنا؟». واكتُشفت بأذن الدكتور بعد يومين،
 * حين سمع خطأً كنّا صحّحناه — وهذا أغلى طريقٍ للاكتشاف.
 *
 * وملفّ AI-STUDIO-SYNC.md كان يحذّر من هذا بنصّه: «قبل أي دفعة من
 * AI Studio إلى GitHub مستقبلاً، اسحب/حدّث من GitHub أولاً». التحذير
 * وحده لم يكفِ، فصار حارساً.
 *
 * القاعدة: **الحكم المعتمد لا يزول صامتاً.** كل صيغةٍ في heardByEar،
 * وكل مفتاحٍ في words يقابلها، مسجَّلٌ في خط الأساس. فإن غاب أحدها
 * وقف النشر — إلا أن يكون نقضاً مسجَّلاً صراحةً في withdrawnVocalizations،
 * فالنقض المكتوب حكمٌ أيضاً، والصمت وحده هو الممنوع.
 *
 *   node scripts/guard-ear-rulings-ratchet.mjs
 *   node scripts/guard-ear-rulings-ratchet.mjs --write-baseline   # بعد اعتماده
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write-baseline')
const LEX = resolve(ROOT, 'src/data/kuwaiti-pronunciation.json')
const BASE = resolve(ROOT, 'podcast-audits/ear-rulings-ratchet.json')

const lex = JSON.parse(readFileSync(LEX, 'utf8'))
const heard = Object.keys(lex.heardByEar || {}).sort()
const words = Object.keys(lex.words || {}).sort()
/* المفتاح وحده لا يكفي.
   في رفعة ٢٩ أغسطس ١٢:٠٣ بقيت «بعدين» في المعجم ورجعت قيمتها من «عُقُب»
   إلى «عقب» — أي عاد النطق الذي شكا منه الدكتور بأذنه، والمفاتيح كلها
   حاضرة، فمرّ الفاحص أخضر. الحكم يعيش في القيمة لا في وجود المفتاح. */
const wordValues = Object.fromEntries(words.map((k) => [k, lex.words[k]]))
const withdrawn = new Set((lex.withdrawnVocalizations || []).flatMap(
  (r) => [r?.word, r?.withdrew].filter(Boolean)))

if (WRITE) {
  writeFileSync(BASE, JSON.stringify({
    note: 'خط أساس أحكام الأذن. لا يُحدَّث إلا بعد اعتماد الدكتور — والنقصان فيه '
      + 'يعني أن حكماً سمعه قد زال، وهو ما بُني هذا الحارس ليمنعه.',
    updated: new Date().toISOString().slice(0, 10),
    heardByEar: heard,
    words,
    wordValues,
  }, null, 1) + '\n')
  console.log(`✓ خط الأساس: ${heard.length} حكماً مسموعاً · ${words.length} مدخلاً`)
  process.exit(0)
}

if (!existsSync(BASE)) {
  console.log('ℹ لا خط أساس بعد — أنشئه بـ--write-baseline')
  process.exit(0)
}
const base = JSON.parse(readFileSync(BASE, 'utf8'))
const missingHeard = (base.heardByEar || []).filter((k) => !heard.includes(k) && !withdrawn.has(k))
const missingWords = (base.words || []).filter((k) => !words.includes(k) && !withdrawn.has(k))
/* خطوط الأساس القديمة بلا قيم — تُفحص بالمفاتيح وحدها حتى تُحدَّث. */
const changed = Object.entries(base.wordValues || {})
  .filter(([k, v]) => words.includes(k) && lex.words[k] !== v && !withdrawn.has(k))
  .map(([k, v]) => `${k}: «${v}» ← صار «${lex.words[k]}»`)

if (missingHeard.length || missingWords.length || changed.length) {
  const vanished = missingHeard.length + missingWords.length
  console.error(vanished && changed.length
    ? '⛔ أحكامٌ معتمدة اختفت أو تبدّلت بلا نقضٍ مسجَّل:\n'
    : vanished ? '⛔ أحكامٌ معتمدة اختفت من المعجم بلا نقضٍ مسجَّل:\n'
      : '⛔ أحكامٌ معتمدة تبدّل نطقها بلا نقضٍ مسجَّل:\n')
  if (missingHeard.length) {
    console.error(`  ${missingHeard.length} صيغة سمعها الدكتور واختارها:`)
    for (const k of missingHeard.slice(0, 25)) console.error(`     · ${k}`)
    if (missingHeard.length > 25) console.error(`     … و${missingHeard.length - 25} غيرها`)
  }
  if (missingWords.length) {
    console.error(`\n  ${missingWords.length} مدخلاً في طبقة النطق:`)
    for (const k of missingWords.slice(0, 25)) console.error(`     · ${k}`)
    if (missingWords.length > 25) console.error(`     … و${missingWords.length - 25} غيره`)
  }
  if (changed.length) {
    console.error(`\n  ${changed.length} حكماً بقي مفتاحه وتبدّل نطقه:`)
    for (const line of changed.slice(0, 25)) console.error(`     · ${line}`)
    if (changed.length > 25) console.error(`     … و${changed.length - 25} غيره`)
  }
  console.error('\n  السبب الأرجح: نسخةٌ أقدم كُتبت فوق الأحدث (دفعة AI Studio قبل السحب من GitHub).')
  console.error('  العلاج: استرجع الأحكام، لا تحدّث خط الأساس. وإن كان النقض مقصوداً بأذنه،')
  console.error('  فسجّله في withdrawnVocalizations ثم حدّث خط الأساس بـ--write-baseline.')
  process.exit(1)
}

if (!base.wordValues) {
  console.log('ℹ خط الأساس بلا قيم — يفحص المفاتيح وحدها. حدّثه بـ--write-baseline ليحرس النطق نفسه.')
}
const gained = heard.length - (base.heardByEar || []).length
console.log(`✅ سقّافة الأحكام: ${heard.length} حكماً مسموعاً محفوظاً`
  + (gained > 0 ? ` (+${gained} جديد — حدّث خط الأساس بعد اعتماده)` : ''))
