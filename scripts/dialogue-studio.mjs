#!/usr/bin/env node
/**
 * حَكَمُ الحوار اليدويّ — يقيس النصّ على أسلوب الدكتور المعتمد، ويمنع التحريف.
 *
 * الدكتور اعتمد ملفاً واحداً وقال: «بنفس الأسلوب تماماً». والأسلوب انطباعٌ لا
 * يُختبر ما لم يصر رقماً، فقِسناه من ملفه المعتمد:
 *   ٣٥ مداخلة · يبدأ الرجل وتختم المرأة · ٤٣٧ كلمة · متوسط ١٢٫٥ للمداخلة
 *   وسومٌ بعددٍ محسوب: [تداخل]×٢ [موسيقى]×٢ [تأمل]×٣ [اعتراض هادئ]×٣
 *   [رد قصير]×٢ [خلاصة]×٢ · وسبعُ تتابعاتٍ لنفس المتحدث (بعد التداخل والردّ)
 *
 * وشرطُه الأصعب: «بدون تحريف وبدون كلام من عنده». فالحوار يشرح المقال ولا
 * يزيد عليه. ولا سبيل إلى إثبات ذلك بالنية — فنقيسه: كم من كلمات الحوار
 * الدالّة موجودةٌ في المقال؟ ما شذّ يُعرض بعينه ليُراجَع، لا يُدفن في نسبة.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

export const CLOSING_LINE = 'ولمن أراد الفكرة كاملة، يمكنه قراءة المقال الأصلي في موقع الدكتور أحمد حسين الفيلكاوي.'

/** مواصفة الأسلوب — مقيسةٌ من ملف الدكتور المعتمد، بهامشٍ معقول */
export const SPEC = {
  turns: [30, 40],
  words: [380, 520],
  wordsPerTurn: [9, 16],
  longestTurn: 26,
  tags: { 'تداخل': [1, 3], 'موسيقى': [2, 3], 'تأمل': [2, 4], 'اعتراض هادئ': [2, 4], 'رد قصير': [1, 3], 'خلاصة': [2, 2] },
  grounding: 0.62,
}

const norm = (value) => String(value || '')
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^ء-يa-zA-Z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ').trim()

/** كلماتٌ لا تدلّ على معنًى خاصّ فلا تُحاسب في الإسناد */
const STOP = new Set(norm('في من على الي عن مع هذا هذه ذلك تلك التي الذي ما لا لم لن قد هل ان انه انها كان كانت يكون نحن هم هي هو انت انا كل بعض غير او و ثم بل لكن حتي اذا لو كما بين عند لدي هنا هناك ايضا فقط جدا نعم ليس بلا بها به لها له منه منها فيه فيها عليه عليها اليه اليها شيء شي امر يمكن يجب نريد اريد نقول يقول قال قالت اقول تقول نري اري نعرف يعرف اكثر اقل اول اخر مره مرات نفسه نفسها بعد قبل حين وقت اليوم الان').split(' '))

/** تحليل النصّ إلى مداخلات — بالصيغة التي يفهمها محرّر اللوحة نفسه */
export function parseScript(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean)
  const turns = []
  for (const line of lines) {
    const match = line.match(/^(الرجل|المرأة)\s*:\s*(.+)$/u)
    if (!match) { if (turns.length) turns[turns.length - 1].text += ` ${line}`; continue }
    const speaker = match[1] === 'الرجل' ? 'male' : 'female'
    const raw = match[2].trim()
    const tags = [...raw.matchAll(/\[([^\]]+)\]/g)].map((hit) => hit[1].trim())
    turns.push({ speaker, raw, tags, text: raw.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim() })
  }
  return turns
}

/** تدقيقٌ كامل: البنية والأسلوب والإسناد إلى المقال */
export function auditDialogue(script, articleBody = '') {
  const turns = parseScript(script)
  const problems = []
  const note = (message) => problems.push(message)

  if (turns.length < SPEC.turns[0] || turns.length > SPEC.turns[1]) note(`عدد المداخلات ${turns.length} خارج ${SPEC.turns.join('–')}`)
  if (turns.length && turns[0].speaker !== 'male') note('يجب أن يبدأ الرجل — كما في ملف الدكتور')
  if (turns.length && turns[turns.length - 1].speaker !== 'female') note('يجب أن تختم المرأة')
  if (turns.length && turns[turns.length - 1].text !== CLOSING_LINE) note('السطر الأخير ليس جملة الإحالة المعتمدة حرفاً بحرف')

  const words = turns.map((turn) => turn.text.split(/\s+/).filter(Boolean).length)
  const total = words.reduce((sum, count) => sum + count, 0)
  if (total < SPEC.words[0] || total > SPEC.words[1]) note(`مجموع الكلمات ${total} خارج ${SPEC.words.join('–')}`)
  const average = total / Math.max(1, turns.length)
  if (average < SPEC.wordsPerTurn[0] || average > SPEC.wordsPerTurn[1]) note(`متوسط المداخلة ${average.toFixed(1)} خارج ${SPEC.wordsPerTurn.join('–')}`)
  const longest = Math.max(0, ...words)
  if (longest > SPEC.longestTurn) note(`أطول مداخلة ${longest} كلمة — الحوار يُقطَّع ولا يُخطَب`)

  /* الوسوم: غيابُها يُخرج الحوار من أسلوبه فيصير قراءةً بصوتين */
  const counted = {}
  for (const turn of turns) for (const tag of turn.tags) {
    const key = /^تداخل/.test(tag) ? 'تداخل' : tag
    counted[key] = (counted[key] || 0) + 1
  }
  for (const [tag, [low, high]] of Object.entries(SPEC.tags)) {
    const found = counted[tag] || 0
    if (found < low || found > high) note(`الوسم [${tag}] ورد ${found} مرة والمطلوب ${low === high ? low : `${low}–${high}`}`)
  }

  /* التتابع: مداخلتان متتاليتان لمتحدثٍ واحد أسلوبٌ مقصود في ملف الدكتور —
     يُكمل فكرته أو يستدرك على نفسه، سبعَ مراتٍ في خمسٍ وثلاثين. فلا يُمنع.
     والممنوع ثلاثٌ متتالية: تلك خطبةٌ قُطّعت أسطراً، لا حوار. */
  let runs = 0
  for (let i = 1; i < turns.length; i += 1) {
    if (turns[i].speaker !== turns[i - 1].speaker) continue
    runs += 1
    if (i >= 2 && turns[i - 1].speaker === turns[i - 2].speaker) note(`المداخلة ${i + 1}: ثلاثُ مداخلاتٍ متتالية لمتحدثٍ واحد — خطبةٌ لا حوار`)
  }
  if (runs > 10) note(`تتابعات المتحدث نفسه ${runs} — أكثر من أسلوب الدكتور (سبعٌ في ملفه)`)
  if (runs < 3) note(`تتابعات المتحدث نفسه ${runs} — أقلّ من أسلوبه؛ الحوار يصير تبادلاً آلياً`)

  /* ★ الإسناد: كلماتُ الحوار الدالّة يجب أن تكون من المقال.
     لا يمنع هذا الصياغة الحرّة، لكنه يمنع إقحام وقائع ليست فيه. */
  const source = new Set(norm(articleBody).split(' ').filter((word) => word.length > 2))
  const spoken = [...new Set(turns.flatMap((turn) => norm(turn.text).split(' ')))]
    .filter((word) => word.length > 3 && !STOP.has(word))
  const stray = spoken.filter((word) => !source.has(word))
  const grounding = spoken.length ? (spoken.length - stray.length) / spoken.length : 0
  if (articleBody && grounding < SPEC.grounding) note(`الإسناد ${(grounding * 100).toFixed(0)}٪ دون ${(SPEC.grounding * 100).toFixed(0)}٪ — كلامٌ كثيرٌ ليس من المقال`)

  return { turns: turns.length, words: total, average: Number(average.toFixed(1)), longest, tags: counted, runs, grounding: Number((grounding * 100).toFixed(0)), stray: stray.slice(0, 30), problems, ok: problems.length === 0 }
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  const parsed = parseScript('الرجل: [تأمل] كلام أول.\nالمرأة: ردّ ثانٍ. [موسيقى]')
  assert(parsed.length === 2, 'يُحلّل مداخلتين')
  assert(parsed[0].speaker === 'male' && parsed[1].speaker === 'female', 'ويميّز المتحدثين')
  assert(parsed[0].tags[0] === 'تأمل' && parsed[0].text === 'كلام أول.', '★ الوسم يُنتزع ولا يبقى في المنطوق')

  /* ★ الشاهد الأكبر: ملف الدكتور المعتمد يجب أن يجتاز حَكَمه */
  const exemplar = resolve(ROOT, 'podcast-audits/exemplar-dialogue.txt')
  if (existsSync(exemplar)) {
    const report = auditDialogue(readFileSync(exemplar, 'utf8'))
    assert(report.problems.filter((p) => !/الإسناد/.test(p)).length === 0, `★ ملف الدكتور المعتمد يجتاز: ${report.problems.join(' | ')}`)
    assert(report.turns === 35 && report.words === 437, `★ ويُقاس كما قِيس: ${report.turns}/${report.words}`)
  }

  /* ★ الخطبة تُرفض: مداخلةٌ طويلة تكسر إيقاع الحوار */
  const speech = auditDialogue(`الرجل: ${'كلمة '.repeat(40)}\nالمرأة: ${CLOSING_LINE}`)
  assert(speech.problems.some((p) => /أطول مداخلة/.test(p)), '★ المداخلة الخطبة تُرفض')

  /* ★ الكلام من عند النفس يُكشف */
  const invented = auditDialogue(
    ['الرجل: تحدث النص عن الميزانية والصواريخ والغواصات النووية في القطب.', `المرأة: ${CLOSING_LINE}`].join('\n'),
    'مقال عن التعليم والمدرسة والطالب والمعلم والمنهج والقيم.',
  )
  assert(invented.problems.some((p) => /الإسناد/.test(p)), '★ ما ليس في المقال يُكشف بالإسناد')

  /* ★ التتابع بلا مبرّر يُرفض */
  const bad = auditDialogue('الرجل: جملة أولى هنا.\nالرجل: جملة ثانية هنا.\nالرجل: جملة ثالثة هنا.\nالمرأة: رد.')
  assert(bad.problems.some((p) => /ثلاثُ مداخلات/.test(p)), '★ ثلاثُ مداخلاتٍ متتالية تُرفض — خطبةٌ لا حوار')

  console.log('✓ اختبارات حَكَم الحوار: 8/8')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const dir = process.argv.find((a) => a.startsWith('--dir='))?.slice(6)
if (!dir) { console.error('الاستعمال: node scripts/dialogue-studio.mjs --dir="مجلد الحوارات"'); process.exit(1) }

const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const files = readdirSync(dir).filter((name) => name.endsWith('.txt')).sort()
console.log(`═══ تدقيق ${files.length} حواراً ═══\n`)

let clean = 0
for (const name of files) {
  const slug = name.replace(/\.txt$/, '')
  const report = auditDialogue(readFileSync(resolve(dir, name), 'utf8'), bodies[slug] || '')
  if (report.ok) { clean += 1; console.log(`✓ ${report.turns} مداخلة · ${report.words} كلمة · إسناد ${report.grounding}٪ · ${slug}`) }
  else {
    console.log(`✘ ${slug}`)
    for (const problem of report.problems) console.log(`   ${problem}`)
    if (report.stray.length) console.log(`   كلماتٌ ليست في المقال: ${report.stray.slice(0, 12).join(' · ')}`)
  }
}
console.log(`\n── سليم: ${clean} · يحتاج مراجعة: ${files.length - clean} ──`)
process.exitCode = clean === files.length ? 0 : 1
