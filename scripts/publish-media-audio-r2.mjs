#!/usr/bin/env node
/**
 * ينقل صوت الأرشيف الإعلامي إلى R2 — حيث يسكن صوت المقالات أصلاً.
 *
 * لماذا لا يسكن الصوت في المستودع: استضافة Firebase المجانية تعطي ٣٦٠ م.ب نقلاً
 * في اليوم، فملفٌ واحد من عشرة ميغابايت يُنهي الحصة بستةٍ وثلاثين استماعاً
 * ويُسقط الموقع كله. R2 يعطي نقلاً مجانياً بلا سقف، وهو بيت الصوت المعتمد هنا.
 *
 * المصدر (MEDIA_AUDIO_SOURCE_BASE) هو ناقلٌ عابر لا مستضيف: نجلب منه الملف مرة
 * واحدة إلى الرانر ثم نرفعه إلى R2 بنوعه الصحيح (audio/mpeg)، ولا يمسّه الزائر.
 *
 * الاستخدام:
 *   npm run media:audio:r2            # ارفع الناقص وتحقّق
 *   npm run media:audio:r2:check      # تحقّق من الروابط العامة فقط، بلا مفاتيح
 *   npm run media:audio:r2:self-test  # اختبارات وحدة بلا شبكة
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARCHIVE = resolve(ROOT, 'src/data/media-archive.json')
const MIN_BYTES = 200_000
const env = process.env
const CHECK_ONLY = process.argv.includes('--check')
const SELF_TEST = process.argv.includes('--self-test')
const FORCE = process.argv.includes('--force')

/** أول ما في ملف MP3 إمّا وسم ID3 أو أول إطارٍ صوتي (0xFF ثم 0xEx/0xFx). */
export function looksLikeMp3(head) {
  if (!head || head.length < 3) return false
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true
  return head[0] === 0xff && (head[1] & 0xe0) === 0xe0
}

/** مواد الأرشيف الصوتية وحدها؛ اللقاءات المرئية تعيش على يوتيوب بلا ملفات. */
export function mediaAudioFiles(archive) {
  return (archive?.items || [])
    .filter((item) => item.audioFile && (item.kind === 'audio' || item.kind === 'radio'))
    .map((item) => ({ slug: item.slug, name: item.audioFile }))
}

if (SELF_TEST) {
  assert.equal(looksLikeMp3(Buffer.from([0x49, 0x44, 0x33])), true)
  assert.equal(looksLikeMp3(Buffer.from([0xff, 0xfb, 0x90])), true)
  assert.equal(looksLikeMp3(Buffer.from([0x3c, 0x21, 0x44])), false, 'صفحة HTML ليست صوتاً')
  assert.equal(looksLikeMp3(null), false)
  assert.deepEqual(
    mediaAudioFiles({ items: [
      { slug: 'radio-idaa', kind: 'audio', audioFile: 'idaa.mp3' },
      { slug: 'archive-x', kind: 'youtube', url: 'https://youtu.be/x' },
      { slug: 'radio-empty', kind: 'audio' },
    ] }),
    [{ slug: 'radio-idaa', name: 'idaa.mp3' }],
  )
  console.log('✓ اختبارات ناقل صوت الأرشيف: 6/6')
  process.exit(0)
}

const base = (env.AUDIO_PUBLIC_BASE_URL || env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const bucket = env.CLOUDFLARE_R2_BUCKET || env.R2_BUCKET || ''
const endpoint = env.CLOUDFLARE_R2_ENDPOINT || ''
const key = env.CLOUDFLARE_R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || ''
const secret = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || ''
const sourceBase = (env.MEDIA_AUDIO_SOURCE_BASE || 'https://github.com/ProfAlfailakawi/Dr.Ahmad/releases/download/media-audio-2026').replace(/\/+$/, '')
const awsEnv = { ...env, AWS_ACCESS_KEY_ID: key, AWS_SECRET_ACCESS_KEY: secret, AWS_DEFAULT_REGION: 'auto', AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required' }

if (!base) {
  console.error('✘ AUDIO_PUBLIC_BASE_URL مفقود؛ لا أعرف الرابط العام الذي يقرأ منه الموقع.')
  process.exit(1)
}

const files = mediaAudioFiles(JSON.parse(readFileSync(ARCHIVE, 'utf8')))
if (!files.length) {
  console.log('لا مادة صوتية في الأرشيف الإعلامي — لا شيء يُنقل.')
  process.exit(0)
}

function aws(params, { allowFailure = false, timeout = 180_000 } = {}) {
  const result = spawnSync('aws', [...params, '--endpoint-url', endpoint], { cwd: ROOT, encoding: 'utf8', env: awsEnv, timeout })
  if (!allowFailure && result.status !== 0)
    throw new Error((result.stderr || result.stdout || '').trim() || `aws ${params.join(' ')} فشل`)
  return result
}

/** الشاهد الوحيد المقبول: الرابط العام نفسه يردّ صوتاً، لا سجلٌّ يقول إنه رُفع. */
async function publicallyPlayable(name) {
  const response = await fetch(`${base}/${encodeURIComponent(name)}`, { headers: { Range: 'bytes=0-2047' } })
  if (response.status !== 200 && response.status !== 206) return { ok: false, why: `الرمز ${response.status}` }
  const type = response.headers.get('content-type') || ''
  if (!/^audio\//i.test(type)) return { ok: false, why: `النوع ${type || 'مجهول'} لا يبدأ بـaudio/` }
  const head = Buffer.from(await response.arrayBuffer())
  if (!looksLikeMp3(head)) return { ok: false, why: 'أول البايتات ليست بداية MP3' }
  return { ok: true, why: `${type} · ${response.status}` }
}

const failures = []
let uploaded = 0
let already = 0

for (const file of files) {
  const live = await publicallyPlayable(file.name)
  if (live.ok && !FORCE) {
    already += 1
    console.log(`✔ ${file.name} — حيٌّ على R2 (${live.why})`)
    continue
  }
  if (CHECK_ONLY) {
    failures.push(`${file.name}: ${live.why}`)
    console.error(`✘ ${file.name} — ${live.why}`)
    continue
  }
  if (!bucket || !endpoint || !key || !secret) {
    console.error('✘ مفاتيح R2 ناقصة؛ لا يمكن الرفع. (شغّل هذا من داخل GitHub Actions حيث الأسرار محفوظة.)')
    process.exit(1)
  }
  const temp = resolve(mkdtempSync(resolve(tmpdir(), 'media-audio-')), file.name)
  const source = `${sourceBase}/${encodeURIComponent(file.name)}`
  const response = await fetch(source, { redirect: 'follow' })
  if (!response.ok) { failures.push(`${file.name}: تعذّر الجلب من المصدر (${response.status})`); continue }
  writeFileSync(temp, Buffer.from(await response.arrayBuffer()))
  const bytes = statSync(temp).size
  const head = readFileSync(temp).subarray(0, 4)
  /* المصدر قد يردّ صفحة خطأ بدل الملف؛ لا نرفع إلى R2 إلا ما ثبت أنه صوتٌ حقيقي. */
  if (bytes < MIN_BYTES || !looksLikeMp3(head)) {
    failures.push(`${file.name}: المجلوب ليس MP3 صالحاً (${bytes} بايت)`)
    continue
  }
  aws([
    's3', 'cp', temp, `s3://${bucket}/${file.name}`,
    '--cache-control', 'public, max-age=31536000, immutable',
    '--content-type', 'audio/mpeg',
    '--no-progress',
  ])
  const verified = await publicallyPlayable(file.name)
  if (!verified.ok) { failures.push(`${file.name}: رُفع ولم يُقرأ عاماً (${verified.why})`); continue }
  uploaded += 1
  console.log(`↑ ${file.name} — رُفع إلى R2 وتحقّق (${(bytes / 1024 / 1024).toFixed(1)} م.ب · ${verified.why})`)
}

console.log(`\nالخلاصة: ${uploaded} مرفوعاً · ${already} كان حياً · ${failures.length} متعثراً`)
if (failures.length) {
  for (const failure of failures) console.error(`✘ ${failure}`)
  process.exit(1)
}
