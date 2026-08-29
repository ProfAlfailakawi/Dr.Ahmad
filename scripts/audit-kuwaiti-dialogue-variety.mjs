#!/usr/bin/env node
/** بوابة تمنع أن تتحول المكتبة كلها إلى حلقة واحدة بأسماء مختلفة. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyConversationVariety, CONVERSATION_FAMILIES } from './lib/kuwaiti-dialogue-variety.mjs'
import { checkSpec, condenseV3Adaptive } from './condense-diwania-v3.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shortLibrary = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json'), 'utf8'))
const fullLibrary = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
const episodes = Object.entries(shortLibrary.episodes || {})
assert.ok(episodes.length >= 144, `المكتبة الحالية ناقصة: ${episodes.length}`)

const familyCounts = Object.fromEntries(CONVERSATION_FAMILIES.map((family) => [family.id, 0]))
const firstSpeakerCounts = { male: 0, female: 0 }
const leadCounts = { male: 0, female: 0, balanced: 0 }
const exactOpenings = new Map()
const topology = new Set()
let castSwapped = 0
let dynamicStructuralFailures = 0
let dynamicSoftWarnings = 0
let baselineSoftWarnings = 0

for (const [slug, episode] of episodes) {
  const original = Object.values(episode)
  const prepared = applyConversationVariety(original, { slug })
  const preparedTwice = applyConversationVariety(prepared.turns, { slug })

  /* أهم قفل: التنويع لا يعيد كتابة الحلقات الممتازة ولا يعيد ترتيبها. */
  assert.deepEqual(prepared.turns.map((turn) => turn.text), original.map((turn) => turn.text),
    `${slug}: التنويع مسّ كلمات الحلقة`)
  assert.deepEqual(prepared.turns.map((turn) => turn.deliveryType), original.map((turn) => turn.deliveryType),
    `${slug}: التنويع غيّر أدوار الجمل`)
  assert.deepEqual(preparedTwice.turns.map((turn) => turn.speaker), prepared.turns.map((turn) => turn.speaker),
    `${slug}: طبقة التنويع غير idempotent`)

  familyCounts[prepared.plan.family] += 1
  firstSpeakerCounts[prepared.plan.firstSpeaker] += 1
  leadCounts[prepared.plan.leadSpeaker] += 1
  if (prepared.plan.castSwapped) castSwapped += 1
  const opening = String(prepared.turns[0]?.text || '').replace(/\s+/g, ' ').trim()
  exactOpenings.set(opening, (exactOpenings.get(opening) || 0) + 1)
  topology.add(prepared.turns.slice(0, 7).map((turn) => `${turn.speaker[0]}:${turn.deliveryType || 'plain'}`).join('|'))

  /* المقال الجديد الذي ما دخل v3 بعد لازم يحصل على انتقاء متنوع يظل داخل
     مواصفة الديوانية. نختبر الـ144 كعينة ارتداد كاملة لكل عائلات الخطة. */
  const full = Object.values(fullLibrary.episodes?.[slug] || {})
  assert.ok(full.length, `${slug}: المتن الكامل مفقود`)
  const condensed = condenseV3Adaptive(full, { slug })
  const spec = checkSpec(condensed.turns)
  const baseline = checkSpec(condenseV3Adaptive(full, { slug: '' }).turns)
  const structural = spec.fails.filter((failure) => /^(قصير|طويلة|مداخلات|مدة|الجسران|أخذ)/u.test(failure))
  if (structural.length) dynamicStructuralFailures += 1
  if (spec.fails.length) dynamicSoftWarnings += 1
  if (baseline.fails.length) baselineSoftWarnings += 1
}

const total = episodes.length
/* لا نصنع توازناً شكلياً بقلب الكاست بعد الكتابة؛ هذا هو العطب الذي جعل
   نورة تقول لفهد «تدرين». الحلقة الجديدة تستطيع أن تبدأ بنورة إذا كُتبت
   لها من الأصل، أما المكتبة المعتمدة فلا نغيّر جنس كلماتها آلياً. */
assert.equal(castSwapped, 0, 'ممنوع قلب الكاست بعد اعتماد النص')
for (const [family, count] of Object.entries(familyCounts)) {
  assert.ok(count >= Math.max(10, Math.floor(total * 0.07)), `${family}: ${count} حلقات فقط`)
}
assert.equal([...exactOpenings.values()].filter((count) => count > 1).length, 0,
  'بدايات متطابقة حرفياً رجعت إلى المكتبة')
assert.ok(topology.size >= Math.floor(total * 0.35), `تنويع الأخذ والرد ضعيف: ${topology.size} بصمة فقط`)
assert.equal(dynamicStructuralFailures, 0, 'خطة التنويع للحلقات الجديدة كسرت الإيقاع أو المدة أو الأخذ والرد')
assert.ok(dynamicSoftWarnings <= baselineSoftWarnings,
  `التنويع زاد تنبيهات المتن: ${dynamicSoftWarnings} بدل ${baselineSoftWarnings}`)

console.log(`✓ تنويع كل المكتبة: ${total} حلقة · البداية الأصلية نورة ${firstSpeakerCounts.female}/فهد ${firstSpeakerCounts.male} · صفر قلب كاست بعد الكتابة`)
console.log(`✓ ست عائلات محادثة: ${Object.entries(familyCounts).map(([family, count]) => `${family}=${count}`).join(' · ')}`)
console.log(`✓ ${topology.size} بصمة أخذ ورد مختلفة · صفر تغيير كلمة · صفر إعادة ترتيب · المقالات الجديدة: صفر عطب بنيوي`)
console.log(`ℹ️ ${dynamicSoftWarnings} متناً تاريخياً ما فيه من الأصل سؤال/اعتراض/تركيب كافي؛ ما اخترعنا له كلاماً، والتنويع ما زادها عن خط الأساس`)
