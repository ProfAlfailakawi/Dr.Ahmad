#!/usr/bin/env node
/**
 * الزرّ الواحد — يقود قافلة توليد الصوت حتى تكتمل، بلا يدٍ تتابعها.
 *
 * التشغيلة الواحدة في GitHub تُولّد دفعةً محدودة ثم تتوقف (وهو صحيح: مهلة
 * الوظيفة ست ساعات، والدفعة الكبيرة تُقطع في منتصفها فتضيع). فكان على الدكتور
 * أن يضغط «شغّل» مرّةً كل ساعة، مئةَ مرّة، ليُنجز مئةً وثلاثاً وأربعين مقالة
 * بصوتين — وهذا ما لا يفعله إنسان.
 *
 * فهذا يفعله عنه: يقيس ما بقي، ثم يُطلق دفعةً، وينتظرها، ويقيس ما بقي، ويُطلق
 * التالية… حتى لا يبقى شيء. ويتوقف بأمانٍ عند أول عطبٍ حقيقيّ بدل أن يُحرق
 * الرصيد في تشغيلاتٍ فاشلة متتالية.
 *
 *   node scripts/generate-all-audio.mjs            ← يعرض ما بقي ولا يُطلق
 *   node scripts/generate-all-audio.mjs --run      ← يقود القافلة حتى تنتهي
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

export const REPO = 'ProfAlfailakawi/Dr.Ahmad'
export const WORKFLOW = 'auto-audio-r2.yml'

/**
 * ما الذي بقي؟ المقال يحتاج صوتين (فهد ونورة)؛ فما لم يكتمل صوتاه فهو ناقص.
 * ولا نعتمد على تخمين: نقرأ سجلّ الصوت نفسه الذي يقرؤه المحرك.
 */
export function remainingWork({ published, meta }) {
  const missing = []
  for (const slug of published) {
    const fahed = Boolean(meta[`${slug}.mp3`])
    const noura = Boolean(meta[`${slug}.noura.mp3`])
    if (!fahed || !noura) missing.push({ slug, fahed, noura })
  }
  const files = missing.reduce((sum, item) => sum + (item.fahed ? 0 : 1) + (item.noura ? 0 : 1), 0)
  return { articles: missing.length, files, missing }
}

/** كم دفعةً نحتاج؟ يُعرض للدكتور قبل أن يُنفق شيئاً */
export const batchesNeeded = (files, perBatch) => Math.ceil(files / Math.max(1, perBatch))

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  const work = remainingWork({
    published: ['a', 'b', 'c'],
    meta: { 'a.mp3': {}, 'a.noura.mp3': {}, 'b.mp3': {} },
  })
  assert(work.articles === 2, '★ المقال المكتمل صوتاه لا يُعاد توليده')
  assert(work.files === 3, '★ ويُحصى الناقص ملفاً ملفاً لا مقالاً: نورةُ «ب» وصوتا «ج»')
  assert(work.missing[0].slug === 'b' && work.missing[0].fahed === true, 'ويُبيَّن أيّ صوتٍ ينقص')

  const done = remainingWork({ published: ['a'], meta: { 'a.mp3': {}, 'a.noura.mp3': {} } })
  assert(done.files === 0, 'وحين يكتمل كل شيء لا يبقى عمل')

  assert(batchesNeeded(0, 40) === 0, 'ولا دفعة لعملٍ منتهٍ')
  assert(batchesNeeded(41, 40) === 2, '★ والكسر يُجبر لدفعةٍ كاملة — وإلا بقي ملفٌ يتيم')

  console.log('✓ اختبارات قائد القافلة: 6/6')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const run = process.argv.includes('--run')
const perBatch = Number(process.argv.find((a) => a.startsWith('--batch='))?.slice(8) || 40)

const gh = (args) => {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = spawnSync('gh', args, { encoding: 'utf8' })
    const output = `${result.stdout || ''}${result.stderr || ''}`
    /* GitHub يردّ 503 عارضاً تحت الضغط — نُعيد ولا نُعلن فشلاً */
    if (!/503|No server is currently available/.test(output)) return { ok: result.status === 0, output }
    spawnSync('sleep', [String(attempt * 3)])
  }
  return { ok: false, output: 'GitHub لا يستجيب بعد أربع محاولات' }
}

const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const metaPath = resolve(ROOT, 'src/data/audio-meta.json')
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {}
const excludedPath = resolve(ROOT, 'podcast-audits/excluded-slugs.json')
const excluded = existsSync(excludedPath) ? JSON.parse(readFileSync(excludedPath, 'utf8')) : []
const published = Object.keys(bodies).filter((slug) => !excluded.includes(slug))

const work = remainingWork({ published, meta })
console.log('═══ قافلة الصوت ═══\n')
console.log(`  منشور            : ${published.length} مقالة`)
console.log(`  مكتملُ الصوتين    : ${published.length - work.articles}`)
console.log(`  ينقصه صوت أو صوتان: ${work.articles} مقالة · ${work.files} ملفاً`)
console.log(`  دفعاتٌ لازمة      : ${batchesNeeded(work.files, perBatch)} (كلٌّ ${perBatch} ملفاً)`)

if (!work.files) { console.log('\n✓ لا عمل — كل المقالات لها صوتاها.'); process.exit(0) }
if (!run) { console.log('\nⓘ عرضٌ فقط. أضف --run لقيادة القافلة حتى تكتمل.'); process.exit(0) }

console.log('\n── تنطلق القافلة ──\n')
let launched = 0
for (let batch = 1; batch <= batchesNeeded(work.files, perBatch); batch += 1) {
  const dispatch = gh(['api', '-X', 'POST', `repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    '-f', 'ref=main', '-f', `inputs[limit]=${perBatch}`, '-f', 'inputs[voice]=all'])
  if (!dispatch.ok) { console.log(`✘ تعذّر إطلاق الدفعة ${batch}: ${dispatch.output.slice(0, 120)}`); break }
  launched += 1
  console.log(`✓ أُطلقت الدفعة ${batch}`)
  /* لا نُطلق التالية قبل أن تنتهي السابقة: مجموعة التزامن في التشغيلة تمنع
     التوازي أصلاً، فالإطلاق المتتابع يصطفّ ولا يضيع — لكنّ الانتظار يُبقي
     السجلّ مقروءاً ويكشف العطب مبكراً. */
  if (batch < batchesNeeded(work.files, perBatch)) {
    const wait = gh(['run', 'watch', '--exit-status', '--compact'])
    if (!wait.ok) { console.log(`⚠ الدفعة ${batch} لم تنتهِ نظيفةً — أوقفتُ القافلة كي لا يُحرق الرصيد.`); break }
  }
}
console.log(`\n── أُطلقت ${launched} دفعة ──`)
