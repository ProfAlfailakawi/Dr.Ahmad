#!/usr/bin/env node
/**
 * حارس مخاطبة الجنس — يقف على النص الذي سيُقال فعلاً.
 *
 * الدرس مأخوذ من ٢٢ أغسطس: كل فاحصٍ يقرأ ملفاً غير المنطوق يخرج أخضر
 * والأذن تسمع خطأً. لذلك موضع هذا الحارس بعد طبقة الصقل مباشرةً، على
 * مجلد المصادر المجهّزة، بجانب guard-spoken-episode.
 *
 * يُسقط القاطع وحده: صيغةُ مؤنثٍ في فم نورة — لا يأخذها خطابٌ عام ولا
 * غائب، فهي مخاطبةُ فهد بجنسٍ ليس جنسه. وصيغُ المذكر في فم فهد تُعرض
 * للأذن ولا توقف شيئاً، لأن الخطاب العام في الكويتي مذكّرٌ أصلاً.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENDER_ADDRESS_VERSION, scanEpisodeGenderAddress } from './lib/kuwaiti-gender-address.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* الفاحص الذاتي يثبت أن الحارس يمسك العطب المسموع فعلاً — لا أن الملف
   موجود. المثال هو سطر الحلقة الخامسة نفسه بحرفه. */
if (process.argv.includes('--self-test')) {
  const { castSwapIntroducesGenderFault } = await import('./lib/kuwaiti-gender-address.mjs')
  const original = [
    { speaker: 'male', text: 'تدرين شنو اللي يخوفني في بعض الاختبارات؟' },
    { speaker: 'female', text: 'صعوبة الأسئلة؟' },
    { speaker: 'male', text: 'تخيلي طالب راجع البيت بهالدرجة الواطية.' },
  ]
  assert.equal(scanEpisodeGenderAddress(original).violations.length, 0,
    'المكتبة مكتوبة صحيحة: فهد يقول «تدرين» و«تخيلي» لنورة')
  const swapped = original.map((turn) => ({ ...turn, speaker: turn.speaker === 'male' ? 'female' : 'male' }))
  const caught = scanEpisodeGenderAddress(swapped).violations
  assert.equal(caught.length, 2, 'قلبُ الكاست يجعلهما مخاطبةَ رجلٍ بصيغة المؤنث، والحارس يمسك الاثنتين')
  assert.deepEqual(caught.map((item) => item.word), ['تدرين', 'تخيلي'])
  assert.equal(castSwapIntroducesGenderFault(original), true, 'هذه الحلقة لا تحتمل قلب الكاست')

  /* والخطاب العام مذكّرٌ في الكويتي، فلا يُحسب خطأً ولا يوقف حلقة. */
  const generic = [
    { speaker: 'male', text: 'هو سؤال يطق عليك فجأة عن الأمان، وعن باجر.' },
    { speaker: 'male', text: 'الفرق إن الحاسبة تحسب لك، وهذي تفكر عنك.' },
    { speaker: 'female', text: 'المدرسة تبي قياس، والمعلم يبي يعرف مستوى طلابه.' },
    { speaker: 'female', text: 'والموهبة ما تنمو في جدول محشو تلقين.' },
  ]
  assert.equal(scanEpisodeGenderAddress(generic).violations.length, 0,
    'الخطاب العام والغائبة لا يُسقطان حلقة — لا يقف فاحصٌ على ظنٍّ')
  assert.equal(castSwapIntroducesGenderFault(generic), true,
    'حتى النص الظاهر محايداً لا يُقلب آلياً؛ ماكو محلل سياق يضمن كل كلمة مستقبلية')

  console.log('✓ فاحص حارس مخاطبة الجنس: يمسك العطب المسموع ولا يوقف الخطاب العام')
  process.exit(0)
}
const arg = (name, fallback = '') =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback
const dir = resolve(ROOT, arg('dir', 'manual-dialogues-kuwaiti'))
const showSuspects = process.argv.includes('--suspects')

assert.ok(existsSync(dir), `مجلد المنطوق مفقود: ${dir}`)
const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort()
assert.ok(files.length, 'لا مصادر ليفحصها حارس مخاطبة الجنس')

let violations = 0
let suspects = 0
const failures = []

for (const file of files) {
  const slug = file.replace(/\.json$/, '')
  const source = JSON.parse(readFileSync(resolve(dir, file), 'utf8'))
  const turns = Array.isArray(source) ? source : Object.values(source.turns || source)
  const found = scanEpisodeGenderAddress(turns)
  suspects += found.suspects.length
  if (found.violations.length) {
    violations += found.violations.length
    failures.push({ slug, found: found.violations })
  }
  if (showSuspects && found.suspects.length) {
    for (const item of found.suspects) {
      console.log(`  ℹ ${slug} [${item.index}] ${item.speaker === 'male' ? 'فهد' : 'نورة'} «${item.word}» :: ${item.text}`)
    }
  }
}

if (failures.length) {
  console.error(`✗ مخاطبةٌ بجنسٍ خاطئ في ${failures.length} حلقة (${violations} موضعاً):`)
  for (const failure of failures) {
    for (const item of failure.found) {
      console.error(`  ${failure.slug} [${item.index}] نورة تخاطب فهد بصيغة المؤنث «${item.word}» :: ${item.text}`)
    }
  }
  console.error('العلاج: امنع قلب الكاست لهذه الحلقة، أو صحّح الصيغة في المتن — لا تُسلّمها للمحرّك.')
  process.exit(1)
}

console.log(`✓ مخاطبة الجنس سليمة في ${files.length} حلقة · ${suspects} صيغةَ مذكرٍ عامة (لا تُسقط) · ${GENDER_ADDRESS_VERSION}`)
