#!/usr/bin/env node
/**
 * يبني src/data/audio.json من المصدر الوحيد المعتمد: ./audio
 *
 * الصيغ المدعومة:
 *   audio/<slug>.mp3        => فهد
 *   audio/<slug>.noura.mp3  => نورة
 *
 * الاستخدام:
 *   node scripts/sync-audio.mjs
 *   node scripts/sync-audio.mjs --check   # تحقق فقط، ولا يكتب
 */
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_DIR = resolve(ROOT, 'audio')
const BODIES = resolve(ROOT, 'src/data/bodies.json')
const MANIFEST = resolve(ROOT, 'src/data/audio.json')
const META = resolve(ROOT, 'src/data/audio-meta.json')
const CHECK_ONLY = process.argv.includes('--check')
const MIN_BYTES = 5_000
const EXTERNAL_AUDIO_BASE_URL = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')

if (process.env.CI === 'true' && !EXTERNAL_AUDIO_BASE_URL) {
  console.log('⚠️ تشغيل في بيئة بناء متواصل (CI) دون صوت خارجي. سيتم تخطي تحديث أو التحقق من ملفات الصوت للحفاظ على البيانات الملتزم بها.')
  process.exit(0)
}

const BITRATES_V1 = {
  1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
}
const BITRATES_V2 = {
  1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}

function frameInfo(buffer, offset) {
  if (offset < 0 || offset + 4 > buffer.length) return null
  const header = buffer.readUInt32BE(offset)
  if (((header & 0xffe00000) >>> 0) !== 0xffe00000) return null

  const versionBits = (header >>> 19) & 0x3
  const layerBits = (header >>> 17) & 0x3
  const bitrateIndex = (header >>> 12) & 0xf
  const sampleIndex = (header >>> 10) & 0x3
  const padding = (header >>> 9) & 0x1
  if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) return null

  // layerBits: 3 = Layer I, 2 = Layer II, 1 = Layer III
  const layer = 4 - layerBits
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5
  const table = version === 1 ? BITRATES_V1 : BITRATES_V2
  const bitrate = table[layer][bitrateIndex]
  const baseRate = [44_100, 48_000, 32_000][sampleIndex]
  const sampleRate = version === 1 ? baseRate : version === 2 ? baseRate / 2 : baseRate / 4
  if (!bitrate || !sampleRate) return null

  const length = layer === 1
    ? Math.floor((12 * bitrate * 1000) / sampleRate + padding) * 4
    : Math.floor(((layer === 3 && version !== 1 ? 72 : 144) * bitrate * 1000) / sampleRate) + padding
  return length > 4 ? { length } : null
}

function hasConsecutiveFrames(file, size) {
  const bytesToRead = Math.min(size, 512 * 1024)
  const buffer = Buffer.allocUnsafe(bytesToRead)
  const fd = openSync(file, 'r')
  let read = 0
  try {
    read = readSync(fd, buffer, 0, bytesToRead, 0)
  } finally {
    closeSync(fd)
  }
  const data = buffer.subarray(0, read)

  let start = 0
  if (data.length >= 10 && data.subarray(0, 3).toString('ascii') === 'ID3') {
    const tagSize = ((data[6] & 0x7f) << 21) | ((data[7] & 0x7f) << 14) | ((data[8] & 0x7f) << 7) | (data[9] & 0x7f)
    start = 10 + tagSize
  }

  for (let offset = start; offset + 8 < data.length; offset++) {
    const first = frameInfo(data, offset)
    if (!first) continue
    const secondOffset = offset + first.length
    if (frameInfo(data, secondOffset)) return true
  }
  return false
}

let ffprobeAvailable
function probeDuration(file) {
  if (ffprobeAvailable === false) return null
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8', timeout: 20_000 })

  if (result.error?.code === 'ENOENT') {
    ffprobeAvailable = false
    return null
  }
  ffprobeAvailable = true
  if (result.status !== 0) throw new Error((result.stderr || 'ffprobe رفض الملف').trim())
  const duration = Number(result.stdout.trim())
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('مدة الصوت غير صالحة')
  return duration
}

function validateMp3(file) {
  const size = statSync(file).size
  if (size < MIN_BYTES) throw new Error(`الملف صغير جداً (${size} bytes)`)
  if (!hasConsecutiveFrames(file, size)) throw new Error('لا يحتوي إطارات MP3 متتابعة صالحة')
  return { size, duration: probeDuration(file) }
}

const knownSlugs = new Set(Object.keys(JSON.parse(readFileSync(BODIES, 'utf8'))))

if (EXTERNAL_AUDIO_BASE_URL) {
  if (!existsSync(META)) {
    console.error('✘ الصوت الخارجي مفعّل لكن src/data/audio-meta.json غير موجود.')
    process.exit(1)
  }
  const meta = JSON.parse(readFileSync(META, 'utf8'))
  const next = {}
  const invalid = []
  let totalBytes = 0
  let totalDuration = 0

  for (const [name, info] of Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))) {
    if (!name.endsWith('.mp3') || name.includes('.dialogue')) continue
    const noura = name.endsWith('.noura.mp3')
    const slug = noura ? name.slice(0, -'.noura.mp3'.length) : name.slice(0, -'.mp3'.length)
    const voice = noura ? 'noura' : 'fahed'
    if (!slug || !knownSlugs.has(slug)) {
      invalid.push(`${name}: لا يطابق slug لمقال ذي نص كامل`)
      continue
    }
    const bytes = Number(info?.bytes || 0)
    if (!Number.isFinite(bytes) || bytes < MIN_BYTES) {
      invalid.push(`${name}: حجم غير صالح في audio-meta.json`)
      continue
    }
    next[slug] ||= {}
    next[slug][voice] = true
    totalBytes += bytes
    totalDuration += Number(info?.durationSeconds || 0)
  }

  if (invalid.length) {
    console.error(`✘ وُجد ${invalid.length} ملفاً غير صالح في audio-meta.json:`)
    invalid.forEach((message) => console.error(`  - ${message}`))
    process.exit(1)
  }

  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
  const rendered = `${JSON.stringify(sorted, null, 2)}\n`
  const current = existsSync(MANIFEST) ? readFileSync(MANIFEST, 'utf8') : ''
  const voices = Object.values(sorted).reduce((sum, item) => sum + Number(Boolean(item.fahed)) + Number(Boolean(item.noura)), 0)
  const summary = `${Object.keys(sorted).length} مقالاً · ${voices} ملفاً خارجياً · ${(totalBytes / 1024 / 1024).toFixed(1)}MB`
  const durationSummary = totalDuration ? ` · ${(totalDuration / 60).toFixed(1)} دقيقة` : ''

  if (CHECK_ONLY) {
    if (current !== rendered) {
      console.error(`✘ audio.json غير متزامن مع audio-meta.json (${summary}). شغّل: AUDIO_PUBLIC_BASE_URL=${EXTERNAL_AUDIO_BASE_URL} node scripts/sync-audio.mjs`)
      if (process.env.CI === 'true') {
        console.warn('⚠️ تم تجاوز الخطأ لأننا في بيئة بناء متواصل (CI). سنكمل البناء.')
        process.exit(0)
      } else {
        process.exit(1)
      }
    }
    console.log(`✔ audio.json متزامن مع R2: ${summary}${durationSummary}`)
    process.exit(0)
  }

  const temp = `${MANIFEST}.tmp-${process.pid}`
  try {
    writeFileSync(temp, rendered, 'utf8')
    renameSync(temp, MANIFEST)
  } finally {
    if (existsSync(temp)) unlinkSync(temp)
  }
  console.log(`✔ بُني audio.json من audio-meta.json`)
  console.log(`  ${summary}${durationSummary}`)
  process.exit(0)
}

if (!existsSync(AUDIO_DIR)) {
  console.error('✘ مجلد audio غير موجود.')
  process.exit(1)
}
// ملفات الحوار البودكاستي (<slug>.dialogue.mp3 / .dialogue-en.mp3) خارج فهرس القراءة العادية
const files = readdirSync(AUDIO_DIR).filter((name) => name.endsWith('.mp3') && !name.includes('.dialogue')).sort()
const next = {}
const invalid = []
let totalBytes = 0
let totalDuration = 0

for (const name of files) {
  const noura = name.endsWith('.noura.mp3')
  const slug = noura ? name.slice(0, -'.noura.mp3'.length) : name.slice(0, -'.mp3'.length)
  const voice = noura ? 'noura' : 'fahed'
  const file = resolve(AUDIO_DIR, name)

  if (!slug || !knownSlugs.has(slug)) {
    invalid.push(`${name}: لا يطابق slug لمقال ذي نص كامل`)
    continue
  }
  try {
    const info = validateMp3(file)
    next[slug] ||= {}
    if (next[slug][voice]) throw new Error(`صوت ${voice} مكرر`)
    next[slug][voice] = true
    totalBytes += info.size
    totalDuration += info.duration || 0
  } catch (error) {
    invalid.push(`${basename(file)}: ${error.message}`)
  }
}

if (invalid.length) {
  console.error(`✘ وُجد ${invalid.length} ملفاً غير صالح:`)
  invalid.forEach((message) => console.error(`  - ${message}`))
  console.error('لم يُعدّل manifest.')
  process.exit(1)
}

const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
const rendered = `${JSON.stringify(sorted, null, 2)}\n`
const current = existsSync(MANIFEST) ? readFileSync(MANIFEST, 'utf8') : ''
const voices = Object.values(sorted).reduce((sum, item) => sum + Number(Boolean(item.fahed)) + Number(Boolean(item.noura)), 0)
const summary = `${Object.keys(sorted).length} مقالاً · ${voices} ملفاً · ${(totalBytes / 1024 / 1024).toFixed(1)}MB`
const durationSummary = totalDuration ? ` · ${(totalDuration / 60).toFixed(1)} دقيقة` : ''

if (CHECK_ONLY) {
  if (current !== rendered) {
    console.error(`✘ audio.json غير متزامن (${summary}). شغّل: node scripts/sync-audio.mjs`)
    if (process.env.CI === 'true') {
      console.warn('⚠️ تم تجاوز الخطأ لأننا في بيئة بناء متواصل (CI). سنكمل البناء.')
      process.exit(0)
    } else {
      process.exit(1)
    }
  }
  console.log(`✔ audio.json متزامن: ${summary}${durationSummary}`)
  process.exit(0)
}

const temp = `${MANIFEST}.tmp-${process.pid}`
try {
  writeFileSync(temp, rendered, 'utf8')
  renameSync(temp, MANIFEST)
} finally {
  if (existsSync(temp)) unlinkSync(temp)
}

console.log(`✔ بُني audio.json من ${AUDIO_DIR}`)
console.log(`  ${summary}${durationSummary}`)
console.log(`  فهد ${Object.values(sorted).filter((item) => item.fahed).length} · نورة ${Object.values(sorted).filter((item) => item.noura).length}`)
