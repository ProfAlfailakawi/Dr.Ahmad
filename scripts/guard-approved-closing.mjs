#!/usr/bin/env node
/**
 * حارس الإحالة المنطوقة.
 *
 * الاسم الكامل جزء من السجل المكتوب، لا من الصوت. آخر دور يصل Gemini هو
 * إحالة كويتية قصيرة إلى «موقع الدكتور أحمد»، مختارة حتمياً من ثماني صيغ.
 * جذي ما نعيد فحص اسم العائلة في كل Take، وما نختم ١٤٤ حلقة بنفس الإعلان.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KUWAITI_CLOSING_VARIANTS,
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
  }
  assert.ok(counts.every((count) => count > 0), `التوزيع لم يستخدم كل الختامات: ${counts.join('، ')}`)
  assert.ok(Math.max(...counts) <= 30, `صيغة ختامية تكررت أكثر من اللازم: ${counts.join('، ')}`)
  assert.deepEqual(archiveWithoutFullName, ['how-do-we-assess-without-breaking-the-human-beingarabic'],
    'تغيرت قائمة المصادر التاريخية الناقصة للإحالة؛ راجع المصدر قبل السماح')
  console.log(`✓ الإحالة المنطوقة: ${archivedFullName} اسماً كاملاً محفوظاً بالأرشيف · مصدر تاريخي واحد تكمله طبقة الصوت · 8 صيغ بلا اسم عائلة · التوزيع ${counts.join('، ')}`)
} else {
  console.log('✓ الإحالة المنطوقة: 8 صيغ معتمدة إلى موقع الدكتور أحمد بلا اسم عائلة')
}
