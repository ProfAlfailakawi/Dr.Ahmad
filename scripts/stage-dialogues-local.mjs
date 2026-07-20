#!/usr/bin/env node
/**
 * مُجهِّز الحوارات محلياً — يضع نصوص الدكتور في مكانٍ يقرؤه المحرك مباشرة.
 *
 * الحال قبله: النصوص الـ١٤٣ مرفوعةٌ في Firestore (مسوّدات) ومحفوظةٌ في
 * `podcast-audits/dialogues/*.txt`، لكنّ محرّك الصوت لا يقرأ أيّاً منهما: هو
 * يقرأ `manual-dialogues/<slug>.json` وحده. وجالبُ الطابور
 * (`fetch-queued-dialogues.mjs`) لا يكتب هذا الملف إلا لمن ضغط الدكتور له زرّ
 * «أرسله للتوليد» — أي مئةً وثلاثاً وأربعين ضغطة، وهو ما رفضه صراحةً.
 *
 * فهذا يكتبها كلَّها دفعةً واحدة، بالمحوِّل **نفسه** الذي رفعها إلى Firestore
 * (`scriptToTurns` من `upload-dialogues.mjs`) — فالبصمة المحلية تطابق البصمة
 * المقفولة في السحابة، ولا يعترض قفلُ المصدر عند التوليد.
 *
 * ولا يُنفق فلساً: الكتابة على القرص ليست توليداً. الإطلاق يبقى قراراً منفصلاً.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scriptToTurns } from './lib/dialogue-script.mjs'
import { dialogueHashes } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'podcast-audits/dialogues')
const OUT = resolve(ROOT, 'manual-dialogues')
const SELF_TEST = process.argv.includes('--self-test')
const APPLY = process.argv.includes('--apply')

/** هل نكتب هذا الملف؟ الموجود المطابق يُترك، والمختلف يُحدَّث، والجديد يُكتب */
export function decideWrite({ existing, nextJson }) {
  if (existing === null) return { action: 'create', why: 'جديد' }
  if (existing === nextJson) return { action: 'skip', why: 'مطابق' }
  return { action: 'update', why: 'اختلف عن المكتوب' }
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }
  let pass = 0
  const t = (m, c) => { assert(c, m); pass++ }

  t('الجديد يُكتب', decideWrite({ existing: null, nextJson: 'a' }).action === 'create')
  t('★ المطابق لا يُلمس — لا نُحدث ضجيجاً في git بلا سبب', decideWrite({ existing: 'a', nextJson: 'a' }).action === 'skip')
  t('والمختلف يُحدَّث', decideWrite({ existing: 'a', nextJson: 'b' }).action === 'update')

  /* ★ المحوِّل هو نفسه الذي رفع إلى Firestore — وإلا اختلفت البصمتان وسقط القفل */
  const turns = scriptToTurns('الرجل: [تأمل] كلامٌ أول.\nالمرأة: [تداخل 90] ردٌّ قصير.')
  t('★ المحوِّل يقرأ نصّ الدكتور', turns.length === 2)
  t('والوسمُ يصير نوعَ أداء', turns[0].deliveryType === 'reflection')
  t('والتداخل يصير مللي ثانية', turns[1].overlapMs === 90)
  t('والمتحدثان يُترجمان', turns[0].speaker === 'male' && turns[1].speaker === 'female')

  const hashes = dialogueHashes(turns)
  t('★ البصمة تُحسب بدالّة الخادم نفسها', typeof hashes.contentSha256 === 'string' && hashes.contentSha256.length === 64)

  console.log(`✓ اختبارات مُجهِّز الحوارات: ${pass}/${pass}`)
  process.exit(0)
}

/* ═══ التشغيل ═══ */

if (!existsSync(SRC)) {
  console.error(`✘ لا مجلَّد نصوصٍ في ${SRC}`)
  process.exit(1)
}
if (APPLY && !existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const files = readdirSync(SRC).filter((f) => f.endsWith('.txt')).sort()
console.log(`═══ تجهيز ${files.length} حواراً للمحرك ═══\n`)

const counts = { create: 0, update: 0, skip: 0 }
const failures = []

for (const file of files) {
  const slug = basename(file, '.txt')
  const script = readFileSync(resolve(SRC, file), 'utf8')
  let turns
  try {
    turns = scriptToTurns(script)
  } catch (error) {
    failures.push(`${slug}: ${error.message}`)
    continue
  }
  if (!turns.length) {
    failures.push(`${slug}: لا مداخلات — النصّ لا يبدأ سطورُه بـ«الرجل:» أو «المرأة:»`)
    continue
  }
  const target = resolve(OUT, `${slug}.json`)
  const nextJson = `${JSON.stringify(turns, null, 2)}\n`
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : null
  const { action } = decideWrite({ existing, nextJson })
  counts[action] += 1
  if (action !== 'skip' && APPLY) writeFileSync(target, nextJson)
}

console.log(`── جديد: ${counts.create} · محدَّث: ${counts.update} · مطابق: ${counts.skip} ──`)

if (failures.length) {
  console.log(`\n✘ تعذّر ${failures.length}:`)
  for (const line of failures.slice(0, 10)) console.log(`  · ${line}`)
  process.exit(1)
}

if (!APPLY) {
  console.log('\nⓘ تشغيلةٌ جافّة. أضف --apply للكتابة.')
  process.exit(0)
}

console.log(`\n✔ ${files.length} حواراً جاهزةٌ في manual-dialogues/ — بلا إنفاقٍ ولا توليد.`)
console.log('  التوليد يبقى قراراً منفصلاً: لن يبدأ حتى تُفعَّل التشغيلة.')
