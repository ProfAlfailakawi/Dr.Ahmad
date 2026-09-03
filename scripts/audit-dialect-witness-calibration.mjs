#!/usr/bin/env node
/**
 * معايرة شاهد اللهجة على أذن الدكتور.
 *
 * في باقة ٢٩ أغسطس قَبِلَت أذنه حلقةً واحدة وردّت أربعاً — وقال في
 * الثالثة «الرجل نفس شي من جدة مصري». ومنح الشاهد الخمسَ جميعاً pass
 * بثقة 0.95 وبالعبارات نفسها. شاهدٌ يعطي الحكم ذاته للمقبول وللمردود لا
 * يحمل معلومةً أصلاً، ووجودُه في السلسلة تطمينٌ كاذب أخطر من غيابه.
 *
 * هذا ليس فاحصاً في مسار الإنتاج — لا يوقف توليداً ولا يُنشر عليه شيء.
 * هو مسطرة تُشغَّل عمداً بعد كل تغييرٍ في نموذج الشاهد أو برومته، وتقول
 * بالرقم: هل صار يفرّق؟ ومن دون أن يفرّق، تبقى الأذن هي الحكم وحدها.
 *
 *   node scripts/audit-dialect-witness-calibration.mjs
 *   node scripts/audit-dialect-witness-calibration.mjs --audits=five-canaries
 *
 * الخروج 1 حين يثبت أن الشاهد أعمى (مرّر كل ما ردّته الأذن).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback = '') =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback
const ledgerPath = resolve(ROOT, arg('ledger', 'podcast-audits/episode-ear-verdicts.json'))
const auditsDir = arg('audits') ? resolve(ROOT, arg('audits')) : ''

if (!existsSync(ledgerPath)) {
  console.error(`✗ سجل أحكام الأذن مفقود: ${ledgerPath}`)
  process.exit(2)
}
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
/* السجل صار جولاتٍ بعد ٣٠ أغسطس؛ والشكل القديم (episodes في الجذر) يبقى
   مقروءاً كي لا يسقط أحدٌ على تغيير شكل. */
const rounds = Array.isArray(ledger.rounds) ? ledger.rounds
  : [{ batch: ledger.batch, runId: ledger.runId, episodes: ledger.episodes || [] }]
const episodes = rounds.flatMap((round) =>
  (round.episodes || []).map((episode) => ({ ...episode, _round: round.batch || round.runId })))
if (!episodes.length) {
  console.error('✗ السجل بلا حلقات؛ لا معايرة على فراغ')
  process.exit(2)
}

/* حين يُمرَّر مجلد تدقيقٍ جديد نقرأ حكم الشاهد منه بدل المحفوظ في السجل،
   فتُقاس النسخة الجديدة على الأحكام نفسها. */
const freshWitness = new Map()
if (auditsDir && existsSync(auditsDir)) {
  for (const file of readdirSync(auditsDir).filter((name) => name.endsWith('.audit.json'))) {
    const audit = JSON.parse(readFileSync(resolve(auditsDir, file), 'utf8'))
    if (audit?.slug) freshWitness.set(audit.slug, audit.dialectAudit || null)
  }
}

const rows = []
let approvedTotal = 0; let approvedPassed = 0
let rejectedTotal = 0; let rejectedCaught = 0
const confidences = new Set()
const verdicts = new Set()

let currentRound = ''
for (const episode of episodes) {
  if (episode._round !== currentRound) { currentRound = episode._round; rows.push(`  ── ${currentRound}`) }
  const witness = freshWitness.get(episode.slug) || {
    status: episode.witnessVerdict,
    assessment: { overall: { confidence: episode.witnessConfidence } },
    model: episode.witnessModel,
  }
  const status = witness?.status || 'مفقود'
  const confidence = witness?.assessment?.overall?.confidence ?? null
  verdicts.add(status)
  if (confidence !== null) confidences.add(confidence)

  let mark = '·'
  if (episode.earVerdict === 'approved') {
    approvedTotal += 1
    if (status === 'pass') { approvedPassed += 1; mark = '✓ وافق الأذن' }
    else mark = '✗ ردّ ما قبلته الأذن'
  } else if (episode.earVerdict === 'rejected') {
    rejectedTotal += 1
    if (status !== 'pass') { rejectedCaught += 1; mark = '✓ أمسك ما ردّته الأذن' }
    else mark = '✗ مرّر ما ردّته الأذن'
  }
  rows.push(`  ${episode.slot}. ${episode.earVerdict === 'approved' ? 'الأذن: قبِلت ' : 'الأذن: ردّت  '} · الشاهد: ${String(status).padEnd(5)} ثقة ${confidence ?? '—'} · ${mark}`)
  if (episode.earReasons?.length) rows.push(`       سبب الأذن: ${episode.earReasons.join(' · ')}`)
}

console.log(`معايرة شاهد اللهجة — ${rounds.length} جولة · ${episodes.length} حكماً`)
console.log(rows.join('\n'))

const catchRate = rejectedTotal ? rejectedCaught / rejectedTotal : 0
const uniformVerdict = verdicts.size === 1
const uniformConfidence = confidences.size <= 1

console.log('')
console.log(`الحكم على الشاهد: أمسك ${rejectedCaught}/${rejectedTotal} مما ردّته الأذن · ووافقها في ${approvedPassed}/${approvedTotal} مما قبِلته`)
if (uniformVerdict) console.log(`تنبيه: الشاهد أعطى الحكم نفسه (${[...verdicts][0]}) لكل الحلقات — لا تباين، فلا معلومة.`)
if (uniformConfidence && confidences.size) console.log(`تنبيه: الثقة ثابتة عند ${[...confidences][0]} في كل الحلقات — رقمٌ لا يقيس شيئاً.`)

if (rejectedTotal && catchRate === 0) {
  console.error('')
  console.error('✗ الشاهد أعمى: مرّر كل ما ردّته أذن الدكتور.')
  console.error('  ما دام كذلك فحكمه «pass» لا يصلح بوابةً — الأذن هي الحكم، وأي «مطلوب» على هذا الشاهد تطمينٌ كاذب.')
  process.exit(1)
}

console.log(`✓ الشاهد يفرّق: نسبة الإمساك ${(catchRate * 100).toFixed(0)}٪`)
