#!/usr/bin/env node
/**
 * التصفير الشامل للصوت — بأمر الدكتور، ولمرّةٍ واحدة في العادة.
 *
 * الغرض: مسح كل ما وُلِّد من قراءاتٍ وحوارات ليُعاد بناؤه من نصوصٍ مُشكَّلة،
 * فالتشكيل يرفع جودة النطق رفعاً لا يُدرَك بالترقيع.
 *
 * وهذا سكربتُ هدمٍ لا بناء، فبُني على ثلاثة أقفال:
 *
 *   ١) الجفاف افتراضاً: لا يُتلف شيئاً حتى يُمرَّر --execute صراحةً.
 *   ٢) قائمة استبقاء: --keep=slug,slug تنجو مما دونها، وتُطبع قبل كل شيء.
 *   ٣) كلمة السرّ: --confirm=امسح-كل-الصوت — فلا تُطلقه ضغطةُ زرٍّ ساهية،
 *      ولا سطرٌ في تشغيلةٍ نُسخ من غيره.
 *
 * ولا يمسّ R2 بنفسه: يطبع قائمة الملفات ليحذفها العارف بمفاتيحها (التشغيلة).
 * فمن ملك المفاتيح ملك الحذف، وهذا السكربت لا يملكها ولا ينبغي أن يملكها.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

const CONFIRM_PHRASE = 'امسح-كل-الصوت'

const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || ''

/**
 * يقرّر مصير كل مدخل. نقيًّا بلا قراءة قرصٍ ولا شبكة، ليُختبر بالكامل.
 * المفاتيح في audio-meta أسماءُ ملفات (slug.mp3 · slug.noura.mp3 · slug.dialogue.mp3)
 * فنستخرج الـslug منها لنُقابله بقائمة الاستبقاء.
 */
export function planReset(meta = {}, keep = []) {
  const kept = new Set(keep.filter(Boolean))
  const remove = []
  const survive = []
  for (const name of Object.keys(meta)) {
    const slug = name
      .replace(/\.dialogue\.(mp3|json)$/, '')
      .replace(/\.noura\.mp3$/, '')
      .replace(/\.dialogue-en\.mp3$/, '')
      .replace(/\.mp3$/, '')
    ;(kept.has(slug) ? survive : remove).push(name)
  }
  return { remove: remove.sort(), survive: survive.sort(), keptSlugs: [...kept].sort() }
}

/** المانيفست بعد التصفير: لا يبقى إلا أصواتُ المستبقَين */
export function survivingManifest(manifest = {}, keep = []) {
  const kept = new Set(keep.filter(Boolean))
  return Object.fromEntries(Object.entries(manifest).filter(([slug]) => kept.has(slug)))
}

if (SELF_TEST) {
  const assert = (condition, message) => { if (!condition) throw new Error(`✘ ${message}`) }
  const meta = {
    'alpha.mp3': {}, 'alpha.noura.mp3': {}, 'alpha.dialogue.mp3': {}, 'alpha.dialogue.json': {},
    'beta.mp3': {}, 'beta.noura.mp3': {},
    'gamma.mp3': {},
  }
  const plan = planReset(meta, ['alpha'])
  assert(plan.survive.length === 4, 'كل أصوات المستبقى تنجو (قراءتان + حوار + نصّه)')
  assert(plan.survive.includes('alpha.dialogue.json'), 'نصّ الحوار ينجو مع صوته — وإلا سقطت بوابة التطابق')
  assert(plan.remove.length === 3, 'ما عداه يُمحى')
  assert(!plan.remove.some((name) => name.startsWith('alpha')), '★ لا يتسرّب ملفٌ للمستبقى إلى قائمة المحو')

  const bare = planReset(meta, [])
  assert(bare.remove.length === 7 && bare.survive.length === 0, 'بلا استبقاء: يُمحى كل شيء')

  const manifest = { alpha: { fahed: true, dialogue: true }, beta: { fahed: true }, gamma: { noura: true } }
  const after = survivingManifest(manifest, ['alpha'])
  assert(Object.keys(after).length === 1 && after.alpha.dialogue === true, 'المانيفست يحتفظ بالمستبقى كاملاً')
  assert(!('beta' in after) && !('gamma' in after), 'ويُسقط ما عداه')

  /* الاسم المتشابه بادئةً لا يُخدع: «alpha-two» ليس «alpha» */
  const tricky = planReset({ 'alpha.mp3': {}, 'alpha-two.mp3': {} }, ['alpha'])
  assert(tricky.remove.includes('alpha-two.mp3'), '★ التشابه في البادئة لا يمنح نجاةً')
  assert(tricky.survive.includes('alpha.mp3'), 'والمستبقى ينجو')

  console.log('✓ اختبارات التصفير الشامل: 8/8')
  process.exit(0)
}

const keep = arg('keep').split(',').map((item) => item.trim()).filter(Boolean)
const execute = process.argv.includes('--execute')
const confirm = arg('confirm')

const META_PATH = resolve(ROOT, 'src/data/audio-meta.json')
const MANIFEST = resolve(ROOT, 'src/data/audio.json')
const meta = existsSync(META_PATH) ? JSON.parse(readFileSync(META_PATH, 'utf8')) : {}
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}

const plan = planReset(meta, keep)
const bytes = plan.remove.reduce((sum, name) => sum + Number(meta[name]?.bytes || 0), 0)
const seconds = plan.remove.reduce((sum, name) => sum + Number(meta[name]?.durationSeconds || 0), 0)

console.log('═══ خطة التصفير الشامل ═══')
console.log(`  يُمحى : ${plan.remove.length} ملفاً · ${(bytes / 1048576).toFixed(1)}MB · ${Math.round(seconds / 60)} دقيقة`)
console.log(`  يبقى  : ${plan.survive.length} ملفاً`)
console.log(`  المستبقى: ${plan.keptSlugs.length ? plan.keptSlugs.join('، ') : '— لا شيء'}`)
for (const name of plan.survive) console.log(`     ✓ ${name}`)

if (!execute) {
  console.log('\nⓘ تشغيلةٌ جافّة: لم يُمسّ شيء. أضف --execute لتنفيذها.')
  process.exit(0)
}
if (confirm !== CONFIRM_PHRASE) {
  console.error(`\n✘ التنفيذ يحتاج --confirm=${CONFIRM_PHRASE}`)
  process.exit(1)
}

/* قائمة الحذف من R2 تُكتب ليقرأها من يملك المفاتيح */
writeFileSync(resolve(ROOT, 'audio-reset-targets.txt'), plan.remove.join('\n') + '\n')

const nextMeta = Object.fromEntries(plan.survive.map((name) => [name, meta[name]]))
writeFileSync(META_PATH, JSON.stringify(nextMeta, null, 2) + '\n')
writeFileSync(MANIFEST, JSON.stringify(survivingManifest(manifest, keep), null, 2) + '\n')

console.log(`\n✓ صُفِّرت المانيفستات. قائمة ملفات R2 في audio-reset-targets.txt (${plan.remove.length} ملفاً).`)
