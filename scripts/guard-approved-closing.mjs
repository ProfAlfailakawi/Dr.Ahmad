#!/usr/bin/env node
/**
 * حارس الإحالة المنطوقة.
 *
 * الاسم الكامل جزء من السجل المكتوب، لا من الصوت في الإنتاج العادي. آخر دور
 * يصل Gemini هو إحالة كويتية قصيرة إلى «موقع الدكتور أحمد»، مختارة حتمياً من
 * ثماني صيغ. الاستثناء الوحيد هو الحلقة الذهبية: نحفظ طلب TTS التاريخي نفسه
 * حرفياً كي لا تتغير بصمته، ثم يمكن قص اسم العائلة لاحقاً في المونتاج.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KUWAITI_CLOSING_VARIANTS,
  KUWAITI_GOLD_REQUEST_CLOSING,
  KUWAITI_GOLD_REQUEST_SLUG,
  applySpokenClosing,
  closingForSlug,
  isApprovedSpokenClosing,
} from './lib/kuwaiti-closing-variants.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const engine = readFileSync(resolve(ROOT, 'scripts/podcast-kuwaiti-gemini.mjs'), 'utf8')
const buildStart = engine.indexOf('function buildTimedMaster')
const buildEnd = engine.indexOf('\nfunction ', buildStart + 1)
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'تعذر العثور على مونتاج الحلقة لفحص الختام')
const buildSource = engine.slice(buildStart, buildEnd)
assert.doesNotMatch(buildSource, /kuwaiti-closing-approved\.mp3|CLOSING_CLIP|useFixedClosing/,
  'عاد لصق ختام ثابت؛ الإحالة يجب أن تتولد داخل نفس الـTake الحالي')
assert.match(buildSource, /const file = files\[i\]/,
  'المونتاج لا يثبت أن كل دور، ومنه الختام، مأخوذ من الـTake الحالي')

const nativeSource = readFileSync(resolve(ROOT, 'scripts/lib/kuwaiti-native-spoken.mjs'), 'utf8')
assert.match(nativeSource, /applySpokenClosing\(output, \{ slug \}\)/,
  'طبقة المنطوق لا تطبق الإحالة المتنوعة قبل Gemini')

assert.equal(KUWAITI_CLOSING_VARIANTS.length, 8, 'المطلوب ثماني صيغ ختامية')
assert.equal(new Set(KUWAITI_CLOSING_VARIANTS).size, 8, 'في الختامات صيغة مكررة')
for (const closing of KUWAITI_CLOSING_VARIANTS) {
  assert.match(closing, /المقال الأصلي/u, `الخاتمة لا تحيل إلى المقال الأصلي: ${closing}`)
  assert.match(closing, /موقع الدكتور أحمد/u, `الخاتمة لا تذكر موقع الدكتور أحمد: ${closing}`)
  assert.doesNotMatch(closing, /حسين|الفيل/u, `اسم العائلة تسرب إلى الصوت: ${closing}`)
  assert.ok(isApprovedSpokenClosing(closing), `الخاتمة غير معتمدة: ${closing}`)
}
assert.match(KUWAITI_GOLD_REQUEST_CLOSING, /أحمد حسين الفيلچاوي/u,
  'اختفى الختام التاريخي من قفل الطلب الذهبي')
assert.ok(!isApprovedSpokenClosing(KUWAITI_GOLD_REQUEST_CLOSING),
  'لا يجوز تعميم ختام الحلقة الذهبية على بقية الإنتاج')
const goldClosingProbe = applySpokenClosing([
  { speaker: 'male', text: 'بداية اختبار.' },
  { speaker: 'female', text: 'وإذا تبي الفكرة كاملة، تلقى المقال الأصلي في موقع الدكتور أحمد.' },
], { slug: KUWAITI_GOLD_REQUEST_SLUG })
assert.equal(goldClosingProbe.turns.at(-1)?.text, KUWAITI_GOLD_REQUEST_CLOSING,
  'الحلقة المرجعية لم تستعد الختام الذي يثبت بصمة طلبها الذهبي')

/* المصدر الأرشيفي لا يتغير: يبقى الاسم الكامل مرئياً في النص والبيانات.
   التحويل يحصل فقط في طبقة المنطوق، فلا نخسر النسبة أو حق المؤلف المكتوب. */
const libPath = resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json')
if (existsSync(libPath)) {
  const eps = JSON.parse(readFileSync(libPath, 'utf8')).episodes
  const counts = new Array(KUWAITI_CLOSING_VARIANTS.length).fill(0)
  let archivedFullName = 0
  const archiveWithoutFullName = []
  for (const [slug, episode] of Object.entries(eps)) {
    const turns = Array.isArray(episode) ? episode : Object.values(episode)
    const last = String(turns[turns.length - 1]?.text || '')
    if (/أحمد حسين الفيل/u.test(last)) archivedFullName += 1
    else archiveWithoutFullName.push(slug)
    const spokenClosing = closingForSlug(slug)
    assert.ok(isApprovedSpokenClosing(spokenClosing), `${slug}: إحالة الصوت غير معتمدة`)
    assert.doesNotMatch(spokenClosing, /حسين|الفيل/u, `${slug}: اسم العائلة دخل الصوت`)
    counts[KUWAITI_CLOSING_VARIANTS.indexOf(spokenClosing)] += 1
    const appliedClosing = applySpokenClosing(turns, { slug }).turns.at(-1)?.text
    if (slug === KUWAITI_GOLD_REQUEST_SLUG) {
      assert.equal(appliedClosing, KUWAITI_GOLD_REQUEST_CLOSING,
        `${slug}: تغيرت بايتات الختام المرجعي الذهبي`)
    } else {
      assert.equal(appliedClosing, spokenClosing,
        `${slug}: الختام الفعلي لا يطابق التوزيع المعتمد`)
      assert.doesNotMatch(appliedClosing, /حسين|الفيل/u, `${slug}: اسم العائلة دخل إنتاجاً جديداً`)
    }
  }
  assert.ok(counts.every((count) => count > 0), `التوزيع لم يستخدم كل الختامات: ${counts.join('، ')}`)
  assert.ok(Math.max(...counts) <= 30, `صيغة ختامية تكررت أكثر من اللازم: ${counts.join('، ')}`)
  assert.deepEqual(archiveWithoutFullName, ['how-do-we-assess-without-breaking-the-human-beingarabic'],
    'تغيرت قائمة المصادر التاريخية الناقصة للإحالة؛ راجع المصدر قبل السماح')
  console.log(`✓ الإحالة المنطوقة: ${archivedFullName} اسماً كاملاً محفوظاً بالأرشيف · طلب ذهبي واحد مقفول حرفياً · بقية الإنتاج 8 صيغ بلا اسم عائلة · التوزيع ${counts.join('، ')}`)
} else {
  console.log('✓ الإحالة المنطوقة: 8 صيغ معتمدة إلى موقع الدكتور أحمد بلا اسم عائلة')
}
