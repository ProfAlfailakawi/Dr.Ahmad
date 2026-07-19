#!/usr/bin/env node
/**
 * بوابة الإطلاق النهائية للبودكاست.
 * لا تنشر ولا ترفع شيئاً؛ تتحقق فقط من أن الحلقة المعتمدة، حالتها، بصماتها،
 * Transcript، تقرير الجودة، وRSS النهائي متطابقة وآمنة.
 *
 * الاستخدام:
 *   node scripts/podcast-release-gate.mjs --local
 *   node scripts/podcast-release-gate.mjs --dist
 *   node scripts/podcast-release-gate.mjs --local --slugs=a,b,c
 *   node scripts/podcast-release-gate.mjs --self-test
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const AUDITS = resolve(ROOT, 'podcast-audits')
const DIST = resolve(ROOT, 'dist')
const STATE = resolve(ROOT, '.podcast-state.json')
const META = resolve(ROOT, 'src/data/audio-meta.json')
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name) => (args.find((arg) => arg.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=')
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const loadJson = (file, fallback = null) => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback
const errors = []
const warnings = []
const checked = []
const fail = (message) => errors.push(message)
const warn = (message) => warnings.push(message)

function ffprobe(file) {
  const result = spawnSync(process.env.FFPROBE_BIN || 'ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=sample_rate,channels,codec_name',
    '-of', 'json', file,
  ], { encoding: 'utf8', timeout: 20_000 })
  if (result.status !== 0) throw new Error((result.stderr || 'ffprobe failed').trim())
  const json = JSON.parse(result.stdout)
  const audio = (json.streams || []).find((stream) => stream.codec_name)
  return {
    duration: Number(json.format?.duration || 0),
    size: Number(json.format?.size || 0),
    bitRate: Number(json.format?.bit_rate || 0),
    sampleRate: Number(audio?.sample_rate || 0),
    channels: Number(audio?.channels || 0),
    codec: audio?.codec_name || '',
  }
}

function normalizedArabic(text = '') {
  return String(text).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
}

function transcriptIssues(transcript) {
  const issues = []
  if (!Array.isArray(transcript?.utterances) || transcript.utterances.length < 10) issues.push('عدد المداخلات أقل من 10')
  const all = (transcript?.utterances || []).map((item) => item.text || '').join(' ')
  const dialect = [' مو ', ' ليش ', ' شلون ', ' خلنا ', ' خلّنا ', ' هني ', ' جذي ', ' وايد ', ' شنو ', ' صج ']
  const padded = ` ${normalizedArabic(all).replace(/\s+/g, ' ')} `
  const found = dialect.filter((word) => padded.includes(normalizedArabic(word)))
  if (found.length) issues.push(`عامية ممنوعة: ${found.join('، ')}`)
  const marks = (all.match(/[\u064B-\u065F\u0670]/g) || []).length
  const letters = (all.match(/[\u0621-\u064A]/g) || []).length
  if (letters && marks / letters > 0.18) issues.push('التشكيل في Transcript كثيف بصورة غير طبيعية')
  return issues
}

function auditAcceptedEpisode(slug, state, meta) {
  const entry = state?.done?.[`${slug}:ar`]
  if (!entry || entry.status !== 'accepted_automated') return fail(`${slug}: الحالة ليست accepted_automated`)
  const audio = resolve(AUDIO, `${slug}.dialogue.mp3`)
  const transcriptFile = resolve(AUDIO, `${slug}.dialogue.json`)
  const auditFile = resolve(AUDITS, `${slug}.ar.json`)
  const audioMeta = meta?.[`${slug}.dialogue.mp3`]
  const transcriptMeta = meta?.[`${slug}.dialogue.json`]

  let audioHash = ''
  let transcriptHash = ''
  let technical = null
  if (existsSync(audio)) {
    audioHash = sha256(audio)
    if (audioHash !== entry.audioHash) fail(`${slug}: بصمة MP3 المحلية لا تطابق الحالة`)
    try { technical = ffprobe(audio) } catch (error) { fail(`${slug}: ${error.message}`) }
  } else if (audioMeta?.sha256) {
    audioHash = audioMeta.sha256
    if (audioHash !== entry.audioHash) fail(`${slug}: بصمة MP3 الخارجية لا تطابق الحالة`)
    technical = {
      duration: Number(audioMeta.durationSeconds || 0), size: Number(audioMeta.bytes || 0),
      bitRate: Number(audioMeta.bitRate || 128000), sampleRate: Number(audioMeta.sampleRate || 44100),
      channels: Number(audioMeta.channels || 1), codec: 'mp3',
    }
  } else fail(`${slug}: لا MP3 محلي ولا metadata موثوقة خارجية`)

  let transcript = null
  if (existsSync(transcriptFile)) {
    transcriptHash = sha256(transcriptFile)
    transcript = loadJson(transcriptFile)
  } else if (transcriptMeta?.sha256) {
    transcriptHash = transcriptMeta.sha256
  } else fail(`${slug}: Transcript مفقود محلياً وخارجياً`)
  if (transcriptHash && transcriptHash !== entry.transcriptHash) fail(`${slug}: بصمة Transcript لا تطابق الحالة`)
  if (transcript) for (const issue of transcriptIssues(transcript)) fail(`${slug}: ${issue}`)

  const audit = loadJson(auditFile)
  if (!audit?.finalGate?.pass) fail(`${slug}: تقرير الجودة النهائي غير مجتاز`)
  const score = Number(audit?.finalGate?.score || 0)
  const minimum = Number(process.env.PODCAST_RELEASE_MIN_SCORE || 94)
  if (score < minimum) fail(`${slug}: درجة الجودة ${score}/100 أقل من ${minimum}`)
  if (technical) {
    if (!(technical.duration >= 150 && technical.duration <= 360)) fail(`${slug}: المدة ${technical.duration.toFixed(1)}ث خارج 150–360ث`)
    if (technical.size < 200_000) fail(`${slug}: حجم MP3 صغير بصورة مريبة`)
    if (technical.sampleRate && technical.sampleRate !== 44100) fail(`${slug}: Sample rate يجب أن يكون 44100Hz`)
    if (technical.channels && technical.channels !== 1) fail(`${slug}: القناة النهائية يجب أن تكون Mono`)
    if (technical.bitRate && technical.bitRate < 96000) fail(`${slug}: bitrate أقل من 96kbps`)
  }
  checked.push({ slug, score, duration: technical?.duration || 0, audioHash: audioHash.slice(0, 12) })
}

function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1])
}
const tag = (xml, name) => (xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`)) || [])[1]?.trim() || ''
const attr = (xml, name, key) => (xml.match(new RegExp(`<${name}\\s[^>]*${key}="([^"]+)"[^>]*/?>`)) || [])[1] || ''

async function validateRemoteAudio(url, expectedBytes) {
  if (!/^https:\/\//.test(url)) return fail(`رابط enclosure غير HTTPS: ${url}`)
  if (flag('offline')) return
  let response
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0', 'User-Agent': 'alfailakawi-podcast-release-gate/1.0' }, signal: AbortSignal.timeout(15000) })
      if (response.status === 206 || response.status === 200) break
    } catch (error) {
      if (attempt === 3) warn(`تعذر فحص الرابط عن بعد ${url}: ${error.message}`)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 600 * attempt))
  }
  if (!response) return
  /* حدُّ الطلبات وأعطالُ الخادم العابرة ليست روابط مكسورة: R2 يردّ 429 حين
     يُفحص مئاتُ الملفات في ثوانٍ، فتسقط تشغيلةٌ نجح فيها كل شيء. نُنبّه ولا
     نُسقط. أما 404 و410 فعطبٌ حقيقيّ يُسقط بلا تردّد. */
  if (![200, 206].includes(response.status)) {
    if ([408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
      warn(`حدُّ طلباتٍ أو عطلٌ عابر (HTTP ${response.status}) عند ${url} — لا يُعدّ رابطاً مكسوراً`)
    } else {
      fail(`رابط الصوت أعاد HTTP ${response.status}: ${url}`)
    }
  }
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (type && !type.includes('audio')) fail(`Content-Type ليس صوتياً: ${type} — ${url}`)
  if (response.status === 206 && !response.headers.get('content-range')) fail(`الخادم لا يعيد Content-Range: ${url}`)
  const length = Number(response.headers.get('content-length') || 0)
  if (response.status === 200 && expectedBytes && length && length !== expectedBytes) fail(`Content-Length لا يطابق enclosure: ${url}`)
}

async function validateDist() {
  const file = resolve(DIST, 'podcast.xml')
  if (!existsSync(file)) return fail('dist/podcast.xml مفقود')
  const xml = readFileSync(file, 'utf8')
  if (!/<rss\b/.test(xml) || !/<channel>/.test(xml)) fail('podcast.xml ليس RSS صالحاً بنيوياً')
  if (!/<atom:link\b[^>]*rel="self"/.test(xml)) fail('podcast.xml يفتقد atom:link self')
  const items = parseItems(xml)
  if (!items.length) fail('podcast.xml لا يحتوي حلقات')
  const guids = new Set()
  const urls = new Set()
  const remoteChecks = []
  for (const item of items) {
    const title = tag(item, 'title')
    const guid = tag(item, 'guid')
    const enclosure = attr(item, 'enclosure', 'url')
    const length = Number(attr(item, 'enclosure', 'length') || 0)
    const type = attr(item, 'enclosure', 'type')
    const pubDate = tag(item, 'pubDate')
    if (!title) fail('حلقة بلا عنوان')
    if (!guid) fail(`${title}: GUID مفقود`)
    if (guids.has(guid)) fail(`${title}: GUID مكرر ${guid}`)
    guids.add(guid)
    if (!enclosure) fail(`${title}: enclosure URL مفقود`)
    if (urls.has(enclosure)) fail(`${title}: enclosure URL مكرر`)
    urls.add(enclosure)
    if (!Number.isFinite(length) || length < 200_000) fail(`${title}: enclosure length غير صالح`)
    if (type !== 'audio/mpeg') fail(`${title}: enclosure type يجب أن يكون audio/mpeg`)
    if (!pubDate || Number.isNaN(Date.parse(pubDate))) fail(`${title}: pubDate غير صالح`)
    if (!/<itunes:duration>[^<]+<\/itunes:duration>/.test(item)) fail(`${title}: itunes:duration مفقود`)
    if (!/<itunes:episodeType>full<\/itunes:episodeType>/.test(item)) fail(`${title}: itunes:episodeType مفقود`)
    remoteChecks.push(validateRemoteAudio(enclosure, length))
  }
  await Promise.all(remoteChecks)
  checked.push({ feed: 'podcast.xml', items: items.length, uniqueGuids: guids.size })
}

function runSelfTest() {
  const dir = mkdtempSync(resolve(tmpdir(), 'podcast-release-gate-'))
  try {
    const transcript = { utterances: Array.from({ length: 12 }, (_, index) => ({ speaker: index % 2 ? 'نورة' : 'فهد', text: 'هذه جملة فصيحة طبيعية وواضحة.' })) }
    assert.deepEqual(transcriptIssues(transcript), [])
    transcript.utterances[0].text = 'المشكلة مو في القياس.'
    assert(transcriptIssues(transcript).some((issue) => issue.includes('عامية')))
    writeFileSync(resolve(dir, 'ok'), 'ok')
    assert.equal(sha256(resolve(dir, 'ok')).length, 64)
    console.log('✓ اختبارات بوابة الإطلاق: 4/4')
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

if (flag('self-test')) {
  runSelfTest()
  process.exit(0)
}

const state = loadJson(STATE, { done: {} })
const meta = loadJson(META, {})
if (flag('local') || !flag('dist')) {
  const requested = opt('slugs').split(',').map((value) => value.trim()).filter(Boolean)
  const slugs = requested.length ? requested : Object.entries(state.done || {})
    .filter(([key, value]) => {
      if (!key.endsWith(':ar') || value?.status !== 'accepted_automated') return false
      const slug = key.slice(0, -3)
      return existsSync(resolve(AUDIO, `${slug}.dialogue.mp3`)) || existsSync(resolve(AUDIO, `${slug}.dialogue.json`))
    })
    .map(([key]) => key.slice(0, -3))
  if (!slugs.length && !flag('allow-empty')) fail('لا توجد حلقات عربية محلية معتمدة لفحصها')
  for (const slug of slugs) auditAcceptedEpisode(slug, state, meta)
}
if (flag('dist')) await validateDist()

for (const item of checked) console.log(`✓ ${JSON.stringify(item)}`)
for (const message of warnings) console.warn(`⚠ ${message}`)
if (errors.length) {
  for (const message of errors) console.error(`✘ ${message}`)
  console.error(`\n⛔ بوابة الإطلاق مغلقة: ${errors.length} مشكلة`) 
  process.exit(2)
}
console.log(`\n✅ بوابة الإطلاق ناجحة: ${checked.length} فحصاً بلا أخطاء`)
