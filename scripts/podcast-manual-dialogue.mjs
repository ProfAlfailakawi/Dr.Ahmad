#!/usr/bin/env node
/**
 * Manual dialogue podcast renderer.
 *
 * Economical mode: the human/ChatGPT-written dialogue is supplied as JSON,
 * then the system only handles Azure TTS, timing, bridges, and review artifacts.
 * No Gemini, no publishing, no R2 upload, no Firebase writes.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { buildDialogueSsml } from './lib/arabic-audio-engine.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'review-output')
const TMP = resolve(ROOT, '.podcast-manual-tmp')
const env = { ...process.env }

if (existsSync(resolve(ROOT, '.env'))) {
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2')
  }
}

const arg = (name, fallback = '') => {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : fallback
}

const SLUG = arg('slug', 'manual-dialogue-review')
const INPUT = resolve(ROOT, arg('input', `manual-dialogues/${SLUG}.json`))
const AZURE_KEY = env.AZURE_SPEECH_KEY
const AZURE_REGION = env.AZURE_SPEECH_REGION || 'uaenorth'
const MALE = env.PODCAST_AR_MALE || 'ar-KW-FahedNeural'
const FEMALE = env.PODCAST_AR_FEMALE || 'ar-KW-NouraNeural'
const MALE_NAME = env.PODCAST_AR_MALE_NAME || 'فهد'
const FEMALE_NAME = env.PODCAST_AR_FEMALE_NAME || 'نورة'
const MUSIC = resolve(ROOT, 'music/still-light.mp3')

if (!AZURE_KEY) {
  console.error('✘ AZURE_SPEECH_KEY مفقود')
  process.exit(1)
}
if (!existsSync(INPUT)) {
  console.error(`✘ ملف الحوار غير موجود: ${INPUT}`)
  process.exit(1)
}

const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg'].find((p) => existsSync(p)) || 'ffmpeg'
const FFPROBE = ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe', 'ffprobe'].find((p) => existsSync(p)) || 'ffprobe'
const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

const run = (bin, args) => {
  const result = spawnSync(bin, args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || `${bin} failed`)
  return result.stdout
}
const ff = (args) => run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args])
const probeDur = (file) => Number(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).trim() || 0)

const delivery = {
  question: { rate: -1, pitch: 2, pause: 560 },
  statement: { rate: 0, pitch: 0, pause: 280 },
  response: { rate: 1, pitch: 0, pause: 260 },
  reflection: { rate: -5, pitch: -1, pause: 560 },
  objection: { rate: 3, pitch: 0.5, pause: 300 },
  explanation: { rate: -1, pitch: 0, pause: 360 },
  setup: { rate: 0, pitch: 0.5, pause: 260 },
  example: { rate: 1, pitch: 0.5, pause: 300 },
  emphasis: { rate: -2, pitch: -0.5, pause: 460 },
  closing: { rate: -5, pitch: -1, pause: 900 },
  briefReaction: { rate: 6, pitch: 1, pause: 210 },
  gentleObjection: { rate: 3, pitch: 0.5, pause: 300 },
  clarification: { rate: 0, pitch: 0, pause: 300 },
  conclusion: { rate: -5, pitch: -0.5, pause: 760 },
}

const normalizeJsonish = (raw) => raw
  .replace(/^\uFEFF/, '')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/\u00A0/g, ' ')

function parseDialogue() {
  const raw = normalizeJsonish(readFileSync(INPUT, 'utf8').trim())
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error(`✘ الحوار ليس JSON صالحاً بعد التنظيف: ${error.message}`)
    process.exit(1)
  }
  if (!Array.isArray(parsed) || parsed.length < 2) {
    console.error('✘ ملف الحوار يجب أن يكون مصفوفة مداخلات.')
    process.exit(1)
  }
  return parsed.map((item, index) => {
    const speaker = String(item.speaker || '').trim().toLowerCase()
    const text = String(item.text || '').trim()
    if (!['male', 'female', 'a', 'b'].includes(speaker)) throw new Error(`speaker غير صحيح في المداخلة ${index + 1}`)
    if (!text) throw new Error(`text مفقود في المداخلة ${index + 1}`)
    const type = String(item.deliveryType || 'statement').trim()
    const config = delivery[type] || delivery.statement
    return {
      speaker: speaker === 'female' || speaker === 'b' ? 'female' : 'male',
      text,
      deliveryType: type,
      pauseAfterMs: Number.isFinite(Number(item.pauseAfterMs)) ? Number(item.pauseAfterMs) : config.pause,
      overlapMs: Math.max(0, Math.min(150, Number(item.overlapMs || 0))),
      musicBridgeAfter: Boolean(item.musicBridgeAfter),
    }
  })
}

const hardDialect = ['مو', 'ليش', 'شلون', 'خلّنا', 'خلنا', 'هني', 'جذي', 'وايد', 'صج', 'شنو', 'أبي', 'تدري', 'يا معود']
function qualityWarnings(items) {
  const warnings = []
  items.forEach((item, index) => {
    for (const word of hardDialect) {
      const rx = new RegExp(`(^|[\\s،.؟!؛:])${word}([\\s،.؟!؛:]|$)`, 'u')
      if (rx.test(item.text)) warnings.push(`مداخلة ${index + 1}: كلمة عامية ممنوعة: ${word}`)
    }
    const colloquialAad = /(^|[\s،.؟!؛:])عاد(?!\s+إلى)([\s،.؟!؛:]|$)/u
    if (colloquialAad.test(item.text)) warnings.push(`مداخلة ${index + 1}: كلمة عامية ممنوعة: عاد`)
    if (item.text.length > 180) warnings.push(`مداخلة ${index + 1}: طويلة وقد تبدو مكتوبة أكثر من منطوقة.`)
    if (item.deliveryType === 'question' && !/[؟?]$/.test(item.text)) warnings.push(`مداخلة ${index + 1}: deliveryType question لكن لا تنتهي بعلامة سؤال.`)
  })
  return warnings
}

function ssmlFor(item) {
  const isMale = item.speaker === 'male'
  return buildDialogueSsml({ ...item, delivery: item.deliveryType,
    ending: item.deliveryType === 'question' ? 'open' : item.deliveryType === 'closing' ? 'final' : 'neutral' },
  isMale ? MALE : FEMALE, { voiceKey: isMale ? 'fahed' : 'noura' })
}

async function synth(item, outPath) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
        'User-Agent': 'alfailakawi-manual-dialogue',
      },
      body: ssmlFor(item),
    }).catch(() => null)
    if (res?.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 4000) {
        writeFileSync(outPath, buf)
        const trimmed = `${outPath}.trim.wav`
        ff([
          '-i', outPath,
          '-af', 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_duration=0.06:start_threshold=-42dB,areverse',
          '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', trimmed,
        ])
        writeFileSync(outPath, readFileSync(trimmed))
        rmSync(trimmed, { force: true })
        return
      }
    }
    await new Promise((done) => setTimeout(done, 1000 * attempt))
  }
  throw new Error(`فشل Azure TTS للمداخلة: ${item.text.slice(0, 50)}`)
}

function musicClip(name, duration, volume) {
  if (!existsSync(MUSIC)) return null
  const out = resolve(TMP, `${name}.wav`)
  ff([
    '-i', MUSIC,
    '-t', String(duration),
    '-af', `afade=t=in:d=0.35,afade=t=out:st=${Math.max(0.4, duration - 0.7)}:d=0.7,volume=${volume}`,
    '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', out,
  ])
  return out
}

function assemble(items, voiceFiles, outMp3) {
  const timeline = []
  let cursor = 4.15
  const intro = musicClip('intro', 4.8, 0.08)
  if (intro) timeline.push({ file: intro, start: 0, kind: 'music' })
  let bridgeCount = 0
  for (let index = 0; index < voiceFiles.length; index++) {
    const item = items[index]
    const duration = probeDur(voiceFiles[index])
    const overlap = Number(item.overlapMs || 0) / 1000
    const start = Math.max(0, cursor - overlap)
    timeline.push({ file: voiceFiles[index], start, kind: 'voice', speaker: item.speaker, text: item.text })
    cursor = start + duration + Number(item.pauseAfterMs || 260) / 1000
    if (item.musicBridgeAfter && bridgeCount < 3) {
      const bridgeDuration = bridgeCount === 0 ? 2.15 : 1.65
      const bridge = musicClip(`bridge-${bridgeCount + 1}`, bridgeDuration, bridgeCount === 0 ? 0.085 : 0.065)
      if (bridge) {
        const bridgeStart = start + duration - 0.42
        timeline.push({ file: bridge, start: bridgeStart, kind: 'bridge' })
        cursor = Math.max(cursor, bridgeStart + bridgeDuration - 0.55)
        bridgeCount++
      }
    }
  }
  const outro = musicClip('outro', 5.5, 0.07)
  if (outro) timeline.push({ file: outro, start: cursor + 0.18, kind: 'music' })
  const total = Math.max(...timeline.map((item) => item.start + probeDur(item.file))) + 0.35
  const inputs = []
  const filters = []
  timeline.forEach((item, index) => {
    inputs.push('-i', item.file)
    const delay = Math.round(item.start * 1000)
    filters.push(`[${index}:a]adelay=${delay}|${delay}[a${index}]`)
  })
  filters.push(`${timeline.map((_, index) => `[a${index}]`).join('')}amix=inputs=${timeline.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`)
  ff([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-t', total.toFixed(2), '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', outMp3])
  return { total, bridgeCount }
}

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
mkdirSync(OUT, { recursive: true })

const items = parseDialogue()
const warnings = qualityWarnings(items)
if (warnings.length) {
  console.warn(`⚠️ ${warnings.length} ملاحظة جودة في الحوار اليدوي:`)
  for (const warning of warnings.slice(0, 20)) console.warn(`- ${warning}`)
}

const voiceFiles = []
for (let index = 0; index < items.length; index++) {
  const file = resolve(TMP, `u${String(index + 1).padStart(3, '0')}.wav`)
  process.stdout.write(`🎙 ${index + 1}/${items.length}\r`)
  await synth(items[index], file)
  voiceFiles.push(file)
}
console.log('')

const outMp3 = resolve(OUT, `${SLUG}.manual-dialogue.mp3`)
const outJson = resolve(OUT, `${SLUG}.manual-dialogue.json`)
const outAudit = resolve(OUT, `${SLUG}.manual-dialogue.audit.json`)
const assembled = assemble(items, voiceFiles, outMp3)
const words = items.reduce((sum, item) => sum + item.text.split(/\s+/).filter(Boolean).length, 0)

writeFileSync(outJson, JSON.stringify({
  generatedAt: new Date().toISOString(),
  mode: 'manual-dialogue-review-only',
  source: INPUT.replace(ROOT + '/', ''),
  voices: { male: MALE, female: FEMALE, maleName: MALE_NAME, femaleName: FEMALE_NAME },
  utterances: items.map((item) => ({ speaker: item.speaker === 'male' ? MALE_NAME : FEMALE_NAME, text: item.text })),
}, null, 2))
writeFileSync(outAudit, JSON.stringify({
  generatedAt: new Date().toISOString(),
  status: 'review_only_not_published',
  reason: 'Manual dialogue mode: no Gemini was used; automatic publishing remains disabled.',
  source: INPUT.replace(ROOT + '/', ''),
  utterances: items.length,
  words,
  durationSec: +assembled.total.toFixed(1),
  averageWordsPerMinute: Math.round(words * 60 / Math.max(1, assembled.total - 9)),
  musicBridges: assembled.bridgeCount,
  warnings,
  bytes: statSync(outMp3).size,
  sha256: hashFile(outMp3),
  voices: { male: MALE, female: FEMALE, maleName: MALE_NAME, femaleName: FEMALE_NAME },
}, null, 2))
rmSync(TMP, { recursive: true, force: true })
console.log(`✅ حلقة حوار يدوي للمراجعة: ${outMp3}`)
